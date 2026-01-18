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
  validateStoredFolderHandle,
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
import { exportBackupJson, importBackupJson, applyBackupReplace, downloadJson, generateBackupFilename } from '../backup/exportImport';
import { writeManifestToFolder, verifyPhotos } from '../backup/folderBackup';
import { getStorageFolderHandleOrThrow } from '../fs/visitPhotos';

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
  
  // Folder validation state
  const [folderValidation, setFolderValidation] = useState<{
    ok: boolean;
    reason?: string;
    permission?: PermissionState;
  } | null>(null);
  const [validatingFolder, setValidatingFolder] = useState(false);

  // Backup state
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupSuccess, setBackupSuccess] = useState<string | null>(null);
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [verifyingPhotos, setVerifyingPhotos] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    total: number;
    missing: Array<{ visitId: string; relativePath: string; photoId: string }>;
  } | null>(null);
  const [showVerifyResults, setShowVerifyResults] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Re-validate folder when handle changes
  useEffect(() => {
    if (folderHandle) {
      validateFolder();
    }
  }, [folderHandle]);

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
      
      // Validate folder handle
      await validateFolder();
    } else {
      setPermissionStatus('prompt');
      setFolderValidation(null);
    }
  };

  const validateFolder = async () => {
    if (!folderHandle) {
      setFolderValidation(null);
      return;
    }

    setValidatingFolder(true);
    try {
      const validation = await validateStoredFolderHandle(folderHandle);
      setFolderValidation(validation);
      
      // Update permission status from validation
      if (validation.permission) {
        setPermissionStatus(validation.permission);
      }
    } catch (error) {
      setFolderValidation({ ok: false, reason: 'validation_failed' });
    } finally {
      setValidatingFolder(false);
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
        
        // Validate the new folder
        const validation = await validateStoredFolderHandle(handle);
        setFolderValidation(validation);
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

  // Backup handlers
  const handleExportData = async () => {
    setBackupLoading(true);
    setBackupError(null);
    setBackupSuccess(null);
    
    try {
      const manifest = await exportBackupJson();
      const filename = generateBackupFilename();
      downloadJson(filename, manifest);
      setBackupSuccess('Data exported successfully!');
      
      // Clear success message after 5 seconds
      setTimeout(() => setBackupSuccess(null), 5000);
    } catch (error: any) {
      setBackupError(error.message || 'Failed to export data');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleExportManifest = async () => {
    if (!folderHandle || permissionStatus !== 'granted') {
      setBackupError('Storage folder not selected or permission denied. Please select a folder first.');
      return;
    }

    setBackupLoading(true);
    setBackupError(null);
    setBackupSuccess(null);

    try {
      const storageHandle = await getStorageFolderHandleOrThrow();
      const manifest = await exportBackupJson();
      const filename = await writeManifestToFolder(storageHandle, manifest);
      setBackupSuccess(`Manifest saved: ${filename}`);
      
      // Clear success message after 5 seconds
      setTimeout(() => setBackupSuccess(null), 5000);
    } catch (error: any) {
      setBackupError(error.message || 'Failed to export manifest');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleImportFile = async () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Validate file first
      await importBackupJson(file);
      // If valid, show confirmation
      setPendingImportFile(file);
      setImportConfirmOpen(true);
    } catch (error: any) {
      setBackupError(error.message || 'Invalid backup file');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingImportFile) return;

    setBackupLoading(true);
    setBackupError(null);
    setBackupSuccess(null);
    setImportConfirmOpen(false);

    try {
      const manifest = await importBackupJson(pendingImportFile);
      await applyBackupReplace(manifest);
      
      // Reload settings to reflect imported values
      await loadGoogleSettings();
      
      setBackupSuccess('Data imported successfully! Please refresh the page to see changes.');
      
      // Clear success message after 10 seconds
      setTimeout(() => setBackupSuccess(null), 10000);
    } catch (error: any) {
      setBackupError(error.message || 'Failed to import data');
    } finally {
      setBackupLoading(false);
      setPendingImportFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCancelImport = () => {
    setImportConfirmOpen(false);
    setPendingImportFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleVerifyPhotos = async () => {
    if (!folderHandle || permissionStatus !== 'granted') {
      setBackupError('Storage folder not selected or permission denied. Please select a folder first.');
      return;
    }

    setVerifyingPhotos(true);
    setBackupError(null);
    setVerifyResult(null);
    setShowVerifyResults(false);

    try {
      const storageHandle = await getStorageFolderHandleOrThrow();
      const result = await verifyPhotos(storageHandle);
      setVerifyResult(result);
      setShowVerifyResults(true);
    } catch (error: any) {
      setBackupError(error.message || 'Failed to verify photos');
    } finally {
      setVerifyingPhotos(false);
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
          <>
            <div style={{ marginBottom: '1rem' }}>
              <strong>Permission status:</strong>{' '}
              <span style={{ 
                color: getPermissionStatusColor(permissionStatus),
                fontWeight: 'bold'
              }}>
                {permissionStatus}
              </span>
            </div>
            
            {validatingFolder && (
              <div style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#666' }}>
                Validating folder...
              </div>
            )}
            
            {!validatingFolder && folderValidation && (
              <div style={{ marginBottom: '1rem' }}>
                <strong>Validation status:</strong>{' '}
                <span style={{ 
                  color: folderValidation.ok ? '#4caf50' : '#f44336',
                  fontWeight: 'bold'
                }}>
                  {folderValidation.ok ? 'Valid' : 'Invalid'}
                </span>
                {folderValidation.reason && (
                  <div style={{ 
                    marginTop: '0.25rem', 
                    fontSize: '0.85rem', 
                    color: folderValidation.ok ? '#666' : '#c62828' 
                  }}>
                    {folderValidation.reason === 'permission_denied' && 'Permission denied'}
                    {folderValidation.reason === 'handle_invalid' && 'Folder handle is invalid'}
                    {folderValidation.reason === 'unsupported' && 'File System Access API not supported'}
                    {folderValidation.reason === 'permission_query_failed' && 'Failed to query permission'}
                    {folderValidation.reason === 'validation_failed' && 'Validation check failed'}
                  </div>
                )}
              </div>
            )}
            
            {!validatingFolder && folderValidation && !folderValidation.ok && (
              <div style={{ 
                marginBottom: '1rem',
                padding: '0.75rem',
                backgroundColor: '#fff3cd',
                border: '1px solid #ffc107',
                borderRadius: '4px',
                fontSize: '0.9rem'
              }}>
                <div style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Folder handle is invalid. Please re-select the folder.
                </div>
                <button
                  onClick={handleSelectFolder}
                  disabled={loading}
                  style={{ 
                    padding: '0.5rem 1rem',
                    backgroundColor: '#ff9800',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Re-select Folder
                </button>
              </div>
            )}
          </>
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

      <section>
        <h2>Backup & Restore</h2>
        
        <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#e3f2fd', borderRadius: '4px', fontSize: '0.9rem' }}>
          <strong>Backup is for moving to a new device.</strong> Export your data before resetting your Chromebook or switching devices.
        </div>

        {backupError && (
          <div style={{ 
            marginBottom: '1rem', 
            padding: '0.75rem', 
            backgroundColor: '#ffebee', 
            color: '#c62828',
            borderRadius: '4px',
            fontSize: '0.9rem'
          }}>
            {backupError}
          </div>
        )}

        {backupSuccess && (
          <div style={{ 
            marginBottom: '1rem', 
            padding: '0.75rem', 
            backgroundColor: '#e8f5e9', 
            color: '#2e7d32',
            borderRadius: '4px',
            fontSize: '0.9rem'
          }}>
            {backupSuccess}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <button 
              onClick={handleExportData}
              disabled={backupLoading}
              style={{ padding: '0.5rem 1rem', marginRight: '0.5rem' }}
            >
              {backupLoading ? 'Exporting...' : 'Export Data (JSON)'}
            </button>
            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
              Downloads a JSON file with all your data (clients, dogs, visits, photos metadata, settings)
            </div>
          </div>

          <div>
            <button 
              onClick={handleExportManifest}
              disabled={backupLoading || !folderHandle || permissionStatus !== 'granted'}
              style={{ padding: '0.5rem 1rem', marginRight: '0.5rem' }}
            >
              {backupLoading ? 'Exporting...' : 'Export + Photos Manifest'}
            </button>
            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
              Writes a manifest JSON to your storage folder (includes photo file list)
            </div>
          </div>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelected}
              style={{ display: 'none' }}
            />
            <button 
              onClick={handleImportFile}
              disabled={backupLoading}
              style={{ padding: '0.5rem 1rem', marginRight: '0.5rem' }}
            >
              {backupLoading ? 'Importing...' : 'Import Data (JSON)'}
            </button>
            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
              Import a backup JSON file. This will replace all existing data.
            </div>
          </div>

          <div>
            <button 
              onClick={handleVerifyPhotos}
              disabled={verifyingPhotos || !folderHandle || permissionStatus !== 'granted'}
              style={{ padding: '0.5rem 1rem', marginRight: '0.5rem' }}
            >
              {verifyingPhotos ? 'Verifying...' : 'Verify Photos'}
            </button>
            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
              Check if all photo files referenced in the database actually exist in the storage folder
            </div>
          </div>
        </div>

        {showVerifyResults && verifyResult && (
          <div style={{
            padding: '1rem',
            backgroundColor: '#f5f5f5',
            borderRadius: '4px',
            marginTop: '1rem',
          }}>
            <div style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Photo Verification Results
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              Total photos: <strong>{verifyResult.total}</strong>
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              Missing files: <strong style={{ color: verifyResult.missing.length > 0 ? '#f44336' : '#4caf50' }}>
                {verifyResult.missing.length}
              </strong>
            </div>
            {verifyResult.missing.length > 0 && (
              <details style={{ marginTop: '0.5rem' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#f44336' }}>
                  Show missing files ({verifyResult.missing.length})
                </summary>
                <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
                  {verifyResult.missing.map((item, idx) => (
                    <li key={idx} style={{ marginBottom: '0.25rem' }}>
                      <strong>Visit {item.visitId}:</strong> {item.relativePath}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {verifyResult.missing.length === 0 && (
              <div style={{ color: '#4caf50', fontWeight: 'bold', marginTop: '0.5rem' }}>
                ✓ All photos verified successfully!
              </div>
            )}
          </div>
        )}
      </section>

      {importConfirmOpen && (
        <div style={{
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
        }}>
          <div style={{
            backgroundColor: '#fff',
            padding: '2rem',
            borderRadius: '8px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
          }}>
            <h3 style={{ marginTop: 0 }}>Confirm Import</h3>
            <p style={{ marginBottom: '1rem', color: '#c62828', fontWeight: 'bold' }}>
              ⚠️ WARNING: This will replace all existing data with the imported backup.
            </p>
            <p style={{ marginBottom: '1.5rem' }}>
              All current clients, dogs, visits, photos metadata, and settings will be deleted and replaced with the backup data.
            </p>
            <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: '#666' }}>
              Are you sure you want to continue?
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                onClick={handleCancelImport}
                disabled={backupLoading}
                style={{ padding: '0.5rem 1rem', backgroundColor: '#e0e0e0' }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={backupLoading}
                style={{ padding: '0.5rem 1rem', backgroundColor: '#f44336', color: 'white' }}
              >
                {backupLoading ? 'Importing...' : 'Yes, Replace All Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
