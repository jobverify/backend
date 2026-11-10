import assert from 'node:assert/strict'
import test from 'node:test'
import { createCatalogScraper, getScraperCatalog } from '../providers/index.js'
import { readInventoryEvidence, attachInventoryEvidence, sourceLifecycleCleanupForbidden } from '../utils/inventoryEvidence.js'
import { analyzePublishableJobs } from '../utils/publishableJobMetrics.js'
import { readSourceObservationEvidence } from '../utils/sourceObservationEvidence.js'
import { recoverEmptyOnlyRecruitment } from '../utils/emptyOnlyRecruitmentRecovery.js'

const provider = getScraperCatalog().find(row => row.source === 'acceleroisa')
const clock = '2026-11-10T04:00:00.000Z'
const root = 'https://www.accelero-corp.com/'
const roleURL = 'https://www.accelero-corp.com/careers/jobs/fixture-india-1'
const description = '<p>Develop and maintain production software services, review API contracts, investigate distributed system failures, and collaborate with the engineering team.</p>'
const posting = changes => ({ '@type': 'JobPosting', identifier: { value: 'fixture-india-1' },
  title: 'Software Engineer', url: roleURL, hiringOrganization: { name: 'Accelero Corporation' },
  description, datePosted: '2026-11-09',
  jobLocation: { address: { addressCountry: 'IN', addressLocality: 'Bengaluru' } }, ...changes })
const publisher = (link = '<a href="' + roleURL + '">Open job</a>', company = 'Accelero Corporation') =>
  '<title>' + company + ' Careers</title><h1>' + company + '</h1>' + link
const role = record => '<h1>Software Engineer</h1>' + description
  + '<script type="application/ld+json">' + JSON.stringify(record) + '</script>'
const response = (url, html, status = 200) => {
  const result = new Response(html, { status, headers: { 'content-type': 'text/html' } })
  Object.defineProperty(result, 'url', { value: url })
  return result
}
const controlledModule = code => 'data:text/javascript,' + encodeURIComponent(code)
const syntheticCollector = (source, code = 'export async function run(){return []}') => createCatalogScraper({
  ...provider, source, modulePath: controlledModule(code),
})
const limits = { now: () => clock, maxRequests: 8, maxPages: 4, maxDetails: 3, sourceTimeoutMs: 3000 }
const originalTransport = t => {
  let reads = 0
  t.mock.method(globalThis, 'fetch', async url => {
    assert.ok(++reads <= 3, 'Only the three legacy reader requests use the original transport')
    assert.ok([root, root + 'careers', root + 'jobs'].includes(url))
    return response(url, publisher())
  })
}

// Synthetic controls exercise the registered empty-only Accelero collector and
// real native extraction. They do not assert live Accelero vacancies exist.
test('registered empty-only reader recovers a newly published explicit India role by default', async t => {
  t.mock.method(globalThis, 'fetch', async url => response(url,
    url === roleURL ? role(posting()) : publisher()))
  const jobs = await createCatalogScraper(provider).run(limits)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, 'fixture-india-1')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].sourceDescription, description)
  assert.deepEqual(jobs[0].nativeSourceRecord, posting())
  assert.equal(analyzePublishableJobs(jobs, { now: clock }).eligibleJobs.length, 1)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(readSourceObservationEvidence(jobs, provider.source).observedVacancyCount, 1)
})

test('unlisted script collectors never acquire an automatic fallback', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Unlisted source must not make recovery requests'))
  assert.deepEqual(await syntheticCollector('not-in-empty-only-cohort').run(limits), [])
})

test('a replacement module cannot borrow an audited source identity to enable recovery', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Replacement module must not acquire recovery authority'))
  const jobs = await syntheticCollector(provider.source).run({ emptyOnlyRecovery: { ...limits,
    fetchPage: async url => ({ status: 200, url, html: url === roleURL ? role(posting()) : publisher() }) } })
  assert.equal(jobs.length, 0)
  assert.equal(jobs.emptyOnlyRecruitmentRecovery, undefined)
})

