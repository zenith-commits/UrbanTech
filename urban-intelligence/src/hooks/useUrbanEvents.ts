import { useState, useCallback, useMemo } from 'react';
import type { UrbanEvent, Alert } from '../types';
import { EVENT_TYPE_LABELS } from '../data/mockData';
import { generateId, sortBySeverity, getSeverityRank } from '../utils/helpers';

export function useUrbanEvents(initialEvents: UrbanEvent[] = []) {
  const [events, setEvents] = useState<UrbanEvent[]>(initialEvents);
  const [alerts, setAlerts] = useState<Alert[]>(() =>
    initialEvents
      .filter(e => getSeverityRank(e.severity) >= 2)
      .map(e => buildAlert(e))
  );
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const addEvent = useCallback((event: UrbanEvent) => {
    setEvents(prev => {
      if (prev.some(e => e.id === event.id)) return prev;
      return [event, ...prev].slice(0, 60);
    });

    setAlerts(prev => {
      if (prev.some(a => a.eventId === event.id)) return prev;
      if (getSeverityRank(event.severity) < 2) return prev;
      return [buildAlert(event), ...prev].slice(0, 30);
    });
  }, []);

  const selectEvent = useCallback((eventId: string | null) => {
    setSelectedEventId(eventId);
  }, []);

  const verifyEvent = useCallback((eventId: string) => {
    setEvents(prev =>
      prev.map(e => (e.id === eventId ? { ...e, status: 'VERIFIED', verifiedAt: Date.now() } : e))
    );
    setAlerts(prev =>
      prev.map(a => (a.eventId === eventId && !a.maintenance ? { ...a, acknowledged: true, acknowledgedAt: Date.now() } : a))
    );
  }, []);

  const createMaintenanceAlert = useCallback((eventId: string): boolean => {
    let created = false;
    setEvents(prev =>
      prev.map(e => {
        if (e.id === eventId && !e.maintenanceAlertId) {
          created = true;
          return { ...e, maintenanceAlertId: generateId('maint_') };
        }
        return e;
      })
    );
    setAlerts(prev => {
      if (prev.some(a => a.eventId === eventId && a.maintenance)) return prev;
      const event = events.find(e => e.id === eventId);
      if (!event || !created) return prev;
      return [
        {
          id: generateId('alt_'),
          eventId,
          type: event.type,
          severity: event.severity,
          message: `MAINTENANCE WORK ORDER CREATED for ${(EVENT_TYPE_LABELS[event.type] || event.type).toUpperCase()}`,
          timestamp: Date.now(),
          acknowledged: false,
          maintenance: true,
        },
        ...prev,
      ].slice(0, 30);
    });
    return created;
  }, [events]);

  const dismissAlert = useCallback((alertId: string) => {
    setAlerts(prev =>
      prev.map(a => (a.id === alertId ? { ...a, acknowledged: true, acknowledgedAt: Date.now() } : a))
    );
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
    setAlerts([]);
    setSelectedEventId(null);
  }, []);

  const getSelectedEvent = useCallback((): UrbanEvent | null => {
    return events.find(e => e.id === selectedEventId) || null;
  }, [events, selectedEventId]);

  const getAlertsBySeverity = useCallback((): Alert[] => {
    return sortBySeverity(alerts.filter(a => !a.acknowledged));
  }, [alerts]);

  const getRecentEvents = useCallback((limit: number = 10): UrbanEvent[] => {
    return events.slice(0, limit);
  }, [events]);

  const activeAlerts = useMemo(
    () => alerts.filter(a => !a.acknowledged),
    [alerts]
  );

  return {
    events,
    alerts,
    activeAlerts,
    selectedEventId,
    addEvent,
    selectEvent,
    verifyEvent,
    createMaintenanceAlert,
    dismissAlert,
    clearEvents,
    getSelectedEvent,
    getAlertsBySeverity,
    getRecentEvents,
  };
}

function buildAlert(event: UrbanEvent): Alert {
  return {
    id: generateId('alt_'),
    eventId: event.id,
    type: event.type,
    severity: event.severity,
    message: `${(EVENT_TYPE_LABELS[event.type] || event.type).toUpperCase()} detected — ${event.subtype || 'check required'}`,
    timestamp: event.timestamp,
    acknowledged: false,
  };
}