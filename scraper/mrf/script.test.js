import assert from 'node:assert/strict'
import test from 'node:test'

const loadMrfModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected MRF scraper module at ./script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html>
  <head>
    <title>Car Tyres | Bike Tyres by official website of MRF Tyres</title>
  </head>
  <body>
    <p>MRF is the largest manufacturer of tyres in India.</p>
    <a href="https://mrfconnect.mrfindia.net" target="_blank">Careers</a>
    <p>MRF Tyres is an Indian multinational and India's largest tyre maker.</p>
  </body>
</html>
`

const careersShellHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>MRF Connect Us</title>
  </head>
  <body>
    <app-root></app-root>
    <script src="runtime-es2015.js" type="module"></script>
    <script src="main-es2015.js" type="module"></script>
  </body>
</html>
`

const samplePayload = [
  {
    campusLinkId: 18,
    campusYearId: 4,
    campusYearName: '2025 - 2026',
    campusCourseId: 4,
    courseName: 'Diploma',
    campusLink: 'https://mrfconnect.mrfindia.net/campusoffcampus/off-campus-registration?q=NAAtADQALQAxAA==',
    campusForId: 1,
    campusForName: null,
    createdOn: '26/02/2025',
    candidateCount: 14,
    campusTemplate: `
      <div class="inner-container">
        <p>The purpose of this form is to collect relevant details of the eligible candidates for the MRF Off-Campus Recruitment - Initial Screening Process.</p>
        <p><strong>Positions:</strong> Technical (R&amp;D), Maintenance, Production / Industrial</p>
        <ol>
          <li><strong>Qualification</strong>: Diploma (2025 Passing Out Candidates)</li>
          <li><strong>Stream</strong>: Mechanical, Electrical, Polymer</li>
          <li>Candidates should be open for posting at any of our manufacturing plants located in Tamil Nadu, Puducherry, Telangana, Goa and Gujarat.</li>
          <li>Since this is a Off-Campus requirement candidates are not required to apply against any Job posting in MRF website.</li>
        </ol>
      </div>
    `,
    disableStatus: 0,
  },
  {
    campusLinkId: 20,
    campusYearId: 4,
    campusYearName: '2025 - 2026',
    campusCourseId: 2,
    courseName: 'BSc',
    campusLink: 'https://mrfconnect.mrfindia.net/campusoffcampus/off-campus-registration?q=NAAtADIALQAxAA==',
    createdOn: '30/04/2025',
    candidateCount: 296,
    campusTemplate: '<p>Disabled campus listing</p>',
    disableStatus: 1,
  },
  {
    campusLinkId: 28,
    campusYearId: 4,
    campusYearName: '2025 - 2026',
    campusCourseId: 7,
    courseName: 'B.COM',
    campusLink: 'https://mrfconnect.mrfindia.net/campusoffcampus/off-campus-registration?q=NAAtADcALQAyAA==',
    campusForId: 2,
    campusForName: null,
    createdOn: '15/10/2025',
    candidateCount: 204,
    campusTemplate: `
      <div class="inner-container">
        <p>The purpose of this form is to collect relevant details of the eligible candidates for MRF Campus Drive Initial Screening Process.</p>
        <h6>Eligibility Criteria</h6>
        <ol>
          <li>Qualification: Regular B.com/BBA with 50% minimum.</li>
          <li>Willing to relocate PAN India</li>
          <li>Age up to 27 yrs</li>
        </ol>
        <h6>Key Responsibilities</h6>
        <ol>
          <li>Warehouse Operations, inventory management and administration</li>
        </ol>
      </div>
    `,
    disableStatus: 0,
  },
]

