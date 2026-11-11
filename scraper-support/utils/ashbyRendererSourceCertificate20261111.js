import { createHash } from 'node:crypto'
import { types } from 'node:util'
import { parseEightfoldJson } from './recruitmentEightfoldData.js'

// Source certificate only. No network, HTML, account, job or UI qualification.
// Reviewed original07dd/b542 packets and complete reversible byte proof are in
// test/fixtures/ashby-renderer-source-certificate-20261111.manifest.json.
const PROFILE = 'ashby-non-user-whole-source-20261111'
const RECORDER = 'node_modules/@datadog/browser-rum/esm/boot/datadogRecorder.mjs'
const PROFILER = 'node_modules/@datadog/browser-rum/esm/domain/profiling/datadogProfiler.mjs'
const SVG = 'src/components/Meeting/people.svg'
const SVG_FILE = 'assets/people-DXCB0Mk2.svg'
const SVG_SRI = 'sha384-S1Kc3hbeBaPw2TZOA91q/FWuwqfrJCPTe7QqzFM5k2EVSPlDs6Q8d8bTYYYhMywq'
const KINDS = ['manifest', 'entry', 'recorder', 'profiler', 'css']
const TYPES = {
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  deployment: /^[0-9a-f]{40}$/,
  filename: /^[A-Za-z0-9_-]{8}$/,
  sri: /^[A-Za-z0-9+/]{64}$/,
}
const sha = value => createHash('sha256').update(value).digest('hex')
const integrity = value => 'sha384-' + createHash('sha384').update(value).digest('base64')
const need = (condition, reason) => {
  if (!condition) throw Object.assign(new Error('Ashby source certificate withheld: ' + reason), {
    code: 'ASHBY_SOURCE_CERTIFICATE_HOLD', reason,
  })
}
const freeze = value => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child)
    Object.freeze(value)
  }
  return value
}
const record = (value, keys, reason = 'input-shape') => {
  need(value && typeof value === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(value)), reason)
  const entries = Reflect.ownKeys(value)
  need(entries.every(key => typeof key === 'string') && entries.length === keys.length && keys.every(key => entries.includes(key)), reason)
  const descriptors = Object.getOwnPropertyDescriptors(value)
  need(entries.every(key => Object.hasOwn(descriptors[key], 'value') && descriptors[key].enumerable), reason)
  return value
}
const sameArray = (value, expected) => Array.isArray(value) && value.length === expected.length && value.every((item, index) => item === expected[index])

const NativeUint8Array = Uint8Array
const typedArrayPrototype = Object.getPrototypeOf(NativeUint8Array.prototype)
const nativeLength = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'length').get
const nativeByteLength = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'byteLength').get
const nativeBuffer = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'buffer').get
const nativeSet = typedArrayPrototype.set
const snapshotBody = value => {
  need(types.isUint8Array(value), 'body-type')
  const length = Reflect.apply(nativeLength, value, [])
  const bytes = Reflect.apply(nativeByteLength, value, [])
  need(Number.isSafeInteger(length) && length > 0 && length === bytes && bytes <= 6291456, 'body-length')
  // Do not coerce the caller's view, inspect its shadowable geometry properties,
  // or invoke slice/species. Native set copies actual typed-array slots into a
  // private plain view, including any appended bytes; Buffer sees only OUR buffer.
  const owned = new NativeUint8Array(length)
  try { Reflect.apply(nativeSet, owned, [value]) } catch { need(false, 'body-type') }
  need(Reflect.apply(nativeLength, value, []) === length && Reflect.apply(nativeByteLength, value, []) === bytes, 'body-length')
  return Buffer.from(Reflect.apply(nativeBuffer, owned, []))
}

