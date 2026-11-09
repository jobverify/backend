import assert from 'node:assert/strict'
import test from 'node:test'

const loadAadinathModule = async () => {
  try {
    return await import('../../scraper/aadinathconsultancy/script.js')
  } catch {
    assert.fail('Expected Aadinath Consultancy scraper module at ../../scraper/aadinathconsultancy/script.js')
  }
}

const officialHomepageHtml = `
<!DOCTYPE html>
<html>
  <head>
    <meta http-equiv="Content-type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="/_autoindex/assets/css/autoindex.css" />
    <script src="/_autoindex/assets/js/tablesort.js"></script>
    <script src="/_autoindex/assets/js/tablesort.number.js"></script>
    <title>Index of /</title>
  </head>
  <body>
    <div class="content">
      <h1 style="color: #555;">Index of /</h1>
      <div id="table-list">
        <table id="table-content">
          <thead class="t-header">
            <tr>
              <th class="colname">Name</th>
              <th class="colname">Last Modified</th>
              <th class="colname">Size</th>
            </tr>
          </thead>
        </table>
      </div>
      <address>Proudly Served by LiteSpeed Web Server at aadinathconsultants.com Port 443</address>
    </div>
  </body>
</html>
`

const missingCareersRouteHtml = `
<!DOCTYPE html>
<html>
  <head>
    <title>404 Not Found</title>
  </head>
  <body>
    <center><h1>404 Not Found</h1></center>
    <p>The resource requested could not be found on this server!</p>
    <hr>
    <center>Proudly powered by LiteSpeed Web Server</center>
    <p>Please be advised that LiteSpeed Technologies Inc. is not a web hosting company and, as such, has no control over content found on this site.</p>
  </body>
</html>
`

test('Aadinath Consultancy sentinel targets the verified first-party autoindex homepage and missing careers routes', async () => {
  const aadinath = await loadAadinathModule()

  assert.equal(aadinath.SOURCE, 'aadinathconsultancy')
  assert.equal(aadinath.COMPANY, 'Aadinath Consultancy')
  assert.equal(aadinath.VERIFIED_AT, '2026-08-13')
  assert.equal(aadinath.HOMEPAGE_URL, 'https://aadinathconsultants.com/')
  assert.deepEqual(aadinath.FIRST_PARTY_TIMEOUT_URLS, [
    'https://aadinathconsultants.com/',
    'https://aadinathconsultants.com/careers',
    'https://aadinathconsultants.com/careers/',
    'https://aadinathconsultants.com/career',
    'https://aadinathconsultants.com/jobs',
    'https://aadinathconsultants.com/jobs/',
    'https://aadinathconsultants.com/join-us',
    'https://aadinathconsultants.com/work-with-us',
    'https://aadinathconsultants.com/openings',
  ])
  assert.deepEqual(aadinath.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://aadinathconsultants.com/careers',
    'https://aadinathconsultants.com/careers/',
    'https://aadinathconsultants.com/career',
    'https://aadinathconsultants.com/jobs',
    'https://aadinathconsultants.com/jobs/',
    'https://aadinathconsultants.com/join-us',
    'https://aadinathconsultants.com/work-with-us',
    'https://aadinathconsultants.com/openings',
  ])
  assert.equal(aadinath.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(aadinath.hasPublicJobsSignal(officialHomepageHtml), false)
  assert.equal(aadinath.hasCareerRouteLinkSignal(officialHomepageHtml), false)
  assert.equal(aadinath.isExpectedTimedOutSurface({ errorKind: 'timeout', status: null, html: null }), true)
  assert.equal(aadinath.isExpectedTimedOutSurface({ errorKind: 'dns' }), false)
  assert.equal(aadinath.isVerifiedMissingCareerRoute({
    status: 404,
    url: 'https://aadinathconsultants.com/careers',
    html: missingCareersRouteHtml,
  }), true)
})

test('Aadinath Consultancy sentinel returns no jobs when the current verified first-party routes all time out', async () => {
  const aadinath = await loadAadinathModule()
  const requestedUrls = []

  const jobs = await aadinath.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      return {
        status: null,
        url,
        html: null,
        errorKind: 'timeout',
      }
    },
  })

  assert.deepEqual(requestedUrls, aadinath.FIRST_PARTY_TIMEOUT_URLS)
  assert.deepEqual(jobs, [])
})

test('Aadinath Consultancy sentinel returns no jobs while the verified homepage stays live and careers routes stay missing', async () => {
  const aadinath = await loadAadinathModule()
  const requestedUrls = []

  const jobs = await aadinath.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === aadinath.HOMEPAGE_URL) {
        return { status: 200, url, html: officialHomepageHtml }
      }

      if (aadinath.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: missingCareersRouteHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    aadinath.HOMEPAGE_URL,
    ...aadinath.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Aadinath Consultancy retries the same first-party routes over HTTP only when HTTPS has an expired certificate', async () => {
  const aadinath = await loadAadinathModule()
  const requestedUrls = []
  const expiredCertificateError = Object.assign(new TypeError('fetch failed'), {
    cause: {
      code: 'CERT_HAS_EXPIRED',
      message: 'certificate has expired',
    },
  })
  const fetchPage = aadinath.createFetchPage({
    fetchImpl: async (url) => {
      requestedUrls.push(url)

      if (url.startsWith('https://')) throw expiredCertificateError

      if (url === 'http://aadinathconsultants.com/') {
        return {
          status: 200,
          url,
          text: async () => officialHomepageHtml.replace('Port 443', 'Port 80'),
        }
      }

      return {
        status: 404,
        url,
        text: async () => missingCareersRouteHtml,
      }
    },
  })

  const jobs = await aadinath.run({ fetchPage })

  assert.deepEqual(jobs, [])
  assert.deepEqual(requestedUrls, aadinath.FIRST_PARTY_TIMEOUT_URLS.flatMap((url) => [
    url,
    url.replace('https://', 'http://'),
  ]))

  const refusedUrls = []
  const fetchWithoutFallback = aadinath.createFetchPage({
    fetchImpl: async (url) => {
      refusedUrls.push(url)
      throw new Error('connect ECONNREFUSED')
    },
  })

  await assert.rejects(fetchWithoutFallback(aadinath.HOMEPAGE_URL), /ECONNREFUSED/)
  assert.deepEqual(refusedUrls, [aadinath.HOMEPAGE_URL])
})

test('Aadinath Consultancy sentinel fails closed when the homepage changes or a first-party careers route starts resolving', async () => {
  const aadinath = await loadAadinathModule()

  await assert.rejects(
    aadinath.run({
      fetchPage: async (url) => {
        if (url === aadinath.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Aadinath Consultancy</title></head><body><h1>Jobs</h1></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    aadinath.run({
      fetchPage: async (url) => {
        if (url === aadinath.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === aadinath.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Open Positions</h1><a href="/apply">Apply now</a></body></html>',
          }
        }

        return { status: 404, url, html: missingCareersRouteHtml }
      },
    }),
    /public jobs surface|verified no-public-careers surface/i,
  )
})
