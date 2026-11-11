import { createHash } from 'node:crypto'
import { readNativeDocument, decodeNativeEntities } from '../../scraper-support/utils/activeNativeHtml.js'
import { normalizeNativeAttributeBoundaries } from '../../scraper-support/utils/nativeHtmlAttributes.js'
import { nativeCountryName, nativeLocationCountryName } from '../../scraper-support/shared/nativeJobPosting.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const CAREERS = 'https://calendly.com/careers'
const BOARD = 'https://job-boards.greenhouse.io/calendly'
const FEED = 'https://boards-api.greenhouse.io/v1/boards/calendly/jobs?content=true'
const EMPLOYER = 'Calendly'
// A complete zero needs the entire reviewed public program. These profiles
// cover active corporate content/declarations and executable data flow, never
// native job IDs, job counts, job criteria or original publication dates.
const PROGRAM = 'd657b7a0fd120d11d2213e52836a3939009b8177c74937975d529f282d6fc788'
const RENDERERS = {
  index: '2c45cec6136837b88a06f9e02a8a50a1b6483682cc70a41f70be72d6c1513d6b',
  island: '2684c70c9ce125b9442b468bef9fd13bd8ffc03714caabd4f69ed7d6f9567d7b',
  components: 'baf891cd6b629bf391919da14006f2c3033c21436158266757e8af295f58e4a0',
}
const sha = value => createHash('sha256').update(value).digest('hex')
const stable = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item)
const need = (condition, reason) => {
  if (!condition) throw Object.assign(Error('Calendly current Astro inventory: ' + reason), {
    softFailure: true, abortRetries: true, failureKind: 'coverage_gap',
  })
}
const one = (nodes, reason) => { need(nodes.length === 1, reason); return nodes[0] }
const documentOf = html => readNativeDocument(normalizeNativeAttributeBoundaries(html))
const rootOf = doc => one(doc.nodes(node => node.tag === 'root'), 'native document root changed')
const classNodes = (doc, name, parent) => doc.nodes(node => doc.hasClass(node, name), parent)
const safeURL = value => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash ? url : null
  } catch { return null }
}

function publisherProgram(html) {
  const doc = documentOf(html)
  const carriers = doc.nodes(node => ['astro-island', 'a', 'form', 'iframe', 'object', 'embed', 'script'].includes(node.tag)).map(node => {
    const attrs = { ...node.attrs }
    delete attrs.uid; delete attrs.prefix
    return { tag: node.tag, attrs, script: node.tag === 'script' ? sha(node.raw || '') : null }
  })
  const signature = { activeText: doc.text(rootOf(doc)), carriers }
  need(sha(stable(signature)) === PROGRAM, 'current active publisher recruitment program/declarations require review')
  const island = one(doc.nodes(node => node.tag === 'astro-island' && node.attrs['component-export'] === 'CareersHubIsland'),
    'current single active careers island declaration missing')
  const index = safeURL(new URL(island.attrs['component-url'], CAREERS).href)
  need(island.attrs.client === 'load' && index?.origin === new URL(CAREERS).origin
    && /^\/_astro\/index\.[a-z\d_-]+\.js$/i.test(index.pathname) && !index.search,
  'current publisher active careers renderer identity changed')
  return { signatureSHA256: PROGRAM, activeCarrierCount: carriers.length, island: { ...island.attrs }, indexURL: index.href }
}

