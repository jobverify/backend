import { createHash } from 'node:crypto'
import { parse } from 'acorn'
import { readNativeDocument } from './activeNativeHtml.js'

// Visibility does not disable an HTML document base. Neither reviewed page
// contract contains base markup, so even an inert/raw markup candidate remains
// unqualified until separately reviewed instead of changing URL authority.
export const hasClientDocumentBase = html => typeof html !== 'string' || /<base(?=[\t\n\f\r />])/i.test(html)

// Script loading is independent of CSS visibility, hidden and inert attributes.
// Walk the retained tree rather than the visible-node selector, preserving
// actual template/raw-text/foreign-namespace exclusions. Object fallback is an
// unqualified declaration context for these reviewed first-party contracts.
export const clientScriptDeclarations = html => {
  const doc = readNativeDocument(html, { excludeObjectFallback: true })
  const root = doc.nodes(node => node.tag === 'root')[0]
  const scripts = []
  const visit = (node, inherited = 'html') => {
    if (!node || typeof node !== 'object') return
    const namespace = node.tag === 'svg' ? 'svg' : node.tag === 'math' ? 'math' : inherited
    if (namespace === 'math' || namespace === 'html' && ['template', 'object'].includes(node.tag)) return
    if (namespace === 'html' && node.tag === 'script') {
      const lower = value => value.replace(/[A-Z]/g, char => char.toLowerCase())
      const strip = value => value.replace(/^[\t\n\f\r ]+|[\t\n\f\r ]+$/g, '')
      const hasType = Object.hasOwn(node.attrs, 'type')
      const supplied = hasType ? node.attrs.type : node.attrs.language ? 'text/' + node.attrs.language : ''
      const type = supplied === '' ? 'text/javascript' : supplied
      const javascript = value => /^(?:(?:text|application)\/(?:x-)?(?:java|ecma)script|text\/javascript1\.[0-5]|text\/(?:jscript|livescript))$/.test(lower(value))
      const classic = javascript(type) || hasType && javascript(strip(type))
      const module = lower(type) === 'module'
      const legacyEvent = !classic || !Object.hasOwn(node.attrs, 'for') || !Object.hasOwn(node.attrs, 'event')
        || lower(strip(node.attrs.for)) === 'window' && ['onload', 'onload()'].includes(lower(strip(node.attrs.event)))
      if (module || classic && !Object.hasOwn(node.attrs, 'nomodule') && legacyEvent) scripts.push(node)
    }
    const childNamespace = namespace === 'svg' && ['foreignobject', 'desc', 'title'].includes(node.tag) ? 'html' : namespace
    for (const child of node.children || []) if (typeof child === 'object') visit(child, childNamespace)
  }
  visit(root)
  return scripts
}

const UUID = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i
const member = (node, name) => node?.type === 'MemberExpression' && !node.computed && node.property?.name === name
const debugAssignment = node => node?.type === 'AssignmentExpression' && node.operator === '='
  && node.left?.type === 'MemberExpression' && node.left.computed && node.left.object?.type === 'LogicalExpression'
  && node.left.object.operator === '||' && member(node.left.object.left, '_debugIds')
  && node.left.object.right?.type === 'AssignmentExpression' && member(node.left.object.right.left, '_debugIds')

// These programs are data. Preserve every AST semantic except the explicitly
// reviewed deployment filenames and the Sentry debug UUID assignment. No code
// from the remote program is evaluated, imported, or called.
const canonical = (value, chunks, parent = null, key = null) => {
  if (Array.isArray(value)) return value.map(child => canonical(child, chunks, parent, key))
  if (!value || typeof value !== 'object') return typeof value === 'bigint' ? String(value) + 'n' : value
  // JSON would otherwise conflate 1e999 (Infinity) with a null literal.
  if (value.type === 'Literal' && typeof value.value === 'number' && !Number.isFinite(value.value)) throw Error('Nonfinite client numeric literal')
  const result = {}
  for (const [name, child] of Object.entries(value)) {
    if (['start', 'end', 'raw'].includes(name)) continue
    if (name === 'value' && value.type === 'Literal' && typeof child === 'string') {
      if (chunks && /^static\/chunks\/[a-z\d_-]+\.(?:js|css)$/i.test(child)) {
        result[name] = 'static/chunks/#deployment#.' + child.split('.').at(-1)
      } else if (UUID.test(child) && key === 'right' && debugAssignment(parent)) result[name] = '#SENTRY_DEBUG_ID#'
      else result[name] = child
    } else result[name] = canonical(child, chunks, value, name)
  }
  return result
}

export const readReviewedClientProgram = (body, { normalizeChunkNames = false } = {}) => {
  if (typeof body !== 'string' || Buffer.byteLength(body, 'utf8') > 1024 * 1024) return null
  try {
    const program = parse(body, { ecmaVersion: 'latest', sourceType: 'script' })
    const normalized = JSON.stringify(canonical(program, normalizeChunkNames))
    return { program, sha256: createHash('sha256').update(normalized).digest('hex') }
  } catch { return null }
}
