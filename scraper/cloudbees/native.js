import { parse } from 'acorn'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { createFirstPartyHTMLScraper } from '../../scraper-support/shared/firstPartyHtmlJobs.js'
import { nativeDate, nativePostingJobs, requireNative } from '../../scraper-support/shared/nativeJobPosting.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

export const CAREERS = 'https://www.cloudbees.com/careers'
export const FEED = 'https://recruiting.paylocity.com/recruiting/v2/api/feed/jobs/982bc369-6352-4fa4-942d-7c76bfca29b4'
export const BOARD = 'https://recruiting.paylocity.com/recruiting/jobs/all/a432d829-f701-4cf3-9108-56ef703b2ac5'
const ACCOUNT = 'a432d829-f701-4cf3-9108-56ef703b2ac5'
const MODULE_ID = 23600
const one = (values, label) => { requireNative(values.length === 1, `CloudBees: missing or ambiguous ${label}`); return values[0] }
const normalized = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const contentKey = html => { const doc = document(html); return doc.text(doc.root).replace(/\s/g, '') }
const executable = node => node.tag === 'script' && !node.attrs.src && !Object.hasOwn(node.attrs, 'nomodule')
  && /^(?:|(?:text|application)\/javascript)$/.test(node.attrs.type || '')

function jsonLiteral(node) {
  if (node?.type === 'Literal' && !node.regex && (node.value === null || ['string', 'number', 'boolean'].includes(typeof node.value))) return node.value
  if (node?.type === 'ArrayExpression') return node.elements.map(jsonLiteral)
  requireNative(node?.type === 'ObjectExpression', 'CloudBees: nonliteral native preload')
  const entries = new Map()
  for (const property of node.properties) {
    requireNative(property.type === 'Property' && property.kind === 'init' && !property.computed
      && property.key.type === 'Literal' && typeof property.key.value === 'string'
      && !entries.has(property.key.value), 'CloudBees: ambiguous native JSON field')
    entries.set(property.key.value, jsonLiteral(property.value))
  }
  return Object.fromEntries(entries)
}

export function readPaylocityPageData(html) {
  const doc = document(html)
  const values = doc.nodes(executable).filter(node => /^\s*window\.pageData\s*=/.test(node.raw || '')).map(node => {
    const program = parse(node.raw, { ecmaVersion: 'latest' })
    const expression = one(program.body, 'native preload statement').expression
    requireNative(expression?.type === 'AssignmentExpression' && expression.operator === '=' && expression.left.type === 'MemberExpression'
      && !expression.left.computed && expression.left.object.name === 'window' && expression.left.property.name === 'pageData', 'CloudBees: native preload assignment changed')
    return jsonLiteral(expression.right)
  })
  return one(values, 'active native pageData')
}

export function verifyCloudBeesOfficial(html) {
  const doc = document(html)
  requireNative(doc.nodes(node => Object.hasOwn(node.attrs, 'data-job-list')).length === 1, 'CloudBees: active official jobs renderer missing')
  const scripts = doc.nodes(executable).filter(node => (node.raw || '').includes(FEED))
  const matches = scripts.filter(node => {
    const ast = parse(node.raw, { ecmaVersion: 'latest' })
    const constant = ast.body.filter(statement => statement.type === 'VariableDeclaration').flatMap(statement => statement.declarations)
      .filter(declaration => declaration.id.name === 'API_URL' && declaration.init?.type === 'Literal' && declaration.init.value === FEED)
    const fetcher = ast.body.find(statement => statement.type === 'FunctionDeclaration' && statement.id.name === 'fetchJobs' && statement.async)
    const init = fetcher?.body.body[0]?.declarations?.[0]?.init
    const listener = ast.body.find(statement => {
      const call = statement.expression
      return call?.type === 'CallExpression' && call.callee?.object?.name === 'document' && call.callee?.property?.name === 'addEventListener'
        && call.arguments[0]?.value === 'DOMContentLoaded' && call.arguments[1]?.async
        && call.arguments[1]?.body?.body?.some(block => block.type === 'TryStatement' && block.block.body.some(child =>
          child.type === 'VariableDeclaration' && child.declarations.some(declaration => declaration.init?.type === 'AwaitExpression'
            && declaration.init.argument?.callee?.name === 'fetchJobs')))
    })
    return constant.length === 1 && init?.type === 'AwaitExpression' && init.argument?.callee?.name === 'fetch'
      && init.argument.arguments.length === 1 && init.argument.arguments[0]?.name === 'API_URL' && listener
  })
  requireNative(matches.length === 1, 'CloudBees: current official native feed binding changed')
}

