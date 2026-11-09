import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  HOMEPAGE_URL,
  NO_PUBLIC_CAREERS_ROUTE_URLS,
  SITEMAP_URL,
  createMiPhiSemiconductorsScraper,
  hasOfficialHomepageSignal,
  pageHasCareersSignal,
  sitemapHasCareerLikeUrl,
} from './script.js'

const fixturesDir = path.dirname(fileURLToPath(import.meta.url))
const readFixture = (name) => readFileSync(path.join(fixturesDir, 'fixtures', name), 'utf8')

const verifiedHomepageHtml = readFixture('homepage.html')
const verifiedSitemapXml = readFixture('sitemap.xml')

const currentHomepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>MIPHI Semiconductors | Secure Data Storage &amp; SSDs India</title>
    </head>
    <body>
      <main>
        <section>
          <h1>Bringing Storage IC Design and Manufacturing to India</h1>
          <p>MiPhi: Powered by Phison, Enhanced by Micromax</p>
          <p>
            Welcome to MiPhi, a venture dedicated to transforming semiconductor memory design and
            manufacturing in India.
          </p>
          <p>MiPhi is positioned to become a leading Indian semiconductor company from its inception.</p>
          <p>Committed to the "Make in India" vision.</p>
        </section>
      </main>
    </body>
  </html>
`

test('MiPhi Semiconductors accepts the verified and current homepage variants', () => {
  assert.equal(hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(hasOfficialHomepageSignal(currentHomepageHtml), true)
  assert.equal(pageHasCareersSignal(currentHomepageHtml), false)
  assert.equal(sitemapHasCareerLikeUrl(verifiedSitemapXml), false)
})

test('MiPhi Semiconductors validates the no-public-careers surface before returning no jobs', async () => {
  const requestedUrls = []

  const jobs = await createMiPhiSemiconductorsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) {
        return { status: 200, url, html: currentHomepageHtml }
      }

      if (url === SITEMAP_URL) {
        return { status: 200, url, html: verifiedSitemapXml }
      }

      if (NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: '<html><body>Not found</body></html>' }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    HOMEPAGE_URL,
    SITEMAP_URL,
    ...NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})
