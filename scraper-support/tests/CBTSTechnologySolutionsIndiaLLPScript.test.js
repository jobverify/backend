import assert from 'node:assert/strict'
import test from 'node:test'

const verifiedCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at CBTS | Build Your Future in Technology</title>
  </head>
  <body>
    <h1>Build the technology foundations that North America depends on.</h1>
    <h2>Explore opportunities across CBTS</h2>
    <a href="https://ats.rippling.com/cbtsindia/jobs">CBTS India</a>
  </body>
</html>
`

const currentCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at CBTS | Build Your Future in Technology</title>
  </head>
  <body>
    <h1>Build the technology foundations that North America depends on.</h1>
    <h2>Explore opportunities across CBTS</h2>
    <a href="https://jobs.cbts.com/careers?&amp;location=India">CBTS India</a>
    <span>View open positions</span>
  </body>
</html>
`

const buildBoardHtml = ({ page, totalPages, items }) => `
<!doctype html>
<html lang="en">
  <head><title>CBTS India</title></head>
  <body>
    <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          apiData: {
            jobBoard: {
              slug: 'cbtsindia',
              companyName: 'CBTS',
              title: 'CBTS India',
              boardURL: 'https://ats.rippling.com/cbtsindia/jobs',
            },
          },
          dehydratedState: {
            queries: [
              {
                queryKey: ['board', 'cbtsindia', 'job-posts', false, { country: 'IN', page }],
                state: {
                  data: {
                    items,
                    page,
                    pageSize: 20,
                    totalItems: 3,
                    totalPages,
                  },
                },
              },
            ],
          },
        },
      },
    })}</script>
  </body>
</html>
`

const pageOneItems = [
  {
    id: '638bb5ec-4d54-46e8-b0f9-cd7892635fd6',
    name: 'Sr. Engineer Security',
    url: 'https://ats.rippling.com/cbtsindia/jobs/638bb5ec-4d54-46e8-b0f9-cd7892635fd6',
    department: { name: 'Cloud Engineering-832000' },
    locations: [
      {
        name: 'Chennai, India',
        country: 'India',
        countryCode: 'IN',
        state: 'Tamil Nadu',
        city: 'Chennai',
        workplaceType: 'ON_SITE',
      },
    ],
  },
  {
    id: '53634252-e7f3-4d46-a588-5fa84d79e331',
    name: 'Sr. Project Manager',
    url: 'https://ats.rippling.com/cbtsindia/jobs/53634252-e7f3-4d46-a588-5fa84d79e331',
    department: { name: 'Information Technology-615000' },
    locations: [
      {
        name: 'Chennai, India',
        country: 'India',
        countryCode: 'IN',
        state: 'Tamil Nadu',
        city: 'Chennai',
        workplaceType: 'ON_SITE',
      },
    ],
  },
]

const pageTwoItems = [
  {
    id: '26ec9805-cd51-42c1-97a2-8563af5b7d05',
    name: 'Sr. Engineer – Network Engineering',
    url: 'https://ats.rippling.com/cbtsindia/jobs/26ec9805-cd51-42c1-97a2-8563af5b7d05',
    department: { name: 'Technology Infrastructure & Cloud Operations' },
    locations: [
      {
        name: 'Chennai, India',
        country: 'India',
        countryCode: 'IN',
        state: 'Tamil Nadu',
        city: 'Chennai',
        workplaceType: 'ON_SITE',
      },
    ],
  },
]

const loadModule = async () => {
  try {
    return await import('../../scraper/cbtstechnologysolutionsindiallp/script.js')
  } catch {
    assert.fail('Expected CBTS Technology Solutions India LLP scraper module at ../../scraper/cbtstechnologysolutionsindiallp/script.js')
  }
}

