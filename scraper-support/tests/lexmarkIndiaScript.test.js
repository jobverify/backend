import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-16T00:00:00.000Z'

const careersLandingHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Lexmark India | Lexmark India</title>
  </head>
  <body>
    <h2>Compensations and Benefits</h2>
    <p>Lexmark India, located in Kolkata, is one of the research and development centers of Lexmark International Inc.</p>
    <a href="https://lexmark.wd1.myworkdayjobs.com/External">Job Listings</a>
    <a href="https://origin-www.lexmark.com/en_in/careers/job-search.html">View Jobs Now</a>
  </body>
</html>
`

const jobSearchHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Search All Jobs | Lexmark India</title>
  </head>
  <body>
    <h1>Search All Jobs</h1>
    <p>15 Jobs Found</p>
    <table class="table">
      <tbody>
        <tr>
          <td><a href="/en_in/careers/job-description.143497.html">Azure Data Integration Developer</a></td>
          <td><a href="/en_in/careers/job-locations/kolkata.html">Kolkata, WB</a></td>
          <td><a href="https://www.lexmark.com/en_in/careers/job-search.html?area=information-technology">Information Technology</a></td>
        </tr>
        <tr>
          <td><a href="/en_in/careers/job-description.143267.html">Usability Engineer 3</a></td>
          <td><a href="/en_in/careers/job-locations/kolkata.html">Kolkata, WB</a></td>
          <td><a href="https://www.lexmark.com/en_in/careers/job-search.html?area=engineering-and-design">Engineering &amp; Design</a></td>
        </tr>
      </tbody>
    </table>
  </body>
</html>
`

const azureDataIntegrationDeveloperHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Description | Lexmark India</title>
  </head>
  <body>
    <div class="jobdetail">
      <div class="col-1-4">
        <h5><strong>Job Title:</strong></h5>
        <p>Azure Data Integration Developer</p>
        <h5><strong>Business Area:</strong></h5>
        <p>Information Technology</p>
        <h5><strong>Location:</strong></h5>
        <p>Kolkata, WB IND</p>
        <h5><strong>Job ID:</strong></h5>
        <p>143497</p>
        <div><a class="call-to-action" href="https://careers.lexmark.com/psp/PWW1EXT/EMPLOYEE/HRMS/c/HRS_HRAM_FL.HRS_CG_SEARCH_FL.GBL?Page=HRS_APP_JBPST_FL&Action=U&FOCUS=Applicant&LanguageCd=ENG&SiteId=3&PostingSeq=1&JobOpeningId=143497" target="_blank">Apply Now</a></div>
      </div>
      <div class="col-3-4">
        <h1>Azure Data Integration Developer</h1>
        <p><b>About Lexmark:</b></p>
        <p>Lexmark India, located in Kolkata, is one of the research and development centers of Lexmark International Inc.</p>
        <p><b>Job Description/Responsibilities:</b></p>
        <p>The candidate will work in Global IT as a Senior Azure Data Integration Developer and collaborate with global business users and other IT teams.</p>
        <p><b>Qualification: BE/ME/MCA with 7+ Years in IT Experience.</b></p>
        <p><b>Must Have Skills/Skill Requirement:</b></p>
        <ul>
          <li>Strong understanding and familiarity with Azure Data Factory.</li>
          <li>Strong background in Business Analysis and Data Modelling.</li>
        </ul>
        <p><b>Good to have skills/General Qualifications:</b></p>
        <ul>
          <li>Experience in AWS Cloud on data Engineering Stacks.</li>
        </ul>
      </div>
    </div>
  </body>
</html>
`

const usabilityEngineerHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Description | Lexmark India</title>
  </head>
  <body>
    <div class="jobdetail">
      <div class="col-1-4">
        <h5><strong>Job Title:</strong></h5>
        <p>Usability Engineer 3</p>
        <h5><strong>Business Area:</strong></h5>
        <p>Engineering &amp; Design</p>
        <h5><strong>Location:</strong></h5>
        <p>Kolkata, WB IND</p>
        <h5><strong>Job ID:</strong></h5>
        <p>143267</p>
        <div><a class="call-to-action" href="https://careers.lexmark.com/psp/PWW1EXT/EMPLOYEE/HRMS/c/HRS_HRAM_FL.HRS_CG_SEARCH_FL.GBL?Page=HRS_APP_JBPST_FL&Action=U&FOCUS=Applicant&LanguageCd=ENG&SiteId=3&PostingSeq=1&JobOpeningId=143267" target="_blank">Apply Now</a></div>
      </div>
      <div class="col-3-4">
        <h1>Usability Engineer 3</h1>
        <p>Responsible for creating, evaluating, and modifying prototypes to support software application development.</p>
        <p><b>Key Qualifications</b></p>
        <ul>
          <li>5+ years of UX/VX experience</li>
          <li>Good communication and personal skills</li>
        </ul>
      </div>
    </div>
  </body>
</html>
`

const driftedSearchHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Lexmark</title>
  </head>
  <body>
    <h1>Company</h1>
  </body>
</html>
`

const loadLexmarkIndiaModule = async () => {
  try {
    return await import('../../scraper/lexmarkindia/script.js')
  } catch {
    assert.fail('Expected Lexmark India scraper module at ../../scraper/lexmarkindia/script.js')
  }
}

test('Lexmark India pins the current Workday contract and preserves legacy archive parsing', async () => {
  const lexmarkIndia = await loadLexmarkIndiaModule()

  assert.equal(lexmarkIndia.SOURCE, 'lexmarkindia')
  assert.equal(lexmarkIndia.COMPANY_NAME, 'Lexmark India')
  assert.equal(lexmarkIndia.CAREERS_URL, 'https://origin-www.lexmark.com/en_in/careers.html')
  assert.equal(lexmarkIndia.JOB_SEARCH_URL, 'https://origin-www.lexmark.com/en_in/careers/job-search.html')
  assert.equal(lexmarkIndia.WORKDAY_URL, 'https://lexmark.wd1.myworkdayjobs.com/Lexmark')
  assert.equal(lexmarkIndia.WORKDAY_JOBS_API_URL, 'https://lexmark.wd1.myworkdayjobs.com/wday/cxs/lexmark/Lexmark/jobs')
  assert.equal(lexmarkIndia.VERIFIED_PUBLIC_JOB_COUNT, 0)
  assert.equal(lexmarkIndia.VERIFIED_ON, '2026-10-03')
  assert.equal(lexmarkIndia.hasOfficialCareersPageSignal(careersLandingHtml), true)
  assert.equal(lexmarkIndia.hasOfficialJobSearchSignal(jobSearchHtml), true)
  assert.equal(lexmarkIndia.hasOfficialJobSearchSignal(driftedSearchHtml), false)
  assert.deepEqual(lexmarkIndia.extractListingRows(jobSearchHtml), [
    {
      title: 'Azure Data Integration Developer',
      location: 'Kolkata, WB',
      department: 'Information Technology',
      sourceUrl: 'https://origin-www.lexmark.com/en_in/careers/job-description.143497.html',
      jobId: '143497',
    },
    {
      title: 'Usability Engineer 3',
      location: 'Kolkata, WB',
      department: 'Engineering & Design',
      sourceUrl: 'https://origin-www.lexmark.com/en_in/careers/job-description.143267.html',
      jobId: '143267',
    },
  ])
  assert.equal(
    lexmarkIndia.hasOfficialJobDetailSignal(
      azureDataIntegrationDeveloperHtml,
      'https://origin-www.lexmark.com/en_in/careers/job-description.143497.html',
    ),
    true,
  )
})

test('Lexmark India preserves normalized first-party jobs for the legacy job-search and detail fixtures', async () => {
  const lexmarkIndia = await loadLexmarkIndiaModule()
  const requestedUrls = []

  const jobs = await lexmarkIndia.createLexmarkIndiaScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === lexmarkIndia.CAREERS_URL) return careersLandingHtml
      if (url === lexmarkIndia.JOB_SEARCH_URL) return jobSearchHtml
      if (url === 'https://origin-www.lexmark.com/en_in/careers/job-description.143497.html') {
        return azureDataIntegrationDeveloperHtml
      }
      if (url === 'https://origin-www.lexmark.com/en_in/careers/job-description.143267.html') {
        return usabilityEngineerHtml
      }

      throw new Error(`Unexpected Lexmark India URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://origin-www.lexmark.com/en_in/careers.html',
    'https://origin-www.lexmark.com/en_in/careers/job-search.html',
    'https://origin-www.lexmark.com/en_in/careers/job-description.143497.html',
    'https://origin-www.lexmark.com/en_in/careers/job-description.143267.html',
  ])

  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      company: job.company,
      department: job.department,
      location: job.location,
      city: job.city,
      country: job.country,
      jobId: job.jobId,
      requisitionId: job.requisitionId,
      experienceRequired: job.experienceRequired,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      source: job.source,
      link: job.link,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Azure Data Integration Developer',
        company: 'Lexmark India',
        department: 'Information Technology',
        location: 'Kolkata, WB IND',
        city: 'Kolkata',
        country: 'India',
        jobId: '143497',
        requisitionId: '143497',
        experienceRequired: '7+ Years',
        sourceUrl: 'https://origin-www.lexmark.com/en_in/careers/job-description.143497.html',
        applyUrl:
          'https://careers.lexmark.com/psp/PWW1EXT/EMPLOYEE/HRMS/c/HRS_HRAM_FL.HRS_CG_SEARCH_FL.GBL?Page=HRS_APP_JBPST_FL&Action=U&FOCUS=Applicant&LanguageCd=ENG&SiteId=3&PostingSeq=1&JobOpeningId=143497',
        source: 'lexmarkindia',
        link: 'https://origin-www.lexmark.com/en_in/careers/job-description.143497.html',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'Usability Engineer 3',
        company: 'Lexmark India',
        department: 'Engineering & Design',
        location: 'Kolkata, WB IND',
        city: 'Kolkata',
        country: 'India',
        jobId: '143267',
        requisitionId: '143267',
        experienceRequired: '5+ years',
        sourceUrl: 'https://origin-www.lexmark.com/en_in/careers/job-description.143267.html',
        applyUrl:
          'https://careers.lexmark.com/psp/PWW1EXT/EMPLOYEE/HRMS/c/HRS_HRAM_FL.HRS_CG_SEARCH_FL.GBL?Page=HRS_APP_JBPST_FL&Action=U&FOCUS=Applicant&LanguageCd=ENG&SiteId=3&PostingSeq=1&JobOpeningId=143267',
        source: 'lexmarkindia',
        link: 'https://origin-www.lexmark.com/en_in/careers/job-description.143267.html',
        scrapedAt: FIXED_SCRAPED_AT,
      },
    ],
  )

  assert.match(jobs[0].jobDescription ?? '', /Senior Azure Data Integration Developer/i)
  assert.match(jobs[0].minimumQualification ?? '', /BE\/ME\/MCA with 7\+ Years/i)
  assert.match(jobs[1].jobDescription ?? '', /prototypes/i)
})

