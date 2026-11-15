import { createHash } from 'node:crypto'
import { parse } from 'acorn'
import { activeScripts } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const requireZero = (condition, message) => {
  if (!condition) throw new Error('Hitachi India current native zero: ' + message)
}

const nativeSearch = html => {
  requireZero(typeof html === 'string' && Buffer.byteLength(html) <= 2 * 1024 * 1024, 'native document unavailable or too large')
  const scripts = activeScripts(html).filter(script => script.includes('__PRELOAD_STATE__'))
  requireZero(scripts.length === 1, 'one active preload initializer is required')
  const script = scripts[0]
  let program
  try { program = parse(script, { ecmaVersion: 'latest' }) } catch { requireZero(false, 'native preload syntax changed') }
  let state = null, assignments = 0
  for (const statement of program.body) {
    const expression = statement.expression, target = expression?.left
    requireZero(statement.type === 'ExpressionStatement' && expression?.type === 'AssignmentExpression'
      && expression.operator === '=' && target?.type === 'MemberExpression' && !target.computed
      && target.object?.type === 'Identifier' && target.object.name === 'window'
      && target.property?.type === 'Identifier' && ['__PRELOAD_STATE__', '__BUILD__'].includes(target.property.name),
    'unreviewed preload code or state mutation')
    if (target.property.name === '__PRELOAD_STATE__') {
      requireZero(++assignments === 1, 'preload state was overwritten')
      try { state = JSON.parse(script.slice(expression.right.start, expression.right.end)) }
      catch { requireZero(false, 'preload state is not native JSON data') }
    } else requireZero(expression.right.type === 'Literal' && typeof expression.right.value === 'string', 'native build identity changed')
  }
  const search = state?.jobSearch, params = search?.params, filter = params?.filter
  requireZero(assignments === 1 && search && typeof search === 'object'
    && Number(params?.page_number) === 1
    && Array.isArray(filter?.brand) && filter.brand.length === 1 && filter.brand[0] === 'Hitachi India Pvt. Ltd'
    && Array.isArray(filter?.country) && filter.country.length === 1 && filter.country[0] === 'India'
    && Object.keys(filter).sort().join(',') === 'brand,country'
    && Object.keys(params).sort().join(',') === 'filter,page_number'
    && Number.isSafeInteger(search.totalJob) && search.totalJob >= 0 && Array.isArray(search.jobs),
  'native exact brand, country, page or total changed')
  return search
}

const requireLoadedZero = html => {
  const search = nativeSearch(html)
  requireZero(search.totalJob === 0 && search.jobs.length === 0 && search.isLoading === false
    && Array.isArray(search.similarJobs) && search.similarJobs.length === 0
    && ['error', 'errors', 'message'].every(key => search[key] == null || search[key] === ''
      || Array.isArray(search[key]) && search[key].length === 0)
    && search.success !== false, 'native search is not a loaded, successful, exact zero')
}

export async function confirmHitachiIndiaNativeZero({ jobs, responses, fetchText, now }) {
  if (jobs.length || responses.length !== 1) return jobs
  // Legal-entity filtering can remove foreign-employer rows from a nonzero
  // brand search. Only the publisher's own zero count can prove an empty feed.
  if (nativeSearch(responses[0].html).totalJob !== 0) return jobs
  requireLoadedZero(responses[0].html)
  const closing = await fetchText(responses[0].url)
  requireLoadedZero(closing)
  Object.defineProperty(jobs, 'nativeCollectionEvidence', { configurable: true, value: {
    source: 'hitachiindia', scope: 'current-first-party-exact-brand-and-India-search',
    nativeTotal: 0, nativeFilters: { brand: ['Hitachi India Pvt. Ltd'], country: ['India'] },
    sourceScopeComplete: false, lifecycleCleanupAllowed: false,
    snapshots: [responses[0].html, closing].map(html => ({
      url: responses[0].url, bodySHA256: createHash('sha256').update(html).digest('hex'),
      totalJob: 0, isLoading: false,
    })),
  } })
  return attachInventoryEvidence(jobs, { status: 'verified-empty', surface: responses[0].url,
    firstParty: true, listingComplete: true, pagesFetched: 2, reportedTotal: 0, indiaFacetCount: 0,
    verifiedAt: now(), lifecycleCleanupAllowed: false,
    reason: 'current-loaded-exact-brand-and-India-native-zero-rechecked;company-scope-and-cleanup-unverified' })
}
