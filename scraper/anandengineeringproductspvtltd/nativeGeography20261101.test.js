import assert from 'node:assert/strict'
import test from 'node:test'
import { createAnandEngineeringProductsScraper, run, parseJobDetail } from './script.js'
import { createCatalogScraper, getScraperCatalog } from '../../scraper-support/providers/index.js'
import { normalizeScrapedJob } from '../../scraper-support/utils/normalizeScrapedJob.js'
import { filterIndiaJobs } from '../../scraper-support/utils/indiaLocationFilter.js'
import { analyzePublishableJobs } from '../../scraper-support/utils/publishableJobMetrics.js'
import { buildJobDerivedFields } from '../../src/utils/jobDerivedFields.js'
import { readInventoryEvidence, isVerifiedEmptyEvidence, isFreshCompleteInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

// These four declarations are verbatim existing controlled fixtures. They are
// synthetic test input, not retained native HTTP or an employer-scope proof.
const home = `<html><head><title>Anand Engineering | Heavy Steel Fabrication &amp; Manufacturing</title></head><body><a href="https://anandengg.in/open-positions/">Careers</a><p>D56, Developed Plot Estate, Thuvakudi, Trichy</p><a href="mailto:admin@anandengg.in">Email</a></body></html>`
const card = (id, title, slug) => `<div data-elementor-type="loop-item" class="elementor e-loop-item post-${id} job-opening type-job-opening status-publish"><h1>${title}</h1><span>August 29, 2026</span><span>5-8 Years</span><a href="https://anandengg.in/job-opening/${slug}/">Apply</a></div>`
const listing = (page, maxPage, cards) => `<html><head><title>Open Positions - Anand Engineering</title><link rel="canonical" href="https://anandengg.in/open-positions/" /></head><body>${cards}<div class="e-load-more-anchor" data-page="${page}" data-max-page="${maxPage}" data-next-page="https://anandengg.in/open-positions/${page + 1}/"></div></body></html>`
const detail = (title, slug) => `<html><head><title>${title} - Anand Engineering</title><link rel="canonical" href="https://anandengg.in/job-opening/${slug}/" /></head><body><h1>${title}</h1><div><h3><strong>Job Description</strong></h3><p>Build manufacturing processes and improve quality.</p><p><strong>Job Experience :</strong> 5 &#8211; 8 yrs</p></div><form name="Career Form"><h5>Application Form</h5></form></body></html>`

const CLOCK = '2026-08-30T00:00:00.000Z'
const SOURCE = 'anandengineeringproductspvtltd'
const TITLE = 'Executive/Senior Executive \u2013 Finance'
const SLUG = 'executive-senior-executive-finance'
const URL = 'https://anandengg.in/job-opening/' + SLUG + '/'
const rawDetail = detail('Executive/Senior Executive &#8211; Finance', SLUG)
const originalDescription = 'Build manufacturing processes and improve quality. Job Experience : 5 \u2013 8 yrs'
const provider = getScraperCatalog().find(row => row.source === SOURCE)
assert.ok(provider)
const rawCard = { jobId: '991698', title: TITLE, applyUrl: URL, postingDate: '2026-08-29', experienceRequired: '5-8 Years' }
const withWorkplace = value => rawDetail.replace('</div><form', value + '</div><form')
const cohort = async (t, html, expected = { country: null, location: null, qualified: false }) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(CLOCK) })
  const pages = new Map([
    ['https://anandengg.in/', home],
    ['https://anandengg.in/open-positions/', listing(1, 1, card('991698', 'Executive/Senior Executive &#8211; Finance', SLUG))],
    [URL, html],
  ])
  const before = [...pages]
  const result = []
  for (const execute of [options => createAnandEngineeringProductsScraper().run(options), run, options => createCatalogScraper(provider).run(options)]) {
    const calls = []
    const jobs = await execute({ fetchText: async url => {
      calls.push(url)
      assert.ok(pages.has(url), 'Unexpected controlled request ' + url)
      return pages.get(url)
    } })
    assert.deepEqual(calls, [...pages.keys()])
    assert.deepEqual([...pages], before)
    assert.equal(jobs.length, 1)
    const job = jobs[0]
    assert.deepEqual(Object.fromEntries(['source', 'company', 'title', 'jobId', 'requisitionId', 'sourceUrl', 'applyUrl', 'link', 'postingDate', 'experienceRequired', 'scrapedAt'].map(k => [k, job[k]])), {
      source: SOURCE, company: 'Anand Engineering Products Pvt Ltd.', title: TITLE,
      jobId: '991698', requisitionId: null, sourceUrl: URL, applyUrl: URL, link: URL,
      postingDate: '2026-08-29', experienceRequired: '5-8 Years', scrapedAt: CLOCK,
    })
    assert.ok(job.jobDescription.startsWith(originalDescription))
    assert.equal(job.country, expected.country, 'authored country before authority checks')
    assert.equal(job.location, expected.location, 'authored workplace before authority checks')
    assert.equal(job.nativeGeographyQualified, expected.qualified)
    const evidence = readInventoryEvidence(jobs)
    assert.equal(evidence?.status, 'coverage-gap')
    assert.equal(evidence.listingComplete, false)
    assert.equal(evidence.firstParty, false) // Current legal/entity binding is not proved by these fixtures.
    assert.equal(evidence.pagesFetched, 3)
    assert.equal(evidence.reportedTotal, null)
    assert.equal(evidence.indiaFacetCount, null)
    assert.equal(evidence.verifiedAt, null)
    assert.equal(isVerifiedEmptyEvidence(evidence), false)
    assert.equal(isFreshCompleteInventoryEvidence(evidence, { now: CLOCK }), false)
    assert.equal(job.sourceListingComplete, false)
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
    assert.equal(Object.hasOwn(job, 'nativeLegalEmployer'), false)
    result.push(job)
  }
  return result
}

