import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { getEventListeners } from 'node:events'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { runBlackRockEarlyCareers } from '../scraper-support/shared/blackrockTalnet.js'
import { createAshbyPairNativeScraper } from '../scraper-support/shared/ashbyPairNative20261027.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

// Every new page, role, database model and transport here is a synthetic offline
// control. No control represents a captured employer inventory or native criteria.
const cases = () => [['null', null], ['false', false], ['zero', 0], ['empty string', ''],
  ['frozen error', Object.freeze(new Error('synthetic caller cancellation'))], ['native default', undefined]]
const reasonSource = label => ({ null: 'null', false: 'false', zero: '0', 'empty string': "''",
  'frozen error': "Object.freeze(new Error('synthetic caller cancellation'))", 'native default': 'undefined' })[label]
const rejectionIs = async (pending, reason) => {
  const actual = await pending.then(value => ({ rejected: false, value }), value => ({ rejected: true, value }))
  assert.equal(actual.rejected, true, 'cancelled work must reject rather than return jobs or success')
  assert.equal(actual.value, reason, 'the exact caller cancellation reason must survive')
}
const trackTimers = t => {
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
const backend = fileURLToPath(new URL('../', import.meta.url))
const persistenceURL = new URL('../scraper-support/utils/saveToDB.js', import.meta.url).href
const syntheticRole = { title: 'Platform Engineer', company: 'Synthetic Employer', source: 'synthetic-cancel',
  location: 'Bengaluru, India', country: 'India', sourceUrl: 'https://employer.example.test/roles/100',
  applyUrl: 'https://employer.example.test/roles/100', sourceDescription: 'Design reliable services and maintain customer interfaces.' }
const persistenceControl = body => {
  // Preserve real normalization, filtering, stage and alert-disabled persistence
  // logic. Replace only the call-time database connection and lazy Job import.
  const script = `
    import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {registerHooks} from 'node:module';
    const state={connectionImports:0,connects:0,modelImports:0,modelLoads:0,writes:0};globalThis.syntheticPersistenceCancellation=state;
    state.model={bulkWrite:async operations=>{state.writes++;return state.bulk?await state.bulk(operations):{upsertedCount:operations.length,modifiedCount:0}}};
    const connectionSource="export default async()=>{const state=globalThis.syntheticPersistenceCancellation;state.connects++;return await state.onConnect?.()}";
    const modelSource="const state=globalThis.syntheticPersistenceCancellation;state.modelLoads++;await state.onModel?.();export default state.model";
    registerHooks({resolve(specifier,context,next){
      if(context.parentURL===${JSON.stringify(persistenceURL)}&&specifier==='../../db/db.js'){state.connectionImports++;return{url:'data:text/javascript,'+encodeURIComponent(connectionSource),shortCircuit:true}}
      if(context.parentURL===${JSON.stringify(persistenceURL)}&&specifier==='../../src/models/Job.js'){state.modelImports++;return{url:'data:text/javascript,'+encodeURIComponent(modelSource),shortCircuit:true}}
      return next(specifier,context)
    }});
    const {default:mongoose}=await import('mongoose');assert.equal(mongoose.connection.readyState,0);assert.equal(mongoose.connection.db,undefined);
    mongoose.connect=async()=>assert.fail('Actual database connection forbidden');globalThis.fetch=async()=>assert.fail('Network forbidden');
    const {saveToDB,saveDryRunSnapshot}=await import(${JSON.stringify(persistenceURL)});
    const role=${JSON.stringify(syntheticRole)},options={enrichPublicExperience:false,descriptionRewriteMode:'off',replaceExisting:false,refreshDatasetSummary:false,enqueueAlerts:false};
    const rejectionIs=${rejectionIs.toString()};
    ${body}
    assert.equal(mongoose.connection.readyState,0);assert.equal(mongoose.connection.db,undefined);
  `
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
    cwd: backend, encoding: 'utf8', timeout: 10000, windowsHide: true,
  })
  assert.equal(result.error, undefined)
  assert.equal(result.status, 0, result.stderr || result.stdout)
}

