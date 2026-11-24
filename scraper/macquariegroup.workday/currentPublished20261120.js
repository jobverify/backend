import { isDeepStrictEqual } from 'node:util'
import { readLiteralModel } from '../../scraper-support/native-sources/literalModel.js'
import { decodeNativeEntities } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { page, need, one, norm, cls, all, props, authoredLines, constraints, writtenPlaceCountries, retainDateModels, schemaPlaces, applicantGeography, scalarFields, nativeCountryName } from './currentFacts20261120.js'
import { createCurrentReader } from './currentRead20261120.js'

export const SOURCE = 'macquariegroup'
export const COMPANY = 'Macquarie Group'
export const CORPORATE = 'https://www.macquarie.com/in/en/careers.html'
export const ORIGIN = 'https://recruitment.macquarie.com'
export const SEARCH = ORIGIN + '/en_US/careers/SearchJobs'
const normalizedKey = value => String(value).replace(/^data-/i, '').replace(/[-_\s]/g, '').toLowerCase()
const applicationKeys = new Set(['applyurl', 'applicationurl', 'jobapplicationurl', 'applyuri', 'applicationuri', 'jobapplicationuri', 'applylink', 'applicationlink', 'jobapplicationlink', 'joburl', 'joburi'])
const semanticLabels = new Set(['employer', 'employername', 'company', 'companyname', 'hiringorganization', 'legalemployer', 'country', 'countrycode', 'jobcountry', 'workcountry', 'addresscountry', 'location', 'joblocation', 'worklocation', 'workplace', 'status', 'jobstatus', 'postingstatus', 'publicationstatus', 'availability', 'ispublished', 'isactive', 'isclosed', 'dateposted', 'posteddate', 'postingdate', 'publishedat', 'publishedon', 'validthrough', 'closingdate', 'applicationdeadline', ...applicationKeys])
const config = at => ({ employer: COMPANY, observedAt: at, countryAlternatives: ['India'] })
const semanticTitle = value => norm(decodeNativeEntities(value))
function semanticProperties(nodes) {
  const properties = []
  for (const node of nodes) {
    const children = node.children.filter(child => typeof child !== 'string' && !child.inert && !child.inactive)
    for (let index = 0; index + 1 < children.length; index++) {
      const label = authoredLines(children[index]).join(' ').replace(/\s*:\s*$/, '')
      if (!semanticLabels.has(normalizedKey(label))) continue
      const value = authoredLines(children[index + 1]).join(' ')
      if (value) properties.push({ key: label, value })
    }
  }
  return properties
}
const pathTo = (root, target, path = []) => root === target ? [...path, root] : root.children.filter(node => typeof node !== 'string').map(node => pathTo(node, target, [...path, root])).find(Boolean)
const checkOwn = raw => {
  need(typeof raw === 'string' && raw.trim(), 'native own URI missing')
  const url = new URL(raw, SEARCH)
  need(url.origin === ORIGIN && !url.username && !url.password && !url.hash, 'native exact Macquarie account URI differs')
  return url
}
function roleURL(raw) {
  const url = checkOwn(raw)
  need(url.pathname === '/en_US/careers/JobDetail' && url.searchParams.size === 1 && /^[1-9]\d*$/.test(url.searchParams.get('jobId') ?? ''), 'native exact public role ID/path differs')
  return url.href
}
function applicationURL(raw, id) {
  const url = checkOwn(raw)
  need(url.pathname === '/en_US/careers/ApplicationMethods' && url.searchParams.size === 2 && url.searchParams.get('jobId') === id && url.searchParams.get('record') === id, 'native exact application account/public ID/record differs')
  return url.href
}
function qualify(nodes, lines, at, allowedApplications) {
  need(nodes.every(node => !node.inert && !node.inactive && !Object.hasOwn(node.attrs, 'disabled') && node.attrs['aria-disabled'] !== 'true' && !cls(node, 'disabled') && !cls(node, 'd-none') && !cls(node, 'hidden')), 'native actual publication/control disabled')
  for (const node of nodes) for (const [key, value] of Object.entries(node.attrs)) if (applicationKeys.has(normalizedKey(key))) need(allowedApplications.includes(new URL(value, SEARCH).href), 'native owned application alias differs')
  const semantic = semanticProperties(nodes)
  for (const property of semantic) if (applicationKeys.has(normalizedKey(property.key))) need(allowedApplications.includes(new URL(property.value, SEARCH).href), 'native semantic application URI differs')
  return constraints([...props(nodes), ...semantic], [...lines, ...semantic.map(property => property.key + ': ' + property.value)], config(at))
}
function nativePage(html, url, at, kind, additionalApplications = []) {
  const p = page(html, url, { canonical: false })
  const canonicalNode = one(p.d.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical'), 'native canonical')
  const canonical = checkOwn(canonicalNode.attrs.href)
  const meta = name => one(p.d.nodes(node => node.tag === 'meta' && node.attrs.name === name), 'native ' + name).attrs.content
  need(meta('avature.portal.id') === '46' && meta('avature.portal.name') === 'Careers' && meta('avature.portal.urlPath') === 'careers' && meta('avature.portal.lang') === 'en_US' && meta('avature.portal.page') === kind, 'native current Macquarie publisher/account/language/page differs')
  need(p.title.endsWith('Macquarie Group'), 'native current Macquarie title differs')
  const site = one(p.d.nodes(node => node.tag === 'meta' && node.attrs.property === 'og:site_name'), 'native publisher site name')
  need(site.attrs.content === COMPANY, 'native publisher site name differs')
  const ogURL = one(p.d.nodes(node => node.tag === 'meta' && node.attrs.property === 'og:url'), 'native current OG URI')
  need(decodeNativeEntities(ogURL.attrs.content) === (kind === 'SearchJobs' ? url : canonical.href), 'native actual OG publisher URI differs')
  if (kind === 'SearchJobs') need(one(p.d.nodes(node => node.tag === 'meta' && node.attrs.property === 'og:title'), 'native search OG title').attrs.content === 'Find Jobs - Careers', 'native current search OG title differs')
  const brand = one(p.d.nodes(node => node.tag === 'h1' && p.d.text(node) === 'Macquarie Group Home Page'), 'native exact publisher heading')
  const main = one(p.d.nodes(node => node.tag === 'main' && node.attrs.id === 'main'), 'native main')
  const publicationNodes = p.d.nodes(node => node.tag === 'title' || node.tag === 'link' && node.attrs.rel === 'canonical' || node.tag === 'meta' && ((node.attrs.name ?? '').startsWith('avature.portal.') || ['og:site_name', 'og:title', 'og:url'].includes(node.attrs.property)))
  if (kind === 'SearchJobs') need(canonical.href === SEARCH, 'native search canonical differs')
  qualify([...new Set([...publicationNodes, ...pathTo(p.root, main), ...pathTo(p.root, brand)])], [], at, [url, SEARCH, canonical.href, ...additionalApplications])
  return { ...p, canonical: canonical.href, publicationNodes, brand, main, publisher: { nativeAccount: '46', brand: COMPANY, url, canonical: canonical.href, sourceLegalEmployer: null } }
}
export function readCurrentCorporate(html, at = new Date().toISOString()) {
  const p = page(html, CORPORATE)
  need(p.title === 'Careers | Macquarie Group', 'own Macquarie careers title differs')
  const site = one(p.d.nodes(node => node.tag === 'meta' && node.attrs.property === 'og:site_name'), 'own publisher site name')
  need(site.attrs.content === 'Macquarie', 'own Macquarie site publisher differs')
  need(one(p.d.nodes(node => node.tag === 'meta' && node.attrs.property === 'og:title'), 'own publisher OG title').attrs.content === p.title, 'own Macquarie OG title differs')
  need(one(p.d.nodes(node => node.tag === 'meta' && node.attrs.property === 'og:url'), 'own publisher OG URI').attrs.content === CORPORATE, 'own Macquarie OG URI differs')
  const anchors = p.d.nodes(node => node.tag === 'a' && p.d.text(node) === 'Search open roles')
  need(anchors.length > 0 && anchors.length <= 4, 'actual own Search open roles handoff missing/ambiguous')
  const headings = p.d.nodes(node => node.tag === 'h1')
  need(headings.length > 0 && headings.length <= 4, 'own current publisher heading missing/ambiguous')
  const urls = anchors.map(anchor => {
    const url = checkOwn(anchor.attrs.href)
    need(url.pathname === '/en_US/careers/SearchJobs/', 'own current native country query path differs')
    qualify([...new Set([...pathTo(p.root, anchor), ...headings.flatMap(heading => pathTo(p.root, heading)), ...p.d.nodes(node => node.tag === 'title' || node.tag === 'link' && node.attrs.rel === 'canonical' || node.tag === 'meta' && ['og:site_name', 'og:title', 'og:url'].includes(node.attrs.property))])], headings.flatMap(authoredLines), at, [url.href, CORPORATE])
    return url.href
  })
  const url = one([...new Set(urls)], 'own exact native handoff URI')
  return { url, sourceLegalEmployer: null, ownPublisher: COMPANY, originalLinks: anchors.map(anchor => structuredClone(anchor.attrs)), rendererExecuted: false }
}
function formState(p, at, { requireCleared = false } = {}) {
  const form = one(p.d.nodes(node => node.tag === 'form' && node.attrs.id === 'tpt_jobSortableForm', p.main), 'native actual public form')
  need(form.attrs.method?.toLowerCase() === 'post' && new URL(form.attrs.action, SEARCH).href === SEARCH, 'native actual public form action/method differs')
  const controls = p.d.nodes(node => ['input', 'select', 'button', 'textarea'].includes(node.tag), form)
  const select = one(controls.filter(node => node.tag === 'select' && p.d.nodes(label => label.tag === 'label' && label.attrs.for === node.attrs.id && p.d.text(label) === 'Countries', form).length === 1), 'native actually labelled Countries select')
  need(typeof select.attrs.name === 'string' && select.attrs.name.endsWith('[]') && select.attrs.id === select.attrs.name.slice(0, -2), 'native Countries control name/id differs')
  const countryOptions = p.d.nodes(node => node.tag === 'option' && Object.hasOwn(node.attrs, 'selected'), select)
  const option = one(countryOptions, 'native selected country')
  need(p.d.text(option) === 'India' && typeof option.attrs.value === 'string' && option.attrs.value, 'native selected country does not explicitly qualify India')
  const associated = node => node.attrs.form == null || node.attrs.form === form.attrs.id
  const keyword = one(controls.filter(node => node.tag === 'input' && node.attrs.name === 'search'), 'native public keyword field')
  const submit = one(controls.filter(node => node.tag === 'button' && (node.attrs.type ?? 'submit').toLowerCase() === 'submit'), 'native actual public search submit')
  need(keyword.attrs.type === 'text' && !Object.hasOwn(keyword.attrs, 'readonly') && associated(keyword), 'native keyword field is not editable/associated')
  need(submit.attrs.name === 'action' && submit.attrs.value === 'search' && associated(submit), 'native public submit differs')
  need(submit.attrs.formaction == null || new URL(submit.attrs.formaction, SEARCH).href === SEARCH, 'native public submit action override differs')
  need(submit.attrs.formmethod == null || submit.attrs.formmethod.toLowerCase() === 'post', 'native public submit method override differs')
  for (const encoding of [form.attrs.enctype, submit.attrs.formenctype].filter(value => value != null)) need(encoding.toLowerCase() === 'application/x-www-form-urlencoded', 'native public form encoding differs')
  const fields = [], successful = []
  for (const node of controls) {
    if (!node.attrs.name || !associated(node) || Object.hasOwn(node.attrs, 'disabled')) continue
    if (node.tag === 'select') {
      if (node === select) { fields.push([node.attrs.name, option.attrs.value]); successful.push(node, option) }
      else if (requireCleared) need(!p.d.nodes(option => option.tag === 'option' && Object.hasOwn(option.attrs, 'selected'), node).length, 'native country-only result has an additional selected filter')
      continue
    }
    const type = (node.attrs.type ?? (node.tag === 'button' ? 'submit' : 'text')).toLowerCase()
    if (node.tag === 'button' || ['submit', 'button', 'reset', 'image'].includes(type)) { if (node === submit) { fields.push([node.attrs.name, node.attrs.value]); successful.push(node) } continue }
    need(node.tag === 'input' && ['hidden', 'text'].includes(type), 'unsupported private/native public form control')
    if (node === keyword && requireCleared) need(!node.attrs.value, 'native country-only keyword is not clear')
    fields.push([node.attrs.name, node === keyword ? '' : node.attrs.value ?? ''])
    successful.push(node)
  }
  need(fields.filter(([key]) => key === 'search').length === 1 && fields.filter(([key]) => key === 'action').length === 1 && fields.filter(([key]) => key === select.attrs.name).length === 1, 'native search successful controls ambiguous')
  qualify([...new Set([...pathTo(p.root, form), ...successful])], [], at, [p.publisher.url, SEARCH])
  return { url: SEARCH, method: 'POST', body: new URLSearchParams(fields).toString(), originalSuccessfulControls: fields, originalFormAttributes: structuredClone(form.attrs), country: { label: 'India', value: option.attrs.value, name: select.attrs.name, id: select.attrs.id, originalSelect: structuredClone(select.attrs), originalOption: structuredClone(option.attrs) }, originalPublisher: p.publisher, rendererExecuted: false }
}
export function readCurrentForm(html, url, at = new Date().toISOString()) { return formState(nativePage(html, url, at, 'SearchJobs'), at) }
function countryQuery(raw, country) {
  const url = checkOwn(raw)
  need(url.pathname === '/en_US/careers/SearchJobs/', 'native country query pathname differs')
  const allowed = new Set([country.id, country.id + '_format', 'listFilterMode', 'jobRecordsPerPage', 'jobOffset'])
  need([...url.searchParams.keys()].every(key => allowed.has(key)) && [...new Set(url.searchParams.keys())].length === url.searchParams.size, 'native country query contains extra/duplicate filters')
  let selected
  try { selected = JSON.parse(url.searchParams.get(country.id)) } catch { need(false, 'native country query value malformed') }
  need(Array.isArray(selected) && selected.length === 1 && String(selected[0]) === country.value && url.searchParams.get('listFilterMode') === '1', 'native selected country/query binding differs')
  need(/^\d+$/.test(url.searchParams.get('jobRecordsPerPage') ?? '') && /^[0-9]+$/.test(url.searchParams.get('jobOffset') ?? '0'), 'native page size/offset unqualified')
  const pageSize = Number(url.searchParams.get('jobRecordsPerPage')), offset = Number(url.searchParams.get('jobOffset') ?? '0')
  need(pageSize > 0 && pageSize <= 100 && Number.isSafeInteger(offset) && offset >= 0, 'native page size/offset bound')
  return { url, pageSize, offset }
}
function labelledCardField(p, card, label) {
  const values = p.d.nodes(node => cls(node, 'article__details__data') && node.children.filter(child => typeof child !== 'string' && child.tag === 'img' && child.attrs.alt === label).length === 1, card)
  const field = one(values, 'native actually authored ' + label)
  const image = one(field.children.filter(child => typeof child !== 'string' && child.tag === 'img' && child.attrs.alt === label), 'native immediate semantic label')
  need(!Object.hasOwn(image.attrs, 'hidden') && !Object.hasOwn(image.attrs, 'inert') && !/display\s*:\s*none|visibility\s*:\s*hidden/i.test(image.attrs.style ?? ''), 'native semantic field label unavailable')
  return { raw: p.d.text(field), field, image, properties: Object.entries(image.attrs).filter(([key]) => key.startsWith('data-')).map(([key, value]) => ({ key, value })) }
}
function originalDay(raw, field, at) {
  const match = /^(\d{1,2})[ -](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[ -](\d{4})$/.exec(raw)
  need(match, 'native posted day format differs')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const value = match[3] + '-' + String(months.indexOf(match[2]) + 1).padStart(2, '0') + '-' + match[1].padStart(2, '0')
  const result = constraints([{ key: 'datePosted', value }], [], config(at)).posted[0]
  return { ...result, field, raw, originalSemanticLabel: 'Posted Date:', originalDateShape: 'native-English-month-day' }
}
function baseRecord(row, dates) {
  const job = { source: SOURCE, company: COMPANY, jobId: SOURCE + '-' + row.nativePublicJobId, nativePublicJobId: row.nativePublicJobId, nativeJobIDLabel: 'Job ID', requisitionId: null, sourceLegalEmployer: null, nativeEmployerDisplayName: COMPANY, title: row.title, url: row.url, sourceUrl: row.url, applyUrl: row.applyUrl, link: row.applyUrl, country: 'India', city: row.city, location: row.location, sourceCountryEvidence: row.geography, postingDate: null, closingDate: null, sourceNativeDates: { recognizedPostingFields: [], recognizedExpiryFields: [] }, sourceDetailComplete: false, sourceDetailStatus: 'partial', sourceMissingCriteria: [{ kind: 'native-detail', reason: 'Current own native country-scoped role publication is qualified; optional own role criteria not acquired yet.' }], sourceScopeComplete: false, sourceListingComplete: false, backendApplicationActivationVerified: false, lifecycleCleanupAllowed: false, sourceNativeApplication: { kind: 'current-own-ApplicationMethods-same-public-jobID-record', url: row.applyUrl, fetched: false, backendActivationVerified: false }, jobDescription: null, sourceDescription: null, originalNativeRow: row }
  return retainDateModels(job, dates)
}
export function readCurrentIndex(html, url, at = new Date().toISOString()) {
  const p = nativePage(html, url, at, 'SearchJobs'), form = formState(p, at, { requireCleared: true }), query = countryQuery(url, form.country)
  const cards = p.d.nodes(node => node.tag === 'article' && cls(node, 'article--result'), p.main)
  need(cards.length > 0 && cards.length <= query.pageSize, 'native nonempty current country cards missing/excessive')
  const countModels = p.d.nodes(node => /^(\d+)-(\d+) of (\d+) results?$/.test(p.d.text(node)), p.main).map(node => ({ raw: p.d.text(node), attributes: structuredClone(node.attrs) }))
  const count = one([...new Set(countModels.map(model => model.raw))], 'native current page count')
  const [, firstRaw, lastRaw, totalRaw] = /^(\d+)-(\d+) of (\d+) results?$/.exec(count)
  const first = Number(firstRaw), last = Number(lastRaw), total = Number(totalRaw)
  need(Number.isSafeInteger(total) && total > 0 && first === query.offset + 1 && last === query.offset + cards.length && last <= total, 'native current page range/count contradicts actual cards')
  const rows = [], held = []
  for (const card of cards) {
    let id = null
    try {
      const heading = one(p.d.nodes(node => node.tag === 'h3', card), 'native card heading')
      const anchor = one(p.d.nodes(node => node.tag === 'a', heading), 'native current role title URI')
      const currentURL = roleURL(anchor.attrs.href)
      id = new URL(currentURL).searchParams.get('jobId')
      const title = p.d.text(anchor)
      need(title, 'native role title empty')
      const idFields = p.d.nodes(node => cls(node, 'article__details__data') && p.d.nodes(node => node.tag === 'p' && p.d.text(node) === 'ID', node).length === 1, card)
      need(p.d.text(one(idFields, 'native labelled public ID')) === 'ID ' + id, 'native public ID label conflicts with role URI')
      const location = labelledCardField(p, card, 'Office Location:')
      need(location.raw && writtenPlaceCountries(location.raw).every(country => country === 'India'), 'native authored office country contradicts explicit selected India')
      const posted = labelledCardField(p, card, 'Posted Date:')
      const controls = p.d.nodes(node => node.tag === 'a' && p.d.text(node) === 'Apply', card)
      need(controls.length > 0 && controls.length <= 4, 'native actual Apply controls missing/excessive')
      const applications = controls.map(control => applicationURL(control.attrs.href, id))
      const applyUrl = one([...new Set(applications)], 'native actual application URI')
      for (const control of p.d.nodes(node => node.tag === 'a' && p.d.text(node) === 'View details', card)) need(roleURL(control.attrs.href) === currentURL, 'native View details role ID conflict')
      const dates = qualify(all(card, node => !node.inactive && !node.inert), authoredLines(card), at, [currentURL, applyUrl])
      const semantic = constraints([...posted.properties, ...location.properties], [], config(at))
      dates.posted.push(originalDay(posted.raw, 'card:Posted Date:', at), ...semantic.posted)
      dates.expiry.push(...semantic.expiry)
      const record = { nativePublicJobId: id, title, url: currentURL, applyUrl, location: location.raw, city: location.raw.replace(/\s+Office$/, ''), geography: { kind: 'actual-native-selected-country-scope-and-same-native-office;no-city-HQ-or-default-inference', country: 'India', selectedCountry: structuredClone(form.country), indexURL: url, originalOfficeLabel: location.raw }, originalCardHTML: p.raw.outer(one(p.raw.nodes(node => node.tag === 'article' && cls(node, 'article--result')).filter(node => p.raw.outer(node).includes(anchor.attrs.href)), 'original exact native card')), originalPostedDateLabel: structuredClone(posted.image.attrs), originalOfficeLabel: structuredClone(location.image.attrs) }
      rows.push(baseRecord(record, dates))
    } catch (error) { held.push({ nativePublicJobId: id, reason: error.message }) }
  }
  const next = p.d.nodes(node => node.tag === 'a' && cls(node, 'paginationNextLink'), p.main)
  need(next.length === (last < total ? 1 : 0), 'native current Next termination/count differs')
  const nextURLs = next.map(node => {
    qualify(pathTo(p.root, node), [], at, [url, SEARCH])
    const target = countryQuery(node.attrs.href, form.country)
    const expected = new URL(url); expected.searchParams.delete('jobOffset')
    const actual = new URL(target.url); actual.searchParams.delete('jobOffset')
    need(expected.href === actual.href && target.offset === query.offset + query.pageSize && target.pageSize === query.pageSize, 'native Next changes country filters or offset')
    return target.url.href
  })
  return { url, rows, held, observedCards: cards.length, country: form.country, pageRange: { first, last, total, offset: query.offset, pageSize: query.pageSize }, originalCountModels: countModels, nextURLs, publisher: p.publisher }
}
function structuredRoles(p, row, at, allowedApplications, dates) {
  const originals = []
  let visited = 0
  const visit = (model, inherited) => {
    if (Array.isArray(model)) { model.forEach(value => visit(value, inherited)); return }
    if (!model || typeof model !== 'object') return
    need(++visited <= 4096, 'native structured model traversal bound')
    const context = Object.hasOwn(model, '@context') ? model['@context'] : inherited
    if (Object.hasOwn(model, '@context')) need(typeof context === 'string' && /^https?:\/\/schema\.org\/?$/.test(context), 'native explicit structured context differs')
    const types = (Array.isArray(model['@type']) ? model['@type'] : [model['@type']]).map(type => typeof type === 'string' ? type.replace(/^https?:\/\/schema\.org\//, '') : type)
    if (types.some(type => ['JobPosting', 'WebPage', 'Organization', 'Place', 'PostalAddress'].includes(type))) {
      need(typeof context === 'string' && /^https?:\/\/schema\.org\/?$/.test(context), 'native structured context unqualified')
      for (const [key, value] of Object.entries(model)) if (applicationKeys.has(normalizedKey(key))) need(allowedApplications.includes(new URL(value, row.url).href), 'native structured application alias differs')
    }
    if (types.some(type => ['JobPosting', 'WebPage', 'Organization'].includes(type))) {
      const extra = constraints(scalarFields(model), [], config(at))
      dates.posted.push(...extra.posted); dates.expiry.push(...extra.expiry)
      for (const field of ['employer', 'hiringOrganization']) if (model[field] != null) {
        const employer = typeof model[field] === 'string' ? model[field] : model[field]?.name
        need(employer === COMPANY, 'native same-role structured employer differs')
      }
      if (types.includes('Organization') && typeof model.url === 'string' && new URL(model.url, row.url).origin === ORIGIN) need(model.name === COMPANY, 'native own publisher Organization differs')
      if (types.includes('JobPosting') || types.includes('WebPage')) {
        for (const field of ['title', ...(types.includes('JobPosting') ? ['name'] : [])]) if (model[field] != null) need(norm(model[field]) === row.title, 'native structured role title differs')
        if (model.url != null) need([row.url, p.canonical].includes(model.url), 'native structured role URI differs')
        applicantGeography(model)
        for (const field of ['jobLocation', 'jobLocations', 'workLocation', 'workLocations']) if (model[field] != null) {
          const places = schemaPlaces({ ...model, jobLocation: model[field] })
          need(places.some(place => place.country === 'India'), 'native structured workplace excludes India')
          need(places.filter(place => place.country === 'India').every(place => !place.city || norm(place.city).toLowerCase() === norm(row.city).toLowerCase()), 'native structured India locality differs')
        }
      }
      originals.push(structuredClone(model))
    }
    for (const [key, value] of Object.entries(model)) if (key !== '@context' && value && typeof value === 'object') visit(value, context)
  }
  for (const script of p.d.nodes(node => node.tag === 'script' && !node.attrs.src && node.attrs.type === 'application/ld+json')) {
    qualify(pathTo(p.root, script), [], at, allowedApplications)
    visit(readLiteralModel(script.raw ?? '').value)
  }
  return originals
}
export function readCurrentRole(html, row, at = new Date().toISOString()) {
  const p = nativePage(html, row.url, at, 'JobDetail', [applicationURL(row.applyUrl, row.nativePublicJobId)])
  const canonical = checkOwn(p.canonical)
  need(!canonical.search && new RegExp('^/en_US/careers/JobDetail/[^/]+/' + row.nativePublicJobId + '$').test(canonical.pathname), 'native canonical role/public ID differs')
  const title = one(p.d.nodes(node => node.tag === 'h2' && cls(node, 'title--11'), p.main), 'native role heading')
  need(p.d.text(title) === row.title && semanticTitle(p.title) === row.title + ' - - ' + row.nativePublicJobId + ' - Macquarie Group', 'native current role title/public ID differs')
  const ogTitle = one(p.d.nodes(node => node.tag === 'meta' && node.attrs.property === 'og:title'), 'native role OG title')
  need(semanticTitle(ogTitle.attrs.content) === row.title, 'native actual OG role title differs')
  const ogURL = one(p.d.nodes(node => node.tag === 'meta' && node.attrs.property === 'og:url'), 'native role OG URI')
  need(decodeNativeEntities(ogURL.attrs.content) === p.canonical, 'native actual OG role URI differs')
  const controls = p.d.nodes(node => node.tag === 'a' && /^(?:Apply|Apply now)$/i.test(p.d.text(node)), p.main)
  need(controls.length > 0 && controls.length <= 8, 'native actual role Apply controls missing/excessive')
  const apps = controls.map(control => applicationURL(control.attrs.href, row.nativePublicJobId))
  const applyUrl = one([...new Set(apps)], 'native current role application URI')
  need(applyUrl === row.applyUrl, 'native role/card application differs')
  const dates = qualify([...new Set([...p.publicationNodes, ...pathTo(p.root, p.main), ...pathTo(p.root, p.brand), ...all(p.main, node => !node.inert && !node.inactive)])], authoredLines(p.main), at, [row.url, p.canonical, applyUrl])
  const fields = []
  for (const field of p.d.nodes(node => cls(node, 'article__content__view__field'), p.main)) {
    const labels = p.d.nodes(node => cls(node, 'article__content__view__field__label'), field)
    const values = p.d.nodes(node => cls(node, 'article__content__view__field__value'), field)
    if (!labels.length) continue
    need(labels.length === 1 && values.length === 1, 'native labelled role field ambiguous')
    fields.push({ label: p.d.text(labels[0]), value: p.d.text(values[0]) })
  }
  const values = name => fields.filter(field => normalizedKey(field.label) === normalizedKey(name)).map(field => field.value)
  need(one(values('Job ID'), 'native labelled Job ID') === row.nativePublicJobId, 'native labelled Job ID conflicts')
  const locations = values('Additional office locations')
  need(locations.length <= 1, 'native role office field ambiguous')
  for (const location of locations) need(norm(location).toLowerCase() === norm(row.city).toLowerCase() && writtenPlaceCountries(location).every(country => country === 'India'), 'native same-role office locality/country differs')
  const semantic = semanticProperties(all(p.main, node => !node.inert && !node.inactive))
  for (const property of semantic.filter(property => ['location', 'joblocation', 'worklocation', 'workplace'].includes(normalizedKey(property.key)))) {
    if (nativeCountryName(property.value) === 'India') continue
    const parts = property.value.split(',').map(norm).filter(Boolean)
    const locality = nativeCountryName(parts.at(-1)) ? parts[0] : property.value.replace(/\s+(?:Office|India)$/i, '')
    need(norm(locality).toLowerCase() === norm(row.city).toLowerCase(), 'native authored semantic India locality differs')
  }
  const authored = constraints(fields.map(field => ({ key: field.label, value: field.value })), fields.map(field => field.label + ': ' + field.value), config(at))
  dates.posted.push(...authored.posted); dates.expiry.push(...authored.expiry)
  const structured = structuredRoles(p, row, at, [row.url, p.canonical, applyUrl], dates)
  const descriptionNodes = p.d.nodes(node => node.tag === 'article' && cls(node, 'article--details'), p.main)
  const description = descriptionNodes.map(node => p.d.text(node)).filter(Boolean).join('\n\n') || null
  const current = retainDateModels({ ...row, sourceNativeDates: structuredClone(row.sourceNativeDates) }, dates)
  return Object.assign(current, { applyUrl, link: applyUrl, jobDescription: description, sourceDescription: description, originalRoleHTML: html, originalRoleFields: fields, originalSemanticRoleProperties: semantic, originalStructuredModels: structured, sourceNativeTitleMetadata: { originalDocumentTitle: p.title, originalOGTitle: ogTitle.attrs.content, originalVisibleTitle: row.title, nativeMetadataExtraEntityDecoding: true }, sourceNativeUnclassifiedDates: values('Date').map(raw => ({ label: 'Date', raw, meaning: 'Native generic Date field retained separately; ageing uses only independently labelled Posted Date or explicit posting properties.' })), originalApplicationControls: controls.map(control => structuredClone(control.attrs)), sourceNativeApplication: { kind: 'current-own-ApplicationMethods-same-public-jobID-record', url: applyUrl, fetched: false, backendActivationVerified: false }, sourceDetailComplete: false, sourceCriteriaRendererVerified: false, backendApplicationActivationVerified: false })
}

const identity = row => ({ id: row.nativePublicJobId, title: row.title, url: row.sourceUrl, workplace: row.location, country: row.country, applicationID: new URL(row.applyUrl).searchParams.get('jobId'), applicationRecord: new URL(row.applyUrl).searchParams.get('record') })
const unavailable = error => !error.nativeContradiction && error.failureKind !== 'parser_or_contract_error' && ![301, 302, 303, 307, 308, 404, 410].includes(error.httpStatus)
export async function runCurrentPublished(options = {}) {
  options.signal?.throwIfAborted()
  need(options.maxJobs == null || options.maxJobs === 0, 'positive caller maxJobs unsupported')
  need(options.maxPages == null || options.maxPages === 0, 'positive caller maxPages unsupported')
  need(!options.fetchText && !options.fetchJson && !options.fetchPage, 'original native Responses required')
  need(options.onAudit == null || typeof options.onAudit === 'function', 'invalid native audit callback')
  const at = (typeof options.now === 'function' ? options.now() : options.now) ?? new Date().toISOString()
  const io = createCurrentReader(SOURCE, [CORPORATE], options)
  const jobs = [], audit = { source: SOURCE, held: [], optionalFailures: [], originalResponses: [], companyIndiaTotal: null, companyGlobalTotal: null, sourceScopeComplete: false, lifecycleCleanupAllowed: false, backendApplicationActivationVerified: false, sourceAcquisitionAttempted: false }
  const read = async (url, request, redirect = false) => {
    const result = await io.read(url, 'html', request, redirect)
    audit.originalResponses.push({ requestedUrl: url, ...result.receipt, originalBody: result.body })
    return result
  }
  const finish = async () => {
    io.check()
    Object.assign(audit, io.stats(), { observedAt: at, fullCriteriaRecovered: false, fullCriteriaIndiaJobs: 0, missingCriteriaJobs: jobs.length })
    if (options.onAudit) await options.onAudit(structuredClone(audit))
    io.check()
    attachSourceObservationEvidence(jobs, { source: SOURCE, recordKind: 'vacancy-rows', observedRecordCount: audit.openingPublication?.observedCards ?? 0, observedVacancyCount: audit.openingPublication?.observedCards ?? 0, sourceScopeComplete: false, companyIndiaTotal: null, companyGlobalTotal: null })
    Object.defineProperty(jobs, 'nativeCollectionEvidence', { value: audit, configurable: true })
    return attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: CORPORATE, firstParty: audit.sourceAcquisitionAttempted, listingComplete: false, reportedTotal: null, indiaFacetCount: null, pagesFetched: io.stats().requests, verifiedAt: at, lifecycleCleanupAllowed: false, reason: 'current-own-native-selected-India-country-publication-partials;all-company-legal-formal-requisition-application-backend-cleanup-held' })
  }
  const phase = async label => {
    const corporate = readCurrentCorporate((await read(CORPORATE)).body, at)
    io.allow(corporate.url)
    const form = readCurrentForm((await read(corporate.url)).body, corporate.url, at)
    const request = io.allowForm(form.url, form.body)
    const response = await read(form.url, request, true)
    need(response.receipt.status === 302 && typeof response.receipt.headers.location === 'string', 'native actual public form did not supply its302 country redirect')
    let url = checkOwn(response.receipt.headers.location).href
    const seen = new Set(), pages = [], rows = [], ids = new Set()
    let total = null, observedCards = 0
    while (url) {
      need(pages.length < 12 && !seen.has(url), 'native complete country pagination bound/cycle')
      seen.add(url); io.allow(url)
      const current = readCurrentIndex((await read(url)).body, url, at)
      if (total == null) total = current.pageRange.total
      need(current.pageRange.total === total && current.pageRange.offset === observedCards, 'native current page totals/offset changed within observation')
      for (const row of [...current.rows, ...current.held]) if (row.nativePublicJobId != null) {
        need(!ids.has(row.nativePublicJobId), 'native country pagination repeats a public ID')
        ids.add(row.nativePublicJobId)
      }
      pages.push(current)
      rows.push(...current.rows)
      observedCards += current.observedCards
      audit.held.push(...current.held.map(row => ({ ...row, phase: label })))
      url = current.nextURLs[0] ?? null
    }
    need(observedCards === total, 'native country pagination does not account for every displayed result')
    return { label, originalCorporate: corporate, originalSearchForm: form, originalRedirect: response.receipt, pages, rows, observedCards, nativeConfiguredReportedCount: total, paginationComplete: true, companyInventoryComplete: false }
  }
  try {
    if (options.maxJobs === 0 || options.maxPages === 0) { audit.callerZeroCap = true; return await finish() }
    audit.sourceAcquisitionAttempted = true
    const opening = await phase('opening'), closing = await phase('closing')
    audit.openingPublication = opening; audit.closingPublication = closing
    for (const row of opening.rows) {
      const matches = closing.rows.filter(later => later.nativePublicJobId === row.nativePublicJobId)
      if (matches.length !== 1 || !isDeepStrictEqual(identity(row), identity(matches[0]))) {
        audit.held.push({ nativePublicJobId: row.nativePublicJobId, reason: 'Closing current native country-scoped role identity/workplace/application absent, ambiguous or changed', opening: row, closing: matches })
        continue
      }
      const later = matches[0]
      const base = retainDateModels({ ...later, sourceNativeDates: structuredClone(later.sourceNativeDates), sourceClosingReconciled: true, sourceNativeRoleClosingQualified: false, sourceNativeIndexVersions: [{ phase: 'opening', record: row }, { phase: 'closing', record: later }] }, { posted: row.sourceNativeDates.recognizedPostingFields, expiry: row.sourceNativeDates.recognizedExpiryFields })
      const versions = []
      let current = base, failure = null
      if (io.stats().requests + 2 > io.stats().maxRequests) failure = { notAttemptedRequestBudget: true, reason: 'Proven current paired native publication retained; optional same-role detail request budget exhausted.' }
      else for (const label of ['opening-role', 'closing-role']) {
        if (io.stats().deniedOrigins.includes(ORIGIN)) { failure ??= { notAttemptedOriginRestricted: true, reason: 'A prior actual response restricted this origin; no further native request was attempted.' }; break }
        try {
          io.allow(row.sourceUrl)
          const response = await read(row.sourceUrl)
          let detail
          try {
            detail = readCurrentRole(response.body, later, at)
            need(isDeepStrictEqual(identity(detail), identity(later)), 'native own role identity differs from its country-scoped record')
          } catch (error) { throw Object.assign(Error('Complete200 native role parser/contract contradiction: ' + error.message), { nativeContradiction: true, failureKind: 'parser_or_contract_error', cause: error }) }
          versions.push({ phase: label, record: detail })
          current = retainDateModels({ ...current, ...detail, sourceNativeDates: current.sourceNativeDates }, { posted: detail.sourceNativeDates.recognizedPostingFields, expiry: detail.sourceNativeDates.recognizedExpiryFields })
          current.sourceNativeRoleClosingQualified = label === 'closing-role'
        } catch (error) {
          io.check()
          failure = { phase: label, httpStatus: error.httpStatus ?? null, reason: error.message }
          audit.optionalFailures.push({ nativePublicJobId: row.nativePublicJobId, ...failure })
          if (!unavailable(error)) { audit.held.push({ nativePublicJobId: row.nativePublicJobId, reason: error.message, originalKnownRoleVersions: versions }); current = null; break }
        }
      }
      if (!current) continue
      current.jobDescription = [...new Set(versions.map(version => version.record.jobDescription).filter(Boolean))].join('\n\n') || null
      current.sourceDescription = current.jobDescription
      current.sourceNativeRoleVersions = versions
      current.sourceNativeIndexVersions = base.sourceNativeIndexVersions
      current.sourceClosingReconciled = true
      current.sourceOptionalDetailFailure = failure
      current.sourceNativePublicationDatePolicy = 'Earliest actually authored labelled posting date only; every original native date shape and precision retained; generic Date fields remain separate and first-ever publication is unproven.'
      current.sourceMissingCriteria = [{ kind: 'legal-employer-and-formal-requisition', reason: 'Current exact own display brand and labelled public Job ID do not prove legal employer or formal requisition.' }, { kind: 'company-and-application-backend', reason: 'Current native country-selected scope only; renderer, ApplicationMethods controls/backend and whole-company inventory/cleanup remain unverified.' }, ...(!current.jobDescription ? [{ kind: 'description', reason: 'Proven paired native role publication retained; optional own native criteria unavailable.' }] : [])]
      jobs.push(current)
    }
    audit.unreadClosingRows = closing.rows.filter(row => !opening.rows.some(prior => prior.nativePublicJobId === row.nativePublicJobId))
    return await finish()
  } finally { io.close() }
}
