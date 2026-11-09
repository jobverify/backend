import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'lapaelectricprivatelimited',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const HOMEPAGE_HTML = readFixture('homepage.html')
const CAREERS_HTML = readFixture('careers.html')
const CAREER_SITEMAP_XML = readFixture('career-sitemap.xml')

const loadModule = async () => {
  try {
    return await import('../../scraper/lapaelectricprivatelimited/script.js')
  } catch {
    assert.fail(
      'Expected Lapa Electric Private Limited scraper module at ../../scraper/lapaelectricprivatelimited/script.js',
    )
  }
}

test('Lapa Electric Private Limited scraper recognizes the verified homepage, careers form surface, and narrative career sitemap', async () => {
  const lapa = await loadModule()

  assert.equal(lapa.SOURCE, 'lapaelectricprivatelimited')
  assert.equal(lapa.COMPANY, 'Lapa Electric Private Limited')
  assert.equal(lapa.HOMEPAGE_URL, 'https://lapaelectric.com/')
  assert.equal(lapa.CAREERS_URL, 'https://lapaelectric.com/lapa-careers/')
  assert.equal(lapa.CAREER_SITEMAP_URL, 'https://lapaelectric.com/career-sitemap.xml')
  assert.deepEqual(lapa.VERIFIED_CAREER_POST_URLS, [
    'https://lapaelectric.com/career/we-dreamt-of-a-scenario-where-innovation-is-human-centric/',
    'https://lapaelectric.com/career/we-are-passionate-engineers-driven-to-bring-the-most-futuristic-ideas-to-reality/',
    'https://lapaelectric.com/career/lapa-electric-is-where-art-concept-meets-engineering/',
    'https://lapaelectric.com/career/join-a-team-of-like-minded-thinkers-who-turn-dreams-into-reality/',
  ])
  assert.equal(lapa.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(lapa.hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.equal(lapa.hasPublicJobsSignal(HOMEPAGE_HTML), false)
  assert.equal(lapa.hasPublicJobsSignal(CAREERS_HTML), false)
  assert.deepEqual(lapa.extractCareerSitemapUrls(CAREER_SITEMAP_XML), lapa.VERIFIED_CAREER_POST_URLS)
  assert.equal(lapa.hasVerifiedNarrativeCareerSitemap(CAREER_SITEMAP_XML), true)
})

test('Lapa Electric Private Limited returns no jobs only while the verified homepage, careers form surface, and narrative career sitemap remain unchanged', async () => {
  const lapa = await loadModule()
  const requestedUrls = []

  const jobs = await lapa.createLapaElectricPrivateLimitedScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === lapa.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          html: HOMEPAGE_HTML,
        }
      }

      if (url === lapa.CAREERS_URL) {
        return {
          status: 200,
          url,
          html: CAREERS_HTML,
        }
      }

      if (url === lapa.CAREER_SITEMAP_URL) {
        return {
          status: 200,
          url,
          html: CAREER_SITEMAP_XML,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    lapa.HOMEPAGE_URL,
    lapa.CAREERS_URL,
    lapa.CAREER_SITEMAP_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Lapa Electric Private Limited fails closed when the homepage, careers form surface, or career sitemap drifts', async () => {
  const lapa = await loadModule()

  await assert.rejects(
    lapa.createLapaElectricPrivateLimitedScraper().run({
      fetchPage: async (url) => {
        if (url === lapa.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Unexpected</title></head><body>No LAPA markers</body></html>',
          }
        }

        if (url === lapa.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: CAREERS_HTML,
          }
        }

        return {
          status: 200,
          url,
          html: CAREER_SITEMAP_XML,
        }
      },
    }),
    /verified official homepage no longer matches the known public surface/i,
  )

  await assert.rejects(
    lapa.createLapaElectricPrivateLimitedScraper().run({
      fetchPage: async (url) => {
        if (url === lapa.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: HOMEPAGE_HTML,
          }
        }

        if (url === lapa.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Careers</h1><a href="/jobs/battery-engineer">Apply now</a></body></html>',
          }
        }

        return {
          status: 200,
          url,
          html: CAREER_SITEMAP_XML,
        }
      },
    }),
    /verified official careers surface no longer matches the known public surface|careers page now appears to expose a public jobs surface/i,
  )

  await assert.rejects(
    lapa.createLapaElectricPrivateLimitedScraper().run({
      fetchPage: async (url) => {
        if (url === lapa.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: HOMEPAGE_HTML,
          }
        }

        if (url === lapa.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: CAREERS_HTML,
          }
        }

        return {
          status: 200,
          url,
          html: `${CAREER_SITEMAP_XML}<url><loc>https://lapaelectric.com/career/senior-battery-engineer/</loc></url>`,
        }
      },
    }),
    /career sitemap changed materially or now exposes public jobs/i,
  )
})
