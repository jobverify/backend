import assert from 'node:assert/strict'
import test from 'node:test'
import {thirdWaveTransport} from '../../test/helpers/darwinboxThirdWaveFixture.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Ambulance Services | RED.Health Products - Quality Care</title>
  </head>
  <body>
    <h1>WE'RE BUILDING INDIA'S 911</h1>
    <p>CAN WE COUNT YOU IN?</p>
    <a href="https://redhealth.darwinbox.in/ms/candidatev2/main">Discover Roles</a>
    <h2>HIRING PROCESS</h2>
    <p>Profile Screening</p>
    <p>Panel Interviews</p>
    <p>Bar Raiser Round</p>
    <p>Offer Discussion</p>
  </body>
</html>
`

const darwinboxCandidateV2ShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title></title>
    <base href="/ms/candidatev2/">
    <script type="module" src="/ms/dboxuilibrary/assets/dboxuilib_dist/www/build/db-components.esm.js"></script>
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" defer></script>
  </head>
  <body>
    <app-root ng-class="clearfix"></app-root>
  </body>
</html>
`

const darwinboxCandidateShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title></title>
    <base href="/ms/candidate/">
    <script type="module" src="/ms/dboxuilibrary/assets/dboxuilib_dist/www/build/db-components.esm.js"></script>
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" defer></script>
  </head>
  <body>
    <app-root ng-class="clearfix"></app-root>
  </body>
</html>
`

const blockedListingApiHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Attention Required! | Cloudflare</title>
  </head>
  <body>
    <div id="cf-wrapper">
      <p>Sorry, you have been blocked</p>
      <p>You are unable to access darwinbox.in</p>
      <p>Please enable cookies.</p>
      <p>Cloudflare Ray ID: 1234567890</p>
    </div>
  </body>
</html>
`

const loadStanPlusModule = async () => {
  try {
    return await import('../../scraper/stanplus/script.js')
  } catch {
    assert.fail('Expected StanPlus scraper module at ../../scraper/stanplus/script.js')
  }
}

test('StanPlus scraper constants stay pinned to the verified RED.Health careers handoff and current Darwinbox shell surfaces', async () => {
  const stanPlus = await loadStanPlusModule()

  assert.equal(stanPlus.SOURCE, 'stanplus')
  assert.equal(stanPlus.COMPANY, 'StanPlus')
  assert.equal(stanPlus.COMPANY_DOMAIN, 'red.health')
  assert.equal(stanPlus.CAREERS_URL, 'https://www.red.health/career')
  assert.equal(stanPlus.OFFICIAL_CAREERS_HANDOFF_URL, 'https://redhealth.darwinbox.in/ms/candidatev2/main')
  assert.equal(stanPlus.VERIFIED_AT, '2026-08-05')
  assert.deepEqual(stanPlus.DARWINBOX_TIMEOUT_ROUTE_URLS, [
    'https://redhealth.darwinbox.in/jobs',
    'https://redhealth.darwinbox.in/ms/candidate/careers',
    'https://redhealth.darwinbox.in/ms/candidatev2/main/careers/home',
    'https://redhealth.darwinbox.in/ms/candidatev2/main/careers/allJobs',
    'https://redhealth.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
  ])
  assert.equal(stanPlus.DARWINBOX_LISTING_API_URL, 'https://redhealth.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main')
  assert.equal(stanPlus.hasOfficialCareersPageSignal(careersPageHtml), true)
  assert.equal(
    stanPlus.extractOfficialDarwinboxUrl(careersPageHtml),
    'https://redhealth.darwinbox.in/ms/candidatev2/main',
  )
  assert.equal(stanPlus.hasBlankDarwinboxShellSignal(darwinboxCandidateV2ShellHtml), true)
  assert.equal(stanPlus.hasBlankDarwinboxShellSignal(darwinboxCandidateShellHtml), true)
  assert.equal(
    stanPlus.hasBlockedDarwinboxListingApiSignal({ status: 403, html: blockedListingApiHtml }),
    true,
  )
  assert.equal(
    stanPlus.hasUnexpectedPublicJobSurface({
      status: 200,
      html: '<html><body><h1>Current Openings</h1><button>Search Jobs</button><a href="/apply">Apply</a></body></html>',
    }),
    true,
  )
})

test('StanPlus traverses the actual current public inventory while preserving native detail gaps', async () => {
  const stanPlus = await loadStanPlusModule()
  const http = thirdWaveTransport('stanplus')
  const jobs = await stanPlus.createStanPlusScraper().run(http)
  assert.equal(jobs.length, 20)
  assert.equal(jobs.filter(job => job.sourceDetailComplete).length, 18)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.ok(jobs.every(job => job.sourceListingComplete === false && job.lifecycleCleanupAllowed === false))
})

test('StanPlus fails closed when the careers handoff drifts or the declared public API is blocked', async () => {
  const stanPlus = await loadStanPlusModule()
  const drift = thirdWaveTransport('stanplus', row => {
    if (row.url === stanPlus.CAREERS_URL) row.body = row.body.replaceAll(stanPlus.OFFICIAL_CAREERS_HANDOFF_URL, 'https://example.com/jobs')
  })
  await assert.rejects(stanPlus.createStanPlusScraper().run(drift), /current active first-party native handoff missing/)
  const blocked = thirdWaveTransport('stanplus', row => {
    if (row.url.includes('/ms/candidateapi/job?page=')) row.status = 403
  })
  await assert.rejects(stanPlus.createStanPlusScraper().run(blocked), /native API HTTP status\/content type changed: job\?page=1/)
})