// These are fixed BYTE ranges, not regex exemptions or an AST pretty-printer.
// Each remaining byte, including every comment and source-map tail, is pinned.
// [name, byteStart, length, alphabet, binding, immediate prefix, suffix]
const profiles = {
  manifest: {
    bytes: 1562, hash: '09ace57b3585eaa2e4488a9e8be340db119bc7796757e7f9070c9289f43eaee8',
    slots: [
      ['ENTRY_FILENAME', 46, 8, 'filename', 'entry', '"file": "assets/index-', '.js"'],
      ['CSS_FILENAME', 346, 8, 'filename', 'css', '"assets/index-', '.css"'],
      ['ENTRY_SRI', 450, 64, 'sri', 'entryIntegrity', '"integrity": "sha384-', '"'],
      ['RECORDER_FILENAME', 627, 8, 'filename', 'recorder', '"file": "assets/datadogRecorder-', '.js"'],
      ['RECORDER_SRI', 845, 64, 'sri', 'recorderIntegrity', '"integrity": "sha384-', '"'],
      ['PROFILER_FILENAME', 1034, 8, 'filename', 'profiler', '"file": "assets/datadogProfiler-', '.js"'],
      ['PROFILER_SRI', 1264, 64, 'sri', 'profilerIntegrity', '"integrity": "sha384-', '"'],
    ],
  },
  entry: {
    bytes: 4274156, hash: 'f854e1d2aba40bb7373c04d9680d1411cd90fec05f5107be78ba04a1235d82c4',
    slots: [
      ['DD_DEBUG_UUID', 284, 36, 'uuid', null, '"ddDebugId":"', '"},"DD_SOURCE_CODE_CONTEXT");\n'],
      ['ASSET_DEPLOYMENT', 1389510, 40, 'deployment', 'version', 'https://cdn.ashbyprd.com/frontend_non_user/', '/`+e}'],
      ['RECORDER_FILENAME', 1391277, 8, 'filename', 'recorder', 'import(`./datadogRecorder-', '.js`)'],
      ['PROFILER_FILENAME', 1393681, 8, 'filename', 'profiler', 'import(`./datadogProfiler-', '.js`)'],
      ['TELEMETRY_VERSION', 1401770, 40, 'deployment', 'version', 'version:(t=`', '`)==null?void 0:t.toString()'],
      ['SOURCE_MAP_FILENAME', 4274141, 8, 'filename', 'entry', '//# sourceMappingURL=index-', '.js.map'],
    ],
  },
  recorder: {
    bytes: 34172, hash: 'd56a297119f530f306495a08a4b18270514db5fc5802e5266c7b9d41971b6de1',
    slots: [
      ['DD_DEBUG_UUID', 284, 36, 'uuid', null, '"ddDebugId":"', '"},"DD_SOURCE_CODE_CONTEXT");\n'],
      ['MAIN_FILENAME', 812, 8, 'filename', 'entry', 'from"./index-', '.js";'],
      ['SOURCE_MAP_FILENAME', 34157, 8, 'filename', 'recorder', '//# sourceMappingURL=datadogRecorder-', '.js.map'],
    ],
  },
  profiler: {
    bytes: 9586, hash: '3b7bfee8e18dcdcffa79b944443c025e6fa400201648a191584f454a990f94ed',
    slots: [
      ['DD_DEBUG_UUID', 284, 36, 'uuid', null, '"ddDebugId":"', '"},"DD_SOURCE_CODE_CONTEXT");\n'],
      ['MAIN_FILENAME', 622, 8, 'filename', 'entry', 'from"./index-', '.js";'],
      ['SOURCE_MAP_FILENAME', 9571, 8, 'filename', 'profiler', '//# sourceMappingURL=datadogProfiler-', '.js.map'],
    ],
  },
  css: {
    bytes: 210346, hash: '504da8fce5a071e314a4d1d13e6d815ccb220887457487b41d34793bc2ba23d7',
    slots: [
      ['DECLARED_IMAGE_DEPLOYMENT', 84324, 40, 'deployment', 'version', 'background-image:url(https://cdn.ashbyprd.com/frontend_non_user/', '/assets/people-DXCB0Mk2.svg)'],
    ],
  },
}

