import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const FIXED_SCRAPED_AT = '2026-07-10T00:00:00.000Z'
const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.resolve(currentDir, '../../scraper/greenkohub/fixtures')

const officialHomepageHtml = readFileSync(
  path.join(fixtureDir, 'official-homepage.html'),
  'utf8',
)

const listingPayload = JSON.parse(
  readFileSync(path.join(fixtureDir, 'alljobs-page-1.json'), 'utf8'),
)

const blockedDarwinboxShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <base href="/ms/candidatev2/">
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" defer></script>
    <script type="module" src="/ms/dboxuilibrary/assets/dboxuilib_dist/www/build/db-components.esm.js"></script>
  </head>
  <body>
    <app-root></app-root>
  </body>
</html>
`

const minimalDarwinboxShellHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Greenko Group</title>
  </head>
  <body>
    Greenko Group -
  </body>
</html>
`

const loadGreenkoHubModule = async () => {
  try {
    return await import('../../scraper/greenkohub/script.js')
  } catch {
    assert.fail('Expected Greenko Hub scraper module at ../../scraper/greenkohub/script.js')
  }
}

test('Greenko Hub official homepage fetch falls back to a scoped non-verifying HTTPS read only for the verified Greenko host certificate failure', async () => {
  const greenkoHub = await loadGreenkoHubModule()
  const fallbackCalls = []

  const html = await greenkoHub.fetchOfficialGreenkoText(
    greenkoHub.OFFICIAL_HOMEPAGE_URL,
    {
      headers: { Accept: 'text/html' },
      fetchTextWithRetryImpl: async () => {
        throw new Error('fetch failed: unable to verify the first certificate')
      },
      insecureHtmlFetch: async (url, options) => {
        fallbackCalls.push({ url, options })
        return officialHomepageHtml
      },
    },
  )

  assert.equal(html, officialHomepageHtml)
  assert.deepEqual(fallbackCalls, [{
    url: greenkoHub.OFFICIAL_HOMEPAGE_URL,
    options: {
      headers: { Accept: 'text/html' },
      timeoutMs: 15000,
    },
  }])

  await assert.rejects(
    greenkoHub.fetchOfficialGreenkoText('https://example.com/', {
      fetchTextWithRetryImpl: async () => {
        throw new Error('fetch failed: unable to verify the first certificate')
      },
      insecureHtmlFetch: async () => officialHomepageHtml,
    }),
    /unable to verify the first certificate/i,
  )
})

test('Greenko Hub scraper keeps the verified homepage to Darwinbox handoff explicit and fails closed on drift', async () => {
  const {
    COMPANY_NAME,
    DARWINBOX_COMPANY_ID,
    DARWINBOX_ORIGIN,
    OFFICIAL_HOMEPAGE_URL,
    PUBLIC_JOBS_URL,
    SOURCE,
    createGreenkoHubScraper,
    extractOfficialPublicJobsUrl,
    hasOfficialGreenkoHubHomepageSignals,
  } = await loadGreenkoHubModule()

  assert.equal(COMPANY_NAME, 'Greenko Hub')
  assert.equal(SOURCE, 'greenkohub')
  assert.equal(DARWINBOX_COMPANY_ID, 'main')
  assert.equal(DARWINBOX_ORIGIN, 'https://greenkogroup.darwinbox.in')
  assert.equal(OFFICIAL_HOMEPAGE_URL, 'https://www.greenkogroup.com/')
  assert.equal(
    PUBLIC_JOBS_URL,
    'https://greenkogroup.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(
    extractOfficialPublicJobsUrl(officialHomepageHtml),
    PUBLIC_JOBS_URL,
  )
  assert.equal(hasOfficialGreenkoHubHomepageSignals(officialHomepageHtml), true)
  assert.equal(
    hasOfficialGreenkoHubHomepageSignals(
      officialHomepageHtml.replace(
        'https://greenkogroup.darwinbox.in/ms/candidatev2/main/careers/allJobs',
        'https://example.com/jobs',
      ),
    ),
    false,
  )

  const scraper = createGreenkoHubScraper({
    now: () => FIXED_SCRAPED_AT,
  })

  await assert.rejects(
    scraper.run({
      fetchText: async () =>
        officialHomepageHtml.replace(
          'https://greenkogroup.darwinbox.in/ms/candidatev2/main/careers/allJobs',
          'https://example.com/jobs',
        ),
      fetchListingPage: async () => listingPayload,
    }),
    /verified official homepage no longer matches the verified public jobs surface/i,
  )
})

