import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const readFixture = (name) => readFileSync(path.join(currentDir, 'fixtures', name), 'utf8')

const homepageHtml = readFixture('homepage.html')
const missingRouteHtml = readFixture('missing-route-404.html')

const underDevelopmentHomepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Website Under Development</title>
    </head>
    <body>
      <main>
        <h1>Under Development</h1>
        <h2>This website is coming soon!</h2>
        <p>We are working hard to bring something amazing. Please check back soon.</p>
        <p>Managed by <a href="https://www.hwplindia.com">HorizonWebinfo Pvt Ltd</a></p>
        <p>ERP | CRM | Mobile Application | Website | HRMS</p>
      </main>
    </body>
  </html>
`

const loadModule = async () => import('./script.js')

test('pins the Gensol Param Renewable / Gensol-Anvi Power sentinel to the verified first-party Gensol placeholder surface', async () => {
  const scraperModule = await loadModule()

  assert.equal(scraperModule.SOURCE, 'gensolparamrenewableanvipower')
  assert.equal(scraperModule.COMPANY, 'Gensol Param Renewable / Gensol-Anvi Power')
  assert.equal(scraperModule.HOMEPAGE_URL, 'https://www.gensol.in/')
  assert.deepEqual(scraperModule.CAREERS_ROUTE_URLS, [
    'https://www.gensol.in/careers',
    'https://www.gensol.in/jobs',
  ])
  assert.equal(scraperModule.hasVerifiedHomepageSignal(homepageHtml), true)
  assert.equal(scraperModule.hasVerifiedHomepageSignal(underDevelopmentHomepageHtml), true)
  assert.equal(scraperModule.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(
    scraperModule.isVerifiedMissingRoute({
      status: 404,
      url: scraperModule.CAREERS_ROUTE_URLS[0],
      html: missingRouteHtml,
    }),
    true,
  )
})

test('returns no jobs only while the verified first-party placeholder and missing career routes remain unchanged', async () => {
  const scraperModule = await loadModule()
  const requestedUrls = []

  const jobs = await scraperModule.createGensolParamRenewableAnviPowerScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === scraperModule.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          html: homepageHtml,
        }
      }

      if (scraperModule.CAREERS_ROUTE_URLS.includes(url)) {
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
    scraperModule.HOMEPAGE_URL,
    ...scraperModule.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('returns no jobs while the current under-development placeholder and missing career routes remain unchanged', async () => {
  const scraperModule = await loadModule()

  const jobs = await scraperModule.createGensolParamRenewableAnviPowerScraper().run({
    fetchPage: async (url) => {
      if (url === scraperModule.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          html: underDevelopmentHomepageHtml,
        }
      }

      if (scraperModule.CAREERS_ROUTE_URLS.includes(url)) {
        return {
          status: 404,
          url,
          html: missingRouteHtml,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('exposes runner metadata for later registry integration without claiming a public jobs board', async () => {
  const scraperModule = await loadModule()

  assert.deepEqual(scraperModule.getRunnerMetadata(), {
    name: 'gensolparamrenewableanvipower',
    dryRunFile: 'jobs.json',
    provider: {
      source: 'gensolparamrenewableanvipower',
      companyName: 'Gensol Param Renewable / Gensol-Anvi Power',
      companyCareerPage: 'https://www.gensol.in/',
      alternateCareerPages: [
        'https://www.gensol.in/careers',
        'https://www.gensol.in/jobs',
      ],
      adapter: 'script',
      atsPlatform: 'official-company-site-no-public-careers',
      countryFilter: 'India',
      parser: 'custom-script',
      paginationStrategy: 'homepage-plus-common-careers-route-validation',
      extractionStrategy: 'verified-official-homepage-plus-missing-first-party-careers-routes-return-empty',
      normalizationProfile: 'engineering-default',
      companyDomain: 'gensol.in',
    },
  })
})

test('fails closed when the verified homepage or missing-route contract changes', async () => {
  const scraperModule = await loadModule()

  await assert.rejects(
    scraperModule.createGensolParamRenewableAnviPowerScraper().run({
      fetchPage: async (url) => {
        if (url === scraperModule.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Unexpected homepage</h1></body></html>',
          }
        }

        return {
          status: 404,
          url,
          html: missingRouteHtml,
        }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    scraperModule.createGensolParamRenewableAnviPowerScraper().run({
      fetchPage: async (url) => {
        if (url === scraperModule.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: `${homepageHtml}<a href="https://jobs.example.com/gensol">Current openings</a>`,
          }
        }

        return {
          status: 404,
          url,
          html: missingRouteHtml,
        }
      },
    }),
    /homepage now appears to expose a public jobs surface/i,
  )

  await assert.rejects(
    scraperModule.createGensolParamRenewableAnviPowerScraper().run({
      fetchPage: async (url) => {
        if (url === scraperModule.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: homepageHtml,
          }
        }

        return {
          status: 200,
          url,
          html: '<html><body><h1>Careers</h1><a href="/roles/solar-engineer">Apply now</a></body></html>',
        }
      },
    }),
    /careers routes changed materially or now expose public jobs/i,
  )
})
