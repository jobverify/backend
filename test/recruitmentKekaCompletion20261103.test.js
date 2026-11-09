import assert from 'node:assert/strict'
import test from 'node:test'
import { createVerifiedRecruitmentScraper, RECRUITMENT_OBSERVATIONS } from '../scraper-support/utils/verifiedRecruitment.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

const source = { source: 'example-keka', companyName: 'Example', companyDomain: 'example.test', companyCareerPage: 'https://example.test/careers' }
const root = 'https://example.keka.com/careers/'
const identifier = 'fc1b8ba5-76ef-4c3f-88c3-3b54f88acc15'
const embedded = root + 'api/embedjobs/' + identifier
const infoURL = root + 'api/organization/default/careerportalinfo'
const jobsURL = root + 'api/embedjobs/default/active/' + identifier
const documentURL = 'https://example.keka.com/ats/documents/' + identifier + '/careerportal/1234abcd.html'
const rendererURL = root + 'api/embedjobs/js/' + identifier
const description = '<p>Develop reliable production services, collaborate with product teams, review software designs and investigate operational failures to improve availability and performance.</p>'
const location = { id: 1, name: 'Bengaluru', city: 'Bengaluru', state: 'Karnataka', countryCode: 'IN', countryName: 'India' }
const native = { id: 123, title: 'Software Engineer', description, publishedOn: '2026-10-30T12:00:00Z', jobLocations: [location] }
const account = { name: 'Example', shortName: 'Example', careersPortalDomain: 'example.keka.com', companyWebsite: 'https://example.test/' }
const embed = `<script>$.when($.ajax('${jobsURL}'), $.ajax('${infoURL}')).then(function() {}); const role = '/careers/jobdetails/' + job.id;</script>`
const renderer = 'fetch(khConfig.domain + `api/organization/${portalName}/careerportalinfo`); fetch(khConfig.domain + `api/embedjobs/${portalName}/active/` + khConfig.identifier); const role = "jobdetails/" + job.id; const locations = job.jobLocations;'
const run = ({ info = account, jobs = [native], career = `<h1>Example Careers</h1><iframe src="${embedded}"></iframe>`, pages = {}, ...options } = {}, provider = source) => {
  const calls = []
  return createVerifiedRecruitmentScraper(provider).run({ now: () => '2026-11-03T14:00:00Z',
    fetchPage: async url => { calls.push(url); return { status: 200, url, contentType: url === rendererURL ? 'text/js' : 'text/html', html: url === provider.companyCareerPage ? career
      : url === embedded ? embed : pages[url] || '<h1>Example</h1>' } },
    fetchJson: async url => { calls.push(url); return url === infoURL ? info : url === jobsURL ? jobs : assert.fail('Unexpected API ' + url) },
    ...options,
  }).then(result => ({ result, calls }))
}

test('reads only the Keka account and full typed-country roles declared by the current embedded renderer', async () => {
  const { result, calls } = await run()
  assert.equal(result.length, 1)
  assert.equal(result[0].jobId, '123')
  assert.equal(result[0].applyUrl, root + 'jobdetails/123')
  assert.equal(result[0].nativeHiringOrganization.name, account.name)
  assert.equal(result[0].sourceDescription, description)
  assert.equal(result[0].postingDate, native.publishedOn)
  assert.equal(result[0].country, 'India')
  assert.ok(calls.includes(infoURL) && calls.includes(jobsURL))
  assert.equal(result[0].lifecycleCleanupAllowed, false)
})

test('follows the literal native portal document and literal khConfig before reading its renderer', async () => {
  const { result } = await run({ career: `<h1>Example Careers</h1><a href="${root}">Jobs</a>`, pages: {
    [root]: `<script>fetch('${new URL(documentURL).pathname}').then(r => r.text())</script>`,
    [documentURL]: `<script>window.khConfig = { identifier: '${identifier}', domain: '${root}', targetContainer: '#jobs' };</script><script src="${rendererURL}"></script>`,
    [rendererURL]: renderer,
  } })
  assert.equal(result.length, 1)
})

