import assert from 'node:assert/strict'
import test from 'node:test'
import { CAREERS_URL, HOMEPAGE_URL, createLifeSignsScraper, extractVerifiedOpenRoles, hasOfficialHomepageSignal, hasOfficialCareersSignal, hasVerifiedRoleDetailSignal } from './script.js'
import { createCatalogScraper, getScraperCatalog } from '../../scraper-support/providers/index.js'
import { normalizeScrapedJob } from '../../scraper-support/utils/normalizeScrapedJob.js'
import { filterIndiaJobs } from '../../scraper-support/utils/indiaLocationFilter.js'
import { analyzePublishableJobs } from '../../scraper-support/utils/publishableJobMetrics.js'
import { readInventoryEvidence, isVerifiedEmptyEvidence, isFreshCompleteInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { buildJobDerivedFields } from '../../src/utils/jobDerivedFields.js'

// Four verbatim original controlled fixture declarations. These inputs and the
// synthetic location variants below are not native captures or company counts.
const home = {
  status: 200, url: HOMEPAGE_URL,
  title: 'AI Patient Monitoring System, Ambulance to Home | Lifesigns',
  text: 'AI-powered patient monitoring. Predictive intelligence and continuous monitoring.',
  links: ['/careers/'],
}
const careers = {
  status: 200, url: CAREERS_URL,
  title: 'Careers at Lifesigns | Challenge convention | Lifesigns',
  text: 'We challenge convention. See open roles. Explore our open roles. Didn’t see the role you’re looking for? Leave a message.',
}
const item = (slug = 'junior-video-editor', title = 'Junior Video Editor') => ({
  id: `wix-${slug}`,
  dataCollectionId: 'OpenRoles',
  data: {
    slug, title, location: 'Chennai', employmentType: 'Full-Time',
    _publishDate: '2026-09-15T00:00:00.000Z',
    body: { nodes: [{ type: 'PARAGRAPH', nodes: [{ type: 'TEXT', textData: { text: 'Edit product videos.' } }] }] },
  },
})
const detail = (slug = 'junior-video-editor', title = 'Junior Video Editor') => ({
  status: 200, url: `https://www.lifesigns.us/careers/${slug}/`, title: `${title} | Lifesigns`,
})

const SOURCE = 'lifesigns'
const provider = getScraperCatalog().find(row => row.source === SOURCE)
assert.ok(provider)
const ROLE_PATH = '/careers/junior-video-editor/'
const ROLE_URL = 'https://www.lifesigns.us' + ROLE_PATH
const clone = value => structuredClone(value)
const routes = [options => createLifeSignsScraper().run(options), options => createCatalogScraper(provider).run(options)]

const transport = (location, change = () => {}) => {
  const role = item()
  role.data.location = location
  const snapshots = { home: clone(home), careers: clone(careers), detail: detail() }
  change(snapshots)
  const original = JSON.stringify({ role, snapshots })
  const calls = [], feeds = []
  return {
    calls, feeds, role,
    options: {
      fetchPageSnapshot: async url => {
        calls.push(url)
        if (url === HOMEPAGE_URL) return snapshots.home
        if (url === CAREERS_URL) return snapshots.careers
        assert.equal(url, ROLE_URL)
        return snapshots.detail
      },
      fetchRoleItems: async () => { feeds.push('OpenRoles'); return [role] },
    },
    unchanged: () => assert.equal(JSON.stringify({ role, snapshots }), original),
  }
}

const forbidden = [
  ['foreign same-path', 'https://other.example'],
  ['credentialed declared host', 'https://user:secret@www.lifesigns.us'],
]
for (const [variant, origin] of forbidden) for (const slot of ['home', 'careers', 'detail', 'handoff']) {
  test('LifeSigns ' + variant + ' ' + slot + ' cannot admit later source phases', async () => {
    const change = snapshots => {
      if (slot === 'home') snapshots.home.url = origin + '/'
      if (slot === 'careers') snapshots.careers.url = origin + '/careers/'
      if (slot === 'detail') snapshots.detail.url = origin + ROLE_PATH
      if (slot === 'handoff') snapshots.home.links = [origin + '/careers/']
    }
    const snapshots = transport('Chennai, India', change)
    for (const execute of routes) {
      const input = transport('Chennai, India', change)
      await assert.rejects(execute(input.options), /homepage|careers page|detail page drifted/)
      assert.deepEqual(input.calls, slot === 'home' || slot === 'handoff' ? [HOMEPAGE_URL]
        : slot === 'careers' ? [HOMEPAGE_URL, CAREERS_URL] : [HOMEPAGE_URL, CAREERS_URL, ROLE_URL])
      assert.equal(input.feeds.length, slot === 'detail' ? 1 : 0)
      input.unchanged()
    }
  })
}

for (const [name, url] of [
  ['HTTP page origin', 'http://www.lifesigns.us/'],
  ['nondefault port page origin', 'https://www.lifesigns.us:8443/'],
]) test('LifeSigns ' + name + ' is rejected before careers or role-feed reads', async () => {
  for (const execute of routes) {
    const input = transport('Chennai, India', snapshots => { snapshots.home.url = url })
    await assert.rejects(execute(input.options), /homepage/)
    assert.deepEqual(input.calls, [HOMEPAGE_URL]); assert.equal(input.feeds.length, 0); input.unchanged()
  }
})

for (const clock of ['2026-09-16T00:00:00.000Z', '2026-11-01T00:00:00.000Z']) for (const [name, raw, country, location] of [
  ['original city-only role', 'Chennai', null, null],
  ['mixed-country role', 'Chennai, India / Boston, United States', null, null],
  ['unknown native workplace', 'Unspecified workplace', null, null],
  ['explicit native India', 'Chennai, India', 'India', 'Chennai, India'],
  ['explicit native US', 'Boston, Massachusetts, United States', 'US', 'Boston, Massachusetts, United States'],
]) test('LifeSigns ' + name + ' preserves raw facts and real geography gates at ' + clock, async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(clock) })
  for (const execute of routes) {
    const input = transport(raw), jobs = await execute(input.options)
    input.unchanged()
    assert.deepEqual(input.calls, [HOMEPAGE_URL, CAREERS_URL, ROLE_URL]); assert.equal(input.feeds.length, 1)
    assert.equal(jobs.length, 1)
    const job = jobs[0]
    assert.equal(job.country, country)
    assert.equal(job.location, location)
    assert.equal(job.city, null); assert.equal(job.state, null)
    assert.equal(job.nativeGeographyQualified, country !== null)
    assert.equal(job.rawNativeWorkplaceEvidence.roleLocation, raw)
    assert.equal(job.jobId, 'lifesigns-junior-video-editor')
    assert.equal(job.requisitionId, 'wix-junior-video-editor')
    assert.equal(job.title, 'Junior Video Editor')
    assert.equal(job.jobDescription, 'Edit product videos.')
    assert.equal(job.postingDate, '2026-09-15T00:00:00.000Z')
    assert.equal(job.sourceUrl, ROLE_URL); assert.equal(job.applyUrl, ROLE_URL); assert.equal(job.link, ROLE_URL)
    assert.equal(job.scrapedAt, clock)
    assert.equal(Object.hasOwn(job, 'nativeLegalEmployer'), false)
    assert.equal(job.sourceListingComplete, false); assert.equal(job.sourceScopeComplete, false); assert.equal(job.lifecycleCleanupAllowed, false)
    const normalized = normalizeScrapedJob(job, provider)
    assert.equal(normalized.country, country); assert.equal(normalized.location, location)
    assert.equal(normalized.city, null); assert.equal(normalized.state, null)
    assert.equal(normalized.sourceDescription, job.jobDescription)
    assert.equal(normalized.postedAtProvenance, 'source')
    assert.equal(normalized.postedAt.toISOString(), '2026-09-15T00:00:00.000Z')
    assert.equal(filterIndiaJobs([normalized]).length, country === 'India' ? 1 : 0)
    assert.equal(buildJobDerivedFields(normalized).isPublicIndia, country === 'India')
    const metrics = analyzePublishableJobs([normalized], { now: new Date(clock) })
    assert.equal(metrics.filterCounts.nonIndia, country === 'India' ? 0 : 1)
    assert.equal(metrics.filterCounts.closed, 0)
    assert.equal(metrics.filterCounts.old, country === 'India' && clock.startsWith('2026-11') ? 1 : 0)
    assert.equal(metrics.eligibleJobs.length, country === 'India' && clock.startsWith('2026-09') ? 1 : 0)
    const evidence = readInventoryEvidence(jobs)
    assert.equal(evidence?.status, 'coverage-gap'); assert.equal(evidence.firstParty, false)
    assert.equal(evidence.listingComplete, false); assert.equal(evidence.pagesFetched, 3)
    assert.equal(evidence.reportedTotal, null); assert.equal(evidence.indiaFacetCount, null); assert.equal(evidence.verifiedAt, null)
    assert.equal(isVerifiedEmptyEvidence(evidence), false)
    assert.equal(isFreshCompleteInventoryEvidence(evidence, { now: clock }), false)
  }
})

