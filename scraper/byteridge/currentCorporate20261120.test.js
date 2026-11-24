import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { corporateContract, FRAME_URL } from './nativeContract.js'

const [packet] = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-corporate-20261120.json.gz', import.meta.url))))

test('Byteridge current WordPress and Elementor revisions retain the official native delegation', () => {
  const contract = corporateContract(packet.body)
  assert.deepEqual(contract.frames, [FRAME_URL])
  assert.deepEqual(contract.reasons, ['unreviewed-corporate-inline-client'])
})

test('Byteridge current corporate stylesheet review rejects unknown and hidden delegation', () => {
  assert.throws(() => corporateContract(packet.body.replace('</head>', '<style>#dynamic-iframe{display:none}</style></head>')), /unreviewed corporate stylesheet/)
  assert.throws(() => corporateContract(packet.body.replace('<iframe id="dynamic-iframe"', '<iframe hidden id="dynamic-iframe"')), /missing visible/)
  assert.throws(() => corporateContract(packet.body.replace('custom-frontend.min.css?ver=1795173305', 'custom-frontend.min.css?ver=9999999999')), /unreviewed corporate stylesheet/)
})

