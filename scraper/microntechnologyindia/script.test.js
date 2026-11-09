import assert from 'node:assert/strict'
import test from 'node:test'

import {
  OFFICIAL_CAREERS_URL,
  SEARCH_PAGE_SIZE,
  buildListingApiUrl,
  createMicronTechnologyIndiaScraper,
  hasOfficialMicronIndiaCareersSignal,
} from './script.js'

const CAREERS_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>Careers | Micron India</title>
</head>
<body>
  <section>Micron India is growing in Hyderabad.</section>
  <a href="https://micron.eightfold.ai/careers?location=India&domain=micron.com">Search current jobs</a>
</body>
</html>`

// These generated positions and details are explicit synthetic controls. Their
// full identity must agree; no fields are added to retained native captures.
const buildDetailPayload = (position, { jobDescription = 'Requires 5+ years of experience building production silicon systems.' } = {}) => ({
  data: {
    ...structuredClone(position),
    publicUrl: `https://careers.micron.com/careers/job/${position.id}`,
    jobDescription,
  },
})

const withMockedMicronDetailFetch = async (positions, runTest) => {
  const originalFetch = globalThis.fetch

  globalThis.fetch = async (url) => {
    const detailUrl = String(url)
    if (!/\/api\/pcsx\/position_details\b/i.test(detailUrl)) {
      throw new Error(`Unexpected network fetch: ${detailUrl}`)
    }

    const positionId = new URL(detailUrl).searchParams.get('position_id')
    const position = positions.find(row => String(row.id) === positionId)
    assert.ok(position, `Unmodeled synthetic Micron detail: ${detailUrl}`)

    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => JSON.stringify(buildDetailPayload(position)),
    }
  }

  try {
    return await runTest()
  } finally {
    globalThis.fetch = originalFetch
  }
}

test('Micron Technology India builds the verified Eightfold listing URL', () => {
  assert.equal(
    buildListingApiUrl(),
    'https://careers.micron.com/api/pcsx/search?domain=micron.com&query=&location=India&start=0&limit=10',
  )
  assert.equal(SEARCH_PAGE_SIZE, 10)
})

test('Micron Technology India still verifies the first-party India careers handoff', () => {
  assert.equal(hasOfficialMicronIndiaCareersSignal(CAREERS_HTML), true)
})

test('Micron Technology India paginates through 10-job Eightfold result pages', async () => {
  const scraper = createMicronTechnologyIndiaScraper()
  const seenApiUrls = []

  const makePosition = (index) => ({
    id: 5000 + index,
    displayJobId: `JR${9000 + index}`,
    name: `Engineer ${index}`,
    locations: ['Hyderabad, Telangana, India'],
    positionUrl: `/careers/job/${5000 + index}`,
    department: 'Engineering',
    postedTs: `2026-08-${String((index % 28) + 1).padStart(2, '0')}T12:00:00Z`,
  })

  const listingResponses = new Map([
    ['0', {
      data: {
        count: 13,
        positions: Array.from({ length: 10 }, (_, index) => makePosition(index + 1)),
      },
    }],
    ['10', {
      data: {
        count: 13,
        positions: Array.from({ length: 3 }, (_, index) => makePosition(index + 11)),
      },
    }],
  ])
  const positions = [...listingResponses.values()].flatMap(payload => payload.data.positions)

  const jobs = await scraper.run({
    fetchText: async (url) => {
      assert.equal(url, OFFICIAL_CAREERS_URL)
      return CAREERS_HTML
    },
    fetchJson: async (url) => {
      const parsedUrl = new URL(url)
      seenApiUrls.push(url)

      if (/\/api\/pcsx\/position_details\b/i.test(parsedUrl.pathname)) {
        const position = positions.find(row => String(row.id) === parsedUrl.searchParams.get('position_id'))
        assert.ok(position)
        return buildDetailPayload(position)
      }

      const start = parsedUrl.searchParams.get('start')
      const limit = parsedUrl.searchParams.get('limit')

      assert.equal(limit, String(SEARCH_PAGE_SIZE))

      const payload = listingResponses.get(start)
      if (!payload) {
        throw new Error(`Unexpected listing page start=${start}`)
      }

      return payload
    },
  })

  assert.deepEqual(
    seenApiUrls.filter(url => new URL(url).pathname === '/api/pcsx/search'),
    [
      'https://careers.micron.com/api/pcsx/search?domain=micron.com&query=&location=India&start=0&limit=10',
      'https://careers.micron.com/api/pcsx/search?domain=micron.com&query=&location=India&start=10&limit=10',
    ],
  )
  assert.deepEqual(
    seenApiUrls.filter(url => new URL(url).pathname === '/api/pcsx/position_details')
      .map(url => Number(new URL(url).searchParams.get('position_id'))).sort((a, b) => a - b),
    positions.map(position => position.id),
  )
  assert.equal(jobs.length, 13)
  assert.ok(jobs.every(job => job.jobDescription === buildDetailPayload(positions[0]).data.jobDescription))
  assert.deepEqual(
    jobs.slice(0, 2).map((job) => ({
      title: job.title,
      location: job.location,
      sourceUrl: job.sourceUrl,
    })),
    [
      {
        title: 'Engineer 1',
        location: 'Hyderabad, Telangana, India',
        sourceUrl: 'https://careers.micron.com/careers/job/5001',
      },
      {
        title: 'Engineer 2',
        location: 'Hyderabad, Telangana, India',
        sourceUrl: 'https://careers.micron.com/careers/job/5002',
      },
    ],
  )
})

