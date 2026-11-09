import assert from 'node:assert/strict'
import test from 'node:test'

const listingHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Current Job Openings, Immediate Jobs Hiring in Noida | Appy Pie Career</title>
  </head>
  <body>
    <h1>Your Career With Us At Appy Pie</h1>
    <h2>Current Search</h2>
    <div class="job_listing">
      <h3>Driver cum Runner</h3>
      <p>Noida|JR407</p>
      <a href="https://careers.appypie.com/careers/driver-cum-runner">Apply</a>
    </div>
  </body>
</html>
`

const zeroJobsListingHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Current Job Openings, Immediate Jobs Hiring in Noida | Appy Pie Career</title>
  </head>
  <body>
    <h1>Your Career With Us At Appy Pie</h1>
    <h2>Current Search</h2>
    <div class="checkbox-container jobpostcategory">
      <span class="noofjobs">(0)</span>
    </div>
    <div class="checkbox-container jobtype">
      <span class="noofjobs">(0)</span>
    </div>
    <div class="checkbox-container location">
      <span class="noofjobs">(0)</span>
    </div>
    <div class="jobresult">
      <h3 class="serchBody-headind">0 Results</h3>
      <div class="no-job-listing"><p>No jobs found.</p></div>
    </div>
  </body>
</html>
`

const detailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Driver cum Runner | Appy Pie Career</title>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org/",
        "@type": "JobPosting",
        "title": "Driver cum Runner",
        "description": "Job Summary: We are looking for a smart, reliable, and responsible Driver cum Runner to support our day-to-day business operations.",
        "datePosted": "July 8, 2026",
        "validThrough": "2020-12-30",
        "employmentType": "FULL_TIME",
        "jobLocation": {
          "@type": "Place",
          "address": {
            "@type": "PostalAddress",
            "streetAddress": "165, NSEZ",
            "addressLocality": "Noida",
            "addressRegion": "UP",
            "postalCode": "201305",
            "addressCountry": "IND"
          }
        },
        "hiringOrganization": {
          "@type": "Organization",
          "name": "Appy Pie",
          "sameAs": "https://careers.appypie.com/careers/driver-cum-runner"
        }
      }
    </script>
  </head>
  <body>
    <div class="job-wrapper detail">
      <h1 class="jobtitle">Driver cum Runner</h1>
      <div class="joblocation"><span>Noida</span></div>
      <div class="jobdescp">
        <h2 class="jobdescp-subheading">Job Category</h2>
        <p>Administration</p>
      </div>
      <div class="companyDetail">
        <ul class="companyDetailList">
          <li>Posted 1 week ago</li>
          <li>Permanent</li>
          <li>JR407</li>
        </ul>
      </div>
      <button type="button" class="apply-btn">Apply Now</button>
    </div>
  </body>
</html>
`

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/appypie/provider.js')
  } catch {
    assert.fail('Expected Appy Pie provider module at ../../scraper/appypie/provider.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/appypie/script.js')
  } catch {
    assert.fail('Expected Appy Pie scraper module at ../../scraper/appypie/script.js')
  }
}

test('Appy Pie exports the verified first-party job-board contract', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()

  assert.deepEqual(providerModule.provider, {
    source: 'appypie',
    companyName: 'Appy Pie',
    officialBrandName: 'Appy Pie',
    adapter: 'script',
    modulePath: '../../scraper/appypie/script.js',
    homepageUrl: 'https://www.appypie.com/',
    companyCareerPage: 'https://careers.appypie.com/careers',
    atsPlatform: 'wordpress-simple-jobs',
    countryFilter: 'India',
    paginationStrategy: 'single-first-party-job-board-page-plus-detail-pages-or-empty-shell',
    extractionStrategy: 'verified-first-party-job-board+detail-page-jsonld+visible-detail-metadata+india-only-filter+zero-openings-fallback',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    companyDomain: 'careers.appypie.com',
    verifiedOn: '2026-08-01',
    verifiedSurfaceSummary:
      'Verified on Saturday, August 1, 2026 that https://careers.appypie.com/careers remained the live first-party Appy Pie careers page, but the public Current Search shell currently exposed only zero-count filters and no public role detail URLs. The local scraper therefore preserves its detail-page JSON-LD mapping when public roles reappear, while returning an empty result for the verified no-openings state visible on the first-party surface today.',
    dryRunFile: 'appypie/jobs.json',
  })

  assert.equal(scriptModule.SOURCE, providerModule.provider.source)
  assert.equal(scriptModule.COMPANY, providerModule.provider.companyName)
  assert.equal(scriptModule.CAREERS_URL, providerModule.provider.companyCareerPage)
  assert.deepEqual(scriptModule.PROVIDER_METADATA, providerModule.provider)
})

test('Appy Pie extracts first-party detail URLs and maps India jobs from the detail page JSON-LD', async () => {
  const appyPie = await loadScriptModule()

  assert.equal(appyPie.hasOfficialCareersSignal(listingHtml), true)
  assert.deepEqual(appyPie.extractJobDetailUrls(listingHtml), [
    'https://careers.appypie.com/careers/driver-cum-runner',
  ])
  assert.equal(appyPie.extractJobPosting(detailHtml).title, 'Driver cum Runner')

  const jobs = await appyPie.run({
    fetchText: async (url) => {
      if (url === appyPie.CAREERS_URL) return listingHtml
      if (url === 'https://careers.appypie.com/careers/driver-cum-runner') return detailHtml
      throw new Error(`Unexpected Appy Pie URL: ${url}`)
    },
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.deepEqual(jobs, [
    {
      title: 'Driver cum Runner',
      company: 'Appy Pie',
      department: 'Administration',
      location: 'Noida, UP, India',
      city: 'Noida',
      state: 'UP',
      country: 'India',
      jobId: 'JR407',
      requisitionId: 'JR407',
      sourceUrl: 'https://careers.appypie.com/careers/driver-cum-runner',
      applyUrl: 'https://careers.appypie.com/careers/driver-cum-runner',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-08',
      closingDate: null,
      jobDescription:
        'Job Summary: We are looking for a smart, reliable, and responsible Driver cum Runner to support our day-to-day business operations.',
      link: 'https://careers.appypie.com/careers/driver-cum-runner',
      source: 'appypie',
      scrapedAt: '2026-07-18T00:00:00.000Z',
    },
  ])
})

test('Appy Pie returns [] for the verified zero-openings shell when the first-party board exposes no detail URLs', async () => {
  const appyPie = await loadScriptModule()

  assert.equal(appyPie.hasOfficialCareersSignal(zeroJobsListingHtml), true)
  assert.deepEqual(appyPie.extractJobDetailUrls(zeroJobsListingHtml), [])
  assert.equal(appyPie.hasVerifiedNoOpeningsSignal(zeroJobsListingHtml), true)

  const jobs = await appyPie.run({
    fetchText: async (url) => {
      assert.equal(url, appyPie.CAREERS_URL)
      return zeroJobsListingHtml
    },
    now: () => '2026-08-01T00:00:00.000Z',
  })

  assert.deepEqual(jobs, [])
})
