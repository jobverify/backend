import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { decodeNativeEntities } from '../../scraper-support/utils/activeNativeHtml.js'
const career = 'https://armiet.in/career/', apply = 'https://forms.gle/SAVWB6HD2V7bKv7x6'
const hasClass = (node, value) => (node.attrs.class || '').split(/\s+/).includes(value)
const children = node => node.children.filter(child => typeof child !== 'string')
const nativeLines = nodes => {
  const render = node => {
    if (typeof node === 'string') return decodeNativeEntities(node)
    if (node.inert || ['script', 'style', 'a', 'button', 'form'].includes(node.tag)) return ''
    if (node.tag === 'br') return '\n'
    const block = /^(?:p|div|h[1-6]|li|ul|ol)$/.test(node.tag)
    return (block ? '\n' : '') + node.children.map(render).join('') + (block ? '\n' : '')
  }
  return nodes.map(render).join('\n').split(/\r?\n/).map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean)
}
const documentFor = html => readVisibleNativeDocument(html, { strict: true })
const surface = document => document.nodes(node => /^h[1-3]$/.test(node.tag) && /^Careers?$/.test(document.text(node))).length > 0
  && document.nodes(node => node.tag === 'a' && node.attrs.href === apply).length > 0
  && document.nodes(node => node.tag === 'root').some(node => document.text(node).includes('armietdigital@gmail.com'))
export const hasActiveArmietSurface = html => surface(documentFor(html))
export const readArmietAdverts = html => {
  const document = documentFor(html)
  if (!surface(document)) throw new Error('ARMIET verified active careers/application surface is unavailable')
  const adverts = document.nodes(node => node.tag === 'div' && hasClass(node, 'wp-block-column')).flatMap(column => {
    const headings = children(column).filter(node => node.tag === 'h4')
    if (headings.length !== 1) return []
    const title = document.text(headings[0]), lines = nativeLines(children(column).filter(node => node !== headings[0]))
    if (!title || !lines.some(line => /^(?:Branches|Eligibility|Qualification|Teaching Location|Job Location|Job Types?|Salary Package)\s*:/i.test(line))) return []
    return [{ title, lines, sourceUrl: career, applyUrl: apply }]
  })
  if (!adverts.length) throw new Error('ARMIET expected visible native role-column adverts; empty scope is unconfirmed')
  return adverts
}