test('MRF scraper keeps the official homepage, careers redirect shell, and public API contract pinned', async () => {
  const mrf = await loadMrfModule()

  assert.equal(mrf.SOURCE, 'mrf')
  assert.equal(mrf.COMPANY, 'MRF Limited')
  assert.equal(mrf.HOMEPAGE_URL, 'https://www.mrftyres.com/')
  assert.equal(mrf.CAREERS_URL, 'https://www.mrftyres.com/careers')
  assert.equal(mrf.CAREERS_PORTAL_URL, 'https://mrfconnect.mrfindia.net/')
  assert.equal(mrf.JOBS_API_URL, 'https://mrfconnect.mrfindia.net/api/campusrequisition/getalloffcampuslink')
  assert.equal(mrf.COMPANY_DOMAIN, 'mrftyres.com')
  assert.equal(mrf.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(mrf.hasOfficialCareersShell(careersShellHtml), true)
  assert.deepEqual(mrf.buildApiRequestBody(), {
    campusCourseId: null,
    campusYearId: 0,
    createdBy: 0,
    campusLinkId: null,
  })
  assert.deepEqual(mrf.buildPublicHeaders(), {
    Accept: 'application/json,text/plain,*/*',
    'Content-Type': 'application/json',
    'User-Agent': mrf.USER_AGENT,
  })

  const jobs = mrf.extractActiveJobs(samplePayload)
  assert.equal(jobs.length, 2)

  assert.deepEqual(jobs[0], {
    title: 'Technical (R&D), Maintenance, Production / Industrial - Diploma (2025 - 2026)',
    company: 'MRF Limited',
    department: 'Technical (R&D), Maintenance, Production / Industrial',
    location: 'India',
    city: null,
    country: 'India',
    jobId: '18',
    requisitionId: '18',
    sourceUrl: 'https://mrfconnect.mrfindia.net/campusoffcampus/off-campus-registration?q=NAAtADQALQAxAA==',
    applyUrl: 'https://mrfconnect.mrfindia.net/campusoffcampus/off-campus-registration?q=NAAtADQALQAxAA==',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: 'Diploma (2025 Passing Out Candidates)',
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2025-02-26',
    closingDate: null,
    jobDescription:
      "The purpose of this form is to collect relevant details of the eligible candidates for the MRF Off-Campus Recruitment - Initial Screening Process.\n\nPOSITIONS:\nTechnical (R&D), Maintenance, Production / Industrial\nQualification: Diploma (2025 Passing Out Candidates)\nStream: Mechanical, Electrical, Polymer\nCandidates should be open for posting at any of our manufacturing plants located in Tamil Nadu, Puducherry, Telangana, Goa and Gujarat.\nSince this is a Off-Campus requirement candidates are not required to apply against any Job posting in MRF website.",
    companyCareerPage: 'https://www.mrftyres.com/careers',
    companyDomain: 'mrftyres.com',
    atsPlatform: 'official-company-careers',
  })

  assert.equal(
    jobs[1].title,
    'Campus Drive - B.COM (2025 - 2026)',
  )
  assert.equal(jobs[1].location, 'Pan India')
  assert.equal(jobs[1].minimumQualification, 'Regular B.com/BBA with 50% minimum.')
  assert.match(jobs[1].jobDescription, /Warehouse Operations, inventory management and administration/i)
})

test('MRF scraper returns only active public registration links from the verified first-party surface', async () => {
  const mrf = await loadMrfModule()
  const requestedPages = []
  const apiRequests = []

  const jobs = await mrf.createMrfScraper({
    now: () => '2026-07-11T00:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === mrf.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === mrf.CAREERS_URL) {
        return { status: 200, url: mrf.CAREERS_PORTAL_URL, html: careersShellHtml }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      apiRequests.push({ url, options })
      return samplePayload
    },
  })

  assert.deepEqual(requestedPages, [
    mrf.HOMEPAGE_URL,
    mrf.CAREERS_URL,
  ])
  assert.equal(apiRequests.length, 1)
  assert.equal(apiRequests[0].url, mrf.JOBS_API_URL)
  assert.equal(apiRequests[0].options.method, 'POST')
  assert.deepEqual(apiRequests[0].options.headers, mrf.buildPublicHeaders())
  assert.equal(apiRequests[0].options.body, JSON.stringify(mrf.buildApiRequestBody()))
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'mrf')
  assert.equal(jobs[0].company, 'MRF Limited')
  assert.equal(jobs[0].companyCareerPage, 'https://www.mrftyres.com/careers')
  assert.equal(jobs[0].companyDomain, 'mrftyres.com')
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-11T00:00:00.000Z')
  assert.equal(jobs[1].location, 'Pan India')
})

test('MRF scraper fails closed when the verified homepage, careers redirect, or public API drift', async () => {
  const mrf = await loadMrfModule()

  await assert.rejects(
    mrf.createMrfScraper().run({
      fetchPage: async (url) => {
        if (url === mrf.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Placeholder</h1></body></html>' }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async () => samplePayload,
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    mrf.createMrfScraper().run({
      fetchPage: async (url) => {
        if (url === mrf.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === mrf.CAREERS_URL) {
          return { status: 200, url: 'https://example.com/jobs', html: '<html><body><h1>Wrong portal</h1></body></html>' }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async () => samplePayload,
    }),
    /verified official careers portal/i,
  )

  await assert.rejects(
    mrf.createMrfScraper().run({
      fetchPage: async (url) => {
        if (url === mrf.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === mrf.CAREERS_URL) {
          return { status: 200, url: mrf.CAREERS_PORTAL_URL, html: careersShellHtml }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async () => ({ response: [] }),
    }),
    /verified public careers api/i,
  )
})
