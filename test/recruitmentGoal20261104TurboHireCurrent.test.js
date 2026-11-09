import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { getScraperCatalog, createCatalogScraper } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { buildDescriptionSourceUpdate } from '../src/services/jobDescriptionPolicy.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/turbohire-current-native-quality.json.gz', import.meta.url))))
const sha = value => createHash('sha256').update(value).digest('hex')
const key = (url, init = {}) => (init.method || 'GET') + ':' + url + ':' + (init.body || '')
const replay = async (source, { modify = () => {}, maxJobs, signal } = {}) => {
  const capture = fixture.sources.find(row => row.source === source), pending = new Map(), reads = []
  for (const receipt of capture.requests) {
    const id = key(receipt.requestedURL, { method: receipt.method, body: receipt.body }), rows = pending.get(id) || []
    rows.push(receipt); pending.set(id, rows)
  }
  const fetchImpl = async (url, init = {}) => {
    assert.equal(init.redirect, 'manual')
    assert.equal(init.credentials, 'omit')
    const receipt = pending.get(key(url, init))?.shift()
    assert.ok(receipt, 'An unrecorded public endpoint was requested: ' + url)
    reads.push(String(url))
    const response = { text: receipt.text, status: receipt.status, contentType: receipt.contentType,
      finalURL: receipt.finalURL }
    modify({ url: String(url), response, reads })
    const result = new Response(response.text, { status: response.status, headers: { 'content-type': response.contentType } })
    Object.defineProperty(result, 'url', { value: response.finalURL })
    return result
  }
  const provider = getScraperCatalog().find(row => row.source === source)
  const jobs = await createCatalogScraper(provider).run({ fetchImpl, now: () => capture.completedAt,
    requestIntervalMs: 0, ...(maxJobs === undefined ? {} : { maxJobs }), signal })
  return { jobs, reads, capture }
}
const mutateJSON = (response, fn) => {
  const value = JSON.parse(response.text); fn(value); response.text = JSON.stringify(value)
}

test('the TurboHire quality fixture preserves 59 original response bodies from two fresh registered runs', () => {
  assert.equal(fixture.sources.reduce((n, row) => n + row.requests.length, 0), 59)
  for (const capture of fixture.sources) for (const receipt of capture.requests) {
    assert.equal(receipt.replayed, false)
    assert.equal(sha(receipt.text), receipt.bodySHA256)
  }
})

