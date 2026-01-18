import { getVisitFolderHandle } from '../fs/visitPhotos';
import { BackupManifest } from './backupTypes';
import { VisitPhoto } from '../db/schema';
import { db } from '../db/db';

/**
 * Write backup manifest to storage folder
 */
export async function writeManifestToFolder(
  storageHandle: FileSystemDirectoryHandle,
  manifest: BackupManifest
): Promise<string> {
  // Ensure GroomingDB/backup folder exists
  let groomingDbFolder: FileSystemDirectoryHandle;
  try {
    groomingDbFolder = await storageHandle.getDirectoryHandle('GroomingDB', { create: true });
  } catch (error) {
    throw new Error('Failed to access GroomingDB folder. Please check folder permissions.');
  }

  let backupFolder: FileSystemDirectoryHandle;
  try {
    backupFolder = await groomingDbFolder.getDirectoryHandle('backup', { create: true });
  } catch (error) {
    throw new Error('Failed to access backup folder. Please check folder permissions.');
  }

  // Generate filename with timestamp
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const filename = `manifest_${year}-${month}-${day}_${hours}-${minutes}-${seconds}.json`;

  // Write manifest file
  const fileHandle = await backupFolder.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  const jsonString = JSON.stringify(manifest, null, 2);
  await writable.write(jsonString);
  await writable.close();

  return filename;
}

/**
 * Verify that all photo files referenced in visitPhotos exist in the filesystem
 */
export async function verifyPhotos(storageHandle: FileSystemDirectoryHandle): Promise<{
  total: number;
  missing: Array<{ visitId: string; relativePath: string; photoId: string }>;
}> {
  const missing: Array<{ visitId: string; relativePath: string; photoId: string }> = [];
  
  // Get all visit photos from DB
  const allPhotos = await db.visitPhotos.toArray();
  
  // Group by visitId for efficient checking
  const photosByVisit = new Map<string, VisitPhoto[]>();
  for (const photo of allPhotos) {
    const photos = photosByVisit.get(photo.visitId) || [];
    photos.push(photo);
    photosByVisit.set(photo.visitId, photos);
  }

  // Check each visit's photos
  for (const [visitId, photos] of photosByVisit.entries()) {
    let visitFolder: FileSystemDirectoryHandle | null = null;
    
    try {
      visitFolder = await getVisitFolderHandle(storageHandle, visitId, false);
    } catch (error) {
      // Visit folder doesn't exist - mark all photos as missing
      for (const photo of photos) {
        missing.push({
          visitId,
          relativePath: photo.relativePath,
          photoId: photo.id,
        });
      }
      continue;
    }

    // Check each photo file
    for (const photo of photos) {
      const filename = photo.relativePath.split('/').pop();
      if (!filename) {
        missing.push({
          visitId,
          relativePath: photo.relativePath,
          photoId: photo.id,
        });
        continue;
      }

      try {
        await visitFolder.getFileHandle(filename);
        // File exists - good
      } catch (error) {
        // File doesn't exist
        missing.push({
          visitId,
          relativePath: photo.relativePath,
          photoId: photo.id,
        });
      }
    }
  }

  return {
    total: allPhotos.length,
    missing,
  };
}
