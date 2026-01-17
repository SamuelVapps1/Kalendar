import { useState, useEffect } from 'react';
import { db } from '../db/db';
import { Dog } from '../db/schema';

interface DogPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (dogId: string) => void;
  excludeDogId?: string;
}

export default function DogPickerModal({ isOpen, onClose, onSelect, excludeDogId }: DogPickerModalProps) {
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadDogs();
    }
  }, [isOpen]);

  const loadDogs = async () => {
    setLoading(true);
    try {
      const allDogs = await db.dogs.orderBy('dogName').toArray();
      setDogs(allDogs);
    } catch (error) {
      console.error('Failed to load dogs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredDogs = dogs.filter((dog) => {
    if (excludeDogId && dog.id === excludeDogId) {
      return false;
    }
    if (!searchQuery.trim()) {
      return true;
    }
    const query = searchQuery.toLowerCase();
    return (
      dog.dogName.toLowerCase().includes(query) ||
      dog.breed?.toLowerCase().includes(query) ||
      dog.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  });

  const handleSelect = (dogId: string) => {
    onSelect(dogId);
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '1.5rem',
          maxWidth: '500px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>Select Dog</h2>
          <button onClick={onClose} style={{ padding: '0.25rem 0.5rem', fontSize: '1.2rem', background: 'none', border: 'none', cursor: 'pointer' }}>
            ×
          </button>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <input
            type="text"
            placeholder="Search dogs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              fontSize: '0.9rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
            autoFocus
          />
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
            Loading dogs...
          </div>
        )}

        {!loading && filteredDogs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
            {searchQuery ? 'No dogs found matching your search.' : 'No dogs available. Add dogs from the Dogs page.'}
          </div>
        )}

        {!loading && filteredDogs.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {filteredDogs.map((dog) => (
              <button
                key={dog.id}
                onClick={() => handleSelect(dog.id)}
                style={{
                  padding: '1rem',
                  textAlign: 'left',
                  border: '1px solid #e0e0e0',
                  borderRadius: '4px',
                  backgroundColor: '#fff',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f5f5f5';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#fff';
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                  {dog.dogName}
                </div>
                {dog.breed && (
                  <div style={{ fontSize: '0.85rem', color: '#666' }}>
                    {dog.breed}
                  </div>
                )}
                {dog.tags.length > 0 && (
                  <div style={{ marginTop: '0.25rem' }}>
                    {dog.tags.slice(0, 3).map((tag, idx) => (
                      <span
                        key={idx}
                        style={{
                          display: 'inline-block',
                          backgroundColor: '#e3f2fd',
                          color: '#1976d2',
                          padding: '0.125rem 0.375rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          marginRight: '0.25rem',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
