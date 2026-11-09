import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { createOfficialAtsRecoveryScraper, OFFICIAL_ATS_DISCOVERY } from '../scraper-support/utils/officialAtsRecovery.js'
import { getScraperCatalog, createCatalogScraper, decorateJobsWithProviderMetadata } from '../scraper-support/providers/index.js'
import { classifyProviderImplementation } from '../scripts/reportScriptCatalogTopology.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../scraper-support/utils/sourceObservationEvidence.js'

// Synthetic transport contracts exercise production discovery and native ATS
// validation. These are not represented as captures of the named live sites.
const provider = { source: 'fixture', companyName: 'Fixture Employer', companyDomain: 'employer.test',
  companyCareerPage: 'https://employer.test/careers', verifiedPublicJobCount: 0, verifiedIndiaJobCount: 0 }
const native = {
  id: 'native-role-id', title: 'Software Engineer', location: 'Bengaluru, India',
  address: { postalAddress: { addressLocality: 'Bengaluru', addressRegion: 'Karnataka', addressCountry: 'IN' } },
  jobUrl: 'https://jobs.ashbyhq.com/actual-board/native-role-id',
  applyUrl: 'https://jobs.ashbyhq.com/actual-board/native-role-id/application',
  descriptionHtml: '<p>Develop and operate the employer production platform, implement reliable service APIs, and investigate failures in distributed systems.</p>',
  isListed: true,
}
const pageWith = html => async url => url === provider.companyCareerPage
  ? { status: 200, url, html } : { status: 404, url, html: '' }
const boundPage = pageWith('<a href="https://jobs.ashbyhq.com/actual-board">Open roles</a>')
const run = options => createOfficialAtsRecoveryScraper(provider).run({ fetchPage: boundPage,
  fetchJson: async url => {
    assert.equal(url, 'https://api.ashbyhq.com/posting-api/job-board/actual-board')
    return { apiVersion: '1', jobs: [native] }
  }, ...options })

