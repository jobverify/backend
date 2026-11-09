import { activeScripts } from '../../scraper-support/utils/activeNativeHtml.js'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { parseNativeRole } from '../../scraper-support/shared/rmkNativePair.js'
import { parseBoundedProgram, parseRemoteLiteral } from '../../scraper-support/utils/remoteScriptData.js'
import { readAixNativeInit } from '../bounteous/nativeScriptContract.js'

const ORIGIN = 'https://careers.airindia.com'
const check = (ok, message) => { if (!ok) throw Error('AirAsia India positive AIX: ' + message) }
const one = (values, label) => { check(values.length === 1, 'expected one native ' + label); return values[0] }
const member = node => node?.type === 'Identifier' ? node.name : node?.type === 'MemberExpression' && !node.computed
  ? member(node.object) + '.' + node.property.name : null
const walk = node => !node || typeof node !== 'object' ? [] : [node, ...Object.values(node).flatMap(value =>
  Array.isArray(value) ? value.flatMap(walk) : value && typeof value === 'object' ? walk(value) : [])]
const ISO_COUNTRIES = new Set('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' '))
const countryNames = new Intl.DisplayNames(['en'], { type: 'region' })
const namedCountries = new Map([...ISO_COUNTRIES].map(code => [countryNames.of(code).toLowerCase(), code]))
for (const [name, code] of [['united states of america', 'US'], ['usa', 'US'], ['u.s.a.', 'US'], ['uk', 'GB'], ['u.k.', 'GB'], ['great britain', 'GB']]) namedCountries.set(name, code)

export function assertNoPositiveAixInventory(html) {
  const d = document(html)
  check(!d.nodes(node => ['job-tile-list', 'tile-search-results-label'].includes(node.attrs.id)
    || Number(node.attrs['data-record-returned']) > 0).length, 'positive native role count carrier conflicts with zero inventory')
  for (const source of activeScripts(html)) check(!walk(parseBoundedProgram(source)).some(node => node.type === 'CallExpression'
    && member(node.callee) === 'j2w.SearchResults.init'), 'positive native search initializer cannot certify zero without its role inventory')
}

function nativeSearchConfig(html) {
  const candidates = []
  for (const source of activeScripts(html)) {
    const ast = parseBoundedProgram(source), nodes = walk(ast)
    check(!nodes.some(node => node.type === 'VariableDeclarator' && ['$', 'parseInt'].includes(member(node.id))
      || ['FunctionDeclaration', 'ClassDeclaration'].includes(node.type) && ['$', 'parseInt'].includes(member(node.id))
      || node.type === 'AssignmentExpression' && ['$', 'parseInt', 'j2w.SearchResults', 'j2w.SearchResults.init'].includes(member(node.left))), 'shadowed native search initializer namespace')
    const calls = nodes.filter(node => node.type === 'CallExpression' && member(node.callee) === 'j2w.SearchResults.init')
    if (!calls.length) continue
    const ready = ast.body[0]?.expression, fn = ready?.arguments?.[0], call = one(calls, 'search initializer')
    check(ast.body.length === 1 && ast.body[0].type === 'ExpressionStatement' && ready.type === 'CallExpression'
      && member(ready.callee) === '$' && ready.arguments.length === 1 && fn?.type === 'FunctionExpression'
      && fn.params.length === 0 && fn.body.body.length === 1 && fn.body.body[0].type === 'ExpressionStatement'
      && fn.body.body[0].expression === call && call.arguments.length === 1 && call.arguments[0].type === 'ObjectExpression', 'native search initializer is not unconditional in the ready callback')
    const values = {}
    for (const property of call.arguments[0].properties) {
      const key = property.key?.name ?? property.key?.value
      check(property.type === 'Property' && !property.computed && !property.method && property.kind === 'init'
        && typeof key === 'string' && !Object.hasOwn(values, key) && !['__proto__', 'constructor', 'prototype'].includes(key), 'unreviewed native search initializer property')
      const value = property.value
      if (['jobRecordsFound', 'jobRecordsPerPage'].includes(key)) {
        check(value.type === 'CallExpression' && member(value.callee) === 'parseInt' && value.arguments.length === 1
          && value.arguments[0].type === 'Literal' && /^\d{1,5}$/.test(value.arguments[0].value), 'dynamic native pagination count')
        values[key] = Number(value.arguments[0].value)
      } else values[key] = parseRemoteLiteral(source.slice(value.start, value.end))
    }
    check(values.apiEndpoint === 'tile-search-results' && values.searchQuery === '?q=&sortColumn=referencedate&sortDirection=desc'
      && values.searchResults === '' && values.tileSearchResultsText === 'Showing {0} to {1} of {2} Jobs'
      && Number.isSafeInteger(values.jobRecordsFound) && values.jobRecordsFound > 0 && values.jobRecordsFound <= 10000
      && Number.isSafeInteger(values.jobRecordsPerPage) && values.jobRecordsPerPage > 0 && values.jobRecordsPerPage <= 100, 'native unfiltered search query or pagination contract changed')
    candidates.push({ total: values.jobRecordsFound, pageSize: values.jobRecordsPerPage, query: values.searchQuery })
  }
  return one(candidates, 'positive search initializer')
}

const roleUrl = value => {
  const url = new URL(value, ORIGIN)
  check(url.protocol === 'https:' && url.origin === ORIGIN && !url.username && !url.password && !url.search && !url.hash
    && /^\/(?:aix\/)?job\/[^/]+\/[1-9]\d*\/$/.test(url.pathname), 'native role URL identity changed')
  return url.href
}

export function readPositiveAixPage(html, { start = 0, config = null } = {}) {
  const d = document(html), initial = config === null
  if (initial) {
    check(!d.nodes(node => node.attrs.id === 'noresults').length, 'positive role tiles conflict with stale zero-result copy')
    config = nativeSearchConfig(html)
    const list = one(d.nodes(node => node.attrs.id === 'job-tile-list'), 'positive role list')
    check(Number(list.attrs['data-per-page']) === config.pageSize
      && Number(list.attrs['data-record-returned']) === Math.min(config.total, config.pageSize), 'native role list counts conflict with pagination')
    const label = d.text(one(d.nodes(node => node.attrs.id === 'tile-search-results-label'), 'positive role total'))
    check(label === `Showing 1 to ${Math.min(config.total, config.pageSize)} of ${config.total} Jobs`, 'native positive listing total does not reconcile')
    const accessible = d.text(one(d.nodes(node => node.attrs.id === 'searchresultslabel'), 'accessible role total'))
    check(accessible.includes(label), 'responsive native listing totals conflict')
  }
  const tiles = d.nodes(node => node.tag === 'li' && d.hasClass(node, 'job-tile'))
  check(tiles.length === Math.min(config.pageSize, config.total - start), 'native positive page role count does not reconcile')
  const rows = tiles.map((tile, index) => {
    const links = d.nodes(node => node.tag === 'a' && d.hasClass(node, 'jobTitle-link'), tile)
    const first = one([...new Set(links.map(node => roleUrl(node.attrs.href)))], 'responsive role URL')
    const jobId = new URL(first).pathname.split('/').at(-2), title = one([...new Set(links.map(node => d.text(node)))], 'responsive role title')
    check(title && links.length > 0 && roleUrl(tile.attrs['data-url']) === first
      && tile.attrs['data-row-index'] === String(start + index + 1) && d.hasClass(tile, 'job-id-' + jobId), 'native role tile public identity or index changed')
    const field = suffix => d.nodes(node => node.attrs.id?.startsWith('job-' + jobId + '-') && node.attrs.id.endsWith(suffix), tile).map(node => d.text(node))
    const requisitionId = one([...new Set(field('-section-customfield1-value'))], 'listing requisition')
    const department = one([...new Set(field('-section-dept-value'))], 'listing department')
    const city = one(field('-desktop-section-city-value'), 'listing primary city')
    const locations = [...new Set(field('-section-location-value'))]
    check(/^[1-9]\d*$/.test(requisitionId) && city && locations.length > 0
      && locations.every(location => location.split(',')[0].trim() === city), 'native listing requisition or responsive location conflict')
    return { jobId, title, sourceUrl: first, requisitionId, department, city, locations }
  })
  const observedLinks = d.nodes(node => node.tag === 'a' && /\/jobs?\//i.test(node.attrs.href || ''))
  check(observedLinks.every(node => rows.some(row => roleUrl(node.attrs.href) === row.sourceUrl)
    && tiles.some(tile => d.nodes(child => child === node, tile).length)), 'unreconciled native positive role link')
  check(new Set(rows.map(row => row.jobId)).size === rows.length, 'duplicate native role identity on a page')
  return { config, rows, nextUrl: start + rows.length < config.total
    ? ORIGIN + '/aix/tile-search-results/' + config.query + '&startrow=' + (start + rows.length) : null }
}

function nativeDate(value) {
  const match = typeof value === 'string' && /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{2}) (\d{2}):(\d{2}):(\d{2}) UTC (\d{4})$/.exec(value)
  check(match, 'unsupported native posting date')
  const date = new Date(value), months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  check(Number.isFinite(date.getTime()) && date.getUTCFullYear() === Number(match[7]) && date.getUTCMonth() === months.indexOf(match[2])
    && date.getUTCDate() === Number(match[3]) && date.getUTCHours() === Number(match[4]) && date.getUTCMinutes() === Number(match[5])
    && date.getUTCSeconds() === Number(match[6]) && ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getUTCDay()] === match[1], 'invalid native posting date calendar or weekday')
  return date.toISOString()
}

