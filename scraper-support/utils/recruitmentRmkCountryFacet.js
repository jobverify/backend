import { createHash } from 'node:crypto'
import { types } from 'node:util'
import { parse } from 'acorn'
import { readNativeDocument, decodeNativeEntities, extractActiveDescription } from './activeNativeHtml.js'
import { readVisibleNativeDocument } from './visibleNativeHtml.js'
import { normalizeNativeAttributeBoundaries } from './nativeHtmlAttributes.js'
import { attachInventoryEvidence } from './inventoryEvidence.js'

const CLIENT_SHA = 'eb3cdee25a3692f74f8fb599b59d6d5179dc16ef2ffc34b8069c385579d622ea'
const ANTI_SHA = '4a1ab69ed7fa61e5385ca970bf06b3e1afafc49efaeace8ec022766e16e72433'
const configs = {
  essilorluxottica: { company: 'EssilorLuxottica', employer: 'EssilorLuxottica Group', origin: 'https://careers.essilorluxottica.com',
    handoff: 'https://careers.essilorluxottica.com/', nativePublisher: true, nativePublisherTitle: 'EssilorLuxottica Group Jobs', field: 'country', value: 'IN',
    fields: ['country', 'city', 'customfield1', 'customfield2', 'customfield3', 'customfield4'], nativeApplicationButton: true,
    legalStatement: 'COPYRIGHT \u00a92020 LUXOTTICA GROUP P.IVA 10182640150 - ALL RIGHTS RESERVED - Subject to direction and coordination activity by EssilorLuxottica S.A. \u2013 712 049 618 R.C.S. Cr\u00e9teil',
    reciprocal: ['overview', 'mission', 'innovation', 'sustainability', 'careers'].map(path => 'https://www.essilorluxottica.com/' + path) },
  newellbrands: { company: 'Newell Brands', employer: 'Newell Brands', origin: 'https://jobs.newellbrands.com',
    corporate: 'https://www.newellbrands.com/', middle: 'https://careers.newellbrands.com/index',
    handoff: 'https://jobs.newellbrands.com/go/AllJobs/9623000/', field: 'customfield4', value: 'India',
    fields: ['customfield4', 'department', 'customfield3', 'customfield5', 'facility', 'dept'] },
}
const sha = value => createHash('sha256').update(value).digest('hex')
const clean = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const plain = value => value && typeof value === 'object' && !Array.isArray(value)
const hasClass = (node, value) => (node.attrs.class || '').split(/\s+/).includes(value)
const fail = message => { throw Object.assign(Error('RMK country facet: ' + message), { softFailure: true, abortRetries: true, failureKind: 'coverage_gap', lifecycleCleanupAllowed: false }) }
const need = (condition, message) => { if (!condition) fail(message) }
const one = (values, label) => { need(values.length === 1, 'missing or ambiguous ' + label); return values[0] }
const unique = values => [...new Set(values)]
const nodeText = node => typeof node === 'string' ? decodeNativeEntities(node) : (node.children || []).map(nodeText).join(' ').replace(/\s+/g, ' ').trim()
const attrEscape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
const voids = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])
const rawExcluded = new Set(['script', 'title', 'template', 'noscript', 'object', 'iframe', 'textarea', 'xmp', 'noembed', 'noframes', 'plaintext'])
const parsed = html => readNativeDocument(normalizeNativeAttributeBoundaries(html))
const rootOf = doc => one(doc.nodes(node => node.tag === 'root'), 'native root')
const inlineClassic = node => node.tag === 'script' && !['src', 'nomodule', 'language'].some(key => Object.hasOwn(node.attrs, key))
  && /^(?:|text\/javascript|application\/javascript)$/.test(node.attrs.type || '')
const javaScriptMimes = new Set(['application/ecmascript', 'application/javascript', 'application/x-ecmascript', 'application/x-javascript',
  'text/ecmascript', 'text/javascript', 'text/javascript1.0', 'text/javascript1.1', 'text/javascript1.2', 'text/javascript1.3',
  'text/javascript1.4', 'text/javascript1.5', 'text/jscript', 'text/livescript', 'text/x-ecmascript', 'text/x-javascript'])
