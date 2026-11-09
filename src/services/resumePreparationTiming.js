export function preparationDurations(preparation = {}) {
  const samples = (preparation.durationSamples || []).filter(value => Number.isFinite(value) && value > 0);
  if (preparation.status === 'completed' && preparation.requestedAt && preparation.generatedAt) {
    const duration = new Date(preparation.generatedAt).getTime() - new Date(preparation.requestedAt).getTime();
    if (Number.isFinite(duration) && duration > 0) samples.push(duration);
  }
  return samples.slice(-20);
}

export function preparationTiming(preparation = {}) {
  const samples = preparationDurations(preparation);
  return {
    requestedAt: preparation.requestedAt || null,
    averageDurationMs: samples.length ? Math.round(samples.reduce((sum, value) => sum + value, 0) / samples.length) : null,
    timingSampleCount: samples.length,
  };
}
