import { readNativeDocument, decodeNativeEntities, extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
const norm = value => String(value || '').replace(/\s+/g, ' ').trim()
const fail = message => Object.assign(new Error('Farm To Plate native ' + message), { abortRetries: true, incompleteScope: true })
const children = node => node.children.filter(child => typeof child !== 'string')
const descendants = (node, predicate) => node ? [...(predicate(node) ? [node] : []), ...children(node).flatMap(child => descendants(child, predicate))] : []
// Native SVG self-closing elements are leaves in the browser. Expand their
// closing syntax for the existing small tree reader, preserving every element,
// attribute, style and ancestor/sibling relationship; no graphics are removed.
export const prepareFarmMarkup = html => String(html).replace(/<svg\b[^>]*>[\s\S]*?<\/svg\s*>/gi, svg =>
  svg.replace(/<([a-z][\w:-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)\/>/gi, (_whole, tag, attrs) => '<' + tag + attrs + '></' + tag + '>'))
const documentFor = html => readVisibleNativeDocument(prepareFarmMarkup(html), { strict: true })
export const farmVisibleText = html => { const document = documentFor(html); return document.nodes(node => node.tag === 'root').map(node => document.text(node)).join(' ') }
export const visibleFarmCareersHandoff = html => {
  const document = documentFor(html)
  return document.nodes(node => node.tag === 'a' && /^Careers(?:\s|$)/i.test(document.text(node))).some(node => {
    try { return new URL(node.attrs.href, 'https://www.farmtoplate.io/').href.replace(/\/$/, '')
      === 'https://www.farmtoplate.io/about-us/careers-and-joining-the-team' } catch { return false }
  })
}
export const readFarmOpeningEvidence = html => {
  const document = documentFor(html)
  const visibleUrls = new Set(document.nodes(node => node.tag === 'a' && /^View Details$/i.test(document.text(node)))
    .map(node => { try { const url = new URL(node.attrs.href, 'https://www.farmtoplate.io/'); if (!url.pathname.endsWith('/')) url.pathname += '/'; return url.href } catch { return null } }).filter(Boolean))
  const headerLinks = new Map(document.nodes(node => node.tag === 'h2' && /^Position:/i.test(document.text(node)))
    .map(node => [document.text(node).replace(/^Position:\s*/i, '').replace(/\s+Vacancy:\s*\d+\s*$/i, ''),
      descendants(node, child => child.tag === 'a').map(child => child.attrs.href)]))
  return { visibleUrls, headerLinks }
}
const linesOf = node => {
  const render = current => {
    if (typeof current === 'string') return decodeNativeEntities(current)
    if (current.inert || ['script', 'style', 'a', 'button', 'form'].includes(current.tag)) return ''
    if (current.tag === 'br') return '\n'
    const block = /^(?:p|div|section|article|h[1-6]|li|ul|ol)$/.test(current.tag)
    return (block ? '\n' : '') + current.children.map(render).join(' ') + (block ? '\n' : '')
  }
  return node ? render(node).split(/\r?\n/).map(norm).filter(Boolean) : []
}
const contains = (root, node) => root && (root === node || children(root).some(child => contains(child, node)))
const exactRoleUrl = (value, expected) => {
  try { const url = new URL(value); return url.origin === 'https://www.farmtoplate.io' && !url.username && !url.password && !url.search && !url.hash && url.href === expected } catch { return false }
}
export const readFarmNativeRole = ({ html, title, detailUrl }) => {
  const markup = prepareFarmMarkup(html), raw = readNativeDocument(markup), visible = readVisibleNativeDocument(markup, { strict: true })
  if (!exactRoleUrl(detailUrl, detailUrl)) throw fail('role URL ownership mismatch')
  const canonical = raw.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical').map(node => node.attrs.href)
  const publicUrls = raw.nodes(node => node.tag === 'meta' && node.attrs.property === 'og:url').map(node => node.attrs.content)
  if ([...canonical, ...publicUrls].some(value => !exactRoleUrl(value, detailUrl))) throw fail('canonical role URL identity mismatch')
  const rawBodies = raw.nodes(node => node.tag === 'main'), visibleBodies = visible.nodes(node => node.tag === 'main')
  if (rawBodies.length > 1 || visibleBodies.length > 1) throw fail('role content identity ambiguous')
  const rawMain = rawBodies[0], visibleMain = visibleBodies[0]
  const pageTitles = raw.nodes(node => node.tag === 'h1' && !contains(rawMain, node)).map(node => raw.text(node))
  const visiblePageTitles = visible.nodes(node => node.tag === 'h1' && !contains(visibleMain, node)).map(node => visible.text(node))
  const lines = linesOf(rawMain), content = lines.join('\n') || null
  const contentTitles = lines.flatMap(line => line.match(/^Job Title\s*:\s*(.+)$/i)?.[1] || [])
  const identityQualified = canonical.length === 1 && publicUrls.length === 1 && pageTitles.length === 1
    && visiblePageTitles.length === 1 && [...pageTitles, ...visiblePageTitles, ...contentTitles].every(value => norm(value) === norm(title))
  const applications = descendants(rawMain, node => node.tag === 'a' && /^Submit your CV here$/i.test(raw.text(node)))
  if (applications.length > 1) throw fail('application URL identity ambiguous')
  const nativeApply = applications[0]?.attrs.href || null
  if (nativeApply && !/^mailto:[^@?\s]+@farmtoplate\.io(?:\?[^\s]*)?$/i.test(nativeApply)) throw fail('application URL ownership mismatch')
  const visibleApply = descendants(visibleMain, node => node.tag === 'a' && /^Submit your CV here$/i.test(visible.text(node)))
  const applyUrl = nativeApply && visibleApply.length === 1 && visibleApply[0].attrs.href === nativeApply ? nativeApply : null
  const visibleLines = linesOf(visibleMain), visibleContent = visibleLines.join('\n')
  const criteria = descendants(visibleMain, node => node.tag === 'ul').some(node => Boolean(extractActiveDescription(visible.text(node))))
  const complete = identityQualified && Boolean(applyUrl) && criteria && Boolean(extractActiveDescription(visibleContent))
  return { jobDescription: complete ? visibleContent : null, applyUrl, lines: visibleLines,
    sourceDetailComplete: complete, publicExperienceChecked: complete,
    ...(!complete ? { sourceDetailFailureKind: identityQualified ? 'missing-content' : 'identity-mismatch' } : {}),
    rawNativeRoleEvidence: { listingTitle: title, pageTitle: pageTitles[0] || null, contentJobTitle: contentTitles[0] || pageTitles[0] || null,
      canonicalUrls: canonical, contentJobDescription: content, identityQualified, activeNativeFieldsQualified: Boolean(visibleMain),
      applicationUrl: nativeApply, applicationSubmissionQualified: false } }
}
