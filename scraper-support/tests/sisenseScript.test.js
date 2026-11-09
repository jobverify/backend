import assert from 'node:assert/strict'
import test from 'node:test'

const samplePayload = {
  jobs: [
    {
      isListed: true,
      jobUrl: 'https://jobs.ashbyhq.com/sisense/9000001',
      applyUrl: 'https://jobs.ashbyhq.com/sisense/9000001/application',
      id: '9000001',
      title: 'Senior Software Engineer',
      publishedAt: '2026-09-10T10:34:52.000Z',
      descriptionHtml: '<p>Build analytics features for India.</p>',
      location: 'Bengaluru, Karnataka, India',
      address: {
        postalAddress: {
          addressLocality: 'Bengaluru',
          addressRegion: 'Karnataka',
          addressCountry: 'India',
        },
      },
      department: 'Product Engineering',
      employmentType: 'FullTime',
    },
    {
      isListed: true,
      jobUrl: 'https://jobs.ashbyhq.com/sisense/9000002',
      applyUrl: 'https://jobs.ashbyhq.com/sisense/9000002/application',
      id: '9000002',
      title: 'Head of Sales',
      publishedAt: '2026-09-10T10:34:52.000Z',
      descriptionHtml: '<p>Lead sales in New York.</p>',
      location: 'New York, NY, United States',
      address: {
        postalAddress: {
          addressLocality: 'New York',
          addressRegion: 'NY',
          addressCountry: 'United States',
        },
      },
      department: 'Sales',
      employmentType: 'FullTime',
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/sisense/script.js')
  } catch {
    assert.fail('Expected Sisense scraper module at ../../scraper/sisense/script.js')
  }
}

test('Sisense scraper extracts only India jobs from the current Ashby board', async () => {
  const sisense = await loadModule()

  assert.equal(sisense.SOURCE, 'sisense')
  assert.equal(sisense.COMPANY, 'Sisense')
  assert.equal(sisense.CAREERS_URL, 'https://www.sisense.com/about/careers/')
  assert.equal(
    sisense.ASHBY_PUBLIC_BOARD_URL,
    'https://jobs.ashbyhq.com/sisense',
  )
  assert.equal(
    sisense.ASHBY_JOB_BOARD_URL,
    'https://api.ashbyhq.com/posting-api/job-board/sisense',
  )
  assert.deepEqual(sisense.extractJobsFromAshbyPayload(samplePayload), [
    {
      title: 'Senior Software Engineer',
      company: 'Sisense',
      department: 'Product Engineering',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      jobId: '9000001',
      requisitionId: '9000001',
      sourceUrl: 'https://jobs.ashbyhq.com/sisense/9000001',
      applyUrl: 'https://jobs.ashbyhq.com/sisense/9000001/application',
      employmentType: 'Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-09-10T10:34:52.000Z',
      closingDate: null,
      jobDescription: 'Build analytics features for India.',
    },
  ])
})

test('Sisense run returns decorated India jobs from the official Ashby API and allows empty current boards', async () => {
  const sisense = await loadModule()
  const requestedUrls = []

  const jobs = await sisense.createSisenseScraper().run({
    fetchJson: async (url) => {
      requestedUrls.push(url)
      return samplePayload
    },
    now: () => '2026-07-25T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [sisense.ASHBY_JOB_BOARD_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'sisense')
  assert.equal(jobs[0].link, 'https://jobs.ashbyhq.com/sisense/9000001/application')
  assert.equal(jobs[0].scrapedAt, '2026-07-25T00:00:00.000Z')

  const emptyJobs = await sisense.createSisenseScraper().run({
    fetchJson: async () => ({ jobs: [samplePayload.jobs[1]] }),
    now: () => '2026-07-25T00:00:00.000Z',
  })

  assert.deepEqual(emptyJobs, [])
})
