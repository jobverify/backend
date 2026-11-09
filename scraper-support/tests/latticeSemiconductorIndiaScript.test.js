import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { assertMappedInventoryEvidence } from './helpers/assertMappedInventoryEvidence.js'

const CAREERS_PAGE_URL = 'https://www.latticesemi.com/About/Jobs'
const WORKDAY_BOARD_URL = 'https://latticesemi.wd5.myworkdayjobs.com/latticesemiconductorscareers'
const WORKDAY_JOBS_API_URL =
  'https://latticesemi.wd5.myworkdayjobs.com/wday/cxs/latticesemi/latticesemiconductorscareers/jobs'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const expectedScraperDir = path.resolve(currentDir, '../../scraper/latticesemiconductorindia')

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Lattice Semiconductor | Careers | Join the FPGA Leader</title>
  </head>
  <body>
    <main>
      <h1>Lattice Careers</h1>
      <a href="https://careers-latticesemi.icims.com/jobs/intro?hashed=-625919477&amp;mobile=false">Search Job Openings</a>
      <a href="https://latticesemi.wd5.myworkdayjobs.com/latticesemiconductorscareers?hashed=-625919477&amp;mobile=false&amp;width=1378">Apply Today</a>
    </main>
  </body>
</html>
`

const workdayBoardHtml = `
<!DOCTYPE html>
<html lang="en-US">
<head>
  <title></title>
  <link rel="canonical" href="https://latticesemi.wd5.myworkdayjobs.com/latticesemiconductorscareers" />
  <meta property="og:title" content="Join the FPGA Leader" />
</head>
<body>
  <script>
    window.__WDA__ = {
      tenant: "latticesemi",
      siteId: "latticesemiconductorscareers",
      requestLocale: "en-US",
      appName: "cxs"
    };
  </script>
</body>
</html>
`

const sampleWorkdayJobs = [
  {
    title: 'Design Eng',
    location: 'Pune, India',
    city: 'Pune',
    link: 'https://latticesemi.wd5.myworkdayjobs.com/latticesemiconductorscareers/job/Pune-India/Design-Eng_R-101170',
    sourceUrl: null,
    applyUrl: null,
    source: null,
    company: null,
  },
  {
    title: 'Senior Design Verification Engineer',
    location: 'Hyderabad, India',
    city: 'Hyderabad',
    link: 'https://latticesemi.wd5.myworkdayjobs.com/latticesemiconductorscareers/job/Hyderabad-India/Senior-Design-Verification-Engineer_R-102415',
    sourceUrl: 'https://example.com/source',
    applyUrl: 'https://example.com/apply',
    source: 'latticesemiconductorindia',
    company: 'Lattice Semiconductor India',
  },
]

const loadLatticeModule = async () => {
  try {
    return await import('../../scraper/latticesemiconductorindia/script.js')
  } catch {
    assert.fail('Expected Lattice Semiconductor India scraper module at ../../scraper/latticesemiconductorindia/script.js')
  }
}

test('Lattice company decoration retains native Workday inventory authority', async t => {
  const lattice = await loadLatticeModule()
  await assertMappedInventoryEvidence(t, jobs => lattice.createLatticeSemiconductorIndiaScraper().run({
    runWorkday: async () => jobs,
    fetchPage: async url => {
      if (url === CAREERS_PAGE_URL) return { status: 200, url, html: careersHtml }
      if (url === WORKDAY_BOARD_URL) return { status: 200, url, html: workdayBoardHtml }
      throw new Error(`Unexpected inventory fixture URL: ${url}`)
    },
  }), { surface: WORKDAY_BOARD_URL, job: sampleWorkdayJobs[0] })
})

test('Lattice Semiconductor India helpers stay pinned to the verified first-party careers and Workday handoff surfaces', async () => {
  const lattice = await loadLatticeModule()

  assert.equal(lattice.SOURCE, 'latticesemiconductorindia')
  assert.equal(lattice.COMPANY_NAME, 'Lattice Semiconductor India')
  assert.equal(lattice.OFFICIAL_BRAND_NAME, 'Lattice Semiconductor')
  assert.equal(lattice.HOMEPAGE_URL, 'https://www.latticesemi.com/en')
  assert.equal(lattice.OFFICIAL_CAREERS_PAGE_URL, CAREERS_PAGE_URL)
  assert.equal(lattice.OFFICIAL_WORKDAY_BOARD_URL, WORKDAY_BOARD_URL)
  assert.equal(lattice.WORKDAY_JOBS_API_URL, WORKDAY_JOBS_API_URL)
  assert.equal(lattice.INDIA_COUNTRY_FACET_ID, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.equal(lattice.VERIFIED_ON, '2026-08-15')
  assert.equal(lattice.extractOfficialWorkdayBoardUrl(careersHtml), `${WORKDAY_BOARD_URL}?hashed=-625919477&mobile=false&width=1378`)
  assert.equal(lattice.hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(lattice.hasOfficialWorkdayBoardSignal(workdayBoardHtml), true)
})

test('Lattice Semiconductor India validates the first-party Workday handoff then delegates enumeration to the shared Workday runner', async () => {
  const lattice = await loadLatticeModule()
  const requestedUrls = []
  let workdayOptions = null

  const jobs = await lattice.createLatticeSemiconductorIndiaScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === CAREERS_PAGE_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (url === WORKDAY_BOARD_URL) {
        return { status: 200, url, html: workdayBoardHtml }
      }

      throw new Error(`Unexpected Lattice Semiconductor India fixture URL: ${url}`)
    },
    runWorkday: async (options) => {
      workdayOptions = options
      return sampleWorkdayJobs
    },
  })

  assert.deepEqual(requestedUrls, [CAREERS_PAGE_URL, WORKDAY_BOARD_URL])
  assert.deepEqual(workdayOptions, {
    company: 'Lattice Semiconductor India',
    baseUrl: WORKDAY_BOARD_URL,
    locationCountry: 'c4f78be1a8f14da0ab49ce1162348a5e',
    source: 'latticesemiconductorindia',
    scraperDir: expectedScraperDir,
  })
  assert.deepEqual(jobs, [
    {
      ...sampleWorkdayJobs[0],
      company: 'Lattice Semiconductor India',
      source: 'latticesemiconductorindia',
      sourceUrl: sampleWorkdayJobs[0].link,
      applyUrl: sampleWorkdayJobs[0].link,
    },
    sampleWorkdayJobs[1],
  ])
})

test('Lattice Semiconductor India fails closed when the first-party careers page or Workday board drifts', async () => {
  const lattice = await loadLatticeModule()

  await assert.rejects(
    lattice.createLatticeSemiconductorIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === CAREERS_PAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Unexpected</title></head><body>No trusted careers markers</body></html>',
          }
        }

        throw new Error(`Unexpected Lattice Semiconductor India fixture URL: ${url}`)
      },
    }),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    lattice.createLatticeSemiconductorIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === CAREERS_PAGE_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === WORKDAY_BOARD_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Placeholder</title></head><body>No Workday markers</body></html>',
          }
        }

        throw new Error(`Unexpected Lattice Semiconductor India fixture URL: ${url}`)
      },
    }),
    /verified Workday board/i,
  )
})
