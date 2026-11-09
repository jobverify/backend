import { createHash } from 'node:crypto'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { parseBoundedProgram, parseRemoteLiteral } from '../../scraper-support/utils/remoteScriptData.js'
import { extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

export const CAREERS_URL = 'https://www.campsystems.com/careers'
export const BOARD_URL = 'https://recruiting.ultipro.com/CAM1010CSII/JobBoard/54a25c3a-e399-42b0-a553-16ed056e0517/'
const BOARD_ID = '54a25c3a-e399-42b0-a553-16ed056e0517'
const SOURCE = 'campsystemsinternationalinc', COMPANY = 'CAMP Systems International, Inc.'
const ORIGIN = 'https://recruiting.ultipro.com', PREFIX = new URL(BOARD_URL).pathname
const UUID = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i
const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim()
const sha = value => createHash('sha256').update(value).digest('hex')
const fail = message => { throw Object.assign(Error('CAMP public inventory: ' + message), { failureKind: 'parser_or_contract_error', abortRetries: true }) }
const requireValue = (condition, message) => { if (!condition) fail(message) }
const one = (values, message) => { requireValue(values.length === 1, message); return values[0] }
const member = node => node?.type === 'Identifier' ? node.name : node?.type === 'MemberExpression' && !node.computed && !node.optional
  ? member(node.object) + '.' + node.property.name : null
const records = (node, result = []) => {
  if (!node || typeof node !== 'object') return result
  result.push(node)
  for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(child => records(child, result)); else if (value && typeof value === 'object') records(value, result)
  return result
}
const properties = node => {
  requireValue(node?.type === 'ObjectExpression', 'native initializer changed')
  const result = new Map()
  for (const property of node.properties) {
    requireValue(property.type === 'Property' && !property.computed && !property.method && property.kind === 'init', 'dynamic native initializer')
    const name = property.key.name || property.key.value
    requireValue(typeof name === 'string' && !result.has(name) && !['__proto__', 'constructor', 'prototype'].includes(name), 'duplicate native field')
    result.set(name, property.value)
  }
  return result
}
// Ordinary scripts execute under CSS-hidden/inert ancestors. Templates, comments
// and raw-text fallbacks are structural exclusions; captured code is never run.
function surface(html) {
  requireValue(typeof html === 'string' && html.length <= 2_000_000, 'public HTML unavailable or oversized')
  const doc = document(html), nodes = []
  function visit(node) {
    if (typeof node === 'string' || ['template', 'noscript', 'textarea', 'title', 'style', 'iframe', 'plaintext', 'xmp', 'noembed', 'noframes'].includes(node.tag)) return
    nodes.push(node)
    if (node.tag !== 'script') node.children.forEach(visit)
  }
  visit(doc.root)
  const scripts = nodes.filter(node => node.tag === 'script' && !node.attrs.src
    && /^(?:|text\/javascript|application\/javascript|module)$/.test(node.attrs.type || ''))
  return { doc, nodes, scripts }
}
function program(script) {
  try { return parseBoundedProgram(script.raw || '') } catch { fail('published native program changed') }
}
const isReady = callee => member(callee) === '$' || callee?.type === 'MemberExpression' && !callee.computed
  && callee.property.name === 'ready' && callee.object.type === 'CallExpression' && member(callee.object.callee) === '$'
  && callee.object.arguments.length === 1 && member(callee.object.arguments[0]) === 'document'
const readyFunctions = ast => ast.body.filter(statement => statement.type === 'ExpressionStatement' && statement.expression.type === 'CallExpression'
  && isReady(statement.expression.callee) && statement.expression.arguments.length === 1
  && statement.expression.arguments[0].type === 'FunctionExpression' && statement.expression.arguments[0].params.length === 0)
  .map(statement => statement.expression.arguments[0])
const writeMember = node => node?.type === 'Identifier' ? node.name : node?.type === 'MemberExpression'
  ? writeMember(node.object) + '.' + (node.computed ? node.property.type === 'Literal' ? String(node.property.value) : '*' : node.property.name) : null
function validateNamespaces(parsed) {
  const protectedNames = new Set(['US', '$', 'ko'])
  const affected = value => {
    const name = value?.replace(/^(?:window|globalThis)\./, '')
    return protectedNames.has(name) || name === 'US.Opportunity' || name === 'US.*' || name === 'ko.applyBindings'
      || /^US\.Opportunity\.(?:\*|OpportunitiesViewModel|CandidateOpportunityDetail|OpportunityRenderViewModel|OpportunityDetailViewModel)$/.test(name || '')
  }
  for (const script of parsed.scripts) {
    for (const node of records(program(script))) {
      if (['FunctionDeclaration', 'ClassDeclaration'].includes(node.type) && protectedNames.has(member(node.id))
        || node.type === 'VariableDeclarator' && protectedNames.has(member(node.id))
        || node.type === 'AssignmentExpression' && affected(writeMember(node.left))
        || node.type === 'UpdateExpression' && affected(writeMember(node.argument))) fail('shadowed or reassigned native constructor namespace')
    }
  }
}
const literal = (script, node) => {
  try { return parseRemoteLiteral(script.raw.slice(node.start, node.end)) } catch { fail('native data is not a bounded literal') }
}
function initializer(html, name, constructor) {
  const parsed = surface(html), candidates = []
  validateNamespaces(parsed)
  for (const script of parsed.scripts.filter(node => (node.raw || '').includes(constructor.split('.').at(-1)))) {
    const ast = program(script), all = records(ast)
    const creations = all.filter(node => node.type === 'NewExpression' && member(node.callee) === constructor)
    for (const creation of creations) {
      const declaration = one(all.filter(node => node.type === 'VariableDeclarator' && node.init === creation && member(node.id) === name), 'unbound native model')
      const ready = readyFunctions(ast).filter(fn => fn.body.body.some(statement => statement.type === 'VariableDeclaration' && statement.declarations.includes(declaration)))
      const fn = one(ready, 'native model is not in the published ready initializer'), local = records(fn)
      requireValue(!local.some(node => node.type === 'VariableDeclarator' && ['US', '$', 'ko'].includes(member(node.id)))
        && local.filter(node => node.type === 'VariableDeclarator' && member(node.id) === name).length === 1
        && !local.some(node => node.params?.some(parameter => [name, 'US', '$', 'ko'].includes(member(parameter)))
          || node.type === 'AssignmentExpression' && (member(node.left) === name || member(node.left)?.startsWith(name + '.'))
          || node.type === 'UpdateExpression' && (member(node.argument) === name || member(node.argument)?.startsWith(name + '.'))), 'shadowed or reassigned native model')
      requireValue(creation.arguments.length === 1, 'native constructor contract changed')
      candidates.push({ ...parsed, script, ast, fn, all, value: creation.arguments[0], fields: properties(creation.arguments[0]) })
    }
  }
  return one(candidates, 'missing or ambiguous published native model')
}
function binding(parsed, model, target) {
  requireValue(parsed.nodes.filter(node => node.attrs.id === target).length === 1, 'native render target changed')
  const calls = []
  for (const script of parsed.scripts.filter(node => (node.raw || '').includes('applyBindings'))) {
    const ast = program(script), direct = new Set(readyFunctions(ast).flatMap(fn => fn.body.body.filter(statement => statement.type === 'ExpressionStatement').map(statement => statement.expression)))
    for (const node of records(ast)) if (node.type === 'CallExpression' && member(node.callee) === 'ko.applyBindings' && member(node.arguments[0]) === model) {
      requireValue(direct.has(node), 'native model render binding is not unconditional in its ready initializer')
      calls.push(node)
    }
  }
  const call = one(calls, 'native model render binding changed'), selector = call.arguments[1]
  requireValue(call.arguments.length === 2 && selector?.type === 'MemberExpression' && selector.computed && selector.property.value === 0
    && selector.object.type === 'CallExpression' && member(selector.object.callee) === '$'
    && selector.object.arguments.length === 1 && selector.object.arguments[0].value === '#' + target, 'native render binding changed')
}

export function readCampHandoff(html) {
  const { doc } = surface(html)
  const candidates = doc.nodes(node => node.tag === 'a' && node.attrs.href).filter(node => /find opportunities/i.test(doc.text(node)
    + ' ' + doc.nodes(child => child.tag === 'img', node).map(image => image.attrs.alt || '').join(' ')))
  const urls = [...new Set(candidates.map(node => new URL(node.attrs.href, CAREERS_URL).href))]
  const url = new URL(one(urls, 'missing or ambiguous Find Opportunities handoff'))
  requireValue(url.protocol === 'https:' && url.hostname === 'cta-redirect.hubspot.com' && !url.username && !url.password && !url.search && !url.hash
    && /^\/cta\/redirect\/5733783\/[a-f\d-]{36}$/.test(url.pathname), 'unreviewed careers handoff')
  requireValue(/innovative, forward-thinkers wanted/i.test(doc.text(doc.root)), 'employer careers identity changed')
  return url.href
}

export function readCampRedirect(html) {
  const { doc } = surface(html)
  const meta = one(doc.nodes(node => node.tag === 'meta' && (node.attrs['http-equiv'] || '').toLowerCase() === 'refresh'), 'missing public handoff destination')
  const match = /^0;url=(https:\/\/[^\s]+)$/i.exec(meta.attrs.content || '')
  requireValue(match && match[1] === BOARD_URL + '?q=&o=postedDateDesc', 'unreviewed board or filtered handoff')
  requireValue(doc.nodes(node => node.tag === 'a' && node.attrs.href === match[1]).length === 1, 'handoff destinations disagree')
  return match[1]
}

export function readCampBoard(html) {
  const parsed = initializer(html, 'opportunityModel', 'US.Opportunity.OpportunitiesViewModel')
  const field = name => { requireValue(parsed.fields.has(name), 'missing native board field'); return literal(parsed.script, parsed.fields.get(name)) }
  binding(parsed, 'opportunityModel', 'OpportunitiesContainer')
  const jobBoard = field('jobBoard'), pageSize = field('pageSize')
  requireValue(jobBoard.Id === BOARD_ID && jobBoard.AllowExternal === true && jobBoard.AllowInternal === false
    && jobBoard.FilterCategory === null && jobBoard.FilterValues === null && jobBoard.HasThirdPartyPostings === false
    && field('isAuthenticated') === false && field('isInternal') === false && field('jobBoardChoices') === 0
    && Array.isArray(field('initialFeaturedOpportunities')) && field('initialFeaturedOpportunities').length === 0, 'board is filtered, internal or incomplete')
  const loadUrl = field('loadUrl'), opportunityLinkUrl = field('opportunityLinkUrl')
  requireValue(Number.isSafeInteger(pageSize) && pageSize >= 1 && pageSize <= 100
    && loadUrl === PREFIX + 'JobBoardView/LoadSearchResults'
    && opportunityLinkUrl === PREFIX + 'OpportunityDetail?opportunityId=00000000-0000-0000-0000-000000000000', 'public native route contract changed')
  return { pageSize, loadUrl: new URL(loadUrl, ORIGIN).href, opportunityLinkUrl, jobBoard }
}

function anonymousToken(html) {
  const candidates = surface(html).scripts.filter(node => /X-RequestVerificationToken/.test(node.raw || ''))
  const script = one(candidates, 'anonymous public session declaration changed'), ast = program(script)
  const inputs = records(ast).filter(node => node.type === 'Literal' && typeof node.value === 'string' && /^<input\b/i.test(node.value))
  const inputNode = one(inputs, 'anonymous public input changed'), input = one(document(inputNode.value).nodes(node => node.tag === 'input'), 'anonymous public input changed')
  requireValue(input.attrs.name === '__RequestVerificationToken' && input.attrs.type === 'hidden'
    && /^[A-Za-z\d_-]{1,8192}$/.test(input.attrs.value || ''), 'anonymous public input unavailable')
  const value = input.attrs.value
  inputNode.value = '<input name="__RequestVerificationToken" type="hidden" value="REDACTED" />'
  const expected = parseBoundedProgram(`$(function() {$('<input name="__RequestVerificationToken" type="hidden" value="REDACTED" />').appendTo("body");});
    $(document).ajaxSend(function(event,xhr,options){if(['GET','HEAD'].indexOf(options.type)===-1){xhr.setRequestHeader('X-RequestVerificationToken',$('input[name="__RequestVerificationToken"]').val());}});`)
  const shape = node => JSON.stringify(node, (key, item) => ['start', 'end', 'raw'].includes(key) ? undefined : item)
  requireValue(shape(ast) === shape(expected), 'anonymous public session program changed')
  return value
}

const countryNames = new Map([['IND', 'India'], ['USA', 'United States'], ['CAN', 'Canada'], ['GBR', 'United Kingdom']])
function worksite(locations) {
  if (!Array.isArray(locations) || !locations.length) return { countries: [], unresolved: true, identity: [] }
  const ids = new Set(), countries = [], identity = []
  let unresolved = false
  for (const location of locations) {
    requireValue(location && UUID.test(location.Id) && !ids.has(location.Id), 'invalid or duplicate native worksite')
    ids.add(location.Id)
    const address = location.Address, country = countryNames.get(address?.Country?.Code)
    const namedCountries = [['India', /\bIndia\b/i], ['United States', /\b(?:USA|United States)\b/i],
      ['Canada', /\bCanada\b/i], ['United Kingdom', /\bUnited Kingdom\b/i]]
      .filter(([_name, pattern]) => pattern.test(location.LocalizedName || '')).map(([name]) => name)
    if (!country || address?.Country?.Name !== country || namedCountries.some(name => name !== country)) unresolved = true
    else countries.push(country)
    identity.push([location.Id, location.LocalizedName, location.LocalizedLocationId, location.LocalizedDescription,
      address?.Line1 ?? null, address?.Line2 ?? null, address?.City ?? null, address?.PostalCode ?? null,
      address?.State?.Code ?? null, address?.State?.Name ?? null, address?.Country?.Code ?? null, address?.Country?.Name ?? null])
  }
  return { countries: [...new Set(countries)].sort(), unresolved, identity: identity.sort((a, b) => a[0].localeCompare(b[0])) }
}
const sorted = value => Array.isArray(value) ? value.map(sorted) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])])) : value
const listingIdentity = record => JSON.stringify(sorted(record))
const LISTING_KEYS = 'Id Featured Title RequisitionNumber FullTime JobCategoryName Locations PostedDate BriefDescription MatchScore MatchedLocations Distance JobLocationType OpportunityType'.split(' ').sort().join('|')
const DETAIL_KEYS = 'Id Title Featured FullTime HoursPerWeek JobCategoryName Locations PostedDate UpdatedDate RequisitionNumber Description EqualOpportunityEmployerDescription PayTransparencyPolicyStatement MatchScore HasApplied ApplicationJobBoardName ApplicationJobBoardId DateApplied Salaried CompensationAmount PublishingStatus Links BehaviorCriteria MotivationCriteria EducationCriteria LicenseAndCertificationCriteria SkillCriteria WorkExperienceCriteria JobBoardMemberships AssessmentUri AssessmentStatus OpportunityIsClosed TravelRequired TravelDescription SupervisorName Assessments ApplicationId CompensationAnnualMinimum CompensationAnnualMaximum CompensationHourlyMinimum CompensationHourlyMaximum CompensationCurrencyCode CompensationCurrency JobLocationType PayRangeVisible PayRange PayRangeCurrencyCode OpportunityType'.split(' ').sort().join('|')
const nativeDate = value => {
  if (typeof value !== 'string') return false
  const parts = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.(\d{1,7}))?Z$/.exec(value)
  if (!parts || !Number.isFinite(Date.parse(value))) return false
  const date = new Date(value), expected = parts.slice(1, 7).map(Number)
  return [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()]
    .every((part, index) => part === expected[index])
}

