import {parse} from 'acorn'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {collectAadyahContext, sha} from './currentRead.js'
import {possibleVacancyMarkup} from '../abmknowledgeware/publicIntake.js'

const ORIGIN = 'https://www.aadyah.com', ENTRY = ORIGIN + '/careers'
const LAYOUT = ORIGIN + '/_next/static/chunks/app/layout-fb5c9b2cf9296988.js'
const PAGE = ORIGIN + '/_next/static/chunks/app/careers/page-138ca50011e9e01d.js'
const CMS = 'https://staging.supercode.in/aadyah-cms/wp-json', HEADER = CMS + '/acf/v3/options/header'
const HASHES = ['9ceae380bc3b31ff63f45a3c655fb338a282e0d9465afadb78f902c1571e7570',
  'ba7678d551f759117da8829e2c3ed0d5b8a3dcf01f548ef3565bcc6055c6efe9']
const CONFIG = Object.freeze({source: 'aadyahaerospace', company: 'Aadyah Aerospace Pvt.Ltd.', entry: ENTRY, urls: [ENTRY, LAYOUT, PAGE, HEADER]})
const normalize = value => String(value ?? '').replace(/\s+/g, ' ').trim()
const javascriptTypes = new Set(['application/javascript', 'application/ecmascript', 'application/x-javascript',
  'text/javascript', 'text/ecmascript', 'text/javascript1.0', 'text/javascript1.1', 'text/javascript1.2',
  'text/javascript1.3', 'text/javascript1.4', 'text/javascript1.5', 'text/jscript', 'text/livescript', 'text/x-javascript', 'text/x-ecmascript'])
const executable = attrs => {
  const type = Object.hasOwn(attrs, 'type') ? attrs.type.trim().toLowerCase() : attrs.language?.trim() ? 'text/' + attrs.language.trim().toLowerCase() : ''
  return type === 'module' || !Object.hasOwn(attrs, 'nomodule') && (type === '' || javascriptTypes.has(type))
}

