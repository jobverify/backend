import { readFileSync } from 'node:fs'
import { parse } from 'acorn'
import { readNativeDocument } from '../../utils/activeNativeHtml.js'
import { readLiteralModel } from '../literalModel.js'

const entities = JSON.parse(readFileSync(new URL('./htmlNamedEntities.json', import.meta.url)))
export const text = value => String(value ?? '').replace(/\s+/g, ' ').trim()
export const decode = value => String(value ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi, (raw, key) => {
  if (key[0] !== '#') return entities[key + ';'] ?? raw
  const point = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10)
  return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : '\ufffd'
})
export const content = node => node.inert || ['script', 'style'].includes(node.tag) ? ''
  : text(node.tag === 'title' ? decode(node.raw) : node.children.map(child => typeof child === 'string' ? decode(child) : content(child)).join(' '))
export const plain = value => content(readNativeDocument(String(value ?? '')).nodes(node => node.tag === 'root')[0])
export const children = (node, predicate) => node.inert ? [] : [ ...(predicate(node) ? [node] : []),
  ...node.children.filter(child => typeof child !== 'string').flatMap(child => children(child, predicate)) ]
export const hasClass = (node, name) => (node.attrs.class || '').split(/\s+/).includes(name)
export const requirePublished = (ok, message) => { if (!ok) throw Error('Published CIS/Veeam role: ' + message) }
export const only = (values, label) => { requirePublished(values.length === 1, 'Expected one ' + label);return values[0] }
export const same = (a, b) => text(a) === text(b)
export const absolute = (value, base) => { try { return new URL(value, base).href } catch { return null } }
export const canonical = (document, expected) => only(document.nodes(node => node.tag === 'link'
  && node.attrs.rel?.toLowerCase() === 'canonical'), 'own canonical URL').attrs.href === expected
export const links = (html, base) => readNativeDocument(html).nodes(node => node.tag === 'a' && node.attrs.href).flatMap(node => {
  const url = absolute(node.attrs.href, base)
  return url ? [{ url, title: content(node), originalAttributes: { ...node.attrs } }] : []
})
export const dayDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const timestamp = Date.parse(value + 'T00:00:00Z')
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? value : null
}
export const offsetDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null
  const [day, time] = value.split('T'), clock = /^(\d{2}):(\d{2}):(\d{2})/.exec(time)
  const zone = /([+-])(\d{2}):(\d{2})$/.exec(value)
  return dayDate(day) && Number(clock[1]) < 24 && Number(clock[2]) < 60 && Number(clock[3]) < 60
    && (!zone || Number(zone[2]) <= 14 && Number(zone[3]) < 60 && (Number(zone[2]) < 14 || Number(zone[3]) === 0))
    && Number.isFinite(Date.parse(value)) ? value : null
}

// The observed Greenhouse profile publishes one unconditional JSON literal.
// Parse syntax only, reject references/aliases/mutations, and never execute it.
export const remixContext = document => {
  const scripts = document.nodes(node => node.tag === 'script' && !node.attrs.src && !Object.hasOwn(node.attrs, 'nomodule')
    && ['', 'text/javascript', 'application/javascript', 'module'].includes((node.attrs.type || '').trim().toLowerCase()))
  const property = node => !node.computed && node.property?.type === 'Identifier' ? node.property.name
    : node.property?.type === 'Literal' && typeof node.property.value === 'string' ? node.property.value : null
  const rootNames = ['window', 'globalThis', 'self', 'frames', 'top', 'parent']
  const global = node => node?.type === 'ThisExpression'
    || node?.type === 'Identifier' && rootNames.includes(node.name)
    || node?.type === 'MemberExpression' && global(node.object) && rootNames.includes(property(node))
  const target = node => node?.type === 'MemberExpression' && (global(node.object) && property(node) === '__remixContext' || target(node.object))
  const writes = [], unsupported = []
  for (const script of scripts) {
    const ast = parse(script.raw || '', { ecmaVersion: 'latest', sourceType: script.attrs.type === 'module' ? 'module' : 'script' })
    const visit = (node, parent) => {
      if (!node || typeof node !== 'object') return
      if (node.type === 'AssignmentExpression' && target(node.left)
        || node.type === 'UpdateExpression' && target(node.argument)
        || node.type === 'UnaryExpression' && node.operator === 'delete' && target(node.argument)) writes.push({ node, script, ast })
      const initializer = target(node) && global(node.object) && property(node) === '__remixContext'
        && parent?.type === 'AssignmentExpression' && parent.left === node && parent.operator === '='
      if (target(node) && !initializer || global(node) && !(parent?.type === 'MemberExpression' && parent.object === node)
        || node.type === 'MemberExpression' && global(node.object) && property(node) === null
        || node.type === 'Identifier' && node.name === '__remixContext'
          && !(parent?.type === 'MemberExpression' && parent.property === node && !parent.computed
            || parent?.type === 'Property' && parent.key === node && !parent.computed && !parent.shorthand)) unsupported.push(node.start)
      if (node.type === 'Literal') return
      for (const child of Object.values(node)) {
        if (Array.isArray(child)) child.forEach(value => visit(value, node))
        else if (child && typeof child === 'object') visit(child, node)
      }
    }
    visit(ast, null)
  }
  const selected = only(writes, 'immutable Remix initializer')
  requirePublished(!unsupported.length && selected.node.type === 'AssignmentExpression' && selected.node.operator === '='
    && selected.node.right.type === 'ObjectExpression', 'Remix model reference, mutation or alias is unsupported')
  const raw = selected.script.raw, match = /^\s*window\.__remixContext\s*=\s*/.exec(raw)
  requirePublished(match && selected.node.right.start === match[0].length
    && /^\s*;\s*$/.test(raw.slice(selected.node.right.end)), 'Remix data is not a standalone unconditional literal')
  return readLiteralModel(raw.slice(selected.node.right.start, selected.node.right.end)).value
}
