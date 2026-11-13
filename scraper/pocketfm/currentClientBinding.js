import { parse } from 'acorn'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { readReviewedClientProgram, hasClientDocumentBase, clientScriptDeclarations } from '../../scraper-support/utils/reviewedClientProgram.js'

// Whole programs reviewed against genuine 2026-11-05 public responses. A build
// filename may rotate; changed module logic, target IDs or tenant links cannot.
const LOADER_SHA256 = 'ba49c2a5eb44f5d8f9ce44d7cdb7212c74b808bb36285971f15f48b66160fb8c'
// November13 keeps the exact footer loader module512169 -> module516114 and
// the unchanged reviewed footer. The surrounding complete Next program changed.
const LOADER_20261113_SHA256 = 'ccb6083dba2f9ccb662d52e8df6e8d11e04be3002df1deb2b127bc3783274b3f'
const FOOTER_SHA256 = '994447fba92c4b0e2d1b4a0ce8c0480d42dbdb6a462be524ee2bc66f8f59fb49'
const LEGACY_LOADER_SHA256 = '14ba844a20ed06cc9d3c5e3aeed2895e7aaf96ddae08f61b4dc2b68555d35e4a'
const LEGACY_FOOTER_SHA256 = 'fafc2abdba1da22439c0ef7d7e4f000bd6791ae0a0303d707c220da41f4d1804'
const LEGACY_PARENT_URL = 'https://pocketfm.com/_next/static/chunks/2y_ptw0orekjx.js'
const LEGACY_FOOTER_URL = 'https://pocketfm.com/_next/static/chunks/0plbo-9g--9fh.js'
const ORIGIN = 'https://pocketfm.com'
const fail = reason => { throw Error('Pocket FM native inventory: current client binding changed: ' + reason) }
const chunkURL = value => {
  try {
    const url = new URL(value, ORIGIN)
    return url.origin === ORIGIN && !url.username && !url.password && !url.search && !url.hash
      && /^\/_next\/static\/chunks\/[a-z\d_-]+\.js$/i.test(url.pathname) ? url.href : null
  } catch { return null }
}

const currentParentURL = html => {
  if (typeof html !== 'string' || Buffer.byteLength(html, 'utf8') > 1024 * 1024) fail('homepage exceeds static inspection bound')
  const doc = readNativeDocument(html, { excludeObjectFallback: true })
  if (hasClientDocumentBase(html)) fail('unreviewed document base')
  const declarations = clientScriptDeclarations(html)
  for (const tag of ['html', 'body']) {
    const nodes = doc.nodes(node => node.tag === tag)
    if (nodes.length !== 1) fail('homepage envelope changed')
  }
  let flight = ''
  for (const script of declarations.filter(node => !node.attrs.src)) {
    try {
      const ast = parse(script.raw || '', { ecmaVersion: 'latest', sourceType: 'script' })
      const call = ast.body.length === 1 && ast.body[0]?.expression
      const receiver = call?.callee?.object
      const payload = call?.arguments?.[0]
      if (call?.type !== 'CallExpression' || call.arguments.length !== 1 || call.callee.computed
        || call.callee.property?.name !== 'push' || receiver?.type !== 'MemberExpression' || receiver.computed
        || receiver.object?.name !== 'self' || receiver.property?.name !== '__next_f'
        || payload?.type !== 'ArrayExpression' || payload.elements.length !== 2
        || payload.elements[0]?.value !== 1 || typeof payload.elements[1]?.value !== 'string') continue
      flight += payload.elements[1].value
    } catch { /* An unrelated inline script is not a Flight declaration. */ }
  }
  const roots = flight.split(/\r?\n/).filter(line => line.startsWith('0:'))
  if (roots.length !== 1) fail('ambiguous literal homepage Flight root')
  let root
  try { root = JSON.parse(roots[0].slice(2)) } catch { fail('malformed homepage Flight root') }
  const entries = root?.t?.t?.d?.r?.[3]?.children?.[0]
  if (!Array.isArray(entries)) fail('homepage script declaration changed')
  const scripts = entries.filter(entry => Array.isArray(entry) && entry[0] === '$' && entry[1] === 'script')
  if (scripts[0]?.[2] !== 'script-0' || typeof scripts[0]?.[3]?.src !== 'string') fail('current parent declaration unavailable')
  const parent = chunkURL(scripts[0][3].src)
  if (!parent || declarations.filter(node => node.attrs.src && chunkURL(node.attrs.src) === parent).length !== 1) {
    fail('current parent is not one active first-party script')
  }
  return parent
}

