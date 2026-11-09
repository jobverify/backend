import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync, spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import * as nuro from '../../scraper/nuro/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
const { run } = nuro
const captured = name => JSON.parse(readFileSync(new URL(`../../scraper/nuro/fixtures/${name}-response.json`, import.meta.url), 'utf8'))
const payload = () => JSON.parse(captured('jobs').body)
const fixtureFetch = ({ html = captured('careers').body, jobs = payload(), scriptTransform = value => value, responseOverride } = {}) => {
  const scripts = JSON.parse(readFileSync(new URL('../../scraper/nuro/fixtures/client-api-responses.json', import.meta.url), 'utf8'))
  return async (url, options) => {
    assert.ok(options.signal instanceof AbortSignal)
    let body
    if (url === nuro.OFFICIAL_CAREERS_URL) body = html
    else if (url === nuro.NATIVE_JOBS_URL) body = JSON.stringify(jobs)
    else {
      const native = scripts.find(script => script.url === url)
      if (!native) throw new Error('Unrecorded unrelated client script')
      body = scriptTransform(native.body)
    }
    return { status: 200, url, text: async () => body, json: async () => JSON.parse(body), ...responseOverride?.(url) }
  }
}

test('Nuro verifies the official script handoff and reports complete no-India inventory truthfully', async () => {
  const jobs = await run({ fetchImpl: fixtureFetch(), now: () => '2026-10-23T03:00:00.000Z' })
  assert.equal(jobs.length, 0)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'complete-inventory')
  assert.equal(evidence.reportedTotal, 101)
  assert.equal(evidence.indiaFacetCount, 0)
  assert.equal(evidence.firstParty, true)
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.verifiedAt, '2026-10-23T03:00:00.000Z')
  assert.ok(evidence.pagesFetched >= 3)
})

test('Nuro rejects broken identities, incomplete pages and missing client handoffs', async () => {
  for (const options of [
    { html: captured('careers').body.replaceAll('content="Nuro"', 'content="Other"') },
    { html: captured('careers').body.replace('</body>', '') },
    { scriptTransform: value => value.replaceAll('boards/nuro/jobs/', 'boards/other/jobs/') },
    { responseOverride: url => url === nuro.OFFICIAL_CAREERS_URL ? { status: 403 } : {} },
    { responseOverride: url => url === nuro.NATIVE_JOBS_URL ? { url: 'https://boards-api.greenhouse.io/v1/boards/other/jobs/?content=true' } : {} },
  ]) await assert.rejects(run({ fetchImpl: fixtureFetch(options) }), /Nuro|unclosed/)
})

test('Nuro enforces the request deadline even when a response arrives after it expires', async () => {
  await assert.rejects(run({ requestTimeoutMs: 5, fetchImpl: async () => {
    await new Promise(resolve => setTimeout(resolve, 30))
    return { status: 200, url: nuro.OFFICIAL_CAREERS_URL, text: async () => captured('careers').body }
  } }), /timeout|aborted/i)
})

test('Nuro parses the captured complete native inventory before India filtering', () => {
  const result = nuro.parseNativeInventory(payload())
  assert.equal(result.total, 101)
  assert.deepEqual(result.jobs, [])
})

test('Nuro extracts future India roles with employer content and original publication date', () => {
  const original = payload().jobs[0]
  const job = { ...original, id: 1001, absolute_url: 'https://nuro.ai/careersitem?gh_jid=1001',
    title: 'Software Engineer', location: { name: 'Bengaluru, Karnataka, India' },
    content: '&lt;p&gt;Build autonomous systems.&lt;/p&gt;', first_published: '2026-10-01T09:00:00Z', updated_at: '2026-10-23T10:00:00Z' }
  const missing = { ...job, id: 1002, absolute_url: 'https://nuro.ai/careersitem?gh_jid=1002', content: null, first_published: null }
  const result = nuro.parseNativeInventory({ jobs: [original, job, missing], meta: { total: 3 } })
  assert.deepEqual(result.jobs.map(j => j.jobId), ['1001', '1002'])
  assert.equal(result.jobs[0].company, 'Nuro')
  assert.equal(result.jobs[0].country, 'India')
  assert.equal(result.jobs[0].jobDescription, '<p>Build autonomous systems.</p>')
  assert.equal(result.jobs[0].postingDate, '2026-10-01T09:00:00Z')
  assert.equal(result.jobs[0].sourceUrl, 'https://nuro.ai/careersitem?gh_jid=1001')
  assert.equal(result.jobs[1].jobDescription, null)
  assert.equal(result.jobs[1].postingDate, null)
})

test('Nuro rejects incomplete, duplicated, foreign-tenant and ambiguous native data', () => {
  for (const change of [
    p => { p.meta.total++ },
    p => { p.jobs.push(p.jobs[0]); p.meta.total++ },
    p => { p.hasMore = true },
    p => { p.jobs[0].company_name = 'Other' },
    p => { p.jobs[0].absolute_url = 'https://other.example/careersitem?gh_jid=8227642' },
    p => { p.jobs[0].absolute_url = 'https://nuro.ai/careersitem?gh_jid=9999' },
    p => { p.jobs[0].location.name = 'Remote' },
    p => { p.jobs[0].location.name = 'Bengaluru, India, US' },
    p => { p.jobs[0].location.name = 'Mountain View, California (HQ), India' },
    p => { p.jobs[0].location.name = 'Bengaluru, Canada' },
    p => { p.jobs[0].location.name = 'Hyderabad, United States' },
    p => { p.jobs[0].location.name = '' },
    p => { p.jobs[0].title = '' },
  ]) {
    const data = payload()
    change(data)
    assert.throws(() => nuro.parseNativeInventory(data), /Nuro/)
  }
})

