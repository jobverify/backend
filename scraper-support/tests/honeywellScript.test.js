import assert from 'node:assert/strict'
import test from 'node:test'

const loadHoneywellModule = async () => {
  try {
    return await import('../../scraper/honeywell/script.js')
  } catch {
    assert.fail('Expected Honeywell scraper module at ../../scraper/scraper/honeywell/script.js')
  }
}

const samplePayload = {
  items: [
    {
      TotalJobsCount: 3,
      Limit: 24,
      requisitionList: [
        {
          Id: '145492',
          Title: 'Estimator II',
          PrimaryLocation: 'Pune, Maharashtra, India',
          PrimaryLocationCountry: 'IN',
          PostedDate: '2026-07-07',
          ShortDescriptionStr: 'Develop accurate project estimates.',
          WorkplaceType: 'Hybrid',
          secondaryLocations: [],
        },
        {
          Id: '145493',
          Title: 'Controls Engineer',
          PrimaryLocation: 'Charlotte, North Carolina, United States',
          PrimaryLocationCountry: 'US',
          PostedDate: '2026-07-06',
          ShortDescriptionStr: 'Support global automation programs.',
          secondaryLocations: [
            { Name: 'Bengaluru, Karnataka, India', CountryCode: 'IN' },
          ],
        },
        {
          Id: '145494',
          Title: 'US Role',
          PrimaryLocation: 'Phoenix, Arizona, United States',
          PrimaryLocationCountry: 'US',
          PostedDate: '2026-07-05',
          ShortDescriptionStr: 'Ignore this role.',
          secondaryLocations: [],
        },
      ],
    },
  ],
}

const sampleDetailPayload = {
  Id: '145492',
  Title: 'Estimator II',
  Category: 'Engineering',
  JobSchedule: 'Full time',
  PostedDate: '2026-07-07',
  PrimaryLocation: 'Pune, Maharashtra, India',
  PrimaryLocationCountry: 'IN',
  ExternalDescriptionStr: '<p>Lead estimating activities for integrated engineering programs.</p>',
  ExternalQualificationsStr: '<ul><li>5 years of estimating experience in capital projects</li><li>Bachelor\'s degree in Engineering</li></ul>',
}

test('buildSearchUrl scopes Honeywell Oracle Cloud requests to the official India jobs finder', async () => {
  const { buildSearchUrl } = await loadHoneywellModule()

  assert.equal(
    buildSearchUrl(),
    'https://ibqbjb.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_1,limit=24,offset=0,location=India',
  )
})

test('buildJobDetailApiUrl uses the official Honeywell Oracle detail endpoint', async () => {
  const { buildJobDetailApiUrl } = await loadHoneywellModule()

  assert.equal(
    buildJobDetailApiUrl('145492'),
    'https://ibqbjb.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails/145492?expand=all',
  )
})

test('extractSearchResults retains Honeywell jobs with a primary or secondary India location', async () => {
  const { extractSearchResults } = await loadHoneywellModule()
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
      title: 'Estimator II',
      location: 'Pune, Maharashtra, India',
      city: 'Pune',
      jobId: '145492',
      sourceUrl: 'https://ibqbjb.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/145492',
    },
    {
      title: 'Controls Engineer',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      jobId: '145493',
      sourceUrl: 'https://ibqbjb.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/145493',
    },
  ])
})

test('extractJobDetail derives experience from Honeywell Oracle detail qualifications', async () => {
  const honeywell = await loadHoneywellModule()
  const listing = honeywell.extractSearchResults(samplePayload)[0]
  const detail = honeywell.extractJobDetail(sampleDetailPayload, listing)

  assert.deepEqual(detail, {
    title: 'Estimator II',
    company: 'Honeywell',
    department: 'Engineering',
    location: 'Pune, Maharashtra, India',
    city: 'Pune',
    jobId: '145492',
    requisitionId: '145492',
    sourceUrl: 'https://ibqbjb.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/145492',
    applyUrl: 'https://ibqbjb.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/145492',
    employmentType: 'Full time',
    experienceRequired: '5 years',
    minimumQualification: "5 years of estimating experience in capital projects Bachelor's degree in Engineering",
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-07',
    closingDate: null,
    jobDescription: 'Lead estimating activities for integrated engineering programs. 5 years of estimating experience in capital projects Bachelor\'s degree in Engineering',
  })
})

test('run preserves the scraper runner contract for Honeywell jobs after hydrating detail data', async () => {
  const { buildSearchUrl, buildJobDetailApiUrl, createHoneywellScraper } = await loadHoneywellModule()
  const requests = []
  const jobs = await createHoneywellScraper({
    maxPages: 1,
    maxJobs: 1,
    fetchJson: async (url) => {
      requests.push(url)
      if (url === buildSearchUrl()) {
        return samplePayload
      }
      if (url === buildJobDetailApiUrl('145492')) {
        return sampleDetailPayload
      }
      assert.fail(`Unexpected Honeywell fetch URL: ${url}`)
      return null
    },
  }).run()

  assert.deepEqual(requests, [
    buildSearchUrl(),
    buildJobDetailApiUrl('145492'),
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'honeywell')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].experienceRequired, '5 years')
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})