test('Micron Technology India bounds detail hydration while preserving pagination and honestly missing descriptions', { timeout: 8000 }, async () => {
  const scraper = createMicronTechnologyIndiaScraper()
  const seenApiUrls = []
  let activeDetails = 0, maximumActiveDetails = 0

  const makePosition = (index) => ({
    id: 9000 + index,
    displayJobId: `JR${9900 + index}`,
    name: `Memory Engineer ${index}`,
    locations: ['Hyderabad, Telangana, India'],
    positionUrl: `/careers/job/${9000 + index}`,
    department: 'Engineering',
    postedTs: `2026-09-${String(index).padStart(2, '0')}T12:00:00Z`,
  })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      assert.equal(url, OFFICIAL_CAREERS_URL)
      return CAREERS_HTML
    },
    fetchJson: async (url) => {
      seenApiUrls.push(url)
      const parsedUrl = new URL(url)
      if (parsedUrl.pathname === '/api/pcsx/position_details') {
        const index = Number(parsedUrl.searchParams.get('position_id')) - 9000
        assert.ok(index >= 1 && index <= 12)
        maximumActiveDetails = Math.max(maximumActiveDetails, ++activeDetails)
        try {
          // Modeled I/O spans a paced start slot so the test still measures
          // concurrent requests in flight instead of an instantaneous response.
          await new Promise(resolve => setTimeout(resolve, 400))
          return buildDetailPayload(makePosition(index), { jobDescription: null })
        } finally { activeDetails-- }
      }
      assert.equal(parsedUrl.pathname, '/api/pcsx/search')

      const start = parsedUrl.searchParams.get('start')
      if (start === '0') {
        return {
          data: {
            count: 12,
            positions: Array.from({ length: 10 }, (_, index) => makePosition(index + 1)),
          },
        }
      }

      if (start === '10') {
        return {
          data: {
            count: 12,
            positions: Array.from({ length: 2 }, (_, index) => makePosition(index + 11)),
          },
        }
      }

      throw new Error(`Unexpected listing page start=${start}`)
    },
  })

  assert.deepEqual(seenApiUrls.filter(url => new URL(url).pathname === '/api/pcsx/search'), [
    'https://careers.micron.com/api/pcsx/search?domain=micron.com&query=&location=India&start=0&limit=10',
    'https://careers.micron.com/api/pcsx/search?domain=micron.com&query=&location=India&start=10&limit=10',
  ])
  assert.deepEqual(
    seenApiUrls.filter(url => new URL(url).pathname === '/api/pcsx/position_details')
      .map(url => Number(new URL(url).searchParams.get('position_id'))).sort((a, b) => a - b),
    Array.from({ length: 12 }, (_, index) => 9001 + index),
  )
  assert.ok(maximumActiveDetails > 1 && maximumActiveDetails <= 6)
  assert.equal(jobs.length, 12)
  assert.equal(jobs[0].title, 'Memory Engineer 1')
  assert.equal(jobs[0].sourceUrl, 'https://careers.micron.com/careers/job/9001')
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(jobs[0].publicExperienceChecked, false)
})

