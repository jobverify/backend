import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/eidikosystemsintegrators/script.js')

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Eidiko Systems Integrators</title>
  </head>
  <body>
    <h2>Current Openings in Eidiko</h2>
    <div class="elementor-posts-container elementor-posts elementor-posts--skin-cards elementor-grid">
      <article class="elementor-post elementor-grid-item post-1867 awsm_job_openings type-awsm_job_openings status-publish hentry">
        <div class="elementor-post__card">
          <div class="elementor-post__text">
            <h3 class="elementor-post__title">
              <a href="https://eidiko.com/job/technical-delivery-leads/">Technical Delivery Leads, Charlotte,NC</a>
            </h3>
            <div class="elementor-post__excerpt">
              <p>Technical Delivery Leads, Charlotte, NC: Closely working with IT project managers for multiple IT projects.</p>
            </div>
          </div>
        </div>
      </article>
      <article class="elementor-post elementor-grid-item post-548 awsm_job_openings type-awsm_job_openings status-publish hentry">
        <div class="elementor-post__card">
          <div class="elementor-post__text">
            <h3 class="elementor-post__title">
              <a href="https://eidiko.com/job/another-as-400-i-series-developer/">Another AS 400 / i Series Developer</a>
            </h3>
            <div class="elementor-post__excerpt">
              <p>Experience: 5 - 12 yrs. Work Location: Bangalore</p>
            </div>
          </div>
        </div>
      </article>
      <article class="elementor-post elementor-grid-item post-530 awsm_job_openings type-awsm_job_openings status-publish hentry">
        <div class="elementor-post__card">
          <div class="elementor-post__text">
            <h3 class="elementor-post__title">
              <a href="https://eidiko.com/job/as-400-i-series-developer/">AS 400 / i Series Developer</a>
            </h3>
            <div class="elementor-post__excerpt">
              <p>Experience: 2 - 4 yrs Work Location: Hyderabad</p>
            </div>
          </div>
        </div>
      </article>
    </div>
  </body>
</html>
`

const BANGALORE_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Another AS 400 / i Series Developer - Eidiko Systems Integrators</title>
    <meta name="description" content="Experience: 5 - 12 yrs. Work Location: Bangalore">
  </head>
  <body>
    <div class="awsm-job-content">
      <div class="awsm-job-specifications-container awsm_job_spec_above_content">
        <div class="awsm-job-specification-item awsm-job-specification-job-type">
          <span class="awsm-job-specification-label"><strong>Job Type: </strong></span>
          <span class="awsm-job-specification-term">Full Time</span>
        </div>
        <div class="awsm-job-specification-item awsm-job-specification-job-location">
          <span class="awsm-job-specification-label"><strong>Job Location: </strong></span>
          <span class="awsm-job-specification-term">Bangalore</span>
        </div>
        <div class="awsm-job-specification-item awsm-job-specification-experience">
          <span class="awsm-job-specification-label"><strong>Experience: </strong></span>
          <span class="awsm-job-specification-term">5 - 12 yrs</span>
        </div>
      </div>
      <div class="awsm-job-entry-content entry-content">
        <p><strong>Brief description about the role:</strong></p>
        <ul>
          <li>Strong SQL skills, including stored procedures.</li>
          <li>Experience with iSeries programming using RPG/ILE.</li>
        </ul>
      </div>
    </div>
    <div class="awsm-job-form"><h2>Apply for this position</h2></div>
  </body>
</html>
`

