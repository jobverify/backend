import crypto from 'node:crypto'
import { createHTMLTransport, MAX_HTML_BYTES, HTML_REQUEST_TIMEOUT_MS } from '../../scraper-support/shared/firstPartyHtmlJobs.js'
import { nativeCountryName, nativeLocationCountryName } from '../../scraper-support/shared/nativeJobPosting.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { parseBoundedProgram, parseRemoteLiteral } from '../../scraper-support/utils/remoteScriptData.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import LINEAR_CATALOG from './catalog.js'

export const SOURCE = LINEAR_CATALOG.source
export const COMPANY = LINEAR_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = LINEAR_CATALOG.officialBrandName
export const VERIFIED_ON = LINEAR_CATALOG.verifiedOn
export const PROVIDER_METADATA = LINEAR_CATALOG
export const CAREERS_PAGE_URL = LINEAR_CATALOG.companyCareerPage
export const NATIVE_API_URL = 'https://api.ashbyhq.com/posting-api/job-board/Linear'
const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i
const norm = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const requireLinear = (condition, reason) => { if (!condition) throw Object.assign(new Error('[linear] Linear ' + reason), { abortRetries: true }) }
const one = (values, reason) => { requireLinear(values.length === 1, 'missing/ambiguous ' + reason); return values[0] }
const executable = node => node.tag === 'script' && !node.attrs.src && !Object.hasOwn(node.attrs, 'nomodule')
  && /^(?:|module|text\/javascript|application\/javascript)$/i.test(node.attrs.type || '')
const shape = node => JSON.stringify(node, (key, value) => ['start', 'end', 'raw'].includes(key) ? undefined : value)
const stableData = value => Array.isArray(value) ? value.map(stableData) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stableData(value[key])])) : value
const dataSignature = value => JSON.stringify(stableData(value))
const bootstrap = '((self[Symbol.for("vinext.navigationRuntime")]??={bootstrap:{routeManifest:null},functions:{}}).bootstrap.rsc??={rsc:[]})'
const pushShape = shape(parseBoundedProgram(bootstrap + '.rsc.push("")').body[0].expression)
const doneShape = shape(parseBoundedProgram(bootstrap + '.done=true').body[0].expression)
const assignTargetShape = shape(parseBoundedProgram(bootstrap).body[0].expression)

const executableRuntime = html => {
  requireLinear(typeof html === 'string' && Buffer.byteLength(html) <= MAX_HTML_BYTES, 'careers response body exceeds bound')
  const doc = readVisibleNativeDocument(html, { strict: true })
  requireLinear(doc.nodes(node => node.tag === 'base').length === 0, 'careers base URL changed')
  const scripts = doc.nodes(executable).filter(node => (node.raw || '').includes('vinext.navigationRuntime'))
  let done = false, nav = false, compatibility = false
  const chunks = []
  for (const script of scripts) for (const statement of parseBoundedProgram(script.raw).body) {
    const expression = statement.type === 'ExpressionStatement' && statement.expression
    requireLinear(expression && !done, 'careers runtime mutation after completion')
    if (expression.type === 'CallExpression' && expression.arguments.length === 1
      && expression.arguments[0].type === 'Literal' && typeof expression.arguments[0].value === 'string') {
      const copy = structuredClone(expression), value = copy.arguments[0].value
      copy.arguments[0].value = ''
      requireLinear(shape(copy) === pushShape, 'careers runtime push target changed')
      chunks.push(value)
    } else if (shape(expression) === doneShape) done = true
    else {
      requireLinear(expression.type === 'CallExpression' && !expression.optional
        && expression.callee.type === 'MemberExpression' && !expression.callee.computed && !expression.callee.optional
        && expression.callee.object.type === 'Identifier' && expression.callee.object.name === 'Object'
        && expression.callee.property.name === 'assign' && expression.arguments.length === 2
        && shape(expression.arguments[0]) === assignTargetShape, 'careers runtime assignment changed')
      const value = parseRemoteLiteral(script.raw.slice(expression.arguments[1].start, expression.arguments[1].end))
      const keys = Object.keys(value).sort().join(',')
      if (keys === 'nav,params,searchParamsFromBrowser') {
        requireLinear(!nav && value.nav?.pathname === '/careers' && Array.isArray(value.nav.searchParams)
          && value.nav.searchParams.length === 0 && Object.keys(value.params).length === 0
          && value.searchParamsFromBrowser === true, 'careers runtime route binding changed')
        nav = true
      } else if (keys === 'compatibilityId') {
        requireLinear(!compatibility && uuid.test(value.compatibilityId), 'careers runtime compatibility binding changed')
        compatibility = true
      } else requireLinear((keys === 'initialCacheKind'
        || keys === 'dynamicStaleTimeSeconds,initialCacheKind' && value.dynamicStaleTimeSeconds === 0)
        && ['dynamic', 'static'].includes(value.initialCacheKind), 'careers runtime metadata changed')
    }
  }
  requireLinear(done && nav && compatibility && chunks.length > 0, 'careers runtime handoff missing or incomplete')
  return { doc, payload: Buffer.from(chunks.join(''), 'utf8') }
}

