import assert from 'node:assert/strict'
import test from 'node:test'
import { registerHooks, syncBuiltinESMExports } from 'node:module'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'

// Authored PDF task/document protocols only. The sentinel is not a valid PDF
// or an employer capture. No native text/graphics, geography or criteria proof
// is supplied by this dependency hook; DOMMatrix is never replaced.
const backend = fileURLToPath(new URL('../', import.meta.url))
const sentinel = Buffer.from('%PDF-1.7\n% Synthetic legacy lifecycle protocol, not an employer document.\n')
const OPS = { save: 1, restore: 2, setTextRenderingMode: 3, setGState: 4,
  showText: 5, showSpacedText: 6, nextLineShowText: 7, nextLineSetSpacingShowText: 8 }
const mockURL = 'data:text/javascript,' + encodeURIComponent('export const getDocument=options=>globalThis.__legacyPdfFactory(options);'
  + 'export const OPS=' + JSON.stringify(OPS) + ';export const VerbosityLevel={ERRORS:0};')
registerHooks({ resolve(specifier, context, next) {
  return specifier === 'pdfjs-dist/legacy/build/pdf.mjs' ? { url: mockURL, shortCircuit: true } : next(specifier, context)
} })
let networkAttempts = 0
const deny = () => { networkAttempts++; throw Error('Synthetic PDF lifecycle tests forbid actual network/database transport') }
globalThis.fetch = deny
http.request = deny
https.request = deny
net.Socket.prototype.connect = deny
syncBuiltinESMExports()
const helpers = []
for (const [label, relative] of [['BTL legacy', '../scraper/btlindia/nativePdf.js'], ['NITARA', '../scraper/nitaragormalonellp/nativePdf.js']]) {
  const url = new URL(relative, import.meta.url), { readNativePdf } = await import(url)
  helpers.push({ label, url: url.href, read: readNativePdf })
}
const reasons = ['null', 'false', 'zero', 'empty string', 'frozen error', 'native default']
const reasonFor = label => label === 'native default' ? AbortSignal.abort().reason : label === 'frozen error'
  ? Object.freeze(Error('Synthetic frozen caller reason')) : ({ null: null, false: false, zero: 0, 'empty string': '' })[label]
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const reflect = promise => promise.then(value => ({ ok: true, value }), reason => ({ ok: false, reason }))
const turn = () => new Promise(resolve => setImmediate(resolve))
const systemSetTimeout = globalThis.setTimeout, systemClearTimeout = globalThis.clearTimeout
const within = async promise => {
  let timer
  try { return await Promise.race([promise, new Promise(resolve => { timer = systemSetTimeout(() => resolve({ pending: true }), 40) })]) }
  finally { systemClearTimeout(timer) }
}
const page = () => ({ view: [0, 0, 100, 100],
  getTextContent: async () => ({ items: [{ str: 'Synthetic protocol text.', height: 10, transform: [10, 0, 0, 10, 10, 50], hasEOL: true }] }),
  getOperatorList: async () => ({ fnArray: [], argsArray: [] }) })
const document = () => ({ numPages: 1, getOptionalContentConfig: async () => new Map(),
  getPage: async () => page(), getMetadata: async () => ({ info: { Synthetic: true } }) })
const invoke = (helper, factory, signal) => { globalThis.__legacyPdfFactory = factory; return helper.read(sentinel, { signal }) }
const clock = t => {
  let elapsed = 0
  const jobs = [], active = new Set()
  t.mock.method(performance, 'now', () => elapsed)
  t.mock.method(globalThis, 'setTimeout', (callback, ms, ...args) => {
    if (ms !== 20000) return systemSetTimeout(callback, ms, ...args)
    const job = { callback, ms }; jobs.push(job); active.add(job); return job
  })
  t.mock.method(globalThis, 'clearTimeout', value => { if (!active.delete(value) && !jobs.includes(value)) systemClearTimeout(value) })
  return { jobs, active, set: value => { elapsed = value }, fire: () => { for (const job of [...active]) { active.delete(job); job.callback() } } }
}

