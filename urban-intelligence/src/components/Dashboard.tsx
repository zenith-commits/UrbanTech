import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Bus, UrbanEvent, Detection, KPIMetrics, SystemStatus, ComponentStatusLabel } from '../types';
import { useWebcam } from '../hooks/useWebcam';
import { useGeolocation } from '../hooks/useGeolocation';
import { useDetectionSimulation } from '../hooks/useDetectionSimulation';
import { useObjectDetection } from '../hooks/useObjectDetection';
import { useUrbanEvents } from '../hooks/useUrbanEvents';
import { DetectionEventCoordinator, buildRealDetectionEvent, cooldownForClass } from '../inference/detectionEvents';
import {
  generateMockBuses,
  generateInitialEvents,
  generateMockEvent,
  getInitialAnalytics,
  getInitialSystemStatus,
} from '../data/mockData';
import { Header } from './Header';
import { KPIStrip } from './KPIStrip';
import { LiveMap } from './LiveMap';
import { WebcamPanel } from './WebcamPanel';
import type { DetectionMode } from './WebcamPanel';
import { EventFeed } from './EventFeed';
import { EventDetails } from './EventDetails';
import { NeedsAttention } from './NeedsAttention';
import { FleetPanel } from './FleetPanel';
import { Analytics } from './Analytics';
import { SystemStatusPanel } from './SystemStatusPanel';
import { GPSStatus } from './GPSStatus';
import { CameraStatus } from './CameraStatus';

const isDev = import.meta.env.DEV;
function devLog(...args: unknown[]) {
  if (isDev) console.log('[AI]', ...args);
}

const DEFAULT_BUS_ID = 'BUS-01';

const HAZARD_CLASSES = [
  'pothole',
  'road_damage',
  'waterlogging',
  'damaged_sign',
  'missing_divider',
  'zebra_crossing',
];