test('former-placeholder recovery discovers the actual board and extracts complete India role details', async () => {
  const jobs = await run()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, provider.source)
  assert.equal(jobs[0].company, provider.companyName)
  assert.equal(jobs[0].jobDescription, native.descriptionHtml)
  assert.equal(jobs[0].applyUrl, native.applyUrl)
  assert.equal(jobs[0].officialAtsBinding.verified, true)
  assert.equal(jobs[OFFICIAL_ATS_DISCOVERY].boards[0].boardToken, 'actual-board')
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('empty and foreign native inventories retain unknown whole-company scope', async () => {
  for (const jobs of [[], [{ ...native, location: 'San Francisco, United States',
    address: { postalAddress: { addressCountry: 'US' } } }]]) {
    const result = await run({ fetchJson: async () => ({ apiVersion: '1', jobs }) })
    assert.equal(result.length, 0)
    assert.equal(readInventoryEvidence(result).status, 'discovery-only')
    assert.equal(readInventoryEvidence(result).listingComplete, false)
  }
})

test('catalog decoration preserves current official ATS discovery when no India role was returned', async () => {
  const jobs = await run({ fetchJson: async () => ({ apiVersion: '1', jobs: [] }) })
  const decorated = decorateJobsWithProviderMetadata(jobs, provider)
  assert.deepEqual(decorated, [])
  assert.equal(decorated[OFFICIAL_ATS_DISCOVERY], jobs[OFFICIAL_ATS_DISCOVERY])
  assert.equal(decorated[OFFICIAL_ATS_DISCOVERY]?.boards[0].boardToken, 'actual-board')
  assert.equal(Object.getOwnPropertyDescriptor(decorated, OFFICIAL_ATS_DISCOVERY)?.enumerable, false)
  assert.equal(readInventoryEvidence(decorated).listingComplete, false)
})

test('missing, inactive, script-only, blocked and ambiguous bindings never fetch a guessed ATS feed', async () => {
  const anchor = '<a href="https://jobs.ashbyhq.com/actual-board">Open roles</a>'
  for (const html of ['', '<p>No openings listed</p>', `<!--${anchor}-->`, `<template>${anchor}</template>`,
    `<div hidden>${anchor}</div>`, `<script>const example="https://jobs.ashbyhq.com/actual-board"</script>`,
    `${anchor}<a href="https://jobs.lever.co/other-board">Open jobs</a>`]) {
    await assert.rejects(run({ fetchPage: pageWith(html), fetchJson: async () => assert.fail('Unbound API must not be requested') }),
      error => error.failureKind === 'coverage_gap' && error.softFailure === true && error.abortRetries === true)
  }
  await assert.rejects(run({ fetchPage: async url => ({ status: 403, url, html: anchor }),
    fetchJson: async () => assert.fail('Blocked employer cannot authorize an ATS') }), /binding|supported-ats/)
})

test('current employer changes select the new board instead of caching a previous tenant', async () => {
  const calls = []
  for (const board of ['actual-board', 'replacement-board']) {
    const job = { ...native, jobUrl: native.jobUrl.replace('actual-board', board), applyUrl: native.applyUrl.replace('actual-board', board) }
    const jobs = await run({ fetchPage: pageWith(`<a href="https://jobs.ashbyhq.com/${board}">Open roles</a>`),
      fetchJson: async url => { calls.push(url); return { apiVersion: '1', jobs: [job] } } })
    assert.equal(jobs[0].applyUrl, job.applyUrl)
  }
  assert.deepEqual(calls, ['https://api.ashbyhq.com/posting-api/job-board/actual-board',
    'https://api.ashbyhq.com/posting-api/job-board/replacement-board'])
})

test('active Ashby and Greenhouse embed loaders establish explicit native board bindings', async () => {
  const ashby = await run({ fetchPage: pageWith('<div id="ashby_embed"></div><script src="https://jobs.ashbyhq.com/actual-board/embed"></script>') })
  assert.equal(ashby.length, 1)
  assert.equal(ashby[0].officialAtsBinding.bindingMethod, 'official-careers-active-ats-embed')
  const greenhouse = await run({ fetchPage: pageWith('<script src="https://boards.greenhouse.io/embed/job_board/js?for=actual-board"></script>'),
    fetchJson: async url => {
      assert.equal(url, 'https://boards-api.greenhouse.io/v1/boards/actual-board/jobs?content=true')
      return { jobs: [], meta: { total: 0 } }
    } })
  assert.equal(greenhouse[OFFICIAL_ATS_DISCOVERY].boards[0].atsPlatform, 'greenhouse')
  const mixedCase = await run({ fetchPage: pageWith('<script src="https://jobs.ashbyhq.com/ActualBoard/embed"></script>'),
    fetchJson: async url => {
      assert.equal(url, 'https://api.ashbyhq.com/posting-api/job-board/ActualBoard')
      return { apiVersion: '1', jobs: [] }
    } })
  assert.equal(mixedCase[OFFICIAL_ATS_DISCOVERY].boards[0].boardToken, 'ActualBoard')
  const versionTwo = await run({ fetchPage: pageWith('<script src="https://jobs.ashbyhq.com/actual-board/embed?version=2"></script>') })
  assert.equal(versionTwo.length, 1)
})

test('same-page fragments do not consume the discovery budget before a real current job listing', async () => {
  const requests = []
  const jobs = await run({ fetchPage: async url => {
    requests.push(url)
    if (url === provider.companyCareerPage) return { status: 200, url, html:
      '<a href="#jobs">Jobs</a><a href="#roles">Roles</a><a href="#opportunities">Opportunities</a>'
      + '<a href="/jobs?office=filtered">Office jobs</a><a href="/jobs">Open roles</a>' }
    if (url === 'https://employer.test/jobs') return { status: 200, url, html:
      '<script src="https://jobs.ashbyhq.com/actual-board/embed"></script>' }
    return { status: 404, url, html: '' }
  } })
  assert.equal(jobs.length, 1)
  assert.deepEqual(requests, [provider.companyCareerPage, 'https://employer.test/jobs'])
})

test('an advertised current-openings page can establish its own active Greenhouse embed', async () => {
  const jobs = await run({ fetchPage: async url => ({ status: 200, url, html: url === provider.companyCareerPage
    ? '<a href="/current-openings">Current openings</a>'
    : '<script src="https://boards.greenhouse.io/embed/job_board/js?for=actual-board"></script>' }),
    fetchJson: async url => {
      assert.equal(url, 'https://boards-api.greenhouse.io/v1/boards/actual-board/jobs?content=true')
      return { jobs: [], meta: { total: 0 } }
    } })
  assert.equal(jobs[OFFICIAL_ATS_DISCOVERY].boards[0].atsPlatform, 'greenhouse')
})

test('native role links on a careers page establish a binding even when the anchor is only a job title', async () => {
  const uuid = 'f2b6c36c-63c2-4baf-a8be-ec768c5ac477'
  const jobs = await run({ fetchPage: pageWith(`<a href="https://jobs.ashbyhq.com/actual-board/${uuid}">Software Engineer</a>`) })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].officialAtsBinding.bindingMethod, 'official-careers-native-posting-link')
  await assert.rejects(run({ fetchPage: pageWith(`<a href="https://jobs.ashbyhq.com/actual-board/${uuid}">Talent community</a>`),
    fetchJson: async () => assert.fail('Talent community links do not bind an inventory') }), /binding/)
})

