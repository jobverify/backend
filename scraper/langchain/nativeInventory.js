import { createHash } from 'node:crypto'
import { readNativeDocument, activeIframeSources } from '../../scraper-support/utils/activeNativeHtml.js'
import { identifyPublicAtsBoard } from '../../scraper-support/utils/publicAtsIdentity.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { inspectNativeRoleCriteria, inspectNativeCountries } from './nativeRoleEvidence.js'
import { withNativeAbort, readNativePublicDocument, serializeNativePayload } from './nativeTransport.js'
import { declaredNativeFrontend, nativeFrontendEntry, verifyNativeFrontend } from './nativeFrontendContract.js'

export const CAREERS_URL = 'https://www.langchain.com/careers'
export const BOARD_URL = 'https://jobs.ashbyhq.com/langchain'
export const API_URL = 'https://api.ashbyhq.com/posting-api/job-board/langchain'
export const RECRUITMENT_OBSERVATIONS = Symbol.for('jobverify.verified-recruitment-observations')
const OFFICIAL_ATS_DISCOVERY = Symbol.for('jobverify.official-ats-discovery')
// Exact historical loaders retain their reviewed profiles. Current declared
// deployments require manifest/SRI and complete reviewed module AST validation;
// downloaded JavaScript remains data and is never executed here.
const REVIEWED_LOADER_SHA256 = 'eea23f1de66310eaa08ca779df5fe4d9cdbffb738f9dae84c5254a3514048149'
const REVIEWED_MANIFEST_URL = 'https://cdn.ashbyprd.com/frontend_non_user/3fe3f8247ce1d2ca000991427629bd467057ba6c/.vite/manifest.json'
const REVIEWED_FRONTENDS = Object.freeze([
  { loaderSHA256: REVIEWED_LOADER_SHA256, manifestURL: REVIEWED_MANIFEST_URL,
    manifestSHA256: '8072fffa5176941b2df69affb583c952633e5abf49f52605b448c6cbf9b5934f',
    entrySHA256: '0caf6e210c9581f7e4eef29cf1bd1d2a3102ac7218f1cad5f8b7bc6b58e28d38',
    contract: 'AT -> window.__appData.jobBoard -> direct jobPostings array; ApiJobBoardWithTeams has only organizationHostedJobsPageName; local Qv/Ile/Nle/Ryt filters and renders all postings' },
  { loaderSHA256: 'dbf1f9e0d92a280bcd38e89308ba5d0df7364779720dd931013b5825e2d72d8b',
    manifestURL: 'https://cdn.ashbyprd.com/frontend_non_user/249f9e89fb71dacdfea1d66006891f1e8ea0bfaf/.vite/manifest.json',
    manifestSHA256: 'ad4278e23150e7978545aed6d051d6a537b83ad64976000a8483f5c26e45a004',
    entrySHA256: '4a736d8e2d0041974cfad92cd2cbdb8768bf85772179d0a293fb4c849c075515',
    entrySRI: 'sha384-++oChadkH1HdrjVXmU+DT54E0IRBXHZapfDLYLN7fsL4Genp6hOikd4nQlyY8dij',
    staticReviewSHA256: '709aa6a0a5c214e7d8bf5c5cb3cbdc4a3d3a8091285e028a2d570b545bec0671',
    contract: 'MT -> window.__appData; zyt selects WOe API query or bootstrap jobBoard; Byt consumes full jobPostings; $v/Ile/Nle filter/group/count locally; query has only organizationHostedJobsPageName' },
  { loaderSHA256: '934d962eaa1105c3116a6e5b15f79a745980784cbeaf83baea447ac6c299954f',
    manifestURL: 'https://cdn.ashbyprd.com/frontend_non_user/14c61a6af42192b9a5a9105f0cb01a41b7ac8c9b/.vite/manifest.json',
    manifestSHA256: 'f30cf908fcb56f607a3c3fd0aedd782cba6ec05a5ade41d5f102c967fff522d1',
    entrySHA256: '814bacc2d043f7d39b1b81b9a7fb6eb59f00c8161c2c148380ccab8cd43fd8e0',
    entrySRI: 'sha384-fZhYi39O32+L3oRFDrrIXCbSjgj049ale5Eds9vWb+NiHgRXJigHyW95Y6WjeLnp',
    staticReviewSHA256: 'af481c2142f635df24c110062a207fda03bf1d7f0362784102db63e9b34fdedf',
    contract: 'MT -> window.__appData; zyt selects WOe API query or bootstrap jobBoard; Byt consumes full jobPostings; $v/Ile/Nle filter/group/count locally; query has only organizationHostedJobsPageName' },
])
const LIMITS = Object.freeze({ requests: 9, responseBytes: 8000000, aggregateBytes: 24000000, nativeRows: 2000, requestTimeoutMs: 15000 })
const POSTING_FIELDS = new Set(['id', 'title', 'department', 'team', 'employmentType', 'location', 'secondaryLocations',
  'publishedAt', 'isListed', 'isRemote', 'workplaceType', 'address', 'descriptionHtml', 'descriptionPlain', 'jobUrl', 'applyUrl'])
