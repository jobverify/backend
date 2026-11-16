const codeErrors = new Set(['SyntaxError', 'ReferenceError', 'TypeError', 'RangeError']);
const memoryErrors = new Set(['ENOMEM', 'ERR_WORKER_OUT_OF_MEMORY', 'ERR_MEMORY_ALLOCATION_FAILED']);

/** Malformed model output is an item error, even when JSON parsing failed. */
export class ModelResponseError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'ModelResponseError';
  }
}

/** Errors in execution must not be absorbed by per-item inference handlers. */
export function isFatalProcessingError(error) {
  const seen = new Set();
  let modelResponse = false;
  for (let current=error; current && !seen.has(current); current=current.cause) {
    seen.add(current);
    modelResponse ||= current instanceof ModelResponseError;
    const invalidResponse = modelResponse && ['SyntaxError','TypeError'].includes(current.name);
    if ((codeErrors.has(current.name) && !invalidResponse) || memoryErrors.has(current.code)
      || current.code==='WORKER_EXECUTION_ERROR'
      || /^(?:Mongo|Mongoose)/.test(current.name || '')) return true;
  }
  return false;
}
