import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Visit, Dog } from '../db/schema';
import { updateVisitQueued } from '../db/visits';
import { listVisitPhotos, addVisitPhoto, deleteVisitPhoto } from '../db/photos';
import { saveFilesToVisit, readPhotoAsBlobUrl, getStorageFolderHandleOrThrow, deletePhotoFile } from '../fs/visitPhotos';
import { getStoredFolder, requestFolderPermission } from '../fs/storageFolder';
import { VisitPhoto } from '../db/schema';

interface VisitEditorProps {
  visit: Visit;
  dog: Dog | null;
}

export default function VisitEditor({ visit, dog }: VisitEditorProps) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Visit['status']>(visit.status);
  const [duration, setDuration] = useState<number | null>(visit.durationMin ?? null);
  const [price, setPrice] = useState<number | null>(visit.priceCents ? visit.priceCents / 100 : null);
  const [notes, setNotes] = useState<string>(visit.notes || '');
  const [photos, setPhotos] = useState<VisitPhoto[]>([]);
  const [photoBlobUrls, setPhotoBlobUrls] = useState<Map<string, string>>(new Map());
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [saving, setSaving] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load photos on mount
  useEffect(() => {
    loadPhotos();
  }, [visit.id]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      photoBlobUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [photoBlobUrls]);

  const loadPhotos = async () => {
    try {
      const photoList = await listVisitPhotos(visit.id);
      setPhotos(photoList);
      await loadPhotoBlobUrls(photoList);
    } catch (error: any) {
      console.error('Failed to load photos:', error);
    }
  };

  const loadPhotoBlobUrls = async (photoList: VisitPhoto[]) => {
    setLoadingPhotos(true);
    
    // Revoke old blob URLs before replacing
    photoBlobUrls.forEach(url => URL.revokeObjectURL(url));
    
    const urls = new Map<string, string>();

    // Check if folder is available
    try {
      await getStorageFolderHandleOrThrow();
    } catch (error) {
      // Folder not available - can't load photos
      setLoadingPhotos(false);
      return;
    }

    for (const photo of photoList) {
      try {
        const blobUrl = await readPhotoAsBlobUrl(visit.id, photo.relativePath);
        urls.set(photo.id, blobUrl);
      } catch (error: any) {
        console.error(`Failed to load photo ${photo.name}:`, error);
      }
    }

    setPhotoBlobUrls(urls);
    setLoadingPhotos(false);
  };

  // Check storage folder availability
  useEffect(() => {
    checkStorageFolder();
  }, []);

  const checkStorageFolder = async () => {
    const handle = await getStoredFolder();
    if (!handle) {
      setStorageError('No storage folder selected');
      return;
    }

    try {
      await getStorageFolderHandleOrThrow();
      setStorageError(null);
    } catch (error: any) {
      setStorageError(error.message);
    }
  };

  // Autosave with debounce
  const triggerSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        await updateVisitQueued(visit.id, {
          status,
          durationMin: duration ?? null,
          priceCents: price ? Math.round(price * 100) : null,
          notes: notes || '',
        });
      } catch (error: any) {
        console.error('Failed to save visit:', error);
        alert(`Failed to save: ${error.message}`);
      } finally {
        setSaving(false);
      }
    }, 1000); // 1 second debounce
  }, [visit.id, status, duration, price, notes]);

  useEffect(() => {
    triggerSave();
  }, [status, duration, price, notes, triggerSave]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingPhotos(true);
    setStorageError(null);

    try {
      // Check storage folder
      await getStorageFolderHandleOrThrow();

      // Save files
      const savedPhotos = await saveFilesToVisit(visit.id, Array.from(files));

      // Add photo records to DB
      for (const saved of savedPhotos) {
        await addVisitPhoto(visit.id, saved.name, saved.relativePath);
      }

      // Reload photos
      await loadPhotos();
    } catch (error: any) {
      setStorageError(error.message);
      alert(`Failed to upload photos: ${error.message}`);
    } finally {
      setUploadingPhotos(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRequestPermission = async () => {
    const handle = await getStoredFolder();
    if (!handle) {
      navigate('/settings');
      return;
    }

    try {
      await requestFolderPermission(handle);
      await checkStorageFolder();
    } catch (error: any) {
      alert(`Failed to request permission: ${error.message}`);
    }
  };

  const handleDeletePhoto = async (photo: VisitPhoto) => {
    if (!confirm(`Delete photo "${photo.name}"?`)) {
      return;
    }

    // Revoke blob URL immediately
    const blobUrl = photoBlobUrls.get(photo.id);
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      const newUrls = new Map(photoBlobUrls);
      newUrls.delete(photo.id);
      setPhotoBlobUrls(newUrls);
    }

    try {
      // Remove from DB first
      await deleteVisitPhoto(photo.id);

      // Remove from filesystem (best-effort, non-blocking)
      try {
        await deletePhotoFile(photo.visitId, photo.relativePath);
      } catch (error: any) {
        // Non-blocking warning
        console.warn(`Failed to delete photo file: ${error.message}`);
        // Show a subtle warning but don't block
        alert(`Photo deleted from database, but file deletion failed: ${error.message}`);
      }

      // Reload photos list
      await loadPhotos();
    } catch (error: any) {
      alert(`Failed to delete photo: ${error.message}`);
      // Reload photos to restore state
      await loadPhotos();
    }
  };

  const formatDate = (dateISO: string): string => {
    const date = new Date(dateISO);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/today" style={{ color: '#2196f3', textDecoration: 'none' }}>
          ← Back to Today
        </Link>
      </div>

      <h1>Visit Details</h1>

      {storageError && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '4px',
          marginBottom: '1rem',
        }}>
          <p style={{ margin: 0, marginBottom: '0.5rem' }}>
            {storageError}
          </p>
          <button onClick={handleRequestPermission} style={{ marginRight: '0.5rem' }}>
            Grant Permission
          </button>
          <Link to="/settings">
            <button>Go to Settings</button>
          </Link>
        </div>
      )}

      {saving && (
        <div style={{
          padding: '0.5rem',
          backgroundColor: '#e3f2fd',
          borderRadius: '4px',
          marginBottom: '1rem',
          fontSize: '0.9rem',
          color: '#1976d2',
        }}>
          Saving...
        </div>
      )}

      <div style={{
        backgroundColor: '#fff',
        padding: '1.5rem',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '1.5rem',
      }}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' }}>
            Dog
          </label>
          {dog ? (
            <div>
              <Link to={`/dogs`} style={{ color: '#2196f3', textDecoration: 'none' }}>
                {dog.dogName}
              </Link>
            </div>
          ) : (
            <span style={{ color: '#999' }}>Unknown dog</span>
          )}
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' }}>
            Date/Time
          </label>
          <div>{formatDate(visit.dateISO)}</div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' }}>
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Visit['status'])}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
          >
            <option value="planned">Planned</option>
            <option value="done">Done</option>
            <option value="no_show">No Show</option>
          </select>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' }}>
            Duration (minutes)
          </label>
          <input
            type="number"
            value={duration ?? ''}
            onChange={(e) => setDuration(e.target.value ? parseInt(e.target.value) : null)}
            placeholder="e.g., 60"
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' }}>
            Price (EUR)
          </label>
          <input
            type="number"
            step="0.01"
            value={price ?? ''}
            onChange={(e) => setPrice(e.target.value ? parseFloat(e.target.value) : null)}
            placeholder="e.g., 45.00"
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' }}>
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this visit..."
            rows={6}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
        </div>
      </div>

      <div style={{
        backgroundColor: '#fff',
        padding: '1.5rem',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}>
        <div style={{ marginBottom: '1rem' }}>
          <h2 style={{ marginTop: 0 }}>Photos</h2>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoUpload}
            disabled={uploadingPhotos || !!storageError}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingPhotos || !!storageError}
          >
            {uploadingPhotos ? 'Uploading...' : 'Add Photos'}
          </button>
        </div>

        {loadingPhotos && (
          <div style={{ color: '#666', fontStyle: 'italic' }}>Loading photos...</div>
        )}

        {!loadingPhotos && photos.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: '1rem',
          }}>
            {photos.map((photo) => {
              const blobUrl = photoBlobUrls.get(photo.id);
              return (
                <div key={photo.id} style={{ position: 'relative' }}>
                  <button
                    onClick={() => handleDeletePhoto(photo)}
                    style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      backgroundColor: 'rgba(244, 67, 54, 0.9)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      zIndex: 10,
                    }}
                    title="Delete photo"
                  >
                    ✕
                  </button>
                  {blobUrl ? (
                    <img
                      src={blobUrl}
                      alt={photo.name}
                      style={{
                        width: '100%',
                        height: '150px',
                        objectFit: 'cover',
                        borderRadius: '4px',
                        border: '1px solid #ddd',
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '150px',
                      backgroundColor: '#f5f5f5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '4px',
                      border: '1px solid #ddd',
                      color: '#999',
                      fontSize: '0.85rem',
                    }}>
                      Failed to load
                    </div>
                  )}
                  <div style={{
                    fontSize: '0.75rem',
                    color: '#666',
                    marginTop: '0.25rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {photo.name}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loadingPhotos && photos.length === 0 && (
          <div style={{ color: '#999', fontStyle: 'italic' }}>
            No photos yet. Click "Add Photos" to upload.
          </div>
        )}
      </div>
    </div>
  );
}