for (const [source, count, held] of [['britannia', 1, 2], ['navi', 37, 1]]) {
  test(source + ' retains full current native records, exact board dates and unresolved-role diagnostics', async () => {
    const { jobs, reads, capture } = await replay(source)
    assert.ok(!reads.some(url => url.startsWith('https://thapi.azurewebsites.net/')))
    assert.equal(jobs.length, count)
    assert.ok(jobs.every(job => job.nativeRoleClosingReconciled && job.country === 'India'
      && job.sourceDetailComplete && job.jobDescription.length > 500
      && job.sourceScopeComplete === false && job.sourceListingComplete === false && job.lifecycleCleanupAllowed === false))
    for (const job of jobs) {
      const detail = job.nativeSourceRecord.nativeDetail
      assert.equal(job.nativeSourceRecord.nativePublisher.client.apiBaseURL, 'https://thapi-stage2.azurewebsites.net')
      assert.equal(job.postingDate, detail.PublishedDates.CAREERPAGE)
      assert.equal(job.sourcePostedDateRaw, detail.PublishedDates.CAREERPAGE)
      assert.equal(job.employmentType, detail.JobTypeV2 || null)
      if (Array.isArray(detail.Skills)) assert.deepEqual(job.requiredSkills, detail.Skills.map(value => value.replace(/\s+/g, ' ').trim()).filter(Boolean))
      assert.equal(job.firstEverPostedAt, null)
      assert.equal(job.jobId, detail.JobId)
      assert.equal(job.requisitionId, detail.JobCode)
      assert.equal(job.nativeEmployerBinding.nativeOrganizationId, detail.OrgDetails.OrgID)
      assert.equal(job.nativeEmployerBinding.legalEmployer, null)
      assert.equal(job.applicationVisited, false)
      assert.ok(!reads.includes(job.applyUrl))
      assert.ok(job.locations.every(place => place.countryCode === 'IN' && place.country === 'India'))
      const update = buildDescriptionSourceUpdate(job, null, { mode: 'publish' })
      assert.equal(update.sourceDescription, job.sourceDescription)
      assert.equal(update.descriptionRewrite.status, 'pending')
    }
    const audit = jobs[0].nativeCollectionEvidence
    assert.equal(audit.failures.length, held)
    assert.equal(audit.closingInventoryMatches, true)
    assert.equal(audit.publisherClosingMatches, true)
    assert.equal(readInventoryEvidence(jobs).reportedTotal, count + held)
    assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
    assert.equal(reads.length, capture.requests.length)
  })

  test(source + ' cancellation and zero cap settle without public requests', async () => {
    const reason = Error('Stop this public source')
    await assert.rejects(replay(source, { signal: AbortSignal.abort(reason) }), error => error === reason)
    const { jobs, reads } = await replay(source, { maxJobs: 0 })
    assert.equal(reads.length, 0)
    assert.equal(jobs.length, 0)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  })

  test(source + ' a missing full description cannot be replaced by the 500-character preview', async () => {
    const { jobs } = await replay(source, { modify: ({ url, response }) => {
      if (url.includes('/api/publicjobs')) mutateJSON(response, detail => {
        detail.JobDescriptionV2 = '<p>Job description attached.</p>'
        detail.JobDescription = null; detail.RolesAndResponsibilitiesV2 = null; detail.EligibilityV2 = null
      })
    } })
    assert.equal(jobs.length, 0)
    assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
    assert.match(readInventoryEvidence(jobs).reason, /missing-content/)
  })

  test(source + ' malformed full description markup stays unresolved', async () => {
    const { jobs } = await replay(source, { modify: ({ url, response }) => {
      if (url.includes('/api/publicjobs')) mutateJSON(response, detail => { detail.JobDescriptionV2 = '<p data-role="unfinished' })
    } })
    assert.equal(jobs.length, 0)
    assert.match(readInventoryEvidence(jobs).reason, /malformed-native-full-description/)
  })

  test(source + ' changed closing roles cannot authorize completion', async () => {
    let listingReads = 0
    await assert.rejects(replay(source, { modify: ({ url, response }) => {
      if (url.includes('/filteredjobs') && ++listingReads === 2)
        mutateJSON(response, payload => { payload.Result[0].JobTitle += ' changed' })
    } }), /closing native inventory changed/)
  })

  test(source + ' generic dates from other job boards cannot replace the CareerPage clock', async () => {
    const { jobs } = await replay(source, { modify: ({ url, response }) => {
      if (url.includes('/api/publicjobs')) mutateJSON(response, detail => { detail.PublishedDate = '2026-01-01T00:00:00.1234567Z' })
    } })
    assert.equal(jobs.length, count)
    assert.ok(jobs.every(job => job.postingDate === job.nativeSourceRecord.nativeDetail.PublishedDates.CAREERPAGE
      && job.postingDate !== job.sourceNativeGeneralPublishedDate))
  })
}

test('Navi fixes all 27 actual publication-clock substitutions and holds the missing description', async () => {
  const { jobs } = await replay('navi')
  assert.equal(jobs.filter(job => job.postingDate !== job.sourceNativeGeneralPublishedDate).length, 27)
  assert.deepEqual(jobs[0].nativeCollectionEvidence.failures.map(row => [row.nativeJobId, row.failureKind]),
    [['66c58ce9-05c7-4a36-83be-3a2665db73ac', 'missing-content']])
})

test('Britannia withholds both actual Offered roles despite their continued appearance in filteredjobs', async () => {
  const { jobs } = await replay('britannia')
  assert.equal(jobs[0].jobId, '29ac46eb-5505-4992-b608-5e2c9c8db95e')
  assert.ok(jobs[0].nativeCollectionEvidence.failures.every(row => row.nativeStatus === 'Offered'))
  assert.equal(jobs[0].jobDescription.length, 1754)
})

