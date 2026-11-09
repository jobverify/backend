import {readNativeDocument, decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'

export const normalizeNativeText = value => String(value ?? '').replace(/\s+/g, ' ').trim()
export const decodeNativeText = value => normalizeNativeText(decodeNativeEntities(value))

export function readAttDocument(html) {
  if (typeof html !== 'string' || !html.trim() || Buffer.byteLength(html) > 3000000) {
    throw Error('AT&T native: Missing or oversized native body')
  }
  try { return readNativeDocument(html) }
  catch { throw Error('AT&T native: Malformed native markup') }
}

export function nativeDescendants(node, predicate) {
  if (node.inert) return []
  return [
    ...(predicate(node) ? [node] : []),
    ...node.children.filter(child => typeof child !== 'string').flatMap(child => nativeDescendants(child, predicate)),
  ]
}

export function nativeTextBlocks(node) {
  const blockTags = new Set(['article', 'div', 'section', 'p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br'])
  const visit = current => {
    if (current.inert || current.tag === 'script') return ''
    const text = current.children.map(child => typeof child === 'string' ? decodeNativeText(child) : visit(child)).join(' ')
    return blockTags.has(current.tag) ? '\n' + text + '\n' : text
  }
  return visit(node).split(/\n+/).map(normalizeNativeText).filter(Boolean)
}

export function nativeTextWithout(node, excluded) {
  const visit = current => {
    if (current.inert || current.tag === 'script' || excluded(current)) return ''
    return current.children.map(child => typeof child === 'string' ? decodeNativeText(child) : visit(child)).join(' ')
  }
  return normalizeNativeText(visit(node))
}
