import assert from 'node:assert/strict'
import test from 'node:test'
import { createEmbitelTechnologiesScraper, CAREERS_URL } from '../../scraper/embiteltechnologies/script.js'

test('Embitel preserves real HTTP failures instead of treating unavailable inventory as empty', async () => {
  await assert.rejects(createEmbitelTechnologiesScraper().run({
    fetchText: async url => { assert.equal(url, CAREERS_URL); throw new Error('HTTP 307 upstream') },
  }), /HTTP 307 upstream/)
})
test('Embitel rejects a changed official careers employer handoff', async () => {
  await assert.rejects(createEmbitelTechnologiesScraper().run({
    fetchText: async () => '<title>Embitel</title>', fetchJson: async () => assert.fail('No trusted handoff'),
  }), /careers/)
})
test('Embitel cancellation stops before public requests', async () => {
  const controller = new AbortController()
  controller.abort(new Error('cancelled'))
  await assert.rejects(createEmbitelTechnologiesScraper().run({
    signal: controller.signal, fetchText: async () => assert.fail('Cancelled'),
  }), /cancelled/)
})
test('Embitel invalid caps reject before public requests', async () => {
  await assert.rejects(createEmbitelTechnologiesScraper({ maxJobs: 0 }).run({
    fetchText: async () => assert.fail('Invalid cap'),
  }), /positive integer/)
})