test('a later API denial preserves an already verified role and stops all further reads', async () => {
  let details = 0, deniedAt
  const { jobs, reads } = await replay('navi', { modify: ({ url, response, reads }) => {
    if (url.includes('/api/publicjobs') && ++details === 2) {
      response.status = 403; response.text = 'Public access denied'; deniedAt = reads.length
    }
  } })
  assert.equal(jobs.length, 1)
  assert.equal(reads.length, deniedAt)
  assert.equal(jobs[0].nativeRoleClosingReconciled, false)
  assert.equal(jobs[0].nativeSourceRecord.nativeClosingListing, null)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('a country word inside a foreign address cannot become an India vacancy', async () => {
  const { jobs } = await replay('britannia', { modify: ({ url, response }) => {
    if (url.includes('/filteredjobs')) mutateJSON(response, payload => {
      for (const row of payload.Result) row.Location = '[{"Address":"India Street, California, United States"}]'
    })
  } })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
})

test('a detail cannot borrow another native employer or publication date', async () => {
  for (const mutate of [detail => { detail.OrgDetails.OrgID = 'another-organization' },
    detail => { detail.PublishedDates.CAREERPAGE = '2026-01-01T00:00:00Z' }]) {
    await assert.rejects(replay('britannia', { modify: ({ url, response }) => {
      if (url.includes('/api/publicjobs')) mutateJSON(response, mutate)
    } }), error => error.abortRetries === true && error.incompleteScope === true)
  }
})

test('a calendar-only closing day retains its precision and cannot expire at an invented midnight', async () => {
  const capture = fixture.sources.find(row => row.source === 'britannia'), day = capture.completedAt.slice(0, 10)
  const { jobs } = await replay('britannia', { modify: ({ url, response }) => {
    if (url.includes('/filteredjobs')) mutateJSON(response, payload => {
      for (const row of payload.Result) row.ExpiryDates.CAREERPAGE = day + 'T00:00:00'
    })
    if (url.includes('/api/publicjobs')) mutateJSON(response, detail => { detail.ExpiryDates.CAREERPAGE = day + 'T00:00:00' })
  } })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].closingDate, day)
  assert.equal(jobs[0].sourceNativeClosingDate, day + 'T00:00:00')
  assert.equal(jobs[0].sourceClosingDateIsExact, false)
})

test('the other TurboHire readers honor zero caps and prior cancellation before any public read', async () => {
  for (const source of ['monocept','byteridge','ola','olaelectric']) {
    const provider = getScraperCatalog().find(row => row.source === source)
    let reads = 0
    const options = { fetchImpl: async () => { reads++; throw Error('No request should start') },
      requestIntervalMs: 0, maxJobs: 0 }
    const jobs = await createCatalogScraper(provider).run(options)
    assert.equal(jobs.length, 0)
    assert.equal(reads, 0)
    assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
    const reason = Error('Stop public native reader')
    await assert.rejects(createCatalogScraper(provider).run({ ...options, signal: AbortSignal.abort(reason) }), error => error === reason)
    assert.equal(reads, 0)
  }
})

test('HTTP 200 error envelopes cannot masquerade as native inventories or successful details', async () => {
  for (const route of ['/filteredjobs', '/api/publicjobs']) await assert.rejects(replay('britannia', {
    modify: ({ url, response }) => {
      if (url.includes(route)) mutateJSON(response, payload => { payload.Success = false; payload.Error = 'Upstream native error' })
    },
  }), /error envelope|reports failure/)
})

test('typed listing country contradictions cannot be hidden by a correct-looking address suffix', async () => {
  await assert.rejects(replay('britannia', { modify: ({ url, response }) => {
    if (url.includes('/filteredjobs')) mutateJSON(response, payload => {
      for (const row of payload.Result) row.Location = JSON.stringify([{ Address: JSON.parse(row.Location)[0].Address, CountryCode: 'US' }])
    })
  } }), /native country conflicts/)
})

test('a changed current client is rejected before any token or older API deployment is read', async () => {
  let requests
  await assert.rejects(replay('britannia', { modify: ({ url, response, reads }) => {
    requests = reads
    if (url.endsWith('/main.f9eb0b1ea3273f6dfc17.chunk.js')) response.text += '\n'
  } }), /current public client bytes changed/)
  assert.ok(!requests.some(url => /\/api\//.test(url)))
})
