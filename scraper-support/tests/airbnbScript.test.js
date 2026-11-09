import assert from 'node:assert/strict'
import test from 'node:test'

const loadAirbnbModule = async () => {
  try {
    return await import('../../scraper/airbnb/script.js')
  } catch {
    assert.fail('Expected Airbnb scraper module at ../../scraper/airbnb/script.js')
  }
}

const careersHomeHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Home - Careers at Airbnb</title>
  </head>
  <body>
    <main>
      <h1>Discover your place at Airbnb</h1>
      <a href="https://careers.airbnb.com/positions/">Explore open roles</a>
      <section>
        <h2>Open the door to your next role</h2>
        <p>203 Open Positions</p>
      </section>
    </main>
  </body>
</html>
`

const pageOneHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Positions Archive - Careers at Airbnb</title>
    <link rel="canonical" href="https://careers.airbnb.com/positions/" />
  </head>
  <body>
    <main>
      <h1>All Jobs</h1>
      <p>203 open roles</p>
      <div>Sort by:</div>
      <ul class="job-list w-full" role="list">
        <li class="inner-grid border-b border-gray-Foggy py-4" role="listitem">
          <div class="col-span-4 lg:col-span-9">
            <div class="flex text-size-3 font-medium text-gray-48 gap-1 mb-[5px]">
              <span>Account Management</span>
              <span>&#x2022;</span>
              <span>Hybrid - Be close to an office</span>
            </div>
            <span class="text-size-4">
              <a href="https://careers.airbnb.com/positions/7995153/">Acquisition Manager</a>
            </span>
          </div>
          <div class="col-span-4 lg:col-span-3 flex justify-end text-right flex-wrap gap-1">
            <span class="text-size-4 font-normal text-gray-48 flex items-center">Berlin, Germany</span>
          </div>
        </li>
        <li class="inner-grid border-b border-gray-Foggy py-4" role="listitem">
          <div class="col-span-4 lg:col-span-9">
            <div class="flex text-size-3 font-medium text-gray-48 gap-1 mb-[5px]">
              <span>Community Support</span>
              <span>&#x2022;</span>
              <span>Onsite</span>
            </div>
            <span class="text-size-4">
              <a href="https://careers.airbnb.com/positions/8002310/?gh_jid=8002310">Supervisor, Executive Escalations</a>
            </span>
          </div>
          <div class="col-span-4 lg:col-span-3 flex justify-end text-right flex-wrap gap-1">
            <span class="text-size-4 font-normal text-gray-48 flex items-center">Gurugram, India</span>
          </div>
        </li>
      </ul>
      <nav aria-label="Pagination">
        <a href="https://careers.airbnb.com/positions/page/2/">2</a>
        <a href="https://careers.airbnb.com/positions/page/3/">3</a>
      </nav>
    </main>
  </body>
</html>
`

const pageTwoHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Positions Archive - Page 2 of 3 - Careers at Airbnb</title>
    <link rel="canonical" href="https://careers.airbnb.com/positions/page/2/" />
  </head>
  <body>
    <main>
      <h1>All Jobs</h1>
      <p>203 open roles</p>
      <div>Sort by:</div>
      <ul class="job-list w-full" role="list">
        <li class="inner-grid border-b border-gray-Foggy py-4" role="listitem">
          <div class="col-span-4 lg:col-span-9">
            <div class="flex text-size-3 font-medium text-gray-48 gap-1 mb-[5px]">
              <span>Community Support</span>
              <span>&#x2022;</span>
              <span>Onsite</span>
            </div>
            <span class="text-size-4">
              <a href="https://careers.airbnb.com/positions/8002310/">Supervisor, Executive Escalations</a>
            </span>
          </div>
          <div class="col-span-4 lg:col-span-3 flex justify-end text-right flex-wrap gap-1">
            <span class="text-size-4 font-normal text-gray-48 flex items-center">Gurugram, India</span>
          </div>
        </li>
        <li class="inner-grid border-b border-gray-Foggy py-4" role="listitem">
          <div class="col-span-4 lg:col-span-9">
            <div class="flex text-size-3 font-medium text-gray-48 gap-1 mb-[5px]">
              <span>Engineering</span>
              <span>&#x2022;</span>
              <span>Live and Work Anywhere</span>
            </div>
            <span class="text-size-4">
              <a href="/positions/7556182/#apply">Senior Software Engineer, (Python, GenAI, MCP)</a>
            </span>
          </div>
          <div class="col-span-4 lg:col-span-3 flex justify-end text-right flex-wrap gap-1">
            <span class="text-size-4 font-normal text-gray-48 flex items-center">Remote - Bangalore, India</span>
          </div>
        </li>
        <li class="inner-grid border-b border-gray-Foggy py-4" role="listitem">
          <div class="col-span-4 lg:col-span-9">
            <div class="flex text-size-3 font-medium text-gray-48 gap-1 mb-[5px]">
              <span>Engineering</span>
              <span>&#x2022;</span>
              <span>Live and Work Anywhere</span>
            </div>
            <span class="text-size-4">
              <a href="https://careers.airbnb.com/positions/7946288/">AI Engineer, Community Support Engineering</a>
            </span>
          </div>
          <div class="col-span-4 lg:col-span-3 flex justify-end text-right flex-wrap gap-1">
            <span class="text-size-4 font-normal text-gray-48 flex items-center">China - Remote</span>
          </div>
        </li>
      </ul>
      <nav aria-label="Pagination">
        <a href="https://careers.airbnb.com/positions/">1</a>
        <a href="https://careers.airbnb.com/positions/page/3/">3</a>
      </nav>
    </main>
  </body>
