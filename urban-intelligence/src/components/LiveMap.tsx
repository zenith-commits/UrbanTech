import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Bus, GPSPosition, UrbanEvent } from '../types';
import { DELHI_CENTER } from '../data/mockData';
import { ErrorBoundary } from './ErrorBoundary';

// Custom div icons (replace Leaflet's default icon to avoid missing-asset issues)
function busIconHTML(live: boolean): string {
  return `<div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center">
    <style>@keyframes uiPing{0%{transform:scale(0.6);opacity:0.85}75%,100%{transform:scale(1.7);opacity:0}}</style>
    <span style="position:absolute;inset:2px;border-radius:9999px;background:${live ? '#22d3ee' : '#60a5fa'};border:2px solid #ffffff;box-shadow:0 0 0 2px rgba(0,0,0,0.35);"></span>
    ${live ? `<span style="position:absolute;inset:-4px;border-radius:9999px;border:2px solid #22d3ee;opacity:0.8;animation:uiPing 1.5s cubic-bezier(0,0,0.2,1) infinite;"></span>` : ''}
    <span style="position:relative;font:700 9px 'JetBrains Mono',monospace;color:#ffffff;text-shadow:0 1px 2px rgba(0,0,0,0.6);">B</span>
  </div>`;
}

const SEVERITY_DOT: Record<string, { color: string; label: string }> = {
  low: { color: '#34d399', label: 'LOW' },
  medium: { color: '#fbbf24', label: 'MED' },
  high: { color: '#fb7185', label: 'HIGH' },
  critical: { color: '#ef4444', label: 'CRIT' },
};