const unknownCases = [
  ['absent authored role workplace', rawDetail],
  ['trailing empty workplace component', withWorkplace('<p>Location: Chennai, India,</p>')],
  ['city-only workplace', withWorkplace('<p>Job Location: Chennai</p>')],
  ['remote-only workplace', withWorkplace('<p>Location: Remote</p>')],
  ['body country outside the bound JD', rawDetail.replace('<h1>', '<p>Country: India</p><h1>')],
  ['global footer country', rawDetail.replace('</body>', '<footer><p>Location: India</p></footer></body>')],
  ['footer nested inside the JD', withWorkplace('<footer><p>Location: India</p></footer>')],
  ['script-only role country', withWorkplace('<script>Location: India</script>')],
  ['template-only role country', withWorkplace('<template><p>Location: India</p></template>')],
  ['comment-only role country', withWorkplace('<!-- Location: India -->')],
  ['role-labelled travel instruction', withWorkplace('<p>Location: Travel to Chennai, India</p>')],
  ['JD container inside global footer', withWorkplace('<p>Location: India</p>').replace('<div><h3>', '<footer><div><h3>').replace('</div><form', '</div></footer><form')],
  ['company or travel prose', withWorkplace('<p>Our offices are in India and this role may travel to India.</p>')],
  ['mixed-country location', withWorkplace('<p>Location: India / United States</p>')],
  ['conflicting role fields', withWorkplace('<p>Job Location: Chennai, India</p><p>Country: United States</p>')],
  ['hidden role country', withWorkplace('<p style="display:none">Location: India</p>')],
  ['conditional workplace hiding', withWorkplace('<style>@media(min-width:99999px){.workplace{display:none}}</style><p class="workplace">Location: India</p>')],
]
for (const [name, html] of unknownCases) test('Anand ' + name + ' stays a raw unknown role through current routes and real public gates', async t => {
  for (const job of await cohort(t, html)) {
    assert.equal(job.nativeGeographyQualified, false)
    for (const key of ['country', 'location', 'city', 'state']) assert.equal(job[key], null, key)
    assert.equal(job.rawNativeWorkplaceEvidence.sourceUrl, URL)
    assert.equal(job.rawNativeWorkplaceEvidence.jobId, '991698')
    const normalized = normalizeScrapedJob(job, provider)
    for (const key of ['country', 'location', 'city', 'state']) assert.equal(normalized[key], null, 'normalized ' + key)
    assert.equal(normalized.sourceDescription, job.jobDescription)
    assert.equal(filterIndiaJobs([normalized]).length, 0)
    assert.equal(buildJobDerivedFields(normalized).isPublicIndia, false)
    const metrics = analyzePublishableJobs([normalized], { now: new Date(CLOCK) })
    assert.equal(metrics.eligibleJobs.length, 0)
    assert.equal(metrics.filterCounts.nonIndia, 1)
    assert.equal(metrics.filterCounts.closed, 0)
  }
})