test('inert, non-executable and non-canonical ATS script URLs cannot authorize extraction', async () => {
  for (const html of [
    '<!--<script src="https://jobs.ashbyhq.com/actual-board/embed"></script>-->',
    '<template><script src="https://jobs.ashbyhq.com/actual-board/embed"></script></template>',
    '<script type="application/json" src="https://jobs.ashbyhq.com/actual-board/embed"></script>',
    '<script nomodule src="https://jobs.ashbyhq.com/actual-board/embed"></script>',
    '<script src="https://jobs.ashbyhq.com/actual-board/embed?test=true"></script>',
    '<script src="https://jobs.ashbyhq.com/actual-board/embed#stale"></script>',
    '<script src="https://boards.greenhouse.io/embed/job_board/js?for=actual-board&for=other"></script>',
    '<script src="https://boards.greenhouse.io/embed/job_board/js?for=actual-board&example=other"></script>',
  ]) await assert.rejects(run({ fetchPage: pageWith(html), fetchJson: async () => assert.fail('Inactive embed must not fetch') }), /binding/)
})

test('EU Lever region is retained from the official board binding', async () => {
  const jobs = await run({ fetchPage: pageWith('<a href="https://jobs.eu.lever.co/actual-board">Open roles</a>'),
    fetchJson: async url => { assert.equal(url, 'https://api.eu.lever.co/v0/postings/actual-board?mode=json'); return [] } })
  assert.equal(jobs.length, 0)
  assert.equal(jobs[OFFICIAL_ATS_DISCOVERY].boards[0].region, 'eu')
})

test('malformed native payloads and contradictory country evidence fail instead of returning an empty success', async () => {
  for (const payload of [null, { success: false, jobs: [] }, { apiVersion: '1', jobs: [native, native] },
    { apiVersion: '1', jobs: [{ ...native, address: { postalAddress: { addressCountry: 'US' } } }] }]) {
    await assert.rejects(run({ fetchJson: async () => payload }), /inventory|envelope/)
  }
})

test('same-token ATS boards in different regions remain distinct and require review', async () => {
  for (const hosts of [['jobs.lever.co', 'jobs.eu.lever.co'], ['boards.greenhouse.io', 'boards.eu.greenhouse.io']]) {
    await assert.rejects(run({ fetchPage: pageWith(hosts.map(host => `<a href="https://${host}/same-board">Open roles</a>`).join('')),
      fetchJson: async () => assert.fail('Conflicting regional employers must not be fetched') }), /ambiguous/)
  }
})

test('a European Greenhouse binding cannot authorize the global API endpoint', async () => {
  await assert.rejects(run({ fetchPage: pageWith('<a href="https://boards.eu.greenhouse.io/employer">Open roles</a>'),
    fetchJson: async () => assert.fail('A regional feed must not fall through to a global token') }), /regional extractor/)
})

test('an acquired-brand handoff cannot relabel unrelated parent-company Greenhouse jobs', async () => {
  await assert.rejects(run({ fetchPage: pageWith('<a href="https://boards.greenhouse.io/parent-company">Open roles</a>'),
    fetchJson: async () => ({ jobs: [{ id: 1, title: 'Engineer', company_name: 'Parent Company' }], meta: { total: 1 } }) }),
  error => error.failureKind === 'coverage_gap' && /native employer name/.test(error.message))
})

