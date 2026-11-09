import { ActiveNativeContentError, decodeNativeEntities, extractActiveDescription } from './activeNativeHtml.js'
import { attachInventoryEvidence } from './inventoryEvidence.js'
import { turboHireWorkplaces, turboHireDate, turboHireRecruitmentRecord } from './turboHireNativeFacts.js'

const clean = value => decodeNativeEntities(value).replace(/\s+/g, ' ').trim()

const requireNative = (source, condition, message) => {
  if (!condition) throw Object.assign(new Error(`[${source}] TurboHire native details: ${message}`), {
    abortRetries: true, incompleteScope: true,
  })
}

const publicModel = (source, payload) => {
  requireNative(source, payload && typeof payload === 'object' && !Array.isArray(payload), 'malformed public native model')
  for (const key of ['Error','Errors','error','errors','Exception','exception','ErrorMessage','errorMessage'])
    requireNative(source, payload[key] == null || payload[key] === '' || Array.isArray(payload[key]) && payload[key].length === 0,
      'public native response contains an error envelope')
  for (const key of ['Success','success']) if (payload[key] != null)
    requireNative(source, payload[key] === true, 'public native response reports failure')
  for (const key of ['StatusCode','statusCode']) if (payload[key] != null)
    requireNative(source, payload[key] === 200, 'public native response reports a failure status')
}

const locations = (source, record) => {
  let values
  try { values = JSON.parse(record?.Location) } catch { /* rejected below */ }
  requireNative(source, Array.isArray(values) && values.length > 0
    && values.every(value => typeof value?.Address === 'string' && value.Address.trim()),
  'native workplace addresses unavailable')
  return values.map(value => clean(value.Address).replace(/\s*,\s*/g, ', ')).sort()
}

const snapshot = (payload, { source, orgId, employer }) => {
  publicModel(source, payload)
  requireNative(source, Array.isArray(payload?.Result) && Number.isSafeInteger(payload.Total)
    && payload.Total >= 0 && payload.Total === payload.Result.length,
  'listing total is missing or truncated')
  const ids = new Set()
  const records = payload.Result.map(record => {
    requireNative(source, typeof record.JobId === 'string' && record.JobId.trim()
      && !ids.has(record.JobId), 'listing role identity is missing or duplicated')
    ids.add(record.JobId)
    requireNative(source, record.OrgDetails?.OrgID === orgId
      && clean(record.OrgDetails?.OrgName) === employer, 'listing employer does not match the declared board')
    requireNative(source, clean(record.JobTitle)
      && typeof record.JobIdObfuscated === 'string' && /^[\w%=+-]+$/.test(record.JobIdObfuscated),
    'listing title or public role identity unavailable')
    return {
      id: record.JobId, title: clean(record.JobTitle), code: clean(record.JobCode),
      publicId: record.JobIdObfuscated, locations: locations(source, record),
      posted: record.PublishedDate ?? null, closes: record.ExpiryDates?.CAREERPAGE ?? null,
    }
  }).sort((a, b) => a.id.localeCompare(b.id))
  return { records, signature: JSON.stringify(records) }
}

