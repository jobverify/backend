import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { EventEmitter, getEventListeners } from 'node:events'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { enrichJobWithPublicExperience, enrichJobsWithPublicExperience } from '../scraper-support/utils/publicExperienceEnrichment.js'
import { fetchVerifiedHttpsPage } from '../scraper-support/utils/verifiedHttps.js'

// All pages, provider responses and transports below are synthetic offline controls.
const origin = 'https://careers.example.test'
const role = () => ({ title: 'Platform Engineer', company: 'Synthetic Employer', jobId: 'R100',
  sourceUrl: `${origin}/jobs/R100`, sourceDescription: null, jobDescription: null })
const description = '<p>Job Description: Design distributed services, maintain production cloud systems and improve service reliability.</p>'
  + '<p>Requirements: at least 5 years of software engineering experience, practical database skills and reliable service delivery.</p>'
const html = (url = role().sourceUrl) => '<html><body><h1>Platform Engineer</h1>'
  + `<script type="application/ld+json">${JSON.stringify({ '@type': 'JobPosting', title: 'Platform Engineer',
    hiringOrganization: { name: 'Synthetic Employer' }, url, description })}</script></body></html>`
const page = (url, body = html(url)) => ({ status: 200, url, html: body })
const cases = () => [['null', null], ['false', false], ['zero', 0], ['empty string', ''],
  ['frozen error', Object.freeze(new Error('caller stopped synthetic request'))], ['native default', undefined]]
const abort = (controller, reason) => { controller.abort(reason); return controller.signal.reason }
const rejectionIs = async (pending, reason) => {
  const result = await pending.then(value => ({ rejected: false, value }), value => ({ rejected: true, value }))
  assert.equal(result.rejected, true, 'cancellation must reject rather than return a job or page')
  assert.equal(result.value, reason, 'the caller reason must retain its exact identity')
}
const run = (bulk, job, options) => bulk
  ? enrichJobsWithPublicExperience([job, { ...role(), jobId: 'R101', sourceUrl: `${origin}/jobs/R101` }],
    { concurrency: 1, useBrowserFallback: false, ...options })
  : enrichJobWithPublicExperience(job, options)
const timers = t => {
  const pending = new Set(), nativeSet = globalThis.setTimeout, nativeClear = globalThis.clearTimeout
  t.mock.method(globalThis, 'setTimeout', (callback, delay, ...args) => {
    const id = nativeSet(() => { pending.delete(id); callback(...args) }, delay)
    pending.add(id)
    return id
  })
  t.mock.method(globalThis, 'clearTimeout', id => { pending.delete(id); nativeClear(id) })
  t.after(() => { for (const id of pending) nativeClear(id) })
  return pending
}

