import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs/promises'
import { createMetricStreamScraper } from '../../scraper/metricstream/script.js'
import { readInventoryEvidence, isVerifiedEmptyEvidence } from '../utils/inventoryEvidence.js'

const fixtureRoot = new URL('./fixtures/metricstream-linkedin/', import.meta.url)
const fixtures = Object.fromEntries(await Promise.all(['home', 'careers', 'head', 'jobs', 'delivery'].map(async name => [name, await fs.readFile(new URL(name + '.html', fixtureRoot), 'utf8')])))
const urls = {
  home: 'https://www.metricstream.com/',
  careers: 'https://www.metricstream.com/about-us/careers.htm',
  head: 'https://www.metricstream.com/careers/head-of-services.html',
  jobs: 'https://www.linkedin.com/company/metricstream/jobs',
  delivery: 'https://in.linkedin.com/jobs/view/delivery-manager-at-metricstream-4468518584',
}
const now = () => '2026-10-09T00:15:00.000Z'
const exercise = async ({ changes = {}, readOverride, signal } = {}) => {
  const input = { ...fixtures, ...changes }
  const read = async (url, options = {}) => {
    const key = Object.keys(urls).find(key => urls[key] === url)
    assert.ok(key, 'Expected a published MetricStream URL, received ' + url)
    if (readOverride) {
      const override = await readOverride(key, input[key], options)
      if (override !== undefined) return override
    }
    return input[key]
  }
  return createMetricStreamScraper({ fetchText: read, fetchLinkedInText: read, now }).run({ signal })
}

test('MetricStream recovers a current employer-published India role while preserving the unresolved primary country conflict', async () => {
  const jobs = await exercise()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Delivery Manager')
  assert.equal(jobs[0].jobId, '4468518584')
  assert.equal(jobs[0].company, 'MetricStream')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].location, 'Bengaluru, Karnataka, India')
  assert.equal(jobs[0].sourceUrl, urls.delivery)
  assert.equal(jobs[0].applyUrl, urls.delivery)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(jobs[0].jobDescription.length, 3601)
  assert.match(jobs[0].jobDescription, /Responsible for end-to-end implementation of MetricStream Apps/)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.firstParty, true)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.match(evidence.reason, /head-of-services\.html/)
  assert.match(evidence.reason, /Bangalore, India/)
  assert.match(evidence.reason, /United States/)
  assert.equal(isVerifiedEmptyEvidence(evidence), false)
})

const mutateJobSchema = (html, mutate) => html.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/i, (_match, open, body, close) => {
  const data = JSON.parse(body)
  mutate(data)
  return open + JSON.stringify(data) + close
})

for (const [name, changes, pattern] of [
  ['foreign company feed canonical', { jobs: fixtures.jobs.replace('href="https://www.linkedin.com/company/metricstream/jobs"', 'href="https://www.linkedin.com/company/unrelated/jobs"') }, /company feed identity/],
  ['foreign employer role card', { jobs: fixtures.jobs.replace('https://www.linkedin.com/company/metricstream?trk=org-job-results_main-jobs-card-subtitle', 'https://www.linkedin.com/company/unrelated?trk=org-job-results_main-jobs-card-subtitle') }, /foreign-employer role card/],
  ['foreign application authority', { jobs: fixtures.jobs.replace('https://in.linkedin.com/jobs/view/delivery-manager-at-metricstream-4468518584', 'https://unrelated.example/jobs/view/delivery-manager-at-metricstream-4468518584') }, /role card/],
  ['duplicate native posting identifier', { jobs: fixtures.jobs.replace('urn:li:jobPosting:4441475372', 'urn:li:jobPosting:4468518584') }, /role card/],
  ['changed detail canonical identity', { delivery: fixtures.delivery.replace('href="' + urls.delivery + '"', 'href="https://in.linkedin.com/jobs/view/delivery-manager-at-metricstream-12345"') }, /job identity/],
  ['foreign native hiring organization', { delivery: mutateJobSchema(fixtures.delivery, data => { data.hiringOrganization.sameAs = 'https://www.linkedin.com/company/unrelated' }) }, /job identity or employer/],
  ['foreign native workplace country despite India text', { delivery: mutateJobSchema(fixtures.delivery, data => { data.jobLocation.address.addressCountry = 'US' }) }, /native India workplace country/],
  ['unscoped native workplace country', { delivery: mutateJobSchema(fixtures.delivery, data => { delete data.jobLocation.address.addressCountry }) }, /native India workplace country/],
  ['conflicting native city', { delivery: mutateJobSchema(fixtures.delivery, data => { data.jobLocation.address.addressLocality = 'Chennai' }) }, /native India workplace country/],
  ['expired native posting', { delivery: mutateJobSchema(fixtures.delivery, data => { data.validThrough = '2026-10-08T00:00:00Z' }) }, /currently open native application/],
  ['future native posting', { delivery: mutateJobSchema(fixtures.delivery, data => { data.datePosted = '2026-10-10T00:00:00Z' }) }, /currently open native application/],
  ['missing native expiry', { delivery: mutateJobSchema(fixtures.delivery, data => { delete data.validThrough }) }, /currently open native application/],
  ['closed native application', { delivery: fixtures.delivery.replace('</body>', '<p>No longer accepting applications</p></body>') }, /currently open native application/],
  ['missing native apply surface', { delivery: fixtures.delivery.replaceAll('public_jobs_apply-link-onsite', 'removed-apply-surface') }, /currently open native application/],
  ['missing published description', { delivery: mutateJobSchema(fixtures.delivery, data => { data.description = '' }) }, /description is missing/],
  ['conflicting visible description', { delivery: fixtures.delivery.replace('Title: Manager, Service Delivery</strong>', 'Title: Unrelated Job</strong>') }, /description is missing or conflicts/],
  ['only unscoped Remote cards', { jobs: fixtures.jobs.replace('Bengaluru, Karnataka, India', 'Remote') }, /no current independently verified India roles/],
]) {
  test('MetricStream partial employer subset rejects ' + name, async () => {
    await assert.rejects(exercise({ changes }), pattern)
  })
}

