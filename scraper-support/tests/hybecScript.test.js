import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'hybec',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const verifiedHomepageHtml = readFixture('homepage.html')

const loadHybecModule = async () => {
  try {
    return await import('../../scraper/hybec/script.js')
  } catch {
    assert.fail('Expected Hybec scraper module at ../../scraper/hybec/script.js')
  }
}

test('Hybec sentinels recognize the verified official homepage placeholder shell', async () => {
  const hybec = await loadHybecModule()

  assert.equal(hybec.SOURCE, 'hybec')
  assert.equal(hybec.COMPANY, 'Hybec')
  assert.equal(hybec.COMPANY_DOMAIN, 'hybec.co.in')
  assert.equal(hybec.VERIFIED_AT, '2026-08-15')
  assert.equal(hybec.HOMEPAGE_URL, 'https://hybec.co.in/')
  assert.equal(
    hybec.isExpectedUnreachableSurface({
      errorKind: 'timeout',
      status: null,
      html: null,
    }),
    true,
  )
  assert.equal(hybec.isExpectedUnreachableSurface({ errorKind: 'dns' }), false)
  assert.equal(hybec.isUnexpectedReachableSurface({ status: 200, html: verifiedHomepageHtml }), true)
  assert.equal(
    hybec.isUnexpectedReachableSurface({
      errorKind: 'timeout',
      status: null,
      html: null,
    }),
    false,
  )
  assert.equal(hybec.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(hybec.hasFirstPartyCareerLikeLink(verifiedHomepageHtml), false)
  assert.equal(hybec.hasPublicJobsSignal(verifiedHomepageHtml), false)
  assert.equal(
    hybec.hasFirstPartyCareerLikeLink(
      verifiedHomepageHtml.replace(
        '<a href="#contact">Contact Us</a>',
        '<a href="/careers">Careers</a>',
      ),
    ),
    true,
  )
})

test('Hybec returns no jobs only while the verified first-party homepage shell exposes no public jobs', async () => {
  const hybec = await loadHybecModule()
  const requestedUrls = []

  const jobs = await hybec.createHybecScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return {
        status: 200,
        url,
        html: verifiedHomepageHtml,
      }
    },
  })

  assert.deepEqual(requestedUrls, [hybec.HOMEPAGE_URL])
  assert.deepEqual(jobs, [])
})

test('Hybec returns no jobs when the verified first-party homepage is temporarily unreachable with a connect-timeout sentinel', async () => {
  const hybec = await loadHybecModule()
  const requestedUrls = []

  const jobs = await hybec.createHybecScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return {
        status: null,
        url,
        html: null,
        errorKind: 'timeout',
      }
    },
  })

  assert.deepEqual(requestedUrls, [hybec.HOMEPAGE_URL])
  assert.deepEqual(jobs, [])
})

test('Hybec fails closed when the homepage changes or starts exposing careers or jobs signals', async () => {
  const hybec = await loadHybecModule()

  await assert.rejects(
    hybec.createHybecScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: '<html><head><title>Unexpected</title></head><body>Different site</body></html>',
      }),
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    hybec.createHybecScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: verifiedHomepageHtml.replace(
          '<a href="#contact">Contact Us</a>',
          '<a href="/careers">Careers</a>',
        ),
      }),
    }),
    /first-party careers or jobs link/i,
  )

  await assert.rejects(
    hybec.createHybecScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: verifiedHomepageHtml.replace(
          '<h1>Launching Soon</h1>',
          '<h1>Launching Soon</h1><p>Current Openings Apply now.</p>',
        ),
      }),
    }),
    /public jobs surface/i,
  )
})