// Independently reviewed90c source variant: the exact77-byte central error-enum
// addition is pinned content in this full hash, NEVER an extra parameter slot.
// Original source profile above and all dependency/CSS profiles stay unchanged.
const entry90cProfile = {
  bytes: 4274233, hash: 'aace3b1785fc2b71bf5c53354dd52986a5bdc66f428dee58bc00c32f9507b56f',
  slots: [
    ['DD_DEBUG_UUID', 284, 36, 'uuid', null, '"ddDebugId":"', '"},"DD_SOURCE_CODE_CONTEXT");\n'],
    ['ASSET_DEPLOYMENT', 1389587, 40, 'deployment', 'version', 'https://cdn.ashbyprd.com/frontend_non_user/', '/`+e}'],
    ['RECORDER_FILENAME', 1391354, 8, 'filename', 'recorder', 'import(`./datadogRecorder-', '.js`)'],
    ['PROFILER_FILENAME', 1393758, 8, 'filename', 'profiler', 'import(`./datadogProfiler-', '.js`)'],
    ['TELEMETRY_VERSION', 1401847, 40, 'deployment', 'version', 'version:(t=`', '`)==null?void 0:t.toString()'],
    ['SOURCE_MAP_FILENAME', 4274218, 8, 'filename', 'entry', '//# sourceMappingURL=index-', '.js.map'],
  ],
}

const canonical = (body, kind, bindings) => {
  const profile = kind === 'entry' && body.length === entry90cProfile.bytes ? entry90cProfile : profiles[kind]
  need(body.length === profile.bytes, 'body-length')
  const parts = [], slots = []
  let cursor = 0
  for (const [name, start, length, alphabet, binding, before, after] of profile.slots) {
    const end = start + length, prefix = Buffer.from(before), suffix = Buffer.from(after)
    need(body.subarray(start - prefix.length, start).equals(prefix) && body.subarray(end, end + suffix.length).equals(suffix), 'slot-context')
    const value = body.subarray(start, end).toString('utf8')
    need(TYPES[alphabet].test(value), 'slot-shape')
    need(binding === null || value === bindings[binding], 'slot-binding')
    parts.push(body.subarray(cursor, start), Buffer.from('[BOUND_' + name + ']'))
    slots.push({ resource: kind, name, byteStart: start, byteLength: length, alphabet, binding, value })
    cursor = end
  }
  parts.push(body.subarray(cursor))
  const hash = sha(Buffer.concat(parts))
  need(hash === profile.hash, 'source-bytes')
  return { hash, slots }
}

// Complete supported CDN response profile. Delivery timestamps/cache entity IDs
// are retained raw; new security/CORS/navigation/auth/challenge fields hold.
// The absence of ACAO on these non-Origin reads is NOT browser CORS proof.
const fixedHeaders = {
  'alt-svc': 'h3=":443"; ma=86400',
  'cache-control': 'public, max-age=691200',
  connection: 'keep-alive', 'content-encoding': 'br', server: 'cloudflare',
  'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
  'transfer-encoding': 'chunked', 'x-amz-server-side-encryption': 'AES256',
}
const deliveryHeaders = ['cf-cache-status', 'cf-ray', 'date', 'etag', 'expires', 'last-modified', 'x-amz-id-2', 'x-amz-request-id', 'x-amz-version-id']
const requiredHeaders = [...Object.keys(fixedHeaders), ...deliveryHeaders, 'content-type']
const headers = (value, kind) => {
  need(value && typeof value === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(value)), 'headers')
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors)
  need(keys.length <= 32 && keys.every(key => typeof key === 'string' && Object.hasOwn(descriptors[key], 'value') && descriptors[key].enumerable), 'headers')
  const original = {}, normalized = Object.create(null)
  for (const key of keys) {
    const item = descriptors[key].value, lower = key.toLowerCase()
    need(/^[a-z0-9-]+$/i.test(key) && !Object.hasOwn(normalized, lower) && typeof item === 'string' && item.length <= 2048 && /^[\x20-\x7e]*$/.test(item), 'headers')
    Object.defineProperty(original, key, { value: item, enumerable: true })
    normalized[lower] = item
  }
  const expectedMIME = { manifest: 'application/json', entry: 'text/javascript', recorder: 'text/javascript', profiler: 'text/javascript', css: 'text/css' }[kind]
  const mime = /^(application\/json|text\/javascript|text\/css)(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?$/i.exec(normalized['content-type'] || '')
  need(mime && mime[1].toLowerCase() === expectedMIME, 'mime-encoding')
  need(Object.keys(normalized).every(key => requiredHeaders.includes(key) || key === 'age') && requiredHeaders.every(key => Object.hasOwn(normalized, key)), 'security-profile')
  need(Object.entries(fixedHeaders).every(([key, item]) => normalized[key] === item), 'security-profile')
  need(['HIT', 'MISS'].includes(normalized['cf-cache-status']) && (!Object.hasOwn(normalized, 'age') || /^\d+$/.test(normalized.age)), 'security-profile')
  return { original, MIME: mime[1].toLowerCase() }
}