for (const [label] of cases()) {
  test(`pre-aborted saveToDB ${label} cancellation precedes all call-time connection and model effects`, () => {
    persistenceControl(`
      const controller=new AbortController();controller.abort(${reasonSource(label)});
      await rejectionIs(saveToDB([role],'synthetic-cancel',{...options,signal:controller.signal}),controller.signal.reason);
      assert.equal(state.connectionImports,0);assert.equal(state.connects,0);assert.equal(state.modelImports,0);assert.equal(state.modelLoads,0);assert.equal(state.writes,0);
    `)
  })

  for (const phase of ['connection', 'model']) for (const outcome of ['resolve', 'reject']) {
    test(`saveToDB retains ${label} cancellation when ${phase} startup ${outcome}s`, () => {
      persistenceControl(`
        const controller=new AbortController(),reason=AbortSignal.abort(${reasonSource(label)}).reason,replacement=Object.freeze(Error('startup replaced cancellation'));
        state.${phase === 'connection' ? 'onConnect' : 'onModel'}=async()=>{controller.abort(reason);${outcome === 'reject' ? 'throw replacement' : ''}};
        await rejectionIs(saveToDB([role],'synthetic-cancel',{...options,signal:controller.signal}),reason);
        assert.equal(state.connects,1);assert.equal(state.modelImports,${phase === 'connection' ? 0 : 1});assert.equal(state.modelLoads,${phase === 'connection' ? 0 : 1});assert.equal(state.writes,0);
      `)
    })
  }

  for (const outcome of ['resolve', 'reject']) {
    test(`saveToDB stage ${outcome} preserves ${label} cancellation from synthetic bulk persistence`, () => {
      persistenceControl(`
        const controller=new AbortController(),reason=AbortSignal.abort(${reasonSource(label)}).reason,stages=[],replacement=Object.freeze(Error('bulk operation replaced cancellation'));
        state.bulk=async()=>{controller.abort(reason);${outcome === 'reject' ? 'throw replacement' : 'return {upsertedCount:1,modifiedCount:0}'}};
        await rejectionIs(saveToDB([role],'synthetic-cancel',{...options,signal:controller.signal,onStage:event=>stages.push(event.stage+':'+event.status)}),reason);
        assert.equal(state.writes,1);assert.ok(stages.includes('bulkWrite:error'));assert.equal(stages.includes('bulkWrite:done'),false);
      `)
    })
  }

  test(`a pre-aborted dry-run snapshot preserves ${label} and creates no output`, () => {
    persistenceControl(`
      const directory=fs.mkdtempSync(path.join(os.tmpdir(),'synthetic-source-cancel-')),output=path.join(directory,'snapshot.json'),controller=new AbortController();
      controller.abort(${reasonSource(label)});
      try{await rejectionIs(saveDryRunSnapshot([role],output,{...options,signal:controller.signal}),controller.signal.reason);assert.equal(fs.existsSync(output),false)}finally{fs.rmSync(output,{force:true});fs.rmdirSync(directory)}
      assert.equal(state.connectionImports,0);assert.equal(state.modelImports,0);assert.equal(state.writes,0);
    `)
  })
}

for (const [label] of [['false'], ['frozen error']]) {
  test(`dry-run terminal stage callback cannot hide ${label} cancellation`, () => {
    persistenceControl(`
      const directory=fs.mkdtempSync(path.join(os.tmpdir(),'synthetic-source-cancel-')),output=path.join(directory,'snapshot.json'),controller=new AbortController(),reason=AbortSignal.abort(${reasonSource(label)}).reason;
      try{await rejectionIs(saveDryRunSnapshot([role],output,{...options,signal:controller.signal,onStage:event=>{if(event.stage==='snapshot write'&&event.status==='done')controller.abort(reason)}}),reason)}finally{fs.rmSync(output,{force:true});fs.rmdirSync(directory)}
      assert.equal(state.connectionImports,0);assert.equal(state.modelImports,0);
    `)
  })
}

test('uncancelled synthetic persistence retains normal save and stage completion behavior', () => {
  persistenceControl(`
    const stages=[],result=await saveToDB([role],'synthetic-cancel',{...options,onStage:event=>stages.push(event.stage+':'+event.status)});
    assert.equal(result.inserted,1);assert.equal(state.connects,1);assert.equal(state.modelLoads,1);assert.equal(state.writes,1);assert.ok(stages.includes('bulkWrite:done'));
  `)
})

test('uncancelled startup failures retain their original identity', () => {
  persistenceControl(`
    const failure=Object.freeze(Error('synthetic startup failure'));state.onConnect=async()=>{throw failure};
    await rejectionIs(saveToDB([role],'synthetic-cancel',options),failure);assert.equal(state.modelImports,0);assert.equal(state.writes,0);
  `)
})

