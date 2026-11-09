import assert from 'node:assert/strict'
import test from 'node:test'

const brandedHomepageHtml = `
<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">
<html>
  <head>
    <title>airtelxlabs</title>
  </head>
  <frameset rows="100%,*" border="0">
    <frame src="https://www.airtel.in/careers/airtelxlabs/" frameborder="0" />
  </frameset>
</html>
`

const genericAirtelCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Airtel Careers</title>
    <link rel="canonical" href="https://careers.airtel.com/">
  </head>
  <body>
    <h1>careers at airtel</h1>
    <script>
      window.config = {
        darwinboxURL: "https://airtel.darwinbox.in/ms/candidatev2/main/careers/allJobs",
        apiUrl: "https://careersapi.airtel.com/"
      }
    </script>
  </body>
</html>
`

const currentGenericAirtelCareersShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Airtel Careers</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
  </body>
</html>
`

const notFoundHtml = `
<html>
  <head><title>404 Not Found</title></head>
  <body><h1>Not Found</h1></body>
</html>
`

const loadAirtelXLabsModule = async () => {
  try {
    return await import('../../scraper/airtelxlabs/script.js')
  } catch {
    assert.fail('Expected Airtel X Labs scraper module at ../../scraper/airtelxlabs/script.js')
  }
}

test('Airtel X Labs scraper constants stay pinned to the branded frameset, generic Airtel careers handoff, and missing branded routes', async () => {
  const airtelXLabs = await loadAirtelXLabsModule()

  assert.equal(airtelXLabs.SOURCE, 'airtelxlabs')
  assert.equal(airtelXLabs.COMPANY, 'Airtel X Labs')
  assert.equal(airtelXLabs.BRANDED_HOMEPAGE_URL, 'https://www.airtelxlabs.com/')
  assert.equal(airtelXLabs.CAREERS_HANDOFF_URL, 'https://www.airtel.in/careers/airtelxlabs/')
  assert.equal(airtelXLabs.GENERIC_AIRTEL_CAREERS_URL, 'https://careers.airtel.com/')
  assert.deepEqual(airtelXLabs.NO_PUBLIC_BRANDED_ROUTE_URLS, [
    'https://www.airtelxlabs.com/careers',
    'https://www.airtelxlabs.com/jobs',
  ])
  assert.deepEqual(airtelXLabs.GENERIC_XLABS_ROUTE_URLS, [
    'https://www.airtel.in/careers/airtelxlabs/jobs',
    'https://www.airtel.in/careers/airtelxlabs/openings',
  ])
  assert.equal(airtelXLabs.hasBrandedHomepageSignal(brandedHomepageHtml), true)
  assert.equal(airtelXLabs.hasGenericAirtelCareersSignal(genericAirtelCareersHtml), true)
  assert.equal(airtelXLabs.hasGenericAirtelCareersSignal(currentGenericAirtelCareersShellHtml), true)
  assert.equal(
    airtelXLabs.isMissingBrandedCareerRoute({
      status: 404,
      url: airtelXLabs.NO_PUBLIC_BRANDED_ROUTE_URLS[0],
    }),
    true,
  )
})

