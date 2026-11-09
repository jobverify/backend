import { createHash } from 'node:crypto'
import { readNativeDocument, decodeNativeEntities, extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const C = 'https://magnitglobal.com/about/careers', L = 'https://magnitglobal.com/us/en/company/careers.html'
const O = 'https://jobs.dayforcehcm.com', D = O + '/prounlimited/CANDIDATEPORTAL'
const E = 'https://globaleur232.dayforcehcm.com/CandidatePortal/en-US/ProUnlimited'
const W = 'https://directsource.magnitglobal.com/eu/magnitglobal', J = W + '/jobs'
const SEARCH = O + '/api/geo/prounlimited/jobposting/search'
const hash = value => createHash('sha256').update(value).digest('hex')
const clean = value => decodeNativeEntities(value).replace(/\s+/g, ' ').trim()
const folded = value => clean(value).replace(/[\u2010-\u2015]/g, '-').replace(/\s*-\s*/g, '-').toLowerCase()
const cls = (node, value) => (node.attrs.class || '').split(/\s+/).includes(value)
const descendants = (node, predicate) => !node || node.inert ? [] : [ ...(predicate(node) ? [node] : []),
  ...node.children.filter(child => typeof child !== 'string').flatMap(child => descendants(child, predicate)) ]
class MagnitIdentityError extends Error {
  constructor(message) { super('Magnit native identity: ' + message); this.name = 'MagnitIdentityError'; this.abortRetries = true }
}
const valid = (condition, message) => { if (!condition) throw new MagnitIdentityError(message) }
const one = (nodes, label) => { valid(nodes.length === 1, 'expected one ' + label); return nodes[0] }
const positiveId = value => Number.isSafeInteger(value) && value > 0
const json = body => { try { return JSON.parse(body) } catch { throw new MagnitIdentityError('invalid native JSON') } }
const regionNames = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' })
const countryCode = value => {
  if (typeof value !== 'string' || !/^[A-Z]{2}$/.test(value) || ['ZZ', 'XA', 'XB', 'EU', 'UN'].includes(value)) return null
  return regionNames.of(value) ? value : null
}
const normalizedLocations = rows => Array.isArray(rows) ? rows.map(row => ({ id: row.locationId, country: countryCode(row.isoCountryCode),
  city: clean(row.cityName), state: clean(row.stateCode), address: clean(row.formattedAddress) })) : []
const countrySignature = rows => JSON.stringify(normalizedLocations(rows).map(row => [row.id, row.country]).sort((a, b) => String(a).localeCompare(String(b))))
const dateUTC = value => {
  if (value == null || value === '') return null
  valid(typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)), 'native UTC publication date invalid')
  return new Date(value).toISOString()
}
const qualifiedClosingDate = value => value && !/^2900-01-01/.test(value) ? value : null
const nextData = html => {
  const doc = readNativeDocument(html)
  const node = one(doc.nodes(n => n.tag === 'script' && n.attrs.id === '__NEXT_DATA__' && n.attrs.type === 'application/json'), 'native Next data')
  return json(node.raw)
}
const readDayforceContext = (html, culture = 'en-US', postingId = null) => {
  const next = nextData(html), queries = next.props?.pageProps?.dehydratedState?.queries
  valid(next.query?.clientNamespace === 'prounlimited' && next.query?.careerSiteXRefCode === 'CANDIDATEPORTAL'
    && Array.isArray(queries) && next.props.pageProps.session?.status === 'unauthenticated', 'native account/page/session context changed')
  const query = one(queries.filter(q => q.queryKey?.[0] === 'site-info'), 'native site account')
  const info = query.state?.data, key = query.queryKey[1]
  valid(key?.clientNamespace === 'prounlimited' && key.careerSiteXRefCode === 'CANDIDATEPORTAL' && key.language === culture
    && info?.clientNamespace === 'prounlimited' && info.jobBoardCode?.toLowerCase() === 'candidateportal'
    && info.jobBoardId === 1 && info.clientId === 80745 && info.cultureCode === culture
    && info.candidateCorrespondenceClientName === 'Magnit' && info.smallLogo?.imageName === 'Magnit - Small'
    && info.largeLogo?.imageName === 'Magnit - Large' && info.isDisabled !== true, 'native employer/account identity conflicts')
  valid(Array.isArray(info.isoCultureCodes) && info.isoCultureCodes.length > 0 && info.isoCultureCodes.length <= 30
    && new Set(info.isoCultureCodes).size === info.isoCultureCodes.length && info.isoCultureCodes.includes(culture)
    && info.isoCultureCodes.every(value => /^[a-z]{2}-[A-Z]{2}$/.test(value)), 'native locale inventory invalid')
  if (postingId == null) return { info }
  valid(next.query.id === String(postingId) && String(key.jobPostingId) === String(postingId), 'native detail page posting identity conflicts')
  const jobQuery = one(queries.filter(q => q.queryKey?.[0] === 'jobs'), 'native full posting')
  valid(jobQuery.queryKey[1]?.clientNamespace === 'prounlimited' && jobQuery.queryKey[1]?.jobBoardId === 1
    && jobQuery.queryKey[1]?.language === culture && String(jobQuery.queryKey[2]?.id) === String(postingId), 'native full posting query identity conflicts')
  return { info, posting: jobQuery.state?.data }
}
const ATS = /(?:^|\.)(?:dayforcehcm\.com|careers-page\.com|manatal\.com|myworkdayjobs\.com|myworkdaysite\.com|oraclecloud\.com|successfactors\.(?:com|eu)|workable\.com|greenhouse\.io|lever\.co|ashbyhq\.com|smartrecruiters\.com|icims\.com|jobvite\.com|freshteam\.com|darwinbox\.(?:com|in)|zohorecruit\.(?:com|in)|bamboohr\.com|teamtailor\.com|trakstar\.com)$/i
const inspectScope = (html, base, reasons, references) => {
  const doc = readNativeDocument(html)
  const frames = node => node.activeFrame ? [node] : node.inert ? [] : node.children.filter(child => typeof child !== 'string').flatMap(frames)
  for (const frame of doc.nodes(n => n.tag === 'root').flatMap(frames)) {
    let media = false
    try {
      const url = new URL(frame.attrs.src, base)
      media = !Object.hasOwn(frame.attrs, 'srcdoc') && ['www.youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com'].includes(url.hostname) && /\/(?:embed|video)\//.test(url.pathname)
      if (!Object.hasOwn(frame.attrs, 'srcdoc') && url.protocol === 'https:' && url.hostname === 'cdn.embedly.com' && url.pathname === '/widgets/media.html'
        && url.searchParams.get('schema') === 'vimeo' && frame.attrs.title === 'Magnit Brand Anthem') {
        const source = new URL(url.searchParams.get('src')), publicVideo = new URL(url.searchParams.get('url'))
        media = source.origin === 'https://player.vimeo.com' && /^\/video\/\d+$/.test(source.pathname)
          && publicVideo.origin === 'https://vimeo.com' && publicVideo.pathname === source.pathname.replace('/video', '')
      }
    } catch {}
    if (!media) reasons.add('additional-active-frame-hiring-scope')
  }
  for (const node of doc.nodes(n => n.tag === 'a' && n.attrs.href || n.tag === 'script' && n.attrs.src
    && /^(?:|module|(?:text|application)\/(?:javascript|ecmascript))$/i.test(n.attrs.type || ''))) {
    let url
    try { url = new URL(node.tag === 'script' ? node.attrs.src : node.attrs.href, base) } catch { continue }
    if (node.tag === 'script' && url.origin === O && url.pathname.startsWith('/_next/static/')) continue
    if (node.tag === 'script' && [O, 'https://maps.dayforcehcm.com'].includes(url.origin) && url.pathname === '/maps/api/js') continue
    const posting = url.origin === O && url.pathname.match(/^\/(?:[a-z]{2}-[A-Z]{2}\/)?prounlimited\/CANDIDATEPORTAL\/jobs\/(\d+)$/)
    if (posting) { references.dayforce.add(Number(posting[1])); continue }
    const direct = url.origin === new URL(W).origin && url.pathname.match(/^\/eu\/magnitglobal\/jobs\/(\d+)-[a-z0-9-]+$/)
    if (direct) { references.direct.add(direct[1]); continue }
    if (url.origin === new URL(W).origin && /^\/eu\/magnitglobal\/job-(?:apply|refer)\/view$/.test(url.pathname)) {
      if (/^[1-9]\d*$/.test(url.searchParams.get('id') || '')) references.direct.add(url.searchParams.get('id'))
      else reasons.add('additional-unbound-application-hiring-scope')
      continue
    }
    const hiring = ATS.test(url.hostname) || /(?:^|\.)(?:jobs?|careers?|hiring)\./i.test(url.hostname)
      || /\b(?:careers?|jobs?|openings?|join our team|opportunities)\b/i.test(doc.text(node))
    if (!hiring) continue
    if ([C, L, D, E, W, J, W + '/'].includes(url.href.replace(/#$/, ''))) continue
    if (url.origin === O && /^\/(?:[a-z]{2}-[A-Z]{2}\/)?prounlimited\/CANDIDATEPORTAL$/.test(url.pathname) && !url.search) continue
    reasons.add('additional-public-hiring-scope:' + url.origin + url.pathname)
  }
}
const readMagnitVisible = html => {
  // Match the complete static ancestor chain. Reducing '.anti-flicker *' to '*'
  // or '.home-page .talent-info-section' to the final class hides unrelated
  // content. Keep this projection source-local; shared captured consumers retain
  // their existing runtime hashes. Unsupported hiding selectors fail closed.
  const doc = readNativeDocument(html), roots = doc.nodes(n => n.tag === 'root'), parents = new Map(), styles = []
  const walk = (node, inactive = false) => {
    inactive ||= ['template', 'noscript', 'script', 'object'].includes(node.tag)
    if (node.tag === 'style' && !inactive) styles.push(node.raw || '')
    for (const child of node.children.filter(child => typeof child !== 'string')) { parents.set(child, node); walk(child, inactive) }
  }
  roots.forEach(root => walk(root))
  const hiding = value => /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|content-visibility\s*:\s*hidden|opacity\s*:\s*0(?:\.0+)?)(?:\s*!important)?\s*(?:;|$)/i.test(value)
  const compound = part => {
    const checks = [], tag = part.match(/^(?:[a-z][\w-]*|\*)/i)?.[0]
    if (tag) { if (tag !== '*') checks.push(node => node.tag === tag.toLowerCase()); part = part.slice(tag.length) }
    while (part) {
      let match
      if ((match = part.match(/^\.([\w-]+)/))) { const value = match[1]; checks.push(node => cls(node, value)) }
      else if ((match = part.match(/^#([\w-]+)/))) { const value = match[1]; checks.push(node => node.attrs.id === value) }
      else if ((match = part.match(/^\[([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]+)))?\]/))) {
        const key = match[1].toLowerCase(), value = match[2] ?? match[3] ?? match[4]
        checks.push(node => Object.hasOwn(node.attrs, key) && (value == null || node.attrs[key] === value))
      } else throw new MagnitIdentityError('unsupported native visibility selector')
      part = part.slice(match[0].length)
    }
    return node => checks.every(check => check(node))
  }
  const selectors = styles.flatMap(css => [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]+)\}/g)]
    .filter(([, , declarations]) => hiding(declarations)).flatMap(([, list]) => list.split(','))).map(selector => {
      valid(!/[+~:()]/.test(selector), 'unsupported native visibility selector')
      const tokens = selector.trim().replace(/\s*>\s*/g, ' > ').split(/\s+/)
      const tests = tokens.map(token => token === '>' ? null : compound(token))
      const matches = (node, at = tokens.length - 1) => {
        if (!node || !tests[at]?.(node)) return false
        if (at === 0) return true
        const parent = parents.get(node)
        if (tokens[at - 1] === '>') return matches(parent, at - 2)
        for (let ancestor = parent; ancestor; ancestor = parents.get(ancestor)) if (matches(ancestor, at - 1)) return true
        return false
      }
      return matches
    })
  const project = (node, active = true) => {
    if (typeof node === 'string') return node
    active = active && !node.inert && !hiding(node.attrs.style || '') && !selectors.some(matches => matches(node))
    return { ...node, inert: !active, children: node.children.map(child => project(child, active)) }
  }
  const projected = roots.map(root => project(root))
  return { ...doc, nodes: predicate => projected.flatMap(root => descendants(root, predicate)) }
}
const visibleDescription = html => {
  if (typeof html !== 'string') return null
  const doc = readMagnitVisible(html), text = doc.text(one(doc.nodes(n => n.tag === 'root'), 'description root'))
  return extractActiveDescription(text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
}
const verifyCorporate = html => {
  const doc = readMagnitVisible(html), head = readNativeDocument(html)
  valid(one(head.nodes(n => n.tag === 'link' && n.attrs.rel === 'canonical'), 'corporate canonical').attrs.href === C
    && /Magnit/.test(doc.text(one(doc.nodes(n => n.tag === 'body'), 'corporate body'))), 'corporate employer identity changed')
  const regions = ['North America', 'India', 'EMEA', 'UK, Ireland & Netherlands'], expected = [D, E, W, D], bindings = []
  const headingsRow = one(doc.nodes(n => cls(n, 'columns-2') && cls(n, 'w-row')), 'country heading row')
  const linksRow = one(doc.nodes(n => cls(n, 'columns-3') && cls(n, 'w-row')), 'country link row')
  const parents = new Map(), walk = node => { for (const child of node.children.filter(child => typeof child !== 'string')) { parents.set(child, node); walk(child) } }
  doc.nodes(n => n.tag === 'root').forEach(walk)
  valid(parents.get(headingsRow) === parents.get(linksRow), 'country heading/link rows lost their common layout')
  const siblings = parents.get(headingsRow).children.filter(child => typeof child !== 'string')
  valid(siblings.indexOf(linksRow) === siblings.indexOf(headingsRow) + 1, 'country heading/link rows are no longer adjacent')
  const headings = headingsRow.children.filter(child => typeof child !== 'string' && !child.inert && cls(child, 'w-col-3'))
  const links = linksRow.children.filter(child => typeof child !== 'string' && !child.inert && cls(child, 'w-col-3'))
  valid(headings.length === 4 && links.length === 4, 'country column counts do not reconcile')
  for (const [index, label] of regions.entries()) {
    valid(doc.text(one(descendants(headings[index], n => n.tag === 'h6'), label + ' region')) === label, 'country heading order changed')
    const link = one(descendants(links[index], n => n.tag === 'a' && /^Learn More$/i.test(doc.text(n))), label + ' careers handoff')
    valid(link.attrs.href === expected[index], label + ' country/employer handoff changed')
    bindings.push([label, link.attrs.href])
  }
  return bindings
}
const verifyLegacy = html => {
  const doc = readNativeDocument(html)
  valid(doc.nodes(n => n.tag === 'script' && !n.attrs.src && /^\s*window\.location\.href\s*=\s*["']https:\/\/magnitglobal\.com\/about\/careers["'];?\s*$/.test(n.raw || '')).length === 1,
    'legacy careers route no longer declares the exact current careers destination')
}
const directPostingUrl = value => {
  let url
  try { url = new URL(value, J) } catch { throw new MagnitIdentityError('invalid DirectSource posting URL') }
  valid(url.origin === new URL(W).origin && /^\/eu\/magnitglobal\/jobs\/[1-9]\d*-[a-z0-9-]+$/.test(url.pathname)
    && !url.search && !url.hash && !url.username && !url.password, 'DirectSource posting URL identity conflicts')
  return url.href
}
const readDirectList = (html, reasons) => {
  const doc = readMagnitVisible(html)
  valid(clean(one(doc.nodes(n => n.tag === 'title'), 'DirectSource list title').raw) === 'Magnit Global Talent Network', 'DirectSource employer identity changed')
  for (const id of ['inputCountry', 'inputJobType']) {
    const select = one(doc.nodes(n => n.tag === 'select' && n.attrs.id === id), 'unfiltered ' + id)
    const options = descendants(select, n => n.tag === 'option'), selected = options.filter(n => Object.hasOwn(n.attrs, 'selected'))
    valid(options.length && (selected.length ? selected : [options[0]]).every(option => option.attrs.value === ''), 'DirectSource native inventory is filtered')
  }
  const industry = one(doc.nodes(n => n.tag === 'select' && n.attrs.id === 'inputIndustry'), 'unfiltered business groups')
  const groups = descendants(industry, n => n.tag === 'option')
  valid(Object.hasOwn(industry.attrs, 'multiple') && groups.some(option => option.attrs.value === 'ALLGRP')
    && groups.every(option => Object.hasOwn(option.attrs, 'selected')), 'DirectSource native business-group inventory is filtered')
  const body = doc.text(one(doc.nodes(n => n.tag === 'body'), 'DirectSource list body')), match = body.match(/\bFound (\d+) Jobs\b/)
  valid(match && Number.isSafeInteger(Number(match[1])), 'DirectSource inventory count unavailable')
  const roles = new Map()
  for (const anchor of doc.nodes(n => n.tag === 'a' && /^\/eu\/magnitglobal\/jobs\/[1-9]\d*-/.test(n.attrs.href || ''))) {
    const url = directPostingUrl(anchor.attrs.href), id = new URL(url).pathname.split('/').at(-1).split('-')[0], title = doc.text(anchor)
    valid(title && !roles.has(id), 'duplicate DirectSource posting identity')
    roles.set(id, { id, url, title })
  }
  if (roles.size !== Number(match[1])) reasons.add('directsource-native-inventory-unreconciled')
  return { roles, total: Number(match[1]) }
}
const readDirectDetail = (html, row, reasons) => {
  const doc = readMagnitVisible(html), scripts = readNativeDocument(html).nodes(n => n.tag === 'script' && n.attrs.type === 'application/ld+json')
  const visible = doc.text(one(doc.nodes(n => n.tag === 'body'), 'DirectSource detail body'))
  if (/\b(?:(?:this|the)\s+(?:job|position|role|vacancy)\s+(?:(?:is|has been)\s+)?(?:closed|filled|expired)|no longer accepting applications|position (?:is )?no longer available)\b/i.test(visible)) {
    reasons.add('native-posting-not-active-or-public:directsource:' + row.id)
    return null
  }
  const native = one(scripts.map(n => json(n.raw)).filter(value => value?.['@type'] === 'JobPosting'), 'DirectSource JobPosting')
  const primaryTitles = doc.nodes(n => n.tag === 'h3' && cls(n, 'main-title'))
  const visibleTitle = one(primaryTitles.length ? primaryTitles : doc.nodes(n => n.tag === 'h1'), 'DirectSource native title')
  valid(String(native.identifier?.value) === row.id && folded(native.title) === folded(row.title)
    && folded(doc.text(visibleTitle)) === folded(row.title), 'DirectSource posting/title identity conflicts')
  valid(native.hiringOrganization?.name === 'Magnit Global' && native.hiringOrganization.sameAs === 'https://magnitglobal.com/', 'DirectSource native employer identity conflicts')
  const legacy = 'https://magnitglobal.eu.willhire.co/jobs/' + new URL(row.url).pathname.split('/').at(-1)
  valid(native.url === row.url || native.url === legacy && /\bvar\s+requestHost\s*=\s*['"]magnitglobal\.eu\.willhire\.co['"]/.test(html), 'DirectSource canonical posting identity conflicts')
  const apply = one(doc.nodes(n => n.tag === 'a' && n.attrs.id === 'mix_apply'), 'DirectSource role application')
  const applyUrl = new URL(apply.attrs.href, row.url)
  valid(applyUrl.origin === new URL(W).origin && applyUrl.pathname === '/eu/magnitglobal/job-apply/view'
    && [...applyUrl.searchParams].length === 1 && applyUrl.searchParams.get('id') === row.id, 'DirectSource native application identity conflicts')
  const address = native.jobLocation?.address, code = countryCode(address?.addressCountry)
  if (!code) reasons.add('native-country-unresolved:directsource:' + row.id)
  const geography = one(doc.nodes(n => n.tag === 'div' && n.children.some(child => typeof child !== 'string'
    && cls(child, 'info-label') && doc.text(child) === 'Job Location')), 'DirectSource primary geography')
  const visibleLocation = doc.text(one(descendants(geography, n => cls(n, 'info-text')), 'DirectSource primary location')).replace(/\s*\((?:Remote|On-Site|Hybrid)\)\s*$/i, '')
  const structuredLocation = [clean(address?.addressLocality), clean(address?.addressRegion)].filter(Boolean).join(', ')
  valid(structuredLocation && folded(visibleLocation) === folded(structuredLocation), 'DirectSource native country/location geography conflicts')
  const description = visibleDescription(native.description), content = one(doc.nodes(n => cls(n, 'ck-content')), 'DirectSource primary full description')
  const full = description && doc.text(content).replace(/\s/g, '') === description.replace(/\s/g, '')
  if (!full) reasons.add('native-description-incomplete:directsource:' + row.id)
  const posted = native.datePosted
  valid(posted == null || typeof posted === 'string' && /^\d{4}-\d{2}-\d{2}(?:[ T]|$)/.test(posted) && Number.isFinite(Date.parse(posted.slice(0, 10))), 'DirectSource native posting date invalid')
  return { source: 'magnitglobal', company: 'Magnit Global', nativeEmployerBrand: 'Magnit Global', jobId: 'directsource:' + row.id,
    requisitionId: null, title: row.title, country: code === 'IN' ? 'India' : code, city: clean(address?.addressLocality) || null,
    location: [clean(address?.addressLocality) || clean(address?.addressRegion), code === 'IN' ? 'India' : code].filter(Boolean).join(', '),
    sourceUrl: row.url, applyUrl: applyUrl.href, link: applyUrl.href,
    jobDescription: full ? description : null, sourceDescription: full ? description : null, sourceDetailComplete: Boolean(full),
    sourceDetailFailureKind: full ? null : 'missing-content', nativeDescriptionSHA256: full ? hash(description) : null,
    sourceNativeDescriptionFragmentCount: full ? 1 : 0, postingDate: posted ? posted.slice(0, 10) : null,
    closingDate: qualifiedClosingDate(native.validThrough), sourcePublicationDateUnavailable: !posted,
    sourceNativeDates: { datePosted: posted ?? null, validThrough: native.validThrough ?? null, postingDatePrecision: 'day', timezoneUnavailable: true },
    remoteStatus: native.jobLocationType === 'TELECOMMUTE' ? 'Remote' : null, employmentType: native.employmentType ?? null,
    sourceNativeCountryEvidence: { system: 'DirectSource', countryCode: code, nativeAddress: address, visibleLocation },
    sourceNativeEmployerEvidence: { brand: 'Magnit Global', companyWebsite: native.hiringOrganization.sameAs, nativePostingId: row.id, legalEmployer: null } }
}
const postingState = row => JSON.stringify([row?.jobPostingId, row?.jobReqId, row?.jobTitle, row?.postingStartTimestampUTC, row?.postingExpiryTimestampUTC,
  row?.jobPostingContent, row?.postingStatus, row?.isInternal, row?.jobApplicationTemplateId])
const searchState = row => JSON.stringify([row?.jobPostingId, row?.jobReqId, row?.jobTitle, row?.postingStartTimestampUTC, row?.postingExpiryTimestampUTC,
  normalizedLocations(row?.postingLocations), row?.jobDescription])
const readDayforceDetail = (detail, rendered, listing, culture, reasons) => {
  const id = listing.jobPostingId
  valid(detail?.jobPostingId === id && detail.jobReqId === listing.jobReqId && folded(detail.jobTitle) === folded(listing.jobTitle), 'Dayforce posting/requisition identity conflicts')
  valid(rendered?.jobPostingId === id && postingState(rendered) === postingState(detail), 'Dayforce API/rendered posting identity conflicts')
  const locations = normalizedLocations(detail.postingLocations), renderedLocations = normalizedLocations(rendered.postingLocations)
  const known = locations.length > 0 && locations.every(row => row.country) && renderedLocations.every(row => row.country)
  if (!known) reasons.add('native-country-unresolved:dayforce:' + id)
  else valid(JSON.stringify(locations) === JSON.stringify(renderedLocations) && countrySignature(detail.postingLocations) === countrySignature(listing.postingLocations), 'Dayforce native country/location identity conflicts')
  for (const location of locations) valid(!(location.country === 'IN' && /(?:^|,\s*)(?:Canada|United States|USA|Netherlands|Poland|Finland)\s*$/i.test(location.address))
    && !(location.country && location.country !== 'IN' && /(?:^|,\s*)India\s*$/i.test(location.address)), 'Dayforce native country/address identity conflicts')
  valid(typeof detail.isInternal === 'boolean' && positiveId(detail.jobApplicationTemplateId), 'Dayforce public application identity unavailable')
  if (detail.isInternal || detail.postingStatus !== 1) { reasons.add('native-posting-not-active-or-public:' + id); return null }
  const raw = detail.jobPostingContent
  valid(raw && typeof raw === 'object' && !Array.isArray(raw), 'Dayforce full native content unavailable')
  const keys = ['jobDescriptionHeader', 'jobDescription', 'jobDescriptionFooter']
  valid(keys.every(key => raw[key] == null || typeof raw[key] === 'string'), 'Dayforce native content schema changed')
  const fragments = keys.map(key => visibleDescription(raw[key])), full = Boolean(fragments[1])
  if (!full) reasons.add('native-description-incomplete:dayforce:' + id)
  const description = full ? fragments.filter(Boolean).join('\n\n') : null
  const india = known ? locations.filter(row => row.country === 'IN') : []
  const url = O + (culture === 'en-US' ? '' : '/' + culture) + '/prounlimited/CANDIDATEPORTAL/jobs/' + id
  return { source: 'magnitglobal', company: 'Magnit Global', nativeEmployerBrand: 'Magnit', jobId: String(id), requisitionId: String(detail.jobReqId),
    title: detail.jobTitle, country: india.length ? 'India' : null, city: india.length === 1 ? india[0].city || null : null,
    location: india.map(row => row.address || [row.city, row.state, 'India'].filter(Boolean).join(', ')).join(' / ') || null,
    locations: india.map(row => row.address || [row.city, row.state, 'India'].filter(Boolean).join(', ')), sourceUrl: url, applyUrl: url, link: url,
    jobDescription: description, sourceDescription: description, sourceDetailComplete: full,
    sourceDetailFailureKind: full ? null : 'missing-content', nativeDescriptionSHA256: full ? hash(description) : null,
    sourceNativeDescriptionFragmentCount: full ? fragments.filter(Boolean).length : 0,
    postingDate: dateUTC(detail.postingStartTimestampUTC), closingDate: qualifiedClosingDate(dateUTC(detail.postingExpiryTimestampUTC)),
    sourcePublicationDateUnavailable: !detail.postingStartTimestampUTC, remoteStatus: detail.hasVirtualLocation === true ? 'Remote' : null,
    sourceNativeCountryEvidence: { system: 'Dayforce', selectedIndiaLocations: india, nativeLocations: detail.postingLocations },
    sourceNativeEmployerEvidence: { brand: 'Magnit', clientNamespace: 'prounlimited', clientId: 80745, jobBoardId: 1, culture, legalEmployer: null },
    sourceNativeDates: { postingStartTimestampUTC: detail.postingStartTimestampUTC, postingExpiryTimestampUTC: detail.postingExpiryTimestampUTC },
    sourceNativePostingStatus: detail.postingStatus }
}
const defaultFetchPage = async (url, init) => {
  const response = await fetch(url, { ...init, redirect: init.method === 'POST' ? 'error' : 'follow' })
  return { status: response.status, url: response.url, body: await response.text(), contentType: response.headers.get('content-type'), setCookies: response.headers.getSetCookie() }
}
export const createMagnitNativeInventory = (defaults = {}) => ({
  async run(options = {}) {
    const settings = { ...defaults, ...options }, signal = settings.signal, load = settings.fetchPage || defaultFetchPage
    const now = settings.now || (() => new Date().toISOString()), maxJobs = settings.maxJobs ?? 0, maxPages = settings.maxPages ?? 50
    valid(Number.isSafeInteger(maxJobs) && maxJobs >= 0 && Number.isSafeInteger(maxPages) && maxPages > 0 && maxPages <= 100, 'invalid native enumeration/output budget')
    valid(!(settings.fetchText || settings.fetchJson || settings.searchJobPostings || settings.createDayforceSessionImpl) || settings.fetchPage, 'current native transport requires fetchPage')
    signal?.throwIfAborted()
    const reasons = new Set(), references = { dayforce: new Set(), direct: new Set() }
    let requests = 0
    const pageAt = async (url, init = {}, final = url) => {
      signal?.throwIfAborted()
      const response = await load(url, { ...init, method: init.method || 'GET', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000),
        headers: { Accept: 'text/html,application/json', ...init.headers } })
      signal?.throwIfAborted(); requests++
      valid(response?.url === final, 'native response redirected outside the verified binding')
      if (response.status !== 200) { const error = Error('Magnit public native HTTP ' + response.status); error.status = response.status; throw error }
      valid(typeof response.body === 'string' && Buffer.byteLength(response.body) <= 4 * 1024 * 1024
        && /^(?:text\/html|application\/json)\b/i.test(response.contentType || ''), 'native response format changed')
      if (/^text\/html\b/i.test(response.contentType || '') && url !== L) inspectScope(response.body, response.url, reasons, references)
      return response
    }
    const scope = async () => {
      const corporate = await pageAt(C), bindings = verifyCorporate(corporate.body)
      verifyLegacy((await pageAt(L)).body)
      const board = readDayforceContext((await pageAt(D)).body).info
      const india = readDayforceContext((await pageAt(E, {}, D)).body).info
      valid(india.clientId === board.clientId && india.jobBoardId === board.jobBoardId && JSON.stringify(india.isoCultureCodes) === JSON.stringify(board.isoCultureCodes), 'India legacy native board account equivalence changed')
      const home = readMagnitVisible((await pageAt(W)).body)
      valid(clean(one(home.nodes(n => n.tag === 'title'), 'DirectSource native employer title').raw) === 'Magnit Global Talent Network'
        && home.nodes(n => n.tag === 'a' && n.attrs.href === '/eu/magnitglobal/jobs' && /Browse Jobs|View all jobs/i.test(home.text(n))).length > 0,
        'DirectSource current employer/jobs handoff changed')
      return { bindings, board, direct: readDirectList((await pageAt(J)).body, reasons) }
    }
    const initial = await scope(), csrf = await pageAt(O + '/api/auth/csrf'), csrfToken = json(csrf.body).csrfToken
    const cookies = Array.isArray(csrf.setCookies) ? csrf.setCookies.map(line => String(line).split(';')[0]).filter(Boolean).join('; ') : ''
    valid(typeof csrfToken === 'string' && /^[\da-f]{64}$/i.test(csrfToken) && cookies, 'public anonymous Dayforce search session unavailable')
    const headers = { Accept: 'application/json', 'Content-Type': 'application/json', Cookie: cookies, 'X-CSRF-TOKEN': csrfToken, Origin: O, Referer: D }
    const collect = async cultures => {
      const rows = new Map(), perCulture = new Map()
      for (const culture of cultures) {
        const postings = new Map()
        let total
        for (let page = 0; page < maxPages; page++) {
          const offset = page * 25, request = { clientNamespace: 'prounlimited', jobBoardCode: 'CANDIDATEPORTAL', cultureCode: culture,
            distanceUnit: 1, exactLocationOnly: false, paginationStart: offset }
          const data = json((await pageAt(SEARCH, { method: 'POST', headers, body: JSON.stringify(request) })).body)
          valid(Array.isArray(data.jobPostings) && Number.isSafeInteger(data.maxCount) && data.maxCount >= 0 && data.offset === offset
            && data.count === data.jobPostings.length && (total == null || total === data.maxCount), 'Dayforce pagination count/offset inventory changed')
          total = data.maxCount
          valid(data.jobPostings.length === Math.min(25, Math.max(0, total - offset)), 'Dayforce pagination inventory truncated')
          for (const row of data.jobPostings) {
            valid(row?.clientNamespace === 'prounlimited' && row.jobBoardId === 1 && positiveId(row.jobPostingId) && positiveId(row.jobReqId)
              && typeof row.jobTitle === 'string' && clean(row.jobTitle) && !postings.has(row.jobPostingId), 'Dayforce search posting identity invalid or duplicate')
            postings.set(row.jobPostingId, row)
            const previous = rows.get(row.jobPostingId)
            valid(!previous || previous.row.jobReqId === row.jobReqId && countrySignature(previous.row.postingLocations) === countrySignature(row.postingLocations), 'Dayforce cross-locale posting identity conflicts')
            if (!previous) rows.set(row.jobPostingId, { row, culture })
          }
          if (postings.size === total) break
        }
        valid(postings.size === total, 'Dayforce pagination budget exhausted before complete inventory')
        perCulture.set(culture, postings)
      }
      return { rows, perCulture }
    }
    const native = await collect(initial.board.isoCultureCodes), jobs = new Map()
    for (const [id, { row, culture }] of native.rows) {
      const detail = json((await pageAt(O + '/api/geo/prounlimited/jobposting/prounlimited/' + culture + '/1/' + id, { headers })).body)
      const publicUrl = O + (culture === 'en-US' ? '' : '/' + culture) + '/prounlimited/CANDIDATEPORTAL/jobs/' + id
      const rendered = readDayforceContext((await pageAt(publicUrl)).body, culture, id).posting
      const job = readDayforceDetail(detail, rendered, row, culture, reasons)
      if (job?.country === 'India') jobs.set(job.jobId, job)
    }
    for (const row of initial.direct.roles.values()) {
      const job = readDirectDetail((await pageAt(row.url)).body, row, reasons)
      if (job?.country === 'India') jobs.set(job.jobId, job)
    }
    const closing = await scope(), finalNative = await collect(closing.board.isoCultureCodes)
    if (JSON.stringify(initial.bindings) !== JSON.stringify(closing.bindings) || JSON.stringify(initial.board.isoCultureCodes) !== JSON.stringify(closing.board.isoCultureCodes)
      || initial.direct.total !== closing.direct.total || JSON.stringify([...initial.direct.roles]) !== JSON.stringify([...closing.direct.roles])) reasons.add('closing-native-scope-or-DirectSource-inventory-changed')
    for (const [culture, rows] of native.perCulture) {
      const finalRows = finalNative.perCulture.get(culture)
      if (!finalRows || rows.size !== finalRows.size || [...rows].some(([id, row]) => searchState(row) !== searchState(finalRows.get(id)))) reasons.add('closing-Dayforce-inventory-changed')
    }
    if ([...references.dayforce].some(id => !native.rows.has(id) || !finalNative.rows.has(id))
      || [...references.direct].some(id => !initial.direct.roles.has(id) || !closing.direct.roles.has(id))) reasons.add('advertised-native-posting-identity-unreconciled')
    const healthy = [...jobs.values()].filter(job => {
      if (job.jobId.startsWith('directsource:')) return closing.direct.roles.get(job.jobId.split(':')[1])?.url === job.sourceUrl
      const id = Number(job.jobId), row = native.rows.get(id), after = finalNative.rows.get(id)
      return after && after.culture === row.culture && searchState(after.row) === searchState(row.row)
    })
    const selected = maxJobs ? healthy.slice(0, maxJobs) : healthy
    if (selected.length !== healthy.length) reasons.add('source-job-limit')
    const complete = reasons.size === 0, verifiedAt = new Date(now()).toISOString()
    for (const job of selected) Object.assign(job, { scrapedAt: verifiedAt, sourceListingComplete: complete, sourceScopeComplete: complete,
      lifecycleCleanupAllowed: complete, companyCareerPage: C, companyDomain: 'magnitglobal.com', atsPlatform: 'dayforce+directsource' })
    return attachInventoryEvidence(selected, { status: complete ? native.rows.size + initial.direct.roles.size ? 'complete-inventory' : 'verified-empty' : 'discovery-only',
      firstParty: true, surface: C, listingComplete: complete, reportedTotal: complete ? native.rows.size + initial.direct.roles.size : null,
      indiaFacetCount: complete ? healthy.length : null, pagesFetched: requests, verifiedAt,
      reason: complete ? 'magnit-all-current-native-systems-and-locales-reconciled' : 'magnit-native-incomplete:' + [...reasons].join(';') })
  },
})
