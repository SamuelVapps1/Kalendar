import Dexie, { Table } from 'dexie';
import { Client, Dog, Visit, EventLink, KV, VisitPhoto } from './schema';

export class GroomingDB extends Dexie {
  clients!: Table<Client, string>;
  dogs!: Table<Dog, string>;
  visits!: Table<Visit, string>;
  eventLinks!: Table<EventLink, string>;
  kv!: Table<KV, string>;
  visitPhotos!: Table<VisitPhoto, string>;

  constructor() {
    super('GroomingCRM');
    
    this.version(1).stores({
      clients: 'id, ownerName, createdAt',
      dogs: 'id, clientId, dogName, createdAt',
      visits: 'id, dogId, dateISO, createdAt',
      eventLinks: 'id, [calendarId+calendarEventId], dogId, updatedAt',
      kv: 'key',
    });

    this.version(2)
      .stores({
        visits: 'id, dogId, [calendarId+calendarEventId], dateISO, createdAt',
        visitPhotos: 'id, visitId, createdAt',
      })
      .upgrade(async () => {
        // No-op upgrade for now
        // Future schema changes can be handled here
      });
  }
}

export const db = new GroomingDB();
