import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getEvent } from '../integrations/google/calendarApi';
import { getDogLinkForEvent } from '../db/eventLinks';
import { getOrCreateVisitForEvent } from '../db/visits';
import { db } from '../db/db';
import { Dog } from '../db/schema';
import VisitEditor from '../components/VisitEditor';
import { isConnected } from '../integrations/google/auth';

export default function VisitFromEventPage() {
  const { calendarId, eventId } = useParams<{ calendarId: string; eventId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visit, setVisit] = useState<any>(null);
  const [dog, setDog] = useState<Dog | null>(null);

  useEffect(() => {
    if (!calendarId || !eventId) {
      setError('Missing calendar ID or event ID');
      setLoading(false);
      return;
    }

    loadVisitData();
  }, [calendarId, eventId]);

  const loadVisitData = async () => {
    try {
      // Check connection
      const connected = await isConnected();
      if (!connected) {
        setError('Not connected to Google Calendar. Please connect in Settings.');
        setLoading(false);
        return;
      }

      // Fetch event from Google Calendar
      const calendarEvent = await getEvent(calendarId!, eventId!);

      // Get linked dog
      const link = await getDogLinkForEvent(calendarId!, eventId!);
      if (!link) {
        setError('No dog linked to this event. Please assign a dog first.');
        setLoading(false);
        return;
      }

      // Load dog
      const dogData = await db.dogs.get(link.dogId);
      if (!dogData) {
        setError('Linked dog not found.');
        setLoading(false);
        return;
      }
      setDog(dogData);

      // Convert event start date to ISO string
      let dateISO: string;
      if (calendarEvent.start.date) {
        // All-day event: use date at 09:00 local time
        const date = new Date(calendarEvent.start.date + 'T09:00:00');
        dateISO = date.toISOString();
      } else if (calendarEvent.start.dateTime) {
        // Timed event: use as-is
        dateISO = new Date(calendarEvent.start.dateTime).toISOString();
      } else {
        throw new Error('Event has no valid start date');
      }

      // Get or create visit
      const visitData = await getOrCreateVisitForEvent(
        calendarId!,
        eventId!,
        link.dogId,
        dateISO
      );
      setVisit(visitData);
    } catch (err: any) {
      setError(err.message || 'Failed to load visit data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div>
        <h1>Visit</h1>
        <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
          Loading...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1>Visit</h1>
        <div style={{
          padding: '1.5rem',
          backgroundColor: '#ffebee',
          color: '#c62828',
          borderRadius: '8px',
          marginBottom: '1rem',
        }}>
          <p style={{ margin: 0, marginBottom: '1rem' }}>{error}</p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link to="/today">
              <button>Back to Today</button>
            </Link>
            {error.includes('Settings') && (
              <Link to="/settings">
                <button>Go to Settings</button>
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!visit || !dog) {
    return (
      <div>
        <h1>Visit</h1>
        <div style={{
          padding: '1.5rem',
          backgroundColor: '#ffebee',
          color: '#c62828',
          borderRadius: '8px',
        }}>
          <p>Visit data not available.</p>
        </div>
      </div>
    );
  }

  return <VisitEditor visit={visit} dog={dog} />;
}
