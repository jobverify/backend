import { registerCurrentRecruitmentContract } from './helpers/currentRecruitmentContract.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const redirectedHomepagePage = {
  url: 'https://mahindralogistics.com/b2b-express/',
  html: `
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
          <h1>B2B Express That Delivers â€” Every Single Time</h1>
          <p>Mahindra Logistics serves customers across India.</p>
        </main>
      </body>
    </html>
  `,
}

const parentCareersPage = {
  url: 'https://mahindralogistics.com/work-with-us/',
  html: `
    <!doctype html>
    <html lang="en-US">
      <head>
        <title>Work With Us - Mahindra Logistics</title>
      </head>
      <body>
        <main>
          <h1>Work With Us: Igniting Mutual Success & Growth</h1>
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
  `,
}

const parentDarwinboxPage = {
  url: 'https://nectar.darwinbox.in/ms/candidatev2/main/careers/home',
  html: `
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
  `,
}

const parentDarwinboxJavascriptShellPage = {
  url: 'https://nectar.darwinbox.in/ms/candidate/careers',
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
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
  `,
}

const loadRivigoModule = async () => {
  try {
    return await import('../../scraper/rivigo/script.js')
  } catch {
    assert.fail('Expected Rivigo scraper module at ../../scraper/rivigo/script.js')
  }
}

test('Rivigo retains historical parent-handoff helpers while current extraction metadata remains unverified', async () => {
  const rivigo = await loadRivigoModule()

  assert.equal(rivigo.SOURCE, 'rivigo')
  assert.equal(rivigo.COMPANY, 'Rivigo')
  assert.equal(rivigo.HOMEPAGE_URL, 'https://mahindralogistics.com/b2b-express/')
  assert.equal(rivigo.REDIRECTED_HOMEPAGE_URL, 'https://mahindralogistics.com/b2b-express/')
  assert.equal(rivigo.CAREERS_URL, 'https://careers-rivigo.flexiele.com/')
  assert.equal(rivigo.PARENT_DARWINBOX_URL, 'https://nectar.darwinbox.in/ms/candidate/careers')
  assert.equal(
    rivigo.PARENT_DARWINBOX_HOME_URL,
    'https://nectar.darwinbox.in/ms/candidatev2/main/careers/home',
  )
  assert.equal(rivigo.VERIFIED_ON, null)
  assert.equal(rivigo.PROVIDER_METADATA.verifiedIndiaJobCount, null)
  assert.equal(rivigo.hasVerifiedRedirectedHomepageSignal(redirectedHomepagePage), true)
  assert.equal(rivigo.hasVerifiedParentCareersSignal(parentCareersPage), true)
  assert.equal(rivigo.hasVerifiedParentDarwinboxSignal(parentDarwinboxPage), true)
  assert.equal(rivigo.hasVerifiedParentDarwinboxSignal(parentDarwinboxJavascriptShellPage), true)
})





// Production extraction supersedes the former unconditional-empty contract.
registerCurrentRecruitmentContract('rivigo', 'rivigoScript.test.js')
