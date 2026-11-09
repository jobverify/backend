import { activeIframeSources, readNativeDocument, extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { CANONICAL_CITIES } from '../../scraper-support/utils/cities.js'

export const CAREERS = 'https://www.atscale.com/careers/'
export const EMBED = 'https://ats.rippling.com/embed/atscale/jobs?s=https%3A%2F%2Fwww.atscale.com%2Fcareers%2F'
export const BOARD = 'https://ats.rippling.com/atscale/jobs'
const WIDGET = 'https://static-assets.ripplingcdn.com/ats/embeds/job-board.v1.js'
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/
const NON_COUNTRY_REGIONS = new Set(['ZZ', 'EU', 'EZ', 'UN', 'XA', 'XB', 'QO'])
const norm = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const need = (ok, message) => { if (!ok) throw new Error(`AtScale native ${message}`) }
const canonical = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v)
const same = (a, b) => canonical(a) === canonical(b)
const plain = value => value && typeof value === 'object' && !Array.isArray(value)
const noError = value => {
  need(plain(value), 'upstream envelope is missing')
  for (const [key, v] of Object.entries(value)) {
    const semantic = key.toLowerCase().replace(/[_\s-]/g, '')
    if (/^(?:error|errors|errormessage|errormessages|errorcode|exception|fault)$/.test(semantic))
      need(v == null || v === '' || v === false || v === 0 || Array.isArray(v) && !v.length, 'upstream error envelope')
    if (/^(?:success|ok)$/.test(semantic)) need(v === true, 'upstream failure envelope')
    if (/^(?:status|statuscode)$/.test(semantic)) need(v === 200 || ['success', 'open', 'published', 'active'].includes(v), 'upstream status envelope')
  }
}
const board = b => {
  noError(b)
  need(b?.boardType === 'RIPPLING' && b.slug === 'atscale' && b.title === 'AtScale' && b.companyName === 'AtScale, Inc.'
    && b.boardURL === BOARD && b.isTest === false && b.groupJobsByLocation === true, 'board/employer/test identity changed')
}

export function parseOfficialAtScale(html) {
  const d = readNativeDocument(html), frames = activeIframeSources(html), widgets = d.nodes(n => n.attrs.id === 'rr-job-board')
  need(d.nodes(n => /^h[1-3]$/.test(n.tag) && d.text(n) === 'Careers at AtScale').length === 1
    && frames.length === 1 && frames[0] === EMBED && widgets.length === 1 && widgets[0].attrs['data-job-board-id'] === 'atscale'
    && !Object.keys(widgets[0].attrs).some(k => /^data-(?:country|locale|filter)/.test(k))
    && d.nodes(n => n.tag === 'script' && n.attrs.src === WIDGET).length === 1, 'current active official global board delegation changed')
  need(!d.nodes(n => n.tag === 'script' && !n.attrs.src).some(n => /RR_BASE_URL\s*=/.test(n.raw || '')), 'official board origin override is unresolved')
  for (const a of d.nodes(n => n.tag === 'a' && n.attrs.href)) {
    let target; try { target = new URL(a.attrs.href, CAREERS) } catch { continue }
    const hiring = /career|jobs?|positions?|open.*roles?|hiring|vacanc|recruit|apply/i.test(d.text(a) + ' ' + target.pathname)
    if (!hiring || !['https:', 'http:'].includes(target.protocol)) continue
    need(target.origin === new URL(CAREERS).origin && target.pathname === '/careers/' && !target.search,
      'competing official hiring surface requires inventory scope review')
  }
  return { embedUrl: EMBED }
}

const payload = (html, page, id) => {
  const d = readNativeDocument(html), scripts = d.nodes(n => n.tag === 'script' && n.attrs.id === '__NEXT_DATA__')
  need(scripts.length === 1 && scripts[0].attrs.type === 'application/json' && !scripts[0].attrs.src, 'one active native JSON document is required')
  let data; try { data = JSON.parse(scripts[0].raw) } catch { need(false, 'native JSON is malformed') }
  noError(data); noError(data.props?.pageProps); noError(data.props.pageProps.apiData)
  need(data.page === page && same(data.query, id ? { jobBoardSlug: 'atscale', jobId: id } : { s: CAREERS, jobBoardSlug: 'atscale' })
    && data.locale === 'en-US' && data.isFallback === false, 'native route/query/locale identity changed')
  const p = data.props.pageProps, a = p.apiData
  board(a.jobBoard)
  return { d, data, p, a }
}

