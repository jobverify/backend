import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Ellenbarrie</title>
    <link rel="canonical" href="https://ellenbarrie.com/" />
  </head>
  <body>
    <nav>
      <a href="https://ellenbarrie.com/career/">Career</a>
    </nav>
    <a href="mailto:info@ellenbarrie.com">info@ellenbarrie.com</a>
  </body>
</html>
`

const careerHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career - Ellenbarrie</title>
    <link rel="canonical" href="https://ellenbarrie.com/career/" />
  </head>
  <body>
    <h2>Join Our Team</h2>
    <h2>Why Work with Us?</h2>
    <h2>Opportunities Await!</h2>
    <p>
      Explore our current openings and find a role that fits your skills and aspirations.
      Whether you're a seasoned professional or just starting your career, we offer
      exciting opportunities across various departments.
    </p>
    <p>Apply Now...</p>
    <form action="/career/#wpcf7-f1766-p1101-o1">
      <input name="candidate_name" />
      <input name="sender_mail" />
      <input name="your_phoneno" />
      <input name="select_file" type="file" />
    </form>
    <a href="mailto:info@ellenbarrie.com">info@ellenbarrie.com</a>
  </body>
</html>
`

const robotsTxt = 'User-agent: *\nDisallow:\nSitemap: https://ellenbarrie.com/wp-sitemap.xml\n'

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://ellenbarrie.com/wp-sitemap-posts-page-1.xml</loc></sitemap>
  <sitemap><loc>https://ellenbarrie.com/wp-sitemap-posts-doctio_team-1.xml</loc></sitemap>
  <sitemap><loc>https://ellenbarrie.com/wp-sitemap-users-1.xml</loc></sitemap>
</sitemapindex>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/ellenbarrieindustrialgases/script.js')
  } catch {
    assert.fail(
      'Expected Ellenbarrie Industrial Gases scraper module at ../../scraper/ellenbarrieindustrialgases/script.js',
    )
  }
}