test('CBTS Technology Solutions India LLP validates the first-party careers page and extracts India jobs from the linked Rippling board pages', async () => {
  const cbts = await loadModule()

  assert.equal(cbts.SOURCE, 'cbtstechnologysolutionsindiallp')
  assert.equal(cbts.COMPANY, 'CBTS TECHNOLOGY SOLUTIONS INDIA LLP')
  assert.equal(cbts.CAREERS_URL, 'https://www.cbts.com/careers')
  assert.equal(cbts.RIPPLING_BOARD_URL, 'https://ats.rippling.com/cbtsindia/jobs')
  assert.equal(cbts.RIPPLING_BOARD_SLUG, 'cbtsindia')
  assert.equal(cbts.hasVerifiedCareersPageSignal(verifiedCareersHtml), true)
  assert.equal(cbts.hasVerifiedCareersPageSignal(currentCareersHtml), true)
  assert.equal(
    cbts.buildBoardPageUrl(2),
    'https://ats.rippling.com/cbtsindia/jobs?city=&country=IN&page=2&searchQuery=&state=&weekdayJdUid=789935&workplaceType=',
  )

  const jobs = cbts.extractIndiaJobsFromBoardHtml(
    buildBoardHtml({ page: 1, totalPages: 2, items: pageOneItems }),
    { scrapedAt: '2026-07-18T00:00:00.000Z' },
  )

  assert.deepEqual(jobs, [
    {
      title: 'Sr. Engineer Security',
      company: 'CBTS TECHNOLOGY SOLUTIONS INDIA LLP',
      department: 'Cloud Engineering-832000',
      location: 'Chennai, India',
      city: 'Chennai',
      country: 'India',
      workplaceType: 'ON_SITE',
      jobId: '638bb5ec-4d54-46e8-b0f9-cd7892635fd6',
      requisitionId: '638bb5ec-4d54-46e8-b0f9-cd7892635fd6',
      sourceUrl: 'https://ats.rippling.com/cbtsindia/jobs/638bb5ec-4d54-46e8-b0f9-cd7892635fd6',
      applyUrl: 'https://ats.rippling.com/cbtsindia/jobs/638bb5ec-4d54-46e8-b0f9-cd7892635fd6',
      link: 'https://ats.rippling.com/cbtsindia/jobs/638bb5ec-4d54-46e8-b0f9-cd7892635fd6',
      source: 'cbtstechnologysolutionsindiallp',
      scrapedAt: '2026-07-18T00:00:00.000Z',
    },
    {
      title: 'Sr. Project Manager',
      company: 'CBTS TECHNOLOGY SOLUTIONS INDIA LLP',
      department: 'Information Technology-615000',
      location: 'Chennai, India',
      city: 'Chennai',
      country: 'India',
      workplaceType: 'ON_SITE',
      jobId: '53634252-e7f3-4d46-a588-5fa84d79e331',
      requisitionId: '53634252-e7f3-4d46-a588-5fa84d79e331',
      sourceUrl: 'https://ats.rippling.com/cbtsindia/jobs/53634252-e7f3-4d46-a588-5fa84d79e331',
      applyUrl: 'https://ats.rippling.com/cbtsindia/jobs/53634252-e7f3-4d46-a588-5fa84d79e331',
      link: 'https://ats.rippling.com/cbtsindia/jobs/53634252-e7f3-4d46-a588-5fa84d79e331',
      source: 'cbtstechnologysolutionsindiallp',
      scrapedAt: '2026-07-18T00:00:00.000Z',
    },
  ])
})

