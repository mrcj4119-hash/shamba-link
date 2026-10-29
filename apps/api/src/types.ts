import type { UserRole } from "./user-role.js";

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string; role: UserRole; sessionId: string };
    }
  }
}

export {};
