import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>India's Biggest Fantasy Sports Platform: Play for Free. Win Big.</title>
    <link rel="canonical" href="https://www.dream11.com/" />
  </head>
  <body>
    <footer>
      <a href="https://www.dreamsports.group/">About</a>
      <a href="https://www.dreamsports.group/careers/" target="_blank">Careers</a>
      <div>Sporta Technologies Private Limited</div>
    </footer>
  </body>
</html>
`

const currentHomepageHtml = `
<!doctype html>
<html lang="en-IN">
  <head>
    <meta property="og:title" content="Dream11 - Play Fantasy Cricket for FREE" />
    <meta
      name="description"
      content="India's #1 fantasy cricket platform — FREE to play. Play fantasy cricket for FREE - Use your skill, pick players and join contests. 25 Cr+ users. Download the Dream11 app now."
    />
    <link rel="canonical" href="https://www.dream11.com/" />
  </head>
  <body>
    <footer>
      <div tabindex="0" role="link"><p>About</p></div>
      <div tabindex="0" role="link"><p>Careers</p></div>
      <div tabindex="0" role="link"><p>Helpdesk</p></div>
      <div>Sporta Technologies Private Limited. 7th Floor, Ascent, Sudam Kalu Ahire Marg, Worli, Mumbai Maharashtra 400030</div>
      <p>India's Biggest Fantasy Sports Platform: Play for Free. Win Big.</p>
    </footer>
  </body>
</html>
`

const parentCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>DreamSports</title>
    <link rel="canonical" href="https://www.dreamsports.group/careers" />
  </head>
  <body>
    <nav>
      <a href="https://www.dream11.com/">Dream11</a>
      <a href="/careers">LIFE AT DREAM SPORTS</a>
    </nav>
    <main>
      <h1>Game On. Build Big.</h1>
      <p>Solving real problems across sports, technology, and financial empowerment.</p>
      <section>
        <h2>Hear from our Sportans</h2>
        <article>
          <h3>Software Development Engineer II - ML Platform, Dream11</h3>
          <p>Swapnesh Kumar</p>
        </article>
        <article>
          <h3>Research Scientist, Dream11</h3>
          <p>Srilakshmi Madiraju</p>
        </article>
      </section>
      <address>Sporta Technologies Pvt Ltd, Unit 1201-1202, ONE BKC, Bandra (E), Mumbai 400051.</address>
    </main>
  </body>
</html>
`

const currentParentCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta property="og:title" content="DreamSports" />
    <link rel="canonical" href="https://www.dreamsports.group/careers" />
  </head>
  <body>
    <nav>
      <a href="https://www.dream11.com/">Dream11</a>
      <a href="/careers">LIFE AT DREAM SPORTS</a>
    </nav>
    <main>
      <h1>Game On. Build Big.</h1>
      <p>Solving real problems across sports, technology, and financial empowerment.</p>
      <section>
        <h2>Benefits</h2>
        <p>Comprehensive health, accident, and life insurance that looks after you and your family.</p>
      </section>
      <address>Sporta Technologies Pvt Ltd, Unit 1201-1202, ONE BKC, Bandra (E), Mumbai 400051.</address>
    </main>
  </body>
</html>
`

const parent404Html = `
<!doctype html>
<html lang="en">
  <head>
    <title>DreamSports</title>
  </head>
  <body>
    <h1>404</h1>
    <p>Page Not Found</p>
  </body>
</html>
`

const dream11Route404Html = `
<!doctype html>
<html lang="en">
  <head>
    <title>Fantasy Cricket Daily, Login & Play Online | Dream11 India</title>
  </head>
  <body>
    <h1>404</h1>
  </body>
</html>
`

const trustworthyJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Dream Sports Jobs</title>
  </head>
  <body>
    <main>
      <h1>Open Positions</h1>
      <a href="https://boards.greenhouse.io/dreamsports/jobs/123">Apply Now</a>
    </main>
  </body>
</html>
`

