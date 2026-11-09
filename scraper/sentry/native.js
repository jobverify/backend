import { createHash } from 'node:crypto'
import { parseExpressionAt } from 'acorn'
import { activeHead, extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { nativeCountryName, nativeLocationCountryName } from '../../scraper-support/shared/nativeJobPosting.js'

export const NATIVE_API_URL = 'https://api.ashbyhq.com/posting-api/job-board/sentry'
export const check = (ok, message) => { if (!ok) throw Object.assign(new Error('[sentry] Current native contract: ' + message), { abortRetries: true, failureKind: 'parser_or_contract_error' }) }
export const norm = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value
export const digest = value => createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')
const within = (node, predicate) => node.inert ? [] : [...(predicate(node) ? [node] : []), ...node.children.filter(child => typeof child !== 'string').flatMap(child => within(child, predicate))]
const revive = (value, depth = 0) => {
  check(depth < 30 && Array.isArray(value) && [0, 1].includes(value[0]) && value.length <= 2, 'unreviewed Astro value carrier')
  if (value[0] === 1) { check(Array.isArray(value[1]), 'malformed Astro list'); return value[1].map(item => revive(item, depth + 1)) }
  if (value[1] && typeof value[1] === 'object') {
    check(!Array.isArray(value[1]), 'unreviewed Astro scalar list')
    return Object.fromEntries(Object.entries(value[1]).map(([key, item]) => [key, revive(item, depth + 1)]))
  }
  return value[1]
}
const readProps = raw => {
  check(typeof raw === 'string' && raw.length < 5000000, 'missing or oversized native hydration')
  let json, ast
  try { json = JSON.parse(raw); ast = parseExpressionAt(raw, 0, { ecmaVersion: 'latest' }) } catch { check(false, 'malformed native hydration JSON') }
  const visit = node => {
    if (!node || typeof node !== 'object') return
    if (node.type === 'ObjectExpression') { const keys = node.properties.map(property => property.key?.value ?? property.key?.name); check(new Set(keys).size === keys.length, 'duplicate native hydration key') }
    for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object') visit(value)
  }
  visit(ast)
  return Object.fromEntries(Object.entries(json).map(([key, value]) => [key, revive(value)]))
}
export const readCorporateInventory = html => {
  const doc = readVisibleNativeDocument(html, { strict: true })
  check(activeHead(html).titles.some(title => title === 'Careers | Sentry') && doc.nodes(node => node.tag === 'h1' && /Work at Sentry/.test(doc.text(node))).length === 1, 'official careers identity changed')
  const islands = doc.nodes(node => node.tag === 'astro-island' && node.attrs['component-export'] === 'OpeningsStickySection'
    && /^\/_astro\/OpeningsStickySection\.[\w-]+\.js(?:\?.*)?$/.test(node.attrs['component-url'] || '') && node.attrs.client === 'load')
  check(islands.length === 1 && within(islands[0], node => node.attrs.id === 'openings-list').length === 1, 'active hydrated openings scope is absent or ambiguous')
  const props = readProps(islands[0].attrs.props)
  check(props.currentUrl === 'https://sentry.io/careers/' && Array.isArray(props.jobs) && props.jobs.length > 0
    && Array.isArray(props.jobsByLocation) && Array.isArray(props.jobsByDepartment)
    && Object.keys(props).every(key => ['currentUrl', 'jobs', 'jobsByLocation', 'jobsByDepartment', 'internshipsCount', 'newGradsCount'].includes(key)), 'native hydration collection or scope changed')
  const ids = new Set(), rows = new Map()
  for (const row of props.jobs) {
    const info = row?.info
    check(typeof row?.id === 'string' && /^[0-9a-f-]{36}$/.test(row.id) && !ids.has(row.id)
      && info?.isListed === true && norm(info.title) && norm(info.locationName)
      && info.applyLink === `https://jobs.ashbyhq.com/sentry/${row.id}` && typeof info.descriptionHtml === 'string', 'hydrated native employer, role identity or full description changed')
    check(Object.keys(info).every(key => ['applyLink', 'departmentName', 'descriptionHtml', 'employmentType', 'isListed', 'locationName', 'teamName', 'title', 'locationIds', 'workplaceType', 'isRemote', 'compensationTierSummary'].includes(key)), 'unreviewed native role criteria field')
    ids.add(row.id); rows.set(row.id, row)
  }
  const seen = new Set()
  for (const anchor of within(islands[0], node => node.tag === 'a' && /^\/careers\/[0-9a-f-]{36}\/$/.test(node.attrs.href || ''))) {
    const id = anchor.attrs.href.split('/')[2], row = rows.get(id)
    const title = within(anchor, node => node.tag === 'span' && /(?:^|\s)_jobTitle_/.test(node.attrs.class || ''))
    const location = within(anchor, node => node.tag === 'span' && /(?:^|\s)_jobLocation_/.test(node.attrs.class || ''))
    check(row && !seen.has(id) && title.length === 1 && location.length === 1
      && doc.text(title[0]) === norm(row.info.title) && doc.text(location[0]) === norm(row.info.locationName), 'visible/hydrated role identity or location disagrees')
    seen.add(id)
  }
  check(seen.size === rows.size, 'visible and hydrated role counts disagree')
  return { props, rows, nativePropsRaw: islands[0].attrs.props, componentUrl: islands[0].attrs['component-url'] }
}
export const reconcileNativeInventory = (corporate, payload) => {
  check(Array.isArray(payload?.jobs) && payload.apiVersion === '1', 'native posting inventory envelope changed')
  const records = payload.jobs.filter(record => record.isListed === true), ids = new Set()
  for (const record of records) {
    const row = corporate.rows.get(record.id)
    check(row && !ids.has(record.id) && norm(record.title) === norm(row.info.title)
      && norm(record.location) === norm(row.info.locationName) && record.jobUrl === row.info.applyLink
      && norm(record.employmentType) === norm(row.info.employmentType), 'corporate/API employer, role identity, location or employment type disagrees')
    check(extractActiveDescription(record.descriptionHtml) && extractActiveDescription(record.descriptionHtml) === extractActiveDescription(row.info.descriptionHtml), 'corporate/API full job criteria disagree')
    if (record.publishedAt != null) check(typeof record.publishedAt === 'string' && /^\d{4}-\d\d-\d\dT/.test(record.publishedAt) && Number.isFinite(Date.parse(record.publishedAt)), 'native publication timestamp is malformed')
    ids.add(record.id)
  }
  check(ids.size === corporate.rows.size, 'corporate/API native role counts disagree')
  return records
}
export const ownCountries = record => {
  const known = new Set(['location', 'address', 'secondaryLocations'])
  if (Object.entries(record).some(([key, value]) => /countr|location|worksite/i.test(key) && !known.has(key) && value != null && value !== '')) return { known: false, india: false }
  const candidates = [{ location: record.location, address: record.address }, ...(record.secondaryLocations || [])]
  const countries = candidates.map(candidate => nativeCountryName((candidate.address?.postalAddress || candidate.address)?.addressCountry) || nativeLocationCountryName(candidate.location))
  return { known: countries.every(Boolean), india: countries.some(country => country === 'India'), countries }
}
export const reviewDescription = html => typeof html === 'string' && extractActiveDescription(html)
  && !/^(?:please\s+)?enter\s+(?:the\s+)?job\s+description[.!]*$/i.test(extractActiveDescription(html))
  && !/<[^>]+\b(?:hidden|inert)(?:\s|=|>)|display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0|(?:height|width|font-size)\s*:\s*0\b/i.test(html) ? html : null
