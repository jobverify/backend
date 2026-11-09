import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { runWorkdayScraper } from '../myworkday/engine.js'
import { WorkdayRequestScheduler } from '../myworkday/requestScheduler.js'
import { createPhenomScraper } from '../phenom/engine.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { runScraperWithTimeout } from '../runner.js'
import { buildScrapers } from '../providers/index.js'
import { readNativeDetailReceipt, rememberNativeDetailReceipt, runWithNativeDetailRecovery } from '../utils/nativeDetailRecovery.js'

const session = () => ({ receipts: new Map(), pending: 0, progress: 0, startedAt: Date.now(), verifiedAt: null })
const settle = async (t, operation) => {
  let result
  const pending = operation().then(value => { result = { value } }, error => { result = { error } })
  for (let step = 0; !result && step < 10000; step++) {
    await setImmediate()
    t.mock.timers.tick(250)
  }
  assert.ok(result, 'Bounded work must settle')
  await pending
  if (result.error) throw result.error
  return result.value
}
const clock = t => t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.parse('2026-10-24T00:00:00Z') })

const workday = (t, { count = 800, grouped = false, detailDelayMs = 0, nativeTransform = value => value } = {}) => {
  const api = 'https://recovery.wd931.myworkdayjobs.com/wday/cxs/recovery/External'
  const roles = Array.from({ length: count }, (_, index) => ({
    title: 'Engineer ' + index, externalPath: '/job/Bangalore/Engineer_R' + index,
    locationsText: grouped ? '2 Locations' : 'Bangalore, India',
  }))
  const requests = []
  let active = 0
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    if (init.method === 'POST') {
      const { offset, limit } = JSON.parse(init.body)
      return Response.json({ total: roles.length, jobPostings: roles.slice(offset, offset + limit) })
    }
    if (!String(url).includes('/job/')) return new Response('<html>Workday careers</html>')
    const role = roles.find(value => String(url).includes('/wday/cxs/') && String(url).endsWith(value.externalPath))
    assert.ok(role, 'Only fetch the current native role endpoint')
    requests.push({ id: role.externalPath, at: Date.now() })
    active++
    try {
      if (detailDelayMs) await new Promise((resolve, reject) => {
        const onAbort = () => { clearTimeout(timer); reject(init.signal.reason) }
        const timer = setTimeout(() => { init.signal.removeEventListener('abort', onAbort); resolve() }, detailDelayMs)
        init.signal.addEventListener('abort', onAbort, { once: true })
      })
      return Response.json(nativeTransform({ jobPostingInfo: {
        title: role.title, jobReqId: role.externalPath.split('_').at(-1),
        location: 'Bangalore, India', country: { descriptor: 'India', alpha2Code: 'IN' },
        additionalLocations: role.locationsText === '2 Locations' ? ['London, United Kingdom'] : [],
        jobDescription: '<p>Build and maintain reliable engineering services.</p>',
      } }))
    } finally { active-- }
  })
  return {
    roles, requests, get active() { return active },
    run: options => runWorkdayScraper({
      source: 'recovery', company: 'Recovery fixture',
      baseUrl: 'https://recovery.wd931.myworkdayjobs.com/External',
      scraperDir: fileURLToPath(new URL('../myworkday', import.meta.url)),
      requestScheduler: new WorkdayRequestScheduler(), retryBaseDelayMs: 0, ...options,
    }),
  }
}

