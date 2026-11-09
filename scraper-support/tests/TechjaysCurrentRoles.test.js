import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import mongoose from 'mongoose'
import Job from '../../src/models/Job.js'
import { saveToDB as persistJobs } from '../utils/saveToDB.js'

// These persistence fixtures stub MongoDB; transactional alert behavior has its own replica-set suite.
const saveToDB = (jobs, source, options = {}) => persistJobs(jobs, source, { enqueueAlerts: false, ...options })
import * as techjays from '../../scraper/techjays/script.js'
const fixture = (name) => readFileSync(new URL('./fixtures/techjays/' + name, import.meta.url), 'utf8')
const board = fixture('current-openings.html')
const baseDetail = fixture('current-detail.html')
const homepage = '<title>Techjays | The AI Reimagination Company</title><h1>The AI Reimagination Company</h1><a href="/careers">Careers</a>'
const fixtureFetch = async (url) => {
  let html = url === techjays.HOMEPAGE_URL ? homepage : board
  if (url !== techjays.HOMEPAGE_URL && url !== techjays.CAREERS_URL) {
    const card = techjays.extractCurrentRoleCards(board).find(card => card.sourceUrl === url)
    assert.ok(card, 'unexpected role request')
    html = baseDetail.replaceAll('AI Lead', card.title).replaceAll('YnrdIjbjMq4_Hc87i5hKKA', card.jobId)
  }
  return { status: 200, url, html, headers: {} }
}

test('Techjays reads six official cards and keeps organization headquarters separate from role locations', () => {
  const cards = techjays.extractCurrentRoleCards(board)
  assert.equal(cards.length, 6)
  assert.equal(cards.filter(card => card.location === 'Coimbatore / Hybrid').length, 2)
  assert.equal(cards.filter(card => card.location == null).length, 4)
  const detail = techjays.extractCurrentRoleDetail(baseDetail, cards[0])
  assert.equal(detail.location, null)
  assert.equal(detail.country, null)
  assert.match(detail.jobDescription, /Python/)
})

test('Techjays returns verified India positives with an incomplete marker and reports the unknown roles', async () => {
  const diagnostics = []
  const jobs = await techjays.run({ fetchPage: fixtureFetch, onDiagnostic: diagnostic => diagnostics.push(diagnostic) })
  assert.equal(jobs.length, 2)
  assert.ok(jobs.every(job => job.country === 'India' && job.city === 'Coimbatore' && job.sourceListingComplete === false))
  assert.equal(diagnostics[0].code, 'incomplete_location_scope')
  assert.equal(diagnostics[0].unknownJobs.length, 4)
  assert.ok(diagnostics[0].unknownJobs.every(job => job.country === null))
})

test('Techjays refuses a truncated board or a mismatched role detail', async () => {
  assert.throws(() => techjays.extractCurrentRoleCards(board.replace('class="careers-job-card"', 'class="missing-card"')), /incomplete/i)
  const card = techjays.extractCurrentRoleCards(board)[0]
  assert.throws(() => techjays.extractCurrentRoleDetail(baseDetail.replace('<h1 class="type-display"', '<h1 data-invalid="true"').replace('>AI Lead</h1>', '>Another Role</h1>'), card), /identity|title/i)
})

test('Techjays partial India output preserves unseen vacancies in the real persistence lifecycle', async (t) => {
  const state = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState')
  Object.defineProperty(mongoose.connection, 'readyState', { configurable: true, value: 1 })
  t.after(() => { if (state) Object.defineProperty(mongoose.connection, 'readyState', state); else delete mongoose.connection.readyState })
  let writes = []
  const lifecycleUpdates = []
  t.mock.method(Job, 'bulkWrite', async operations => { writes = operations; return { modifiedCount: 2, upsertedCount: 0 } })
  t.mock.method(Job, 'updateMany', filter => { lifecycleUpdates.push(filter); return { exec: async () => ({ modifiedCount: 1 }) } })
  const jobs = await techjays.run({ fetchPage: fixtureFetch, onDiagnostic: () => {} })
  const result = await saveToDB(jobs, 'techjays', { enrichPublicExperience: false, refreshDatasetSummary: false })
  assert.equal(writes.length, 2)
  assert.deepEqual(lifecycleUpdates, [])
  assert.equal(result.staleCheckSkipped, true)
  assert.match(result.staleCheckReason, /incomplete/i)
  assert.equal(result.expired, 0)
})