// Flight text records have byte lengths and can contain newlines. Remote code
// is parsed as a reviewed assignment envelope, never evaluated.
const flightRecords = payload => {
  const records = new Map()
  let cursor = 0
  while (cursor < payload.length) {
    const colon = payload.indexOf(58, cursor)
    if (colon === cursor && payload.subarray(cursor, cursor + 3).toString() === ':HL') {
      const end = payload.indexOf(10, cursor)
      requireLinear(end > cursor && Array.isArray(JSON.parse(payload.subarray(cursor + 3, end).toString('utf8'))), 'careers resource hint framing changed')
      cursor = end + 1
      continue
    }
    requireLinear(colon > cursor && colon - cursor <= 12, 'careers model record framing changed')
    const id = payload.subarray(cursor, colon).toString()
    requireLinear(/^[a-f\d]+$/i.test(id) && !records.has(id), 'careers duplicate or invalid model identity')
    cursor = colon + 1
    if (payload[cursor] === 84) {
      const comma = payload.indexOf(44, cursor), hex = payload.subarray(cursor + 1, comma).toString()
      requireLinear(comma > cursor && /^[a-f\d]+$/i.test(hex), 'careers text framing changed')
      const size = parseInt(hex, 16)
      requireLinear(size <= MAX_HTML_BYTES && comma + 1 + size <= payload.length, 'careers truncated text record')
      records.set(id, { kind: 'text', value: payload.subarray(comma + 1, comma + 1 + size).toString('utf8') })
      cursor = comma + 1 + size
    } else {
      const end = payload.indexOf(10, cursor)
      requireLinear(end >= cursor, 'careers incomplete model record')
      const raw = payload.subarray(cursor, end).toString('utf8')
      if (raw.startsWith('I')) records.set(id, { kind: 'import', value: JSON.parse(raw.slice(1)) })
      else records.set(id, { kind: 'model', value: JSON.parse(raw) })
      cursor = end + 1
    }
    if (payload[cursor] === 10) cursor++
    requireLinear(records.size <= 4096, 'careers model record bound exceeded')
  }
  return records
}
const nativeUrl = (value, id, application = false) => ['Linear', 'linear'].some(board =>
  value === `https://jobs.ashbyhq.com/${board}/${id}${application ? '/application' : ''}`)