export function readCampListing(payload, { skip, pageSize }) {
  const keys = payload && Object.keys(payload).sort().join('|')
  requireValue(payload && ['locations|opportunities|totalCount', 'initialTotalOpportunitiesCount|locations|opportunities|totalCount'].includes(keys)
    && Array.isArray(payload.opportunities) && Array.isArray(payload.locations) && payload.locations.length === 0
    && Number.isSafeInteger(payload.totalCount) && payload.totalCount >= 0 && payload.totalCount <= 1000
    && (!Object.hasOwn(payload, 'initialTotalOpportunitiesCount')
      || Number.isSafeInteger(payload.initialTotalOpportunitiesCount) && payload.initialTotalOpportunitiesCount === payload.totalCount)
    && payload.opportunities.length === Math.min(pageSize, Math.max(0, payload.totalCount - skip)), 'native total and pagination do not reconcile')
  const ids = new Set()
  for (const row of payload.opportunities) {
    requireValue(row && Object.keys(row).sort().join('|') === LISTING_KEYS, 'unreviewed native listing fields')
    requireValue(row && UUID.test(row.Id) && !ids.has(row.Id) && typeof row.Title === 'string' && clean(row.Title)
      && typeof row.RequisitionNumber === 'string' && clean(row.RequisitionNumber) && typeof row.FullTime === 'boolean'
      && typeof row.JobCategoryName === 'string' && typeof row.BriefDescription === 'string'
      && nativeDate(row.PostedDate), 'native role identity or posting date changed')
    ids.add(row.Id); worksite(row.Locations)
  }
  return payload
}

