import { createHash } from 'node:crypto'
import { readNativeDocument, readNativeAttributeTokens, decodeNativeEntities } from '../../scraper-support/utils/activeNativeHtml.js'
import { readLiteralModel } from '../../scraper-support/native-sources/literalModel.js'
import { readEightfoldLocationScope } from '../../scraper-support/apiPortal/eightfoldLocations.js'

const ORIGIN = 'https://www.lifesigns.us'
const ROOT = ORIGIN + '/'
const unknown = () => ({ country: null, location: null, city: null, state: null, nativeGeographyQualified: false })
const check = (ok, reason) => { if (!ok) throw Error(reason) }
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const keys = (value, expected) => object(value) && Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key))
const same = (value, expected) => {
  if (value === expected) return true
  if (Array.isArray(expected)) return Array.isArray(value) && value.length === expected.length && value.every((x, i) => same(x, expected[i]))
  return object(expected) && keys(value, Object.keys(expected)) && Object.entries(expected).every(([key, x]) => same(value[key], x))
}
const semantic = /^(?:itemprop|itemscope|itemtype|itemid|(?:data-)?(?:country|location|workplace|worksite|employer|hiring|job|address|geo))/i
// Recognize unreviewed country/workplace carrier NAMES after data-* qualifiers.
// Attribute values are never parsed into countries or used as geography.
const dataSemanticToken = /(?:^|[-_:.])(?:[a-z0-9]*country(?:code)?|(?:work(?:place|site|location)|job(?:location)?|location|address|employer|hiring(?:organization)?|geo(?:graphy)?)(?:country(?:code)?)?)(?:$|[-_:.])/i
const semanticAttribute = key => semantic.test(key) || /^data-/i.test(key) && dataSemanticToken.test(key.slice(5))
const sourceScripts = new Set(['0s2cptn1mmf6r','355awi69x9l93','2fxe7h6n_rtg2','turbopack-3-ry682tkyiqk','0umf92h1sb77c','0jbvc0l0-ur0q','39srg_qi3fe_b','3h0-eekwy_o5e','1vkf7rl46uegy','02y3b__13b24e','27qljlrbrvxg7','1e_9pndw1ctb4','0cz1d0mv5g_q7','05wjci380js-5'].map(name => '/_next/static/chunks/' + name + '.js'))

// Raw attribute tokens are paired with the structural tree below. The scanner
// skips comments and raw element bodies, so JSON/RSC string copies never become
// extra HTML declarations. It does not execute, normalize or interpret programs.
const rawAttributes = html => {
  const byTag = new Map(), raw = new Set(['script','style','textarea','title','xmp','iframe','noembed','noframes','plaintext','noscript'])
  let at = 0
  while ((at = html.indexOf('<', at)) !== -1) {
    if (html.startsWith('<!--', at)) { const end = html.indexOf('-->', at + 4); at = end < 0 ? html.length : end + 3; continue }
    if (html.startsWith('<!', at) || html.startsWith('<?', at) || html.startsWith('</', at)) { const end = html.indexOf('>', at + 2); at = end < 0 ? html.length : end + 1; continue }
    const match = /^[a-z][a-z0-9:_-]*/i.exec(html.slice(at + 1))
    if (!match) { at++; continue }
    const tag = match[0].toLowerCase(), first = at + 1 + match[0].length
    let end = first, quote = null
    for (; end < html.length; end++) {
      const char = html[end]
      if (quote) { if (char === quote) quote = null }
      else if (char === '"' || char === "'") quote = char
      else if (char === '>') break
    }
    check(end < html.length, 'unterminated-native-tag')
    const tokens = readNativeAttributeTokens(html.slice(first, end))
    if (!byTag.has(tag)) byTag.set(tag, [])
    byTag.get(tag).push(tokens)
    at = end + 1
    if (raw.has(tag)) {
      const close = new RegExp('</' + tag + '[\\t\\n\\f\\r ]*>', 'ig'); close.lastIndex = at
      const found = close.exec(html); at = found ? close.lastIndex : html.length
    }
  }
  return byTag
}

