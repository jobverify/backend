import assert from 'node:assert/strict'
import test from 'node:test'

const loadHevoDataModule = async () => {
  try {
    return await import('../../scraper/hevodata/script.js')
  } catch {
    assert.fail('Expected Hevo Data scraper module at ../../scraper/hevodata/script.js')
  }
}

const leverJobs = [
  {
    id: 'cfdb183c-e9f4-4877-8b8c-bd7a3b4a7fde',
    text: 'Account Executive',
    hostedUrl: 'https://jobs.lever.co/hevodata/cfdb183c-e9f4-4877-8b8c-bd7a3b4a7fde',
    applyUrl: 'https://jobs.lever.co/hevodata/cfdb183c-e9f4-4877-8b8c-bd7a3b4a7fde/apply',
    createdAt: 1_781_107_135_316,
    categories: {
      location: 'Bangalore, India',
      team: 'Account Executive  - Mid Market',
      commitment: 'Full time',
      allLocations: ['Bangalore, India'],
    },
    workplaceType: 'onsite',
    descriptionPlain: 'About Hevo Data Build the next phase of growth.',
  },
  {
    id: 'a7f26742-f965-4a59-840d-f7afa0a28176',
    text: 'AI Solution Engineer',
    hostedUrl: 'https://jobs.lever.co/hevodata/a7f26742-f965-4a59-840d-f7afa0a28176',
    applyUrl: 'https://jobs.lever.co/hevodata/a7f26742-f965-4a59-840d-f7afa0a28176/apply',
    createdAt: 1_757_064_386_743,
    categories: {
      location: 'Bangalore, India',
      team: 'Strategy All',
      commitment: 'Full time',
      allLocations: ['Bangalore, India'],
    },
    workplaceType: 'onsite',
    descriptionPlain: 'Prototype and deliver internal AI applications.',
  },
  {
    id: 'us-role',
    text: 'VP Product Marketing',
    hostedUrl: 'https://jobs.lever.co/hevodata/us-role',
    applyUrl: 'https://jobs.lever.co/hevodata/us-role/apply',
    createdAt: 1_705_814_355_152,
    categories: {
      location: 'United States',
      team: 'Product Marketing',
      commitment: 'Full time',
      allLocations: ['United States'],
    },
    workplaceType: 'remote',
    descriptionPlain: 'Ignore this US role.',
  },
]

test('Hevo Data constants stay pinned to the official Lever board', async () => {
  const hevoData = await loadHevoDataModule()

  assert.equal(hevoData.CAREER_PAGE_URL, 'https://jobs.lever.co/hevodata/')
  assert.equal(hevoData.LEVER_ENDPOINT, 'https://api.lever.co/v0/postings/hevodata?mode=json')
})

test('extractLeverJobs keeps only India roles from the Hevo Lever feed', async () => {
  const hevoData = await loadHevoDataModule()
  const jobs = hevoData.extractLeverJobs(leverJobs)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Account Executive',
    company: 'Hevo Data',
    department: 'Account Executive - Mid Market',
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    jobId: 'cfdb183c-e9f4-4877-8b8c-bd7a3b4a7fde',
    requisitionId: 'cfdb183c-e9f4-4877-8b8c-bd7a3b4a7fde',
    sourceUrl: 'https://jobs.lever.co/hevodata/cfdb183c-e9f4-4877-8b8c-bd7a3b4a7fde',
    applyUrl: 'https://jobs.lever.co/hevodata/cfdb183c-e9f4-4877-8b8c-bd7a3b4a7fde/apply',
    employmentType: 'Full time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-10T15:58:55.316Z',
    closingDate: null,
    jobDescription: 'About Hevo Data Build the next phase of growth.',
    remoteStatus: 'On-site',
  })
})

test('extractLeverJobs derives experience from official Lever requirement lists when descriptionPlain is incomplete', async () => {
  const hevoData = await loadHevoDataModule()
  const jobs = hevoData.extractLeverJobs([
    {
      ...leverJobs[0],
      descriptionPlain: 'About Hevo Data Build the next phase of growth.',
      descriptionBodyPlain: 'About Hevo Data Build the next phase of growth.',
      lists: [
        {
          text: 'What We Are Looking For',
          content: '<li>4 - 7 years of B2B sales experience, with meaningful time in a quota-carrying, net-new business role.</li>',
        },
      ],
    },
  ])

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].experienceRequired, '4-7 years')
})

test('run fetches the official Hevo Lever feed and decorates shared runner fields', async () => {
  const hevoData = await loadHevoDataModule()
  const requests = []

  const jobs = await hevoData.createHevoDataScraper().run({
    fetchJson: async (url) => {
      requests.push(url)
      return leverJobs
    },
    now: () => '2026-07-09T00:00:00.000Z',
  })

  assert.deepEqual(requests, [hevoData.LEVER_ENDPOINT])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'hevodata')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-09T00:00:00.000Z')
})