function originalDate(value, label, now, publication = false) {
  if (value === null) return null
  const match = typeof value === 'string'
    && /^(\d{4}-\d{2}-\d{2})T((?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d)(?:\.\d{1,9})?(?:Z|[+-](?:(?:0\d|1[0-3]):[0-5]\d|14:00))$/.exec(value)
  need(match, 'invalid native original ' + label + ' date model')
  const wall = new Date(match[1] + 'T' + match[2] + '.000Z'), date = Date.parse(value)
  need(Number.isFinite(+wall) && wall.toISOString().slice(0, 19) === match[1] + 'T' + match[2]
    && Number.isFinite(date) && (!publication || date <= Date.parse(now)), 'invalid native original ' + label + ' calendar/publication date')
  return value
}

function countryFor(row) {
  need(row.location && Object.keys(row.location).length === 1 && Object.hasOwn(row.location, 'name')
    && typeof row.location.name === 'string' && row.location.name.trim()
    && Array.isArray(row.offices), 'native role location/country model changed')
  const explicitRemote = /^Remote - ([A-Z]{2})$/.exec(row.location.name)
  let country = nativeLocationCountryName(row.location.name) || (explicitRemote && nativeCountryName(explicitRemote[1])) || null
  const officeCountries = []
  for (const office of row.offices) {
    need(office && Object.keys(office).length === 5
      && ['id', 'name', 'location', 'child_ids', 'parent_id'].every(field => Object.hasOwn(office, field))
      && Number.isSafeInteger(office.id) && office.id > 0
      && Array.isArray(office.child_ids) && office.child_ids.length === 0 && office.parent_id === null
      && typeof office.name === 'string' && (office.location === null || typeof office.location === 'string'), 'native office country/hierarchy model changed')
    const explicit = nativeLocationCountryName(office.location)
    if (explicit) officeCountries.push(explicit)
    else need(office.location === null && office.name === 'Remote' && explicitRemote, 'additional native office country scope is unresolved')
  }
  if (!country && officeCountries.length && new Set(officeCountries).size === 1) country = officeCountries[0]
  need(country && officeCountries.every(value => value === country), 'unknown or contradictory native role/office country')
  need(country !== 'India', 'native India role requires a separately qualified positive path; zero withheld')
  return { country, primary: row.location.name, officeCountries }
}

const rowFields = ['absolute_url', 'data_compliance', 'internal_job_id', 'location', 'metadata', 'id', 'updated_at',
  'requisition_id', 'title', 'company_name', 'first_published', 'language', 'application_deadline', 'content',
  'departments', 'offices', 'ai_disclaimer', 'include_ai_disclaimer', 'ai_opt_out_request_url']
function inventory(payload, now) {
  need(payload && stable(Object.keys(payload).sort()) === stable(['jobs', 'meta']) && Array.isArray(payload.jobs)
    && payload.meta && Object.keys(payload.meta).length === 1 && Number.isSafeInteger(payload.meta.total)
    && payload.meta.total > 0 && payload.meta.total <= 20 && payload.meta.total === payload.jobs.length,
  'native complete inventory model/count/continuation requires review')
  const seen = new Set()
  for (const row of payload.jobs) {
    need(row && Object.keys(row).length === rowFields.length && rowFields.every(field => Object.hasOwn(row, field))
      && Number.isSafeInteger(row.id) && row.id > 0 && !seen.has(row.id), 'native inventory duplicate/invalid identity or new model')
    seen.add(row.id)
    const url = safeURL(row.absolute_url)
    need(row.company_name === EMPLOYER && typeof row.title === 'string' && row.title.trim()
      && url?.origin === new URL(BOARD).origin && url.pathname === '/calendly/jobs/' + row.id && !url.search,
    'native employer/company/role URL identity changed')
    need(typeof row.content === 'string' && row.content.length >= 100 && row.ai_disclaimer === null && row.include_ai_disclaimer === false,
      'native full criteria/description or additional disclaimer requires review')
    need(Array.isArray(row.metadata) && row.metadata.length === 1 && row.metadata[0]
      && Object.keys(row.metadata[0]).length === 4 && ['id', 'name', 'value', 'value_type'].every(field => Object.hasOwn(row.metadata[0], field))
      && row.metadata[0].name === 'Featured Job Post'
      && row.metadata[0].value_type === 'single_select' && ['True', 'False'].includes(row.metadata[0].value),
    'native metadata country/criteria model requires review')
    countryFor(row)
    originalDate(row.first_published, 'publication', now, true)
    originalDate(row.application_deadline, 'deadline', now)
    originalDate(row.updated_at, 'updated', now)
  }
  return stable(payload)
}

function boardInventory(html, payload) {
  const doc = documentOf(html)
  need(decodeNativeEntities(one(doc.nodes(node => node.tag === 'title'), 'native board title missing').raw) === 'Jobs at Calendly'
    && doc.nodes(node => node.tag === 'h1' && doc.text(node) === 'Current openings at Calendly').length === 1,
  'native board employer identity changed')
  need(doc.nodes(node => node.tag === 'a' && node.attrs.href === CAREERS).length === 1,
    'current native board reciprocal employer careers identity missing')
  const total = one(doc.nodes(node => /^h[1-6]$/.test(node.tag) && /^\d+ jobs?$/.test(doc.text(node))), 'native published total missing')
  need(Number(doc.text(total).split(' ')[0]) === payload.meta.total, 'native board published total disagrees with feed inventory')
  const rows = classNodes(doc, 'job-post'), cards = [], cardLinks = new Set()
  need(rows.length === payload.meta.total && rows.every(node => node.tag === 'tr'),
    'native board published card count/row model differs from complete inventory')
  for (const node of rows) {
    const link = one(doc.nodes(child => child.tag === 'a', node), 'native board card missing unique role link')
    const url = safeURL(link.attrs.href), id = url?.pathname.match(/^\/calendly\/jobs\/(\d+)$/)?.[1]
    const row = payload.jobs.find(row => row.id === Number(id)), fields = doc.nodes(child => child.tag === 'p', link)
    need(row && url.origin === new URL(BOARD).origin && !url.search && url.href === row.absolute_url,
      'native board card role identity differs from complete feed')
    need(fields.length === 2 && doc.hasClass(fields[0], 'body--medium') && doc.hasClass(fields[1], 'body__secondary')
      && doc.text(fields[0]) === row.title && doc.text(fields[1]) === row.location.name
      && doc.text(link) === row.title + ' ' + row.location.name && doc.text(node) === doc.text(link),
    'native board own-card title/country/location/metadata differs from original feed')
    cardLinks.add(link)
    cards.push({ id: row.id, title: doc.text(fields[0]), location: doc.text(fields[1]),
      country: countryFor(row).country, href: url.href, originalVisibleCardText: doc.text(node) })
  }
  for (const link of doc.nodes(node => node.tag === 'a' && node.attrs.href)) {
    need(cardLinks.has(link) || [CAREERS, 'https://www.greenhouse.com'].includes(link.attrs.href),
      'new native board recruitment program/link outside inventoried cards requires review')
  }
  const ids = cards.map(card => card.id)
  need(ids.length === payload.jobs.length && new Set(ids).size === ids.length
    && payload.jobs.every(row => ids.includes(row.id)), 'native board/feed complete role identity inventory disagrees')
  need(doc.nodes(node => ['iframe', 'form', 'object', 'embed'].includes(node.tag)).length === 0,
    'additional native board recruitment form/page scope requires review')
  need(doc.nodes(node => node.tag === 'button').every(node => ['Create alert', ''].includes(doc.text(node))),
    'native board pagination/program requires review')
  return { ids: ids.sort((left, right) => left - right), total: payload.meta.total, cards, sha256: sha(html) }
}

// Parse the publisher's JSON literal as data, never as executable JavaScript.
// JSON.parse alone accepts duplicate keys with last-wins semantics, so retain
// lexical object boundaries and reject any ambiguous original native fields.
function uniqueNativeJSON(source) {
  let value
  try { value = JSON.parse(source) } catch { need(false, 'native loader is not a JSON-only literal') }
  const stack = []
  for (let cursor = 0; cursor < source.length; cursor++) {
    const char = source[cursor]
    if (char === '{') stack.push(new Set())
    else if (char === '[') stack.push(null)
    else if (char === '}' || char === ']') stack.pop()
    else if (char === '"') {
      const start = cursor++
      while (cursor < source.length && source[cursor] !== '"') {
        if (source[cursor] === '\\') cursor++
        cursor++
      }
      let next = cursor + 1
      while (/\s/.test(source[next] || '') && next < source.length) next++
      if (source[next] === ':') {
        const keys = stack.at(-1), key = JSON.parse(source.slice(start, cursor + 1))
        need(keys instanceof Set && !keys.has(key), 'native loader contains duplicate JSON identity/data keys')
        keys.add(key)
      }
    }
  }
  return value
}

function nativeRoleIdentity(doc, row) {
  const script = one(doc.nodes(node => node.tag === 'script' && /\b__remixContext\b/.test(node.raw || '')),
    'native loader missing or duplicated active identity carrier')
  need(!Object.hasOwn(script.attrs, 'nomodule') && !Object.hasOwn(script.attrs, 'src')
    && (!script.attrs.type || /^(?:application|text)\/javascript$/i.test(script.attrs.type)),
    'native loader active JSON assignment carrier changed')
  const literal = /^\s*window\.__remixContext\s*=\s*(\{[\s\S]*\});\s*$/.exec(script.raw)
  need(literal, 'native loader requires the exact JSON-only assignment model')
  const model = uniqueNativeJSON(literal[1]), loader = model?.state?.loaderData
  const routeName = 'routes/$url_token_.jobs_.$job_post_id'
  need(loader && stable(Object.keys(loader).sort()) === stable(['root', routeName].sort()),
    'native loader account/role route identity model changed')
  const root = loader.root, route = loader[routeName], post = route?.jobPost, config = root?.boardConfiguration
  need(root && root.urlToken === 'calendly' && root.internal === false && root.preview === false
    && root.embedded === false && root.isJobPost === true
    && [row.absolute_url, row.absolute_url.replace('https:', 'http:')].includes(root.href),
  'native loader account/public role mode identity changed')
  need(route && route.urlToken === 'calendly' && route.jobPostId === String(row.id)
    && route.submitPath === 'https://boards.greenhouse.io/calendly/jobs/' + row.id
    && route.confirmationPath === '/calendly/jobs/' + row.id + '/confirmation'
    && post && post.post_type === 'job_post' && post.company_name === EMPLOYER && post.title === row.title
    && post.hiring_plan_id === row.internal_job_id && post.job_post_location === row.location.name
    && post.public_url === row.absolute_url && post.redirect_to === null,
  'native loader role/company/employer/public URL/submission identity changed')
  need(config && config.job_board_public_url === BOARD && config.header_text === 'Current openings at Calendly'
    && config.logo?.href === CAREERS && safeURL(config.logo.url)?.origin === 'https://s2-recruiting.cdn.greenhouse.io',
  'native loader reciprocal employer board/logo identity changed')
  const head = one(doc.nodes(node => node.tag === 'head'), 'native head identity missing or duplicated')
  const og = property => {
    const meta = one(doc.nodes(node => node.tag === 'meta' && node.attrs.property === property),
      'native Open Graph identity metadata missing or duplicated: ' + property)
    need(doc.nodes(node => node === meta, head).length === 1, 'native Open Graph identity metadata is outside the active head')
    return meta.attrs.content
  }
  need(og('og:title') === row.title && og('og:description') === row.location.name && og('og:url') === row.absolute_url
    && og('og:type') === 'article' && og('og:image') === config.logo.url,
  'native Open Graph role/employer/location/public URL identity changed')
  const logo = one(doc.nodes(node => node.tag === 'a' && doc.hasClass(node, 'logo')),
    'native reciprocal employer logo missing or duplicated')
  const image = one(doc.nodes(node => node.tag === 'img', logo), 'native reciprocal employer logo image changed')
  need(logo.attrs.href === CAREERS && image.attrs.alt === 'Calendly Logo' && image.attrs.src === config.logo.url,
    'native visible reciprocal employer logo identity changed')
  return { company: post.company_name, roleId: route.jobPostId, account: root.urlToken, publicURL: post.public_url,
    nativeSubmissionURL: route.submitPath, nativeRootHrefOriginal: root.href, publicJobMode: true,
    hiringPlanId: post.hiring_plan_id, hostedPublicationDateOriginal: post.published_at,
    nativeBoardURL: config.job_board_public_url, nativeLogoURL: config.logo.url,
    originalPublicJobPost: structuredClone(post) }
}

function qualifiedHeadTitle(html, doc, row) {
  const head = one(doc.nodes(node => node.tag === 'head'), 'native head title boundary missing or duplicated')
  const title = one(doc.nodes(node => node.tag === 'title', head), 'native head title missing or duplicated')
  need(one(doc.nodes(node => node.tag === 'title'), 'native title identity is ambiguous') === title,
    'native title is outside the active head')
  const text = decodeNativeEntities(title.raw), expected = 'Job Application for ' + row.title + ' at ' + EMPLOYER
  need(text === expected || title.raw === 'page_title', 'native full role head title/employer identity changed')
  const component = '<title>' + title.raw + '</title>', at = html.indexOf(component)
  const headAt = html.indexOf('<head>'), headEnd = html.indexOf('</head>')
  need(Object.keys(head.attrs).length === 0 && Object.keys(title.attrs).length === 0
    && headAt >= 0 && headAt === html.lastIndexOf('<head>') && headEnd === html.lastIndexOf('</head>')
    && at > headAt && at + component.length <= headEnd && at === html.lastIndexOf(component),
  'native original head title component is ambiguous or outside the exact head boundary')
  // Only this independently validated component differs in the actual captured
  // native variant. Every original byte is retained; all other bytes still
  // participate in the opening/closing comparison, including loader and OG data.
  return { publicHeadTitleVariant: title.raw === 'page_title' ? 'native-page-title-placeholder' : 'native-job-title',
    fullPublicRoleComparisonSHA256: sha(html.slice(0, at) + '<title>[qualified Calendly native job title]</title>' + html.slice(at + component.length)),
    comparisonPolicy: 'exact-original-document-except-independently-qualified-single-native-head-title-component' }
}

function fullRole(html, row, payload) {
  const doc = documentOf(html)
  const nativeRouteIdentity = nativeRoleIdentity(doc, row), headTitle = qualifiedHeadTitle(html, doc, row)
  need(doc.text(one(doc.nodes(node => node.tag === 'h1'), 'native role heading missing')) === row.title,
    'native full role heading identity changed')
  need(doc.text(one(classNodes(doc, 'job__location'), 'native full role location missing')) === row.location.name,
    'native full role country/location disagrees with original feed')
  const own = one(classNodes(doc, 'job__description'), 'native full own-role description boundary changed')
  const publicText = doc.text(own), api = documentOf(decodeNativeEntities(decodeNativeEntities(row.content)))
  const originalText = api.text(rootOf(api)), nativeRanges = classNodes(doc, 'pay-range', own), apiRanges = classNodes(api, 'pay-range')
  need(originalText.length >= 100 && !/\bindia\b/i.test(originalText), 'native full criteria contain unresolved India scope or missing description')
  need(nativeRanges.length === apiRanges.length && nativeRanges.length > 0 && nativeRanges.length <= 5,
    'native salary interval structure changed')
  const salaryIntervals = []
  for (let index = 0; index < apiRanges.length; index++) {
    const source = apiRanges[index], target = nativeRanges[index]
    const spans = api.nodes(node => node.tag === 'span', source), amounts = doc.nodes(node => node.tag === 'bdi', target).map(node => doc.text(node))
    const divider = one(classNodes(api, 'divider', source), 'native structured salary divider changed')
    need(spans.length === 3 && spans[1] === divider && api.text(divider) === '—' && amounts.length === 3
      && /^\$[\d,]+$/.test(amounts[0]) && /^\$[\d,]+$/.test(amounts[1]) && amounts[2] === 'USD'
      && api.text(spans[0]) === amounts[0] && api.text(spans[2]) === amounts[1] + ' ' + amounts[2]
      && doc.text(target) === 'Tier ' + (index + 1) + ' Salary Hiring Range ' + amounts[0] + ' - ' + amounts[1] + ' ' + amounts[2],
    'native structured salary interval endpoints/currency/label changed')
    salaryIntervals.push({ tier: index + 1, minimumOriginal: amounts[0], maximumOriginal: amounts[1], currencyOriginal: amounts[2],
      sourceSeparatorOriginal: '—', publicSeparatorOriginal: '-', endpointsAndCurrencyExact: true })
    // Compare a local parsed copy using only the publisher's explicit salary
    // divider component. Every other character, including punctuation, stays.
    divider.children = ['-']
  }
  need(classNodes(api, 'divider').length === apiRanges.length && api.text(rootOf(api)) === publicText,
    'full native own-role criteria/description disagrees outside reviewed structured salary intervals')
  const application = one(doc.nodes(node => node.tag === 'form' && node.attrs.id === 'application-form'), 'native current application action missing')
  need(application.attrs.method === 'get' && application.attrs.action === '/calendly/jobs/' + row.id
    && doc.nodes(node => node.tag === 'button' && doc.text(node) === 'Submit application', application).length === 1,
  'native current application role action changed')
  for (const link of doc.nodes(node => node.tag === 'a' && /\/calendly\/jobs\//.test(node.attrs.href || ''))) {
    const url = safeURL(new URL(link.attrs.href, row.absolute_url).href)
    need(url?.origin === new URL(BOARD).origin && payload.jobs.some(job => url.pathname === '/calendly/jobs/' + job.id),
      'native full role declares additional unenumerated role scope')
  }
  return { id: row.id, title: row.title, employer: row.company_name, legalEmployer: null, ...countryFor(row),
    sourceNativeRecord: structuredClone(row), sourceNativeDescriptionText: originalText, sourcePublicDescriptionText: publicText,
    sourcePublicRoleHtml: html, nativeRouteIdentity, ...headTitle, fullCriteriaOutsideStructuredPayRangesExact: true, salaryIntervals,
    originalPublicationDate: row.first_published, nativeUpdatedAtOriginal: row.updated_at,
    nativeDeadlineOriginal: row.application_deadline, currentApplicationAction: true, fullPublicRoleSHA256: sha(html) }
}

export async function runCurrentCalendlyAstro({ fetchImpl = globalThis.fetch, signal,
  now = () => new Date().toISOString(), onAudit } = {}) {
  signal?.throwIfAborted()
  const checkedAt = now(), receipts = []
  need(Number.isFinite(Date.parse(checkedAt)), 'invalid observation timestamp')
  const deadline = signal ? AbortSignal.any([signal, AbortSignal.timeout(120000)]) : AbortSignal.timeout(120000)
  const read = async (url, kind = 'html', closing = false) => {
    deadline.throwIfAborted(); need(receipts.length < 52, 'finite current source request budget reached')
    const response = await fetchImpl(url, { method: 'GET', credentials: 'omit', redirect: 'error', cache: 'no-store',
      signal: AbortSignal.any([deadline, AbortSignal.timeout(20000)]), headers: {
        Accept: kind === 'json' ? 'application/json' : kind === 'js' ? 'application/javascript' : 'text/html',
        'User-Agent': 'Mozilla/5.0 (compatible; Jobverify current careers inventory check)',
      } })
    deadline.throwIfAborted()
    if (response.status !== 200) throw Object.assign(Error('Calendly current native HTTP ' + response.status), {
      status: response.status, softFailure: true, abortRetries: true,
      failureKind: [401, 403, 429, 451].includes(response.status) ? 'blocked_or_access_denied' : 'coverage_gap',
    })
    need(response.url === url, 'native public response identity changed')
    const contentType = response.headers.get('content-type') || ''
    need((kind === 'json' ? /^(?:application|text)\/json\b/i : kind === 'js'
      ? /^(?:application|text)\/(?:java|ecma|x-java)script\b/i : /^text\/html\b/i).test(contentType), 'native public content type changed')
    need(Number(response.headers.get('content-length') || 0) <= 4000000, 'native response byte budget reached')
    const reader = response.body.getReader(), chunks = []; let length = 0
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      length += chunk.value.byteLength
      if (length > 4000000) { await reader.cancel(); need(false, 'native response byte budget reached') }
      chunks.push(Buffer.from(chunk.value))
    }
    deadline.throwIfAborted()
    const body = Buffer.concat(chunks).toString('utf8')
    receipts.push({ url, phase: closing ? 'closing' : 'opening', status: response.status, contentType, bytes: length, sha256: sha(body) })
    if (kind !== 'json') return body
    try { return JSON.parse(body) } catch { need(false, 'invalid native JSON inventory') }
  }
  const publisher = publisherProgram(await read(CAREERS)), scripts = []
  const readRenderer = async (url, kind) => {
    const body = await read(url, 'js')
    need(sha(body) === RENDERERS[kind], 'current declared renderer/client requires review')
    scripts.push({ url, kind, sha256: sha(body) }); return body
  }
  const index = await readRenderer(publisher.indexURL, 'index')
  const imports = [...index.matchAll(/from"(\.\/islands\.[a-z\d_-]+\.js)"/gi)]
  need(imports.length === 1 && index.includes('u as Y') && index.includes('Y as CareersHubIsland'), 'current declared renderer export data flow changed')
  const islandURL = new URL(imports[0][1], publisher.indexURL).href, island = await readRenderer(islandURL, 'island')
  need(island.includes('Vn=`' + FEED + '`') && island.includes('return t.jobs') && island.includes('ai=I(Yn)')
    && island.includes('ai as u'), 'current native renderer account/feed data flow changed')
  const componentImports = [...island.matchAll(/from"(\.\/src\.[a-z\d_-]+\.js)"/gi)]
  need(componentImports.length === 1, 'current declared full careers renderer dependency changed')
  await readRenderer(new URL(componentImports[0][1], islandURL).href, 'components')
  const opening = await read(FEED, 'json'), snapshot = inventory(opening, checkedAt)
  const board = boardInventory(await read(BOARD), opening), roles = []
  for (const row of opening.jobs) roles.push(fullRole(await read(row.absolute_url), row, opening))
  for (const role of roles) {
    const row = opening.jobs.find(row => row.id === role.id), closing = fullRole(await read(row.absolute_url, 'html', true), row, opening)
    need(closing.fullPublicRoleComparisonSHA256 === role.fullPublicRoleComparisonSHA256, 'closing full native role criteria/identity changed outside qualified head title')
    role.closingFullRoleUnchanged = closing.fullPublicRoleSHA256 === role.fullPublicRoleSHA256
    role.closingFullRoleCriteriaAndIdentityUnchanged = true
    role.closingPublicHeadTitleVariant = closing.publicHeadTitleVariant
    role.sourcePublicClosingRoleHtml = closing.sourcePublicRoleHtml
    role.sourcePublicClosingRoleSHA256 = closing.fullPublicRoleSHA256
  }
  need(inventory(await read(FEED, 'json', true), checkedAt) === snapshot, 'closing complete native inventory changed')
  need(stable(boardInventory(await read(BOARD, 'html', true), opening)) === stable(board), 'closing complete native board inventory changed')
  need(stable(publisherProgram(await read(CAREERS, 'html', true))) === stable(publisher), 'closing current publisher program changed')
  for (const script of scripts) need(sha(await read(script.url, 'js', true)) === script.sha256, 'closing current declared renderer changed')
  deadline.throwIfAborted()
  const jobs = [], audit = { source: 'calendly', checkedAt, receipts, publisher, scripts,
    nativeFeedURL: FEED, nativeBoardURL: BOARD, nativeReportedTotal: opening.meta.total, observedNativeRecordCount: opening.jobs.length,
    roles, nativeBoardInventory: board, indiaRoleCount: 0, currentDeclaredSourceProgramComplete: true, companyGlobalScopeQualified: false,
    sourceScope: 'registered-current-public-careers-program-and-reciprocal-native-board', lifecycleCleanupAllowed: false,
    fullClosingPublisherRenderersBoardFeedAndEveryRoleReconciled: true }
  Object.defineProperty(jobs, 'nativeCollectionEvidence', { value: audit, configurable: true })
  attachSourceObservationEvidence(jobs, { source: 'calendly', recordKind: 'vacancy-rows', observedRecordCount: opening.jobs.length,
    observedVacancyCount: opening.jobs.length, sourceScopeComplete: true, companyGlobalTotal: null, companyIndiaTotal: null })
  if (onAudit) await onAudit(structuredClone(audit))
  deadline.throwIfAborted()
  return attachInventoryEvidence(jobs, { status: 'complete-inventory', surface: FEED, firstParty: true,
    listingComplete: true, lifecycleCleanupAllowed: false, pagesFetched: receipts.length,
    reportedTotal: opening.meta.total, indiaFacetCount: 0, verifiedAt: checkedAt,
    reason: 'Complete current declared corporate Astro careers program, exact reviewed native feed, reciprocal complete board and every full foreign role reconciled at opening/closing. Native employer and explicit countries qualify India zero for this finite public source; company-global inventory and lifecycle cleanup remain unqualified.' })
}
