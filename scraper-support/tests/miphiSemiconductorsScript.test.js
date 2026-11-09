import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(currentDir, '..', '..', 'scraper', 'miphisemiconductors', 'fixtures')

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const officialHomepageHtml = readFixture('homepage.html')
const officialSitemapXml = readFixture('sitemap.xml')

const loadMiPhiModule = async () => {
  try {
    return await import('../../scraper/miphisemiconductors/script.js')
  } catch {
    assert.fail('Expected MiPhi Semiconductors scraper module at ../../scraper/miphisemiconductors/script.js')
  }
}

test('MiPhi Semiconductors scraper constants stay pinned to the verified official homepage, sitemap, and no-public-careers routes', async () => {
  const miphi = await loadMiPhiModule()

  assert.equal(miphi.SOURCE, 'miphisemiconductors')
  assert.equal(miphi.COMPANY, 'MiPhi Semiconductors')
  assert.equal(miphi.HOMEPAGE_URL, 'https://www.miphi.in/')
  assert.equal(miphi.SITEMAP_URL, 'https://www.miphi.in/sitemap.xml')
  assert.deepEqual(miphi.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://www.miphi.in/careers',
    'https://www.miphi.in/careers/',
    'https://www.miphi.in/career',
    'https://www.miphi.in/career/',
    'https://www.miphi.in/jobs',
    'https://www.miphi.in/jobs/',
  ])
  assert.equal(miphi.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(miphi.sitemapHasCareerLikeUrl(officialSitemapXml), false)
  assert.equal(
    miphi.isMissingCareerRoute({ status: 404, url: miphi.NO_PUBLIC_CAREERS_ROUTE_URLS[0] }),
    true,
  )
})

test('MiPhi Semiconductors returns no jobs only while the verified first-party homepage and sitemap expose no careers surface', async () => {
  const miphi = await loadMiPhiModule()
  const requestedUrls = []

  const jobs = await miphi.createMiPhiSemiconductorsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === miphi.HOMEPAGE_URL) {
        return { status: 200, url, html: officialHomepageHtml }
      }

      if (url === miphi.SITEMAP_URL) {
        return { status: 200, url, html: officialSitemapXml }
      }

      if (miphi.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: '' }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    miphi.HOMEPAGE_URL,
    miphi.SITEMAP_URL,
    ...miphi.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('MiPhi Semiconductors fails closed when the homepage, sitemap, or a checked careers route changes materially', async () => {
  const miphi = await loadMiPhiModule()

  await assert.rejects(
    miphi.createMiPhiSemiconductorsScraper().run({
      fetchPage: async (url) => {
        if (url === miphi.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><title>Unexpected</title></html>' }
        }

        if (url === miphi.SITEMAP_URL) {
          return { status: 200, url, html: officialSitemapXml }
        }

        return { status: 404, url, html: '' }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    miphi.createMiPhiSemiconductorsScraper().run({
      fetchPage: async (url) => {
        if (url === miphi.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === miphi.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: officialSitemapXml.replace(
              '</urlset>',
              '<url><loc>https://www.miphi.in/careers</loc></url></urlset>',
            ),
          }
        }

        return { status: 404, url, html: '' }
      },
    }),
    /verified sitemap no longer matches the no-public-careers surface/i,
  )

  await assert.rejects(
    miphi.createMiPhiSemiconductorsScraper().run({
      fetchPage: async (url) => {
        if (url === miphi.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === miphi.SITEMAP_URL) {
          return { status: 200, url, html: officialSitemapXml }
        }

        if (url === miphi.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) {
          return { status: 200, url, html: '<html><body>Current openings</body></html>' }
        }

        return { status: 404, url, html: '' }
      },
    }),
    /verified no-public-careers route/i,
  )
})
