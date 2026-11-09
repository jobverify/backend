import { document as readDocument, decode } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { nativeDate } from '../../scraper-support/shared/nativeJobPosting.js'

const document = html => {
  const p = readDocument(html)
  for (const node of p.nodes(n => /(?:^|;)\s*content-visibility\s*:\s*hidden\s*(?:!important\s*)?(?:;|$)/i.test((n.attrs.style || '').replace(/\/\*[\s\S]*?\*\//g, '')))) node.inactive = true
  return p
}
const narrative = node => !node || node.inactive || ['script', 'style', 'strong', 'b', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(node.tag) ? '' : node.children.map(c => typeof c === 'string' ? decode(c) : narrative(c)).join(' ').replace(/\s+/g, ' ').trim()

export const PROFILE_URL = 'https://www.linkedin.com/company/letstransport/'
export const LISTING_URL = 'https://www.linkedin.com/jobs/letstransport-jobs-worldwide?f_C=6472988&trk=top-card_top-card-primary-button-top-card-primary-cta'
const fail = reason => { throw new Error(`LetsTransport native publisher: ${reason}`) }
const one = (nodes, reason) => nodes.length === 1 ? nodes[0] : fail(reason)
const urls = value => { try { return new URL(value) } catch { return fail('invalid URL') } }
const linkedin = url => url.protocol === 'https:' && ['www.linkedin.com', 'in.linkedin.com'].includes(url.hostname) && !url.port && !url.username && !url.password && !url.hash
export const exactEmployer = value => {
  const url = urls(value)
  return linkedin(url) && /^\/company\/letstransport\/?$/.test(url.pathname)
}
const roleUrl = (value, id) => {
  const url = urls(value)
  if (!linkedin(url) || !new RegExp(`^/jobs/view/[^/]+-${id}$`).test(url.pathname)) fail('role URL identity changed')
  url.search = ''
  return url.href
}

export function extractNativeCards(html) {
  const page = document(html), text = page.text(page.root)
  const count = page.text(one(page.nodes(n => page.hasClass(n, 'results-context-header__job-count')), 'missing inventory count'))
  if (!/^\d+$/.test(count) || +count < 1 || +count > 100 || !text.includes("You've viewed all jobs for this search")) fail('unproven complete displayed inventory')
  if (page.text(one(page.nodes(n => page.hasClass(n, 'results-context-header__query-search')), 'missing employer search')) !== 'Letstransport Jobs in Worldwide') fail('employer search changed')
  const list = one(page.nodes(n => n.tag === 'ul' && page.hasClass(n, 'jobs-search__results-list')), 'missing native inventory')
  const nodes = page.nodes(n => page.hasClass(n, 'job-search-card'), list)
  if (nodes.length !== +count) fail('incomplete displayed inventory')
  const cards = nodes.map(node => {
    const id = node.attrs['data-entity-urn']?.match(/^urn:li:jobPosting:(\d+)$/)?.[1]
    if (!id) fail('missing native posting ID')
    const anchor = one(page.nodes(n => n.tag === 'a' && page.hasClass(n, 'base-card__full-link'), node), 'missing native role link')
    const employer = one(page.nodes(n => n.tag === 'a' && exactEmployer(n.attrs.href || 'https://invalid.example'), node), 'missing exact card employer')
    if (page.text(employer) !== 'LetsTransport') fail('card employer identity changed')
    const title = page.text(one(page.nodes(n => page.hasClass(n, 'base-search-card__title'), node), 'missing native title'))
    const location = page.text(one(page.nodes(n => page.hasClass(n, 'job-search-card__location'), node), 'missing native location'))
    const time = one(page.nodes(n => n.tag === 'time', node), 'missing native card date')
    const posted = time.attrs.datetime
    if (!title || !location || nativeDate(posted, { required: true }).precision !== 'day') fail('incomplete title, geography or public date')
    return { id, title, location, url: roleUrl(anchor.attrs.href, id), postingDate: posted }
  })
  if (new Set(cards.map(r => r.id)).size !== cards.length) fail('duplicate native posting')
  return cards
}

export function verifyProfile(html) {
  const p = document(html)
  if (p.text(one(p.nodes(n => n.tag === 'h1'), 'missing profile title')) !== 'LetsTransport') fail('profile employer changed')
  const canonical = one(p.nodes(n => n.tag === 'link' && n.attrs.rel === 'canonical'), 'missing profile canonical')
  if (!exactEmployer(canonical.attrs.href)) fail('profile canonical identity changed')
  const websites = p.nodes(n => n.tag === 'a' && n.attrs['data-tracking-control-name'] === 'about_website' && (() => {
    try { let u = urls(n.attrs.href); if (linkedin(u) && u.pathname === '/redir/redirect' && u.searchParams.getAll('url').length === 1) u = urls(u.searchParams.get('url')); return ['http:', 'https:'].includes(u.protocol) && ['letstransport.in', 'www.letstransport.in'].includes(u.hostname) && u.pathname === '/' && !u.search && !u.hash && !u.username && !u.password && !u.port } catch { return false }
  })())
  if (!websites.length) fail('reciprocal employer domain missing')
  if (!p.nodes(n => n.tag === 'a' && (() => { try { const u = urls(n.attrs.href); return linkedin(u) && u.pathname === '/jobs/letstransport-jobs-worldwide' && u.searchParams.get('f_C') === '6472988' } catch { return false } })()).length) fail('exact employer organization board missing')
}

const indianRegions = new Set(['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'])
export function extractNativeDetail(html, row, now) {
  const p = document(html)
  const canonical = one(p.nodes(n => n.tag === 'link' && n.attrs.rel === 'canonical'), 'missing role canonical')
  const sourceUrl = roleUrl(canonical.attrs.href, row.id)
  if (new URL(sourceUrl).pathname !== new URL(row.url).pathname) fail('canonical identity mismatch')
  const title = p.text(one(p.nodes(n => n.tag === 'h1' && p.hasClass(n, 'top-card-layout__title')), 'missing detail title'))
  const employer = one(p.nodes(n => n.tag === 'a' && p.hasClass(n, 'topcard__org-name-link')), 'missing detail employer')
  const location = p.text(one(p.nodes(n => p.hasClass(n, 'topcard__flavor') && p.hasClass(n, 'topcard__flavor--bullet')), 'missing detail country'))
  if (title !== row.title || location !== row.location || p.text(employer) !== 'LetsTransport' || !exactEmployer(employer.attrs.href)) fail('listing/detail identity changed')
  const criteria = p.nodes(n => p.hasClass(n, 'description__job-criteria-item')).map(n => [
    p.text(one(p.nodes(c => c.tag === 'h3', n), 'missing criteria heading')),
    p.text(one(p.nodes(c => p.hasClass(c, 'description__job-criteria-text'), n), 'missing criteria value')),
  ])
  const employmentType = criteria.find(([key]) => key === 'Employment type')?.[1] || null
  // The six older external postings conflict with expired 2021/2022 native ATS
  // application pages. This adapter deliberately covers the native internship
  // subset; a LinkedIn republication cannot establish a new requisition.
  if (employmentType !== 'Internship') return null
  if (/No longer accepting applications/i.test(p.text(p.root))) return null
  const [city, state, country, ...extra] = location.split(',').map(s => s.trim())
  if (!city || !indianRegions.has(state) || country !== 'India' || extra.length) fail('unverified explicit India geography')
  const button = one(p.nodes(n => n.tag === 'button' && n.attrs.id === 'topbar-apply'), 'missing active native Apply')
  if (p.text(button) !== 'Apply' || Object.hasOwn(button.attrs, 'disabled') || button.attrs['aria-disabled'] === 'true') fail('disabled native application')
  const handoffs = p.nodes(n => n.tag === 'a' && n.attrs['data-tracking-control-name'] === 'public_jobs_nav-header-signin')
  if (!handoffs.some(n => { try { const u = urls(n.attrs.href), target = urls(u.searchParams.get('session_redirect')); return linkedin(u) && u.pathname === '/login' && roleUrl(target.href, row.id) === sourceUrl.replace('https://in.', 'https://www.') } catch { return false } })) fail('missing exact native account application handoff')
  const schemas = p.nodes(n => n.tag === 'script' && n.attrs.type === 'application/ld+json').map(n => JSON.parse(n.raw))
  // Captured native internship details expose no JobPosting schema. A newly
  // introduced schema may add geography, expiry or restrictions; fail closed
  // until that contract is reviewed rather than silently ignoring fields.
  if (schemas.some(s => JSON.stringify(s).includes('JobPosting'))) fail('new unreviewed JobPosting schema/restrictions')
  const posted = row.postingDate
  if (!Number.isFinite(Date.parse(posted)) || Date.parse(posted) > Date.parse(now)) fail('invalid native public posting date')
  const descriptions = p.nodes(n => p.hasClass(n, 'show-more-less-html__markup'))
  let jobDescription = null
  if (descriptions.length === 1) {
    const node = descriptions[0], prose = p.nodes(n => ['p', 'li'].includes(n.tag), node).map(narrative).filter(t => t.length > 30)
    if (prose.length && p.text(node).length > 250) jobDescription = p.text(node)
  }
  return { jobId: row.id, requisitionId: null, title, location, city, state, country,
    locations: [location], countryCode: 'IN', employmentType, postingDate: posted,
    closingDate: null, jobDescription,
    sourceUrl, applyUrl: sourceUrl, link: sourceUrl, applicationRequiresAccount: true,
    externalApplicationDestinationVerified: false, sourceListingComplete: false,
    sourceScopeComplete: false, lifecycleCleanupAllowed: false,
    sourceListingIncompleteReason: 'Native India internship subset only; six older LinkedIn external roles conflict with expired original ATS pages and full employer inventory remains unproven.' }
}