const HYDERABAD_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>AS 400 / i Series Developer - Eidiko Systems Integrators</title>
    <meta name="description" content="Experience: 2 - 4 yrs Work Location: Hyderabad">
  </head>
  <body>
    <div class="awsm-job-content">
      <div class="awsm-job-specifications-container awsm_job_spec_above_content">
        <div class="awsm-job-specification-item awsm-job-specification-job-type">
          <span class="awsm-job-specification-label"><strong>Job Type: </strong></span>
          <span class="awsm-job-specification-term">Full Time</span>
        </div>
        <div class="awsm-job-specification-item awsm-job-specification-job-location">
          <span class="awsm-job-specification-label"><strong>Job Location: </strong></span>
          <span class="awsm-job-specification-term">Hyderabad</span>
        </div>
        <div class="awsm-job-specification-item awsm-job-specification-experience">
          <span class="awsm-job-specification-label"><strong>Experience: </strong></span>
          <span class="awsm-job-specification-term">2 - 4 yrs</span>
        </div>
      </div>
      <div class="awsm-job-entry-content entry-content">
        <p><strong>Brief description about the role:</strong></p>
        <ul>
          <li>Experience with AS400.</li>
          <li>Ability to code complex queries against multiple databases.</li>
        </ul>
      </div>
    </div>
    <div class="awsm-job-form"><h2>Apply for this position</h2></div>
  </body>
</html>
`

const CHARLOTTE_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Technical Delivery Leads, Charlotte,NC - Eidiko Systems Integrators</title>
    <meta name="description" content="Experience: 10+ yrs. Work Location: Charlotte, NC">
  </head>
  <body>
    <div class="awsm-job-content">
      <div class="awsm-job-specifications-container awsm_job_spec_above_content">
        <div class="awsm-job-specification-item awsm-job-specification-job-type">
          <span class="awsm-job-specification-label"><strong>Job Type: </strong></span>
          <span class="awsm-job-specification-term">Full Time</span>
        </div>
        <div class="awsm-job-specification-item awsm-job-specification-job-location">
          <span class="awsm-job-specification-label"><strong>Job Location: </strong></span>
          <span class="awsm-job-specification-term">Charlotte, NC</span>
        </div>
        <div class="awsm-job-specification-item awsm-job-specification-experience">
          <span class="awsm-job-specification-label"><strong>Experience: </strong></span>
          <span class="awsm-job-specification-term">10+ yrs</span>
        </div>
      </div>
      <div class="awsm-job-entry-content entry-content">
        <p>Closely working with IT project managers for multiple IT projects.</p>
      </div>
    </div>
    <div class="awsm-job-form"><h2>Apply for this position</h2></div>
  </body>
</html>
`

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/eidikosystemsintegrators/catalog.js')
  } catch {
    assert.fail('Expected Eidiko Systems Integrators catalog module at ../../scraper/eidikosystemsintegrators/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/eidikosystemsintegrators/script.js')
  } catch {
    assert.fail('Expected Eidiko Systems Integrators scraper module at ../../scraper/eidikosystemsintegrators/script.js')
  }
}

test('Eidiko Systems Integrators local catalog records the verified first-party public jobs board state', async () => {
  const { EIDIKO_SYSTEMS_INTEGRATORS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(EIDIKO_SYSTEMS_INTEGRATORS_CATALOG)

  assert.equal(defaultCatalog, EIDIKO_SYSTEMS_INTEGRATORS_CATALOG)
  assert.equal(provider.source, 'eidikosystemsintegrators')
  assert.equal(provider.companyName, 'Eidiko Systems Integrators')
  assert.equal(provider.officialBrandName, 'Eidiko')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://eidiko.com/careers/')
  assert.equal(provider.companyDomain, 'eidiko.com')
  assert.equal(provider.atsPlatform, 'first-party-awsm-jobs-board')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-careers-page-awsm-post-grid')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+awsm-job-openings-cards+same-domain-detail-pages+india-location-filter',
  )
  assert.equal(provider.verifiedOn, '2026-08-13')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /first-party Eidiko careers page/i)
  assert.match(provider.verifiedSurfaceSummary, /Another AS 400 \/ i Series Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /AS 400 \/ i Series Developer/i)
})