test('only explicitly reviewed native employer names can qualify a different Greenhouse employer label', async () => {
  const aliasProvider = { ...provider, nativeEmployerNames: ['Fixture Labs'] }
  const options = { fetchPage: pageWith('<a href="https://boards.greenhouse.io/actual-board">Open roles</a>'),
    fetchJson: async () => ({ jobs: [{ id: 1, title: 'Engineer', company_name: 'Fixture Labs',
      location: { name: 'United States' }, absolute_url: 'https://boards.greenhouse.io/actual-board/jobs/1',
      first_published: '2026-10-15T00:00:00Z', content: '<p>Build and operate the employer production software platform, investigate service failures, and implement reliable distributed system APIs.</p>' }], meta: { total: 1 } }) }
  const jobs = await createOfficialAtsRecoveryScraper(aliasProvider).run(options)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  await assert.rejects(createOfficialAtsRecoveryScraper(provider).run(options), /native employer name/)
  await assert.rejects(createOfficialAtsRecoveryScraper({ ...aliasProvider, nativeEmployerNames: ['Other Employer'] }).run(options), /native employer name/)
  for (const names of ['Fixture Labs', [null], [' '], ['!!!']]) {
    await assert.rejects(createOfficialAtsRecoveryScraper({ ...provider, nativeEmployerNames: names }).run({
      fetchPage: async () => assert.fail('Invalid alias configuration must not fetch'),
    }), /explicitly reviewed list/)
  }
})

test('source deadlines are bounded and invalid options fail before making requests', async () => {
  for (const sourceTimeoutMs of [0, -1, 120001, Infinity, '1000']) {
    await assert.rejects(run({ sourceTimeoutMs, fetchPage: async () => assert.fail('Invalid deadline must not fetch') }), /timeout/)
  }
})

test('caller cancellation reaches both employer discovery and native API reads', async () => {
  const before = new AbortController()
  before.abort(new Error('cancelled before source'))
  await assert.rejects(run({ signal: before.signal, fetchPage: async () => assert.fail('Cancelled run must not fetch') }), /cancelled before source/)
  const during = new AbortController()
  await assert.rejects(run({ signal: during.signal, fetchPage: async (url, { signal }) => {
    assert.equal(signal.aborted, false)
    during.abort(new Error('cancelled employer request'))
    return { status: 200, url, html: '<a href="https://jobs.ashbyhq.com/actual-board">Open roles</a>' }
  }, fetchJson: async () => assert.fail('Cancelled discovery must not reach API') }), /cancelled employer request/)
  const api = new AbortController()
  await assert.rejects(run({ signal: api.signal, fetchJson: async (url, { signal }) => {
    assert.equal(signal.aborted, false)
    api.abort(new Error('cancelled API request'))
    return { apiVersion: '1', jobs: [native] }
  } }), /cancelled API request/)
})

