import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'

const URL = 'https://www.autopi.io/careers/'
const descendants = (node, predicate) => !node || typeof node === 'string' || node.inert && !node.activeFrame ? []
  : [...(predicate(node) ? [node] : []), ...node.children.flatMap(child => descendants(child, predicate))]
const only = values => values.length === 1 ? values[0] : null

// This certifies the explicit current server-rendered board, rather than the
// absence of matches from the archived role-card regular expression.
export function readCurrentEmptyInventory(html) {
  const raw = readNativeDocument(html), visible = readVisibleNativeDocument(html, { strict: true })
  const head = only(raw.nodes(node => node.tag === 'head'))
  if (!head) return null
  const title = only(descendants(head, node => node.tag === 'title'))
  const meta = name => only(descendants(head, node => node.tag === 'meta' && node.attrs.property === name))?.attrs.content
  const canonicals = descendants(head, node => node.tag === 'link' && node.attrs.rel === 'canonical')
  if (!title || !/^Join Our Team\s*\|\s*AutoPi Careers\s*$/.test(title.raw || '')
    || meta('og:url') !== URL || meta('og:site_name') !== 'AutoPi.io'
    || canonicals.length > 1 || canonicals.some(node => node.attrs.href !== URL)) return null
  const main = only(visible.nodes(node => node.tag === 'main'))
  const sections = descendants(main, node => node.tag === 'section'
    && descendants(node, child => child.tag === 'h2' && visible.text(child) === "Roles we're hiring for").length === 1)
  const section = only(sections)
  if (!section) return null
  const nodes = predicate => descendants(section, predicate)
  const labels = nodes(node => node.tag === 'span' && /^\d+ open$/.test(visible.text(node)))
  if (labels.length !== 1 || visible.text(labels[0]) !== '0 open'
    || nodes(node => node.tag === 'div' && visible.text(node) === '// no openings').length !== 1
    || nodes(node => node.tag === 'p' && visible.text(node) === "No open positions right now - but we're always interested in great people.").length !== 1) return null
  if (nodes(node => ['article', 'h1', 'h3', 'h4', 'h5', 'h6', 'button', 'form', 'iframe', 'object', 'script'].includes(node.tag)
    || Object.keys(node.attrs).some(key => /^data-(?:ajax|load|page|cursor|offset)/.test(key))).length) return null
  const anchors = nodes(node => node.tag === 'a')
  if (anchors.length !== 1 || anchors[0].attrs.href !== '/sales-inquiry/') return null
  if (descendants(main, node => node.tag === 'a' && /\/(?:careers|jobs)\/[^#?]+/i.test(node.attrs.href || '')
    || /(?:^|\s)(?:role-card|job-card|job-listing)(?:\s|$)/.test(node.attrs.class || '')).length) return null
  if (raw.nodes(node => node.tag === 'script' && node.attrs.type === 'application/ld+json'
    && /"@type"\s*:\s*(?:"JobPosting"|\[[^\]]*"JobPosting")/.test(node.raw || '')).length) return null
  return { surface: URL, nativeTotal: 0, heading: "Roles we're hiring for", nativeCountLabel: '0 open',
    nativeEmptyStatement: "No open positions right now - but we're always interested in great people.",
    scope: 'declared-public-careers-board' }
}

export function waitForSource(value, signal) {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason)
    signal.addEventListener('abort', abort, { once: true })
    Promise.resolve(value).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}
