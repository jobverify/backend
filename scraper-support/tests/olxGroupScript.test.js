import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs - Careers OLX Group</title>
  </head>
  <body>
    <main>
      <h1>Shape Your Future at OLX</h1>
      <p>Reminder: Beware of recruitment scams</p>
      <label>Search open roles</label>
      <h2>Showing all open roles</h2>
      <a href="https://jobs.eu.lever.co/olx/2c31fc64-dce6-41cc-93cb-1dc97100157b">AI Operations Specialist</a>
      <a href="https://jobs.eu.lever.co/olx/1a1fa38d-6ed5-4121-a47c-b3e800422929">Customer Support Agent</a>
      <a href="https://jobs.eu.lever.co/olx/1cd7d6a9-6d24-43a6-9227-fc6750e70ece">Treasury Manager/Senior Manager</a>
    </main>
  </body>
</html>
`

const LEVER_BOARD_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>OLX</h1>
    <section>location type</section>
    <section>location</section>
    <section>team</section>
    <section>work type</section>
    <a href="https://jobs.eu.lever.co/olx/2c31fc64-dce6-41cc-93cb-1dc97100157b">AI Operations Specialist</a>
    <a href="https://jobs.eu.lever.co/olx/1a1fa38d-6ed5-4121-a47c-b3e800422929">Customer Support Agent</a>
    <a href="https://jobs.eu.lever.co/olx/1cd7d6a9-6d24-43a6-9227-fc6750e70ece">Treasury Manager/Senior Manager</a>
    <p>Apply for a role at OLX.</p>
  </body>
</html>
`

const LEVER_PAYLOAD = [
  {
    id: 'bengaluru-data-engineer',
    text: 'Senior Data Engineer',
    hostedUrl: 'https://jobs.eu.lever.co/olx/bengaluru-data-engineer',
    applyUrl: 'https://jobs.eu.lever.co/olx/bengaluru-data-engineer/apply',
    createdAt: 1_783_827_200_000,
    categories: {
      location: 'Bengaluru, India',
      team: 'Engineering',
      commitment: 'Full-time',
      allLocations: ['Bengaluru, India'],
    },
    workplaceType: 'remote',
    descriptionPlain: 'Build OLX data platforms from Bengaluru.',
  },
  {
    id: 'bucharest-ai-ops',
    text: 'AI Operations Specialist',
    hostedUrl: 'https://jobs.eu.lever.co/olx/bucharest-ai-ops',
    applyUrl: 'https://jobs.eu.lever.co/olx/bucharest-ai-ops/apply',
    createdAt: 1_783_420_800_000,
    categories: {
      location: 'Bucharest, Romania',
      team: 'Engineering',
      commitment: 'Full-time',
      allLocations: ['Bucharest, Romania'],
    },
    workplaceType: 'hybrid',
    descriptionPlain: 'Support OLX AI operations from Bucharest.',
  },
]

const LIVE_BOARD_PAYLOAD_WITHOUT_INDIA = [
  {
    id: 'bucharest-ai-ops',
    text: 'AI Operations Specialist',
    hostedUrl: 'https://jobs.eu.lever.co/olx/bucharest-ai-ops',
    applyUrl: 'https://jobs.eu.lever.co/olx/bucharest-ai-ops/apply',
    createdAt: 1_783_420_800_000,
    categories: {
      location: 'Bucharest, Romania',
      team: 'Engineering',
      commitment: 'Full-time',
      allLocations: ['Bucharest, Romania'],
    },
    workplaceType: 'hybrid',
    descriptionPlain: 'Support OLX AI operations from Bucharest.',
  },
  {
    id: 'warsaw-ai-ops',
    text: 'AI Operations Specialist',
    hostedUrl: 'https://jobs.eu.lever.co/olx/warsaw-ai-ops',
    applyUrl: 'https://jobs.eu.lever.co/olx/warsaw-ai-ops/apply',
    createdAt: 1_783_507_200_000,
    categories: {
      location: 'Warsaw, Poland',
      team: 'Engineering',
      commitment: 'Full-time',
      allLocations: ['Warsaw, Poland'],
    },
    workplaceType: 'hybrid',
    descriptionPlain: 'Support OLX AI operations from Warsaw.',
  },
]

const loadModule = async () => {
  try {
    return await import('../../scraper/olxgroup/script.js')
  } catch {
    assert.fail('Expected OLX Group scraper module at ../../scraper/olxgroup/script.js')
  }
}

