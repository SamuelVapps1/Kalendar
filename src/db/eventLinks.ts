import { db } from './db';
import { EventLink } from './schema';

/**
 * Get dog link for a specific event
 */
export async function getDogLinkForEvent(
  calendarId: string,
  eventId: string
): Promise<EventLink | null> {
  const link = await db.eventLinks
    .where('[calendarId+calendarEventId]')
    .equals([calendarId, eventId])
    .first();
  return link || null;
}

/**
 * Set dog link for an event
 */
export async function setDogLinkForEvent(
  calendarId: string,
  eventId: string,
  dogId: string
): Promise<void> {
  const existing = await getDogLinkForEvent(calendarId, eventId);
  const now = Date.now();

  if (existing) {
    // Update existing link
    await db.eventLinks.update(existing.id, {
      dogId,
      updatedAt: now,
    });
  } else {
    // Create new link
    await db.eventLinks.add({
      id: `${calendarId}:${eventId}`,
      calendarId,
      calendarEventId: eventId,
      dogId,
      createdAt: new Date(),
      updatedAt: now,
    });
  }
}

/**
 * Remove dog link for an event
 */
export async function removeDogLinkForEvent(
  calendarId: string,
  eventId: string
): Promise<void> {
  const existing = await getDogLinkForEvent(calendarId, eventId);
  if (existing) {
    await db.eventLinks.delete(existing.id);
  }
}

/**
 * Get all links for a specific dog
 */
export async function getLinksForDog(dogId: string): Promise<EventLink[]> {
  return await db.eventLinks.where('dogId').equals(dogId).toArray();
}