// Inspect the retained tree using browser loading rules. Visibility and inert
// do not stop script GETs. Template/object fallback and foreign namespaces
// cannot authorize this HTML deployment contract.
function declarations(html, fail) {
  const doc = readNativeDocument(html), root = doc.nodes(node => node.tag === 'root')[0], nodes = []
  const walk = (node, inherited = 'html', parent, head = false) => {
    if (!node || node.nativeTagUnqualified) return
    if (inherited === 'svg' && ['foreignobject', 'desc', 'title'].includes(parent?.tag)) inherited = 'html'
    if (inherited === 'mathml' && (parent?.tag === 'annotation-xml' && /^(?:text\/html|application\/xhtml\+xml)$/i.test(parent.attrs.encoding?.trim() || '')
      || ['mi', 'mo', 'mn', 'ms', 'mtext'].includes(parent?.tag) && !['mglyph', 'malignmark'].includes(node.tag))) inherited = 'html'
    const namespace = inherited === 'html' ? node.tag === 'svg' ? 'svg' : node.tag === 'math' ? 'mathml' : 'html' : inherited
    if (namespace === 'html' && ['template', 'object'].includes(node.tag)) return
    head ||= namespace === 'html' && node.tag === 'head'
    if (namespace === 'html' && ['script', 'base', 'title'].includes(node.tag)) nodes.push({node, head})
    for (const child of node.children || []) if (typeof child !== 'string') walk(child, namespace, node, head)
  }
  walk(root)
  const titles = nodes.filter(({node, head}) => node.tag === 'title' && head).map(({node}) => normalize(node.raw))
  if (titles.length !== 1 || !/^AADYAH Aerospace\s*\|\s*Careers$/i.test(titles[0])) throw fail('official careers publisher identity changed')
  const bases = nodes.filter(({node}) => node.tag === 'base' && Object.hasOwn(node.attrs, 'href'))
  let base = ENTRY
  if (bases.length) {
    try {base = new URL(bases[0].node.attrs.href, ENTRY).href} catch {throw fail('HTML base authority is unqualified')}
    const parsed = new URL(base)
    if (parsed.origin !== ORIGIN || parsed.username || parsed.password) throw fail('HTML base authority changed')
  }
  const clients = nodes.filter(({node}) => node.tag === 'script' && node.attrs.src && executable(node.attrs)).map(({node}) => {
    try {return {url: new URL(node.attrs.src, base).href, attrs: {...node.attrs}}} catch {throw fail('public client declaration URL changed')}
  })
  for (const [pattern, expected] of [[/\/app\/layout-[^/]+\.js(?:[?#]|$)/, LAYOUT], [/\/app\/careers\/page-[^/]+\.js(?:[?#]|$)/, PAGE]]) {
    const matches = clients.filter(row => pattern.test(row.url))
    if (matches.length !== 1 || matches[0].url !== expected) throw fail('current active public client deployment declaration changed')
    if (matches[0].attrs.integrity?.trim()) throw fail('unreviewed public client integrity declaration changed')
  }
  const scripts = nodes.filter(({node}) => node.tag === 'script').map(({node}) => ({attrs: {...node.attrs}, body: node.raw || '',
    sha256: sha(node.raw || ''), executable: executable(node.attrs), visuallyInactive: node.inert === true}))
  return {title: titles[0], base, clients: clients.filter(row => [LAYOUT, PAGE].includes(row.url)), scripts}
}

const visit = (ast, callback) => {
  const pending = [ast]
  while (pending.length) {
    const node = pending.pop(); callback(node)
    for (const value of Object.values(node)) if (value && typeof value === 'object') {
      if (Array.isArray(value)) {for (let index = value.length - 1; index >= 0; index--) if (value[index] && typeof value[index] === 'object') pending.push(value[index])}
      else pending.push(value)
    }
  }
}

// Diagnostic leads never authorize requests. Retain the legacy guard against
// silently discarding newly published role markup or literal inline clients.
function unresolvedRoleLeads(html, scripts) {
  const possible = possibleVacancyMarkup(html, ENTRY)
  for (const script of scripts) {
    if (!script.executable || script.attrs.src || !script.body) continue
    let ast
    try {ast = parse(script.body, {ecmaVersion: 'latest', sourceType: 'module'}); script.parserStatus = 'parsed-without-execution'}
    catch {script.parserStatus = 'unparsed-public-script'; continue}
    visit(ast, node => {
      if (node.type !== 'CallExpression') return
      const get = node.callee?.type === 'Identifier' && node.callee.name === 'fetch' || node.callee?.type === 'MemberExpression' && node.callee.property?.name === 'get'
      const target = node.arguments[0]?.type === 'Literal' ? node.arguments[0].value : null
      const init = node.arguments[1]
      const method = init?.type === 'ObjectExpression' ? init.properties.find(row => (row.key?.name ?? row.key?.value) === 'method')?.value : null
      if (get && (!method || method.type === 'Literal' && String(method.value).toUpperCase() === 'GET') && typeof target === 'string'
        && /(?:\/(?:api\/)?(?:jobs?|positions|openings)(?:\/|\?|$)|boards-api\.greenhouse|jobs\.lever\.co)/i.test(target)) possible.push({kind: 'unreviewed-executable-role-client',
        url: target, method: 'GET', publishedByPage: ENTRY, clientSha256: script.sha256, followed: false})
    })
  }
  return possible
}

// Entire immutable program hashes pin a reviewed static binding. String
// occurrences or formatter switch keys never independently authorize a URL.
function programContract(layout, page, fail) {
  if (layout.sha256 !== HASHES[0] || page.sha256 !== HASHES[1]) throw fail('reviewed public client program hash binding changed')
  let layoutAst, pageAst
  try {layoutAst = parse(layout.body, {ecmaVersion: 'latest', sourceType: 'script'}); pageAst = parse(page.body, {ecmaVersion: 'latest', sourceType: 'script'})}
  catch {throw fail('reviewed client program static parse failed')}
  const gets = [], keys = [], properties = []
  visit(layoutAst, node => {
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && node.callee.property.name === 'get') gets.push(layout.body.slice(node.start, node.end))
    if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'm' && node.arguments.length === 1 && node.arguments[0].type === 'Literal') keys.push(node.arguments[0].value)
  })
  visit(pageAst, node => {if (node.type === 'Property') properties.push(node.key.name ?? node.key.value)})
  if (gets.length !== 1 || gets[0] !== '_.Z.get("".concat("https://staging.supercode.in/aadyah-cms/wp-json","/acf/v3/options/").concat(e))'
    || JSON.stringify(keys) !== '["header","header"]' || !properties.includes('Opportunities') || !properties.includes('Button_Link')) throw fail('reviewed literal public GET binding changed')
  return {declaredPublicGETs: [HEADER], literalClientGetKeys: keys, rendererFields: ['Opportunities', 'Button_Link'],
    authority: 'exact-active-declarations-and-reviewed-program-sha256', clientHashes: [layout.sha256, page.sha256], remoteProgramsExecuted: false}
}

function nativeHeader(body, fail) {
  let header
  try {header = JSON.parse(body)} catch {throw fail('native public header JSON changed')}
  if (!header || typeof header !== 'object' || Array.isArray(header)
    || JSON.stringify(Object.keys(header).sort()) !== '["connect","cosmos","footer","logos","nav_links"]'
    || !Array.isArray(header.footer) || !Array.isArray(header.logos) || !Array.isArray(header.nav_links)) throw fail('native header envelope changed')
  const terms = header.footer.filter(row => row.acf_fc_layout === 'terms_and_policy')
  const logos = header.logos[0]?.dark_logo?.url
  if (terms.length !== 1 || !/AADYAH AEROSPACE/i.test(terms[0].copy_right_text1 || '') || typeof logos !== 'string'
    || !logos.startsWith(CMS.replace('/wp-json', '') + '/wp-content/')
    || !header.nav_links.some(row => row.nav_link?.url === '/careers')) throw fail('native CMS employer identity changed')
  const sections = header.footer.filter(row => row.acf_fc_layout === 'logo_section'), button = sections[0]?.button
  if (sections.length !== 1 || !button || button.url !== '/careers#jobs' || !/^view opening$/i.test(normalize(button.title))) throw fail('current native public hiring anchor changed')
  return {nativeHeader: header, opening: {title: button.title, url: new URL(button.url, ORIGIN).href}}
}

export const createCurrentScraper = () => ({run: options => collectAadyahContext(CONFIG, options || {}, async scope => {
  scope.audit.scriptStructure = []
  scope.audit.possibleVacancyMarkup = []
  const snapshot = async phase => {
    const html = await scope.read(ENTRY, 'html', phase), declared = declarations(html.body, scope.fail)
    const possible = unresolvedRoleLeads(html.body, declared.scripts)
    scope.audit.scriptStructure.push({url: ENTRY, phase, scripts: declared.scripts})
    scope.audit.possibleVacancyMarkup.push(...possible)
    scope.check()
    const layout = await scope.read(LAYOUT, 'javascript', phase), page = await scope.read(PAGE, 'javascript', phase)
    const contract = programContract(layout, page, scope.fail)
    scope.check()
    const response = await scope.read(HEADER, 'json', phase), model = nativeHeader(response.body, scope.fail)
    scope.check()
    return {...model, clientHashes: contract.clientHashes, declarations: declared, programContract: contract, htmlSha256: html.sha256, headerSha256: response.sha256}
  }
  scope.audit.initial = await snapshot('initial')
  scope.audit.declaredPublicGETs = [HEADER]
  scope.audit.observations = [{kind: 'declared-native-header-hiring-anchor', url: ENTRY, vacancy: false,
    country: null, postingDate: null, descriptionComplete: false, title: scope.audit.initial.opening.title,
    applicationUrl: scope.audit.initial.opening.url, followed: false, sourceScopeComplete: false}]
  scope.audit.closing = await snapshot('closing')
  scope.audit.closingComparison = 'public-header-and-declared-client-context-only'
  scope.audit.closingMatches = JSON.stringify(scope.audit.initial) === JSON.stringify(scope.audit.closing)
  if (scope.audit.possibleVacancyMarkup.length) throw scope.fail('public native role discovery requires a collector', {code: 'AADYAH_PUBLIC_NATIVE_ROLE_COLLECTOR_REQUIRED'})
  if (!scope.audit.closingMatches) throw scope.fail('closing native header or current declared client context changed', {code: 'AADYAH_CONTEXT_CHANGED_DURING_READ'})
})})
