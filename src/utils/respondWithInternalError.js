/**
 * @file Shared helper for sanitizing unexpected internal-error responses.
 * @module utils/respondWithInternalError
 */

import { logOperationalError } from './operationalLog.js';

export const respondWithInternalError = (
  res,
  error,
  {
    code = null,
    message = "Internal Server Error",
    logLabel = "Unexpected internal error:",
  } = {},
) => {
  logOperationalError(logLabel, error, { requestId: res.locals?.requestId, statusCode: 500 });

  const payload = {
    success: false,
    message,
  };

  if (code != null) {
    payload.code = code;
  }

  return res.status(500).json(payload);
};
