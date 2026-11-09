import { parseBoundedProgram } from '../../scraper-support/utils/remoteScriptData.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { sourcePublicationDateFields } from '../../src/utils/jobPublicationDate.js'
import { decodeHTML } from 'entities'
import { SOURCE, COMPANY, CAREERS_URL, canonical, iso, need } from './nativeContract.js'

export const parseWidgetJSONP = text => {
  need(typeof text === 'string', 'missing JSONP body')
  const program = parseBoundedProgram(text), statement = program.body[0], call = statement?.expression
  need(program.body.length === 1 && statement?.type === 'ExpressionStatement' && call?.type === 'CallExpression' && !call.optional && call.callee.type === 'Identifier' && call.callee.name === 'whrcallback' && call.arguments.length === 1 && call.arguments[0]?.type === 'ObjectExpression', 'unsupported JSONP callback envelope')
  const inspect = node => {
    if (!node) return
    if (node.type === 'ObjectExpression') {
      const keys = new Set()
      for (const property of node.properties) {
        need(property.type === 'Property' && property.kind === 'init' && !property.computed && !property.method && !property.shorthand && property.key.type === 'Literal' && typeof property.key.value === 'string', 'non-JSON native object property')
        const name = property.key.value
        need(!keys.has(name) && !['__proto__', 'prototype', 'constructor'].includes(name), 'duplicate or unsupported native JSON key: ' + name)
        keys.add(name); inspect(property.value)
      }
    } else if (node.type === 'ArrayExpression') node.elements.forEach(inspect)
  }
  inspect(call.arguments[0])
  return JSON.parse(text.slice(call.arguments[0].start, call.arguments[0].end))
}

