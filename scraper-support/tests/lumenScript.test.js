import assert from 'node:assert/strict'
import test from 'node:test'

import { getScraperCatalog } from '../providers/index.js'

const loadLumenModule = async () => {
  try {
    return await import('../../scraper/lumen/script.js')
  } catch {
    assert.fail('Expected Lumen scraper module at ../../scraper/lumen/script.js')
  }
}

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>AI-Ready Networking & Secure Cloud Solutions | Lumen Technologies</title>
  </head>
  <body>
    <main>
      <p>Lumen Technologies</p>
      <a href="https://jobs.lumen.com/" target="_blank" rel="noopener noreferrer">Careers</a>
      <p>AI-Ready Networking & Secure Cloud Solutions</p>
    </main>
  </body>
</html>
`

const PCS_X_PAYLOAD = JSON.stringify({
  domain: 'lumen.com',
  configs: {
    pcsxConfig: {
      enabled: true,
      searchConfig: {
        allFilters: ['location_country', 'category'],
      },
    },
  },
}).replace(/"/g, '&#34;')

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Lumen Technologies</title>
  </head>
  <body>
    <main>
      <h1>Challenge Accepted.</h1>
      <h2>Build the Future.</h2>
      <script>window._EF_GROUP_ID = "lumen.com";</script>
      <code id="pcsx-data" style="display:none;" data-nosnippet>${PCS_X_PAYLOAD}</code>
    </main>
  </body>
</html>
`

const SEARCH_API_PAYLOAD = {
  data: {
    count: 2,
    positions: [
      {
        id: 1133910625764,
        displayJobId: '340953',
        name: 'Senior Network Engineer',
        locations: ['Bengaluru, Karnataka, India'],
        standardizedLocations: ['Bengaluru, Karnataka, IN'],
        postedTs: Date.parse('2026-07-08T00:00:00Z') / 1000,
        department: 'Engineering & Science',
        workLocationOption: 'onsite',
        positionUrl: '/careers/job/1133910625764',
      },
      {
        id: 1133913469015,
        displayJobId: '342319',
        name: 'Solutions Architect',
        locations: ['Denver, Colorado, United States'],
        standardizedLocations: ['Denver, CO, US'],
        postedTs: Date.parse('2026-07-08T00:00:00Z') / 1000,
        department: 'Sales, Marketing & Product Management',
        workLocationOption: 'onsite',
        positionUrl: '/careers/job/1133913469015',
      },
    ],
  },
}

test('getScraperCatalog includes Lumen as an Eightfold provider with verified public API metadata', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'lumen')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'eightfold')
  assert.equal(provider.companyName, 'Lumen Technologies')
  assert.equal(provider.homepageUrl, 'https://www.lumen.com/en-us/home.html')
  assert.equal(provider.companyCareerPage, 'https://careers.lumen.com/careers?sort_by=hot&start=0')
  assert.equal(provider.listingApiUrl, 'https://careers.lumen.com/api/pcsx/search')
  assert.deepEqual(provider.apiQuery, {
    domain: 'lumen.com',
    query: '',
    location: 'India',
  })
  assert.equal(provider.verifiedOn, '2026-08-03')
  assert.equal(provider.companyDomain, 'lumen.com')
  assert.match(provider.modulePath, /lumen[\\/]script\.js$/i)
})

test('createLumenScraper validates the official homepage and extracts India jobs from the live Eightfold search API', async () => {
  const lumen = await loadLumenModule()

  assert.equal(lumen.HOMEPAGE_URL, 'https://www.lumen.com/en-us/home.html')
  assert.equal(lumen.CAREERS_URL, 'https://careers.lumen.com/careers?sort_by=hot&start=0')
  assert.equal(lumen.SEARCH_API_URL, 'https://careers.lumen.com/api/pcsx/search')
  assert.equal(lumen.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(lumen.hasVerifiedCareersSignal(CAREERS_HTML), true)

  const requestedPageUrls = []
  const requestedApiUrls = []
  const jobs = await lumen.createLumenScraper().run({
    fetchText: async (url) => {
      requestedPageUrls.push(url)
      if (url === lumen.HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === lumen.CAREERS_URL) return CAREERS_HTML
      throw new Error(`Unexpected Lumen URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedApiUrls.push(url)
      assert.equal(url, lumen.buildSearchApiUrl({ start: 0, limit: lumen.SEARCH_PAGE_SIZE }))
      return SEARCH_API_PAYLOAD
    },
  })

  assert.deepEqual(requestedPageUrls, [
    lumen.HOMEPAGE_URL,
    lumen.CAREERS_URL,
  ])
  assert.deepEqual(requestedApiUrls, [
    lumen.buildSearchApiUrl({ start: 0, limit: lumen.SEARCH_PAGE_SIZE }),
  ])
  assert.equal(jobs.length, 1)
  assert.deepEqual(
    {
      title: jobs[0].title,
      company: jobs[0].company,
      location: jobs[0].location,
      city: jobs[0].city,
      country: jobs[0].country,
      source: jobs[0].source,
      sourceUrl: jobs[0].sourceUrl,
      applyUrl: jobs[0].applyUrl,
      link: jobs[0].link,
      department: jobs[0].department,
      employmentType: jobs[0].employmentType,
      experienceRequired: jobs[0].experienceRequired,
      postingDate: jobs[0].postingDate,
      requiredSkills: jobs[0].requiredSkills,
    },
    {
      title: 'Senior Network Engineer',
      company: 'Lumen Technologies',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      country: 'India',
      source: 'lumen',
      sourceUrl: 'https://careers.lumen.com/careers/job/1133910625764',
      applyUrl: 'https://careers.lumen.com/careers/job/1133910625764',
      link: 'https://careers.lumen.com/careers/job/1133910625764',
      department: 'Engineering & Science',
      employmentType: null,
      experienceRequired: null,
      postingDate: '2026-07-08',
      requiredSkills: [],
    },
  )
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})
