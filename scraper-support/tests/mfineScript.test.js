import assert from 'node:assert/strict'
import test from 'node:test'

import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const CONTACT_PAGE_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Contact Us - mfine</title>
  </head>
  <body>
    <main>
      <h2>Careers at mfine</h2>
      <p>
        If you're looking for a career with mfine, or if you're a doctor looking to partner with
        mfine, please get in touch with us
        <a href="https://www.mfine.co/join-us/" target="_blank" rel="noopener noreferrer">here</a>.
      </p>
      <p>Email us at <a href="mailto:support@mfine.co">support@mfine.co</a></p>
    </main>
  </body>
</html>
`

const CURRENT_CONTACT_PAGE_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Contact Us &#8211; mfine</title>
  </head>
  <body>
    <main>
      <h1>Contact Us</h1>
      <p>We are here to help. Let us know your concern, and we will get in touch with you.</p>
      <p>Contact us. <a href="mailto:support@mfine.co">support@mfine.co</a></p>
      <p>MFine, 1245, 22nd Main Road, 13th Cross, Vanganahalli, 1st Sector, HSR Layout, Bangalore - 560102</p>
      <p>Consult a doctor online with mfine</p>
      <p>Careers at mfine</p>
    </main>
  </body>
</html>
`

const BLANK_DARWINBOX_SHELL_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title></title>
    <meta property="og:title" content=" " />
    <meta property="twitter:title" content=" " />
    <meta property="og:image" content="" />
    <meta property="twitter:image" content="" />
    <meta property="og:image:alt" content="" />
  </head>
  <body>
     -
  </body>
</html>
`

const HANDOFF_DARWINBOX_SHELL_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <base href="/ms/candidate/" />
    <title>mfine Careers</title>
    <script src="https://mfine.darwinbox.in/candidateweb/assets/bot.js"></script>
  </head>
  <body>
    <noscript>Please enable Javascript!</noscript>
  </body>
</html>
`

const ACTIVE_DARWINBOX_SHELL_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <base href="/ms/candidatev2/" />
    <title>mfine Careers</title>
    <script src="https://mfine.darwinbox.in/candidateweb/assets/bot.js"></script>
    <script>window.pendo = { initialize() {} }</script>
  </head>
  <body>
    <app-root></app-root>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>mfine careers</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="https://mfine.darwinbox.in/ms/candidatev2/main/careers/jobDetails/mfine-001">Apply now</a>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/mfine/script.js')
  } catch {
    assert.fail('Expected Mfine scraper module at ../../scraper/mfine/script.js')
  }
}

test('Mfine sentinel constants stay pinned to the verified contact-page handoff and broken Darwinbox tenant state from Thursday, July 16, 2026', async () => {
  const mfine = await loadModule()

  assert.equal(mfine.SOURCE, 'mfine')
  assert.equal(mfine.COMPANY, 'Mfine')
  assert.equal(mfine.OFFICIAL_BRAND_NAME, 'mfine')
  assert.equal(mfine.VERIFIED_ON, '2026-07-16')
  assert.equal(mfine.HOMEPAGE_URL, 'https://www.mfine.co/')
  assert.equal(mfine.CONTACT_PAGE_URL, 'https://www.mfine.co/contact-us/')
  assert.equal(mfine.OFFICIAL_CAREERS_HANDOFF_URL, 'https://www.mfine.co/join-us/')
  assert.equal(mfine.DARWINBOX_CAREERS_URL, 'https://mfine.darwinbox.in/ms/candidate/careers')
  assert.deepEqual(mfine.DARWINBOX_SHELL_ROUTE_URLS, [
    'https://mfine.darwinbox.in/ms/candidatev2/main/careers/home',
    'https://mfine.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  ])
  assert.equal(
    mfine.DARWINBOX_LISTING_API_URL,
    'https://mfine.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
  )
  assert.match(mfine.VERIFIED_SURFACE_SUMMARY, /error while getting tenant info/i)
  assert.match(mfine.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)

  assert.equal(
    mfine.extractOfficialCareersHandoffUrl(CONTACT_PAGE_HTML),
    mfine.OFFICIAL_CAREERS_HANDOFF_URL,
  )
  assert.equal(mfine.hasOfficialMfineCareersSignal(CONTACT_PAGE_HTML), true)
  assert.equal(mfine.extractOfficialCareersHandoffUrl(CURRENT_CONTACT_PAGE_HTML), null)
  assert.equal(mfine.hasOfficialMfineContactSignal(CURRENT_CONTACT_PAGE_HTML), true)
  assert.equal(mfine.hasOfficialMfineCareersSignal('<html><body>unexpected</body></html>'), false)
  assert.equal(mfine.hasBlankDarwinboxShellSignal(BLANK_DARWINBOX_SHELL_HTML), true)
  assert.equal(mfine.hasBlankDarwinboxShellSignal(HANDOFF_DARWINBOX_SHELL_HTML), true)
  assert.equal(mfine.hasBlankDarwinboxShellSignal(ACTIVE_DARWINBOX_SHELL_HTML), true)
  assert.equal(mfine.hasBlankDarwinboxShellSignal(PUBLIC_JOBS_HTML), false)
  assert.equal(
    mfine.hasDarwinboxTenantInfoError({
      status: 500,
      body: '{"status":"error","data":{"message":"Internal Server Error - Error while getting tenant info"}}',
    }),
    true,
  )
})

test('Mfine preserves saved jobs when its listing API reports a tenant outage', async () => {
  const mfine = await loadModule()
  const requestedPages = []
  const requestedApis = []

  const jobs = await mfine.createMfineScraper({
    now: () => '2026-09-14T00:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === mfine.CONTACT_PAGE_URL) {
        return { status: 200, url, html: CONTACT_PAGE_HTML }
      }

      if (url === mfine.OFFICIAL_CAREERS_HANDOFF_URL) {
        return {
          status: 200,
          url: mfine.DARWINBOX_CAREERS_URL,
          html: HANDOFF_DARWINBOX_SHELL_HTML,
        }
      }

      if (mfine.DARWINBOX_SHELL_ROUTE_URLS.includes(url)) {
        return { status: 200, url, html: ACTIVE_DARWINBOX_SHELL_HTML }
      }

      throw new Error(`Unexpected Mfine URL: ${url}`)
    },
    probeListingApi: async (url) => {
      requestedApis.push(url)
      return {
        status: 500,
        body: '{"status":"error","data":{"message":"Internal Server Error - Error while getting tenant info"}}',
      }
    },
  })
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs)?.status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs)?.surface, mfine.DARWINBOX_LISTING_API_URL)

  assert.deepEqual(requestedPages, [
    mfine.CONTACT_PAGE_URL,
    mfine.OFFICIAL_CAREERS_HANDOFF_URL,
    ...mfine.DARWINBOX_SHELL_ROUTE_URLS,
  ])
  assert.deepEqual(requestedApis, [mfine.DARWINBOX_LISTING_API_URL])
})

