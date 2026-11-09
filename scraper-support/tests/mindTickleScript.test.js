import assert from 'node:assert/strict'
import test from 'node:test'

const createdAt = Date.parse('2026-07-15T12:00:00.000Z')

const aboutPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Mindtickle</title>
  </head>
  <body>
    <main>
      <h2>Our people matter most</h2>
      <p>If you're looking to make a dramatic impact on your career, we invite you to explore our job openings around the globe.</p>
      <a href="https://jobs.lever.co/mindtickle">View open opportunities</a>
      <a href="https://jobs.lever.co/mindtickle">Join the team</a>
    </main>
  </body>
</html>
`

const leverPayload = [
  {
    id: '166a3fea-6a19-48da-9a7d-bbff7d3c2f95',
    text: 'Customer Success Engineer - II',
    hostedUrl: 'https://jobs.lever.co/mindtickle/166a3fea-6a19-48da-9a7d-bbff7d3c2f95',
    applyUrl: 'https://jobs.lever.co/mindtickle/166a3fea-6a19-48da-9a7d-bbff7d3c2f95/apply',
    country: 'IN',
    workplaceType: 'hybrid',
    createdAt,
    descriptionPlain: 'Deliver product and integration expertise for revenue enablement customers.',
    openingPlain: 'Work closely with customer success and product teams.',
    additionalPlain: 'B2B SaaS experience preferred.',
    categories: {
      commitment: 'Full-Time',
      department: 'Customer Success & Pro Serv',
      location: 'Pune, Maharashtra',
    },
  },
  {
    id: 'non-india-role',
    text: 'Account Executive',
    hostedUrl: 'https://jobs.lever.co/mindtickle/non-india-role',
    applyUrl: 'https://jobs.lever.co/mindtickle/non-india-role/apply',
    country: 'US',
    workplaceType: 'remote',
    createdAt,
    descriptionPlain: 'United States only role.',
    categories: {
      commitment: 'Full-Time',
      department: 'Sales',
      location: 'Remote, US',
    },
  },
]

const nonIndiaPayload = [
  {
    id: 'remote-us-role',
    text: 'Commercial Account Executive',
    hostedUrl: 'https://jobs.lever.co/mindtickle/remote-us-role',
    applyUrl: 'https://jobs.lever.co/mindtickle/remote-us-role/apply',
    country: 'US',
    workplaceType: 'remote',
    createdAt,
    descriptionPlain: 'United States only role.',
    categories: {
      commitment: 'Full-Time',
      department: 'Sales',
      location: 'Remote, US',
    },
  },
]

const loadMindTickleModule = async () => {
  try {
    return await import('../../scraper/mindtickle/script.js')
  } catch {
    assert.fail('Expected MindTickle scraper module at ../../scraper/mindtickle/script.js')
  }
}

test('MindTickle helpers stay pinned to the verified first-party about page and Lever payload contract', async () => {
  const mindTickle = await loadMindTickleModule()

  assert.equal(mindTickle.SOURCE, 'mindtickle')
  assert.equal(mindTickle.COMPANY, 'MindTickle')
  assert.equal(mindTickle.ABOUT_URL, 'https://www.mindtickle.com/about-us/')
  assert.equal(mindTickle.LEVER_BOARD_URL, 'https://jobs.lever.co/mindtickle')
  assert.equal(mindTickle.LEVER_API_URL, 'https://api.lever.co/v0/postings/mindtickle?mode=json')
  assert.equal(mindTickle.hasVerifiedAboutPageSignal(aboutPageHtml), true)
  assert.equal(
    mindTickle.normalizeLeverUrl('https://jobs.lever.co/mindtickle/166a3fea-6a19-48da-9a7d-bbff7d3c2f95'),
    'https://jobs.lever.co/mindtickle/166a3fea-6a19-48da-9a7d-bbff7d3c2f95',
  )

  const jobs = mindTickle.extractIndiaJobsFromLeverPayload(leverPayload, {
    scrapedAt: '2026-07-16T00:00:00.000Z',
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Customer Success Engineer - II',
    company: 'MindTickle',
    location: 'Pune, Maharashtra',
    city: 'Pune',
    country: 'India',
    link: 'https://jobs.lever.co/mindtickle/166a3fea-6a19-48da-9a7d-bbff7d3c2f95',
    applyUrl: 'https://jobs.lever.co/mindtickle/166a3fea-6a19-48da-9a7d-bbff7d3c2f95/apply',
    sourceUrl: 'https://jobs.lever.co/mindtickle/166a3fea-6a19-48da-9a7d-bbff7d3c2f95',
    source: 'mindtickle',
    jobId: '166a3fea-6a19-48da-9a7d-bbff7d3c2f95',
    requisitionId: '166a3fea-6a19-48da-9a7d-bbff7d3c2f95',
    department: 'Customer Success & Pro Serv',
    employmentType: 'Full-Time',
    experienceRequired: null,
    jobDescription:
      'Deliver product and integration expertise for revenue enablement customers.\n\nWork closely with customer success and product teams.\n\nB2B SaaS experience preferred.',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: new Date(createdAt).toISOString(),
    remoteStatus: 'Hybrid',
    scrapedAt: '2026-07-16T00:00:00.000Z',
  })
})

test('MindTickle run validates the first-party about page before fetching the public Lever API', async () => {
  const mindTickle = await loadMindTickleModule()
  const requested = []

  const jobs = await mindTickle.createMindTickleScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requested.push({ type: 'text', url })
      return aboutPageHtml
    },
    fetchJson: async (url, options = {}) => {
      requested.push({ type: 'json', url, options })
      return leverPayload
    },
    now: () => '2026-07-16T00:00:00.000Z',
  })

  assert.deepEqual(requested, [
    { type: 'text', url: mindTickle.ABOUT_URL },
    {
      type: 'json',
      url: mindTickle.LEVER_API_URL,
      options: { method: 'GET' },
    },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Customer Success Engineer - II')
  assert.equal(jobs[0].country, 'India')
})

test('MindTickle returns no jobs when the verified public Lever board has no India roles', async () => {
  const mindTickle = await loadMindTickleModule()

  const jobs = await mindTickle.createMindTickleScraper().run({
    fetchText: async () => aboutPageHtml,
    fetchJson: async () => nonIndiaPayload,
  })

  assert.deepEqual(jobs, [])
})

test('MindTickle fails closed when the about page drifts or the Lever payload stops matching Mindtickle', async () => {
  const mindTickle = await loadMindTickleModule()

  await assert.rejects(
    mindTickle.createMindTickleScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
      fetchJson: async () => leverPayload,
    }),
    /verified first-party about page/i,
  )

  await assert.rejects(
    mindTickle.createMindTickleScraper().run({
      fetchText: async () => aboutPageHtml,
      fetchJson: async () => [
        {
          ...leverPayload[0],
          hostedUrl: 'https://example.com/not-lever',
        },
      ],
    }),
    /trusted lever job url/i,
  )
})
