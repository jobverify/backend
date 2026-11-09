import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/easyrewardzsoftwareservices/script.js')

const CAREERS_FIXTURE = `
  <h1>Careers</h1>
  <p>Join the tribe</p>
  <div class="awsm-filter-wrap">
    <label>All Job Category</label>
    <label>All Job Location</label>
  </div>
  <div class="awsm-job-listings awsm-row awsm-grid-col-3" data-listings="12">
    <div class="awsm-job-listing-item awsm-grid-item" id="awsm-grid-item-39368">
      <a href="https://easyrewardz.com/jobs/customer-success-kam-bfsi-2/" class="awsm-job-item">
        <div class="awsm-grid-left-col">
          <h2 class="awsm-job-post-title">Customer Success â€“ KAM â€“ BFSI</h2>
        </div>
        <div class="awsm-grid-right-col">
          <div class="awsm-job-specification-wrapper">
            <div class="awsm-job-specification-item awsm-job-specification-job-category">
              <span class="awsm-job-specification-term">Customer Success â€“ KAM â€“ BFSI</span>
            </div>
            <div class="awsm-job-specification-item awsm-job-specification-job-type">
              <span class="awsm-job-specification-term">Full Time</span>
            </div>
            <div class="awsm-job-specification-item awsm-job-specification-job-location">
              <span class="awsm-job-specification-term">Gurgaon</span>
            </div>
          </div>
          <div class="awsm-job-more-container"><span class="awsm-job-more">More Details</span></div>
        </div>
      </a>
    </div>
    <div class="awsm-job-listing-item awsm-grid-item" id="awsm-grid-item-39222">
      <a href="https://easyrewardz.com/jobs/smb-sales-popin/" class="awsm-job-item">
        <div class="awsm-grid-left-col">
          <h2 class="awsm-job-post-title">SMB -Sales &#8211; Popin</h2>
        </div>
        <div class="awsm-grid-right-col">
          <div class="awsm-job-specification-wrapper">
            <div class="awsm-job-specification-item awsm-job-specification-job-category">
              <span class="awsm-job-specification-term">SMB -Sales &#8211; Popin</span>
            </div>
            <div class="awsm-job-specification-item awsm-job-specification-job-type">
              <span class="awsm-job-specification-term">Full Time</span>
            </div>
            <div class="awsm-job-specification-item awsm-job-specification-job-location">
              <span class="awsm-job-specification-term">Gurgaon</span>
            </div>
          </div>
          <div class="awsm-job-more-container"><span class="awsm-job-more">More Details</span></div>
        </div>
      </a>
    </div>
  </div>
`

const API_FIXTURE = JSON.stringify([
  {
    id: 39368,
    date: '2025-07-17T11:50:15',
    slug: 'customer-success-kam-bfsi-2',
    link: 'https://easyrewardz.com/jobs/customer-success-kam-bfsi-2/',
    title: {
      rendered: 'Customer Success â€“ KAM â€“ BFSI',
    },
    content: {
      rendered: `
        <h2>About Easyrewardz</h2>
        <p>EasyRewardz is a leading customer experience management company.</p>
        <h2>Experience &amp; Skills</h2>
        <ul>
          <li>4-5 years+ Experience</li>
          <li>Strong knowledge of loyalty, CRM and marketing strategy in BFSI.</li>
        </ul>
        <h2>Qualification &amp; Working Experience</h2>
        <p>BE/B.Tech with MBA.</p>
        <p>4-5 years of working experience.</p>
        <p><b>Location – Gurgaon</b></p>
      `,
    },
  },
  {
    id: 39222,
    date: '2025-07-17T11:27:26',
    slug: 'smb-sales-popin',
    link: 'https://easyrewardz.com/jobs/smb-sales-popin/',
    title: {
      rendered: 'SMB -Sales &#8211; Popin',
    },
    content: {
      rendered: `
        <h2>About Easyrewardz</h2>
        <p>Join the growth team focused on SMB partnerships.</p>
        <p><b>Location – Gurgaon</b></p>
        <h2>Responsibilities</h2>
        <p>Own inside sales motions and partner outreach for the Popin product line.</p>
      `,
    },
  },
])

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/easyrewardzsoftwareservices/catalog.js')
  } catch {
    assert.fail('Expected EasyRewardz Software Services catalog module at ../../scraper/easyrewardzsoftwareservices/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/easyrewardzsoftwareservices/script.js')
  } catch {
    assert.fail('Expected EasyRewardz Software Services scraper module at ../../scraper/easyrewardzsoftwareservices/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('EasyRewardz Software Services local catalog captures the verified first-party careers listing surface', async () => {
  const { EASYREWARDZ_SOFTWARE_SERVICES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = buildCatalogReadyProvider(EASYREWARDZ_SOFTWARE_SERVICES_CATALOG)

  assert.equal(defaultCatalog, EASYREWARDZ_SOFTWARE_SERVICES_CATALOG)
  assert.equal(provider.source, 'easyrewardzsoftwareservices')
  assert.equal(provider.companyName, 'EasyRewardz Software Services')
  assert.equal(provider.officialBrandName, 'Easyrewardz')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://easyrewardz.com/')
  assert.equal(provider.companyCareerPage, 'https://easyrewardz.com/company/careers/')
  assert.equal(provider.companyDomain, 'easyrewardz.com')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(provider.extractionStrategy, 'verified-first-party-awsm-jobs-listing')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/easyrewardz\.com\/company\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /Customer Success/i)
  assert.match(provider.verifiedSurfaceSummary, /Lead Data Engineer/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /easyrewardzsoftwareservices[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'EasyRewardz Software Services\n',
    catalog: [provider],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('EasyRewardz Software Services scraper extracts first-party role cards from the verified careers page', async () => {
  const easyrewardz = await loadScriptModule()
  const scraper = easyrewardz.createEasyRewardzSoftwareServicesScraper({
    now: () => '2026-07-18T12:00:00.000Z',
  })

  assert.equal(easyrewardz.hasOfficialCareersSignals(CAREERS_FIXTURE), true)

  const jobs = await scraper.run({
    fetchText: async (url) => {
      if (url === easyrewardz.CAREERS_URL) {
        return CAREERS_FIXTURE
      }

      if (url === easyrewardz.JOBS_API_URL) {
        return API_FIXTURE
      }

      throw new Error(`Unexpected EasyRewardz fixture URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      applyUrl: job.applyUrl,
      employmentType: job.employmentType,
      jobId: job.jobId,
      experienceRequired: job.experienceRequired,
      publicExperienceChecked: job.publicExperienceChecked,
    })),
    [
      {
        title: 'Customer Success â€“ KAM â€“ BFSI',
        location: 'Gurgaon, India',
        applyUrl: 'https://easyrewardz.com/jobs/customer-success-kam-bfsi-2/',
        employmentType: 'Full-time',
        jobId: 'customer-success-kam-bfsi-gurgaon-customer-success-kam-bfsi-2',
        experienceRequired: '4-5 years',
        publicExperienceChecked: true,
      },
      {
        title: 'SMB -Sales – Popin',
        location: 'Gurgaon, India',
        applyUrl: 'https://easyrewardz.com/jobs/smb-sales-popin/',
        employmentType: 'Full-time',
        jobId: 'smb-sales-popin-gurgaon-smb-sales-popin',
        experienceRequired: null,
        publicExperienceChecked: true,
      },
    ],
  )
})
