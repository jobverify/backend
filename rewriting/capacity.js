/** Whole-description latency of fresh inference, separate from copying/reuse. */
export function summarizeRewriteCapacity(results, { startedAt, finishedAt, attempted = results.length } = {}) {
  const seconds = Math.max(0, (Date.parse(finishedAt) - Date.parse(startedAt)) / 1000) || 0;
  const fresh = results.filter(result => result.generationRequests > 0 && !result.modelPlanCached);
  const durations = fresh.map(result => result.durationMs).filter(ms => Number.isFinite(ms) && ms > 0).sort((a, b) => a - b);
  const published = results.filter(result => result.ok && result.published !== false);
  const sum = key => published.reduce((total, result) => total + (result.quality?.[key] || 0), 0);
  const capacity = { elapsedSeconds: seconds,
    modelRequests: results.reduce((total, result) => total + (result.generationRequests || 0), 0),
    transportRetries: results.reduce((total, result) => total + (result.transportRetries || 0), 0),
    ...Object.fromEntries(['correctionRequests', 'correctionsAccepted', 'correctionsRejected', 'correctionsSkipped']
      .map(key => [key, results.reduce((total, result) => total + (result[key] || 0), 0)])),
    attemptsPerHour: seconds ? attempted / seconds * 3600 : 0,
    publishedPerHour: seconds ? published.length / seconds * 3600 : 0,
    p50DurationMs: durations[Math.floor(durations.length * .5)] ?? null,
    p95DurationMs: durations[Math.min(durations.length - 1, Math.floor(durations.length * .95))] ?? null,
    freshInferenceDescriptions: fresh.length,
    renderedWithoutInference: published.filter(result => result.renderedWithoutInference).length,
    cachedDescriptions: published.filter(result => result.modelPlanCached).length,
    modelEditedDescriptions: published.filter(result => (result.quality?.modelEditedBlocks ?? result.quality?.modelEditedItems ?? 0) > 0).length,
    sourcePreservedDescriptions: published.filter(result => (result.quality?.modelEditedBlocks ?? result.quality?.modelEditedItems) === 0).length,
    modelWordingEditedDescriptions: published.filter(result => result.quality?.modelWordingEditedBlocks > 0).length,
    modelLayoutOnlyDescriptions: published.filter(result => result.quality?.modelWordingEditedBlocks === 0
      && result.quality?.modelLayoutEditedBlocks > 0).length,
    reusedChunks: results.reduce((total, result) => total + (result.reusedChunks || 0), 0),
    modelEditedBlocks: sum('modelEditedBlocks'), sourcePreservedBlocks: sum('sourcePreservedBlocks'),
    modelWordingEditedBlocks: sum('modelWordingEditedBlocks'), modelLayoutEditedBlocks: sum('modelLayoutEditedBlocks'),
    wordingMetricsRecordedDescriptions: published.filter(result => Number.isInteger(result.quality?.modelWordingEditedBlocks)
      && Number.isInteger(result.quality?.modelLayoutEditedBlocks)).length,
    layoutParagraphBreaks: sum('layoutParagraphBreaks'),
    protectedSourceBlocks: sum('protectedSourceBlocks'), sourceFallbackBlocks: sum('sourceFallbackBlocks'),
  };
  capacity.modelEditedDescriptionsPerHour = seconds ? capacity.modelEditedDescriptions / seconds * 3600 : 0;
  const wordingComplete = capacity.wordingMetricsRecordedDescriptions === published.length;
  capacity.modelWordingEditedDescriptionsPerHour = !wordingComplete ? null : seconds ? capacity.modelWordingEditedDescriptions / seconds * 3600 : 0;
  capacity.modelLayoutOnlyDescriptionsPerHour = !wordingComplete ? null : seconds ? capacity.modelLayoutOnlyDescriptions / seconds * 3600 : 0;
  if (published.some(result => Number.isInteger(result.quality?.modelEditedItems))) {
    capacity.modelEditedItems = sum('modelEditedItems'); capacity.sourceCopiedItems = sum('sourceCopiedItems');
  }
  return capacity;
}
