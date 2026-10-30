import type { NextFunction, Request, RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "./config/env.js";
import { db } from "./db.js";
import { AppError } from "./errors.js";
import { isUserRole, type UserRole } from "./user-role.js";

export type AsyncRoute = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

export const asyncHandler =
  (handler: AsyncRoute): RequestHandler =>
  (req, res, next) => {
    void handler(req, res, next).catch(next);
  };

export const authenticate: RequestHandler = (req, _res, next) => {
  const [scheme, token] = (req.header("authorization") ?? "").split(" ");
  if (scheme !== "Bearer" || !token) {
    return next(new AppError(401, "UNAUTHENTICATED", "Please sign in to continue."));
  }
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });
    if (
      typeof payload === "string" ||
      typeof payload.sub !== "string" ||
      !isUserRole(payload.role) ||
      typeof payload.jti !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.jti)
    ) {
      throw new AppError(401, "INVALID_TOKEN", "Your session is invalid. Please sign in again.");
    }
    void db("users")
      .where({ id: payload.sub })
      .first("id", "role", "is_active", "auth_version")
      .then((user) => {
        if (!user || !user.is_active || payload.ver !== user.auth_version) {
          next(new AppError(401, "INVALID_SESSION", "Your session has expired. Please sign in again."));
          return;
        }
        req.auth = { userId: payload.sub!, role: user.role, sessionId: payload.jti! };
        next();
      })
      .catch(next);
    return;
  } catch (error) {
    return next(error instanceof AppError
      ? error
      : new AppError(401, "INVALID_TOKEN", "Your session is invalid. Please sign in again."));
  }
};

export function requireRole(...allowed: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(new AppError(401, "UNAUTHENTICATED", "Please sign in."));
    if (!allowed.includes(req.auth.role)) {
      return next(new AppError(403, "FORBIDDEN", "You do not have access to this action."));
    }
    return next();
  };
}

export const notFound: RequestHandler = (req, _res, next) =>
  next(new AppError(404, "NOT_FOUND", `No route for ${req.method} ${req.path}`));

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof AppError) {
    res.status(error.status).json({
      error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) },
    });
    return;
  }
  if (typeof error === "object" && error !== null && "name" in error && error.name === "ZodError") {
    const details = "issues" in error && Array.isArray(error.issues)
      ? error.issues.map((issue) => ({
          field: Array.isArray(issue.path) ? issue.path.join(".") : "",
          message: typeof issue.message === "string" ? issue.message : "Invalid value",
        }))
      : [];
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Please check the submitted information.", details } });
    return;
  }
  if (typeof error === "object" && error !== null && "code" in error && error.code === "LIMIT_FILE_SIZE") {
    res.status(413).json({ error: { code: "FILE_TOO_LARGE", message: "The upload is too large. Photos must be under 8 MB and videos under 50 MB." } });
    return;
  }
  if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
    res.status(409).json({ error: { code: "CONFLICT", message: "This information is already in use." } });
    return;
  }
  console.error(JSON.stringify({
    level: "error",
    requestId: req.header("x-request-id"),
    method: req.method,
    path: req.path,
    message: error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
        ? error.message
        : "Unknown error",
    stack: env.NODE_ENV === "production" ? undefined : error instanceof Error ? error.stack : undefined,
  }));
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } });
}
