import { createHash } from 'node:crypto'
import { parse } from 'acorn'
import {setTimeout as delay} from 'node:timers/promises'
import { createHTMLTransport } from '../shared/firstPartyHtmlJobs.js'
import { readNativeDocument, decodeNativeEntities, extractActiveDescription } from './activeNativeHtml.js'
import { readVisibleNativeDocument } from './visibleNativeHtml.js'
import { createPublishingGapAtsScraper, publicAtsInventoryError } from './publishingGapAts.js'
import { attachInventoryEvidence, readInventoryEvidence } from './inventoryEvidence.js'

const sha = value => createHash('sha256').update(value).digest('hex')
const requireNative = (value, message) => { if (!value) throw Object.assign(Error('Current native ATS: ' + message), {
  softFailure: true, upstreamOutage: false, abortRetries: true, failureKind: 'coverage_gap',
}) }
const companyKey = value => typeof value === 'string' ? value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '') : null
const executable = node => node.tag === 'script' && !Object.hasOwn(node.attrs, 'nomodule')
  && (!node.attrs.type || /^(?:text|application)\/(?:javascript|ecmascript)$/i.test(node.attrs.type.trim()))
const canonical = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item)

// Preserve exact publisher timestamps. Date.parse alone accepts impossible dates
// such as February30; updated_at must never substitute for first_published.
function nativeDate(value, name, { dateOnly = false } = {}) {
  if (value == null) return null
  requireNative(typeof value === 'string', name + ' date is not a string')
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(Z|[+-]\d{2}:\d{2}))?$/.exec(value)
  requireNative(match && (dateOnly || match[4]), name + ' date format is unknown')
  const [, year, month, day, hour, minute, second, zone] = match
  const calendar = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  requireNative(calendar.getUTCFullYear() === Number(year) && calendar.getUTCMonth() + 1 === Number(month)
    && calendar.getUTCDate() === Number(day) && (!hour || Number(hour) < 24 && Number(minute) < 60 && Number(second) < 60)
    && (!zone || zone === 'Z' || Number(zone.slice(1, 3)) <= 14 && Number(zone.slice(4)) < 60
      && (Number(zone.slice(1, 3)) < 14 || Number(zone.slice(4)) === 0)) && Number.isFinite(Date.parse(value)), name + ' date is impossible')
  return value
}

function noChangedBase(document, current) {
  const bases = document.nodes(node => node.tag === 'base' && Object.hasOwn(node.attrs, 'href'))
  requireNative(bases.length === 0 || bases.length === 1 && new URL(bases[0].attrs.href, current).href === current, 'binding document base changed')
}

function requireRoleSections(decoded, config) {
  const document = readNativeDocument(decoded)
  const events = []
  const visit = node => {
    if (typeof node === 'string') { events.push({ text: decodeNativeEntities(node) }); return }
    if (node.inert || node.tag === 'script') return
    const heading = /^h[1-6]$/.test(node.tag), emphasis = ['strong', 'b'].includes(node.tag)
    const text = heading || emphasis ? document.text(node) : ''
    const role = text.length <= 200 ? [['duties', config.dutiesPattern], ['qualifications', config.requirementsPattern],
      ['stop', config.sectionStopPattern]].find(([, pattern]) => pattern.exec(text)?.index === 0)?.[0] : null
    if (heading || emphasis && role) {
      events.push({ heading: true, role, rank: heading ? Number(node.tag[1]) : 7 })
      return // A nested strong element cannot create the same heading twice.
    }
    for (const child of node.children) visit(child)
  }
  for (const root of document.nodes(node => node.tag === 'root')) visit(root)
  // DOM order is essential: matching earlier prose with indexOf would allow
  // that prose or an unrelated benefits section to fill an empty real heading.
  for (const role of ['duties', 'qualifications']) {
    const index = events.findIndex(event => event.role === role)
    requireNative(index >= 0, 'native full role content lacks duties or qualification headings')
    const section = []
    for (const event of events.slice(index + 1)) {
      if (event.heading && (event.role || event.rank <= events[index].rank)) break
      if (!event.heading) section.push(event.text)
    }
    requireNative(section.join(' ').replace(/\s/g, '').length >= 80, 'native full role content has an empty duties or qualification section')
  }
}

