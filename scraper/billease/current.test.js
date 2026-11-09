import assert from 'node:assert/strict'
import test from 'node:test'

import { verifyCurrentNoIndiaInventory } from './script.js'

const payload = [
  { data: 1 }, ['ShallowReactive', 2], { 'billease-career-jobs': 3 },
  { jobs: 4, failed: 18 }, [5, 11],
  { id: 6, title: 7, location: 8, url: 9 },
  '11111111-1111-4111-8111-111111111111', 'Sales Associate', 'Philippines',
  'https://billease.careers-page.com/jobs/11111111-1111-4111-8111-111111111111',
  null,
  { id: 12, title: 13, location: 14, url: 15 },
  '22222222-2222-4222-8222-222222222222', 'Risk Analyst',
  'Makati City, Metro Manila, Philippines',
  'https://billease.careers-page.com/jobs/22222222-2222-4222-8222-222222222222',
  null, null, false,
]

test('BillEase historical corporate payload decoder checks all records without establishing current full inventory', () => {
  assert.equal(verifyCurrentNoIndiaInventory(payload, 2), true)
  assert.throws(() => verifyCurrentNoIndiaInventory(payload, 1), /count or state/i)
})

test('BillEase historical no-India decoder rejects an India role rather than filtering it out', () => {
  const withIndia = [...payload]
  withIndia[14] = 'Bengaluru, India'
  assert.throws(() => verifyCurrentNoIndiaInventory(withIndia, 2), /India role/i)
})
