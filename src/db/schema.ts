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
  dateISO: string; // ISO date string
  notes?: string;
  priceCents?: number;
  durationMin?: number;
  status: 'planned' | 'done' | 'no_show';
  createdAt: Date;
  updatedAt: Date;
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
