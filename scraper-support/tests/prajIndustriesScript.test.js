import assert from 'node:assert/strict'
import test from 'node:test'

const officialCareersHtml = `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <title>Careers - Praj Industries</title>
    <link rel="canonical" href="https://www.praj.net/careers/" />
  </head>
  <body>
    <h2>Careers</h2>
    <p>In case of any assistance required from the Human Capital Team including queries on employment verification, kindly send an email on prajhumancapitalconnect@praj.net</p>
    <a href="https://praj.darwinbox.in/ms/candidate/careers">SEARCH FOR JOB</a>
    <h2>Life At Praj</h2>
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
    <noscript>Please enable Javascript!</noscript>
    <script type="module" src="/ms/dboxuilibrary/assets/dboxuilib_dist/www/build/db-components.esm.js"></script>
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" defer></script>
  </head>
  <body>
    <app-root ng-class="clearfix"></app-root>
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

const blockedListingApiHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Attention Required! | Cloudflare</title>
  </head>
  <body>
    <div id="cf-wrapper">
      <p>Sorry, you have been blocked</p>
      <p>Please enable cookies.</p>
      <p>Cloudflare Ray ID: 1234567890</p>
    </div>
  </body>
</html>
`

const loadPrajIndustriesModule = async () => {
  try {
    return await import('../../scraper/prajindustries/script.js')
  } catch {
    assert.fail('Expected Praj Industries scraper module at ../../scraper/prajindustries/script.js')
  }
}

test('Praj Industries scraper constants stay pinned to the verified first-party careers handoff and Darwinbox unavailable surfaces', async () => {
  const praj = await loadPrajIndustriesModule()

  assert.equal(praj.SOURCE, 'prajindustries')
  assert.equal(praj.COMPANY, 'Praj Industries')
  assert.equal(praj.OFFICIAL_BRAND_NAME, 'Praj Industries')
  assert.equal(praj.VERIFIED_ON, '2026-08-14')
  assert.equal(praj.OFFICIAL_CAREERS_URL, 'https://www.praj.net/careers/')
  assert.equal(praj.DARWINBOX_HANDOFF_URL, 'https://praj.darwinbox.in/ms/candidate/careers')
  assert.equal(praj.DARWINBOX_ORIGIN, 'https://praj.darwinbox.in')
  assert.equal(praj.DARWINBOX_COMPANY_ID, 'main')
  assert.equal(praj.DARWINBOX_JOBS_URL, 'https://praj.darwinbox.in/jobs')
  assert.equal(praj.DARWINBOX_CANDIDATE_CAREERS_URL, 'https://praj.darwinbox.in/ms/candidate/careers')
  assert.equal(praj.DARWINBOX_PUBLIC_HOME_URL, 'https://praj.darwinbox.in/ms/candidatev2/main/careers/home')
  assert.equal(praj.DARWINBOX_PUBLIC_ALL_JOBS_URL, 'https://praj.darwinbox.in/ms/candidatev2/main/careers/allJobs')
  assert.equal(praj.DARWINBOX_LISTING_API_URL, 'https://praj.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main')
  assert.deepEqual(praj.DARWINBOX_SHELL_ROUTE_URLS, [
    'https://praj.darwinbox.in/jobs',
    'https://praj.darwinbox.in/ms/candidate/careers',
    'https://praj.darwinbox.in/ms/candidatev2/main/careers/home',
    'https://praj.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  ])
  assert.equal(typeof praj.extractOfficialDarwinboxUrl, 'function')
  assert.equal(typeof praj.hasVerifiedCareersPageSignals, 'function')
  assert.equal(typeof praj.hasBlankDarwinboxShellSignal, 'function')
  assert.equal(typeof praj.hasBlockedDarwinboxListingApiSignal, 'function')
  assert.equal(typeof praj.hasUnexpectedPublicJobSurface, 'function')
  assert.equal(typeof praj.createPrajIndustriesScraper, 'function')

  assert.equal(
    praj.extractOfficialDarwinboxUrl(officialCareersHtml),
    'https://praj.darwinbox.in/ms/candidate/careers',
  )
  assert.equal(praj.hasVerifiedCareersPageSignals(officialCareersHtml), true)
  assert.equal(praj.hasVerifiedCareersPageSignals('<html><body>No trusted Praj careers content</body></html>'), false)
  assert.equal(praj.hasBlankDarwinboxShellSignal(darwinboxCandidateShellHtml), true)
  assert.equal(praj.hasBlankDarwinboxShellSignal(darwinboxCandidateV2ShellHtml), true)
  assert.equal(
    praj.hasBlockedDarwinboxListingApiSignal({ status: 403, body: blockedListingApiHtml }),
    true,
  )
  assert.equal(
    praj.hasUnexpectedPublicJobSurface({
      status: 200,
      html: '<html><body><h1>Open Jobs</h1><button>Search Jobs</button><a href="/apply">Apply</a></body></html>',
    }),
    true,
  )
})

test('Praj Industries returns no jobs while the verified careers handoff stays fixed and Darwinbox only exposes blank shells plus a blocked listing API', async () => {
  const praj = await loadPrajIndustriesModule()
  const requestedUrls = []
  const listingApiRequests = []

  const jobs = await praj.createPrajIndustriesScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === praj.OFFICIAL_CAREERS_URL) {
        return { status: 200, url, finalUrl: url, html: officialCareersHtml, errorKind: null }
      }

      if (url === praj.DARWINBOX_CANDIDATE_CAREERS_URL) {
        return { status: 200, url, finalUrl: url, html: darwinboxCandidateShellHtml, errorKind: null }
      }

      if (praj.DARWINBOX_SHELL_ROUTE_URLS.includes(url)) {
        return {
          status: 200,
          url,
          finalUrl: url === praj.DARWINBOX_JOBS_URL ? praj.DARWINBOX_PUBLIC_HOME_URL : url,
          html: darwinboxCandidateV2ShellHtml,
          errorKind: null,
        }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    probeListingApi: async (url) => {
      listingApiRequests.push(url)
      return { status: 403, body: blockedListingApiHtml }
    },
  })

  assert.deepEqual(requestedUrls, [
    praj.OFFICIAL_CAREERS_URL,
    ...praj.DARWINBOX_SHELL_ROUTE_URLS,
  ])
  assert.deepEqual(listingApiRequests, [praj.DARWINBOX_LISTING_API_URL])
  assert.deepEqual(jobs, [])
})

