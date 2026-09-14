import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const databaseDirectory = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(databaseDirectory, 'schema.sql');

export function createDatabase(filename) {
  if (filename !== ':memory:') {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
  }

  const db = new Database(filename);
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  if (filename !== ':memory:') {
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
  }

  return db;
}

export function initializeDatabase(db) {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);
  return db;
}

export function openInitializedDatabase(filename) {
  return initializeDatabase(createDatabase(filename));
}
