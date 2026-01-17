import { db } from './db';
import { Visit } from './schema';

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
