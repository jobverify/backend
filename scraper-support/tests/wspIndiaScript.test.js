import assert from 'node:assert/strict'
import test from 'node:test'

const loadWspIndiaModule = async () => {
  try {
    return await import('../../scraper/wspindia/script.js')
  } catch {
    assert.fail('Expected WSP India scraper module at ../../scraper/wspindia/script.js')
  }
}

const indiaSiteHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>We are WSP</h1>
      <p>Lead and grow</p>
      <a href="/en-gl/careers/job-opportunities?country=IN">Search and apply</a>
    </main>
  </body>
</html>
`

const jobsPageOneHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Find your dream job</h1>
      <a href="https://emit.fa.ca3.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_2001/requisitions/preview/85341">
        <span>Principal Engineer - Audio Visual Systems</span>
        <span>Noida | Bengaluru</span>
      </a>
      <a href="https://emit.fa.ca3.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_2001/requisitions/preview/85342">
        <span>Principal Engineer - RAMS</span>
        <span>Bengaluru | Noida | Mumbai</span>
      </a>
      <a href="/en-gl/careers/job-opportunities?country=IN&page=2">2</a>
      <a href="https://example.com/not-official">Ignore me</a>
    </main>
  </body>
</html>
`

const jobsPageTwoHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Find your dream job</h1>
      <a href="https://emit.fa.ca3.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_2001/requisitions/preview/85343">
        <span>Analyst Consultant - Emissions Inventories</span>
        <span>Other cities in India | Mumbai | Noida</span>
      </a>
    </main>
  </body>
</html>
`

const detailPayloadByJobId = {
  '85341': {
    items: [{
      Id: '85341',
      Title: "Principal Engineer - Audio Visual Systems",
      PrimaryLocationCountry: 'IN',
      CorporateDescriptionStr: "<p>WSP is one of the world's leading professional services consulting firms. We are dedicated to our local communities and propelled by international brainpower.</p>",
      ExternalDescriptionStr: '<p>Lead audio visual systems engineering for complex transport projects.</p>',
      InternalResponsibilitiesStr: '<p>Coordinate multidisciplinary AV and ELV design reviews.</p>',
      ExternalQualificationsStr: "<p>Bachelor's degree in Electrical Engineering.</p><p>5 - 8 years' experience in audio visual and ELV design.</p>",
    }],
  },
  '85342': {
    items: [{
      Id: '85342',
      Title: "Principal Engineer - RAMS",
      PrimaryLocationCountry: 'IN',
      CorporateDescriptionStr: "<p>WSP is one of the world's leading professional services consulting firms. We are dedicated to our local communities and propelled by international brainpower.</p>",
      ExternalDescriptionStr: '<p>Lead RAMS delivery for major mobility programmes and coordinate multidisciplinary reviews.</p>',
      InternalResponsibilitiesStr: '<p>Support assurance workshops and system safety reviews.</p>',
      ExternalQualificationsStr: "<p>Bachelor's degree in engineering with strong stakeholder management skills.</p>",
    }],
  },
  '85343': {
    items: [{
      Id: '85343',
      Title: "Analyst Consultant - Emissions Inventories",
      PrimaryLocationCountry: 'IN',
      CorporateDescriptionStr: "<p>WSP is one of the world's leading professional services consulting firms. We are dedicated to our local communities and propelled by international brainpower.</p>",
      ExternalDescriptionStr: '<p>Support emissions inventory analysis and environmental consulting projects across India.</p>',
      InternalResponsibilitiesStr: '<p>Prepare data-driven findings for consulting deliverables.</p>',
      ExternalQualificationsStr: '<p>Degree in environmental engineering or a related field.</p>',
    }],
  },
}

const cloudflareChallengeHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Just a moment...</title>
  </head>
  <body>
    <div>Cloudflare</div>
    <div>Please enable cookies.</div>
    <script src="/cdn-cgi/challenge-platform/scripts/jsd/main.js"></script>
  </body>
</html>
`

test('WSP India verifies the official India site handoff and builds paginated official jobs URLs', async () => {
  const wspIndia = await loadWspIndiaModule()

  assert.equal(wspIndia.INDIA_SITE_URL, 'https://www.wsp.com/en-gl/sites/india')
  assert.equal(
    wspIndia.JOBS_PAGE_URL,
    'https://www.wsp.com/en-gl/careers/job-opportunities?country=IN',
  )
  assert.equal(wspIndia.hasOfficialIndiaSiteSignal(indiaSiteHtml), true)
  assert.equal(wspIndia.hasOfficialJobsPageSignal(jobsPageOneHtml), true)
  assert.equal(
    wspIndia.buildJobsPageUrl({ page: 1 }),
    'https://www.wsp.com/en-gl/careers/job-opportunities?country=IN',
  )
  assert.equal(
    wspIndia.buildJobsPageUrl({ page: 2 }),
    'https://www.wsp.com/en-gl/careers/job-opportunities?country=IN&page=2',
  )
})

test('extractJobsFromHtml keeps only official Oracle preview links exposed by WSP and normalizes locations', async () => {
  const wspIndia = await loadWspIndiaModule()
  const jobs = wspIndia.extractJobsFromHtml(jobsPageOneHtml)

  assert.deepEqual(jobs, [
    {
      title: 'Principal Engineer - Audio Visual Systems',
      company: 'WSP India',
      location: 'Noida | Bengaluru',
      city: 'Noida',
      sourceUrl: 'https://emit.fa.ca3.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_2001/requisitions/preview/85341',
      applyUrl: 'https://emit.fa.ca3.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_2001/requisitions/preview/85341',
      jobId: '85341',
      requisitionId: '85341',
      jobDescription: null,
    },
    {
      title: 'Principal Engineer - RAMS',
      company: 'WSP India',
      location: 'Bengaluru | Noida | Mumbai',
      city: 'Bengaluru',
      sourceUrl: 'https://emit.fa.ca3.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_2001/requisitions/preview/85342',
      applyUrl: 'https://emit.fa.ca3.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_2001/requisitions/preview/85342',
      jobId: '85342',
      requisitionId: '85342',
      jobDescription: null,
    },
  ])
})