const packet = (value, kind, url) => {
  record(value, ['requestedURL', 'finalURL', 'status', 'headers', 'body'])
  need(value.requestedURL === url && value.finalURL === url, 'route')
  need(value.status === 200, 'status')
  const header = headers(value.headers, kind)
  const body = snapshotBody(value.body)
  let text
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(body) } catch { need(false, 'utf8') }
  need(!text.startsWith('\ufeff') && Buffer.from(text, 'utf8').equals(body), 'utf8')
  return {
    body, text,
    evidence: {
      requestedURL: value.requestedURL, finalURL: value.finalURL, status: value.status,
      originalHeaders: header.original, MIME: header.MIME, decodedEntityBytes: body.length,
      originalSHA256: sha(body), computedIntegrity: integrity(body),
    },
  }
}

const limits = () => ({
  browserExecution: 'unqualified', renderedUI: 'unqualified',
  unacquiredBytes: ['font stylesheet', 'fonts', 'favicon/media', 'declared SVG', 'source maps'],
  cors: 'Browser Origin-specific CORS remains unknown; original asset requests did not prove cross-origin execution.',
  separateEvidenceRequired: ['HTML/carrier/security', 'corporate/account binding', 'native data and role criteria/country', 'current opening/closing transaction', 'application and screening UI'],
  captureClocks: 'Caller retains original acquisition timestamps/phases; this pure comparison creates no currentness interval.',
})