for (const [name, workplace, country, location] of [
  ['explicit named India location', '<p>Job Location: Chennai, Tamil Nadu, India</p>', 'India', 'Chennai, Tamil Nadu, India'],
  ['explicit role IN plus same-role city', '<p>Country: IN</p><p>Location: Chennai</p>', 'India', 'Chennai'],
  ['explicit US workplace', '<p>Job Location: Boston, Massachusetts, United States</p>', 'US', 'Boston, Massachusetts, United States'],
  ['explicit role US plus same-role city', '<p>Country: US</p><p>Location: Boston</p>', 'US', 'Boston'],
]) test('Anand ' + name + ' preserves only the authored role country and workplace', async t => {
  for (const job of await cohort(t, withWorkplace(workplace), { country, location, qualified: true })) {
    assert.equal(job.nativeGeographyQualified, true)
    assert.equal(job.country, country)
    assert.equal(job.location, location)
    assert.equal(job.city, null)
    assert.equal(job.state, null)
    const normalized = normalizeScrapedJob(job, provider)
    assert.equal(normalized.country, country)
    assert.equal(normalized.location, location)
    assert.equal(filterIndiaJobs([normalized]).length, country === 'India' ? 1 : 0)
    assert.equal(buildJobDerivedFields(normalized).isPublicIndia, country === 'India')
  }
})

test('Anand geography qualification retains the exact original healthy JD and native input fields', async t => {
  for (const job of await cohort(t, rawDetail)) assert.equal(job.jobDescription, originalDescription)
})

test('Anand current detail canonical and title guards stay closed before geography can qualify', () => {
  for (const html of [rawDetail.replace(URL, 'https://other.example/job-opening/wrong/'), rawDetail.replace('<h1>Executive/Senior Executive &#8211; Finance</h1>', '<h1>Different Engineer</h1>')]) {
    assert.throws(() => parseJobDetail(html, rawCard), /verified job detail changed/)
  }
})


// Literal paired cases from the independently frozen10-control review. The
// original23 geography cases above remain byte-exact and execute as before.
const followupControls = [
  ['active direct workplace positive','<p>Job Location: Chennai, India</p>',true],
  ['active wrapper workplace positive','<div><p>Job Location: Chennai, India</p></div>',true],
  ['direct semantic footer stays excluded','<footer><p>Job Location: Chennai, India</p></footer>',false],
  ['wrapper cannot launder semantic footer workplace','<div><footer><p>Job Location: Chennai, India</p></footer></div>',false],
  ['direct application form stays excluded','<form><p>Job Location: Chennai, India</p></form>',false],
  ['wrapper cannot launder application form workplace','<div><form><p>Job Location: Chennai, India</p></form></div>',false],
  ['wrapper cannot launder navigation country','<div><nav><p>Country: India</p></nav></div>',false],
  ['typed role country with ordinary location stays positive','<p>Country: IN</p><p>Location: Chennai</p>',true],
  ['typed country cannot mask a malformed trailing location component','<p>Country: IN</p><p>Location: Chennai, India,</p>',false],
  ['typed country cannot erase a supplied empty workplace field','<p>Country: IN</p><p>Location:</p>',false],
]
const positiveLocations = new Map([
  ['active direct workplace positive', 'Chennai, India'],
  ['active wrapper workplace positive', 'Chennai, India'],
  ['typed role country with ordinary location stays positive', 'Chennai'],
])
for (const [name, field, qualified] of followupControls) test('Anand follow-up: ' + name, async t => {
  const expected = { qualified, country: qualified ? 'India' : null, location: positiveLocations.get(name) || null }
  for (const job of await cohort(t, withWorkplace(field), expected)) {
    const normalized = normalizeScrapedJob(job, provider)
    const metrics = analyzePublishableJobs([normalized], { now: new Date(CLOCK) })
    assert.equal(normalized.country, expected.country)
    assert.equal(normalized.location, expected.location)
    assert.equal(job.nativeGeographyQualified, qualified)
    assert.equal(buildJobDerivedFields(normalized).isPublicIndia, qualified)
    assert.equal(metrics.eligibleJobs.length, qualified ? 1 : 0)
    assert.equal(metrics.filterCounts.closed, 0)
    if (name === 'typed country cannot erase a supplied empty workplace field') {
      assert.ok(job.rawNativeWorkplaceEvidence.fields.some(row => row.label === 'location' && row.value === ''))
    }
    if (name.startsWith('wrapper cannot launder')) assert.deepEqual(job.rawNativeWorkplaceEvidence.fields, [])
  }
})

