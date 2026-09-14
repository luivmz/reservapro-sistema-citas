import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { AppError } from '../errors/AppError.js';
import {
  booleanValue,
  email,
  pagination,
  password,
  requiredString,
  role,
  uuid,
} from '../utils/validation.js';

export function createUserService({ userRepository, bcryptRounds }) {
  return {
    list(auth, query) {
      const paging = pagination(query);
      const result = userRepository.list(auth.tenantId, paging);
      return {
        data: result.items,
        meta: { page: paging.page, limit: paging.limit, total: result.total },
      };
    },

    get(auth, idValue) {
      const id = uuid(idValue);
      const user = userRepository.findById(auth.tenantId, id);
      if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Usuario no encontrado.');
      return user;
    },

    async create(auth, input) {
      const now = new Date().toISOString();
      const user = {
        id: randomUUID(),
        tenantId: auth.tenantId,
        name: requiredString(input.name, 'name', { min: 2, max: 120 }),
        email: email(input.email),
        passwordHash: await bcrypt.hash(password(input.password), bcryptRounds),
        role: role(input.role),
        active: booleanValue(input.active, 'active', true),
        createdAt: now,
        updatedAt: now,
      };
      return userRepository.create(user);
    },

    async update(auth, idValue, input) {
      const id = uuid(idValue);
      const current = userRepository.findRawById(auth.tenantId, id);
      if (!current) throw new AppError(404, 'USER_NOT_FOUND', 'Usuario no encontrado.');

      const nextRole = input.role === undefined ? current.role : role(input.role);
      const nextActive = input.active === undefined ? Boolean(current.active) : booleanValue(input.active, 'active');
      if (id === auth.userId && (nextRole !== current.role || !nextActive)) {
        throw new AppError(409, 'SELF_LOCKOUT', 'No puede cambiar su propio rol ni desactivar su cuenta.');
      }

      const passwordHash = input.password === undefined
        ? null
        : await bcrypt.hash(password(input.password), bcryptRounds);

      return userRepository.update(auth.tenantId, id, {
        name: input.name === undefined
          ? current.name
          : requiredString(input.name, 'name', { min: 2, max: 120 }),
        email: input.email === undefined ? current.email : email(input.email),
        role: nextRole,
        active: nextActive,
        passwordHash,
        updatedAt: new Date().toISOString(),
      });
    },

    deactivate(auth, idValue) {
      const id = uuid(idValue);
      if (id === auth.userId) {
        throw new AppError(409, 'SELF_LOCKOUT', 'No puede desactivar su propia cuenta.');
      }
      const current = userRepository.findRawById(auth.tenantId, id);
      if (!current) throw new AppError(404, 'USER_NOT_FOUND', 'Usuario no encontrado.');

      userRepository.update(auth.tenantId, id, {
        name: current.name,
        email: current.email,
        role: current.role,
        active: false,
        passwordHash: null,
        updatedAt: new Date().toISOString(),
      });
    },
  };
}
