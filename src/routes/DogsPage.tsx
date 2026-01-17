import { useState, useEffect } from 'react';
import { db } from '../db/db';
import { Dog } from '../db/schema';

export default function DogsPage() {
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    dogName: '',
    breed: '',
    tags: '',
  });

  useEffect(() => {
    loadDogs();
  }, []);

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

  const handleAddDog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.dogName.trim()) {
      alert('Dog name is required');
      return;
    }

    try {
      const now = new Date();
      const tags = formData.tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const newDog: Dog = {
        id: `dog_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        dogName: formData.dogName.trim(),
        breed: formData.breed.trim() || undefined,
        tags,
        createdAt: now,
        updatedAt: now,
      };

      await db.dogs.add(newDog);
      await loadDogs();
      setFormData({ dogName: '', breed: '', tags: '' });
      setShowAddForm(false);
    } catch (error) {
      console.error('Failed to add dog:', error);
      alert('Failed to add dog. Please try again.');
    }
  };

  const handleDeleteDog = async (dogId: string) => {
    if (!confirm('Delete this dog? This action cannot be undone.')) {
      return;
    }

    try {
      await db.dogs.delete(dogId);
      await loadDogs();
    } catch (error) {
      console.error('Failed to delete dog:', error);
      alert('Failed to delete dog. Please try again.');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1>Dogs</h1>
        <button onClick={() => setShowAddForm(!showAddForm)} style={{ padding: '0.5rem 1rem' }}>
          {showAddForm ? 'Cancel' : 'Add Dog'}
        </button>
      </div>

      {showAddForm && (
        <section style={{ marginBottom: '2rem' }}>
          <h2>Add New Dog</h2>
          <form onSubmit={handleAddDog}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                <strong>Dog Name *</strong>
              </label>
              <input
                type="text"
                value={formData.dogName}
                onChange={(e) => setFormData({ ...formData, dogName: e.target.value })}
                required
                style={{
                  width: '100%',
                  maxWidth: '400px',
                  padding: '0.5rem',
                  fontSize: '0.9rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                <strong>Breed</strong>
              </label>
              <input
                type="text"
                value={formData.breed}
                onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
                style={{
                  width: '100%',
                  maxWidth: '400px',
                  padding: '0.5rem',
                  fontSize: '0.9rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                <strong>Tags (comma-separated)</strong>
              </label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="e.g., large, friendly, special-needs"
                style={{
                  width: '100%',
                  maxWidth: '400px',
                  padding: '0.5rem',
                  fontSize: '0.9rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                }}
              />
            </div>

            <button type="submit" style={{ padding: '0.5rem 1rem' }}>
              Add Dog
            </button>
          </form>
        </section>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
          Loading dogs...
        </div>
      )}

      {!loading && dogs.length === 0 && (
        <div style={{ 
          padding: '2rem', 
          textAlign: 'center',
          backgroundColor: '#fff',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <p style={{ color: '#666' }}>No dogs yet. Add your first dog above.</p>
        </div>
      )}

      {!loading && dogs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {dogs.map((dog) => (
            <div
              key={dog.id}
              style={{
                backgroundColor: '#fff',
                padding: '1.5rem',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <div style={{ flex: 1 }}>
                <h3 style={{ marginBottom: '0.5rem', color: '#333' }}>
                  {dog.dogName}
                </h3>
                {dog.breed && (
                  <div style={{ marginBottom: '0.5rem', color: '#666', fontSize: '0.9rem' }}>
                    <strong>Breed:</strong> {dog.breed}
                  </div>
                )}
                {dog.tags.length > 0 && (
                  <div style={{ marginBottom: '0.5rem' }}>
                    {dog.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        style={{
                          display: 'inline-block',
                          backgroundColor: '#e3f2fd',
                          color: '#1976d2',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.85rem',
                          marginRight: '0.5rem',
                          marginBottom: '0.25rem',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {dog.notes && (
                  <div style={{ color: '#666', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                    {dog.notes}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleDeleteDog(dog.id)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#f44336',
                  marginLeft: '1rem',
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
