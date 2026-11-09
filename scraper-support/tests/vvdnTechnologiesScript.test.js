import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-19T00:00:00.000Z'

const loadVvdnModule = async () => {
  try {
    return await import('../../scraper/vvdntechnologies/script.js')
  } catch {
    assert.fail('Expected VVDN Technologies scraper module at ../../scraper/vvdntechnologies/script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Careers</h1>
      <p>Come Join the Club of Innovation</p>
      <h2>Where would you like to begin your journey with VVDN?</h2>
      <footer>
        <a href="https://www.vvdntech.com/careers/new-openings">Current Openings</a>
        <a href="https://www.vvdntech.com/careers/application-form?candidate_source=lateral_open_applied">Apply Now</a>
      </footer>
    </main>
  </body>
</html>
`

const zeroJobsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Find Jobs</h1>
      <p>Unable to find the job you are looking for?</p>
      <a href="https://www.vvdntech.com/careers/application-form?candidate_source=lateral_open_applied">Apply here</a>
    </main>
  </body>
</html>
`

const smartRecruitersZeroPayload = {
  offset: 0,
  limit: 100,
  totalFound: 0,
  content: [],
}

const smartRecruitersIndiaPayload = {
  offset: 0,
  limit: 100,
  totalFound: 1,
  content: [
    {
      id: '743999999999999',
      name: 'Senior Firmware Engineer',
      releasedDate: '2026-07-18T12:00:00.000Z',
      location: {
        city: 'Manesar',
        region: 'Haryana',
        country: 'in',
        remote: false,
      },
      department: { label: 'Engineering' },
      typeOfEmployment: { label: 'Full-time' },
    },
  ],
}

test('VVDN scraper validates the official careers page, current apply-only surface, and SmartRecruiters zero-postings feed', async () => {
  const vvdn = await loadVvdnModule()

  assert.equal(vvdn.CAREERS_URL, 'https://www.vvdntech.com/careers/')
  assert.equal(vvdn.CURRENT_OPENINGS_URL, 'https://www.vvdntech.com/careers/new-openings')
  assert.equal(
    vvdn.APPLY_URL,
    'https://www.vvdntech.com/careers/application-form?candidate_source=lateral_open_applied',
  )
  assert.equal(
    vvdn.SMARTRECRUITERS_POSTINGS_API_URL,
    'https://api.smartrecruiters.com/v1/companies/VVDNTechnologies/postings?limit=100',
  )
  assert.equal(vvdn.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(
    vvdn.extractCurrentOpeningsUrl(officialCareersHtml),
    'https://www.vvdntech.com/careers/new-openings',
  )
  assert.equal(vvdn.hasZeroJobsApplyOnlySignal(zeroJobsHtml), true)
  assert.equal(vvdn.hasNoSmartRecruitersPostingsSignal(smartRecruitersZeroPayload), true)
})

test('VVDN scraper maps India jobs when the verified SmartRecruiters feed exposes postings', async () => {
  const vvdn = await loadVvdnModule()

  assert.deepEqual(
    vvdn.extractIndiaJobsFromSmartRecruitersPayload(smartRecruitersIndiaPayload, {
      scrapedAt: FIXED_SCRAPED_AT,
    }),
    [
      {
        title: 'Senior Firmware Engineer',
        company: 'VVDN Technologies',
        location: 'Manesar, Haryana, India',
        city: 'Manesar',
        country: 'India',
        link: 'https://jobs.smartrecruiters.com/VVDNTechnologies/743999999999999',
        applyUrl: 'https://jobs.smartrecruiters.com/VVDNTechnologies/743999999999999',
        sourceUrl: 'https://jobs.smartrecruiters.com/VVDNTechnologies/743999999999999',
        source: 'vvdntechnologies',
        jobId: '743999999999999',
        requisitionId: null,
        department: 'Engineering',
        employmentType: 'Full-time',
        experienceRequired: null,
        jobDescription: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: '2026-07-18T12:00:00.000Z',
        remoteStatus: 'On-site',
        scrapedAt: FIXED_SCRAPED_AT,
      },
    ],
  )
})

test('VVDN scraper returns no jobs while the official openings surface and SmartRecruiters feed expose no postings', async () => {
  const vvdn = await loadVvdnModule()
  const requested = []

  const jobs = await vvdn.createVvdnTechnologiesScraper().run({
    fetchText: async (url) => {
      requested.push({ type: 'text', url })
      if (url === vvdn.CAREERS_URL) return officialCareersHtml
      if (url === vvdn.CURRENT_OPENINGS_URL) return zeroJobsHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requested.push({ type: 'json', url, options })
      if (url === vvdn.SMARTRECRUITERS_POSTINGS_API_URL) return smartRecruitersZeroPayload
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requested, [
    { type: 'text', url: vvdn.CAREERS_URL },
    { type: 'text', url: vvdn.CURRENT_OPENINGS_URL },
    {
      type: 'json',
      url: 'https://api.smartrecruiters.com/v1/companies/VVDNTechnologies/postings?limit=100',
      options: { method: 'GET' },
    },
  ])
  assert.deepEqual(jobs, [])
})

test('VVDN scraper returns SmartRecruiters jobs if the verified feed starts exposing India postings', async () => {
  const vvdn = await loadVvdnModule()

  const jobs = await vvdn.createVvdnTechnologiesScraper().run({
    fetchText: async (url) => {
      if (url === vvdn.CAREERS_URL) return officialCareersHtml
      if (url === vvdn.CURRENT_OPENINGS_URL) return zeroJobsHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchJson: async () => smartRecruitersIndiaPayload,
    now: () => FIXED_SCRAPED_AT,
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Senior Firmware Engineer')
})

test('VVDN scraper fails closed when the official careers page stops linking to the verified openings surface', async () => {
  const vvdn = await loadVvdnModule()

  await assert.rejects(
    vvdn.createVvdnTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === vvdn.CAREERS_URL) {
          return officialCareersHtml.replace(
            '<a href="https://www.vvdntech.com/careers/new-openings">Current Openings</a>',
            '<a href="https://www.vvdntech.com/careers/job-123">Current Openings</a>',
          )
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
      fetchJson: async () => smartRecruitersZeroPayload,
    }),
    /verified official current openings surface/i,
  )

  await assert.rejects(
    vvdn.createVvdnTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === vvdn.CAREERS_URL) return officialCareersHtml
        if (url === vvdn.CURRENT_OPENINGS_URL) {
          return '<html><body><h1>Find Jobs</h1><a href="/careers/jobs/senior-engineer">Senior Engineer</a></body></html>'
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
      fetchJson: async () => smartRecruitersZeroPayload,
    }),
    /public current openings surface now exposes jobs/i,
  )
})
