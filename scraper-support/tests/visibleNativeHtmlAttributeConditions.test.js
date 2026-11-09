import assert from 'node:assert/strict'
import test from 'node:test'
import { readVisibleNativeDocument } from '../utils/visibleNativeHtml.js'

const targetVisible = (selector, attributes = '') => readVisibleNativeDocument(
  `<style>${selector}{display:none}</style><div id="target" ${attributes}>Native roles</div>`,
  { strict: true },
).nodes(node => node.attrs.id === 'target').length === 1

test('a conditional hiding rule cannot hide an element missing its required top-level attribute', () => {
  assert.equal(targetVisible('[data-et-multi-view-load-tablet-hidden=true]:not(.et_multi_view_swapped)'), true)
  assert.equal(targetVisible('[data-hidden]:hover'), true)
  assert.equal(targetVisible('[data-hidden="yes"]:not(.shown)', 'data-hidden="no"'), true)
})

test('a conditional hiding rule remains conservative when its required top-level attribute matches', () => {
  assert.equal(targetVisible('[data-hidden]:hover', 'data-hidden'), false)
  assert.equal(targetVisible('[data-hidden="yes"]:not(.shown)', 'data-hidden="yes"'), false)
})

test('attributes nested inside an unresolved pseudo-class cannot prove its hiding rule absent', () => {
  assert.equal(targetVisible(':not([data-shown])'), false)
  assert.equal(targetVisible('.role:not([data-shown])', 'class="role"'), false)
  assert.equal(targetVisible('[data-hidden]:not([data-shown])', 'data-hidden'), false)
})
