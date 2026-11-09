import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(currentDir, '..', '..', 'scraper', 'gridbotstechnologies', 'fixtures')

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const officialHomepageHtml = readFixture('homepage.html')
const officialSitemapXml = readFixture('sitemap.xml')

const loadGridbotsModule = async () => {
  try {
    return await import('../../scraper/gridbotstechnologies/script.js')
  } catch {
    assert.fail('Expected Gridbots Technologies scraper module at ../../scraper/gridbotstechnologies/script.js')
  }
}

test('Gridbots Technologies scraper constants stay pinned to the verified official homepage, sitemap, and no-public-careers routes', async () => {
  const gridbots = await loadGridbotsModule()

  assert.equal(gridbots.SOURCE, 'gridbotstechnologies')
  assert.equal(gridbots.COMPANY, 'Gridbots Technologies')
  assert.equal(gridbots.HOMEPAGE_URL, 'https://www.gridbots.com/')
  assert.equal(gridbots.SITEMAP_URL, 'https://www.gridbots.com/sitemap.xml')
  assert.deepEqual(gridbots.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://www.gridbots.com/careers',
    'https://www.gridbots.com/careers/',
    'https://www.gridbots.com/career',
    'https://www.gridbots.com/career/',
    'https://www.gridbots.com/jobs',
    'https://www.gridbots.com/jobs/',
  ])
  assert.equal(gridbots.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(gridbots.sitemapHasCareerLikeUrl(officialSitemapXml), false)
  assert.equal(gridbots.isMissingCareerRoute({ status: 404, url: gridbots.NO_PUBLIC_CAREERS_ROUTE_URLS[0] }), true)
})

test('Gridbots Technologies returns no jobs only while the verified first-party homepage and sitemap expose no careers surface', async () => {
  const gridbots = await loadGridbotsModule()
  const requestedUrls = []

  const jobs = await gridbots.createGridbotsTechnologiesScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === gridbots.HOMEPAGE_URL) {
        return { status: 200, url, html: officialHomepageHtml }
      }

      if (url === gridbots.SITEMAP_URL) {
        return { status: 200, url, html: officialSitemapXml }
      }

      if (gridbots.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: '' }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    gridbots.HOMEPAGE_URL,
    gridbots.SITEMAP_URL,
    ...gridbots.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Gridbots Technologies fails closed when the homepage, sitemap, or a checked careers route changes materially', async () => {
  const gridbots = await loadGridbotsModule()

  await assert.rejects(
    gridbots.createGridbotsTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === gridbots.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><title>Unexpected</title></html>' }
        }

        if (url === gridbots.SITEMAP_URL) {
          return { status: 200, url, html: officialSitemapXml }
        }

        return { status: 404, url, html: '' }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    gridbots.createGridbotsTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === gridbots.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === gridbots.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: officialSitemapXml.replace(
              '</urlset>',
              '<url><loc>https://gridbots.com/careers</loc></url></urlset>',
            ),
          }
        }

        return { status: 404, url, html: '' }
      },
    }),
    /verified sitemap no longer matches the no-public-careers surface/i,
  )

  await assert.rejects(
    gridbots.createGridbotsTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === gridbots.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === gridbots.SITEMAP_URL) {
          return { status: 200, url, html: officialSitemapXml }
        }

        if (url === gridbots.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) {
          return { status: 200, url, html: '<html><body>Current openings</body></html>' }
        }

        return { status: 404, url, html: '' }
      },
    }),
    /verified no-public-careers route/i,
  )
})
