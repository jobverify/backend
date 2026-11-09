import assert from 'node:assert/strict'
import test from 'node:test'

const verifiedCyberArkCareersHtml = `
<!doctype html>
<html>
  <head>
    <title>Careers | CyberArk</title>
  </head>
  <body>
    <h2>Find your opportunity</h2>
    <p>CyberArk is now a Palo Alto Networks company. Check the Palo Alto Networks career site for all opportunities!</p>
    <a href="https://jobs.paloaltonetworks.com/en/">Search All Jobs</a>
  </body>
</html>
`

const redirectedCyberArkCareersHtml = `
<!doctype html>
<html>
  <head>
    <title>Idira | The Identity Security Platform - Palo Alto Networks</title>
    <meta
      name="description"
      content="Protect your organization with Idira. Modernize identity governance, automate access reviews, and secure every identity across your hybrid cloud environment."
    />
    <link rel="canonical" href="https://www.paloaltonetworks.com/idira" />
  </head>
  <body>
    <h1>Idira</h1>
    <p>Identity Security Platform</p>
    <p>Protect your organization with Idira.</p>
    <footer>
      <a href="https://jobs.paloaltonetworks.com/en/" target="_blank" rel="noopener">Careers</a>
    </footer>
  </body>
</html>
`

const verifiedPaloAltoIndiaHtml = `
<!doctype html>
<html>
  <head>
    <title>Explore Cybersecurity Careers and Jobs at Palo Alto Networks India</title>
  </head>
  <body>
    <p>India Location</p>
    <h1>Center of Excellence</h1>
    <p>
      Palo Alto Networks India boasts state-of-the-art technology centers located in Bengaluru,
      Gurgaon, and Pune.
    </p>
    <h2>Latest Jobs in India</h2>
  </body>
</html>
`

const redirectedPaloAltoIndiaErrorHtml = `
<!doctype html>
<html>
  <head>
    <title>Error</title>
  </head>
  <body>
    <nav>
      <p>Locations</p>
      <p>EMEA</p>
      <p>India</p>
      <p>Israel</p>
      <p>JAPAC</p>
      <p>Japan</p>
      <p>LATAM</p>
      <p>North America</p>
    </nav>
    <h1>Error</h1>
    <p>An error has occurred. Please use your browser back button to return to the previous page, start a new search above, or go back to the homepage.</p>
    <section>
      <h2>Featured Jobs</h2>
      <h2>Recently Viewed Jobs</h2>
    </section>
  </body>
</html>
`

const verifiedPaloAltoIndiaSearchHtml = `
<!doctype html>
<html>
  <head>
    <title>Search our Job Opportunities at Palo Alto Networks</title>
  </head>
  <body>
    <p>Job Search Results</p>
    <h1>Define what’s next in cybersecurity.</h1>
    <section>
      <h2>Filtered by</h2>
      <p>Country: India</p>
    </section>
    <section>
      <p>Bengaluru</p>
      <p>Mumbai</p>
      <p>New Delhi</p>
      <p>Pune</p>
    </section>
    <p>Clear All Filters</p>
  </body>
</html>
`

const loadCyberArkIndiaModule = async () => {
  try {
    return await import('../../scraper/cyberarkindia/script.js')
  } catch {
    assert.fail('Expected CyberArk India scraper module at ../../scraper/cyberarkindia/script.js')
  }
}

test('CyberArk India sentinel recognizes the verified CyberArk-to-Palo-Alto careers handoff', async () => {
  const cyberArkIndia = await loadCyberArkIndiaModule()

  assert.equal(cyberArkIndia.SOURCE, 'cyberarkindia')
  assert.equal(cyberArkIndia.COMPANY, 'CyberArk India')
  assert.equal(cyberArkIndia.CYBERARK_CAREERS_URL, 'https://www.cyberark.com/careers/')
  assert.equal(cyberArkIndia.PALO_ALTO_JOBS_HOME_URL, 'https://jobs.paloaltonetworks.com/en/')
  assert.equal(cyberArkIndia.PALO_ALTO_INDIA_URL, 'https://jobs.paloaltonetworks.com/en/india')
  assert.equal(
    cyberArkIndia.PALO_ALTO_INDIA_SEARCH_URL,
    'https://jobs.paloaltonetworks.com/en/search-jobs/?alcpm=1269750&orgIds=47263',
  )
  assert.equal(cyberArkIndia.hasCyberArkCareersHandoffSignal(verifiedCyberArkCareersHtml), true)
  assert.equal(cyberArkIndia.hasPaloAltoIndiaLocationSignal(verifiedPaloAltoIndiaHtml), true)
  assert.equal(cyberArkIndia.hasPaloAltoIndiaErrorFallbackSignal({
    html: redirectedPaloAltoIndiaErrorHtml,
    finalUrl: 'https://jobs.paloaltonetworks.com/en/error',
  }), true)
  assert.equal(cyberArkIndia.hasExpectedIndiaSearchHandoff(verifiedPaloAltoIndiaHtml), false)
  assert.equal(cyberArkIndia.hasPaloAltoIndiaSearchSignal(verifiedPaloAltoIndiaSearchHtml), true)
  assert.equal(cyberArkIndia.hasCyberArkSpecificJobsSignal(verifiedPaloAltoIndiaSearchHtml), false)
  assert.equal(
    cyberArkIndia.hasCyberArkSpecificJobsSignal('<html><body><h1>CyberArk Jobs in India</h1></body></html>'),
    true,
  )
})

