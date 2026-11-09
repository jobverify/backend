import assert from 'node:assert/strict'
import test from 'node:test'
import * as civica from '../../scraper/civicaindia/script.js'
import { civicaNativeOptions } from './fixtures/civicaNativeOptions.js'

test('Civica India retains source identity and selects the current native board', () => {
  assert.equal(civica.SOURCE, 'civicaindia')
  assert.equal(civica.COMPANY, 'Civica India')
  assert.equal(civica.WORKABLE_PAGE_URL, 'https://apply.workable.com/civica-uk-ltd-1/')
  assert.equal(civica.PROVIDER_METADATA.officialBrandName, 'Civica')
})

test('Civica wrapper forwards transport, time and output limits to complete native extraction', async () => {
  const options = civicaNativeOptions()
  const jobs = await civica.createCivicaIndiaScraper({ now: options.now }).run({ ...options, maxJobs: 2 })
  assert.equal(jobs.length, 2)
  assert.ok(options.calls.every(call => !call.url.includes('/civica/llms')))
})

test('Civica rejects a current corporate challenge instead of inheriting a retired board zero', async () => {
  await assert.rejects(civica.run({ fetchPage: async url => ({ status: 403, url, html: '<title>Just a moment...</title>' }) }), /first-party.*unavailable/i)
})