test('Mfine preserves saved jobs when the current contact page omits the direct careers handoff', async () => {
  const mfine = await loadModule()
  const requestedPages = []

  const jobs = await mfine.createMfineScraper({
    now: () => '2026-09-14T00:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === mfine.CONTACT_PAGE_URL) {
        return { status: 200, url, html: CURRENT_CONTACT_PAGE_HTML }
      }

      if (url === mfine.OFFICIAL_CAREERS_HANDOFF_URL) {
        return {
          status: 200,
          url: mfine.DARWINBOX_CAREERS_URL,
          html: HANDOFF_DARWINBOX_SHELL_HTML,
        }
      }

      if (mfine.DARWINBOX_SHELL_ROUTE_URLS.includes(url)) {
        return { status: 200, url, html: ACTIVE_DARWINBOX_SHELL_HTML }
      }

      throw new Error(`Unexpected Mfine URL: ${url}`)
    },
    probeListingApi: async () => ({
      status: 500,
      body: '{"status":"error","data":{"message":"Internal Server Error - Error while getting tenant info"}}',
    }),
  })

  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs)?.status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs)?.surface, mfine.DARWINBOX_LISTING_API_URL)
  assert.deepEqual(requestedPages, [
    mfine.CONTACT_PAGE_URL,
    mfine.OFFICIAL_CAREERS_HANDOFF_URL,
    ...mfine.DARWINBOX_SHELL_ROUTE_URLS,
  ])
})

test('Mfine sentinel fails closed when the contact page, handoff target, shell routes, or listing API drift materially', async () => {
  const mfine = await loadModule()

  await assert.rejects(
    mfine.createMfineScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: '<html><body>No careers handoff here</body></html>',
      }),
      probeListingApi: async () => ({
        status: 500,
        body: '{"status":"error","data":{"message":"Internal Server Error - Error while getting tenant info"}}',
      }),
    }),
    /verified mfine contact page/i,
  )

  await assert.rejects(
    mfine.createMfineScraper().run({
      fetchPage: async (url) => {
        if (url === mfine.CONTACT_PAGE_URL) {
          return { status: 200, url, html: CONTACT_PAGE_HTML }
        }

        return {
          status: 200,
          url: 'https://example.com/jobs',
          html: HANDOFF_DARWINBOX_SHELL_HTML,
        }
      },
      probeListingApi: async () => ({
        status: 500,
        body: '{"status":"error","data":{"message":"Internal Server Error - Error while getting tenant info"}}',
      }),
    }),
    /darwinbox handoff/i,
  )

  await assert.rejects(
    mfine.createMfineScraper().run({
      fetchPage: async (url) => {
        if (url === mfine.CONTACT_PAGE_URL) {
          return { status: 200, url, html: CONTACT_PAGE_HTML }
        }

        if (url === mfine.OFFICIAL_CAREERS_HANDOFF_URL) {
          return {
            status: 200,
            url: mfine.DARWINBOX_CAREERS_URL,
            html: HANDOFF_DARWINBOX_SHELL_HTML,
          }
        }

        return { status: 200, url, html: PUBLIC_JOBS_HTML }
      },
      probeListingApi: async () => ({
        status: 500,
        body: '{"status":"error","data":{"message":"Internal Server Error - Error while getting tenant info"}}',
      }),
    }),
    /darwinbox shell route/i,
  )

  await assert.rejects(
    mfine.createMfineScraper().run({
      fetchPage: async (url) => {
        if (url === mfine.CONTACT_PAGE_URL) {
          return { status: 200, url, html: CONTACT_PAGE_HTML }
        }

        if (url === mfine.OFFICIAL_CAREERS_HANDOFF_URL) {
          return {
            status: 200,
            url: mfine.DARWINBOX_CAREERS_URL,
            html: HANDOFF_DARWINBOX_SHELL_HTML,
          }
        }

        return { status: 200, url, html: ACTIVE_DARWINBOX_SHELL_HTML }
      },
      probeListingApi: async () => ({
        status: 200,
        body: '{"data":[]}',
      }),
    }),
    /listing api/i,
  )
})