function publicURL(value, kind, id) {
  const url = new URL(value)
  requireNative(url.origin === 'https://recruiting.paylocity.com' && !url.username && !url.password && !url.port && !url.search && !url.hash,
    'CloudBees: foreign native public URL')
  const match = /^\/recruiting\/jobs\/(details|apply)\/(\d+)(?:\/(Cloud-Bees-Inc|CloudBees-Inc)\/[a-z0-9%._-]+)?\/?$/i.exec(url.pathname)
  requireNative(match && match[1].toLowerCase() === kind.toLowerCase() && match[2] === String(id), 'CloudBees: native public role identity mismatch')
  return url.href
}

function verifyBoard(html) {
  const data = readPaylocityPageData(html)
  requireNative(data.ModuleId === String(MODULE_ID) && data.ModuleTitle === 'CloudBees Inc' && data.ShowInternal === false
    && Array.isArray(data.Jobs) && data.Jobs.length > 0 && data.Jobs.length <= 500, 'CloudBees: native employer/public board mismatch')
  const records = new Map()
  for (const row of data.Jobs) {
    requireNative(Number.isSafeInteger(row.JobId) && row.JobId > 0 && !records.has(row.JobId) && normalized(row.JobTitle)
      && typeof row.IsInternal === 'boolean' && row.JobLocation?.ModuleId === MODULE_ID, 'CloudBees: invalid native board row')
    records.set(row.JobId, row)
  }
  return records
}

function parseFeed(body, board) {
  const payload = JSON.parse(body)
  requireNative(['Cloud Bees Inc', 'CloudBees Inc'].includes(payload?.displayName) && !payload.error && payload.success !== false
    && Array.isArray(payload.jobs) && payload.jobs.length === board.size, 'CloudBees: incomplete or mismatched native feed')
  const ids = new Set()
  const records = payload.jobs.map(record => {
    const row = board.get(record.jobId)
    requireNative(row && !ids.has(record.jobId) && record.companyName === 'CloudBees Inc' && record.title === row.JobTitle
      && typeof record.description === 'string' && (record.requirements == null || typeof record.requirements === 'string'), 'CloudBees: native feed/list identity mismatch')
    ids.add(record.jobId)
    publicURL(record.displayUrl, 'Details', record.jobId)
    publicURL(record.applyUrl, 'Apply', record.jobId)
    const listURL = new URL(record.listUrl)
    requireNative(listURL.origin === 'https://recruiting.paylocity.com' && !listURL.username && !listURL.password && !listURL.search && !listURL.hash
      && new RegExp(`^/recruiting/jobs/all/${ACCOUNT}(?:/(?:CloudBees-Inc|Cloud-Bees-Inc))?/?$`, 'i').test(listURL.pathname), 'CloudBees: native account listing URL mismatch')
    const date = nativeDate(record.publishedDate, { required: true })
    requireNative(date.iso === new Date(row.PublishedDate).toISOString(), 'CloudBees: native publication dates disagree')
    return { id: String(record.jobId), title: record.title, url: record.displayUrl, locations: [row.LocationName], countries: [row.JobLocation.Country],
      nativeFeed: record, nativeBoard: row }
  })
  return { records, observedRows: records.length, reportedTotal: null, pageNumber: 1, lastPage: 1, nextURL: null, terminationKnown: true,
    fingerprint: JSON.stringify([...records].sort((a, b) => a.id.localeCompare(b.id))) }
}

