import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { extractIndiaJobsFromGreenhousePayload } from './script.js'

const native = JSON.parse(readFileSync(new URL('./test-data/2026-10-31-native-packets.json', import.meta.url), 'utf8')).feed.jobs.find(job => job.id === 8728555002)
const extract = changes => extractIndiaJobsFromGreenhousePayload({ jobs: [{ ...structuredClone(native), ...changes }], meta: { total: 1 } })

test('Calendly qualifies current San Francisco roles using their explicit native office country', () => {
  assert.deepEqual(extract(), [])
})

for (const place of ['San Francisco (Hybrid)', 'Bengaluru']) test('Calendly does not infer a country from a city-only label ' + place, () => {
  assert.throws(() => extract({ location: { name: place }, offices: [], metadata: [] }), /unresolved.*country/i)
})

test('Calendly accepts explicit native country metadata without relying on a city-name country guess', () => {
  const jobs = extract({ location: { name: 'Bengaluru' }, offices: [], metadata: [{ name: 'Country', value: 'India' }] })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
})

test('Calendly preserves contradictions between explicitly named native workplace countries', () => {
  assert.throws(() => extract({ location: { name: 'Bengaluru, India' }, offices: [], metadata: [{ name: 'Country', value: 'United States' }] }), /contradictory.*country/i)
})