const hiddenBoardScriptHtml = `
<!doctype html>
<html lang="en">
  <body>
    <script>window.__debug = "https://jobs.lever.co/dreamsports"</script>
    <main>
      <h1>Game On. Build Big.</h1>
      <p>No public jobs are listed here.</p>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/dream11/script.js')
  } catch {
    assert.fail('Expected Dream11 scraper module at ../../scraper/dream11/script.js')
  }
}

test('Dream11 constants and helpers stay pinned to the verified parent-brand careers handoff', async () => {
  const dream11 = await loadModule()

  assert.equal(dream11.COMPANY, 'Dream11')
  assert.equal(dream11.OFFICIAL_BRAND_NAME, 'Dream11')
  assert.equal(dream11.PARENT_COMPANY_NAME, 'Dream Sports')
  assert.equal(dream11.SOURCE, 'dream11')
  assert.equal(dream11.VERIFIED_AT, '2026-08-07')
  assert.equal(dream11.HOMEPAGE_URL, 'https://www.dream11.com/')
  assert.equal(dream11.PARENT_CAREERS_URL, 'https://www.dreamsports.group/careers')
  assert.equal(
    dream11.PARENT_CAREERS_LANDING_URL,
    'https://www.dreamsports.group/lifeatdreamsports',
  )
  assert.equal(dream11.LINKED_CAREERS_URL, 'https://www.dreamsports.group/careers/')
  assert.deepEqual(dream11.DREAM11_REDIRECT_ROUTE_URLS, [
    'https://www.dream11.com/careers',
    'https://www.dream11.com/careers/',
    'https://www.dream11.com/jobs',
    'https://www.dream11.com/join-us',
  ])
  assert.deepEqual(dream11.DREAM11_MISSING_ROUTE_URLS, [
    'https://www.dream11.com/about-us/careers',
  ])
  assert.deepEqual(dream11.PARENT_MISSING_ROUTE_URLS, [
    'https://www.dreamsports.group/jobs',
    'https://www.dreamsports.group/openings',
    'https://www.dreamsports.group/careers/jobs',
    'https://www.dreamsports.group/careers/openings',
    'https://www.dreamsports.group/lifeatdreamsports/jobs',
    'https://www.dreamsports.group/lifeatdreamsports/openings',
    'https://www.dreamsports.group/lifeatdreamsports/careers',
  ])

  assert.equal(dream11.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(dream11.hasOfficialHomepageSignal(currentHomepageHtml), true)
  assert.equal(
    dream11.extractParentCareersUrlFromHomepage(homepageHtml),
    'https://www.dreamsports.group/careers/',
  )
  assert.equal(
    dream11.extractParentCareersUrlFromHomepage(currentHomepageHtml),
    null,
  )
  assert.equal(
    dream11.isVerifiedDream11RedirectedNoTrustRoute(
      {
        status: 200,
        url: dream11.HOMEPAGE_URL,
        html: homepageHtml,
      },
      dream11.DREAM11_REDIRECT_ROUTE_URLS[0],
    ),
    true,
  )
  assert.equal(
    dream11.isVerifiedMissingRoute(
      {
        status: 404,
        url: dream11.DREAM11_MISSING_ROUTE_URLS[0],
        html: dream11Route404Html,
      },
      dream11.DREAM11_MISSING_ROUTE_URLS[0],
    ),
    true,
  )
  assert.equal(dream11.hasParentCareersLandingSignal(parentCareersHtml), true)
  assert.equal(dream11.hasParentCareersLandingSignal(currentParentCareersHtml), true)
  assert.equal(dream11.hasPublicJobSignal(parentCareersHtml), false)
  assert.equal(dream11.hasPublicJobSignal(currentParentCareersHtml), false)
  assert.equal(dream11.hasPublicJobSignal(hiddenBoardScriptHtml), false)
  assert.equal(
    dream11.isVerifiedMissingRoute(
      {
        status: 404,
        url: dream11.PARENT_MISSING_ROUTE_URLS[0],
        html: parent404Html,
      },
      dream11.PARENT_MISSING_ROUTE_URLS[0],
    ),
    true,
  )
})

test('Dream11 returns no jobs only while the verified Dream Sports careers handoff stays non-actionable', async () => {
  const dream11 = await loadModule()
  const requestedUrls = []

  const jobs = await dream11.createDream11Scraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === dream11.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (dream11.DREAM11_REDIRECT_ROUTE_URLS.includes(url)) {
        return { status: 200, url: dream11.HOMEPAGE_URL, html: homepageHtml }
      }

      if (dream11.DREAM11_MISSING_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: dream11Route404Html }
      }

      if (url === dream11.PARENT_CAREERS_URL) {
        return {
          status: 200,
          url: dream11.PARENT_CAREERS_LANDING_URL,
          html: parentCareersHtml,
        }
      }

      if (dream11.PARENT_MISSING_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: parent404Html }
      }

      throw new Error(`Unexpected Dream11 URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    dream11.HOMEPAGE_URL,
    ...dream11.DREAM11_REDIRECT_ROUTE_URLS,
    ...dream11.DREAM11_MISSING_ROUTE_URLS,
    dream11.PARENT_CAREERS_URL,
    ...dream11.PARENT_MISSING_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Dream11 fails closed when the homepage, handoff, or alternate routes drift into public jobs', async () => {
  const dream11 = await loadModule()

  await assert.rejects(
    dream11.createDream11Scraper().run({
      fetchPage: async (url) => {
        if (url === dream11.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><title>Dream11</title></html>' }
        }

        throw new Error(`Unexpected Dream11 URL: ${url}`)
      },
    }),
    /verified official Dream11 homepage/i,
  )

  await assert.rejects(
    dream11.createDream11Scraper().run({
      fetchPage: async (url) => {
        if (url === dream11.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === dream11.DREAM11_REDIRECT_ROUTE_URLS[0]) {
          return { status: 200, url, html: homepageHtml }
        }

        if (dream11.DREAM11_REDIRECT_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 200, url: dream11.HOMEPAGE_URL, html: homepageHtml }
        }

        throw new Error(`Unexpected Dream11 URL: ${url}`)
      },
    }),
    /verified Dream11 no-trust route changed/i,
  )

  await assert.rejects(
    dream11.createDream11Scraper().run({
      fetchPage: async (url) => {
        if (url === dream11.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (dream11.DREAM11_REDIRECT_ROUTE_URLS.includes(url)) {
          return { status: 200, url: dream11.HOMEPAGE_URL, html: homepageHtml }
        }

        if (dream11.DREAM11_MISSING_ROUTE_URLS.includes(url)) {
          return { status: 404, url, html: dream11Route404Html }
        }

        if (url === dream11.PARENT_CAREERS_URL) {
          return {
            status: 200,
            url: dream11.PARENT_CAREERS_LANDING_URL,
            html: trustworthyJobsHtml,
          }
        }

        throw new Error(`Unexpected Dream11 URL: ${url}`)
      },
    }),
    /verified Dream Sports careers landing page|public jobs/i,
  )

  await assert.rejects(
    dream11.createDream11Scraper().run({
      fetchPage: async (url) => {
        if (url === dream11.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (dream11.DREAM11_REDIRECT_ROUTE_URLS.includes(url)) {
          return { status: 200, url: dream11.HOMEPAGE_URL, html: homepageHtml }
        }

        if (dream11.DREAM11_MISSING_ROUTE_URLS.includes(url)) {
          return { status: 404, url, html: dream11Route404Html }
        }

        if (url === dream11.PARENT_CAREERS_URL) {
          return {
            status: 200,
            url: dream11.PARENT_CAREERS_LANDING_URL,
            html: parentCareersHtml,
          }
        }

        if (url === dream11.PARENT_MISSING_ROUTE_URLS[0]) {
          return { status: 200, url, html: trustworthyJobsHtml }
        }

        if (dream11.PARENT_MISSING_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 404, url, html: parent404Html }
        }

        throw new Error(`Unexpected Dream11 URL: ${url}`)
      },
    }),
    /verified Dream11 or Dream Sports alternate job route changed/i,
  )
})
