import { createHash } from 'node:crypto'
import { Parser } from 'acorn'

const LOADER_TEMPLATE = 'd68cc05fe45b187a88eb9a68be8ed88ad33a1e99656c0b6756ab1967ae94ed07'
const CURRENT_PUBLIC_PROFILE = 'reviewed-complete-module-public-stealth-false-20261107'
const PROGRAM_ASTS = Object.freeze({
  '088cf22a4f0074e78997d6cdba2c378321f164237a95e98089a3a0937dda00ca': 'reviewed-complete-module-original',
  '82a6e22d0c5ab5fb927fc9bc9f9ee67ef7af293b7e878ab500f0f2cf8ffd95a6': 'reviewed-complete-module-two-campaign-statistics-flags-removed',
  '31029f9972fafc7f87a7e7b6af686626549bee7976ffc2009e139a2f81082509': CURRENT_PUBLIC_PROFILE,
})
const RECORDER = 'node_modules/@datadog/browser-rum/esm/boot/datadogRecorder.mjs'
const PROFILER = 'node_modules/@datadog/browser-rum/esm/domain/profiling/datadogProfiler.mjs'
const maxBytes = 8000000, maxNodes = 1500000, maxFields = 10000000, maxPending = 50000
const sha = value => createHash('sha256').update(value).digest('hex')
const object = value => value && typeof value === 'object' && !Array.isArray(value)
const need = (value, message) => {
  if (!value) throw Object.assign(Error('[langchain] Native frontend contract: ' + message), {
    failureKind: 'coverage_gap', softFailure: true, upstreamOutage: false, abortRetries: true,
  })
}

