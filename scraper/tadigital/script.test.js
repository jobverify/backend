import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadTaDigitalModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected TA Digital scraper module at ./script.js')
  }
}

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(currentDir, 'fixtures')

const readFixture = (name) => fs.readFileSync(path.join(fixturesDir, name), 'utf8')

const redirectHtml = readFixture('homepage-redirect.html')
const sitemapXml = readFixture('sitemap.xml')
const parkedLanderHtml = readFixture('lander.html')

test('TA Digital sentinel pins the verified first-party parked-domain contract', async () => {
  const tadigital = await loadTaDigitalModule()

  assert.equal(tadigital.SOURCE, 'tadigital')
  assert.equal(tadigital.COMPANY, 'TA Digital')
  assert.equal(tadigital.HOMEPAGE_URL, 'https://ta.digital/')
  assert.equal(tadigital.CAREERS_URL, 'https://ta.digital/careers')
  assert.equal(tadigital.CAREERS_ALIAS_URL, 'https://ta.digital/careers/')
  assert.equal(tadigital.SITEMAP_URL, 'https://ta.digital/sitemap.xml')
  assert.equal(tadigital.BLOCKED_LANDER_URL, 'https://ta.digital/lander')
  assert.equal(
    tadigital.BLOCKED_REASON,
    'Official ta.digital routes currently resolve to a parked /lander page and expose no stable first-party careers or apply surface.',
  )
  assert.equal(
    tadigital.extractRedirectTarget(redirectHtml, tadigital.HOMEPAGE_URL),
    'https://ta.digital/lander',
  )
  assert.deepEqual(tadigital.extractSitemapUrls(sitemapXml), ['https://ta.digital/lander'])
  assert.equal(
    tadigital.hasParkedLanderSignal({
      status: 200,
      url: tadigital.BLOCKED_LANDER_URL,
      html: parkedLanderHtml,
    }),
    true,
  )
})

test('TA Digital sentinel returns no jobs only while the verified official routes stay parked and non-public', async () => {
  const tadigital = await loadTaDigitalModule()
  const requestedUrls = []

  const jobs = await tadigital.createTaDigitalScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (
        url === tadigital.HOMEPAGE_URL
        || url === tadigital.CAREERS_URL
        || url === tadigital.CAREERS_ALIAS_URL
      ) {
        return {
          status: 200,
          url,
          html: redirectHtml,
        }
      }

      if (url === tadigital.SITEMAP_URL) {
        return {
          status: 200,
          url,
          html: sitemapXml,
        }
      }

      if (url === tadigital.BLOCKED_LANDER_URL) {
        return {
          status: 200,
          url,
          html: parkedLanderHtml,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    tadigital.HOMEPAGE_URL,
    tadigital.CAREERS_URL,
    tadigital.CAREERS_ALIAS_URL,
    tadigital.SITEMAP_URL,
    tadigital.BLOCKED_LANDER_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('TA Digital sentinel fails closed when the official careers route stops matching the blocked parked shell', async () => {
  const tadigital = await loadTaDigitalModule()

  await assert.rejects(
    tadigital.createTaDigitalScraper().run({
      fetchPage: async (url) => {
        if (url === tadigital.HOMEPAGE_URL || url === tadigital.CAREERS_ALIAS_URL) {
          return { status: 200, url, html: redirectHtml }
        }

        if (url === tadigital.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Current Openings</h1><a href="/apply">Apply now</a></body></html>',
          }
        }

        if (url === tadigital.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }

        if (url === tadigital.BLOCKED_LANDER_URL) {
          return { status: 200, url, html: parkedLanderHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official careers route changed materially/i,
  )
})

test('TA Digital sentinel fails closed when the parked lander stops matching the verified non-public surface', async () => {
  const tadigital = await loadTaDigitalModule()

  await assert.rejects(
    tadigital.createTaDigitalScraper().run({
      fetchPage: async (url) => {
        if (
          url === tadigital.HOMEPAGE_URL
          || url === tadigital.CAREERS_URL
          || url === tadigital.CAREERS_ALIAS_URL
        ) {
          return { status: 200, url, html: redirectHtml }
        }

        if (url === tadigital.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }

        if (url === tadigital.BLOCKED_LANDER_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Current Openings</h1><a href="/apply">Apply now</a></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /blocked lander no longer matches the verified parked non-public surface/i,
  )
})
