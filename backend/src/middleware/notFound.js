import { AppError } from '../errors/AppError.js';

export function notFound(req, _res, next) {
  next(new AppError(404, 'ROUTE_NOT_FOUND', `No existe ${req.method} ${req.originalUrl}.`));
}