const loaderChild = program => {
  const matches = []
  const visit = node => {
    if (!node || typeof node !== 'object') return
    if (node.type === 'ArrayExpression') {
      for (let index = 0; index < node.elements.length - 1; index++) {
        if (node.elements[index]?.type === 'Literal' && node.elements[index].value === 512169
          && node.elements[index + 1]?.type === 'ArrowFunctionExpression') matches.push(node.elements[index + 1])
      }
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) for (const child of value) visit(child)
      else if (value && typeof value === 'object') visit(value)
    }
  }
  visit(program)
  if (matches.length !== 1) fail('reviewed footer loader module unavailable')
  // The complete loader fingerprint fixes this function's calls and target
  // module 516114. Only its literal static chunk names were normalized.
  const arrays = []
  const findChunks = node => {
    if (!node || typeof node !== 'object') return
    if (node.type === 'ArrayExpression' && node.elements.length === 3
      && node.elements.every(entry => entry?.type === 'Literal' && typeof entry.value === 'string'
        && /^static\/chunks\/[a-z\d_-]+\.js$/i.test(entry.value))) arrays.push(node)
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) for (const child of value) findChunks(child)
      else if (value && typeof value === 'object') findChunks(value)
    }
  }
  findChunks(matches[0])
  const child = arrays.length === 1 && chunkURL('/_next/' + arrays[0].elements[0].value)
  if (!child) fail('reviewed footer chunk unavailable')
  return child
}

export const verifyCurrentPocketClientBinding = async (html, getText) => {
  const parentURL = currentParentURL(html)
  const parent = readReviewedClientProgram(await getText(parentURL), { normalizeChunkNames: true })
  if (![LOADER_SHA256, LOADER_20261113_SHA256].includes(parent?.sha256)) fail('unreviewed parent program')
  const childURL = loaderChild(parent.program)
  const footer = readReviewedClientProgram(await getText(childURL))
  if (footer?.sha256 !== FOOTER_SHA256) fail('unreviewed careers footer program')
  return { parentURL, childURL, loaderProgramSHA256: parent.sha256, footerProgramSHA256: FOOTER_SHA256 }
}

export const verifyLegacyPocketClientBinding = async (html, getText) => {
  if (hasClientDocumentBase(html)) fail('unreviewed document base')
  if (clientScriptDeclarations(html).filter(node => node.attrs.src && chunkURL(node.attrs.src) === LEGACY_PARENT_URL).length !== 1) {
    fail('historical parent is not one active first-party script')
  }
  const parent = readReviewedClientProgram(await getText(LEGACY_PARENT_URL))
  if (parent?.sha256 !== LEGACY_LOADER_SHA256) fail('unreviewed historical parent program')
  const footer = readReviewedClientProgram(await getText(LEGACY_FOOTER_URL))
  if (footer?.sha256 !== LEGACY_FOOTER_SHA256) fail('unreviewed historical careers footer program')
  return { parentURL: LEGACY_PARENT_URL, childURL: LEGACY_FOOTER_URL,
    loaderProgramSHA256: LEGACY_LOADER_SHA256, footerProgramSHA256: LEGACY_FOOTER_SHA256 }
}

export const verifyPocketClientBinding = async (html, getText) => {
  if (hasClientDocumentBase(html)) fail('unreviewed document base')
  const legacy = clientScriptDeclarations(html).some(node => node.attrs.src && chunkURL(node.attrs.src) === LEGACY_PARENT_URL)
  return legacy ? verifyLegacyPocketClientBinding(html, getText) : verifyCurrentPocketClientBinding(html, getText)
}