const locationKeys = new Set(['country', 'city', 'state', 'locations'])
const locationFieldKeys = new Set(['country', 'countryCode', 'city', 'region', 'hidden'])
const roleKeys = new Set(['title', 'shortcode', 'code', 'employment_type', 'telecommuting', 'department', 'url', 'shortlink', 'application_url', 'published_on', 'created_at', 'country', 'city', 'state', 'education', 'experience', 'function', 'industry', 'locations', 'description'])
const without = (row, keys) => Object.fromEntries(Object.entries(row).filter(([key]) => !keys.has(key)))
const core = row => canonical(without(row, locationKeys))
const signature = (group, omitDescription = false) => canonical([...new Set(group.records.map(row => canonical(omitDescription ? without(row, new Set(['description'])) : row)))].sort())
const day = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(value + 'T00:00:00.000Z')
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value ? value : null
}
const roleURL = (value, shortcode, application = false) => {
  if (value == null || value === '') return null
  need(typeof value === 'string', 'non-string native role URL')
  let url
  try { url = new URL(value) } catch { need(false, 'invalid native role URL') }
  need(url.protocol === 'https:' && url.host === 'apply.workable.com' && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/j/' + shortcode + (application ? '/apply' : '') && url.href === value, 'native URL/shortcode identity contradiction')
  return value
}
const geography = row => {
  const locations = row.locations == null ? [] : row.locations
  need(Array.isArray(locations) && locations.length <= 100, 'unsupported native locations')
  for (const location of locations) {
    need(location && typeof location === 'object' && !Array.isArray(location), 'invalid role-owned native location')
    for (const key of ['country', 'countryCode', 'city', 'region']) need(location[key] == null || typeof location[key] === 'string', 'invalid native location field')
    const labels = [row.country, location.country].filter(Boolean)
    need(!(labels.includes('India') && labels.some(label => label !== 'India')), 'native India country/location contradiction')
    need(!(location.countryCode === 'IN' && labels.some(label => label !== 'India')), 'native India country-code contradiction')
    need(!(labels.includes('India') && location.countryCode && location.countryCode !== 'IN'), 'native India country-code contradiction')
  }
  const hint = row.country === 'India' || locations.some(location => location.country === 'India' || location.countryCode === 'IN')
  // Uninterpreted nested fields remain raw evidence, not qualified geography.
  const qualified = row.country === 'India' && locations.length > 0 && locations.every(location => Object.keys(location).every(key => locationFieldKeys.has(key)) && location.country === 'India' && location.countryCode === 'IN' && location.hidden === false)
  const cities = [...new Set([row.city, ...locations.map(location => location.city)].filter(Boolean))]
  const regions = [...new Set([row.state, ...locations.map(location => location.region)].filter(Boolean))]
  return { hint, qualified, city: cities.length === 1 ? cities[0] : null, state: regions.length === 1 ? regions[0] : null, cityConflict: cities.length > 1, stateConflict: regions.length > 1 }
}

export const readWidgetInventory = (text, { mode = 'titles', observedAt = null } = {}) => {
  need(['titles', 'details'].includes(mode), 'unsupported widget observation mode')
  const raw = parseWidgetJSONP(text)
  need(raw && !Array.isArray(raw) && canonical(Object.keys(raw).sort()) === canonical(['description', 'jobs', 'name']) && raw.name === COMPANY && typeof raw.description === 'string' && Array.isArray(raw.jobs) && raw.jobs.length <= 10000, 'native widget publisher/schema contradiction')
  const byId = new Map()
  for (const [index, row] of raw.jobs.entries()) {
    need(row && typeof row === 'object' && !Array.isArray(row) && typeof row.title === 'string' && row.title.trim() && !/[<>]/.test(row.title) && typeof row.shortcode === 'string' && /^[A-Z0-9]{10}$/.test(row.shortcode), 'missing or unsupported native role identity')
    need(Object.keys(row).every(key => roleKeys.has(key)), 'unsupported native role field/schema')
    for (const key of ['country', 'city', 'state', 'description', 'published_on', 'created_at']) need(row[key] == null || typeof row[key] === 'string', 'unsupported native role field: ' + key)
    const url = roleURL(row.url, row.shortcode), shortlink = roleURL(row.shortlink, row.shortcode)
    need(!url || !shortlink || url === shortlink, 'native shortlink contradiction')
    roleURL(row.application_url, row.shortcode, true)
    const location = geography(row)
    if (!byId.has(row.shortcode)) byId.set(row.shortcode, { shortcode: row.shortcode, records: [], indexes: [], geographies: [], core: core(row) })
    const group = byId.get(row.shortcode)
    need(group.core === core(row), 'same-shortcode non-location field contradiction')
    group.records.push(row); group.indexes.push(index); group.geographies.push(location)
  }
  const groups = [...byId.values()]
  for (const group of groups) group.distinctVariantCount = new Set(group.records.map(row => canonical(without(row, new Set(Object.keys(row).filter(key => !locationKeys.has(key))))))).size
  const distinctVariantCount = groups.reduce((count, group) => count + group.distinctVariantCount, 0)
  return { mode, raw, groups, observedAt: iso(observedAt), rawRowCount: raw.jobs.length, distinctVariantCount, duplicateRowCount: raw.jobs.length - distinctVariantCount, extraVariantCount: distinctVariantCount - groups.length }
}

const textBlocks = new Set(['p', 'div', 'section', 'article', 'header', 'footer', 'aside', 'main', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'ul', 'ol', 'dl', 'dt', 'dd', 'blockquote', 'pre', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'figure', 'figcaption', 'hr'])
const visibleDescription = html => {
  if (typeof html !== 'string' || !html.trim()) return null
  const document = readVisibleNativeDocument(html, { strict: true }), root = document.nodes(node => node.tag === 'root')[0]
  // Decode original visible text leaves once. The small tree's text helper has
  // a legacy entity subset and must not turn punctuation into literal refs.
  const textOf = node => {
    if (node.inert || node.tag === 'script') return ''
    if (node.tag === 'br') return '\n'
    const content = node.children.map(child => typeof child === 'string' ? decodeHTML(child) : textOf(child)).join('')
    return textBlocks.has(node.tag) ? '\n' + content + '\n' : content
  }
  const text = root ? textOf(root).replace(/\s+/g, ' ').trim() : ''
  if (!text.replace(/&(?:[a-z][a-z0-9]+|#x[\da-f]+|#\d+);?/gi, '').trim()) return null
  return extractActiveDescription(text) ? text : null
}

export const projectIndiaObservations = (opening, details = null, closing = null) => {
  const index = snapshot => new Map((snapshot?.groups || []).map(group => [group.shortcode, group]))
  const maps = [index(opening), index(details), index(closing)], ids = [...new Set(maps.flatMap(map => [...map.keys()]))], jobs = []
  for (const id of ids) {
    const versions = maps.map(map => map.get(id)), latest = versions[2] || versions[1] || versions[0]
    const allIndia = versions.flatMap(group => group ? group.records.filter((_row, index) => group.geographies[index].hint) : [])
    if (!allIndia.length) continue
    const crossMode = Boolean(versions[0] && versions[1] && signature(versions[0], true) === signature(versions[1], true))
    const sameMode = Boolean(versions[1] && versions[2] && signature(versions[1]) === signature(versions[2]))
    const conflict = Boolean(versions[0] && versions[1] && !crossMode || versions[1] && versions[2] && !sameMode)
    const selected = latest.records.filter((_row, index) => latest.geographies[index].hint), selectedGeography = latest.geographies.filter(location => location.hint)
    const row = selected[0] || allIndia.at(-1), allQualified = selected.length > 0 && selectedGeography.every(location => location.qualified) && !conflict
    const cities = [...new Set(selectedGeography.map(location => location.city).filter(Boolean))], states = [...new Set(selectedGeography.map(location => location.state).filter(Boolean))]
    const cityConflict = selectedGeography.some(location => location.cityConflict) || cities.length > 1, stateConflict = selectedGeography.some(location => location.stateConflict) || states.length > 1
    const city = allQualified && !cityConflict && cities.length === 1 ? cities[0] : null, state = allQualified && !stateConflict && states.length === 1 ? states[0] : null
    const content = crossMode && !conflict ? visibleDescription(row.description) : null
    const observation = closing?.observedAt || details?.observedAt || opening?.observedAt
    const published = day(row.published_on), publication = published && (!observation || published <= observation.slice(0, 10)) ? published : null
    jobs.push({
      source: SOURCE, company: COMPANY, nativePublisherName: COMPANY, nativeLegalEmployer: null,
      atsPlatform: 'workable-widget-v1', companyCareerPage: CAREERS_URL, companyDomain: 'flatgigs.com',
      jobId: id, requisitionId: id, title: row.title, originalTitle: row.title,
      country: allQualified ? 'India' : '', city, state, location: allQualified ? city ? city + ', India' : 'India' : '',
      remoteStatus: row.telecommuting === true ? 'remote' : null,
      sourceUrl: row.url || row.shortlink || null, link: row.url || row.shortlink || null, applyUrl: row.application_url || null,
      description: content, jobDescription: content, sourceDescription: content,
      ...(publication ? sourcePublicationDateFields(publication) : { postingDate: null, postedAt: null }),
      sourcePublishedOn: row.published_on ?? null, sourceCreatedAt: row.created_at ?? null,
      sourcePublicationPrecision: 'calendar-day', sourcePublicationIsExactInstant: false,
      sourceEmploymentType: row.employment_type || null,
      nativeIdentityQualified: !conflict, nativeGeographyQualified: allQualified, nativeCityConflict: cityConflict, nativeStateConflict: stateConflict,
      nativeApplicationQualified: Boolean(row.application_url), nativeDescriptionVisibleQualified: Boolean(content), nativePublicationDateQualified: Boolean(publication),
      nativeCrossModeCorroborated: crossMode, nativeSameModeDataCorroborated: sameMode,
      nativeSameModeClosingQualified: false, nativeCurrentAvailabilityQualified: false,
      nativeRawEvidence: { opening: versions[0]?.records || [], details: versions[1]?.records || [], closing: versions[2]?.records || [] },
    })
  }
  return jobs
}

export const inventoriesMatch = (left, right, { omitDescription = false } = {}) => Boolean(left && right && left.groups.length === right.groups.length && left.groups.every(group => {
  const other = right.groups.find(other => other.shortcode === group.shortcode)
  return other && signature(group, omitDescription) === signature(other, omitDescription)
}))
