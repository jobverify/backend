import { isProductionEnvironment } from "../utils/runtimeConfig.js";
import { logOperationalError } from '../utils/operationalLog.js';

export class APIError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  const requestedStatus = err.statusCode ?? err.status;
  const statusCode = Number.isInteger(requestedStatus) && requestedStatus >= 400 && requestedStatus <= 599
    ? requestedStatus
    : 500;
  const isInvalidJson = err.type === "entity.parse.failed";
  const message = isInvalidJson ? "Invalid JSON request body." : err.message || "Internal Server Error";
  const details = isInvalidJson ? null : err.details || null;
  const isProduction = isProductionEnvironment();
  const isSafeClientError =
    err instanceof APIError || (statusCode >= 400 && statusCode < 500);
  const responseMessage =
    isProduction && !isSafeClientError ? "Internal Server Error" : message;

  logOperationalError('http_request', err, { requestId: req.requestId, statusCode });

  const payload = {
    success: false,
    message: responseMessage,
  };

  if (!isProduction && details !== null) {
    payload.details = details;
  } else if (isSafeClientError && details !== null) {
    payload.details = details;
  }

  return res.status(statusCode).json(payload);
};
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