function parseDetail(html, row) {
  const doc = document(html), pageData = readPaylocityPageData(html), record = row.nativeFeed, board = row.nativeBoard
  requireNative(pageData.moduleName === 'CloudBees Inc' && pageData.jobTitle === row.title && board.IsInternal === false
    && board.JobLocation.Country === 'IND', 'CloudBees: public native detail identity or country changed')
  const publicTitle = one(doc.nodes(node => node.tag === 'meta' && node.attrs.property === 'og:title'), 'public native title').attrs.content
  const publicRoleURL = one(doc.nodes(node => node.tag === 'meta' && node.attrs.property === 'og:url'), 'public native role URL').attrs.content
  requireNative(publicTitle === `CloudBees Inc - ${row.title}` && publicURL(publicRoleURL, 'Details', row.id), 'CloudBees: public native role metadata mismatch')
  const title = row.title
  const city = normalized(board.JobLocation.City || board.JobLocation.Metro)
    || (board.LocationName === 'Hybrid - Chennai' ? 'Chennai' : null)
  requireNative(city === 'Chennai' && board.LocationName === 'Hybrid - Chennai', 'CloudBees: native India location scope unresolved')
  // Paylocity keeps the server-rendered preview hidden until browser hydration.
  // The employer's verified public feed supplies full content independently;
  // do not relabel hidden HTML as visible-page verification.
  const description = record.description, requirements = record.requirements || ''
  requireNative(contentKey(description).length >= 100 && (!requirements || contentKey(requirements).length >= 100), 'CloudBees: full native feed content unavailable')
  return { id: row.id, title, sourceURL: row.url, nativeListingRecord: row, nativeHiringOrganization: { name: record.companyName },
    nativeCountryAddresses: [{ raw: { addressLocality: city, addressRegion: board.JobLocation.State || null, addressCountry: 'IND' },
      country: 'India', nativeCountryRaw: 'IND' }], nativeApplicationURL: record.applyUrl, nativeDirectApplyFlag: null,
    nativePostedDate: nativeDate(record.publishedDate, { required: true }), nativeValidThrough: nativeDate(null),
    nativeVisibleDescriptionHTML: description + (requirements ? `<h3>Requirements</h3>${requirements}` : ''), nativeSchemaDescription: null,
    nativeDescriptionOrigin: 'employer-native-public-Paylocity-feed-description-and-requirements', visibleContentVerified: false,
    nativeCreatedUtc: record.createdUtc, nativeModuleId: MODULE_ID, nativeIsInternal: board.IsInternal, sourceScopeComplete: false }
}

export async function runNativeCloudBees(options = {}) {
  const signal = AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(120000)])
  signal.throwIfAborted()
  let board
  const config = { source: 'cloudbees', companyName: 'CloudBees', boardURL: FEED, maxRequests: 510, maxAggregateBytes: 32 * 1024 * 1024, detailConcurrency: 3,
    expectedContentType: url => url === FEED ? 'application/json' : 'text/html',
    validateURL(value) { if (![CAREERS, FEED, BOARD].includes(value)) { const url = new URL(value); publicURL(value, 'Details', url.pathname.split('/')[4]) } },
    sameReadIdentity: (left, right) => left === right,
    handoffs: [{ url: CAREERS, verify: verifyCloudBeesOfficial }, { url: BOARD, verify: html => { board = verifyBoard(html) } }],
    parseListing: body => parseFeed(body, board), candidateForIndia: row => row.nativeBoard.IsInternal === false && row.nativeBoard.JobLocation.Country === 'IND',
    parseDetail, pageFingerprint: page => page.fingerprint,
    projectJobs(result, settings) {
      const jobs = nativePostingJobs(result, settings)
      for (const job of jobs) {
        job.nativeFeedDescriptionHTML = job.nativeFacts.nativeListingRecord.nativeFeed.description
        job.nativeFeedRequirementsHTML = job.nativeFacts.nativeListingRecord.nativeFeed.requirements
        job.nativeDescriptionOrigin = job.nativeFacts.nativeDescriptionOrigin
        job.sourceDetailStatus = 'complete-native-feed-and-public-role-metadata'
        delete job.nativeVisibleDescriptionHTML
        delete job.nativeFacts.nativeVisibleDescriptionHTML
      }
      return jobs
    } }
  let jobs
  try { jobs = await createFirstPartyHTMLScraper(config).run({ ...options, signal }) }
  catch (error) { signal.throwIfAborted(); throw error }
  signal.throwIfAborted()
  const evidence = jobs[Symbol.for('jobverify.native-html-evidence')]
  return attachInventoryEvidence(jobs, { status: 'discovery-only', surface: CAREERS, firstParty: true, listingComplete: false,
    pagesFetched: evidence?.pagesFetched || 0, reportedTotal: null, indiaFacetCount: null, verifiedAt: new Date().toISOString(),
    reason: `official-native-Paylocity-feed-and-public-country-visibility-reconciled;observed-roles=${evidence?.observedListingCount ?? 'unknown'};returned-india-details=${jobs.length};whole-company-scope-unverified` })
}
