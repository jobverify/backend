import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = () => JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261024.json.gz', import.meta.url))))
const options = f => ({ fetchPage: async () => f.official, fetchJson: async url => url.includes('/careers/list') ? f.inventory : f.embed })
test('Aembit checks the current exact official BambooHR embed and both native empty responses', async () => {
  const jobs = await run(options(fixture()))
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 0)
})
for (const [name, change] of [
  ['missing employer binding', f => { f.official.html = '<h1>Aembit Careers</h1>' }],
  ['failed embed', f => { f.embed.success = false }],
  ['failed native listing envelope', f => { f.inventory.success = false }],
  ['native continuation with zero count', f => { f.inventory.hasMore = true }],
  ['contradictory native count', f => { f.inventory.meta.totalCount = 1 }],
  ['unknown positive contract', f => { f.inventory.meta.totalCount = 1; f.inventory.result = [{ id: 1 }] }],
]) test('Aembit leaves positive extraction pending and rejects ' + name, async () => {
  const f = fixture(); change(f)
  await assert.rejects(run(options(f)))
})

for (const wrapper of ['<div hidden>CONTENT</div>', '<div style="display:none">CONTENT</div>', '<textarea>CONTENT</textarea>', '<xmp>CONTENT</xmp>', '<object data="/existing.pdf" type="application/pdf">CONTENT</object>']) test('Aembit rejects inactive employer binding inside ' + wrapper.split('>')[0], async () => {
  const f = fixture()
  f.official.html = wrapper.replace('CONTENT', '<div id="BambooHR" data-domain="aembit.bamboohr.com"></div>')
  await assert.rejects(run(options(f)), /binding/i)
})

for (const phase of ['official', 'list']) test('Aembit stops after cancellation at the ' + phase + ' response boundary', async () => {
  const f = fixture(), controller = new AbortController()
  const reason = new Error('cancel Aembit after ' + phase)
  const calls = []
  await assert.rejects(run({ signal: controller.signal, fetchPage: async () => {
    if (phase === 'official') controller.abort(reason)
    return f.official
  }, fetchJson: async url => {
    calls.push(url)
    if (phase === 'list') controller.abort(reason)
    return url.includes('/careers/list') ? f.inventory : f.embed
  } }), error => error === reason)
  assert.equal(calls.length, phase === 'official' ? 0 : 1)
})
