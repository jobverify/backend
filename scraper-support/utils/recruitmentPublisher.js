const values = value => Array.isArray(value) ? value : [value]
export const recruitmentSchemaContext = value => typeof value === 'string' && /^https?:\/\/schema\.org\/?$/.test(value)
  || value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 1
    && typeof value['@vocab'] === 'string' && /^https?:\/\/schema\.org\/?$/.test(value['@vocab'])
const typeIs = (node, type) => values(node['@type']).some(value => value === type
  || value === 'https://schema.org/' + type || value === 'http://schema.org/' + type)
const selfRoot = (value, page, { identity = false } = {}) => {
  if (typeof value !== 'string') return null
  let url
  try { url = new URL(value) } catch { return null }
  return url.protocol === 'https:' && !url.username && !url.password && !url.port
    && url.hostname.replace(/^www\./, '') === page.hostname.replace(/^www\./, '')
    && url.pathname === '/' && !url.search && (identity || !url.hash) ? url : null
}

// These are publisher identities, never vacancy or work-country evidence.
// Only the current document's own Organization and publisher declarations may
// supply names; a customer's profile or a JobPosting's hiringOrganization may not.
export function structuredRecruitmentPublisherState(document, pageURL) {
  const page = new URL(pageURL), candidates = [], conflicts = new Set(), identities = new Map()
  let visited = 0, complete = true
  const visit = (node, inheritedContext = false, depth = 0) => {
    if (!node || typeof node !== 'object') return
    if (depth > 12 || ++visited > 5000) { complete = false; return }
    if (Array.isArray(node)) {
      if (node.length > 2000) { complete = false; return }
      for (const item of node) visit(item, inheritedContext, depth + 1)
      return
    }
    const context = Object.hasOwn(node, '@context') ? recruitmentSchemaContext(node['@context']) : inheritedContext
    if (!context) return
    if (typeIs(node, 'Organization') || typeIs(node, 'Corporation')) {
      const url = selfRoot(node.url, page), identity = node['@id'] == null ? url : selfRoot(node['@id'], page, { identity: true })
      if (url && identity) {
        const key = identity.href, signature = JSON.stringify(node)
        if (identities.has(key) && identities.get(key) !== signature) conflicts.add(key)
        identities.set(key, signature)
        const names = ['name', 'legalName', 'alternateName'].flatMap(field => values(node[field]).slice(0, 32)
          .filter(value => typeof value === 'string' && value.trim() && value.length <= 500)
          .map(value => ({ field, name: value.trim() })))
        if (names.length) candidates.push({ identity: key, url: url.href, names })
      }
    }
    visit(node['@graph'], context, depth + 1)
    if (typeIs(node, 'WebSite') || typeIs(node, 'WebPage')) visit(node.publisher, context, depth + 1)
  }
  for (const node of document.nodes(node => node.tag === 'script' && !node.attrs.src
    && node.attrs.type === 'application/ld+json')) {
    try { visit(JSON.parse(node.raw || '')) } catch { /* Malformed schema cannot establish identity. */ }
  }
  return { complete, conflictingIdentities: [...conflicts],
    publishers: complete ? candidates.filter(candidate => !conflicts.has(candidate.identity)) : [] }
}

export const structuredRecruitmentPublishers = (document, pageURL) => structuredRecruitmentPublisherState(document, pageURL).publishers
