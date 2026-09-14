import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { AppError } from '../errors/AppError.js';
import { email, password, requiredString, slug, timezone } from '../utils/validation.js';

export function createAuthService({ db, tenantRepository, userRepository, tokenService, bcryptRounds }) {
  const createOrganization = db.transaction((tenant, user) => {
    tenantRepository.create(tenant);
    return userRepository.create(user);
  });

  return {
    async register(input) {
      const tenantSlug = slug(input.tenantSlug);
      const normalizedEmail = email(input.email);
      const plainPassword = password(input.password);
      const now = new Date().toISOString();
      const tenantId = randomUUID();
      const passwordHash = await bcrypt.hash(plainPassword, bcryptRounds);

      const user = createOrganization(
        {
          id: tenantId,
          name: requiredString(input.organizationName, 'organizationName', { min: 2, max: 120 }),
          slug: tenantSlug,
          timezone: timezone(input.timezone),
          createdAt: now,
          updatedAt: now,
        },
        {
          id: randomUUID(),
          tenantId,
          name: requiredString(input.adminName, 'adminName', { min: 2, max: 120 }),
          email: normalizedEmail,
          passwordHash,
          role: 'ADMIN',
          active: true,
          createdAt: now,
          updatedAt: now,
        },
      );

      return {
        token: tokenService.issue(user),
        user,
        tenant: {
          id: user.tenantId,
          name: user.tenantName,
          slug: user.tenantSlug,
          timezone: user.timezone,
        },
      };
    },

    async login(input) {
      const tenantSlug = slug(input.tenantSlug);
      const normalizedEmail = email(input.email);
      const plainPassword = requiredString(input.password, 'password', { min: 1, max: 128 });
      const rawUser = userRepository.findForLogin(tenantSlug, normalizedEmail);
      const valid = rawUser && await bcrypt.compare(plainPassword, rawUser.password_hash);

      if (!valid) {
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Las credenciales no son válidas.');
      }

      const user = userRepository.findById(rawUser.tenant_id, rawUser.id);
      return { token: tokenService.issue(user), user };
    },

    me(auth) {
      const user = userRepository.findById(auth.tenantId, auth.userId);
      if (!user || !user.active) {
        throw new AppError(401, 'INVALID_TOKEN', 'La sesión no es válida.');
      }
      return user;
    },
  };
}