// Missing HTML is an existing injected snapshot API, not country authority.
// In that legacy case the caller keeps its prior explicit feed-country policy.
export const readLifeSignsNativeRoleCountry = (snapshot, item, expectedURL, feedGeography) => {
  if (!Object.hasOwn(snapshot || {}, 'html')) return null
  const html = typeof snapshot.html === 'string' ? snapshot.html : ''
  const evidence = {
    status: 'held', issues: [],
    snapshot: { ...structuredClone(snapshot), html, bodyBytes: Buffer.byteLength(html), bodySHA256: createHash('sha256').update(html).digest('hex') },
    feedItem: structuredClone(item), jsonLDDeclarations: [], schemas: [], jobPosting: null, organization: null,
    fullCriteriaAuthority: 'OpenRoles.data.body', schemaDescriptionIsTitleOnly: null, legalEmployerVerified: false,
    authority: 'Same-role JobPosting singleton Place.address/PostalAddress.addressCountry IN only; organization contacts/offices, city labels, legalName and unexecuted hydration programs never supply vacancy geography.',
    limits: { countryOnly: true, browserRuntimeVerified: false, roleHTMLFullCriteriaVerified: false, activeOrClosingVerified: false, legalEmployerVerified: false, companyScopeComplete: false, lifecycleCleanupAllowed: false },
  }
  const held = () => ({ ...unknown(), sourceNativeRoleCountryEvidence: evidence })
  try {
    check(typeof snapshot.html === 'string' && html.length > 0 && Buffer.byteLength(html) <= 1000000, 'missing-or-unreviewed-role-html')
    const target = new URL(expectedURL)
    check(target.origin === ORIGIN && !target.username && !target.password && !target.port && !target.search && !target.hash && expectedURL === ORIGIN + '/careers/' + item.data.slug + '/', 'unreviewed-expected-role-url')
    check(snapshot.status === 200 && snapshot.url === expectedURL && /^text\/html(?:;|$)/i.test(snapshot.contentType || ''), 'role-response-identity-or-media-unreviewed')
    const document = readNativeDocument(html), root = document.nodes(node => node.tag === 'root')[0]
    const nodes = []
    const visit = (node, parents) => { nodes.push({ node, parents }); for (const child of node.children || []) if (typeof child !== 'string') visit(child, [...parents, node.tag]) }
    visit(root, [])
    const attributes = rawAttributes(html), positions = new Map()
    for (const { node } of nodes) {
      if (node.tag === 'root') continue
      const index = positions.get(node.tag) || 0, tokens = attributes.get(node.tag)?.[index]
      positions.set(node.tag, index + 1)
      check(tokens, 'unreviewed-native-attribute-boundary')
      if (['script','link','meta','base'].includes(node.tag) || tokens.some(([key]) => semanticAttribute(key))) {
        check(new Set(tokens.map(([key]) => key)).size === tokens.length, 'duplicate-semantic-native-attribute')
      }
      check(!Object.keys(node.attrs).some(key => semanticAttribute(key)), 'unreviewed-html-role-semantic-carrier')
      check(node.tag !== 'base', 'unreviewed-document-base')
    }
    const context = row => row.parents.filter(tag => tag !== 'root')
    const canonical = nodes.filter(({ node }) => node.tag === 'link' && (node.attrs.rel || '').split(/\s+/).includes('canonical'))
    check(canonical.length === 1 && !canonical[0].node.inert && same(context(canonical[0]), ['html','head']), 'canonical-missing-duplicate-inert-or-context')
    check(same(canonical[0].node.attrs, { rel: 'canonical', href: expectedURL }), 'canonical-role-identity-or-attributes')
    for (const { node } of nodes.filter(row => row.node.tag === 'link' && row.node.attrs.rel !== 'canonical')) {
      const attrs = node.attrs
      check(['preload','stylesheet','icon'].includes(attrs.rel) && Object.keys(attrs).every(key => ['rel','href','as','fetchpriority','type','crossorigin','data-precedence','sizes'].includes(key)), 'unreviewed-link-role-authority')
      const link = new URL(attrs.href, ROOT)
      check(!link.username && !link.password && (link.origin === ORIGIN || link.href === 'https://www.googletagmanager.com/gtag/js?id=G-1XSGH5RX7R'), 'unreviewed-link-origin')
    }
    const titles = nodes.filter(row => row.node.tag === 'title' && same(context(row), ['html','head']))
    check(titles.length === 1 && !titles[0].node.inert && decodeNativeEntities(titles[0].node.raw || '').trim() === item.data.title, 'head-role-title-ambiguous')
    for (const { node } of nodes.filter(row => row.node.tag === 'meta')) {
      const attrs = node.attrs
      if (keys(attrs, ['charset'])) { check(attrs.charset.toLowerCase() === 'utf-8', 'unreviewed-charset'); continue }
      check(keys(attrs, ['name','content']) || keys(attrs, ['property','content']), 'unreviewed-meta-attributes')
      const name = attrs.name || attrs.property
      check(['viewport','robots','description','og:title','og:description','twitter:card','twitter:title','twitter:description'].includes(name), 'unreviewed-meta-carrier')
      if (['description','og:title','og:description','twitter:title','twitter:description'].includes(name)) check(attrs.content === item.data.title, 'conflicting-head-role-metadata')
    }
    const scripts = nodes.filter(row => row.node.tag === 'script')
    const jsonLD = scripts.filter(row => row.node.attrs.type === 'application/ld+json')
    check(jsonLD.length === 2, 'jsonld-declaration-count-unreviewed')
    for (const row of jsonLD) {
      evidence.jsonLDDeclarations.push({ attrs: structuredClone(row.node.attrs), parents: context(row), inert: !!row.node.inert, raw: row.node.raw || '' })
      check(!row.node.inert && same(context(row), ['html','body']) && same(row.node.attrs, { type: 'application/ld+json' }), 'jsonld-attributes-or-inert-context')
      check((row.node.raw || '').length <= 128000, 'jsonld-byte-bound')
      readLiteralModel(row.node.raw) // Reject duplicate decoded keys before JSON.parse can drop them.
      const schema = JSON.parse(row.node.raw)
      evidence.schemas.push(schema)
      check(keys(schema, ['@context','@graph']) && schema['@context'] === 'https://schema.org' && Array.isArray(schema['@graph']), 'unreviewed-jsonld-envelope')
    }
    // These are declarations/context only, never evaluated country authority.
    const external = scripts.filter(row => row.node.attrs.src)
    check(external.length === sourceScripts.size && new Set(external.map(row => row.node.attrs.src)).size === sourceScripts.size, 'unreviewed-program-declaration-count')
    for (const { node } of external) check(sourceScripts.has(node.attrs.src) && !node.inert
      && (keys(node.attrs, ['src','async']) && node.attrs.async === '' || keys(node.attrs, ['src','nomodule']) && node.attrs.nomodule === ''), 'unreviewed-program-declaration')
    const inline = scripts.filter(row => !row.node.attrs.src && row.node.attrs.type !== 'application/ld+json')
    check(inline.length === 3 && inline.every(row => !row.node.inert), 'unreviewed-inline-context-count')
    check(inline.filter(row => same(row.node.attrs, { id: '_R_' }) && (row.node.raw || '').startsWith('(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push(')).length === 1, 'unreviewed-inline-bootstrap-context')
    check(inline.filter(row => keys(row.node.attrs, []) && row.node.raw === '(self.__next_f=self.__next_f||[]).push([0])').length === 1, 'unreviewed-hydration-initial-context')
    check(inline.filter(row => keys(row.node.attrs, []) && (row.node.raw || '').startsWith('self.__next_f.push([1,"')).length === 1, 'unreviewed-hydration-string-context')
    const graph = evidence.schemas.flatMap(schema => schema['@graph'])
    check(graph.length === 5 && graph.every(object), 'unreviewed-graph-node-count')
    check(new Set(graph.map(node => node['@id'])).size === graph.length, 'duplicate-or-missing-graph-identity')
    const byType = type => graph.filter(node => node['@type'] === type)
    check(['WebSite','Organization','JobPosting','WebPage','BreadcrumbList'].every(type => byType(type).length === 1), 'duplicate-or-unknown-graph-subject')
    let nestedJobs = 0
    const census = value => { if (Array.isArray(value)) { value.forEach(census); return }; if (!object(value)) return; if (value['@type'] === 'JobPosting') nestedJobs++; Object.values(value).forEach(census) }
    evidence.schemas.forEach(census)
    check(nestedJobs === 1, 'nested-role-declaration-ambiguous')
    const job = byType('JobPosting')[0], organization = byType('Organization')[0]
    evidence.jobPosting = job; evidence.organization = organization
    check(organization['@type'] === 'Organization' && organization['@id'] === ROOT + '#organization'
      && organization.url === ROOT && organization.name === 'Lifesigns', 'referenced-organization-identity')
    // Other organization leaf metadata stays raw context, never a role office,
    // employing legal entity assertion, alias, or country qualification rule.
    check(same(byType('WebSite')[0], { '@type': 'WebSite', '@id': ROOT + '#website', url: ROOT, name: 'Lifesigns', publisher: { '@id': ROOT + '#organization' } }), 'website-context-identity')
    check(same(byType('WebPage')[0], { '@type': 'WebPage', '@id': expectedURL + '#webpage', url: expectedURL, name: item.data.title,
      description: item.data.title, isPartOf: { '@id': ROOT + '#website' }, about: { '@id': expectedURL + '#job' } }), 'webpage-role-context')
    check(same(byType('BreadcrumbList')[0], { '@type': 'BreadcrumbList', '@id': expectedURL + '#breadcrumb', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: ROOT },
      { '@type': 'ListItem', position: 2, name: 'Careers', item: ROOT + 'careers/' },
      { '@type': 'ListItem', position: 3, name: item.data.title, item: expectedURL },
    ] }), 'breadcrumb-role-context')
    check(keys(job, ['@type','@id','title','description','url','hiringOrganization','employmentType','jobLocation']), 'unreviewed-role-owned-fields')
    check(job['@type'] === 'JobPosting' && job['@id'] === expectedURL + '#job' && job.url === expectedURL
      && job.title === item.data.title && job.description === item.data.title && job.employmentType === item.data.employmentType, 'role-identity-title-employment-or-description')
    check(same(job.hiringOrganization, { '@id': ROOT + '#organization' }), 'unreviewed-role-owned-employer-reference')
    check(same(job.jobLocation, { '@type': 'Place', address: { '@type': 'PostalAddress', addressCountry: 'IN' } }), 'missing-conflicting-or-unreviewed-role-country')
    check(keys(item, ['id','dataCollectionId','data']) && item.dataCollectionId === 'OpenRoles' && item.id === item.data._id, 'feed-role-identity')
    const feedFields = new Set(['employmentType','body','_publishDate','location','_id','_draftDate','_owner','_createdDate','_updatedDate','slug','_publishStatus','title'])
    check(Object.keys(item.data).every(key => feedFields.has(key)), 'unreviewed-feed-owned-field')
    const semanticFeed = value => {
      if (Array.isArray(value)) return value.some(semanticFeed)
      if (!object(value)) return false
      return Object.entries(value).some(([key, child]) => /(?:country|location|workplace|worksite|hiring|employer|address|geography)/i.test(key) || semanticFeed(child))
    }
    check(!semanticFeed(item.data.body), 'unreviewed-nested-feed-authority-carrier')
    check(typeof item.data.location === 'string' && !/[;/|]|\b(?:and|or|global|worldwide|multiple|anywhere)\b/i.test(item.data.location)
      && !item.data.location.split(',').some(component => !component.trim()), 'ambiguous-feed-location')
    for (const component of item.data.location.split(',')) {
      const observed = readEightfoldLocationScope({ locations: [component.trim()] })
      check(observed.unresolved || !observed.country || observed.country === 'India', 'feed-explicit-country-disagreement')
    }
    check(!feedGeography.country || feedGeography.country === 'India', 'feed-role-country-disagreement')
    evidence.status = 'country-only-qualified'; evidence.schemaDescriptionIsTitleOnly = true
    return { ...unknown(), country: 'India', nativeGeographyQualified: true, sourceNativeRoleCountryEvidence: evidence }
  } catch (error) {
    evidence.issues.push(typeof error?.message === 'string' ? error.message.slice(0, 180) : 'unreviewed-native-role-country')
    return held()
  }
}
