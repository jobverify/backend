import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/bito/script.js')
  } catch {
    assert.fail('Expected Bito scraper module at ../../scraper/bito/script.js')
  }
}

const VERIFIED_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Bito</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <h2>Enable developers to innovate at the speed of thought</h2>
      <h2>Bito is committed to AI tools that can revolutionize how software developers work.</h2>
      <a href="#open-roles">View open roles</a>
      <section id="open-roles">
        <h2>We're looking for talented people</h2>
        <h3>Currently open positions</h3>
        <div id="freshteam-widget"></div>
        <script
          type="text/rocketlazyloadscript"
          data-rocket-src="https://bito.ai/wp-content/cache/min/1/files.freshteam.com/production/98462/attachments/6008816624/original/6000034511_widget.js?ver=1784794402"
        ></script>
      </section>
      <p>careers@bito.ai</p>
    </main>
  </body>
</html>
`

const VERIFIED_LISTING_HTML = `
<!doctype html>
<html>
  <head>
    <title>Careers</title>
  </head>
  <body>
    <h3 class="advanced-page-title">Open Positions</h3>
    <div data-portal-id="job-role-list">
      <ul>
        <li data-portal-role="_role_6000089038">
          <div class="role-title">
            <h5>
              Sales
              <span class="mobile-role-count">- 1 Open Role</span>
            </h5>
          </div>
          <div class="job-list">
            <a
              href="/jobs/Ot1OTp378jzF/account-executive-new-business-san-francisco-bay-area"
              class="heading"
              data-portal-title="accountexecutive,newbusiness(sanfranciscobayarea)"
              data-portal-location="Pune, India"
              data-portal-job-type="2"
              data-portal-remote-location=true
            >
              <div class="row">
                <div class="job-list-info">
                  <div class="job-title">Account Executive, New Business (San Francisco Bay Area)</div>
                  <div class="job-desc text">
                    Bito believes software development will change dramatically over the next 5-10 years.
                  </div>
                </div>
                <div class="job-location">
                  <div class="location-info">
                    Remote
                    <br />
                    Full Time
                  </div>
                </div>
              </div>
            </a>
          </div>
        </li>
      </ul>
    </div>
  </body>
</html>
`

const VERIFIED_DETAIL_HTML = `
<!doctype html>
<html>
  <body>
    <div class="job-details">
      <div class="job-details-header" id="job-details-header">
        <div class="content">
          <a class="link-back" id="job-details-back-btn">
            <i class="icon-arrow-left"></i>Sales
          </a>
          <div class="row">
            <div class="col-xs-8">
              <h1 class="brand-color">Account Executive, New Business (San Francisco Bay Area)</h1>
              <div class="stick-hide-in-mobile text-color">
                Preferable Location(s):
                San Francisco, United States of America | New York, United States of America
                <div>
                  Work Type:
                  Full Time
                </div>
              </div>
            </div>
            <div class="col-xs-4 pull-xs-right text-right">
              <a href="#applicant-form" class="btn btn-custom">Apply Now</a>
            </div>
          </div>
        </div>
      </div>
      <div class="job-details-content content">
        <div>
          <p>Bito believes software development will change dramatically over the next 5-10 years.</p>
          <p>Bito's AI Architect builds a semantic knowledge graph of enterprise codebases.</p>
          <p>Our founders have previously started, built, and taken a company public.</p>
          <p>We're looking for an Account Executive - New Business (US) to drive growth in the developer tools and SaaS space.</p>
          <div><strong>Key Responsibilities</strong></div>
          <ul>
            <li>Own and close new business in US markets for Bito's AI Architect</li>
          </ul>
          <div><strong>Qualifications</strong></div>
          <ul>
            <li>5+ years of quota-carrying sales experience, ideally in developer tools, SaaS, or GenAI</li>
            <li>Strong written and verbal communication with follow-through</li>
          </ul>
        </div>
        <div class="application-form" id="applicant-form">
          <form action="/jobs/Ot1OTp378jzF/applicants" method="post"></form>
        </div>
      </div>
      <script type="application/ld+json">
        {
          "@context": "http://schema.org/",
          "@type": "JobPosting",
          "url": "https://bito.freshteam.com/jobs/Ot1OTp378jzF/Account%20Executive,%20New%20Business%20(San%20Francisco%20Bay%20Area)",
          "title": "Account Executive, New Business (San Francisco Bay Area)",
          "description": "<p>Bito believes software development will change dramatically over the next 5-10 years.</p><p>Bito's AI Architect builds a semantic knowledge graph of enterprise codebases.</p><p>Our founders have previously started, built, and taken a company public.</p><p>We're looking for an Account Executive - New Business (US) to drive growth in the developer tools and SaaS space.</p><div><strong>Key Responsibilities</strong></div><ul><li>Own and close new business in US markets for Bito's AI Architect</li></ul><div><strong>Qualifications</strong></div><ul><li>5+ years of quota-carrying sales experience, ideally in developer tools, SaaS, or GenAI</li><li>Strong written and verbal communication with follow-through</li></ul>",
          "datePosted": "2026-06-04 21:15:38 UTC",
          "employmentType": "FULL_TIME",
          "remote": "true",
          "hiringOrganization": {
            "@type": "Organization",
            "name": "Bito"
          },
          "jobLocation": {
            "@type": "Place",
            "address": {
              "@type": "PostalAddress",
              "addressRegion": "Pune",
              "addressLocality": "Maharashtra",
              "addressCountry": "India"
            }
          }
        }
      </script>
    </div>
  </body>
