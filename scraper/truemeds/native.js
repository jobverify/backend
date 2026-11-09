import { document, decode, norm } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { nativeCountryName, nativeLocationCountryName, nativeDate } from '../../scraper-support/shared/nativeJobPosting.js'

export const activeDocument = html => {
  const doc = document(html)
  const propagate = (node, inherited = false) => {
    const style = (node.attrs.style || '').replace(/\/\*[\s\S]*?\*\//g, '')
    node.inactive ||= inherited || /(?:^|;)\s*content-visibility\s*:\s*hidden\s*(?:!important\s*)?(?:;|$)/i.test(style)
    for (const child of node.children.filter(c => typeof c !== 'string')) propagate(child, node.inactive)
  }
  propagate(doc.root)
  return doc
}

const requireProof = (ok, reason) => { if (!ok) throw Error(reason) }
const hasClass = (n, c) => (n.attrs.class || '').split(/\s+/).includes(c)
const schemas = doc => doc.nodes(n => n.tag === 'script' && n.attrs.type === 'application/ld+json')
  .flatMap(n => { const p = JSON.parse(n.raw); return Array.isArray(p) ? p : [p] })
const employer = value => {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password
    && ['www.linkedin.com', 'in.linkedin.com'].includes(u.hostname) && /^\/company\/truemeds-india\/?$/.test(u.pathname) }
  catch { return false }
}
export const roleID = value => {
  const u = new URL(value)
  requireProof(u.protocol === 'https:' && !u.username && !u.password && !u.hash
    && ['www.linkedin.com', 'in.linkedin.com'].includes(u.hostname), 'Untrusted native role origin')
  const id = /^\/jobs\/view\/[^/]+-(\d+)$/.exec(u.pathname)?.[1]
  requireProof(id && !u.search, 'Unexpected native role path')
  return id
}

export const employerListingURL = doc => {
  requireProof(doc.nodes(n => n.tag === 'h1' && doc.text(n) === 'Truemeds').length === 1, 'Native employer heading changed')
  const urls = doc.nodes(n => n.tag === 'a').map(n => n.attrs.href).filter(value => {
    try { const u = new URL(value); return u.origin === 'https://www.linkedin.com'
      && u.pathname === '/jobs/truemeds-jobs-worldwide' && u.searchParams.get('f_C') === '14614643'
      && [...u.searchParams.keys()].every(k => ['f_C', 'trk'].includes(k)) && !u.hash }
    catch { return false }
  })
  requireProof(new Set(urls).size === 1, 'Official employer See jobs handoff changed')
  return urls[0]
}

export const listingRows = doc => {
  const lists = schemas(doc).filter(p => p['@type'] === 'ItemList')
  requireProof(lists.length === 1 && Array.isArray(lists[0].itemListElement), 'Native listing schema changed')
  const rows = lists[0].itemListElement
  requireProof(rows.length > 0 && rows.length <= 100, 'Native listing count unavailable or exceeds bound')
  const headings = doc.nodes(n => n.tag === 'h1').map(n => doc.text(n))
  const total = /^(\d+) Truemeds Jobs in Worldwide$/.exec(headings[0] || '')
  requireProof(headings.length === 1 && total && Number(total[1]) === rows.length
    && doc.text(doc.root).includes("You've viewed all jobs for this search"), 'Native pagination or count is incomplete')
  const cards = doc.nodes(n => hasClass(n, 'job-search-card'))
  requireProof(cards.length === rows.length, 'Visible/native listing count mismatch')
  const seen = new Set()
  return rows.map(row => {
    const id = roleID(row.url)
    requireProof(!seen.has(id) && row.disambiguatingDescription === 'Truemeds' && typeof row.name === 'string', 'Native employer or unique role identity changed')
    seen.add(id)
    const card = cards.find(n => n.attrs['data-entity-urn'] === `urn:li:jobPosting:${id}`)
    requireProof(card && doc.nodes(n => n.tag === 'h3' && norm(doc.text(n)) === norm(row.name), card).length === 1
      && doc.nodes(n => n.tag === 'a' && employer(n.attrs.href) && doc.text(n) === 'Truemeds', card).length > 0, 'Visible/native listing identity mismatch')
    const labels = doc.nodes(n => hasClass(n, 'job-search-card__location'), card).map(n => doc.text(n))
    requireProof(labels.length === 1, 'Visible listing geography unavailable')
    return {...row, id, nativeVisibleLocation:labels[0]}
  })
}