test('CyberArk India sentinel returns [] only while the verified official handoff remains unchanged', async () => {
  const cyberArkIndia = await loadCyberArkIndiaModule()
  const requestedUrls = []

  const jobs = await cyberArkIndia.createCyberArkIndiaScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === cyberArkIndia.CYBERARK_CAREERS_URL) {
        return {
          status: 200,
          url,
          headers: {},
          html: verifiedCyberArkCareersHtml,
        }
      }

      if (url === cyberArkIndia.PALO_ALTO_INDIA_URL) {
        return {
          status: 200,
          url,
          headers: {},
          html: verifiedPaloAltoIndiaHtml,
        }
      }

      if (url === cyberArkIndia.PALO_ALTO_INDIA_SEARCH_URL) {
        return {
          status: 200,
          url,
          headers: {},
          html: verifiedPaloAltoIndiaSearchHtml,
        }
      }

      throw new Error(`Unexpected CyberArk India URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    cyberArkIndia.CYBERARK_CAREERS_URL,
    cyberArkIndia.PALO_ALTO_INDIA_URL,
    cyberArkIndia.PALO_ALTO_INDIA_SEARCH_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('CyberArk India sentinel accepts the current Friday, August 7, 2026 redirect-based CyberArk-to-Palo-Alto handoff', async () => {
  const cyberArkIndia = await loadCyberArkIndiaModule()
  const requestedUrls = []

  const jobs = await cyberArkIndia.createCyberArkIndiaScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === cyberArkIndia.CYBERARK_CAREERS_URL) {
        return {
          status: 200,
          url: 'https://www.paloaltonetworks.com/idira',
          headers: {},
          html: redirectedCyberArkCareersHtml,
        }
      }

      if (url === cyberArkIndia.PALO_ALTO_INDIA_URL) {
        return {
          status: 200,
          url: 'https://jobs.paloaltonetworks.com/en/error',
          headers: {},
          html: redirectedPaloAltoIndiaErrorHtml,
        }
      }

      if (url === cyberArkIndia.PALO_ALTO_INDIA_SEARCH_URL) {
        return {
          status: 200,
          url,
          headers: {},
          html: verifiedPaloAltoIndiaSearchHtml,
        }
      }

      throw new Error(`Unexpected CyberArk India URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    cyberArkIndia.CYBERARK_CAREERS_URL,
    cyberArkIndia.PALO_ALTO_INDIA_URL,
    cyberArkIndia.PALO_ALTO_INDIA_SEARCH_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('CyberArk India sentinel fails closed when the handoff drifts or a CyberArk-specific jobs board appears', async () => {
  const cyberArkIndia = await loadCyberArkIndiaModule()

  await assert.rejects(
    cyberArkIndia.createCyberArkIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === cyberArkIndia.CYBERARK_CAREERS_URL) {
          return { status: 200, url, headers: {}, html: '<html><title>Unexpected</title></html>' }
        }

        return { status: 200, url, headers: {}, html: verifiedPaloAltoIndiaSearchHtml }
      },
    }),
    /verified official cyberark careers surface/i,
  )

  await assert.rejects(
    cyberArkIndia.createCyberArkIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === cyberArkIndia.CYBERARK_CAREERS_URL) {
          return { status: 200, url, headers: {}, html: verifiedCyberArkCareersHtml }
        }

        if (url === cyberArkIndia.PALO_ALTO_INDIA_URL) {
          return { status: 200, url, headers: {}, html: '<html><title>Unexpected</title></html>' }
        }

        return { status: 200, url, headers: {}, html: verifiedPaloAltoIndiaSearchHtml }
      },
    }),
    /verified palo alto networks india location page/i,
  )

  await assert.rejects(
    cyberArkIndia.createCyberArkIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === cyberArkIndia.CYBERARK_CAREERS_URL) {
          return { status: 200, url, headers: {}, html: verifiedCyberArkCareersHtml }
        }

        if (url === cyberArkIndia.PALO_ALTO_INDIA_URL) {
          return { status: 200, url, headers: {}, html: verifiedPaloAltoIndiaHtml }
        }

        return {
          status: 200,
          url,
          headers: {},
          html: verifiedPaloAltoIndiaSearchHtml.replace(
            '</body>',
            '<h2>CyberArk Jobs in India</h2><a href="/en/search-jobs/cyberark-india">View CyberArk jobs</a></body>',
          ),
        }
      },
    }),
    /parent india jobs surface changed materially or now exposes a cyberark-specific public jobs surface/i,
  )
})
