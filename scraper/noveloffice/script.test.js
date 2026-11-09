import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'
import { normalizeScrapedJob } from '../../scraper-support/utils/normalizeScrapedJob.js'
import { postScrapeInput } from '../../src/services/postScrapeClassification.js'

const HOMEPAGE_HTML = `
  <html>
    <head>
      <title>Managed Office Space in Bangalore | Novel Office</title>
    </head>
    <body>
      <a href="mailto:officeenquiry@noveloffice.in">officeenquiry@noveloffice.in</a>
      <p class="section-title">Want to join us?</p>
      <p>Explore our careers page and discover opportunities to grow with us.</p>
      <p>Think you're a fit? Apply now and show us what you've got.</p>
      <script>
        window.location.href = "https://noveloffice.in/careers?src=internal";
      </script>
    </body>
  </html>
`

const CAREERS_HTML = `
  <html>
    <head>
      <title>Home - Novel Careers</title>
      <meta name="description" content="Shape your future with Novel Office" />
    </head>
    <body>
      <div>
        <h2>Work with us.</h2>
        <p>Shape your future with Novel Office</p>
      </div>
      <h2>Current Openings &#8211; India Process</h2>
      <h3>Join our India team and make an impact.</h3>
      <h2>Current Openings &#8211; US Process</h2>
      <h3>Work with our international and expand your career horizons.</h3>
      <a href="mailto:careers@noveloffice.org">careers@noveloffice.org</a>
      <a href="/careers/apply-now/">Apply Now</a>
    </body>
  </html>
`

const APPLY_FORM_URL = 'https://noveloffice.in/careers/apply-now/'

const APPLY_HTML = `
  <html>
    <head>
      <title>Apply Now - Novel Careers</title>
      <link rel="canonical" href="${APPLY_FORM_URL}" />
    </head>
    <body>
      <h2>Job Application Form</h2>
      <p>Attach Resume</p>
      <a href="mailto:careers@noveloffice.org">careers@noveloffice.org</a>
      <p>
        <label for="job-name">Current Openings <em>*</em></label>
        <select
          name="job-name"
          id="job-name"
          class="wpcf7-form-control wpcf7-select wpcf7-validates-as-required"
          aria-required="true"
          aria-invalid="false"
        >
          <option value="">&#8212;Please choose an option&#8212;</option>
          <option value="Client Relationship Executive">Client Relationship Executive</option>
          <option value="Pre Sales Executive">Pre Sales Executive</option>
          <option value="Front Office Executive">Front Office Executive</option>
          <option value="Legal Associate">Legal Associate</option>
          <option value="Procurement Executive">Procurement Executive</option>
          <option value="Technician Maintenance">Technician Maintenance</option>
          <option value="Business Development Manager (US Process)">Business Development Manager (US Process)</option>
        </select>
        <span class="wpcf7-form-control-wrap" data-name="job-opening">
          <input
            class="wpcf7-form-control wpcf7-text wpcf7-validates-as-required jaf-visually-hidden"
            id="job-opening"
            name="job-opening"
            type="text"
            value=""
          />
        </span>
      </p>
    </body>
  </html>
`

const EXPECTED_TITLES = [
  'Client Relationship Executive',
  'Pre Sales Executive',
  'Front Office Executive',
  'Legal Associate',
  'Procurement Executive',
  'Technician Maintenance',
  'Business Development Manager (US Process)',
]

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Novel Office scraper module at ./script.js')
  }
}

test('Novel Office application options preserve missing source descriptions through classification input', async () => {
  const novelOffice = await loadModule()
  const jobs = await novelOffice.createNovelOfficeScraper().run({
    fetchText: async (url) => {
      if (url === novelOffice.HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === novelOffice.CAREERS_URL) return CAREERS_HTML
      assert.equal(url, novelOffice.APPLY_URL)
      return APPLY_HTML
    },
  })
  assert.ok(jobs.length > 0)
  for (const job of jobs) {
    assert.equal(job.jobDescription, null)
    assert.equal(job.preserveExistingSourceContent, true)
    assert.equal(job.publicExperienceChecked, true)
    const normalized = normalizeScrapedJob(job)
    assert.equal(normalized.sourceDescription, '')
    assert.equal(normalized.jobDescription, null)
    assert.equal(normalized.experienceRequired, null)
    const input = postScrapeInput(normalized)
    assert.equal(input.body, '')
    assert.equal(input.incomplete, true)
  }
})

