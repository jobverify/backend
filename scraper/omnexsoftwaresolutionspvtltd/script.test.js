import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => import('./script.js')

const homepageHtml = `
  <html>
    <head><title>Omnex Systems</title></head>
    <body>
      <nav>
        <a href="https://careers.omnexsystems.com/Users/Jobs">Careers</a>
      </nav>
      <footer>Omnex Inc. USA</footer>
    </body>
  </html>
`

const aboutHtml = `
  <html>
    <head><title>About Omnex Systems</title></head>
    <body>
      <p>Omnex Systems, LLC is headquartered in Ann Arbor, Michigan.</p>
      <a href="https://careers.omnexsystems.com/Users/Jobs">Careers</a>
    </body>
  </html>
`

const careersHtml = `
  <html>
    <head><title>Jobs</title></head>
    <body>
      <input type="hidden" id="hiddenFooterClientName" value="Omnex Software Solutions Pvt.Ltd." />
      <input type="hidden" id="hdnClientId" value="27" />
      <script src="/Scripts/UsersJobs.js"></script>
    </body>
  </html>
`

const jobsPayload = {
  Jobs: [{
    Id: 1156,
    Title: 'Sr. Manager - Digital Marketing',
    City: 'Chennai',
    State: 'Tamil Nadu',
    Country: 'India',
    Job_Type: 'Full Time',
    CreatedDate: '/Date(1781481600000)/',
    EndDate: '/Date(1785456000000)/',
    Description: '<p>Lead demand generation.</p>',
    ClientName: 'Omnex Software Solutions Pvt.Ltd.',
  }],
  TotalJobsCount: 1,
}

const detailHtml = `
  <html>
    <head>
      <title>Sr. Manager - Digital Marketing</title>
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "JobPosting",
          "title": "Sr. Manager - Digital Marketing",
          "description": "<p>Lead demand generation
for India operations.</p>",
          "datePosted": "2026-06-15",
          "validThrough": "2026-07-31",
          "employmentType": "Full Time",
          "identifier": {
            "@type": "PropertyValue",
            "name": "Omnex Software Solutions Pvt.Ltd.",
            "value": "SM-DM61857"
          },
          "hiringOrganization": {
            "@type": "Organization",
            "name": "Omnex Software Solutions Pvt.Ltd."
          },
          "jobLocation": {
            "@type": "Place",
            "address": {
              "@type": "PostalAddress",
              "addressLocality": "Chennai",
              "addressRegion": "Tamil Nadu",
              "addressCountry": "India"
            }
          }
        }
      </script>
    </head>
    <body>
      <input type="hidden" id="hiddenFooterClientName" value="Omnex Software Solutions Pvt.Ltd." />
      <input type="hidden" id="hdnDescription" value="&lt;p&gt;Lead demand generation for India operations.&lt;/p&gt;" />
    </body>
  </html>
`

test('Omnex scraper validates the first-party handoff and maps enriched jobs from the public portal', async () => {
  const omnex = await loadModule()
  const {
    ABOUT_URL,
    CAREERS_URL,
    COMPANY,
    HOME_URL,
    buildJobDetailUrl,
    buildListingsApiUrl,
    createOmnexSoftwareSolutionsScraper,
    extractSearchResults,
    hasOfficialCareersSignal,
  } = omnex

  assert.equal(COMPANY, 'Omnex Software Solutions Pvt.Ltd.')
  assert.equal(CAREERS_URL, 'http://careers.omnexsystems.com/Users/Jobs')
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(extractSearchResults(jobsPayload), [{
    title: 'Sr. Manager - Digital Marketing',
    company: 'Omnex Software Solutions Pvt.Ltd.',
    department: null,
    location: 'Chennai, Tamil Nadu, India',
    city: 'Chennai',
    country: 'India',
    jobId: '1156',
    requisitionId: '1156',
    sourceUrl: 'http://careers.omnexsystems.com/Users/Index?JobId=1156',
    applyUrl: 'http://careers.omnexsystems.com/Users/Index?JobId=1156',
    employmentType: 'Full Time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-15T00:00:00.000Z',
    closingDate: '2026-07-31T00:00:00.000Z',
    jobDescription: 'Lead demand generation.',
  }])

  const requests = []
  const jobs = await createOmnexSoftwareSolutionsScraper().run({
    fetchText: async (url) => {
      requests.push(url)
      if (url === HOME_URL) return homepageHtml
      if (url === ABOUT_URL) return aboutHtml
      if (url === CAREERS_URL) return careersHtml
      if (url === buildJobDetailUrl(1156)) return detailHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requests.push(url)
      assert.equal(url, buildListingsApiUrl())
      return jobsPayload
    },
    now: () => '2026-07-11T00:00:00.000Z',
  })

  assert.deepEqual(requests, [
    HOME_URL,
    ABOUT_URL,
    CAREERS_URL,
    buildListingsApiUrl(),
    buildJobDetailUrl(1156),
  ])
  assert.deepEqual(jobs, [{
    title: 'Sr. Manager - Digital Marketing',
    company: 'Omnex Software Solutions Pvt.Ltd.',
    department: null,
    location: 'Chennai, Tamil Nadu, India',
    city: 'Chennai',
    country: 'India',
    jobId: '1156',
    requisitionId: 'SM-DM61857',
    sourceUrl: 'http://careers.omnexsystems.com/Users/Index?JobId=1156',
    applyUrl: 'http://careers.omnexsystems.com/Users/Index?JobId=1156',
    employmentType: 'Full Time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-15T00:00:00.000Z',
    closingDate: '2026-07-31T00:00:00.000Z',
    jobDescription: 'Lead demand generation for India operations.',
    source: 'omnexsoftwaresolutionspvtltd',
    link: 'http://careers.omnexsystems.com/Users/Index?JobId=1156',
    scrapedAt: '2026-07-11T00:00:00.000Z',
  }])
})

test('Omnex scraper rejects a careers page that loses the verified company identity signal', async () => {
  const omnex = await loadModule()

  await assert.rejects(
    omnex.createOmnexSoftwareSolutionsScraper().run({
      fetchText: async (url) => {
        if (url === omnex.HOME_URL) return homepageHtml
        if (url === omnex.ABOUT_URL) return aboutHtml
        if (url === omnex.CAREERS_URL) {
          return '<html><body><input id="hiddenFooterClientName" value="Another Company" /></body></html>'
        }
        throw new Error(`Unexpected text URL: ${url}`)
      },
    }),
    /verified Omnex Software Solutions jobs page/i,
  )
})
