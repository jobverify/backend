const errorNames = new Set(['Error', 'TypeError', 'SyntaxError', 'RangeError', 'APIError',
  'MongoServerError', 'MongoNetworkError', 'MongoServerSelectionError', 'MongoNotConnectedError',
  'MongoNetworkTimeoutError', 'ValidationError', 'CastError', 'AbortError', 'TimeoutError']);
const category = error => errorNames.has(error?.name) ? error.name : 'OtherError';

// Driver messages, stacks, query objects and arbitrary details can contain PII
// or credentials. Retain categories/codes, never serialize the original Error.
export function logOperationalError(operation, error, { requestId, statusCode } = {}) {
  console.error(JSON.stringify({ timestamp: new Date().toISOString(), event: 'operation_failed', operation,
    errorType: category(error),
    ...(Number.isInteger(error?.code) ? { errorCode: error.code } : {}),
    ...(error?.cause ? { causeType: category(error.cause) } : {}),
    ...(requestId ? { requestId } : {}), ...(statusCode ? { statusCode } : {}),
  }));
}