for (const helper of helpers) {
  for (const label of reasons) {
    test(`${helper.label} pre-abort ${label} keeps identity without creating a task`, async () => {
      const reason = reasonFor(label), controller = new AbortController(); controller.abort(reason)
      let created = 0
      const result = await reflect(invoke(helper, () => { created++; assert.fail('Pre-abort must not create a PDF task') }, controller.signal))
      assert.equal(result.ok, false); assert.equal(result.reason, reason); assert.equal(created, 0)
    })
    test(`${helper.label} running abort ${label} survives rejected teardown and late task rejection`, async () => {
      const reason = reasonFor(label), cleanup = Object.freeze(Error('Synthetic cleanup failure')), controller = new AbortController()
      const entered = deferred(), loading = deferred(); let destroyed = 0
      const pending = reflect(invoke(helper, () => { entered.resolve(); return { promise: loading.promise,
        destroy: async () => { destroyed++; throw cleanup } } }, controller.signal))
      await entered.promise; controller.abort(reason)
      const result = await pending
      loading.reject(Object.freeze(Error('Synthetic late loading failure'))); await turn()
      assert.equal(result.ok, false); assert.equal(result.reason, reason); assert.equal(destroyed, 1)
    })
    test(`${helper.label} abort ${label} interrupts pending cleanup before its late success`, async () => {
      const reason = reasonFor(label), controller = new AbortController(), entered = deferred(), release = deferred(); let destroyed = 0
      const pending = reflect(invoke(helper, () => ({ promise: Promise.resolve(document()),
        destroy: () => { destroyed++; entered.resolve(); return release.promise } }), controller.signal))
      await entered.promise; controller.abort(reason)
      const early = await within(pending)
      release.resolve(); const final = await pending
      assert.equal(early.pending, undefined); assert.equal(early.ok, false); assert.equal(early.reason, reason)
      assert.equal(final.ok, false); assert.equal(final.reason, reason); assert.equal(destroyed, 1)
    })
    test(`${helper.label} late content after ${label} abort cannot start an operator read`, async () => {
      const reason = reasonFor(label), controller = new AbortController(), entered = deferred(), content = deferred(); let operators = 0, destroyed = 0
      const p = page(), ordinary = await p.getTextContent(), doc = document()
      p.getTextContent = () => { entered.resolve(); return content.promise }
      p.getOperatorList = async () => { operators++; return { fnArray: [], argsArray: [] } }
      doc.getPage = async () => p
      const pending = reflect(invoke(helper, () => ({ promise: Promise.resolve(doc), destroy: async () => { destroyed++ } }), controller.signal))
      await entered.promise; controller.abort(reason); const result = await pending
      content.resolve(ordinary); await turn(); await turn()
      assert.equal(result.ok, false); assert.equal(result.reason, reason); assert.equal(operators, 0); assert.equal(destroyed, 1)
    })
  }
  for (const [label, parser] of [['frozen error', Object.freeze(Error('Synthetic original parser failure'))], ['null', null], ['false', false], ['zero', 0], ['empty string', '']]) {
    test(`${helper.label} primary parser ${label} survives a different cleanup rejection`, async () => {
      const cleanup = Object.freeze(Error('Synthetic cleanup rejection')); let destroyed = 0
      const result = await reflect(invoke(helper, () => ({ promise: Promise.reject(parser), destroy: async () => { destroyed++; throw cleanup } })))
      assert.equal(result.ok, false); assert.equal(result.reason, parser); assert.equal(destroyed, 1)
    })
    test(`${helper.label} successful parse propagates cleanup ${label} identity`, async () => {
      let destroyed = 0
      const result = await reflect(invoke(helper, () => ({ promise: Promise.resolve(document()), destroy: async () => { destroyed++; throw parser } })))
      assert.equal(result.ok, false); assert.equal(result.reason, parser); assert.equal(destroyed, 1)
    })
  }
  test(`${helper.label} late loading resolution after abort does not inspect the document`, async () => {
    const controller = new AbortController(), entered = deferred(), loading = deferred(); let inspected = 0, destroyed = 0
    const pending = reflect(invoke(helper, () => { entered.resolve(); return { promise: loading.promise, destroy: async () => { destroyed++ } } }, controller.signal))
    await entered.promise; controller.abort(false); const result = await pending
    loading.resolve({ get numPages() { inspected++; return 1 } }); await turn(); await turn()
    assert.equal(result.reason, false); assert.equal(inspected, 0); assert.equal(destroyed, 1)
  })
  test(`${helper.label} one 20s deadline stays armed through stalled cleanup`, async t => {
    const time = clock(t), entered = deferred(), release = deferred(); let destroyed = 0
    const pending = reflect(invoke(helper, () => ({ promise: Promise.resolve(document()),
      destroy: () => { destroyed++; entered.resolve(); return release.promise } })))
    await entered.promise; time.set(20000); time.fire()
    const early = await within(pending)
    release.resolve(); await pending
    assert.equal(early.pending, undefined); assert.equal(early.ok, false)
    assert.equal(early.reason.message, 'Native PDF extraction deadline'); assert.equal(early.reason.abortRetries, true)
    assert.equal(time.jobs.length, 1); assert.equal(time.jobs[0].ms, 20000); assert.equal(time.active.size, 0); assert.equal(destroyed, 1)
  })
  for (const stage of ['initialization', 'promise getter', 'content', 'cleanup']) {
    test(`${helper.label} monotonic budget catches synchronous ${stage} overrun before timer dispatch`, async t => {
      const time = clock(t), doc = document(); let destroyed = 0, followups = 0
      doc.getOptionalContentConfig = async () => { followups++; return new Map() }
      if (stage === 'content') doc.getPage = async () => ({ ...page(), getTextContent: async () => { time.set(20001); return { items: [] } },
        getOperatorList: async () => { followups++; return { fnArray: [], argsArray: [] } } })
      const result = await reflect(invoke(helper, () => {
        if (stage === 'initialization') time.set(20001)
        return { get promise() { if (stage === 'promise getter') time.set(20001); return Promise.resolve(doc) },
          destroy: async () => { destroyed++; if (stage === 'cleanup') time.set(20001) } }
      }))
      assert.equal(result.ok, false); assert.equal(result.reason.message, 'Native PDF extraction deadline'); assert.equal(result.reason.abortRetries, true)
      assert.equal(destroyed, 1); assert.equal(time.jobs.length, 1); assert.equal(time.active.size, 0)
      if (stage === 'initialization' || stage === 'promise getter') assert.equal(followups, 0)
      if (stage === 'content') assert.equal(followups, 1, 'optional content only; no late operator read')
    })
  }
  for (const stage of ['initialization', 'promise getter', 'cleanup']) {
    test(`${helper.label} unsettled ${stage} promise cannot hide a synchronous elapsed deadline`, async t => {
      const time = clock(t), entered = deferred(), release = deferred(); let destroyed = 0
      const pending = reflect(invoke(helper, () => {
        if (stage === 'initialization') { time.set(20001); entered.resolve() }
        return { get promise() {
          if (stage === 'promise getter') { time.set(20001); entered.resolve() }
          return stage === 'cleanup' ? Promise.resolve(document()) : release.promise
        }, destroy: () => {
          destroyed++
          if (stage === 'cleanup') { time.set(20001); entered.resolve(); return release.promise }
          return Promise.resolve()
        } }
      }))
      await entered.promise
      const early = await within(pending)
      release.resolve(document()); await pending
      assert.equal(early.pending, undefined); assert.equal(early.ok, false)
      assert.equal(early.reason.message, 'Native PDF extraction deadline'); assert.equal(destroyed, 1); assert.equal(time.active.size, 0)
    })
  }
  test(`${helper.label} cleanup deadline cannot replace an earlier frozen parser error`, async t => {
    const time = clock(t), parser = Object.freeze(Error('Synthetic original parser failure')), entered = deferred(), release = deferred()
    const pending = reflect(invoke(helper, () => ({ promise: Promise.reject(parser), destroy: () => { entered.resolve(); return release.promise } })))
    await entered.promise; time.set(20000); time.fire()
    const early = await within(pending)
    release.reject(Object.freeze(Error('Synthetic late cleanup rejection'))); const final = await pending; await turn()
    assert.equal(early.pending, undefined); assert.equal(early.reason, parser); assert.equal(final.reason, parser); assert.equal(time.active.size, 0)
  })
  test(`${helper.label} ordinary success keeps the complete existing model and parser options`, async () => {
    const metadata = Object.freeze({ Title: 'Synthetic protocol title', CreationDate: 'D:20000101000000Z' }), doc = document(), p = page()
    doc.getOptionalContentConfig = async () => new Map([['inactive', { visible: false }]])
    p.getTextContent = async () => ({ items: [
      { str: 'Synthetic first line.', transform: [10, 0, 0, 10, 10, 50], height: 10, hasEOL: true },
      { str: 'Synthetic off-page line.', transform: [10, 0, 0, 10, 200, 200], height: 10, hasEOL: false },
    ] })
    p.getOperatorList = async () => ({ fnArray: [OPS.save, OPS.setTextRenderingMode, OPS.showText, OPS.restore], argsArray: [[], [3], [[]], []] })
    doc.getPage = async () => p; doc.getMetadata = async () => ({ info: metadata })
    let destroyed = 0, options
    const result = await invoke(helper, value => { options = value; return { promise: Promise.resolve(doc), destroy: async () => { destroyed++ } } })
    assert.deepEqual(result, { text: 'Synthetic first line.\n Synthetic off-page line.', pages: 1, visibilityQualified: false,
      visibilityLimits: ['inactive-optional-content', 'invisible-text-rendering', 'off-page-text'], documentMetadata: metadata, publicationDateQualified: false })
    assert.equal(result.documentMetadata, metadata); assert.equal(destroyed, 1)
    assert.deepEqual(Buffer.from(options.data), sentinel)
    assert.deepEqual(Object.keys(options).sort(), ['data', 'disableAutoFetch', 'isEvalSupported', 'standardFontDataUrl', 'useWorkerFetch', 'verbosity'])
    assert.equal(options.useWorkerFetch, false); assert.equal(options.isEvalSupported, false); assert.equal(options.disableAutoFetch, true); assert.equal(options.verbosity, 0)
    assert.match(options.standardFontDataUrl, /pdfjs-dist\/standard_fonts\/$/)
  })
}

