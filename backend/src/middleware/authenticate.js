import { AppError } from '../errors/AppError.js';

export function createAuthenticate({ tokenService, userRepository }) {
  return function authenticate(req, _res, next) {
    const authorization = req.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      next(new AppError(401, 'AUTH_REQUIRED', 'Se requiere autenticación.'));
      return;
    }

    try {
      const token = authorization.slice('Bearer '.length).trim();
      if (!token) throw new Error('Token vacío');
      const claims = tokenService.verify(token);
      if (typeof claims.sub !== 'string' || typeof claims.tenantId !== 'string') {
        throw new Error('Claims incompletos');
      }

      const user = userRepository.findById(claims.tenantId, claims.sub);
      if (!user?.active) throw new Error('Usuario inactivo');

      req.auth = Object.freeze({
        userId: user.id,
        tenantId: user.tenantId,
        role: user.role,
        timezone: user.timezone,
      });
      next();
    } catch {
      next(new AppError(401, 'INVALID_TOKEN', 'La sesión no es válida o expiró.'));
    }
  };
}
