import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'

const data = (value, key) => {
  if (!value || typeof value !== 'object') return undefined
  try { return Object.getOwnPropertyDescriptor(value, key)?.value } catch { return undefined }
}
const count = value => Number.isSafeInteger(value) && value >= 0 && value <= 1000000 ? value : null
const boolean = value => typeof value === 'boolean' ? value : null
const scalar = (value, maxLength = 4096) => typeof value === 'string' && value.length <= maxLength
  || typeof value === 'number' && Number.isFinite(value) ? value : null
const arrayCount = (value, arrayKey, countKey) => {
  const array = data(value, arrayKey), reported = data(value, countKey)
  if (!Array.isArray(array)) return count(reported)
  return reported !== undefined && count(reported) !== array.length ? null : count(array.length)
}

// The bounded native collector retains failures for roles it could not return.
// Full evidence is on the first job; compact copies on subsequent jobs describe
// the same batch. Keep this separate from returned-job counters and never copy
// role bodies, descriptions or error messages into status records.
function nativeCollections(jobs) {
  const collections = [], seen = new Set(), observations = [], fullReferences = new Map()
  for (const job of jobs) {
    const evidence = data(job, 'nativeCollectionEvidence')
    if (!evidence || typeof evidence !== 'object'
      || !['candidateDetails', 'failures', 'listingPaginationComplete', 'extractedDetailJobs'].some(key => {
        try { return Object.hasOwn(evidence, key) } catch { return false }
      })) continue
    const sourceValue = data(job, 'source'), evidenceSourceValue = data(evidence, 'source')
    const source = typeof sourceValue === 'string' ? scalar(sourceValue, 200) : null
    const evidenceSource = typeof evidenceSourceValue === 'string' ? scalar(evidenceSourceValue, 200) : null
    const sourceMatches = typeof source === 'string' && source.length > 0 && source === evidenceSource
    const failures = sourceMatches ? data(evidence, 'failures') : null
    let unextractedDetailFailures = null, otherFailures = null, failureStages = null
    if (Array.isArray(failures) && count(failures.length) !== null) {
      const stages = new Map(); let knownStages = true
      for (const failure of failures) {
        const value = data(failure, 'stage'), stage = typeof value === 'string' && /^[a-z][a-z0-9-]{0,79}$/.test(value) ? value : 'unknown'
        if (stage === 'unknown') knownStages = false
        stages.set(stage, (stages.get(stage) || 0) + 1)
      }
      failureStages = Object.fromEntries(stages)
      if (knownStages) {
        unextractedDetailFailures = stages.get('native-detail') || 0
        otherFailures = failures.length - unextractedDetailFailures
      }
    }
    const candidateDetails = sourceMatches ? count(data(evidence, 'candidateDetails')) : null
    const parsedDetails = sourceMatches ? arrayCount(evidence, 'jobs', 'extractedDetailJobs') : null
    const excludedDetails = sourceMatches ? arrayCount(evidence, 'exclusions', 'excludedDetailJobs') : null
    const countsReconciled = [candidateDetails, parsedDetails, excludedDetails, unextractedDetailFailures].every(n => n !== null)
      ? candidateDetails === parsedDetails + excludedDetails + unextractedDetailFailures : null
    const listingPaginationComplete = sourceMatches ? boolean(data(evidence, 'listingPaginationComplete')) : null
    const closingInventoryMatches = sourceMatches ? boolean(data(evidence, 'closingInventoryMatches')) : null
    const countryCountsPresent = data(evidence, 'observedIndiaListingCount') !== undefined || data(evidence, 'nonIndiaListingCount') !== undefined
    const observedIndiaRows = sourceMatches ? count(data(evidence, 'observedIndiaListingCount')) : null
    const excludedNonIndiaRows = sourceMatches ? count(data(evidence, 'nonIndiaListingCount')) : null
    const observedListingRows = sourceMatches ? count(data(evidence, 'observedListingCount')) : null
    const collection = {
      source, evidenceSource, sourceMatches,
      observedListingRows: sourceMatches ? count(data(evidence, 'observedListingCount')) : null,
      candidateDetails, parsedDetails, excludedDetails, unextractedDetailFailures, otherFailures, failureStages,
      countsReconciled, listingPaginationComplete, closingInventoryMatches,
      sourceScopeComplete: sourceMatches ? boolean(data(evidence, 'sourceScopeComplete')) : null,
      ...(countryCountsPresent ? { nativeListingCountryCounts: { observedIndiaRows, excludedNonIndiaRows,
        reconciled: [observedIndiaRows, excludedNonIndiaRows, observedListingRows].every(n => n !== null)
          ? observedIndiaRows + excludedNonIndiaRows === observedListingRows : null } } : {}),
      complete: countsReconciled === true && unextractedDetailFailures === 0 && otherFailures === 0
        && listingPaginationComplete === true && closingInventoryMatches === true,
    }
    const responses = data(evidence, 'retainedResponses')
    const frame = response => ['url', 'bodySHA256', 'requestedAt', 'completedAt'].map(key => scalar(data(response, key)))
    const firstID = scalar(data(evidence, 'firstExtractedJobID') ?? data(data(data(evidence, 'jobs'), '0'), 'id'))
    const compactReference = !Array.isArray(responses)
      && data(evidence, 'retainedResponsesOnFirstExtractedJob') === true
      && data(evidence, 'fullBatchEvidenceOnFirstExtractedJob') === true
    const responseCount = Array.isArray(responses) ? count(responses.length) : count(data(evidence, 'retainedResponseCount'))
    const referenceKey = sourceMatches && firstID !== null && responseCount !== null
      ? JSON.stringify([collection, firstID, responseCount]) : null
    const identity = JSON.stringify([collection, firstID, Array.isArray(responses)
      ? [frame(data(responses, '0')), frame(data(responses, String(responses.length - 1)))] : null,
      ...(compactReference ? ['declared-compact-reference', responseCount] : [])])
    observations.push({ collection, identity, referenceKey, compactReference })
    if (referenceKey !== null && Array.isArray(responses) && Array.isArray(data(evidence, 'jobs'))) {
      if (!fullReferences.has(referenceKey)) fullReferences.set(referenceKey, new Set())
      fullReferences.get(referenceKey).add(identity)
    }
  }
  // Opt-in compact responses explicitly point back to the first extracted job.
  // Resolve only a unique full batch with identical counters,source,first ID
  // and response count. Different full checks remain separate observations.
  for (const observation of observations) {
    let { collection, identity } = observation
    if (observation.compactReference) {
      const matches = fullReferences.get(observation.referenceKey)
      if (matches?.size === 1) identity = matches.values().next().value
      else collection = { ...collection, complete: false, ...(matches?.size > 1
        ? { nativeEvidenceReferenceAmbiguous: true } : { nativeEvidenceReferenceMissing: true }) }
    }
    if (!seen.has(identity)) { seen.add(identity); collections.push(collection) }
  }
  return collections
}

// Inspect the selected India roles separately from upstream enumeration. A
// complete list can still contain details that timed out or lack source text.
export function extractionDetailHealth(jobs = []) {
  let incompleteJobs = 0
  let missingDescriptions = 0
  const failureKinds = {}
  for (const job of jobs) {
    const missing = !hasSourceDescription(job)
    if (missing) missingDescriptions++
    if (missing || job.sourceDetailComplete === false || job.sourceListingComplete === false) {
      incompleteJobs++
      const kind = job.sourceDetailFailureKind || (missing ? 'missing-content' : job.sourceListingComplete === false ? 'listing-incomplete' : 'detail-incomplete')
      failureKinds[kind] = (failureKinds[kind] || 0) + 1
    }
  }
  const native = nativeCollections(jobs)
  return { complete: incompleteJobs === 0 && native.every(collection => collection.complete),
    inspectedJobs: jobs.length, incompleteJobs, missingDescriptions, failureKinds,
    ...(native.length ? { nativeCollections: native } : {}) }
}