export const extractRoleSummaries = html => {
  const { doc, payload } = executableRuntime(html)
  const records = flightRecords(payload), root = records.get('0')?.value
  requireLinear(root?.__route === 'route:/careers' && /^\$L[a-f\d]+$/i.test(root['page:/careers']), 'careers route model is not bound')
  let metadataDocument = doc
  if (doc.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical').length === 0) {
    // The current renderer streams its nonvisual head metadata into a hidden
    // SSR container and binds that same fragment to this route's Flight root.
    // Read only that exact metadata slot; hidden vacancy content stays inert.
    const reference = root['__vinext_streaming_metadata_body:route:/careers']?.match(/^\$L([a-f\d]+)$/i)?.[1]
    const body = reference && records.get(reference)
    requireLinear(body?.kind === 'model' && Array.isArray(body.value) && body.value.length === 2, 'streamed careers metadata route binding missing')
    const entry = body.value[0], props = entry?.[3]
    requireLinear(Array.isArray(entry) && entry.length === 4 && entry[0] === '$' && entry[1] === 'div' && entry[2] === null
      && props && Object.keys(props).sort().join(',') === 'dangerouslySetInnerHTML,hidden,suppressHydrationWarning'
      && props.hidden === true && props.suppressHydrationWarning === true
      && Object.keys(props.dangerouslySetInnerHTML || {}).join(',') === '__html', 'streamed careers metadata model changed')
    const textReference = props.dangerouslySetInnerHTML.__html?.match(/^\$([a-f\d]+)$/i)?.[1]
    const fragment = textReference && records.get(textReference)
    requireLinear(fragment?.kind === 'text' && html.includes(fragment.value), 'bound careers metadata does not match original SSR fragment')
    metadataDocument = readVisibleNativeDocument(fragment.value, { strict: true })
  }
  const canonical = one(metadataDocument.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical'), 'careers canonical URL')
  requireLinear(canonical.attrs.href === CAREERS_PAGE_URL
    && metadataDocument.nodes(node => node.tag === 'title').some(node => /Linear/.test(node.raw || ''))
    && doc.nodes(node => /^h[1-3]$/.test(node.tag)).some(node => doc.text(node) === 'Open roles'), 'careers identity changed')
  const pages = [], visited = new Set()
  const visit = (value, depth = 0) => {
    requireLinear(depth <= 80, 'careers bound model exceeds depth limit')
    if (typeof value === 'string') {
      const id = value.match(/^\$(?:L)?([a-f\d]+)$/i)?.[1]
      if (!id || visited.has(id)) return
      visited.add(id)
      const record = records.get(id)
      requireLinear(record, 'careers bound model reference missing')
      if (record.kind === 'model') visit(record.value, depth + 1)
      return
    }
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value) && value[0] === '$' && value[3]?.page?.jobs) {
      const id = value[1]?.match(/^\$L([a-f\d]+)$/i)?.[1]
      requireLinear(id && records.get(id)?.kind === 'import', 'careers jobs component is not bound')
      pages.push(value[3].page)
      return
    }
    for (const child of Object.values(value)) visit(child, depth + 1)
  }
  visit(root['page:/careers'])
  const page = one(pages, 'bound careers jobs component'), roles = [], ids = new Set(), groups = []
  requireLinear(page.jobs && !Array.isArray(page.jobs), 'careers job groups missing')
  for (const [team, titles] of Object.entries(page.jobs)) {
    requireLinear(norm(team) && titles && typeof titles === 'object' && !Array.isArray(titles), 'careers team grouping changed')
    for (const [title, rows] of Object.entries(titles)) {
      requireLinear(norm(title) && Array.isArray(rows) && rows.length > 0, 'careers title grouping changed')
      for (const row of rows) {
        requireLinear(row && uuid.test(row.id) && !ids.has(row.id) && row.isListed === true && row.team === team
          && norm(row.title) === norm(title) && norm(row.location) && nativeUrl(row.jobUrl, row.id)
          && nativeUrl(row.applyUrl, row.id, true), 'careers native role identity changed')
        ids.add(row.id)
        roles.push({ id: row.id, title: norm(row.title), location: row.location,
          url: 'https://linear.app/careers/' + row.id, jobUrl: row.jobUrl, applyUrl: row.applyUrl, team })
      }
      groups.push(rows)
    }
  }
  requireLinear(roles.length > 0 && roles.length <= 200, 'careers native handoff is empty or oversized')
  const anchors = doc.nodes(node => node.tag === 'a' && /^\/?(?:https:\/\/linear\.app\/)?careers\//.test(node.attrs.href || ''))
  requireLinear(anchors.length === groups.length && groups.every(rows => anchors.some(anchor =>
    new URL(anchor.attrs.href, CAREERS_PAGE_URL).href === 'https://linear.app/careers/' + rows[0].id
    && doc.text(anchor).includes(norm(rows[0].title)) && rows.every(row => doc.text(anchor).includes(norm(row.location))))),
  'careers visible role groups do not reconcile with bound data')
  return roles
}
export const hasVerifiedCareersPageSignal = html => { try { extractRoleSummaries(html); return true } catch { return false } }

