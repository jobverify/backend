import assert from 'node:assert/strict'
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import nodeTest from 'node:test'

import { acquireWorkdaySourceAdmission } from '../shared/workdaySourceAdmission.js'
import { createCatalogScraper } from '../providers/index.js'
import {
  sources, captures, details, packetFor, configPath, providerFor,
  exercise, assertScopedRole,
} from './cognexCondeWorkday20261101.helpers.mjs'

const test = (name, run) => nodeTest(name, { concurrency: false }, run)
for (const source of Object.keys(sources)) {
  test(`${source}: exact retained scoped packets preserve all native body hashes, dates and unknown company scope`, () => {
    const capture = captures[source]
    assert.equal(capture.capturedResponses.length, 8)
    assert.equal(capture.sourceScopeComplete, false)
    assert.equal(capture.companyTotals, null)
    assert.equal(capture.indiaTotals, null)
    assert.equal(JSON.parse(packetFor(source, packet => packet.kind === 'india-filtered-listing').body).total, 7)
    assert.equal(JSON.parse(packetFor(source, packet => packet.kind === 'first-unfiltered-listing').body).jobPostings.length, 20)
    assert.equal(details[source].jobPostingInfo.startDate, source === 'cognex' ? '2026-10-22' : '2026-10-27')
    assert.equal(details[source].jobPostingInfo.posted, true)
    assert.equal(details[source].jobPostingInfo.canApply, true)
  })

  // Conde's current native CMS/renderer + India-facet contract is exercised
  // against every intact current response in recruitmentGoal20261106CondenastNative.
  // The synthetic unfiltered-board cases below remain the Cognex engine contract.
  if (source === 'condenast') continue

  test(`${source}: synthetic visible primary and one-role unfiltered snapshots retain native ID, title, full JD and day-precision dates`, async t => {
    assertScopedRole(await exercise(t, source), source)
  })

  test(`${source}: actual registered route preserves the same scoped job and proof carrier`, async t => {
    const result = await exercise(t, source, { registered: true })
    assertScopedRole(result, source)
    const provider = providerFor(source)
    assert.equal(provider.adapter, 'script')
    assert.equal(provider.backfillMode, 'workday')
    assert.equal(provider.verifiedOn, null)
    assert.equal(provider.verifiedPublicJobCount, null)
    assert.notEqual(provider.bindingEvidence?.verified, true)
  })

  test(`${source}: caller reasons are returned exactly before config or transport`, async t => {
    const reasons = [new Error('caller'), Object.freeze({ opaque: source }), 'caller string', null, 0]
    for (const reason of reasons) {
      const controller = new AbortController()
      controller.abort(reason)
      const result = await exercise(t, source, { options: { signal: controller.signal } })
      assert.equal(result.rejected, true)
      assert.equal(result.error, reason)
      assert.equal(result.calls.length, 0)
    }
  })

  test(`${source}: absent, malformed, partial and wrong-site configs cannot fall back to implicit India or start IO`, async t => {
    const originalRead = fs.readFileSync
    const exactConfig = JSON.parse(originalRead(configPath(source), 'utf8'))
    const variants = [
      () => { const error = new Error('synthetic missing config'); error.code = 'ENOENT'; throw error },
      () => '{',
      () => 'null',
      () => JSON.stringify({ ...exactConfig, inventoryScope: 'legacy-filtered' }),
      () => JSON.stringify({ ...exactConfig, locationCountry: 'c4f78be1a8f14da0ab49ce1162348a5e' }),
      () => JSON.stringify({ ...exactConfig, jobsApiUrl: exactConfig.jobsApiUrl.replace(/\/jobs$/, '/jobs?other=1') }),
      () => JSON.stringify({ ...exactConfig, detailUrlBase: exactConfig.detailUrlBase + '-wrong' }),
      () => JSON.stringify({ ...exactConfig, officialCareersUrl: 'https://foreign.example/careers' }),
      () => JSON.stringify({ ...exactConfig, boardIdentityVerified: true }),
    ]
    for (const variant of variants) {
      const mock = t.mock.method(fs, 'readFileSync', (file, ...args) => {
        if (String(file) === configPath(source)) return variant()
        return originalRead(file, ...args)
      })
      syncBuiltinESMExports()
      try {
        const result = await exercise(t, source)
        assert.equal(result.rejected, true)
        assert.equal(result.error?.code, 'WORKDAY_SOURCE_CONFIG_INVALID')
        assert.equal(result.error?.abortRetries, true)
        assert.equal(result.error?.sourceScopeComplete, false)
        assert.equal(result.calls.length, 0)
      } finally { mock.mock.restore(); syncBuiltinESMExports() }
    }
  })

  test(`${source}: caller abort during a pending ordinary request stops before later reads with exact frozen reason`, async t => {
    const controller = new AbortController(), reason = Object.freeze({ opaque: 'pending-' + source })
    const result = await exercise(t, source, { options: { signal: controller.signal }, handle: ({ init, calls }) => {
      if (calls.length !== 1) return
      return new Promise((resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true })
        queueMicrotask(() => controller.abort(reason))
      })
    } })
    assert.equal(result.rejected, true)
    assert.equal(result.error, reason)
    assert.equal(result.calls.length, 1)
  })

  test(`${source}: current corporate denial, foreign URL or inert-only handoff cannot reach the board`, async t => {
    const board = source === 'cognex' ? 'https://cognex.wd1.myworkdayjobs.com/External_Career_Site' : 'https://condenast.wd115.myworkdayjobs.com/CondeCareers'
    for (const change of [
      state => { state.primary.status = 403 },
      state => { state.primary.url = 'https://foreign.example/careers' },
      state => { state.primary.body = `<html><template><a href="${board}">Careers</a></template></html>` },
      state => { state.primary.body = `<html><a href="${board}-WrongSite">Careers</a></html>` },
    ]) {
      const result = await exercise(t, source, { change })
      assert.equal(result.rejected, true)
      assert.equal(result.calls.some(call => call.method === 'POST'), false)
    }
  })

  test(`${source}: contradictory optional detail identity cannot acquire native criteria or clocks`, async t => {
    for (const mutate of [
      info => { info.jobReqId = 'WRONG-ID' },
      info => { info.title = 'Unrelated role' },
      info => { info.jobPostingSiteId = 'WrongSite' },
      info => { info.externalUrl = info.externalUrl.replace('.myworkdayjobs.com', '.foreign.example') },
    ]) {
      const result = await exercise(t, source, { change: state => mutate(state.detail.jobPostingInfo) })
      if (!result.rejected) {
        assert.equal(result.jobs.length, 1, 'Existing safe listing fallback remains a raw observation')
        const job = result.jobs[0]
        assert.equal(job.sourceDetailComplete, false)
        assert.equal(job.requisitionId, null)
        assert.equal(job.sourceDescription, undefined)
        assert.equal(job.jobDescription, null)
        assert.equal(job.sourceDateProvenance, undefined)
        assert.equal(job.sourceRawDates, undefined)
        assert.equal(job.link, details[source].jobPostingInfo.externalUrl)
      }
    }
  })

  test(`${source}: an explicit foreign or conflicting native country cannot emit an India role`, async t => {
    for (const country of [
      { descriptor: 'United States of America', id: 'bc33aa3152ec42d4995f4791a106ed09' },
      { descriptor: 'United States of America', id: 'c4f78be1a8f14da0ab49ce1162348a5e' },
    ]) {
      const result = await exercise(t, source, { change: state => { state.detail.jobPostingInfo.country = country } })
      assert.ok(result.rejected || result.jobs.length === 0)
      assert.notEqual(result.evidence?.status, 'verified-empty')
    }
  })

  test(`${source}: closing native title drift cannot produce complete inventory or a certified zero`, async t => {
    const result = await exercise(t, source, { change: state => { state.closing.jobPostings[0].title += ' changed' } })
    assert.equal(result.rejected, true)
    assert.equal(result.jobs, undefined)
  })
}

