// Authored ordinary failure protocol; no native response or vacancy.
import assert from 'node:assert/strict'
import test from 'node:test'
import { run } from '../scraper/radspanwirelesssystems/script.js'

test('RADSPAN preserves the ordinary transport cause inside its existing diagnostic wrapper', async () => {
  const primary = Object.freeze(Error('Authored upstream diagnostic'))
  const descriptors = Object.getOwnPropertyDescriptors(primary), calls = []
  await assert.rejects(run({ fetchText: async url => { calls.push(url); throw primary } }), error => {
    assert.equal(error.constructor, Error)
    assert.notEqual(error, primary)
    assert.equal(error.message, 'RADSPAN Wireless Systems sentinel could not verify the verified no-surface condition at https://www.radspanwirelesssystems.com/: Authored upstream diagnostic')
    assert.deepEqual(calls, ['https://www.radspanwirelesssystems.com/'])
    assert.deepEqual(Object.getOwnPropertyDescriptors(primary), descriptors)
    assert.equal(error.cause, primary)
    return true
  })
})