export function readCampDetail(html, listing, retainNative) {
  const parsed = initializer(html, 'opportunity', 'US.Opportunity.CandidateOpportunityDetail'), model = literal(parsed.script, parsed.value)
  retainNative?.(structuredClone(model))
  requireValue(Object.keys(model).sort().join('|') === DETAIL_KEYS, 'unreviewed native detail fields or qualifications')
  const constructors = records(parsed.fn).filter(node => node.type === 'NewExpression')
  const renderer = one(constructors.filter(node => member(node.callee) === 'US.Opportunity.OpportunityRenderViewModel'), 'native renderer changed')
  const view = one(constructors.filter(node => member(node.callee) === 'US.Opportunity.OpportunityDetailViewModel'), 'native view changed')
  const renderFields = properties(renderer.arguments[0]), viewFields = properties(view.arguments[0])
  requireValue(member(renderFields.get('opportunity')) === 'opportunity' && member(viewFields.get('opportunity')) === 'opportunity'
    && member(viewFields.get('renderer')) === 'renderer' && literal(parsed.script, renderFields.get('currentJobBoardId')) === BOARD_ID
    && literal(parsed.script, viewFields.get('currentJobBoardId')) === BOARD_ID && literal(parsed.script, renderFields.get('isViewingInternal')) === false, 'detail is not bound to the declared external board')
  const rendererBinding = one(records(parsed.fn).filter(node => node.type === 'VariableDeclarator' && node.init === renderer && member(node.id) === 'renderer'), 'native renderer binding changed')
  const assignment = one(records(parsed.fn).filter(node => node.type === 'AssignmentExpression' && node.right === view && member(node.left) === 'US.CurrentOpportunityDetailViewModel'), 'native view binding changed')
  requireValue(rendererBinding && assignment, 'native rendering model changed')
  const local = records(parsed.fn)
  requireValue(local.filter(node => node.type === 'VariableDeclarator' && member(node.id) === 'renderer').length === 1
    && !local.some(node => node.type === 'AssignmentExpression' && (member(node.left) === 'renderer' || member(node.left)?.startsWith('renderer.'))), 'reassigned native renderer')
  binding(parsed, 'US.CurrentOpportunityDetailViewModel', 'opportunityDetailView')
  requireValue(parsed.nodes.filter(node => node.attrs['data-automation'] === 'job-description' && node.attrs['data-bind'] === 'html: Description').length === 1, 'native description render binding changed')
  requireValue(model.Id === listing.Id && model.Title === listing.Title && model.RequisitionNumber === listing.RequisitionNumber
    && model.FullTime === listing.FullTime && model.JobCategoryName === listing.JobCategoryName
    && JSON.stringify(worksite(model.Locations).identity) === JSON.stringify(worksite(listing.Locations).identity)
    && model.PublishingStatus === 1 && model.OpportunityIsClosed === false && model.HasApplied === false
    && model.ApplicationId == null && model.DateApplied == null, 'native listing and full detail disagree')
  const membership = one(model.JobBoardMemberships?.filter(row => row.JobBoardId === BOARD_ID) || [], 'missing current public board membership')
  requireValue(membership.PublishedExternal === true && membership.ExternalPostedDate === listing.PostedDate, 'native posting date or membership changed')
  // These extra public qualifications would need their own template projection.
  // Preserve the full model and withhold a role rather than silently dropping them.
  for (const key of ['BehaviorCriteria', 'MotivationCriteria', 'EducationCriteria', 'LicenseAndCertificationCriteria', 'SkillCriteria', 'WorkExperienceCriteria']) {
    requireValue(Array.isArray(model[key]) && model[key].length === 0, 'unprojected additional native qualifications')
  }
  requireValue(model.TravelRequired == null && model.TravelDescription == null && model.PayRangeVisible === false, 'unprojected additional native criteria')
  requireValue(Array.isArray(model.Links) && model.Links.length === 0, 'unprojected additional native attachments')
  requireValue([model.EqualOpportunityEmployerDescription, model.PayTransparencyPolicyStatement].every(value => value == null || typeof value === 'string'), 'native description fields changed')
  requireValue(typeof model.Description === 'string' && clean(model.Description), 'full native description unavailable')
  const raw = [model.Description, model.EqualOpportunityEmployerDescription, model.PayTransparencyPolicyStatement].filter(value => value != null && value !== '').join('\n')
  const visible = extractActiveDescription(raw)
  requireValue(Boolean(visible), 'full native description unavailable')
  const place = worksite(model.Locations), sourceUrl = BOARD_URL + 'OpportunityDetail?opportunityId=' + model.Id
  return { source: SOURCE, company: COMPANY, jobId: model.Id, requisitionId: model.RequisitionNumber, title: model.Title,
    link: sourceUrl, sourceUrl, applyUrl: sourceUrl, companyCareerPage: CAREERS_URL, companyDomain: 'campsystems.com',
    country: place.unresolved ? null : place.countries.includes('India') ? 'India' : place.countries.length === 1 ? place.countries[0] : null,
    sourceNativeCountries: place.countries, sourceCountryScopeUnresolved: place.unresolved,
    location: model.Locations.map(location => location.LocalizedName).join(' | '), city: null, state: null,
    department: model.JobCategoryName, employmentType: model.FullTime ? 'Full time' : 'Part time', postingDate: listing.PostedDate,
    closingDate: null, experienceRequired: null, minimumQualification: null, preferredQualification: null, requiredSkills: [],
    jobDescription: raw, sourceNativeDescriptionHTML: model.Description, sourceNativeVisibleDescription: visible,
    sourceNativeDescriptionSha256: sha(raw), sourceNativeListingRecord: structuredClone(listing), sourceNativeDetailRecord: model,
    sourceDetailComplete: true, sourceNativeDetailQualified: true, sourceListingComplete: false,
    sourceScopeComplete: false, lifecycleCleanupAllowed: false }
}