test('Airtel X Labs accepts the current generic Airtel JavaScript shell handoff without treating it as an X Labs board', async () => {
  const airtelXLabs = await loadAirtelXLabsModule()

  const jobs = await airtelXLabs.createAirtelXLabsScraper().run({
    fetchPage: async (url) => {
      if (url === airtelXLabs.BRANDED_HOMEPAGE_URL) {
        return { status: 200, url, html: brandedHomepageHtml }
      }

      if (url === airtelXLabs.CAREERS_HANDOFF_URL) {
        return {
          status: 200,
          url: airtelXLabs.GENERIC_AIRTEL_CAREERS_URL,
          html: currentGenericAirtelCareersShellHtml,
        }
      }

      if (airtelXLabs.NO_PUBLIC_BRANDED_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: notFoundHtml }
      }

      if (airtelXLabs.GENERIC_XLABS_ROUTE_URLS.includes(url)) {
        return {
          status: 200,
          url: airtelXLabs.GENERIC_AIRTEL_CAREERS_URL,
          html: currentGenericAirtelCareersShellHtml,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('Airtel X Labs returns no jobs only while the branded surface still collapses into generic Airtel careers and branded routes stay absent', async () => {
  const airtelXLabs = await loadAirtelXLabsModule()
  const requestedUrls = []

  const jobs = await airtelXLabs.createAirtelXLabsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === airtelXLabs.BRANDED_HOMEPAGE_URL) {
        return { status: 200, url, html: brandedHomepageHtml }
      }

      if (url === airtelXLabs.CAREERS_HANDOFF_URL) {
        return {
          status: 200,
          url: airtelXLabs.GENERIC_AIRTEL_CAREERS_URL,
          html: genericAirtelCareersHtml,
        }
      }

      if (airtelXLabs.NO_PUBLIC_BRANDED_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: notFoundHtml }
      }

      if (airtelXLabs.GENERIC_XLABS_ROUTE_URLS.includes(url)) {
        return {
          status: 200,
          url: airtelXLabs.GENERIC_AIRTEL_CAREERS_URL,
          html: genericAirtelCareersHtml,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    airtelXLabs.BRANDED_HOMEPAGE_URL,
    airtelXLabs.CAREERS_HANDOFF_URL,
    ...airtelXLabs.NO_PUBLIC_BRANDED_ROUTE_URLS,
    ...airtelXLabs.GENERIC_XLABS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Airtel X Labs can recover with browser-backed page fetches when direct requests are blocked', async () => {
  const airtelXLabs = await loadAirtelXLabsModule()
  const attempts = []

  const jobs = await airtelXLabs.createAirtelXLabsScraper().run({
    fetchPage: async (url) => {
      attempts.push(`http:${url}`)
      return {
        status: 403,
        url,
        html: '<html><body>Forbidden</body></html>',
      }
    },
    fetchBrowserPage: async (url) => {
      attempts.push(`browser:${url}`)

      if (url === airtelXLabs.BRANDED_HOMEPAGE_URL) {
        return { status: 200, url, html: brandedHomepageHtml }
      }

      if (url === airtelXLabs.CAREERS_HANDOFF_URL) {
        return {
          status: 200,
          url: airtelXLabs.GENERIC_AIRTEL_CAREERS_URL,
          html: currentGenericAirtelCareersShellHtml,
        }
      }

      if (airtelXLabs.NO_PUBLIC_BRANDED_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: notFoundHtml }
      }

      if (airtelXLabs.GENERIC_XLABS_ROUTE_URLS.includes(url)) {
        return {
          status: 200,
          url: airtelXLabs.GENERIC_AIRTEL_CAREERS_URL,
          html: currentGenericAirtelCareersShellHtml,
        }
      }

      throw new Error(`Unexpected browser URL: ${url}`)
    },
  })

  assert.deepEqual(attempts, [
    `http:${airtelXLabs.BRANDED_HOMEPAGE_URL}`,
    `browser:${airtelXLabs.BRANDED_HOMEPAGE_URL}`,
    `http:${airtelXLabs.CAREERS_HANDOFF_URL}`,
    `browser:${airtelXLabs.CAREERS_HANDOFF_URL}`,
    ...airtelXLabs.NO_PUBLIC_BRANDED_ROUTE_URLS.flatMap((url) => [`http:${url}`, `browser:${url}`]),
    ...airtelXLabs.GENERIC_XLABS_ROUTE_URLS.flatMap((url) => [`http:${url}`, `browser:${url}`]),
  ])
  assert.deepEqual(jobs, [])
})

test('Airtel X Labs fails closed when the branded homepage, Airtel handoff, branded missing routes, or generic x-labs routes drift', async () => {
  const airtelXLabs = await loadAirtelXLabsModule()

  await assert.rejects(
    airtelXLabs.createAirtelXLabsScraper().run({
      fetchPage: async (url) => {
        if (url === airtelXLabs.BRANDED_HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><title>Unexpected</title></html>' }
        }

        if (url === airtelXLabs.CAREERS_HANDOFF_URL) {
          return {
            status: 200,
            url: airtelXLabs.GENERIC_AIRTEL_CAREERS_URL,
            html: genericAirtelCareersHtml,
          }
        }

        if (airtelXLabs.NO_PUBLIC_BRANDED_ROUTE_URLS.includes(url)) {
          return { status: 404, url, html: notFoundHtml }
        }

        return {
          status: 200,
          url: airtelXLabs.GENERIC_AIRTEL_CAREERS_URL,
          html: genericAirtelCareersHtml,
        }
      },
    }),
    /verified branded homepage/i,
  )

  await assert.rejects(
    airtelXLabs.createAirtelXLabsScraper().run({
      fetchPage: async (url) => {
        if (url === airtelXLabs.BRANDED_HOMEPAGE_URL) {
          return { status: 200, url, html: brandedHomepageHtml }
        }

        if (url === airtelXLabs.CAREERS_HANDOFF_URL) {
          return {
            status: 200,
            url,
            html: genericAirtelCareersHtml,
          }
        }

        if (airtelXLabs.NO_PUBLIC_BRANDED_ROUTE_URLS.includes(url)) {
          return { status: 404, url, html: notFoundHtml }
        }

        return {
          status: 200,
          url: airtelXLabs.GENERIC_AIRTEL_CAREERS_URL,
          html: genericAirtelCareersHtml,
        }
      },
    }),
    /verified Airtel careers handoff/i,
  )

  await assert.rejects(
    airtelXLabs.createAirtelXLabsScraper().run({
      fetchPage: async (url) => {
        if (url === airtelXLabs.BRANDED_HOMEPAGE_URL) {
          return { status: 200, url, html: brandedHomepageHtml }
        }

        if (url === airtelXLabs.CAREERS_HANDOFF_URL) {
          return {
            status: 200,
            url: airtelXLabs.GENERIC_AIRTEL_CAREERS_URL,
            html: genericAirtelCareersHtml,
          }
        }

        if (url === airtelXLabs.NO_PUBLIC_BRANDED_ROUTE_URLS[0]) {
          return { status: 200, url, html: '<html><body>Open roles</body></html>' }
        }

        if (airtelXLabs.NO_PUBLIC_BRANDED_ROUTE_URLS[1] === url) {
          return { status: 404, url, html: notFoundHtml }
        }

        return {
          status: 200,
          url: airtelXLabs.GENERIC_AIRTEL_CAREERS_URL,
          html: genericAirtelCareersHtml,
        }
      },
    }),
    /verified missing branded route/i,
  )

  await assert.rejects(
    airtelXLabs.createAirtelXLabsScraper().run({
      fetchPage: async (url) => {
        if (url === airtelXLabs.BRANDED_HOMEPAGE_URL) {
          return { status: 200, url, html: brandedHomepageHtml }
        }

        if (url === airtelXLabs.CAREERS_HANDOFF_URL) {
          return {
            status: 200,
            url: airtelXLabs.GENERIC_AIRTEL_CAREERS_URL,
            html: genericAirtelCareersHtml,
          }
        }

        if (airtelXLabs.NO_PUBLIC_BRANDED_ROUTE_URLS.includes(url)) {
          return { status: 404, url, html: notFoundHtml }
        }

        if (url === airtelXLabs.GENERIC_XLABS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Airtel X Labs openings</h1></body></html>',
          }
        }

        return {
          status: 200,
          url: airtelXLabs.GENERIC_AIRTEL_CAREERS_URL,
          html: genericAirtelCareersHtml,
        }
      },
    }),
    /verified generic Airtel x-labs route/i,
  )
})
