import Dexie, { Table } from 'dexie';
import { Client, Dog, Visit, EventLink, KV } from './schema';

export class GroomingDB extends Dexie {
  clients!: Table<Client, string>;
  dogs!: Table<Dog, string>;
  visits!: Table<Visit, string>;
  eventLinks!: Table<EventLink, string>;
  kv!: Table<KV, string>;

  constructor() {
    super('GroomingCRM');
    
    this.version(1).stores({
      clients: 'id, ownerName, createdAt',
      dogs: 'id, clientId, dogName, createdAt',
      visits: 'id, dogId, dateISO, createdAt',
      eventLinks: 'id, [calendarId+calendarEventId], dogId, updatedAt',
      kv: 'key',
    });
  }
}

export const db = new GroomingDB();