const nativeOffice = place => {
  need(plain(place) && norm(place.name) && norm(place.country) && /^[A-Z]{2}$/.test(place.countryCode || '')
    && (place.city == null || typeof place.city === 'string')
    && ['ON_SITE', 'HYBRID', 'REMOTE'].includes(place.workplaceType), 'typed role country/office is missing')
  const country = new Intl.DisplayNames(['en'], { type: 'region' }).of(place.countryCode)
  need(!NON_COUNTRY_REGIONS.has(place.countryCode) && country !== place.countryCode && country === place.country,
    'typed country is unknown, aggregate, pseudo or contradicts its name/code')
  if (place.countryCode === 'IN') {
    const city = norm(place.city)
    need(city ? Object.hasOwn(CANONICAL_CITIES, city.toLowerCase()) && [city, `${city}, India`].includes(place.name)
      : ['India', 'Remote, India', 'Remote (India)'].includes(place.name), 'typed India country conflicts with its role-assigned city/office label')
  } else need(!/\bIndia\b/i.test(place.name + ' ' + place.state)
    && !Object.hasOwn(CANONICAL_CITIES, norm(place.city).toLowerCase()), 'typed foreign country contradicts an India office')
  return place.countryCode === 'IN'
}

export function parseAtScaleListing(html) {
  const { d, data, p, a } = payload(html, '/embed/[jobBoardSlug]/jobs')
  need(data.query.s === CAREERS && a.jobBoardSlug === 'atscale' && same(a.filtersConfig, { workLocations: [], departments: [] }), 'native embed scope/filter changed')
  const queries = p.dehydratedState?.queries
  need(Array.isArray(queries), 'native queries are missing')
  const found = queries.filter(q => q.queryKey?.[2] === 'job-posts')
  need(found.length === 1 && same(found[0].queryKey, ['board', 'atscale', 'job-posts', true,
    { searchQuery: '', departments: [], workplaceType: null, country: '', state: '', city: '', page: 0, pageSize: 20 }])
    && found[0].state?.status === 'success' && found[0].state.error == null, 'native unfiltered listing query changed or failed')
  const value = found[0].state.data; noError(value)
  need(same(Object.keys(value).sort(), ['items', 'page', 'pageSize', 'totalItems', 'totalPages'].sort())
    && value.page === 0 && value.pageSize === 20 && value.totalPages === 1 && Number.isSafeInteger(value.totalItems)
    && value.totalItems >= 0 && value.totalItems <= 20 && Array.isArray(value.items) && value.items.length === value.totalItems,
  'native one-page inventory total/pagination does not reconcile')
  const ids = new Set(), records = value.items.map(raw => {
    noError(raw)
    for (const k of ['closed', 'isClosed', 'archived', 'isArchived', 'isInternal', 'isDeleted', 'unlistedFromSearch'])
      if (raw[k] != null) need(raw[k] === false, 'native listing includes a closed/internal/unlisted role')
    for (const k of ['published', 'isPublished', 'active', 'isActive', 'isPublic', 'visible', 'isVisible'])
      if (raw[k] != null) need(raw[k] === true, 'native listing is explicitly inactive/unpublished/private')
    need(UUID.test(raw.id || '') && !ids.has(raw.id) && norm(raw.name) && !/[<>]/.test(raw.name)
      && raw.url === `${BOARD}/${raw.id}` && raw.language === 'en-US' && norm(raw.department?.name)
      && Array.isArray(raw.locations) && raw.locations.length > 0, 'native listing identity is missing, repeated or conflicts')
    ids.add(raw.id)
    const offices = raw.locations.map(nativeOffice)
    need(new Set(raw.locations.map(canonical)).size === raw.locations.length, 'native listing repeats a role office')
    return { id: raw.id, url: `https://ats.rippling.com/en-US/atscale/jobs/${raw.id}`, raw, india: offices.some(Boolean) }
  })
  const rendered = [...new Set(d.nodes(n => n.tag === 'a' && /^https:\/\/ats\.rippling\.com\/en-US\/atscale\/jobs\//.test(n.attrs.href || '')).map(n => n.attrs.href))].sort()
  need(same(rendered, records.map(r => r.url).sort()), 'native visible role inventory differs from JSON')
  for (const row of records) need(d.nodes(n => n.tag === 'a' && n.attrs.href === row.url).some(n => d.text(n) === norm(row.raw.name)), 'native visible role title differs from JSON')
  return { pageNumber: 1, lastPage: 1, reportedTotal: value.totalItems, observedRows: value.items.length, records,
    nextURL: null, terminationKnown: true, fingerprint: canonical(value.items.slice().sort((a, b) => a.id.localeCompare(b.id))) }
}

function creationDate(value, now) {
  const match = typeof value === 'string' && /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value)
  need(match && Number.isFinite(Date.parse(value)) && Date.parse(value) <= Date.parse(now)
    && Number(match[2]) < 24 && Number(match[3]) < 60 && Number(match[4]) < 60 && Number(match[5] || 0) < 24 && Number(match[6] || 0) < 60
    && new Date(`${match[1]}T00:00:00Z`).toISOString().slice(0, 10) === match[1], 'native creation metadata is malformed or future')
}

export function validateAtScaleDetail(html, row, { now }) {
  const { d, a } = payload(html, '/[jobBoardSlug]/jobs/[jobId]', row.id), j = a.jobPost
  noError(j); board(j.board)
  need(j.uuid === row.id && j.name === row.raw.name && j.url === row.raw.url && j.companyName === 'AtScale, Inc.'
    && j.unlistedFromSearch === false && j.jsonLd == null, 'native role/employer/listed identity changed')
  for (const k of ['closed', 'isClosed', 'archived', 'isArchived', 'isInternal', 'isDeleted']) if (j[k] != null) need(j[k] === false, 'native role is closed or internal')
  for (const k of ['published', 'isPublished', 'active', 'isActive']) if (j[k] != null) need(j[k] === true, 'native role is not open/published')
  for (const k of ['datePosted', 'postedAt', 'publishedAt', 'publishedOn', 'postingDate', 'publicationDate', 'validThrough', 'closingDate', 'deadline', 'endDate'])
    need(j[k] == null && row.raw[k] == null, 'native publication/closing contract changed; creation is not publication')
  creationDate(j.createdOn, now)
  const names = row.raw.locations.map(l => l.name)
  need(same(j.workLocations, names) && same(a.workLocations, names), 'native detail assigned offices conflict with listing')
  for (const k of ['country', 'countryCode', 'country_code']) if (j[k] != null) need(row.raw.locations.every(l => j[k] === l[k === 'country' ? 'country' : 'countryCode']), 'native detail country conflicts')
  need(j.department?.base_department === row.raw.department.name && norm(j.department.name) && same(a.department, j.department), 'native detail department conflicts')
  const canonicalLinks = d.nodes(n => n.tag === 'link' && n.attrs.rel === 'canonical')
  need(canonicalLinks.length === 1 && canonicalLinks[0].attrs.href === j.url
    && d.nodes(n => /^h[12]$/.test(n.tag)).some(n => d.text(n) === norm(j.name)), 'native rendered title/canonical conflicts')
  const apply = d.nodes(n => n.tag === 'button' && n.attrs['data-testid'] === 'Apply now'), fields = j.activeJobApplication?.basicQuestions
  need(apply.length > 0 && apply.every(n => n.attrs['data-disabled'] === 'false' && !Object.hasOwn(n.attrs, 'disabled') && n.attrs['aria-disabled'] !== 'true')
    && Array.isArray(fields) && ['first_name', 'last_name', 'email', 'resume'].every(oid => fields.some(f => f.oid === oid && f.required === true
      && f.fieldType === (oid === 'resume' ? 'FILE' : 'SHORT_ANSWER'))), 'native public apply action/configuration is missing or disabled')
  need(typeof j.description?.company === 'string' && typeof j.description.role === 'string', 'native full description sections are missing')
  const full = j.description.company + '\n' + j.description.role, role = extractActiveDescription(j.description.role)
  need(role && role.length >= 100 && role !== extractActiveDescription(j.description.company)
    && !/\b(?:this (?:role|job|position) is (?:closed|no longer available)|no longer accepting applications)\b/i.test(role), 'native substantive original role JD is missing or closed')
  const preview = d.nodes(n => (n.attrs.class || '').split(/\s+/).includes('ATS_htmlPreview'))
  need(preview.length === 1 && d.text(preview[0]) === extractActiveDescription(full), 'native visible JD differs from complete original sections')
  return { job: j, full, rawLocations: row.raw.locations }
}

export function parseAtScaleDetail(html, row, { now }) {
  const { job: j, full } = validateAtScaleDetail(html, row, { now })
  const offices = row.raw.locations.filter(l => l.countryCode === 'IN'), cities = [...new Set(offices.map(l => l.city ?? null))]
  need(offices.length > 0, 'native role has no assigned India office')
  return { source: 'atscale', company: 'AtScale', title: norm(j.name), jobId: j.uuid, requisitionId: null,
    country: 'India', city: cities.length === 1 ? cities[0] : null, state: offices.length === 1 ? offices[0].state : null,
    location: offices.map(l => l.name).join(' / '), locations: offices.map(l => l.name), department: j.department.name,
    sourceUrl: j.url, applyUrl: j.url, link: j.url, employmentType: j.employmentType?.id ?? null,
    jobDescription: full, sourceDescription: full, jobDescriptionHtml: full, sourceNativeDescriptionSections: { ...j.description },
    postingDate: null, postedAt: null, closingDate: null, sourcePostingDateKnown: false, sourceNativeCreatedOn: j.createdOn,
    sourceNativeEmployer: j.companyName, sourceNativeLocations: row.raw.locations, sourceDetailComplete: true,
    sourceNativeStatusEvidence: { unlistedFromSearch: j.unlistedFromSearch, enabledApplyAction: true, nativeApplicationConfig: true },
    companyDomain: 'atscale.com', companyCareerPage: CAREERS, atsPlatform: 'rippling', scrapedAt: now }
}

export const validateAtScaleURL = value => need(value === CAREERS || value === EMBED
  || /^https:\/\/ats\.rippling\.com\/en-US\/atscale\/jobs\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value), 'request leaves configured company/board/role')