test('Lexmark India fails closed when the careers landing page, archive, or detail pages drift', async () => {
  const lexmarkIndia = await loadLexmarkIndiaModule()

  await assert.rejects(
    lexmarkIndia.createLexmarkIndiaScraper().run({
      fetchText: async (url) => {
        if (url === lexmarkIndia.CAREERS_URL) return '<html><body><h1>Lexmark</h1></body></html>'
        throw new Error(`Unexpected Lexmark India URL: ${url}`)
      },
    }),
    /careers landing page/i,
  )

  await assert.rejects(
    lexmarkIndia.createLexmarkIndiaScraper().run({
      fetchText: async (url) => {
        if (url === lexmarkIndia.CAREERS_URL) return careersLandingHtml
        if (url === lexmarkIndia.JOB_SEARCH_URL) return driftedSearchHtml
        throw new Error(`Unexpected Lexmark India URL: ${url}`)
      },
    }),
    /job search page/i,
  )

  await assert.rejects(
    lexmarkIndia.createLexmarkIndiaScraper().run({
      fetchText: async (url) => {
        if (url === lexmarkIndia.CAREERS_URL) return careersLandingHtml
        if (url === lexmarkIndia.JOB_SEARCH_URL) return jobSearchHtml
        if (url === 'https://origin-www.lexmark.com/en_in/careers/job-description.143497.html') {
          return '<html><body><h1>Azure Data Integration Developer</h1></body></html>'
        }
        if (url === 'https://origin-www.lexmark.com/en_in/careers/job-description.143267.html') {
          return usabilityEngineerHtml
        }
        throw new Error(`Unexpected Lexmark India URL: ${url}`)
      },
    }),
    /job detail page/i,
  )
})
