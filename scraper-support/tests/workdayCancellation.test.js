import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers } from '../providers/index.js'

test('the Workday provider adapter forwards runner cancellation before network work starts', async () => {
  const originalFetch = global.fetch
  const controller = new AbortController()
  const abortReason = new Error('runner source budget expired')
  let fetchCalled = false

  const unexpectedFetchError = new Error('network work started after cancellation')
  unexpectedFetchError.softFailure = true
  unexpectedFetchError.abortRetries = true

  global.fetch = async () => {
    fetchCalled = true
    throw unexpectedFetchError
  }
  controller.abort(abortReason)

  try {
    const airbus = buildScrapers().find((scraper) => scraper.name === 'airbus')
    assert.ok(airbus)

    await assert.rejects(
      airbus.run({ signal: controller.signal }),
      (error) => error === abortReason,
    )
    assert.equal(fetchCalled, false)
  } finally {
    global.fetch = originalFetch
  }
})

test('the script provider adapter forwards cancellation through a custom Workday wrapper', async () => {
  const controller = new AbortController()
  let receivedOptions
  const scraper = buildScrapers().find((item) => item.name === 'alphawavesemiindia')
  assert.ok(scraper)

  const jobs = await scraper.run({
    signal: controller.signal,
    workdayRunner: async (options) => {
      receivedOptions = options
      return [{
        title: 'Verification Engineer',
        company: 'Alphawave Semi India',
        location: 'Bengaluru',
        sourceUrl: 'https://example.test/jobs/verification-engineer',
        applyUrl: 'https://example.test/jobs/verification-engineer',
      }]
    },
  })

  assert.equal(receivedOptions.signal, controller.signal)
  assert.equal(receivedOptions.source, 'alphawavesemiindia')
  assert.equal(jobs.length, 1)
})

test('provider decoration preserves an explicitly confirmed Workday empty result', async () => {
  const confirmedEmpty = []
  const authoritativeEmpty = Symbol.for('jobverify.workday.authoritative-empty')
  Object.defineProperty(confirmedEmpty, authoritativeEmpty, { value: true })
  const scraper = buildScrapers().find((item) => item.name === 'alphawavesemiindia')
  assert.ok(scraper)

  const jobs = await scraper.run({
    workdayRunner: async () => confirmedEmpty,
  })

  assert.deepEqual(jobs, [])
  assert.equal(jobs[authoritativeEmpty], true)
})

test('Ohmium job-id backfill preserves confirmed empty provenance', async () => {
  const { backfillMissingJobIds } = await import('../../scraper/ohmiumoperationspltd.workday/script.js')
  const authoritativeEmpty = Symbol.for('jobverify.workday.authoritative-empty')
  const confirmedEmpty = []
  Object.defineProperty(confirmedEmpty, authoritativeEmpty, { value: true })

  const jobs = backfillMissingJobIds(confirmedEmpty)

  assert.deepEqual(jobs, [])
  assert.equal(jobs[authoritativeEmpty], true)
})

test('a custom Workday wrapper forwards cancellation to its preflight request', async () => {
  const controller = new AbortController()
  const preflightError = new Error('stop after capturing preflight options')
  let receivedSignal
  const scraper = buildScrapers().find((item) => item.name === 'cerence')
  assert.ok(scraper)

  await assert.rejects(
    scraper.run({
      signal: controller.signal,
      fetchText: async (_url, options = {}) => {
        receivedSignal = options.signal
        throw preflightError
      },
    }),
    (error) => error === preflightError,
  )

  assert.equal(receivedSignal, controller.signal)
})
