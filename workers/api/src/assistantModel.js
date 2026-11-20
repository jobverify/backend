import { ASSISTANT_MODEL, ASSISTANT_LIMITS } from '../../../src/assistant/contract.js';

// Bindings are objects, not process.env values. No SDK, API key or paid fallback.
export function createWorkersAssistantModel(ai) {
  if (typeof ai?.run !== 'function') return undefined;
  return async ({ messages, tools, maxTokens, signal } = {}) => {
    signal?.throwIfAborted();
    const output = await ai.run(ASSISTANT_MODEL, {
      messages, tools, max_tokens: Math.min(maxTokens ?? ASSISTANT_LIMITS.outputTokens, ASSISTANT_LIMITS.outputTokens),
      temperature: 0, stream: false,
    });
    // AI.run has no guaranteed remote cancellation; the service deadline and
    // output budget bound this turn, and late results are never displayed.
    signal?.throwIfAborted();
    return output;
  };
}