test('a caller can explicitly keep the original empty-only reader without acquisition', async t => {
  originalTransport(t)
  const jobs = await createCatalogScraper(provider).run({ ...limits, emptyOnlyRecovery: false })
  assert.equal(jobs.length, 0)
  assert.equal(jobs.emptyOnlyRecruitmentRecovery, undefined)
})

test('original parser guard errors remain authoritative', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Original guard failure must not make recovery requests'))
  await assert.rejects(syntheticCollector(provider.source,
    'export async function run(){throw Object.assign(Error("Native schema guard rejected"),{code:"NATIVE_HTML_SHAPE"})}').run(limits),
  error => error.code === 'NATIVE_HTML_SHAPE')
})

test('original positive source output is preserved without extra acquisition', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Positive source output must not make recovery requests'))
  const jobs = await syntheticCollector(provider.source,
    'export async function run(){return [{title:"Original role",country:"India",jobDescription:"Original content"}]}').run(limits)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Original role')
  assert.equal(jobs[0].jobDescription, 'Original content')
})

test('injected source-local fetch fixtures do not trigger recovery network', async t => {
  originalTransport(t)
  const jobs = await createCatalogScraper(provider).run({ ...limits, fetchText: async () => publisher() })
  assert.deepEqual(jobs, [])
  assert.equal(jobs.emptyOnlyRecruitmentRecovery, undefined)
})

test('registered American InfoSource probeUrl fixture never acquires recovery network', async t => {
  const unexpected = []
  t.mock.method(globalThis, 'fetch', async url => {
    unexpected.push(url)
    return response(url, '<h1>American InfoSource</h1>')
  })
  const source = getScraperCatalog().find(row => row.source === 'americaninfosource')
  const jobs = await createCatalogScraper(source).run({
    probeUrl: async url => ({ url, status: 404, html: 'Not found' }), maxRequests: 1, maxPages: 1,
  })
  assert.equal(jobs.length, 0)
  assert.deepEqual(unexpected, [])
  assert.equal(jobs.emptyOnlyRecruitmentRecovery, undefined)
})

test('an explicit nested recovery transport can exercise fallback with source-local fixtures', async t => {
  originalTransport(t)
  const jobs = await createCatalogScraper(provider).run({ fetchText: async () => 'original fixture',
    emptyOnlyRecovery: { ...limits, fetchPage: async url => ({ status: 200, url,
      html: url === roleURL ? role(posting()) : publisher() }) } })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].nativeSourceRecord.hiringOrganization.name, 'Accelero Corporation')
})

for (const [name, page, record] of [
  ['inert role link', publisher('<template><a href="' + roleURL + '">Open job</a></template>'), posting()],
  ['unidentified corporate publisher', publisher(undefined, 'Unrelated Business'), posting()],
  ['foreign native employer', publisher(), posting({ hiringOrganization: { name: 'Unrelated Business' } })],
  ['missing native work country', publisher(), posting({ jobLocation: { address: { addressLocality: 'Bengaluru' } } })],
  ['US native work country', publisher(), posting({ jobLocation: { address: { addressCountry: 'US', addressLocality: 'Boston' } } })],
  ['missing full native description', publisher(), posting({ description: '<p>Apply now.</p>' })],
]) test('unqualified fallback stays an unknown zero: ' + name, async t => {
  originalTransport(t)
  const jobs = await createCatalogScraper(provider).run({ emptyOnlyRecovery: { ...limits,
    fetchPage: async url => ({ status: 200, url, html: url === roleURL ? role(record) : page }) } })
  assert.equal(jobs.length, 0)
  assert.notEqual(readInventoryEvidence(jobs)?.status, 'verified-empty')
  assert.notEqual(readInventoryEvidence(jobs)?.listingComplete, true)
  assert.ok(jobs.emptyOnlyRecruitmentRecovery)
  assert.notEqual(jobs.emptyOnlyRecruitmentRecovery.status, 'observed-india-roles')
})

