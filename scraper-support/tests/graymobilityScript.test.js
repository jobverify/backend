import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../scraper/graymobility/fixtures',
)

const readHtmlFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const verifiedHomepageHtml = readHtmlFixture('homepage.html')
const verifiedCareers404Html = readHtmlFixture('careers-404.html')

const loadGraymobilityModule = async () => {
  try {
    return await import('../../scraper/graymobility/script.js')
  } catch {
    assert.fail('Expected Graymobility scraper module at ../../scraper/graymobility/script.js')
  }
}

test('Graymobility validates the verified homepage and branded missing careers routes', async () => {
  const graymobility = await loadGraymobilityModule()

  assert.equal(graymobility.SOURCE, 'graymobility')
  assert.equal(graymobility.COMPANY, 'Gray Mobility')
  assert.equal(graymobility.HOMEPAGE_URL, 'https://graymobility.com/')
  assert.deepEqual(graymobility.CAREERS_ROUTE_URLS, [
    'https://graymobility.com/careers',
    'https://graymobility.com/careers/',
    'https://graymobility.com/career',
    'https://graymobility.com/career/',
    'https://graymobility.com/jobs',
  ])
  assert.equal(graymobility.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(graymobility.hasPublicJobsSignal(verifiedHomepageHtml), false)
  assert.equal(
    graymobility.isVerifiedMissingCareersRoute({
      status: 404,
      url: graymobility.CAREERS_ROUTE_URLS[0],
      headers: {},
      html: verifiedCareers404Html,
    }),
    true,
  )
  assert.equal(
    graymobility.isVerifiedMissingCareersRoute({
      status: 200,
      url: graymobility.CAREERS_ROUTE_URLS[0],
      headers: {},
      html: '<html><body><h1>Careers</h1><a href="/jobs/design-engineer">Apply now</a></body></html>',
    }),
    false,
  )
})

test('Graymobility returns no jobs only while the verified homepage and missing careers routes remain unchanged', async () => {
  const graymobility = await loadGraymobilityModule()
  const requestedUrls = []

  const jobs = await graymobility.createGraymobilityScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === graymobility.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          headers: {},
          html: verifiedHomepageHtml,
        }
      }

      if (graymobility.CAREERS_ROUTE_URLS.includes(url)) {
        return {
          status: 404,
          url,
          headers: {},
          html: verifiedCareers404Html,
        }
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    graymobility.HOMEPAGE_URL,
    ...graymobility.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Graymobility fails closed when the homepage or missing careers route contract changes', async () => {
  const graymobility = await loadGraymobilityModule()

  await assert.rejects(
    graymobility.createGraymobilityScraper().run({
      fetchPage: async (url) => {
        if (url === graymobility.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: '<html><body><h1>Unexpected homepage</h1></body></html>',
          }
        }

        return {
          status: 404,
          url,
          headers: {},
          html: verifiedCareers404Html,
        }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    graymobility.createGraymobilityScraper().run({
      fetchPage: async (url) => {
        if (url === graymobility.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: `${verifiedHomepageHtml}<a href="https://jobs.ashbyhq.com/graymobility">Open positions</a>`,
          }
        }

        return {
          status: 404,
          url,
          headers: {},
          html: verifiedCareers404Html,
        }
      },
    }),
    /homepage now appears to expose a public jobs surface/i,
  )

  await assert.rejects(
    graymobility.createGraymobilityScraper().run({
      fetchPage: async (url) => {
        if (url === graymobility.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: verifiedHomepageHtml,
          }
        }

        if (url === graymobility.CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            headers: {},
            html: '<html><body><h1>Careers</h1><a href="/jobs/design-engineer">Apply now</a></body></html>',
          }
        }

        return {
          status: 404,
          url,
          headers: {},
          html: verifiedCareers404Html,
        }
      },
    }),
    /careers routes changed materially or now expose public jobs/i,
  )
})

test('Graymobility returns an empty result when the verified no-jobs surface is temporarily timeout-blocked', async () => {
  const graymobility = await loadGraymobilityModule()

  const jobs = await graymobility.createGraymobilityScraper().run({
    fetchPage: async () => {
      throw new Error(
        'fetch failed | Connect Timeout Error (attempted addresses: 76.223.105.230:443, 13.248.243.5:443, timeout: 10000ms)',
      )
    },
  })

  assert.deepEqual(jobs, [])
})