test('Nuro never certifies HTTP-200 native error envelopes as empty inventory', async () => {
  for (const error of [{ error: 'upstream unavailable' }, { errors: ['unavailable'] },
    { success: false }, { ok: false }, { hasError: true }, { failed: true }, { status: 503 }, { status: 'error' }]) {
    const data = { jobs: [], meta: { total: 0 }, ...error }
    assert.throws(() => nuro.parseNativeInventory(data), /Nuro/)
    await assert.rejects(run({ fetchImpl: fixtureFetch({ jobs: data }) }), /Nuro/)
  }
})

test('Nuro rejects impossible calendar dates while preserving native offset timestamps', () => {
  const job = { ...payload().jobs[0], location: { name: 'Bengaluru, Karnataka, India' } }
  assert.equal(nuro.parseNativeInventory({ jobs: [job], meta: { total: 1 } }).jobs[0].postingDate, '2026-09-23T18:38:33-04:00')
  for (const invalid of ['2026-02-31', '2026-02-31T18:38:33-04:00', '2025-02-29T01:00:00Z', '2026-04-31T12:00:00+05:30']) {
    for (const field of ['first_published', 'application_deadline']) {
      assert.throws(() => nuro.parseNativeInventory({ jobs: [{ ...job, [field]: invalid }], meta: { total: 1 } }), /Nuro.*date|Nuro.*deadline/)
    }
  }
})

test('Nuro retains India jobs missing substantive source text without claiming complete details', async () => {
  for (const content of [null, '', ' \n\t', '&lt;p&gt;&amp;nbsp;&lt;br&gt;&lt;/p&gt;', '&lt;script&gt;ignored()&lt;/script&gt;']) {
    const job = { ...payload().jobs[0], location: { name: 'Bengaluru, Karnataka, India' }, content }
    const jobs = await run({ fetchImpl: fixtureFetch({ jobs: { jobs: [job], meta: { total: 1 } } }) })
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].sourceDetailComplete, false)
    assert.equal(jobs[0].sourceListingComplete, false)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  }
})

test('Nuro bounds transports and response bodies that ignore AbortSignal, including caller cancellation', async () => {
  const moduleUrl = new URL('../../scraper/nuro/script.js', import.meta.url).href
  const script = `
    import { run, OFFICIAL_CAREERS_URL } from ${JSON.stringify(moduleUrl)};
    process.send('ready');
    const keepAlive = setInterval(() => {}, 100);
    const never = () => new Promise(() => {});
    const checks = [];
    try {
      for (const mode of ['fetch', 'body', 'cancel']) {
        const controller = new AbortController();
        const abortTimer = mode === 'cancel' ? setTimeout(() => controller.abort(new Error('caller cancelled')), 10) : null;
        try {
          await run({ requestTimeoutMs: mode === 'cancel' ? 1000 : 10, signal: controller.signal,
            fetchImpl: mode === 'body' ? async () => ({ status: 200, url: OFFICIAL_CAREERS_URL, text: never }) : never });
          checks.push('unexpected success');
        } catch (error) { checks.push(error.message); }
        finally { clearTimeout(abortTimer); }
      }
      console.log(JSON.stringify(checks));
    } finally { clearInterval(keepAlive); }
  `
  const output = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', script], {
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true,
    })
    let stdout = '', stderr = '', ready = false, deadlineError
    const expire = phase => {
      deadlineError = new Error(`Nuro ${phase} deadline exceeded`)
      child.kill()
    }
    // Module loading can exceed two seconds under the full suite's process
    // load. Start the short behavior watchdog only after imports have finished.
    let timer = setTimeout(() => expire('child startup'), 30000)
    child.stdout.setEncoding('utf8').on('data', data => { stdout += data })
    child.stderr.setEncoding('utf8').on('data', data => { stderr += data })
    child.on('message', message => {
      if (message !== 'ready' || ready) return
      ready = true
      clearTimeout(timer)
      timer = setTimeout(() => expire('transport checks'), 2000)
    })
    child.on('error', error => { clearTimeout(timer); reject(error) })
    child.on('close', (code, signal) => {
      clearTimeout(timer)
      if (deadlineError) reject(deadlineError)
      else if (!ready || code !== 0) reject(new Error(`Nuro child failed (${code ?? signal}): ${stderr}`))
      else resolve(stdout)
    })
  })
  const checks = JSON.parse(output)
  assert.match(checks[0], /timeout|deadline/i)
  assert.match(checks[1], /timeout|deadline/i)
  assert.match(checks[2], /caller cancelled/)
})

test('Nuro propagates native request failures instead of reporting empty inventory', async () => {
  await assert.rejects(run({ fetchImpl: async () => { throw new Error('native request failed') } }), /native request failed/)
})

test('Nuro rejects a caller cancellation before fetching inventory', async () => {
  const controller = new AbortController()
  controller.abort(new Error('cancelled'))
  await assert.rejects(run({ signal: controller.signal, fetchImpl: async () => { throw new Error('must not fetch') } }), /cancelled/)
})

test('importing Nuro with --dry-run cannot write output or fetch jobs', () => {
  const moduleUrl = new URL('../../scraper/nuro/script.js', import.meta.url).href
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', `
    import fs from 'node:fs';
    fs.writeFileSync = () => { throw new Error('Unexpected import file write'); };
    process.argv.push('--dry-run');
    globalThis.fetch = () => { throw new Error('Unexpected import network'); };
    await import(${JSON.stringify(moduleUrl)});
    console.log('imported');
  `], { encoding: 'utf8', timeout: 5000 })
  assert.equal(output.trim(), 'imported')
})