const locationScope = value => {
  requireLinear(value && typeof value === 'object' && !Array.isArray(value) && typeof value.location === 'string'
    && norm(value.location) && Object.keys(value).every(key => ['location', 'address'].includes(key)), 'native geography record malformed')
  requireLinear(!Object.hasOwn(value.address || {}, 'postalAddress')
    || Object.keys(value.address).every(key => ['postalAddress', '@type'].includes(key)), 'native geography wrapper has unreviewed fields')
  const address = value.address?.postalAddress || value.address || {}
  requireLinear(address && typeof address === 'object' && !Array.isArray(address)
    && Object.keys(address).every(key => ['@type', 'addressCountry', 'addressLocality', 'addressRegion', 'streetAddress', 'postalCode'].includes(key))
    && ['addressCountry', 'addressLocality', 'addressRegion'].every(key => address[key] == null || typeof address[key] === 'string'), 'native geography address malformed')
  const raw = address.addressCountry || null, country = nativeCountryName(raw)
  const region = raw === 'European Union' ? 'European Union' : null
  const labelCountry = nativeLocationCountryName(value.location), indiaLabel = /\bindia\b/i.test(value.location)
  const contradiction = (country && labelCountry && country !== labelCountry)
    || ((country && country !== 'India' || region) && indiaLabel)
  const broad = /\b(?:worldwide|global|anywhere|APAC|EMEA|all locations|Asia[- ]Pacific)\b/i.test(value.location)
  const resolved = !contradiction && !broad && Boolean(country || region || indiaLabel)
    && (!raw || Boolean(country || region))
  return { nativeLocation: value.location, nativeAddress: address, nativeCountryRaw: raw, country, region,
    resolved, india: !contradiction && (country === 'India' || indiaLabel) }
}
const dateValue = raw => {
  if (raw == null || raw === '') return null
  requireLinear(typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(raw)
    && Number.isFinite(Date.parse(raw)) && new Date(raw.slice(0, 10)).toISOString().slice(0, 10) === raw.slice(0, 10), 'native source date malformed')
  return raw
}
const dateIsExact = value => value != null && value.includes('T')
const datesAgree = (left, right) => !dateIsExact(left) || !dateIsExact(right)
  ? new Date(left).toISOString().slice(0, 10) === new Date(right).toISOString().slice(0, 10)
  : Date.parse(left) === Date.parse(right)
const descriptionKey = value => extractActiveDescription(value)?.replace(/\s/g, '') || null

const reconcilePostingAddress = (posting, scopes, locations) => {
  if (posting.locationAddress == null) return null
  const raw = posting.locationAddress
  requireLinear(raw && typeof raw === 'object' && !Array.isArray(raw), 'native posting address malformed')
  requireLinear(!Object.hasOwn(raw, 'postalAddress') || Object.keys(raw).every(key => ['postalAddress', '@type'].includes(key)),
    'native posting address has ambiguous wrapper geography')
  const address = raw.postalAddress ?? raw
  const fields = ['addressCountry', 'addressLocality', 'addressRegion', 'streetAddress', 'postalCode']
  requireLinear(address && typeof address === 'object' && !Array.isArray(address)
    && Object.keys(address).every(key => key === '@type' || fields.includes(key))
    && fields.every(key => address[key] == null || typeof address[key] === 'string'), 'native posting address malformed')
  const detail = locationScope({ location: posting.locationName, address: raw })
  const primary = scopes[0]
  requireLinear(detail.resolved && Boolean(detail.country || detail.region)
    && (!primary.country || primary.country === detail.country)
    && (!primary.region || primary.region === detail.region)
    && (!primary.india || detail.india), 'native posting address geography contradicts primary feed worksite')
  const agrees = (left, right) => fields.filter(key => key !== 'addressCountry').every(key =>
    !norm(left[key]) || !norm(right[key]) || norm(left[key]).normalize('NFKC') === norm(right[key]).normalize('NFKC'))
  requireLinear(agrees(address, primary.nativeAddress), 'native posting address contradicts primary feed address')
  requireLinear(locations.some(location => {
    const published = location?.address?.postalAddress || location?.address
    return published && (detail.country ? nativeCountryName(published.addressCountry) === detail.country
      : published.addressCountry === detail.region) && agrees(address, published)
  }), 'native posting address contradicts schema worksite geography')
  return raw
}