test('bounded Workday recovery completes an 800-role paced inventory instead of repeating its prefix', async t => {
  clock(t)
  const fixture = workday(t)
  const recovery = session()
  let jobs
  let passes = 0
  for (; passes < 4; passes++) {
    recovery.pending = 0
    jobs = await settle(t, () => fixture.run({ nativeDetailRecovery: recovery }))
    if (jobs.every(job => job.sourceDetailComplete)) break
  }
  assert.equal(jobs.length, 800)
  assert.ok(jobs.every(job => job.sourceDetailComplete === true), 'The tail must actually be fetched')
  assert.equal(fixture.requests.length, 800, 'Validated details must not be fetched again in later bounded passes')
  assert.ok(passes > 0 && passes < 4)
  assert.ok(jobs.some(job => job.sourceDetailFromRecovery === true))
  assert.ok(jobs.every(job => job.sourceDetailVerifiedAt))
  assert.ok(new Date(readInventoryEvidence(jobs).verifiedAt).getTime() < Date.now(), 'Retain the actual oldest receipt clock')
  assert.equal(fixture.active, 0)
  t.diagnostic(JSON.stringify({ workload: '800-workday-details', passes: passes + 1,
    detailRequests: fixture.requests.length, receiptBytes: recovery.receiptBytes }))
})

test('Workday recovery invalidates a receipt when the currently advertised title changes', async t => {
  clock(t)
  const fixture = workday(t, { count: 8 })
  const recovery = session()
  await settle(t, () => fixture.run({ nativeDetailRecovery: recovery }))
  fixture.roles[0].title = 'Principal Engineer'
  const jobs = await settle(t, () => fixture.run({ nativeDetailRecovery: recovery }))
  assert.equal(jobs[0].title, 'Principal Engineer')
  assert.equal(fixture.requests.length, 9)
  assert.equal(jobs[0].sourceDetailFromRecovery, undefined)
  assert.ok(jobs.slice(1).every(job => job.sourceDetailFromRecovery === true))
})

test('fresh Workday enumeration removes old roles rather than unioning disjoint recovery inventories', async t => {
  clock(t)
  const fixture = workday(t, { count: 8 })
  const recovery = session()
  await settle(t, () => fixture.run({ nativeDetailRecovery: recovery }))
  fixture.roles.shift()
  fixture.roles.push({ title: 'New role', externalPath: '/job/Bangalore/New_R80', locationsText: 'Bangalore, India' })
  const jobs = await settle(t, () => fixture.run({ nativeDetailRecovery: recovery }))
  assert.equal(jobs.length, 8)
  assert.ok(!jobs.some(job => job.jobId === 'R0'))
  assert.ok(jobs.some(job => job.jobId === 'R80' && job.title === 'New role' && job.sourceDetailComplete))
  assert.equal(fixture.requests.length, 9)
})

test('native hyphenated Workday requisitions remain resumable without borrowing another role identity', async t => {
  clock(t)
  const fixture = workday(t, { count: 1 })
  fixture.roles[0].externalPath = '/job/Bangalore/Engineer_JR-008'
  const recovery = session()
  await settle(t, () => fixture.run({ nativeDetailRecovery: recovery }))
  const jobs = await settle(t, () => fixture.run({ nativeDetailRecovery: recovery }))
  assert.equal(jobs[0].requisitionId, 'JR-008')
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(fixture.requests.length, 1)
  assert.equal(jobs[0].sourceDetailFromRecovery, true)
})

test('a native Workday posting URL corroborates a repost suffix without changing requisition identity', async t => {
  clock(t)
  const fixture = workday(t, { count: 1, nativeTransform: payload => ({ jobPostingInfo: {
    ...payload.jobPostingInfo, jobReqId: 'R0', jobPostingId: 'Engineer_R0-1',
    externalUrl: 'https://recovery.wd931.myworkdayjobs.com/External/job/Bangalore/Engineer_R0-1',
  } }) })
  fixture.roles[0].externalPath = '/job/Bangalore/Engineer_R0-1'
  const recovery = session()
  await settle(t, () => fixture.run({ nativeDetailRecovery: recovery }))
  const jobs = await settle(t, () => fixture.run({ nativeDetailRecovery: recovery }))
  assert.equal(jobs[0].requisitionId, 'R0')
  assert.equal(fixture.requests.length, 1)
  assert.equal(jobs[0].sourceDetailFromRecovery, true)
})

