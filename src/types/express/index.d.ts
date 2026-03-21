import 'express-serve-static-core';
import { AuthUser } from '../../auth/jwt.strategy';

declare module 'express-serve-static-core' {
  interface Request {
    tenantId?: string | null;
    user?: AuthUser;
  }
}

