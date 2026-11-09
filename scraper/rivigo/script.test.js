import { registerCurrentRecruitmentContract } from '../../scraper-support/tests/helpers/currentRecruitmentContract.js'
import assert from 'node:assert/strict'
import test from 'node:test'
import { CAREERS_URL as HISTORICAL_CAREERS_URL } from './historicalBoundary20261103.js'

import {
  CAREERS_URL,
  HOMEPAGE_URL,
  PARENT_DARWINBOX_URL,
  REDIRECTED_HOMEPAGE_URL,
  createRivigoScraper,
  hasVerifiedParentCareersSignal,
  hasVerifiedParentDarwinboxJavascriptShellSignal,
  hasVerifiedParentDarwinboxSignal,
  hasVerifiedRedirectedHomepageSignal,
} from './script.js'

const redirectedHomepageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>B2B Express Services: Fastest Courier &amp; Parcel Deliveries</title>
  </head>
  <body>
    <header>
      <a href="https://mahindralogistics.com/work-with-us/">Work With Us</a>
    </header>
    <main>
      <h1>B2B Express That Delivers — Every Single Time</h1>
      <p>Mahindra Logistics serves customers across India.</p>
    </main>
  </body>
</html>
`

const parentCareersHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Work With Us - Mahindra Logistics</title>
  </head>
  <body>
    <main>
      <h1>Work With Us: Igniting Mutual Success &amp; Growth</h1>
      <p>
        Whether you are a seasoned professional or just starting your career, we have a diverse range of job
        opportunities available.
      </p>
      <a href="https://nectar.darwinbox.in/ms/candidate/careers" target="_blank" rel="noopener">
        Explore Opportunities
      </a>
    </main>
  </body>
</html>
`

const parentDarwinboxHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Mahindra Logistics and Subsidiaries</title>
  </head>
  <body>
    <main>
      <a href="https://nectar.darwinbox.in/ms/candidatev2/main/careers/allJobs">Open Jobs</a>
      <p>We Have 31 Open Jobs</p>
    </main>
  </body>
</html>
`

const parentDarwinboxJavascriptShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title></title>
    <base href="/ms/candidate/">
    <noscript>Please enable Javascript!</noscript>
    <script type="module" src="/ms/dboxuilibrary/assets/dboxuilib_dist/www/build/db-components.esm.js"></script>
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" defer></script>
  </head>
  <body>
    <app-root ng-class="clearfix"></app-root>
  </body>
</html>
`

test('Rivigo recognizes the verified Mahindra redirect and parent-company handoff surfaces', () => {
  assert.equal(
    hasVerifiedRedirectedHomepageSignal({
      url: REDIRECTED_HOMEPAGE_URL,
      html: redirectedHomepageHtml,
    }),
    true,
  )

  assert.equal(
    hasVerifiedParentCareersSignal({
      url: HISTORICAL_CAREERS_URL,
      html: parentCareersHtml,
    }),
    true,
  )

  assert.equal(
    hasVerifiedParentDarwinboxSignal({
      url: 'https://nectar.darwinbox.in/ms/candidatev2/main/careers/home',
      html: parentDarwinboxHtml,
    }),
    true,
  )

  assert.equal(
    hasVerifiedParentDarwinboxJavascriptShellSignal({
      url: PARENT_DARWINBOX_URL,
      html: parentDarwinboxJavascriptShellHtml,
    }),
    true,
  )

  assert.equal(
    hasVerifiedParentDarwinboxSignal({
      url: PARENT_DARWINBOX_URL,
      html: parentDarwinboxJavascriptShellHtml,
    }),
    true,
  )
})





// Production extraction supersedes the former unconditional-empty contract.
registerCurrentRecruitmentContract('rivigo', 'script.test.js')

test('a captured Mahindra parent-company redirect cannot relabel that inventory as Rivigo', async () => {
  await assert.rejects(createRivigoScraper().run({ fetchPage: async () => ({ status: 200,
    url: REDIRECTED_HOMEPAGE_URL, html: redirectedHomepageHtml }) }), error => {
    assert.equal(error.failureKind, 'coverage_gap')
    assert.equal(error.recruitmentObservations.nativeRecords, 0)
    assert.ok(error.recruitmentObservations.failures.some(row => /authority/.test(row.message)))
    return true
  })
})
