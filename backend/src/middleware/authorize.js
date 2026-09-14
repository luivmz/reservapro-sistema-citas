import { AppError } from '../errors/AppError.js';

export function authorize(...allowedRoles) {
  return function authorizeRole(req, _res, next) {
    if (!req.auth || !allowedRoles.includes(req.auth.role)) {
      next(new AppError(403, 'FORBIDDEN', 'No tiene permisos para realizar esta operación.'));
      return;
    }
    next();
  };
}