export function declaredNativeFrontend(loader) {
  const bases = [...loader.matchAll(/https:\/\/cdn\.ashbyprd\.com\/frontend_non_user\/[a-f\d]{40}\//g)].map(match => match[0])
  need(bases.length === 4 && new Set(bases).size === 1, 'loader deployment declarations changed')
  const base = bases[0], normalized = loader.replaceAll(base, '__CURRENT_DECLARED_DEPLOYMENT_BASE__')
  need(sha(normalized) === LOADER_TEMPLATE, 'loader template changed; static review required')
  return { base, version: base.split('/').at(-2), manifestURL: base + '.vite/manifest.json',
    loaderSHA256: sha(loader), normalizedLoaderSHA256: LOADER_TEMPLATE, requiresCurrentProgramVerification: true }
}

export function nativeFrontendEntry(declaration, response, check) {
  check()
  need(response.status === 200 && response.url === declaration.manifestURL && typeof response.body === 'string'
    && Buffer.byteLength(response.body) <= maxBytes, 'current declared manifest body unavailable')
  let manifest
  try { manifest = JSON.parse(response.body) } catch { need(false, 'manifest is not literal JSON data') }
  check()
  const entry = manifest?.['index.html']
  need(object(manifest) && object(entry) && entry.name === 'index' && entry.src === 'index.html' && entry.isEntry === true
    && /^assets\/index-[A-Za-z\d_-]{8}\.js$/.test(entry.file) && /^sha384-[A-Za-z\d+/]{64}$/.test(entry.integrity), 'unreviewed manifest entry authority, path or integrity')
  need(entry.imports == null || Array.isArray(entry.imports) && entry.imports.length === 0, 'unreviewed static entry imports')
  need(JSON.stringify(entry.dynamicImports) === JSON.stringify([RECORDER, PROFILER]), 'manifest dynamic import declarations changed')
  const dynamicFile = (key, name) => {
    const value = manifest[key]
    need(object(value) && value.name === name && value.src === key && value.isDynamicEntry === true
      && new RegExp('^assets/' + name + '-[A-Za-z\\d_-]{8}\\.js$').test(value.file)
      && /^sha384-[A-Za-z\d+/]{64}$/.test(value.integrity)
      && JSON.stringify(value.imports) === '["index.html"]', 'unreviewed manifest telemetry entry')
    return './' + value.file.slice('assets/'.length)
  }
  const recorder = dynamicFile(RECORDER, 'datadogRecorder'), profiler = dynamicFile(PROFILER, 'datadogProfiler')
  const entryURL = declaration.base + entry.file
  need(new URL(entryURL).href === entryURL, 'noncanonical manifest entry URL')
  check()
  return { entryURL, entrySRI: entry.integrity, recorder, profiler,
    manifestSHA256: sha(response.body), manifestBytes: Buffer.byteLength(response.body) }
}

const slot = (root, path) => {
  let value = root
  for (const key of path.split('.')) { need(value != null && Object.hasOwn(value, key), 'program AST slot context changed'); value = value[key] }
  return value
}
const normalizeSlots = (tree, declaration, manifest, currentPublicProfile) => {
  const uuid = slot(tree, 'body.0.expression.arguments.0.properties.0.value')
  need(slot(tree, 'body.0.expression.arguments.0.properties').length === 1
    && slot(tree, 'body.0.expression.arguments.0.properties.0.key').value === 'ddDebugId'
    && slot(tree, 'body.0.expression.arguments.1').value === 'DD_SOURCE_CODE_CONTEXT'
    && uuid.type === 'Literal' && typeof uuid.value === 'string'
    && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/.test(uuid.value), 'program debug UUID slot context changed')
  uuid.value = '__DEPLOYMENT_DEBUG_UUID__'
  // Two explicit reviewed layouts. Binding names and whole-module AST remain
  // significant; no identifier or control-flow normalization is performed.
  const positions = currentPublicProfile
    ? { base: 1989, recorder: 1991, profiler: 2002, version: 2019, names: ['iCe', 'uCe', 'xCe', 'UCe'] }
    : { base: 1988, recorder: 1990, profiler: 2001, version: 2018, names: ['nCe', 'cCe', 'yCe', 'VCe'] }
  need(slot(tree, `body.${positions.base}.declarations.1.id`).name === positions.names[0]
    && slot(tree, `body.${positions.recorder}.id`).name === positions.names[1]
    && slot(tree, `body.${positions.profiler}.id`).name === positions.names[2]
    && slot(tree, `body.${positions.version}.id`).name === positions.names[3]
    && slot(tree, `body.${positions.version}.body.body.1.expression.right.expressions.0.arguments.0.properties.2.key`).name === 'version', 'program deployment slot bindings changed')
  const paths = {
    base: `body.${positions.base}.declarations.1.init.body.body.0.argument.left`,
    recorder: `body.${positions.recorder}.body.body.0.argument.object.argument.arguments.0.body.body.0.declarations.0.init.argument.source`,
    profiler: `body.${positions.profiler}.body.body.0.argument.object.argument.arguments.0.body.body.0.declarations.0.init.argument.source`,
    version: `body.${positions.version}.body.body.1.expression.right.expressions.0.arguments.0.properties.2.value.test.left.right`,
  }
  const expected = { base: declaration.base, version: declaration.version, recorder: manifest.recorder, profiler: manifest.profiler }
  for (const [name, path] of Object.entries(paths)) {
    const node = slot(tree, path)
    need(node.type === 'TemplateLiteral' && node.expressions.length === 0 && node.quasis.length === 1
      && node.quasis[0].value.raw === expected[name] && node.quasis[0].value.cooked === expected[name], 'program ' + name + ' AST slot changed')
    node.quasis[0].value.raw = node.quasis[0].value.cooked = '__CURRENT_' + name.toUpperCase() + '__'
  }
}

// This stream includes the entire module, not only the visibly relevant
// functions. Extra writes, helper changes and decoy/rebound functions therefore
// change the fingerprint. Parser offsets and Literal raw spelling are metadata;
// all other fields, including template raw/cooked and regex/bigint data, remain.
function canonicalFingerprint(tree, check) {
  const hash = createHash('sha256'), pending = [tree], tokens = [], cache = new Map()
  let fields = 0, nodes = 0, chars = 0
  const flush = () => { if (tokens.length) { hash.update(tokens.join('')); tokens.length = 0; chars = 0 } }
  const emit = token => { tokens.push(token); chars += token.length; if (tokens.length >= 2048 || chars >= 65536) flush() }
  while (pending.length) {
    need(++fields <= maxFields && pending.length <= maxPending, 'program AST field bound exceeded')
    if ((fields & 1023) === 0) check()
    const value = pending.pop()
    if (value === null) { emit('null;'); continue }
    if (typeof value === 'string') {
      let token = cache.get(value)
      if (token === undefined) {
        token = 'string:' + JSON.stringify(value) + ';'
        if (value.length <= 64 && cache.size < 8192) cache.set(value, token)
      }
      emit(token); continue
    }
    if (typeof value === 'number') { emit('number:' + (Object.is(value, -0) ? '-0' : String(value)) + ';'); continue }
    if (['boolean', 'bigint', 'undefined'].includes(typeof value)) { emit(typeof value + ':' + String(value) + ';'); continue }
    if (Array.isArray(value)) {
      need(value.length + pending.length <= maxPending, 'program AST pending field bound exceeded')
      emit('array:' + value.length + ';')
      for (let index = value.length - 1; index >= 0; index--) pending.push(value[index])
      continue
    }
    need(++nodes <= maxNodes, 'program AST node bound exceeded')
    const keys = Object.keys(value).filter(key => !(typeof value.type === 'string' && ['start', 'end'].includes(key))
      && !(value.type === 'Literal' && key === 'raw')).sort()
    emit('object:' + keys.length + ';')
    for (let index = keys.length - 1; index >= 0; index--) { pending.push(value[keys[index]]); pending.push(keys[index]) }
  }
  flush(); check()
  return { normalizedProgramASTSHA256: hash.digest('hex'), semanticStreamFields: fields, astObjects: nodes }
}

export function verifyNativeFrontend(declaration, manifest, response, check) {
  check()
  need(response.status === 200 && response.url === manifest.entryURL && typeof response.body === 'string'
    && Buffer.byteLength(response.body) <= maxBytes, 'current manifest entry body unavailable')
  need('sha384-' + createHash('sha384').update(response.body).digest('base64') === manifest.entrySRI, 'actual entry SRI integrity mismatch')
  check()
  let constructedNodes = 0
  const constructing = () => { need(++constructedNodes <= maxNodes, 'program AST construction bound exceeded'); if ((constructedNodes & 1023) === 0) check() }
  const BoundedParser = Parser.extend(Base => class extends Base {
    startNode() { constructing(); return super.startNode() }
    startNodeAt(position, location) { constructing(); return super.startNodeAt(position, location) }
  })
  let tree
  try { tree = BoundedParser.parse(response.body, { ecmaVersion: 'latest', sourceType: 'module' }) }
  catch (error) { check(); if (error?.failureKind === 'coverage_gap') throw error; need(false, 'program AST parse contract changed') }
  check()
  need(!tree.body.some(node => node.type === 'ImportDeclaration'), 'unreviewed static program imports')
  const declarations = tree.body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations)
  const currentPublicProfile = tree.body[5567]?.type === 'FunctionDeclaration' && tree.body[5567].id?.name === 'Jyt'
  const queryBinding = currentPublicProfile ? 'JOe' : 'WOe'
  const queries = declarations.filter(node => node.id.type === 'Identifier' && node.id.name === queryBinding)
  need(queries.length === 1 && queries[0].init?.type === 'CallExpression' && queries[0].init.callee?.object?.name === 'JSON'
    && queries[0].init.callee?.property?.name === 'parse' && queries[0].init.arguments.length === 1, 'program query binding changed')
  const literal = queries[0].init.arguments[0]
  need(literal.type === 'TemplateLiteral' && literal.expressions.length === 0 && literal.quasis.length === 1, 'program query is not literal data')
  const query = JSON.parse(literal.quasis[0].value.cooked)
  const operation = query.definitions?.find(node => node.kind === 'OperationDefinition')
  const board = operation?.selectionSet?.selections?.find(node => node.name?.value === 'jobBoardWithTeams')
  need(operation?.name?.value === 'ApiJobBoardWithTeams'
    && JSON.stringify(operation.variableDefinitions.map(node => node.variable.name.value)) === '["organizationHostedJobsPageName"]'
    && JSON.stringify(board?.arguments?.map(node => node.name.value)) === '["organizationHostedJobsPageName"]'
    && board.selectionSet.selections.some(node => node.name?.value === 'jobPostings' && (node.arguments?.length ?? 0) === 0), 'native query pagination or selection changed')
  const criticalBindings = currentPublicProfile ? ['NT', 'Jyt', 'ey', 'Rle', 'Fle', 'Yyt'] : ['MT', 'zyt', '$v', 'Ile', 'Nle', 'Byt']
  const critical = criticalBindings.map(name => {
    const rows = tree.body.filter(node => node.type === 'FunctionDeclaration' && node.id?.name === name)
    need(rows.length === 1, 'critical program binding missing or duplicated')
    return { name, sourceSHA256: sha(response.body.slice(rows[0].start, rows[0].end)) }
  })
  normalizeSlots(tree, declaration, manifest, currentPublicProfile)
  const fingerprint = canonicalFingerprint(tree, check)
  need(Object.hasOwn(PROGRAM_ASTS, fingerprint.normalizedProgramASTSHA256), 'whole-module program AST contract changed; static review required')
  check()
  return { ...declaration, requiresCurrentProgramVerification: false, ...manifest, entrySHA256: sha(response.body),
    entryBytes: Buffer.byteLength(response.body), entrySRI: manifest.entrySRI, entryIntegrityVerified: true,
    ...fingerprint, reviewedProgramASTProfile: PROGRAM_ASTS[fingerprint.normalizedProgramASTSHA256],
    constructedASTNodes: constructedNodes, queryASTSHA256: sha(JSON.stringify(query)), criticalFunctions: critical,
    contract: 'Current declared loader -> current manifest/SRI entry DATA -> complete reviewed module AST -> direct native board/query full jobPostings array and local grouping/filtering/counting/rendering',
    evidenceKind: 'current-declared-manifest-SRI-and-full-module-AST-contract',
    programsRefetchedDuringThisAttempt: true, downloadedJavaScriptExecuted: false }
}
