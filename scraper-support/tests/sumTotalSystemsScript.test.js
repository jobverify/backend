import assert from 'node:assert/strict'
import test from 'node:test'

const redirectedHomepage = {
  status: 200,
  url: 'https://www.cornerstoneondemand.com/',
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <title>Cornerstone</title>
      </head>
      <body>
        <h1>Cornerstone Workforce AI</h1>
        <p>Trusted by over 7,000 organizations worldwide</p>
      </body>
    </html>
  `,
}

const redirectedCompanyPage = {
  status: 200,
  url: 'https://www.cornerstoneondemand.com/company/',
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <title>About us</title>
      </head>
      <body>
        <h1>We power potential</h1>
        <a href="https://www.cornerstoneondemand.com/careers/">Explore Open Positions</a>
      </body>
    </html>
  `,
}

const genericCornerstoneCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Cornerstone</title>
  </head>
  <body>
    <main>
      <h1>Tomorrow. Together.</h1>
      <a
        aria-label="Search for open positions at Cornerstone."
        href="https://cornerstone.csod.com/ux/ats/careersite/2/home?c=cornerstone"
      >
        Search Open Positions
      </a>
      <h2>Interested in a Career at Cornerstone?</h2>
      <p>careers@csod.com</p>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/sumtotalsystems/script.js')
  } catch {
    assert.fail('Expected SumTotal Systems scraper module at ../../scraper/sumtotalsystems/script.js')
  }
}

test('SumTotal Systems helpers stay pinned to the verified redirect into generic Cornerstone careers from Friday, July 17, 2026', async () => {
  const sumTotalSystems = await loadModule()

  assert.equal(sumTotalSystems.SOURCE, 'sumtotalsystems')
  assert.equal(sumTotalSystems.COMPANY, 'SumTotal Systems')
  assert.equal(sumTotalSystems.HOMEPAGE_URL, 'https://www.sumtotalsystems.com/')
  assert.equal(sumTotalSystems.ABOUT_URL, 'https://www.sumtotalsystems.com/about')
  assert.equal(sumTotalSystems.REDIRECT_HOMEPAGE_URL, 'https://www.cornerstoneondemand.com/')
  assert.equal(sumTotalSystems.REDIRECT_COMPANY_URL, 'https://www.cornerstoneondemand.com/company/')
  assert.equal(sumTotalSystems.PARENT_CAREERS_URL, 'https://www.cornerstoneondemand.com/careers/')
  assert.equal(
    sumTotalSystems.PARENT_OPEN_POSITIONS_URL,
    'https://cornerstone.csod.com/ux/ats/careersite/2/home?c=cornerstone',
  )
  assert.equal(sumTotalSystems.VERIFIED_ON, '2026-07-17')
  assert.equal(sumTotalSystems.hasRedirectedHomepageSignal(redirectedHomepage), true)
  assert.equal(sumTotalSystems.hasRedirectedCompanySignal(redirectedCompanyPage), true)
  assert.equal(sumTotalSystems.hasGenericCornerstoneCareersSignal(genericCornerstoneCareersHtml), true)
  assert.equal(
    sumTotalSystems.extractParentOpenPositionsUrl(genericCornerstoneCareersHtml),
    'https://cornerstone.csod.com/ux/ats/careersite/2/home?c=cornerstone',
  )
})