test('MetricStream cannot use a commented employer handoff to suppress its primary location conflict', async () => {
  const changes = { careers: fixtures.careers.replace(/<a\b[^>]*href="https:\/\/www\.linkedin\.com\/company\/metricstream"[^>]*>[\s\S]*?<\/a>/i, match => '<!--' + match + '-->') }
  let secondaryRead = false
  await assert.rejects(exercise({ changes, readOverride: key => { if (['jobs', 'delivery'].includes(key)) secondaryRead = true } }), /incomplete country scope.*conflicting/)
  assert.equal(secondaryRead, false)
})

test('MetricStream preserves a secondary native access failure with the unresolved primary conflict', async () => {
  const accessError = Object.assign(new Error('HTTP 403 from published employer jobs feed'), { status: 403 })
  await assert.rejects(exercise({ readOverride: key => { if (key === 'jobs') throw accessError } }), error => {
    assert.equal(error, accessError)
    assert.equal(error.status, 403)
    assert.match(error.primaryInventoryConflict, /conflicting listing and detail locations/)
    return true
  })
})

test('MetricStream rejects a listing snapshot that changes after detail verification', async () => {
  let pages = 0
  await assert.rejects(exercise({ readOverride: (key, html) => key === 'jobs' && ++pages === 2 ? html.replace('datetime="2026-09-22"', 'datetime="2026-09-23"') : undefined }), /listing changed during traversal/)
})

test('MetricStream forwards caller cancellation into the partial traversal', async () => {
  const controller = new AbortController()
  const abort = new Error('Caller cancelled MetricStream')
  await assert.rejects(exercise({ signal: controller.signal, readOverride: (key, _html, options) => {
    if (key === 'delivery') {
      assert.equal(options.signal, controller.signal)
      controller.abort(abort)
    }
  } }), error => error === abort)
})

test('MetricStream native LinkedIn transport rejects redirects beyond the published authority', async () => {
  const { fetchLinkedInPublicText } = await import('../../scraper/metricstream/script.js')
  await assert.rejects(fetchLinkedInPublicText(urls.jobs, { fetchImpl: async (_url, options) => {
    assert.ok(options.signal instanceof AbortSignal)
    return { ok: true, url: 'https://unrelated.example/', text: async () => fixtures.jobs }
  } }), /final redirect changed the published authority/)
  await assert.rejects(fetchLinkedInPublicText(urls.jobs, { fetchImpl: async () => ({ ok: false, status: 429 }) }), error => error.status === 429 && error.abortRetries === true)
})

test('MetricStream native LinkedIn transport stops before a request when already cancelled', async () => {
  const { fetchLinkedInPublicText } = await import('../../scraper/metricstream/script.js')
  const controller = new AbortController()
  const abort = new Error('Already cancelled')
  controller.abort(abort)
  await assert.rejects(fetchLinkedInPublicText(urls.jobs, { signal: controller.signal, fetchImpl: async () => { assert.fail('A cancelled operation must not issue a request') } }), error => error === abort)
})


test('MetricStream rejects a foreign workplace declared in the JD despite India schema and card fields', async () => {
  const delivery = mutateJobSchema(fixtures.delivery, data => { data.description = data.description.replace('Job Location: - Bengaluru, Karnataka', 'Job Location: - Les Ulis, France') })
    .replace('Job Location: - Bengaluru, Karnataka</p>', 'Job Location: - Les Ulis, France</p>')
  await assert.rejects(exercise({ changes: { delivery } }), /conflicting.*JD workplace/)
})

for (const middle of ['United States', 'US', 'Karnataka, United States']) {
  test('MetricStream rejects a foreign or extra workplace region before India: ' + middle, async () => {
    const location = 'Bengaluru, ' + middle + ', India'
    await assert.rejects(exercise({ changes: {
      jobs: fixtures.jobs.replaceAll('Bengaluru, Karnataka, India', location),
      delivery: mutateJobSchema(fixtures.delivery, data => { data.description = data.description.replace('Job Location: - Bengaluru, Karnataka', 'Job Location: - Bengaluru, ' + middle) }).replaceAll('Bengaluru, Karnataka, India', location).replace('Job Location: - Bengaluru, Karnataka</p>', 'Job Location: - Bengaluru, ' + middle + '</p>'),
    } }), /native India workplace country/)
  })
}
for (const region of ['United States', 'US', 'Tamil Nadu']) {
  test('MetricStream rejects contradictory structured workplace region: ' + region, async () => {
    await assert.rejects(exercise({ changes: { delivery: mutateJobSchema(fixtures.delivery, data => { data.jobLocation.address.addressRegion = region }) } }), /native India workplace country/)
  })
}
test('MetricStream accepts a matching published Indian state in the workplace schema', async () => {
  const jobs = await exercise({ changes: { delivery: mutateJobSchema(fixtures.delivery, data => { data.jobLocation.address.addressRegion = 'Karnataka' }) } })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceListingComplete, false)
})
