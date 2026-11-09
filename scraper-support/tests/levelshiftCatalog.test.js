import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import {
  CAREERS_PAGE_URL,
  HOMEPAGE_URL,
  LEGACY_HOMEPAGE_URL,
  INDIA_JOB_LISTING_URL,
  INDIA_LISTING_API_URL,
  INDIA_LISTING_PAGE_URL,
  REBRAND_TARGET_URL,
  createLevelshiftScraper,
  hasOfficialCareersSignal,
  hasOfficialHomepageSignal,
  hasVerifiedLegacyHomepageSignal,
  extractIndiaJobListingUrl,
  buildIndiaListingUrl,
} from '../../scraper/levelshift/script.js'

const legacyHomepageHtml = `
  <html>
    <head>
      <title>levelshift - PreludeSys</title>
    </head>
    <body>
      <p>PreludeSys is now LevelShift. You'll be redirected to our new home in 5 seconds.</p>
      <a href="https://levelshift.com/?utm_source=preludesys.com&utm_medium=referral&utm_campaign=splash">
        Click here
      </a>
      <a href="mailto:info@preludesys.com">info@preludesys.com</a>
    </body>
  </html>
`

const homepageHtml = `
  <html>
    <head>
      <title>AI Transformation Partner for Enterprises | LevelShift</title>
    </head>
    <body>
      <a href="/careers">Careers</a>
    </body>
  </html>
`

const careersHtml = `
  <html>
    <head>
      <title>Careers at LevelShift - Join Our Team</title>
    </head>
    <body>
      <h1>Careers</h1>
      <h2>Openings @ LevelShift</h2>
      <a href="/careers/current-us-job-openings">USA</a>
      <a href="/careers/current-job-openings">India</a>
    </body>
  </html>
`

const indiaOpeningsHtml = `
  <html>
    <head>
      <title>Current Job Openings - Careers at LevelShift</title>
    </head>
    <body>
      <h1>Current India Job Openings</h1>
      JavaScript is disabled. Please visit the careers portal directly.
      <a href="https://careersindia.levelshift.com/apply/job/listing?id=1782">careers portal directly</a>
    </body>
  </html>
`

const listingPayload = {
  status: 'success',
  jobs: {
    requirements: [
      {
        _id: 17821094,
        title: 'System Analyst-Dynamics CRM',
        created_at: '2026-03-26T09:47:22Z',
        needjson: {
          skills: [],
          profileactivetime: {
            display: '< 1 year',
          },
        },
        jobdetails: {
          location_arr: {
            value: ['Chennai, Tamil Nadu, India'],
          },
        },
        jdText: '<p>Role description</p>',
        jobURL: 'https://app.recruber.com/apply/job/detail?jid=17821094&sid=5c7d312c5e5efc0654130f23&src=jobpost&uid=100645&cpid=1782',
      },
    ],
    matchCount: 1,
    offset: 0,
  },
  jobdetailsjson: null,
}

test('Levelshift is registered as a verified first-party jobs scraper with the exact PreludeSys rebrand alias', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'levelshift')

  assert.ok(provider, 'Expected Levelshift provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'LevelShift')
  assert.equal(provider.companyCareerPage, INDIA_JOB_LISTING_URL)
  assert.equal(provider.atsPlatform, 'official-first-party-candidate-portal')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'homepage-plus-careers-page-plus-current-openings-page-plus-first-party-candidate-portal',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-careers-page+verified-current-openings-link+verified-first-party-jobs-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'levelshift.com')
  assert.equal(provider.verifiedOn, '2026-08-07')
  assert.match(provider.verifiedSurfaceSummary, /Verified on Friday, August 7, 2026/i)
  assert.match(provider.modulePath, /levelshift[\\/]script\.js$/i)
  assert.equal(companyAliases.PreludeSys, 'levelshift')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'LevelShift'), false)
})

test('Levelshift scraper verifies the PreludeSys rebrand handoff plus the live first-party homepage, careers page, and India listing API', async () => {
  assert.equal(LEGACY_HOMEPAGE_URL, 'https://preludesys.com/')
  assert.equal(HOMEPAGE_URL, 'https://levelshift.com/')
  assert.equal(CAREERS_PAGE_URL, 'https://levelshift.com/careers')
  assert.equal(INDIA_LISTING_PAGE_URL, 'https://levelshift.com/careers/current-job-openings')
  assert.equal(INDIA_JOB_LISTING_URL, 'https://careersindia.levelshift.com/apply/job/listing?id=1782')
  assert.equal(INDIA_LISTING_API_URL, 'https://careersindia.levelshift.com/public/listingdata')
  assert.equal(REBRAND_TARGET_URL, 'https://levelshift.com/?utm_source=preludesys.com&utm_medium=referral&utm_campaign=splash')
  assert.equal(hasVerifiedLegacyHomepageSignal(legacyHomepageHtml), true)
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
  assert.equal(extractIndiaJobListingUrl(indiaOpeningsHtml), INDIA_JOB_LISTING_URL)
  assert.equal(buildIndiaListingUrl({ offset: 0 }), `${INDIA_LISTING_API_URL}?accountid=1782&limit=50&offset=0`)

  const requestedTextUrls = []
  const requestedJsonUrls = []
  const scraper = createLevelshiftScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)

      if (url === LEGACY_HOMEPAGE_URL) return legacyHomepageHtml
      if (url === HOMEPAGE_URL) return homepageHtml
      if (url === CAREERS_PAGE_URL) return careersHtml
      if (url === INDIA_LISTING_PAGE_URL) return indiaOpeningsHtml

      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requestedJsonUrls.push({ url, options })

      if (url === buildIndiaListingUrl({ offset: 0 })) {
        assert.equal(options.method, 'POST')
        return listingPayload
      }

      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTextUrls, [
    LEGACY_HOMEPAGE_URL,
    HOMEPAGE_URL,
    CAREERS_PAGE_URL,
    INDIA_LISTING_PAGE_URL,
  ])
  assert.deepEqual(requestedJsonUrls.map((entry) => entry.url), [buildIndiaListingUrl({ offset: 0 })])
  assert.equal(jobs.length, 1)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      company: job.company,
      location: job.location,
      jobId: job.jobId,
      applyUrl: job.applyUrl,
      companyCareerPage: job.companyCareerPage,
    })),
    [
      {
        title: 'System Analyst-Dynamics CRM',
        company: 'LevelShift',
        location: 'Chennai, Tamil Nadu, India',
        jobId: '17821094',
        applyUrl: 'https://app.recruber.com/apply/job/detail?jid=17821094&sid=5c7d312c5e5efc0654130f23&src=jobpost&uid=100645&cpid=1782',
        companyCareerPage: INDIA_JOB_LISTING_URL,
      },
    ],
  )
})

test('Levelshift accepts the current direct PreludeSys handoff to the LevelShift homepage', () => {
  assert.equal(hasVerifiedLegacyHomepageSignal(homepageHtml), true)
})

test('Levelshift matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Levelshift,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Levelshift', 'levelshift', 'LevelShift']],
  )
})

test('Levelshift resolves the exact PreludeSys CSV lane through the verified rebrand alias', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'PreludeSys,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['PreludeSys', 'levelshift', 'LevelShift']],
  )
})

test('Levelshift is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'levelshift')

  assert.ok(scraper, 'Expected buildScrapers() to return the Levelshift scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'levelshift')
  assert.equal(scraper.provider.companyCareerPage, INDIA_JOB_LISTING_URL)
  assert.match(scraper.dryRunFile, /levelshift[\\/]jobs\.json$/i)
})
