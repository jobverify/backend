import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { qualifyCurrentEpamModel } from './currentModel20261113.js'

const directory = new URL('./fixtures/current-20261113/', import.meta.url)
const receipts = JSON.parse(readFileSync(new URL('receipts.json', directory)))
const rows = receipts.filter(row => row.requestedUrl.includes('/api/jobs/v2/search/')).flatMap(row => {
  const body = gunzipSync(readFileSync(new URL(row.file, directory)))
  assert.equal(createHash('sha256').update(body).digest('hex'), row.sha256)
  return JSON.parse(body).data.jobs
})

test('current EPAM model qualification keeps all 256 originals and explicitly holds 119 relocation models', () => {
  const before = JSON.stringify(rows)
  let qualified = 0, held = 0
  for (const row of rows) {
    try {
      const result = qualifyCurrentEpamModel(row)
      assert.ok(result.jobDescription.includes(row.text))
      assert.equal(result.applicationType, 'full-self-service')
      qualified++
    } catch (error) {
      assert.equal(error.code, 'native-relocation-criteria-unqualified')
      held++
    }
  }
  assert.deepEqual({ qualified, held }, { qualified: 137, held: 119 })
  assert.equal(JSON.stringify(rows), before, 'Qualification cannot rewrite original publisher fields')
})

for (const [name, mutate] of [
  ['hidden role title', row => { row.name = '<span hidden>' + row.name + '</span>' }],
  ['encoded markup in role title', row => { row.name = '&lt;style&gt;body{display:none}&lt;/style&gt;' + row.name }],
  ['stylesheet in skill metadata', row => { row.metadata.skills[0].title += '<style>body{display:none}</style>' }],
  ['offscreen primary skill', row => { row.primary_skill = '<span style="position:fixed;left:-9999px">' + row.primary_skill + '</span>' }],
]) test(`current EPAM rejects ${name} before the role can be published`, () => {
  const row = structuredClone(rows[0])
  mutate(row)
  assert.throws(() => qualifyCurrentEpamModel(row), /native-non-criteria-markup-unqualified/)
})

for (const [name, mutate] of [
  ['unknown nested seniority member', row => { row.metadata.seniority[0].unreviewedRequirement = 'Additional certification required' }],
  ['different native tenant', row => { row.tenant = 'anywhere'; row.unique_id = 'anywhere_' + row.uid + '_en-us' }],
  ['calendar-invalid original posting date', row => { row.created_at = '2026-02-30T09:00:00.000Z' }],
  ['additional required test', row => { row.tests.required = true }],
]) test(`current EPAM holds ${name} without rewriting its original model`, () => {
  const row = structuredClone(rows[0])
  mutate(row)
  const before = JSON.stringify(row)
  assert.throws(() => qualifyCurrentEpamModel(row))
  assert.equal(JSON.stringify(row), before)
})