test('LifeSigns an empty controlled role feed remains a coverage gap with unknown authority', async () => {
  for (const execute of routes) {
    const calls = []
    const jobs = await execute({ fetchPageSnapshot: async url => { calls.push(url); return url === HOMEPAGE_URL ? home : careers }, fetchRoleItems: async () => [] })
    assert.deepEqual(calls, [HOMEPAGE_URL, CAREERS_URL]); assert.equal(jobs.length, 0)
    const evidence = readInventoryEvidence(jobs)
    assert.equal(evidence?.status, 'coverage-gap'); assert.equal(evidence.pagesFetched, 2)
    assert.equal(evidence.firstParty, false); assert.equal(evidence.listingComplete, false)
    assert.equal(evidence.reportedTotal, null); assert.equal(evidence.indiaFacetCount, null); assert.equal(evidence.verifiedAt, null)
    assert.equal(isVerifiedEmptyEvidence(evidence), false)
  }
})

test('LifeSigns existing missing and bare-remote role-workplace errors remain rejections', () => {
  for (const location of [null, '', 'Remote', 'Hybrid', 'Anywhere']) {
    const role = item(); role.data.location = location
    assert.throws(() => extractVerifiedOpenRoles(careers, [role], { [ROLE_PATH]: detail() }), /incomplete opening|needs country verification/)
  }
})


