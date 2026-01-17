import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { isConnected } from '../integrations/google/auth';
import { listEvents, CalendarEvent, patchEventDescription } from '../integrations/google/calendarApi';
import { getKV } from '../db/kv';
import { getDogLinkForEvent, setDogLinkForEvent, removeDogLinkForEvent } from '../db/eventLinks';
import { extractDogIdFromDescription, upsertDogToken, removeDogToken } from '../utils/linkToken';
import { db } from '../db/db';
import { Dog } from '../db/schema';
import DogPickerModal from '../components/DogPickerModal';

const SELECTED_CALENDAR_KEY = 'selectedCalendarId';

type ViewMode = 'today' | 'week';

interface EventWithLink extends CalendarEvent {
  linkedDogId?: string | null;
  linkedDog?: Dog | null;
}

export default function TodayPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('today');
  const [events, setEvents] = useState<EventWithLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickingForEventId, setPickingForEventId] = useState<string | null>(null);
  const [linkingEventId, setLinkingEventId] = useState<string | null>(null);

  useEffect(() => {
    checkConnection();
  }, []);

  useEffect(() => {
    if (connected) {
      loadEvents();
    }
  }, [viewMode, connected]);

  const checkConnection = async () => {
    const isConn = await isConnected();
    setConnected(isConn);
  };

  const loadEvents = async () => {
    if (!connected) {
      setError(null);
      setEvents([]);
      return;
    }

    const calendarId = await getKV<string>(SELECTED_CALENDAR_KEY);
    if (!calendarId) {
      setError(null);
      setEvents([]);
      return;
    }

    setSelectedCalendarId(calendarId);
    setLoading(true);
    setError(null);

    try {
      const now = new Date();
      let timeMin: Date;
      let timeMax: Date;

      if (viewMode === 'today') {
        timeMin = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        timeMax = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      } else {
        timeMin = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        timeMax = new Date(now);
        timeMax.setDate(timeMax.getDate() + 7);
        timeMax.setHours(23, 59, 59, 999);
      }

      const eventList = await listEvents(calendarId, timeMin, timeMax);
      
      // Enrich events with link information and auto-detect from descriptions
      const enrichedEvents = await Promise.all(
        eventList.map(async (event) => {
          // Check for existing link
          let link = await getDogLinkForEvent(calendarId, event.id);
          let linkedDog: Dog | null = null;

          // Auto-detect from description if no link exists
          if (!link && event.description) {
            const dogIdFromDesc = extractDogIdFromDescription(event.description);
            if (dogIdFromDesc) {
              // Check if dog exists
              try {
                const dog = await db.dogs.get(dogIdFromDesc);
                if (dog) {
                  linkedDog = dog;
                  // Create local mapping
                  await setDogLinkForEvent(calendarId, event.id, dogIdFromDesc);
                  link = await getDogLinkForEvent(calendarId, event.id);
                }
              } catch (err) {
                console.error('Failed to auto-link event:', err);
              }
            }
          }

          // Load linked dog if link exists
          if (link) {
            try {
              const dog = await db.dogs.get(link.dogId);
              linkedDog = dog || null;
            } catch (err) {
              console.error('Failed to load linked dog:', err);
            }
          }

          return {
            ...event,
            linkedDogId: link?.dogId || (linkedDog ? linkedDog.id : null),
            linkedDog,
          };
        })
      );

      setEvents(enrichedEvents);
    } catch (err: any) {
      setError(err.message || 'Failed to load events');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignDog = (eventId: string) => {
    setPickingForEventId(eventId);
    setPickerOpen(true);
  };

  const handleDogSelected = async (dogId: string) => {
    if (!pickingForEventId || !selectedCalendarId) {
      return;
    }

    setLinkingEventId(pickingForEventId);
    setPickerOpen(false);

    try {
      const event = events.find((e) => e.id === pickingForEventId);
      if (!event) {
        throw new Error('Event not found');
      }

      // Update local mapping
      await setDogLinkForEvent(selectedCalendarId, pickingForEventId, dogId);

      // Update Google Calendar description
      const newDescription = upsertDogToken(event.description, dogId);
      await patchEventDescription(selectedCalendarId, pickingForEventId, newDescription);

      // Reload events to reflect changes
      await loadEvents();
    } catch (err: any) {
      alert(`Failed to link dog: ${err.message}`);
    } finally {
      setLinkingEventId(null);
      setPickingForEventId(null);
    }
  };

  const handleUnlinkDog = async (eventId: string) => {
    if (!selectedCalendarId) {
      return;
    }

    if (!confirm('Unlink dog from this event? The token will be removed from the event description.')) {
      return;
    }

    setLinkingEventId(eventId);

    try {
      const event = events.find((e) => e.id === eventId);
      if (!event) {
        throw new Error('Event not found');
      }

      // Remove local mapping
      await removeDogLinkForEvent(selectedCalendarId, eventId);

      // Remove token from Google Calendar description
      const newDescription = removeDogToken(event.description);
      await patchEventDescription(selectedCalendarId, eventId, newDescription);

      // Reload events to reflect changes
      await loadEvents();
    } catch (err: any) {
      alert(`Failed to unlink dog: ${err.message}`);
    } finally {
      setLinkingEventId(null);
    }
  };

  const formatEventTime = (event: CalendarEvent): string => {
    if (event.start.date) {
      return 'All-day';
    }
    if (event.start.dateTime) {
      const date = new Date(event.start.dateTime);
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    }
    return 'Unknown time';
  };

  const formatEventDate = (event: CalendarEvent): string => {
    if (event.start.date) {
      return event.start.date;
    }
    if (event.start.dateTime) {
      const date = new Date(event.start.dateTime);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
      });
    }
    return '';
  };

  if (!connected) {
    return (
      <div>
        <h1>Today</h1>
        <div style={{ 
          padding: '2rem', 
          textAlign: 'center',
          backgroundColor: '#fff',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <p style={{ marginBottom: '1rem', color: '#666' }}>
            Connect to Google Calendar to view your events.
          </p>
          <Link to="/settings">
            <button>Go to Settings</button>
          </Link>
        </div>
      </div>
    );
  }

  if (!selectedCalendarId) {
    return (
      <div>
        <h1>Today</h1>
        <div style={{ 
          padding: '2rem', 
          textAlign: 'center',
          backgroundColor: '#fff',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <p style={{ marginBottom: '1rem', color: '#666' }}>
            Please select a calendar in Settings.
          </p>
          <Link to="/settings">
            <button>Go to Settings</button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1>Today</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setViewMode('today')}
            style={{
              backgroundColor: viewMode === 'today' ? '#2196f3' : '#e0e0e0',
              color: viewMode === 'today' ? 'white' : '#333',
            }}
          >
            Today
          </button>
          <button
            onClick={() => setViewMode('week')}
            style={{
              backgroundColor: viewMode === 'week' ? '#2196f3' : '#e0e0e0',
              color: viewMode === 'week' ? 'white' : '#333',
            }}
          >
            Week
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
          Loading events...
        </div>
      )}

      {error && (
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#ffebee', 
          color: '#c62828',
          borderRadius: '4px',
          marginBottom: '1rem'
        }}>
          Error: {error}
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <div style={{ 
          padding: '2rem', 
          textAlign: 'center',
          backgroundColor: '#fff',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <p style={{ color: '#666' }}>
            No events found for {viewMode === 'today' ? 'today' : 'this week'}.
          </p>
        </div>
      )}

      {!loading && !error && events.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {events.map((event) => {
            const eventDate = formatEventDate(event);
            const eventTime = formatEventTime(event);
            const isToday = viewMode === 'today' || eventDate === new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const isLinking = linkingEventId === event.id;

            return (
              <div
                key={event.id}
                style={{
                  backgroundColor: '#fff',
                  padding: '1.5rem',
                  borderRadius: '8px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  borderLeft: '4px solid #2196f3',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '1.1rem', color: '#333' }}>
                        {event.summary || '(No title)'}
                      </strong>
                      <span style={{ 
                        fontSize: '0.85rem', 
                        color: '#666',
                        backgroundColor: '#f5f5f5',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px'
                      }}>
                        {eventTime}
                      </span>
                      {!isToday && (
                        <span style={{ fontSize: '0.85rem', color: '#999' }}>
                          {eventDate}
                        </span>
                      )}
                    </div>

                    {event.linkedDog ? (
                      <div style={{ 
                        marginBottom: '0.5rem',
                        padding: '0.5rem',
                        backgroundColor: '#e8f5e9',
                        borderRadius: '4px',
                        display: 'inline-block'
                      }}>
                        <span style={{ fontSize: '0.9rem', color: '#2e7d32' }}>
                          🐕 Linked dog: <strong>{event.linkedDog.dogName}</strong>
                        </span>
                      </div>
                    ) : event.linkedDogId ? (
                      <div style={{ 
                        marginBottom: '0.5rem',
                        padding: '0.5rem',
                        backgroundColor: '#fff3e0',
                        borderRadius: '4px',
                        display: 'inline-block'
                      }}>
                        <span style={{ fontSize: '0.9rem', color: '#e65100' }}>
                          ⚠️ Unknown dog linked
                        </span>
                      </div>
                    ) : null}
                    
                    {event.location && (
                      <div style={{ marginBottom: '0.5rem', color: '#666', fontSize: '0.9rem' }}>
                        📍 {event.location}
                      </div>
                    )}

                    {event.description && (
                      <div style={{ 
                        marginTop: '0.5rem', 
                        color: '#666', 
                        fontSize: '0.9rem',
                        maxHeight: '3em',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {removeDogToken(event.description).substring(0, 150)}
                        {removeDogToken(event.description).length > 150 ? '...' : ''}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <a
                    href={event.htmlLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: '#2196f3',
                      textDecoration: 'none',
                      fontSize: '0.9rem',
                    }}
                  >
                    Open in Google Calendar →
                  </a>
                  {event.linkedDog ? (
                    <button
                      onClick={() => handleUnlinkDog(event.id)}
                      disabled={isLinking}
                      style={{
                        padding: '0.25rem 0.75rem',
                        fontSize: '0.85rem',
                        backgroundColor: '#f44336',
                      }}
                    >
                      {isLinking ? 'Unlinking...' : 'Unlink'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAssignDog(event.id)}
                      disabled={isLinking}
                      style={{
                        padding: '0.25rem 0.75rem',
                        fontSize: '0.85rem',
                      }}
                    >
                      Assign Dog
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DogPickerModal
        isOpen={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
          setPickingForEventId(null);
        }}
        onSelect={handleDogSelected}
      />
    </div>
  );
}
