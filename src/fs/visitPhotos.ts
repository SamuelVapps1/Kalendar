import { getStoredFolder, requestFolderPermission, validateStoredFolderHandle } from './storageFolder';

/**
 * Get the storage folder handle or throw if not available
 * Validates the handle before returning it
 */
export async function getStorageFolderHandleOrThrow(): Promise<FileSystemDirectoryHandle> {
  const handle = await getStoredFolder();
  if (!handle) {
    throw new Error('No storage folder selected. Please select a folder in Settings.');
  }

  // Validate handle
  const validation = await validateStoredFolderHandle(handle);
  if (!validation.ok) {
    if (validation.reason === 'permission_denied') {
      throw new Error('Storage folder permission denied. Please grant permission in Settings.');
    } else if (validation.reason === 'handle_invalid') {
      throw new Error('Storage folder handle is invalid. Please re-select the folder in Settings.');
    } else if (validation.reason === 'unsupported') {
      throw new Error('File System Access API is not supported in this browser.');
    } else {
      throw new Error('Storage folder is invalid. Please re-select the folder in Settings.');
    }
  }

  // If permission is prompt, try to request it
  if (validation.permission === 'prompt') {
    const newPermission = await requestFolderPermission(handle);
    if (newPermission !== 'granted') {
      throw new Error('Storage folder permission denied. Please grant permission in Settings.');
    }
  }

  return handle;
}

/**
 * Get or create a visit folder within the storage folder
 */
export async function getVisitFolderHandle(
  storageHandle: FileSystemDirectoryHandle,
  visitId: string,
  create: boolean = true
): Promise<FileSystemDirectoryHandle> {
  // Ensure GroomingDB folder exists
  let groomingDbFolder: FileSystemDirectoryHandle;
  try {
    groomingDbFolder = await storageHandle.getDirectoryHandle('GroomingDB', { create });
  } catch (error) {
    throw new Error('Failed to access GroomingDB folder. Please check folder permissions.');
  }

  // Ensure visits folder exists
  let visitsFolder: FileSystemDirectoryHandle;
  try {
    visitsFolder = await groomingDbFolder.getDirectoryHandle('visits', { create });
  } catch (error) {
    throw new Error('Failed to access visits folder. Please check folder permissions.');
  }

  // Get or create visit-specific folder
  const visitFolder = await visitsFolder.getDirectoryHandle(visitId, { create });
  return visitFolder;
}

/**
 * Generate a filename for a photo
 */
function generatePhotoFilename(file: File, index: number): string {
  const timestamp = Date.now();
  const ext = file.name.split('.').pop() || 'jpg';
  return `after_${timestamp}_${index}.${ext}`;
}

/**
 * Save files to a visit folder
 */
export async function saveFilesToVisit(
  visitId: string,
  files: File[]
): Promise<Array<{ name: string; relativePath: string }>> {
  const storageHandle = await getStorageFolderHandleOrThrow();
  const visitFolder = await getVisitFolderHandle(storageHandle, visitId, true);

  const savedPhotos: Array<{ name: string; relativePath: string }> = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filename = generatePhotoFilename(file, i);
    const relativePath = `visits/${visitId}/${filename}`;

    try {
      const fileHandle = await visitFolder.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(file);
      await writable.close();

      savedPhotos.push({
        name: filename,
        relativePath,
      });
    } catch (error: any) {
      console.error(`Failed to save file ${file.name}:`, error);
      throw new Error(`Failed to save ${file.name}: ${error.message}`);
    }
  }

  return savedPhotos;
}

/**
 * Read a photo file as a blob URL
 */
export async function readPhotoAsBlobUrl(
  visitId: string,
  relativePath: string
): Promise<string> {
  const storageHandle = await getStorageFolderHandleOrThrow();
  const visitFolder = await getVisitFolderHandle(storageHandle, visitId, false);

  // Extract filename from relativePath (e.g., "visits/<visitId>/filename.jpg" -> "filename.jpg")
  const filename = relativePath.split('/').pop();
  if (!filename) {
    throw new Error('Invalid relative path');
  }

  try {
    const fileHandle = await visitFolder.getFileHandle(filename);
    const file = await fileHandle.getFile();
    return URL.createObjectURL(file);
  } catch (error: any) {
    throw new Error(`Failed to read photo: ${error.message}`);
  }
}

/**
 * Delete a photo file from the filesystem
 */
export async function deletePhotoFile(
  visitId: string,
  relativePath: string
): Promise<void> {
  const storageHandle = await getStorageFolderHandleOrThrow();
  const visitFolder = await getVisitFolderHandle(storageHandle, visitId, false);

  // Extract filename from relativePath
  const filename = relativePath.split('/').pop();
  if (!filename) {
    throw new Error('Invalid relative path');
  }

  try {
    // Chrome supports removeEntry on directory handles
    await (visitFolder as any).removeEntry(filename, { recursive: false });
  } catch (error: any) {
    // If file doesn't exist, that's fine (idempotent)
    if (error.name === 'NotFoundError') {
      return;
    }
    throw new Error(`Failed to delete photo file: ${error.message}`);
  }
}
