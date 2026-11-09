import { readNativeDocument, extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
const norm = value => String(value || '').replace(/\s+/g, ' ').trim()
const hasClass = (node, value) => (node.attrs.class || '').split(/\s+/).includes(value)
const fail = message => Object.assign(new Error('Josh Technology Group native ' + message), { abortRetries: true, incompleteScope: true })
const blocks = (document, root) => root ? root.children.filter(node => typeof node !== 'string'
  && !['a', 'button', 'form', 'input', 'script'].includes(node.tag)).map(node => ({ node, text: document.text(node) })).filter(block => block.text) : []
const labelValue = (items, labels) => {
  for (const { text } of items) for (const label of labels) {
    const match = text.match(new RegExp('^' + label + '\\s*:\\s*(.*)$', 'i'))
    if (!match) continue
    const index = items.findIndex(item => item.text === text)
    return norm(match[1] || items[index + 1]?.text).replace(/^[•●-]+\s*/, '') || null
  }
  return null
}
const header = (document, { node, text }) => /^h[1-6]$/.test(node.tag)
  || node.children.filter(child => typeof child !== 'string' && child.tag === 'strong')
    .map(child => document.text(child)).join(' ').trim() === text
const criteria = (document, items) => {
  const values = []
  let inside = false
  for (const item of items) {
    if (header(document, item)) {
      inside = /(?:responsibilit|resposibilit|job description)/i.test(item.text)
      continue
    }
    if (inside) values.push(item.text)
  }
  return Boolean(extractActiveDescription(values.join('\n')))
}
const scoped = (document, name) => document.nodes(node => hasClass(node, name))
const sameUrl = (value, expected) => {
  try {
    const url = new URL(value)
    return url.origin === 'https://www.joshtechnologygroup.com' && !url.username && !url.password
      && !url.hash && !url.search && /^\/careers\/[^/]+\/$/.test(url.pathname) && url.href === expected
  } catch { return false }
}

export const readJoshNativeRoleFields = (html, listing) => {
  const raw = readNativeDocument(html), visible = readVisibleNativeDocument(html, { strict: true })
  const titleNodes = visible.nodes(node => node.tag === 'span' && hasClass(node, 'career-list__title'))
  // The native hero and application modal repeat the same title. Every
  // supplied copy must agree with this exact listing; none may overwrite it.
  if (!titleNodes.length || titleNodes.some(node => norm(visible.text(node)) !== norm(listing.title))
    || !sameUrl(listing.sourceUrl, listing.sourceUrl)
    || listing.applyUrl != null && !sameUrl(listing.applyUrl, listing.sourceUrl)) throw fail('role title/application URL identity mismatch')
  const canonical = raw.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical').map(node => node.attrs.href)
  const applications = raw.nodes(node => node.tag === 'input' && node.attrs.name === 'career-link').map(node => node.attrs.value)
  const publicUrls = raw.nodes(node => node.tag === 'meta' && node.attrs.property === 'og:url').map(node => node.attrs.content)
  if (canonical.length !== 1 || applications.length !== 1
    || [...canonical, ...applications, ...publicUrls].some(value => !sameUrl(value, listing.sourceUrl))) throw fail('canonical/native application role URL identity mismatch')
  const rawBodies = scoped(raw, 'career-list__openings'), visibleBodies = scoped(visible, 'career-list__openings')
  if (rawBodies.length !== 1 || visibleBodies.length > 1) throw fail('role detail body identity unavailable')
  const rawBlocks = blocks(raw, rawBodies[0]), visibleBlocks = blocks(visible, visibleBodies[0])
  const introductions = scoped(raw, 'career-list__content').map(node => raw.text(node)).filter(Boolean)
  const rawDescription = [...introductions, ...rawBlocks.map(block => block.text)].join('\n') || null
  const visibleIntroductions = scoped(visible, 'career-list__content').map(node => visible.text(node)).filter(Boolean)
  const description = [...visibleIntroductions, ...visibleBlocks.map(block => block.text)].join('\n') || null
  return { title: visible.text(titleNodes[0]), sourceUrl: canonical[0], applyUrl: applications[0],
    location: labelValue(visibleBlocks, ['Work Location']), city: null, country: null,
    experienceRequired: labelValue(visibleBlocks, ['Required Experience', 'Experience']),
    minimumQualification: labelValue(visibleBlocks, ['Qualifications', 'Required Qualifications']),
    jobDescription: description, sourceDetailComplete: criteria(visible, visibleBlocks),
    rawNativeRoleEvidence: { contentJobDescription: rawDescription },
    publicExperienceChecked: criteria(visible, visibleBlocks),
    ...(!criteria(visible, visibleBlocks) ? { sourceDetailFailureKind: 'missing-content' } : {}) }
}
