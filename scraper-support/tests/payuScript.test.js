import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Be a PayUneer</h1>
      <h2>Life at PayU India</h2>
      <section>
        <h3>Who do we hire? We hire the right tribe</h3>
        <a href="https://corporate.payu.com/job-board/">View all open positions</a>
      </section>
    </main>
  </body>
</html>
`

const jobBoardHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Become a PayUneer</h1>
      <p>Showing 16 of 16 positions</p>
      <span class="tag" data-type="location">Prague, Czech Republic</span>
      <span class="tag" data-type="location">Poznan, Poland</span>
      <span class="tag" data-type="location">Warsaw, Poland</span>
      <span class="tag" data-type="location">Bucharest, Romania</span>
    </main>
  </body>
</html>
`

const indiaJobBoardHtml = jobBoardHtml.replace(
  '</main>',
  '<span class="tag" data-type="location">Bengaluru, India</span></main>',
)

const driftedCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Careers</h1>
      <p>Placeholder</p>
    </main>
  </body>
</html>
`

const driftedJobBoardHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Jobs</h1>
      <p>No board markers here</p>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/payu/script.js')
  } catch {
    assert.fail('Expected PayU scraper module at ../../scraper/payu/script.js')
  }
}

test('PayU recognizes the verified India careers handoff and extracts non-India public board locations', async () => {
  const payu = await loadModule()

  assert.equal(payu.SOURCE, 'payu')
  assert.equal(payu.COMPANY, 'PayU')
  assert.equal(payu.OFFICIAL_BRAND_NAME, 'PayU India')
  assert.equal(payu.VERIFIED_ON, '2026-07-16')
  assert.equal(payu.HOMEPAGE_URL, 'https://corporate.payu.in/')
  assert.equal(payu.CAREERS_URL, 'https://corporate.payu.in/careers/')
  assert.equal(payu.GLOBAL_JOB_BOARD_URL, 'https://corporate.payu.com/job-board/')
  assert.equal(payu.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(payu.hasOfficialJobBoardSignal(jobBoardHtml), true)
  assert.deepEqual(payu.extractVisibleJobLocations(jobBoardHtml), [
    'Prague, Czech Republic',
    'Poznan, Poland',
    'Warsaw, Poland',
    'Bucharest, Romania',
  ])
  assert.equal(payu.jobBoardHasIndiaLocations(jobBoardHtml), false)
  assert.equal(payu.jobBoardHasIndiaLocations(indiaJobBoardHtml), true)
})

test('PayU returns [] while the verified official hiring flow exposes no India jobs', async () => {
  const payu = await loadModule()
  const requestedUrls = []

  const jobs = await payu.createPayUScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === payu.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (url === payu.GLOBAL_JOB_BOARD_URL) {
        return { status: 200, url, html: jobBoardHtml }
      }

      throw new Error(`Unexpected PayU URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [payu.CAREERS_URL, payu.GLOBAL_JOB_BOARD_URL])
  assert.deepEqual(jobs, [])
})

test('PayU fails closed when the careers handoff drifts, the global board drifts, or India jobs appear', async () => {
  const payu = await loadModule()

  await assert.rejects(
    payu.createPayUScraper().run({
      fetchPage: async (url) => {
        if (url === payu.CAREERS_URL) {
          return { status: 200, url, html: driftedCareersHtml }
        }

        throw new Error(`Unexpected PayU URL: ${url}`)
      },
    }),
    /careers page/i,
  )

  await assert.rejects(
    payu.createPayUScraper().run({
      fetchPage: async (url) => {
        if (url === payu.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === payu.GLOBAL_JOB_BOARD_URL) {
          return { status: 200, url, html: driftedJobBoardHtml }
        }

        throw new Error(`Unexpected PayU URL: ${url}`)
      },
    }),
    /job board/i,
  )

  await assert.rejects(
    payu.createPayUScraper().run({
      fetchPage: async (url) => {
        if (url === payu.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === payu.GLOBAL_JOB_BOARD_URL) {
          return { status: 200, url, html: indiaJobBoardHtml }
        }

        throw new Error(`Unexpected PayU URL: ${url}`)
      },
    }),
    /India roles/i,
  )
})
