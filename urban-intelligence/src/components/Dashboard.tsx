import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Bus, GPSPosition, UrbanEvent, Detection, KPIMetrics, SystemStatus, ComponentStatusLabel } from '../types';
import { useWebcam } from '../hooks/useWebcam';
import { useGeolocation } from '../hooks/useGeolocation';
import { useDetectionSimulation } from '../hooks/useDetectionSimulation';
import { useUrbanEvents } from '../hooks/useUrbanEvents';
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
import { EventFeed } from './EventFeed';
import { EventDetails } from './EventDetails';
import { NeedsAttention } from './NeedsAttention';
import { FleetPanel } from './FleetPanel';
import { Analytics } from './Analytics';
import { SystemStatusPanel } from './SystemStatusPanel';
import { GPSStatus } from './GPSStatus';
import { CameraStatus } from './CameraStatus';

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

  // --- Demo / simulation control ---
  const [demoMode, setDemoMode] = useState(false);
  const [aiPaused, setAiPaused] = useState(false);
  const [detectionsToday, setDetectionsToday] = useState(64);

  // --- Real webcam ---
  const {
    stream,
    isActive: cameraActive,
    isLoading: cameraLoading,
    error: cameraError,
    facingMode,
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

  const busPosition: GPSPosition | null = gpsPosition || activeBus?.position || null;

  // --- Shared event store (single source of truth for events / alerts) ---
  const initialEvents = useMemo(() => generateInitialEvents(buses), [buses]);
  const urban = useUrbanEvents(initialEvents);

  const { events, alerts, selectedEventId, selectEvent, verifyEvent, createMaintenanceAlert, dismissAlert, clearEvents } = urban;
  const selectedEvent: UrbanEvent | null = events.find(e => e.id === selectedEventId) || null;

  // --- Frontend AI detection simulation over the real webcam ---
  const simulateEnabled = cameraActive && demoMode && !aiPaused;

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
    [gpsPosition, activeBus, activeBusId, urban]
  );

  const simulation = useDetectionSimulation(simulateEnabled, 1600, handleDetectionFrame);

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
    [cameraActive, gpsWatching, isUsingFallback]
  );

  const liveSystemStatus: SystemStatus = useMemo(() => {
    const aiStatus: ComponentStatusLabel = simulateEnabled ? 'RUNNING' : 'DISCONNECTED';
    const pipelineStatus: ComponentStatusLabel = simulateEnabled ? 'ACTIVE' : 'STANDBY';
    const mapStatus: ComponentStatusLabel = simulateEnabled ? 'ACTIVE' : 'ONLINE';

    return {
      ...systemStatus,
      aiEngine: {
        ...systemStatus.aiEngine,
        status: aiStatus,
        details: simulateEnabled
          ? 'Frontend detection simulation active'
          : 'Requires camera + demo mode',
      },
      eventPipeline: {
        ...systemStatus.eventPipeline,
        status: pipelineStatus,
        details: `${events.length} events processed`,
      },
      map: {
        ...systemStatus.map,
        status: mapStatus,
      },
    };
  }, [systemStatus, simulateEnabled, events.length]);

  const kpis = useMemo(
    () => computeKPIs(events, detectionsToday, buses),
    [events, detectionsToday, buses]
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
    [selectEvent]
  );

  const handleSelectEvent = useCallback(
    (eventId: string) => {
      selectEvent(eventId);
      setFocusedBusId(null);
    },
    [selectEvent]
  );

  const handleMapSelectEvent = useCallback(
    (event: UrbanEvent) => handleSelectEvent(event.id),
    [handleSelectEvent]
  );

  const handleVerifyEvent = useCallback(
    (eventId: string) => verifyEvent(eventId),
    [verifyEvent]
  );

  const handleCreateMaintenanceAlert = useCallback(
    (eventId: string) => createMaintenanceAlert(eventId),
    [createMaintenanceAlert]
  );

  const handleToggleDemo = useCallback(() => {
    setDemoMode(prev => !prev);
  }, []);

  const handleToggleSimulation = useCallback(() => {
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
        cameraStatus={cameraActive ? 'CONNECTED' : 'DISCONNECTED'}
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
                stream={stream}
                isActive={cameraActive}
                error={cameraError}
                detections={simulation.detections}
                fps={simulation.fps}
                isSimulationRunning={simulateEnabled}
                onToggleSimulation={handleToggleSimulation}
                videoRef={videoRef}
              />

              <CameraStatus
                isActive={cameraActive}
                isLoading={cameraLoading}
                error={cameraError}
                facingMode={facingMode}
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

            {/* Demo Controls */}
            <div className="bg-navy-800/50 border border-navy-600 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-white">DEMO CONTROLS</span>
                <span
                  className={`text-xs font-mono px-2 py-0.5 rounded border ${
                    demoMode
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                  }`}
                >
                  {demoMode ? 'SIMULATION ACTIVE' : 'MANUAL'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleToggleDemo}
                  className={`flex-1 min-w-[120px] px-3 py-2 rounded text-sm font-medium transition-colors ${
                    demoMode
                      ? 'bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30'
                      : 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30'
                  }`}
                >
                  {demoMode ? 'STOP SIMULATION' : 'START SIMULATION'}
                </button>
                <button
                  onClick={() => clearEvents()}
                  className="flex-1 min-w-[120px] px-3 py-2 rounded text-sm font-medium bg-navy-700 border border-navy-600 text-navy-300 hover:bg-navy-600 transition-colors"
                >
                  CLEAR EVENTS
                </button>
              </div>
              <p className="mt-3 text-xs text-navy-400">
                Demo mode drives the simulated AI detection and event pipeline. Real webcam and GPS
                remain independent.
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