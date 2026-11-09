import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(currentDir, 'fixtures')

const loadNecModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected NEC Corporation scraper module at ./script.js')
  }
}

const homepageHtml = fs.readFileSync(path.join(fixturesDir, 'homepage.html'), 'utf8')
const careersHtml = fs.readFileSync(path.join(fixturesDir, 'careers.html'), 'utf8')
const sitemapXml = fs.readFileSync(path.join(fixturesDir, 'sitemap.xml'), 'utf8')

test('NEC Corporation recognizes the verified global homepage, sitemap, and zero-job recruit page', async () => {
  const nec = await loadNecModule()

  assert.equal(nec.SOURCE, 'neccorporation')
  assert.equal(nec.COMPANY, 'NEC Corporation')
  assert.equal(nec.HOMEPAGE_URL, 'https://www.nec.com/')
  assert.equal(nec.SITEMAP_URL, 'https://www.nec.com/sitemap.xml')
  assert.equal(nec.CAREERS_URL, 'https://www.nec.com/en/global/rd/rd-recruit/index.html')
  assert.equal(nec.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(nec.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(nec.pageExposesPublicJobListings(careersHtml), false)
  assert.deepEqual(nec.extractCareerSurfaceUrls(sitemapXml), [nec.CAREERS_URL])
})

test('NEC Corporation returns no jobs only while the verified first-party sitemap and recruit page stay unchanged', async () => {
  const nec = await loadNecModule()
  const requestedUrls = []

  const jobs = await nec.createNecCorporationScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === nec.HOMEPAGE_URL) return homepageHtml
      if (url === nec.SITEMAP_URL) return sitemapXml
      if (url === nec.CAREERS_URL) return careersHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    nec.HOMEPAGE_URL,
    nec.SITEMAP_URL,
    nec.CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('NEC Corporation fails closed when the homepage, sitemap, or recruit page contract changes', async () => {
  const nec = await loadNecModule()

  await assert.rejects(
    nec.createNecCorporationScraper().run({
      fetchText: async (url) => {
        if (url === nec.HOMEPAGE_URL) {
          return '<html><head><title>Placeholder</title></head><body>Welcome</body></html>'
        }

        if (url === nec.SITEMAP_URL) return sitemapXml
        if (url === nec.CAREERS_URL) return careersHtml

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official NEC Corporation homepage/i,
  )

  await assert.rejects(
    nec.createNecCorporationScraper().run({
      fetchText: async (url) => {
        if (url === nec.HOMEPAGE_URL) return homepageHtml
        if (url === nec.SITEMAP_URL) {
          return sitemapXml.replace(
            '</urlset>',
            '<url><loc>https://www.nec.com/en/global/careers/index.html</loc></url></urlset>',
          )
        }
        if (url === nec.CAREERS_URL) return careersHtml

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /sitemap/i,
  )

  await assert.rejects(
    nec.createNecCorporationScraper().run({
      fetchText: async (url) => {
        if (url === nec.HOMEPAGE_URL) return homepageHtml
        if (url === nec.SITEMAP_URL) return sitemapXml
        if (url === nec.CAREERS_URL) {
          return `${careersHtml}<section><h2>Current Openings</h2><a href="/jobs/researcher">Apply Now</a></section>`
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public job listings/i,
  )
})