test('OLX Group pins the verified official careers page and public Lever endpoints', async () => {
  const olxGroup = await loadModule()

  assert.equal(olxGroup.CAREERS_PAGE_URL, 'https://careers.olxgroup.com/jobs/')
  assert.equal(olxGroup.LEVER_BOARD_URL, 'https://jobs.eu.lever.co/olx')
  assert.equal(olxGroup.LEVER_API_URL, 'https://api.eu.lever.co/v0/postings/olx?mode=json')
  assert.equal(olxGroup.hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.equal(
    olxGroup.extractVerifiedLeverBoardUrl(CAREERS_HTML),
    'https://jobs.eu.lever.co/olx',
  )
  assert.equal(olxGroup.hasOfficialLeverBoardSignal(LEVER_BOARD_HTML), true)
})

test('OLX Group extracts only India jobs from the verified Lever payload shape', async () => {
  const olxGroup = await loadModule()
  const jobs = olxGroup.extractLeverJobs(LEVER_PAYLOAD)

  assert.deepEqual(jobs, [
    {
      title: 'Senior Data Engineer',
      company: 'OLX Group',
      department: 'Engineering',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: 'bengaluru-data-engineer',
      requisitionId: 'bengaluru-data-engineer',
      sourceUrl: 'https://jobs.eu.lever.co/olx/bengaluru-data-engineer',
      applyUrl: 'https://jobs.eu.lever.co/olx/bengaluru-data-engineer/apply',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-12T03:33:20.000Z',
      closingDate: null,
      jobDescription: 'Build OLX data platforms from Bengaluru.',
      remoteStatus: 'Remote',
    },
  ])
})

test('OLX Group run validates the official careers handoff and returns an honest zero-job result while the current India slice is empty', async () => {
  const olxGroup = await loadModule()
  const requestedPages = []
  const requestedJson = []

  const jobs = await olxGroup.createOlxGroupScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === olxGroup.CAREERS_PAGE_URL) {
        return { status: 200, url, html: CAREERS_HTML }
      }

      if (url === olxGroup.LEVER_BOARD_URL) {
        return { status: 200, url, html: LEVER_BOARD_HTML }
      }

      throw new Error(`Unexpected OLX Group page URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)

      if (url === olxGroup.LEVER_API_URL) {
        return LIVE_BOARD_PAYLOAD_WITHOUT_INDIA
      }

      throw new Error(`Unexpected OLX Group json URL: ${url}`)
    },
  })

  assert.deepEqual(requestedPages, [
    olxGroup.CAREERS_PAGE_URL,
    olxGroup.LEVER_BOARD_URL,
  ])
  assert.deepEqual(requestedJson, [olxGroup.LEVER_API_URL])
  assert.deepEqual(jobs, [])
})

test('OLX Group fails closed when the verified careers page, Lever board, or Lever payload drifts', async () => {
  const olxGroup = await loadModule()

  await assert.rejects(
    olxGroup.createOlxGroupScraper().run({
      fetchPage: async (url) => {
        if (url === olxGroup.CAREERS_PAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        throw new Error(`Unexpected OLX Group page URL: ${url}`)
      },
      fetchJson: async () => LIVE_BOARD_PAYLOAD_WITHOUT_INDIA,
    }),
    /verified official careers page/i,
  )

  await assert.rejects(
    olxGroup.createOlxGroupScraper().run({
      fetchPage: async (url) => {
        if (url === olxGroup.CAREERS_PAGE_URL) {
          return { status: 200, url, html: CAREERS_HTML }
        }

        if (url === olxGroup.LEVER_BOARD_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        throw new Error(`Unexpected OLX Group page URL: ${url}`)
      },
      fetchJson: async () => LIVE_BOARD_PAYLOAD_WITHOUT_INDIA,
    }),
    /verified public lever board/i,
  )

  await assert.rejects(
    olxGroup.createOlxGroupScraper().run({
      fetchPage: async (url) => {
        if (url === olxGroup.CAREERS_PAGE_URL) {
          return { status: 200, url, html: CAREERS_HTML }
        }

        if (url === olxGroup.LEVER_BOARD_URL) {
          return { status: 200, url, html: LEVER_BOARD_HTML }
        }

        throw new Error(`Unexpected OLX Group page URL: ${url}`)
      },
      fetchJson: async () => ({ postings: [] }),
    }),
    /verified lever payload/i,
  )
})