// JobDescV2 is a 500-character listing preview. It is not a full description,
// and frequently stops inside a tag or a quoted attribute. Read the native
// public getJobInfo response, bound to the same role, employer and workplaces.
// Never recover by accepting the preview or weakening the active HTML reader.
export const hydrateTurboHireJobs = async ({
  source, orgId, employer, origin, apiBaseUrl, boardUrl, payload, jobs,
  fetchJson, headers, listingUrl, listingRequest, maxJobs, signal, now = () => new Date().toISOString(),
  retainNativeProof = false, publisherProof = null, verifyPublisher, publicJobInfoUrl, verifyNativeDetail, mapNativeFields,
}) => {
  signal?.throwIfAborted()
  const context = { source, orgId, employer }
  const opening = snapshot(payload, context)
  requireNative(source, maxJobs == null || Number.isSafeInteger(maxJobs) && maxJobs >= 0, 'invalid caller cap')
  const selected = maxJobs == null ? jobs : jobs.slice(0, maxJobs)
  const hydrated = []
  const failures = []
  let stopped = false
  for (const job of selected) {
    signal?.throwIfAborted()
    const listing = payload.Result.find(record => record.JobId === job.jobId)
    requireNative(source, listing && job.sourceUrl === `${origin}/job/publicjobs/${listing.JobIdObfuscated}`
      && job.title === clean(listing.JobTitle), 'selected role is outside the current native listing')
    const url = publicJobInfoUrl ? publicJobInfoUrl(listing)
      : `${apiBaseUrl}/api/publicjobs/${encodeURIComponent(job.jobId)}?fieldVisibility=CareerPage`
    let detail
    try { detail = await fetchJson(url, { method: 'GET', headers, signal }) }
    catch (error) {
      signal?.throwIfAborted()
      if (!retainNativeProof || !error.publicReadFailure) throw error
      failures.push({ stage: 'native-detail', nativeJobId: job.jobId, sourceUrl: job.sourceUrl,
        failureKind: 'native-public-read-failed', status: error.status ?? null })
      stopped = true
      break
    }
    signal?.throwIfAborted()
    publicModel(source, detail)
    const qualified = verifyNativeDetail ? await verifyNativeDetail(detail, listing) : null
    signal?.throwIfAborted()
    requireNative(source, detail?.JobId === listing.JobId && clean(detail.JobTitle) === job.title
      && detail.OrgDetails?.OrgID === orgId && clean(detail.OrgDetails?.OrgName) === employer
      && detail.JobIdObfuscated === listing.JobIdObfuscated && clean(detail.JobCode) === clean(listing.JobCode),
    'detail role, title or employer contradicts the listing')
    requireNative(source, JSON.stringify(locations(source, detail)) === JSON.stringify(locations(source, listing)),
      'detail workplaces contradict the listing')
    // The detail's generic PublishedDate can belong to another job board and
    // differ by days. The CAREERPAGE clock is the one used by filteredjobs.
    requireNative(source, (detail.PublishedDates?.CAREERPAGE ?? null) === (listing.PublishedDate ?? null)
      && (detail.ExpiryDates?.CAREERPAGE ?? null) === (listing.ExpiryDates?.CAREERPAGE ?? null),
    'detail publication or closing date contradicts the listing')
    if (detail.IsPublic !== true || detail.JobStatus !== 'Active'
      || !Array.isArray(detail.PublishedJobBoards) || !detail.PublishedJobBoards.includes('CAREERPAGE')) {
      failures.push({ stage: 'native-detail', nativeJobId: job.jobId, sourceUrl: job.sourceUrl,
        failureKind: 'native-public-vacancy-status-unqualified', nativeStatus: detail.JobStatus ?? null })
      continue
    }
    if (qualified?.sourceDetailComplete === false) {
      failures.push({ stage: 'native-detail', nativeJobId: job.jobId, sourceUrl: job.sourceUrl, failureKind: 'missing-content' })
      continue
    }
    let sections
    try {
      const description = extractActiveDescription(detail.JobDescriptionV2 || detail.JobDescription)
      sections = [description, ...[detail.RolesAndResponsibilitiesV2, detail.EligibilityV2]
        .map(extractActiveDescription).filter(Boolean)]
    } catch (error) {
      if (!retainNativeProof || !(error instanceof ActiveNativeContentError)) throw error
      failures.push({ stage: 'native-detail', nativeJobId: job.jobId, sourceUrl: job.sourceUrl,
        failureKind: 'malformed-native-full-description' })
      continue
    }
    const description = sections[0]
    if (!description || description.length < 150) {
      failures.push({ stage: 'native-detail', nativeJobId: job.jobId, sourceUrl: job.sourceUrl,
        failureKind: 'missing-content' })
      continue
    }
    let nativeFacts = {}
    if (retainNativeProof) {
      const workplaces = turboHireWorkplaces(detail.Location), india = workplaces.find(place => place.countryCode === 'IN')
      const ordered = value => value.sort((a, b) => a.address.localeCompare(b.address))
      requireNative(source, JSON.stringify(ordered([...workplaces])) === JSON.stringify(ordered(turboHireWorkplaces(listing.Location))),
        'typed native detail workplaces contradict the listing')
      requireNative(source, india, 'selected role lacks a native India workplace')
      const postingDate = turboHireDate(detail.PublishedDates?.CAREERPAGE, { now: now(), publication: true })
      const closingDate = turboHireDate(detail.ExpiryDates?.CAREERPAGE, { now: now() })
      requireNative(source, detail.IsDraft === false, 'native role draft status unavailable or unqualified')
      const expired = closingDate && (closingDate.length === 10
        ? closingDate < now().slice(0, 10) : Date.parse(closingDate) < Date.parse(now()))
      if (expired) {
        failures.push({ stage: 'native-detail', nativeJobId: job.jobId, sourceUrl: job.sourceUrl, failureKind: 'native-vacancy-expired' })
        continue
      }
      nativeFacts = { country: 'India', city: india.city, location: india.address, locations: workplaces,
        postingDate, closingDate, sourcePostedDateRaw: detail.PublishedDates?.CAREERPAGE ?? null,
        sourceDateProvenance: 'native-TurboHire-PublishedDates.CAREERPAGE', firstEverPostedAt: null,
        sourceNativeClosingDate: detail.ExpiryDates?.CAREERPAGE ?? null, sourceClosingDateIsExact: Boolean(closingDate?.endsWith('Z')),
        sourceDetailStatus: 'complete', sourcePrimaryLocation: workplaces[0].address,
        sourceDescriptionAttachment: detail.JobDescriptionBlobUrl || null, publicExperienceChecked: true, applicationVisited: false,
        nativeEmployerBinding: { method: 'current-corporate-handoff-and-native-organization', publisher: employer,
          nativeOrganizationId: orgId, legalEmployer: null },
        nativeSourceRecord: { nativeListing: turboHireRecruitmentRecord(listing),
          nativeDetail: turboHireRecruitmentRecord(detail), nativePublisher: publisherProof } }
    }
    const fullDescription = sections.join('\n\n')
    const fullFields = mapNativeFields ? mapNativeFields(detail, fullDescription) : {}
    hydrated.push({ ...job, ...fullFields, ...nativeFacts, jobDescription: fullDescription, sourceDescription: fullDescription,
      sourceDetailComplete: true, sourceDescriptionApiUrl: url,
      sourceNativeGeneralPublishedDate: detail.PublishedDate ?? null,
      sourceNativeLocations: retainNativeProof ? nativeFacts.locations : locations(source, detail) })
  }
  let closingPayload, closing = null
  if (!stopped) {
    try { closingPayload = await fetchJson(listingUrl, listingRequest); closing = snapshot(closingPayload, context) }
    catch (error) {
      signal?.throwIfAborted()
      if (!retainNativeProof || !error.publicReadFailure) throw error
      failures.push({ stage: 'closing-inventory', failureKind: 'native-public-read-failed', status: error.status ?? null })
      stopped = true
    }
  }
  signal?.throwIfAborted()
  if (closing) requireNative(source, opening.signature === closing.signature, 'closing native inventory changed')
  if (retainNativeProof) {
    if (closingPayload) for (const job of hydrated) {
      const original = turboHireWorkplaces(job.nativeSourceRecord.nativeListing.Location)
      const current = turboHireWorkplaces(closingPayload.Result.find(record => record.JobId === job.jobId).Location)
      const ordered = values => values.sort((a, b) => a.address.localeCompare(b.address))
      requireNative(source, JSON.stringify(ordered(original)) === JSON.stringify(ordered(current)), 'typed closing workplaces changed')
    }
    let publisherReconciled = false
    if (!stopped && verifyPublisher) {
      try { await verifyPublisher(); publisherReconciled = true }
      catch (error) {
        signal?.throwIfAborted()
        if (!error.publicReadFailure) throw error
        failures.push({ stage: 'closing-publisher', failureKind: 'native-public-read-failed', status: error.status ?? null })
      }
    }
    const result = hydrated.map(job => ({ ...job, sourceScopeComplete: false, sourceListingComplete: false,
      lifecycleCleanupAllowed: false, nativeRoleClosingReconciled: Boolean(closing && publisherReconciled),
      sourceInventoryScope: `declared-first-party-${source}-TurboHire-careers-board`,
      nativeSourceRecord: { ...job.nativeSourceRecord, nativeClosingListing: closingPayload
        ? turboHireRecruitmentRecord(closingPayload.Result.find(record => record.JobId === job.jobId)) : null } }))
    const observed = { source, candidateDetails: selected.length, extractedDetailJobs: result.length,
      jobs: result.map(job => ({ id: job.jobId })), exclusions: [], failures,
      listingPaginationComplete: true, closingInventoryMatches: Boolean(closing),
      publisherClosingMatches: publisherReconciled, sourceScopeComplete: false }
    if (result.length) result[0].nativeCollectionEvidence = observed
    Object.defineProperty(result, Symbol.for('jobverify.verified-recruitment-observations'), { value: observed })
    return attachInventoryEvidence(result, { status: 'coverage-gap', surface: boardUrl, firstParty: true,
      listingComplete: false, pagesFetched: 1 + selected.length + Number(Boolean(closing)),
      reportedTotal: payload.Total, indiaFacetCount: null, verifiedAt: now(),
      reason: 'individually-verified-native-TurboHire-details;company-inventory-not-certified'
        + (failures.length ? ';unqualified-native-details:' + failures.map(failure => failure.failureKind).join(',') : '') })
  }
  // A board with unresolved/foreign workplace labels or a caller limit is not
  // certified as a complete India inventory merely because selected roles work.
  const complete = hydrated.length === payload.Total
    && opening.records.every(record => record.locations.every(location => /(?:^|, )India$/i.test(location)))
  const verifiedAt = now()
  const result = hydrated.map(job => ({ ...job, sourceListingComplete: complete,
    lifecycleCleanupAllowed: complete, sourceInventoryScope: `declared-first-party-${source}-TurboHire-careers-board` }))
  if (failures.length && result.length) result[0].nativeCollectionEvidence = {
    source, candidateDetails: selected.length, extractedDetailJobs: result.length,
    jobs: result.map(job => ({ id: job.jobId })), exclusions: [], failures,
    listingPaginationComplete: true, closingInventoryMatches: true, sourceScopeComplete: false,
  }
  return attachInventoryEvidence(result, {
    status: complete ? (result.length ? 'complete-inventory' : 'verified-empty') : 'coverage-gap',
    surface: boardUrl, firstParty: true, listingComplete: complete, pagesFetched: 2 + hydrated.length,
    reportedTotal: payload.Total, indiaFacetCount: complete ? result.length : null, verifiedAt,
    reason: complete ? 'current-declared-TurboHire-board:stable-total-identities-workplaces-and-full-native-details'
      : 'current-declared-TurboHire-board:limited-selection-or-unresolved-India-inventory'
        + (failures.length ? ';unqualified-native-details:' + failures.map(failure => `${failure.nativeJobId}:${failure.failureKind}`).join(',') : ''),
  })
}
