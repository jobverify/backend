import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createAgNextScraper } from '../../scraper/agnext/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const home = '<title>AgNext</title><a href="https://agnext.keka.com/careers">Explore Current Openings</a>'
const board = '<title>AgNext</title><app-root></app-root>'
const response = (body, type = 'text/html') => new Response(body, { headers: { 'content-type': type } })
const observedHome = JSON.parse(readFileSync(new URL('../../scraper/agnext/fixtures/home-response.json', import.meta.url)))
const observedBoard = JSON.parse(readFileSync(new URL('../../scraper/agnext/fixtures/careers-response.json', import.meta.url)))

test('AgNext observes the official handoff and does not call a generic board shell verified empty', async () => {
  const urls = []
  const jobs = await createAgNextScraper({ fetchImpl: async (url) => {
    urls.push(url)
    return response(url === 'https://www.agnext.com/' ? home : board)
  } }).run()
  assert.ok(urls.includes('https://www.agnext.com/'))
  assert.ok(urls.includes('https://agnext.keka.com/careers'))
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.listingComplete, false)
  assert.notEqual(evidence.status, 'verified-empty')
  assert.equal(evidence.firstParty, true)
  assert.ok(Date.now() - Date.parse(evidence.verifiedAt) < 5000)
})

test('AgNext rejects an unrelated homepage instead of silently returning empty', async () => {
  await assert.rejects(createAgNextScraper({ fetchImpl: async () => response('<title>Access denied</title>') }).run(), /handoff|official|AgNext/i)
})

test('AgNext honors cancellation before requesting public source pages', async () => {
  const controller = new AbortController()
  controller.abort(new Error('AgNext cancelled by caller'))
  await assert.rejects(createAgNextScraper({ fetchImpl: async () => { throw new Error('must not fetch') } }).run({ signal: controller.signal }), /cancelled by caller/)
})

test('AgNext rejects a failed official source response rather than reporting zero inventory', async () => {
  await assert.rejects(createAgNextScraper({ fetchImpl: async () => new Response('Unavailable', { status: 503 }) }).run(), /HTTP 503/)
})

test('AgNext cancels an in-flight source request', async () => {
  const controller = new AbortController()
  const scraper = createAgNextScraper({ fetchImpl: async (_url, { signal }) => {
    queueMicrotask(() => controller.abort(new Error('stop AgNext request')))
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }))
  } })
  await assert.rejects(scraper.run({ signal: controller.signal }), /stop AgNext request/)
})

test('AgNext captured HTTP 200 Forbidden Access page is an upstream failure, never an empty inventory', async () => {
  await assert.rejects(createAgNextScraper({ fetchImpl: async (url) => {
    return response(url === 'https://www.agnext.com/' ? observedHome.body : observedBoard.body)
  } }).run(), /board is blocked/)
})

test('AgNext observation also accepts its captured official homepage handoff', async () => {
  const jobs = await createAgNextScraper({ fetchImpl: async (url) => response(url === 'https://www.agnext.com/' ? observedHome.body : board) }).run()
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
})
