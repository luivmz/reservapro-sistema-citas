import { loadEnv } from '../config/env.js';
import { openInitializedDatabase } from './database.js';

const env = loadEnv();
const db = openInitializedDatabase(env.databasePath);

const tables = db.prepare(`
  SELECT name
  FROM sqlite_master
  WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
  ORDER BY name
`).all();

db.close();

console.log(`Base SQLite inicializada en ${env.databasePath}`);
console.log(`Tablas disponibles: ${tables.map(({ name }) => name).join(', ')}`);
