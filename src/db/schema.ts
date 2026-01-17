// Database schema types

export interface Client {
  id: string;
  ownerName: string;
  phone?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Dog {
  id: string;
  clientId?: string; // Optional for now
  dogName: string;
  breed?: string;
  notes?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Visit {
  id: string;
  dogId: string;
  calendarId: string;
  calendarEventId: string;
  dateISO: string; // ISO date string
  notes?: string;
  priceCents?: number | null;
  durationMin?: number | null;
  status: 'planned' | 'done' | 'no_show';
  createdAt: Date;
  updatedAt: Date;
}

export interface VisitPhoto {
  id: string;
  visitId: string;
  name: string;
  relativePath: string; // e.g., "visits/<visitId>/after_1234567890_1.jpg"
  createdAt: Date;
}

export interface EventLink {
  id: string;
  calendarId: string;
  calendarEventId: string;
  dogId: string;
  createdAt: Date;
  updatedAt: number; // timestamp
}

export interface KV {
  key: string;
  value: any; // Structured clone compatible
}