test('initial registered source replacements execute recovery through the production catalog', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => assert.fail('Registered recovery tests must use controlled transport'))
  const sources = ['blockchaincom', 'cloudinary', 'cloverhealth', 'dailypay', 'flatironhealth', 'influxdata',
    'goodnotes', 'duda', 'housecallpro', 'hoxhunt', 'immersivelabs', 'immuta', 'instructure', 'hyperscience', 'huntress']
  const catalog = getScraperCatalog()
  assert.equal(new Set(catalog.map(p => p.source)).size, catalog.length, 'catalog sources should remain unique')
  for (const source of sources) {
    const rows = catalog.filter(p => p.source === source)
    assert.equal(rows.length, 1, source)
    const p = rows[0]
    assert.equal(classifyProviderImplementation(p).type, 'script', source)
    assert.equal(p.backfillMode, 'live-parser')
    assert.equal(p.zeroResultPolicy, 'evidence-required')
    assert.equal(p.verifiedPublicJobCount, null)
    assert.equal(p.verifiedIndiaJobCount, null)
    if (source === 'goodnotes') {
      // Goodnotes now reads its corporate-declared original Greenhouse SSR
      // documents. The other historical recovery cases below keep Ashby controls.
      const directory = new URL('../scraper-support/tests/fixtures/currentNative20261106C27/', import.meta.url)
      const fixture = JSON.parse(gunzipSync(readFileSync(new URL('capture.json.gz', directory))))
      const expected = JSON.parse(readFileSync(new URL('expectations.json', directory))).goodnotes
      const packets = new Map(fixture.responses.filter(row => row.source === source).map(row => [row.requestedUrl, row]))
      const corporate = 'https://www.goodnotes.com/careers', board = 'https://job-boards.greenhouse.io/goodnotes'
      const roleURLs = expected.map(row => row.boardRecord.absolute_url), requests = []
      const current = await import('../scraper/goodnotes/script.js')
      assert.equal(current.DISPOSITION, 'current-corporate-declared-greenhouse-original-ssr')
      const jobs = await createCatalogScraper(p).run({ fetchPage: async (url, init) => {
        const page = packets.get(url)
        assert.ok(page, 'Only retained original Goodnotes documents: ' + url)
        assert.equal(Buffer.byteLength(page.body), page.bytes)
        assert.equal(createHash('sha256').update(page.body).digest('hex'), page.sha256)
        assert.equal(init.method, 'GET')
        assert.equal(init.body, undefined)
        requests.push(url)
        return { status: page.status, finalUrl: page.finalUrl, headers: page.headers, body: page.body }
      } })
      // Closing envelopes replay original fixture bytes; they do not certify a
      // fresh live closing observation or complete company inventory.
      assert.deepEqual(requests, [corporate, board, ...roleURLs, board, ...roleURLs, corporate])
      assert.equal(jobs.length, 1, source)
      const wanted = expected.find(row => row.id === '6216615004'), job = jobs[0]
      assert.equal(job.source, source)
      assert.equal(job.company, p.companyName)
      assert.equal(job.atsPlatform, 'greenhouse-original-ssr')
      assert.equal(job.jobId, wanted.id)
      assert.equal(job.country, null)
      assert.equal(job.sourceCountryScopeUnresolved, true)
      assert.equal(job.requisitionId, wanted.formalRequisition)
      assert.equal(job.postingDate, wanted.postingDate)
      assert.equal(createHash('sha256').update(job.sourceDescriptionHTML).digest('hex'), wanted.htmlSHA256)
      assert.equal(createHash('sha256').update(job.jobDescription.replace(/\s/g, '')).digest('hex'), wanted.compactTextSHA256)
      assert.equal(job.sourceDetailComplete, true)
      assert.equal(job.lifecycleCleanupAllowed, false)
      assert.equal(job.applicationVisited, false)
      const audit = jobs.nativeCollectionEvidence
      assert.equal(audit.observedVacancyCount, 5)
      assert.equal(audit.observedForeignCount, 4)
      assert.equal(audit.unknownCountryCount, 1)
      assert.equal(audit.closingReconciled, true)
      assert.equal(audit.sourceScopeComplete, false)
      assert.equal(audit.companyGlobalTotal, null)
      assert.equal(audit.companyIndiaTotal, null)
      assert.deepEqual(audit.originalOpeningRecords, expected.map(row => row.boardRecord))
      assert.deepEqual(audit.originalClosingRecords, audit.originalOpeningRecords)
      assert.equal(readSourceObservationEvidence(jobs, source).observedVacancyCount, 5)
      const inventory = readInventoryEvidence(jobs)
      assert.equal(inventory.listingComplete, false)
      assert.equal(inventory.reportedTotal, null)
      assert.equal(inventory.indiaFacetCount, null)
      let parsedReads = 0
      await assert.rejects(createCatalogScraper(p).run({ fetchJson: async () => { parsedReads++; return { apiVersion: '1', jobs: [native] } } }), /Original HTTP metadata/)
      assert.equal(parsedReads, 0, 'The retired parsed Ashby control cannot bypass Goodnotes original-response provenance')
      continue
    }
    const jobs = await createCatalogScraper(p).run({
      fetchPage: async url => ({ status: 200, url, html: '<a href="https://jobs.ashbyhq.com/actual-board">Open roles</a>' }),
      fetchJson: async () => ({ apiVersion: '1', jobs: [native] }),
    })
    assert.equal(jobs.length, 1, source)
    assert.equal(jobs[0].source, source)
    assert.equal(jobs[0].company, p.companyName)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  }
})