test('Praj Industries fails closed when the verified careers handoff drifts, Darwinbox jobs become public, or the listing API is no longer blocked', async () => {
  const praj = await loadPrajIndustriesModule()

  await assert.rejects(
    praj.createPrajIndustriesScraper().run({
      fetchPage: async (url) => {
        if (url === praj.OFFICIAL_CAREERS_URL) {
          return {
            status: 200,
            url,
            finalUrl: url,
            html: officialCareersHtml.replace(
              'https://praj.darwinbox.in/ms/candidate/careers',
              'https://example.com/jobs',
            ),
            errorKind: null,
          }
        }

        return { status: 200, url, finalUrl: url, html: darwinboxCandidateV2ShellHtml, errorKind: null }
      },
      probeListingApi: async () => ({ status: 403, body: blockedListingApiHtml }),
    }),
    /verified Darwinbox handoff/i,
  )

  await assert.rejects(
    praj.createPrajIndustriesScraper().run({
      fetchPage: async (url) => {
        if (url === praj.OFFICIAL_CAREERS_URL) {
          return { status: 200, url, finalUrl: url, html: officialCareersHtml, errorKind: null }
        }

        if (url === praj.DARWINBOX_PUBLIC_ALL_JOBS_URL) {
          return {
            status: 200,
            url,
            finalUrl: url,
            html: '<html><body><h1>Current Openings</h1><button>Search Jobs</button><a href="/apply">Apply</a></body></html>',
            errorKind: null,
          }
        }

        return { status: 200, url, finalUrl: url, html: darwinboxCandidateV2ShellHtml, errorKind: null }
      },
      probeListingApi: async () => ({ status: 403, body: blockedListingApiHtml }),
    }),
    /public Darwinbox jobs surface/i,
  )

  await assert.rejects(
    praj.createPrajIndustriesScraper().run({
      fetchPage: async (url) => {
        if (url === praj.OFFICIAL_CAREERS_URL) {
          return { status: 200, url, finalUrl: url, html: officialCareersHtml, errorKind: null }
        }

        if (url === praj.DARWINBOX_CANDIDATE_CAREERS_URL) {
          return { status: 200, url, finalUrl: url, html: darwinboxCandidateShellHtml, errorKind: null }
        }

        return { status: 200, url, finalUrl: url, html: darwinboxCandidateV2ShellHtml, errorKind: null }
      },
      probeListingApi: async () => ({
        status: 200,
        body: JSON.stringify({ data: [], job_counts: 0 }),
      }),
    }),
    /listing api no longer matches the verified blocked state/i,
  )
})
