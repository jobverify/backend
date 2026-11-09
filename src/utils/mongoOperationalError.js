const OPERATIONAL_CODES = new Set([
  6, 7, 18, 24, 50, 64, 89, 91, 112, 189, 251, 262, 9001,
  10107, 11600, 11601, 11602, 13435, 13436,
  'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN',
]);
const OPERATIONAL_NAMES = new Set([
  'MongoNetworkError', 'MongoNetworkTimeoutError', 'MongoServerSelectionError',
  'MongooseServerSelectionError', 'MongoTopologyClosedError', 'MongoNotConnectedError',
  'MongoPoolClearedError', 'MongoPoolClosedError', 'MongoWaitQueueTimeoutError',
  'MongoOperationTimeoutError', 'MongoWriteConcernError',
]);

// Unknown server/query/validation errors deliberately remain fatal. Never infer
// operational recovery just because a programming error mentions a database.
export const isMongoOperationalError = (error, { networkCodes = true } = {}) => {
  const seen = new Set();
  let operational = false;
  for (let current = error; current && !seen.has(current); current = current.cause) {
    seen.add(current);
    if (current instanceof TypeError || current instanceof ReferenceError || current instanceof SyntaxError || current instanceof RangeError) return false;
    if ((OPERATIONAL_CODES.has(current.code) && (networkCodes || typeof current.code === 'number')) || OPERATIONAL_NAMES.has(current.name)
      || current.hasErrorLabel?.('TransientTransactionError')
      || current.errorLabels?.includes?.('TransientTransactionError')
      || current.hasErrorLabel?.('UnknownTransactionCommitResult')
      || current.errorLabels?.includes?.('UnknownTransactionCommitResult')
      || (/over your space quota/i.test(current.message) && /writes are blocked on your cluster/i.test(current.message))) {
      operational = true;
    }
  }
  return operational;
};

const hasUnknownCommitResult = error => {
  const seen = new Set();
  for (let current = error; current && !seen.has(current); current = current.cause) {
    seen.add(current);
    if (current.hasErrorLabel?.('UnknownTransactionCommitResult') || current.errorLabels?.includes?.('UnknownTransactionCommitResult')) return true;
  }
  return false;
};

export const retryMongoOperation = async (operation, {
  attempts = 3,
  signal,
  wait = delay => new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, delay);
    signal?.addEventListener('abort', abort, { once: true });
  }),
} = {}) => {
  for (let attempt = 1; ; attempt++) {
    signal?.throwIfAborted();
    try { return await operation(); }
    catch (error) {
      // The driver owns commit retries. Replaying a callback cannot establish
      // whether an earlier commit succeeded after its acknowledgement was lost.
      if (signal?.aborted || hasUnknownCommitResult(error) || !isMongoOperationalError(error) || attempt >= attempts) throw error;
      await wait(250 * 2 ** (attempt - 1));
    }
  }
};