test('enrichJobFromDetailRecord captures public experience requirements from Oracle requisition details', async () => {
  const wspIndia = await loadWspIndiaModule()

  const enriched = wspIndia.enrichJobFromDetailRecord({
    title: 'Principal Engineer - Audio Visual Systems',
    company: 'WSP India',
    location: 'Noida | Bengaluru',
    city: 'Noida',
    sourceUrl: 'https://emit.fa.ca3.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_2001/requisitions/preview/85341',
    applyUrl: 'https://emit.fa.ca3.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_2001/requisitions/preview/85341',
    jobId: '85341',
    requisitionId: '85341',
    jobDescription: null,
  }, detailPayloadByJobId['85341'].items[0])

  assert.equal(enriched.experienceRequired, '5-8 years')
  assert.equal(enriched.publicExperienceChecked, true)
  assert.match(enriched.jobDescription, /Lead audio visual systems engineering/i)
})

test('run follows the verified WSP India handoff and paginates the official jobs surface', async () => {
  const wspIndia = await loadWspIndiaModule()
  const requests = []

  const jobs = await wspIndia.createWspIndiaScraper().run({
    fetchPage: async (url) => {
      requests.push(url)
      if (url === wspIndia.INDIA_SITE_URL) return { status: 200, url, html: indiaSiteHtml }
      if (url === wspIndia.buildJobsPageUrl({ page: 1 })) return { status: 200, url, html: jobsPageOneHtml }
      if (url === wspIndia.buildJobsPageUrl({ page: 2 })) return { status: 200, url, html: jobsPageTwoHtml }
      throw new Error(`Unexpected WSP India URL: ${url}`)
    },
    fetchJson: async (url) => {
      requests.push(url)
      if (url === wspIndia.buildJobDetailsApiUrl('85341')) return detailPayloadByJobId['85341']
      if (url === wspIndia.buildJobDetailsApiUrl('85342')) return detailPayloadByJobId['85342']
      if (url === wspIndia.buildJobDetailsApiUrl('85343')) return detailPayloadByJobId['85343']
      throw new Error(`Unexpected WSP India details URL: ${url}`)
    },
    now: () => '2026-07-10T00:00:00.000Z',
  })

  assert.deepEqual(requests, [
    wspIndia.INDIA_SITE_URL,
    wspIndia.buildJobsPageUrl({ page: 1 }),
    wspIndia.buildJobDetailsApiUrl('85341'),
    wspIndia.buildJobDetailsApiUrl('85342'),
    wspIndia.buildJobsPageUrl({ page: 2 }),
    wspIndia.buildJobDetailsApiUrl('85343'),
  ])
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      city: job.city,
      jobId: job.jobId,
      experienceRequired: job.experienceRequired,
      publicExperienceChecked: job.publicExperienceChecked,
      source: job.source,
      link: job.link,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Principal Engineer - Audio Visual Systems',
        location: 'Noida | Bengaluru',
        city: 'Noida',
        jobId: '85341',
        experienceRequired: '5-8 years',
        publicExperienceChecked: true,
        source: 'wspindia',
        link: 'https://emit.fa.ca3.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_2001/requisitions/preview/85341',
        scrapedAt: '2026-07-10T00:00:00.000Z',
      },
      {
        title: 'Principal Engineer - RAMS',
        location: 'Bengaluru | Noida | Mumbai',
        city: 'Bengaluru',
        jobId: '85342',
        experienceRequired: null,
        publicExperienceChecked: true,
        source: 'wspindia',
        link: 'https://emit.fa.ca3.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_2001/requisitions/preview/85342',
        scrapedAt: '2026-07-10T00:00:00.000Z',
      },
      {
        title: 'Analyst Consultant - Emissions Inventories',
        location: 'Other cities in India | Mumbai | Noida',
        city: 'Other cities in India',
        jobId: '85343',
        experienceRequired: null,
        publicExperienceChecked: true,
        source: 'wspindia',
        link: 'https://emit.fa.ca3.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_2001/requisitions/preview/85343',
        scrapedAt: '2026-07-10T00:00:00.000Z',
      },
    ],
  )
})

test('run rejects Cloudflare challenged WSP surfaces rather than returning a verified zero-job result', async () => {
  const wspIndia = await loadWspIndiaModule()
  let detailFetchCalled = false

  await assert.rejects(wspIndia.createWspIndiaScraper().run({
    fetchPage: async (url) => ({
      status: 403,
      url,
      html: cloudflareChallengeHtml,
    }),
    fetchJson: async () => {
      detailFetchCalled = true
      return {}
    },
  }), /Cloudflare/i)
  assert.equal(detailFetchCalled, false)
})

test('WSP India refuses a partial job when the public Oracle detail request fails', async () => {
  const wspIndia = await loadWspIndiaModule()
  await assert.rejects(wspIndia.createWspIndiaScraper().run({
    fetchPage: async url => ({
      status: 200, url,
      html: url === wspIndia.INDIA_SITE_URL ? indiaSiteHtml : jobsPageOneHtml,
    }),
    fetchJson: async () => { throw new Error('HTTP 403 Oracle detail unavailable') },
  }), /Oracle detail unavailable/i)
})
