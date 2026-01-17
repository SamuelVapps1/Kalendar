import { db } from './db';
import { VisitPhoto } from './schema';

/**
 * Add a photo record to a visit
 */
export async function addVisitPhoto(
  visitId: string,
  name: string,
  relativePath: string
): Promise<VisitPhoto> {
  const photo: VisitPhoto = {
    id: crypto.randomUUID(),
    visitId,
    name,
    relativePath,
    createdAt: new Date(),
  };

  await db.visitPhotos.add(photo);
  return photo;
}

/**
 * List all photos for a visit
 */
export async function listVisitPhotos(visitId: string): Promise<VisitPhoto[]> {
  return await db.visitPhotos
    .where('visitId')
    .equals(visitId)
    .sortBy('createdAt');
}

/**
 * Delete a photo record
 */
export async function deleteVisitPhoto(photoId: string): Promise<void> {
  await db.visitPhotos.delete(photoId);
}