const inlineProgramMode = node => {
  if (node.tag !== 'script' || Object.hasOwn(node.attrs, 'src')) return null
  const type = (node.attrs.type || '').trim().toLowerCase()
  if (type === 'module') return 'module' // nomodule does not disable a module.
  return !Object.hasOwn(node.attrs, 'nomodule') && (!type || javaScriptMimes.has(type.split(';')[0].trim())) ? 'script' : null
}

function visible(page) {
  const doc = parsed(page.html), styles = []
  const find = node => {
    if (typeof node === 'string') return
    if (node.tag === 'style') { if (node.attrs.id === 'antiClickjack') styles.push(node); return }
    if (rawExcluded.has(node.tag)) return
    node.children.forEach(find)
  }
  find(rootOf(doc))
  if (styles.length) {
    const style = one(styles, 'antiClickjack style'), program = one(doc.nodes(node => inlineClassic(node) && node.attrs.id === 'antiClickJackScript' && node.attrs.type === 'text/javascript'), 'antiClickjack program')
    need(style.attrs.type === 'text/css' && style.raw === 'body{display:none !important;}' && sha(program.raw || '') === ANTI_SHA, 'antiClickjack current top-level program changed')
  }
  // Reconstruct the parsed active tree for CSS analysis. Styles quoted inside
  // scripts/templates are raw fallback, not active CSS. Original bytes remain
  // in the receipts. Only the reviewed top-window antiClickjack pair is removed.
  const render = node => {
    if (typeof node === 'string') return node
    if (rawExcluded.has(node.tag)) return ''
    if (node.tag === 'style') return styles.includes(node) ? '' : '<style>' + (node.raw || '') + '</style>'
    if (node.tag === 'root') return node.children.map(render).join('')
    const start = '<' + node.tag + Object.entries(node.attrs).map(([key, value]) => ' ' + key + '="' + attrEscape(value) + '"').join('') + '>'
    return start + (voids.has(node.tag) ? '' : node.children.map(render).join('') + '</' + node.tag + '>')
  }
  const result = readVisibleNativeDocument(render(rootOf(doc)))
  const within = (node, predicate) => node.inert ? [] : [ ...(predicate(node) ? [node] : []), ...node.children.filter(child => typeof child !== 'string').flatMap(child => within(child, predicate)) ]
  return { ...result, nodes: (predicate, subtree) => subtree ? within(subtree, predicate) : result.nodes(predicate) }
}
const activeHandoff = (page, target) => {
  const doc = visible(page)
  need(!doc.nodes(node => node.tag === 'base').length, 'unreviewed corporate base')
  return doc.nodes(node => node.tag === 'a' && node.attrs.href).some(node => { try { return new URL(node.attrs.href, page.url).href === target } catch { return false } })
}
const member = (node, path) => {
  if (path.length === 1) return node?.type === 'Identifier' && node.name === path[0]
  return node?.type === 'MemberExpression' && !node.computed && node.property?.name === path.at(-1) && member(node.object, path.slice(0, -1))
}
const literal = node => {
  if (node?.type === 'Literal' && !node.regex && ['string', 'boolean'].includes(typeof node.value)) return node.value
  if (node?.type === 'ArrayExpression') return node.elements.map(literal)
  need(node?.type === 'ObjectExpression' && node.properties.length <= 12, 'nonliteral options configuration')
  const result = Object.create(null)
  for (const property of node.properties) {
    const key = property.key?.name ?? property.key?.value
    need(property.type === 'Property' && !property.computed && !property.method && property.kind === 'init'
      && typeof key === 'string' && !Object.hasOwn(result, key), 'ambiguous options configuration')
    result[key] = literal(property.value)
  }
  return result
}
const memberPath = node => {
  if (node?.type === 'Identifier') return [node.name]
  if (node?.type === 'ThisExpression') return ['this']
  if (node?.type !== 'MemberExpression') return null
  const prefix = memberPath(node.object), key = node.computed ? node.property?.type === 'Literal' && node.property.value : node.property?.name
  return prefix && typeof key === 'string' ? [...prefix, key] : null
}
const globalObjects = new Set(['window', 'self', 'globalThis'])
const nativeNamespacePath = node => {
  const path = memberPath(node)
  if (!path) return null
  // These members all name the same anonymous public Window. Treat an
  // unqualified this receiver conservatively as well; do not simulate scope.
  let start = path[0] === 'this' ? 1 : 0
  while (globalObjects.has(path[start])) start++
  return path.slice(start)
}
const propertyNameOnly = (parent, key) => parent && (
  (parent.type === 'MemberExpression' && key === 'property' && !parent.computed)
  || (['Property', 'MethodDefinition', 'PropertyDefinition'].includes(parent.type) && key === 'key' && !parent.computed)
  || (['LabeledStatement', 'BreakStatement', 'ContinueStatement'].includes(parent.type) && key === 'label')
  || parent.type === 'MetaProperty')