for (const bulk of [false, true]) {
  const api = bulk ? 'bulk' : 'single'
  for (const [label, supplied] of cases()) {
    test(`${api} enrichment preserves a pre-aborted ${label} reason without fetching`, async () => {
      const controller = new AbortController(), reason = abort(controller, supplied)
      await rejectionIs(run(bulk, role(), { signal: controller.signal,
        fetchText: async () => assert.fail('pre-aborted enrichment must not fetch'),
        fetchBrowserText: async () => assert.fail('pre-aborted enrichment must not use a browser') }), reason)
    })

    test(`${api} enrichment preserves ${label} cancellation when a raw transport rejects differently`, async () => {
      const controller = new AbortController()
      let calls = 0
      const pending = run(bulk, role(), { signal: controller.signal, fetchText: async () => {
        calls += 1
        abort(controller, supplied)
        throw new Error('transport replaced the caller cancellation')
      }, fetchBrowserText: async () => assert.fail('cancelled raw fetch must not start fallback') })
      await rejectionIs(pending, controller.signal.reason)
      assert.equal(calls, 1, 'a cancelled batch must not advance to another job')
    })

    test(`${api} default fetch links the exact ${label} reason and disposes its timer and listener`, async t => {
      const controller = new AbortController(), scheduled = timers(t)
      let linked, release
      t.mock.method(globalThis, 'fetch', async (_url, options) => {
        linked = options.signal
        return new Promise((_, reject) => { release = reject })
      })
      const pending = run(bulk, role(), { signal: controller.signal, fetchTimeoutMs: 1000 })
      assert.ok(linked, 'default transport must receive a request signal')
      assert.equal(getEventListeners(controller.signal, 'abort').length, 1)
      const reason = abort(controller, supplied)
      const linkedReason = linked.reason
      release(new Error('transport used its own abort error'))
      await rejectionIs(pending, reason)
      assert.equal(linkedReason, reason, 'the child request must receive the caller reason')
      assert.equal(getEventListeners(controller.signal, 'abort').length, 0)
      assert.equal(scheduled.size, 0, 'the request deadline must be cleared')
    })
  }

  test(`${api} enrichment rejects a late raw success after cancellation`, async () => {
    const controller = new AbortController(), reason = Object.freeze(new Error('cancel raw body'))
    let calls = 0
    await rejectionIs(run(bulk, role(), { signal: controller.signal, fetchText: async url => {
      calls += 1
      controller.abort(reason)
      return page(url)
    } }), reason)
    assert.equal(calls, 1)
  })

  test(`${api} enrichment rejects a late embedded success after cancellation`, async () => {
    const controller = new AbortController(), reason = Object.freeze(new Error('cancel embedded body'))
    const child = 'https://boards.greenhouse.io/synthetic/jobs/100'
    const calls = []
    await rejectionIs(run(bulk, role(), { signal: controller.signal, fetchText: async url => {
      calls.push(url)
      if (url === role().sourceUrl) return page(url, `<html><body><iframe src="${child}"></iframe></body></html>`)
      assert.equal(url, child)
      controller.abort(reason)
      return page(url)
    } }), reason)
    assert.deepEqual(calls, [role().sourceUrl, child])
  })

  for (const phase of bulk ? ['browser body', 'browser retry'] : ['browser acquisition', 'browser body', 'browser retry']) {
    test(`${api} enrichment observes cancellation after ${phase}`, async () => {
      const controller = new AbortController(), reason = Object.freeze(new Error(`cancel ${phase}`))
      let browserCalls = 0
      const fetchBrowserText = async url => {
        browserCalls += 1
        if (phase === 'browser retry' && browserCalls === 1) return '<html>awswafcookiedomainlist</html>'
        controller.abort(reason)
        return page(url)
      }
      const options = { signal: controller.signal, fetchText: async () => '<html></html>',
        ...(phase === 'browser acquisition' && !bulk
          ? { getBrowserText: async () => { controller.abort(reason); return null } }
          : { fetchBrowserText }) }
      await rejectionIs(run(bulk, role(), options), reason)
      assert.equal(browserCalls, phase === 'browser acquisition' && !bulk ? 0 : phase === 'browser retry' ? 2 : 1)
    })
  }
}

test('an empty bulk enrichment still observes pre-aborted cancellation', async () => {
  await rejectionIs(enrichJobsWithPublicExperience([], { signal: AbortSignal.abort(false) }), false)
})

test('default provider JSON links caller cancellation without swallowing its falsy reason', async t => {
  const controller = new AbortController(), scheduled = timers(t), calls = []
  let linked
  const job = { ...role(), sourceUrl: 'https://synthetic.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/R100' }
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push(url)
    if (calls.length === 1) return { ok: true, status: 200, url, headers: new Headers(), text: async () => '<html></html>' }
    assert.match(url, /recruitingCEJobRequisitionDetails/)
    linked = options.signal
    controller.abort(null)
    throw new Error('provider transport replaced abort')
  })
  await rejectionIs(enrichJobWithPublicExperience(job, { signal: controller.signal, fetchTimeoutMs: 1000 }), null)
  assert.equal(calls.length, 2)
  assert.equal(linked.reason, null)
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0)
  assert.equal(scheduled.size, 0)
})