function eventIconHTML(severity: string, isSelected: boolean, label?: string): L.DivIcon {
  const cfg = SEVERITY_DOT[severity] || SEVERITY_DOT.high;
  const tooltip = label
    ? `<div style="position:absolute;top:-4px;left:50%;transform:translate(-50%,-100%);background:rgba(10,15,26,0.96);border:1px solid #233044;border-radius:4px;padding:2px 6px;font:700 10px 'JetBrains Mono',monospace;color:#fff;white-space:nowrap;">${label}</div>`
    : '';
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:18px;height:18px;display:flex;align-items:center;justify-content:center">
      <style>@keyframes uiPing{0%{transform:scale(0.6);opacity:0.85}75%,100%{transform:scale(1.7);opacity:0}}</style>
      ${tooltip}
      <span style="position:absolute;inset:1px;border-radius:9999px;background:${cfg.color};border:2px solid #ffffff;box-shadow:0 0 0 2px rgba(0,0,0,0.35);"></span>
      ${isSelected ? `<span style="position:absolute;inset:-7px;border-radius:9999px;border:2px solid #22d3ee;animation:uiPing 1.2s cubic-bezier(0,0,0.2,1) infinite;"></span>` : ''}
    </div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function BusMarker({ position, isActive, label }: { position: GPSPosition; isActive: boolean; label: string }) {
  const icon = useRef(L.divIcon({
    className: '',
    html: busIconHTML(isActive),
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })).current;

  if (position.latitude === undefined || position.longitude === undefined) return null;

  return (
    <Marker position={[position.latitude, position.longitude]} icon={icon}>
      <Popup>
        <div className="font-mono">
          <div className="font-bold text-cyan-400">{label}</div>
          <div className="text-xs text-white/80">{isActive ? 'ACTIVE ROUTE' : 'IN FLEET'}</div>
          <div className="text-xs text-white/60 mt-1">
            {position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

function EventMarker({ event, isSelected, onClick }: { event: UrbanEvent; isSelected: boolean; onClick: () => void }) {
  const icon = eventIconHTML(event.severity, isSelected, `${event.type.replace('_', ' ').toUpperCase()} ${Math.round(event.confidence * 100)}%`);

  return (
    <Marker
      position={[event.position.latitude, event.position.longitude]}
      icon={icon}
      eventHandlers={{ click: () => onClick() }}
    >
      <Popup>
        <div className="font-mono">
          <div className="font-bold text-white text-sm">{event.type.replace('_', ' ').toUpperCase()}</div>
          <div className="text-xs text-rose-400">{event.severity.toUpperCase()} • {Math.round(event.confidence * 100)}%</div>
          <div className="text-xs text-white/70 mt-1">{event.busId} • {event.status}</div>
        </div>
      </Popup>
    </Marker>
  );
}

function MapController({
  selectedEvent,
  focusedBusId,
  buses,
}: {
  selectedEvent: UrbanEvent | null;
  focusedBusId: string | null;
  buses: Bus[];
}) {
  const map = useMap();

  // Center on selected event (event selection)
  useEffect(() => {
    if (selectedEvent && selectedEvent.position) {
      map.flyTo([selectedEvent.position.latitude, selectedEvent.position.longitude], 17, {
        animate: true,
        duration: 0.8,
      });
    }
  }, [selectedEvent, map]);

  // Center on bus ONLY when the user selects a different bus (not on live position updates)
  useEffect(() => {
    if (!focusedBusId) return;
    const bus = buses.find(b => b.id === focusedBusId);
    if (bus && bus.position) {
      map.flyTo([bus.position.latitude, bus.position.longitude], 15, {
        animate: true,
        duration: 0.8,
      });
    }
  }, [focusedBusId, buses, map]);

  return null;
}

function MapOverlay({ activeBus, isDemoGPS }: { activeBus: Bus | null; isDemoGPS: boolean }) {
  return (
    <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2 pointer-events-none">
      <div className="bg-navy-900/90 border border-navy-600 rounded-lg p-3 shadow-lg pointer-events-auto">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-xs text-cyan-400">GPS</span>
          <span className={`text-xs font-mono ${isDemoGPS ? 'text-amber-400' : 'text-emerald-400'}`}>
            {isDemoGPS ? 'DEMO' : 'LIVE'}
          </span>
        </div>
        {activeBus && (
          <div className="text-xs text-navy-300 font-mono space-y-1">
            <div>LAT {activeBus.position.latitude.toFixed(6)}</div>
            <div>LON {activeBus.position.longitude.toFixed(6)}</div>
            <div>±{Math.round(activeBus.position.accuracy ?? 0)}m</div>
          </div>
        )}
      </div>

      {activeBus && (
        <div className="bg-navy-900/90 border border-navy-600 rounded-lg p-3 shadow-lg">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-3 h-3 rounded-full bg-cyan-400 border-2 border-white" />
            <span className="font-mono text-white text-sm">{activeBus.label}</span>
          </div>
          <div className="text-xs text-navy-400">ACTIVE ROUTE</div>
        </div>
      )}
    </div>
  );
}

interface LiveMapProps {
  activeBus: Bus | null;
  buses: Bus[];
  events: UrbanEvent[];
  selectedEvent: UrbanEvent | null;
  focusedBusId: string | null;
  isDemoGPS: boolean;
  onSelectEvent: (event: UrbanEvent) => void;
}

export function LiveMap({
  activeBus,
  buses,
  events,
  selectedEvent,
  focusedBusId,
  isDemoGPS,
  onSelectEvent,
}: LiveMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const handleMapRef = (map: L.Map | null) => {
    if (map && mapRef.current !== map) {
      mapRef.current = map;
      setMapReady(true);
      setTimeout(() => {
        map.invalidateSize();
      }, 150);
    }
  };

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.invalidateSize();
    }
  }, [activeBus?.position, events.length, selectedEvent]);

  const activeRoute =
    activeBus && activeBus.route.length > 1 ? (activeBus.route as [number, number][]) : [];

  return (
    <div className="relative w-full min-h-[500px] h-full bg-navy-900 rounded-lg overflow-hidden border border-navy-600">
      <ErrorBoundary
        fallback={
          <div className="min-h-[500px] bg-navy-900 rounded-lg border border-rose-500/30 flex items-center justify-center">
            <div className="text-center p-8">
              <div className="text-3xl text-rose-400 mb-3">🗺</div>
              <p className="text-rose-400 font-semibold">MAP UNAVAILABLE</p>
              <p className="text-navy-400 text-sm mt-2">Live GIS map failed to load.</p>
            </div>
          </div>
        }
      >
        <MapContainer
          center={DELHI_CENTER}
          zoom={14}
          scrollWheelZoom={true}
          ref={handleMapRef}
          className="w-full h-full"
          style={{ height: '100%', minHeight: 500, width: '100%' }}
          attributionControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />

          <ZoomControl position="bottomright" />

          {activeRoute.length > 1 && (
            <Polyline
              positions={activeRoute}
              pathOptions={{
                color: '#22d3ee',
                weight: 3,
                opacity: 0.7,
                dashArray: '10, 10',
                lineCap: 'round',
              }}
            />
          )}

          {buses
            .filter(b => b.id !== activeBus?.id)
            .map(bus => (
              <BusMarker key={bus.id} position={bus.position} isActive={false} label={bus.label} />
            ))}

          {activeBus && (
            <BusMarker position={activeBus.position} isActive={true} label={activeBus.label} />
          )}

          {events.map(event => (
            <EventMarker
              key={event.id}
              event={event}
              isSelected={selectedEvent?.id === event.id}
              onClick={() => onSelectEvent(event)}
            />
          ))}

          <MapController
            selectedEvent={selectedEvent}
            focusedBusId={focusedBusId}
            buses={buses}
          />
        </MapContainer>
      </ErrorBoundary>

      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-navy-900 z-10 pointer-events-none">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-cyan-400 font-mono">LOADING MAP...</p>
          </div>
        </div>
      )}

      <MapOverlay activeBus={activeBus} isDemoGPS={isDemoGPS} />
    </div>
  );
}