function verifyNitroBinding(html, config) {
  const document = readNativeDocument(html), visible = readVisibleNativeDocument(html, { strict: true })
  noChangedBase(document, config.careersURL)
  requireNative(document.nodes(node => node.attrs.id === 'grnhse_app').length === 1
    && visible.nodes(node => node.attrs.id === 'grnhse_app').length === 1, 'native openings container is missing, duplicated or hidden')
  const title = document.nodes(node => node.tag === 'title').map(node => node.raw).join(' ')
  requireNative(config.nativeEmployerNames.every(name => title.includes(name)), 'native employer alias is no longer advertised by the primary page')
  const matches = []
  for (const script of document.nodes(node => executable(node) && !node.attrs.src && node.raw?.includes('NPRL.registerScript'))) {
    let ast
    try { ast = parse(script.raw, { ecmaVersion: 'latest', sourceType: 'script' }) } catch { requireNative(false, 'loader JavaScript cannot be statically read') }
    // Only direct top-level calls qualify. Comments, strings, templates, dormant
    // functions and conditional branches cannot register an employer board.
    for (const statement of ast.body) {
      const call = statement.type === 'ExpressionStatement' ? statement.expression : null
      if (call?.type !== 'CallExpression' || call.optional || call.callee.type !== 'MemberExpression'
        || call.callee.computed || call.callee.optional || call.callee.object.name !== 'NPRL'
        || call.callee.property.name !== 'registerScript') continue
      const [target, id, encoded] = call.arguments
      if (target?.type !== 'Literal' || typeof target.value !== 'string' || !target.value.includes('greenhouse.io')) continue
      requireNative(call.arguments.length === 3 && id?.type === 'Literal' && typeof id.value === 'string'
        && encoded?.type === 'Literal' && typeof encoded.value === 'string', 'loader binding arguments are unknown')
      requireNative(target.value === config.embedURL, 'current loader binding names another native account')
      requireNative(/^[a-z\d-]{1,100}$/i.test(id.value) && /^[A-Za-z\d+/]+={0,2}$/.test(encoded.value), 'loader metadata identity is invalid')
      let metadata
      try { metadata = JSON.parse(Buffer.from(encoded.value, 'base64').toString('utf8')) } catch { requireNative(false, 'loader metadata cannot be read') }
      requireNative(metadata?.delay === false && canonical(metadata.attributes) === canonical({ id: id.value })
        && metadata.canonicalLink === config.embedURL && Object.keys(metadata).sort().join(',') === 'attributes,canonicalLink,delay',
        'loader metadata does not reconcile the current embed identity')
      // The empty placement template must be the actual next element after the
      // openings container. Comments and inert nested copies cannot supply it.
      const placements = visible.nodes(node => node.children?.some(child => typeof child !== 'string' && !child.inert && child.attrs.id === 'grnhse_app'))
        .map(parent => {
          const siblings = parent.children.filter(child => typeof child !== 'string')
          return siblings[siblings.findIndex(child => !child.inert && child.attrs.id === 'grnhse_app') + 1]
        }).filter(node => node?.tag === 'template' && node.attrs['data-nitro-marker-id'] === id.value
          && !Object.hasOwn(node.attrs, 'hidden') && !Object.hasOwn(node.attrs, 'inert') && !node.children.length)
      requireNative(placements.length === 1, 'native loader placement marker is missing or ambiguous')
      matches.push({ nativeEmbedURL: target.value, loaderRegistrationId: id.value, registrationScriptSHA256: sha(script.raw) })
    }
  }
  requireNative(matches.length === 1, 'current executable native loader binding is absent or ambiguous')
  return { kind: 'current-primary-top-level-Nitro-registration', nativeAccount: config.boardToken, officialURL: config.careersURL,
    ...matches[0], legalEmployerVerified: false, browserExecutionVerified: false }
}

