import assert from 'node:assert/strict'
import test from 'node:test'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Kantar discovery uses its officially linked Workday board after the retired GetJobs API', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'kantar')
  assert.ok(provider)
  assert.equal(provider.adapter, 'workday')
  assert.equal(provider.companyName, 'Kantar')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyCareerPage, 'https://www.kantar.com/careers')
  assert.equal(provider.baseUrl, 'https://kantar.wd3.myworkdayjobs.com/KANTAR')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.locationCountry, undefined)
  assert.equal(provider.boardIdentityVerified, true)
})

test('Kantar exposes one runnable replacement scraper and propagates cancellation', async () => {
  const scrapers = buildScrapers().filter((item) => item.name === 'kantar')
  assert.equal(scrapers.length, 1)
  assert.match(scrapers[0].dryRunFile, /kantar[\\/]jobs\.json$/)
  const controller = new AbortController()
  controller.abort(new Error('cancelled Kantar'))
  await assert.rejects(scrapers[0].run({ signal: controller.signal }), /cancelled Kantar/)
})
