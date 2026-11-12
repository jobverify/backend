import { createHash } from 'node:crypto'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'
import { readNativeWithSignal } from '../../scraper-support/utils/nativePagination.js'

export const AMAZON_NATIVE_PAGE_SIZE = 100
export const AMAZON_SEARCH_PAGE_URL = 'https://www.amazon.jobs/en/search?normalized_country_code%5B%5D=IND'

const hash = value => createHash('sha256').update(value).digest('hex')
const text = value => typeof value === 'string' && value.trim().length > 0
const content = value => typeof value === 'string' && hasSourceDescription({ jobDescription: value })
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))

// These are the complete fields returned beside description_short in the
// first-party public search response. Preferred qualifications are optional;
// the genuine HVH posting explicitly returns null for that field.
export const hasAmazonNativeBody = record => content(record?.description)
  && content(record?.basic_qualifications) && Object.hasOwn(record, 'preferred_qualifications')
  && (record.preferred_qualifications === null || typeof record.preferred_qualifications === 'string')

export const hasAmazonNativeIdentity = record => {
  if (!text(record?.id) || !text(record?.id_icims) || !text(record?.title) || !text(record?.company_name)) return false
  try {
    const path = new URL(record.job_path, 'https://www.amazon.jobs')
    const apply = new URL(record.url_next_step)
    if (path.origin !== 'https://www.amazon.jobs' || path.username || path.password || path.search || path.hash
      || !path.pathname.startsWith('/en/jobs/' + encodeURIComponent(record.id_icims) + '/')) return false
    if (apply.protocol !== 'https:' || apply.username || apply.password || apply.hash) return false
    if (['https://account.amazon.jobs', 'https://account.amazon.com'].includes(apply.origin)) {
      return apply.pathname === '/jobs/' + encodeURIComponent(record.id_icims) + '/apply'
    }
    return apply.origin === 'https://hvr-amazon.my.site.com' && record.source_system === 'HVH'
      && apply.pathname === '/JobDetails' && apply.searchParams.get('reqid') === record.id && apply.searchParams.get('isapply') === '1'
  } catch { return false }
}

export const hasAmazonIndiaGeography = record => {
  if (record?.country_code !== 'IND' || !text(record.normalized_location) || !/(?:^|,\s*)IND$/.test(record.normalized_location)
    || !text(record.location) || !/^IN,\s*/.test(record.location) || !Array.isArray(record.locations) || !record.locations.length) return false
  return record.locations.every(value => {
    try {
      const location = typeof value === 'string' ? JSON.parse(value) : null
      return location?.normalizedCountryCode === 'IND' && location.countryIso3a === 'IND' && location.countryIso2a === 'IN'
        && location.normalizedCountryName === 'India' && text(location.normalizedLocation) && /(?:^|,\s*)IND$/.test(location.normalizedLocation)
        && text(location.location) && /^IN,\s*/.test(location.location)
    } catch { return false }
  })
}

export const matchesAmazonPublicQuery = (payload, { offset, limit }) => {
  if (!payload || payload.error != null || !Number.isSafeInteger(payload.hits) || payload.hits < 0 || !Array.isArray(payload.jobs)) return false
  try {
    const envelope = JSON.parse(payload.job_posting_search_request)
    if (!exactKeys(envelope, ['jobPostingSearchRequest'])) return false
    const request = envelope.jobPostingSearchRequest
    if (!exactKeys(request, ['query', 'excludeFacets', 'filterFacets', 'start', 'size', 'sort', 'location', 'accessLevel',
      'includeFacets', 'locationFacets', 'jobTypeFacets', 'contentFilterFacets', 'treatment'])
      || request.query !== null || request.location !== null || request.accessLevel !== 'EXTERNAL'
      || Number(request.start) !== offset || Number(request.size) !== limit
      || request.sort?.sortOrder !== 'DESCENDING' || request.sort?.sortType !== 'SCORE'
      || ['includeFacets', 'locationFacets', 'jobTypeFacets', 'contentFilterFacets'].some(key => !Array.isArray(request[key]) || request[key].length)) return false
    const facets = entries => entries.map(entry => ({ name: entry.name, values: entry.values.map(value => value.name) }))
    const filter = facets(request.filterFacets)
    const excludes = facets(request.excludeFacets).sort((a, b) => a.name.localeCompare(b.name))
    return JSON.stringify(filter) === JSON.stringify([{ name: 'normalizedCountryCode', values: ['IND'] }])
      && JSON.stringify(excludes) === JSON.stringify([
        { name: 'businessCategory', values: ['a-confidential-job'] },
        { name: 'isPostedExternally', values: ['0'] },
        { name: 'isUnsearchable', values: ['1'] },
      ])
  } catch { return false }
}