export function readPositiveAixRole(html, row, now) {
  const d = document(html), init = readAixNativeInit(html), body = one(d.nodes(node => node.tag === 'body'), 'role body')
  check(init.ssoCompanyId === 'airindiali' && ['', 'aix'].includes(init.brand) && init.siteTypeId === 1 && init.categoryId === 0
    && d.hasClass(body, 'bodyaix') === (init.brand === 'aix'), 'native role tenant or employer brand changed')
  const canonical = one(d.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical'), 'canonical role URL')
  check(roleUrl(canonical.attrs.href) === row.sourceUrl, 'canonical role public identity conflict')
  const scope = one(d.nodes(node => Object.hasOwn(node.attrs, 'itemscope') && /^https?:\/\/schema\.org\/JobPosting\/?$/.test(node.attrs.itemtype || '')), 'active full JobPosting')
  const property = name => d.nodes(node => node.attrs.itemprop === name, scope)
  const content = name => { const node = one(property(name), name); return node.attrs.content ?? d.text(node) }
  check(content('title') === row.title && content('hiringOrganization') === 'Air India Careers', 'native role title or hiring employer conflicts with listing')
  const descriptionNode = one(property('description'), 'full role description'), description = d.inner(descriptionNode), plain = d.text(descriptionNode)
  check(/\bThis opportunity is with Air India Express\./.test(plain), 'explicit native AIX employer opportunity statement missing')
  check(plain.length >= 180 && !/(?:job (?:is )?no longer available|position has been filled|requisition is no longer active)/i.test(d.text(scope)), 'full active native role description unavailable')
  const addresses = property('address').map(address => {
    check(d.nodes(child => child.attrs.itemprop, address).every(child => ['address', 'addressLocality', 'addressRegion', 'addressCountry'].includes(child.attrs.itemprop)), 'unreviewed native typed address country fields')
    const read = name => { const node = one(d.nodes(child => child.attrs.itemprop === name, address), 'typed ' + name); return node.attrs.content ?? d.text(node) }
    return { city: read('addressLocality'), region: read('addressRegion'), countryCode: read('addressCountry') }
  })
  check(addresses.length === 1 && addresses[0].city === row.city && ISO_COUNTRIES.has(addresses[0].countryCode), 'typed native ISO country or listing/detail location conflict')
  check(d.text(one(d.nodes(node => node.attrs['data-careersite-propertyid'] === 'city', scope), 'visible detail city')) === row.city, 'visible native role city conflicts with listing and typed address')
  const listingCountries = row.locations.flatMap(location => location.split(/[,;|]/).map(value => value.trim()).flatMap(value => {
    const code = ISO_COUNTRIES.has(value) ? value : namedCountries.get(value.toLowerCase())
    return code ? [code] : []
  }))
  check(listingCountries.every(code => code === addresses[0].countryCode), 'explicit native listing country conflicts with typed detail country')
  const applications = [...new Set(d.nodes(node => node.tag === 'a' && /\/talentcommunity\/apply\//.test(node.attrs.href || '')).map(node => new URL(node.attrs.href, row.sourceUrl).href))]
  check(applications.length === 1 && applications.every(value => {
    const url = new URL(value)
    return url.protocol === 'https:' && url.origin === ORIGIN && !url.username && !url.password && !url.hash
      && url.pathname === '/talentcommunity/apply/' + row.jobId + '/' && url.search === '?locale=en_US'
  }), 'native application public identity or query conflict')
  const postingDate = nativeDate(content('datePosted')), closingDate = nativeDate(content('validThrough'))
  check(Date.parse(postingDate) <= Date.parse(now) && Date.parse(closingDate) > Date.parse(now)
    && postingDate <= closingDate, 'future posting date or expired native application date')
  const state = { publicId: row.jobId, title: row.title, employer: 'Air India Express', addresses, description, postingDate, closingDate, applyUrl: applications[0] }
  if (addresses[0].countryCode !== 'IN') return { state, excluded: true, reason: 'explicit-native-country-outside-India' }
  const job = parseNativeRole(html, { ...row, countryCode: 'IN', locations: [row.city], expectedLocationCount: 1 },
    { source: 'airasiaindia', companyName: 'Air India Express', companyToken: 'airindiali', nativeEmployer: 'Air India Careers', origin: ORIGIN }, now)
  const complete = job.sourceDetailComplete || /Who can Apply:/i.test(plain) && /Requirements\s*:/i.test(plain) && /Stages of Selection/i.test(plain)
  check(!job.excluded && complete, 'native full role responsibilities or qualification sections are incomplete')
  delete job.sourceDetailFailureKind
  return { state, job: { ...job, requisitionId: row.requisitionId, department: row.department, sourceDetailComplete: true,
    sourceDetailStatus: 'complete', sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
    nativeEmployerBrand: 'Air India Express', companyCareerPage: 'https://www.airindiaexpress.com/careers',
    sourceNativeListingRecord: row, sourceNativeEmployerStatement: 'This opportunity is with Air India Express.' } }
}