export const detailJob = (doc, row, now) => {
  const ps = schemas(doc).filter(p => p['@type'] === 'JobPosting')
  requireProof(ps.length === 1, 'Expected one native JobPosting')
  const p = ps[0]
  requireProof(p.hiringOrganization?.name === 'Truemeds' && employer(p.hiringOrganization.sameAs), 'Native role employer mismatch')
  requireProof(norm(p.title) === norm(row.name) && doc.nodes(n => n.tag === 'h1' && doc.text(n) === norm(row.name)).length === 1, 'Native role title mismatch')
  requireProof(doc.nodes(n => n.tag === 'a' && employer(n.attrs.href) && doc.text(n) === 'Truemeds').length > 0, 'Visible native employer missing')
  requireProof(doc.nodes(n => n.tag === 'link' && n.attrs.rel === 'canonical' && n.attrs.href === row.url).length === 1, 'Native role canonical identity mismatch')
  const locations = Array.isArray(p.jobLocation) ? p.jobLocation : [p.jobLocation]
  requireProof(locations.length > 0 && locations.length <= 20 && locations.every(l => l?.address), 'Native country locations unavailable')
  for (const l of locations) {
    const c = nativeCountryName(l.address.addressCountry), label = nativeLocationCountryName(l.address.addressLocality)
    requireProof(c && (!label || label === c), 'Native country missing or conflicts with locality')
    const regionCountry = nativeLocationCountryName(l.address.addressRegion)
    requireProof(!regionCountry || regionCountry === c, 'Native country conflicts with region country')
    requireProof(c !== 'India' || !/^(?:California|Texas|New York|Florida|Washington|Ontario|British Columbia|New South Wales|CA|TX|NY|FL|WA|ON|BC|NSW)$/i.test(l.address.addressRegion || ''), 'Native country/region conflict')
  }
  const visibleCountries = doc.nodes(n => hasClass(n, 'topcard__flavor') && hasClass(n, 'topcard__flavor--bullet'))
    .map(n => nativeLocationCountryName(doc.text(n))).filter(Boolean)
  const listedCountry = nativeLocationCountryName(row.nativeVisibleLocation)
  if (listedCountry) visibleCountries.push(listedCountry)
  requireProof(visibleCountries.every(c => locations.some(l => nativeCountryName(l.address.addressCountry) === c)), 'Visible/schema country conflict')
  const india = locations.filter(l => nativeCountryName(l.address.addressCountry) === 'India')
  if (!india.length) return null
  const posted = nativeDate(p.datePosted), expiry = nativeDate(p.validThrough)
  requireProof(!posted.iso || !expiry.iso || posted.iso <= expiry.iso, 'Native expiry precedes publication')
  requireProof(Number.isFinite(Date.parse(now)), 'Invalid reference date')
  const text = doc.text(doc.root)
  if ((posted.iso && Date.parse(posted.iso) > Date.parse(now)) || (expiry.iso && Date.parse(expiry.iso) <= Date.parse(now))
    || /\bno longer accepting applications\b|\bthis job is no longer available\b/i.test(text)) return null
  const visible = doc.nodes(n => hasClass(n, 'show-more-less-html__markup'))
  requireProof(visible.length <= 1, 'Ambiguous native description')
  const schemaDoc = activeDocument(decode(p.description || ''))
  const visibleText = visible.length ? doc.text(visible[0]) : ''
  const schemaText = schemaDoc.text(schemaDoc.root)
  if (visibleText && schemaText) requireProof(visibleText.replace(/\s/g, '') === schemaText.replace(/\s/g, ''), 'Visible/schema description mismatch')
  const prose = n => n.inactive || /^(?:h[1-6]|strong|b|script|style)$/.test(n.tag) ? ''
    : n.children.map(c => typeof c === 'string' ? decode(c) : prose(c)).join(' ')
  const substantive = norm(visible[0] ? prose(visible[0]) : '')
  const description = substantive && /[\p{L}\p{N}]/u.test(substantive)
    && !/^(?:jd|job description|n\/a|tbd|apply now|placeholder)[.!: ]*$/i.test(substantive) ? visibleText : null
  return {id:row.id, jobId:row.id, source:'truemeds', company:'Truemeds', title:norm(row.name), country:'India',
    city:india.length === 1 ? india[0].address.addressLocality || null : null,
    location:india.map(l => [l.address.addressLocality, l.address.addressRegion, 'India'].filter(Boolean).join(', ')).join('; '),
    sourceUrl:row.url, applyUrl:row.url, link:row.url, applicationLinkSource:'public-role-page-fallback',
    postedAt:posted.iso, postingDate:posted.iso, nativePublicationDate:posted.raw, nativePublicationField:posted.iso ? 'JobPosting.datePosted' : null,
    validThrough:expiry.iso, closingDate:expiry.iso, sourceClosingDateIsExact:expiry.exact, firstEverPublication:null,
    sourceDescription:description, jobDescription:description, sourceDetailComplete:Boolean(description),
    sourceDetailStatus:description ? 'complete' : 'missing-description', sourceListingComplete:false,
    sourceScopeComplete:false, lifecycleCleanupAllowed:false, nativeJobPosting:p, nativeListingRecord:row,
    nativeVisibleDescriptionHTML:visible.length ? doc.inner(visible[0]) : null}
}
