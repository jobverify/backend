import assert from 'node:assert/strict'
import { setImmediate } from 'node:timers/promises'
import test from 'node:test'
import { buildScrapers } from '../../scraper-support/providers/index.js'
import { runScraperWithTimeout } from '../../scraper-support/runner.js'

test('EY runner permits its bounded opening, detail and closing collection to finish', async context => {
  const registered = buildScrapers().find(scraper => scraper.name === 'ey')
  assert.ok(registered)
  context.mock.timers.enable({ apis: ['setTimeout'] })
  let finish, operationSignal
  const jobs = []
  const running = runScraperWithTimeout({ ...registered, run: ({ signal }) => new Promise((resolve, reject) => {
    operationSignal = signal
    finish = () => resolve(jobs)
    signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  }) }, undefined, { nativeDetailRecovery: false, abortGraceMs: 0 })
  running.catch(() => {})
  await setImmediate()
  context.mock.timers.tick(23 * 60 * 1000 + 1)
  await setImmediate()
  assert.equal(operationSignal.aborted, false, 'parent runner must allow the native 23-minute collection budget')
  finish()
  assert.equal(await running, jobs)
})

test('an explicit smaller EY runner deadline still cancels the source', async context => {
  const registered = buildScrapers().find(scraper => scraper.name === 'ey')
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const running = runScraperWithTimeout({ ...registered, run: ({ signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  }) }, 100, { nativeDetailRecovery: false, abortGraceMs: 0 })
  const rejection = assert.rejects(running, /ey.*timed out after 100ms/)
  await setImmediate()
  context.mock.timers.tick(101)
  await rejection
})
