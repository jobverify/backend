import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { parse } from 'acorn'
import { activeHead, activeScripts, extractActiveDescription, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { disposeResponseBody } from '../../scraper-support/shared/responseBodyDisposal.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36'

const DEFAULT_CALLBACK_NAME = 'jobverifyAllstateCallback'
const DEFAULT_SORT_FIELD = 'open_date'
const DEFAULT_SORT_ORDER = 'descending'
const DEFAULT_PAGE_SIZE = 10

export const SOURCE = 'allstate'
export const COMPANY = 'Allstate'
export const JOBS_SEARCH_URL = 'https://www.allstate.jobs/job-search-results/'
export const JOBS_API_URL = 'https://jobsapi-internal.m-cloud.io/api/job'
export const DEFAULT_ORGANIZATION_ID = '2030'
export const DEFAULT_FILTERS = [
  'ats_portalid:Workday-MuleAPI-External',
  'is_internal:allstate_careers',
]
export const INDIA_FACET = 'compliment:India'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&#8217;|&#x27;/gi, "'")

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const parseJson = (value) => {
  if (!value) return null

  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const readNativeResponse = async (response, url, signal) => {
  signal?.throwIfAborted()
  if (response.status !== 200 || response.url !== new URL(url).href) {
    await disposeResponseBody(response, {signal, bestEffort:true})
    signal?.throwIfAborted()
    throw Object.assign(new Error(`Allstate native response identity changed: HTTP ${response.status} for ${url}`), {
      status:response.status, abortRetries:true, lifecycleCleanupAllowed:false, sourceScopeComplete:false,
    })
  }
  const html = await response.text()
  signal?.throwIfAborted()
  return html
}

const defaultFetchText = async (url, {signal} = {}) => {
  const response = await fetch(url, {
    signal,
    redirect: 'error',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return readNativeResponse(response, url, signal)
}

const defaultFetchJsonpText = async (url, {signal} = {}) => {
  const response = await fetch(url, {
    signal,
    redirect: 'error',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/javascript,text/javascript,*/*;q=0.9',
    },
  })

  return readNativeResponse(response, url, signal)
}

const normalizeCountry = (record = {}) => {
  const compliment = normalizeWhitespace(record.compliment)
  if (compliment) return compliment

  const countryCode = normalizeWhitespace(record.primary_country)
  if (countryCode?.toUpperCase() === 'IN') return 'India'

  return countryCode || null
}

const normalizeLocation = (record = {}) => {
  const parts = [
    normalizeWhitespace(record.primary_city),
    normalizeWhitespace(record.primary_state),
    normalizeCountry(record),
  ].filter(Boolean)

  return parts.join(', ') || null
}

const extractExperienceRequired = (description) => {
  const text = stripTags(description)
  if (!text) return null

  const matched = text.match(
    /\b(Minimum\s+\d+\s+years?\s+of\s+experience|\d+\s+or\s+more\s+years?\s+of\s+experience)\b/i,
  )

  return matched ? normalizeWhitespace(matched[1]) : null
}

const extractMinimumQualification = (description) => {
  const text = decodeHtmlEntities(String(description ?? ''))
  if (!text) return null

  const matched = text.match(/\b(Bachelor'?s degree[^<\n\r.]*)/i)
  return matched ? normalizeWhitespace(matched[1]) : null
}

const need = (condition, message) => { if (!condition) throw new Error(`Allstate ${message}`) }
const API_BASE = 'https://jobsapi-internal.m-cloud.io/api/'
// Each observed declaration plan is exact, including all script attributes,
// order and complete inline bodies. The four ready programs stay unchanged.
const SEARCH_PROGRAM_GRAPHS = ['searchPrograms20261116.json','searchPrograms20261128.json']
  .map(name => JSON.parse(readFileSync(new URL(name,import.meta.url),'utf8')))
// Four complete original ready registrations bind the two public widgets and
// their CWS-presence/widget guards. Calls in an uncalled wrapper or an edited
// control-flow plan cannot qualify merely because they appear somewhere in AST.
const SEARCH_PROGRAMS = [
  '1e32206037ad9a99919cca0a040b8a5c98f2b3353d8b29aab498bd278a18d9a7',
  '03a9f85a0035c2b2c7447421d21b860a92a6a33877b509ac51f166240c950521',
  'f54ef74d47718c9bf58544f6adab8860155feafcccd964a373cdfe20c893b816',
  '6e3041a35e9c4a7e3133aad60aa71ea22419621b44f25aed0d50ee24412505ff',
]
const publishedObjects = (scripts, name) => {
  const values = []
  for (const script of scripts.filter(s => new RegExp(`\\bvar\\s+${name}\\s*=`).test(s))) {
    let tree
    try { tree = parse(script, {ecmaVersion: 'latest'}) } catch { throw new Error(`Allstate ${name} publication program changed`) }
    for (const statement of tree.body.filter(n => n.type === 'VariableDeclaration')) {
      for (const declaration of statement.declarations.filter(n => n.id.type === 'Identifier' && n.id.name === name)) {
        const value = declaration.init?.type === 'ObjectExpression' ? parseJson(script.slice(declaration.init.start, declaration.init.end)) : null
        need(value && typeof value === 'object' && !Array.isArray(value), `${name} literal native model changed`)
        values.push(value)
      }
    }
  }
  return values
}
const walk = (node, visit) => {
  if (!node || typeof node !== 'object') return
  if (typeof node.type === 'string') visit(node)
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) for (const child of value) walk(child, visit)
    else if (value && typeof value === 'object') walk(value, visit)
  }
}
const isJobsCall = (node, method) => node.type === 'CallExpression'
  && node.callee.type === 'MemberExpression' && !node.callee.computed && node.callee.property.name === method
  && node.callee.object.type === 'MemberExpression' && !node.callee.object.computed
  && node.callee.object.object.name === 'CWS' && node.callee.object.property.name === 'jobs'

export const extractSearchConfiguration = (html = '') => {
  const doc = readNativeDocument(html), scriptNodes = []
  const visit = node => {
    if (typeof node === 'string' || ['template','noscript'].includes(node.tag)) return
    if (node.tag === 'script') { scriptNodes.push(node); return }
    for (const child of node.children) visit(child)
  }
  for (const root of doc.nodes(node => node.tag === 'root')) visit(root)
  // Include the complete declared script plan, even visually hidden scripts.
  // An extra computed setter, changed activation attribute or additional client
  // cannot override the pinned ready callbacks while escaping a dot-call regex.
  const declaredPlan = scriptNodes.map(node => ({attrs:node.attrs,
    bodySHA256:createHash('sha256').update(node.raw || '').digest('hex')}))
  need(SEARCH_PROGRAM_GRAPHS.some(graph => isDeepStrictEqual(declaredPlan,graph)),
  'public search program execution binding changed')
  const scripts = scriptNodes.filter(node => !node.attrs.src && !Object.hasOwn(node.attrs,'nomodule')
    && /^(?:|(?:text|application)\/(?:java|ecma)script)$/i.test(node.attrs.type || '')).map(node => node.raw || '')
  need(isDeepStrictEqual([...new Set(activeHead(html).titles)], ['Allstate Job Search | Jobs Near Me & Remote | Allstate Careers']), 'public job-search title changed')
  need(doc.nodes(n => /^h[1-6]$/.test(n.tag) && doc.text(n) === 'Open Jobs').length > 0
    && doc.nodes(n => n.tag === 'input' && n.attrs.name === 'compliment' && n.attrs.value === 'India' && n.attrs['data-facet'] === 'compliment').length === 1,
  'active India search surface changed')
  const options = publishedObjects(scripts, 'cws_opts')
  need(options.length === 1 && options[0].org === DEFAULT_ORGANIZATION_ID && options[0].api === API_BASE, 'declared employer/API binding changed')
  let apiCalls = 0, orgBindings = 0, facetBindings = 0, limit = DEFAULT_PAGE_SIZE
  const programs = scripts.filter(s => /CWS\.jobs\.(?:set_api|set_options)\s*\(/.test(s))
  need(isDeepStrictEqual(programs.map(script => createHash('sha256').update(script).digest('hex')), SEARCH_PROGRAMS),
    'public search configuration execution binding changed')
  for (const script of programs) {
    let tree
    try { tree = parse(script, {ecmaVersion: 'latest'}) } catch { throw new Error('Allstate public search configuration program changed') }
    walk(tree, node => {
      if (isJobsCall(node, 'set_api')) {
        need(node.arguments.length === 1 && node.arguments[0].type === 'Literal'
          && normalizeWhitespace(node.arguments[0].value) === API_BASE, 'active jobs API binding changed')
        apiCalls++
      }
      if (isJobsCall(node, 'set_options')) {
        const object = node.arguments[0]
        need(node.arguments.length === 1 && object?.type === 'ObjectExpression', 'active search options changed')
        for (const prop of object.properties) {
          need(prop.type === 'Property' && !prop.computed && prop.kind === 'init', 'dynamic search options are unqualified')
          const key = prop.key.name ?? prop.key.value, value = prop.value
          if (key === 'org_id') { need(value.type === 'Literal' && value.value === DEFAULT_ORGANIZATION_ID, 'active employer binding changed'); orgBindings++ }
          if (key === 'filters') {
            need(value.type === 'ArrayExpression' && value.elements.every(n => n?.type === 'Literal')
              && isDeepStrictEqual(value.elements.map(n => n.value), DEFAULT_FILTERS), 'active Workday facets changed')
            facetBindings++
          }
          if (key === 'limit') { need(value.type === 'Literal' && Number.isSafeInteger(value.value) && value.value > 0, 'declared page size changed'); limit = value.value }
        }
      }
    })
  }
  need(apiCalls > 0 && orgBindings > 0 && facetBindings > 0, 'active public API handoff missing')
  return {apiBaseUrl: API_BASE, organizationId: DEFAULT_ORGANIZATION_ID, filters: [...DEFAULT_FILTERS], limit}
}

export const hasVerifiedSearchPageSignal = (html = '') => {
  try { extractSearchConfiguration(html); return true } catch { return false }
}

export const buildJobsApiUrl = ({
  apiBaseUrl = 'https://jobsapi-internal.m-cloud.io/api/',
  organizationId = DEFAULT_ORGANIZATION_ID,
  filters = [...DEFAULT_FILTERS, INDIA_FACET],
  limit = DEFAULT_PAGE_SIZE,
  offset = 1,
  sortField = DEFAULT_SORT_FIELD,
  sortOrder = DEFAULT_SORT_ORDER,
  callbackName = DEFAULT_CALLBACK_NAME,
} = {}) => {
  const url = new URL('job', apiBaseUrl)
  url.searchParams.append('Organization', String(organizationId))
  url.searchParams.append('Limit', String(limit))
  url.searchParams.append('offset', String(offset))
  url.searchParams.append('sortfield', sortField)
  url.searchParams.append('sortorder', sortOrder)

  for (const filter of filters) {
    url.searchParams.append('facet', filter)
  }

  url.searchParams.append('callback', callbackName)
  return url.toString()
}

export const extractJsonpPayload = (value = '', callbackName = null) => {
  const matched = String(value ?? '').match(/^([\w$.]+)\(([\s\S]*)\)\s*;?\s*$/)
  if (!matched) {
    throw new Error('Allstate jobs API returned an unexpected JSONP payload')
  }
  need(callbackName == null || matched[1] === callbackName, 'jobs API callback changed')
  const payload = parseJson(matched[2])
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Allstate jobs API returned an unreadable JSONP payload')
  }

  return payload
}

const mapJob = (record = {}, now = () => new Date().toISOString()) => ({
  title: normalizeWhitespace(record.title),
  company: COMPANY,
  department: normalizeWhitespace(record.primary_category || record.brand),
  location: normalizeLocation(record),
  city: normalizeWhitespace(record.primary_city),
  country: normalizeCountry(record),
  countryCode: record.primary_country,
  jobId: normalizeWhitespace(record.ref || record.clientid),
  requisitionId: normalizeWhitespace(record.ref || record.clientid),
  link: normalizeWhitespace(record.seo_url || record.url),
  applyUrl: normalizeWhitespace(record.seo_url || record.url),
  sourceUrl: normalizeWhitespace(record.url || record.seo_url),
  source: SOURCE,
  employmentType: normalizeWhitespace(record.employment_type),
  experienceRequired: extractExperienceRequired(record.description),
  publicExperienceChecked: true,
  jobDescription: stripTags(record.description),
  sourceDescription: record.description,
  sourceDescriptionFormat: 'HTML',
  sourceNativeDetailPayload: structuredClone(record),
  fullNativeAuthoredRecordAvailable: true,
  fullNativeAuthoredCriteriaAvailable: true,
  nativeCriteriaComplete: true,
  sourceDetailComplete: true,
  // The employer declares this fixed external Workday feed. Other Allstate
  // entities and recruiting channels are outside that observed contract.
  sourceScopeComplete: false,
  companyInventoryComplete: false,
  lifecycleCleanupAllowed: false,
  minimumQualification: extractMinimumQualification(record.description),
  preferredQualification: null,
  requiredSkills: [],
  postingDate: normalizeWhitespace(record.open_date),
  scrapedAt: now(),
})

const validateRecord = (record, {allowBlankApplication = false} = {}) => {
  need(record && typeof record === 'object' && !Array.isArray(record), 'native row is malformed')
  need(record.company_name === COMPANY && record.scout_orgid === Number(DEFAULT_ORGANIZATION_ID)
    && record.ats_portalid === 'Workday-MuleAPI-External' && record.is_internal === 'allstate_careers', 'native employer/facet binding changed')
  need(record.primary_country === 'IN' && record.compliment === 'India', 'native India country fields are missing or contradictory')
  need(record.entity_status === 'Open' && record.publish_to_cws === 'true' && record.is_posted === 'true' && record.hidden === 'false', 'native publication status is unqualified')
  need(Number.isSafeInteger(record.id) && record.id > 0 && typeof record.ref === 'string' && /^R\d+$/.test(record.ref)
    && record.clientid === record.ref && typeof record.title === 'string' && normalizeWhitespace(record.title), 'native posting identity/title is unqualified')
  need(typeof record.description === 'string' && extractActiveDescription(record.description), 'full native description is missing')
  let detail, apply
  try { detail = new URL(record.url) } catch { throw new Error('Allstate native posting URLs are malformed') }
  need(detail.origin === 'https://www.allstate.jobs' && !detail.username && !detail.password && !detail.search && !detail.hash
    && new RegExp(`^/job/${record.id}/[^/]+/$`).test(detail.pathname), 'native corporate posting URL identity changed')
  // An explicitly blank API application link is unresolved, even when an
  // independently cached detail still advertises a link. Preserve its native
  // observation and hold that row; never manufacture or carry forward a URL.
  if (allowBlankApplication && record.seo_url === '') return false
  try { apply = new URL(record.seo_url) } catch { throw new Error('Allstate native posting URLs are malformed') }
  need(apply.origin === 'https://allstate.wd5.myworkdayjobs.com' && !apply.username && !apply.password && !apply.search && !apply.hash
    && /^\/allstate_careers\/job\/[^/]+\/[^/]+\/apply$/.test(apply.pathname)
    && new RegExp(`_${record.ref}(?:-\\d+)?/apply$`).test(apply.pathname), 'native Workday application identity changed')
  return true
}

const verifyDetail = (html, record) => {
  const models = publishedObjects(activeScripts(html), 'current_job')
  need(models.length === 1, 'native detail model missing or ambiguous')
  const model = models[0]
  validateRecord(model)
  // The detail template changes date formatting and adds presentation fields;
  // identity, scope, and authored description must agree exactly with the API.
  for (const key of ['id','ref','clientid','title','company_name','scout_orgid','ats_portalid','is_internal','primary_country','compliment','url','seo_url','description']) {
    need(isDeepStrictEqual(model[key], record[key]), `native detail ${key} disagrees with inventory`)
  }
  const doc = readNativeDocument(html), descriptions = doc.nodes(n => doc.hasClass(n, 'ejd-desc')).map(n => doc.text(n))
  // WordPress's published typography filter converts spaced hyphens to dashes.
  // Compare every word of each visible description, preserving all criteria.
  const typography = text => text.replace(/[\u2013\u2014]/g, '-')
  const expected = typography(extractActiveDescription(record.description))
  need(descriptions.length > 0 && descriptions.every(text => typography(text) === expected), 'complete visible native detail criteria disagree with inventory')
}

const callerLimit = (value, fallback, name) => {
  const limit = value ?? fallback
  need(limit === Infinity || (Number.isSafeInteger(limit) && limit >= 0), `invalid caller ${name}`)
  return limit
}

export const createAllstateScraper = ({
  now = () => new Date().toISOString(),
  pageSize = DEFAULT_PAGE_SIZE,
  callbackName = DEFAULT_CALLBACK_NAME,
  maxPages = 1000,
  maxJobs = Infinity,
  signal: configuredSignal,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJsonpText = defaultFetchJsonpText,
    signal = configuredSignal,
    maxPages: runMaxPages = maxPages,
    maxJobs: runMaxJobs = maxJobs,
  } = {}) {
    const checkAbort = () => signal?.throwIfAborted()
    const read = async (fetcher, url) => {
      checkAbort()
      try { const text = await fetcher(url, {signal}); checkAbort(); return text }
      catch (error) { checkAbort(); throw error }
    }
    checkAbort()
    const pageCap = callerLimit(runMaxPages, 1000, 'maxPages'), jobCap = callerLimit(runMaxJobs, Infinity, 'maxJobs')
    need(Number.isSafeInteger(pageSize) && pageSize > 0 && pageSize <= 1000, 'invalid caller pageSize')
    need(typeof callbackName === 'string' && /^[A-Za-z_$][\w$]*$/.test(callbackName), 'invalid caller callback')
    let pagesFetched = 0, total = null, snapshotsMatch = false
    const heldNativeRecords = []
    const jobs = [], finish = (complete, reason, opening = [], closing = []) => {
      for (const job of jobs) job.sourceListingComplete = complete
      attachInventoryEvidence(jobs, {status: complete ? (total === 0 ? 'verified-empty' : 'complete-inventory') : 'coverage-gap',
        surface: JOBS_SEARCH_URL, firstParty: total !== null, listingComplete: complete, lifecycleCleanupAllowed: false,
        reportedTotal: total, indiaFacetCount: total, pagesFetched, verifiedAt: now(), reason})
      if (snapshotsMatch) attachSourceObservationEvidence(jobs, {source:SOURCE,recordKind:'vacancy-rows',
        observedRecordCount:opening.length,observedVacancyCount:opening.length,sourceScopeComplete:false})
      Object.defineProperty(jobs, 'nativeCollectionEvidence', {configurable: true, value: {
        source: SOURCE, configuredFeed: {organizationId: DEFAULT_ORGANIZATION_ID, api: JOBS_API_URL, facets: [...DEFAULT_FILTERS, INDIA_FACET]},
        ...(snapshotsMatch ? {recordKind:'vacancy-rows',observedRecordCount:opening.length,observedVacancyCount:opening.length} : {}),
        reportedTotal: total, openingRawRows: structuredClone(opening), closingRawRows: structuredClone(closing),
        closingRawRowsMatch: snapshotsMatch, heldNativeRecords: structuredClone(heldNativeRecords),
        sourceScopeComplete: false, companyInventoryComplete: false, lifecycleCleanupAllowed: false,
      }})
      return jobs
    }
    if (pageCap === 0 || jobCap === 0) return finish(false, 'caller-zero-cap-no-inventory-proof')
    const config = extractSearchConfiguration(await read(fetchText, JOBS_SEARCH_URL))
    const phase = async (opening) => {
      const rows = [], ids = new Set(), refs = new Set()
      let phaseTotal = null, page = 0
      do {
        if (page >= pageCap) return {rows, complete: false}
        const offset = page * pageSize + 1
        const url = buildJobsApiUrl({...config, filters: [...config.filters, INDIA_FACET], limit: pageSize, offset, callbackName})
        const payload = extractJsonpPayload(await read(fetchJsonpText, url), callbackName)
        pagesFetched++; page++
        need(Number.isSafeInteger(payload.totalHits) && payload.totalHits >= 0 && Array.isArray(payload.queryResult), 'native inventory count/rows malformed')
        if (phaseTotal === null) phaseTotal = payload.totalHits
        need(payload.totalHits === phaseTotal && (total === null || payload.totalHits === total), 'native inventory total changed')
        total = phaseTotal
        const expectedSize = Math.min(pageSize, Math.max(0, phaseTotal - offset + 1))
        need(payload.queryResult.length === expectedSize, 'native inventory page is truncated or oversized')
        for (const record of payload.queryResult) {
          const applicationQualified = validateRecord(record, {allowBlankApplication:true})
          need(!ids.has(record.id) && !refs.has(record.ref), 'native inventory repeats a posting identity')
          ids.add(record.id); refs.add(record.ref); rows.push(structuredClone(record))
          if (opening) {
            if (!applicationQualified) {
              heldNativeRecords.push({reason:'native-application-url-empty',nativeRecord:structuredClone(record),
                applicationQualified:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false})
              continue
            }
            if (jobs.length >= jobCap) return {rows, complete: false}
            verifyDetail(await read(fetchText, record.url), record)
            jobs.push(mapJob(record, now))
          }
        }
      } while (rows.length < phaseTotal)
      need(rows.length === phaseTotal, 'native unique row count disagrees with reported total')
      return {rows, complete: true}
    }
    const opening = await phase(true)
    if (!opening.complete) return finish(false, 'caller-cap-incomplete-configured-India-feed', opening.rows)
    const closingConfig = extractSearchConfiguration(await read(fetchText, JOBS_SEARCH_URL))
    need(isDeepStrictEqual(config, closingConfig), 'closing public search configuration changed')
    const closing = await phase(false)
    if (!closing.complete) return finish(false, 'caller-cap-incomplete-closing-configured-India-feed', opening.rows, closing.rows)
    // Compare every authored field, not only mapped jobs, count or IDs. Ordering
    // may vary for tied publisher sort values, so reconcile by native identity.
    const byId = rows => [...rows].sort((a,b) => a.id-b.id)
    need(isDeepStrictEqual(byId(opening.rows), byId(closing.rows)), 'closing full raw inventory rows changed')
    snapshotsMatch = true
    checkAbort()
    return finish(heldNativeRecords.length === 0, heldNativeRecords.length
      ? 'stable-configured-public-India-feed;native-application-url-empty-ids:'+heldNativeRecords.map(row=>row.nativeRecord.ref).join(',')+';company-scope-unqualified'
      : 'complete-stable-configured-public-India-Workday-feed;company-scope-unqualified', opening.rows, closing.rows)
  },
})

export const run = async (options = {}) => createAllstateScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