function verifyNativePayload(payload, config, now) {
  requireNative(payload && !publicAtsInventoryError(payload) && Array.isArray(payload.jobs)
    && Number.isSafeInteger(payload.meta?.total) && payload.meta.total === payload.jobs.length
    && payload.hasMore !== true && (payload.total == null || payload.total === payload.jobs.length), 'native inventory envelope/total is incomplete')
  const accepted = new Set([config.companyName, ...config.nativeEmployerNames].map(companyKey)), ids = new Set()
  for (const post of payload.jobs) {
    requireNative(post && typeof post === 'object' && !Array.isArray(post) && Number.isSafeInteger(post.id) && post.id > 0
      && !ids.has(post.id) && typeof post.title === 'string' && post.title.trim(), 'native role identity is missing or duplicated')
    ids.add(post.id)
    requireNative(accepted.has(companyKey(post.company_name)), 'native employer does not match the registered company brand')
    let url
    try { url = new URL(post.absolute_url) } catch { requireNative(false, 'native role URL identity is invalid') }
    const expectedPath = config.mode === 'next-reviewed-client' ? `/${config.boardToken}/jobs/${post.id}` : '/careers/opening/'
    const expectedOrigin = config.mode === 'next-reviewed-client' ? 'https://boards.greenhouse.io' : new URL(config.careersURL).origin
    requireNative(typeof post.absolute_url === 'string' && url.origin === expectedOrigin && url.pathname === expectedPath
      && !url.username && !url.password && !url.hash && [...url.searchParams].length === 1
      && url.searchParams.get('gh_jid') === String(post.id), 'native role URL identity/account does not reconcile')
    for (const field of ['is_active', 'is_published', 'isListed', 'active', 'published']) {
      requireNative(post[field] == null || post[field] === true, 'native public status is inactive or unknown')
    }
    requireNative(post.is_internal == null || post.is_internal === false, 'native public status is internal or unknown')
    for (const field of ['status', 'state']) requireNative(post[field] == null
      || typeof post[field] === 'string' && /^(?:active|open|published|listed)$/i.test(post[field]), 'native public status is not open')
    nativeDate(post.first_published, 'original publication')
    nativeDate(post.updated_at, 'revision')
    const deadline = nativeDate(post.application_deadline, 'application deadline', { dateOnly: true })
    requireNative(!deadline || Date.parse(deadline.length === 10 ? deadline + 'T23:59:59Z' : deadline) >= now, 'native application deadline date has expired')
    const decoded = decodeNativeEntities(post.content), content = extractActiveDescription(decoded)
    requireNative(typeof post.content === 'string' && content?.length >= 300 && config.dutiesPattern.test(content)
      && config.requirementsPattern.test(content), 'native full role content lacks substantive duties or qualifications')
    requireRoleSections(decoded, config)
  }
}