const inspect = input => {
  record(input, ['declaration', 'manifest'])
  const declaration = record(input.declaration, ['version', 'manifestURL'])
  need(typeof declaration.version === 'string' && TYPES.deployment.test(declaration.version), 'declaration')
  const base = 'https://cdn.ashbyprd.com/frontend_non_user/' + declaration.version + '/'
  need(declaration.manifestURL === base + '.vite/manifest.json', 'declaration')
  const original = packet(input.manifest, 'manifest', declaration.manifestURL)
  let model
  try { model = parseEightfoldJson(original.text) } catch { need(false, 'manifest-json') }
  record(model, ['index.html', RECORDER, PROFILER, SVG], 'manifest-graph')
  const entry = record(model['index.html'], ['file', 'name', 'src', 'isEntry', 'dynamicImports', 'css', 'assets', 'integrity'], 'manifest-graph')
  need(entry.name === 'index' && entry.src === 'index.html' && entry.isEntry === true && sameArray(entry.dynamicImports, [RECORDER, PROFILER]) && sameArray(entry.assets, [SVG_FILE]), 'manifest-graph')
  need(Array.isArray(entry.css) && entry.css.length === 1 && typeof entry.css[0] === 'string' && /^assets\/index-[A-Za-z0-9_-]{8}\.css$/.test(entry.css[0]), 'manifest-graph')
  const svg = record(model[SVG], ['file', 'src', 'integrity'], 'manifest-graph')
  need(svg.file === SVG_FILE && svg.src === SVG && svg.integrity === SVG_SRI, 'manifest-graph')
  const nodes = { entry, recorder: model[RECORDER], profiler: model[PROFILER] }
  for (const [kind, source, name] of [['recorder', RECORDER, 'datadogRecorder'], ['profiler', PROFILER, 'datadogProfiler']]) {
    const node = record(nodes[kind], ['file', 'name', 'src', 'isDynamicEntry', 'imports', 'integrity'], 'manifest-graph')
    need(node.name === name && node.src === source && node.isDynamicEntry === true && sameArray(node.imports, ['index.html']), 'manifest-graph')
  }
  const bindings = { version: declaration.version, css: /^assets\/index-([A-Za-z0-9_-]{8})\.css$/.exec(entry.css[0])[1] }
  const resources = {}
  for (const [kind, node] of Object.entries(nodes)) {
    const stem = { entry: 'index', recorder: 'datadogRecorder', profiler: 'datadogProfiler' }[kind]
    need(typeof node.file === 'string' && typeof node.integrity === 'string', 'manifest-graph')
    const filename = new RegExp('^assets/' + stem + '-([A-Za-z0-9_-]{8})\\.js$').exec(node.file)
    need(filename && /^sha384-[A-Za-z0-9+/]{64}$/.test(node.integrity), 'manifest-graph')
    bindings[kind] = filename[1]
    bindings[kind + 'Integrity'] = node.integrity.slice(7)
    resources[kind] = { url: base + node.file, declaredIntegrity: node.integrity }
  }
  resources.css = { url: base + entry.css[0], declaredIntegrity: null }
  const proof = canonical(original.body, 'manifest', bindings)
  return { declaration: { ...declaration }, resources, bindings, evidence: {
    ...original.evidence, declaredIntegrity: null, canonicalSHA256: proof.hash,
  }, manifestSlots: proof.slots }
}

/** Derive four exact resource URLs from a qualified original manifest, without
 * acquiring, evaluating or qualifying the declared source bodies. */
export function inspectAshbyRendererManifest(input) {
  const result = inspect(input)
  return freeze({
    profileId: PROFILE, kind: 'reviewed-manifest-declaration', sourceBodiesQualified: false,
    declaration: result.declaration, resources: result.resources,
    manifest: result.evidence, typedManifestSlots: result.manifestSlots, limits: limits(),
  })
}

/** Certify only this reviewed whole source graph modulo the13 individually
 * typed/bound source literals. Recomputed publisher SRI is also necessary, but
 * never substitutes for the whole complement hash or transport qualification. */
export function certifyAshbyRendererSource(input) {
  record(input, ['declaration', 'packets'])
  record(input.packets, KINDS)
  const declaration = inspect({ declaration: input.declaration, manifest: input.packets.manifest })
  const resources = { manifest: declaration.evidence }, slots = []
  for (const kind of ['entry', 'recorder', 'profiler', 'css']) {
    const descriptor = declaration.resources[kind]
    const original = packet(input.packets[kind], kind, descriptor.url)
    const proof = canonical(original.body, kind, declaration.bindings)
    need(descriptor.declaredIntegrity === null || descriptor.declaredIntegrity === original.evidence.computedIntegrity, 'integrity')
    resources[kind] = { ...original.evidence, declaredIntegrity: descriptor.declaredIntegrity, canonicalSHA256: proof.hash }
    slots.push(...proof.slots)
  }
  return freeze({
    profileId: PROFILE, kind: 'reviewed-complete-source-certificate', sourceBodiesQualified: true,
    sourceScope: 'Exact manifest graph, three complete JS bodies and main CSS;13 bound source literals and seven bound manifest values only.',
    declaration: declaration.declaration, resources,
    typedSourceSlots: slots, typedManifestSlots: declaration.manifestSlots,
    declaredUnacquiredSVG: { file: SVG_FILE, integrity: SVG_SRI, bytesAcquired: false },
    limits: limits(),
  })
}
