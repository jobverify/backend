import assert from 'node:assert/strict'
import test from 'node:test'

const loadMindteckModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Mindteck scraper module at ./script.js')
  }
}

const officialHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Mindteck | AI, IoT &amp; Product Engineering Solutions</title>
  </head>
  <body>
    <nav>
      <a href="https://careers.mindteck.com/">Careers</a>
    </nav>
  </body>
</html>
`

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Step into a world of opportunities</h1>
      <h2>Discover career opportunities that match your ambitions at Mindteck.</h2>
      <a href="https://careers.mindteck.com/job-search">Explore Open Positions</a>
    </main>
  </body>
</html>
`

const zeroJobsShellHtml = `
<!doctype html>
<html lang="en">
  <body>
    <header>
      <img alt="logo" src="/logo.svg">
    </header>
    <main>
      <p>We are the global engineering and technology solutions company devoted to delivering knowledge that matters to help clients compete, innovate and propel forward along the digital continuum.</p>
    </main>
    <footer>© 2026 Mindteck. All Rights Reserved</footer>
  </body>
</html>
`

test('Mindteck scraper validates the verified official careers handoff and current zero-jobs shell', async () => {
  const mindteck = await loadMindteckModule()

  assert.equal(mindteck.SOURCE, 'mindteck')
  assert.equal(mindteck.COMPANY, 'Mindteck')
  assert.equal(mindteck.HOMEPAGE_URL, 'https://www.mindteck.com/')
  assert.equal(mindteck.CAREERS_URL, 'https://careers.mindteck.com/')
  assert.equal(mindteck.JOB_SEARCH_URL, 'https://careers.mindteck.com/job-search')
  assert.equal(mindteck.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(mindteck.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(
    mindteck.extractJobSearchUrl(officialCareersHtml),
    'https://careers.mindteck.com/job-search',
  )
  assert.equal(mindteck.hasZeroJobsShellSignal(zeroJobsShellHtml), true)
})

test('Mindteck scraper returns no jobs while the official public job-search route only exposes the verified shell', async () => {
  const mindteck = await loadMindteckModule()
  const requestedUrls = []

  const jobs = await mindteck.createMindteckScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === mindteck.HOMEPAGE_URL) return officialHomepageHtml
      if (url === mindteck.CAREERS_URL) return officialCareersHtml
      if (url === mindteck.JOB_SEARCH_URL) return zeroJobsShellHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    mindteck.HOMEPAGE_URL,
    mindteck.CAREERS_URL,
    mindteck.JOB_SEARCH_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Mindteck scraper fails closed when the verified careers handoff or zero-jobs shell changes', async () => {
  const mindteck = await loadMindteckModule()

  await assert.rejects(
    mindteck.createMindteckScraper().run({
      fetchText: async (url) => {
        if (url === mindteck.HOMEPAGE_URL) return officialHomepageHtml
        if (url === mindteck.CAREERS_URL) {
          return officialCareersHtml.replace(
            'https://careers.mindteck.com/job-search',
            'https://careers.mindteck.com/job-search/software-engineer',
          )
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified public job-search route/i,
  )

  await assert.rejects(
    mindteck.createMindteckScraper().run({
      fetchText: async (url) => {
        if (url === mindteck.HOMEPAGE_URL) return officialHomepageHtml
        if (url === mindteck.CAREERS_URL) return officialCareersHtml
        if (url === mindteck.JOB_SEARCH_URL) {
          return `
            <html>
              <body>
                <main>
                  <a href="/job-search/senior-software-engineer">Senior Software Engineer</a>
                </main>
              </body>
            </html>
          `
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public job-search surface now exposes jobs/i,
  )
})
