import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'industowersltd',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const verifiedCareersHtml = readFixture('careers.html')

const loadIndusTowersLtdModule = async () => {
  try {
    return await import('../../scraper/industowersltd/script.js')
  } catch {
    assert.fail('Expected Indus Towers Ltd scraper module at ../../scraper/industowersltd/script.js')
  }
}

test('Indus Towers Ltd validates the verified official careers shell and detects public job signals', async () => {
  const indusTowersLtd = await loadIndusTowersLtdModule()

  assert.equal(indusTowersLtd.SOURCE, 'industowersltd')
  assert.equal(indusTowersLtd.COMPANY, 'Indus Towers Ltd')
  assert.equal(indusTowersLtd.CAREERS_URL, 'https://www.industowers.com/careers/')
  assert.equal(indusTowersLtd.hasOfficialCareersSignal(verifiedCareersHtml), true)
  assert.equal(
    indusTowersLtd.hasOfficialCareersSignal('<html><body><h1>Careers</h1><p>Placeholder</p></body></html>'),
    false,
  )
  assert.equal(indusTowersLtd.hasPublicJobListingsSignal(verifiedCareersHtml), false)
  assert.equal(
    indusTowersLtd.hasPublicJobListingsSignal(
      `${verifiedCareersHtml}<section><h2>Current Openings</h2><a href="/jobs/rf-engineer">Apply now</a></section>`,
    ),
    true,
  )
})

test('Indus Towers Ltd returns no jobs for the verified official careers shell without public listings', async () => {
  const indusTowersLtd = await loadIndusTowersLtdModule()
  const requestedUrls = []

  const jobs = await indusTowersLtd.createIndusTowersLtdScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return verifiedCareersHtml
    },
  })

  assert.deepEqual(requestedUrls, ['https://www.industowers.com/careers/'])
  assert.deepEqual(jobs, [])
})

test('Indus Towers Ltd fails closed when the verified careers shell changes or exposes jobs', async () => {
  const indusTowersLtd = await loadIndusTowersLtdModule()

  await assert.rejects(
    indusTowersLtd.createIndusTowersLtdScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1><p>Placeholder</p></body></html>',
    }),
    /Indus Towers Ltd official careers page changed/i,
  )

  await assert.rejects(
    indusTowersLtd.createIndusTowersLtdScraper().run({
      fetchText: async () =>
        verifiedCareersHtml.replace(
          '</main>',
          '<section><h2>Current Openings</h2><a href="/jobs/rf-engineer">Apply now</a></section></main>',
        ),
    }),
    /Indus Towers Ltd careers page now appears to expose public job listings/i,
  )
})
