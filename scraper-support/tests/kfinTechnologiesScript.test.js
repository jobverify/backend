import assert from 'node:assert/strict'
import test from 'node:test'

import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const FIXED_SCRAPED_AT = '2026-07-16T00:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - KFin Technologies Private Limited | KFintech</title>
  </head>
  <body>
    <h1>Be the first to see new opportunities.</h1>
    <p>Join the Talent Network</p>
    <button type="button">Domestic Fund Services</button>
    <div class="job-card">
      <a href="https://www.kfintech.com/jobs/associate-senior-associate-mutual-fund-services-uti/">
        Associate/ Senior Associate - Mutual Fund Services (UTI)
      </a>
    </div>
    <button type="button">IT</button>
    <div class="job-card">
      <a href="/jobs/product-manager-it/">Product Manager - IT</a>
    </div>
    <button type="button">Non-Domestic Fund Services</button>
    <p class="empty-filter-message">No Jobs Available</p>
  </body>
</html>
`

const associateDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Associate/ Senior Associate - Mutual Fund Services (UTI) - KFin Technologies Private Limited | KFintech</title>
    <link rel="canonical" href="https://www.kfintech.com/jobs/associate-senior-associate-mutual-fund-services-uti/" />
    <meta property="og:url" content="https://www.kfintech.com/jobs/associate-senior-associate-mutual-fund-services-uti/" />
  </head>
  <body>
    <h1> Associate/ Senior Associate &#8211; Mutual Fund Services (UTI)</h1>
    <a href="#application">Apply Now</a>
    <p><img src="/wp-content/uploads/2022/05/position_icon.svg"><span>Skills/Designation: </span>Associate/Senior Associate</p>
    <p><img src="/wp-content/uploads/2022/05/experience_icon.svg"><span>Experience: </span>0-3 Yrs years</p>
    <p><img src="/wp-content/uploads/2022/05/location_icon.svg"><span>Location: </span>Hyderabad</p>
    <p><img src="/wp-content/uploads/2022/05/experience_icon.svg"><span>Grade: </span>M1</p>
    <div class="job-description">
      <p>Responsibilities:</p>
      <p>Handle transaction processing for domestic fund services.</p>
      <p>Job Specification</p>
      <p>Good communication skills.</p>
    </div>
    <h4 class="job-form-title">Apply for this Job</h4>
  </body>
</html>
`

const productManagerDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Product Manager - IT - KFin Technologies Private Limited | KFintech</title>
    <link rel="canonical" href="https://www.kfintech.com/jobs/product-manager-it/" />
    <meta property="og:url" content="https://www.kfintech.com/jobs/product-manager-it/" />
  </head>
  <body>
    <h1> Product Manager &#8211; IT</h1>
    <a href="#application">Apply Now</a>
    <p><img src="/wp-content/uploads/2022/05/position_icon.svg"><span>Skills/Designation: </span>Senior Manager</p>
    <p><img src="/wp-content/uploads/2022/05/experience_icon.svg"><span>Experience: </span>7-12 years</p>
    <p><img src="/wp-content/uploads/2022/05/location_icon.svg"><span>Location: </span>Hyderabad</p>
    <p><img src="/wp-content/uploads/2022/05/experience_icon.svg"><span>Grade: </span>M3</p>
    <div class="job-description">
      <p>Responsibilities:</p>
      <p>Drive product strategy for enterprise IT platforms.</p>
    </div>
    <h4 class="job-form-title">Apply for this Job</h4>
  </body>
</html>
`

const driftedCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>KFintech</title>
  </head>
  <body>
    <h1>Company</h1>
  </body>
</html>
`

const loadKFinTechnologiesModule = async () => {
  try {
    return await import('../../scraper/kfintechnologies/script.js')
  } catch {
    assert.fail('Expected KFin Technologies scraper module at ../../scraper/kfintechnologies/script.js')
  }
}

