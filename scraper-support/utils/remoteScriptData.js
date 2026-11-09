import { parse, tokenizer } from 'acorn'
import { parseJavaScriptLiteral } from './safeLiteral.js'

const MAX_SOURCE = 2_000_000
const MAX_NODES = 100_000
const MAX_EXPANDED_BYTES = 8_000_000
const MAX_DEPTH = 80
const forbidden = new Set(['__proto__', 'prototype', 'constructor'])
const reject = () => { throw new Error('Unsupported or oversized remote JavaScript data grammar') }
const key = value => {
  if (typeof value !== 'string' && typeof value !== 'number') reject()
  const name = String(value)
  if (forbidden.has(name)) reject()
  return name
}

// Bound token count/nesting before Acorn's recursive parser sees the source.
export const parseBoundedProgram = source => {
  if (typeof source !== 'string' || source.length > MAX_SOURCE) reject()
  let depth = 0, count = 0
  for (const token of tokenizer(source, { ecmaVersion: 'latest' })) {
    if (++count > MAX_NODES) reject()
    if (['{', '[', '(', '${'].includes(token.type.label) && ++depth > MAX_DEPTH) reject()
    if (['}', ']', ')'].includes(token.type.label)) depth--
  }
  return parse(source, { ecmaVersion: 'latest', sourceType: 'script' })
}

const literalValue = (node, source, reference, depth = 0) => {
  if (!node || depth > MAX_DEPTH) reject()
  if (node.type === 'Identifier' && reference) return reference(node.name)
  if (node.type === 'Literal') {
    if (node.regex || node.bigint || !['string', 'number', 'boolean', 'object'].includes(typeof node.value) || (typeof node.value === 'number' && !Number.isFinite(node.value))) reject()
    const value = parseJavaScriptLiteral(source.slice(node.start, node.end))
    if (!Object.is(value, node.value)) reject()
    return value
  }
  if (node.type === 'UnaryExpression' && ((node.operator === '-' && node.argument.type === 'Literal' && typeof node.argument.value === 'number') || (node.operator === '!' && /^[!]([01])$/.test(source.slice(node.start, node.end))))) {
    const value = parseJavaScriptLiteral(source.slice(node.start, node.end))
    if (typeof value === 'number' && !Number.isFinite(value)) reject()
    return value
  }
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) return parseJavaScriptLiteral(source.slice(node.start, node.end))
  if (node.type === 'ArrayExpression') return node.elements.map(child => literalValue(child, source, reference, depth + 1))
  if (node.type === 'ObjectExpression') {
    const result = Object.create(null)
    for (const prop of node.properties) {
      if (prop.type !== 'Property' || prop.kind !== 'init' || prop.computed || prop.method || prop.shorthand || !['Identifier', 'Literal'].includes(prop.key.type)) reject()
      const name = key(prop.key.type === 'Identifier' ? prop.key.name : prop.key.value)
      if (Object.hasOwn(result, name)) reject()
      result[name] = literalValue(prop.value, source, reference, depth + 1)
    }
    return result
  }
  reject()
}

export const parseRemoteLiteral = source => {
  const wrapped = `(${source})`
  const program = parseBoundedProgram(wrapped)
  if (program.body.length !== 1 || program.body[0].type !== 'ExpressionStatement') reject()
  return literalValue(program.body[0].expression, wrapped)
}

export const parseJobsDeclaration = source => {
  const program = parseBoundedProgram(source)
  if (program.body.length !== 1 || program.body[0].type !== 'VariableDeclaration') reject()
  const declarations = program.body[0].declarations
  if (declarations.length !== 1 || declarations[0].id.type !== 'Identifier' || declarations[0].id.name !== 'JOB_DATA') reject()
  return literalValue(declarations[0].init, source)
}

const memberIs = (node, path) => {
  if (path.length === 1) return node?.type === 'Identifier' && node.name === path[0]
  return node?.type === 'MemberExpression' && !node.computed && !node.optional && node.property.type === 'Identifier' && node.property.name === path.at(-1) && memberIs(node.object, path.slice(0, -1))
}

export const parseDwrData = source => {
  const program = parseBoundedProgram(source)
  const variables = new Map()
  const reference = name => { key(name); if (!variables.has(name)) reject(); return variables.get(name) }
  let callback, called = false
  for (const statement of program.body) {
    if (called) reject()
    if (statement.type === 'VariableDeclaration') {
      for (const declaration of statement.declarations) {
        if (declaration.id.type !== 'Identifier' || declaration.id.name === 'dwr') reject()
        const name = key(declaration.id.name)
        if (variables.has(name)) reject()
        variables.set(name, declaration.init ? literalValue(declaration.init, source, reference) : null)
      }
      continue
    }
    if (statement.type !== 'ExpressionStatement') reject()
    const expression = statement.expression
    if (expression.type === 'AssignmentExpression' && expression.operator === '=') {
      const target = expression.left
      if (target.type !== 'MemberExpression' || target.optional || target.object.type !== 'Identifier') reject()
      const object = reference(target.object.name)
      if (!object || typeof object !== 'object') reject()
      let name
      if (target.computed) {
        if (target.property.type !== 'Literal') reject()
        name = key(target.property.value)
      } else {
        if (target.property.type !== 'Identifier') reject()
        name = key(target.property.name)
      }
      if (Array.isArray(object) && (!/^(0|[1-9][0-9]*)$/.test(name) || Number(name) > 10_000 || Number(name) > object.length)) reject()
      object[name] = literalValue(expression.right, source, reference)
      continue
    }
    if (expression.type !== 'CallExpression' || expression.optional || !memberIs(expression.callee, ['dwr', 'engine', '_remoteHandleCallback']) || expression.arguments.length !== 3) reject()
    for (const argument of expression.arguments.slice(0, 2)) {
      if (argument.type !== 'Literal' || !['string', 'number'].includes(typeof argument.value)) reject()
    }
    callback = literalValue(expression.arguments[2], source, reference)
    called = true
  }
  if (!called) reject()
  // Validate even unused declarations. Bound expanded graph size and depth so
  // aliases cannot create cycles or exponential work for downstream consumers.
  // Charge UTF-8 bytes for keys and strings at every expanded alias occurrence,
  // including declaration roots, without allocating an expanded copy.
  let visits = 0, expandedBytes = 0
  const chargeString = value => {
    expandedBytes += Buffer.byteLength(value, 'utf8')
    if (expandedBytes > MAX_EXPANDED_BYTES) reject()
  }
  const ancestors = new Set()
  const visit = (value, depth = 0) => {
    if (++visits > MAX_NODES || depth > MAX_DEPTH) reject()
    if (typeof value === 'string') chargeString(value)
    if (!value || typeof value !== 'object') return
    if (ancestors.has(value)) reject()
    ancestors.add(value)
    for (const [name, child] of Object.entries(value)) {
      chargeString(name)
      visit(child, depth + 1)
    }
    ancestors.delete(value)
  }
  for (const value of variables.values()) visit(value)
  visit(callback)
  return callback
}

