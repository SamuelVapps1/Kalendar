import { db } from './db';

/**
 * Get a value from the KV store
 */
export async function getKV<T = any>(key: string): Promise<T | null> {
  const record = await db.kv.get(key);
  return record ? record.value : null;
}

/**
 * Set a value in the KV store
 */
export async function setKV<T = any>(key: string, value: T): Promise<void> {
  await db.kv.put({ key, value });
}

/**
 * Delete a key from the KV store
 */
export async function deleteKV(key: string): Promise<void> {
  await db.kv.delete(key);
}