const defaultNamespace = (node, path) => node?.type === 'LogicalExpression' && node.operator === '||'
  && member(node.left, path) && node.right.type === 'ObjectExpression' && node.right.properties.length === 0
function reviewedOptionsProgram(program, assignment) {
  const [namespace, search, options] = program.body
  need(program.body.length === 3 && namespace?.type === 'VariableDeclaration' && namespace.kind === 'var' && namespace.declarations.length === 1
    && member(namespace.declarations[0].id, ['j2w']) && defaultNamespace(namespace.declarations[0].init, ['j2w'])
    && search?.type === 'ExpressionStatement' && search.expression.type === 'AssignmentExpression' && search.expression.operator === '='
    && member(search.expression.left, ['j2w', 'search']) && defaultNamespace(search.expression.right, ['j2w', 'search'])
    && options?.type === 'ExpressionStatement' && options.expression === assignment, 'unreviewed options bootstrap or mutation')
}
function searchContract(page, config) {
  const doc = parsed(page.html), declarations = [], tokens = [], programs = []
  need(!doc.nodes(node => node.tag === 'base').length, 'unreviewed native base')
  const scripts = doc.nodes(node => inlineProgramMode(node))
  for (const script of scripts) {
    let program
    // A syntax error prevents the entire classic script from executing. The
    // current Essilor page includes malformed, unrelated analytics scripts.
    try { program = parse(script.raw, { ecmaVersion: 'latest', sourceType: inlineProgramMode(script) }) } catch { continue }
    programs.push(program)
    // Modules and other executable MIME variants must be checked for changes
    // to the namespace, but only the reviewed classic programs supply proof.
    if (!inlineClassic(script)) continue
    tokens.push(...[...(script.raw || '').matchAll(/"X-CSRF-Token"\s*:\s*"([a-f\d-]{36})"/gi)].map(match => match[1]))
    for (const statement of program.body) {
      const expression = statement.type === 'ExpressionStatement' ? statement.expression : null
      if (expression?.type === 'AssignmentExpression' && expression.operator === '=' && member(expression.left, ['j2w', 'search', 'options'])) {
        reviewedOptionsProgram(program, expression)
        declarations.push({ value: literal(expression.right), program })
      }
    }
  }
  const declared = one(declarations, 'active options declaration'), declaration = declared.value
  // The observed bootstrap is a literal assignment, not a running application.
  // Any other program accessing this namespace, or later reusing its root,
  // makes the resulting options unknown; never execute or simulate overrides.
  let later = false, visited = 0
  const inspect = (node, depth = 0, parent = null, key = '') => {
    if (!node || typeof node !== 'object') return
    need(++visited <= 100_000 && depth <= 150, 'options program analysis bound reached')
    if (propertyNameOnly(parent, key)) return
    const native = nativeNamespacePath(node)
    need(!(native?.[0] === 'j2w' && (native[1] === 'search' || later)), 'unreviewed active options namespace mutation')
    for (const [childKey, value] of Object.entries(node)) if (Array.isArray(value)) value.forEach(child => inspect(child, depth + 1, node, childKey));else if (value && typeof value === 'object') inspect(value, depth + 1, node, childKey)
  }
  for (const program of programs) { if (program === declared.program) later = true;else inspect(program) }
  need(JSON.stringify(declaration.facets) === JSON.stringify(config.fields) && declaration.isOpen === false && declaration.showPicklistAllLocales === true, 'country options field contract changed')
  const button = one(doc.nodes(node => node.tag === 'a' && node.attrs.id === 'options-search'), 'country menu controller')
  need(button.attrs['aria-controls'] === 'moreOptionsDiv' && button.attrs['data-target'] === '.optionsDiv' && button.attrs['data-toggle'] === 'collapse', 'country menu controller changed')
  const menus = []
  const walk = (node, form = null) => {
    if (typeof node === 'string') return
    if (node.tag === 'div' && node.attrs.id === 'optionsFacetValues') { menus.push({ node, form }); return }
    if (node.inert || rawExcluded.has(node.tag)) return
    node.children.forEach(child => walk(child, node.tag === 'form' ? node : form))
  }
  walk(rootOf(doc))
  const menu = one(menus, 'declared country selector menu')
  need(menu.form?.attrs.method?.toLowerCase() === 'get' && menu.form.attrs.action === '/search/'
    && menu.node.attrs.class === 'optionsFacetValues' && /^display\s*:\s*none;?$/.test(menu.node.attrs.style || ''), 'country selector is not the reviewed script-controlled GET form')
  const controls = [], labels = []
  const metadata = node => {
    if (typeof node === 'string') return
    if (['template', 'script', 'noscript', 'object'].includes(node.tag) || Object.hasOwn(node.attrs, 'hidden') || Object.hasOwn(node.attrs, 'inert') || node.attrs['aria-hidden'] === 'true' || /(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(node.attrs.style || '')) return
    if (node.tag === 'select' && node.attrs.id === 'optionsFacetsDD_' + config.field) controls.push(node)
    if (node.tag === 'label' && node.attrs.for === 'optionsFacetsDD_' + config.field) labels.push(node)
    node.children.forEach(metadata)
  }
  menu.node.children.forEach(metadata)
  const control = one(controls, 'native country selector'), label = one(labels, 'native country selector label')
  need(control.attrs.name === control.attrs.id && /^Country(?:\/Region)?$/.test(clean(nodeText(label))), 'native selector is not typed as country')
  const client = one(unique(doc.nodes(node => node.tag === 'script' && node.attrs.src).map(node => new URL(node.attrs.src, page.url)).filter(url => url.origin === config.origin && /^\/platform\/js\/j2w\/min\/options-search\.min\.js$/.test(url.pathname)).map(url => url.href)), 'declared options client')
  return { token: one(unique(tokens), 'fresh anonymous CSRF declaration'), client, selector: control.attrs.name, declaration }
}
function countrySelection(payload, config) {
  need(plain(payload) && plain(payload.facets?.map) && Array.isArray(payload.facets.map[config.field]), 'invalid country facet response')
  const countries = payload.facets.map[config.field]
  need(countries.length <= 5000 && countries.every(value => plain(value) && typeof value.name === 'string' && typeof value.translated === 'string' && Number.isSafeInteger(value.count) && value.count >= 0), 'invalid typed country records')
  const selected = one(countries.filter(value => value.name === config.value), 'native India country record')
  need((selected.translated || selected.name) === 'India' && selected.count > 0, 'India country count is empty or unverified')
  return structuredClone(selected)
}
function listing(page, config, selected) {
  const doc = visible(page), rows = [], ids = new Set()
  const summaries = unique(doc.nodes(node => hasClass(node, 'paginationLabel')).map(node => doc.text(node)))
  const summary = one(summaries, 'native pagination count'), match = summary.match(/^Results 1\s*[\u2013-]\s*(\d+) of (\d+)$/)
  need(match && Number(match[1]) === selected.count && Number(match[2]) === selected.count, 'selected country pagination count changed or incomplete')
  for (const node of doc.nodes(node => node.tag === 'tr' && hasClass(node, 'data-row'))) {
    const links = doc.nodes(child => child.tag === 'a' && hasClass(child, 'jobTitle-link') && child.attrs.href, node)
    const identity = one(unique(links.map(link => JSON.stringify({ href: new URL(link.attrs.href, page.url).href, title: doc.text(link) }))), 'native listing title identity')
    const item = JSON.parse(identity), url = new URL(item.href), match = url.pathname.match(/^\/job\/[^/]+\/([1-9]\d{2,19})\/$/)
    need(url.origin === config.origin && !url.search && !url.hash && match && item.title, 'native role URL identity changed')
    need(!ids.has(match[1]), 'duplicate native posting identity'); ids.add(match[1])
    const location = one(unique(doc.nodes(child => hasClass(child, 'jobLocation'), node).map(child => doc.text(child))), 'native listing location')
    rows.push({ id: match[1], url: url.href, title: item.title, location })
  }
  need(rows.length === selected.count && rows.length <= 100, 'selected country listing count is incomplete')
  need(!doc.nodes(node => node.tag === 'a' && /\b(?:next|last)\b/i.test(node.attrs.rel || '')).length, 'selected pagination is not terminal')
  return { rows, summary }
}
function detail(page, row, config, selected, now) {
  const doc = visible(page), canonicals = doc.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical')
  need(one(canonicals, 'own canonical identity').attrs.href === row.url, 'own canonical identity changed')
  const scope = one(doc.nodes(node => hasClass(node, 'jobDisplayShell') && node.attrs.itemtype === 'http://schema.org/JobPosting' && Object.hasOwn(node.attrs, 'itemscope')), 'visible native JobPosting scope')
  const properties = (root, key) => {
    const values = []
    const visit = node => {
      if (typeof node === 'string' || node.inert) return
      if ((node.attrs.itemprop || '').split(/\s+/).includes(key)) values.push(node)
      if (node !== root && Object.hasOwn(node.attrs, 'itemscope')) return
      node.children.forEach(visit)
    }
    root.children.forEach(visit); return values
  }
  const fields = key => properties(scope, key)
  const meta = key => { const nodes = fields(key);return nodes.length ? one(nodes, 'native ' + key).attrs.content : null }
  const title = doc.text(one(fields('title'), 'visible native title'))
  need(title === row.title && unique(doc.nodes(node => node.tag === 'h1', scope).map(node => doc.text(node))).includes(title), 'listing and own visible title identity changed')
  const descriptionNode = one(fields('description'), 'visible full description'), description = doc.text(descriptionNode)
  need(description.length >= 200 && extractActiveDescription(description), 'visible full native description unavailable')
  need(meta('hiringOrganization') === config.employer, 'native employer differs from configured company')
  const place = one(fields('jobLocation'), 'own native job location')
  need(place.attrs.itemtype === 'http://schema.org/Place', 'own native country Place type changed')
  const address = one(properties(place, 'address'), 'own native work-country address')
  need(address.attrs.itemtype === 'http://schema.org/PostalAddress', 'own native country PostalAddress type changed')
  const entries = ['addressCountry', 'streetAddress', 'addressLocality', 'addressRegion', 'postalCode'].flatMap(key => properties(address, key).map(node => [key, node.attrs.content]))
  need(new Set(entries.map(([key]) => key)).size === entries.length, 'ambiguous own native country fields')
  const nativeAddress = Object.fromEntries(entries)
  const geo = one(unique(doc.nodes(node => hasClass(node, 'jobGeoLocation'), scope).map(node => doc.text(node))), 'visible native geography')
  need(geo === row.location && /(?:^|,\s*)IN$/.test(geo), 'selected native country and visible location differ')
  need(nativeAddress.addressCountry ? nativeAddress.addressCountry === 'IN' : nativeAddress.streetAddress === 'IN' && geo === 'IN', 'own native country disagrees with the selected India country')
  const controls = doc.nodes(node => node.tag === 'a' && node.attrs.href?.startsWith('/talentcommunity/apply/')
    || config.nativeApplicationButton === true && node.tag === 'button' && node.attrs['aria-label'] === 'Apply now' && node.attrs['data-toggle'] === 'dropdown' && node.attrs.href?.startsWith('/talentcommunity/apply/'), scope)
  const applications = unique(controls.map(node => new URL(node.attrs.href, page.url).href))
  const application = one(applications, 'visible native application')
  need(application === config.origin + '/talentcommunity/apply/' + row.id + '/?locale=en_US', 'native application posting identity changed')
  const postedRaw = meta('datePosted'), posted = typeof postedRaw === 'string' && /\sUTC \d{4}$/.test(postedRaw) ? new Date(postedRaw) : null
  need(posted && Number.isFinite(posted.getTime()) && posted.getTime() <= now, 'native posting date unavailable or future')
  const expiryRaw = meta('validThrough'), expiry = typeof expiryRaw === 'string' && (/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(expiryRaw) || /\sUTC \d{4}$/.test(expiryRaw)) ? new Date(expiryRaw) : null
  need(expiryRaw === null || expiry && Number.isFinite(expiry.getTime()) && expiry.getTime() > now, 'native validThrough expiry invalid or expired')
  const pageText = doc.text(scope)
  need(!/\b(?:position (?:has been|is) filled|job is no longer available|requisition is closed)\b/i.test(pageText), 'native role visibly closed')
  return { id: row.id, url: row.url, title, location: geo, description, employer: config.employer, nativeAddress,
    application, postedRaw, postingDate: posted.toISOString().slice(0, 10), expiryRaw, closingDate: expiry?.toISOString().slice(0, 10) || null, selectedCountry: selected,
    city: nativeAddress.addressLocality || null, nativeApplicationControls: controls.map(node => ({ tag: node.tag, attrs: node.attrs, label: doc.text(node) })), nativeDescription: structuredClone(descriptionNode) }
}

export async function runCurrentRmkCountryFacet(source, options = {}) {
  const config = configs[source]
  need(config, 'unsupported unreviewed source')
  options.signal?.throwIfAborted()
  const maxDetails = options.maxDetails ?? 32, duration = options.sourceDeadlineMs ?? 85_000
  need(Number.isSafeInteger(maxDetails) && maxDetails > 0 && maxDetails <= 80 && Number.isSafeInteger(duration) && duration > 0, 'invalid reader bounds')
  const controller = new AbortController(), started = performance.now(), deadlineMs = Math.min(duration, 85_000)
  const deadlineError = Object.assign(Error('RMK country facet: source deadline exceeded'), { softFailure: true, abortRetries: true, failureKind: 'coverage_gap', lifecycleCleanupAllowed: false })
  const timer = setTimeout(() => controller.abort(deadlineError), deadlineMs)
  const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal
  const fetchImpl = options.fetchImpl || globalThis.fetch, responses = [], cookies = new Map(), now = Date.now()
  let totalBytes = 0, requestCount = 0
  const check = () => { if (performance.now() - started >= deadlineMs && !signal.aborted) controller.abort(deadlineError);signal.throwIfAborted() }
  const ignore = operation => { try { Promise.resolve(operation()).catch(() => {}) } catch {} }
  const wait = (operation, disposeLate) => new Promise((resolve, reject) => {
    let settled = false, failure
    const detach = () => signal.removeEventListener('abort', aborted)
    const stop = error => { if (!settled) { settled = true;failure = error;detach();reject(error) } }
    const aborted = () => stop(signal.reason)
    signal.addEventListener('abort', aborted, { once: true })
    try { check() } catch (error) { stop(error);return }
    Promise.resolve().then(() => { check();return operation() }).then(value => {
      if (settled) { if (disposeLate) ignore(() => disposeLate(value, failure));return }
      try { check() } catch (error) { stop(error);if (disposeLate) ignore(() => disposeLate(value, error));return }
      settled = true;detach();resolve(value)
    }, error => { if (!settled) { try { check() } catch (expired) { error = expired } stop(error) } })
  })
  const read = async (url, init = {}) => {
    check();need(++requestCount <= 80, 'native read bound reached')
    const origin = new URL(url).origin, cookie = cookies.get(origin)
    let response, reader, released = false, cancelled = false
    const release = () => { if (reader && !released) { released = true;ignore(() => reader.releaseLock()) } }
    const cancelResponse = (value, error) => ignore(() => value?.body?.cancel(error))
    const cancel = error => { if (cancelled) return;cancelled = true;if (reader) { ignore(() => reader.cancel(error));release() } else cancelResponse(response, error) }
    try {
      response = await wait(() => fetchImpl(url, { ...init, redirect: 'manual', credentials: 'omit', cache: 'no-store', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify current public RMK reader)', Accept: 'text/html,application/json;q=0.9,*/*;q=0.8', ...(cookie ? { Cookie: cookie } : {}), ...init.headers }, signal }), cancelResponse)
      const chunks = [];let bytes = 0, chunkCount = 0
      if (response.body !== null) {
        need(response.body?.getReader, 'native readable response body unavailable')
        reader = await wait(() => response.body.getReader(), value => { ignore(() => value.cancel());ignore(() => value.releaseLock()) })
        for (;;) {
          const { done, value } = await wait(() => reader.read())
          if (done) break
          need(types.isUint8Array(value) && ++chunkCount <= 65_536, 'native response chunk type or count bound exceeded')
          need(value.byteLength <= 4_000_000 - bytes && value.byteLength <= 24_000_000 - totalBytes, 'native response byte bounds exceeded')
          bytes += value.byteLength;totalBytes += value.byteLength
          chunks.push(Buffer.from(value));check()
        }
      }
      const buffer = Buffer.concat(chunks, bytes), html = new TextDecoder('utf-8', { fatal: true }).decode(buffer), finalURL = response.url || url
      check()
      responses.push({ url, finalURL, status: response.status, method: init.method || 'GET', requestBody: init.body || null, bytes, bodySHA256: sha(buffer), body: html, checkedAt: new Date().toISOString() })
      if (!response.ok) throw Object.assign(Error('RMK country facet HTTP ' + response.status + ' ' + url), { softFailure: true, abortRetries: true, failureKind: [401, 403, 429].includes(response.status) ? 'blocked_or_access_denied' : 'upstream_unavailable', lifecycleCleanupAllowed: false })
      need(finalURL === url, 'unreviewed current public redirect')
      const set = response.headers.getSetCookie?.() || []
      if (set.length) cookies.set(origin, set.map(value => value.split(';')[0]).join('; '))
      need(!/<title[^>]*>\s*(?:Just a moment|Access Denied|Forbidden|Robot Check)/i.test(html) && !/id=["']challenge-form|px-captcha|datadome\.co\/captcha/i.test(html), 'public access challenge')
      return { url: finalURL, html, status: response.status }
    } catch (error) { cancel(error);throw error }
    finally { release() }
  }
  const bind = async () => {
    if (config.nativePublisher === true) {
      const page = await read(config.handoff), nativeDoc = parsed(page.html), document = visible(page)
      need(nativeDoc.nodes(node => node.tag === 'title' && clean(node.raw) === config.nativePublisherTitle).length === 1
        && document.nodes(node => node.tag === 'h1' && document.text(node) === config.nativePublisherTitle).length === 1, 'configured native legal publisher identity changed')
      const footer = one(document.nodes(node => node.attrs.id === 'footer'), 'configured native legal publisher footer')
      need(document.text(footer).endsWith(config.legalStatement), 'configured native legal publisher statement changed')
      need(config.reciprocal.every(url => activeHandoff(page, url)), 'configured native reciprocal corporate links changed')
      return { verified: true, method: 'configured-first-party-native-legal-publisher', officialURL: config.handoff,
        originalConfiguredNativeRoot: config.handoff, nativePublisherTitle: config.nativePublisherTitle, nativeEmployer: config.employer,
        legalStatement: config.legalStatement, reciprocalCorporateURLs: config.reciprocal, nativePublisherBodySHA256: sha(page.html), companyScopeComplete: false }
    }
    const corporate = await read(config.corporate)
    need(parsed(corporate.html).nodes(node => node.tag === 'title' && clean(node.raw) === config.company).length === 1, 'current corporate publisher changed')
    need(activeHandoff(corporate, config.middle), 'current corporate careers handoff unavailable')
    const middle = await read(config.middle)
    need(activeHandoff(middle, config.handoff), 'current native careers handoff unavailable')
    return { verified: true, method: 'current-corporate-active-careers-handoff', officialURL: config.corporate, handoffChain: [config.middle, config.handoff], corporateBodySHA256: sha(corporate.html), middleBodySHA256: sha(middle.html), companyScopeComplete: false }
  }
  try {
  const binding = await bind(), native = await read(config.handoff), nativeDoc = parsed(native.html)
  const searchURLs = unique(nativeDoc.nodes(node => node.tag === 'form' && node.attrs.method?.toLowerCase() === 'get' && node.attrs.name === 'keywordsearch').map(node => new URL(node.attrs.action, native.url).href))
  const seedURL = one(searchURLs, 'declared native search form')
  need(seedURL === config.origin + '/search/', 'declared search form origin or path changed')
  const select = async () => {
    const seed = await read(seedURL), contract = searchContract(seed, config)
    const client = await read(contract.client)
    need(sha(client.html) === CLIENT_SHA, 'current declared options client changed')
    const payload = await read(config.origin + '/services/jobs/options/facetValues/', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': contract.token },
      body: JSON.stringify({ page: 0, keywords: '', locationsearch: '', sortby: 'referencedate', sortdir: 'desc', sortfield: 'title', recordsperpage: 25, startrow: 0,
        facetquery: { facet: true, mincount: 1, limit: 5000, fields: contract.declaration.facets, sort: 'index', showPicklistAllLocales: true }, filterquery: {} }) })
    let data
    try { data = JSON.parse(payload.html) } catch { fail('invalid native country facet JSON') }
    const selected = countrySelection(data, config), url = new URL(seedURL)
    url.searchParams.set('createNewAlert', 'false');url.searchParams.set('q', '');url.searchParams.set(contract.selector, selected.name)
    const page = await read(url.href), inventory = listing(page, config, selected)
    need(inventory.rows.length <= maxDetails, 'selected native detail count exceeds reader bound')
    return { selected, inventory, url: url.href, client: contract.client }
  }
  const opening = await select()
  const hydrate = async () => {
    const results = new Array(opening.inventory.rows.length);let next = 0, failure
    await Promise.allSettled(Array.from({ length: Math.min(4, results.length) }, async () => {
      while (!failure && next < results.length) {
        const index = next++, row = opening.inventory.rows[index]
        try { results[index] = detail(await read(row.url), row, config, opening.selected, now) } catch (error) { failure ||= error }
      }
    }))
    if (failure) throw failure
    return results
  }
  const details = await hydrate(), closingDetails = await hydrate()
  need(JSON.stringify(details) === JSON.stringify(closingDetails), 'closing own native role context changed')
  const closing = await select()
  need(JSON.stringify(opening) === JSON.stringify(closing), 'closing current country selection or listing changed')
  const closingBinding = await bind()
  const jobs = details.map((value, index) => ({ title: value.title, company: config.company, source, jobId: value.id, requisitionId: null,
    location: value.location, city: value.city, country: 'India', sourceUrl: value.url, applyUrl: value.application, link: value.application,
    jobDescription: value.description, sourceDescription: value.description, postingDate: value.postingDate, closingDate: value.closingDate,
    sourcePostedDateRaw: value.postedRaw, postingDatePrecision: 'calendar-date', sourcePostedDateIsExact: false, firstEverPostedAt: null,
    minimumQualification: null, preferredQualification: null, experienceRequired: null, requiredSkills: [], employmentType: null, workplaceType: null,
    nativeEmployer: value.employer, nativeListingRecord: opening.inventory.rows[index], nativeDetailRecord: value, nativeClosingDetailRecord: closingDetails[index],
    nativeCountryEvidence: { method: 'current-typed-native-country-facet-and-independent-selected-role-membership', field: config.field,
      selectedCountry: value.selectedCountry, nativeAddress: value.nativeAddress, selectedURL: opening.url, countryProofFromCityOrHQ: false },
    sourceOfficialBinding: { ...binding, currentHandoffRechecked: true, closingBinding },
    sourceNativeClosingContext: { eachFullRoleRechecked: true, selectedListingRechecked: true, currentCountryFacetRechecked: true, currentClientRechecked: true, selectedReportedTotal: opening.selected.count },
    sourceScopeComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false, sourceDetailComplete: true, scrapedAt: new Date().toISOString(),
  }))
  need(jobs.length > 0, 'empty inventory is unverified')
  jobs[0].nativeBatchEvidence = { responses, selectedCountry: opening.selected, nativeListing: opening.inventory,
    nativeSelectedPaginationComplete: true, companyScopeComplete: false, lifecycleCleanupAllowed: false }
  return attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: opening.url, firstParty: true, listingComplete: false,
    lifecycleCleanupAllowed: false, pagesFetched: 2, reportedTotal: null, indiaFacetCount: opening.selected.count, verifiedAt: new Date().toISOString(), reason: 'current-native-country-selected-partial-company-scope;cleanup-forbidden' })
  } finally { clearTimeout(timer) }
}
