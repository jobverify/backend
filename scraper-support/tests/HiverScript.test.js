import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_URL = 'https://hiverhq.com/careers'
const PINPOINT_BOARD_URL = 'https://hiverhq.pinpointhq.com/'
const PINPOINT_POSTINGS_URL = 'https://hiverhq.pinpointhq.com/postings.json'
const PINPOINT_RSS_URL = 'https://hiverhq.pinpointhq.com/jobs.rss'

const careersHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Hiver™ | Hiver Careers</title>
  </head>
  <body>
    <main>
      <a href="https://hiverhq.pinpointhq.com/" target="_blank" rel="noopener">
        See our open positions
      </a>
      <h2>Open positions</h2>
      <p class="no_open_position">No open positions currently</p>
      <p class="no_open_position">No open positions currently</p>
      <p>Send in your resume to <a href="mailto:jobs@hiverhq.com">jobs@hiverhq.com</a></p>
    </main>
  </body>
</html>
`

const pinpointBoardHtml = `
<!doctype html>
<html lang="en-GB">
  <head>
    <title>Jobs at Hiver | Hiver Careers</title>
    <link rel="alternate" type="application/rss+xml" title="RSS" href="https://hiverhq.pinpointhq.com/jobs.rss" />
  </head>
  <body>
    <h1>Current Opportunities</h1>
    <div data-react-class="External::Jobs">
      <script type="application/json">
        {"url":"/postings.json","translations":{"no_positions":"There are currently no positions advertised.","no_opportunities":"There are currently no opportunities based on your filters. Please try again, or register your interest."}}
      </script>
    </div>
    <p>Don't worry if you don't see any roles you want to apply for now. Register your interest to allow us to contact you when a suitable role meeting your criteria comes along.</p>
    <a href="/register-your-interest/new">Register Your Interest</a>
  </body>
</html>
`

const loadHiverModule = async () => {
  try {
    return await import('../../scraper/hiver/script.js')
  } catch {
    assert.fail('Expected Hiver scraper module at ../../scraper/hiver/script.js')
  }
}

test('Hiver helpers stay pinned to the verified first-party careers page and empty Pinpoint board', async () => {
  const hiver = await loadHiverModule()

  assert.equal(hiver.SOURCE, 'hiver')
  assert.equal(hiver.COMPANY, 'Hiver')
  assert.equal(hiver.CAREERS_URL, CAREERS_URL)
  assert.equal(hiver.PINPOINT_BOARD_URL, PINPOINT_BOARD_URL)
  assert.equal(hiver.PINPOINT_POSTINGS_URL, PINPOINT_POSTINGS_URL)
  assert.equal(hiver.PINPOINT_RSS_URL, PINPOINT_RSS_URL)
  assert.equal(hiver.VERIFIED_ON, '2026-07-16')
  assert.equal(hiver.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(hiver.extractPinpointBoardUrl(careersHtml), PINPOINT_BOARD_URL)
  assert.equal(hiver.hasOfficialPinpointEmptyBoardSignal(pinpointBoardHtml), true)
  assert.equal(hiver.extractPinpointPostingsUrl(pinpointBoardHtml), PINPOINT_POSTINGS_URL)
})

test('Hiver returns an honest empty result only while both verified first-party surfaces still show no public openings', async () => {
  const hiver = await loadHiverModule()
  const requestedUrls = []

  const jobs = await hiver.createHiverScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === CAREERS_URL) {
        return {
          status: 200,
          url,
          html: careersHtml,
        }
      }

      if (url === PINPOINT_BOARD_URL) {
        return {
          status: 200,
          url,
          html: pinpointBoardHtml,
        }
      }

      throw new Error(`Unexpected Hiver page URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [CAREERS_URL, PINPOINT_BOARD_URL])
  assert.deepEqual(jobs, [])
})

test('Hiver fails closed when the first-party careers shell or Pinpoint board changes materially', async () => {
  const hiver = await loadHiverModule()

  await assert.rejects(
    hiver.createHiverScraper().run({
      fetchPage: async (url) => {
        if (url === CAREERS_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Unexpected</title></head><body></body></html>',
          }
        }

        throw new Error(`Unexpected Hiver page URL: ${url}`)
      },
    }),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    hiver.createHiverScraper().run({
      fetchPage: async (url) => {
        if (url === CAREERS_URL) {
          return {
            status: 200,
            url,
            html: careersHtml,
          }
        }

        if (url === PINPOINT_BOARD_URL) {
          return {
            status: 200,
            url,
            html: pinpointBoardHtml.replace(
              'There are currently no positions advertised.',
              'Now hiring across customer support.',
            ),
          }
        }

        throw new Error(`Unexpected Hiver page URL: ${url}`)
      },
    }),
    /verified pinpoint empty board/i,
  )

  await assert.rejects(
    hiver.createHiverScraper().run({
      fetchPage: async (url) => {
        if (url === CAREERS_URL) {
          return {
            status: 200,
            url,
            html: careersHtml.replace(/No open positions currently/g, '1 open position'),
          }
        }

        if (url === PINPOINT_BOARD_URL) {
          return {
            status: 200,
            url,
            html: pinpointBoardHtml,
          }
        }

        throw new Error(`Unexpected Hiver page URL: ${url}`)
      },
    }),
    /verified first-party careers page/i,
  )
})
