import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { activeHead } from '../utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../utils/visibleNativeHtml.js'
import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'
import { decorateJobsWithProviderMetadata } from '../providers/index.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { createPublicIO } from '../native-sources/publicIO.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'


const careersPageHtml = `
<!doctype html>
<html>
  <head>
    <title>Aditya Birla Capital Careers: Explore Career Opportunities Now!</title>
    <link rel="canonical" href="https://www.adityabirlacapital.com/careers" />
  </head>
  <body>
    <h1>ABC Careers</h1>
    <nav>
      <a class="nav-item nav-link" href="/careers/jobs" aria-current="page">Jobs</a>
    </nav>
  </body>
</html>
`

const jobsPageHtml = `
<!doctype html>
<html>
  <head>
    <title>Job Search, Employment, Job Vacancies &amp; Opportunities - Aditya Birla Capital</title>
    <link rel="canonical" href="https://www.adityabirlacapital.com/careers/jobs" />
  </head>
  <body>
    <h1>Search Jobs at Aditya Birla Capital</h1>
    <input type="hidden" id="jobTitleEndpoint" value="/ABCareers/api/JobSearch/JobTitleSuggestions" />
    <input type="hidden" id="locationEndpoint" value="/ABCareers/api/JobSearch/LocationSuggestions" />
    <div
      class="job-hunt-card-section"
      onclick="window.location='/careers/sitecore/content/abcl/abcareers/home/jobs/job-details/valuation-officer-sales-in-varanasi-jobs-abcl_job-33975';"
      data-job-code="abcl_job-33975"
    >
      <a
        href="/careers/sitecore/content/abcl/abcareers/home/jobs/job-details/valuation-officer-sales-in-varanasi-jobs-abcl_job-33975"
        class="job-hunt-cmpname-section"
        data-job-code="abcl_job-33975"
      >
        <h3>Valuation Officer</h3>
      </a>
    </div>
    <button class="upload-link" onclick="location.href='https://abgcareers.peoplestrong.com/register'">
      UPLOAD RESUME
    </button>
  </body>
</html>
`

const ionaDetailHtml = `
<!doctype html>
<html>
  <head>
    <title>valuation officer sales Jobs in varanasi | Aditya Birla Capital</title>
  </head>
  <body>
    <h2 class="job-description-heading">Job Description</h2>
    <div class="join-team-description">Location: N-VAR, Varanasi</div>
    <button
      type="button"
      class="btn btn-danger p-3 exploreBtn"
      onclick="location.href = 'https://abccareers.iona.ai/job-details/referral/abcl_job-33975?source=ABCCareers&amp;subsource=ABCCareer-Jobs'"
    >
      Apply now
    </button>
  </body>
</html>
`

const peopleStrongDetailHtml = `
<!doctype html>
<html>
  <head>
    <title>branch manager retail gold loan merta city Jobs in rajasthan | Aditya Birla Capital</title>
  </head>
  <body>
    <h2 class="job-description-heading">Job Description</h2>
    <div class="join-team-description">Location: Merta City, Rajasthan</div>
    <button
      type="button"
      class="btn btn-danger p-3 exploreBtn"
      onclick="location.href = 'https://abgcareers.peoplestrong.com/job/detail/abg107672?source=ABCCareers&amp;subsource=ABCCareer-Jobs'"
    >
      Apply now
    </button>
  </body>
</html>
`

const pageZeroPayload = {
  Results: [
    {
      JobCode: 'abcl_job-33975',
      JobTitle: 'Valuation Officer',
      Designation: 'Valuation Officer',
      MinYearsOfExp: 0,
      MaxYearsOfExp: 4,
      FunctionalArea: 'Sales',
      BusinessLine: 'Retail',
      Department: 'Sales',
      Location1: 'N-VAR',
      Location2: 'Varanasi',
      Location3: 'India',
      EndDate: '2026-09-27T18:30:00Z',
      DemandCreatedDate: '2026-06-30T18:30:00Z',
      Url: '/sitecore/content/abcl/abcareers/home/jobs/job-details/valuation-officer-sales-in-varanasi-jobs-abcl_job-33975',
    },
    {
      JobCode: 'abg107672',
      JobTitle: 'Branch Manager - Retail Gold Loan - Merta City',
      Designation: 'NA',
      MinYearsOfExp: 1,
      MaxYearsOfExp: 15,
      FunctionalArea: 'Sales',
      BusinessLine: 'Aditya Birla Capital Limited',
      Department: 'Retail - Gold Loan',
      Location1: 'Merta City',
      Location2: 'Rajasthan',
      Location3: 'India',
      EndDate: '2027-01-05T18:30:00Z',
      DemandCreatedDate: '2026-07-02T18:30:00Z',
      Url: '/sitecore/content/abcl/abcareers/home/jobs/job-details/branch-manager-retail-gold-loan-merta-city-retail-gold-loan-in-rajasthan-jobs-abg107672',
    },
  ],
  TotalResults: 2,
  Pages: 1,
}