const validateNativeRole = (html, row, scopes) => {
  const doc = readVisibleNativeDocument(html, { strict: true })
  const schema = JSON.parse(one(doc.nodes(node => node.tag === 'script' && node.attrs.type === 'application/ld+json'), 'native role schema').raw)
  const script = one(doc.nodes(executable).filter(node => (node.raw || '').includes('window.__appData')), 'native role application data')
  const program = parseBoundedProgram(script.raw), statement = program.body[0]
  // The retained native page assigns __appData, declares ENTRY_KEY, then loads
  // its Vite manifest. Match that loader AST without running it; only the CDN
  // build directory is variable. Extra writes cannot supersede the role data.
  const loaderShape = JSON.stringify(program.body.slice(1), (key, value) => ['start', 'end', 'raw'].includes(key) ? undefined
    : typeof value === 'string' ? value.replace(/https:\/\/cdn\.ashbyprd\.com\/frontend_non_user\/[a-f\d]{40}\//g,
      'https://cdn.ashbyprd.com/frontend_non_user/VERSION/') : value)
  requireLinear(crypto.createHash('sha256').update(loaderShape).digest('hex') === '6f7ca54cedf0a984b239a67833e86dcb604e09312d58a76449f2e034f9054404',
    'native role application loader changed')
  const expression = statement.type === 'ExpressionStatement' && statement.expression
  requireLinear(expression?.type === 'AssignmentExpression' && expression.operator === '='
    && expression.left.type === 'MemberExpression' && !expression.left.computed && !expression.left.optional
    && expression.left.object.name === 'window' && expression.left.property.name === '__appData', 'native role application binding changed')
  const app = parseRemoteLiteral(script.raw.slice(expression.right.start, expression.right.end)), org = app.organization, posting = app.posting
  requireLinear(org?.organizationId === '3287cc87-df80-4a67-ab05-1a50f6dec2bc' && org.name === 'Linear'
    && org.publicWebsite === 'https://linear.app/' && org.customJobsPageUrl === CAREERS_PAGE_URL
    && org.hostedJobsPageSlug?.toLowerCase() === 'linear' && org.isDemoOrg === false
    && posting?.id === row.id && norm(posting.title) === norm(row.title) && posting.isListed === true && posting.isConfidential === false,
  'native role employer or application identity changed')
  requireLinear(schema['@type'] === 'JobPosting' && norm(schema.title) === norm(row.title)
    && schema.identifier?.value === row.id && schema.identifier.name === 'Linear'
    && schema.hiringOrganization?.name === 'Linear' && schema.hiringOrganization.sameAs === 'https://linear.app/'
    && norm(posting.locationName) === norm(row.location)
    && Array.isArray(posting.secondaryLocationNames)
    && JSON.stringify(posting.secondaryLocationNames.map(norm).sort()) === JSON.stringify(row.secondaryLocations.map(value => norm(value.location)).sort()),
  'native role schema identity/geography changed')
  const content = descriptionKey(row.descriptionHtml)
  requireLinear(content && content.length >= 100 && content === descriptionKey(posting.descriptionHtml)
    && content === descriptionKey(schema.description), 'native role full description mismatch')
  const locations = Array.isArray(schema.jobLocation) ? schema.jobLocation : [schema.jobLocation]
  const countries = locations.map(location => location?.address?.addressCountry)
  requireLinear(scopes.filter(scope => scope.india).every(() => countries.some(value => nativeCountryName(value) === 'India')), 'native role India geography not corroborated')
  const nativePostingAddress = reconcilePostingAddress(posting, scopes, locations)
  const applicants = Array.isArray(schema.applicantLocationRequirements) ? schema.applicantLocationRequirements : [schema.applicantLocationRequirements]
  if (schema.jobLocationType === 'TELECOMMUTE') requireLinear(applicants.some(item => nativeCountryName(item?.name) === 'India'), 'native role remote India applicant scope unverified')
  const published = dateValue(row.publishedAt), datePosted = dateValue(schema.datePosted)
  requireLinear(!published || !datePosted || published.slice(0, 10) === datePosted.slice(0, 10), 'native role publication date contradiction')
  requireLinear(Object.hasOwn(posting, 'applicationDeadline'), 'native role application deadline contract missing')
  requireLinear((posting.applicationDeadline == null || norm(posting.applicationDeadline))
    && (schema.validThrough == null || norm(schema.validThrough)), 'native role deadline/expiry is empty or unqualified')
  const deadline = dateValue(posting.applicationDeadline), validThrough = dateValue(schema.validThrough)
  requireLinear(!deadline || !validThrough || datesAgree(deadline, validThrough), 'native role deadline/schema expiry contradiction')
  // Preserve the publisher's raw value, choosing its precise timestamp when a
  // matching companion field only identifies the calendar day.
  const closingDate = dateIsExact(deadline) ? deadline : dateIsExact(validThrough) ? validThrough : deadline || validThrough
  const sourceClosingDateIsExact = closingDate == null ? null : dateIsExact(closingDate)
  const postingDate = published || datePosted
  // A native day-only expiry has no publisher-supplied midnight timestamp.
  requireLinear(!closingDate || !postingDate || (closingDate.length === 10
    ? closingDate >= postingDate.slice(0, 10) : Date.parse(closingDate) >= Date.parse(postingDate)), 'native role expiry precedes publication')
  return { organization: { organizationId: org.organizationId, name: org.name, publicWebsite: org.publicWebsite },
    schema, postingDate, closingDate, sourceClosingDateIsExact,
    nativeApplicationDeadline: posting.applicationDeadline, nativeValidThrough: schema.validThrough ?? null,
    nativePostingAddress,
    sourceDescription: row.descriptionHtml }
}

