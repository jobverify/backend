import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Corporate Digital Identity | CDI & KYC | Encompass Corporation</title>
  </head>
  <body>
    <main>
      <h1>Corporate Digital Identity</h1>
      <p>CDI & KYC automation for complex regulated organisations.</p>
      <a href="/careers/">Careers</a>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Work for us | Careers at Encompass | KYC automation software</title>
  </head>
  <body>
    <main>
      <h1>Work for us</h1>
      <p>Explore our latest vacancies and help shape the future of digital identity.</p>
      <a href="https://encompass.pinpointhq.com/#js-careers-jobs-block">Explore our latest vacancies</a>
      <a href="https://encompass.pinpointhq.com/#js-careers-jobs-block">View jobs</a>
    </main>
  </body>
</html>
`

const pinpointBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs at Encompass Corporation | Encompass Corporation Careers</title>
  </head>
  <body>
    <div data-react-class="External::Jobs">
      <script type="application/json">
        {"url":"/postings.json","emptyText":"There are currently no positions advertised."}
      </script>
    </div>
    <a href="https://encompass.pinpointhq.com/jobs.rss">RSS</a>
    <a href="/register-your-interest/new">Register your interest</a>
  </body>
</html>
`

const verifiedUkPosting = {
  id: '6bd08fad-5b65-468f-8bf4-d9928ebc6fc6',
  title: 'Senior Platform Engineer',
  employment_type_text: 'Full Time',
  workplace_type_text: 'Hybrid',
  department: {
    name: 'Engineering',
  },
  location: {
    name: 'Glasgow',
    city: 'Glasgow',
    postal_code: 'G2 6NL',
  },
  path: '/postings/6bd08fad-5b65-468f-8bf4-d9928ebc6fc6',
  description: 'Build platform capabilities for digital identity workflows.',
  created_at: '2026-07-15T09:00:00Z',
}

const loadEncompassModule = async () => {
  try {
    return await import('../../scraper/encompass/script.js')
  } catch {
    assert.fail('Expected Encompass scraper module at ../../scraper/encompass/script.js')
  }
}

