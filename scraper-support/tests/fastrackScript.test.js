import assert from 'node:assert/strict'
import test from 'node:test'

const homepagePage = {
  status: 200,
  url: 'https://www.fastrack.in/',
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <title>Fastrack - Shop Fashion Accessories For Men, Women & Kids</title>
      </head>
      <body>
        <main>
          <h1>FASTRACK CATEGORIES</h1>
          <footer>
            <section>
              <h2>ABOUT FASTRACK</h2>
              <a href="https://careers.titan.in/?rms=titan">Careers</a>
              <a href="https://www.titancare.in/">After Sales Service</a>
              <a href="https://www.fastrack.in/pages/help-contact-us">Contact Us</a>
            </section>
          </footer>
        </main>
      </body>
    </html>
  `,
}

const titanCorporateCareersPage = {
  status: 200,
  url: 'https://www.titancompany.in/careers',
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <title>Career Opportunities at Titan Company</title>
        <meta
          name="description"
          content="Learn more about the careers, people, and culture at Titan Company and apply to brands like Tanishq, Titan, Taneira, Fastrack, EyePlus, Mia, Zoya, and more."
        />
        <link rel="canonical" href="https://www.titancompany.in/careers" />
      </head>
      <body>
        <main>
          <h1>Career Opportunities at Titan Company</h1>
          <section>
            <h2>Current vacancies</h2>
            <a href="https://careers.titan.in/in/en/search-results">Current vacancies</a>
          </section>
          <section>
            <h2>Life at Titan</h2>
            <p>Working at Titan Company  Limited</p>
          </section>
        </main>
      </body>
    </html>
  `,
}

const titanCareersHomePage = {
  status: 200,
  url: 'https://careers.titan.in/in/en',
  html: `
    <!doctype html>
    <html lang="en" class="desktop en_in external">
      <head>
        <title>Careers at Titan | Titan jobs</title>
      </head>
      <body>
        <main>
          <a href="https://careers.titan.in/in/en/search-results">Search results</a>
          <h1>DREAM. DISCOVER. DESIGN</h1>
          <section>
            <h2>What makes us unique?</h2>
            <p>Career Paths We trust you to know how to pave career path.</p>
          </section>
          <section>
            <h2>Upload Resume</h2>
          </section>
          <section>
            <h2>Our Brands</h2>
            <p>The Timeless Tales of TITAN</p>
          </section>
        </main>
      </body>
    </html>
  `,
}

const currentTitanCareersHomePage = {
  status: 200,
  url: 'https://careers.titan.in/in/en',
  html: '<title>Careers at Titan | Titan jobs</title><a href="/in/en/search-results">Search results</a><h1>ream</h1><h2>What is it like to work with Titan?</h2><p>Career Paths</p><h2>Upload &#xa0; Resume</h2><h2>Our Brands</h2><p>The Timeless Tales of TITAN</p>',
}

const zeroJobsSearchPage = {
  status: 200,
  url: 'https://careers.titan.in/in/en/search-results',
  html: `
    <!doctype html>
    <html lang="en" class="desktop en_in external">
      <head>
        <title>Search results  | Find available job openings at Titan</title>
      </head>
      <body>
        <main>
          <h1>SEARCH RESULTS</h1>
          <h4>We couldn’t find any open positions for  "\${pageStateData.searchKeyword}"</h4>
          <h4>We couldn’t find any open positions for  "\${pageStateData.placeVal}"</h4>
          <h4>Sorry... no active job openings, please come back later.</h4>
          <ul>
            <li>Check your spelling</li>
            <li>Try more general keywords</li>
          </ul>
        </main>
      </body>
    </html>
  `,
}

const searchResultsWithOpeningsPage = {
  status: 200,
  url: 'https://careers.titan.in/in/en/search-results',
  html: `
    <!doctype html>
    <html lang="en" class="desktop en_in external">
      <head>
        <title>Search results  | Find available job openings at Titan</title>
      </head>
      <body>
        <main>
          <h1>SEARCH RESULTS</h1>
          <a href="/in/en/job/12345/store-manager-fastrack">Store Manager - Fastrack</a>
        </main>
      </body>
    </html>
  `,
}

const loadModule = async () => {
  try {
    return await import('../../scraper/fastrack/script.js')
  } catch {
    assert.fail('Expected Fastrack scraper module at ../../scraper/fastrack/script.js')
  }
}

