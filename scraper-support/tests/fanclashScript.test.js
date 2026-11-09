import assert from 'node:assert/strict'
import test from 'node:test'

const parkedDomainHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>FanClash.com — Premium Domain For Sale</title>
  </head>
  <body>
    <main>
      <a href="https://www.atom.com/">Atom.com</a>
      <h1>FanClash.com is for sale!</h1>
      <p>Premium Domain For Sale</p>
      <p>Buy Now</p>
      <p>Purchase Domain</p>
      <p>See FanClash.com as your website</p>
    </main>
  </body>
</html>
`

const notFoundHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>404</title>
  </head>
  <body>
    <main>
      <p>Page not found.</p>
      <a href="http://fanclash.com/">Home</a>
    </main>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Fanclash Careers</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="https://jobs.lever.co/fanclash/apply">Apply now</a>
    </main>
  </body>
</html>
`

const loadFanclashModule = async () => {
  try {
    return await import('../../scraper/fanclash/script.js')
  } catch {
    assert.fail('Expected Fanclash scraper module at ../../scraper/fanclash/script.js')
  }
}

test('Fanclash scraper constants and helpers stay pinned to the verified parked-domain and unresolved-host contract from July 15, 2026', async () => {
  const fanclash = await loadFanclashModule()

  assert.equal(fanclash.SOURCE, 'fanclash')
  assert.equal(fanclash.COMPANY, 'Fanclash')
  assert.equal(fanclash.OFFICIAL_BRAND_NAME, 'FanClash')
  assert.equal(fanclash.VERIFIED_AT, '2026-07-15')
  assert.equal(fanclash.HOMEPAGE_URL, 'https://fanclash.com/')
  assert.equal(fanclash.PARKED_DOMAIN_REDIRECT_URL, 'https://www.atom.com/name/FanClash')
  assert.deepEqual(fanclash.PARKED_HOMEPAGE_URLS, [
    'https://fanclash.com/',
    'https://www.fanclash.com/',
  ])
  assert.deepEqual(fanclash.NOT_FOUND_ROUTE_URLS, [
    'https://fanclash.com/careers',
    'https://www.fanclash.com/careers',
    'https://fanclash.com/jobs',
    'https://www.fanclash.com/jobs',
    'https://fanclash.com/robots.txt',
    'https://www.fanclash.com/robots.txt',
    'https://fanclash.com/sitemap.xml',
    'https://www.fanclash.com/sitemap.xml',
  ])
  assert.deepEqual(fanclash.UNRESOLVED_DOMAIN_URLS, [
    'https://fanclash.in/',
    'https://www.fanclash.in/',
    'https://fanclash.in/careers',
    'https://www.fanclash.in/careers',
  ])
  assert.match(fanclash.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)
  assert.equal(
    fanclash.hasVerifiedAtomParkedRedirect({
      status: 403,
      finalUrl: fanclash.PARKED_DOMAIN_REDIRECT_URL,
      html: parkedDomainHtml,
    }),
    true,
  )
  assert.equal(
    fanclash.hasVerified404Route(
      {
        status: 404,
        finalUrl: fanclash.NOT_FOUND_ROUTE_URLS[0],
        html: notFoundHtml,
      },
      fanclash.NOT_FOUND_ROUTE_URLS[0],
    ),
    true,
  )
  assert.equal(
    fanclash.hasDnsResolutionFailure("The remote name could not be resolved: 'fanclash.in'"),
    true,
  )
  assert.equal(fanclash.hasPublicJobsSignal(publicJobsHtml), true)
})