test('Ellenbarrie Industrial Gases helpers stay pinned to the verified homepage, generic career form, and missing public opening contract', async () => {
  const ellenbarrie = await loadModule()

  assert.equal(ellenbarrie.SOURCE, 'ellenbarrieindustrialgases')
  assert.equal(ellenbarrie.COMPANY, 'Ellenbarrie Industrial Gases')
  assert.equal(ellenbarrie.OFFICIAL_BRAND_NAME, 'Ellenbarrie')
  assert.equal(ellenbarrie.VERIFIED_ON, '2026-07-15')
  assert.equal(ellenbarrie.HOMEPAGE_URL, 'https://ellenbarrie.com/')
  assert.equal(ellenbarrie.CAREER_PAGE_URL, 'https://ellenbarrie.com/career/')
  assert.deepEqual(ellenbarrie.COMMON_MISSING_ROUTE_URLS, [
    'https://ellenbarrie.com/careers',
    'https://ellenbarrie.com/jobs',
    'https://ellenbarrie.com/join-us',
    'https://ellenbarrie.com/work-with-us',
  ])
  assert.equal(ellenbarrie.APPLICATION_EMAIL, 'info@ellenbarrie.com')
  assert.equal(ellenbarrie.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(ellenbarrie.hasCareerPageSignal(careerHtml), true)
  assert.equal(ellenbarrie.hasRobotsTxtSignal(robotsTxt), true)
  assert.equal(ellenbarrie.hasSitemapSignal(sitemapXml), true)
  assert.equal(ellenbarrie.hasUnexpectedPublicOpeningSignal(careerHtml), false)
  assert.equal(
    ellenbarrie.hasUnexpectedPublicOpeningSignal(
      careerHtml.replace(
        '</form>',
        '</form><a href="https://ellenbarrie.com/career/process-engineer-opening/">Process Engineer</a>',
      ),
    ),
    true,
  )
})

test('Ellenbarrie Industrial Gases run returns [] while the verified generic first-party career form remains live', async () => {
  const ellenbarrie = await loadModule()
  const requestedUrls = []

  const jobs = await ellenbarrie.createEllenbarrieIndustrialGasesScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === ellenbarrie.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === ellenbarrie.CAREER_PAGE_URL) {
        return { status: 200, url, html: careerHtml }
      }

      if (url === ellenbarrie.ROBOTS_TXT_URL) {
        return { status: 200, url, html: robotsTxt }
      }

      if (url === ellenbarrie.SITEMAP_URL) {
        return { status: 200, url, html: sitemapXml }
      }

      if (ellenbarrie.COMMON_MISSING_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: '<html><body>Not found</body></html>' }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    ellenbarrie.HOMEPAGE_URL,
    ellenbarrie.CAREER_PAGE_URL,
    ellenbarrie.ROBOTS_TXT_URL,
    ellenbarrie.SITEMAP_URL,
    ...ellenbarrie.COMMON_MISSING_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Ellenbarrie Industrial Gases fails closed when the verified homepage, career form, robots, sitemap, or missing-route contract drifts', async () => {
  const ellenbarrie = await loadModule()

  await assert.rejects(
    ellenbarrie.createEllenbarrieIndustrialGasesScraper().run({
      fetchPage: async (url) => {
        if (url === ellenbarrie.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body>No career link</body></html>' }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified homepage/i,
  )

  await assert.rejects(
    ellenbarrie.createEllenbarrieIndustrialGasesScraper().run({
      fetchPage: async (url) => {
        if (url === ellenbarrie.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === ellenbarrie.CAREER_PAGE_URL) {
          return { status: 200, url, html: careerHtml.replace('candidate_name', 'candidate_full_name') }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified career page/i,
  )

  await assert.rejects(
    ellenbarrie.createEllenbarrieIndustrialGasesScraper().run({
      fetchPage: async (url) => {
        if (url === ellenbarrie.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === ellenbarrie.CAREER_PAGE_URL) return { status: 200, url, html: careerHtml }
        if (url === ellenbarrie.ROBOTS_TXT_URL) {
          return { status: 200, url, html: 'User-agent: *\nDisallow:\n' }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /robots\.txt/i,
  )

  await assert.rejects(
    ellenbarrie.createEllenbarrieIndustrialGasesScraper().run({
      fetchPage: async (url) => {
        if (url === ellenbarrie.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === ellenbarrie.CAREER_PAGE_URL) return { status: 200, url, html: careerHtml }
        if (url === ellenbarrie.ROBOTS_TXT_URL) return { status: 200, url, html: robotsTxt }
        if (url === ellenbarrie.SITEMAP_URL) {
          return { status: 200, url, html: '<xml></xml>' }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /sitemap/i,
  )

  await assert.rejects(
    ellenbarrie.createEllenbarrieIndustrialGasesScraper().run({
      fetchPage: async (url) => {
        if (url === ellenbarrie.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === ellenbarrie.CAREER_PAGE_URL) {
          return {
            status: 200,
            url,
            html: careerHtml.replace(
              '</form>',
              '</form><script type="application/ld+json">{"@type":"JobPosting"}</script>',
            ),
          }
        }
        if (url === ellenbarrie.ROBOTS_TXT_URL) return { status: 200, url, html: robotsTxt }
        if (url === ellenbarrie.SITEMAP_URL) return { status: 200, url, html: sitemapXml }
        if (ellenbarrie.COMMON_MISSING_ROUTE_URLS.includes(url)) {
          return { status: 404, url, html: '<html><body>Not found</body></html>' }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public openings/i,
  )

  await assert.rejects(
    ellenbarrie.createEllenbarrieIndustrialGasesScraper().run({
      fetchPage: async (url) => {
        if (url === ellenbarrie.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === ellenbarrie.CAREER_PAGE_URL) return { status: 200, url, html: careerHtml }
        if (url === ellenbarrie.ROBOTS_TXT_URL) return { status: 200, url, html: robotsTxt }
        if (url === ellenbarrie.SITEMAP_URL) return { status: 200, url, html: sitemapXml }
        if (url === ellenbarrie.COMMON_MISSING_ROUTE_URLS[0]) {
          return { status: 200, url, html: '<html><body>Current openings</body></html>' }
        }
        if (ellenbarrie.COMMON_MISSING_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 404, url, html: '<html><body>Not found</body></html>' }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /missing-route/i,
  )
})
