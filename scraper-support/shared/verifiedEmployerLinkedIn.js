import { normalizeCity } from '../utils/cityNormalizer.js'
import { extractAshbyExperienceRequired } from '../utils/ashbyExperience.js'

const clean = s => typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : ''
const decode = s => String(s ?? '').replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => { const code = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n); return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '' })
  .replace(/&(quot|apos|lt|gt|nbsp|amp);/gi, (_, n) => ({ quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', amp: '&' })[n.toLowerCase()])
const withoutComments = h => String(h ?? '').replace(/<!--[\s\S]*?-->/g, '')
const document = h => withoutComments(h).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
const visible = h => clean(decode(document(decode(h)).replace(/<[^>]*>/g, ' ')))
const attr = (tag, name) => decode(tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])(.*?)\\1`, 'is'))?.[2])
const classes = tag => attr(tag, 'class').split(/\s+/)
const hasClass = (tag, name) => classes(tag).includes(name)
const error = message => { throw new Error('Verified LinkedIn ' + message) }
const elementAt = (html, index) => {
  const open = html.slice(index).match(/^<([a-z][\w-]*)\b[^>]*>/i)
  if (!open) return error('malformed HTML inventory')
  const tag = open[1], pattern = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi'); pattern.lastIndex = index
  let depth = 0, end = null
  for (let m; (m = pattern.exec(html));) { depth += /^<\//.test(m[0]) ? -1 : 1; if (depth === 0) { end = m.index; return { tag: open[0], inner: html.slice(index + open[0].length, end), outer: html.slice(index, pattern.lastIndex) } } }
  return error('unterminated HTML inventory')
}
const elements = (html, tag, predicate) => [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'gi'))].filter(m => predicate(m[0])).map(m => elementAt(html, m.index))
const one = (items, reason) => items.length === 1 ? items[0] : error(reason)
const links = html => elements(document(html), 'a', () => true).map(x => ({ href: attr(x.tag, 'href'), text: visible(x.inner), tag: x.tag }))
const strictUrl = (value, base) => {
  if (!clean(value)) return error('missing URL identity')
  let u; try { u = new URL(value, base) } catch { return error('invalid URL identity') }
  if (u.protocol !== 'https:' || u.username || u.password || u.hash) return error('unsafe URL identity')
  return u
}
const linkedin = u => ['www.linkedin.com', 'in.linkedin.com'].includes(u.hostname) && !u.port
const companyIdentity = (value, config, jobsAllowed = false) => {
  const u = strictUrl(value); const paths = [`/company/${config.companyTenant}`, `/company/${config.companyTenant}/`]
  if (jobsAllowed) paths.push(`/company/${config.companyTenant}/jobs`, `/company/${config.companyTenant}/jobs/`)
  return linkedin(u) && paths.includes(u.pathname)
}
const boardIdentity = (value, config) => {
  const u = strictUrl(value)
  if (!linkedin(u) || u.pathname !== config.listingPath || u.searchParams.getAll('f_C').length !== 1 || u.searchParams.get('f_C') !== config.companyId
    || [...u.searchParams.keys()].some(k => !['f_C', 'trk'].includes(k)) || u.searchParams.getAll('trk').length > 1) return error('employer board query identity changed')
  return u
}
const roleIdentity = (value, id) => {
  const u = strictUrl(value)
  if (!linkedin(u) || !/^\/jobs\/view\/[^/]+-\d+$/.test(u.pathname) || !u.pathname.endsWith('-' + id)
    || [...u.searchParams.keys()].some(k => !['position', 'pageNum', 'refId', 'trackingId', 'trk'].includes(k))) return error('role URL identity changed')
  return u
}
const regions = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' })
const reserved = new Set(['ZZ', 'XA', 'XB', 'UN', 'EU', 'EZ', 'QO'])
const namedCountries = new Map()
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) { const code = String.fromCharCode(a, b), name = regions.of(code); if (name && !reserved.has(code)) namedCountries.set(name.toLowerCase(), code) }
const employmentTypes = { FULL_TIME: 'Full-time', PART_TIME: 'Part-time', CONTRACTOR: 'Contract', TEMPORARY: 'Temporary', INTERN: 'Internship', VOLUNTEER: 'Volunteer', PER_DIEM: 'Per diem', OTHER: 'Other' }
const employmentType = value => value == null ? null : employmentTypes[value] ?? error('unknown employment type')
const countryCode = raw => {
  if (typeof raw !== 'string' || !/^[A-Z]{2}$/.test(raw) || reserved.has(raw) || !regions.of(raw)) return error('unverified structured country geography')
  return raw
}
const accountApplication = (html, canonical) => {
  const doc = document(html), button = one(elements(doc, 'button', t => attr(t, 'id') === 'topbar-apply'), 'missing application button')
  if (visible(button.inner) !== 'Apply') return error('application button changed')
  const modal = attr(button.tag, 'data-modal'); let candidates
  if (modal) {
    const body = one(elements(doc, 'div', t => attr(t, 'id') === modal), 'application modal identity changed')
    candidates = links(body.inner).filter(x => attr(x.tag, 'data-tracking-control-name') === 'public_jobs_apply-link-offsite_contextual-sign-in-modal_join-link')
  } else {
    if (attr(button.tag, 'data-tracking-control-name') !== 'public_jobs_apply-link-onsite') return error('application mode changed')
    candidates = links(doc).filter(x => attr(x.tag, 'data-tracking-control-name') === 'public_jobs_nav-header-signin')
  }
  if (!candidates.length) return error('missing account application handoff')
  for (const link of candidates) {
    let u, target; try { u = strictUrl(link.href); target = strictUrl(u.searchParams.get('session_redirect')) } catch { return error('application URL identity changed') }
    if (!linkedin(u) || !['/signup/cold-join', '/login'].includes(u.pathname) || u.searchParams.getAll('session_redirect').length !== 1
      || !linkedin(target) || target.pathname !== canonical.pathname) return error('application role identity changed')
  }
}
const parseBoard = (html, config) => {
  const doc = document(html), countNode = one(elements(doc, 'span', t => hasClass(t, 'results-context-header__job-count')), 'missing inventory count')
  const label = visible(countNode.inner)
  if (!/^\d+$/.test(label) || Number(label) <= 0 || Number(label) > 100) return error('unverified complete inventory count')
  const count = Number(label)
  if (!visible(doc).includes("You've viewed all jobs for this search")) return error('missing complete inventory terminal')
  const query = one(elements(doc, 'span', t => hasClass(t, 'results-context-header__query-search')), 'missing inventory query identity')
  if (visible(query.inner).toLowerCase() !== (config.companyName + ' Jobs in Worldwide').toLowerCase()) return error('employer inventory identity changed')
  const list = one(elements(doc, 'ul', t => hasClass(t, 'jobs-search__results-list')), 'missing inventory container')
  const urns = [...list.inner.matchAll(/data-entity-urn\s*=\s*(["'])urn:li:jobPosting:(\d+)\1/g)].map(m => m[2])
  const cards = elements(list.inner, 'div', t => hasClass(t, 'job-search-card'))
  if (urns.length !== count || new Set(urns).size !== count || cards.length !== count) return error('incomplete or duplicate raw inventory cards')
  const rawRoleLinks = links(list.inner).filter(x => { try { return new URL(x.href).pathname.startsWith('/jobs/view/') } catch { return false } })
  if (rawRoleLinks.length !== count) return error('raw role anchor inventory mismatch')
  const rows = cards.map(card => {
    const urn = attr(card.tag, 'data-entity-urn'), id = urn.match(/^urn:li:jobPosting:(\d+)$/)?.[1]
    if (!id || !urns.includes(id)) return error('card role identity changed')
    const anchor = one(links(card.outer).filter(x => hasClass(x.tag, 'base-card__full-link')), 'missing role card anchor')
    const source = roleIdentity(anchor.href, id), title = visible(one(elements(card.inner, 'h3', t => hasClass(t, 'base-search-card__title')), 'missing card title').inner)
    const location = visible(one(elements(card.inner, 'span', t => hasClass(t, 'job-search-card__location')), 'missing card geography').inner)
    if (!title || !location) return error('incomplete role card identity/geography')
    if (!rawRoleLinks.some(x => x.href === anchor.href)) return error('raw role inventory parity changed')
    return { id, title, location, url: source.href }
  })
  if (new Set(rows.map(x => x.id)).size !== count || new Set(rows.map(x => new URL(x.url).pathname)).size !== count) return error('duplicate card identity')
  return rows
}
const parseDetail = (html, row, config, at) => {
  const doc = document(html), canonical = one([...doc.matchAll(/<link\b[^>]*>/gi)].filter(m => attr(m[0], 'rel') === 'canonical'), 'missing canonical identity')
  const source = roleIdentity(attr(canonical[0], 'href'), row.id)
  if (source.search || source.pathname !== new URL(row.url).pathname) return error('canonical role identity changed')
  const title = visible(one(elements(doc, 'h1', t => hasClass(t, 'top-card-layout__title')), 'missing detail title identity').inner)
  const employer = one(links(doc).filter(x => hasClass(x.tag, 'topcard__org-name-link')), 'missing detail employer identity')
  const location = visible(one(elements(doc, 'span', t => hasClass(t, 'topcard__flavor') && hasClass(t, 'topcard__flavor--bullet')), 'missing detail geography').inner)
  if (title !== row.title || employer.text !== config.companyName || !companyIdentity(employer.href, config) || location !== row.location) return error('listing/detail identity or geography changed')
  if (visible(doc).includes('No longer accepting applications')) return error('expired role is still listed')
  const description = one(elements(doc, 'div', t => hasClass(t, 'show-more-less-html__markup')), 'missing full description').inner.trim()
  if (!visible(description)) return error('empty description')
  let allSchemas
  try { allSchemas = [...withoutComments(html).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m => attr(m[1], 'type') === 'application/ld+json').map(m => JSON.parse(m[2])) } catch { return error('malformed role schema') }
  const schemas = allSchemas.filter(x => x?.['@type'] === 'JobPosting')
  let geography, schema = null, remoteStatus = null
  if (!schemas.length) {
    const rule = config.nativeRoleEvidence?.[row.id]
    if (allSchemas.some(x => JSON.stringify(x).includes('JobPosting')) || !rule || rule.title !== title || rule.location !== location || location !== 'India'
      || !Array.isArray(rule.descriptionSignals) || !rule.descriptionSignals.length || !rule.descriptionSignals.every(s => clean(s) && visible(description).includes(s))) return error('unverified native role schema/geography evidence')
    geography = [{ country: 'IN', city: null, state: null, location }]; remoteStatus = 'Remote'
  } else {
    schema = one(schemas, 'duplicate role schema identity')
    employmentType(schema.employmentType)
    if (visible(schema.title) !== title || schema.hiringOrganization?.name !== config.companyName || !companyIdentity(schema.hiringOrganization?.sameAs, config)) return error('schema employer/title identity changed')
    if (visible(schema.description) !== visible(description)) return error('schema and full visible description parity changed')
    if (!Number.isFinite(Date.parse(schema.datePosted)) || Date.parse(schema.datePosted) > at || !Number.isFinite(Date.parse(schema.validThrough)) || Date.parse(schema.validThrough) <= at) return error('invalid or expired role dates')
    const namedLocationCountry = namedCountries.get(location.split(',').at(-1).trim().toLowerCase())
    const places = Array.isArray(schema.jobLocation) ? schema.jobLocation : [schema.jobLocation]
    if (!places.length) return error('missing structured geography')
    geography = places.map(p => {
      const a = p?.address
      if (p?.['@type'] !== 'Place' || a?.['@type'] !== 'PostalAddress') return error('invalid role geography')
      const country = countryCode(a.addressCountry), city = a.addressLocality == null ? null : clean(a.addressLocality), state = a.addressRegion == null ? null : clean(a.addressRegion)
      if ((a.addressLocality != null && !city) || (a.addressRegion != null && !state)) return error('invalid structured geography fields')
      if (city ? !location.toLowerCase().includes(city.toLowerCase()) : location !== regions.of(country)) return error('structured/visible geography parity changed')
      if (places.length === 1 && namedLocationCountry && namedLocationCountry !== country) return error('structured/visible country geography parity changed')
      if (state && !location.toLowerCase().includes(state.toLowerCase())) return error('structured/visible state geography parity changed')
      return { country, city, state, location: places.length === 1 ? location : [city, state, regions.of(country)].filter(Boolean).join(', ') }
    })
  }
  accountApplication(doc, source)
  return { ...row, sourceUrl: source.href, description, geography, schema, remoteStatus }
}

export async function runVerifiedEmployerLinkedIn(config, { signal, fetchImpl = fetch, now = () => new Date().toISOString(), maxJobs } = {}) {
  signal?.throwIfAborted()
  if (!clean(config?.source) || !clean(config.companyName) || !/^[a-z0-9-]+$/.test(config.companyTenant ?? '') || !/^\d+$/.test(config.companyId ?? '')) return error('invalid employer configuration')
  const scrapedAt = now(), at = Date.parse(scrapedAt)
  if (!Number.isFinite(at)) return error('invalid scrape date')
  const request = async (url, validateUrl) => {
    signal?.throwIfAborted()
    const deadline = AbortSignal.timeout(config.requestTimeoutMs ?? 15000), requestSignal = signal ? AbortSignal.any([signal, deadline]) : deadline
    try {
      const response = await fetchImpl(url, { signal: requestSignal, redirect: 'follow', headers: { Accept: 'text/html' } })
      signal?.throwIfAborted(); requestSignal.throwIfAborted()
      if (!response.ok) { const e = new Error(`HTTP ${response.status} for ${url}`); e.status = response.status; throw e }
      if (response.url && !validateUrl(response.url)) return error('response URL identity changed')
      const html = await response.text(); signal?.throwIfAborted(); requestSignal.throwIfAborted()
      return html
    } catch (e) { signal?.throwIfAborted(); requestSignal.throwIfAborted(); throw e }
  }
  const official = strictUrl(config.officialUrl)
  const home = await request(official.href, value => strictUrl(value).href === official.href)
  let verifiedHandoff
  if (typeof config.validateOfficialHandoff === 'function') {
    verifiedHandoff = await config.validateOfficialHandoff({ home, officialUrl: official.href, request: async value => {
      const target = strictUrl(value, official.href)
      if (target.origin !== official.origin) return error('official handoff request origin changed')
      return request(target.href, finalUrl => strictUrl(finalUrl).href === target.href)
    } })
    signal?.throwIfAborted()
  } else {
    verifiedHandoff = visible(home).toLowerCase().includes(config.companyName.toLowerCase()) && links(home).some(x => { try { return /^(?:Careers|Jobs|We're Hiring)$/i.test(x.text) && strictUrl(x.href, official.href).href === config.companyJobsUrl } catch { return false } })
  }
  if (verifiedHandoff !== true) return error('official employer careers handoff changed')
  if (!companyIdentity(config.companyJobsUrl, config, true)) return error('configured company handoff identity changed')
  const company = await request(config.companyJobsUrl, value => companyIdentity(value, config, true))
  if (visible(one(elements(document(company), 'h1', () => true), 'missing company identity').inner) !== config.companyName) return error('company page identity changed')
  const boardLinks = links(company).filter(x => { try { return new URL(x.href).pathname === config.listingPath } catch { return false } })
  if (!boardLinks.length) return error('missing exact employer board handoff')
  const boardUrls = boardLinks.map(x => boardIdentity(x.href, config).href)
  if (new Set(boardUrls).size !== 1) return error('ambiguous employer board handoff')
  const board = boardUrls[0], rows = parseBoard(await request(board, value => boardIdentity(value, config).href === board), config)
  const detailed = []
  for (const row of rows) detailed.push(parseDetail(await request(row.url, value => roleIdentity(value, row.id).pathname === new URL(row.url).pathname), row, config, at))
  signal?.throwIfAborted()
  const limit = Number.isFinite(Number(maxJobs)) && Number(maxJobs) > 0 ? Math.floor(Number(maxJobs)) : Infinity
  return detailed.filter(row => row.geography.some(p => p.country === 'IN')).map(row => {
    const primary = row.geography.find(p => p.country === 'IN'), schema = row.schema
    return { source: config.source, company: config.companyName, companyCareerPage: config.companyJobsUrl, atsPlatform: 'linkedin-employer', jobId: row.id, requisitionId: row.id, title: row.title,
      sourceUrl: row.sourceUrl, applyUrl: row.sourceUrl, link: row.sourceUrl, applicationRequiresAccount: true,
      location: row.location, locations: row.geography.map(p => p.location), city: primary.city ? normalizeCity(primary.city) || primary.city : null, state: primary.state, country: 'India', remoteStatus: row.remoteStatus,
      jobDescription: row.description, experienceRequired: extractAshbyExperienceRequired({ title: row.title, jobDescription: row.description }), employmentType: employmentType(schema?.employmentType),
      publicExperienceChecked: true, sourceListingComplete: true, postedAt: schema?.datePosted ?? null, closingDate: schema?.validThrough ?? null, scrapedAt }
  }).slice(0, limit)
}
