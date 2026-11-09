import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_HTML = `
  <html>
    <head>
      <title>Careers - Join the ASC International Team | Inspection &amp; Metrology Jobs | ASC International</title>
    </head>
    <body>
      <main>
        <h1>Join Our Continuously <span>Growing Team</span></h1>
        <h2>Why Build Your Career Here</h2>
        <h3>Current Openings</h3>
        <h4>Automated Optical Inspection (AOI) Engineer</h4>
        <ul>
          <li>Apply software and troubleshooting techniques to solve computer-related Mechatronics AOI systems product issues.</li>
          <li>Utilize online, remote access software to service customer AOI systems.</li>
          <li>Manage proper spare parts inventory for Mechatronics AOI systems.</li>
        </ul>
        <p>
          Requirements: Bachelor's Degree or Foreign equivalent in industrial engineering, mechanic engineering,
          electrical engineering, technology education, or a closely related field and 2 Years' experience as an AOI Engineer, including:
        </p>
        <ul>
          <li>AOI Programming</li>
          <li>Troubleshooting complex AOI Hardware/software issues; Building, Repairing, and supporting AOI Sensors.</li>
          <li>Travel: Domestic travel 50% of the time to clients' sites for installation, training, and support, as normal and customary for the position.</li>
        </ul>
        <p>ALL EXPERIENCE MAY BE GAINED CONCURRENTLY.</p>
        <p>Mail resume to ATTN: HR, ASC International, Inc 830 Tower Drive Suite 200 Medina, MN 55340</p>
      </main>
    </body>
  </html>
`

const loadAscInternationalModule = async () => {
  try {
    return await import('../../scraper/ascinternational/script.js')
  } catch {
    assert.fail('Expected ASC International scraper module at ../../scraper/ascinternational/script.js')
  }
}

test('buildSearchUrl keeps ASC International on the official careers page', async () => {
  const {
    CAREER_PAGE_URL,
    LEGACY_JOB_POSTING_URL,
    buildSearchUrl,
  } = await loadAscInternationalModule()

  assert.equal(CAREER_PAGE_URL, 'https://ascinternational.com/careers/')
  assert.equal(LEGACY_JOB_POSTING_URL, 'https://w2.ascinternational.com/job-posting/')
  assert.equal(buildSearchUrl(), 'https://ascinternational.com/careers/')
})

test('ASC International accepts the current official careers title variant', async () => {
  const { hasOfficialCareersPageSignal } = await loadAscInternationalModule()

  assert.equal(hasOfficialCareersPageSignal(`
    <html><head><title>Careers - Inspection &amp; Metrology Jobs | ASC International</title></head>
    <body><h1>Join Our Continuously Growing Team</h1><h2>Current Openings</h2></body></html>
  `), true)
})

test('extractSearchResults maps ASC International static careers markup into shared scraper fields', async () => {
  const { CAREER_PAGE_URL, extractSearchResults } = await loadAscInternationalModule()
  const jobs = extractSearchResults(CAREERS_HTML)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Automated Optical Inspection (AOI) Engineer',
    company: 'ASC International',
    department: null,
    location: 'Medina, MN, USA',
    city: 'Medina',
    jobId: 'automated-optical-inspection-aoi-engineer',
    requisitionId: 'automated-optical-inspection-aoi-engineer',
    sourceUrl: CAREER_PAGE_URL,
    applyUrl: CAREER_PAGE_URL,
    employmentType: null,
    experienceRequired: '2 years',
    minimumQualification: "Bachelor's Degree or Foreign equivalent in industrial engineering, mechanic engineering, electrical engineering, technology education, or a closely related field",
    preferredQualification: null,
    requiredSkills: [
      'AOI Programming',
      'Troubleshooting complex AOI Hardware/software issues; Building, Repairing, and supporting AOI Sensors.',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription: jobs[0].jobDescription,
  })
  assert.match(jobs[0].jobDescription, /Apply software and troubleshooting techniques/i)
  assert.match(jobs[0].jobDescription, /Mail resume to ATTN: HR/i)
})

test('run fetches the ASC International careers page once and decorates shared runner fields', async () => {
  const { CAREER_PAGE_URL, createAscInternationalScraper } = await loadAscInternationalModule()
  const requests = []
  const scraper = createAscInternationalScraper({ maxJobs: 1 })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requests.push(url)
      return CAREERS_HTML
    },
  })

  assert.deepEqual(requests, [CAREER_PAGE_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'ascinternational')
  assert.equal(jobs[0].company, 'ASC International')
  assert.equal(jobs[0].link, CAREER_PAGE_URL)
  assert.equal(jobs[0].location, 'Medina, MN, USA')
  assert.match(jobs[0].scrapedAt, /\d{4}-\d{2}-\d{2}T/)
})

test('run returns an honest empty result when both verified first-party job pages time out from this environment', async () => {
  const {
    CAREER_PAGE_URL,
    LEGACY_JOB_POSTING_URL,
    createAscInternationalScraper,
  } = await loadAscInternationalModule()
  const requests = []

  const jobs = await createAscInternationalScraper().run({
    fetchPage: async (url) => {
      requests.push(url)
      return {
        status: null,
        url,
        html: null,
        errorKind: 'timeout',
      }
    },
  })

  assert.deepEqual(requests, [
    CAREER_PAGE_URL,
    LEGACY_JOB_POSTING_URL,
  ])
  assert.deepEqual(jobs, [])
})