// Pre-freeze finite source-schema checks. Named countries and terminal ISO
// codes in the same raw label cannot contradict one another.
for (const raw of ['USA, Chennai, IN', 'Chennai, India, Boston, US']) {
  test('LifeSigns mixed named and coded countries remain unqualified: ' + raw, async t => {
    t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-09-16T00:00:00.000Z') })
    for (const execute of routes) {
      const input = transport(raw), jobs = await execute(input.options)
      input.unchanged()
      assert.equal(jobs.length, 1)
      assert.equal(jobs[0].country, null)
      assert.equal(jobs[0].location, null)
      assert.equal(jobs[0].nativeGeographyQualified, false)
      assert.equal(jobs[0].rawNativeWorkplaceEvidence.roleLocation, raw)
      const normalized = normalizeScrapedJob(jobs[0], provider)
      assert.equal(normalized.country, null); assert.equal(normalized.location, null)
      assert.equal(buildJobDerivedFields(normalized).isPublicIndia, false)
      assert.equal(filterIndiaJobs([normalized]).length, 0)
      assert.equal(analyzePublishableJobs([normalized], { now: new Date() }).eligibleJobs.length, 0)
      assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
    }
  })
}

test('LifeSigns non-string native role workplaces reject malformed schema instead of country coercion', async () => {
  for (const location of [['Chennai', 'India'], { city: 'Chennai', country: 'India' }, 123, true]) {
    const role = item(); role.data.location = location
    const before = JSON.stringify(role)
    assert.throws(() => extractVerifiedOpenRoles(careers, [role], { [ROLE_PATH]: detail() }), /incomplete opening/)
    assert.equal(JSON.stringify(role), before)
    for (const execute of routes) {
      const input = transport(location)
      await assert.rejects(execute(input.options), /incomplete opening/)
      input.unchanged()
    }
  }
})
