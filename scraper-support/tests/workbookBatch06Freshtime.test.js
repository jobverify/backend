import { registerCurrentRecruitmentContract } from './helpers/currentRecruitmentContract.js'
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  COMPANY,
  VERIFIED_ON,
  assertNoPublicJobsSurface,
  assertVerifiedOfficialPublicSurface,
  createFreshtimeScraper,
} from '../../scraper/freshtime/script.js'

const VERIFIED_SURFACE_HTML = `
  <html>
    <head><title>Freshtime - Greencore</title></head>
    <body>
      <h1>Freshtime</h1>
      <p>The acquisition of Freshtime broadened Greencore's product proposition.</p>
      <p>Freshtime is a well-established supplier of meal salads, chilled snacking and prepared produce in the UK.</p>
      <p>The business operates from a single facility in Boston, Lincolnshire.</p>
    </body>
  </html>
`

const VERIFIED_NOT_FOUND_HTML = `
  <html>
    <head><title>Page not found - Greencore</title></head>
    <body>
      <h1>Page not found</h1>
      <p>Greencore</p>
      <a href="https://www.greencore.com/careers/">Careers</a>
      <a href="https://www.greencore.com/careers/work-with-greencore/">Work With Greencore</a>
    </body>
  </html>
`

test('Freshtime retains historical information-surface helpers without certifying current inventory', () => {
  assert.equal(COMPANY, 'Freshtime')
  assert.equal(VERIFIED_ON, null)
  assert.match(CAREERS_URL, /greencore\.com\/.*freshtime/i)
  assert.doesNotThrow(() => assertVerifiedOfficialPublicSurface(VERIFIED_SURFACE_HTML))
  assert.doesNotThrow(() => assertVerifiedOfficialPublicSurface(VERIFIED_NOT_FOUND_HTML))
  assert.doesNotThrow(() => assertNoPublicJobsSurface(VERIFIED_SURFACE_HTML))
  assert.doesNotThrow(() => assertNoPublicJobsSurface(VERIFIED_NOT_FOUND_HTML))

})

test('Freshtime rejects official-surface drift and public jobs emergence', () => {
  assert.throws(
    () => assertVerifiedOfficialPublicSurface(VERIFIED_SURFACE_HTML.replace('meal salads', 'fresh meals')),
    /verified official public surface changed/i,
  )

  assert.throws(
    () => assertNoPublicJobsSurface(`${VERIFIED_SURFACE_HTML}<a href="https://jobs.lever.co/freshtime">Jobs</a>`),
    /public jobs surface/i,
  )

  assert.throws(
    () => assertNoPublicJobsSurface(`${VERIFIED_SURFACE_HTML}<script type="application/ld+json">{"@type":"JobPosting"}</script>`),
    /JobPosting/i,
  )
})

// Production extraction supersedes the former unconditional-empty contract.
registerCurrentRecruitmentContract('freshtime', 'workbookBatch06Freshtime.test.js')

test('Freshtime retains a captured 404 as an explicit current coverage failure', async () => {
  await assert.rejects(createFreshtimeScraper().run({ fetchPage: async url => ({ status: 404, url, html: VERIFIED_NOT_FOUND_HTML }) }), error => {
    assert.equal(error.failureKind, 'coverage_gap')
    assert.ok(error.recruitmentObservations.receipts.every(row => row.status === 404))
    assert.equal(error.recruitmentObservations.sourceScopeComplete, false)
    return true
  })
})
