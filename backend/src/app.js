import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { AppError } from './errors/AppError.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { createHealthRouter } from './routes/healthRoutes.js';

function createCorsOptions(frontendOrigin) {
  const allowedOrigins = frontendOrigin.split(',').map((origin) => origin.trim()).filter(Boolean);

  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new AppError(403, 'ORIGIN_NOT_ALLOWED', 'El origen de la solicitud no está permitido.'));
    },
    credentials: false,
  };
}

export function createApp({ db, env }) {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors(createCorsOptions(env.frontendOrigin)));
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/health', createHealthRouter(db));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
