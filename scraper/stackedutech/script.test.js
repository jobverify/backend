import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const verifiedRedirectPage = {
  status: 301,
  url: 'http://stackedutech.com/',
  location: 'https://superglasscharlottesville.com/headlight-restoration.html/',
  html: `
    <html>
      <head><title>301 Moved Permanently</title></head>
      <body>
        <h1>Moved Permanently</h1>
      </body>
    </html>
  `,
}

const verifiedMissingRoutePage = (url) => ({
  status: 404,
  url,
  html: `
    <!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">
    <html>
      <head><title>404 Not Found</title></head>
      <body>
        <h1>Not Found</h1>
        <p>The requested URL was not found on this server.</p>
        <p>Additionally, a 404 Not Found error was encountered while trying to use an ErrorDocument to handle the request.</p>
      </body>
    </html>
  `,
})

const verifiedRobotsTxt = `
# As a condition of accessing this website, you agree to abide by the following
# content signals:
#
# search:   building a search index and providing search results.
# ai-input: inputting content into one or more AI models.
# ai-train: training or fine-tuning AI models.
User-agent: *
Disallow:
`

const surfacedJobsPage = {
  status: 200,
  url: 'http://stackedutech.com/careers',
  html: `
    <html>
      <head><title>Careers | StackEdutech</title></head>
      <body>
        <h1>Current openings</h1>
        <a href="/apply">Apply now</a>
      </body>
    </html>
  `,
}

test('StackEdutech sentinel helpers stay pinned to the verified redirect and missing-jobs contract', async () => {
  const stackedutech = await loadModule()
  assert.ok(stackedutech, 'Expected StackEdutech scraper module at ./script.js')

  assert.equal(stackedutech.SOURCE, 'stackedutech')
  assert.equal(stackedutech.COMPANY, 'StackEdutech')
  assert.equal(stackedutech.HOMEPAGE_URL, 'http://stackedutech.com/')
  assert.equal(stackedutech.WWW_HOMEPAGE_URL, 'http://www.stackedutech.com/')
  assert.equal(
    stackedutech.EXPECTED_REDIRECT_URL,
    'https://superglasscharlottesville.com/headlight-restoration.html/',
  )
  assert.equal(stackedutech.ROBOTS_URL, 'https://stackedutech.com/robots.txt')
  assert.deepEqual(stackedutech.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'http://stackedutech.com/careers',
    'http://stackedutech.com/jobs',
  ])
  assert.equal(stackedutech.isVerifiedHomepageRedirect(verifiedRedirectPage), true)
  assert.equal(stackedutech.isVerifiedHomepageRedirect({
    ...verifiedRedirectPage,
    location: 'https://stackedutech.com/careers',
  }), false)
  assert.equal(
    stackedutech.isVerifiedMissingCareersRoute(verifiedMissingRoutePage('http://stackedutech.com/careers')),
    true,
  )
  assert.equal(stackedutech.isVerifiedMissingCareersRoute(surfacedJobsPage), false)
  assert.equal(stackedutech.hasVerifiedRobotsTxt(verifiedRobotsTxt), true)
  assert.equal(stackedutech.hasPublicJobsSignal(verifiedRobotsTxt), false)
  assert.equal(stackedutech.hasPublicJobsSignal(surfacedJobsPage.html), true)
})

test('run returns [] only while the StackEdutech first-party surface remains an unrelated redirect with missing jobs routes', async () => {
  const stackedutech = await loadModule()
  assert.ok(stackedutech, 'Expected StackEdutech scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await stackedutech.createStackEdutechScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === stackedutech.HOMEPAGE_URL || url === stackedutech.WWW_HOMEPAGE_URL) {
        return {
          ...verifiedRedirectPage,
          url,
        }
      }

      if (stackedutech.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return verifiedMissingRoutePage(url)
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchText: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, stackedutech.ROBOTS_URL)
      return verifiedRobotsTxt
    },
  })

  assert.deepEqual(requestedUrls, [
    stackedutech.HOMEPAGE_URL,
    stackedutech.WWW_HOMEPAGE_URL,
    stackedutech.ROBOTS_URL,
    ...stackedutech.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('default StackEdutech fetches pass AbortSignal so live probes are bounded', async () => {
  const stackedutech = await loadModule()
  assert.ok(stackedutech, 'Expected StackEdutech scraper module at ./script.js')

  const originalFetch = globalThis.fetch
  const requestedUrls = []
  const signals = []

  globalThis.fetch = async (url, options = {}) => {
    requestedUrls.push(String(url))
    signals.push(options.signal)

    if (url === stackedutech.HOMEPAGE_URL || url === stackedutech.WWW_HOMEPAGE_URL) {
      return new Response(verifiedRedirectPage.html, {
        status: verifiedRedirectPage.status,
        headers: {
          location: verifiedRedirectPage.location,
        },
      })
    }

    if (url === stackedutech.ROBOTS_URL) {
      return new Response(verifiedRobotsTxt, { status: 200 })
    }

    if (stackedutech.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
      return new Response(verifiedMissingRoutePage(url).html, { status: 404 })
    }

    throw new Error(`Unexpected page URL: ${url}`)
  }

  try {
    const jobs = await stackedutech.run()

    assert.deepEqual(jobs, [])
    assert.deepEqual(requestedUrls, [
      stackedutech.HOMEPAGE_URL,
      stackedutech.WWW_HOMEPAGE_URL,
      stackedutech.ROBOTS_URL,
      ...stackedutech.NO_PUBLIC_CAREERS_ROUTE_URLS,
    ])
    assert.equal(signals.length, requestedUrls.length)
    assert.ok(signals.every((signal) => signal instanceof AbortSignal))
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('run fails closed when the verified StackEdutech redirect or no-jobs routes drift', async () => {
  const stackedutech = await loadModule()
  assert.ok(stackedutech, 'Expected StackEdutech scraper module at ./script.js')

  await assert.rejects(
    stackedutech.createStackEdutechScraper().run({
      fetchPage: async (url) => {
        if (url === stackedutech.HOMEPAGE_URL) {
          return {
            ...verifiedRedirectPage,
            location: 'https://stackedutech.com/careers',
          }
        }

        if (url === stackedutech.WWW_HOMEPAGE_URL) {
          return verifiedRedirectPage
        }

        return verifiedMissingRoutePage(url)
      },
      fetchText: async () => verifiedRobotsTxt,
    }),
    /verified homepage redirect/i,
  )

  await assert.rejects(
    stackedutech.createStackEdutechScraper().run({
      fetchPage: async (url) => {
        if (url === stackedutech.HOMEPAGE_URL || url === stackedutech.WWW_HOMEPAGE_URL) {
          return {
            ...verifiedRedirectPage,
            url,
          }
        }

        if (url === stackedutech.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) {
          return surfacedJobsPage
        }

        return verifiedMissingRoutePage(url)
      },
      fetchText: async () => verifiedRobotsTxt,
    }),
    /checked careers routes/i,
  )

  await assert.rejects(
    stackedutech.createStackEdutechScraper().run({
      fetchPage: async (url) => {
        if (url === stackedutech.HOMEPAGE_URL || url === stackedutech.WWW_HOMEPAGE_URL) {
          return {
            ...verifiedRedirectPage,
            url,
          }
        }

        return verifiedMissingRoutePage(url)
      },
      fetchText: async () => 'User-agent: *\nAllow: /\nCareers\nApply now',
    }),
    /robots\.txt/i,
  )
})