test('successful enrichment clears linked resources and a later abort cannot change its result', async t => {
  const controller = new AbortController(), scheduled = timers(t)
  let linked
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    linked = options.signal
    return { ok: true, status: 200, url, headers: new Headers(), text: async () => html(url) }
  })
  const result = await enrichJobWithPublicExperience(role(), { signal: controller.signal, fetchTimeoutMs: 1000 })
  assert.equal(result.publicExperienceChecked, true)
  assert.equal(result.sourceDescription, description)
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0)
  assert.equal(scheduled.size, 0)
  controller.abort(false)
  assert.equal(linked.aborted, false, 'completed child request must be detached from later cancellation')
  assert.equal(result.sourceDescription, description)
})

const response = () => {
  const stream = new EventEmitter()
  stream.statusCode = 200
  stream.headers = {}
  stream.destroyedCount = 0
  stream.destroy = () => { stream.destroyedCount += 1; stream.emit('close') }
  return stream
}
const transport = ({ onCreate, onEnd } = {}) => {
  const state = { ends: 0, destroyed: [] }
  state.request = (url, options, callback) => {
    assert.equal(url, `${origin}/`)
    assert.equal(options.rejectUnauthorized, true)
    const handle = new EventEmitter()
    handle.end = () => { state.ends += 1; onEnd?.(callback) }
    handle.destroy = reason => { state.destroyed.push(reason); handle.emit('error', reason) }
    onCreate?.(callback)
    return handle
  }
  return state
}
const httpsPage = (request, signal) => fetchVerifiedHttpsPage(origin, {
  allowedOrigins: [origin], request, signal, timeoutMs: 1000,
})

for (const [label, supplied] of cases()) {
  test(`verified HTTPS preserves pre-aborted ${label} identity before creating a request`, async () => {
    const controller = new AbortController(), reason = abort(controller, supplied)
    await rejectionIs(httpsPage(() => assert.fail('pre-aborted request must not start'), controller.signal), reason)
  })

  test(`verified HTTPS preserves in-flight ${label} identity and destroys both streams once`, async t => {
    const controller = new AbortController(), incoming = response(), scheduled = timers(t)
    const state = transport({ onEnd: callback => callback(incoming) })
    const pending = httpsPage(state.request, controller.signal)
    assert.equal(state.ends, 1)
    const reason = abort(controller, supplied)
    await rejectionIs(pending, reason)
    assert.deepEqual(state.destroyed, [reason])
    assert.equal(incoming.destroyedCount, 1)
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0)
    assert.equal(scheduled.size, 0)
    incoming.emit('data', 'late data')
    incoming.emit('end')
    incoming.emit('error', new Error('late response error'))
    assert.equal(incoming.destroyedCount, 1, 'late events must not repeat terminal cleanup')
  })

  test(`verified HTTPS cleans up ${label} cancellation during a synchronous request callback`, async t => {
    const controller = new AbortController(), incoming = response(), scheduled = timers(t)
    const state = transport({ onCreate: callback => { callback(incoming); abort(controller, supplied) } })
    const pending = httpsPage(state.request, controller.signal)
    await rejectionIs(pending, controller.signal.reason)
    assert.deepEqual(state.destroyed, [controller.signal.reason], 'a returned handle must be destroyed even after synchronous abort')
    assert.equal(incoming.destroyedCount, 1)
    assert.equal(state.ends, 0, 'cancelled synchronous setup must not start the request body')
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0)
    assert.equal(scheduled.size, 0)
  })
}

for (const reason of [null, false, 0, '', undefined]) {
  test(`verified HTTPS rejects a synchronous transport throw of ${String(reason)} exactly`, async t => {
    const scheduled = timers(t)
    await rejectionIs(httpsPage(() => { throw reason }), reason)
    assert.equal(scheduled.size, 0)
  })

  test(`verified HTTPS rejects a falsy response error of ${String(reason)} exactly`, async t => {
    const incoming = response(), scheduled = timers(t)
    const state = transport({ onCreate: callback => { callback(incoming); incoming.emit('error', reason) } })
    await rejectionIs(httpsPage(state.request), reason)
    assert.deepEqual(state.destroyed, [reason])
    assert.equal(incoming.destroyedCount, 1)
    assert.equal(state.ends, 0)
    assert.equal(scheduled.size, 0)
  })
}

