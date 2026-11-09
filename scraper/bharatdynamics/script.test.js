import assert from 'node:assert/strict'
import test from 'node:test'

import {
  COMPANY,
  HOMEPAGE_URL,
  RECRUITMENTS_URL,
  SOURCE,
  buildRecruitmentsPageUrl,
  createBharatDynamicsScraper,
  extractActionableRecruitmentNotices,
  extractRecruitmentUrl,
  hasOfficialHomepageSignal,
  hasOfficialRecruitmentsPageSignal,
} from './script.js'

const homepageHtml = `
  <html>
    <head>
      <title>Home | Official Website of Bharat Dynamics Limited (BDL) under the Ministry of Defence, Government of India.</title>
    </head>
    <body>
      <nav>
        <a href="/recruitments">Recruitment</a>
      </nav>
      <main>
        <h1>Bharat Dynamics Limited</h1>
      </main>
    </body>
  </html>
`

const recruitmentsRootHtml = `
  <html>
    <head>
      <title>Recruitments | Official Website of Bharat Dynamics Limited (BDL) under the Ministry of Defence, Government of India.</title>
    </head>
    <body>
      <a href="https://www.ncs.gov.in/">Click here for vacancies on National Career Service (NCS) Portal</a>
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Issue Date</th>
            <th>Download</th>
            <th>Location</th>
          </tr>
        </thead>
        <tbody>
          <tr class="align-top">
            <td>1</td>
            <td>Notification – Recruitment for the posts of Contract Engineer (Field Firing) on Contractual basis in BDL</td>
            <td>06/08/2026</td>
            <td><a href="/sites/default/files/Nofification-Recruitment_contract-Engineer%28field-firing%29.pdf">Download PDF</a></td>
            <td>India</td>
          </tr>
          <tr class="align-top">
            <td>2</td>
            <td>Selected Candidates for Trainee Engineer</td>
            <td>05/08/2026</td>
            <td><a href="/sites/default/files/selected-candidates.pdf">Download PDF</a></td>
            <td>India</td>
          </tr>
        </tbody>
      </table>
      <a href="?page=1" title="Go to next page">Next</a>
    </body>
  </html>
`

const recruitmentsPageTwoHtml = `
  <html>
    <head>
      <title>Recruitments - Page 2 | Official Website of Bharat Dynamics Limited (BDL) under the Ministry of Defence, Government of India.</title>
    </head>
    <body>
      <a href="https://www.ncs.gov.in/">Click here for vacancies on National Career Service (NCS) Portal</a>
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Issue Date</th>
            <th>Download</th>
            <th>Location</th>
          </tr>
        </thead>
        <tbody>
          <tr class="align-top">
            <td>3</td>
            <td>Interview Schedule for Project Engineer</td>
            <td>01/08/2026</td>
            <td><a href="/sites/default/files/interview-schedule.pdf">Download PDF</a></td>
            <td>India</td>
          </tr>
        </tbody>
      </table>
    </body>
  </html>
`

test('Bharat Dynamics helpers accept the current root recruitments title and extract actionable notices conservatively', () => {
  assert.equal(SOURCE, 'bharatdynamics')
  assert.equal(COMPANY, 'Bharat Dynamics')
  assert.equal(HOMEPAGE_URL, 'https://bdl-india.in/')
  assert.equal(RECRUITMENTS_URL, 'https://bdl-india.in/recruitments')
  assert.equal(buildRecruitmentsPageUrl(2), 'https://bdl-india.in/recruitments?page=1')
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(extractRecruitmentUrl(homepageHtml), RECRUITMENTS_URL)
  assert.equal(hasOfficialRecruitmentsPageSignal(recruitmentsRootHtml), true)
  assert.equal(hasOfficialRecruitmentsPageSignal(recruitmentsPageTwoHtml), true)

  const notices = extractActionableRecruitmentNotices(recruitmentsRootHtml, {
    now: () => '2026-08-07T09:00:00.000Z',
  })

  assert.deepEqual(notices, [{
    title: 'Notification – Recruitment for the posts of Contract Engineer (Field Firing) on Contractual basis in BDL',
    company: 'Bharat Dynamics',
    department: null,
    location: 'India',
    city: null,
    state: null,
    country: 'India',
    jobId: 'bharatdynamics-notification-recruitment-for-the-posts-of-contract-engineer-field-firing-on-contractual-basis-in-bdl-2026-08-06',
    requisitionId: 'download-pdf',
    sourceUrl: 'https://bdl-india.in/sites/default/files/Nofification-Recruitment_contract-Engineer%28field-firing%29.pdf',
    applyUrl: 'https://bdl-india.in/sites/default/files/Nofification-Recruitment_contract-Engineer%28field-firing%29.pdf',
    employmentType: 'Contract',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-08-06T00:00:00.000Z',
    closingDate: null,
    jobDescription: 'Official Bharat Dynamics recruitment notice PDF. Review the advertisement for eligibility, schedule, and application instructions.',
  }])
})

test('Bharat Dynamics scraper runs across the paginated table and keeps only the current actionable notice', async () => {
  const requestedUrls = []

  const jobs = await createBharatDynamicsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) return homepageHtml
      if (url === RECRUITMENTS_URL) return recruitmentsRootHtml
      if (url === 'https://bdl-india.in/recruitments?page=1') return recruitmentsPageTwoHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-08-07T09:00:00.000Z',
    maxPages: 2,
  })

  assert.deepEqual(requestedUrls, [
    'https://bdl-india.in/',
    'https://bdl-india.in/recruitments',
    'https://bdl-india.in/recruitments?page=1',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'bharatdynamics')
  assert.equal(jobs[0].link, 'https://bdl-india.in/sites/default/files/Nofification-Recruitment_contract-Engineer%28field-firing%29.pdf')
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('Bharat Dynamics scraper fails closed when the recruitments table drifts materially', async () => {
  await assert.rejects(
    createBharatDynamicsScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return homepageHtml
        return `
          <html>
            <head><title>Recruitments | Official Website of Bharat Dynamics Limited (BDL) under the Ministry of Defence, Government of India.</title></head>
            <body><p>Placeholder only.</p></body>
          </html>
        `
      },
    }),
    /Bharat Dynamics recruitments page no longer matches the verified official surface/i,
  )
})
