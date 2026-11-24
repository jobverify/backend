import test from 'node:test'
import assert from 'node:assert/strict'
import {nativeCountryName,writtenPlaceCountries} from './currentFacts20261120.js'

test('Actual UK constituent Northern Ireland resolves as United Kingdom',()=>{
 assert.equal(nativeCountryName('Northern Ireland'),'United Kingdom')
 assert.deepEqual(writtenPlaceCountries('Belfast, Northern Ireland'),['United Kingdom'])
})
test('The country Ireland retains its separate native meaning',()=>{
 assert.equal(nativeCountryName('Ireland'),'Ireland')
 assert.deepEqual(writtenPlaceCountries('Dublin, Ireland'),['Ireland'])
})
