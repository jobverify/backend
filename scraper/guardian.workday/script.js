import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodeHTML } from 'entities'
import { parse } from 'acorn'
import { runWorkdayScraper, buildWorkdayDetailApiUrl } from '../../scraper-support/myworkday/engine.js'
import { WORKDAY_COUNTRY_INVENTORY_PROOF, currentWorkdayBoardReceipt, hashWorkdayProof,
  workdayInventoryIdentity, explicitWorkdayCountryScope } from '../../scraper-support/myworkday/countryInventoryProof.js'
import { createHTMLTransport, MAX_HTML_BYTES } from '../../scraper-support/shared/firstPartyHtmlJobs.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const SOURCE = 'guardian'
const CORPORATE = 'https://www.guardianlife.com/careers/corporate'
const ORIGIN = 'https://guardianlife.wd5.myworkdayjobs.com'
const BOARD = ORIGIN + '/Guardian-Life-Careers'
const API = ORIGIN + '/wday/cxs/guardianlife/Guardian-Life-Careers/jobs'
const EMPLOYER = 'The Guardian Life Insurance Company of America'
const scraperDir = path.dirname(fileURLToPath(import.meta.url))
const SOURCE_BUDGET_MS = 180000
const MAX_EXTRA_REQUESTS = 64
const MAX_EXTRA_BYTES = 16 * 1024 * 1024
const MAX_UNRESOLVED = 16
const MAX_CAREERS_PAGES = 16
const MAX_CORPORATE_CONTROLS = 128
const CONTROL_DESTINATION_ATTRIBUTES = ['href', 'formaction', 'data-href', 'data-url', 'data-link', 'data-target']
const MAX_PAGES = 20
const text = value => typeof value === 'string' ? decodeHTML(value).replace(/\s+/g, ' ').trim() : ''
const requireProof = (condition, message) => { if (!condition) throw Error(message) }
const us = value => /^(?:US|USA|United States(?: of America)?)$/i.test(text(value))
const plain = value => {
  const document = readNativeDocument(String(value || ''))
  return text(document.text(document.nodes(node => node.tag === 'root')[0]))
}
// Native HTML inserts spaces at inline tag/punctuation boundaries. Preserve
// word boundaries while normalizing those formatting differences.
const contentIdentity = value => text(value).replace(/\u200b/g, '').replace(/\s+/g, ' ')
  .replace(/\s+([,.;:!?)\]])/g, '$1').replace(/([(\[])\s+/g, '$1').trim()
const currentNativeClient = script => {
  const assignments = []
  const isWorkday = node => node?.type === 'MemberExpression' && !node.computed
    && node.object?.type === 'Identifier' && node.object.name === 'window' && node.property?.name === 'workday'
  const visit = node => {
    if (!node || typeof node !== 'object') return
    if (node.type === 'AssignmentExpression' && isWorkday(node.left)) assignments.push(node)
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit)
      else if (value && typeof value === 'object') visit(value)
    }
  }
  visit(parse(script, { ecmaVersion: 'latest' }))
  requireProof(assignments.length === 1, 'Guardian native client has ambiguous account assignment')
  const assignment = assignments[0], right = assignment.right
  requireProof(assignment.operator === '=' && right.type === 'LogicalExpression' && right.operator === '||'
    && isWorkday(right.left) && right.right.type === 'ObjectExpression', 'Guardian native client assignment changed')
  const properties = new Map()
  for (const property of right.right.properties) {
    requireProof(property.type === 'Property' && property.kind === 'init' && !property.computed && !property.method,
      'Guardian native client object has dynamic properties')
    const key = property.key.type === 'Identifier' ? property.key.name : property.key.value
    requireProof(typeof key === 'string' && !properties.has(key), 'Guardian native client has duplicate properties')
    properties.set(key, property.value)
  }
  for (const [key, expected] of Object.entries({ tenant: 'guardianlife', siteId: 'Guardian-Life-Careers', environment: 'PROD', postingAvailable: true })) {
    const field = properties.get(key)
    requireProof(field?.type === 'Literal' && field.value === expected, 'Guardian native client account or available posting state changed')
  }
}
const roleKey = value => {
  const url = new URL(value)
  requireProof(url.origin === ORIGIN && !url.username && !url.password && !url.search && !url.hash,
    'Guardian role changes native origin or query scope')
  const pathname = url.pathname.replace(/^\/en-US\//, '/')
  requireProof(/^\/Guardian-Life-Careers\/job\/[^?#]+$/.test(pathname), 'Guardian role changes board identity')
  return url.origin + pathname
}
const countryIsUs = country => {
  const fields = typeof country === 'string' ? [country] : [country?.descriptor, country?.alpha2Code].filter(value => value != null)
  return fields.length > 0 && fields.every(us)
    && (country?.id == null || country.id === 'bc33aa3152ec42d4995f4791a106ed09' || us(country.id))
}
const corporateLabel = (document, node) => {
  // Reference naming is outside this finite grammar. The shared projection
  // normalizes some entities, so attribute presence itself stays unresolved;
  // decoded whitespace must never turn a reference into absence evidence.
  requireProof(!Object.hasOwn(node.attrs, 'aria-labelledby'), 'Guardian corporate referenced accessible name is unresolved by the bounded scope grammar')
  const imageLabels = child => typeof child === 'string' || child.inert || ['script', 'style', 'head', 'template'].includes(child.tag) ? ''
    : [child.tag === 'img' || child.tag === 'input' && (child.attrs.type || '').toLowerCase() === 'image' ? child.attrs.alt || '' : '',
      ...child.children.map(imageLabels)].join(' ')
  return text([document.text(node), node.attrs['aria-label'], node.attrs.title, node.attrs.value, imageLabels(node)].filter(Boolean).join(' '))
}
const activeAnchors = html => {
  const document = readVisibleNativeDocument(html, { strict: true }), anchors = [], forms = [], controls = [], embeds = []
  const visit = (node, form = null) => {
    if (typeof node === 'string' || ['script', 'style', 'head', 'svg', 'template'].includes(node.tag)
      || ['inert', 'hidden'].some(key => Object.hasOwn(node.attrs, key))
      || ['button', 'input', 'fieldset', 'select', 'textarea', 'option', 'optgroup'].includes(node.tag) && Object.hasOwn(node.attrs, 'disabled')
      || ['aria-hidden', 'aria-disabled'].some(key => Object.hasOwn(node.attrs, key) && node.attrs[key].toLowerCase() !== 'false')) return
    // The shared reader excludes object fallback semantics. An object itself
    // can load a child document, so keep that destination before discarding
    // its fallback. Unsupported visibility remains unresolved, never absent.
    if (node.tag === 'object') {
      if (!/(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse))\s*(?:!important\s*)?(?:;|$)/i.test(node.attrs.style || '')) embeds.push(node)
      return
    }
    if (node.inert) return
    if (node.tag === 'a' && node.attrs.href && corporateLabel(document, node)) anchors.push({ href: node.attrs.href, text: corporateLabel(document, node) })
    if (node.tag === 'form') { form = node; forms.push(node) }
    if (node.tag === 'embed') embeds.push(node)
    if (['button', 'input'].includes(node.tag) || ['button', 'link'].includes(node.attrs.role)
      || node.tag === 'a' && Object.keys(node.attrs).some(key => /^on/i.test(key) || CONTROL_DESTINATION_ATTRIBUTES.includes(key) && key !== 'href')) controls.push({ node, form })
    for (const child of node.children) visit(child, form)
  }
  for (const root of document.nodes(node => node.tag === 'root')) visit(root)
  requireProof(forms.length + controls.length + embeds.length <= MAX_CORPORATE_CONTROLS, 'Guardian corporate controls exceed the bounded scope grammar')
  return { document, anchors, forms, controls, embeds }
}
const ats = hostname => /(?:myworkdayjobs|myworkdaysite|greenhouse|lever\.co|ashbyhq|icims|smartrecruiters|oraclecloud|successfactors|taleo|dayforce|ultipro|jobvite|peoplehr|bamboohr|workable|applytojob|eightfold|phenom|brassring|recruiting\.adp|zoho)/i.test(hostname)
const recruitingIntent = value => /\b(?:apply|jobs?|careers?|vacanc(?:y|ies)|openings?|positions?|roles?|recruit(?:ing|ment)?|employment|opportunit(?:y|ies))\b/i.test(value)
const recruitingURL = url => ats(url.hostname)
  || /(?:^|[.-])(?:careers?|jobs?|recruit(?:ing|ment)?|hiring)(?:[.-]|$)/i.test(url.hostname)
  || /(?:^|\/)(?:jobs?|careers?|vacancies|openings|positions|roles|recruit(?:ing|ment)?|apply)(?:[\/_.-]|$)/i.test(url.pathname)
const accountedNativeTarget = (target, physicalProof) => {
  if (target.origin !== ORIGIN || target.protocol !== 'https:' || target.username || target.password || target.hash) return false
  const boardPath = target.pathname.replace(/^\/en-US\//, '/')
  return boardPath === '/Guardian-Life-Careers' && [...target.searchParams.keys()].every(key => key === 'q')
    || physicalProof.listingRoles.some(role => { try { return roleKey(role.url) === roleKey(target.href) } catch { return false } })
}
const validURL = value => {
  const url = new URL(value)
  requireProof(url.protocol === 'https:' && !url.username && !url.password && !url.hash && !url.search,
    'Guardian supplemental read URL is not a scoped public URL')
  requireProof(url.origin === 'https://www.guardianlife.com' && /^\/careers(?:\/|$)/.test(url.pathname)
    || url.origin === ORIGIN && (url.href === API || /^\/wday\/cxs\/guardianlife\/Guardian-Life-Careers\/job\//.test(url.pathname)
      || /^\/(?:en-US\/)?Guardian-Life-Careers\/job\//.test(url.pathname)), 'Guardian supplemental read changes source identity')
}

function createReader(options, signal, report) {
  let requests = 0, aggregateBytes = 0
  return async (url, query = null) => {
    signal.throwIfAborted()
    validURL(url)
    requireProof(++requests <= MAX_EXTRA_REQUESTS, 'Guardian supplemental request budget exhausted')
    const expectedContentType = query || url.includes('/wday/cxs/') ? 'application/json' : 'text/html'
    const fetchImpl = options.fetchImpl || globalThis.fetch
    // Reuse the shared bounded stream reader. Only this exact read-only CXS
    // search URL is translated to POST; there is no global fetch replacement.
    const transport = options.guardianTransport || createHTMLTransport({ validateURL: validURL,
      expectedContentType: () => expectedContentType }, { signal, timeoutMs: 20000,
      fetchImpl: (input, init) => input === API && query
        ? fetchImpl(input, { ...init, method: 'POST', headers: { ...init.headers, 'Content-Type': 'application/json' }, body: JSON.stringify(query) })
        : fetchImpl(input, init) })
    const response = await transport(url, { method: query ? 'POST' : 'GET', body: query ? JSON.stringify(query) : undefined, signal })
    signal.throwIfAborted()
    requireProof(response?.url === url && response.bodyComplete === true && response.body instanceof Uint8Array
      && Number.isInteger(response.status) && response.headers && !Array.isArray(response.headers), 'Guardian supplemental response is incomplete')
    const body = Buffer.from(response.body), headers = Object.fromEntries(Object.entries(response.headers).map(([key, value]) => [key.toLowerCase(), value]))
    aggregateBytes += body.length
    requireProof(body.length <= MAX_HTML_BYTES && aggregateBytes <= MAX_EXTRA_BYTES, 'Guardian supplemental aggregate/body budget exhausted')
    requireProof(Object.keys(headers).length === Object.keys(response.headers).length, 'Guardian response has ambiguous headers')
    const requested = Date.parse(response.requestedAt), completed = Date.parse(response.completedAt)
    requireProof(Number.isFinite(requested) && Number.isFinite(completed) && completed >= requested && completed <= Date.now() + 1000
      && requested >= Date.parse(report.physicalCountryProof?.closing?.verifiedAt),
      'Guardian response has no original valid capture clocks')
    const receipt = { url, method: query ? 'POST' : 'GET', requestBody: query ? JSON.stringify(query) : null,
      status: response.status, headers, bodyBytes: body.length, bodySHA256: hashWorkdayProof(body),
      rawBodyBase64: body.toString('base64'), bodyRepresentation: 'complete decoded HTTP response body; not compressed wire bytes',
      requestedAt: response.requestedAt, completedAt: response.completedAt, provenance: response.provenance || null }
    report.retainedResponses.push(receipt)
    report.collectionUsage = { requests, aggregateBytes }
    const html = new TextDecoder('utf-8', { fatal: true }).decode(body)
    if ([403, 429].includes(response.status) || headers['cf-mitigated'] === 'challenge'
      || /verify you are human|checking your browser|cf-chl-/i.test(html.slice(0, 4096))) {
      throw Object.assign(Error('Guardian native public access denied; no alternate client retry'), { guardianAccessDenied: true })
    }
    if (response.status === 200) requireProof(text(headers['content-type']).split(';')[0].toLowerCase() === expectedContentType,
      'Guardian supplemental response has an unexpected content type')
    return { ...response, headers, html, receipt }
  }
}

async function verifyCorporateScope(read, report, physicalProof, signal) {
  const queue = [CORPORATE], seen = new Set(), redirects = new Map(), sourcePages = [], handoffs = [], networkPages = []
  while (queue.length) {
    const url = queue.shift()
    if (seen.has(url)) continue
    requireProof(seen.size < MAX_CAREERS_PAGES, 'Guardian current careers scope exceeded its page bound')
    seen.add(url)
    const response = await read(url)
    signal.throwIfAborted()
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      requireProof(typeof response.headers.location === 'string' && !/[\\\r\n\t]/.test(response.headers.location), 'Guardian careers redirect is invalid')
      const target = new URL(response.headers.location, url).href
      validURL(target)
      redirects.set(url, target)
      const chain = new Set([url])
      for (let current = target; redirects.has(current); current = redirects.get(current)) {
        requireProof(!chain.has(current), 'Guardian careers redirect cycled')
        chain.add(current)
      }
      queue.push(target)
      sourcePages.push({ url, status: response.status, redirect: target, sha256: response.receipt.bodySHA256 })
      continue
    }
    requireProof(response.status === 200, 'Guardian advertised careers page is unavailable')
    const { document, anchors, forms, controls, embeds } = activeAnchors(response.html)
    const bodyText = text(document.text(document.nodes(node => node.tag === 'body')[0] || document.nodes(node => node.tag === 'root')[0]))
    const network = new URL(url).pathname.startsWith('/careers/financial-representative')
    if (network && !url.endsWith('/apply')) {
      requireProof(/financial professional/i.test(bodyText)
        && /The Guardian Network[®]? is a network of preferred providers authorized to offer products/i.test(bodyText),
      'Guardian separate financial-professional Network purpose changed')
    }
    requireProof(!/"@type"\s*:\s*"JobPosting"/.test(response.html), 'Guardian corporate branch now advertises individual native vacancies')
    for (const anchor of anchors) {
      const target = new URL(anchor.href, url)
      if (!['http:', 'https:'].includes(target.protocol)) {
        requireProof(!recruitingIntent(anchor.text), 'Guardian careers has an uninspectable recruiting navigation scheme')
        continue
      }
      const native = target.origin === ORIGIN
      if (native) {
        const boardPath = target.pathname.replace(/^\/en-US\//, '/')
        requireProof(target.protocol === 'https:' && !target.username && !target.password && !target.hash,
          'Guardian advertised board handoff has invalid identity')
        requireProof(boardPath === '/Guardian-Life-Careers'
          && [...target.searchParams.keys()].every(key => key === 'q')
          || physicalProof.listingRoles.some(role => { try { return roleKey(role.url) === roleKey(target.href) } catch { return false } }),
        'Guardian current careers advertises an additional native board or unenumerated role')
        handoffs.push({ from: url, url: target.href, text: anchor.text })
      } else if (ats(target.hostname) || target.origin !== 'https://www.guardianlife.com'
        && (recruitingURL(target) || recruitingIntent(anchor.text))) {
        throw Error('Guardian current careers advertises an unresolved additional recruiting surface: ' + target.href)
      }
      if (target.origin === 'https://www.guardianlife.com' && !/^\/careers(?:\/|$)/.test(target.pathname)
        && (recruitingURL(target) || recruitingIntent(anchor.text))) {
        throw Error('Guardian advertises an unresolved additional first-party job inventory: ' + target.href)
      }
      if (target.origin !== 'https://www.guardianlife.com' || !/^\/careers(?:\/|$)/.test(target.pathname)) continue
      requireProof(!target.search && !target.hash && target.protocol === 'https:', 'Guardian internal careers query scope changed')
      // These are advertised corporate information pages, plus the general
      // careers handoff. Network articles are separate financial-professional
      // recruiting content, explicitly identified by the current parent page.
      if (!network || target.pathname === '/careers/financial-representative/apply') queue.push(target.href)
    }
    // A visible child document can introduce another recruiting surface. The
    // bounded grammar recognizes only the already-enumerated native target;
    // srcdoc and unknown children stay unresolved rather than being executed.
    for (const frame of document.frames()) {
      requireProof(!Object.hasOwn(frame.attrs, 'srcdoc'), 'Guardian careers has an unaccounted srcdoc child document')
      requireProof(frame.attrs.src && accountedNativeTarget(new URL(frame.attrs.src, url), physicalProof),
        'Guardian careers has an unaccounted iframe child document')
    }
    for (const embedded of embeds) {
      const destination = embedded.attrs.src || embedded.attrs.data
      requireProof(destination && accountedNativeTarget(new URL(destination, url), physicalProof),
        'Guardian careers has an unaccounted embed or object child document')
    }
    const inspectControlTarget = (destination, label) => {
      const target = new URL(destination, url)
      if (accountedNativeTarget(target, physicalProof)) return
      requireProof(!recruitingURL(target) && !recruitingIntent(label),
        'Guardian careers has an unaccounted recruiting form or control destination: ' + target.href)
    }
    for (const form of forms) {
      const label = corporateLabel(document, form)
      const handlers = Object.entries(form.attrs).filter(([key]) => /^on/i.test(key)).map(([, value]) => value).join(' ')
      requireProof(!handlers || !recruitingIntent(label + ' ' + handlers), 'Guardian careers has an uninspectable scripted recruiting form')
      if (form.attrs.action) inspectControlTarget(form.attrs.action, label)
      else requireProof(!recruitingIntent(label), 'Guardian careers has an unaccounted recruiting form without a destination')
    }
    for (const control of controls) {
      const { node } = control
      if (node.tag === 'input' && (node.attrs.type || '').toLowerCase() === 'hidden') continue
      const label = corporateLabel(document, node)
      const handlers = Object.entries(node.attrs).filter(([key]) => /^on/i.test(key)).map(([, value]) => value).join(' ')
      requireProof(!handlers || !recruitingIntent(label + ' ' + handlers), 'Guardian careers has an uninspectable scripted recruiting control')
      const destinations = CONTROL_DESTINATION_ATTRIBUTES.map(key => node.attrs[key]).filter(Boolean)
      const form = node.attrs.form ? forms.find(candidate => candidate.attrs.id === node.attrs.form) : control.form
      if (!destinations.length && form?.attrs.action) destinations.push(form.attrs.action)
      if (!destinations.length) requireProof(!recruitingIntent(label), 'Guardian careers has an unaccounted recruiting control without a destination')
      for (const destination of destinations) inspectControlTarget(destination, label)
    }
    sourcePages.push({ url, status: response.status, sha256: response.receipt.bodySHA256, completedAt: response.completedAt })
    if (network) networkPages.push({ url, purpose: 'separate financial-professional Guardian Network recruiting; outside configured corporate-employee inventory',
      parentNativeStatement: url.endsWith('/apply') ? null : bodyText.match(/The Guardian Network[®]? is a network of preferred providers authorized to offer products[^.]*\./)?.[0],
      advertisedNativeVacancyCount: 0, sha256: response.receipt.bodySHA256 })
    if (url === CORPORATE) {
      report.boardReceipt = currentWorkdayBoardReceipt({ officialCareersUrl: CORPORATE, boardUrl: BOARD,
        response: { ok: true, status: 200, url, headers: new Headers(response.headers) }, html: response.html })
      // Preserve the packet's capture clock instead of stamping replay time.
      report.boardReceipt.fetchedAt = response.completedAt
    }
  }
  requireProof(report.boardReceipt && handoffs.length, 'Guardian current corporate board handoff was not established')
  report.corporateScope = { sourcePages, handoffs, excludedNetworkRecruiting: networkPages,
    scope: 'current publicly advertised corporate-employee Workday inventory', wholeCompanyScope: null, legalEmployerUniversality: null }
}

async function remoteApplicantReceipt(role, listing, read, signal) {
  const apiUrl = buildWorkdayDetailApiUrl(role.url, API)
  const native = await read(apiUrl)
  requireProof(native.status === 200, 'Guardian fresh CXS role is unavailable')
  const payload = JSON.parse(native.html), info = payload?.jobPostingInfo
  requireProof(info && typeof info.jobReqId === 'string' && info.jobReqId === role.requisitionId
    && info.jobPostingSiteId === 'Guardian-Life-Careers' && roleKey(info.externalUrl) === roleKey(role.url)
    && text(info.title) === text(listing.title) && text(info.title) && text(payload.hiringOrganization?.name) === EMPLOYER,
  'Guardian fresh native requisition, title, employer, site or canonical role identity changed')
  requireProof(info.jobPostingId === new URL(role.url).pathname.split('/').at(-1)
    && new RegExp('_' + role.requisitionId + '(?:-\\d+)?$').test(info.jobPostingId), 'Guardian native posting identity changed')
  const locations = [info.location, ...(info.additionalLocations || [])]
  requireProof(Array.isArray(info.additionalLocations) && locations.every(value => typeof value === 'string' && value.trim())
    && JSON.stringify(locations) === JSON.stringify(role.locations)
    && locations.every(location => explicitWorkdayCountryScope(location) !== 'india' && !/\bindia\b/i.test(location))
    && info.jobRequisitionLocation?.descriptor === info.location && countryIsUs(info.country)
    && countryIsUs(info.jobRequisitionLocation.country), 'Guardian current native physical locations changed or conflict with US geographic eligibility')
  requireProof(info.canApply === true && info.posted === true && info.remoteType === 'Fully Remote'
    && /^\d{4}-\d{2}-\d{2}$/.test(info.startDate || '') && typeof info.jobDescription === 'string'
    && plain(info.jobDescription).length > 100, 'Guardian remote role lacks current application, date or complete content')
  const publicUrl = info.externalUrl
  const page = await read(publicUrl)
  signal.throwIfAborted()
  requireProof(page.status === 200, 'Guardian native public role is unavailable')
  const document = readNativeDocument(page.html)
  const schemas = document.nodes(node => node.tag === 'script' && !node.attrs.src && /^application\/ld\+json$/i.test(node.attrs.type || '')).flatMap(node => {
    const value = JSON.parse(node.raw || '')
    return Array.isArray(value) ? value : Array.isArray(value?.['@graph']) ? value['@graph'] : [value]
  }).filter(value => value?.['@type'] === 'JobPosting')
  requireProof(schemas.length === 1, 'Guardian public role has no unique native JobPosting')
  const schema = schemas[0], applicant = schema.applicantLocationRequirements
  const places = Array.isArray(schema.jobLocation) ? schema.jobLocation : [schema.jobLocation]
  const descriptionMeta = document.nodes(node => node.tag === 'meta' && node.attrs.property === 'og:description')
  const titleMeta = document.nodes(node => node.tag === 'meta' && node.attrs.property === 'og:title')
  const urlMeta = document.nodes(node => node.tag === 'meta' && node.attrs.property === 'og:url')
  const fullNativeContent = contentIdentity(plain(info.jobDescription)), schemaContent = contentIdentity(schema.description)
  requireProof(['http://schema.org', 'https://schema.org'].includes(schema['@context'])
    && schema.identifier?.['@type'] === 'PropertyValue' && schema.identifier.value === info.jobReqId
    && text(schema.identifier.name) === text(info.title) && text(schema.title) === text(info.title)
    && text(schema.hiringOrganization?.name) === EMPLOYER && schema.hiringOrganization?.['@type'] === 'Organization'
    && schema.datePosted === info.startDate && titleMeta.length === 1 && text(titleMeta[0].attrs.content) === text(info.title)
    && urlMeta.length === 1 && roleKey(urlMeta[0].attrs.content) === roleKey(publicUrl),
  'Guardian native public role identity, employer, title or posting date differs from CXS')
  requireProof(schema.jobLocationType === 'TELECOMMUTE' && applicant?.['@type'] === 'Country' && us(applicant.name)
    && JSON.stringify(Object.keys(applicant).sort()) === JSON.stringify(['@type', 'name'])
    && places.length > 0 && places.every(place => place?.['@type'] === 'Place' && place.address?.['@type'] === 'PostalAddress'
      && us(place.address.addressCountry)) && places.some(place => text(place.address.addressLocality) === text(info.location)),
  'Guardian role-wide native US geographic applicant eligibility is unavailable or conflicting')
  requireProof(fullNativeContent && schemaContent.startsWith(fullNativeContent) && descriptionMeta.length === 1
    && schemaContent === contentIdentity(descriptionMeta[0].attrs.content), 'Guardian full native CXS content does not reconcile with public schema and description metadata')
  const nativeStates = document.nodes(node => node.tag === 'script' && !node.attrs.src && /window\.workday\s*=/.test(node.raw || ''))
  requireProof(nativeStates.length === 1, 'Guardian public role has ambiguous native client state')
  currentNativeClient(nativeStates[0].raw)
  return { requisitionId: info.jobReqId, url: publicUrl, nativeDetailUrl: apiUrl,
    method: 'native-remote-geographic-applicant-location-requirement', applicantCountry: applicant.name,
    indiaEligibility: 'excluded-by-role-wide-US-geographic-applicant-requirement', physicalLocations: [...locations],
    originalPhysicalCountriesUnresolved: true, originalCountryScopes: role.countryScopes || [],
    nativeDetailSHA256: native.receipt.bodySHA256, publicRoleSHA256: page.receipt.bodySHA256,
    nativeDescriptionSHA256: hashWorkdayProof(info.jobDescription), schemaDescriptionSHA256: hashWorkdayProof(schema.description),
    completeCxsDescriptionReconciled: true, schemaAppendedNativeBoilerplate: schemaContent.slice(fullNativeContent.length),
    startDate: info.startDate, cxsCompletedAt: native.completedAt, verifiedAt: page.completedAt }
}

async function finalClosing(read, physicalProof, report) {
  const expected = new Map(physicalProof.listingRoles.map(role => [roleKey(role.url), workdayInventoryIdentity(role)]))
  const actual = new Map()
  let total = null, offset = 0, pages = 0, completedAt = null
  for (let number = 1; number <= MAX_PAGES; number++) {
    const response = await read(API, { appliedFacets: {}, searchText: '', limit: 20, offset })
    requireProof(response.status === 200, 'Guardian final native inventory is unavailable')
    const payload = JSON.parse(response.html)
    requireProof(Number.isSafeInteger(payload.total) && payload.total >= 0 && Array.isArray(payload.jobPostings)
      && payload.jobPostings.length <= 20 && !payload.nextPage && !payload.nextOffset && !payload.hasMore && !payload.next,
    'Guardian final native inventory has an unknown pagination contract')
    pages++
    if (total === null) total = payload.total
    requireProof((number > 1 && payload.total === 0 ? total : payload.total) === total && total === physicalProof.initial.reportedTotal,
      'Guardian final complete-board native total changed')
    for (const row of payload.jobPostings) {
      requireProof(typeof row.externalPath === 'string' && row.externalPath.startsWith('/job/'), 'Guardian final native row has invalid identity')
      const key = roleKey(BOARD + row.externalPath), identity = workdayInventoryIdentity(row)
      requireProof(!actual.has(key) && expected.get(key) === identity, 'Guardian final native role identity changed or repeated')
      actual.set(key, identity)
    }
    offset += payload.jobPostings.length
    completedAt = response.completedAt
    if (offset >= total) break
    requireProof(payload.jobPostings.length && number < MAX_PAGES, 'Guardian final complete-board inventory was truncated')
  }
  requireProof(actual.size === total && actual.size === expected.size, 'Guardian final native role sets do not reconcile')
  const sha256 = hashWorkdayProof(JSON.stringify([...actual.values()].sort()))
  requireProof(sha256 === physicalProof.initial.sha256 && sha256 === physicalProof.closing.sha256, 'Guardian final complete-board role hash changed')
  requireProof(report.retainedResponses.filter(packet => packet.method === 'GET').every(packet => Date.parse(packet.completedAt) <= Date.parse(completedAt)),
    'Guardian closing capture predates supplemental scope receipts')
  return { reportedTotal: total, count: actual.size, sha256, pages, verifiedAt: completedAt }
}

export async function run(options = {}) {
  const controller = new AbortController(), budgetReason = Object.assign(Error('Guardian whole-source proof budget exhausted'), { name: 'TimeoutError' })
  const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal
  const timer = setTimeout(() => controller.abort(budgetReason), SOURCE_BUDGET_MS)
  try {
    signal.throwIfAborted()
    const original = await runWorkdayScraper({ ...options, company: 'Guardian', source: SOURCE, baseUrl: BOARD, scraperDir, signal })
    signal.throwIfAborted()
    const physicalProof = original[WORKDAY_COUNTRY_INVENTORY_PROOF], evidence = readInventoryEvidence(original)
    const report = { policy: 'guardian-current-public-corporate-workday-inventory', physicalCountryProof: physicalProof || null,
      applicantScopeReceipts: [], failures: [], retainedResponses: [], finalClosing: null,
      cleanupAllowed: false, sourceScopeComplete: false, wholeCompanyScope: null, legalEmployerUniversality: null,
      collectionLimits: { additionalMaxRequests: MAX_EXTRA_REQUESTS, additionalMaxAggregateBytes: MAX_EXTRA_BYTES,
        additionalMaxBodyBytes: MAX_HTML_BYTES, requestTimeoutMs: 20000, maxUnresolvedRoles: MAX_UNRESOLVED, maxClosingPages: MAX_PAGES,
        wholeSourceBudgetMs: SOURCE_BUDGET_MS, maxCorporateControlsPerPage: MAX_CORPORATE_CONTROLS,
        sharedWorkdayEngineHasSeparateExistingBounds: true } }
    const read = createReader(options, signal, report)
    let complete = false
    try {
      requireProof(physicalProof?.scope === 'complete-board-country-proof' && evidence?.firstParty === true
        && ['coverage-gap', 'complete-inventory'].includes(evidence.status)
        && physicalProof.initial.count === physicalProof.initial.reportedTotal
        && physicalProof.closing.count === physicalProof.initial.count && physicalProof.closing.sha256 === physicalProof.initial.sha256
        && physicalProof.listingRoles?.length === physicalProof.initial.count && physicalProof.roles?.length === physicalProof.initial.count,
      'Guardian shared full-board native country proof is incomplete')
      requireProof(physicalProof.unresolvedRoles.length <= MAX_UNRESOLVED, 'Guardian unresolved role budget exceeded')
      const unresolvedUrls = new Set(physicalProof.unresolvedRoles.map(role => role.url))
      const indiaRoles = physicalProof.roles.filter(role => role.countryScopes?.includes('india'))
      requireProof(indiaRoles.length === original.length && original.every(job => job.sourceDetailComplete === true
        && typeof job.sourceDescription === 'string' && job.sourceDescription.trim()
        && indiaRoles.some(role => roleKey(role.url) === roleKey(job.link))), 'Guardian proven India descriptions or role identities are incomplete')
      requireProof(physicalProof.roles.every(role => unresolvedUrls.has(role.url)
        || Array.isArray(role.countryScopes) && role.countryScopes.length === role.locations.length
          && role.countryScopes.every(scope => scope === 'india' || scope === 'foreign')),
      'Guardian unaccounted native physical-country role remains')
      await verifyCorporateScope(read, report, physicalProof, signal)
      for (const unresolved of physicalProof.unresolvedRoles) {
        signal.throwIfAborted()
        const role = physicalProof.roles.find(role => role.url === unresolved.url)
        const listing = physicalProof.listingRoles.find(listing => listing.url === unresolved.url)
        try {
          requireProof(role && listing && !role.countryScopes.includes('india')
            && !original.some(job => roleKey(job.link) === roleKey(role.url)), 'Guardian cannot exclude a proven India role')
          report.applicantScopeReceipts.push(await remoteApplicantReceipt(role, listing, read, signal))
        } catch (error) {
          signal.throwIfAborted()
          report.failures.push({ stage: 'native-remote-applicant-scope', requisitionId: unresolved.requisitionId, reason: error.message })
          if (error.guardianAccessDenied) throw error
        }
      }
      requireProof(report.applicantScopeReceipts.length === physicalProof.unresolvedRoles.length && !report.failures.length,
        'Guardian unresolved role eligibility proof is incomplete')
      report.finalClosing = await finalClosing(read, physicalProof, report)
      complete = true
      report.cleanupAllowed = true
      report.sourceScopeComplete = true
    } catch (error) {
      signal.throwIfAborted()
      report.failures.push({ stage: 'guardian-corporate-inventory', reason: error.message })
    }
    const remaining = (physicalProof?.unresolvedRoles || []).filter(role => !report.applicantScopeReceipts.some(receipt => receipt.requisitionId === role.requisitionId && roleKey(receipt.url) === roleKey(role.url)))
    const jobs = original.map(job => ({ ...job, sourceScopeComplete: complete, sourceListingComplete: complete,
      lifecycleCleanupAllowed: complete, sourceUnresolvedCountryRoleCount: remaining.length,
      sourceInventoryScope: 'current-public-corporate-employee-workday-board' }))
    // The shared proof property is non-configurable. Copy the array and augment
    // the proof; the original physical-country proof and labels stay untouched.
    Object.defineProperty(jobs, WORKDAY_COUNTRY_INVENTORY_PROOF, { value: { ...physicalProof,
      unresolvedRoles: remaining, guardian: report } })
    return attachInventoryEvidence(jobs, { ...evidence, status: complete ? 'complete-inventory' : 'coverage-gap',
      surface: API, firstParty: evidence?.firstParty === true && Boolean(report.boardReceipt), listingComplete: complete,
      pagesFetched: (evidence?.pagesFetched || 0) + (report.finalClosing?.pages || 0),
      reportedTotal: evidence?.reportedTotal ?? null, indiaFacetCount: complete ? jobs.length : null,
      verifiedAt: complete ? report.finalClosing.verifiedAt : evidence?.verifiedAt || null,
      reason: complete ? 'guardian-current-public-corporate-workday-board;all-native-role-country-or-geographic-applicant-scopes;post-receipt-closing-reconciled'
        : 'guardian-current-public-corporate-workday-coverage-gap;proven-india-roles-retained;cleanup-disabled' })
  } finally { clearTimeout(timer); signal.throwIfAborted() }
}
