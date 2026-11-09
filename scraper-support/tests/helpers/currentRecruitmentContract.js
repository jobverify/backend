import assert from 'node:assert/strict'
import test from 'node:test'
import { getScraperCatalog, createCatalogScraper } from '../../providers/index.js'
import { readInventoryEvidence } from '../../utils/inventoryEvidence.js'
import { RECRUITMENT_OBSERVATIONS } from '../../utils/verifiedRecruitment.js'
import { classifyProviderImplementation } from '../../../scripts/reportScriptCatalogTopology.js'

const description = '<p>Design and operate production software services, investigate distributed system failures, review API contracts and collaborate with the engineering team on reliable delivery.</p>'

// Current production behavior replaces the historical unconditional-empty
// contract. Every case supplies its transport; source notes are never live proof.
export function registerCurrentRecruitmentContract(source, label = 'current') {
  const provider = getScraperCatalog().find(item => item.source === source)
  assert.ok(provider)
  const root = new URL(/myworkdayjobs|smartrecruiters|ashbyhq|greenhouse|lever\.co|breezy\.hr|workable\.com/i.test(provider.companyCareerPage)
    ? provider.officialHomepageUrl : provider.companyCareerPage)
  root.search = ''; root.hash = ''; root.pathname = root.pathname.replace(/\/$/, '') + '/jobs/native-test-role'
  const roleURL = root.href
  const record = { '@type': 'JobPosting', identifier: { value: source + '-native-1' }, title: 'Software Engineer',
    hiringOrganization: { name: provider.companyName }, url: roleURL, description,
    jobLocation: { address: { addressCountry: 'IN', addressLocality: 'Bengaluru' } }, datePosted: '2026-10-30' }
  const html = native => '<h1>Software Engineer</h1>' + native.description + '<script type="application/ld+json">' + JSON.stringify(native) + '</script>'
  const fetchPage = native => async url => ({ status: 200, url, html: url === roleURL ? html(native)
    : '<h1>Careers</h1><a href="' + roleURL + '">Open job</a>' })
  const run = options => createCatalogScraper(provider).run({ now: () => '2026-11-03T10:00:00Z', maxPages: 4,
    fetchPage: fetchPage(record), fetchJson: () => assert.fail('A first-party fixture did not advertise a native API'), ...options })
  const guard = t => {
    let calls = 0
    t.mock.method(globalThis, 'fetch', () => { calls++; throw new Error('Uncontrolled HTTP is forbidden') })
    t.after(() => assert.equal(calls, 0))
  }

  test(`${source} ${label}: registered extraction returns current native India content`, async t => {
    guard(t)
    assert.equal(classifyProviderImplementation(provider).type, 'script')
    assert.equal(provider.parser, 'runtime-verified-recruitment')
    assert.equal(provider.zeroResultPolicy, 'evidence-required')
    assert.equal(provider.verifiedIndiaJobCount, null)
    const jobs = await run()
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].company, provider.companyName)
    assert.equal(jobs[0].source, source)
    assert.equal(jobs[0].applyUrl, roleURL)
    assert.equal(jobs[0].sourceDescription, description)
    assert.equal(jobs[0].postingDate, record.datePosted)
    assert.equal(jobs[0].lifecycleCleanupAllowed, false)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.ok(jobs[RECRUITMENT_OBSERVATIONS])
  })
  test(`${source} ${label}: a foreign employer or unresolved country never becomes an India job`, async t => {
    guard(t)
    for (const change of [{ hiringOrganization: { name: 'Unrelated Employer' } },
      { jobLocation: { address: { addressCountry: 'US', addressLocality: 'Bengaluru' } } },
      { jobLocation: { address: { addressLocality: 'Bengaluru' } } }]) {
      const jobs = await run({ fetchPage: fetchPage({ ...record, ...change }) })
      assert.equal(jobs.length, 0)
      assert.notEqual(readInventoryEvidence(jobs).status, 'verified-empty')
    }
  })
  test(`${source} ${label}: blocked and failed current pages retain their external failure classification`, async t => {
    guard(t)
    for (const status of [403, 503]) await assert.rejects(run({ fetchPage: async url => ({ status, url, html: '' }) }),
      error => {
        assert.equal(error.failureKind, status === 403 ? 'blocked_or_access_denied' : 'network_or_timeout')
        assert.equal(error.status, status)
        assert.equal(error.upstreamOutage, true)
        assert.equal(error.abortRetries, true)
        assert.equal(error.recruitmentObservations.sourceScopeComplete, false)
        assert.equal(error.recruitmentObservations.lifecycleCleanupAllowed, false)
        assert.ok(error.recruitmentObservations.receipts.some(row => row.status === status))
        assert.match(error.message, new RegExp('HTTP ' + status))
        return true
      })
  })
  test(`${source} ${label}: an unrelated redirect cannot authorize a role or guessed API`, async t => {
    guard(t)
    await assert.rejects(run({ fetchPage: async () => ({ status: 200, url: 'https://unrelated.test/jobs', html: html(record) }) }),
      error => error.failureKind === 'coverage_gap')
  })
  test(`${source} ${label}: hidden links and incomplete job data retain unknown coverage`, async t => {
    guard(t)
    await assert.rejects(run({ fetchPage: async url => ({ status: 200, url, html:
      '<template><a href="' + roleURL + '">Jobs</a></template><script>const sample="https://jobs.ashbyhq.com/other"</script>' }) }),
      error => error.failureKind === 'coverage_gap')
    const jobs = await run({ fetchPage: fetchPage({ ...record, description: '<p>Apply now</p>' }) })
    assert.equal(jobs.length, 0)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  })
  test(`${source} ${label}: cancellation reaches the current request boundary`, async t => {
    guard(t)
    const before = new AbortController(); before.abort(new Error('cancelled before request'))
    await assert.rejects(run({ signal: before.signal, fetchPage: () => assert.fail('Cancelled source must not fetch') }), /cancelled before request/)
    const during = new AbortController()
    await assert.rejects(run({ signal: during.signal, fetchPage: async url => {
      during.abort(new Error('cancelled during request')); return { status: 200, url, html: html(record) }
    } }), /cancelled during request/)
  })
}
