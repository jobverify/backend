import assert from 'node:assert/strict'
import test from 'node:test'

const loadPoshmarkModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Poshmark scraper module at ./script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Join us as we reimagine the future of shopping</h1>
      <section>
        <h2>Current Openings</h2>
        <p>
          We're currently upgrading our careers page to serve you better! While we're making
          improvements, please email your application to talent@poshmark.com.
        </p>
        <a href="https://job-boards.greenhouse.io/poshmark">See Current Openings</a>
      </section>
    </main>
  </body>
</html>
`

const zeroJobsBoardHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Current openings at Poshmark</h1>
      <p>Create a Job Alert</p>
      <p>There are no current openings.</p>
    </main>
  </body>
</html>
`

test('Poshmark scraper validates the official careers page and linked zero-jobs Greenhouse board', async () => {
  const poshmark = await loadPoshmarkModule()

  assert.equal(poshmark.SOURCE, 'poshmark')
  assert.equal(poshmark.COMPANY, 'Poshmark')
  assert.equal(poshmark.CAREERS_URL, 'https://poshmark.com/careers')
  assert.equal(poshmark.GREENHOUSE_BOARD_URL, 'https://job-boards.greenhouse.io/poshmark')
  assert.equal(poshmark.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(poshmark.extractBoardUrl(officialCareersHtml), poshmark.GREENHOUSE_BOARD_URL)
  assert.equal(poshmark.hasZeroJobsSignal(zeroJobsBoardHtml), true)
})

test('Poshmark scraper returns no jobs while the official public careers flow is email apply plus a zero-jobs board', async () => {
  const poshmark = await loadPoshmarkModule()
  const requestedUrls = []

  const jobs = await poshmark.createPoshmarkScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === poshmark.CAREERS_URL) return officialCareersHtml
      if (url === poshmark.GREENHOUSE_BOARD_URL) return zeroJobsBoardHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    poshmark.CAREERS_URL,
    poshmark.GREENHOUSE_BOARD_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Poshmark scraper fails closed when the official careers flow changes or openings appear', async () => {
  const poshmark = await loadPoshmarkModule()

  await assert.rejects(
    poshmark.createPoshmarkScraper().run({
      fetchText: async () => '<html><body><main><h1>Poshmark Careers</h1></main></body></html>',
    }),
    /verified official careers surface/i,
  )

  await assert.rejects(
    poshmark.createPoshmarkScraper().run({
      fetchText: async (url) => {
        if (url === poshmark.CAREERS_URL) {
          return officialCareersHtml.replace(
            'https://job-boards.greenhouse.io/poshmark',
            'https://jobs.lever.co/poshmark',
          )
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official careers surface|verified greenhouse board/i,
  )

  await assert.rejects(
    poshmark.createPoshmarkScraper().run({
      fetchText: async (url) => {
        if (url === poshmark.CAREERS_URL) return officialCareersHtml
        if (url === poshmark.GREENHOUSE_BOARD_URL) {
          return `
            <html>
              <body>
                <main>
                  <h1>Current openings at Poshmark</h1>
                  <a href="/poshmark/jobs/123">Software Engineer</a>
                </main>
              </body>
            </html>
          `
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public jobs board now exposes openings/i,
  )
})
