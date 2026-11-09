import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { buildDescriptionSourceUpdate } from '../../src/services/jobDescriptionPolicy.js'
import { extractionDetailHealth } from '../utils/extractionDetailHealth.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

for (const [source, returned, withheld] of [['idfy', 17, 4], ['trumindssoftwaresystems', 13, 0]]) {
  const module = await import(`../../scraper/${source}/script.js`)
  const capture = JSON.parse(gunzipSync(readFileSync(new URL(
    `../../scraper/${source}/test-data/native-public-20261103.json.gz`, import.meta.url))))
  const replay = async ({ mutateDetail = value => value, mutateOpening = value => value,
    mutateClosing = value => value, signal, maxJobs, afterDetail } = {}) => {
    const requested = [], opening = structuredClone(capture.openingListing)
    let listingReads = 0
    const packet = url => {
      const result = capture.packets.find(row => row.url === url)
      assert.ok(result, `Only captured first-party routes may be read: ${url}`)
      assert.equal(result.status, 200)
      return result
    }
    const options = { signal, now: () => capture.observedAt,
      fetchPage: async url => { requested.push(url); const row = packet(url)
        return { status: row.status, url: row.finalUrl, html: row.body } },
      fetchText: async url => { requested.push(url); return packet(url).body },
      fetchJson: async (url, init = {}) => {
        requested.push(url)
        if (url === module.NOAUTH_TOKEN_URL) return { access_token: 'fixture-public-token' }
        assert.equal(init.headers.Authorization, 'Bearer fixture-public-token')
        if (url === module.FILTERED_JOBS_URL) {
          assert.equal(init.method, 'POST')
          return ++listingReads === 1 ? mutateOpening(opening) : mutateClosing(JSON.parse(packet(url).body))
        }
        assert.equal(init.method, 'GET')
        const detail = mutateDetail(JSON.parse(packet(url).body))
        afterDetail?.()
        return detail
      } }
    const scraper = source === 'idfy' ? module.createIdfyScraper({ maxJobs })
      : module.createTrumindsSoftwareSystemsScraper({ maxJobs })
    const jobs = maxJobs === undefined ? await module.run(options) : await scraper.run(options)
    return { jobs, requested }
  }

  test(`${source} captured 500-character previews reproduce the persistence error`, () => {
    const listingJobs = module.extractPublicJobs(capture.openingListing)
    let malformed = 0
    for (const job of listingJobs) {
      try { buildDescriptionSourceUpdate(job, null) }
      catch (error) { assert.match(error.message, /Unterminated native/); malformed++ }
    }
    assert.ok(malformed > 0)
  })

  test(`${source} full native details survive the real description persistence policy`, async () => {
    const { jobs, requested } = await replay()
    assert.equal(jobs.length, returned)
    assert.equal(requested.filter(url => url.includes('/api/publicjobs/')).length, capture.openingListing.Total)
    for (const job of jobs) {
      assert.equal(job.source, source)
      assert.equal(job.sourceDetailComplete, true)
      assert.ok(job.sourceDescription.length > 500)
      const update = buildDescriptionSourceUpdate(job, null, { mode: 'publish' })
      assert.equal(update.sourceDescription, job.sourceDescription)
      assert.equal(update.descriptionRewrite.status, 'pending')
      assert.equal(job.description, undefined)
    }
    const evidence = readInventoryEvidence(jobs)
    assert.equal(evidence.reportedTotal, capture.openingListing.Total)
    assert.equal(evidence.listingComplete, withheld === 0)
    assert.equal(extractionDetailHealth(jobs).complete, withheld === 0)
    if (withheld) {
      const audit = jobs[0].nativeCollectionEvidence
      assert.equal(audit.failures.length, withheld)
      assert.ok(audit.failures.every(row => row.nativeStatus === 'Offered'))
      assert.equal(extractionDetailHealth(jobs).nativeCollections[0].unextractedDetailFailures, withheld)
    }
  })

  test(`${source} retains the board publication date when another board's date differs`, async () => {
    const { jobs } = await replay()
    const job = jobs.find(job => job.postingDate !== job.sourceNativeGeneralPublishedDate)
    assert.ok(job, 'The actual native responses contain distinct publication clocks')
    const listing = capture.openingListing.Result.find(row => row.JobId === job.jobId)
    assert.equal(job.postingDate, listing.PublishedDate)
  })

  for (const [label, mutateDetail] of [
    ['wrong role ID', value => ({ ...value, JobId: 'another-role' })],
    ['wrong title', value => ({ ...value, JobTitle: 'Another advertised vacancy' })],
    ['wrong employer', value => ({ ...value, OrgDetails: { ...value.OrgDetails, OrgID: 'another-employer' } })],
    ['wrong public identity', value => ({ ...value, JobIdObfuscated: 'another-public-role' })],
    ['contradictory workplace', value => ({ ...value, Location: '[{"Address":"London, United Kingdom"}]' })],
    ['wrong career-page publication', value => ({ ...value, PublishedDates: { ...value.PublishedDates, CAREERPAGE: '2026-01-01T00:00:00Z' } })],
    ['wrong closing date', value => ({ ...value, ExpiryDates: { ...value.ExpiryDates, CAREERPAGE: '2026-01-01T00:00:00Z' } })],
  ]) test(`${source} rejects ${label} rather than substituting a listing preview`, async () => {
    await assert.rejects(replay({ mutateDetail }), error => error.incompleteScope === true && error.abortRetries === true)
  })

  test(`${source} missing full descriptions retain a partial inventory and diagnostics`, async () => {
    let first = true
    const { jobs } = await replay({ mutateDetail: value => {
      if (!first) return value
      first = false
      return { ...value, JobDescription: '', JobDescriptionV2: '<p>Job description attached.</p>' }
    } })
    assert.equal(jobs.length, returned - 1)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.equal(jobs[0].nativeCollectionEvidence.failures[0].failureKind, 'missing-content')
    assert.ok(jobs.every(job => job.lifecycleCleanupAllowed === false))
  })

  test(`${source} refuses a truncated native listing before requesting job details`, async () => {
    await assert.rejects(replay({ mutateOpening: value => ({ ...value, Total: value.Total + 1 }) }), /listing total/)
  })

  test(`${source} refuses duplicate native role identities`, async () => {
    await assert.rejects(replay({ mutateOpening: value => {
      value.Result[1] = structuredClone(value.Result[0])
      return value
    } }), /missing or duplicated/)
  })

  test(`${source} unqualified vacancy statuses never become verified zero inventory`, async () => {
    const { jobs } = await replay({ mutateDetail: value => ({ ...value, JobStatus: 'Offered' }) })
    assert.equal(jobs.length, 0)
    assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
    assert.equal(readInventoryEvidence(jobs).reportedTotal, capture.openingListing.Total)
    assert.match(readInventoryEvidence(jobs).reason, /native-public-vacancy-status-unqualified/)
  })

  test(`${source} unclassified reader failures remain the original error`, async () => {
    const reason = new TypeError('Reader implementation failed')
    await assert.rejects(replay({ mutateDetail: () => { throw reason } }), error => error === reason)
  })

  test(`${source} refuses changed closing inventory`, async () => {
    await assert.rejects(replay({ mutateClosing: value => {
      value.Result[0].JobTitle += ' changed'
      return value
    } }), /closing native inventory changed/)
  })

  test(`${source} a caller limit never certifies complete source coverage`, async () => {
    const { jobs } = await replay({ maxJobs: 1 })
    assert.equal(jobs.length, 1)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  })

  test(`${source} caller cancellation is preserved before and after a detail read`, async () => {
    const reason = Error('Stop full native hydration')
    await assert.rejects(replay({ signal: AbortSignal.abort(reason) }), error => error === reason)
    const controller = new AbortController()
    await assert.rejects(replay({ signal: controller.signal, afterDetail: () => controller.abort(reason) }), error => error === reason)
  })
}
