import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { parsePage } from './native.js'

const fixture = JSON.parse(readFileSync(new URL('./test-data/2026-10-31-facet-packets.json', import.meta.url), 'utf8'))
const parsed = payload => parsePage(JSON.stringify(payload), 0)

test('Flywire reconciles captured pages when only equal-count facet option ordering changes', () => {
  const opening = parsed(fixture.opening), closing = parsed(fixture.closing)
  assert.equal(closing.total, 57)
  assert.equal(closing.jobPostings.length, 20)
  assert.deepEqual(closing.jobPostings, fixture.opening.jobPostings)
  assert.equal(closing.facets.length, fixture.opening.facets.length)
  assert.deepEqual(closing, opening)
})

test('Flywire facet reconciliation uses native identities for another valid presentation order', () => {
  const reordered = structuredClone(fixture.opening)
  reordered.facets.reverse()
  for (const facet of reordered.facets) facet.values.reverse()
  assert.deepEqual(parsed(reordered), parsed(fixture.opening))
})

test('Flywire preserves changed native facet counts and descriptors in the reconciled snapshot', () => {
  const changedCount = structuredClone(fixture.opening)
  changedCount.facets[0].values[0].count += 1
  assert.notDeepEqual(parsed(changedCount), parsed(fixture.opening))
  const changedDescriptor = structuredClone(fixture.opening)
  changedDescriptor.facets[0].values[0].descriptor = 'Changed native facet label'
  assert.notDeepEqual(parsed(changedDescriptor), parsed(fixture.opening))
})

test('Flywire refuses duplicated native facet group or value identities', () => {
  const duplicateGroup = structuredClone(fixture.opening)
  duplicateGroup.facets.push(structuredClone(duplicateGroup.facets[0]))
  assert.throws(() => parsed(duplicateGroup), /duplicate.*facet|facet.*identity/i)
  const duplicateValue = structuredClone(fixture.opening)
  duplicateValue.facets[0].values.push(structuredClone(duplicateValue.facets[0].values[0]))
  assert.throws(() => parsed(duplicateValue), /duplicate.*facet|facet.*identity/i)
})

test('Flywire does not canonicalize away actual listing record changes', () => {
  const changed = structuredClone(fixture.opening)
  changed.jobPostings[0].title = 'A different current role'
  assert.notDeepEqual(parsed(changed), parsed(fixture.opening))
})