// Archived canonical-role fixtures from the original two exact assertions.
// No source parser is rebuilt here and this private provider is never registered.
const legacyRoleFields = [{
    title: 'Valuation Officer',
    company: 'Aditya Birla Capital',
    department: 'Sales',
    businessLine: 'Retail',
    team: 'Sales',
    location: 'Varanasi, India',
    city: 'Varanasi',
    country: 'India',
    sourceUrl: 'https://www.adityabirlacapital.com/careers/sitecore/content/abcl/abcareers/home/jobs/job-details/valuation-officer-sales-in-varanasi-jobs-abcl_job-33975',
    applyUrl: 'https://abccareers.iona.ai/job-details/referral/abcl_job-33975?source=ABCCareers&subsource=ABCCareer-Jobs',
    jobId: 'abcl_job-33975',
    requisitionId: 'abcl_job-33975',
    employmentType: null,
    experienceRequired: '0 - 4 years',
    postingDate: '2026-06-30T18:30:00Z',
    closingDate: '2026-09-27T18:30:00Z',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    jobDescription: null,
    remoteStatus: null,
  },
{
    title: 'Branch Manager - Retail Gold Loan - Merta City',
    company: 'Aditya Birla Capital',
    department: 'Sales',
    businessLine: 'Aditya Birla Capital Limited',
    team: 'Retail - Gold Loan',
    location: 'Merta City, Rajasthan, India',
    city: 'Merta City',
    country: 'India',
    sourceUrl: 'https://www.adityabirlacapital.com/careers/sitecore/content/abcl/abcareers/home/jobs/job-details/branch-manager-retail-gold-loan-merta-city-retail-gold-loan-in-rajasthan-jobs-abg107672',
    applyUrl: 'https://abgcareers.peoplestrong.com/job/detail/abg107672?source=ABCCareers&subsource=ABCCareer-Jobs',
    jobId: 'abg107672',
    requisitionId: 'abg107672',
    employmentType: null,
    experienceRequired: '1 - 15 years',
    postingDate: '2026-07-02T18:30:00Z',
    closingDate: '2027-01-05T18:30:00Z',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    jobDescription: null,
    remoteStatus: null,
  }]
const observationClock = '2026-07-14T09:30:00.000Z'
const privateProvider = { source: 'controlled-retired-role-fixture', companyName: 'Aditya Birla Capital',
  companyCareerPage: 'https://www.adityabirlacapital.com/careers', companyDomain: 'adityabirlacapital.com' }
const normalized = () => legacyRoleFields.map((fields, index) => normalizeScrapedJob({ ...structuredClone(fields),
  source: privateProvider.source, scrapedAt: observationClock, nativeLegacyRecord: structuredClone(pageZeroPayload.Results[index]),
}, privateProvider))