const searchClientUrl = html => {
  if (typeof html !== 'string' || !/<title>\s*Job search\s*\|\s*Amazon\.jobs\s*<\/title>/i.test(html)
    || !/<meta\b[^>]*property=["']og:site_name["'][^>]*content=["']Amazon\.jobs["']/i.test(html)) return null
  const observed = html.match(/<meta\b[^>]*property=["']og:url["'][^>]*content=["']([^"']+)["']/i)?.[1]?.replaceAll('&amp;', '&')
  if (observed !== AMAZON_SEARCH_PAGE_URL) return null
  const scripts = [...html.matchAll(/<script\b[^>]*src=["']([^"']+)["']/gi)]
    .map(match => { try { return new URL(match[1], 'https://www.amazon.jobs') } catch { return null } })
    .filter(url => url && /\/assets\/bundles\/search\/index-[a-f0-9]+\.js$/.test(url.pathname))
  return scripts.length === 1 && scripts[0].origin === 'https://static.amazon.jobs'
    && !scripts[0].username && !scripts[0].password && !scripts[0].search && !scripts[0].hash ? scripts[0].toString() : null
}

const matchesSearchClient = client => typeof client === 'string'
  && client.includes('axios.get("/"+I18n.locale+CXT.SEARCH.RELATIVE_URL+"/search.json?"+')
  && client.includes('key:"buildPageInfoUrl"') && client.includes('&result_limit=')
  && client.includes('normalized_country_code_facet') && client.includes('basic_qualifications:React.PropTypes.string.isRequired')
  && client.includes('preferred_qualifications:React.PropTypes.string') && client.includes('description_short:React.PropTypes.string')

const materialFields = ['id', 'id_icims', 'title', 'company_name', 'job_path', 'url_next_step', 'country_code', 'location',
  'normalized_location', 'locations', 'city', 'state', 'description', 'basic_qualifications', 'preferred_qualifications',
  'posted_date', 'job_schedule_type', 'job_category', 'source_system']
const materialFingerprint = rows => hash(JSON.stringify(rows.map(row => [row.id_icims, materialFields.map(key => row[key])])
  .sort((a, b) => a[0].localeCompare(b[0]))))
const fullyKnown = row => hasAmazonNativeIdentity(row) && hasAmazonIndiaGeography(row) && hasAmazonNativeBody(row)

// Pagination alone intentionally remains unverified in the shared helper.
// This source separately binds the external India query to its live public
// client, checks the actual terminal boundary, and rereads every material role.
export const verifyAmazonNativeInventory = async ({ pages, pageSize, fetchJson, fetchText, buildSearchApiUrl, signal }) => {
  const incomplete = reason => ({ complete: false, reason })
  const first = pages[0]?.payload
  if (!pages.length || !Number.isSafeInteger(first?.hits) || first.hits < 0) return incomplete('amazon-native-total-unknown')
  const rows = pages.flatMap(page => page.payload.jobs || [])
  const total = first.hits
  if (rows.length !== total || new Set(rows.map(row => row.id_icims)).size !== total
    || !rows.every(fullyKnown) || pages.some(page => page.payload.hits !== total || !matchesAmazonPublicQuery(page.payload, { offset: page.offset, limit: pageSize }))) {
    return incomplete('amazon-native-identity-country-content-or-query-unverified')
  }
  const readJson = offset => readNativeWithSignal(() => fetchJson(buildSearchApiUrl({ offset, resultLimit: pageSize }), { signal }), signal)
  const readText = url => readNativeWithSignal(() => fetchText(url, { signal }), signal)
  try {
    const shell = await readText(AMAZON_SEARCH_PAGE_URL)
    const clientUrl = searchClientUrl(shell)
    if (!clientUrl) return incomplete('amazon-official-search-binding-unverified')
    const client = await readText(clientUrl)
    if (!matchesSearchClient(client)) return incomplete('amazon-current-search-client-contract-unverified')
    const boundary = await readJson(total)
    if (!matchesAmazonPublicQuery(boundary, { offset: total, limit: pageSize }) || boundary.hits !== total || boundary.jobs.length) return incomplete('amazon-native-boundary-unreconciled')
    const closingRows = []
    let closingPages = 0
    do {
      const offset = closingRows.length
      const page = await readJson(offset)
      closingPages++
      if (!matchesAmazonPublicQuery(page, { offset, limit: pageSize }) || page.hits !== total
        || !page.jobs.every(fullyKnown) || (!page.jobs.length && total > 0)
        || page.jobs.length > pageSize || closingRows.length + page.jobs.length > total) return incomplete('amazon-closing-query-or-inventory-changed')
      closingRows.push(...page.jobs)
    } while (closingRows.length < total)
    const openingFingerprint = materialFingerprint(rows)
    const closingFingerprint = materialFingerprint(closingRows)
    if (new Set(closingRows.map(row => row.id_icims)).size !== total || openingFingerprint !== closingFingerprint) return incomplete('amazon-closing-role-content-or-identity-changed')
    const closingBoundary = await readJson(total)
    if (!matchesAmazonPublicQuery(closingBoundary, { offset: total, limit: pageSize }) || closingBoundary.hits !== total || closingBoundary.jobs.length) return incomplete('amazon-closing-boundary-unreconciled')
    const closingShell = await readText(AMAZON_SEARCH_PAGE_URL)
    if (searchClientUrl(closingShell) !== clientUrl || hash(await readText(clientUrl)) !== hash(client)) return incomplete('amazon-closing-public-client-changed')
    return { complete: true, reason: 'amazon-current-public-india-inventory-and-full-native-criteria-reconciled',
      schema: 'amazon-native-inventory-v1', searchPage: AMAZON_SEARCH_PAGE_URL, clientUrl, clientSHA256: hash(client),
      reportedTotal: total, observedUnique: total, openingPages: pages.length, closingPages, terminalChecks: 2,
      openingFingerprint, closingFingerprint, sourceScope: 'all-external-searchable-amazon-jobs-with-native-country-IND',
      nativeFullCriteriaCount: total, verifiedAt: new Date().toISOString() }
  } catch (error) {
    signal?.throwIfAborted()
    return incomplete('amazon-public-scope-check-unavailable:' + (error?.status || error?.name || 'upstream'))
  }
}