test('bounded Workday required-scope passes finish 1844 grouped listings without relaxing India checks', async t => {
  clock(t)
  const fixture = workday(t, { count: 1844, grouped: true })
  const recovery = session()
  let jobs
  let passes = 0
  for (; passes < 8; passes++) {
    recovery.pending = 0
    try { jobs = await settle(t, () => fixture.run({ nativeDetailRecovery: recovery })) }
    catch (error) { if (error.code !== 'NATIVE_DETAIL_RECOVERY_PENDING') throw error }
    if (jobs && !recovery.pending) break
  }
  assert.ok(jobs, 'Recover the entire required-country queue')
  assert.equal(jobs.length, 1844)
  assert.ok(passes > 0 && passes < 8, 'Yield at a finite scope pass budget')
  assert.equal(fixture.requests.length, 1844)
  assert.ok(jobs.every(job => job.location === 'Bangalore, India' && job.sourceDetailComplete === true))
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(fixture.active, 0)
  t.diagnostic(JSON.stringify({ workload: '1844-workday-country-checks', passes: passes + 1,
    detailRequests: fixture.requests.length, receiptBytes: recovery.receiptBytes }))
})

const phenom = ({ count = 1132, delayMs = 750 } = {}) => {
  const roles = Array.from({ length: count }, (_, index) => ({ reqId: 'R' + index, jobId: 'R' + index,
    jobSeqNo: 'native-' + index, title: 'Engineer ' + index, country: 'India', cityStateCountry: 'Pune, India' }))
  const html = () => '<script>phApp.ddo = ' + JSON.stringify({ eagerLoadRefineSearch: {
    status: 200, totalHits: count, hits: count, data: { jobs: roles, aggregations: [{ field: 'country', value: { India: count } }] },
  } }) + '</script>'
  const requests = []
  const scraper = createPhenomScraper({ companyName: 'Recovery fixture', source: 'recovery',
    baseUrl: 'https://careers.example.com', scraperDir: fileURLToPath(new URL('.', import.meta.url)) })
  return { roles, requests, run: options => scraper.run({
    ...options, fetchText: async (url, { signal }) => {
      if (new URL(url).pathname.endsWith('/search-results')) return html()
      const role = roles.find(value => new URL(url).pathname.split('/job/')[1]?.split('/')[0] === value.jobId)
      assert.ok(role)
      requests.push(url)
      await new Promise((resolve, reject) => {
        const onAbort = () => { clearTimeout(timer); reject(signal.reason) }
        const timer = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve() }, delayMs)
        signal.addEventListener('abort', onAbort, { once: true })
      })
      return '<link rel="canonical" href="' + url + '"><script>phApp.ddo = ' + JSON.stringify({ jobDetail: {
        status: 200, data: { job: { ...role, ml_country: 'India', standardisedCountry: 'India',
          ml_Description: '<p>Build and maintain reliable engineering services.</p>' } },
      } }) + '</script>'
    },
  }) }
}

test('Quest-scale Phenom recovery finishes every serial detail within bounded passes', async t => {
  clock(t)
  const fixture = phenom()
  const recovery = session()
  let jobs
  let passes = 0
  for (; passes < 12; passes++) {
    recovery.pending = 0
    jobs = await settle(t, () => fixture.run({ nativeDetailRecovery: recovery }))
    if (jobs.every(job => job.sourceDetailComplete)) break
  }
  assert.equal(jobs.length, 1132)
  assert.ok(jobs.every(job => job.sourceDetailComplete === true))
  assert.ok(passes > 0 && passes < 12)
  // At most one aborted boundary request per serial pass is fetched again.
  assert.ok(fixture.requests.length <= 1132 + passes)
  assert.ok(jobs.some(job => job.sourceDetailFromRecovery === true))
  assert.ok(jobs.every(job => job.sourceDetailVerifiedAt))
  t.diagnostic(JSON.stringify({ workload: '1132-serial-phenom-details', passes: passes + 1,
    detailRequests: fixture.requests.length, receiptBytes: recovery.receiptBytes }))
})

