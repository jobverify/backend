const marker = '%LABEL_NO_POSITIONS%'
const selector = '.positions-container > .no-positions-container > h2.polygot'
const companyKey = value => typeof value === 'string'
  ? value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '') : ''
const https = value => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.port ? url : null
  } catch { return null }
}
const breezyRoot = value => {
  const url = https(value)
  return url && /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.breezy\.hr$/i.test(url.hostname)
    && !/^(?:www|api|assets-cdn)\.breezy\.hr$/i.test(url.hostname)
    && url.href === url.origin + '/' ? url : null
}
const children = node => node.children.filter(child => typeof child !== 'string' && !child.inert)
const onlyChild = (parent, child) => {
  const elements = children(parent)
  return elements.length === 1 && elements[0] === child
    && parent.children.every(value => typeof value !== 'string' || !value.trim())
}
const conditional = node => {
  const classes = (node.attrs.class || '').split(/\s+/)
  if (classes.some(value => /^(?:hidden|hide|d-none|invisible|ng-hide|ng-cloak|sr-only|visually-hidden)$/i.test(value))) return true
  return Object.keys(node.attrs).some(attribute => {
    const name = attribute.replace(/^(?:data-|x-)/, '').replace(/[:_]/g, '-')
    return /^ng-(?:if|show|hide|repeat|switch(?:-.+)?|class|style|bind(?:-.+)?|include|transclude)$/.test(name)
      || /^v-(?:if|else(?:-if)?|show|for|html|text|bind(?:-.+)?)$/.test(name)
      || /^th-(?:if|unless|each|switch|case)$/.test(name)
      || /^[:@]/.test(attribute)
  })
}
const unconditionalPath = (root, target) => {
  const visit = (node, uncertain) => {
    const next = uncertain || node.inert || conditional(node)
    if (node === target) return !next
    for (const child of node.children) if (typeof child !== 'string') {
      const found = visit(child, next)
      if (found !== null) return found
    }
    return null
  }
  return visit(root, false) === true
}
const structuredRole = document => {
  const visit = (value, depth = 0) => {
    if (!value || typeof value !== 'object' || depth > 12) return false
    if (Array.isArray(value)) return value.slice(0, 2000).some(item => visit(item, depth + 1))
    const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']]
    if (types.some(type => type === 'JobPosting' || type === 'https://schema.org/JobPosting')) return true
    return Object.values(value).some(item => visit(item, depth + 1))
  }
  for (const node of document.nodes(node => node.tag === 'script' && /^application\/ld\+json$/i.test(node.attrs.type || ''))) {
    try { if (visit(JSON.parse(node.raw || ''))) return true } catch { return true }
  }
  return false
}

// This reads one observed native document contract. It does not count vacancies,
// translate the publisher token, evaluate publisher programs/CSS, or authorize
// any source-wide conclusion. Identity and current handoff are both required.
export function readBreezyEmptyState(document, pageURL, {
  companyName, publisherNames = [], officialHomepageUrl, bindingEvidence,
} = {}) {
  const page = breezyRoot(pageURL), home = https(officialHomepageUrl)
  if (!page || !home || /(?:^|\.)breezy\.hr$/i.test(home.hostname)
    || !document || typeof document.nodes !== 'function' || typeof document.text !== 'function') return null
  const corporateHost = home.hostname.replace(/^www\./, '')
  const official = https(bindingEvidence?.officialURL)
  if (!bindingEvidence || bindingEvidence.verified !== true
    || bindingEvidence.bindingMethod !== 'runtime-current-careers-link'
    || !official || !(official.hostname === corporateHost || official.hostname.endsWith('.' + corporateHost))
    || !Array.isArray(bindingEvidence.matchedLinks)
    || !bindingEvidence.matchedLinks.some(value => breezyRoot(value)?.href === page.href)) return null

  const roots = document.nodes(node => node.tag === 'root')
  const heads = document.nodes(node => node.tag === 'head')
  const bodies = document.nodes(node => node.tag === 'body')
  if (roots.length !== 1 || heads.length !== 1 || bodies.length !== 1
    || !document.hasClass(bodies[0], 'breezy-portal')) return null
  const root = roots[0], head = heads[0], body = bodies[0]
  const canonicals = document.nodes(node => node.tag === 'link' && (node.attrs.rel || '').split(/\s+/i).includes('canonical'))
  const publishers = document.nodes(node => node.tag === 'meta' && node.attrs.name === 'breezy-doc-title')
  if (canonicals.length !== 1 || publishers.length !== 1
    || !document.nodes(node => node === canonicals[0], head).length
    || !document.nodes(node => node === publishers[0], head).length
    || breezyRoot(canonicals[0].attrs.href)?.href !== page.href) return null
  const publisher = publishers[0].attrs.content || ''
  const expected = [companyName, ...(Array.isArray(publisherNames) ? publisherNames : [])].map(companyKey).filter(value => value.length >= 2)
  if (!expected.includes(companyKey(publisher))) return null

  const companyContainers = document.nodes(node => node.tag === 'li' && document.hasClass(node, 'company'), body)
  if (companyContainers.length !== 1) return null
  const companyLinks = document.nodes(node => node.tag === 'a' && node.attrs.href, companyContainers[0])
  if (companyLinks.length !== 1) return null
  const companyURL = https(companyLinks[0].attrs.href)
  if (!companyURL || companyURL.hostname.replace(/^www\./, '') !== corporateHost
    || companyURL.href !== companyURL.origin + '/') return null

  const listings = document.nodes(node => document.hasClass(node, 'positions-container'), body)
  const empty = document.nodes(node => document.hasClass(node, 'no-positions-container'), body)
  const headings = document.nodes(node => node.tag === 'h2' && document.hasClass(node, 'polygot') && document.text(node) === marker, body)
  if (listings.length !== 1 || empty.length !== 1 || headings.length !== 1
    || !onlyChild(listings[0], empty[0]) || !onlyChild(empty[0], headings[0])
    || children(headings[0]).length) return null
  if (![headings[0], canonicals[0], publishers[0], companyLinks[0]].every(node => unconditionalPath(root, node))) return null

  const roleLinks = document.nodes(node => node.tag === 'a' && node.attrs.href, body).filter(node => {
    try {
      const url = new URL(node.attrs.href, page)
      return /(?:^|\.)breezy\.hr$/i.test(url.hostname) && /^\/p(?:\/|$)/i.test(decodeURIComponent(url.pathname))
    } catch { return true }
  })
  if (roleLinks.length || structuredRole(document)) return null

  return {
    kind: 'breezy', surface: page.href, reportedTotal: null, boardEmptyStateObserved: true,
    observedRoleLinks: 0, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
    evidence: {
      type: 'native-empty-state-token', marker, selector, translationResolved: false,
      publisher, canonicalURL: page.href, companyURL: companyURL.href,
      bindingEvidence: { ...bindingEvidence, matchedLinks: [...bindingEvidence.matchedLinks] },
    },
  }
}
