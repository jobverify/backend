import assert from 'node:assert/strict'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'in22labs',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const verifiedHomepageHtml = readFixture('homepage.html')
const verifiedSitemapXml = readFixture('sitemap.xml')

const loadIn22LabsModule = async () => {
  try {
    return await import('../../scraper/in22labs/script.js')
  } catch {
    assert.fail('Expected in22Labs scraper module at ../../scraper/in22labs/script.js')
  }
}

test('in22Labs scraper constants stay pinned to the verified official homepage, sitemap, and no-public-careers routes', async () => {
  const in22Labs = await loadIn22LabsModule()

  assert.equal(in22Labs.SOURCE, 'in22labs')
  assert.equal(in22Labs.COMPANY, 'in22Labs')
  assert.equal(in22Labs.HOMEPAGE_URL, 'https://in22labs.com/')
  assert.equal(in22Labs.SITEMAP_URL, 'https://in22labs.com/sitemap.xml')
  assert.deepEqual(in22Labs.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://in22labs.com/careers',
    'https://in22labs.com/careers/',
    'https://in22labs.com/career',
    'https://in22labs.com/career/',
    'https://in22labs.com/jobs',
    'https://in22labs.com/jobs/',
    'https://in22labs.com/join-us',
    'https://in22labs.com/join-us/',
  ])
  assert.equal(in22Labs.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(in22Labs.sitemapHasCareerLikeUrl(verifiedSitemapXml), false)
  assert.equal(in22Labs.isMissingCareerRoute({ status: 404 }), true)
  assert.equal(in22Labs.isMissingCareerRoute({ status: 200 }), false)
})

test('in22Labs returns no jobs only while the verified first-party homepage and sitemap expose no careers surface', async () => {
  const in22Labs = await loadIn22LabsModule()
  const requestedUrls = []

  const jobs = await in22Labs.createIn22LabsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === in22Labs.HOMEPAGE_URL) {
        return { status: 200, url, html: verifiedHomepageHtml }
      }

      if (url === in22Labs.SITEMAP_URL) {
        return { status: 200, url, html: verifiedSitemapXml }
      }

      if (in22Labs.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: '' }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    in22Labs.HOMEPAGE_URL,
    in22Labs.SITEMAP_URL,
    ...in22Labs.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('in22Labs fails closed when the homepage, sitemap, or a checked careers route changes materially', async () => {
  const in22Labs = await loadIn22LabsModule()

  await assert.rejects(
    in22Labs.createIn22LabsScraper().run({
      fetchPage: async (url) => {
        if (url === in22Labs.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><title>Unexpected</title></html>' }
        }

        if (url === in22Labs.SITEMAP_URL) {
          return { status: 200, url, html: verifiedSitemapXml }
        }

        return { status: 404, url, html: '' }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    in22Labs.createIn22LabsScraper().run({
      fetchPage: async (url) => {
        if (url === in22Labs.HOMEPAGE_URL) {
          return { status: 200, url, html: verifiedHomepageHtml }
        }

        if (url === in22Labs.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: verifiedSitemapXml.replace(
              '</urlset>',
              '<url><loc>https://in22labs.com/careers</loc></url></urlset>',
            ),
          }
        }

        return { status: 404, url, html: '' }
      },
    }),
    /verified sitemap no longer matches the no-public-careers surface/i,
  )

  await assert.rejects(
    in22Labs.createIn22LabsScraper().run({
      fetchPage: async (url) => {
        if (url === in22Labs.HOMEPAGE_URL) {
          return { status: 200, url, html: verifiedHomepageHtml }
        }

        if (url === in22Labs.SITEMAP_URL) {
          return { status: 200, url, html: verifiedSitemapXml }
        }

        if (url === in22Labs.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) {
          return { status: 200, url, html: '<html><body>Open positions</body></html>' }
        }

        return { status: 404, url, html: '' }
      },
    }),
    /verified no-public-careers route/i,
  )
})
