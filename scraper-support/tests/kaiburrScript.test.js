import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(currentDir, 'fixtures', 'kaiburr')
const officialHomepageHtml = readFileSync(path.join(fixturesDir, 'homepage.html'), 'utf8')
const officialSitemapXml = readFileSync(path.join(fixturesDir, 'sitemap.xml'), 'utf8')

const loadKaiburrModule = async () => {
  try {
    return await import('../../scraper/kaiburr/script.js')
  } catch {
    assert.fail('Expected Kaiburr scraper module at ../../scraper/kaiburr/script.js')
  }
}

test('Kaiburr scraper constants stay pinned to the verified official homepage, sitemap, and missing careers routes', async () => {
  const kaiburr = await loadKaiburrModule()

  assert.equal(kaiburr.SOURCE, 'kaiburr')
  assert.equal(kaiburr.COMPANY, 'Kaiburr')
  assert.equal(kaiburr.HOMEPAGE_URL, 'https://kaiburr.com/')
  assert.equal(kaiburr.SITEMAP_URL, 'https://kaiburr.com/sitemap.xml')
  assert.deepEqual(kaiburr.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://kaiburr.com/careers',
    'https://kaiburr.com/careers/',
    'https://kaiburr.com/jobs',
    'https://kaiburr.com/jobs/',
    'https://kaiburr.com/company/careers',
    'https://kaiburr.com/company/careers/',
  ])
  assert.equal(kaiburr.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(kaiburr.sitemapHasCareerLikeUrl(officialSitemapXml), false)
  assert.equal(kaiburr.isMissingCareerRoute({ status: 404 }), true)
})

test('Kaiburr returns no jobs only while the verified first-party homepage and sitemap expose no public careers surface', async () => {
  const kaiburr = await loadKaiburrModule()
  const requestedUrls = []

  const jobs = await kaiburr.createKaiburrScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === kaiburr.HOMEPAGE_URL) {
        return { status: 200, url, html: officialHomepageHtml }
      }

      if (url === kaiburr.SITEMAP_URL) {
        return { status: 200, url, html: officialSitemapXml }
      }

      if (kaiburr.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: '<html><body>404</body></html>' }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    kaiburr.HOMEPAGE_URL,
    kaiburr.SITEMAP_URL,
    ...kaiburr.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Kaiburr fails closed when the homepage, sitemap, or checked careers routes drift', async () => {
  const kaiburr = await loadKaiburrModule()

  await assert.rejects(
    kaiburr.createKaiburrScraper().run({
      fetchPage: async (url) => {
        if (url === kaiburr.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><title>Unexpected</title></html>' }
        }

        if (url === kaiburr.SITEMAP_URL) {
          return { status: 200, url, html: officialSitemapXml }
        }

        return { status: 404, url, html: '' }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    kaiburr.createKaiburrScraper().run({
      fetchPage: async (url) => {
        if (url === kaiburr.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === kaiburr.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: officialSitemapXml.replace(
              '</urlset>',
              '<url><loc>https://kaiburr.com/careers</loc></url></urlset>',
            ),
          }
        }

        return { status: 404, url, html: '' }
      },
    }),
    /verified sitemap no longer matches the no-public-careers surface/i,
  )

  await assert.rejects(
    kaiburr.createKaiburrScraper().run({
      fetchPage: async (url) => {
        if (url === kaiburr.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === kaiburr.SITEMAP_URL) {
          return { status: 200, url, html: officialSitemapXml }
        }

        if (url === kaiburr.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) {
          return { status: 200, url, html: '<html><body>Open positions</body></html>' }
        }

        return { status: 404, url, html: '' }
      },
    }),
    /verified no-public-careers route/i,
  )
})