test('successful verified HTTPS clears resources and ignores cancellation after completion', async t => {
  const controller = new AbortController(), incoming = response(), scheduled = timers(t)
  const state = transport({ onEnd: callback => { callback(incoming); incoming.emit('data', 'complete'); incoming.emit('end') } })
  const result = await httpsPage(state.request, controller.signal)
  assert.equal(result.html, 'complete')
  assert.equal(result.status, 200)
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0)
  assert.equal(scheduled.size, 0)
  controller.abort(false)
  assert.deepEqual(state.destroyed, [])
  assert.equal(incoming.destroyedCount, 0)
  assert.equal(result.html, 'complete')
})

test('synchronous successful HTTPS response is returned without starting a completed request', async () => {
  const incoming = response()
  const state = transport({ onCreate: callback => { callback(incoming); incoming.emit('data', 'complete'); incoming.emit('end') } })
  const result = await httpsPage(state.request)
  assert.equal(result.html, 'complete')
  assert.equal(state.ends, 0)
})

test('a late HTTPS response callback after cancellation is destroyed without reading its body', async () => {
  const controller = new AbortController(), incoming = response()
  let callback
  const state = transport({ onCreate: created => { callback = created } })
  const pending = httpsPage(state.request, controller.signal)
  controller.abort(false)
  callback(incoming)
  await rejectionIs(pending, false)
  assert.equal(incoming.destroyedCount, 1)
  assert.equal(incoming.listenerCount('data'), 0, 'a cancelled response must not begin collecting a body')
})

for (const stage of ['body', 'acquisition', 'close']) test(`synthetic browser session ${stage} cancellation is preserved with runtime cleanup`, () => {
  const backend = fileURLToPath(new URL('../', import.meta.url))
  const helper = new URL('../scraper-support/utils/publicExperienceEnrichment.js', import.meta.url).href
  const script = `
    import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
    const stage=${JSON.stringify(stage)},controller=new AbortController(),reason=stage==='close'?0:stage==='acquisition'?'':Object.freeze(Error('synthetic browser cancellation'));
    const state={stage,controller,reason,opened:0,closed:0,raw:0,browser:0};globalThis.syntheticCancellation=state;
    const moduleSource="export const createBrowserFetchSession=async()=>{const state=globalThis.syntheticCancellation;state.opened++;if(state.stage==='acquisition')state.controller.abort(state.reason);return{fetchPage:async url=>{state.browser++;if(state.stage==='body')state.controller.abort(state.reason);return{status:200,url,html:'<html></html>'}},close:async()=>{state.closed++;if(state.stage==='close')state.controller.abort(state.reason)}}}";
    registerHooks({resolve(specifier,context,next){if(specifier==='../shared/browserFetch.js'&&context.parentURL===${JSON.stringify(helper)})return{url:'data:text/javascript,'+encodeURIComponent(moduleSource),shortCircuit:true};return next(specifier,context)}});
    globalThis.fetch=async()=>assert.fail('offline synthetic control forbids network');
    const {enrichJobsWithPublicExperience}=await import(${JSON.stringify(helper)});
    const result=await enrichJobsWithPublicExperience(${JSON.stringify([role(), role()])},{concurrency:1,signal:controller.signal,fetchText:async()=>{state.raw++;return '<html></html>'}}).then(value=>({rejected:false,value}),value=>({rejected:true,value}));
    assert.equal(result.rejected,true);assert.equal(result.value,reason);assert.equal(state.opened,1);assert.equal(state.closed,1);assert.equal(state.browser,stage==='acquisition'?0:stage==='close'?2:1);assert.equal(state.raw,stage==='close'?2:1);
  `
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
    cwd: backend, encoding: 'utf8', timeout: 10000, windowsHide: true,
  })
  assert.equal(result.error, undefined)
  assert.equal(result.status, 0, result.stderr || result.stdout)
})