const validURL = url => {
  const value = new URL(url)
  requireLinear(url === CAREERS_PAGE_URL || url === NATIVE_API_URL
    || value.origin === 'https://jobs.ashbyhq.com' && /^\/(?:Linear|linear)\/[a-f\d-]{36}$/.test(value.pathname)
      && !value.search && !value.hash && !value.username && !value.password, 'response URL outside reviewed source identity')
}

export const createLinearScraper = () => {
  const collect = async ({ signal, transport, fetchImpl } = {}) => {
    signal?.throwIfAborted()
    const readResponse = transport || createHTMLTransport({ validateURL: validURL,
      expectedContentType: url => url === NATIVE_API_URL ? 'application/json' : 'text/html' }, { signal, fetchImpl })
    const responses = [], failures = [], exclusions = [], geography = [], jobs = []
    let aggregate = 0
    const read = async url => {
      signal?.throwIfAborted(); validURL(url)
      requireLinear(responses.length < 64, 'response request budget exceeded')
      const boundary=signal?AbortSignal.any([signal,AbortSignal.timeout(HTML_REQUEST_TIMEOUT_MS)]):AbortSignal.timeout(HTML_REQUEST_TIMEOUT_MS)
      const response = await new Promise((resolve,reject)=>{const abort=()=>{boundary.removeEventListener('abort',abort);reject(signal?.aborted?signal.reason:boundary.reason)};if(boundary.aborted){abort();return}boundary.addEventListener('abort',abort,{once:true});Promise.resolve().then(()=>readResponse(url,{signal:boundary})).then(value=>{boundary.removeEventListener('abort',abort);boundary.aborted?abort():resolve(value)},error=>{boundary.removeEventListener('abort',abort);boundary.aborted?abort():reject(error)})})
      signal?.throwIfAborted()
      requireLinear(response?.url === url && response.bodyComplete === true && response.body instanceof Uint8Array,
        'response identity or complete bytes unavailable')
      const body = Buffer.from(response.body); aggregate += body.length
      requireLinear(body.length <= MAX_HTML_BYTES && aggregate <= 8 * MAX_HTML_BYTES, 'response byte bound exceeded')
      const expected = url === NATIVE_API_URL ? 'application/json' : 'text/html'
      const contentType = response.headers?.['content-type']?.split(';')[0].trim().toLowerCase()
      responses.push({ url, status: response.status, bytes: body.length, sha256: crypto.createHash('sha256').update(body).digest('hex'),
        requestedAt: response.requestedAt || null, completedAt: response.completedAt || null })
      requireLinear(response.status === 200 && contentType === expected, 'HTTP response unavailable or changed content type: ' + response.status)
      return new TextDecoder('utf-8', { fatal: true }).decode(body)
    }
    const html = await read(CAREERS_PAGE_URL), roles = extractRoleSummaries(html)
    const payload = JSON.parse(await read(NATIVE_API_URL))
    requireLinear(payload?.apiVersion === '1' && Array.isArray(payload.jobs) && payload.jobs.length <= 200
      && Object.keys(payload).every(key => ['jobs', 'apiVersion'].includes(key))
      && !payload.error && !payload.errors && payload.success !== false && payload.hasMore !== true
      && (payload.total == null || payload.total === payload.jobs.length), 'native role inventory envelope changed')
    const native = payload.jobs.filter(row => row?.isListed === true)
    requireLinear(payload.jobs.every(row => row && typeof row.isListed === 'boolean' && uuid.test(row.id))
      && new Set(payload.jobs.map(row => row.id)).size === payload.jobs.length, 'native role inventory identity/status changed')
    requireLinear(native.length === roles.length, 'native role identities do not reconcile with current careers page')
    const byId = new Map(roles.map(row => [row.id, row]))
    const corporateNativeLocationMismatches=native.filter(row=>norm(byId.get(row.id)?.location)!==norm(row.location)).map(row=>({jobId:row.id,corporateLocation:byId.get(row.id)?.location??null,nativeLocation:row.location}))
    let unknownGeography = false, selectedFailures = false, rowFailures = false
    for (const row of native) {
      const official = byId.get(row.id)
      requireLinear(official && norm(official.title) === norm(row.title) && nativeUrl(row.jobUrl, row.id)
        && nativeUrl(row.applyUrl, row.id, true) && Array.isArray(row.secondaryLocations), 'native role/application identity changed')
      let scopes
      try {
        requireLinear(Object.keys(row).every(key => ['id', 'title', 'department', 'team', 'employmentType', 'location',
          'secondaryLocations', 'publishedAt', 'isListed', 'isRemote', 'workplaceType', 'address', 'jobUrl', 'applyUrl',
          'descriptionHtml', 'descriptionPlain'].includes(key)), 'native row has unreviewed public fields')
        scopes = [{ location: row.location, address: row.address }, ...row.secondaryLocations].map(locationScope)
        geography.push({ jobId: row.id, scopes })
        if (scopes.some(scope => !scope.resolved)) unknownGeography = true
        dateValue(row.publishedAt)
        const content = descriptionKey(row.descriptionHtml)
        requireLinear(content && content.length >= 100, 'native role full description unavailable')
      } catch (error) {
        signal?.throwIfAborted()
        rowFailures = true
        failures.push({ jobId: row.id, stage: 'native-row', reason: error.message })
        continue
      }
      if (!scopes.some(scope => scope.india)) {
        exclusions.push({ jobId: row.id, reason: scopes.every(scope => scope.resolved)
          ? 'native-scopes-outside-india' : 'native-india-country-unverified', nativeGeography: scopes })
        continue
      }
      try {
        const fact = validateNativeRole(await read(row.jobUrl), row, scopes)
        const location = scopes.find(scope => scope.india)
        jobs.push({ source: SOURCE, company: COMPANY, jobId: row.id, requisitionId: row.id, title: norm(row.title),
          location: location.nativeLocation, city: location.nativeAddress.addressLocality || null,
          state: location.nativeAddress.addressRegion || null, country: 'India', department: row.department || null,
          employmentType: row.employmentType || null, workplaceType: row.workplaceType || null,
          sourceUrl: row.jobUrl, companyCareerPage: CAREERS_PAGE_URL, companyDomain: 'linear.app', atsPlatform: 'ashby',
          applyUrl: row.applyUrl, link: row.applyUrl, postingDate: fact.postingDate,
          closingDate: fact.closingDate, sourceClosingDateIsExact: fact.sourceClosingDateIsExact,
          nativeApplicationDeadline: fact.nativeApplicationDeadline, nativeValidThrough: fact.nativeValidThrough,
          nativePostingAddress: fact.nativePostingAddress,
          jobDescription: fact.sourceDescription, sourceDescription: fact.sourceDescription,
          nativeSourceRecord: row, nativeHiringOrganization: fact.organization, nativeJobPosting: fact.schema,
          nativeGeography: scopes, sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false })
      } catch (error) {
        signal?.throwIfAborted()
        selectedFailures = true
        failures.push({ jobId: row.id, stage: 'native-detail', reason: error.message })
      }
    }
    let closingInventoryStable = false, closingPayload = null, closingRoles = null
    try {
      closingRoles = extractRoleSummaries(await read(CAREERS_PAGE_URL))
      closingPayload = JSON.parse(await read(NATIVE_API_URL))
      closingInventoryStable = dataSignature(payload) === dataSignature(closingPayload)
        && dataSignature(roles) === dataSignature(closingRoles)
      if (!closingInventoryStable) failures.push({ stage: 'closing-inventory', reason: 'native or corporate inventory, country, dates or full criteria changed' })
    } catch (error) {
      signal?.throwIfAborted()
      failures.push({ stage: 'closing-inventory', reason: error.message })
    }
    if (Array.isArray(closingPayload?.jobs)) {
      const current = new Map(closingPayload.jobs.map(row => [row.id, row]))
      for (let index = jobs.length - 1; index >= 0; index--) {
        const job = jobs[index]
        if (dataSignature(current.get(job.jobId)) !== dataSignature(job.nativeSourceRecord)) {
          failures.push({ jobId: job.jobId, stage: 'closing-native-role', reason: 'own native role changed or disappeared' })
          jobs.splice(index, 1)
        }
      }
    }
    const timestamps = responses.map(response => response.completedAt)
    const verifiedAt = timestamps.every(value => typeof value === 'string' && Number.isFinite(Date.parse(value)))
      ? timestamps.sort()[0] : null
    const indiaFacetCount = unknownGeography || selectedFailures || rowFailures || !closingInventoryStable || corporateNativeLocationMismatches.length ? null : jobs.length
    const configuredBoardComplete=indiaFacetCount!==null&&failures.length===0&&verifiedAt!==null
    for(const job of jobs)Object.assign(job,{sourceListingComplete:configuredBoardComplete,sourceDeclaredBoardScopeComplete:configuredBoardComplete,sourceCompanyWideScopeComplete:false})
    const evidence = { status: configuredBoardComplete?'complete-inventory':'discovery-only', surface: NATIVE_API_URL, firstParty: true,
      listingComplete: configuredBoardComplete, pagesFetched: responses.length, reportedTotal: configuredBoardComplete?native.length:null, indiaFacetCount, verifiedAt,
      reason: `linear-bound-current-public-board:official-roles=${roles.length};native-roles=${native.length};checked-board-india=${indiaFacetCount ?? 'unknown'};configured-board=${configuredBoardComplete?'complete':'partial'};company-scope-and-cleanup-unverified`
        + (unknownGeography ? ';native-geography-unresolved' : '') + (selectedFailures ? ';native-detail-unverified' : '')
        + (rowFailures ? ';native-row-unverified' : '') + (!closingInventoryStable ? ';closing-inventory-unverified' : '')
        + (corporateNativeLocationMismatches.length?';corporate-native-location-disagreement':'') }
    attachSourceObservationEvidence(jobs, { source: SOURCE, recordKind: 'vacancy-rows', observedRecordCount: native.length, observedVacancyCount: native.length, sourceScopeComplete: false })
    attachInventoryEvidence(jobs, evidence)
    return { jobs, officialRoles: roles, nativeRoles: native, originalNativePayload:structuredClone(payload),corporateNativeLocationMismatches,geography, failures, exclusions, responses, inventoryEvidence: evidence,
      observedPublicRoleCount: native.length, checkedBoardIndiaCount: indiaFacetCount, closingInventoryStable, closingPayload, closingRoles,
      configuredBoardComplete,sourceDeclaredBoardScopeComplete:configuredBoardComplete,sourceCompanyWideScopeComplete:false,
      companyGlobalTotal:null,companyIndiaTotal:null,sourceScopeComplete: false, lifecycleCleanupAllowed: false }
  }
  return { collect, async run(options = {}) { return (await collect(options)).jobs } }
}
export const run = async options => createLinearScraper().run(options)
