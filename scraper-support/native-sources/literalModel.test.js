import test from 'node:test'
import assert from 'node:assert/strict'
import { readLiteralModel } from './literalModel.js'

test('ordinary JSON stays literal and quoted JSON never becomes another model', () => {
  const text = '{"description":"{\\"jobLocation\\":{\\"addressCountry\\":\\"IN\\"}}","real":false}'
  const result = readLiteralModel(text)
  assert.equal(typeof result.value.description, 'string')
  assert.equal(result.value.real, false)
  assert.equal(result.validJSON, true)
})
test('the narrow original-control profile keeps exact values and exposes invalid JSON syntax', () => {
  const text = '{"description":"first\nsecond\tline","country":"US"}'
  assert.throws(() => readLiteralModel(text), /control/)
  const result = readLiteralModel(text, { rawControls: true })
  assert.equal(result.value.description, 'first\nsecond\tline')
  assert.equal(result.value.country, 'US')
  assert.equal(result.rawControlCharacters.length, 2)
  assert.equal(result.validJSON, false)
})
test('decoded duplicate keys and non-data expressions stay rejected in both profiles', () => {
  for (const rawControls of [false, true]) {
    assert.throws(() => readLiteralModel('{"jobLocation":1,"job\\u004cocation":2}', { rawControls }), /Duplicate decoded key/)
    for (const input of ['{"value":someFunction()}', '{"value":undefined}', '{"value":NaN}', '{"value":1,}', '[1,]']) {
      assert.throws(() => readLiteralModel(input, { rawControls }))
    }
  }
})
test('prototype-shaped native keys remain data and cannot change object prototypes', () => {
  const result = readLiteralModel('{"__proto__":{"polluted":true},"constructor":"raw"}')
  assert.equal(Object.getPrototypeOf(result.value), null)
  assert.equal(result.value.__proto__.polluted, true)
  assert.equal({}.polluted, undefined)
})