const sha = value => createHash('sha256').update(value).digest('hex')
const text = value => typeof value === 'string' && value.trim().length > 0
const object = value => value && typeof value === 'object' && !Array.isArray(value)
const requireValue = (value, message) => { if (!value) throw Object.assign(Error('[langchain] ' + message), { failureKind: 'coverage_gap', softFailure: true, upstreamOutage: false, abortRetries: true }) }
const normalized = value => value.normalize('NFKC').replace(/\s+/g, ' ').trim()
const isCorporate = value => {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.port && ['langchain.com', 'www.langchain.com'].includes(url.hostname) } catch { return false }
}

// JSON.parse alone discards duplicate declarations. Inspect validated JSON's
// original keys before using any employer, publication or access authority.
function rejectDuplicateBootstrapKeys(json) {
  const containers = []
  for (let cursor = 0; cursor < json.length; cursor++) {
    const char = json[cursor]
    if (char === '{') containers.push(new Set())
    else if (char === '[') containers.push(null)
    else if (char === '}' || char === ']') containers.pop()
    else if (char === '"') {
      const start = cursor
      for (cursor++; cursor < json.length; cursor++) {
        if (json[cursor] === '\\') cursor++
        else if (json[cursor] === '"') break
      }
      let next = cursor + 1
      while (/\s/.test(json[next] ?? '') && next < json.length) next++
      if (json[next] === ':') {
        const key = JSON.parse(json.slice(start, cursor + 1)), keys = containers.at(-1)
        requireValue(keys instanceof Set && !keys.has(key), 'Duplicate native bootstrap authority key')
        keys.add(key)
      }
    }
  }
}

function literalBootstrap(html) {
  const doc = readNativeDocument(html)
  const scripts = doc.nodes(node => node.tag === 'script' && !node.attrs.src && (node.raw || '').includes('window.__appData'))
  requireValue(scripts.length === 1, 'Missing or ambiguous native board bootstrap')
  const script = scripts[0].raw, prefix = /^\s*window\.__appData\s*=\s*/.exec(script)
  requireValue(prefix && script[prefix[0].length] === '{', 'Native bootstrap is not a literal JSON object')
  let depth = 0, quoted = false, escaped = false, end = -1
  for (let cursor = prefix[0].length; cursor < script.length; cursor++) {
    const char = script[cursor]
    if (quoted) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') quoted = false }
    else if (char === '"') quoted = true
    else if (char === '{') depth++
    else if (char === '}' && --depth === 0) { end = cursor + 1; break }
  }
  requireValue(end > 0, 'Unterminated native bootstrap JSON')
  const suffix = script.slice(end).trim()
  const frontend = REVIEWED_FRONTENDS.find(profile => sha(suffix) === profile.loaderSHA256 && suffix.includes(profile.manifestURL))
    || declaredNativeFrontend(suffix)
  const json = script.slice(prefix[0].length, end), data = JSON.parse(json)
  rejectDuplicateBootstrapKeys(json)
  const organization = data.organization, board = data.jobBoard
  requireValue(data.maintenanceMode === false && data.posting === null && data.routerPrefix === '/', 'Native board publication or route state changed')
  requireValue(object(organization) && organization.name === 'LangChain' && organization.hostedJobsPageSlug === 'langchain'
    && text(organization.organizationId) && isCorporate(organization.publicWebsite) && organization.customJobsPageUrl === null
    && organization.isDemoOrg === false && organization.__typename === 'Organization', 'Native employer/account binding changed')
  requireValue(object(board) && board.__typename === 'JobBoard' && Array.isArray(board.jobPostings)
    && Array.isArray(board.teams) && Object.keys(board).every(key => ['teams', 'jobPostings', '__typename', 'stealthAccess'].includes(key))
    && (!Object.hasOwn(board, 'stealthAccess') || board.stealthAccess === false)
    && board.jobPostings.length <= LIMITS.nativeRows, 'Unsupported native board inventory shape')
  const ids = new Set(), teams = new Map()
  for (const team of board.teams) {
    requireValue(object(team) && text(team.id) && text(team.name) && !teams.has(team.id), 'Invalid native team inventory')
    teams.set(team.id, team)
  }
  for (const row of board.jobPostings) {
    requireValue(object(row) && text(row.id) && !ids.has(row.id) && text(row.title) && text(row.locationName)
      && teams.has(row.teamId) && row.__typename === 'JobPostingBriefsWithIdsAndTeamId'
      && Array.isArray(row.secondaryLocations), 'Invalid or duplicate native board posting')
    ids.add(row.id)
  }
  return { data, organization, board, frontend }
}

