import { getKV, setKV, deleteKV } from '../db/kv';

const STORAGE_FOLDER_KEY = 'storageFolderHandle';

/**
 * Pick a storage folder using the File System Access API
 */
export async function pickStorageFolder(): Promise<FileSystemDirectoryHandle | null> {
  if (!('showDirectoryPicker' in window)) {
    throw new Error('File System Access API not supported in this browser');
  }

  try {
    const handle = await (window as any).showDirectoryPicker({
      mode: 'readwrite',
    }) as FileSystemDirectoryHandle;
    
    // Store the handle in IndexedDB
    await setKV(STORAGE_FOLDER_KEY, handle);
    
    return handle;
  } catch (error: any) {
    // User cancelled or error occurred
    if (error.name === 'AbortError') {
      return null;
    }
    throw error;
  }
}

/**
 * Get the stored folder handle from IndexedDB
 */
export async function getStoredFolder(): Promise<FileSystemDirectoryHandle | null> {
  const handle = await getKV<FileSystemDirectoryHandle>(STORAGE_FOLDER_KEY);
  return handle || null;
}

/**
 * Check the permission status for a directory handle
 */
export async function getFolderPermission(
  handle: FileSystemDirectoryHandle
): Promise<PermissionState> {
  if (!('query' in handle)) {
    return 'prompt';
  }

  try {
    const status = await (handle as any).queryPermission({ mode: 'readwrite' });
    return status;
  } catch (error) {
    return 'denied';
  }
}

/**
 * Request permission for a directory handle
 */
export async function requestFolderPermission(
  handle: FileSystemDirectoryHandle
): Promise<PermissionState> {
  if (!('requestPermission' in handle)) {
    return 'denied';
  }

  try {
    const status = await (handle as any).requestPermission({ mode: 'readwrite' });
    return status;
  } catch (error) {
    return 'denied';
  }
}

/**
 * Clear the stored folder handle
 */
export async function clearStoredFolder(): Promise<void> {
  await deleteKV(STORAGE_FOLDER_KEY);
}

/**
 * Check if File System Access API is supported
 */
export function isFileSystemAccessSupported(): boolean {
  return 'showDirectoryPicker' in window;
}

/**
 * Request persistent storage from the browser
 */
export async function persistStorage(): Promise<boolean> {
  if (!('storage' in navigator) || !('persist' in navigator.storage)) {
    return false;
  }

  try {
    const persisted = await navigator.storage.persist();
    return persisted;
  } catch (error) {
    return false;
  }
}

/**
 * Check if storage is persisted
 */
export async function isStoragePersisted(): Promise<boolean> {
  if (!('storage' in navigator) || !('persisted' in navigator.storage)) {
    return false;
  }

  try {
    const persisted = await navigator.storage.persisted();
    return persisted;
  } catch (error) {
    return false;
  }
}

/**
 * Validate a stored folder handle
 * Checks if the handle is still valid and has required permissions
 */
export async function validateStoredFolderHandle(
  handle: FileSystemDirectoryHandle
): Promise<{ ok: boolean; reason?: string; permission?: PermissionState }> {
  // Check if File System Access API is supported
  if (!('showDirectoryPicker' in window)) {
    return { ok: false, reason: 'unsupported' };
  }

  // Check permission status
  let permission: PermissionState;
  try {
    permission = await getFolderPermission(handle);
  } catch (error) {
    return { ok: false, reason: 'permission_query_failed', permission: 'denied' };
  }

  if (permission === 'denied') {
    return { ok: false, reason: 'permission_denied', permission };
  }

  // Try a lightweight operation to verify handle is still valid
  try {
    // Use values() iterator - lightweight operation
    // This will throw if handle is invalid
    for await (const _ of (handle as any).values()) {
      break; // Just need to verify we can iterate, then break immediately
    }
  } catch (error) {
    return { ok: false, reason: 'handle_invalid', permission };
  }

  return { ok: true, permission };
}
