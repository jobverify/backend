import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BOARD_URL,
  CAREERS_URL,
  hasInactiveBoardSignal,
  run,
} from '../../scraper/brij/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const careersHtml = `
  <html><head><title>Brij Careers | Open Roles in NYC &amp; Remote</title></head>
  <body><h1>Brij Careers | Help us Build the Future of Product Experience</h1>
    <a href="https://brij.applytojob.com/apply/b5AFVvgAX7/Marketing-Director">
      <h4>Marketing Director</h4>
    </a>
    <a href="https://brij.applytojob.com/apply/mbHSToYOU2/Chief-Of-Staff">
      <h4>Chief Of Staff</h4>
    </a>
  </body></html>
`

const inactiveBoardHtml = `
  <html><head><title>JazzHR - Inactive Career Page</title></head>
  <body><h1>This account is no longer active.</h1>
    <a href="https://info.jazzhr.com/job-seekers.html">Learn more about JazzHR.</a>
  </body></html>
`

test('Brij recognizes the exact JazzHR inactive-board response', () => {
  assert.equal(hasInactiveBoardSignal(inactiveBoardHtml), true)
  assert.equal(hasInactiveBoardSignal('<title>Brij - Career Page</title>'), false)
})

test('Brij inactive account preserves previous jobs while current application links are unavailable', async () => {
  const requested = []
  const jobs = await run({
    fetchText: async (url) => {
      requested.push(url)
      if (url === CAREERS_URL) return careersHtml
      if (url === BOARD_URL) return inactiveBoardHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs)?.status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs)?.surface, BOARD_URL)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.deepEqual(requested, [CAREERS_URL, BOARD_URL])
})

test('Brij does not accept a generic error page as verified inactive state', async () => {
  await assert.rejects(
    run({
      fetchText: async (url) => url === CAREERS_URL
        ? careersHtml
        : '<title>Error</title><p>Account unavailable</p>',
    }),
    /ApplyToJob board no longer matches/i,
  )
})
