import assert from 'node:assert/strict'
import test from 'node:test'

const LEGACY_CAREERS_HTML = `
<!doctype html>
<html>
  <body>
    <h1>Join us as we reimagine the future of shopping</h1>
    <p>We're currently upgrading our careers page to serve you better!</p>
    <p>Please email your application to talent@poshmark.com.</p>
    <a href="https://job-boards.greenhouse.io/poshmark">Current Openings</a>
  </body>
</html>
`

const CURRENT_CAREERS_HTML = `
<!doctype html>
<html>
  <body>
    <main>
      <h1>Join us as we reimagine the future of shopping</h1>
      <p>
        Guided by our core values, we&#39;re constantly challenging the boundaries of commerce
        and looking for innovative and passionate people to join our team.
      </p>
      <button class="btn btn--primary m--v--2">See Current Openings</button>
      <section>
        <h2>Poshmark comes to life with our core values</h2>
        <h3>FOCUS ON PEOPLE</h3>
      </section>
      <div>
        <p>
          We&#39;re currently upgrading our careers page to serve you better! While we&#39;re making
          improvements, please email your application to
          <a href="mailto:talent@poshmark.com">talent@poshmark.com</a>.
        </p>
      </div>
    </main>
  </body>
</html>
`

const ZERO_JOBS_BOARD_HTML = `
<!doctype html>
<html>
  <body>
    <h1>Current openings at Poshmark</h1>
    <button>Create a Job Alert</button>
    <p>There are no current openings.</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/poshmark/script.js')
  } catch {
    assert.fail('Expected Poshmark scraper module at ../../scraper/poshmark/script.js')
  }
}

test('Poshmark accepts both the legacy Greenhouse handoff page and the current branded upgrade shell', async () => {
  const poshmark = await loadModule()

  assert.equal(poshmark.SOURCE, 'poshmark')
  assert.equal(poshmark.COMPANY, 'Poshmark')
  assert.equal(poshmark.CAREERS_URL, 'https://poshmark.com/careers')
  assert.equal(poshmark.GREENHOUSE_BOARD_URL, 'https://job-boards.greenhouse.io/poshmark')
  assert.equal(poshmark.hasOfficialCareersSignal(LEGACY_CAREERS_HTML), true)
  assert.equal(poshmark.hasOfficialCareersSignal(CURRENT_CAREERS_HTML), true)
  assert.equal(
    poshmark.extractBoardUrl(LEGACY_CAREERS_HTML),
    'https://job-boards.greenhouse.io/poshmark',
  )
  assert.equal(poshmark.extractBoardUrl(CURRENT_CAREERS_HTML), null)
  assert.equal(poshmark.hasZeroJobsSignal(ZERO_JOBS_BOARD_HTML), true)
})

test('Poshmark run returns [] when the current branded careers page only exposes the email handoff', async () => {
  const poshmark = await loadModule()
  const requestedUrls = []

  const jobs = await poshmark.createPoshmarkScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === poshmark.CAREERS_URL) return CURRENT_CAREERS_HTML
      throw new Error(`Unexpected Poshmark URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, ['https://poshmark.com/careers'])
  assert.deepEqual(jobs, [])
})

test('Poshmark run still validates the legacy linked empty Greenhouse board when the anchor is present', async () => {
  const poshmark = await loadModule()
  const requestedUrls = []

  const jobs = await poshmark.createPoshmarkScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === poshmark.CAREERS_URL) return LEGACY_CAREERS_HTML
      if (url === poshmark.GREENHOUSE_BOARD_URL) return ZERO_JOBS_BOARD_HTML
      throw new Error(`Unexpected Poshmark URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://poshmark.com/careers',
    'https://job-boards.greenhouse.io/poshmark',
  ])
  assert.deepEqual(jobs, [])
})

test('Poshmark fails closed when the linked Greenhouse board exposes openings', async () => {
  const poshmark = await loadModule()

  await assert.rejects(
    poshmark.createPoshmarkScraper().run({
      fetchText: async (url) => {
        if (url === poshmark.CAREERS_URL) return LEGACY_CAREERS_HTML
        if (url === poshmark.GREENHOUSE_BOARD_URL) {
          return ZERO_JOBS_BOARD_HTML.replace(
            'There are no current openings.',
            'Senior Software Engineer',
          )
        }
        throw new Error(`Unexpected Poshmark URL: ${url}`)
      },
    }),
    /public jobs board/i,
  )
})