test('Fastrack helpers stay pinned to the verified homepage careers handoff and Titan zero-openings public surface', async () => {
  const fastrack = await loadModule()

  assert.equal(fastrack.SOURCE, 'fastrack')
  assert.equal(fastrack.COMPANY_NAME, 'Fastrack')
  assert.equal(fastrack.OFFICIAL_BRAND_NAME, 'Fastrack')
  assert.equal(fastrack.HOMEPAGE_URL, 'https://www.fastrack.in/')
  assert.equal(fastrack.CAREERS_HANDOFF_URL, 'https://careers.titan.in/?rms=titan')
  assert.equal(fastrack.CAREERS_HOME_URL, 'https://careers.titan.in/in/en')
  assert.equal(fastrack.TITAN_CORPORATE_CAREERS_URL, 'https://www.titancompany.in/careers')
  assert.equal(fastrack.SEARCH_RESULTS_URL, 'https://careers.titan.in/in/en/search-results')
  assert.equal(fastrack.hasOfficialHomepageSignal(homepagePage), true)
  assert.equal(
    fastrack.extractCareersHandoffUrl(homepagePage.html),
    'https://careers.titan.in/?rms=titan',
  )
  assert.equal(fastrack.hasTitanCorporateCareersSignal(titanCorporateCareersPage), true)
  assert.equal(
    fastrack.extractCurrentVacanciesUrl(titanCorporateCareersPage.html),
    'https://careers.titan.in/in/en/search-results',
  )
  assert.equal(fastrack.hasTitanJobsHomeSignal(titanCareersHomePage), true)
  assert.equal(fastrack.hasTitanJobsHomeSignal(currentTitanCareersHomePage), true)
  assert.equal(fastrack.hasZeroJobsSignal(zeroJobsSearchPage), true)
  assert.equal(fastrack.hasPublicJobSignal(zeroJobsSearchPage.html), false)
  assert.equal(fastrack.hasPublicJobSignal(searchResultsWithOpeningsPage.html), true)
})

test('Fastrack returns no jobs while the verified brand and parent-company careers surfaces still show no active openings', async () => {
  const fastrack = await loadModule()
  const requestedUrls = []

  const jobs = await fastrack.createFastrackScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === fastrack.HOMEPAGE_URL) return homepagePage
      if (url === fastrack.TITAN_CORPORATE_CAREERS_URL) return titanCorporateCareersPage
      if (url === fastrack.CAREERS_HANDOFF_URL) return titanCareersHomePage
      if (url === fastrack.SEARCH_RESULTS_URL) return zeroJobsSearchPage

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    fastrack.HOMEPAGE_URL,
    fastrack.TITAN_CORPORATE_CAREERS_URL,
    fastrack.CAREERS_HANDOFF_URL,
    fastrack.SEARCH_RESULTS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Fastrack fails closed when the homepage handoff, Titan careers link, redirect target, or zero-openings shell drifts', async () => {
  const fastrack = await loadModule()

  await assert.rejects(
    fastrack.createFastrackScraper().run({
      fetchPage: async (url) => {
        if (url === fastrack.HOMEPAGE_URL) {
          return {
            ...homepagePage,
            html: homepagePage.html.replace('https://careers.titan.in/?rms=titan', 'https://careers.titan.in/jobs'),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified careers handoff/i,
  )

  await assert.rejects(
    fastrack.createFastrackScraper().run({
      fetchPage: async (url) => {
        if (url === fastrack.HOMEPAGE_URL) return homepagePage
        if (url === fastrack.TITAN_CORPORATE_CAREERS_URL) {
          return {
            ...titanCorporateCareersPage,
            html: titanCorporateCareersPage.html.replace(
              'https://careers.titan.in/in/en/search-results',
              'https://careers.titan.in/in/en/job/12345',
            ),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified current vacancies surface/i,
  )

  await assert.rejects(
    fastrack.createFastrackScraper().run({
      fetchPage: async (url) => {
        if (url === fastrack.HOMEPAGE_URL) return homepagePage
        if (url === fastrack.TITAN_CORPORATE_CAREERS_URL) return titanCorporateCareersPage
        if (url === fastrack.CAREERS_HANDOFF_URL) {
          return {
            ...titanCareersHomePage,
            url: 'https://careers.titan.in/in/en/jobs',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified parent careers home/i,
  )

  await assert.rejects(
    fastrack.createFastrackScraper().run({
      fetchPage: async (url) => {
        if (url === fastrack.HOMEPAGE_URL) return homepagePage
        if (url === fastrack.TITAN_CORPORATE_CAREERS_URL) return titanCorporateCareersPage
        if (url === fastrack.CAREERS_HANDOFF_URL) return titanCareersHomePage
        if (url === fastrack.SEARCH_RESULTS_URL) return searchResultsWithOpeningsPage

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public jobs surface now exposes openings/i,
  )
})
