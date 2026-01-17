import { useState, useEffect, useRef } from 'react';
import {
  pickStorageFolder,
  getStoredFolder,
  getFolderPermission,
  requestFolderPermission,
  clearStoredFolder,
  isFileSystemAccessSupported,
  persistStorage,
  isStoragePersisted,
} from '../fs/storageFolder';
import {
  getClientId,
  setClientId,
  connectGoogle,
  isConnected,
  clearAccessToken,
} from '../integrations/google/auth';
import { listCalendars } from '../integrations/google/calendarApi';
import { Calendar } from '../integrations/google/calendarApi';
import { getKV, setKV } from '../db/kv';

const SELECTED_CALENDAR_KEY = 'selectedCalendarId';

export default function SettingsPage() {
  const [fsSupported, setFsSupported] = useState(false);
  const [folderHandle, setFolderHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<PermissionState>('prompt');
  const [storagePersisted, setStoragePersisted] = useState<boolean | null>(null);
  const [persistChecked, setPersistChecked] = useState(false);
  const [loading, setLoading] = useState(false);

  // Google Calendar state
  const [clientId, setClientIdState] = useState<string>('');
  const [googleConnected, setGoogleConnected] = useState(false);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('');
  const [googleError, setGoogleError] = useState<string | null>(null);
  const clientIdInputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Check API support
    setFsSupported(isFileSystemAccessSupported());

    // Load stored folder and check permissions
    loadFolderStatus();

    // Check storage persistence status
    checkStoragePersisted();

    // Load Google Calendar settings
    loadGoogleSettings();
  }, []);

  const loadGoogleSettings = async () => {
    const storedClientId = await getClientId();
    if (storedClientId) {
      setClientIdState(storedClientId);
    }

    const storedCalendarId = await getKV<string>(SELECTED_CALENDAR_KEY);
    if (storedCalendarId) {
      setSelectedCalendarId(storedCalendarId);
    }

    const connected = await isConnected();
    setGoogleConnected(connected);
    
    // If connected, try to load calendars
    if (connected) {
      try {
        const calList = await listCalendars();
        setCalendars(calList);
      } catch (error: any) {
        // Token might be expired, clear connection
        setGoogleConnected(false);
      }
    }
  };

  const loadFolderStatus = async () => {
    const handle = await getStoredFolder();
    setFolderHandle(handle);
    
    if (handle) {
      const status = await getFolderPermission(handle);
      setPermissionStatus(status);
    } else {
      setPermissionStatus('prompt');
    }
  };

  const checkStoragePersisted = async () => {
    const persisted = await isStoragePersisted();
    setStoragePersisted(persisted);
  };

  const handleSelectFolder = async () => {
    setLoading(true);
    try {
      const handle = await pickStorageFolder();
      if (handle) {
        setFolderHandle(handle);
        const status = await getFolderPermission(handle);
        setPermissionStatus(status);
      }
    } catch (error: any) {
      alert(`Error selecting folder: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPermission = async () => {
    if (!folderHandle) return;
    
    setLoading(true);
    try {
      const status = await requestFolderPermission(folderHandle);
      setPermissionStatus(status);
      
      if (status === 'granted') {
        // Re-store the handle after permission is granted
        await pickStorageFolder();
      }
    } catch (error: any) {
      alert(`Error requesting permission: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClearFolder = async () => {
    if (confirm('Clear stored folder? You will need to select it again.')) {
      await clearStoredFolder();
      setFolderHandle(null);
      setPermissionStatus('prompt');
    }
  };

  const handlePersistStorage = async () => {
    setLoading(true);
    try {
      const persisted = await persistStorage();
      setPersistChecked(true);
      setStoragePersisted(persisted);
      
      if (!persisted) {
        alert('Could not request persistent storage. Your browser may not support it or storage quota may be exceeded.');
      }
    } catch (error: any) {
      alert(`Error requesting persistent storage: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClientIdChange = (value: string) => {
    setClientIdState(value);
    setGoogleError(null);
    
    // Debounce save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(async () => {
      if (value.trim()) {
        await setClientId(value.trim());
      }
    }, 500);
  };

  const handleConnectGoogle = async () => {
    if (!clientId.trim()) {
      setGoogleError('Please enter a Google OAuth Client ID first');
      return;
    }

    setLoading(true);
    setGoogleError(null);
    try {
      await connectGoogle();
      setGoogleConnected(true);
      
      // Fetch calendars
      const calList = await listCalendars();
      setCalendars(calList);
    } catch (error: any) {
      setGoogleError(error.message || 'Failed to connect to Google');
      setGoogleConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectGoogle = () => {
    if (confirm('Disconnect from Google Calendar? You will need to reconnect to view events.')) {
      clearAccessToken();
      setGoogleConnected(false);
      setCalendars([]);
      setSelectedCalendarId('');
      setKV(SELECTED_CALENDAR_KEY, '');
    }
  };

  const handleCalendarChange = async (calendarId: string) => {
    setSelectedCalendarId(calendarId);
    await setKV(SELECTED_CALENDAR_KEY, calendarId);
  };

  const getPermissionStatusColor = (status: PermissionState) => {
    switch (status) {
      case 'granted':
        return '#4caf50';
      case 'denied':
        return '#f44336';
      default:
        return '#ff9800';
    }
  };

  return (
    <div>
      <h1>Settings</h1>
      
      <section style={{ marginBottom: '2rem' }}>
        <h2>Storage Folder</h2>
        
        <div style={{ marginBottom: '1rem' }}>
          <strong>File System Access API:</strong>{' '}
          <span style={{ 
            color: fsSupported ? '#4caf50' : '#f44336',
            fontWeight: 'bold'
          }}>
            {fsSupported ? 'Supported' : 'Not Supported'}
          </span>
        </div>

        {folderHandle && (
          <div style={{ marginBottom: '1rem' }}>
            <strong>Current folder:</strong> {folderHandle.name}
          </div>
        )}

        {folderHandle && (
          <div style={{ marginBottom: '1rem' }}>
            <strong>Permission status:</strong>{' '}
            <span style={{ 
              color: getPermissionStatusColor(permissionStatus),
              fontWeight: 'bold'
            }}>
              {permissionStatus}
            </span>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button 
            onClick={handleSelectFolder} 
            disabled={!fsSupported || loading}
            style={{ padding: '0.5rem 1rem' }}
          >
            {folderHandle ? 'Change Storage Folder' : 'Select Storage Folder'}
          </button>

          {folderHandle && permissionStatus !== 'granted' && (
            <button 
              onClick={handleRequestPermission}
              disabled={loading}
              style={{ padding: '0.5rem 1rem' }}
            >
              Re-authorize
            </button>
          )}

          {folderHandle && (
            <button 
              onClick={handleClearFolder}
              disabled={loading}
              style={{ padding: '0.5rem 1rem' }}
            >
              Clear Stored Folder
            </button>
          )}
        </div>
      </section>

      <section>
        <h2>Storage Persistence</h2>
        
        {storagePersisted !== null && (
          <div style={{ marginBottom: '1rem' }}>
            <strong>Persistent storage:</strong>{' '}
            <span style={{ 
              color: storagePersisted ? '#4caf50' : '#ff9800',
              fontWeight: 'bold'
            }}>
              {storagePersisted ? 'Enabled' : 'Not Enabled'}
            </span>
          </div>
        )}

        {!persistChecked && (
          <button 
            onClick={handlePersistStorage}
            disabled={loading}
            style={{ padding: '0.5rem 1rem' }}
          >
            Request Persistent Storage
          </button>
        )}
      </section>

      <section>
        <h2>Google Calendar</h2>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            <strong>Google OAuth Client ID:</strong>
          </label>
          <input
            ref={clientIdInputRef}
            type="text"
            value={clientId}
            onChange={(e) => handleClientIdChange(e.target.value)}
            placeholder="Enter your Google OAuth Client ID"
            style={{
              width: '100%',
              maxWidth: '500px',
              padding: '0.5rem',
              fontSize: '0.9rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          />
          <div style={{ marginTop: '0.25rem', fontSize: '0.85rem', color: '#666' }}>
            Get your Client ID from Google Cloud Console (see README for instructions)
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <strong>Connection status:</strong>{' '}
          <span style={{ 
            color: googleConnected ? '#4caf50' : '#ff9800',
            fontWeight: 'bold'
          }}>
            {googleConnected ? 'Connected' : 'Not Connected'}
          </span>
        </div>

        {googleError && (
          <div style={{ 
            marginBottom: '1rem', 
            padding: '0.75rem', 
            backgroundColor: '#ffebee', 
            color: '#c62828',
            borderRadius: '4px',
            fontSize: '0.9rem'
          }}>
            {googleError}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {!googleConnected ? (
            <button 
              onClick={handleConnectGoogle}
              disabled={loading || !clientId.trim()}
              style={{ padding: '0.5rem 1rem' }}
            >
              Connect Google
            </button>
          ) : (
            <button 
              onClick={handleDisconnectGoogle}
              disabled={loading}
              style={{ padding: '0.5rem 1rem', backgroundColor: '#f44336' }}
            >
              Disconnect
            </button>
          )}
        </div>

        {googleConnected && calendars.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>
              <strong>Select Calendar:</strong>
            </label>
            <select
              value={selectedCalendarId}
              onChange={(e) => handleCalendarChange(e.target.value)}
              style={{
                width: '100%',
                maxWidth: '500px',
                padding: '0.5rem',
                fontSize: '0.9rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
              }}
            >
              <option value="">-- Select a calendar --</option>
              {calendars.map((cal) => (
                <option key={cal.id} value={cal.id}>
                  {cal.summary} {cal.primary ? '(Primary)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </section>
    </div>
  );
}