</html>
`

test('Archived Bito fixture validates the verified first-party careers page and public Freshteam board contract', async () => {
  const bito = await loadModule()
  const listings = bito.extractListingJobs(VERIFIED_LISTING_HTML)
  const jobPosting = bito.extractJobPosting(VERIFIED_DETAIL_HTML)

  assert.equal(bito.SOURCE, 'bito')
  assert.equal(bito.COMPANY, 'Bito')
  assert.equal(bito.VERIFIED_ON, '2026-07-25')
  assert.equal(bito.CAREERS_URL, 'https://bito.ai/careers/')
  assert.equal(bito.FRESHTEAM_JOBS_URL, 'https://bito.freshteam.com/jobs')
  assert.equal(
    bito.DISPOSITION,
    'verified-first-party-careers-page-plus-public-freshteam-jobs-board',
  )
  assert.match(bito.VERIFIED_SURFACE_SUMMARY, /Saturday, July 25, 2026/)
  assert.match(bito.VERIFIED_SURFACE_SUMMARY, /https:\/\/bito\.ai\/careers\//i)
  assert.match(bito.VERIFIED_SURFACE_SUMMARY, /https:\/\/bito\.freshteam\.com\/jobs/i)
  assert.match(
    bito.VERIFIED_SURFACE_SUMMARY,
    /Account Executive, New Business \(San Francisco Bay Area\)/i,
  )
  assert.equal(bito.hasOfficialCareersPageSignal(VERIFIED_CAREERS_HTML), true)
  assert.equal(bito.hasVerifiedFreshteamWidgetEmbed(VERIFIED_CAREERS_HTML), true)
  assert.equal(bito.hasFreshteamJobsBoardSignal(VERIFIED_LISTING_HTML), true)
  assert.equal(listings.length, 1)
  assert.equal(listings[0].title, 'Account Executive, New Business (San Francisco Bay Area)')
  assert.equal(listings[0].department, 'Sales')
  assert.equal(listings[0].locationText, 'Remote')
  assert.equal(listings[0].dataLocation, 'Pune, India')
  assert.equal(
    bito.extractVisiblePreferredLocations(VERIFIED_DETAIL_HTML),
    'San Francisco, United States of America | New York, United States of America',
  )
  assert.equal(jobPosting?.hiringOrganization?.name, 'Bito')
  assert.equal(jobPosting?.jobLocation?.address?.addressCountry, 'India')
})

test('Archived Bito fixture extracts the verified public Freshteam role conservatively from the visible detail page fields', async () => {
  const bito = await loadModule()
  const listing = bito.extractListingJobs(VERIFIED_LISTING_HTML)[0]
  const job = bito.extractJobDetail(VERIFIED_DETAIL_HTML, listing)

  assert.equal(
    job.sourceUrl,
    'https://bito.freshteam.com/jobs/Ot1OTp378jzF/account-executive-new-business-san-francisco-bay-area',
  )
  assert.equal(
    job.applyUrl,
    'https://bito.freshteam.com/jobs/Ot1OTp378jzF/account-executive-new-business-san-francisco-bay-area',
  )
  assert.equal(job.title, 'Account Executive, New Business (San Francisco Bay Area)')
  assert.equal(job.company, 'Bito')
  assert.equal(job.department, 'Sales')
  assert.equal(
    job.location,
    'San Francisco, United States of America | New York, United States of America',
  )
  assert.equal(job.city, 'San Francisco')
  assert.equal(job.country, 'United States')
  assert.equal(job.employmentType, 'Full-time')
  assert.equal(job.experienceRequired, '5+ years')
  assert.equal(job.postingDate, '2026-06-04T21:15:38.000Z')
  assert.equal(job.remoteStatus, 'Remote')
  assert.match(job.jobDescription, /Own and close new business in US markets/i)
  assert.match(job.jobDescription, /5\+ years of quota-carrying sales experience/i)
})

test('current Bito run requires response identity rather than the archived fetchText-only contract', async () => {
  const bito = await loadModule()
  await assert.rejects(bito.run({ fetchText: async () => VERIFIED_CAREERS_HTML }), /transport requires fetchPage/)
})
test('current Bito catalog uses native India scope and evidence-required zero handling', async () => {
  const bito = await loadModule()
  const { getScraperCatalog } = await import('../providers/index.js')
  const provider = getScraperCatalog().find(row => row.source === 'bito')
  assert.equal(provider.atsPlatform, 'freshteam')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.zeroResultPolicy, 'evidence-required')
  assert.equal(bito.PROVIDER_METADATA.verifiedOn, '2026-10-26')
})