</html>
`

test('Airbnb helpers stay pinned to the verified careers-home redirect and first-party positions archive contract', async () => {
  const airbnb = await loadAirbnbModule()

  assert.equal(airbnb.SOURCE, 'airbnb')
  assert.equal(airbnb.COMPANY, 'Airbnb')
  assert.equal(airbnb.CAREERS_ENTRY_URL, 'https://www.airbnb.com/careers')
  assert.equal(airbnb.CAREERS_HOME_URL, 'https://careers.airbnb.com/')
  assert.equal(airbnb.POSITIONS_URL, 'https://careers.airbnb.com/positions/')
  assert.equal(airbnb.buildPositionsPageUrl(), 'https://careers.airbnb.com/positions/')
  assert.equal(
    airbnb.buildPositionsPageUrl({ page: 2 }),
    'https://careers.airbnb.com/positions/page/2/',
  )
  assert.equal(airbnb.hasOfficialCareersHomeSignal(careersHomeHtml), true)
  assert.equal(airbnb.hasOfficialPositionsSignal(pageOneHtml), true)
  assert.equal(
    airbnb.normalizeAirbnbJobUrl('https://careers.airbnb.com/positions/7556182/?gh_jid=7556182#apply'),
    'https://careers.airbnb.com/positions/7556182/',
  )

  assert.deepEqual(airbnb.extractPaginationSummary(pageTwoHtml), {
    currentPage: 2,
    totalPages: 3,
    hasNext: true,
  })

  assert.deepEqual(airbnb.extractIndiaJobCardsFromPage(pageOneHtml), [
    {
      title: 'Supervisor, Executive Escalations',
      location: 'Gurugram, India',
      department: 'Community Support',
      workplaceType: 'Onsite',
      sourceUrl: 'https://careers.airbnb.com/positions/8002310/',
      jobId: '8002310',
      requisitionId: '8002310',
    },
  ])
})

test('Airbnb run paginates the verified first-party positions archive, filters India roles, and dedupes overlapping page boundaries', async () => {
  const airbnb = await loadAirbnbModule()
  const requestedUrls = []

  const jobs = await airbnb.createAirbnbScraper({ maxPages: 2 }).run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === airbnb.CAREERS_ENTRY_URL) {
        return {
          status: 200,
          url: airbnb.CAREERS_HOME_URL,
          html: careersHomeHtml,
        }
      }

      if (url === airbnb.POSITIONS_URL) {
        return {
          status: 200,
          url,
          html: pageOneHtml,
        }
      }

      if (url === airbnb.buildPositionsPageUrl({ page: 2 })) {
        return {
          status: 200,
          url,
          html: pageTwoHtml,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-15T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    airbnb.CAREERS_ENTRY_URL,
    airbnb.POSITIONS_URL,
    airbnb.buildPositionsPageUrl({ page: 2 }),
  ])
  assert.equal(jobs.length, 2)

  assert.deepEqual(jobs[0], {
    title: 'Supervisor, Executive Escalations',
    company: 'Airbnb',
    location: 'Gurugram, India',
    city: 'Gurgaon',
    country: 'India',
    link: 'https://careers.airbnb.com/positions/8002310/',
    applyUrl: 'https://careers.airbnb.com/positions/8002310/',
    sourceUrl: 'https://careers.airbnb.com/positions/8002310/',
    source: 'airbnb',
    jobId: '8002310',
    requisitionId: '8002310',
    department: 'Community Support',
    employmentType: null,
    experienceRequired: null,
    jobDescription: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    remoteStatus: 'On-site',
    scrapedAt: '2026-07-15T00:00:00.000Z',
  })

  assert.deepEqual(jobs[1], {
    title: 'Senior Software Engineer, (Python, GenAI, MCP)',
    company: 'Airbnb',
    location: 'Remote - Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    link: 'https://careers.airbnb.com/positions/7556182/',
    applyUrl: 'https://careers.airbnb.com/positions/7556182/',
    sourceUrl: 'https://careers.airbnb.com/positions/7556182/',
    source: 'airbnb',
    jobId: '7556182',
    requisitionId: '7556182',
    department: 'Engineering',
    employmentType: null,
    experienceRequired: null,
    jobDescription: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    remoteStatus: 'Remote',
    scrapedAt: '2026-07-15T00:00:00.000Z',
  })
})

test('Airbnb fails closed when the verified careers home, positions archive, or first-party detail URLs drift', async () => {
  const airbnb = await loadAirbnbModule()

  await assert.rejects(
    airbnb.createAirbnbScraper().run({
      fetchPage: async (url) => {
        if (url === airbnb.CAREERS_ENTRY_URL) {
          return {
            status: 200,
            url: airbnb.CAREERS_HOME_URL,
            html: '<html><body><h1>Careers</h1></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official airbnb careers entry surface/i,
  )

  await assert.rejects(
    airbnb.createAirbnbScraper().run({
      fetchPage: async (url) => {
        if (url === airbnb.CAREERS_ENTRY_URL) {
          return {
            status: 200,
            url: airbnb.CAREERS_HOME_URL,
            html: careersHomeHtml,
          }
        }

        if (url === airbnb.POSITIONS_URL) {
          return {
            status: 200,
            url,
            html: pageOneHtml.replace(
              'https://careers.airbnb.com/positions/8002310/?gh_jid=8002310',
              'https://boards.greenhouse.io/airbnb/jobs/8002310',
            ),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified first-party airbnb detail urls/i,
  )

  await assert.rejects(
    airbnb.createAirbnbScraper({ maxPages: 2 }).run({
      fetchPage: async (url) => {
        if (url === airbnb.CAREERS_ENTRY_URL) {
          return {
            status: 200,
            url: airbnb.CAREERS_HOME_URL,
            html: careersHomeHtml,
          }
        }

        if (url === airbnb.POSITIONS_URL) {
          return {
            status: 200,
            url,
            html: pageOneHtml,
          }
        }

        if (url === airbnb.buildPositionsPageUrl({ page: 2 })) {
          return {
            status: 200,
            url,
            html: pageTwoHtml.replace('Page 2 of 3', 'Page 3 of 3'),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official airbnb positions surface/i,
  )
})
