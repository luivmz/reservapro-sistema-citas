import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { createAuthenticate } from './middleware/authenticate.js';
import { createAppointmentRepository } from './repositories/appointmentRepository.js';
import { createClientRepository } from './repositories/clientRepository.js';
import { createDashboardRepository } from './repositories/dashboardRepository.js';
import { createEmployeeRepository } from './repositories/employeeRepository.js';
import { createEmployeeServiceRepository } from './repositories/employeeServiceRepository.js';
import { createScheduleRepository } from './repositories/scheduleRepository.js';
import { createServiceRepository } from './repositories/serviceRepository.js';
import { createTenantRepository } from './repositories/tenantRepository.js';
import { createUserRepository } from './repositories/userRepository.js';
import { createAuthRouter } from './routes/authRoutes.js';
import { createAppointmentRouter } from './routes/appointmentRoutes.js';
import { createAvailabilityRouter } from './routes/availabilityRoutes.js';
import { createClientRouter } from './routes/clientRoutes.js';
import { createDashboardRouter } from './routes/dashboardRoutes.js';
import { createEmployeeRouter } from './routes/employeeRoutes.js';
import { AppError } from './errors/AppError.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { createHealthRouter } from './routes/healthRoutes.js';
import { createServiceRouter } from './routes/serviceRoutes.js';
import { createUserRouter } from './routes/userRoutes.js';
import { createAuthService } from './services/authService.js';
import { createAppointmentService } from './services/appointmentService.js';
import { createAvailabilityService } from './services/availabilityService.js';
import { createCatalogService } from './services/catalogService.js';
import { createClientService } from './services/clientService.js';
import { createDashboardService } from './services/dashboardService.js';
import { createEmployeeManagementService } from './services/employeeManagementService.js';
import { createEmployeeOfferingService } from './services/employeeOfferingService.js';
import { createScheduleService } from './services/scheduleService.js';
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
  const clientRepository = createClientRepository(db);
  const employeeRepository = createEmployeeRepository(db);
  const serviceRepository = createServiceRepository(db);
  const employeeServiceRepository = createEmployeeServiceRepository(db);
  const scheduleRepository = createScheduleRepository(db);
  const appointmentRepository = createAppointmentRepository(db);
  const dashboardRepository = createDashboardRepository(db);
  const authService = createAuthService({
    db,
    tenantRepository,
    userRepository,
    tokenService,
    bcryptRounds: env.bcryptRounds,
  });
  const userService = createUserService({ userRepository, bcryptRounds: env.bcryptRounds });
  const clientService = createClientService({ clientRepository, userRepository });
  const employeeManagementService = createEmployeeManagementService({ employeeRepository, userRepository });
  const employeeOfferingService = createEmployeeOfferingService({
    employeeRepository,
    serviceRepository,
    employeeServiceRepository,
  });
  const catalogService = createCatalogService({
    serviceRepository,
    employeeRepository,
    employeeServiceRepository,
  });
  const scheduleService = createScheduleService({ scheduleRepository, employeeRepository });
  const schedulingDependencies = {
    clientRepository,
    employeeRepository,
    serviceRepository,
    employeeServiceRepository,
    scheduleRepository,
    appointmentRepository,
  };
  const availabilityService = createAvailabilityService(schedulingDependencies);
  const appointmentService = createAppointmentService(schedulingDependencies);
  const dashboardService = createDashboardService({ dashboardRepository, employeeRepository });
  const authenticate = createAuthenticate({ tokenService, userRepository });

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors(createCorsOptions(env.frontendOrigin)));
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/health', createHealthRouter(db));
  app.use('/api/auth', createAuthRouter({ authService, authenticate }));
  app.use('/api/users', createUserRouter({ userService, authenticate }));
  app.use('/api/clients', createClientRouter({ clientService, authenticate }));
  app.use('/api/employees', createEmployeeRouter({
    employeeManagementService,
    employeeOfferingService,
    scheduleService,
    authenticate,
  }));
  app.use('/api/services', createServiceRouter({ catalogService, authenticate }));
  app.use('/api/availability', createAvailabilityRouter({ availabilityService, authenticate }));
  app.use('/api/appointments', createAppointmentRouter({ appointmentService, authenticate }));
  app.use('/api/dashboard', createDashboardRouter({ dashboardService, authenticate }));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