test('generic active DOM retains the legacy careers identity and literal same-domain detail anchor', () => {
  assert.deepEqual(activeHead(careersPageHtml).titles, ['Aditya Birla Capital Careers: Explore Career Opportunities Now!'])
  for (const [html, expected] of [[careersPageHtml, 'https://www.adityabirlacapital.com/careers'],
    [jobsPageHtml, 'https://www.adityabirlacapital.com/careers/jobs']]) {
    const document = readVisibleNativeDocument(html)
    assert.deepEqual(document.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical').map(node => node.attrs.href), [expected])
  }
  const document = readVisibleNativeDocument(jobsPageHtml)
  const links = document.nodes(node => node.tag === 'a' && node.attrs.href).map(node =>
    new URL(node.attrs.href, 'https://www.adityabirlacapital.com/careers/jobs').href)
  assert.deepEqual(links, [legacyRoleFields[0].sourceUrl])
})

test('shared normalization preserves the two legacy role fixtures without manufacturing missing descriptions', () => {
  const jobs = normalized()
  for (const [index, job] of jobs.entries()) {
    const fields = legacyRoleFields[index]
    for (const key of ['title', 'company', 'department', 'businessLine', 'team', 'location', 'city', 'country',
      'sourceUrl', 'applyUrl', 'jobId', 'requisitionId', 'experienceRequired']) assert.equal(job[key], fields[key], key)
    assert.equal(job.postingDate.getTime(), Date.parse(fields.postingDate))
    assert.equal(job.closingDate.getTime(), Date.parse(fields.closingDate))
    assert.deepEqual(job.nativeLegacyRecord, pageZeroPayload.Results[index])
    assert.equal(job.jobDescription, null)
    assert.equal(hasSourceDescription(job), false)
  }
})

test('generic DOM decodes both literal event attributes once without executing the legacy apply handlers', () => {
  for (const [index, html] of [ionaDetailHtml, peopleStrongDetailHtml].entries()) {
    const document = readVisibleNativeDocument(html)
    const buttons = document.nodes(node => node.tag === 'button' && node.attrs.onclick)
    assert.equal(buttons.length, 1)
    assert.ok(buttons[0].attrs.onclick.includes(legacyRoleFields[index].applyUrl))
    assert.equal(buttons[0].attrs.onclick.includes('&amp;'), false)
    assert.match(document.text(buttons[0]), /Apply now/)
    assert.deepEqual(document.nodes(node => node.tag === 'script'), [])
  }
})

test('actual normalization and provider decoration preserve the original observation clock and raw provenance', () => {
  const jobs = normalized()
  const evidence = { status: 'discovery-only', firstParty: false, listingComplete: false, reportedTotal: null,
    indiaFacetCount: null, verifiedAt: observationClock, reason: 'Synthetic legacy contract; no current native admission.' }
  const decorated = decorateJobsWithProviderMetadata(attachInventoryEvidence(jobs, evidence), privateProvider)
  for (const [index, job] of decorated.entries()) {
    assert.equal(job.scrapedAt.toISOString(), observationClock)
    assert.equal(job.scrapedTimestamp.toISOString(), observationClock)
    assert.equal(job.postingDate.getTime(), Date.parse(legacyRoleFields[index].postingDate))
    assert.equal(job.closingDate.getTime(), Date.parse(legacyRoleFields[index].closingDate))
    assert.equal(job.source, privateProvider.source)
    assert.equal(job.company, 'Aditya Birla Capital')
    assert.equal(job.companyCareerPage, privateProvider.companyCareerPage)
    assert.deepEqual(job.nativeLegacyRecord, pageZeroPayload.Results[index])
    assert.equal(job.jobDescription, null)
    assert.equal(hasSourceDescription(job), false)
  }
  assert.deepEqual(readInventoryEvidence(decorated), readInventoryEvidence(jobs))
  assert.equal(readInventoryEvidence(decorated).verifiedAt, observationClock)
  assert.equal(readInventoryEvidence(decorated).listingComplete, false)
})

test('shared public IO rejects a foreign handoff before transport and retains exact allowed legacy HTML bytes', async () => {
  const urls = legacyRoleFields.map(row => row.applyUrl), calls = []
  const io = createPublicIO({ allowed: url => urls.includes(url.href), fetchPage: async url => {
    calls.push(url)
    return { url, status: 200, headers: { 'content-type': 'text/html' },
      bodyBase64: Buffer.from(url === urls[0] ? ionaDetailHtml : peopleStrongDetailHtml).toString('base64') }
  } })
  for (const [index, url] of urls.entries()) {
    const page = await io.load(url)
    const html = index ? peopleStrongDetailHtml : ionaDetailHtml
    assert.equal(page.originalText, html)
    assert.equal(page.bodySHA256, createHash('sha256').update(html).digest('hex'))
    assert.equal(page.transportQualified, true)
  }
  assert.equal(await io.load('https://example.com/job-details/referral/abcl_job-33975'), null)
  assert.equal(io.issues.at(-1).kind, 'native-url-blocked')
  assert.deepEqual(calls, urls)
  const reason = Object.freeze({ controlled: 'stop before handoff' })
  await assert.rejects(createPublicIO({ signal: AbortSignal.abort(reason), allowed: () => true,
    fetchPage: async () => assert.fail('transport after caller cancellation') }).load(urls[0]), error => error === reason)
})
