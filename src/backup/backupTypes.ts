import { Client, Dog, Visit, EventLink, VisitPhoto } from '../db/schema';

export const SCHEMA_VERSION = 1;

export interface BackupData {
  clients: Client[];
  dogs: Dog[];
  visits: Visit[];
  eventLinks: EventLink[];
  visitPhotos: VisitPhoto[];
  kv: Record<string, any>; // Only safe keys
}

export interface BackupManifest {
  schemaVersion: number;
  exportedAt: string; // ISO string
  app: {
    name: string;
    version: string;
  };
  data: BackupData;
}

// Safe KV keys that can be exported
export const SAFE_KV_KEYS = [
  'selectedCalendarId',
  'googleClientId',
  // Add other non-sensitive UI prefs here
] as const;

export type SafeKVKey = typeof SAFE_KV_KEYS[number];
