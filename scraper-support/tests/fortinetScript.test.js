import assert from 'node:assert/strict'
import test from 'node:test'

const loadFortinetModule = async () => {
  try {
    return await import('../../scraper/fortinet/script.js')
  } catch {
    assert.fail('Expected Fortinet scraper module at ../../scraper/scraper/fortinet/script.js')
  }
}

const samplePayload = {
  items: [
    {
      TotalJobsCount: 3,
      Limit: 24,
      requisitionList: [
        {
          Id: '22026',
          Title: 'Regional Sales Manager (RSM) - Cloud Security',
          PrimaryLocation: 'Gurgaon, Haryana, India',
          PrimaryLocationCountry: 'IN',
          PostedDate: '2026-07-03',
          ShortDescriptionStr: 'Drive enterprise cloud security growth.',
          WorkplaceType: 'On-site',
          secondaryLocations: [],
        },
        {
          Id: '22027',
          Title: 'Solutions Architect',
          PrimaryLocation: 'Singapore',
          PrimaryLocationCountry: 'SG',
          PostedDate: '2026-07-02',
          ShortDescriptionStr: 'Support regional customer architecture.',
          secondaryLocations: [
            { Name: 'Pune, Maharashtra, India', CountryCode: 'IN' },
          ],
        },
        {
          Id: '22028',
          Title: 'US Role',
          PrimaryLocation: 'Sunnyvale, California, United States',
          PrimaryLocationCountry: 'US',
          PostedDate: '2026-07-01',
          ShortDescriptionStr: 'Ignore this role.',
          secondaryLocations: [],
        },
      ],
    },
  ],
}

test('buildSearchUrl scopes Fortinet Oracle Cloud requests to the official India jobs finder', async () => {
  const { buildSearchUrl } = await loadFortinetModule()

  assert.equal(
    buildSearchUrl(),
    'https://edel.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_2001,limit=24,offset=0,location=India',
  )
})

test('extractSearchResults retains Fortinet jobs with a primary or secondary India location', async () => {
  const { extractSearchResults } = await loadFortinetModule()
  const jobs = extractSearchResults(samplePayload)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs.map((job) => ({
    title: job.title,
    location: job.location,
    city: job.city,
    jobId: job.jobId,
    sourceUrl: job.sourceUrl,
  })), [
    {
      title: 'Regional Sales Manager (RSM) - Cloud Security',
      location: 'Gurgaon, Haryana, India',
      city: 'Gurgaon',
      jobId: '22026',
      sourceUrl: 'https://edel.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_2001/job/22026',
    },
    {
      title: 'Solutions Architect',
      location: 'Pune, Maharashtra, India',
      city: 'Pune',
      jobId: '22027',
      sourceUrl: 'https://edel.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_2001/job/22027',
    },
  ])
})

test('run preserves the scraper runner contract for Fortinet jobs', async () => {
  const { buildSearchUrl, createFortinetScraper } = await loadFortinetModule()
  const requests = []
  const jobs = await createFortinetScraper({
    maxPages: 1,
    maxJobs: 1,
    fetchJson: async (url) => {
      requests.push(url)
      assert.equal(url, buildSearchUrl())
      return samplePayload
    },
  }).run()

  assert.deepEqual(requests, [buildSearchUrl()])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'fortinet')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})
