import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Rain - Careers</title>
  </head>
  <body>
    <main>
      <h1>Rain careers</h1>
      <h2>Our mission</h2>
      <p>Welcome to Rain, where we're reinvigorating the workforce by delivering responsible on-demand access to pay.</p>
      <a href="https://jobs.ashbyhq.com/rain-technologies" target="_blank" class="lm-button w-inline-block">
        <div class="button-txt">See open roles</div>
      </a>
    </main>
  </body>
</html>
`

const ashbyPayload = {
  jobs: [
    {
      id: 'f60a3996-2bc2-42d9-a353-154e1f371c58',
      title: 'Business Development Representative',
      department: 'GTM',
      team: 'Sales (BDR)',
      employmentType: 'FullTime',
      location: 'United States',
      secondaryLocations: [],
      publishedAt: '2026-06-25T19:35:22.515+00:00',
      isListed: true,
      isRemote: true,
      workplaceType: 'Remote',
      address: {
        postalAddress: {
          addressCountry: 'United States',
        },
      },
      jobUrl: 'https://jobs.ashbyhq.com/rain-technologies/f60a3996-2bc2-42d9-a353-154e1f371c58',
      applyUrl: 'https://jobs.ashbyhq.com/rain-technologies/f60a3996-2bc2-42d9-a353-154e1f371c58/application',
      descriptionPlain: 'Drive pipeline generation and outbound prospecting for Rain.',
    },
    {
      id: '84ce9cef-273b-4f48-86b3-eaa68894ce67',
      title: 'Engineering Lead',
      department: 'Engineering',
      team: 'Engineering',
      employmentType: 'FullTime',
      location: 'Lisbon Portugal',
      secondaryLocations: [
        {
          location: 'Italy',
          address: {
            postalAddress: {
              addressCountry: 'Italy',
            },
          },
        },
      ],
      publishedAt: '2026-07-08T13:58:29.767+00:00',
      isListed: true,
      isRemote: true,
      workplaceType: 'Remote',
      address: {
        postalAddress: {
          addressCountry: 'Portugal',
          addressLocality: 'Lisbon',
        },
      },
      jobUrl: 'https://jobs.ashbyhq.com/rain-technologies/84ce9cef-273b-4f48-86b3-eaa68894ce67',
      applyUrl: 'https://jobs.ashbyhq.com/rain-technologies/84ce9cef-273b-4f48-86b3-eaa68894ce67/application',
      descriptionPlain: 'Lead the remote engineering team building Rain products.',
    },
    {
      id: 'ignore-me',
      title: 'Unlisted Role',
      department: 'Operations',
      employmentType: 'FullTime',
      location: 'United States',
      secondaryLocations: [],
      publishedAt: '2026-07-01T00:00:00.000+00:00',
      isListed: false,
      jobUrl: 'https://jobs.ashbyhq.com/rain-technologies/ignore-me',
      applyUrl: 'https://jobs.ashbyhq.com/rain-technologies/ignore-me/application',
      descriptionPlain: 'This role should be ignored.',
    },
  ],
}

const loadRainInstantPayModule = async () => {
  try {
    return await import('../../scraper/raininstantpay/script.js')
  } catch {
    assert.fail('Expected Rain Instant Pay scraper module at ../../scraper/raininstantpay/script.js')
  }
}

test('Rain Instant Pay pins the verified official careers page and Ashby endpoints', async () => {
  const rainInstantPay = await loadRainInstantPayModule()

  assert.equal(rainInstantPay.SOURCE, 'raininstantpay')
  assert.equal(rainInstantPay.COMPANY, 'Rain Instant Pay')
  assert.equal(rainInstantPay.CAREERS_PAGE_URL, 'https://www.rainapp.com/careers')
  assert.equal(rainInstantPay.ASHBY_PUBLIC_BOARD_URL, 'https://jobs.ashbyhq.com/rain-technologies')
  assert.equal(
    rainInstantPay.ASHBY_JOB_BOARD_URL,
    'https://api.ashbyhq.com/posting-api/job-board/rain-technologies',
  )
  assert.equal(rainInstantPay.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(
    rainInstantPay.extractVerifiedAshbyPublicBoardUrl(careersHtml),
    'https://jobs.ashbyhq.com/rain-technologies',
  )
  assert.equal(
    rainInstantPay.buildAshbyJobBoardUrl('https://jobs.ashbyhq.com/rain-technologies'),
    'https://api.ashbyhq.com/posting-api/job-board/rain-technologies',
  )
})

test('Rain Instant Pay extracts listed jobs from the verified Ashby payload into shared scraper fields', async () => {
  const rainInstantPay = await loadRainInstantPayModule()
  const jobs = rainInstantPay.extractAshbyJobs(ashbyPayload)

  assert.deepEqual(jobs, [
    {
      title: 'Business Development Representative',
      company: 'Rain Instant Pay',
      department: 'GTM',
      location: 'United States',
      city: null,
      state: null,
      country: 'United States',
      jobId: 'f60a3996-2bc2-42d9-a353-154e1f371c58',
      requisitionId: 'f60a3996-2bc2-42d9-a353-154e1f371c58',
      sourceUrl: 'https://jobs.ashbyhq.com/rain-technologies/f60a3996-2bc2-42d9-a353-154e1f371c58',
      applyUrl: 'https://jobs.ashbyhq.com/rain-technologies/f60a3996-2bc2-42d9-a353-154e1f371c58/application',
      employmentType: 'Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-06-25T19:35:22.515+00:00',
      closingDate: null,
      jobDescription: 'Drive pipeline generation and outbound prospecting for Rain.',
      remoteStatus: 'Remote',
    },
    {
      title: 'Engineering Lead',
      company: 'Rain Instant Pay',
      department: 'Engineering',
      location: 'Lisbon, Portugal',
      city: 'Lisbon',
      state: null,
      country: 'Portugal',
      jobId: '84ce9cef-273b-4f48-86b3-eaa68894ce67',
      requisitionId: '84ce9cef-273b-4f48-86b3-eaa68894ce67',
      sourceUrl: 'https://jobs.ashbyhq.com/rain-technologies/84ce9cef-273b-4f48-86b3-eaa68894ce67',
      applyUrl: 'https://jobs.ashbyhq.com/rain-technologies/84ce9cef-273b-4f48-86b3-eaa68894ce67/application',
      employmentType: 'Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-08T13:58:29.767+00:00',
      closingDate: null,
      jobDescription: 'Lead the remote engineering team building Rain products.',
      remoteStatus: 'Remote',
    },
  ])
})

test('Rain Instant Pay run validates the official careers handoff and returns normalized public Ashby jobs', async () => {
  const rainInstantPay = await loadRainInstantPayModule()
  const requestedTexts = []
  const requestedJson = []

  const jobs = await rainInstantPay.createRainInstantPayScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === rainInstantPay.CAREERS_PAGE_URL) return careersHtml
      throw new Error(`Unexpected Rain Instant Pay text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      return ashbyPayload
    },
  })

  assert.deepEqual(requestedTexts, [rainInstantPay.CAREERS_PAGE_URL])
  assert.deepEqual(requestedJson, [rainInstantPay.ASHBY_JOB_BOARD_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'raininstantpay')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

test('Rain Instant Pay fails closed when the verified careers page, Ashby handoff, or payload drift', async () => {
  const rainInstantPay = await loadRainInstantPayModule()

  await assert.rejects(
    rainInstantPay.createRainInstantPayScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
      fetchJson: async () => ashbyPayload,
    }),
    /verified rain instant pay official careers page/i,
  )

  await assert.rejects(
    rainInstantPay.createRainInstantPayScraper().run({
      fetchText: async () =>
        careersHtml.replaceAll('jobs.ashbyhq.com/rain-technologies', 'jobs.ashbyhq.com/other'),
      fetchJson: async () => ashbyPayload,
    }),
    /verified ashby public board handoff/i,
  )

  await assert.rejects(
    rainInstantPay.createRainInstantPayScraper().run({
      fetchText: async () => careersHtml,
      fetchJson: async () => ({ postings: [] }),
    }),
    /verified ashby payload/i,
  )
})