const restricted = source => {
  const sourceReads=['package.json','scraper/btlindia/nativePdf.js','scraper/nitaragormalonellp/nativePdf.js','scraper-support/shared/pdfDisplay.js','node_modules/@napi-rs/canvas/package.json','node_modules/@napi-rs/canvas/geometry.js','node_modules/pdfjs-dist/package.json','node_modules/pdfjs-dist/legacy/build/pdf.mjs','node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'].map(name=>fileURLToPath(new URL(name,new URL('../',import.meta.url)))).concat([fileURLToPath(new URL('../../package.json',import.meta.url))])
  const result = spawnSync(process.execPath, ['--permission',...sourceReads.map(name=>'--allow-fs-read='+name),'--disallow-code-generation-from-strings', '--unhandled-rejections=strict', '--input-type=module', '--eval', source],
    { cwd: backend, env: { ...process.env, NODE_OPTIONS: '' }, encoding: 'utf8', timeout: 20000, windowsHide: true })
  assert.equal(result.error, undefined); assert.equal(result.status, 0, result.stderr || result.stdout)
}
test('restricted strict rejections observe reentrant aborts, late parser failures and late cleanup failures', () => {
  restricted(`import assert from'node:assert/strict';import{registerHooks}from'node:module';
   globalThis.fetch=()=>assert.fail('No HTTP');for(const name of ['node:http','node:https']){const m=(await import(name)).default;m.request=m.get=()=>assert.fail('No HTTP')}
   (await import('node:net')).default.Socket.prototype.connect=()=>assert.fail('No DB/network');
   registerHooks({resolve(s,c,n){return s==='pdfjs-dist/legacy/build/pdf.mjs'?{url:${JSON.stringify(mockURL)},shortCircuit:true}:n(s,c)}});
   const urls=${JSON.stringify(helpers.map(helper => helper.url))},reasonFor=${reasonFor.toString()},deferred=${deferred.toString()},reflect=${reflect.toString()},turn=${turn.toString()};
   for(const url of urls){const{readNativePdf}=await import(url);for(const label of ${JSON.stringify(reasons)}){
    const reason=reasonFor(label),caller=new AbortController();let destroyed=0;
    globalThis.__legacyPdfFactory=()=>{caller.abort(reason);return{promise:Promise.reject(Error('Synthetic late parser rejection')),destroy:async()=>{destroyed++;throw Error('Synthetic cleanup rejection')}}};
    const result=await reflect(readNativePdf(Buffer.from('%PDF-1.7 synthetic'),{signal:caller.signal}));assert.equal(result.ok,false);assert.equal(result.reason,reason);assert.equal(destroyed,1);await turn();
   }
    const caller=new AbortController(),loading=deferred(),cleanup=deferred(),cleaning=deferred();let destroyed=0;
    globalThis.__legacyPdfFactory=()=>({promise:loading.promise,destroy:()=>{destroyed++;cleaning.resolve();return cleanup.promise}});
    const pending=reflect(readNativePdf(Buffer.from('%PDF-1.7 synthetic'),{signal:caller.signal}));await turn();caller.abort(false);await cleaning.promise;
    const early=await Promise.race([pending,new Promise(resolve=>setTimeout(()=>resolve({pending:true}),40))]);
    cleanup.reject(Error('Synthetic late cleanup rejection'));loading.reject(Error('Synthetic late task rejection'));const final=await pending;await turn();await turn();
    assert.equal(early.pending,undefined);assert.equal(early.reason,false);assert.equal(final.reason,false);assert.equal(destroyed,1);
   }
   for(const name of ['addons','worker','child'])assert.equal(process.permission.has(name),false);const geometry=await import('@napi-rs/canvas/geometry.js');assert.equal(globalThis.DOMMatrix,geometry.DOMMatrix);`)
})
test('restricted native display import remains the original cached capability failure', () => {
  restricted(`import assert from'node:assert/strict';globalThis.fetch=()=>assert.fail('No HTTP');let original,repeated;
   try{await import('pdfjs-dist/legacy/build/pdf.mjs')}catch(error){original=error}try{await import('pdfjs-dist/legacy/build/pdf.mjs')}catch(error){repeated=error}
   assert.ok(original instanceof ReferenceError);assert.equal(original.message,'DOMMatrix is not defined');assert.equal(original,repeated);
   for(const url of ${JSON.stringify(helpers.map(helper => helper.url))}){let actual;try{await import(url)}catch(error){actual=error}assert.equal(actual,original)}
   for(const name of ['addons','worker','child'])assert.equal(process.permission.has(name),false);const geometry=await import('@napi-rs/canvas/geometry.js');assert.equal(globalThis.DOMMatrix,geometry.DOMMatrix);`)
})
test('synthetic lifecycle suite performed no actual network operation', () => assert.equal(networkAttempts, 0))
