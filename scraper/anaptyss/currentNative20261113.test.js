import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { decorateJobsWithProviderMetadata, getScraperCatalog } from '../../scraper-support/providers/index.js'

const packets = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-20261113.json.gz', import.meta.url))))
const replay = async (mutate = () => {}, options = {}) => {
  const visits = new Map()
  return run({ ...options, fetchPage: async url => {
    const page = structuredClone(packets.find(row => row.requestedUrl === url))
    assert.ok(page, 'captured current first-party URL ' + url)
    const visit = (visits.get(url) || 0) + 1
    visits.set(url, visit)
    mutate(page, url, visit)
    return page
  } })
}
test('Anaptyss November native cards recover nine explicit India roles and all public qualification tabs', async () => {
  const jobs = await replay()
  assert.equal(jobs.length, 9)
  assert.ok(jobs.every(job => job.country === 'India' && job.sourceDetailComplete))
  const architect = jobs.find(job => job.jobId === 'sr-solutions-architect')
  assert.match(architect.jobDescription, /10–15 years of professional experience/)
  assert.match(architect.jobDescription, /Strategic &amp; Business Skills/)
  assert.equal(architect.postingDate, '2026-11-01')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 9)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(architect.lifecycleCleanupAllowed, false)
  assert.equal(jobs.nativeCollectionEvidence?.observedDetails.length, 9)
  assert.equal(decorateJobsWithProviderMetadata(jobs, getScraperCatalog().find(row => row.source === 'anaptyss')).nativeCollectionEvidence?.observedDetails.length, 9)
})
test('Anaptyss unreviewed qualification tab executable cannot establish complete criteria', async () => {
  await assert.rejects(replay((page, url) => {
    if (url.endsWith('/1sr4oigy47isl.js')) page.html = page.html.replace('onClick:()=>i(l)', 'onClick:()=>i(0)')
  }), /tab|client|contract/i)
})
test('Anaptyss hidden unbound qualifications cannot qualify a complete native role', async () => {
  const jobs = await replay((page, url) => {
    if (url.endsWith('/job-post/sr-solutions-architect')) page.html = page.html.replace('aria-controls="_R_599av5ubrb_-p1"', 'aria-controls="unbound-panel"')
  })
  assert.equal(jobs.some(job => job.jobId === 'sr-solutions-architect'), false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

for (const [scope, style] of [
  ['criteria block', 'position:fixed;left:-9999px'],
  ['criteria ancestor', 'position:fixed;left:-9999px'],
  ['individual body text', 'font-size:0'],
]) test(`Anaptyss ${scope} with ${style} cannot establish full authored visibility`, async () => {
  const jobs = await replay((page, url) => {
    if (url.endsWith('/job-post/sr-solutions-architect')) {
      const original = page.html
      page.html = scope === 'criteria block' ? original.replace('class="jb-block"', `style="${style}" class="jb-block"`)
        : scope === 'criteria ancestor' ? original.replace('class="jb-body"', `style="${style}" class="jb-body"`)
          : original.replace(/(<div class="jb-block">[\s\S]*?<p)(?=[\s>])/, `$1 style="${style}"`)
      assert.notEqual(page.html, original, 'mutated actual native criteria')
    }
  })
  assert.equal(jobs.some(job => job.jobId === 'sr-solutions-architect'), false)
  assert.equal(jobs.nativeCollectionEvidence.observedDetails.some(job => job.jobId === 'sr-solutions-architect'), false)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed, false)
})
test('Anaptyss contradictory native country is held despite an India city label', async () => {
  const jobs = await replay((page, url) => {
    if (url.endsWith('/job-post/sr-solutions-architect')) page.html = page.html.replace('<dt>Country</dt><dd>India</dd>', '<dt>Country</dt><dd>United Kingdom</dd>')
  })
  assert.equal(jobs.some(job => job.jobId === 'sr-solutions-architect'), false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
test('Anaptyss explicitly disabled native application controls cannot publish a role', async () => {
  const jobs = await replay((page, url) => {
    if (url.endsWith('/job-post/sr-solutions-architect')) page.html = page.html.replaceAll('href="/apply-now?post=', 'aria-disabled="true" href="/apply-now?post=')
  })
  assert.equal(jobs.some(job => job.jobId === 'sr-solutions-architect'), false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
test('Anaptyss a changed closing detail final URL is rejected', async () => {
  await assert.rejects(replay((page, url, visit) => {
    if (url.endsWith('/job-post/sr-solutions-architect') && visit === 2) page.url = 'https://another-employer.example/job-post/sr-solutions-architect'
  }), /final URL/i)
})
test('Anaptyss final inventory change after closing details holds removed postings', async () => {
  const jobs = await replay((page, url, visit) => {
    if (url.endsWith('/careers/openings') && visit >= 3) page.html = page.html.replace(/<details class="op-card"[\s\S]*?<\/details>/, '').replace('9 open positions', '8 open positions')
  })
  assert.equal(jobs.some(job => job.jobId === 'sr-solutions-architect'), false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
test('Anaptyss caller cancellation bounds an ignoring current reader', async () => {
  const controller = new AbortController(), reason = { cancelled: 'anaptyss' }
  const task = run({ signal: controller.signal, fetchPage: async url => {
    if (url.endsWith('/careers/openings')) return new Promise(() => {})
    return structuredClone(packets.find(row => row.requestedUrl === url))
  } })
  setTimeout(() => controller.abort(reason), 10)
  await assert.rejects(task, value => value === reason)
})
test('Anaptyss default public HTTP request receives and aborts with the caller signal', async () => {
  const original = globalThis.fetch, controller = new AbortController(), reason = { cancelled: 'anaptyss-http' }
  let requestSignal
  globalThis.fetch = async (_url, init) => {
    requestSignal = init.signal
    queueMicrotask(() => controller.abort(reason))
    return new Promise(() => {})
  }
  try {
    await assert.rejects(run({ signal: controller.signal }), value => value === reason)
    assert.equal(requestSignal?.aborted, true)
    assert.equal(requestSignal.reason, reason)
  } finally { globalThis.fetch = original }
})
