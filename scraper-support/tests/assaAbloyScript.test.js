import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  JOBS_API_URL,
  buildSearchUrl,
  createAssaAbloyScraper,
  extractSearchResults,
} from '../../scraper/assaabloy/script.js'

const samplePayload = {
  itemsTotalCount: 3,
  items: [
    {
      jobReqId: 49038,
      title: 'Senior Test Engineer',
      postStartDate: '2026-06-29T07:58:08Z',
      applicationDueDate: '2026-08-31T20:29:59Z',
      created: '2026-06-12T19:53:36Z',
      applicationUrl: 'https://career2.successfactors.eu/career?career_ns=job_application&company=assaabloya&career_job_req_id=49038&selected_lang=en_US',
      evergreen: false,
      officePresence: 'Hybrid',
      jobFunction: {
        category: 'IT',
        name: 'Telecom & Internet',
      },
      locations: [
        {
          region: 'Asia',
          country: 'India',
          city: 'Chennai',
          address: '10th Floor (9th office floor), ALTIUS A BLOCK',
        },
      ],
      experienceLevel: {
        value: 4,
        name: 'Associate',
      },
    },
    {
      jobReqId: 15352,
      title: 'Manager Specification (Delhi)',
      postStartDate: '2026-05-29T16:58:16Z',
      applicationDueDate: '2026-08-31T20:29:59Z',
      created: '2022-09-29T05:38:35Z',
      applicationUrl: 'https://career2.successfactors.eu/career?career_ns=job_application&company=assaabloya&career_job_req_id=15352&selected_lang=en_US',
      evergreen: false,
      officePresence: 'Hybrid',
      jobFunction: {
        category: 'Sales',
        name: 'Marketing & Product Management',
      },
      locations: [
        {
          region: 'Asia',
          country: 'India',
          state: 'Karnataka',
          city: 'Bangalore',
          address: '#36 / Floor 2-3-4, Patalamma Temple Street',
        },
        {
          region: 'Asia',
          country: 'India',
          state: 'Haryana',
          city: 'Gurgaon',
          address: 'Office No 1&2, Enco Working Space, 6Th Floor, Enkay Tower',
        },
      ],
      experienceLevel: {
        value: 5,
        name: 'Mid-senior level',
      },
    },
    {
      jobReqId: 45123,
      title: 'Project Coordinator',
      postStartDate: '2026-06-28T08:58:35Z',
      applicationDueDate: '2026-07-15T15:59:59Z',
      created: '2026-01-23T08:52:15Z',
      applicationUrl: 'https://career2.successfactors.eu/career?career_ns=job_application&company=assaabloya&career_job_req_id=45123&selected_lang=en_US',
      evergreen: false,
      officePresence: 'Hybrid',
      jobFunction: {
        category: 'Project/Program Management',
      },
      locations: [
        {
          region: 'Oceania',
          country: 'Australia',
          state: 'Queensland',
          city: 'Brisbane',
          address: 'Brisbane Airport',
        },
      ],
      experienceLevel: {
        value: 4,
        name: 'Associate',
      },
    },
  ],
}

test('extractSearchResults filters ASSA ABLOY openings to India jobs and maps shared scraper fields', () => {
  const jobs = extractSearchResults(samplePayload)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Senior Test Engineer',
    company: 'ASSA ABLOY',
    department: 'Telecom & Internet',
    location: 'Chennai, India',
    city: 'Chennai',
    country: 'India',
    jobId: '49038',
    requisitionId: '49038',
    sourceUrl: 'https://career2.successfactors.eu/career?career_ns=job_application&company=assaabloya&career_job_req_id=49038&selected_lang=en_US',
    applyUrl: 'https://career2.successfactors.eu/career?career_ns=job_application&company=assaabloya&career_job_req_id=49038&selected_lang=en_US',
    employmentType: 'Full-time',
    experienceRequired: 'Associate',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-29T07:58:08Z',
    closingDate: '2026-08-31T20:29:59Z',
    jobDescription: 'Category: IT. Function: Telecom & Internet. Office presence: Hybrid. Locations: Chennai, India.',
    publicExperienceChecked: true,
  })
  assert.deepEqual(jobs[1], {
    title: 'Manager Specification (Delhi)',
    company: 'ASSA ABLOY',
    department: 'Marketing & Product Management',
    location: 'Bangalore, Gurgaon, India',
    city: 'Bangalore',
    country: 'India',
    jobId: '15352',
    requisitionId: '15352',
    sourceUrl: 'https://career2.successfactors.eu/career?career_ns=job_application&company=assaabloya&career_job_req_id=15352&selected_lang=en_US',
    applyUrl: 'https://career2.successfactors.eu/career?career_ns=job_application&company=assaabloya&career_job_req_id=15352&selected_lang=en_US',
    employmentType: 'Full-time',
    experienceRequired: 'Mid-senior level',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-05-29T16:58:16Z',
    closingDate: '2026-08-31T20:29:59Z',
    jobDescription: 'Category: Sales. Function: Marketing & Product Management. Office presence: Hybrid. Locations: Bangalore, Gurgaon, India.',
    publicExperienceChecked: true,
  })
})

test('run fetches ASSA ABLOY jobs from the official job openings API and decorates runner fields', async () => {
  const requestedUrls = []
  const scraper = createAssaAbloyScraper()

  const jobs = await scraper.run({
    fetchJson: async (url) => {
      requestedUrls.push(url)
      return samplePayload
    },
  })

  assert.equal(buildSearchUrl(), JOBS_API_URL)
  assert.equal(CAREER_PAGE_URL, 'https://www.assaabloy.com/career/en/open-positions')
  assert.deepEqual(requestedUrls, [JOBS_API_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'assaabloy')
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, jobs[0].scrapedAt)
})

test('ASSA ABLOY fetches the complete inventory from the integration hub configured by its official careers component', async () => {
  const jobs = await createAssaAbloyScraper().run({
    fetchJson: async (url) => {
      if (url === 'https://integration-hub-prod-assets.globalweb.aws.assaabloy.com/job-openings/jobs.json') {
        return { version: '1.0', fetchedAt: '2026-10-08T19:01:32+02:00', ...samplePayload }
      }
      throw new Error(`HTTP 404 for ${url}`)
    },
  })

  assert.deepEqual(jobs.map(job => job.jobId), ['49038', '15352'])
  assert.deepEqual(jobs.map(job => job.country), ['India', 'India'])
})

for (const { name, payload } of [
  { name: 'missing items', payload: { version: '1.0', itemsTotalCount: 0 } },
  { name: 'missing advertised total', payload: { version: '1.0', items: [] } },
  { name: 'truncated items', payload: { version: '1.0', itemsTotalCount: 3, items: samplePayload.items.slice(0, 2) } },
]) {
  test(`ASSA ABLOY rejects ${name} before applying maxJobs`, async () => {
    await assert.rejects(createAssaAbloyScraper({ maxJobs: 1 }).run({
      fetchJson: async () => payload,
    }), /ASSA ABLOY job inventory is malformed or incomplete/)
  })
}

test('ASSA ABLOY preserves a verified empty inventory when the advertised total is zero', () => {
  assert.deepEqual(extractSearchResults({ version: '1.0', itemsTotalCount: 0, items: [] }), [])
})