test('run maps verified Darwinbox listings into Jobverify jobs and keeps only India roles', async () => {
  const { createGreenkoHubScraper } = await loadGreenkoHubModule()
  const scraper = createGreenkoHubScraper({
    now: () => FIXED_SCRAPED_AT,
  })
  const requestedPages = []
  const requestedDetailIds = []

  const jobs = await scraper.run({
    fetchText: async () => officialHomepageHtml,
    fetchListingPage: async ({ page }) => {
      requestedPages.push(page)
      return listingPayload
    },
    // Explicit synthetic transport failure; no native upstream availability claim.
    fetchJobDetail: async ({ jobId }) => {
      requestedDetailIds.push(jobId)
      throw new Error('CONTROLLED missing-detail transport failure')
    },
  })

  assert.deepEqual(requestedPages, [1])
  assert.deepEqual(requestedDetailIds, ['a6a366a37046e4', 'a6a225d73da6e0'])
  assert.deepEqual(jobs, [
    {
      title: 'Officer',
      company: 'Greenko Hub',
      department: 'Greenko Security Services',
      location: 'Neemuch, Neemuch, Madhya Pradesh, India',
      city: 'Neemuch',
      jobId: 'a6a366a37046e4',
      requisitionId: null,
      sourceUrl: 'https://greenkogroup.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a366a37046e4',
      applyUrl: 'https://greenkogroup.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a366a37046e4',
      employmentType: 'Employee - Regular',
      experienceRequired: '17 - 20 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '20-Jun-2026',
      closingDate: null,
      jobDescription: null,
      sourceDetailComplete: false,
      sourceDetailFailureKind: 'upstream',
      sourceListingComplete: false,
      source: 'greenkohub',
      link: 'https://greenkogroup.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a366a37046e4',
      scrapedAt: FIXED_SCRAPED_AT,
    },
    {
      title: 'Associate',
      company: 'Greenko Hub',
      department: 'Contracts & Procurement',
      location: 'Admin Office - Hyderabad, Hyderabad, Telangana, India',
      city: 'Admin Office - Hyderabad',
      jobId: 'a6a225d73da6e0',
      requisitionId: null,
      sourceUrl: 'https://greenkogroup.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a225d73da6e0',
      applyUrl: 'https://greenkogroup.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a225d73da6e0',
      employmentType: 'Employee - Regular',
      experienceRequired: '2 - 4 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '05-Jun-2026',
      closingDate: null,
      jobDescription: '<p><br /></p>',
      sourceDetailComplete: false,
      sourceDetailFailureKind: 'upstream',
      sourceListingComplete: false,
      source: 'greenkohub',
      link: 'https://greenkogroup.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a225d73da6e0',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('Greenko Hub rejects listing HTTP403 without reading the Turnstile shell or inventing a current-openings job', async () => {
  const greenkoHub = await loadGreenkoHubModule()
  assert.equal(greenkoHub.hasBlockedDarwinboxShellSignal(blockedDarwinboxShellHtml), true)

  const requestedUrls = []
  const denial = Object.freeze(Object.assign(
    new Error(`HTTP 403 for ${greenkoHub.PUBLIC_JOBS_URL}`), { status: 403 },
  ))
  await assert.rejects(
    greenkoHub.createGreenkoHubScraper({ now: () => FIXED_SCRAPED_AT }).run({
      fetchText: async (url) => {
        requestedUrls.push(url)
        if (url === greenkoHub.OFFICIAL_HOMEPAGE_URL) return officialHomepageHtml
        if (url === greenkoHub.PUBLIC_JOBS_URL) return blockedDarwinboxShellHtml
        throw new Error(`Unexpected Greenko Hub URL: ${url}`)
      },
      fetchListingPage: async () => { throw denial },
    }),
    (error) => error.name === 'DarwinboxUpstreamUnavailableError' && error.cause === denial,
  )
  assert.deepEqual(requestedUrls, [greenkoHub.OFFICIAL_HOMEPAGE_URL])
})

test('Greenko Hub rejects listing HTTP403 without reading the minimal branded shell or inventing a current-openings job', async () => {
  const greenkoHub = await loadGreenkoHubModule()
  assert.equal(greenkoHub.hasMinimalDarwinboxShellSignal(minimalDarwinboxShellHtml), true)

  const requestedUrls = []
  const denial = Object.freeze(Object.assign(
    new Error(`HTTP 403 for ${greenkoHub.PUBLIC_JOBS_URL}`), { status: 403 },
  ))
  await assert.rejects(
    greenkoHub.createGreenkoHubScraper({ now: () => FIXED_SCRAPED_AT }).run({
      fetchText: async (url) => {
        requestedUrls.push(url)
        if (url === greenkoHub.OFFICIAL_HOMEPAGE_URL) return officialHomepageHtml
        if (url === greenkoHub.PUBLIC_JOBS_URL) return minimalDarwinboxShellHtml
        throw new Error(`Unexpected Greenko Hub URL: ${url}`)
      },
      fetchListingPage: async () => { throw denial },
    }),
    (error) => error.name === 'DarwinboxUpstreamUnavailableError' && error.cause === denial,
  )
  assert.deepEqual(requestedUrls, [greenkoHub.OFFICIAL_HOMEPAGE_URL])
})