test('actual Workday provider forwards the bounded recovery session on every source pass', async t => {
  clock(t)
  const fixture = workday(t)
  const scraper = buildScrapers().find(value => value.name === 'airbus')
  assert.ok(scraper)
  const jobs = await settle(t, () => runScraperWithTimeout(scraper, 210000, { nativeDetailRecovery: true }))
  assert.equal(jobs.length, 800)
  assert.ok(jobs.every(job => job.sourceDetailComplete === true))
  assert.equal(fixture.requests.length, 800)
})

test('combined required scope and optional detail work yields before the unchanged source deadline', async t => {
  clock(t)
  const fixture = workday(t, { count: 800 })
  // The first 400 roles require native country checks; the other 400 already
  // advertise India and still need their descriptions after scope completes.
  fixture.roles.slice(0, 400).forEach(role => { role.locationsText = '2 Locations' })
  const jobs = await settle(t, () => runScraperWithTimeout({ name: 'mixed-recovery', run: options => fixture.run(options) },
    210000, { nativeDetailRecovery: true }))
  assert.equal(jobs.length, 800)
  assert.ok(jobs.every(job => job.sourceDetailComplete === true))
  assert.equal(fixture.requests.length, 800)
})

test('a reused Phenom receipt must pass the country identity guard again', async t => {
  clock(t)
  const fixture = phenom({ count: 1 })
  const recovery = session()
  await settle(t, () => fixture.run({ nativeDetailRecovery: recovery }))
  const key = [...recovery.receipts.keys()][0]
  const receipt = readNativeDetailReceipt(recovery, key)
  receipt.payload.structured.country = 'United States'
  rememberNativeDetailReceipt(recovery, key, receipt.payload, receipt.fetchedAt)
  const jobs = await settle(t, () => fixture.run({ nativeDetailRecovery: recovery }))
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceDetailFailureKind, 'identity-mismatch')
  assert.equal(fixture.requests.length, 1)
})

test('registered legacy Workday wrappers retain recovery even when they reconstruct run options', async t => {
  clock(t)
  const fixture = workday(t)
  const scraper = buildScrapers().find(value => value.name === 'alteryx')
  assert.ok(scraper)
  const jobs = await settle(t, () => runScraperWithTimeout(scraper, 210000, { nativeDetailRecovery: true }))
  assert.equal(jobs.length, 800)
  assert.ok(jobs.every(job => job.sourceDetailComplete === true))
  assert.equal(fixture.requests.length, 800)
  assert.ok(jobs.some(job => job.sourceDetailFromRecovery === true))
})

test('Phenom engine retains lifecycle recovery through a wrapper that reconstructs only signal', async t => {
  clock(t)
  const fixture = phenom({ count: 4 })
  const jobs = await settle(t, () => runScraperWithTimeout({ name: 'legacy-phenom',
    run: ({ signal }) => fixture.run({ signal }),
  }, 300000, { nativeDetailRecovery: true }))
  assert.ok(jobs.every(job => job.sourceDetailComplete === true && job.sourceDetailVerifiedAt))
})

test('an explicit engine recovery session overrides the ambient source lifecycle', async t => {
  clock(t)
  const fixture = workday(t, { count: 2 })
  const explicit = session()
  let ambient
  const jobs = await settle(t, () => runWithNativeDetailRecovery(async recovery => {
    ambient = recovery
    return fixture.run({ nativeDetailRecovery: explicit })
  }))
  assert.ok(jobs.every(job => job.sourceDetailComplete && job.sourceDetailVerifiedAt))
  assert.equal(explicit.receipts.size, 2)
  assert.equal(ambient.progress, 0)
})
