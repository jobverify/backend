export const CORRECTION_MODES = Object.freeze(['adaptive', 'always']);

/** Bound repeatedly unsuccessful corrections without permanently disabling recovery. */
export const createCorrectionPolicy = ({ mode = 'adaptive' } = {}) => {
  if (!CORRECTION_MODES.includes(mode)) throw new TypeError('Invalid prose correction mode');
  const states = new Map();
  const skipped = () => ({ retry: false, finish() {} });
  return { acquire: ({ reason, phase = 'fragment', scope = 'neutral', allowSourceFallback }) => {
    if (mode === 'always' || !allowSourceFallback) return { retry: true, finish() {} };
    const key = JSON.stringify([reason, phase, scope]);
    let state = states.get(key);
    if (!state) { state = { failures: 0, remaining: 0, probing: false }; states.set(key, state); }
    if (state.probing) return skipped();
    if (state.remaining > 0) { state.remaining--; return skipped(); }
    const probe = state.failures >= 3;
    if (probe) state.probing = true;
    let finished = false;
    return { retry: true, finish: accepted => {
      if (finished) return;
      finished = true;
      if (probe) state.probing = false;
      if (accepted === null) return; // Transport failure/cancellation is not a factual rejection.
      if (accepted) { state.failures = 0; state.remaining = 0; }
      else if (++state.failures >= 3) state.remaining = 8;
    } };
  } };
};
