import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { nativePageContract } from './nativeContract.js'

const shell = JSON.parse(gunzipSync(readFileSync(new URL('./test-inputs/native-shell-20261031.json.gz', import.meta.url))))
const expected = { JobTitle: 'Sr. SDE (Dot Net)' }

test('current Byteridge native build retains the public application root, schema and employer binding', () => {
  const native = nativePageContract(shell.body, expected)
  assert.equal(native.posting.title, 'Sr. SDE (Dot Net)')
  assert.equal(native.posting.hiringOrganization.name, 'Byteridge Software Private Limited')
  assert.deepEqual(native.countries, ['India'])
})

for (const [label, change] of [
  ['duplicate client with an absolute URL alias', html => html.replace('<script src="/main.83be12cc773959e07faa.chunk.js">', '<script src="https://byteridge.turbohire.co/18.686c2629fe7c78598547.chunk.js">')],
  ['mixed reviewed builds', html => html.replace('runtime-main.9522a0a57370b3c3a0b4.js', 'runtime-main.b10416b6ebb29396fa10.js')],
  ['unreviewed main client', html => html.replace('main.83be12cc773959e07faa.chunk.js', 'main.unreviewed.chunk.js')],
  ['missing executable main client', html => html.replace('<script src="/main.83be12cc773959e07faa.chunk.js">', '<script type="application/json" src="/main.83be12cc773959e07faa.chunk.js">')],
  ['hidden public application root', html => html.replace('<div id="root">', '<div hidden id="root">')],
  ['other legal employer', html => html.replaceAll('Byteridge Software Private Limited', 'Another Employer')],
]) test('current Byteridge native build rejects ' + label, () => {
  const html = change(shell.body)
  assert.notEqual(html, shell.body)
  assert.throws(() => nativePageContract(html, expected))
})
