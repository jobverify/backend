import assert from 'node:assert/strict'
import test from 'node:test'

const loadZeptoModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Zepto scraper module at ./script.js')
  }
}

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Welcome to Zepto, India's Fastest Online Grocery Delivery App!</title>
    </head>
    <body>
      <main>
        <section>
          <h2>How it Works</h2>
          <h3>Get free delivery</h3>
          <p>Experience lighting-fast speed &amp; get all your items delivered in minutes</p>
        </section>
        <footer>
          <p>&copy; Zepto Marketplace Private Limited</p>
          <nav>
            <a href="/delivery-areas">Delivery Areas</a>
            <a href="/careers">Careers</a>
            <a href="/support">Customer Support</a>
          </nav>
          <h3>Download App</h3>
        </footer>
      </main>
    </body>
  </html>
`

const currentHomepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Zepto: Online Grocery Delivery App - Groceries in Minutes</title>
    </head>
    <body>
      <main>
        <section>
          <h2>How it Works</h2>
          <p>Experience lighting-fast speed &amp; get all your items delivered in minutes</p>
        </section>
        <footer>
          <nav>
            <a href="/careers">Careers</a>
          </nav>
        </footer>
      </main>
    </body>
  </html>
`

const careersRedirectPage = {
  status: 308,
  url: 'https://www.zepto.com/careers',
  headers: {
    location: 'https://zepto.talentrecruit.com/career-page',
    refresh: '0;url=https://zepto.talentrecruit.com/career-page',
  },
  html: 'https://zepto.talentrecruit.com/career-page',
}

const careersAliasRedirectPage = {
  status: 308,
  url: 'https://www.zepto.com/careers/',
  headers: {
    location: '/careers',
    refresh: '0;url=/careers',
  },
  html: '/careers',
}

const awsWafCareersPage = {
  status: 202,
  url: 'https://www.zepto.com/careers',
  headers: {},
  html: `
    <!doctype html>
    <html lang="en">
      <head><title></title></head>
      <body>
        <script type="text/javascript">
          window.awsWafCookieDomainList = ['zepto.com','zepto.co.in','zeptonow.com'];
        </script>
      </body>
    </html>
  `,
}

const awsWafCareersAliasPage = {
  ...awsWafCareersPage,
  url: 'https://www.zepto.com/careers/',
}

test('Zepto sentinel pins the verified first-party homepage and current careers redirect contract', async () => {
  const zepto = await loadZeptoModule()

  assert.equal(zepto.SOURCE, 'zepto')
  assert.equal(zepto.COMPANY, 'Zepto')
  assert.equal(zepto.HOMEPAGE_URL, 'https://www.zepto.com/')
  assert.equal(zepto.CAREERS_URL, 'https://www.zepto.com/careers')
  assert.equal(zepto.CAREERS_ALIAS_URL, 'https://www.zepto.com/careers/')
  assert.equal(zepto.APPLY_URL, 'https://zepto.talentrecruit.com/career-page')
  assert.equal(
    zepto.BLOCKED_REASON,
    'Official Zepto careers route redirects to a third-party TalentRecruit board, so there is no first-party public jobs surface to scrape.',
  )
  assert.equal(zepto.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(zepto.hasOfficialHomepageSignal(currentHomepageHtml), true)
  assert.equal(zepto.extractCareersUrl(homepageHtml), 'https://www.zepto.com/careers')
  assert.equal(zepto.isKnownCareersAliasRedirect(careersAliasRedirectPage), true)
  assert.equal(zepto.isBlockedThirdPartyCareersHandoff(careersRedirectPage), true)
  assert.equal(zepto.isBlockedAwsWafCareersInterstitial(awsWafCareersPage), true)
})

test('Zepto sentinel returns no jobs only while the official first-party careers routes keep the known blocked handoff', async () => {
  const zepto = await loadZeptoModule()
  const requestedUrls = []

  const jobs = await zepto.createZeptoScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === zepto.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          headers: {},
          html: homepageHtml,
        }
      }

      if (url === zepto.CAREERS_URL) {
        return careersRedirectPage
      }

      if (url === zepto.CAREERS_ALIAS_URL) {
        return careersAliasRedirectPage
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    zepto.HOMEPAGE_URL,
    zepto.CAREERS_URL,
    zepto.CAREERS_ALIAS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Zepto sentinel returns no jobs when the careers routes are blocked by the current AWS WAF interstitial', async () => {
  const zepto = await loadZeptoModule()

  const jobs = await zepto.createZeptoScraper().run({
    fetchPage: async (url) => {
      if (url === zepto.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          headers: {},
          html: currentHomepageHtml,
        }
      }

      if (url === zepto.CAREERS_URL) {
        return awsWafCareersPage
      }

      if (url === zepto.CAREERS_ALIAS_URL) {
        return awsWafCareersAliasPage
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('Zepto sentinel returns no jobs when the homepage and careers routes are blocked by the current AWS WAF interstitial', async () => {
  const zepto = await loadZeptoModule()

  const jobs = await zepto.createZeptoScraper().run({
    fetchPage: async (url) => {
      if (url === zepto.HOMEPAGE_URL) {
        return {
          status: 202,
          url,
          headers: {},
          html: awsWafCareersPage.html,
        }
      }

      if (url === zepto.CAREERS_URL) {
        return awsWafCareersPage
      }

      if (url === zepto.CAREERS_ALIAS_URL) {
        return awsWafCareersAliasPage
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('Zepto sentinel fails closed when the homepage stops linking to the verified official careers route', async () => {
  const zepto = await loadZeptoModule()

  await assert.rejects(
    zepto.createZeptoScraper().run({
      fetchPage: async (url) => {
        if (url === zepto.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: homepageHtml.replace('href="/careers"', 'href="/jobs"'),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official careers route/i,
  )
})

test('Zepto sentinel fails closed when the canonical careers route becomes a public job board or changes handoff shape', async () => {
  const zepto = await loadZeptoModule()

  await assert.rejects(
    zepto.createZeptoScraper().run({
      fetchPage: async (url) => {
        if (url === zepto.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: homepageHtml,
          }
        }

        if (url === zepto.CAREERS_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: `
              <html>
                <body>
                  <h1>Current Openings</h1>
                  <a href="/careers/software-engineer">Apply now</a>
                </body>
              </html>
            `,
          }
        }

        if (url === zepto.CAREERS_ALIAS_URL) {
          return careersAliasRedirectPage
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /now appears to expose first-party public jobs/i,
  )
})

test('Zepto sentinel fails closed when the trailing-slash alias stops redirecting to the canonical careers route', async () => {
  const zepto = await loadZeptoModule()

  await assert.rejects(
    zepto.createZeptoScraper().run({
      fetchPage: async (url) => {
        if (url === zepto.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: homepageHtml,
          }
        }

        if (url === zepto.CAREERS_URL) {
          return careersRedirectPage
        }

        if (url === zepto.CAREERS_ALIAS_URL) {
          return {
            ...careersAliasRedirectPage,
            headers: {
              location: '/jobs',
              refresh: '0;url=/jobs',
            },
            html: '/jobs',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /trailing-slash careers alias/i,
  )
})
