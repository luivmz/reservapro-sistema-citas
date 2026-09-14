import { randomUUID } from 'node:crypto';
import { AppError } from '../errors/AppError.js';
import {
  booleanValue,
  email,
  optionalString,
  requiredString,
  uuid,
} from '../utils/validation.js';
import { listFilters, paginated } from './resourceHelpers.js';

export function createClientService({ clientRepository, userRepository }) {
  function assertClientUser(tenantId, userId) {
    if (!userId) return null;
    const user = userRepository.findRawById(tenantId, userId);
    if (!user || user.role !== 'CLIENT') {
      throw new AppError(404, 'USER_NOT_FOUND', 'Usuario CLIENT no encontrado.');
    }
    return userId;
  }

  function ownClient(auth) {
    const client = clientRepository.findByUserId(auth.tenantId, auth.userId);
    if (!client) throw new AppError(403, 'CLIENT_PROFILE_REQUIRED', 'La cuenta no tiene un perfil de cliente vinculado.');
    return client;
  }

  return {
    list(auth, query) {
      const filters = listFilters(query);
      return paginated(clientRepository.list(auth.tenantId, filters), filters);
    },
    get(auth, idValue) {
      const id = uuid(idValue);
      if (auth.role === 'CLIENT' && ownClient(auth).id !== id) {
        throw new AppError(404, 'CLIENT_NOT_FOUND', 'Cliente no encontrado.');
      }
      const client = clientRepository.findById(auth.tenantId, id);
      if (!client) throw new AppError(404, 'CLIENT_NOT_FOUND', 'Cliente no encontrado.');
      return client;
    },
    create(auth, input) {
      const now = new Date().toISOString();
      const userId = input.userId == null ? null : assertClientUser(auth.tenantId, uuid(input.userId, 'userId'));
      return clientRepository.create({
        id: randomUUID(),
        tenantId: auth.tenantId,
        userId,
        name: requiredString(input.name, 'name', { min: 2, max: 120 }),
        email: email(input.email, 'email', { optional: true }),
        phone: optionalString(input.phone, 'phone', { max: 30, emptyAsNull: true }),
        notes: optionalString(input.notes, 'notes', { max: 2000 }) ?? '',
        active: booleanValue(input.active, 'active', true),
        createdAt: now,
        updatedAt: now,
      });
    },
    update(auth, idValue, input) {
      const id = uuid(idValue);
      const current = clientRepository.findById(auth.tenantId, id);
      if (!current) throw new AppError(404, 'CLIENT_NOT_FOUND', 'Cliente no encontrado.');
      const userId = input.userId === undefined
        ? current.userId
        : input.userId === null
          ? null
          : assertClientUser(auth.tenantId, uuid(input.userId, 'userId'));
      return clientRepository.update(auth.tenantId, id, {
        userId,
        name: input.name === undefined ? current.name : requiredString(input.name, 'name', { min: 2, max: 120 }),
        email: input.email === undefined ? current.email : email(input.email, 'email', { optional: true }),
        phone: input.phone === undefined ? current.phone : optionalString(input.phone, 'phone', { max: 30, emptyAsNull: true }),
        notes: input.notes === undefined ? current.notes : optionalString(input.notes, 'notes', { max: 2000 }),
        active: input.active === undefined ? current.active : booleanValue(input.active, 'active'),
        updatedAt: new Date().toISOString(),
      });
    },
    deactivate(auth, idValue) {
      const id = uuid(idValue);
      const current = clientRepository.findById(auth.tenantId, id);
      if (!current) throw new AppError(404, 'CLIENT_NOT_FOUND', 'Cliente no encontrado.');
      clientRepository.update(auth.tenantId, id, { ...current, active: false, updatedAt: new Date().toISOString() });
    },
  };
}