test('Micron Technology India keeps successful jobs when its owned browser session reports Target closed while closing', async () => {
  const closeError = new Error('Protocol error (Runtime.callFunctionOn): Target closed')
  const position = {
    id: 6001, displayJobId: 'JR96001', name: 'Principal Engineer',
    locations: ['Hyderabad, Telangana, India'], positionUrl: '/careers/job/6001',
    department: 'Engineering', postedTs: '2026-08-04T10:00:00Z',
  }
  let closeAttempts = 0
  const scraper = createMicronTechnologyIndiaScraper({
    createBrowserFetchSessionImpl: async () => ({
      fetchText: async () => JSON.stringify({
        data: {
          count: 1,
          positions: [position],
        },
      }),
      close: async () => {
        closeAttempts++
        throw closeError
      },
    }),
  })

  const jobs = await withMockedMicronDetailFetch([position], async () => scraper.run({
    fetchText: async () => CAREERS_HTML,
  }))

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Principal Engineer')
  assert.equal(jobs[0].sourceUrl, 'https://careers.micron.com/careers/job/6001')
  assert.equal(closeAttempts, 1)
})

test('Micron Technology India uses the shared browser text fetch with the India landing page when live browser auth is required', async () => {
  const calls = []
  const position = {
    id: 7001, displayJobId: 'JR97001', name: 'STAFF ENG-HIG-HBM-LAYOUT',
    locations: ['Hyderabad, Telangana, India'], positionUrl: '/careers/job/7001',
    department: 'Engineering', postedTs: '2026-08-04T10:00:00Z',
  }
  const scraper = createMicronTechnologyIndiaScraper({
    createBrowserFetchSessionImpl: async () => ({
      fetchText: async (url, options) => {
        calls.push({ url, options })
        return JSON.stringify({
          data: {
            count: 1,
            positions: [position],
          },
        })
      },
      close: async () => {},
    }),
  })

  const jobs = await withMockedMicronDetailFetch([position], async () => scraper.run({
    fetchText: async () => CAREERS_HTML,
  }))

  assert.equal(jobs.length, 1)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://careers.micron.com/api/pcsx/search?domain=micron.com&query=&location=India&start=0&limit=10')
  assert.equal(calls[0].options.referer, 'https://careers.micron.com/careers?domain=micron.com&location=India')
  assert.ok(calls[0].options.signal instanceof AbortSignal)
})

test('Micron Technology India recreates its browser session after a transient aborted navigation', async () => {
  let sessionCreations = 0
  let sessionClosures = 0
  const position = {
    id: 8001, displayJobId: 'JR98001', name: 'Staff Engineer',
    locations: ['Hyderabad, Telangana, India'], positionUrl: '/careers/job/8001',
    department: 'Engineering', postedTs: '2026-08-04T10:00:00Z',
  }
  const scraper = createMicronTechnologyIndiaScraper({
    createBrowserFetchSessionImpl: async () => {
      sessionCreations += 1

      if (sessionCreations === 1) {
        return {
          fetchText: async () => {
            throw new Error('net::ERR_ABORTED at https://careers.micron.com/api/pcsx/search')
          },
          close: async () => { sessionClosures++ },
        }
      }

      return {
        fetchText: async () => JSON.stringify({
          data: {
            count: 1,
            positions: [position],
          },
        }),
        close: async () => { sessionClosures++ },
      }
    },
  })

  const jobs = await withMockedMicronDetailFetch([position], async () => scraper.run({
    fetchText: async () => CAREERS_HTML,
  }))

  assert.equal(sessionCreations, 2)
  assert.equal(sessionClosures, 2)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Staff Engineer')
  assert.equal(jobs[0].sourceUrl, 'https://careers.micron.com/careers/job/8001')
})
