import { readNativeDocument, activeHead } from '../../scraper-support/utils/activeNativeHtml.js'
import { document as slices } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { nativeDate } from '../../scraper-support/shared/nativeJobPosting.js'
import { readLiteralModel } from '../../scraper-support/native-sources/literalModel.js'
import { need, one, norm, all, page, props, authoredLines, semanticCriteria, constraints, writtenPlaceCountries, nativeCountryName, projection, retainDateModels } from './currentFacts20261121.js'

export const HOME = 'https://corp.rakuten.co.in/', PORTAL = 'https://rakuten.openings.co/', PORTAL_CURRENT = PORTAL + 'rakuten/'
export const CONFIG = 'https://apic2.zwayam.com/data-service/v2/company/15124/careersite-configurations', LIST = 'https://apic2.zwayam.com/jobs/search', DETAIL = 'https://apic2.zwayam.com/jobs-service/v1/jobs/careersite'
const key = value => String(value).replace(/^data[-_:]/i, '').replace(/[-_\s]/g, '').toLowerCase()
const applicationKeys = new Set(['applyurl', 'applicationurl', 'jobapplicationurl', 'jobapplicationuri', 'applicationlink', 'applylink', 'applicationuri', 'applyuri', 'careersiteredirectionurl'])
const countryKeys = new Set(['country', 'countrycode', 'countryname', 'addresscountry', 'jobcountry', 'workcountry', 'workplacecountry', 'worklocationcountry'])
const placeKeys = new Set(['location', 'locations', 'joblocation', 'joblocations', 'worklocation', 'worklocations', 'workplace', 'workplaces', 'formattedlocation', 'locationdisplayformanagejobs', 'locationseparatedbyslash', 'locagg'])
const employers = new Set(['employer', 'employername', 'company', 'companyname', 'hiringorganization', 'legalemployer'])
const unscoped = new Set(['otherstatusone', 'otherstatustwo', 'appliesnotblocked'])
const context = at => ({ employer: 'Rakuten', observedAt: at, countryAlternatives: ['India'] })
export function json(text) { need(typeof text === 'string' && Buffer.byteLength(text) <= 6000000, 'finite native JSON'); return readLiteralModel(text).value }
function publicURL(value, base = PORTAL_CURRENT) { need(typeof value === 'string' && value === value.trim() && value, 'native URL malformed'); const u = new URL(value, base); need(u.protocol === 'https:' && !u.username && !u.password && !u.port, 'native HTTPS URL differs'); return u }
const roleURL = row => PORTAL_CURRENT + 'jobview/' + encodeURIComponent(row.jobUrl) + '?id=' + encodeURIComponent(row.id)
function applications(properties, allowed) { for (const p of properties) if (applicationKeys.has(key(p.key)) && p.value != null && p.value !== '') need(typeof p.value === 'string' && allowed.includes(publicURL(p.value).href), 'same-role native application alias conflicts') }
function nativeDay(value) {
  if (typeof value === 'number') { need(Number.isSafeInteger(value) && value > 0, 'native epoch date malformed'); return { ...nativeDate(new Date(value).toISOString(), { required: true }), raw: value } }
  const match = typeof value === 'string' && /^(\d{2})-([A-Za-z]{3})-(\d{4})$/.exec(value)
  if (match) { const month = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(match[2].toLowerCase()); need(month >= 0, 'native date month unknown'); return { ...nativeDate(match[3] + '-' + String(month + 1).padStart(2, '0') + '-' + match[1], { required: true }), raw: value } }
  return nativeDate(value, { required: true })
}
function datesFor(record, at) {
  const dates = { posted: [], expiry: [] }
  for (const field of ['createdDate', 'createDate', 'jobCreatedDate', 'datePosted', 'postedDate', 'postingDate', 'publishedAt']) if (record[field] != null && record[field] !== '') {
    const date = nativeDay(record[field]); need(date.exact ? Date.parse(date.iso) <= Date.parse(at) : date.iso.slice(0, 10) <= at.slice(0, 10), 'native creation/publication date future'); dates.posted.push({ field, ...date })
  }
  for (const field of ['endtDate', 'closingDate', 'validThrough', 'applicationDeadline', 'expiryDate']) if (record[field] != null && record[field] !== '') {
    const date = nativeDay(record[field]); need(date.exact ? Date.parse(date.iso) >= Date.parse(at) : date.iso.slice(0, 10) >= at.slice(0, 10), 'native application expiry elapsed'); dates.expiry.push({ field, ...date })
  }
  if (record.startDate != null) { const date = nativeDay(record.startDate); need(Date.parse(date.iso) <= Date.parse(at), 'native current-date range has not started') }
  return dates
}
function country(value) { const raw = value && typeof value === 'object' ? value.name : value; need(nativeCountryName(raw) === 'India', 'native explicit country contradicts India'); if (value && typeof value === 'object') for (const field of ['code', 'countryCode', 'alternateName', 'identifier']) if (value[field] != null) need(nativeCountryName(value[field]) === 'India', 'native country aliases differ') }
const types = model => (Array.isArray(model?.['@type']) ? model['@type'] : [model?.['@type']]).map(t => String(t ?? '').replace(/^https?:\/\/schema\.org\//, ''))
function issuer(value, publisher) {
  const label = typeof value === 'object' ? value.name : value
  need(publisher ? /\bRakuten\b/.test(label ?? '') : label === 'Rakuten', 'native exact issuer/employer conflicts')
  if (value && typeof value === 'object') {
    if (value['@context'] != null) need(/^https?:\/\/schema\.org\/?$/.test(value['@context']), 'native issuer context differs')
    if (value['@type'] != null) need(types(value).includes('Organization'), 'native issuer type differs')
    for (const field of ['url', '@id', 'sameAs']) if (value[field] != null) {
      const identities = Array.isArray(value[field]) ? value[field] : [value[field]]
      need(identities.length > 0 && identities.length <= 16, 'native issuer identities malformed')
      for (const identity of identities) { const u = publicURL(identity); u.hash = ''; need([HOME, PORTAL, PORTAL_CURRENT].includes(u.href), 'native issuer URL identifies a different account') }
    }
  }
}
function structured(p, wanted) {
  const result = []; let count = 0
  function visit(value, inherited, script, depth = 0) {
    need(depth <= 32 && ++count <= 30000, 'finite current native structured criteria')
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) { value.forEach(v => visit(v, inherited, script, depth + 1)); return }
    const context = Object.hasOwn(value, '@context') ? value['@context'] : inherited
    if (types(value).some(t => wanted.includes(t))) result.push({ model: value, context, script })
    for (const [key, child] of Object.entries(value)) if (key !== '@context' && child && typeof child === 'object') visit(child, context, script, depth + 1)
  }
  for (const script of p.d.nodes(n => n.tag === 'script' && !n.attrs.src && (n.attrs.type ?? '').trim().toLowerCase() === 'application/ld+json')) visit(readLiteralModel(script.raw ?? '').value, undefined, script)
  return result
}
function recordFacts(model, row, at, allowed, { publisher = false, geography = true } = {}) {
  let visited = 0
  const visit = (value, depth = 0) => {
    need(depth <= 32 && ++visited <= 30000, 'finite known native role facts')
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) { value.forEach(v => visit(v, depth + 1)); return }
    if (value['@context'] != null) need(typeof value['@context'] === 'string' && /^https?:\/\/schema\.org\/?$/.test(value['@context']), 'native known criteria context differs')
    if (geography && types(value).some(t => ['Place', 'PostalAddress'].includes(t))) for (const field of ['name', 'addressLocality', 'addressRegion', 'streetAddress']) if (value[field] != null) need(writtenPlaceCountries(value[field]).every(c => c === 'India'), 'native structured workplace wording conflicts with India')
    const generic = []
    for (const [field, entry] of Object.entries(value)) {
      if (entry == null || entry === '') continue
      const name = key(field)
      if (unscoped.has(name)) continue
      if (!geography && (countryKeys.has(name) || placeKeys.has(name) || ['applicantlocationrequirements', 'eligibleregion'].includes(name))) continue
      if (name === 'status') { need(entry === 1 || typeof entry === 'string' && /^(?:open|active|published|available|approved|posted)$/i.test(entry), 'native active publication status unavailable'); continue }
      if (name === 'displaystatus') { need(entry === 'Open', 'native selected display status not Open'); continue }
      if (name === 'jobvisibiltylevel' || name === 'jobvisibilitylevel') { need(['N', 'L'].includes(entry), 'native job visibility hidden/private/unqualified'); continue }
      if (name === 'requisitionstatus') { need(entry === 'A', 'native active requisition status differs'); continue }
      if (name === 'iscompanylive') { need(entry === 1, 'native company not live'); continue }
      if (name === 'jobtype') { need(entry === 'J', 'native record is not a vacancy'); continue }
      if (name === 'privatejobshare') { need(entry === 'N', 'native private job cannot qualify public publication'); continue }
      if (name === 'companyid') { need(String(entry) === '15124', 'native role belongs to a different account'); continue }
      if (name === 'jobid' && row) { need(String(entry) === row.id, 'native nested public role ID differs'); continue }
      if (name === 'joburl') { if (value === model) need(entry === row?.jobUrl, 'native public role slug differs'); else need(entry === row?.jobUrl || allowed.includes(publicURL(entry).href), 'native same-role URL differs'); continue }
      if (employers.has(name) || name === 'publisher') { issuer(entry, publisher); if (typeof entry === 'object') visit(entry, depth + 1); continue }
      if (countryKeys.has(name)) { country(entry); if (entry && typeof entry === 'object') visit(entry, depth + 1); continue }
      if (['applicantlocationrequirements', 'eligibleregion'].includes(name)) {
        const values = Array.isArray(entry) ? entry : [entry]
        need(values.length > 0 && values.length <= 32, 'native applicant eligibility scope malformed')
        for (const value of values) { if (typeof value === 'object') need(types(value).includes('Country'), 'native applicant geographic type unresolved'); country(value); if (typeof value === 'object') visit(value, depth + 1) }
        continue
      }
      if (placeKeys.has(name)) for (const place of Array.isArray(entry) ? entry : [entry]) {
        need(typeof place === 'string' || place && typeof place === 'object', 'native supplied workplace malformed')
        if (typeof place === 'string') need(writtenPlaceCountries(place).every(c => c === 'India'), 'native role workplace conflicts with India')
      }
      if (['careersiteurl', 'domainurl'].includes(name)) { const u = publicURL(entry.includes('://') ? entry : 'https://' + entry); need(u.hostname === 'rakuten.openings.co', 'native role employer domain conflicts') }
      if (applicationKeys.has(name)) applications([{ key: field, value: entry }], allowed)
      if (!['createddate', 'createdate', 'jobcreateddate', 'modifieddate', 'startdate', 'endtdate'].includes(name)) generic.push({ key: field, value: entry })
      if (entry && typeof entry === 'object') visit(entry, depth + 1)
    }
    constraints(generic.filter(p => !employers.has(key(p.key)) && !countryKeys.has(key(p.key)) && !applicationKeys.has(key(p.key))), [], context(at))
  }
  visit(model)
}
function htmlFacts(html, url, at, allowed, row) {
  const p = page(html, url, { canonical: false, requireTitle: false }), nodes = all(p.root, () => true), semantic = semanticCriteria(p.root)
  const originalText = node => typeof node === 'string' ? node : ['style', 'script'].includes(node.tag) ? '' : node.children.map(originalText).join(' ')
  for (const node of nodes) if (node.inert || node.inactive || Object.hasOwn(node.attrs, 'hidden') || Object.hasOwn(node.attrs, 'inert') || node.attrs['aria-hidden'] === 'true' || /(?:^|\s)(?:hidden|sr-only|d-none)(?:\s|$)/.test(node.attrs.class ?? '')) need(!norm(originalText(node)) && !(node.tag === 'script' && (node.attrs.type ?? '').trim().toLowerCase() === 'application/ld+json' && norm(node.raw)), 'native hidden or inert role criteria require review')
  const properties = [...props(nodes), ...semantic.properties]
  applications(properties, allowed)
  const lines = [...authoredLines(p.root), ...semantic.lines], dates = constraints(properties, lines, context(at))
  for (const line of lines) {
    const person = /\b(?:you|applicants?|candidates?|employees?)\s+(?:(?:can|may|must|will|should|need to)\s+)?(?:be\s+)?(?:(?:based|located|resident|reside)\s+(?:(?:only|exclusively)\s+)*(?:in|from)|work(?:ing)?\s+(?:(?:only|exclusively|remotely)\s+)*from)\s+(.+)/i.exec(line)
    const role = /\b(?:this|the)\s+(?:role|position|job)\s+(?:(?:can|may|must|will|should)\s+be|is)\s+(?:performed|done|worked|based|located|available|open)\s+(?:(?:only|exclusively|remotely)\s+)*(?:in|from|to)\s+(.+)/i.exec(line)
    if (person || role) need(writtenPlaceCountries((person ?? role)[1]).every(c => c === 'India'), 'authored explicit role/applicant workplace conflicts with India')
    const direct = /\b(?:you|applicants?|candidates?|employees?)\s+(?:(?:can|may|must|will|should)\s+)?work\s+in\s+(.+?)[.!]?$/i.exec(line), directCountry = direct ? nativeCountryName(direct[1]) : null
    if (directCountry) need(directCountry === 'India', 'authored explicit direct work country conflicts with India')
  }
  for (const link of p.d.nodes(n => ['a', 'button'].includes(n.tag) && /^(?:apply|apply now|apply for this (?:job|role))$/i.test(norm(p.d.text(n))))) {
    need(!Object.hasOwn(link.attrs, 'disabled') && link.attrs['aria-disabled'] !== 'true', 'same-role Apply control disabled')
    publisherCarriers(p, [link], at, allowed)
    const target = link.attrs.href ?? link.attrs['data-application-url']
    if (target) need(allowed.includes(publicURL(target, url).href), 'same-role authored Apply target differs')
  }
  for (const { model, context: schemaContext } of structured(p, ['JobPosting', 'WebPage', 'AboutPage', 'Place', 'PostalAddress'])) {
    need(/^https?:\/\/schema\.org\/?$/.test(schemaContext ?? ''), 'native criteria schema context differs')
    if (model.url != null) need(allowed.includes(publicURL(model.url, url).href), 'native criteria URL differs')
    if (model.title != null && row) need(norm(model.title) === row.title, 'native criteria title differs')
    if (model.name != null && row && types(model).some(t => ['WebPage', 'AboutPage', 'JobPosting'].includes(t))) need(norm(model.name) === row.title || /\bRakuten\b/.test(model.name) || /^(?:Careers|Job details|Job opening)$/i.test(norm(model.name)), 'native same-role page name identifies a different role/publisher')
    recordFacts(model, row, at, allowed)
  }
  return { dates, text: p.d.text(p.root), originalHTML: html }
}
const nodePath = (node, target, parents = []) => node === target ? [...parents, node] : node.children.filter(c => typeof c !== 'string').map(c => nodePath(c, target, [...parents, node])).find(Boolean)
function publisherCarriers(p, nodes, at, allowed) {
  for (const node of nodes) {
    const chain = nodePath(p.root, node) ?? []
    need(chain.length && chain.every(n => !Object.hasOwn(n.attrs, 'hidden') && !Object.hasOwn(n.attrs, 'inert') && !Object.hasOwn(n.attrs, 'disabled') && n.attrs['aria-hidden'] !== 'true' && n.attrs['aria-disabled'] !== 'true'), 'native current publisher/handoff explicitly withdrawn')
    const facts = props(chain); applications(facts, allowed); constraints(facts, [], context(at))
  }
}
export function readCurrentOwn(html, { observedAt = new Date().toISOString() } = {}) {
  const p = page(html, HOME, { canonical: false }), head = activeHead(html)
  need(/\bRakuten\b/.test(p.title ?? ''), 'current own publisher title differs')
  for (const h of p.d.nodes(n => n.tag === 'h1')) need(/\bRakuten\b/.test(p.d.text(h)) || /^(?:Careers|Career opportunities|Join our team|Explore current career opportunities)$/i.test(norm(p.d.text(h))), 'current own h1 explicitly identifies another publisher')
  const anchors = p.d.nodes(n => n.tag === 'a' && n.attrs.href).filter(n => { try { return publicURL(n.attrs.href, HOME).href === PORTAL } catch { return false } })
  need(anchors.length > 0 && anchors.length <= 8, 'current literal own native careers declaration absent/ambiguous')
  const canonicals = p.d.nodes(n => n.tag === 'link' && (n.attrs.rel ?? '').toLowerCase() === 'canonical')
  if (canonicals.length) need(publicURL(one(canonicals, 'own canonical').attrs.href, HOME).href === HOME, 'own canonical differs')
  for (const meta of head.metas) {
    if (['og:site_name', 'og:title'].includes(meta.property) || meta.name === 'publisher') need(/\bRakuten\b/.test(meta.content ?? ''), 'own named publisher metadata differs')
    if (meta.property === 'og:url') need(publicURL(meta.content, HOME).href === HOME, 'own OpenGraph page identity differs')
  }
  // The current own page streams its document metadata after the body content.
  // Qualify that actual active title carrier without moving or executing it.
  const titles = p.d.nodes(n => n.tag === 'title' && norm(n.raw) === p.title)
  const title = one(titles, 'active current publisher title'), titleOwner = nodePath(p.root, title)?.at(-2)
  need(titleOwner && ['head', 'body'].includes(titleOwner.tag), 'current document title is not the native metadata carrier')
  const metadata = [['name', 'publisher'], ['property', 'og:title'], ['property', 'og:url'], ['property', 'og:site_name']].map(([key, value]) => one(titleOwner.children.filter(n => typeof n !== 'string' && n.tag === 'meta' && n.attrs[key] === value), 'current title-associated publisher metadata ' + value))
  publisherCarriers(p, [title, ...metadata, ...anchors, ...canonicals, ...p.d.nodes(n => n.tag === 'h1')], observedAt, [HOME, PORTAL])
  for (const { model, context: schemaContext, script } of structured(p, ['WebPage', 'AboutPage', 'WebSite', 'Organization'])) {
    const current = [model.url, model['@id']].filter(v => typeof v === 'string').some(value => { const u = publicURL(value, HOME); u.hash = ''; return u.href === HOME })
    if (!current) continue
    need(/^https?:\/\/schema\.org\/?$/.test(schemaContext ?? ''), 'current own publisher schema context differs')
    if (model.name != null) need(/\bRakuten\b/.test(model.name) || /^(?:Careers|Career opportunities)$/i.test(norm(model.name)), 'current own structured publisher name differs')
    for (const field of ['url', '@id']) if (model[field] != null) { const u = publicURL(model[field], HOME); u.hash = ''; need(u.href === HOME, 'current own structured publisher URI differs') }
    publisherCarriers(p, [script], observedAt, [HOME, PORTAL]); recordFacts(model, null, observedAt, [HOME, PORTAL], { publisher: true })
  }
  const semantic = semanticCriteria(p.root); applications(semantic.properties, [HOME, PORTAL]); constraints(semantic.properties, semantic.lines, context(observedAt))
  return { portalURL: PORTAL, originalTitle: p.title, originalMetas: head.metas, originalCareersAnchors: anchors.map(n => ({ attributes: structuredClone(n.attrs), text: p.d.text(n) })), companyInventoryComplete: false }
}
export function readCurrentPortal(html, { observedAt = new Date().toISOString() } = {}) {
  const document = readNativeDocument(html), bases = document.nodes(n => n.tag === 'base'), base = one(bases, 'native exact public application base')
  need(base.attrs.href === '/rakuten/', 'current native portal base differs')
  const raw = slices(html), originalBase = one(all(raw.root, n => n.tag === 'base'), 'original native base carrier'), originalBaseHTML = raw.outer(originalBase)
  need(html.split(originalBaseHTML).length === 2, 'unique native base original bytes')
  const stripped = html.replace(originalBaseHTML, ''), p = page(stripped, PORTAL_CURRENT, { canonical: false })
  need(/\bRakuten\b/.test(p.title ?? ''), 'current native portal publisher differs')
  const roots = p.d.nodes(n => n.tag === 'app-root'); one(roots, 'current native app-root')
  const modules = p.d.nodes(n => n.tag === 'script' && n.attrs.type === 'module' && n.attrs.src)
  need(modules.length > 0 && modules.length <= 8, 'native module handoff missing/ambiguous')
  const main = modules.at(-1), url = publicURL(main.attrs.src, PORTAL_CURRENT)
  need(url.origin === new URL(PORTAL).origin && url.pathname.startsWith('/rakuten/') && url.pathname.endsWith('.js') && !url.search && !url.hash, 'native main module unbound')
  publisherCarriers(p, [main, ...roots], observedAt, [PORTAL, PORTAL_CURRENT])
  return { clientURL: url.href, originalTitle: p.title, originalBaseAttributes: base.attrs, originalModuleAttributes: main.attrs, originalHeadMetadata: activeHead(html).metas }
}
export function readCurrentConfiguration(text, { observedAt = new Date().toISOString() } = {}) {
  const value = json(text)
  need(value.responseStatus === 'SUCCESS' && value.reponseObject?.company?.companyName === 'Rakuten' && value.reponseObject.company.domainName === 'rakuten.openings.co', 'current public native company configuration differs')
  recordFacts(value.reponseObject.company, null, observedAt, [PORTAL, PORTAL_CURRENT], { publisher: true, geography: false })
  return { company: 'Rakuten', companyId: '15124', domain: 'rakuten.openings.co', originalConfiguration: value, legalEmployer: null }
}
function qualifyRow(record, wrapper, at) {
  need(record && typeof record === 'object' && !Array.isArray(record) && String(record.id) === String(wrapper._id) && /^\d+$/.test(String(record.id)), 'native wrapper/public role ID differs')
  need(typeof record.jobTitle === 'string' && norm(record.jobTitle) && typeof record.jobUrl === 'string' && /^[a-z0-9-]+$/i.test(record.jobUrl), 'native job title/slug missing')
  const row = { id: String(record.id), title: norm(record.jobTitle), jobUrl: record.jobUrl, location: record.location, locations: [record.location], originalRecord: structuredClone(record) }
  row.url = roleURL(row)
  need(typeof row.location === 'string' && writtenPlaceCountries(row.location).includes('India'), 'native role lacks an explicit India workplace')
  need(record.status === 1, 'native selected row is not status1')
  recordFacts(record, row, at, [row.url]); datesFor(record, at)
  return row
}
export function readCurrentInventory(text, { observedAt = new Date().toISOString() } = {}) {
  const model = json(text), data = model.data, config = data?.facetedSearchConfig
  need(model.code === 200 && data && Array.isArray(data.data) && Number.isSafeInteger(data.totalCount) && data.totalCount > 0 && data.totalCount <= 100 && data.data.length === data.totalCount && data.hasMoreData === false, 'native configured public inventory incomplete')
  need(config?.companyId === '15124' && config.domain === 'rakuten.openings.co' && Number(config.paginationHowMuch) >= data.totalCount, 'native configured account/pagination differs')
  const selected = config.queryCriteria?.careersite
  need(selected && Array.isArray(selected.and) && Array.isArray(selected.not), 'native selected public query unavailable')
  const positive = field => one(selected.and.filter(v => v.fieldName === field), 'native current selector ' + field)
  for (const [name, expected] of [['companyId', '15124'], ['status', '1'], ['jobType', 'J']]) { const v = positive(name); need(v.fieldValueString === expected && ['term', 'matchPhrase'].includes(v.type), 'native selected public ' + name + ' changed') }
  const range = one(selected.and.filter(v => v.type === 'currentDateRange'), 'native current date selection')
  need(range.dynamicQueryField1 === 'startDate' && range.dynamicQueryField2 === 'endtDate', 'native selected date fields differ')
  const visibility = selected.not.filter(v => v.fieldName === 'jobVisibiltyLevel').map(v => v.fieldValueString).sort()
  need(JSON.stringify(visibility) === '["C","P"]', 'native selected private/hidden exclusions changed')
  const rows = [], held = [], seen = new Set()
  for (const wrapper of data.data) {
    need(wrapper && typeof wrapper === 'object' && wrapper._source && !seen.has(String(wrapper._id)), 'native wrapper missing/duplicate'); seen.add(String(wrapper._id))
    try { rows.push(qualifyRow(wrapper._source, wrapper, observedAt)) } catch (error) { held.push({ id: String(wrapper._id), reason: error.message, originalWrapper: structuredClone(wrapper) }) }
  }
  return { rows, held, nativeConfiguredReportedCount: data.totalCount, originalQueryCriteria: structuredClone(config.queryCriteria), originalPagination: structuredClone(config), configuredScopeOnly: true, companyInventoryComplete: false }
}
export function inspectCurrentRole(text, row, { observedAt = new Date().toISOString() } = {}) {
  const detail = json(text)
  need(String(detail.id) === row.id && detail.jobUrl === row.jobUrl && norm(detail.jobTitle) === row.title && detail.location === row.location, 'same-role native detail identity/location differs')
  need(detail.status === 1, 'native current public detail is not status1')
  recordFacts(detail, row, observedAt, [row.url])
  const dates = datesFor(detail, observedAt), originalDates = datesFor(row.originalRecord, observedAt)
  dates.posted.push(...originalDates.posted); dates.expiry.push(...originalDates.expiry)
  const fields = detail.jobConfigurationData
  need(fields && typeof fields === 'object' && !Array.isArray(fields) && typeof fields.Description === 'string' && norm(fields.Description), 'full original native description absent')
  const descriptions = []
  for (const [name, value] of Object.entries(fields)) if (value != null && value !== '') {
    need(typeof value === 'string', 'native public criteria field malformed')
    const result = htmlFacts(value, row.url, observedAt, [row.url], row)
    applications([{ key: name, value: result.text }], [row.url]); constraints([{ key: name, value: result.text }], [name + ': ' + result.text], context(observedAt))
    dates.posted.push(...result.dates.posted); dates.expiry.push(...result.dates.expiry)
    if (name === 'Description') descriptions.push(result.text)
  }
  for (const field of ['longDescription', 'shortDescription', 'shortDescriptionDb', 'mediumDescriptionWithoutHtml']) if (detail[field]) htmlFacts(detail[field], row.url, observedAt, [row.url], row)
  const observed = { binding: { id: row.id, companyId: '15124', title: row.title, url: row.url, location: row.location, country: 'India' }, originalListingRecord: structuredClone(row.originalRecord), originalDetailRecord: detail }
  const job = projection({ source: 'rakuten', company: 'Rakuten', publisher: 'Rakuten', employer: 'Rakuten' }, row, observed, { description: descriptions.join('\n\n'), rawDescription: fields.Description, application: { kind: 'current-native-jobview-inline-public-apply-trigger', url: row.url, fetched: false, backendActivationVerified: false }, countryEvidence: { kind: 'same-role-explicit-native-workplace', rawLocation: row.location, country: 'India', originalJobLocationRecord: row.originalRecord.jobLocationRecord ?? null }, dates, city: row.location.split(',')[0].trim() })
  Object.assign(job, { sourceCompanyScopeUnresolved: true, originalNativeCriteriaFields: structuredClone(fields), sourceNativeReferenceNumber: detail.referenceNumber ?? row.originalRecord.referenceNumber ?? null, sourceNativeUnscopedMetadata: { otherStatusOne: row.originalRecord.otherStatusOne ?? null, otherStatusTwo: row.originalRecord.otherStatusTwo ?? null, appliesNotBlocked: row.originalRecord.appliesNotBlocked ?? null, meaning: 'Original unscoped metadata retained; enum and application/backend meanings unproven.' }, sourceNativeSelectedPublication: { status: detail.status, displayStatus: row.originalRecord.displayStatus, jobVisibility: detail.jobVisibiltyLevel, publicDetailResolved: true, currentClientSuccessClosedJob: false }, sourceNativeDatePolicy: 'Earliest actually supplied native creation/publication fact, without renewal by modifiedDate or job URL. First-ever publication, formal requisition and legal employer remain unproven.' })
  return retainDateModels(job, dates)
}
