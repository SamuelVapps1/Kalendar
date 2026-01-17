import { getAccessToken } from './auth';

export interface Calendar {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
}

export interface CalendarListResponse {
  items: Calendar[];
}

export interface EventDateTime {
  date?: string; // All-day events (YYYY-MM-DD)
  dateTime?: string; // Timed events (RFC3339)
  timeZone?: string;
}

export interface CalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: EventDateTime;
  end: EventDateTime;
  htmlLink: string;
  status: string;
}

export interface EventsResponse {
  items: CalendarEvent[];
  nextPageToken?: string;
}

/**
 * List all calendars for the authenticated user
 */
export async function listCalendars(): Promise<Calendar[]> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated. Please connect to Google first.');
  }

  const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch calendars: ${response.status} ${error}`);
  }

  const data: CalendarListResponse = await response.json();
  return data.items;
}

/**
 * List events for a calendar within a time range
 */
export async function listEvents(
  calendarId: string,
  timeMin: Date,
  timeMax: Date
): Promise<CalendarEvent[]> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated. Please connect to Google first.');
  }

  // Convert dates to RFC3339 format
  const timeMinStr = timeMin.toISOString();
  const timeMaxStr = timeMax.toISOString();

  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(calendarId) + '/events');
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('timeMin', timeMinStr);
  url.searchParams.set('timeMax', timeMaxStr);

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch events: ${response.status} ${error}`);
  }

  const data: EventsResponse = await response.json();
  return data.items || [];
}

/**
 * Get a single event by ID
 */
export async function getEvent(
  calendarId: string,
  eventId: string
): Promise<CalendarEvent> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated. Please connect to Google first.');
  }

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch event: ${response.status} ${error}`);
  }

  const event: CalendarEvent = await response.json();
  return event;
}

/**
 * Update an event's description
 */
export async function patchEventDescription(
  calendarId: string,
  eventId: string,
  description: string
): Promise<CalendarEvent> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated. Please connect to Google first.');
  }

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      description,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update event: ${response.status} ${error}`);
  }

  const event: CalendarEvent = await response.json();
  return event;
}