// A source-specific current-client binding supplements the existing real native
// Greenhouse mapper. Neither an account-name guess nor a historical fixture can
// replace the employer page, reviewed client/loader, or current public response.
export function createCurrentClientGreenhouseScraper(config) {
  const apiURL = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(config.boardToken)}/jobs?content=true`
  const allowedURLs = new Set([config.careersURL, apiURL, ...(config.portalURL ? [config.portalURL, config.clientURL] : [])])
  return { async run({ fetchImpl, signal, sourceTimeoutMs = 90000, maxJobs, maxRequests = 12, maxAggregateBytes = 8 * 1024 * 1024,
    requestIntervalMs = 1000 } = {}) {
    requireNative(['next-reviewed-client', 'nitro-greenhouse'].includes(config.mode), 'unreviewed binding mode')
    requireNative(Number.isSafeInteger(sourceTimeoutMs) && sourceTimeoutMs > 0 && sourceTimeoutMs <= 120000, 'source timeout bound is invalid')
    requireNative(Number.isSafeInteger(maxRequests) && maxRequests > 0 && maxRequests <= 12, 'native request bound is invalid')
    requireNative(Number.isSafeInteger(maxAggregateBytes) && maxAggregateBytes > 0 && maxAggregateBytes <= 16 * 1024 * 1024, 'native aggregate byte bound is invalid')
    requireNative(maxJobs === undefined || Number.isSafeInteger(maxJobs) && maxJobs >= 0 && maxJobs <= 10000, 'returned role bound is invalid')
    requireNative(Number.isSafeInteger(requestIntervalMs) && requestIntervalMs >= 0
      && (requestIntervalMs >= 1000 || typeof fetchImpl === 'function' && fetchImpl !== globalThis.fetch), 'native request interval is invalid')
    signal?.throwIfAborted()
    if (maxJobs === 0) {
      const jobs = []
      Object.defineProperty(jobs, Symbol.for('jobverify.official-ats-discovery'), { value: {
        source: config.source, binding: null, nativeInventory: { snapshots: 0,
          observedNativeRoles: null, fullContentRoles: null, selectedIndiaPostings: null,
          returnedPostings: 0, unresolvedCountryScope: true, scopeComplete: false },
        retainedResponses: [], productionWrites: false,
      } })
      return attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: config.careersURL,
        firstParty: false, listingComplete: false, pagesFetched: 0, reportedTotal: null,
        indiaFacetCount: null, verifiedAt: new Date().toISOString(), reason: 'caller-zero-result-limit;native-inventory-not-read;cleanup-forbidden' })
    }
    const runSignal = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(sourceTimeoutMs)])
    const validateURL = url => requireNative(allowedURLs.has(url), 'unqualified native read URL')
    const transport = createHTMLTransport({ validateURL, expectedContentType: url => url === apiURL ? 'application/json'
      : url === config.clientURL ? 'text/javascript' : 'text/html' }, { fetchImpl, signal: runSignal })
    let requests = 0, bytes = 0
    const priorReads = new Map()
    const retainedResponses = []
    const read = async (url, types) => {
      runSignal.throwIfAborted(); requireNative(++requests <= maxRequests, 'native request bound exceeded')
      const origin = new URL(url).origin, wait = requestIntervalMs - (Date.now() - (priorReads.get(origin) || 0))
      if (wait > 0) await delay(wait, undefined, {signal: runSignal})
      runSignal.throwIfAborted(); priorReads.set(origin, Date.now())
      const response = await transport(url)
      runSignal.throwIfAborted(); bytes += response.body.length
      requireNative(bytes <= maxAggregateBytes, 'native aggregate byte bound exceeded')
      requireNative(response.status === 200, 'HTTP ' + response.status + ' native response')
      const mime = response.headers['content-type']?.split(';')[0].trim().toLowerCase()
      requireNative(types.includes(mime), 'native content type is unexpected')
      const text = new TextDecoder('utf-8', { fatal: true }).decode(response.body)
      requireNative(text.trim(), 'native response body is empty')
      retainedResponses.push({ url, status: response.status, contentType: mime, bodyBytes: response.body.length,
        bodySHA256: sha(response.body), rawBodyBase64: response.body.toString('base64'), requestedAt: response.requestedAt,
        completedAt: response.completedAt, bodyRepresentation: 'complete decoded HTTP response body' })
      return text
    }
    const binding = async () => {
      const html = await read(config.careersURL, ['text/html']), document = readNativeDocument(html)
      noChangedBase(document, config.careersURL)
      if (config.mode === 'nitro-greenhouse') return verifyNitroBinding(html, config)
      // Corporate CSS visibility is not inferred by this proof. This is a
      // current active HTML hyperlink to an employer-owned portal; both the
      // portal route and its exact reviewed executable client are verified next.
      const links = document.nodes(node => node.tag === 'a' && node.attrs.href).filter(node => {
        try { return new URL(node.attrs.href, config.careersURL).href === config.portalURL } catch { return false }
      })
      requireNative(links.length > 0, 'current corporate native jobs handoff is missing')
      const portal = await read(config.portalURL, ['text/html']), page = readNativeDocument(portal)
      noChangedBase(page, config.portalURL)
      const next = page.nodes(node => node.tag === 'script' && node.attrs.id === '__NEXT_DATA__' && node.attrs.type === 'application/json')
      requireNative(next.length === 1 && page.nodes(node => node.attrs.id === '__next').length === 1, 'current native Next route is ambiguous')
      let state
      try { state = JSON.parse(next[0].raw) } catch { requireNative(false, 'native Next route data is invalid') }
      requireNative(state.page === '/' && canonical(state.query) === '{}' && state.buildId === config.buildId
        && state.nextExport === true && state.isFallback === false, 'native Next route/build contract changed')
      const clients = page.nodes(node => executable(node) && node.attrs.src).filter(node => {
        try { return new URL(node.attrs.src, config.portalURL).href === config.clientURL } catch { return false }
      })
      requireNative(clients.length === 1, 'current executable native client is missing or ambiguous')
      const client = await read(config.clientURL, ['text/javascript', 'application/javascript'])
      requireNative(sha(Buffer.from(client)) === config.clientSHA256, 'reviewed native client contract changed')
      return { kind: 'current-corporate-owned-Next-portal-and-reviewed-client', nativeAccount: config.boardToken,
        officialURL: config.careersURL, portalURL: config.portalURL, clientURL: config.clientURL,
        clientSHA256: config.clientSHA256, buildId: config.buildId, corporateLinkVisibilityVerified: false,
        browserExecutionVerified: false, legalEmployerVerified: false }
    }
    const snapshot = async () => {
      const currentBinding = await binding(), text = await read(apiURL, ['application/json'])
      let payload
      try { payload = JSON.parse(text) } catch { requireNative(false, 'native inventory JSON is invalid') }
      verifyNativePayload(payload, config, Date.now())
      const jobs = await createPublishingGapAtsScraper({ source: config.source, companyName: config.companyName,
        companyDomain: config.companyDomain, companyCareerPage: config.careersURL, atsPlatform: 'greenhouse',
        boardToken: config.boardToken, sourceScopeComplete: false }).run({ signal: runSignal, fetchJson: async url => {
        requireNative(url === apiURL, 'native mapper requested an unqualified feed')
        return payload
      } })
      runSignal.throwIfAborted()
      return { binding: currentBinding, payload, jobs, innerEvidence: readInventoryEvidence(jobs) }
    }
    const first = await snapshot(), closing = await snapshot()
    const fingerprint = payload => canonical({ ...payload, jobs: [...payload.jobs].sort((a, b) => a.id - b.id) })
    const bindingKey = value => canonical({ kind: value.kind, nativeAccount: value.nativeAccount, clientSHA256: value.clientSHA256,
      officialURL: value.officialURL, nativeEmbedURL: value.nativeEmbedURL })
    requireNative(bindingKey(first.binding) === bindingKey(closing.binding) && fingerprint(first.payload) === fingerprint(closing.payload),
      'native binding or complete inventory changed during closing snapshot')
    const nativeById = new Map(first.payload.jobs.map(post => [String(post.id), post]))
    const jobs = first.jobs.slice(0, maxJobs).map(job => {
      const post = nativeById.get(String(job.jobId))
      const descriptionHTML = decodeNativeEntities(post.content)
      return { ...job, sourceUrl: post.absolute_url, sourceDescription: descriptionHTML, jobDescription: descriptionHTML,
        nativeDescriptionHTML: descriptionHTML, nativeDescriptionRaw: post.content,
        postingDate: post.first_published ?? null, nativePublicationDate: post.first_published ?? null,
        nativeUpdatedAt: post.updated_at ?? null, nativeApplicationDeadline: post.application_deadline ?? null,
        nativeSourceRecord: structuredClone(post), nativeEmployerBrand: post.company_name, nativeLegalEmployer: null,
        employmentType: null, sourceDetailComplete: true, sourceScopeComplete: false, sourceListingComplete: false,
        lifecycleCleanupAllowed: false, applicationAccessVerified: false, applicationSubmitted: false,
        officialAtsBinding: first.binding }
    })
    const proof = { source: config.source, binding: first.binding, nativeInventory: { snapshots: 2,
      observedNativeRoles: first.payload.jobs.length, fullContentRoles: first.payload.jobs.length,
      selectedIndiaPostings: first.jobs.length, returnedPostings: jobs.length,
      unresolvedCountryScope: /native-location-scope-unresolved|native-india-location-unmapped/.test(first.innerEvidence?.reason || ''),
      publicStatusEvidence: 'current unfiltered public API membership; conflicting explicit status fields rejected',
      scopeComplete: false }, innerEvidence: first.innerEvidence, retainedResponses, productionWrites: false }
    Object.defineProperty(jobs, Symbol.for('jobverify.official-ats-discovery'), { value: proof })
    return attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: apiURL, firstParty: true, listingComplete: false,
      pagesFetched: 2, reportedTotal: first.payload.meta.total, indiaFacetCount: null, verifiedAt: new Date().toISOString(),
      reason: 'current-employer-client-bound-native-feed;two-full-snapshots;other-channels-and-legal-employer-unknown;cleanup-forbidden'
        + (proof.nativeInventory.unresolvedCountryScope ? ';native-location-scope-unresolved' : '') })
  } }
}