for (const [name, changes] of [
  ['another company', { info: { ...account, name: 'Another Company' } }],
  ['another tenant', { info: { ...account, careersPortalDomain: 'other.keka.com' } }],
  ['a different reciprocal website', { info: { ...account, companyWebsite: 'https://other.test/' } }],
  ['an invalid feed envelope', { jobs: { error: 'unavailable' } }],
  ['conflicting typed countries', { jobs: [{ ...native, jobLocations: [{ ...location, countryName: 'United States' }] }] }],
  ['a duplicate job identity', { jobs: [native, { ...native, title: 'Another job' }] }],
]) test('Keka preserves coverage failure for ' + name, async () => {
  try {
    const { result } = await run(changes)
    assert.ok(result[RECRUITMENT_OBSERVATIONS].failures.length || result[RECRUITMENT_OBSERVATIONS].unresolved.length)
    assert.equal(readInventoryEvidence(result).listingComplete, false)
    assert.notEqual(readInventoryEvidence(result).status, 'verified-empty')
  } catch (error) { assert.equal(error.failureKind, 'coverage_gap') }
})

test('an active empty Keka feed proves the feed was read, without certifying the whole company empty', async () => {
  const { result } = await run({ jobs: [] })
  assert.equal(result.length, 0)
  assert.equal(result[RECRUITMENT_OBSERVATIONS].nativeInventoryReads[0].kind, 'keka')
  assert.notEqual(readInventoryEvidence(result).status, 'verified-empty')
})

test('inert or commented Keka handoffs cannot grant an account', async () => {
  for (const career of [`<h1>Example Careers</h1><!-- <iframe src="${embedded}"></iframe> -->`, `<h1>Example Careers</h1><template><iframe src="${embedded}"></iframe></template>`]) {
    await assert.rejects(run({ career }), error => error.failureKind === 'coverage_gap')
  }
})

const feedURL = 'https://careers.example.test/webflow.php'
const feedSource = { ...source, nativeJsonFeed: { contract: 'keka-webflow', url: feedURL, rolePrefix: root + 'jobdetails/' } }
const feedRole = { id: 'ecc8aab6-0adf-4709-ac21-14b1bb4e2398', name: native.title, url: root + 'jobdetails/123', description,
  published_date: native.publishedOn, type: { name: 'Full-Time' }, location: { city: 'Bengaluru', country: { name: 'India' } },
  locations: [{ city: 'Bengaluru', country: { name: 'India' } }], company: { name: '' } }
const runFeed = (changes = {}, career = `<h1>Example Careers</h1><script>$.ajax({url:'${feedURL}',dataType:'text',success:function(raw){renderJobs(JSON.parse(raw));}})</script>`, provider = feedSource) => createVerifiedRecruitmentScraper(provider).run({
  now: () => '2026-11-03T14:00:00Z',
  fetchPage: async url => ({ status: 200, url, html: url === source.companyCareerPage ? career : '<h1>Example</h1>' }),
  fetchJson: async url => { assert.equal(url, feedURL); return [{ ...feedRole, ...changes }] },
})

test('reads a first-party JSON feed only when its active Ajax request is still declared', async () => {
  const result = await runFeed()
  assert.equal(result.length, 1)
  assert.equal(result[0].nativeHiringOrganization, null)
  assert.equal(result[0].nativeEmployerBinding.surface, feedURL)
  assert.equal(result[0].nativeSourceRecord.id, feedRole.id)
  assert.equal(result[0].applyUrl, feedRole.url)
  assert.equal(result[0].sourceDescription, description)
  assert.equal(result[0].sourceScopeComplete, false)
})

test('a feed mentioned in comments, strings or an inert script cannot grant inventory access', async () => {
  for (const career of [`<h1>Example Careers</h1><!-- <script>$.ajax({url:'${feedURL}'})</script> -->`,
    `<h1>Example Careers</h1><script>const example = "$.ajax({url:'${feedURL}'})"</script>`,
    `<h1>Example Careers</h1><template><script>$.ajax({url:'${feedURL}'})</script></template>`]) {
    await assert.rejects(runFeed({}, career), error => error.failureKind === 'coverage_gap')
  }
})

test('the declared feed cannot broaden employer, country or role URL scope', async () => {
  for (const changes of [{ company: { name: 'Another company' } }, { url: 'https://foreign.test/job/123' },
    { locations: [{ city: 'Bengaluru', country: { name: 'US' } }], location: { city: 'Bengaluru', country: { name: 'IN' } } }]) {
    try { assert.equal((await runFeed(changes)).length, 0) } catch (error) { assert.equal(error.failureKind, 'coverage_gap') }
  }
  const protectedJobs = await runFeed({}, undefined, { ...feedSource, requireNativeEmployerName: true })
  assert.equal(protectedJobs.length, 0)
})