test('CBTS Technology Solutions India LLP paginates the linked Rippling board and fails closed on contract drift', async () => {
  const cbts = await loadModule()
  const requestedUrls = []

  const jobs = await cbts.createCbtstechnologysolutionsindiallpScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === cbts.CAREERS_URL) return verifiedCareersHtml
      if (url === cbts.buildBoardPageUrl(1)) {
        return buildBoardHtml({ page: 1, totalPages: 2, items: pageOneItems })
      }
      if (url === cbts.buildBoardPageUrl(2)) {
        return buildBoardHtml({ page: 2, totalPages: 2, items: pageTwoItems })
      }
      throw new Error(`Unexpected CBTS fixture URL: ${url}`)
    },
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    cbts.CAREERS_URL,
    cbts.buildBoardPageUrl(1),
    cbts.buildBoardPageUrl(2),
  ])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[2].title, 'Sr. Engineer – Network Engineering')

  await assert.rejects(
    cbts.createCbtstechnologysolutionsindiallpScraper().run({
      fetchText: async (url) => {
        if (url === cbts.CAREERS_URL) return verifiedCareersHtml.replace('https://ats.rippling.com/cbtsindia/jobs', 'https://ats.rippling.com/other/jobs')
        throw new Error(`Unexpected CBTS fixture URL: ${url}`)
      },
    }),
    /verified careers page/i,
  )

  await assert.rejects(
    cbts.createCbtstechnologysolutionsindiallpScraper().run({
      fetchText: async (url) => {
        if (url === cbts.CAREERS_URL) return verifiedCareersHtml
        if (url === cbts.buildBoardPageUrl(1)) {
          return buildBoardHtml({ page: 1, totalPages: 1, items: [] }).replace('"slug":"cbtsindia"', '"slug":"other"')
        }
        throw new Error(`Unexpected CBTS fixture URL: ${url}`)
      },
    }),
    /verified rippling board/i,
  )
})


const currentEightfoldBoardHtml = '<title>Careers at CBTS</title><script>window._EF_GROUP_ID = "cbts.com";</script>'

test('CBTS follows its current Eightfold India handoff, paginates, and excludes non-India positions', async () => {
  const cbts = await loadModule()
  const offsets = []
  const jobs = await cbts.createCbtstechnologysolutionsindiallpScraper().run({
    now: () => '2026-10-03T00:00:00.000Z',
    fetchText: async (url) => {
      if (url === cbts.CAREERS_URL) return currentCareersHtml
      assert.equal(url, 'https://jobs.cbts.com/careers?&location=India')
      return currentEightfoldBoardHtml
    },
    fetchJson: async (value) => {
      const url = new URL(value)
      assert.equal(url.origin, 'https://jobs.cbts.com')
      assert.equal(url.searchParams.get('domain'), 'cbts.com')
      if (url.pathname === '/api/pcsx/search') {
        const offset = Number(url.searchParams.get('start'))
        offsets.push(offset)
        assert.equal(url.searchParams.get('location'), 'India')
        assert.equal(url.searchParams.get('limit'), '10')
        const ids = offset === 0 ? [1,2,3,4,5,6,7,8,9,10] : [11,12]
        return {data: {count: 12, positions: ids.map(id => ({id, name: 'Engineer ' + id, standardizedLocations: [id === 11 ? 'Cincinnati, OH, US' : id === 1 ? 'IN' : 'Chennai, TN, IN'], locations: [id === 11 ? 'Cincinnati' : 'Chennai'], positionUrl: '/careers/job/' + id}))}}
      }
      assert.equal(url.pathname, '/api/pcsx/position_details')
      const id = Number(url.searchParams.get('position_id'))
      return {data: {publicUrl: 'https://jobs.cbts.com/careers/job/' + id, jobDescription: '<p>Build reliable services.</p>'}}
    },
  })
  assert.deepEqual(offsets, [0,10])
  assert.equal(jobs.length, 11)
  assert.equal(jobs.some(job => job.title === 'Engineer 11'), false)
  assert.equal(jobs[0].applyUrl, 'https://jobs.cbts.com/careers/job/1')
  assert.equal(jobs[0].source, 'cbtstechnologysolutionsindiallp')
  assert.equal(jobs[0].scrapedAt, '2026-10-03T00:00:00.000Z')
  assert.match(jobs[0].jobDescription, /Build reliable services/)
})

test('CBTS rejects the current jobs handoff when its board identity is unverified', async () => {
  const cbts = await loadModule()
  await assert.rejects(cbts.createCbtstechnologysolutionsindiallpScraper().run({
    fetchText: async url => url === cbts.CAREERS_URL ? currentCareersHtml : '<title>Careers at Another Company</title>',
    fetchJson: async () => assert.fail('Unverified board must not query listings'),
  }), /CBTS verified Eightfold board/i)
})
