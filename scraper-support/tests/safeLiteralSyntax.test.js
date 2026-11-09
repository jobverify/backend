import assert from 'node:assert/strict'
import test from 'node:test'
import { parseJavaScriptLiteral } from '../utils/safeLiteral.js'

test('literal parser accepts only the two compiled boolean constants', () => {
  const parsed = parseJavaScriptLiteral('[{active:!0}, {active:!1}, {active:true}]')
  assert.deepEqual(parsed.map(record => record.active), [true, false, true])
  assert.equal(parseJavaScriptLiteral('!0'), true)
  assert.equal(parseJavaScriptLiteral('!1'), false)
})

test('compiled boolean support still rejects arbitrary unary expressions without executing them', () => {
  globalThis.__safeLiteralExecuted = false
  for (const value of ['!2', '!10', '!true', '!!0', '! 0', '!0 + 1', '!0()', '!0.toString()', '!(() => {globalThis.__safeLiteralExecuted = true})()']) {
    assert.throws(() => parseJavaScriptLiteral(value))
    assert.throws(() => parseJavaScriptLiteral('[{active:' + value + '}]'))
  }
  assert.equal(globalThis.__safeLiteralExecuted, false)
  delete globalThis.__safeLiteralExecuted
})
