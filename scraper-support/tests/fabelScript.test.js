import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>HOME | Fabel Services</title>
  </head>
  <body>
    <header>
      <a href="https://www.fabelservices.net/">HOME</a>
      <a href="https://www.fabelservices.net/about-us">ABOUT US</a>
      <a href="https://www.fabelservices.net/contact-us">CONTACT US</a>
    </header>
    <main>
      <h1>Innovating Business Landscape with Creative Solutions</h1>
      <p>Your vision=Our mission=Transformative Reality</p>
      <section>
        <h2>WHO WE ARE</h2>
        <p>Fabel Services offers a wide range of solutions, including software and IT infrastructure for e-commerce businesses, integration, maintenance, customer service, finance and accounts, logistics, marketing and more.</p>
      </section>
      <section>
        <h2>SERVICES WE PROVIDE</h2>
        <p>Fabel Services Private Limited is a standalone entity providing comprehensive business support services.</p>
      </section>
      <section>
        <h2>GET IN TOUCH</h2>
        <p>Plot No. 334, Udyog Vihar, Phase IV, Gurgaon 122016</p>
        <p><a href="mailto:info@fabelservices.net">info@fabelservices.net</a></p>
        <p><a href="tel:9999208074">9999208074</a></p>
      </section>
    </main>
  </body>
</html>
`

const missingRouteHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>404</title>
  </head>
  <body></body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Fabel Services</title>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Analyst"}
    </script>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="https://jobs.lever.co/fabel/analyst">Apply now</a>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/fabel/script.js')
  } catch {
    assert.fail('Expected Fabel scraper module at ../../scraper/fabel/script.js')
  }
}

test('Fabel helpers stay pinned to the verified homepage contract and missing careers routes', async () => {
  const fabel = await loadModule()

  assert.equal(fabel.SOURCE, 'fabel')
  assert.equal(fabel.COMPANY, 'Fabel')
  assert.equal(fabel.OFFICIAL_BRAND_NAME, 'Fabel Services Private Limited')
  assert.equal(fabel.HOMEPAGE_URL, 'https://www.fabelservices.net/')
  assert.deepEqual(fabel.CAREERS_ROUTE_URLS, [
    'https://www.fabelservices.net/careers',
    'https://www.fabelservices.net/career',
    'https://www.fabelservices.net/jobs',
    'https://www.fabelservices.net/join-us',
    'https://www.fabelservices.net/openings',
  ])
  assert.equal(fabel.VERIFIED_ON, '2026-07-15')
  assert.match(fabel.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)
  assert.equal(fabel.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(fabel.hasFirstPartyCareerLikeLink(homepageHtml), false)
  assert.equal(
    fabel.hasFirstPartyCareerLikeLink('<a href="https://www.fabelservices.net/careers">Careers</a>'),
    true,
  )
  assert.equal(fabel.pageExposesPublicJobsSignal(homepageHtml), false)
  assert.equal(fabel.pageExposesPublicJobsSignal(publicJobsHtml), true)
  assert.equal(
    fabel.isVerifiedMissingCareersRoute({
      status: 404,
      url: fabel.CAREERS_ROUTE_URLS[0],
      html: missingRouteHtml,
    }),
    true,
  )
})

test('Fabel returns no jobs while the verified first-party surface exposes no public jobs board', async () => {
  const fabel = await loadModule()
  const requestedUrls = []

  const jobs = await fabel.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === fabel.HOMEPAGE_URL) {
        return {
          status: 200,
          url: fabel.HOMEPAGE_URL,
          html: homepageHtml,
        }
      }

      if (fabel.CAREERS_ROUTE_URLS.includes(url)) {
        return {
          status: 404,
          url,
          html: missingRouteHtml,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    fabel.HOMEPAGE_URL,
    ...fabel.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Fabel fails closed when the verified homepage or missing careers routes drift', async () => {
  const fabel = await loadModule()

  await assert.rejects(
    fabel.run({
      fetchPage: async (url) => {
        if (url === fabel.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Fabel</h1></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage no longer matches/i,
  )

  await assert.rejects(
    fabel.run({
      fetchPage: async (url) => {
        if (url === fabel.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: `${homepageHtml}<a href="https://www.fabelservices.net/careers">Careers</a>`,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage now exposes a first-party careers or jobs link/i,
  )

  await assert.rejects(
    fabel.run({
      fetchPage: async (url) => {
        if (url === fabel.HOMEPAGE_URL) {
          return {
            status: 200,
            url: fabel.HOMEPAGE_URL,
            html: homepageHtml,
          }
        }

        if (url === fabel.CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: publicJobsHtml,
          }
        }

        return {
          status: 404,
          url,
          html: missingRouteHtml,
        }
      },
    }),
    /careers route changed materially or now exposes public jobs/i,
  )
})
