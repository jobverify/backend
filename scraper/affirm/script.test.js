import { checkCurrentReplay, assertCurrentProvider } from '../../scraper-support/native-sources/declaredJobFeeds/legacyReplayControls.js'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261024.json.gz', import.meta.url))))
test('affirm: current original-entity complete replay (legacy case 9)', async () => checkCurrentReplay('affirm', 'complete'))

test('affirm: current original-entity india replay (legacy case 22)', async () => checkCurrentReplay('affirm', 'india'))

for (const [name, change] of [
  ['generic remote', j => { j.location.name = 'Remote' }],
  ['unresolved country', j => { j.location.name = 'Global Remote' }],
  ['foreign and global scope', j => { j.location.name = 'Remote US or Worldwide' }],
  ['foreign scope with an unrecognized second location', j => { j.location.name = 'Remote US or Bangalore' }],
  ['India scope with an unrecognized second country', j => { j.location.name = 'India or Germany' }],
  ['conflicting India and foreign scope', j => { j.location.name = 'Remote US and India' }],
  ['different employer', j => { j.company_name = 'Other Employer' }],
  ['different board', j => { j.absolute_url = j.absolute_url.replace('/affirm/', '/other/') }],
]) test('Affirm cannot claim zero India when a native record has ' + name, async () => {
  const payload = structuredClone(fixture.inventory); change(payload.jobs[0])
  await assert.rejects(run({ fetchJson: async () => payload }))
})

for (const [name, change] of [
  ['missing native total', p => { delete p.meta }],
  ['repeated native identity', p => { p.jobs[1] = structuredClone(p.jobs[0]) }],
]) test('Affirm rejects ' + name + ' rather than certify complete scope', async () => {
  const payload = structuredClone(fixture.inventory); change(payload)
  await assert.rejects(run({ fetchJson: async () => payload }))
})

test('affirm: current original-entity abort replay (legacy case 53)', async () => checkCurrentReplay('affirm', 'abort'))