for (const [label, supplied] of cases()) {
  test(`BlackRock pre-aborted ${label} cancellation starts no transport and leaves no resources`, async t => {
    const controller = new AbortController(), scheduled = trackTimers(t)
    controller.abort(supplied)
    await rejectionIs(runBlackRockEarlyCareers({ signal: controller.signal, timeoutMs: 1000,
      fetchText: async () => assert.fail('cancelled scope must not fetch') }), controller.signal.reason)
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0)
    assert.equal(scheduled.size, 0)
  })

  test(`BlackRock in-flight ${label} cancellation settles an uncooperative transport exactly`, async t => {
    const controller = new AbortController(), scheduled = trackTimers(t)
    let started, release, linked
    const admitted = new Promise(resolve => { started = resolve })
    const pending = runBlackRockEarlyCareers({ signal: controller.signal, timeoutMs: 1000,
      fetchText: async (_url, options) => { linked = options.signal; started(); return new Promise(resolve => { release = resolve }) } })
    await admitted
    controller.abort(supplied)
    await rejectionIs(pending, controller.signal.reason)
    assert.equal(linked.reason, controller.signal.reason)
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0)
    assert.equal(getEventListeners(linked, 'abort').length, 0)
    assert.equal(scheduled.size, 0)
    release('<html>late synthetic transport body</html>')
    await Promise.resolve()
  })

  test(`BlackRock queued transport cannot start after immediate ${label} cancellation`, async () => {
    const controller = new AbortController()
    let calls = 0
    const pending = runBlackRockEarlyCareers({ signal: controller.signal, timeoutMs: 1000,
      fetchText: async () => { calls += 1; return '<html>late synthetic body</html>' } })
    controller.abort(supplied)
    await rejectionIs(pending, controller.signal.reason)
    assert.equal(calls, 0)
  })

  test(`BlackRock default HTTP does not read a response body after ${label} header cancellation`, async t => {
    const controller = new AbortController(), reason = AbortSignal.abort(supplied).reason
    let bodies = 0, calls = 0
    t.mock.method(globalThis, 'fetch', async url => {
      calls += 1
      controller.abort(reason)
      return { status: 503, url, text: async () => { bodies += 1; return '<html>synthetic unavailable</html>' } }
    })
    await rejectionIs(runBlackRockEarlyCareers({ signal: controller.signal, timeoutMs: 1000 }), reason)
    assert.equal(calls, 1)
    assert.equal(bodies, 0)
  })
}

test('BlackRock ordinary HTTP failure still rejects without certifying an inventory', async () => {
  await assert.rejects(runBlackRockEarlyCareers({ timeoutMs: 1000,
    fetchText: async () => ({ status: 503, finalURL: 'https://careers.blackrock.com/students-and-graduates-apac', body: '<html>synthetic unavailable</html>' }) }), /Native HTTP request failed/)
})

const spec = { source: 'synthetic-cancel', company: 'Synthetic Employer', domain: 'employer.example.test',
  token: 'synthetic-cancel', careersUrl: 'https://employer.example.test/careers' }
const boardURL = `https://jobs.ashbyhq.com/${spec.token}`
const apiURL = `https://api.ashbyhq.com/posting-api/job-board/${spec.token}`
const corporateHTML = `<html><body>${spec.company}<script>const endpoint="${apiURL}";</script></body></html>`
const boardHTML = organization => `<html><script>window.__appData = ${JSON.stringify({ organization: organization ?? {
  name: spec.company, hostedJobsPageSlug: spec.token, publicWebsite: 'https://employer.example.test',
  organizationId: 'synthetic-org', isDemoOrg: false }, jobBoard: { jobPostings: [] } })}</script></html>`
const feed = { apiVersion: '1', jobs: [], total: 0 }
const phases = ['opening corporate', 'opening board', 'opening feed', 'closing board', 'closing feed', 'closing corporate']
const sequence = [spec.careersUrl, boardURL, apiURL, boardURL, apiURL, spec.careersUrl]
const bodyFor = url => url === spec.careersUrl ? corporateHTML : url === boardURL ? boardHTML() : JSON.stringify(feed)
const scraper = () => createAshbyPairNativeScraper(spec)