test('SumTotal Systems returns no jobs only while the exact-name surface still resolves to generic Cornerstone careers', async () => {
  const sumTotalSystems = await loadModule()
  const requestedUrls = []

  const jobs = await sumTotalSystems.createSumTotalSystemsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === sumTotalSystems.HOMEPAGE_URL) return redirectedHomepage
      if (url === sumTotalSystems.ABOUT_URL) return redirectedCompanyPage
      if (url === sumTotalSystems.PARENT_CAREERS_URL) {
        return { status: 200, url, html: genericCornerstoneCareersHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    sumTotalSystems.HOMEPAGE_URL,
    sumTotalSystems.ABOUT_URL,
    sumTotalSystems.PARENT_CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('SumTotal Systems default fetch path uses bounded abort signals for each page request', async () => {
  const sumTotalSystems = await loadModule()
  const originalFetch = globalThis.fetch
  const originalTimeout = AbortSignal.timeout
  const requestedUrls = []
  const timeoutMs = []
  const timeoutSignals = []

  AbortSignal.timeout = (ms) => {
    timeoutMs.push(ms)
    const signal = new AbortController().signal
    timeoutSignals.push(signal)
    return signal
  }

  globalThis.fetch = async (url, options = {}) => {
    requestedUrls.push(url)
    const expectedSignal = timeoutSignals.at(-1)

    assert.ok(expectedSignal, 'expected default fetch to request a timeout signal')
    assert.equal(options.signal, expectedSignal)

    if (url === sumTotalSystems.HOMEPAGE_URL) {
      return {
        status: redirectedHomepage.status,
        url: redirectedHomepage.url,
        text: async () => redirectedHomepage.html,
      }
    }

    if (url === sumTotalSystems.ABOUT_URL) {
      return {
        status: redirectedCompanyPage.status,
        url: redirectedCompanyPage.url,
        text: async () => redirectedCompanyPage.html,
      }
    }

    if (url === sumTotalSystems.PARENT_CAREERS_URL) {
      return {
        status: 200,
        url,
        text: async () => genericCornerstoneCareersHtml,
      }
    }

    throw new Error(`Unexpected URL: ${url}`)
  }

  try {
    const jobs = await sumTotalSystems.createSumTotalSystemsScraper().run()

    assert.deepEqual(requestedUrls, [
      sumTotalSystems.HOMEPAGE_URL,
      sumTotalSystems.ABOUT_URL,
      sumTotalSystems.PARENT_CAREERS_URL,
    ])
    assert.deepEqual(timeoutMs, [15000, 15000, 15000])
    assert.deepEqual(jobs, [])
  } finally {
    globalThis.fetch = originalFetch
    AbortSignal.timeout = originalTimeout
  }
})

test('SumTotal Systems fails closed when the redirect chain or generic parent careers contract drifts', async () => {
  const sumTotalSystems = await loadModule()

  await assert.rejects(
    sumTotalSystems.createSumTotalSystemsScraper().run({
      fetchPage: async (url) => {
        if (url === sumTotalSystems.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }
        if (url === sumTotalSystems.ABOUT_URL) return redirectedCompanyPage
        return { status: 200, url, html: genericCornerstoneCareersHtml }
      },
    }),
    /verified SumTotal Systems root redirect/i,
  )

  await assert.rejects(
    sumTotalSystems.createSumTotalSystemsScraper().run({
      fetchPage: async (url) => {
        if (url === sumTotalSystems.HOMEPAGE_URL) return redirectedHomepage
        if (url === sumTotalSystems.ABOUT_URL) {
          return {
            status: 200,
            url: 'https://www.cornerstoneondemand.com/company/',
            html: '<html><body><h1>We power potential</h1></body></html>',
          }
        }
        return { status: 200, url, html: genericCornerstoneCareersHtml }
      },
    }),
    /verified SumTotal Systems about redirect/i,
  )

  await assert.rejects(
    sumTotalSystems.createSumTotalSystemsScraper().run({
      fetchPage: async (url) => {
        if (url === sumTotalSystems.HOMEPAGE_URL) return redirectedHomepage
        if (url === sumTotalSystems.ABOUT_URL) return redirectedCompanyPage
        if (url === sumTotalSystems.PARENT_CAREERS_URL) {
          return {
            status: 200,
            url,
            html: genericCornerstoneCareersHtml.replace(
              'https://cornerstone.csod.com/ux/ats/careersite/2/home?c=cornerstone',
              'https://example.com/jobs',
            ),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /generic Cornerstone careers surface/i,
  )
})
