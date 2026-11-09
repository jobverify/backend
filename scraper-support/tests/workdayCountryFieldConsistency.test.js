import assert from 'node:assert/strict'
import test from 'node:test'
import { hasRecognizedWorkdayCountry, explicitWorkdayCountryScope } from '../myworkday/countryInventoryProof.js'

const india = 'c4f78be1a8f14da0ab49ce1162348a5e'

test('an India country ID or explicit ID code cannot override a conflicting native country label', () => {
  for (const country of [
    { id: india, descriptor: 'United States of America' },
    { id: india.toUpperCase(), descriptor: 'Singapore', alpha2Code: 'SG' },
    { id: 'US', descriptor: 'India' },
    { id: 'IN', descriptor: 'United States', alpha2Code: 'US' },
    { id: india, descriptor: 'India', alpha2Code: 'GB' },
  ]) assert.equal(hasRecognizedWorkdayCountry(country), false)
})

test('consistent native labels retain country proof without inferring a country from an unknown UUID', () => {
  for (const country of ['India', { id: india, descriptor: 'India' }, { id: india, descriptor: 'IN', alpha2Code: 'IN' },
    { id: 'unknown-native-uuid', descriptor: 'United States of America', alpha2Code: 'US' },
    { descriptor: 'United Kingdom', alpha2Code: 'UK' }]) assert.equal(hasRecognizedWorkdayCountry(country), true)
  assert.equal(hasRecognizedWorkdayCountry({ id: 'unknown-native-uuid' }), false)
  assert.equal(hasRecognizedWorkdayCountry({ id: india }), false)
})

test('explicit country names retain their scope with a separated Remote suffix', () => {
  for (const [label, expected] of [
    ['Spain - Remote', 'foreign'], ['Italy - Remote', 'foreign'],
    ['United States - Remote', 'foreign'], ['India - Remote', 'india'],
    ['Spain – Remote', 'foreign'], ['Italy Remote', 'foreign'],
    ['US - California - Remote', 'foreign'], ['US - Massachusetts - Remote', 'foreign'],
    ['IN - Bengaluru', 'india'], ['US - Bengaluru, India', null],
    ['Campus 42 - Remote', null], ['Global - Remote', null],
    ['Italy / India - Remote', null], ['Italy and India - Remote', null],
    ['Spain - Remote - India', null],
  ]) assert.equal(explicitWorkdayCountryScope(label), expected, label)
})

test('native short and formal region names retain their explicit ISO country identity', () => {
  for (const [descriptor, alpha2Code] of [['Hong Kong', 'HK'], ['Macao', 'MO'], ['Russian Federation', 'RU']]) {
    assert.equal(hasRecognizedWorkdayCountry({ descriptor, alpha2Code }), true, descriptor)
    assert.equal(hasRecognizedWorkdayCountry({ descriptor, alpha2Code: 'IN' }), false, descriptor + ' must not override India')
    assert.equal(hasRecognizedWorkdayCountry({ descriptor, alpha2Code, id: india }), false, descriptor + ' must not override the native India ID')
  }
})

test('an ambiguous Indian state suffix cannot establish a foreign country', () => {
  for (const label of ['Powai, Mumbai, MH', 'Chennai, TN', 'Panaji, GA', 'Shillong, ML', 'Aizawl, MZ', 'Gangtok, SK']) {
    assert.equal(explicitWorkdayCountryScope(label), null, label)
  }
  assert.equal(explicitWorkdayCountryScope('Bengaluru, US'), 'foreign')
  assert.equal(explicitWorkdayCountryScope('Mumbai, India'), 'india')
  assert.equal(explicitWorkdayCountryScope('MH - Majuro'), 'foreign')
})

test('US state suffixes cannot supply a country identity, including Indiana IN', () => {
  for (const label of ['Lafayette, IN', 'San Francisco, CA', 'Boston, MA', 'Portland, ME', 'Baltimore, MD']) {
    assert.equal(explicitWorkdayCountryScope(label), null, label)
  }
  assert.equal(explicitWorkdayCountryScope('IN - Bengaluru'), 'india')
  assert.equal(explicitWorkdayCountryScope('Bengaluru, IND'), 'india')
})