function corporateBinding(response) {
  requireValue(response.status === 200 && isCorporate(response.url), 'Current corporate careers body unavailable')
  const doc = readNativeDocument(response.body)
  const resolve = value => { try { return new URL(value, response.url).href } catch { return null } }
  const anchors = doc.nodes(node => node.tag === 'a' && node.attrs.href).map(node => ({ url: resolve(node.attrs.href), text: doc.text(node) })).filter(row => row.url)
  const scripts = doc.nodes(node => node.tag === 'script' && node.attrs.src).map(node => resolve(node.attrs.src)).filter(Boolean)
  const frames = activeIframeSources(response.body).map(resolve).filter(Boolean)
  const hiringLinks = anchors.filter(row => /career|jobs?|vacanc|hiring|recruit|openings?|join.{0,12}(?:us|team)/i.test(row.url + ' ' + row.text))
  const carriers = [...hiringLinks.map(row => row.url), ...scripts, ...frames]
  const bindings = carriers.map(url => ({ url, board: identifyPublicAtsBoard(url) })).filter(row => row.board)
  requireValue(bindings.some(row => row.board.atsPlatform === 'ashby' && row.board.boardToken === 'langchain'
    && /^https:\/\/jobs\.ashbyhq\.com\/langchain(?:\/embed)?$/.test(row.url)), 'Current corporate Ashby hiring handoff unavailable')
  const alternatives = bindings.filter(row => row.board.atsPlatform !== 'ashby' || row.board.boardToken !== 'langchain')
  return { verified: true, officialURL: response.url, httpStatus: response.status,
    matchedLinks: bindings.filter(row => row.board.atsPlatform === 'ashby' && row.board.boardToken === 'langchain').map(row => row.url),
    bindingMethod: 'current-corporate-active-native-handoff-and-reciprocal-native-organization',
    hiringLinks, activeFrames: frames, declaredPrograms: scripts,
    activeForms: doc.nodes(node => node.tag === 'form').map(node => ({ action: node.attrs.action ?? null, id: node.attrs.id ?? null })),
    unqualifiedAlternativeBoards: alternatives.map(row => row.url),
    sourceScopeComplete: false,
  }
}

function publishedDate(value) {
  requireValue(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value), 'Invalid native publication timestamp')
  const date = new Date(value)
  requireValue(Number.isFinite(date.getTime()), 'Invalid native publication calendar/time')
  // Round-trip the local calendar in the published UTC offset, rejecting dates
  // such as February 30 that Date would otherwise silently normalize.
  const offset = /([+-])(\d{2}):(\d{2})$/.exec(value)
  const minutes = offset ? (offset[1] === '+' ? 1 : -1) * (+offset[2] * 60 + +offset[3]) : 0
  requireValue(!offset || +offset[2] <= 23 && +offset[3] <= 59, 'Invalid native publication offset')
  requireValue(new Date(+date + minutes * 60000).toISOString().slice(0, 19) === value.slice(0, 19), 'Impossible native publication calendar/time')
  const fractionalDigits = /\.(\d+)(?:Z|[+-])/.exec(value)?.[1].length ?? 0
  return { raw: value, iso: date.toISOString(), precision: ['second', 'decisecond', 'centisecond', 'millisecond'][fractionalDigits], fractionalDigits,
    sourceField: 'publishedAt', provenance: 'native-public-posting-api', firstEverPublication: null }
}

