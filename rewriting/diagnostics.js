import { captureRewriteError } from './failureDiagnostics.js';

const clip = (value, limit) => typeof value === 'string' ? value.slice(0, limit) : undefined;

/** Bounded employer-text samples belong only in the diagnostic artifact, never console summaries. */
export const createRewriteDiagnostics = ({ maxSamples = 10, maxBytes = 65536 } = {}) => {
  if (!Number.isInteger(maxSamples) || maxSamples < 0 || maxSamples > 10 || !Number.isInteger(maxBytes) || maxBytes < 4096 || maxBytes > 65536) throw new Error('Invalid rejection diagnostic limits');
  const state = { totalRejected: 0, totalRejectedFragments: 0, reasons: Object.create(null),
    fragmentReasons: Object.create(null), samples: [], maxSamples, maxBytes };
  return { record({ id, input, response, reason, diagnostic, kind: requestedKind } = {}) {
    const kind = requestedKind === 'fragment' ? 'fragment' : 'job';
    state[kind === 'fragment' ? 'totalRejectedFragments' : 'totalRejected']++;
    const reasons = kind === 'fragment' ? state.fragmentReasons : state.reasons;
    let key = typeof reason === 'string' && /^[a-z_]{1,64}$/.test(reason) ? reason : 'unknown';
    if (!Object.hasOwn(reasons, key) && Object.keys(state.reasons).length + Object.keys(state.fragmentReasons).length >= 32) key = 'other';
    reasons[key] = (reasons[key] || 0) + 1;
    const phase = String(id || '').startsWith('worker-probe-') ? 'probe' : 'production';
    if (!maxSamples) return;
    const sameReason = sample => sample.reason === key && sample.kind === kind;
    if (state.samples.filter(sameReason).length >= 2) {
      const probe = state.samples.findIndex(sample => sameReason(sample) && sample.phase === 'probe');
      if (phase !== 'production' || probe < 0) return;
      state.samples.splice(probe, 1);
    }
    if (state.samples.length >= maxSamples) {
      if (state.samples.some(sameReason)) return;
      let replace = state.samples.findLastIndex(sample => state.samples.filter(other => other.reason === sample.reason && other.kind === sample.kind).length > 1);
      if (replace < 0 && kind === 'job') replace = state.samples.findLastIndex(sample => sample.kind === 'fragment');
      if (replace < 0) return;
      state.samples.splice(replace, 1);
    }
    const raw = response?.rawValue ?? response?.value;
    const sample = { id: clip(id, 64), inputHash: clip(input?.inputHash, 64), reason: key, phase, kind,
      sourceContext: clip(diagnostic?.evidence || input?.sourceDescription, 1800),
      ...(phase === 'probe' && { probeSource: clip(input?.sourceDescription, 1800) }),
      completionPreview: diagnostic?.phase === 'assembly'
        ? (typeof diagnostic.text === 'string' ? clip(JSON.stringify({ text: clip(diagnostic.text, 1200) }), 2400) : undefined)
        : typeof response?.rawText === 'string' && response.rawText
        ? clip(response.rawText, 2400) : raw === undefined || raw === null ? undefined : clip(JSON.stringify(raw), 2400),
      validation: diagnostic ? { code: clip(diagnostic.code, 64),
        phase: ['fragment', 'assembly', 'publication'].includes(diagnostic.phase) ? diagnostic.phase : undefined,
        sectionContext: clip(diagnostic.sectionContext, 128),
        sourceId: Number.isInteger(diagnostic.sourceId) ? diagnostic.sourceId : undefined,
        section: clip(diagnostic.section, 64), itemIndex: Number.isInteger(diagnostic.itemIndex) ? diagnostic.itemIndex : undefined,
        sourceOffset: Number.isInteger(diagnostic.sourceOffset) ? diagnostic.sourceOffset : undefined,
        text: clip(diagnostic.text, 1200), evidence: clip(diagnostic.evidence, 1800), scope: clip(diagnostic.scope, 32) } : undefined,
      generationRequests: response?.generationRequests, finishReason: response?.finishReason, retrySkipped: response?.retrySkipped };
    if (response?.errorDiagnostic) sample.error = captureRewriteError(response.errorDiagnostic, { sourceTexts: [input?.sourceDescription] });
    state.samples.push(sample);
    // Reserve space for all bounded reason counters as the run continues.
    while (state.samples.length && Buffer.byteLength(JSON.stringify(state)) > maxBytes - 4096) state.samples.pop();
  }, snapshot: () => structuredClone(state) };
};