for (const [label, supplied] of cases()) {
  test(`Ashby pre-aborted ${label} cancellation precedes every HTTP request`, async t => {
    const controller = new AbortController()
    controller.abort(supplied)
    let calls = 0
    t.mock.method(globalThis, 'fetch', async () => { calls += 1; throw new Error('HTTP must not start') })
    await rejectionIs(scraper().run({ signal: controller.signal }), controller.signal.reason)
    assert.equal(calls, 0)
  })

  for (const mode of ['late success', 'replacement rejection']) {
    test(`Ashby injected ${mode} preserves ${label} cancellation before another route`, async () => {
      const controller = new AbortController(), reason = AbortSignal.abort(supplied).reason
      let calls = 0
      await rejectionIs(scraper().run({ signal: controller.signal, fetchText: async url => {
        calls += 1
        assert.equal(url, spec.careersUrl)
        controller.abort(reason)
        if (mode === 'replacement rejection') throw new Error('transport replaced cancellation')
        return corporateHTML
      }, fetchJson: async () => assert.fail('cancelled text request must not begin JSON') }), reason)
      assert.equal(calls, 1)
    })
  }

  for (const status of [404, 503]) {
    test(`Ashby default HTTP ${status} preserves ${label} header cancellation without reading the body`, async t => {
      const controller = new AbortController(), reason = AbortSignal.abort(supplied).reason
      let bodies = 0, calls = 0
      t.mock.method(globalThis, 'fetch', async url => {
        calls += 1
        controller.abort(reason)
        return { ok: false, status, url, text: async () => { bodies += 1; return '<html>synthetic unavailable</html>' } }
      })
      await rejectionIs(scraper().run({ signal: controller.signal }), reason)
      assert.equal(calls, 1)
      assert.equal(bodies, 0)
    })
  }

  test(`Ashby default JSON transport cannot replace ${label} cancellation`, async t => {
    const controller = new AbortController(), reason = AbortSignal.abort(supplied).reason
    let calls = 0
    t.mock.method(globalThis, 'fetch', async url => {
      assert.equal(url, sequence[calls++])
      if (url === apiURL) { controller.abort(reason); throw new Error('JSON transport replaced cancellation') }
      return { ok: true, status: 200, url, text: async () => bodyFor(url) }
    })
    await rejectionIs(scraper().run({ signal: controller.signal }), reason)
    assert.equal(calls, 3)
  })
}

for (let phase = 0; phase < phases.length; phase += 1) for (const [label, supplied] of [['false', false], ['frozen error', Object.freeze(new Error('cancel late synthetic body'))]]) {
  test(`Ashby ${phases[phase]} late body preserves ${label} cancellation`, async t => {
    const controller = new AbortController()
    let calls = 0
    t.mock.method(globalThis, 'fetch', async url => {
      const current = calls++
      assert.equal(url, sequence[current])
      return { ok: true, status: 200, url, text: async () => {
        if (current === phase) controller.abort(supplied)
        return bodyFor(url)
      } }
    })
    await rejectionIs(scraper().run({ signal: controller.signal }), supplied)
    assert.equal(calls, phase + 1, 'cancelled collection must not start another route')
  })
}

for (const callback of ['clock', 'audit']) for (const [label, supplied] of [['false', false], ['frozen error', Object.freeze(new Error('cancel synthetic completion'))]]) {
  test(`Ashby final ${callback} callback preserves ${label} cancellation`, async () => {
    const controller = new AbortController()
    let audits = 0
    await rejectionIs(scraper().run({ signal: controller.signal,
      fetchText: async url => bodyFor(url), fetchJson: async () => structuredClone(feed),
      now: () => { if (callback === 'clock') controller.abort(supplied); return '2026-11-11T00:00:00.000Z' },
      onNativeAudit: () => { audits += 1; if (callback === 'audit') controller.abort(supplied) },
    }), supplied)
    assert.equal(audits, callback === 'clock' ? 0 : 1)
  })
}

test('an uncancelled synthetic Ashby protocol retains success with every proof channel checked', async () => {
  const calls = []
  const jobs = await scraper().run({ fetchText: async url => { calls.push(url); return bodyFor(url) },
    fetchJson: async url => { calls.push(url); return structuredClone(feed) }, now: () => '2026-11-11T00:00:00.000Z' })
  assert.deepEqual(calls, sequence)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true, 'this assertion describes only the synthetic protocol')
})

test('synthetic Ashby employer mismatch still rejects its native proof', async () => {
  await assert.rejects(scraper().run({ fetchText: async url => url === boardURL ? boardHTML({ name: 'Wrong synthetic organization' }) : bodyFor(url),
    fetchJson: async () => structuredClone(feed) }), /native-board-employer-mismatch/)
})

test('uncancelled Ashby HTTP denial remains a terminal HTTP failure', async t => {
  t.mock.method(globalThis, 'fetch', async url => ({ ok: false, status: 403, url, text: async () => '<html>synthetic denied</html>' }))
  await assert.rejects(scraper().run(), error => error.status === 403 && error.abortRetries === true)
})
