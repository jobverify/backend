import { createHash } from 'node:crypto'
import { activeHead, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

export const CURRENT_JOBS_URL = 'https://careers.checkpoint.com/jobs'
const companyId = 'CheckPointSoftwareTechnologies2'
const careersUrl = 'https://www.checkpoint.com/careers/'
const insist = (condition, reason) => {
  if (!condition) throw Object.assign(new Error('Check Point current ' + reason), { abortRetries: true })
}
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const postingId = value => {
  try {
    const url = new URL(value)
    return url.origin === 'https://jobs.smartrecruiters.com' && !url.username && !url.password && !url.hash
      ? url.pathname.match(new RegExp('^/' + companyId + '/(\\d+)-[^/]+(?:/apply)?/?$'))?.[1] : null
  } catch { return null }
}

export function inspectCurrentCheckPointSearch(page) {
  const document = readNativeDocument(page.html)
  const scripts = document.nodes(node => node.tag === 'script' && !node.inert && node.attrs.id === '__NEXT_DATA__')
  if (!scripts.length) return null
  insist(scripts.length === 1 && scripts[0].attrs.type === 'application/json' && !scripts[0].attrs.src,
    'native Next.js data declaration changed')
  let data
  try { data = JSON.parse(scripts[0].raw) } catch { insist(false, 'native Next.js JSON is malformed') }
  const props = data?.props?.pageProps, result = props?.result, query = props?.queryState
  insist(page.status === 200 && page.url === CURRENT_JOBS_URL && data.page === '/jobs'
    && data.isFallback === false && typeof data.buildId === 'string' && data.buildId.length > 0
    && activeHead(page.html).titles[0] === 'Career Opportunities at Check Point Software'
    && props.siteOrigin === 'https://careers.checkpoint.com' && props.careersHomeUrl === careersUrl
    && props.__canonical === CURRENT_JOBS_URL && props.__noindex === false,
  'native page identity or canonical authority changed')
  insist(query?.q === '' && query.page === 0 && query.sortValue === 'MOST_RELEVANT'
    && query.filters && typeof query.filters === 'object' && !Array.isArray(query.filters)
    && Object.keys(query.filters).length === 0, 'native default search scope changed')
  const rows = result?.jobPostingsList, countries = result?.facetsList?.country_s
  insist(Number.isSafeInteger(result?.numberOfMatches) && result.numberOfMatches > 0
    && result.numberOfMatches <= 10000 && Array.isArray(rows)
    && rows.length === Math.min(result.numberOfMatches, 10)
    && result.numberOfPages === Math.ceil(result.numberOfMatches / 10)
    && Array.isArray(countries), 'native result count or pagination changed')
  const india = countries.filter(row => row.facetValue === 'India')
  insist(india.length === 1 && Number.isSafeInteger(india[0].count) && india[0].count >= 0
    && india[0].count <= result.numberOfMatches, 'native India country facet is unavailable')
  const ids = new Set()
  for (const row of rows) {
    const id = postingId(row.applyUrl)
    insist(typeof row.id === 'string' && /^\d{6,8}$/.test(row.id) && id?.endsWith(row.id)
      && typeof row.title === 'string' && row.title.trim() && typeof row.country === 'string'
      && row.country.trim() && row.isCareerPortal === 1 && typeof row.slug === 'string' && row.slug
      && !ids.has(row.id), 'native role/account identity changed')
    ids.add(row.id)
    const path = '/jobs/' + row.id + '/' + row.slug
    insist(document.nodes(node => node.tag === 'a' && !node.inert && node.attrs.href === path).length > 0,
      'native role link is missing or inert')
  }
  return { indiaCount: india[0].count, signature: digest({ total: result.numberOfMatches, india: india[0].count,
    rows: rows.map(row => [row.id, row.title, row.country, row.city, row.applyUrl, row.refNumber]) }) }
}

const inventorySignature = rows => digest(rows.map(row => [row.id, row.name, row.refNumber,
  row.company.identifier, row.location, row.typeOfEmployment, row.releasedDate]).sort((a, b) => a[0].localeCompare(b[0])))

export async function collectCurrentCheckPoint({ landingPage, searchPage, fetchPage, fetchJson,
  buildListingApiUrl, buildDetailApiUrl, mapJob, maxJobs, signal }) {
  const landing = readNativeDocument(landingPage.html)
  insist(landingPage.status === 200 && landingPage.url === careersUrl
    && activeHead(landingPage.html).titles[0] === 'Careers - Check Point Software'
    && landing.nodes(node => {
      if (node.tag !== 'a' || node.inert || !node.attrs.href) return false
      try { const url = new URL(node.attrs.href, careersUrl)
        return url.origin === 'https://careers.checkpoint.com' && url.pathname === '/index.php'
          && url.searchParams.get('m') === 'cpcareers' && url.searchParams.get('a') === 'search'
      } catch { return false }
    }).length > 0, 'corporate native account handoff changed')
  const native = inspectCurrentCheckPointSearch(searchPage)
  insist(native, 'native search declaration is missing')
  let pagesFetched = 2
  const readInventory = async () => {
    const rows = [], ids = new Set()
    do {
      signal?.throwIfAborted()
      const payload = await fetchJson(buildListingApiUrl(rows.length), { method: 'GET', signal })
      pagesFetched++
      insist(payload?.totalFound === native.indiaCount && payload.offset === rows.length && payload.limit === 100
        && Array.isArray(payload.content) && payload.content.length === Math.min(100, native.indiaCount - rows.length),
      'native/API India inventory count or pagination changed')
      for (const row of payload.content) {
        insist(typeof row.id === 'string' && /^\d+$/.test(row.id) && !ids.has(row.id)
          && typeof row.name === 'string' && row.name.trim() && row.company?.identifier === companyId
          && /^in$/i.test(row.location?.country || '') && row.visibility === 'PUBLIC',
        'API listing role, employer or country identity changed')
        ids.add(row.id)
        rows.push(row)
      }
    } while (rows.length < native.indiaCount)
    return rows
  }
  const opening = await readInventory(), jobs = []
  for (const row of opening) {
    signal?.throwIfAborted()
    const detail = await fetchJson(buildDetailApiUrl(row.id), { method: 'GET', signal })
    pagesFetched++
    insist(detail?.id === row.id && detail.name === row.name && detail.refNumber === row.refNumber
      && detail.company?.identifier === companyId && detail.active === true && detail.visibility === 'PUBLIC'
      && /^in$/i.test(detail.location?.country || '') && detail.location.city === row.location.city
      && postingId(detail.postingUrl) === row.id && postingId(detail.applyUrl) === row.id,
    'API detail identity, active status or country changed')
    const mapped = mapJob(row, detail)
    insist(mapped && mapped.jobDescription?.length >= 100, 'native full job description is unavailable')
    jobs.push({ ...mapped, sourceScopeComplete: false, lifecycleCleanupAllowed: false })
  }
  const closing = await readInventory()
  insist(inventorySignature(opening) === inventorySignature(closing), 'closing API inventory changed')
  const closingPage = await fetchPage(CURRENT_JOBS_URL)
  pagesFetched++
  const closingNative = inspectCurrentCheckPointSearch(closingPage)
  insist(closingNative?.signature === native.signature, 'closing native inventory changed')
  signal?.throwIfAborted()
  const capped = Number.isInteger(maxJobs) && maxJobs >= 0 && maxJobs < jobs.length
  const selected = capped ? jobs.slice(0, maxJobs) : jobs
  for (const job of selected) job.sourceListingComplete = !capped
  return attachInventoryEvidence(selected, {
    status: capped ? 'discovery-only' : jobs.length ? 'complete-inventory' : 'verified-empty',
    firstParty: true, listingComplete: !capped, surface: CURRENT_JOBS_URL, pagesFetched,
    reportedTotal: native.indiaCount, indiaFacetCount: native.indiaCount, verifiedAt: new Date().toISOString(),
    reason: capped ? 'checkpoint-current-native-india-inventory:source-job-limit'
      : 'checkpoint-current-next-native-account-country-facet-and-opening-closing-public-api-inventory',
  })
}