export function createCurrentCampScraper() {
  return { async run(options = {}) {
    const timeoutMs = options.timeoutMs ?? 180000
    requireValue(Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 300000, 'invalid source deadline')
    requireValue(options.maxJobs == null || Number.isSafeInteger(options.maxJobs) && options.maxJobs >= 0, 'invalid output limit')
    requireValue(options.signal == null || options.signal instanceof AbortSignal, 'invalid caller cancellation signal')
    const deadline = new AbortController(), timer = setTimeout(() => deadline.abort(new DOMException('CAMP source deadline exceeded', 'TimeoutError')), timeoutMs)
    const signal = AbortSignal.any([deadline.signal, ...(options.signal ? [options.signal] : [])])
    const wait = (promise, active = signal) => new Promise((resolve, reject) => {
      const finish = (callback, value) => { active.removeEventListener('abort', abort); callback(value) }
      const abort = () => finish(reject, active.reason)
      active.addEventListener('abort', abort, { once: true })
      Promise.resolve(promise).then(value => finish(resolve, value), error => finish(reject, error))
      if (active.aborted) abort()
    })
    let pagesFetched = 0
    const read = async (url, session, body) => {
      signal.throwIfAborted()
      const active = AbortSignal.any([signal, AbortSignal.timeout(20000)])
      const native = new URL(url).origin === ORIGIN
      requireValue(!session || native, 'anonymous session scope mismatch')
      const headers = { Accept: body ? 'application/json' : 'text/html', 'User-Agent': 'Mozilla/5.0',
        ...(session ? { Cookie: session.cookie } : {}), ...(body ? { 'Content-Type': 'application/json; charset=utf-8', 'X-RequestVerificationToken': session.token } : {}) }
      let response
      try { response = await wait((options.fetchImpl || fetch)(url, { method: body ? 'POST' : 'GET', redirect: 'manual', signal: active, headers, ...(body ? { body: JSON.stringify(body) } : {}) }), active) }
      catch { signal.throwIfAborted(); active.throwIfAborted(); fail('public transport unavailable') }
      pagesFetched++
      if (response?.status !== 200 || response.url !== url) {
        const status = response?.status
        // Body cancellation is best-effort; it must not hold a rejected source.
        try { Promise.resolve(response?.body?.cancel?.()).catch(() => {}) } catch {}
        const error = Object.assign(Error('CAMP public surface unavailable (HTTP ' + status + ')'), {
          status, source: SOURCE, surface: url, failureKind: [401, 403, 429].includes(status) ? 'blocked_or_access_denied' : 'upstream_http_error',
          abortRetries: true, nativeJobTotal: null, nativeIndiaTotal: null })
        if (error.failureKind === 'blocked_or_access_denied') deadline.abort(error)
        throw error
      }
      let text
      try { text = await wait(Promise.resolve().then(() => response.text()), active) }
      catch { signal.throwIfAborted(); active.throwIfAborted(); fail('public response body unavailable') }
      requireValue(typeof text === 'string' && text.length <= 2_000_000, 'public response exceeds source bound')
      active.throwIfAborted()
      return { text, response }
    }
    try {
      signal.throwIfAborted()
      const now = new Date((options.now || (() => new Date()))())
      requireValue(Number.isFinite(now.getTime()), 'invalid observation time')
      const start = async () => {
        const corporate = await read(CAREERS_URL), handoff = readCampHandoff(corporate.text)
        const target = readCampRedirect((await read(handoff)).text), board = await read(target), config = readCampBoard(board.text)
        const cookie = (board.response.headers?.getSetCookie?.() || []).map(value => value.split(';')[0]).join('; ')
        requireValue(cookie.length > 0 && cookie.length <= 20000 && !/[\r\n]/.test(cookie), 'anonymous public session unavailable')
        return { handoff, target, config, session: { cookie, token: anonymousToken(board.text) } }
      }
      const listing = async context => {
        const rows = [], ids = new Set()
        let total = null
        for (let skip = 0; total === null || skip < total; skip += context.config.pageSize) {
          const body = { opportunitySearch: { Top: context.config.pageSize, Skip: skip, QueryString: '',
            OrderBy: [{ Value: 'postedDateDesc', PropertyName: 'PostedDate', Ascending: false }], Filters: [] } }
          const text = (await read(context.config.loadUrl, context.session, body)).text
          let payload
          try { payload = JSON.parse(text) } catch { fail('native inventory JSON unavailable') }
          const page = readCampListing(payload, { skip, pageSize: context.config.pageSize })
          requireValue(total === null || total === page.totalCount, 'native total changed during pagination')
          total = page.totalCount
          for (const row of page.opportunities) { requireValue(!ids.has(row.Id), 'duplicate native role across pages'); ids.add(row.Id); rows.push(row) }
        }
        requireValue(rows.length === total, 'native unique identities and total disagree')
        return rows
      }
      const snapshot = async context => {
        const native = await listing(context), rows = new Array(native.length), failures = []
        let index = 0
        await Promise.all(Array.from({ length: Math.min(4, native.length) }, async () => {
          while (index < native.length) {
            const current = index++, record = native[current], url = BOARD_URL + 'OpportunityDetail?opportunityId=' + record.Id
            let nativeDetail = null
            try { rows[current] = readCampDetail((await read(url, context.session)).text, record, value => { nativeDetail = value }) }
            catch (error) {
              signal.throwIfAborted()
              if (error.failureKind === 'blocked_or_access_denied') throw error
              rows[current] = { source: SOURCE, jobId: record.Id, sourceNativeListingRecord: record, sourceNativeDetailRecord: nativeDetail,
                sourceNativeDescriptionHTML: nativeDetail?.Description ?? null, jobDescription: null, sourceDetailComplete: false,
                sourceCountryScopeUnresolved: worksite(record.Locations).unresolved, sourceNativeCountries: worksite(record.Locations).countries }
              failures.push({ jobId: record.Id, failureKind: error.failureKind || 'native-detail-unavailable' })
            }
          }
        }))
        return { native, rows, failures }
      }
      const first = await start(), opening = await snapshot(first), last = await start(), closing = await snapshot(last)
      const end = await listing(last), byId = rows => new Map(rows.map(row => [row.Id, row]))
      const initial = byId(opening.native), final = byId(end), initialDetails = new Map(opening.rows.map(row => [row.jobId, row]))
      const listingStable = JSON.stringify(first.config) === JSON.stringify(last.config) && first.handoff === last.handoff && first.target === last.target
        && initial.size === closing.native.length && final.size === closing.native.length
        && closing.native.every(row => initial.has(row.Id) && final.has(row.Id) && listingIdentity(row) === listingIdentity(initial.get(row.Id)) && listingIdentity(row) === listingIdentity(final.get(row.Id)))
      for (const row of closing.rows) {
        const prior = initialDetails.get(row.jobId)
        row.sourceCurrentPostingStable = Boolean(prior?.sourceDetailComplete && row.sourceDetailComplete
          && initial.has(row.jobId) && final.has(row.jobId) && listingIdentity(row.sourceNativeListingRecord) === listingIdentity(final.get(row.jobId))
          && JSON.stringify(prior.sourceNativeDetailRecord) === JSON.stringify(row.sourceNativeDetailRecord))
        row.scrapedAt = now.toISOString()
      }
      const candidates = closing.rows.filter(row => row.country === 'India' && row.sourceDetailComplete && row.sourceCurrentPostingStable)
      const jobs = options.maxJobs ? candidates.slice(0, options.maxJobs) : candidates
      const complete = listingStable && !opening.failures.length && !closing.failures.length
        && closing.rows.every(row => row.sourceCurrentPostingStable && !row.sourceCountryScopeUnresolved) && jobs.length === candidates.length
      for (const row of jobs) row.sourceListingComplete = complete
      const evidence = { status: complete ? end.length ? 'complete-inventory' : 'verified-empty' : 'coverage-gap',
        surface: last.config.loadUrl, firstParty: true, listingComplete: complete, pagesFetched,
        reportedTotal: listingStable ? end.length : null, indiaFacetCount: complete ? candidates.length : null, verifiedAt: new Date().toISOString(),
        reason: complete ? 'Declared current CAMP public board, unfiltered native total, full descriptions and final membership reconcile'
          : 'CAMP native listing, countries or full role criteria remain incomplete; company-wide totals and lifecycle cleanup remain unproved' }
      attachInventoryEvidence(jobs, evidence)
      attachSourceObservationEvidence(jobs, { source: SOURCE, recordKind: 'vacancy-rows', observedRecordCount: closing.native.length,
        observedVacancyCount: closing.native.length, sourceScopeComplete: false })
      if (options.onRecords) await wait(Promise.resolve().then(() => options.onRecords(structuredClone(closing.rows))))
      if (options.onAudit) await wait(Promise.resolve().then(() => options.onAudit({ source: SOURCE, opening, closing,
        finalNativeListing: end, listingStable, inventoryEvidence: evidence, productionWrites: false })))
      signal.throwIfAborted()
      return jobs
    } finally { clearTimeout(timer) }
  } }
}
