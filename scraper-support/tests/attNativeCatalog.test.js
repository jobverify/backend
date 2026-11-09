import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {buildScrapers, getScraperCatalog} from '../providers/index.js'
import {resolveScraperRetryAttempts} from '../runner.js'
import {withRetry} from '../utils/retry.js'

const indiaUrl = 'https://www.att.jobs/search-jobs?acm=ALL&alrpm=1269750&ascf=%5B%7B%22key%22%3A%22ALL%22%2C%22value%22%3A%22%22%7D%5D'

test('AT&T registry selects its public native India adapter and preserves its existing source directory', () => {
  const entries = getScraperCatalog().filter(provider => provider.source === 'att')
  assert.equal(entries.length, 1)
  const [provider] = entries
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'talentbrew')
  assert.equal(provider.companyCareerPage, indiaUrl)
  assert.match(provider.modulePath, /scraper[\\/]att\.workday[\\/]script\.js$/)
  assert.match(provider.dryRunFile, /att\.workday[\\/]jobs\.json$/)
  assert.equal(provider.zeroResultPolicy, 'evidence-required')
})

test('selected AT&T executable honors cancellation and rejects a capped native inventory', async () => {
  const scraper = buildScrapers().find(item => item.name === 'att')
  assert.equal(scraper.provider.adapter, 'script')
  const controller = new AbortController()
  const cancellation = Error('AT&T native catalog cancellation')
  controller.abort(cancellation)
  let calls = 0
  await assert.rejects(scraper.run({signal: controller.signal, fetch: async () => {calls++}}), error => error === cancellation)
  assert.equal(calls, 0)
  const first = gunzipSync(fs.readFileSync(new URL('../../scraper/att.workday/fixtures/native-20261025/att-india5.html.gz', import.meta.url))).toString('utf8')
  await assert.rejects(scraper.run({maxJobs: 10, fetch: async url => {
    calls++
    assert.equal(url, indiaUrl)
    return {status: 200, url, text: async () => first}
  }}), /AT&T native.*(?:cap|limit|truncat)/i)
  assert.equal(calls, 1)
})

test('AT&T source deadline does not restart the complete native inventory through the runner retry policy', async () => {
  const scraper = buildScrapers().find(item => item.name === 'att')
  let calls = 0
  const deadline = Error('AT&T native: Source deadline exceeded')
  await assert.rejects(withRetry(() => scraper.run({fetch: async () => {
    calls++
    throw deadline
  }}), {attempts: resolveScraperRetryAttempts(scraper), baseDelayMs: 0, label: 'att'}), /Source deadline exceeded/)
  assert.equal(calls, 1, 'A source deadline must terminate this invocation, not reset it four times')
})