test('Encompass helpers stay pinned to the verified first-party careers handoff and public Pinpoint board', async () => {
  const encompass = await loadEncompassModule()

  assert.equal(encompass.SOURCE, 'encompass')
  assert.equal(encompass.COMPANY, 'Encompass')
  assert.equal(encompass.OFFICIAL_BRAND_NAME, 'Encompass Corporation')
  assert.equal(encompass.VERIFIED_ON, '2026-07-15')
  assert.equal(encompass.HOMEPAGE_URL, 'https://www.encompasscorporation.com/')
  assert.equal(encompass.CAREERS_ENTRY_URL, 'https://www.encompasscorporation.com/careers')
  assert.equal(encompass.CAREERS_PAGE_URL, 'https://www.encompasscorporation.com/careers/')
  assert.deepEqual(encompass.ACCEPTED_CAREERS_URLS, [
    'https://www.encompasscorporation.com/careers',
    'https://www.encompasscorporation.com/careers/',
  ])
  assert.equal(encompass.PINPOINT_BOARD_URL, 'https://encompass.pinpointhq.com/')
  assert.equal(encompass.PINPOINT_POSTINGS_URL, 'https://encompass.pinpointhq.com/postings.json')
  assert.equal(encompass.PINPOINT_RSS_URL, 'https://encompass.pinpointhq.com/jobs.rss')
  assert.equal(encompass.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(encompass.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(
    encompass.extractPinpointBoardUrl(careersHtml),
    'https://encompass.pinpointhq.com/',
  )
  assert.equal(encompass.hasOfficialPinpointBoardSignal(pinpointBoardHtml), true)
  assert.equal(
    encompass.extractPinpointPostingsUrl(pinpointBoardHtml),
    'https://encompass.pinpointhq.com/postings.json',
  )
})

test('Encompass maps the verified Glasgow Pinpoint posting shape and currently filters it out for India-only coverage', async () => {
  const encompass = await loadEncompassModule()

  assert.deepEqual(encompass.mapPinpointPosting(verifiedUkPosting), {
    title: 'Senior Platform Engineer',
    company: 'Encompass',
    department: 'Engineering',
    location: 'Glasgow',
    city: 'Glasgow',
    country: null,
    jobId: '6bd08fad-5b65-468f-8bf4-d9928ebc6fc6',
    requisitionId: '6bd08fad-5b65-468f-8bf4-d9928ebc6fc6',
    sourceUrl: 'https://encompass.pinpointhq.com/postings/6bd08fad-5b65-468f-8bf4-d9928ebc6fc6',
    applyUrl: 'https://encompass.pinpointhq.com/postings/6bd08fad-5b65-468f-8bf4-d9928ebc6fc6',
    employmentType: 'Full Time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-15T09:00:00.000Z',
    closingDate: null,
    jobDescription: 'Build platform capabilities for digital identity workflows.',
    remoteStatus: 'Hybrid',
  })
  assert.deepEqual(encompass.extractPinpointJobs([verifiedUkPosting]), [])
})

test('Encompass run validates the verified public surface and returns an honest zero-job result while the board has no India roles', async () => {
  const encompass = await loadEncompassModule()
  const requestedPages = []
  const requestedJson = []

  const jobs = await encompass.createEncompassScraper({
    now: () => '2026-07-15T10:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === encompass.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === encompass.CAREERS_ENTRY_URL) {
        return {
          status: 200,
          url: encompass.CAREERS_PAGE_URL,
          html: careersHtml,
        }
      }

      if (url === encompass.PINPOINT_BOARD_URL) {
        return {
          status: 200,
          url,
          html: pinpointBoardHtml,
        }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)

      if (url === encompass.PINPOINT_POSTINGS_URL) {
        return [verifiedUkPosting]
      }

      throw new Error(`Unexpected postings URL: ${url}`)
    },
  })

  assert.deepEqual(requestedPages, [
    encompass.HOMEPAGE_URL,
    encompass.CAREERS_ENTRY_URL,
    encompass.PINPOINT_BOARD_URL,
  ])
  assert.deepEqual(requestedJson, [encompass.PINPOINT_POSTINGS_URL])
  assert.deepEqual(jobs, [])
})

test('Encompass fails closed when the homepage, careers page, Pinpoint board, or postings payload changes materially', async () => {
  const encompass = await loadEncompassModule()

  await assert.rejects(
    encompass.createEncompassScraper().run({
      fetchPage: async (url) => {
        if (url === encompass.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><head><title>Unexpected</title></head><body></body></html>' }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async () => [verifiedUkPosting],
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    encompass.createEncompassScraper().run({
      fetchPage: async (url) => {
        if (url === encompass.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === encompass.CAREERS_ENTRY_URL) {
          return {
            status: 200,
            url: encompass.CAREERS_PAGE_URL,
            html: '<html><head><title>Work for us</title></head><body></body></html>',
          }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async () => [verifiedUkPosting],
    }),
    /verified careers page/i,
  )

  await assert.rejects(
    encompass.createEncompassScraper().run({
      fetchPage: async (url) => {
        if (url === encompass.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === encompass.CAREERS_ENTRY_URL) {
          return {
            status: 200,
            url: encompass.CAREERS_PAGE_URL,
            html: careersHtml,
          }
        }

        if (url === encompass.PINPOINT_BOARD_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Board changed</h1></body></html>',
          }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async () => [verifiedUkPosting],
    }),
    /verified pinpoint board/i,
  )

  await assert.rejects(
    encompass.createEncompassScraper().run({
      fetchPage: async (url) => {
        if (url === encompass.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === encompass.CAREERS_ENTRY_URL) {
          return {
            status: 200,
            url: encompass.CAREERS_PAGE_URL,
            html: careersHtml,
          }
        }

        if (url === encompass.PINPOINT_BOARD_URL) {
          return {
            status: 200,
            url,
            html: pinpointBoardHtml,
          }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async () => [{ id: 'broken' }],
    }),
    /pinpoint postings payload/i,
  )
})