function fullModels(payload, bootstrap, check) {
  check()
  requireValue(object(payload) && payload.apiVersion === '1' && Array.isArray(payload.jobs)
    && Object.keys(payload).every(key => ['jobs', 'apiVersion'].includes(key)) && payload.jobs.length <= LIMITS.nativeRows, 'Invalid native inventory envelope or schema')
  requireValue(payload.jobs.length === bootstrap.board.jobPostings.length, 'Native board/API inventory count mismatch')
  const briefs = new Map(bootstrap.board.jobPostings.map(row => [row.id, row])), identities = new Set()
  const relations = { inspected: 0, unresolved: 0, worksiteUnresolved: 0, countryCounts: {} }
  const models = payload.jobs.map(row => {
    check()
    requireValue(object(row) && Object.keys(row).every(field => POSTING_FIELDS.has(field)), 'Unreviewed native role schema fields')
    requireValue(object(row) && typeof row.id === 'string' && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(row.id)
      && !identities.has(row.id) && text(row.title) && row.isListed === true, 'Invalid native identity or public listed state')
    identities.add(row.id)
    const brief = briefs.get(row.id)
    requireValue(brief && ['title', 'employmentType', 'workplaceType'].every(field => row[field] === brief[field])
      && row.location === brief.locationName && Array.isArray(row.secondaryLocations)
      && JSON.stringify(row.secondaryLocations.map(location => location?.location)) === JSON.stringify(brief.secondaryLocations.map(location => location?.locationName)), 'Native board/API posting identity or location mismatch')
    for (const [field, suffix] of [['jobUrl', ''], ['applyUrl', '/application']]) {
      requireValue(row[field] === BOARD_URL + '/' + row.id + suffix, 'Foreign native posting/application identity')
    }
    const { authoredCriteria, ownedBlocks } = inspectNativeRoleCriteria(row, check)
    requireValue((row.isRemote === null || typeof row.isRemote === 'boolean') && [null, 'Remote', 'Hybrid', 'OnSite'].includes(row.workplaceType)
      && ['FullTime', 'PartTime', 'Contract', 'Intern', 'Temporary'].includes(row.employmentType)
      && text(row.department) && text(row.team), 'Unsupported native role employment schema')
    requireValue(!(row.isRemote === true && row.workplaceType === 'OnSite')
      && !(row.isRemote === false && row.workplaceType === 'Remote'), 'Unreviewed contradictory native remote/workplace tuple')
    const countries = inspectNativeCountries(row, ownedBlocks, check)
    const locations = countries.locations
    for (const location of locations) {
      relations.inspected++
      if (!location.countryScopeQualified) relations.unresolved++
      else relations.countryCounts[location.country] = (relations.countryCounts[location.country] || 0) + 1
      if (!location.worksiteScopeQualified) relations.worksiteUnresolved++
    }
    check()
    return { id: row.id, title: normalized(row.title), nativeSourceRecord: structuredClone(row), nativeBoardRecord: structuredClone(brief),
      nativeCountryRelations: locations, nativeAuthoredCriteria: authoredCriteria, nativePublication: publishedDate(row.publishedAt),
      nativeCountryScopeQualified: countries.countryScopeQualified, nativeAuthoredLocationRestrictions: countries.restrictionClauses,
      nativeQualification: { complete: countries.qualifiedForProjection, contentComplete: true,
        countryComplete: countries.countryScopeQualified, worksiteComplete: countries.worksiteScopeQualified,
        unresolved: [...new Set(locations.flatMap(location => location.unresolved))] },
      nativeListedState: true, nativeOpenStateBasis: 'current-public-board-membership-and-api-isListed-true',
      nativePublicationStatus: 'listed-public-posting', legalEmployer: null, requisitionId: null, firstEverPublication: null,
      applicationVisited: false, sourceDetailComplete: countries.qualifiedForProjection }
  })
  check(); return { models, relations }
}

