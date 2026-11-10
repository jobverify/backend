import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { extractRoleSummaries } from './native.js'

const packet = JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261110/current-careers.json.gz', import.meta.url))))

test('the current employer-declared lowercase Linear board retains its exact role and application identities', () => {
  const roles = extractRoleSummaries(packet.body)
  const role = roles.find(role => role.id === '6dd5500a-4bd4-4f57-ba09-7b07acefecf4')
  assert.equal(role.title, 'Account Executive, Enterprise')
  assert.equal(role.jobUrl, 'https://jobs.ashbyhq.com/linear/6dd5500a-4bd4-4f57-ba09-7b07acefecf4')
  assert.equal(role.applyUrl, 'https://jobs.ashbyhq.com/linear/6dd5500a-4bd4-4f57-ba09-7b07acefecf4/application')
})

test('board case support cannot activate a different Ashby employer or host', () => {
  for (const html of [packet.body.replaceAll('ashbyhq.com/linear/', 'ashbyhq.com/foreign/'),
    packet.body.replaceAll('jobs.ashbyhq.com', 'jobs.foreign.example')]) {
    assert.throws(() => extractRoleSummaries(html), /native role identity/)
  }
})