test('unavailable fallback preserves original inventory evidence and its cleanup hold', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Unavailable recovery fixture must stay isolated'))
  const original = attachInventoryEvidence([], { status: 'coverage-gap', surface: root, firstParty: true, listingComplete: false,
      lifecycleCleanupAllowed: false, pagesFetched: 1, reportedTotal: null, indiaFacetCount: null,
      verifiedAt: clock, reason: 'source-owned-incomplete-evidence' })
  const jobs = await recoverEmptyOnlyRecruitment(original, provider, { emptyOnlyRecovery: { ...limits,
    fetchPage: async url => ({ status: 503, url, html: '<h1>Unavailable</h1>' }) } })
  assert.equal(jobs.length, 0)
  assert.equal(jobs, original)
  assert.equal(readInventoryEvidence(jobs).reason, 'source-owned-incomplete-evidence')
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
  assert.equal(jobs.emptyOnlyRecruitmentRecovery.failures?.some(failure => failure.status === 503), true)
  assert.match(String(jobs.emptyOnlyRecruitmentRecovery.receipts?.[0]?.bodySHA256), /^[a-f0-9]{64}$/)
})

test('a historical empty inventory does not prevent recovery of a current native India role', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Historical empty fixture must stay isolated'))
  const original = attachInventoryEvidence([], { status: 'verified-empty', surface: root, firstParty: true,
    listingComplete: true, pagesFetched: 1, reportedTotal: 0, indiaFacetCount: 0,
    verifiedAt: '2020-01-01T00:00:00.000Z', reason: 'historical-empty-snapshot' })
  const jobs = await recoverEmptyOnlyRecruitment(original, provider, { emptyOnlyRecovery: { ...limits,
    fetchPage: async url => ({ status: 200, url, html: url === roleURL ? role(posting()) : publisher() }) } })
  assert.equal(jobs.length, 1)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

for (const key of ['maxRequests', 'maxPages', 'maxDetails', 'sourceTimeoutMs']) {
  for (const placement of ['source options', 'nested recovery options']) {
    test(`zero ${key} in ${placement} cannot acquire recovery requests or roles`, async t => {
      const requests = []
      t.mock.method(globalThis, 'fetch', async url => {
        requests.push(url)
        return response(url, url === roleURL ? role(posting()) : publisher())
      })
      const original = []
      const options = placement === 'source options' ? { ...limits, [key]: 0 }
        : { ...limits, emptyOnlyRecovery: { [key]: 0 } }
      const jobs = await recoverEmptyOnlyRecruitment(original, provider, options)
      assert.deepEqual(requests, [], 'A disabled budget must never expand to the default request allowance')
      assert.equal(jobs, original)
      assert.equal(jobs.emptyOnlyRecruitmentRecovery, undefined)
    })
  }
}

test('invalid recovery budgets preserve the original result without requesting public pages', async t => {
  const requests = []
  t.mock.method(globalThis, 'fetch', async url => {
    requests.push(url)
    return response(url, url === roleURL ? role(posting()) : publisher())
  })
  for (const key of ['maxRequests', 'maxPages', 'maxDetails', 'sourceTimeoutMs']) {
    for (const invalid of [-1, 1.5, NaN, Infinity, '2']) {
      const original = []
      const jobs = await recoverEmptyOnlyRecruitment(original, provider, {
        ...limits, emptyOnlyRecovery: { [key]: invalid },
      })
      assert.deepEqual(requests, [], `${key} with ${String(invalid)} must not permit default-budget requests`)
      assert.equal(jobs, original)
    }
  }
})

test('a positive recovery request cap is enforced by native discovery', async t => {
  const requests = []
  t.mock.method(globalThis, 'fetch', async url => {
    requests.push(url)
    return response(url, url === roleURL ? role(posting()) : publisher())
  })
  const original = []
  const jobs = await recoverEmptyOnlyRecruitment(original, provider, { ...limits, maxRequests: 1 })
  assert.equal(requests.length, 1)
  assert.equal(jobs, original)
})
