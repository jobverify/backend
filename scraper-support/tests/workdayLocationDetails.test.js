/**
 * @file Tests for Workday detail page location extraction and normalization utilities.
 * @module scraper/tests/workdayLocationDetails
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  extractWorkdayDetailLocations,
  normalizeStoredLocations,
} from '../myworkday/locationDetails.js'
import { formatStoredLocationLabel } from '../../src/utils/jobLocations.js'

// Verifies that multiple location elements are parsed successfully from a Workday page.
test('extractWorkdayDetailLocations reads all detail-page location entries', () => {
  const html = `
    <div data-automation-id="locations" class="css-k008qs">
      <dl>
        <dt class="css-y8qsrx">locations</dt>
        <dd class="css-129m7dg">Bangalore - Remote</dd>
        <dd class="css-129m7dg">Pune - Remote</dd>
        <dd class="css-129m7dg">Chennai - Office</dd>
      </dl>
    </div>
  `

  assert.deepEqual(extractWorkdayDetailLocations(html), [
    'Bangalore - Remote',
    'Pune - Remote',
    'Chennai - Office',
  ])
})

// Verifies that explicit locations are preferred over generic grouped location count labels.
test('normalizeStoredLocations prefers explicit entries over grouped count labels', () => {
  assert.deepEqual(
    normalizeStoredLocations({
      city: '3 Locations',
      location: '3 Locations',
      locations: ['Bangalore - Remote', 'Pune - Remote'],
    }),
    ['Bangalore - Remote', 'Pune - Remote'],
  )
})

test('formatStoredLocationLabel saves state and country in bracketed location labels', () => {
  assert.equal(
    formatStoredLocationLabel({ location: 'ALANGANALLUR, Tamil Nadu, India' }),
    'ALANGANALLUR [Tamil Nadu] [India]',
  )
})
