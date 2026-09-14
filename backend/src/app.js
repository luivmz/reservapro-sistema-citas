import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { createAuthenticate } from './middleware/authenticate.js';
import { createTenantRepository } from './repositories/tenantRepository.js';
import { createUserRepository } from './repositories/userRepository.js';
import { createAuthRouter } from './routes/authRoutes.js';
import { AppError } from './errors/AppError.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { createHealthRouter } from './routes/healthRoutes.js';
import { createUserRouter } from './routes/userRoutes.js';
import { createAuthService } from './services/authService.js';
import { createTokenService } from './services/tokenService.js';
import { createUserService } from './services/userService.js';

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
  const tokenService = createTokenService(env);
  const tenantRepository = createTenantRepository(db);
  const userRepository = createUserRepository(db);
  const authService = createAuthService({
    db,
    tenantRepository,
    userRepository,
    tokenService,
    bcryptRounds: env.bcryptRounds,
  });
  const userService = createUserService({ userRepository, bcryptRounds: env.bcryptRounds });
  const authenticate = createAuthenticate({ tokenService, userRepository });

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors(createCorsOptions(env.frontendOrigin)));
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/health', createHealthRouter(db));
  app.use('/api/auth', createAuthRouter({ authService, authenticate }));
  app.use('/api/users', createUserRouter({ userService, authenticate }));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
