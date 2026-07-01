import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../lib/errors";
import { logger } from "../lib/logger";

// Precisa dos 4 parâmetros (mesmo sem usar `next`) pro Express reconhecer
// isso como error handler em vez de middleware normal.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Dados inválidos", details: err.flatten() });
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) logger.error({ err }, err.message);
    return res.status(err.statusCode).json({ error: err.message, ...(err.details ? { details: err.details } : {}) });
  }

  logger.error({ err, path: req.path, method: req.method }, "Erro não tratado");

  const isProd = process.env.NODE_ENV === "production";
  return res.status(500).json({ error: isProd ? "Erro interno do servidor" : (err as Error)?.message || "Erro interno" });
}
