import {createHash} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {readNativeDocument, activeHead, extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {decodeJavaScriptStringLiteral} from '../../scraper-support/utils/safeLiteral.js'
import {nativeCountryName, nativeDate} from '../../scraper-support/shared/nativeJobPosting.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {buildSearchJobsRequestBody, isTeradataSearchRequest} from './searchRequest.js'

export const SOURCE = 'teradata', COMPANY = 'Teradata'
export const CAREERS = 'https://www.teradata.com/about-us/careers', BOARD = 'https://careers.teradata.com/jobs'
export const API = 'https://careers.teradata.com/graphql'
export const CLIENTS = Object.freeze([
  {url: 'https://assets.gr8people.com/builds/app-career-site/_next/static/chunks/pages/_app-214209832d7e8cff.js', sha256: '75e26cac47358bb07ec4653e32d38369113571c9a2efe0b5de9c6b861439113a'},
  {url: 'https://assets.gr8people.com/builds/app-career-site/_next/static/chunks/661-f731e19d0bb3ca29.js', sha256: '3b25c7c420d81eae8504229a25255616135d908f9c4d1f799b6a8c5966fbfc43'},
])
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const copy = value => structuredClone(value)
const canonical = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(k => [k, item[k]])) : item)
const need = (ok, message) => {if (!ok) throw Object.assign(Error('Teradata native: ' + message), {code: 'TERADATA_NATIVE_PROOF', abortRetries: true})}
const one = (items, label) => {need(items.length === 1, 'missing or ambiguous ' + label); return items[0]}
const parsed = body => copy(readLiteralModel(body).value)
const text = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : null
const allowed = new Set([CAREERS, BOARD, API, ...CLIENTS.map(c => c.url)])

export function corporateHandoff(html) {
  const doc = readNativeDocument(html)
  need(!doc.nodes(n => n.tag === 'base').length, 'unreviewed corporate document base')
  need(activeHead(html).titles.includes('Careers | Teradata'), 'current corporate identity missing')
  need(doc.nodes(n => n.tag === 'a' && n.attrs.href === BOARD && doc.text(n) === 'Explore careers').length > 0, 'active corporate careers handoff missing')
  return {url: CAREERS, board: BOARD, title: 'Careers | Teradata'}
}

export function boardContext(html) {
  const doc = readNativeDocument(html)
  need(!doc.nodes(n => n.tag === 'base').length, 'unreviewed native document base')
  need(activeHead(html).titles.includes('Search Careers at Teradata'), 'current native board identity missing')
  const next = parsed(one(doc.nodes(n => n.tag === 'script' && n.attrs.id === '__NEXT_DATA__' && n.attrs.type === 'application/json'), 'current native page model').raw)
  const props = next.props?.pageProps
  need(next.page === '/jobs' && props?.client?.name === COMPANY && props.client.id === 'Q2xpZW50LzE=', 'current native publisher changed')
  need(canonical(props.jobPostingSettings) === canonical({visibleFields: ['POSITION_TYPE', 'WORKPLACE_TYPE']}), 'native visible criteria configuration changed')
  for (const client of CLIENTS) need(doc.nodes(n => n.tag === 'script' && n.attrs.src === client.url).length === 1, 'reviewed current client is not declared')
  return {client: props.client, visibleFields: props.jobPostingSettings.visibleFields, clients: CLIENTS}
}

