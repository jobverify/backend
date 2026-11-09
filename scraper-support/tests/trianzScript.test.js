import assert from 'node:assert/strict'
import test from 'node:test'

const loadTrianzModule = async () => {
  try {
    return await import('../../scraper/trianz/script.js')
  } catch {
    assert.fail('Expected Trianz scraper module at ../../scraper/trianz/script.js')
  }
}

const careersPageHtml = `
  <html>
    <head>
      <title>Careers | Trianz</title>
    </head>
    <body>
      <main>
        <h1>Careers at Trianz</h1>
        <p>Build a career that is future-ready with Trianz.</p>
        <section>
          <h2>India Opportunities</h2>
          <a href="https://recruit.trianz.com/">Explore India openings</a>
        </section>
      </main>
    </body>
  </html>
`

test('recognizes the official Trianz careers page signal and India recruit handoff', async () => {
  const trianz = await loadTrianzModule()

  assert.equal(trianz.CAREERS_PAGE_URL, 'https://www.trianz.com/careers')
  assert.equal(trianz.INDIA_HANDOFF_URL, 'https://recruit.trianz.com/')
  assert.equal(trianz.hasOfficialCareersSignal(careersPageHtml), true)
  assert.equal(trianz.hasIndiaHandoffSignal(careersPageHtml), true)
  assert.equal(trianz.hasIndiaHandoffSignal('<main>No India handoff</main>'), false)
})

test('run returns no jobs after validating the official Trianz careers page while the India recruit host stays unreachable', async () => {
  const trianz = await loadTrianzModule()
  const requestedUrls = []

  const jobs = await trianz.createTrianzScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === trianz.CAREERS_PAGE_URL) {
        return { status: 200, url, html: careersPageHtml }
      }

      if (url === trianz.INDIA_HANDOFF_URL) {
        throw new Error('connect ECONNREFUSED recruit.trianz.com')
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    trianz.CAREERS_PAGE_URL,
    trianz.INDIA_HANDOFF_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('run fails closed when the official Trianz careers page no longer exposes the verified India handoff', async () => {
  const trianz = await loadTrianzModule()

  await assert.rejects(
    trianz.createTrianzScraper().run({
      fetchPage: async (url) => {
        if (url === trianz.CAREERS_PAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Careers at Trianz</h1><p>Future-ready teams.</p></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified India handoff/i,
  )
})

test('run fails closed when the recruit host starts serving a reachable public page', async () => {
  const trianz = await loadTrianzModule()

  await assert.rejects(
    trianz.createTrianzScraper().run({
      fetchPage: async (url) => {
        if (url === trianz.CAREERS_PAGE_URL) {
          return { status: 200, url, html: careersPageHtml }
        }

        if (url === trianz.INDIA_HANDOFF_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Trianz Recruit</h1><a href="/jobs">Jobs</a></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /no longer matches the verified unreachable state/i,
  )
})
