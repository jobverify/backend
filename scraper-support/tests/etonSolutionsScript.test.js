import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Website Designing & Best Digital Marketing Company in Delhi - Eton Solutions</title>
  </head>
  <body>
    <header>
      <p>info@etonsolutions.com</p>
      <p>+91-96500 96446</p>
      <a href="https://etonsolutions.com/">HOME</a>
      <a href="https://www.etonsolutions.com/about-us">About Us</a>
      <a href="https://www.etonsolutions.com/contact-us">CONTACT US</a>
      <a href="https://api.whatsapp.com/send?phone=919650096446&text=Hi">WhatsApp</a>
    </header>
    <main>
      <h1>Best Digital Marketing Company in Delhi: ETON Solutions</h1>
      <p>Providing The Cutting Edge Web Solutions</p>
      <p>Website Designing Company in Delhi</p>
      <a href="https://www.etonsolutions.com/about-us">Discover More</a>
    </main>
  </body>
</html>
`

const missingRouteHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>404 Not Found</title>
  </head>
  <body>
    <h1>Not Found</h1>
  </body>
</html>
`

const publicJobsHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Careers | Eton Solutions</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="https://jobs.lever.co/etonsolutions/software-engineer">Apply now</a>
    </main>
  </body>
</html>
`

const loadEtonSolutionsModule = async () => {
  try {
    return await import('../../scraper/etonsolutions/script.js')
  } catch {
    assert.fail('Expected Eton Solutions scraper module at ../../scraper/etonsolutions/script.js')
  }
}

test('Eton Solutions helpers stay pinned to the verified homepage and missing public-jobs routes', async () => {
  const etonSolutions = await loadEtonSolutionsModule()

  assert.equal(etonSolutions.SOURCE, 'etonsolutions')
  assert.equal(etonSolutions.COMPANY, 'Eton Solutions')
  assert.equal(etonSolutions.OFFICIAL_BRAND_NAME, 'ETON Solutions')
  assert.equal(etonSolutions.VERIFIED_ON, '2026-07-15')
  assert.equal(etonSolutions.HOMEPAGE_URL, 'https://etonsolutions.com/')
  assert.equal(etonSolutions.CAREER_PAGE_URL, 'https://etonsolutions.com/careers')
  assert.equal(etonSolutions.ROBOTS_TXT_URL, 'https://etonsolutions.com/robots.txt')
  assert.equal(etonSolutions.WP_SITEMAP_URL, 'https://etonsolutions.com/wp-sitemap.xml')
  assert.deepEqual(etonSolutions.CHECKED_404_ROUTE_URLS, [
    'https://etonsolutions.com/careers',
    'https://etonsolutions.com/career',
    'https://etonsolutions.com/jobs',
    'https://etonsolutions.com/join-us',
    'https://etonsolutions.com/work-with-us',
    'https://etonsolutions.com/openings',
  ])
  assert.equal(etonSolutions.hasHomepageSignal(homepageHtml), true)
  assert.equal(etonSolutions.hasPublicAtsOrCareersLink(homepageHtml), false)
  assert.equal(etonSolutions.isExpectedMissingRoute({ status: 404, html: missingRouteHtml }), true)
  assert.equal(etonSolutions.hasPublicAtsOrCareersLink(publicJobsHtml), true)
})

test('Eton Solutions returns [] only while the verified homepage exposes no public careers surface', async () => {
  const etonSolutions = await loadEtonSolutionsModule()
  const requestedUrls = []

  const jobs = await etonSolutions.createEtonSolutionsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === etonSolutions.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (
        url === etonSolutions.ROBOTS_TXT_URL
        || url === etonSolutions.WP_SITEMAP_URL
        || etonSolutions.CHECKED_404_ROUTE_URLS.includes(url)
      ) {
        return { status: 404, url, html: missingRouteHtml }
      }

      throw new Error(`Unexpected Eton Solutions URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    etonSolutions.HOMEPAGE_URL,
    etonSolutions.ROBOTS_TXT_URL,
    etonSolutions.WP_SITEMAP_URL,
    ...etonSolutions.CHECKED_404_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Eton Solutions fails closed when the homepage or missing-route contract drifts', async () => {
  const etonSolutions = await loadEtonSolutionsModule()

  await assert.rejects(
    etonSolutions.createEtonSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === etonSolutions.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><head><title>Unexpected</title></head><body></body></html>' }
        }

        throw new Error(`Unexpected Eton Solutions URL: ${url}`)
      },
    }),
    /homepage no longer matches/i,
  )

  await assert.rejects(
    etonSolutions.createEtonSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === etonSolutions.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: homepageHtml.replace(
              '</main>',
              '<a href="https://jobs.lever.co/etonsolutions/software-engineer">Careers</a></main>',
            ),
          }
        }

        throw new Error(`Unexpected Eton Solutions URL: ${url}`)
      },
    }),
    /homepage no longer matches/i,
  )

  await assert.rejects(
    etonSolutions.createEtonSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === etonSolutions.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === etonSolutions.ROBOTS_TXT_URL) {
          return { status: 200, url, html: '<xml></xml>' }
        }

        throw new Error(`Unexpected Eton Solutions URL: ${url}`)
      },
    }),
    /missing crawl routes changed/i,
  )

  await assert.rejects(
    etonSolutions.createEtonSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === etonSolutions.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === etonSolutions.ROBOTS_TXT_URL || url === etonSolutions.WP_SITEMAP_URL) {
          return { status: 404, url, html: missingRouteHtml }
        }

        if (url === etonSolutions.CHECKED_404_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsHtml }
        }

        if (etonSolutions.CHECKED_404_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 404, url, html: missingRouteHtml }
        }

        throw new Error(`Unexpected Eton Solutions URL: ${url}`)
      },
    }),
    /404 careers route changed/i,
  )
})