// The current client publishes these URL helpers with slugify lower/strict.
// Read only its literal character map; never evaluate the downloaded program.
export function currentClientSlugger(program) {
  need(sha(program) === CLIENTS[0].sha256, 'declared native client changed')
  const start = program.indexOf('4103:function(e)'), end = program.indexOf('slugify: string argument expected', start)
  need(start >= 0 && end > start, 'reviewed native URL transformation missing')
  const literal = program.slice(start, end).match(/var e=JSON\.parse\(('(?:\\.|[^'\\])*')\),t=JSON\.parse\(/)?.[1]
  need(literal, 'reviewed literal native character map missing')
  const characters = parsed(decodeJavaScriptStringLiteral(literal))
  return title => title.normalize().split('').reduce((result, character) => {
    let value = characters[character] || character
    if (value === '-') value = ' '
    return result + value.replace(/[^\w\s$*_+~.()'"!\-:@]+/g, '')
  }, '').replace(/[^A-Za-z0-9\s]/g, '').trim().replace(/\s+/g, '-').toLowerCase()
}

const countryAddress = schema => {
  const place = Array.isArray(schema.jobLocation) ? schema.jobLocation.length === 1 && schema.jobLocation[0] : schema.jobLocation
  return place?.address
}
const nativeSchema = row => {
  need(row?.__typename === 'JobPosting' && typeof row.key === 'string' && /^\d+$/.test(row.key)
    && row.id === Buffer.from('JobPosting/' + row.key).toString('base64') && row.number === row.key && text(row.title), 'native posting identity changed')
  const schema = parsed(row.structuredDataJSON)
  need(schema['@type'] === 'JobPosting' && schema.title === row.title && schema.identifier === row.key, 'native model/schema identity mismatch')
  need(schema.hiringOrganization?.name === COMPANY && row.status === 'OPEN' && ['EXTERNAL', 'INT_EXT'].includes(row.postType), 'native employer or public status unqualified')
  return schema
}

export function nativePlaceCountries(rows) {
  const places = new Map()
  for (const row of rows) {
    try {
      const schema = nativeSchema(row), address = countryAddress(schema), country = nativeCountryName(address?.addressCountry)
      need(country && text(row.primaryPlace?.id) && text(row.primaryPlace?.name), 'primary worksite country missing')
      const entry = places.get(row.primaryPlace.id) || {name: row.primaryPlace.name, countries: new Set(), references: []}
      entry.countries.add(country)
      if (entry.name !== row.primaryPlace.name) entry.countries.add('ambiguous-native-place-name')
      entry.references.push({key: row.key, country, address: copy(address)})
      places.set(row.primaryPlace.id, entry)
    } catch { /* A missing primary country cannot provide another role's evidence. */ }
  }
  for (const entry of places.values()) entry.references.sort((a, b) => a.key.localeCompare(b.key))
  return places
}

// The current full models use this finite rich-text vocabulary. Inspect the
// original tree, including inert descendants, before producing active text.
// Unknown tags, attributes or CSS cannot prove that all displayed criteria
// survived. This policy is local to the reviewed, pinned Teradata client.
const criteriaTags = new Set(['root', 'p', 'span', 'strong', 'ul', 'li', 'b', 'br', 'h1', 'h2', 'h3', 'h4', 'div', 'em', 'u'])
const criteriaClasses = new Set(['pf0', 'cf0', 'p4', 'p5', 'x-component', 'x-component-default', 'html-editor-content', 'cf1', 'xmsonormal'])
const criteriaIds = new Set(['fieldcontainer-1016-labelCell', 'fieldcontainer-1016-containerEl', 'fieldcontainer-1016-innerCt', 'component-1017'])
const criteriaStyles = new Map(Object.entries({
  'font-size': ['9pt', '9.5pt', '11pt', '11.0pt', '12pt', '12.0pt', 'medium'],
  color: ['#000000', 'windowtext', 'black', '#00233c', '#1f2937', '#6b7280', '#4472c4', '#426fc1', '#1f3864', '#595959', '#003300', '#4471c4'],
  background: ['white'], 'text-align': ['justify'], 'list-style-type': ['none'], 'font-weight': ['400', 'bold'],
  margin: ['0in'], 'margin-left': ['.375in'], 'margin-top': ['0in', '0'], 'margin-bottom': ['0in', '0'],
  'font-family': ["'open sans'", "'cambria math'", "'aptos narrow'"], direction: ['ltr'], 'unicode-bidi': ['embed'], 'vertical-align': ['middle'],
}).map(([key, values]) => [key, new Set(values)]))
const completeCriteriaText = html => {
  need(typeof html === 'string' && !/<!--|<!|<\?/.test(html), 'hidden or unreviewed native role criteria')
  const doc = readNativeDocument(html), root = one(doc.nodes(n => n.tag === 'root'), 'native criteria root')
  const visit = node => {
    if (typeof node === 'string') return
    need(!node.inert && criteriaTags.has(node.tag), 'hidden or unreviewed native role criteria')
    for (const [name, value] of Object.entries(node.attrs)) {
      if (name === 'class') need(value.split(/\s+/).filter(Boolean).every(c => criteriaClasses.has(c)), 'unreviewed native criteria class')
      else if (name === 'id') need(criteriaIds.has(value), 'unreviewed native criteria id')
      else if (name === 'type') need(node.tag === 'ul' && value === 'disc', 'unreviewed native criteria list type')
      else if (name === 'style') {
        const properties = new Set()
        for (const declaration of value.split(';').map(s => s.trim()).filter(Boolean)) {
          const match = declaration.match(/^([a-z-]+)\s*:\s*(.+)$/i), property = match?.[1].toLowerCase(), setting = match?.[2].trim().toLowerCase()
          need(match && !properties.has(property) && criteriaStyles.get(property)?.has(setting), 'hidden or unreviewed native criteria style')
          properties.add(property)
        }
      } else need(false, 'hidden or unreviewed native criteria attribute')
    }
    node.children.forEach(visit)
  }
  visit(root)
  return extractActiveDescription(html)
}

export function nativeRole(row, places, slugger, clock, {allowUnresolvedSecondary = false} = {}) {
  const schema = nativeSchema(row), address = countryAddress(schema), country = nativeCountryName(address?.addressCountry)
  need(country, 'own native work country missing')
  if (country !== 'India') return {excluded: true, country}
  need(typeof row.descriptionHTML === 'string' && row.descriptionHTML === schema.description, 'full native criteria/schema mismatch')
  const description = completeCriteriaText(row.descriptionHTML)
  need(description && description.length >= 100, 'full native role criteria unavailable')
  need(row.eeoText == null || typeof row.eeoText === 'string', 'unreviewed native eligibility criteria model')
  const eligibility = row.eeoText ? completeCriteriaText(row.eeoText) : null
  need(row.places?.__typename === 'PlaceConnection' && Array.isArray(row.places.nodes) && row.places.nodes.length > 0
    && row.places.pageInfo?.hasNextPage === false && row.places.pageInfo.hasPreviousPage === false, 'native workplace connection incomplete')
  need(row.places.nodes.some(p => p.id === row.primaryPlace?.id && p.name === row.primaryPlace.name), 'primary workplace is absent from own locations')
  const locations = row.places.nodes.map(place => {
    const evidence = places.get(place.id)
    // A written country at the end of this role's own workplace is explicit
    // evidence. A city, state abbreviation or standalone country-shaped city
    // cannot provide this fallback. Existing contradictory references still hold.
    const last = place.name?.includes(',') ? place.name.split(',').at(-1).trim() : null
    const written = last?.length > 2 ? nativeCountryName(last) : null
    if (allowUnresolvedSecondary && (!evidence && !written || evidence && (evidence.name !== place.name || evidence.countries.size !== 1))) {
      return {location: place.name, country: null, nativePlaceId: place.id, nativeCountryEvidence: {method: 'unresolved-own-native-workplace', referenceKey: row.key}}
    }
    if (!evidence) {
      need(written, 'native secondary worksite country unresolved')
      return {location: place.name, country: written, nativePlaceId: place.id,
        nativeCountryEvidence: {method: 'own-native-workplace-written-country', referenceKey: row.key, nativeLabel: place.name}}
    }
    need(evidence.name === place.name && evidence.countries.size === 1, 'native secondary worksite country unresolved')
    const bound = [...evidence.countries][0]
    need(!written || written === bound, 'native written work country contradicts own typed reference')
    return {location: place.name, country: bound, nativePlaceId: place.id,
      nativeCountryEvidence: {method: 'current-own-primary-place-and-JobPosting-addressCountry', referenceKey: evidence.references[0].key}}
  })
  need(locations.find(p => p.nativePlaceId === row.primaryPlace.id)?.country === country, 'own primary country contradicts native place evidence')
  need(schema.datePosted === row.postedOn, 'native publication timestamps conflict')
  const posted = nativeDate(row.postedOn, {required: true})
  need(Date.parse(posted.iso) <= Date.parse(clock), 'future native publication')
  const slug = slugger(row.title)
  need(slug && /^[a-z0-9-]+$/.test(slug), 'native public role path unavailable')
  const sourceUrl = 'https://careers.teradata.com/jobs/' + row.key + '/' + slug
  return {source: SOURCE, company: COMPANY, jobId: row.key, nativeJobId: row.id, nativePostingNumber: row.number,
    title: row.title, sourceUrl, applyUrl: sourceUrl, link: sourceUrl, requisitionId: null, legalEmployer: null,
    country, city: address.addressLocality === 'VIRTUAL' ? null : text(address.addressLocality), state: text(address.addressRegion),
    location: locations.map(p => p.location).join('; '), locations, nativeCountryAddresses: [copy(address)],
    sourceCountryScopeUnresolved: locations.some(p => p.country === null),
    nativeHiringOrganization: copy(schema.hiringOrganization), department: null, employmentType: text(row.positionType?.name),
    experienceRequired: null, requiredSkills: [], minimumQualification: null, preferredQualification: null,
    jobDescription: [description, eligibility].filter(Boolean).join('\n'),
    sourceDescription: row.descriptionHTML, nativeWorkplaceType: row.workplaceType,
    remoteStatus: ({REMOTE: 'Remote', HYBRID: 'Hybrid', ON_SITE: 'On-site'})[row.workplaceType] || null,
    postingDate: row.postedOn, postedAt: row.postedOn, sourcePostedDateRaw: row.postedOn, sourceDatePrecision: posted.precision,
    closingDate: null, firstEverPublication: null, applicationVisited: false, activeApplyVerified: false,
    nativeSourceRecord: {posting: copy(row), jobPosting: copy(schema)},
    sourceDetailComplete: false, sourceDetailStatus: 'partial', nativeRoleClosingReconciled: false,
    sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false, scrapedAt: clock}
}

export const createNativeTeradataScraper = (defaults = {}) => ({async run(options = {}) {
  const settings = {...defaults, ...options}
  settings.signal?.throwIfAborted()
  const cap = settings.maxJobs == null ? Infinity : settings.maxJobs
  need(cap === Infinity || Number.isSafeInteger(cap) && cap >= 0, 'invalid result cap')
  const clock = new Date(typeof settings.now === 'function' ? settings.now() : settings.now || Date.now()).toISOString()
  const receipts = [], gaps = [], held = [], audit = {source: SOURCE, observedAt: clock, nativeRecords: 0,
    openingPages: 0, closingPages: 0, nativeRoleClosingReconciled: 0, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
    failures: gaps, heldNativeRows: held, clientProofs: CLIENTS}
  const finish = jobs => {
    Object.defineProperty(jobs, Symbol.for('jobverify.verified-recruitment-observations'), {value: {...audit,
      returnedIndiaJobs: jobs.length, unresolved: ['company-recruitment-scope-unverified', ...gaps.map(g => g.message)],
      nativeInventoryReads: [{kind: 'gr8people-persisted-search', surface: BOARD, reportedTotal: audit.nativeRecords}]}})
    if (jobs.length) jobs[0].sourceNativeCollectionAudit = {...audit, responseHashes: receipts.map(r => ({url: r.url, status: r.status, sha256: r.sha256}))}
    return attachInventoryEvidence(jobs, {status: 'coverage-gap', surface: BOARD, firstParty: true, listingComplete: false,
      reportedTotal: null, indiaFacetCount: null, pagesFetched: receipts.length, verifiedAt: clock,
      reason: 'Current native full models reconciled=' + audit.nativeRoleClosingReconciled + '; whole company scope and lifecycle cleanup remain unqualified'})
  }
  if (cap === 0) return finish([])
  const interval = settings.minIntervalMs ?? 1000
  need(Number.isSafeInteger(interval) && interval >= 0 && interval <= 5000 && (interval >= 1000 || typeof settings.fetchImpl === 'function'), 'invalid source pacing')
  const controller = new AbortController(), signal = settings.signal ? AbortSignal.any([settings.signal, controller.signal]) : controller.signal
  const deadline = setTimeout(() => controller.abort(Object.assign(Error('Teradata native source deadline'), {code: 'TERADATA_NATIVE_DEADLINE'})), 180000)
  const fetchImpl = settings.fetchImpl || globalThis.fetch, lastStarted = new Map()
  let totalBytes = 0, jobs = [], openingRows = [], slugger, openingInventoryComplete = false
  const read = async (url, request = {}) => {
    signal.throwIfAborted()
    need(allowed.has(url), 'unreviewed source request')
    need(receipts.length < 30, 'source request bound')
    const origin = new URL(url).origin, wait = interval - (Date.now() - (lastStarted.get(origin) || 0))
    if (wait > 0) await delay(wait, undefined, {signal})
    signal.throwIfAborted(); lastStarted.set(origin, Date.now())
    const local = new AbortController(), combined = AbortSignal.any([signal, local.signal])
    let listener, reader, response
    const timeout = setTimeout(() => local.abort(Object.assign(Error('Teradata native request deadline'), {code: 'TERADATA_NATIVE_REQUEST_DEADLINE'})), 20000)
    const interrupted = new Promise((_, reject) => {listener = () => reject(combined.reason); combined.addEventListener('abort', listener, {once: true})})
    try {
      return await Promise.race([(async () => {
        const method = request.body ? 'POST' : 'GET'
        need(method === 'GET' || url === API && isTeradataSearchRequest(request.body), 'unreviewed native operation')
        response = await fetchImpl(url, {method, body: request.body ? JSON.stringify(request.body) : undefined,
          headers: {Accept: url === API ? 'application/json' : '*/*', ...(request.body ? {'Content-Type': 'application/json', 'Apollo-Require-Preflight': 'true'} : {})},
          credentials: 'omit', redirect: 'manual', signal: combined})
        combined.throwIfAborted()
        need(response.url === url && Number.isInteger(response.status), 'manual response identity changed')
        const receipt = {url, method, status: response.status, sha256: null}; receipts.push(receipt)
        if (response.status !== 200) throw Object.assign(Error('Teradata native HTTP ' + response.status), {status: response.status, requestUrl: url, finalUrl: response.url, abortRetries: true})
        const mime = response.headers.get('content-type') || '', expected = url === API ? /^application\/json\b/i
          : url.startsWith('https://assets.') ? /^(?:text|application)\/javascript\b/i : /^text\/html\b/i
        need(expected.test(mime), 'unexpected native response MIME')
        const advertised = response.headers.get('content-length'), encoding = response.headers.get('content-encoding')
        need(advertised === null || /^\d+$/.test(advertised) && Number(advertised) <= 4000000, 'advertised native response byte bound')
        need(!encoding || ['identity', 'gzip', 'br', 'deflate'].includes(encoding.toLowerCase()), 'unsupported native response encoding')
        reader = response.body?.getReader(); need(reader, 'native response stream missing')
        const chunks = []; let count = 0
        for (;;) {combined.throwIfAborted(); const part = await reader.read(); combined.throwIfAborted(); if (part.done) break
          count += part.value.byteLength; totalBytes += part.value.byteLength
          need(count <= 4000000 && totalBytes <= 32000000, 'native response byte bound'); chunks.push(Buffer.from(part.value))}
        need(advertised === null || encoding && encoding !== 'identity' || Number(advertised) === count, 'native body length mismatch')
        const bytes = Buffer.concat(chunks); receipt.sha256 = sha(bytes)
        return new TextDecoder('utf-8', {fatal: true}).decode(bytes)
      })(), interrupted])
    } finally {
      clearTimeout(timeout); combined.removeEventListener('abort', listener)
      if (reader) void reader.cancel().catch(() => {})
      else void response?.body?.cancel().catch(() => {})
    }
  }
  const inventory = async phase => {
    const rows = [], ids = new Set(); let expected = null
    for (let start = 0; start < 1000; start += 100) {
      const result = parsed(await read(API, {body: buildSearchJobsRequestBody({start})}))
      const observed = result.data?.searchJobs?.results?.nodes
      // A subsequent page or an earlier malformed row must not resurrect a
      // contradiction already present anywhere in this parsed closing page.
      if (phase === 'closing' && Array.isArray(observed)) {
        const counts = new Map()
        for (const row of observed) counts.set(row?.key, (counts.get(row?.key) || 0) + 1)
        jobs = jobs.filter(job => {
          const matches = observed.filter(row => row?.key === job.jobId)
          const changed = matches.length && (ids.has(job.jobId) || counts.get(job.jobId) > 1
            || matches.some(row => canonical(row) !== canonical(job.nativeSourceRecord.posting)))
          if (changed) held.push({key: job.jobId, reason: 'complete closing native model changed'})
          return !changed
        })
      }
      need(!result.errors && result.data?.searchJobs?.results, 'native search result or error envelope changed')
      const page = result.data.searchJobs.results
      need(Number.isSafeInteger(page.totalCount) && page.totalCount >= 0 && page.totalCount <= 1000
        && Array.isArray(page.nodes) && page.nodes.length === Math.min(100, Math.max(0, page.totalCount - start)), 'native pagination total or page shape changed')
      if (expected === null) expected = page.totalCount
      need(page.totalCount === expected && page.pageInfo?.hasNextPage === (start + page.nodes.length < expected)
        && page.pageInfo.hasPreviousPage === (start > 0), 'native pagination context changed')
      for (const row of page.nodes) {need(text(row.key) && !ids.has(row.key), 'duplicate or absent native posting key'); ids.add(row.key); rows.push(row)}
      if (phase === 'opening') {openingRows = rows; audit.nativeRecords = rows.length; audit.openingPages++} else audit.closingPages++
      if (!page.pageInfo.hasNextPage) {need(rows.length === expected, 'native cohort incomplete'); return rows}
    }
    need(false, 'native page bound')
  }
  try {
    const corporate = corporateHandoff(await read(CAREERS)), board = boardContext(await read(BOARD))
    const programs = []
    for (const client of CLIENTS) {const program = await read(client.url); need(sha(program) === client.sha256, 'declared native client changed'); programs.push(program)}
    slugger = currentClientSlugger(programs[0])
    const opening = await inventory('opening')
    openingInventoryComplete = true
    const countries = nativePlaceCountries(opening)
    for (const row of opening) {
      try {const job = nativeRole(row, countries, slugger, clock); if (!job.excluded) jobs.push(job)}
      catch (error) {held.push({key: row.key, reason: error.message})}
    }
    const closing = await inventory('closing'), ending = new Map(closing.map(row => [row.key, row])), endCountries = nativePlaceCountries(closing)
    const stableJobs = []
    for (const job of jobs) {
      const row = ending.get(job.jobId)
      try {
        need(row && canonical(job.nativeSourceRecord.posting) === canonical(row), 'complete closing native model changed')
        const current = nativeRole(row, endCountries, slugger, clock)
        need(!current.excluded && canonical(job.locations) === canonical(current.locations), 'closing native workplace country context changed')
        stableJobs.push(job)
      } catch (error) {held.push({key: job.jobId, reason: error.message})}
    }
    jobs = stableJobs
    for (const client of CLIENTS) need(sha(await read(client.url)) === client.sha256, 'closing declared client changed')
    need(canonical(boardContext(await read(BOARD))) === canonical(board), 'closing native publisher/configuration changed')
    need(canonical(corporateHandoff(await read(CAREERS))) === canonical(corporate), 'closing corporate handoff changed')
    for (const job of jobs) Object.assign(job, {sourceDetailComplete: true, sourceDetailStatus: 'complete', nativeRoleClosingReconciled: true})
    audit.nativeRoleClosingReconciled = jobs.length
    await settings.onAudit?.({...audit, receipts})
    settings.signal?.throwIfAborted()
    return finish(jobs.slice(0, cap))
  } catch (error) {
    settings.signal?.throwIfAborted()
    gaps.push({stage: 'native-full-model-read', status: error.status ?? null, message: error.message})
    if (!openingInventoryComplete && !jobs.length && openingRows.length && slugger) {
      const places = nativePlaceCountries(openingRows)
      for (const row of openingRows) {
        try {const fact = nativeRole(row, places, slugger, clock, {allowUnresolvedSecondary: true}); if (!fact.excluded) jobs.push(fact)}
        catch { /* Missing own employer/country/content never becomes a partial role. */ }
      }
    }
    if (jobs.length) return finish(jobs.slice(0, cap))
    Object.assign(error, {source: SOURCE, failureKind: 'incomplete_listing', abortRetries: true, recruitmentObservations: audit,
      inventoryEvidence: {status: 'coverage-gap', surface: BOARD, firstParty: true, listingComplete: false,
        reportedTotal: null, indiaFacetCount: null, pagesFetched: receipts.length, verifiedAt: clock, reason: error.message}})
    throw error
  } finally {clearTimeout(deadline)}
}})
