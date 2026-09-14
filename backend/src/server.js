import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { openInitializedDatabase } from './database/database.js';

const env = loadEnv();
const db = openInitializedDatabase(env.databasePath);
const app = createApp({ db, env });

const server = app.listen(env.port, () => {
  console.log(`ReservaPro API disponible en http://localhost:${env.port}`);
});

function shutdown(signal) {
  console.log(`${signal} recibido. Cerrando ReservaPro API...`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
