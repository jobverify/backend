import assert from 'node:assert/strict'
import test from 'node:test'

const loadTitanModule = async () => {
  try {
    return await import('../../scraper/titan/script.js')
  } catch {
    assert.fail('Expected Titan scraper module at ../../scraper/titan/script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Career Opportunities at Titan Company</h1>
      <section>
        <h2>Current vacancies</h2>
        <a href="https://careers.titan.in/in/en/search-results">Current vacancies</a>
      </section>
      <section>
        <h2>Life at Titan</h2>
        <p>Working at Titan Company Limited</p>
      </section>
    </main>
  </body>
</html>
`

const zeroJobsSearchHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Search Results</h1>
      <p>We couldn't find any open positions for "\${pageStateData.searchKeyword}"</p>
      <p>We couldn't find any open positions for "\${pageStateData.placeVal}"</p>
      <p>Sorry... no active job openings, please come back later.</p>
    </main>
  </body>
</html>
`

test('Titan scraper validates the official careers page and current zero-jobs search surface', async () => {
  const titan = await loadTitanModule()

  assert.equal(titan.CAREERS_URL, 'https://www.titancompany.in/careers')
  assert.equal(titan.SEARCH_RESULTS_URL, 'https://careers.titan.in/in/en/search-results')
  assert.equal(titan.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(
    titan.extractCurrentVacanciesUrl(officialCareersHtml),
    'https://careers.titan.in/in/en/search-results',
  )
  assert.equal(titan.hasZeroJobsSignal(zeroJobsSearchHtml), true)
})

test('Titan scraper returns no jobs while the official public Titan jobs surface says there are no active openings', async () => {
  const titan = await loadTitanModule()
  const requestedUrls = []

  const jobs = await titan.createTitanScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === titan.CAREERS_URL) return officialCareersHtml
      if (url === titan.SEARCH_RESULTS_URL) return zeroJobsSearchHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    titan.CAREERS_URL,
    titan.SEARCH_RESULTS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Titan scraper fails closed when the official page stops linking to the verified search surface or jobs appear', async () => {
  const titan = await loadTitanModule()

  await assert.rejects(
    titan.createTitanScraper().run({
      fetchText: async (url) => {
        if (url === titan.CAREERS_URL) {
          return officialCareersHtml.replace(
            'https://careers.titan.in/in/en/search-results',
            'https://careers.titan.in/in/en/job/123',
          )
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official vacancies surface/i,
  )

  await assert.rejects(
    titan.createTitanScraper().run({
      fetchText: async (url) => {
        if (url === titan.CAREERS_URL) return officialCareersHtml
        if (url === titan.SEARCH_RESULTS_URL) {
          return `
            <html>
              <body>
                <main>
                  <h1>Search Results</h1>
                  <a href="/in/en/job/role-1">Senior Engineer</a>
                </main>
              </body>
            </html>
          `
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public jobs surface now exposes openings/i,
  )
})