// Only this captured decoder envelope is recognized. Its loops/eval are never
// interpreted; base64 decoding happens locally, followed by a data-only parser.
const SUCURI_ENVELOPE = "var s={},u,c,U,r,i,l=0,a,e=eval,w=String.fromCharCode,sucuri_cloudproxy_js='',S='';L=S.length;U=0;r='';var A='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';for(u=0;u<64;u++){s[A.charAt(u)]=u;}for(i=0;i<L;i++){c=s[S.charAt(i)];U=(U<<6)+c;l+=6;while(l>=8){((a=(U>>>(l-=8))&0xff)||(i<(L-2)))&&(r+=w(a));}}e(r);"
const shape = program => JSON.stringify(program, (name, value) => ['start', 'end', 'raw'].includes(name) ? undefined : value)
const envelopeShape = shape(parseBoundedProgram(SUCURI_ENVELOPE))

export const parseSucuriCookieScript = script => {
  if (typeof script !== 'string' || script.length > 65_536) reject()
  let program = parseBoundedProgram(script)
  const encoded = program.body[0]?.type === 'VariableDeclaration' ? program.body[0].declarations.find(d => d.id.type === 'Identifier' && d.id.name === 'S') : null
  if (encoded) {
    if (encoded.init?.type !== 'Literal' || typeof encoded.init.value !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded.init.value)) reject()
    const data = encoded.init.value
    encoded.init.value = ''
    if (shape(program) !== envelopeShape) reject()
    const decoded = Buffer.from(data, 'base64')
    if (decoded.toString('base64').replace(/=+$/, '') !== data.replace(/=+$/, '')) reject()
    script = decoded.toString('utf8')
    program = parseBoundedProgram(script)
  }
  const variables = new Map()
  let cookie = null, reloaded = false, steps = 0
  const expressionValue = (node, depth = 0) => {
    if (++steps > 4096 || depth > MAX_DEPTH) reject()
    let value
    if (node?.type === 'Literal' && ['string', 'number'].includes(typeof node.value)) value = node.value
    else if (node?.type === 'Identifier' && variables.has(node.name)) value = variables.get(node.name)
    else if (node?.type === 'BinaryExpression' && node.operator === '+') {
      const left = expressionValue(node.left, depth + 1), right = expressionValue(node.right, depth + 1)
      if (typeof left !== 'string' || typeof right !== 'string') reject()
      value = left + right
    } else if (node?.type === 'CallExpression' && !node.optional && memberIs(node.callee, ['String', 'fromCharCode']) && node.arguments.length > 0 && node.arguments.length <= 256) {
      const codes = node.arguments.map(arg => {
        if (arg.type !== 'Literal' || !Number.isInteger(arg.value) || arg.value < 0 || arg.value > 65535) reject()
        return arg.value
      })
      value = String.fromCharCode(...codes)
    } else reject()
    if (typeof value === 'string' && value.length > 8192) reject()
    return value
  }
  for (const statement of program.body) {
    if (reloaded || statement.type !== 'ExpressionStatement') reject()
    const expression = statement.expression
    if (expression.type === 'AssignmentExpression' && expression.operator === '=') {
      if (expression.left.type === 'Identifier' && expression.left.name === 'm' && cookie === null && !variables.has('m')) variables.set('m', expressionValue(expression.right))
      else if (memberIs(expression.left, ['document', 'cookie']) && cookie === null) cookie = expressionValue(expression.right)
      else reject()
    } else if (expression.type === 'CallExpression' && !expression.optional && memberIs(expression.callee, ['location', 'reload']) && expression.arguments.length === 0 && cookie !== null) reloaded = true
    else reject()
  }
  if (typeof cookie !== 'string') reject()
  const pair = cookie.split(';', 1)[0].trim()
  if (!/^sucuri_cloudproxy_uuid_[a-z0-9]+=[^\s;\x00-\x1f\x7f]+$/i.test(pair)) reject()
  return pair
}

export const extractSucuriCookieData = html => {
  if (typeof html !== 'string' || html.length > MAX_SOURCE) reject()
  const matches = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
  if (matches.length !== 1) reject()
  return parseSucuriCookieScript(matches[0][1])
}
