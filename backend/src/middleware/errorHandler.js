import { AppError } from '../errors/AppError.js';

function normalizeError(error) {
  if (error instanceof AppError) return error;

  if (error instanceof SyntaxError && error.type === 'entity.parse.failed') {
    return new AppError(400, 'INVALID_JSON', 'El cuerpo JSON no es válido.');
  }

  if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return new AppError(409, 'RESOURCE_CONFLICT', 'El recurso entra en conflicto con un registro existente.');
  }

  if (error?.code?.startsWith?.('SQLITE_CONSTRAINT')) {
    return new AppError(422, 'INTEGRITY_ERROR', 'Los datos no cumplen las reglas de integridad.');
  }

  return new AppError(500, 'INTERNAL_ERROR', 'Ocurrió un error interno.');
}

export function errorHandler(error, _req, res, _next) {
  const safeError = normalizeError(error);

  if (safeError.status >= 500 && process.env.NODE_ENV !== 'test') {
    console.error('Error interno no controlado:', error.message);
  }

  res.status(safeError.status).json({
    error: {
      code: safeError.code,
      message: safeError.message,
      details: safeError.details,
    },
  });
}