test('Eidiko Systems Integrators exact backlog row resolves from the local catalog', async () => {
  const { EIDIKO_SYSTEMS_INTEGRATORS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Eidiko Systems Integrators\n',
    catalog: [hydrateProviderCatalogEntry(EIDIKO_SYSTEMS_INTEGRATORS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('Eidiko Systems Integrators extracts the verified India jobs from the first-party careers board', async () => {
  const eidiko = await loadScriptModule()
  const requestedUrls = []

  const jobs = await eidiko.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === eidiko.CAREERS_URL) return CAREERS_HTML
      if (url === 'https://eidiko.com/job/technical-delivery-leads/') return CHARLOTTE_DETAIL_HTML
      if (url === 'https://eidiko.com/job/another-as-400-i-series-developer/') return BANGALORE_DETAIL_HTML
      if (url === 'https://eidiko.com/job/as-400-i-series-developer/') return HYDERABAD_DETAIL_HTML
      throw new Error(`Unexpected Eidiko URL: ${url}`)
    },
    now: () => '2026-08-13T10:30:00.000Z',
  })

  assert.equal(eidiko.hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.deepEqual(eidiko.extractListingJobs(CAREERS_HTML), [
    {
      title: 'Technical Delivery Leads, Charlotte,NC',
      detailUrl: 'https://eidiko.com/job/technical-delivery-leads/',
      jobId: 'technical-delivery-leads',
      requisitionId: 'technical-delivery-leads',
      summary: 'Technical Delivery Leads, Charlotte, NC: Closely working with IT project managers for multiple IT projects.',
    },
    {
      title: 'Another AS 400 / i Series Developer',
      detailUrl: 'https://eidiko.com/job/another-as-400-i-series-developer/',
      jobId: 'another-as-400-i-series-developer',
      requisitionId: 'another-as-400-i-series-developer',
      summary: 'Experience: 5 - 12 yrs. Work Location: Bangalore',
    },
    {
      title: 'AS 400 / i Series Developer',
      detailUrl: 'https://eidiko.com/job/as-400-i-series-developer/',
      jobId: 'as-400-i-series-developer',
      requisitionId: 'as-400-i-series-developer',
      summary: 'Experience: 2 - 4 yrs Work Location: Hyderabad',
    },
  ])
  assert.deepEqual(requestedUrls, [
    eidiko.CAREERS_URL,
    'https://eidiko.com/job/technical-delivery-leads/',
    'https://eidiko.com/job/another-as-400-i-series-developer/',
    'https://eidiko.com/job/as-400-i-series-developer/',
  ])
  assert.deepEqual(jobs, [
    {
      title: 'Another AS 400 / i Series Developer',
      company: 'Eidiko Systems Integrators',
      department: null,
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: 'another-as-400-i-series-developer',
      requisitionId: 'another-as-400-i-series-developer',
      sourceUrl: 'https://eidiko.com/job/another-as-400-i-series-developer/',
      applyUrl: 'https://eidiko.com/job/another-as-400-i-series-developer/',
      employmentType: 'Full Time',
      experienceRequired: '5 - 12 yrs',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Brief description about the role: Strong SQL skills, including stored procedures. Experience with iSeries programming using RPG/ILE.',
      source: 'eidikosystemsintegrators',
      link: 'https://eidiko.com/job/another-as-400-i-series-developer/',
      scrapedAt: '2026-08-13T10:30:00.000Z',
    },
    {
      title: 'AS 400 / i Series Developer',
      company: 'Eidiko Systems Integrators',
      department: null,
      location: 'Hyderabad, India',
      city: 'Hyderabad',
      country: 'India',
      jobId: 'as-400-i-series-developer',
      requisitionId: 'as-400-i-series-developer',
      sourceUrl: 'https://eidiko.com/job/as-400-i-series-developer/',
      applyUrl: 'https://eidiko.com/job/as-400-i-series-developer/',
      employmentType: 'Full Time',
      experienceRequired: '2 - 4 yrs',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Brief description about the role: Experience with AS400. Ability to code complex queries against multiple databases.',
      source: 'eidikosystemsintegrators',
      link: 'https://eidiko.com/job/as-400-i-series-developer/',
      scrapedAt: '2026-08-13T10:30:00.000Z',
    },
  ])
})

test('Eidiko Systems Integrators fails closed when the verified careers board drifts', async () => {
  const eidiko = await loadScriptModule()

  await assert.rejects(
    eidiko.run({
      fetchText: async () => '<html><body><h1>Unexpected shell</h1></body></html>',
    }),
    /verified careers page changed materially/i,
  )
})
