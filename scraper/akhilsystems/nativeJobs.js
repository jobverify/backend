import { parseExpressionAt } from 'acorn'

const fail = () => { throw new Error('Akhil Systems unsupported static native job model') }
const forbidden = new Set(['__proto__', 'prototype', 'constructor'])

// Read data and React's static text children. Downloaded functions, identifiers,
// property access, templates with interpolation, and arbitrary calls never run.
function readStatic(node, depth = 0) {
  if (!node || depth > 60) fail()
  if (node.type === 'Literal' && !node.regex && !node.bigint) return node.value
  if (node.type === 'ArrayExpression') return node.elements.filter(Boolean).map(child => readStatic(child, depth + 1))
  if (node.type === 'ObjectExpression') {
    const value = Object.create(null)
    for (const property of node.properties) {
      if (property.type !== 'Property' || property.computed || property.method || property.shorthand || property.kind !== 'init') fail()
      const key = property.key.type === 'Identifier' ? property.key.name : property.key.value
      if (typeof key !== 'string' || forbidden.has(key) || Object.hasOwn(value, key)) fail()
      value[key] = readStatic(property.value, depth + 1)
    }
    return value
  }
  if (node.type === 'CallExpression') {
    const callee = node.callee.type === 'SequenceExpression' ? node.callee.expressions : [node.callee]
    const member = callee.at(-1)
    const tag = node.arguments[0]
    const staticTag = tag?.type === 'Literal' && typeof tag.value === 'string'
    const fragment = tag?.type === 'MemberExpression' && !tag.computed && tag.object.type === 'Identifier' && tag.property.name === 'Fragment'
    if (callee.length !== 2 || callee[0]?.type !== 'Literal' || callee[0].value !== 0
      || member?.type !== 'MemberExpression' || member.computed || member.object.type !== 'Identifier'
      || !['jsx', 'jsxs'].includes(member.property.name)
      || (!staticTag && !fragment)) fail()
    const props = readStatic(node.arguments[1], depth + 1)
    const children = props.children ?? ''
    const text = value => Array.isArray(value) ? value.map(text).join(' ') : value == null ? '' : typeof value === 'string' || typeof value === 'number' ? String(value) : fail()
    return text(children)
  }
  fail()
}

export function extractNativeJobModels(source) {
  if (typeof source !== 'string' || source.length > 1_000_000) fail()
  const candidates = [...source.matchAll(/\[\s*\{\s*id\s*:\s*\d+\s*,\s*summary\s*:\s*\[/g)]
  if (!candidates.length) return null
  if (candidates.length !== 1) fail()
  let expression = parseExpressionAt(source, candidates[0].index, { ecmaVersion: 'latest' })
  if (expression.type === 'SequenceExpression') expression = expression.expressions[0]
  if (expression.type !== 'ArrayExpression' || expression.elements.length > 200) fail()
  const models = readStatic(expression)
  const ids = new Set()
  return models.map(model => {
    if (!Number.isInteger(model.id) || model.id <= 0 || ids.has(model.id)
      || !Array.isArray(model.summary) || !Array.isArray(model.fullDetails)) fail()
    ids.add(model.id)
    const summary = Object.fromEntries(model.summary.map(field => {
      if (typeof field.label !== 'string' || typeof field.value !== 'string') fail()
      return [field.label, field.value]
    }))
    const description = model.fullDetails.map(field => {
      if (typeof field.label !== 'string' || typeof field.value !== 'string') fail()
      return `${field.label}: ${field.value}`
    }).join('\n')
    if (!summary.Designation || !summary['Job Location'] || !description.trim()) fail()
    return { title: summary.Designation, location: summary['Job Location'],
      experienceRequired: summary['Experience Level'], openings: summary['No. of Opening'], jobDescription: description }
  })
}

export async function readNativeCareerModels(html, { baseUrl, fetchPage }) {
  const origin = new URL(baseUrl).origin
  const queue = [...String(html).matchAll(/<script\b[^>]*src=["']([^"']+)["']/gi)]
    .map(match => new URL(match[1], baseUrl)).filter(url => url.origin === origin && /^\/_next\/static\/chunks\/[-a-zA-Z0-9_]+\.js$/.test(url.pathname)).map(url => url.href)
  if (!queue.length) return null
  const seen = new Set()
  while (queue.length) {
    if (seen.size > 30) fail()
    const url = queue.shift()
    if (seen.has(url)) continue
    seen.add(url)
    const page = await fetchPage(url)
    if (page.status !== 200 || page.url !== url || page.html.length > 1_000_000) fail()
    const models = extractNativeJobModels(page.html)
    if (models) return models
    if (!/box-career/.test(page.html)) continue
    for (const match of page.html.matchAll(/["'](static\/chunks\/[-a-zA-Z0-9_]+\.js)["']/g)) {
      const dependency = new URL('/_next/' + match[1], baseUrl).href
      if (!seen.has(dependency)) queue.push(dependency)
    }
  }
  fail()
}
