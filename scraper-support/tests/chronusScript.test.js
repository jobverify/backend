import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
  <html>
    <head><title>Careers at Chronus</title></head>
    <body>
      <h2>Open Positions</h2>
      <script id="rbox-loader-script">
        src=['/static/client-src-served/widget/8241/rbox_api.js', '/static/client-src-served/widget/8241/rbox_impl.js'];
        s.src = _rbox.host_protocol + '//w.recruiterbox.com' + src[0];
      </script>
    </body>
  </html>
`

const openingsPayload = [
  {
    id: 699913,
    title: 'Senior Product Designer',
    position_type: 'Full-time',
    location: {
      city: 'Chennai',
      state: 'Tamil Nadu',
      country: 'India',
    },
    company_name: 'Chronus',
    job_code: 'Chrn0150',
    team: 'Product Design',
    description: '<p>Design mentoring software experiences for global customers.</p>',
  },
  {
    id: 699999,
    title: 'Product Marketing Manager',
    position_type: 'Full-time',
    location: {
      city: 'Bellevue',
      state: 'Washington',
      country: 'United States',
    },
    company_name: 'Chronus',
    job_code: 'Chrn9999',
    team: 'Marketing',
    description: '<p>Ignore non-India roles.</p>',
  },
]

const loadModule = async () => {
  try {
    return await import('../../scraper/chronus/script.js')
  } catch {
    assert.fail('Expected Chronus scraper module at ../../scraper/chronus/script.js')
  }
}

test('Chronus exports stable Recruiterbox endpoints and validates the official careers handoff', async () => {
  const chronus = await loadModule()

  assert.equal(chronus.CAREER_PAGE_URL, 'https://chronus.com/about-us/careers')
  assert.equal(chronus.OPENINGS_API_URL, 'https://app.recruiterbox.com/widget/8241/openings/')
  assert.equal(chronus.DETAIL_URL_BASE, 'https://app.recruiterbox.com/widget/8241/opening/')
  assert.equal(chronus.hasOfficialCareersSignal(careersHtml), true)
})

test('extractSearchResults keeps Chronus India openings from Recruiterbox JSON', async () => {
  const chronus = await loadModule()
  const jobs = chronus.extractSearchResults(openingsPayload)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Senior Product Designer',
    company: 'Chronus',
    department: 'Product Design',
    location: 'Chennai, Tamil Nadu, India',
    city: 'Chennai',
    country: 'India',
    jobId: '699913',
    requisitionId: 'Chrn0150',
    sourceUrl: 'https://app.recruiterbox.com/widget/8241/opening/699913/',
    applyUrl: 'https://app.recruiterbox.com/widget/8241/opening/699913/',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Design mentoring software experiences for global customers.',
    jobType: 'Full-time',
    additionalLocations: null,
  })
})

test('run verifies the official Chronus careers page before loading the Recruiterbox feed', async () => {
  const chronus = await loadModule()
  const requests = []

  const jobs = await chronus.createChronusScraper({
    maxJobs: 1,
    fetchText: async (url) => {
      requests.push(url)
      if (url === chronus.CAREER_PAGE_URL) return careersHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requests.push(url)
      if (url === chronus.OPENINGS_API_URL) return openingsPayload
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  }).run()

  assert.deepEqual(requests, [
    chronus.CAREER_PAGE_URL,
    chronus.OPENINGS_API_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'chronus')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
