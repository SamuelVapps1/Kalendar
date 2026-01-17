import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getVisitById } from '../db/visits';
import { db } from '../db/db';
import { Dog } from '../db/schema';
import VisitEditor from '../components/VisitEditor';

export default function VisitPage() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visit, setVisit] = useState<any>(null);
  const [dog, setDog] = useState<Dog | null>(null);

  useEffect(() => {
    if (!id) {
      setError('Missing visit ID');
      setLoading(false);
      return;
    }

    loadVisit();
  }, [id]);

  const loadVisit = async () => {
    try {
      const visitData = await getVisitById(id!);
      if (!visitData) {
        setError('Visit not found');
        setLoading(false);
        return;
      }

      setVisit(visitData);

      // Load dog
      const dogData = await db.dogs.get(visitData.dogId);
      setDog(dogData || null);
    } catch (err: any) {
      setError(err.message || 'Failed to load visit');
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
          <Link to="/today">
            <button>Back to Today</button>
          </Link>
        </div>
      </div>
    );
  }

  if (!visit) {
    return (
      <div>
        <h1>Visit</h1>
        <div style={{
          padding: '1.5rem',
          backgroundColor: '#ffebee',
          color: '#c62828',
          borderRadius: '8px',
        }}>
          <p>Visit not found.</p>
        </div>
      </div>
    );
  }

  return <VisitEditor visit={visit} dog={dog} />;
}