export function Dashboard() {
  // --- Shared fleet state (single source of truth for vehicles) ---
  const [buses, setBuses] = useState<Bus[]>(() => generateMockBuses());
  const [activeBusId, setActiveBusId] = useState<string>(DEFAULT_BUS_ID);
  const [focusedBusId, setFocusedBusId] = useState<string | null>(DEFAULT_BUS_ID);

  const activeBus = buses.find(b => b.id === activeBusId) || buses[0] || null;

  // --- AI mode control ---
  const [detectionMode, setDetectionMode] = useState<DetectionMode>('off');
  const [aiPaused, setAiPaused] = useState(false);
  const [threshold, setThreshold] = useState(0.25);
  const [detectionsToday, setDetectionsToday] = useState(64);

  // --- Real webcam ---
  const {
    isActive: cameraActive,
    isLoading: cameraLoading,
    videoReady: cameraVideoReady,
    error: cameraError,
    facingMode,
    videoWidth,
    videoHeight,
    deviceLabel,
    startCamera,
    stopCamera,
    switchCamera,
    videoRef,
  } = useWebcam();

  // --- Real GPS (with clearly-labelled demo fallback) ---
  const {
    position: gpsPosition,
    isWatching: gpsWatching,
    error: gpsError,
    startWatching,
    stopWatching,
    requestPermission,
    isUsingFallback,
  } = useGeolocation();

  // Keep the active bus anchored to the live (or demo) GPS fix
  useEffect(() => {
    if (!gpsPosition) return;
    setBuses(prev =>
      prev.map(bus =>
        bus.id === activeBusId
          ? {
              ...bus,
              position: gpsPosition,
              gpsStatus: gpsPosition.isReal ? 'LOCKED' : 'SEARCHING',
            }
          : bus
      )
    );
  }, [gpsPosition, activeBusId]);

  // --- Shared event store (single source of truth for events / alerts) ---
  const initialEvents = useMemo(() => generateInitialEvents(buses), [buses]);
  const urban = useUrbanEvents(initialEvents);

  const { events, alerts, selectedEventId, selectEvent, verifyEvent, createMaintenanceAlert, dismissAlert, clearEvents } = urban;
  const selectedEvent: UrbanEvent | null = events.find(e => e.id === selectedEventId) || null;

  // --- Real AI object detection (ONNX Runtime Web) ---
  const coordinatorRef = useRef(new DetectionEventCoordinator());

  const handleRealDetections = useCallback(
    (dets: Detection[]) => {
      if (dets.length === 0) return;
      const sustained = coordinatorRef.current.update(dets);
      const pos = gpsPosition || activeBus?.position || null;
      if (!pos) return;
      for (const det of sustained) {
        const cd = cooldownForClass(det.className);
        if (coordinatorRef.current.shouldEmit(det.className, cd)) {
          const event = buildRealDetectionEvent(det, pos, activeBusId);
          urban.addEvent(event);
          setDetectionsToday(prev => prev + 1);
          devLog('real event:', event.type, event.subtype, Math.round(event.confidence * 100) + '%');
        }
      }
    },
    [gpsPosition, activeBus, activeBusId, urban],
  );

  const realDetection = useObjectDetection({
    active: detectionMode === 'real',
    paused: detectionMode === 'real' && aiPaused,
    videoRef,
    threshold,
    onDetections: handleRealDetections,
    targetFps: 12,
  });

  devLog('real model:', realDetection.modelState, realDetection.backend ?? '...', 'loading:', realDetection.isLoading);

  // --- Frontend AI detection simulation over the real webcam ---
  const simActive = detectionMode === 'demo' && cameraActive && !aiPaused;

  const handleDetectionFrame = useCallback(
    (dets: Detection[]) => {
      if (dets.length === 0) return;
      setDetectionsToday(prev => prev + dets.length);

      const pos = gpsPosition || activeBus?.position || null;
      if (!pos) return;

      // Occasionally promote a hazard-class detection into a meaningful urban event.
      if (Math.random() < 0.3) {
        const hazardDetections = dets.filter(d => HAZARD_CLASSES.includes(d.className));
        const sourceDet = hazardDetections[0] || dets[0];
        const event = generateMockEvent(activeBusId, pos, dets.slice(0, 3).map(d => d.id));
        event.confidence = Math.max(event.confidence, sourceDet.confidence - 0.1);
        urban.addEvent(event);
      }
    },
    [gpsPosition, activeBus, activeBusId, urban],
  );

  const simulation = useDetectionSimulation(simActive, 1600, handleDetectionFrame);

  const activeDetections: Detection[] =
    detectionMode === 'real' ? realDetection.detections : detectionMode === 'demo' ? simulation.detections : [];

  // --- Mode selection handler: click to activate (auto-starts camera if needed) ---
  const handleSetDetectionMode = useCallback(
    (mode: DetectionMode) => {
      setDetectionMode(prev => {
        const next = prev === mode ? 'off' : mode;
        if (next !== 'off' && !cameraActive) {
          startCamera();
        }
        return next;
      });
    },
    [cameraActive, startCamera],
  );

  // --- Derived status ---
  const gpsStatus: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'ERROR' =
    gpsError && !isUsingFallback
      ? 'ERROR'
      : gpsWatching && !isUsingFallback
        ? 'CONNECTED'
        : gpsWatching && isUsingFallback
          ? 'CONNECTING'
          : 'DISCONNECTED';

  const isDemoGPS = !gpsPosition || !gpsPosition.isReal || isUsingFallback;

  const systemStatus = useMemo(
    () => getInitialSystemStatus(cameraActive, gpsWatching && !isUsingFallback),
    [cameraActive, gpsWatching, isUsingFallback],
  );

  const liveSystemStatus: SystemStatus = useMemo(() => {
    const aiStatus: ComponentStatusLabel =
      detectionMode === 'real'
        ? realDetection.modelState === 'ready'
          ? 'RUNNING'
          : realDetection.modelState === 'loading'
            ? 'CONNECTING'
            : realDetection.modelState === 'error'
              ? 'ERROR'
              : 'DISCONNECTED'
        : detectionMode === 'demo'
          ? simActive
            ? 'RUNNING'
            : 'STANDBY'
          : 'DISCONNECTED';

    const aiDetails =
      detectionMode === 'real'
        ? realDetection.modelState === 'ready'
          ? `${realDetection.backend?.toUpperCase() ?? '?'} BACKEND — MODEL LOADED`
          : realDetection.modelState === 'loading'
            ? 'ONNX Runtime loading model...'
            : realDetection.modelError ?? 'Model not active'
        : detectionMode === 'demo'
          ? 'Frontend simulation active'
          : 'Select DEMO AI or LIVE AI';

    return {
      ...systemStatus,
      camera: {
        ...systemStatus.camera,
        status: cameraActive && cameraVideoReady ? 'CONNECTED' : cameraActive ? 'CONNECTING' : 'DISCONNECTED',
        details: cameraActive && cameraVideoReady
          ? `${videoWidth}x${videoHeight} stream`
          : cameraActive
            ? 'Waiting for video'
            : 'Click START CAMERA',
      },
      aiEngine: {
        ...systemStatus.aiEngine,
        status: aiStatus,
        details: aiDetails,
      },
      eventPipeline: {
        ...systemStatus.eventPipeline,
        status: detectionMode !== 'off' ? 'ACTIVE' : 'STANDBY',
        details: `${events.length} events processed`,
      },
      map: {
        ...systemStatus.map,
      },
    };
  }, [
    systemStatus, detectionMode, simActive, cameraActive, cameraVideoReady, videoWidth, videoHeight,
    realDetection.modelState, realDetection.modelError, realDetection.backend, events.length,
  ]);

  const kpis = useMemo(
    () => computeKPIs(events, detectionsToday, buses),
    [events, detectionsToday, buses],
  );

  const analytics = useMemo(() => getInitialAnalytics(), []);

  // --- GPS auto-fallback on error ---
  useEffect(() => {
    if (gpsError && !isUsingFallback && !gpsWatching) {
      const timer = setTimeout(() => startWatching(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [gpsError, isUsingFallback, gpsWatching, startWatching]);

  // --- Handlers ---
  const handleSelectBus = useCallback(
    (busId: string) => {
      setActiveBusId(busId);
      setFocusedBusId(busId);
      selectEvent(null);
    },
    [selectEvent],
  );

  const handleSelectEvent = useCallback(
    (eventId: string) => {
      selectEvent(eventId);
      setFocusedBusId(null);
    },
    [selectEvent],
  );

  const handleMapSelectEvent = useCallback(
    (event: UrbanEvent) => handleSelectEvent(event.id),
    [handleSelectEvent],
  );

  const handleVerifyEvent = useCallback(
    (eventId: string) => verifyEvent(eventId),
    [verifyEvent],
  );

  const handleCreateMaintenanceAlert = useCallback(
    (eventId: string) => createMaintenanceAlert(eventId),
    [createMaintenanceAlert],
  );

  const handleTogglePause = useCallback(() => {
    setAiPaused(prev => !prev);
  }, []);

  const handleToggleDemoGPS = useCallback(() => {
    if (isUsingFallback) {
      startWatching(false);
    } else {
      stopWatching();
      startWatching(true);
    }
  }, [isUsingFallback, startWatching, stopWatching]);

  const handleRequestGPSPermission = useCallback(async () => {
    try {
      await requestPermission();
      startWatching(false);
    } catch {
      startWatching(true);
    }
  }, [requestPermission, startWatching]);

  return (
    <div className="min-h-screen bg-navy-900 text-white font-sans">
      <Header
        gpsPosition={activeBus?.position || gpsPosition || null}
        gpsStatus={gpsStatus}
        cameraStatus={cameraActive && cameraVideoReady ? 'CONNECTED' : cameraActive ? 'CONNECTING' : 'DISCONNECTED'}
        isDemoGPS={isDemoGPS}
      />

      <KPIStrip metrics={kpis} />

      <main className="p-3 lg:p-6 space-y-4 lg:space-y-6 max-w-[1800px] mx-auto">
        {/* Top Row: Map + Camera/Events */}
        <div className="grid lg:grid-cols-12 gap-4 lg:gap-6">
          {/* Map - 8 cols */}
          <div className="lg:col-span-8 min-h-[520px]">
            <LiveMap
              activeBus={activeBus}
              buses={buses}
              events={events}
              selectedEvent={selectedEvent}
              focusedBusId={focusedBusId}
              isDemoGPS={isDemoGPS}
              onSelectEvent={handleMapSelectEvent}
            />
          </div>

          {/* Right Panel - 4 cols */}
          <div className="lg:col-span-4 space-y-4">
            {/* Webcam */}
            <div className="space-y-3">
              <WebcamPanel
                detectionMode={detectionMode}
                isActive={cameraActive}
                isLoading={cameraLoading}
                videoReady={cameraVideoReady}
                error={cameraError}
                detections={activeDetections}
                stats={realDetection.stats}
                simFps={simulation.fps}
                simRunning={simActive}
                aiRunning={detectionMode !== 'off' && !aiPaused}
                modelState={realDetection.modelState}
                modelError={realDetection.modelError}
                modelBackend={realDetection.backend}
                potholeAvailable={realDetection.potholeAvailable}
                threshold={threshold}
                onThresholdChange={setThreshold}
                onToggleSimulation={handleTogglePause}
                onStartCamera={() => { startCamera(); }}
                videoRef={videoRef}
              />

              <CameraStatus
                isActive={cameraActive}
                isLoading={cameraLoading}
                videoReady={cameraVideoReady}
                error={cameraError}
                facingMode={facingMode}
                deviceLabel={deviceLabel}
                onStart={() => { startCamera(); }}
                onStop={stopCamera}
                onSwitch={() => { switchCamera(); }}
              />
            </div>

            {/* Event Feed */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="font-medium text-white">LIVE EVENTS</span>
                <span className="text-xs text-navy-400 font-mono">{events.length} TOTAL</span>
              </div>
              <EventFeed
                events={events}
                selectedEventId={selectedEventId}
                onSelectEvent={handleSelectEvent}
                maxEvents={15}
              />
            </div>

            {selectedEvent && (
              <EventDetails
                event={selectedEvent}
                onVerify={handleVerifyEvent}
                onCreateMaintenanceAlert={handleCreateMaintenanceAlert}
                onClose={() => selectEvent(null)}
              />
            )}
          </div>
        </div>

        {/* Bottom Row: Analytics + Panels */}
        <div className="grid lg:grid-cols-12 gap-4 lg:gap-6">
          <div className="lg:col-span-8">
            <Analytics data={analytics} />
          </div>

          <div className="lg:col-span-4 space-y-4">
            <FleetPanel
              buses={buses}
              activeBusId={activeBusId}
              onSelectBus={handleSelectBus}
            />

            <NeedsAttention
              alerts={alerts}
              onSelectAlert={(alert) => {
                if (events.some(e => e.id === alert.eventId)) {
                  handleSelectEvent(alert.eventId);
                }
              }}
              onDismiss={dismissAlert}
            />

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              <GPSStatus
                position={gpsPosition}
                isWatching={gpsWatching}
                error={isUsingFallback ? 'Using demo GPS (Delhi)' : gpsError}
                isDemo={isUsingFallback || !gpsPosition}
                onRequestPermission={handleRequestGPSPermission}
                onToggleDemo={handleToggleDemoGPS}
              />
              <SystemStatusPanel status={liveSystemStatus} />
            </div>

            {/* AI Mode Controls */}
            <div className="bg-navy-800/50 border border-navy-600 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-white">AI MODE</span>
                <span
                  className={`text-xs font-mono px-2 py-0.5 rounded border ${
                    detectionMode === 'real'
                      ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                      : detectionMode === 'demo'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        : 'bg-navy-700 text-navy-400 border-navy-600'
                  }`}
                >
                  {detectionMode === 'real' ? 'LIVE AI' : detectionMode === 'demo' ? 'DEMO AI' : 'AI OFF'}
                </span>
              </div>

              <div className="flex gap-1 p-1 bg-navy-900 rounded border border-navy-600">
                {(['off', 'demo', 'real'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => handleSetDetectionMode(mode)}
                    className={`flex-1 py-2 px-2 rounded text-xs font-mono font-medium transition-colors ${
                      detectionMode === mode
                        ? mode === 'real'
                          ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-300'
                          : mode === 'demo'
                            ? 'bg-amber-500/20 border border-amber-500/30 text-amber-300'
                            : 'bg-navy-700 border border-navy-600 text-navy-300'
                        : 'border border-transparent text-navy-400 hover:text-navy-300'
                    }`}
                  >
                    {mode === 'off' ? 'OFF' : mode === 'demo' ? 'DEMO AI' : 'LIVE AI'}
                  </button>
                ))}
              </div>

              {detectionMode === 'real' && realDetection.potholeAvailable && (
                <p className="mt-2 text-[11px] text-rose-400/80 font-mono">
                  POTHOLE MODEL LOADED — sustained potholes will be flagged as events
                </p>
              )}

              {detectionMode !== 'off' && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleTogglePause}
                    className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                      aiPaused
                        ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30'
                        : 'bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30'
                    }`}
                  >
                    {aiPaused ? 'RESUME AI' : 'PAUSE AI'}
                  </button>
                  <button
                    onClick={() => { setDetectionsToday(0); clearEvents(); }}
                    className="flex-1 px-3 py-2 rounded text-sm font-medium bg-navy-700 border border-navy-600 text-navy-300 hover:bg-navy-600 transition-colors"
                  >
                    CLEAR ALL
                  </button>
                </div>
              )}

              <p className="mt-3 text-xs text-navy-400">
                {detectionMode === 'off'
                  ? 'Select DEMO AI for simulated detections, or LIVE AI for real camera-based ONNX inference.'
                  : detectionMode === 'demo'
                    ? 'Demo mode uses the frontend detection simulation. Real webcam and GPS remain independent.'
                    : 'Real AI runs YOLOv8n locally in the browser via ONNX Runtime Web (WASM/WebGPU).'}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function computeKPIs(events: UrbanEvent[], detectionsToday: number, buses: Bus[]): KPIMetrics {
  const roadHazards = events.filter(
    e => e.type === 'pothole' || e.type === 'road_damage' || e.type === 'waterlogging'
  ).length;
  const activeAlerts = events.filter(e => e.status === 'UNVERIFIED').length;
  const avgConfidence =
    events.length > 0
      ? Math.round((events.reduce((sum, e) => sum + e.confidence, 0) / events.length) * 100 * 10) / 10
      : 0;

  return {
    activeBuses: buses.filter(b => b.status === 'LIVE').length,
    detectionsToday,
    roadHazards,
    activeAlerts,
    avgConfidence,
  };
}
