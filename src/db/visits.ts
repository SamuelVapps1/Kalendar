import { db } from './db';
import { Visit } from './schema';

// Serialized write queue per visitId
const writeQueue = new Map<string, Promise<void>>();

/**
 * Update a visit with queued writes to prevent overlapping saves
 * Ensures writes are serialized per visitId
 */
export async function updateVisitQueued(
  visitId: string,
  patch: Partial<Pick<Visit, 'status' | 'notes' | 'priceCents' | 'durationMin'>>
): Promise<void> {
  // Get existing promise or start with resolved promise
  const previousWrite = writeQueue.get(visitId) || Promise.resolve();

  // Chain new write after previous one completes
  const newWrite = previousWrite
    .then(async () => {
      await updateVisit(visitId, patch);
    })
    .catch((error) => {
      // Log error but don't break the chain
      console.error(`Failed to update visit ${visitId}:`, error);
      throw error; // Re-throw so caller can handle it
    })
    .finally(() => {
      // Clean up queue entry if this is the last write
      if (writeQueue.get(visitId) === newWrite) {
        writeQueue.delete(visitId);
      }
    });

  writeQueue.set(visitId, newWrite);
  return newWrite;
}

/**
 * Get or create a visit for a calendar event
 */
export async function getOrCreateVisitForEvent(
  calendarId: string,
  eventId: string,
  dogId: string,
  dateISO: string
): Promise<Visit> {
  // Try to find existing visit
  const existing = await db.visits
    .where('[calendarId+calendarEventId]')
    .equals([calendarId, eventId])
    .first();

  if (existing) {
    return existing;
  }

  // Create new visit
  const visitId = crypto.randomUUID();
  const now = new Date();

  const visit: Visit = {
    id: visitId,
    dogId,
    calendarId,
    calendarEventId: eventId,
    dateISO,
    status: 'planned',
    notes: '',
    priceCents: null,
    durationMin: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.visits.add(visit);
  return visit;
}

/**
 * Get visit by ID
 */
export async function getVisitById(visitId: string): Promise<Visit | null> {
  return await db.visits.get(visitId) || null;
}

/**
 * Get visit by calendar event
 */
export async function getVisitForEvent(
  calendarId: string,
  eventId: string
): Promise<Visit | null> {
  return await db.visits
    .where('[calendarId+calendarEventId]')
    .equals([calendarId, eventId])
    .first() || null;
}

/**
 * Update a visit
 */
export async function updateVisit(
  visitId: string,
  patch: Partial<Pick<Visit, 'status' | 'notes' | 'priceCents' | 'durationMin'>>
): Promise<void> {
  await db.visits.update(visitId, {
    ...patch,
    updatedAt: new Date(),
  });
}

/**
 * Get all visits for a dog
 */
export async function getVisitsForDog(dogId: string): Promise<Visit[]> {
  return await db.visits.where('dogId').equals(dogId).sortBy('dateISO');
}
