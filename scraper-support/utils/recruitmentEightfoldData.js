import { createHash } from 'node:crypto'
import { decodeHTML } from 'entities'
import { readNativeDocument, readNativeAttributeTokens } from './activeNativeHtml.js'
import { normalizeNativeAttributeBoundaries } from './nativeHtmlAttributes.js'
import { readVisibleNativeDocument } from './visibleNativeHtml.js'

const need = (condition, message) => { if (!condition) throw new Error('Eightfold ' + message) }
const sha = value => createHash('sha256').update(value).digest('hex')

// JSON.parse alone silently chooses the last duplicate. Native account, role,
// criteria and country evidence must retain unambiguous original key spelling.
export const parseEightfoldJson = source => {
  need(typeof source === 'string' && source.length > 0 && source.length <= 8000000, 'native JSON size/type changed')
  let value
  try { value = JSON.parse(source) } catch { throw new Error('Eightfold native JSON is invalid') }
  const stack = []
  for (let cursor = 0; cursor < source.length; cursor++) {
    const char = source[cursor]
    if (char === '{') stack.push(new Set())
    else if (char === '[') stack.push(null)
    else if (char === '}' || char === ']') stack.pop()
    else if (char === '"') {
      const start = cursor++
      while (cursor < source.length && source[cursor] !== '"') {
        if (source[cursor] === '\\') cursor++
        cursor++
      }
      let next = cursor + 1
      while (next < source.length && /\s/.test(source[next])) next++
      if (source[next] === ':') {
        const keys = stack.at(-1), key = JSON.parse(source.slice(start, cursor + 1))
        need(keys instanceof Set && !keys.has(key), 'native JSON contains duplicate identity/data keys')
        keys.add(key)
      }
    }
  }
  return value
}

// Visibility policy is unchanged. Walk the retained tree explicitly because the
// reviewed code carrier is itself hidden data, never visible recruitment text.
export const eightfoldDocument = html => {
  need(typeof html === 'string' && html.length > 0 && html.length <= 8000000, 'native document size/type changed')
  const normalized = normalizeNativeAttributeBoundaries(html), document = readNativeDocument(normalized)
  const root = document.nodes(node => node.tag === 'root')[0], entries = []
  const walk = (node, ancestors) => {
    entries.push({ node, ancestors })
    for (const child of node.children) if (typeof child !== 'string') walk(child, [...ancestors, node])
  }
  walk(root, [])
  return { document, entries, normalized }
}
const active = ({ node, ancestors }) => !node.inert && !node.nativeTagUnqualified
  && !ancestors.some(parent => parent.inert || ['svg', 'math', 'template', 'object', 'noscript'].includes(parent.tag))

// This extra lexical check can only withhold evidence: the actual tree above
// supplies authority. It catches duplicate identity attributes lost by HTML's
// normal first-attribute policy, including non-code ID shadows.
const unambiguousIdAttributes = (normalized, id) => {
  for (const match of normalized.matchAll(/<([a-z][^\s/>]*)\s+([^>]*)>/gi)) {
    const attributes = readNativeAttributeTokens(match[2])
    if (!attributes.some(([name, value]) => name === 'id' && decodeHTML(value) === id)) continue
    const names = new Set()
    for (const [name] of attributes) {
      need(!names.has(name), 'native carrier/mount has duplicate identity attributes')
      names.add(name)
    }
  }
}

export const readEightfoldDataCarrier = (html, { id, mountId } = {}) => {
  need(typeof id === 'string' && /^[A-Za-z][\w-]*$/.test(id), 'native carrier identity is invalid')
  const parsed = eightfoldDocument(html), matches = parsed.entries.filter(({ node }) => node.attrs.id === id)
  need(matches.length === 1, 'native data carrier identity missing or duplicated')
  unambiguousIdAttributes(parsed.normalized, id)
  const { node, ancestors } = matches[0]
  need(node.tag === 'code' && ancestors.some(parent => parent.tag === 'body')
    && !ancestors.some(parent => parent.inert || ['svg', 'math', 'template', 'object', 'noscript'].includes(parent.tag))
    && !node.nativeTagUnqualified && node.children.length === 1 && typeof node.children[0] === 'string',
  'native code carrier is not in its active document context')
  need(Object.keys(node.attrs).every(name => ['id', 'style', 'data-nosnippet'].includes(name))
    && /^\s*display\s*:\s*none\s*;?\s*$/i.test(node.attrs.style || '')
    && (!Object.hasOwn(node.attrs, 'data-nosnippet') || node.attrs['data-nosnippet'] === ''),
  'native data carrier self-hidden model changed')
  const visibleDocument = readVisibleNativeDocument(parsed.normalized, { strict: true })
  let originalParent = parsed.entries[0].node, visibleParent = visibleDocument.nodes(item => item.tag === 'root')[0]
  need(visibleParent && !visibleParent.inert, 'native carrier document is not visibly active')
  // Inspect the same ancestor path in the stylesheet-qualified projection;
  // never expose the self-hidden code as visible text to obtain this proof.
  for (const parent of ancestors.slice(1)) {
    const index = originalParent.children.indexOf(parent)
    visibleParent = visibleParent.children[index]
    need(visibleParent && typeof visibleParent !== 'string' && !visibleParent.inert,
      'native carrier ancestor is stylesheet-hidden or unqualified')
    originalParent = parent
  }
  if (mountId != null) {
    need(typeof mountId === 'string' && /^[A-Za-z][\w-]*$/.test(mountId), 'native mount identity is invalid')
    const mounts = parsed.entries.filter(({ node: item }) => item.attrs.id === mountId)
    need(mounts.length === 1 && active(mounts[0]) && mounts[0].ancestors.some(parent => parent.tag === 'body'),
      'native mount is missing, inactive or duplicated')
    need(visibleDocument.nodes(item => item.attrs.id === mountId).length === 1,
      'native mount is stylesheet-hidden or unqualified')
    unambiguousIdAttributes(parsed.normalized, mountId)
  }
  const rawText = node.children[0], decoded = decodeHTML(rawText)
  return { value: parseEightfoldJson(decoded), rawText, attributes: { ...node.attrs }, dataOnly: true,
    sourceHtmlSHA256: sha(html), carrierRawTextSHA256: sha(rawText), decodedJsonSHA256: sha(decoded) }
}