for (const [name, field, location] of [
  ['a genuinely absent optional location preserves explicit role country', '<p>Country: India</p>', 'India'],
  ['active inline-labelled role workplace remains supported', '<p><strong>Job Location:</strong> Chennai, India</p>', 'Chennai, India'],
]) test('Anand follow-up: ' + name, async t => {
  for (const job of await cohort(t, withWorkplace(field), { qualified: true, country: 'India', location })) {
    assert.equal(job.nativeGeographyQualified, true)
    assert.equal(job.country, 'India')
    assert.equal(job.location, location)
    const normalized = normalizeScrapedJob(job, provider)
    assert.equal(buildJobDerivedFields(normalized).isPublicIndia, true)
  }
})


for (const [name, field] of [
  ['typed country cannot hide an empty provided nested location block', '<p>Country: IN</p><div>Location:<p></p></div>'],
  ['typed country cannot join a provided label and separate value block', '<p>Country: IN</p><div>Location:<p>Chennai</p></div>'],
]) test('Anand follow-up: ' + name, async t => {
  for (const job of await cohort(t, withWorkplace(field))) {
    assert.equal(job.nativeGeographyQualified, false)
    assert.equal(job.country, null)
    assert.equal(job.location, null)
    const normalized = normalizeScrapedJob(job, provider)
    assert.equal(normalized.country, null)
    assert.equal(buildJobDerivedFields(normalized).isPublicIndia, false)
    assert.equal(analyzePublishableJobs([normalized], { now: new Date(CLOCK) }).eligibleJobs.length, 0)
  }
})


test('Anand follow-up: a direct empty role location is not lost beside excluded navigation', async t => {
  for (const job of await cohort(t, withWorkplace('<p>Country: India</p>Location:<nav>Other links</nav>'))) {
    assert.equal(job.nativeGeographyQualified, false)
    const normalized = normalizeScrapedJob(job, provider)
    assert.equal(normalized.country, null)
    assert.equal(normalized.location, null)
    assert.equal(analyzePublishableJobs([normalized], { now: new Date(CLOCK) }).eligibleJobs.length, 0)
  }
})


// Five exact paired literal inputs from the independently frozen inline-value
// review. All prior44 family cases and their input bytes remain intact.
const inlineValueControls = [
 ['inline wrapped location value remains a complete visible field','<p>Job Location: <span>Chennai, India</span></p>','India','Chennai, India'],
 ['inline wrapped IN country value remains explicit role proof','<p>Country: <strong>IN</strong></p><p>Location: Chennai</p>','India','Chennai'],
 ['inline wrapped US country remains explicit foreign role proof','<p>Country: <span>US</span></p><p>Location: Boston</p>','US','Boston'],
 ['hidden inline value cannot complete the supplied empty label','<p>Country: IN</p><p>Location: <span hidden>Chennai</span></p>',null,null],
 ['a separate block value cannot complete an inline label','<p>Country: IN</p><div><span>Location:</span><p>Chennai</p></div>',null,null],
]
for (const [name, field, country, location] of inlineValueControls) test('Anand inline-value follow-up: ' + name, async t => {
  for (const job of await cohort(t, withWorkplace(field), { country, location, qualified: country !== null })) {
    assert.equal(job.nativeGeographyQualified, country !== null)
    assert.equal(job.country, country)
    assert.equal(job.location, location)
    const normalized = normalizeScrapedJob(job, provider)
    assert.equal(normalized.country, country)
    assert.equal(normalized.location, location)
    assert.equal(buildJobDerivedFields(normalized).isPublicIndia, country === 'India')
    const metrics = analyzePublishableJobs([normalized], { now: new Date(CLOCK) })
    assert.equal(metrics.eligibleJobs.length, country === 'India' ? 1 : 0)
    assert.equal(metrics.filterCounts.closed, 0)
  }
})