test('Cognex: retained ordinary corporate 429 remains fail-closed; no captured India subset can bypass it', async t => {
  const primary = packetFor('cognex', packet => packet.phase === 'initial-pages' && packet.status === 429)
  const result = await exercise(t, 'cognex', { change: state => { state.primary = primary } })
  assert.equal(result.rejected, true)
  assert.equal(result.calls.length, 1)
  assert.equal(result.calls[0].url, primary.url)
})

test('Conde Nast: opaque corporate SSR without the declared reviewed renderer cannot authorize the India handoff', async t => {
  const primary = packetFor('condenast', packet => packet.phase === 'initial-pages' && packet.url === 'https://www.condenast.com/careers')
  const result = await exercise(t, 'condenast', { change: state => { state.primary = primary } })
  assert.equal(result.rejected, true)
  assert.equal(result.calls[0].url, primary.url)
  assert.ok(result.calls.every(call => call.method !== 'POST' && !call.url.includes('myworkdayjobs.com')))
})

test('registered Cognex and Conde configurations enter their actual Workday admission shards without changing catalog authority', async () => {
  for (const [source, shard] of [['cognex', 'wd1'], ['condenast', 'wd115']]) {
    const scraper = createCatalogScraper(providerFor(source))
    const lease = await acquireWorkdaySourceAdmission(scraper, { admissionTimeoutMs: 1000 })
    assert.ok(lease)
    try { assert.equal(lease.groupKey, 'workday:' + shard); assert.equal(lease.signal.aborted, false) }
    finally { lease.release() }
  }
})