test('KFin Technologies stays pinned to the verified KFintech careers and first-party detail-page contract', async () => {
  const kfinTechnologies = await loadKFinTechnologiesModule()

  assert.equal(kfinTechnologies.SOURCE, 'kfintechnologies')
  assert.equal(kfinTechnologies.COMPANY_NAME, 'KFin Technologies')
  assert.equal(kfinTechnologies.OFFICIAL_BRAND_NAME, 'KFintech')
  assert.equal(kfinTechnologies.CAREERS_URL, 'https://www.kfintech.com/career/')
  assert.equal(kfinTechnologies.JOBS_ARCHIVE_URL, 'https://www.kfintech.com/jobs/')
  assert.equal(
    kfinTechnologies.VERIFIED_SAMPLE_JOB_URL,
    'https://www.kfintech.com/jobs/associate-senior-associate-mutual-fund-services-uti/',
  )
  assert.equal(kfinTechnologies.VERIFIED_PUBLIC_JOB_COUNT, 8)
  assert.equal(kfinTechnologies.VERIFIED_ON, '2026-07-16')
  assert.equal(kfinTechnologies.hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(kfinTechnologies.hasOfficialCareersPageSignal(driftedCareersHtml), false)
  assert.deepEqual(kfinTechnologies.extractJobLinks(careersHtml), [
    'https://www.kfintech.com/jobs/associate-senior-associate-mutual-fund-services-uti/',
    'https://www.kfintech.com/jobs/product-manager-it/',
  ])
  assert.equal(
    kfinTechnologies.hasOfficialJobDetailSignal(
      associateDetailHtml,
      'https://www.kfintech.com/jobs/associate-senior-associate-mutual-fund-services-uti/',
    ),
    true,
  )
})

test('KFin Technologies extracts normalized first-party jobs from verified detail pages', async () => {
  const kfinTechnologies = await loadKFinTechnologiesModule()

  assert.deepEqual(
    kfinTechnologies.extractJobFromDetailPage(
      'https://www.kfintech.com/jobs/associate-senior-associate-mutual-fund-services-uti/',
      associateDetailHtml,
    ),
    {
      title: 'Associate/ Senior Associate - Mutual Fund Services (UTI)',
      company: 'KFin Technologies',
      department: null,
      location: 'Hyderabad, India',
      city: 'Hyderabad',
      state: null,
      country: 'India',
      jobId: 'associate-senior-associate-mutual-fund-services-uti',
      requisitionId: 'associate-senior-associate-mutual-fund-services-uti',
      sourceUrl: 'https://www.kfintech.com/jobs/associate-senior-associate-mutual-fund-services-uti/',
      applyUrl: 'https://www.kfintech.com/jobs/associate-senior-associate-mutual-fund-services-uti/',
      employmentType: null,
      experienceRequired: '0-3 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Associate/Senior Associate'],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Responsibilities: Handle transaction processing for domestic fund services. Job Specification Good communication skills.',
      remoteStatus: null,
    },
  )
})

test('KFin Technologies run verifies the careers page before returning first-party jobs', async () => {
  const kfinTechnologies = await loadKFinTechnologiesModule()
  const requestedUrls = []

  const jobs = await kfinTechnologies.createKFinTechnologiesScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === kfinTechnologies.CAREERS_URL) return careersHtml
      if (url === 'https://www.kfintech.com/jobs/associate-senior-associate-mutual-fund-services-uti/') {
        return associateDetailHtml
      }
      if (url === 'https://www.kfintech.com/jobs/product-manager-it/') {
        return productManagerDetailHtml
      }

      throw new Error(`Unexpected KFin Technologies URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.kfintech.com/career/',
    'https://www.kfintech.com/jobs/associate-senior-associate-mutual-fund-services-uti/',
    'https://www.kfintech.com/jobs/product-manager-it/',
  ])

  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      company: job.company,
      location: job.location,
      city: job.city,
      country: job.country,
      jobId: job.jobId,
      requiredSkills: job.requiredSkills,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      source: job.source,
      link: job.link,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Associate/ Senior Associate - Mutual Fund Services (UTI)',
        company: 'KFin Technologies',
        location: 'Hyderabad, India',
        city: 'Hyderabad',
        country: 'India',
        jobId: 'associate-senior-associate-mutual-fund-services-uti',
        requiredSkills: ['Associate/Senior Associate'],
        sourceUrl: 'https://www.kfintech.com/jobs/associate-senior-associate-mutual-fund-services-uti/',
        applyUrl: 'https://www.kfintech.com/jobs/associate-senior-associate-mutual-fund-services-uti/',
        source: 'kfintechnologies',
        link: 'https://www.kfintech.com/jobs/associate-senior-associate-mutual-fund-services-uti/',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'Product Manager - IT',
        company: 'KFin Technologies',
        location: 'Hyderabad, India',
        city: 'Hyderabad',
        country: 'India',
        jobId: 'product-manager-it',
        requiredSkills: ['Senior Manager'],
        sourceUrl: 'https://www.kfintech.com/jobs/product-manager-it/',
        applyUrl: 'https://www.kfintech.com/jobs/product-manager-it/',
        source: 'kfintechnologies',
        link: 'https://www.kfintech.com/jobs/product-manager-it/',
        scrapedAt: FIXED_SCRAPED_AT,
      },
    ],
  )
})

test('KFin Technologies returns discovery-only evidence when the verified careers page times out', async () => {
  const kfinTechnologies = await loadKFinTechnologiesModule()
  const timeoutError = Object.assign(new TypeError('fetch failed'), {
    cause: {
      code: 'UND_ERR_CONNECT_TIMEOUT',
      message: 'Connect Timeout Error (attempted address: www.kfintech.com:443, timeout: 10000ms)',
    },
  })

  const jobs = await kfinTechnologies.createKFinTechnologiesScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async () => { throw timeoutError },
  })

  assert.deepEqual(jobs, [])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.status, 'discovery-only')
  assert.equal(evidence?.surface, kfinTechnologies.CAREERS_URL)
  assert.equal(evidence?.listingComplete, false)
})

test('KFin Technologies fails closed when the verified first-party careers page drifts', async () => {
  const kfinTechnologies = await loadKFinTechnologiesModule()

  await assert.rejects(
    kfinTechnologies.createKFinTechnologiesScraper().run({
      fetchText: async () => driftedCareersHtml,
    }),
    /verified KFin Technologies careers page/i,
  )
})
