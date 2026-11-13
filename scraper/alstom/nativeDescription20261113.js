import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { decodeHTML } from 'entities'

const antiClickjackStyle = '<style id="antiClickjack" type="text/css">body{display:none !important;}</style>'
const antiClickjackScript = /^\s*if\s*\(\s*self\s*===\s*top\s*\)\s*\{\s*var\s+antiClickjack\s*=\s*document\s*\.\s*getElementById\s*\(\s*"antiClickjack"\s*\)\s*;\s*antiClickjack\s*\.\s*parentNode\s*\.\s*removeChild\s*\(\s*antiClickjack\s*\)\s*;\s*\}\s*else\s*\{\s*top\s*\.\s*location\s*=\s*self\s*\.\s*location\s*;\s*\}\s*$/
const whitespace = value => decodeHTML(String(value || '')).replace(/\s+/g, ' ').trim()

// The first-party page removes this exact style in a top-level browsing context.
// Recognize only that published script, rather than ignoring arbitrary hiding CSS.
const topLevelMarkup = html => {
  const scripts = readNativeDocument(html).nodes(node => node.tag === 'script' && node.attrs.id === 'antiClickJackScript' && !Object.hasOwn(node.attrs, 'src'))
  return scripts.length === 1 && scripts[0].attrs.type === 'text/javascript'
    && !Object.hasOwn(scripts[0].attrs, 'nomodule') && antiClickjackScript.test(scripts[0].raw)
    && html.split(antiClickjackStyle).length === 2
    ? html.replace(antiClickjackStyle, '') : html
}

// Positioned content cannot establish normal-flow source criteria. Keep this
// conservative qualification local to Alstom's server-rendered description.
const positionDeclaration = /(?:^|;)\s*(?:position\s*:\s*(?:absolute|fixed)\b|clip(?:-path)?\s*:)/i
const unqualifiedPosition = node => positionDeclaration.test((node.attrs?.style || '').replace(/\/\*[\s\S]*?\*\//g, ''))

// Reuse the visible reader's conservative selector/ancestor matching for the
// same position qualification when declarations come from a stylesheet. This
// is an extraction-only projection; original HTTP bytes remain untouched.
const criteriaMarkup = html => topLevelMarkup(html).replace(/<style\b([^>]*)>([\s\S]*?)<\/style\s*>/gi, (_, attributes, css) => {
  const projected = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/([^{}]+)\{([^{}]*)\}/g, (rule, selector, declarations) =>
    positionDeclaration.test(declarations) ? `${selector}{${declarations};opacity:0!important}` : rule)
  return `<style${attributes}>${projected}</style>`
})

export const extractAlstomNativeDescription = value => {
  const document = readVisibleNativeDocument(criteriaMarkup(String(value || '')), { strict: true })
  const descriptions = []
  const visit = (node, qualified = true) => {
    if (node.inert) return
    qualified &&= !unqualifiedPosition(node)
    if (qualified && node.attrs.itemprop === 'description') descriptions.push(node)
    for (const child of node.children) if (typeof child !== 'string') visit(child, qualified)
  }
  document.nodes(node => node.tag === 'root').forEach(node => visit(node))
  if (descriptions.length !== 1) return { jobDescription: null, requiredSkills: [] }
  const scope = descriptions[0]
  const readText = (node, bullets = false) => {
    if (node.inert || unqualifiedPosition(node) || node.tag === 'script') return ''
    return (bullets && node.tag === 'li' ? '- ' : '') + node.children.map(child =>
      typeof child === 'string' ? child : readText(child, bullets)).join(' ')
  }
  const requiredSkills = []
  const listItems = node => {
    if (node.inert || unqualifiedPosition(node)) return
    if (node.tag === 'li') {
      const text = whitespace(readText(node))
      if (text) requiredSkills.push(text)
    }
    for (const child of node.children) if (typeof child !== 'string') listItems(child)
  }
  listItems(scope)
  return { jobDescription: whitespace(readText(scope, true)) || null, requiredSkills }
}
