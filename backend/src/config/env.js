import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function loadEnv(source = process.env) {
  dotenv.config({ path: path.join(backendRoot, '.env'), quiet: true });

  const nodeEnv = source.NODE_ENV ?? process.env.NODE_ENV ?? 'development';
  const port = Number(source.PORT ?? process.env.PORT ?? 3000);
  const bcryptRounds = Number(source.BCRYPT_ROUNDS ?? process.env.BCRYPT_ROUNDS ?? 12);
  const databaseSetting = source.DATABASE_PATH ?? process.env.DATABASE_PATH ?? './data/reservapro.sqlite3';

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT debe ser un entero entre 1 y 65535.');
  }
  if (!Number.isInteger(bcryptRounds) || bcryptRounds < 10 || bcryptRounds > 14) {
    throw new Error('BCRYPT_ROUNDS debe ser un entero entre 10 y 14.');
  }

  const databasePath = databaseSetting === ':memory:'
    ? databaseSetting
    : path.resolve(backendRoot, databaseSetting);

  return Object.freeze({
    nodeEnv,
    port,
    bcryptRounds,
    databasePath,
    jwtSecret: source.JWT_SECRET ?? process.env.JWT_SECRET ?? '',
    jwtExpiresIn: source.JWT_EXPIRES_IN ?? process.env.JWT_EXPIRES_IN ?? '2h',
    frontendOrigin: source.FRONTEND_ORIGIN ?? process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
    backendRoot,
  });
}