test('Fanclash returns [] only while the verified first-party routes remain parked, 404, and unresolved', async () => {
  const fanclash = await loadFanclashModule()
  const requestedUrls = []

  const jobs = await fanclash.createFanclashScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (fanclash.PARKED_HOMEPAGE_URLS.includes(url)) {
        return {
          status: 403,
          url,
          finalUrl: fanclash.PARKED_DOMAIN_REDIRECT_URL,
          html: parkedDomainHtml,
          errorMessage: '',
        }
      }

      if (fanclash.NOT_FOUND_ROUTE_URLS.includes(url)) {
        return {
          status: 404,
          url,
          finalUrl: url,
          html: notFoundHtml,
          errorMessage: '',
        }
      }

      if (fanclash.UNRESOLVED_DOMAIN_URLS.includes(url)) {
        return {
          status: 'DNS_ERROR',
          url,
          finalUrl: '',
          html: '',
          errorMessage: "The remote name could not be resolved: 'fanclash.in'",
        }
      }

      throw new Error(`Unexpected Fanclash URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    ...fanclash.PARKED_HOMEPAGE_URLS,
    ...fanclash.NOT_FOUND_ROUTE_URLS,
    ...fanclash.UNRESOLVED_DOMAIN_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Fanclash fails closed when the parked domain, missing routes, or unresolved hosts drift into a public site', async () => {
  const fanclash = await loadFanclashModule()

  await assert.rejects(
    fanclash.createFanclashScraper().run({
      fetchPage: async (url) => {
        if (fanclash.PARKED_HOMEPAGE_URLS.includes(url)) {
          return {
            status: 200,
            url,
            finalUrl: url,
            html: publicJobsHtml,
            errorMessage: '',
          }
        }

        throw new Error(`Unexpected Fanclash URL: ${url}`)
      },
    }),
    /public jobs|parked-domain redirect/i,
  )

  await assert.rejects(
    fanclash.createFanclashScraper().run({
      fetchPage: async (url) => {
        if (fanclash.PARKED_HOMEPAGE_URLS.includes(url)) {
          return {
            status: 403,
            url,
            finalUrl: fanclash.PARKED_DOMAIN_REDIRECT_URL,
            html: parkedDomainHtml,
            errorMessage: '',
          }
        }

        if (url === fanclash.NOT_FOUND_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            finalUrl: url,
            html: publicJobsHtml,
            errorMessage: '',
          }
        }

        if (fanclash.NOT_FOUND_ROUTE_URLS.slice(1).includes(url)) {
          return {
            status: 404,
            url,
            finalUrl: url,
            html: notFoundHtml,
            errorMessage: '',
          }
        }

        if (fanclash.UNRESOLVED_DOMAIN_URLS.includes(url)) {
          return {
            status: 'DNS_ERROR',
            url,
            finalUrl: '',
            html: '',
            errorMessage: "The remote name could not be resolved: 'fanclash.in'",
          }
        }

        throw new Error(`Unexpected Fanclash URL: ${url}`)
      },
    }),
    /verified 404 route changed/i,
  )

  await assert.rejects(
    fanclash.createFanclashScraper().run({
      fetchPage: async (url) => {
        if (fanclash.PARKED_HOMEPAGE_URLS.includes(url)) {
          return {
            status: 403,
            url,
            finalUrl: fanclash.PARKED_DOMAIN_REDIRECT_URL,
            html: parkedDomainHtml,
            errorMessage: '',
          }
        }

        if (fanclash.NOT_FOUND_ROUTE_URLS.includes(url)) {
          return {
            status: 404,
            url,
            finalUrl: url,
            html: notFoundHtml,
            errorMessage: '',
          }
        }

        if (url === fanclash.UNRESOLVED_DOMAIN_URLS[0]) {
          return {
            status: 200,
            url,
            finalUrl: url,
            html: '<html><body>Welcome back</body></html>',
            errorMessage: '',
          }
        }

        if (fanclash.UNRESOLVED_DOMAIN_URLS.slice(1).includes(url)) {
          return {
            status: 'DNS_ERROR',
            url,
            finalUrl: '',
            html: '',
            errorMessage: "The remote name could not be resolved: 'fanclash.in'",
          }
        }

        throw new Error(`Unexpected Fanclash URL: ${url}`)
      },
    }),
    /verified unresolved first-party surface changed/i,
  )
})

test('Fanclash accepts the current parked-domain redirect even when Atom now returns HTTP 200', async () => {
  const fanclash = await loadFanclashModule()

  assert.equal(
    fanclash.hasVerifiedAtomParkedRedirect({
      status: 200,
      finalUrl: fanclash.PARKED_DOMAIN_REDIRECT_URL,
      html: parkedDomainHtml,
    }),
    true,
  )
})

test('Fanclash uses HTTP only when the www HTTPS certificate is self-signed', async () => {
  const fanclash = await loadFanclashModule()
  const requested = []
  const fetchPage = fanclash.createFetchPage({
    fetchImpl: async (url) => {
      requested.push(url)
      if (url.startsWith('https://')) {
        const error = new TypeError('fetch failed')
        error.cause = { code: 'DEPTH_ZERO_SELF_SIGNED_CERT', message: 'self-signed certificate' }
        throw error
      }
      return {
        status: 403,
        url: fanclash.PARKED_DOMAIN_REDIRECT_URL,
        text: async () => '<title>Just a moment...</title><meta name=robots content=noindex,nofollow><script src=https://challenges.cloudflare.com/challenge.js></script>',
      }
    },
  })

  const page = await fetchPage('https://www.fanclash.com/')
  assert.deepEqual(requested, ['https://www.fanclash.com/', 'http://www.fanclash.com/'])
  assert.equal(fanclash.hasVerifiedAtomParkedRedirect(page), true)

  const noFallbackRequests = []
  const noFallbackPage = await fanclash.createFetchPage({
    fetchImpl: async (url) => {
      noFallbackRequests.push(url)
      const error = new TypeError('fetch failed')
      error.cause = { code: 'ECONNRESET', message: 'socket hang up' }
      throw error
    },
  })('https://www.fanclash.com/')
  assert.deepEqual(noFallbackRequests, ['https://www.fanclash.com/'])
  assert.equal(noFallbackPage.status, 'FETCH_ERROR')
})
