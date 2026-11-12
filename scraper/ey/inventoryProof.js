import { createHash } from 'node:crypto'
import { parse } from 'acorn'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { readNativeWithSignal } from '../../scraper-support/utils/nativePagination.js'

const origin = 'https://careers.ey.com'
// Retained public options-search.min.js: the POST endpoint/model, facet fields
// and supported showPicklistAllLocales property were reviewed together.
const reviewedClientSha256 = 'eb3cdee25a3692f74f8fb599b59d6d5179dc16ef2ffc34b8069c385579d622ea'
const hash = body => createHash('sha256').update(String(body)).digest('hex')
const unverified = reason => ({ verified: false, reason })
export const isExecutableEyClassicScript = node => node.tag === 'script' && !Object.hasOwn(node.attrs, 'nomodule')
  && ['', 'text/javascript', 'application/javascript'].includes((node.attrs.type || '').trim().toLowerCase())
const memberPath = node => node?.type === 'Identifier' ? node.name
  : node?.type === 'MemberExpression' && !node.optional && !node.computed
    ? `${memberPath(node.object)}.${node.property.name}` : null
const emptyObject = node => node?.type === 'ObjectExpression' && node.properties.length === 0
const keepOrCreate = (node, target) => node?.type === 'LogicalExpression' && node.operator === '||'
  && memberPath(node.left) === target && emptyObject(node.right)
const assignment = (statement, target) => statement?.type === 'ExpressionStatement'
  && statement.expression.type === 'AssignmentExpression' && statement.expression.operator === '='
  && memberPath(statement.expression.left) === target ? statement.expression.right : null

// The retained native declaration is a complete, unconditional classic-script
// bootstrap. Parse its actual expressions; comments, strings and disabled or
// uncalled carriers cannot bind the options consumed by the reviewed client.
const boundOptions = tree => {
  try {
    if (tree.body.length !== 3) return null
    const [root, search, options] = tree.body
    const declaration = root.type === 'VariableDeclaration' && root.kind === 'var'
      && root.declarations.length === 1 ? root.declarations[0] : null
    if (declaration?.id.type !== 'Identifier' || declaration.id.name !== 'j2w'
      || !keepOrCreate(declaration.init, 'j2w')
      || !keepOrCreate(assignment(search, 'j2w.search'), 'j2w.search')) return null
    const value = assignment(options, 'j2w.search.options')
    if (value?.type !== 'ObjectExpression' || value.properties.length !== 3) return null
    const fields = new Map()
    for (const property of value.properties) {
      if (property.type !== 'Property' || property.kind !== 'init' || property.method
        || property.shorthand || property.computed) return null
      const name = property.key.type === 'Identifier' ? property.key.name : property.key.value
      if (fields.has(name)) return null
      fields.set(name, property.value)
    }
    const facets = fields.get('facets')
    const allLocales = fields.get('showPicklistAllLocales')
    if (fields.get('isOpen')?.type !== 'Literal' || fields.get('isOpen').value !== true
      || facets?.type !== 'ArrayExpression' || facets.elements.length !== 3
      || facets.elements.some((node, index) => node?.type !== 'Literal'
        || node.value !== ['customfield1', 'country', 'city'][index])
      || allLocales?.type !== 'Literal' || typeof allLocales.value !== 'boolean') return null
    return { nativeUiAllLocalesDefault: allLocales.value }
  } catch {
    return null
  }
}
const inspectOptionsScript = source => {
  try {
    const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'script' })
    const assignmentCount = node => {
      if (!node || typeof node !== 'object') return 0
      if (Array.isArray(node)) return node.reduce((count, child) => count + assignmentCount(child), 0)
      const own = node.type === 'AssignmentExpression' && memberPath(node.left) === 'j2w.search.options' ? 1 : 0
      return own + Object.values(node).reduce((count, child) => count + assignmentCount(child), 0)
    }
    return { assignments: assignmentCount(tree), options: boundOptions(tree) }
  } catch {
    // A syntactically invalid classic script does not execute a declaration.
    return { assignments: 0, options: null }
  }
}

const inspectPage = html => {
  try {
    const document = readNativeDocument(String(html))
    const roots = document.nodes(node => node.tag === 'html')
    if (roots.length !== 1 || roots[0].attrs.lang !== 'en-GB') return unverified('ey-native-locale-unverified')
    const country = document.nodes(node => node.tag === 'input' && node.attrs.name === 'optionsFacetsDD_country')
    if (country.length !== 1 || country[0].attrs.type !== 'hidden' || country[0].attrs.value !== 'IN') return unverified('ey-native-country-query-unverified')
    const scripts = document.nodes(node => isExecutableEyClassicScript(node) && !Object.hasOwn(node.attrs, 'src'))
      .map(node => inspectOptionsScript(node.raw || ''))
    const declarations = scripts.map(script => script.options).filter(Boolean)
    if (declarations.length !== 1 || scripts.reduce((count, script) => count + script.assignments, 0) !== 1) return unverified('ey-native-options-page-unverified')
    const clients = document.nodes(node => isExecutableEyClassicScript(node) && node.attrs.src).map(node => new URL(node.attrs.src, origin))
      .filter(url => url.pathname === '/platform/js/j2w/min/options-search.min.js')
    if (clients.length !== 1 || clients[0].origin !== origin || clients[0].username || clients[0].password || clients[0].hash) return unverified('ey-native-options-client-unverified')
    return { verified: true, locale: 'en_GB', country: 'IN', clientUrl: clients[0].href,
      nativeUiAllLocalesDefault: declarations[0].nativeUiAllLocalesDefault }
  } catch {
    return unverified('ey-native-options-page-unverified')
  }
}

export const createEyInventoryContract = ({ readText, signal }) => {
  let clientEverUnverified = false
  return { inspectPage,
    async readFacet(html) {
      const page = inspectPage(html)
      if (!page.verified) return page
      try {
        // Closing must observe bytes again even when the publisher keeps the
        // same asset URL. A later healthy read cannot erase an earlier failure.
        const client = await readNativeWithSignal(() => readText(page.clientUrl, { signal }), signal)
        const clientSha256 = hash(client)
        clientEverUnverified ||= clientSha256 !== reviewedClientSha256
        if (clientEverUnverified) return unverified('ey-native-options-client-unverified')
        const model = { page: 0, keywords: '', locationsearch: '', sortby: 'referencedate', sortdir: 'desc', sortfield: 'title',
          recordsperpage: 25, startrow: 0, facetquery: { facet: true, mincount: 1, limit: 5000,
            fields: ['customfield1', 'country', 'city'], sort: 'index', showPicklistAllLocales: true }, filterquery: {} }
        const endpoint = `${origin}/services/jobs/options/facetValues/`
        const body = await readNativeWithSignal(() => readText(endpoint, { signal, method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(model) }), signal)
        const countries = JSON.parse(body)?.facets?.map?.country
        const india = Array.isArray(countries) ? countries.filter(row => row?.name === 'IN') : []
        if (india.length !== 1 || india[0].translated !== 'India' || !Number.isInteger(india[0].count) || india[0].count < 0) return unverified('ey-native-india-facet-missing')
        return { ...page, endpoint, model, clientSha256, responseSha256: hash(body), count: india[0].count }
      } catch {
        signal?.throwIfAborted()
        return unverified('ey-native-india-facet-unreadable')
      }
    },
  }
}
