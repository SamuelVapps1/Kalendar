import { db } from '../db/db';
import { getKV, setKV, deleteKV } from '../db/kv';
import { BackupManifest, BackupData, SCHEMA_VERSION, SAFE_KV_KEYS } from './backupTypes';

const APP_NAME = 'groom-crm';
const APP_VERSION = '1.0.0'; // Match package.json version

/**
 * Export all backup data from IndexedDB
 */
export async function exportBackupJson(): Promise<BackupManifest> {
  // Fetch all data
  const clients = await db.clients.toArray();
  const dogs = await db.dogs.toArray();
  const visits = await db.visits.toArray();
  const eventLinks = await db.eventLinks.toArray();
  const visitPhotos = await db.visitPhotos.toArray();

  // Export only safe KV keys
  const kv: Record<string, any> = {};
  for (const key of SAFE_KV_KEYS) {
    const value = await getKV(key);
    if (value !== null) {
      kv[key] = value;
    }
  }

  const data: BackupData = {
    clients,
    dogs,
    visits,
    eventLinks,
    visitPhotos,
    kv,
  };

  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    app: {
      name: APP_NAME,
      version: APP_VERSION,
    },
    data,
  };
}

/**
 * Download JSON file to user's downloads
 */
export function downloadJson(filename: string, data: any): void {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate backup filename with timestamp
 */
export function generateBackupFilename(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `groom-crm_backup_${year}-${month}-${day}_${hours}-${minutes}.json`;
}

/**
 * Parse and validate backup JSON file
 */
export async function importBackupJson(file: File): Promise<BackupManifest> {
  const text = await file.text();
  const json = JSON.parse(text) as BackupManifest;

  // Validate schema version
  if (typeof json.schemaVersion !== 'number') {
    throw new Error('Invalid backup file: missing schemaVersion');
  }

  if (json.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      `Schema version mismatch. Backup version: ${json.schemaVersion}, Current version: ${SCHEMA_VERSION}`
    );
  }

  // Validate required fields
  if (!json.data) {
    throw new Error('Invalid backup file: missing data');
  }

  if (!Array.isArray(json.data.clients) ||
      !Array.isArray(json.data.dogs) ||
      !Array.isArray(json.data.visits) ||
      !Array.isArray(json.data.eventLinks) ||
      !Array.isArray(json.data.visitPhotos) ||
      typeof json.data.kv !== 'object') {
    throw new Error('Invalid backup file: invalid data structure');
  }

  return json;
}

/**
 * Wipe database and restore from backup
 */
export async function applyBackupReplace(manifest: BackupManifest): Promise<void> {
  const { data } = manifest;

  // Clear existing safe keys first (before transaction)
  for (const key of SAFE_KV_KEYS) {
    await deleteKV(key);
  }

  // Use transaction to ensure atomicity for table data
  await db.transaction('rw', 
    [db.clients, db.dogs, db.visits, db.eventLinks, db.visitPhotos],
    async () => {
      // Clear all tables
      await db.clients.clear();
      await db.dogs.clear();
      await db.visits.clear();
      await db.eventLinks.clear();
      await db.visitPhotos.clear();

      // Restore data
      if (data.clients.length > 0) {
        await db.clients.bulkPut(data.clients);
      }
      if (data.dogs.length > 0) {
        await db.dogs.bulkPut(data.dogs);
      }
      if (data.visits.length > 0) {
        await db.visits.bulkPut(data.visits);
      }
      if (data.eventLinks.length > 0) {
        await db.eventLinks.bulkPut(data.eventLinks);
      }
      if (data.visitPhotos.length > 0) {
        await db.visitPhotos.bulkPut(data.visitPhotos);
      }
    }
  );

  // Restore safe keys from backup (after transaction)
  for (const [key, value] of Object.entries(data.kv)) {
    if (SAFE_KV_KEYS.includes(key as any)) {
      await setKV(key, value);
    }
  }
}
