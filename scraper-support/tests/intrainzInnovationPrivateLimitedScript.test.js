import assert from 'node:assert/strict'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'intrainzinnovationprivatelimited',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const verifiedShellHtml = readFixture('place-mantra-shell.html')

const loadIntrainzModule = async () => {
  try {
    return await import('../../scraper/intrainzinnovationprivatelimited/script.js')
  } catch {
    assert.fail('Expected INTRAINZ INNOVATION PRIVATE LIMITED scraper module at ../../scraper/intrainzinnovationprivatelimited/script.js')
  }
}

test('INTRAINZ INNOVATION PRIVATE LIMITED recognizes the verified first-party repurposed shell and absence of public job signals', async () => {
  const intrainz = await loadIntrainzModule()

  assert.equal(intrainz.SOURCE, 'intrainzinnovationprivatelimited')
  assert.equal(intrainz.COMPANY, 'INTRAINZ INNOVATION PRIVATE LIMITED')
  assert.equal(intrainz.HOMEPAGE_URL, 'https://www.intrainz.com/')
  assert.deepEqual(intrainz.CHECKED_ROUTE_URLS, [
    'https://www.intrainz.com/careers',
    'https://www.intrainz.com/careers/',
    'https://www.intrainz.com/career',
    'https://www.intrainz.com/jobs',
    'https://www.intrainz.com/jobs/',
    'https://www.intrainz.com/join-us',
    'https://www.intrainz.com/join-us/',
  ])
  assert.equal(intrainz.hasVerifiedShellSignal(verifiedShellHtml), true)
  assert.equal(intrainz.hasVerifiedShellSignal('<html><head><title>Unexpected</title></head><body>Placeholder</body></html>'), false)
  assert.equal(intrainz.hasPublicJobSignal(verifiedShellHtml), false)
  assert.equal(
    intrainz.hasPublicJobSignal('<html><body><section><h2>Current openings</h2><a href="/jobs/data-engineer">Apply now</a></section></body></html>'),
    true,
  )
})

test('INTRAINZ INNOVATION PRIVATE LIMITED returns no jobs only while the verified first-party shell remains unchanged across common careers routes', async () => {
  const intrainz = await loadIntrainzModule()
  const requestedUrls = []

  const jobs = await intrainz.createIntrainzInnovationPrivateLimitedScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return {
        status: 200,
        url,
        html: verifiedShellHtml,
      }
    },
  })

  assert.deepEqual(requestedUrls, [
    intrainz.HOMEPAGE_URL,
    ...intrainz.CHECKED_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('INTRAINZ INNOVATION PRIVATE LIMITED fails closed when the verified first-party shell changes or public job signals appear', async () => {
  const intrainz = await loadIntrainzModule()

  await assert.rejects(
    intrainz.createIntrainzInnovationPrivateLimitedScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: url === intrainz.HOMEPAGE_URL
          ? '<html><head><title>Unexpected</title></head><body>Placeholder</body></html>'
          : verifiedShellHtml,
      }),
    }),
    /verified first-party shell/i,
  )

  await assert.rejects(
    intrainz.createIntrainzInnovationPrivateLimitedScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: intrainz.CHECKED_ROUTE_URLS[0] === url
          ? `${verifiedShellHtml}<section><h2>Current openings</h2><a href="/jobs/data-engineer">Apply now</a></section>`
          : verifiedShellHtml,
      }),
    }),
    /public job signals/i,
  )
})
