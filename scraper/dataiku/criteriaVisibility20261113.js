import { decodeNativeEntities, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'

// Native typography reviewed from current and retained original role bodies.
// White #LI markers are retained tracking text, not role
// criteria; their exception cannot cover any other authored words.
const typography = new Set(['font-weight:400', 'font-size:10pt', 'font-size:12pt', 'text-decoration:underline'])
const trackingText = new Set(['#LI-CM', '#LI-Hybrid', '#LI-FN1', '#LI-JR1', '#LI-Remote', '#LI-Remote #LI-FR1', '#LI-Remote #LI-AN1', '#LI-Hybrid #LI-AN1'])

export function qualifyDataikuCriteria(raw) {
  const issues = [], trackingSpans = []
  const doc = readNativeDocument(decodeNativeEntities(raw)), root = doc.nodes(node => node.tag === 'root')[0]
  const inspect = node => {
    if (typeof node === 'string') return
    if (node.inert || Object.hasOwn(node, 'raw')) issues.push('inactive-or-raw-authored-content')
    const declarations = (node.attrs.style || '').split(';').filter(value => value.trim())
      .map(value => value.trim().toLowerCase().replace(/\s*:\s*/, ':'))
    const nativeTracking = node.tag === 'span' && trackingText.has(doc.text(node))
      && declarations.includes('color:rgb(255, 255, 255)')
      && declarations.every(value => ['color:rgb(255, 255, 255)', 'font-size:8pt'].includes(value))
    if (nativeTracking) trackingSpans.push({ text: doc.text(node), nativeStyle: node.attrs.style })
    else for (const declaration of declarations) {
      if (typography.has(declaration)) continue
      issues.push('unreviewed-authored-inline-style')
    }
    node.children.forEach(inspect)
  }
  inspect(root)
  return { qualified: issues.length === 0, issues: [...new Set(issues)], retainedNativeTrackingSpans: trackingSpans }
}
