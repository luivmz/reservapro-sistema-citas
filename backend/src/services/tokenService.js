import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';

const ISSUER = 'reservapro-api';
const AUDIENCE = 'reservapro-web';
const ALGORITHM = 'HS256';

export function createTokenService(env) {
  if (typeof env.jwtSecret !== 'string' || env.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET debe contener al menos 32 caracteres.');
  }

  return {
    issue(user) {
      return jwt.sign(
        { tenantId: user.tenantId, role: user.role },
        env.jwtSecret,
        {
          algorithm: ALGORITHM,
          audience: AUDIENCE,
          expiresIn: env.jwtExpiresIn,
          issuer: ISSUER,
          jwtid: randomUUID(),
          subject: user.id,
        },
      );
    },
    verify(token) {
      return jwt.verify(token, env.jwtSecret, {
        algorithms: [ALGORITHM],
        audience: AUDIENCE,
        issuer: ISSUER,
      });
    },
  };
}