export const createLangchainNativeScraper = () => ({
  async run(options = {}) {
    const { signal, sourceTimeoutMs = 90000 } = options
    requireValue(Number.isSafeInteger(sourceTimeoutMs) && sourceTimeoutMs > 0 && sourceTimeoutMs <= 120000, 'Source timeout must be between 1 and 120000 milliseconds')
    signal?.throwIfAborted()
    const deadline = performance.now() + sourceTimeoutMs
    const deadlineReason = Error('LangChain native source deadline exceeded')
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(deadlineReason), sourceTimeoutMs)
    const runSignal = AbortSignal.any([controller.signal, ...(signal ? [signal] : [])])
    const check = () => {
      signal?.throwIfAborted()
      if (!controller.signal.aborted && performance.now() >= deadline) controller.abort(deadlineReason)
      runSignal.throwIfAborted()
    }
    const retainedResponses = [], executionStartedAt = new Date().toISOString()
    const requestChecks = new WeakMap()
    let totalBytes = 0, audit = null
    const get = async url => {
      check()
      requireValue(retainedResponses.length < LIMITS.requests, 'Source request bound exceeded')
      const requestedAt = new Date().toISOString(), request = new AbortController()
      const requestDeadline = performance.now() + LIMITS.requestTimeoutMs
      const requestReason = Error('LangChain native request deadline exceeded')
      const requestTimer = setTimeout(() => request.abort(requestReason), LIMITS.requestTimeoutMs)
      const requestSignal = AbortSignal.any([runSignal, request.signal])
      const checkRequest = () => {
        check()
        if (!request.signal.aborted && performance.now() >= requestDeadline) request.abort(requestReason)
        requestSignal.throwIfAborted()
      }
      let response
      try {
        const byteLimit = Math.min(LIMITS.responseBytes, LIMITS.aggregateBytes - totalBytes)
        if (options.fetchDocument) response = await withNativeAbort(() => options.fetchDocument(url,
          { method: 'GET', redirect: 'manual', signal: requestSignal }), requestSignal, checkRequest)
        else if (options.fetchPage && url !== API_URL) response = await withNativeAbort(() => options.fetchPage(url,
          { signal: requestSignal }), requestSignal, checkRequest)
        else if (options.fetchJson && url === API_URL) {
          const payload = await withNativeAbort(() => options.fetchJson(url, { signal: requestSignal }), requestSignal, checkRequest)
          response = { status: 200, url, body: serializeNativePayload(payload, { check: checkRequest, byteLimit, nativeRows: LIMITS.nativeRows }),
            bodyRepresentation: 'caller-parsed-json-reserialization' }
        } else response = await readNativePublicDocument(url, { signal: requestSignal, callerSignal: signal ?? null, check: checkRequest, byteLimit })
        checkRequest()
        requireValue(object(response) && Number.isSafeInteger(response.status) && response.url === url, 'Unexpected public response authority or transport shape')
        const body = response.body ?? response.html
        const record = { requestedUrl: url, url, method: 'GET', status: response.status,
          location: response.location ?? response.headers?.location ?? null,
          sourceRequestedAt: response.sourceRequestedAt ?? requestedAt,
          sourceCompletedAt: response.sourceCompletedAt ?? new Date().toISOString(),
          offlineReviewRequestedAt: options.acquisitionMode === 'captured-response-replay' ? requestedAt : null,
          bodyRepresentation: response.bodyRepresentation ?? 'response-text',
          headers: Object.fromEntries(Object.entries(response.headers || {}).filter(([name]) => name.toLowerCase() !== 'set-cookie')) }
        checkRequest()
        requestChecks.set(record, checkRequest)
        retainedResponses.push(record)
        if (response.status >= 300 && response.status < 400) {
          record.bodyUnavailable = true; record.bodyUnavailableReason = response.bodyUnavailableReason || 'Redirect response body not supplied; metadata retained without fabricating a body.'
          return { ...record, body: null }
        }
        requireValue(typeof body === 'string', 'Public response body unavailable')
        const bytes = Buffer.byteLength(body)
        requireValue(bytes <= LIMITS.responseBytes && totalBytes + bytes <= LIMITS.aggregateBytes, 'Response or aggregate byte limit exceeded')
        totalBytes += bytes
        Object.assign(record, { body, bodyBytes: bytes, bodySHA256: sha(body), bodyUnavailable: false })
        checkRequest()
        if (record.status !== 200) {
          const denied = [401, 403, 406, 429, 451].includes(record.status)
          throw Object.assign(Error('[langchain] Public source HTTP ' + record.status), {
            status: record.status, statusCode: record.status, requestUrl: url,
            failureKind: denied ? 'blocked_or_access_denied' : 'coverage_gap',
            softFailure: true, upstreamOutage: denied, abortRetries: true,
          })
        }
        return record
      } finally { clearTimeout(requestTimer) }
    }
    try {
      let corporate = await get(CAREERS_URL)
      for (let redirects = 0; corporate.status >= 300 && corporate.status < 400 && redirects < 3; redirects++) {
        requireValue(text(corporate.location), 'Corporate redirect lacks a declared Location')
        const next = new URL(corporate.location, corporate.url)
        requireValue(isCorporate(next.href) && !next.hash, 'Unreviewed corporate redirect authority')
        corporate = await get(next.href)
      }
      const checkCorporate = requestChecks.get(corporate)
      checkCorporate(); const binding = corporateBinding(corporate); checkCorporate()
      const boardResponse = await get(BOARD_URL)
      const checkBoard = requestChecks.get(boardResponse)
      checkBoard(); const bootstrap = literalBootstrap(boardResponse.body); checkBoard()
      let frontend = bootstrap.frontend
      if (frontend.requiresCurrentProgramVerification) {
        const manifestResponse = await get(frontend.manifestURL)
        const entry = nativeFrontendEntry(frontend, manifestResponse, requestChecks.get(manifestResponse))
        const entryResponse = await get(entry.entryURL)
        frontend = verifyNativeFrontend(frontend, entry, entryResponse, requestChecks.get(entryResponse))
      }
      const currentPublicProfile = frontend.reviewedProgramASTProfile === 'reviewed-complete-module-public-stealth-false-20261107'
      requireValue(Object.hasOwn(bootstrap.board, 'stealthAccess') === currentPublicProfile,
        'Native public board access declaration and reviewed frontend profile disagree')
      const apiResponse = await get(API_URL)
      const checkAPI = requestChecks.get(apiResponse)
      checkAPI(); const payload = JSON.parse(apiResponse.body); checkAPI()
      const { models, relations } = fullModels(payload, bootstrap, checkAPI)
      const closingAPI = await get(API_URL), closingBoard = await get(BOARD_URL), closingCorporate = await get(corporate.url)
      runSignal.throwIfAborted()
      requireValue(closingAPI.bodySHA256 === apiResponse.bodySHA256 && closingBoard.bodySHA256 === boardResponse.bodySHA256
        && closingCorporate.bodySHA256 === corporate.bodySHA256, 'Closing native inventory, role content, or corporate binding changed during collection')
      check()
      const indiaModels = models.filter(model => model.nativeQualification.complete && model.nativeCountryRelations.some(location => location.country === 'India'))
      const detailHealth = { complete: models.length > 0 && models.every(model => model.sourceDetailComplete),
        inspectedJobs: models.length, incompleteJobs: models.filter(model => !model.sourceDetailComplete).length,
        missingDescriptions: 0, contentComplete: models.length > 0, missingCriteria: 0,
        incompleteCountryJobs: models.filter(model => !model.nativeQualification.countryComplete).length,
        incompleteWorksiteJobs: models.filter(model => !model.nativeQualification.worksiteComplete).length,
        nonVacuous: models.length > 0, basis: 'every-native-listed-role-active-authored-criteria-and-typed-country-worksite-consistency-before-projection' }
      audit = { source: 'langchain', executionStartedAt, executionCompletedAt: new Date().toISOString(),
        acquisitionMode: options.acquisitionMode ?? (options.fetchDocument || options.fetchPage || options.fetchJson ? 'caller-supplied-response' : 'current-anonymous-node-get'),
        physicalAcquisitionStartedAt: retainedResponses[0].sourceRequestedAt,
        physicalAcquisitionCompletedAt: retainedResponses.at(-1).sourceCompletedAt,
        configuredBoardURL: BOARD_URL, nativeModelURL: API_URL, nativeApiVersion: payload.apiVersion,
        reviewedNativeFrontend: { ...frontend,
          evidenceKind: frontend.evidenceKind ?? 'previously-acquired-static-contract-pinned-by-current-loader',
          programsRefetchedDuringThisAttempt: frontend.programsRefetchedDuringThisAttempt === true, downloadedJavaScriptExecuted: false },
        corporateBinding: binding, nativeOrganization: structuredClone(bootstrap.organization),
        observedListingCount: models.length, fullNativeModels: models, countryRelations: relations,
        allRoleDetailHealth: detailHealth, nativeQualificationHealth: { ...detailHealth },
        listingPaginationComplete: true, closingInventoryMatches: true,
        configuredBoardInventoryComplete: detailHealth.complete && relations.unresolved === 0 && relations.worksiteUnresolved === 0,
        configuredBoardIndiaCount: detailHealth.complete && relations.unresolved === 0 && relations.worksiteUnresolved === 0 ? indiaModels.length : null,
        sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null,
        lifecycleCleanupAllowed: false, applicationsVisited: false, bounds: LIMITS,
        requestCount: retainedResponses.length, aggregateBytes: totalBytes, retainedResponses }
      const jobs = indiaModels.map(model => {
        const row = model.nativeSourceRecord, india = model.nativeCountryRelations.filter(location => location.country === 'India')
        return { source: 'langchain', company: 'LangChain', id: row.id, jobId: row.id, requisitionId: null,
          title: model.title, department: row.department, team: row.team,
          sourceUrl: row.jobUrl, applyUrl: row.applyUrl, link: row.applyUrl, country: 'India',
          city: india.length === 1 ? india[0].nativeAddress.addressLocality ?? null : null,
          state: india.length === 1 ? india[0].nativeAddress.addressRegion ?? null : null,
          location: [...new Set(india.map(location => location.location))].join(' / '),
          jobDescription: row.descriptionHtml, sourceDescription: row.descriptionHtml, nativeDescriptionHTML: row.descriptionHtml,
          nativeDescriptionPlain: row.descriptionPlain, nativeSourceRecord: row, nativeFacts: model,
          employmentType: row.employmentType, workplaceType: row.workplaceType, isRemote: row.isRemote,
          postingDate: row.publishedAt, nativePublication: model.nativePublication, closingDate: null,
          firstEverPublication: null, legalEmployer: null, experienceRequired: null, minimumQualification: null,
          preferredQualification: null, requiredSkills: [], sourceDetailComplete: true, sourceListingComplete: false,
          sourceScopeComplete: false, lifecycleCleanupAllowed: false, applicationVisited: false,
          officialAtsBinding: binding, scrapedAt: audit.physicalAcquisitionCompletedAt }
      })
      attachInventoryEvidence(jobs, { status: 'discovery-only', surface: API_URL, firstParty: true,
        listingComplete: false, pagesFetched: retainedResponses.length, reportedTotal: null, indiaFacetCount: null,
        verifiedAt: audit.physicalAcquisitionCompletedAt,
        reason: `langchain-configured-public-board-${audit.configuredBoardInventoryComplete ? 'complete' : 'country-scope-unresolved'}:company-source-scope-unresolved` })
      attachSourceObservationEvidence(jobs, { source: 'langchain', recordKind: 'vacancy-rows', observedRecordCount: models.length,
        observedVacancyCount: models.length, sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null })
      Object.defineProperty(jobs, RECRUITMENT_OBSERVATIONS, { value: { source: 'langchain', nativeRecords: models.length,
        returnedIndiaJobs: jobs.length, nativeInventoryAudit: audit } })
      Object.defineProperty(jobs, OFFICIAL_ATS_DISCOVERY, { value: { boards: [{ atsPlatform: 'ashby', boardToken: 'langchain', bindingEvidence: binding }], checks: retainedResponses.map(({ body, ...receipt }) => receipt) } })
      requestChecks.get(closingCorporate)()
      return jobs
    } catch (error) {
      if (signal?.aborted) throw signal.reason
      if (runSignal.aborted && ![401, 403, 406, 429, 451].includes(error?.status)) throw runSignal.reason
      if (error && typeof error === 'object' && Object.isExtensible(error)) Object.assign(error, { source: 'langchain',
        nativeCollectionEvidence: audit || { source: 'langchain', sourceScopeComplete: false, companyGlobalTotal: null,
          companyIndiaTotal: null, configuredBoardInventoryComplete: false, retainedResponses: error.nativeHttpReceipt
            ? [...retainedResponses, error.nativeHttpReceipt] : retainedResponses } })
      throw error
    } finally { clearTimeout(timer) }
  },
})