test('Novel Office validates the verified homepage, careers shell, and first-party apply form surface', async () => {
  const novelOffice = await loadModule()

  assert.equal(novelOffice.SOURCE, 'noveloffice')
  assert.equal(novelOffice.COMPANY, 'Novel Office')
  assert.equal(novelOffice.HOMEPAGE_URL, 'https://noveloffice.in/')
  assert.equal(novelOffice.CAREERS_URL, 'https://noveloffice.in/careers/')
  assert.equal(novelOffice.APPLY_URL, APPLY_FORM_URL)
  assert.equal(novelOffice.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(novelOffice.hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.equal(novelOffice.hasOfficialApplyPageSignal(APPLY_HTML), true)
  assert.deepEqual(novelOffice.extractCurrentOpeningOptions(APPLY_HTML), EXPECTED_TITLES)
})

test('Novel Office extracts the verified public opening titles from the first-party apply form', async () => {
  const novelOffice = await loadModule()

  const jobs = novelOffice.extractPublicListings(APPLY_HTML)

  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      country: job.country,
      jobId: job.jobId,
      requisitionId: job.requisitionId,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
    })),
    [
      {
        title: 'Client Relationship Executive',
        location: 'India',
        country: 'India',
        jobId: 'noveloffice-client-relationship-executive',
        requisitionId: 'noveloffice-client-relationship-executive',
        sourceUrl: APPLY_FORM_URL,
        applyUrl: APPLY_FORM_URL,
      },
      {
        title: 'Pre Sales Executive',
        location: 'India',
        country: 'India',
        jobId: 'noveloffice-pre-sales-executive',
        requisitionId: 'noveloffice-pre-sales-executive',
        sourceUrl: APPLY_FORM_URL,
        applyUrl: APPLY_FORM_URL,
      },
      {
        title: 'Front Office Executive',
        location: 'India',
        country: 'India',
        jobId: 'noveloffice-front-office-executive',
        requisitionId: 'noveloffice-front-office-executive',
        sourceUrl: APPLY_FORM_URL,
        applyUrl: APPLY_FORM_URL,
      },
      {
        title: 'Legal Associate',
        location: 'India',
        country: 'India',
        jobId: 'noveloffice-legal-associate',
        requisitionId: 'noveloffice-legal-associate',
        sourceUrl: APPLY_FORM_URL,
        applyUrl: APPLY_FORM_URL,
      },
      {
        title: 'Procurement Executive',
        location: 'India',
        country: 'India',
        jobId: 'noveloffice-procurement-executive',
        requisitionId: 'noveloffice-procurement-executive',
        sourceUrl: APPLY_FORM_URL,
        applyUrl: APPLY_FORM_URL,
      },
      {
        title: 'Technician Maintenance',
        location: 'India',
        country: 'India',
        jobId: 'noveloffice-technician-maintenance',
        requisitionId: 'noveloffice-technician-maintenance',
        sourceUrl: APPLY_FORM_URL,
        applyUrl: APPLY_FORM_URL,
      },
      {
        title: 'Business Development Manager (US Process)',
        location: 'India',
        country: 'India',
        jobId: 'noveloffice-business-development-manager-us-process',
        requisitionId: 'noveloffice-business-development-manager-us-process',
        sourceUrl: APPLY_FORM_URL,
        applyUrl: APPLY_FORM_URL,
      },
    ],
  )
  assert.equal(jobs[0].company, 'Novel Office')
  assert.equal(jobs[0].jobDescription, null)
})

test('Novel Office run fetches the verified homepage, careers shell, and apply surface before returning jobs', async () => {
  const novelOffice = await loadModule()
  const requestedUrls = []

  const jobs = await novelOffice.createNovelOfficeScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === novelOffice.HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === novelOffice.CAREERS_URL) return CAREERS_HTML
      if (url === novelOffice.APPLY_URL) return APPLY_HTML

      throw new Error(`Unexpected fixture URL: ${url}`)
    },
    now: () => '2026-07-11T12:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    'https://noveloffice.in/',
    'https://noveloffice.in/careers/',
    APPLY_FORM_URL,
  ])
  assert.equal(jobs.length, EXPECTED_TITLES.length)
  assert.equal(jobs[0].source, 'noveloffice')
  assert.equal(jobs[0].companyCareerPage, APPLY_FORM_URL)
  assert.equal(jobs[0].companyDomain, 'noveloffice.in')
  assert.equal(jobs[0].scrapedAt, '2026-07-11T12:00:00.000Z')
})

test('Novel Office fails closed when the homepage, careers shell, or apply form contract changes materially', async () => {
  const novelOffice = await loadModule()

  await assert.rejects(
    novelOffice.createNovelOfficeScraper().run({
      fetchText: async (url) => {
        if (url === novelOffice.HOMEPAGE_URL) {
          return '<html><head><title>Unexpected</title></head><body></body></html>'
        }
        if (url === novelOffice.CAREERS_URL) return CAREERS_HTML
        return APPLY_HTML
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    novelOffice.createNovelOfficeScraper().run({
      fetchText: async (url) => {
        if (url === novelOffice.HOMEPAGE_URL) return HOMEPAGE_HTML
        if (url === novelOffice.CAREERS_URL) {
          return '<html><head><title>Home - Novel Careers</title></head><body><h2>Work with us.</h2></body></html>'
        }
        return APPLY_HTML
      },
    }),
    /verified careers shell/i,
  )

  await assert.rejects(
    novelOffice.createNovelOfficeScraper().run({
      fetchText: async (url) => {
        if (url === novelOffice.HOMEPAGE_URL) return HOMEPAGE_HTML
        if (url === novelOffice.CAREERS_URL) return CAREERS_HTML
        return '<html><head><title>Apply Now - Novel Careers</title></head><body><h2>Job Application Form</h2></body></html>'
      },
    }),
    /verified apply page/i,
  )
})

test('Novel Office is registered as a script provider and matches coverage without alias churn', async () => {
  await loadModule()

  const provider = getScraperCatalog().find((item) => item.source === 'noveloffice')

  assert.ok(provider, 'Expected Novel Office provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Novel Office')
  assert.equal(provider.companyCareerPage, APPLY_FORM_URL)
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-shell-plus-apply-form-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-careers-shell+first-party-apply-form-dropdown-openings',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'noveloffice.in')
  assert.match(provider.modulePath, /noveloffice[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Novel Office'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Novel Office,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Novel Office', 'noveloffice', 'Novel Office']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'noveloffice')
  assert.ok(scraper, 'Expected buildScrapers() to return the Novel Office scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'noveloffice')
  assert.equal(scraper.provider.companyCareerPage, APPLY_FORM_URL)
  assert.match(scraper.dryRunFile, /noveloffice[\\/]jobs\.json$/i)
})
