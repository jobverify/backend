import assert from 'node:assert/strict'
import test from 'node:test'

const loadCitymallModule = async () => {
  try {
    return await import('../../scraper/citymall/script.js')
  } catch (error) {
    assert.fail(`Expected Citymall scraper module at ../../scraper/citymall/script.js (${error.code || error.message})`)
  }
}

const listingHtml = `
<!doctype html>
<html>
  <head>
    <meta property="og:title" content="Careers - CityMall" />
    <meta property="og:description" content="#2 Jobs - Gurugram" />
  </head>
  <body>
    <div class="advanced-search">
      <h3 class="advanced-page-title">Open Positions</h3>
    </div>
    <div class="job-role-list" data-portal-id="job-role-list">
      <ul>
        <li data-portal-role="_role_6000115571">
          <div class="role-title">
            <h5>
              Engineering
              <span class="mobile-role-count">- 2 Open Roles</span>
            </h5>
          </div>
          <div>
            <div class="job-list">
              <a href="/jobs/wRX0jtUqbsww/backend-engineer-sde-iii-nodejs" class="heading" data-portal-title="backendengineer-sdeiiinodejs" data-portal-location="Gurugram, India" data-portal-job-type="2" data-portal-remote-location="false">
                <div class="row">
                  <div class="job-list-info">
                    <div class="job-title">Backend Engineer- SDE III NodeJS</div>
                    <div class="job-desc text">
                      What problems will you be working on:&nbsp;•&nbsp;Architecture and development of mission critical systems that constitute the core of our operations&nbsp;•&nbsp;Brainstorming and chalking out solutio...
                    </div>
                  </div>
                  <div class="job-location">
                    <div class="location-info">
                      Gurugram, Haryana
                      <br/>
                      Full Time
                    </div>
                  </div>
                </div>
              </a>
              <a href="/jobs/_zGvqXKOs_dF/sr-data-engineer" class="heading" data-portal-title="srdataengineer" data-portal-location="Gurugram, India" data-portal-job-type="2" data-portal-remote-location="false">
                <div class="row">
                  <div class="job-list-info">
                    <div class="job-title">Sr Data Engineer</div>
                    <div class="job-desc text">
                      Roles and Responsibilities:&nbsp;.&nbsp;Tests, monitors, manage and validate data warehouse activity including data extraction, transformation, movement, loading, cleansing, and updating processes&nbs...
                    </div>
                  </div>
                  <div class="job-location">
                    <div class="location-info">
                      Gurugram, Haryana
                      <br/>
                      Full Time
                    </div>
                  </div>
                </div>
              </a>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </body>
</html>
`

const backendEngineerDetailHtml = `
<!doctype html>
<html>
  <body>
    <div class="job-details">
      <div class="job-details-header">
        <div class="content">
          <a class="link-back" id="job-details-back-btn">
            <i class="icon-arrow-left"></i>Engineering
          </a>
          <div class="row">
            <div class="col-xs-8">
              <h1 class="brand-color">Backend Engineer- SDE III NodeJS</h1>
              <div class="stick-hide-in-mobile text-color">
                Gurugram, Haryana
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
          <p>What problems will you be working on:</p>
          <ul>
            <li>Architecture and development of mission critical systems that constitute the core of our operations</li>
            <li>Brainstorming and chalking out solutions to business requirements</li>
            <li>Implementing complex workflows</li>
            <li>Maintain code and write automated tests to ensure the product is of the highest quality</li>
          </ul>
          <p>Must have skills:</p>
          <ul>
            <li>2 years - 4yrs of experience working in a high growth startup building APIs and architecture that scales using NodeJS, Javascript</li>
            <li>Sound understanding of writing reliable, readable, and extensible software that would stand the test of time</li>
            <li>Strong core javascript skills</li>
          </ul>
        </div>
      </div>
    </div>
    <script type="application/ld+json">
      {
        "@context": "http://schema.org/",
        "@type": "JobPosting",
        "datePosted": "2026-02-02 21:30:21 UTC",
        "employmentType": "FULL_TIME",
        "remote": "false"
      }
    </script>
  </body>
</html>
`

const srDataEngineerDetailHtml = `
<!doctype html>
<html>
  <body>
    <div class="job-details">
      <div class="job-details-header">
        <div class="content">
          <a class="link-back" id="job-details-back-btn">
            <i class="icon-arrow-left"></i>Engineering
          </a>
          <div class="row">
            <div class="col-xs-8">
              <h1 class="brand-color">Sr Data Engineer</h1>
              <div class="stick-hide-in-mobile text-color">
                Gurugram, Haryana
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
          <p><strong>Roles and Responsibilities:</strong></p>
          <ul>
            <li>Tests, monitors, manage and validate data warehouse activity including data extraction, transformation, movement, loading, cleansing, and updating processes</li>
            <li>Building and maintaining optimized and highly available data pipelines that facilitate deeper analysis and reporting</li>
            <li>Collaborate with stakeholders to understand, define and document business applications, data sources/relationships, and needs</li>
          </ul>
          <p><strong>Skills Required:</strong></p>
          <ul>
            <li>Proficient in languages: Python.</li>
            <li>Minimum 2+ years experience as Data Engineer</li>
            <li>Experience in AWS Stack - Glue, Athena, Quick sight, RDS, Redshift, Kafka</li>
          </ul>
        </div>
      </div>
    </div>
    <script type="application/ld+json">
      {
        "@context": "http://schema.org/",
        "@type": "JobPosting",
        "datePosted": "2025-11-09 14:38:01 UTC",
        "employmentType": "FULL_TIME",
        "remote": "false"
      }
    </script>
  </body>
</html>
`

test('Citymall constants stay pinned to the public Freshteam board and detail URL pattern', async () => {
  const citymall = await loadCitymallModule()

  assert.equal(citymall.SOURCE, 'citymall')
  assert.equal(citymall.COMPANY, 'Citymall')
  assert.equal(citymall.COUNTRY_FILTER, 'India')
  assert.equal(citymall.LISTING_URL, 'https://citymall.freshteam.com/jobs')
  assert.equal(citymall.DETAIL_URL_PATTERN, 'https://citymall.freshteam.com/jobs/{opaque_id}/{slug}')
  assert.equal(citymall.hasOfficialJobsBoardSignal(listingHtml), true)
  assert.equal(
    citymall.buildDetailUrl('wRX0jtUqbsww', 'backend-engineer-sde-iii-nodejs'),
    'https://citymall.freshteam.com/jobs/wRX0jtUqbsww/backend-engineer-sde-iii-nodejs',
  )
})

test('extractListingJobs parses the Citymall Freshteam board and preserves department, summary, and work type', async () => {
  const citymall = await loadCitymallModule()

  const listings = citymall.extractListingJobs(listingHtml)

  assert.equal(listings.length, 2)
  assert.deepEqual(listings[0], {
    title: 'Backend Engineer- SDE III NodeJS',
    summary: 'What problems will you be working on: • Architecture and development of mission critical systems that constitute the core of our operations • Brainstorming and chalking out solutio...',
    department: 'Engineering',
    detailUrl: 'https://citymall.freshteam.com/jobs/wRX0jtUqbsww/backend-engineer-sde-iii-nodejs',
    jobId: 'wRX0jtUqbsww',
    requisitionId: 'wRX0jtUqbsww',
    slug: 'backend-engineer-sde-iii-nodejs',
    locationText: 'Gurugram, Haryana',
    employmentType: 'Full Time',
    remoteFlag: 'false',
  })
  assert.equal(listings[1].title, 'Sr Data Engineer')
  assert.equal(listings[1].department, 'Engineering')
  assert.equal(listings[1].employmentType, 'Full Time')
})

test('extractJobDetail enriches each Citymall detail page and keeps the public detail page as the apply surface', async () => {
  const citymall = await loadCitymallModule()
  const listings = citymall.extractListingJobs(listingHtml)

  assert.deepEqual(
    citymall.extractJobDetail(backendEngineerDetailHtml, listings[0]),
    {
      title: 'Backend Engineer- SDE III NodeJS',
      company: 'Citymall',
      department: 'Engineering',
      location: 'Gurugram, Haryana, India',
      city: 'Gurugram',
      country: 'India',
      jobId: 'wRX0jtUqbsww',
      requisitionId: 'wRX0jtUqbsww',
      sourceUrl: 'https://citymall.freshteam.com/jobs/wRX0jtUqbsww/backend-engineer-sde-iii-nodejs',
      applyUrl: 'https://citymall.freshteam.com/jobs/wRX0jtUqbsww/backend-engineer-sde-iii-nodejs',
      employmentType: 'Full-time',
      experienceRequired: '2-4 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: [
        'What problems will you be working on:',
        'Architecture and development of mission critical systems that constitute the core of our operations',
        'Brainstorming and chalking out solutions to business requirements',
        'Implementing complex workflows',
        'Maintain code and write automated tests to ensure the product is of the highest quality',
        'Must have skills:',
        '2 years - 4yrs of experience working in a high growth startup building APIs and architecture that scales using NodeJS, Javascript',
        'Sound understanding of writing reliable, readable, and extensible software that would stand the test of time',
        'Strong core javascript skills',
      ].join(' '),
      remoteStatus: 'On-site',
    },
  )

  assert.deepEqual(
    citymall.extractJobDetail(srDataEngineerDetailHtml, listings[1]),
    {
      title: 'Sr Data Engineer',
      company: 'Citymall',
      department: 'Engineering',
      location: 'Gurugram, Haryana, India',
      city: 'Gurugram',
      country: 'India',
      jobId: '_zGvqXKOs_dF',
      requisitionId: '_zGvqXKOs_dF',
      sourceUrl: 'https://citymall.freshteam.com/jobs/_zGvqXKOs_dF/sr-data-engineer',
      applyUrl: 'https://citymall.freshteam.com/jobs/_zGvqXKOs_dF/sr-data-engineer',
      employmentType: 'Full-time',
      experienceRequired: '2+ years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: [
        'Roles and Responsibilities:',
        'Tests, monitors, manage and validate data warehouse activity including data extraction, transformation, movement, loading, cleansing, and updating processes',
        'Building and maintaining optimized and highly available data pipelines that facilitate deeper analysis and reporting',
        'Collaborate with stakeholders to understand, define and document business applications, data sources/relationships, and needs',
        'Skills Required:',
        'Proficient in languages: Python.',
        'Minimum 2+ years experience as Data Engineer',
        'Experience in AWS Stack - Glue, Athena, Quick sight, RDS, Redshift, Kafka',
      ].join(' '),
      remoteStatus: 'On-site',
    },
  )
})

test('run validates the Citymall Freshteam board, enriches only the selected detail pages, and decorates jobs', async () => {
  const citymall = await loadCitymallModule()
  const requestedUrls = []

  const jobs = await citymall.createCitymallScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === citymall.LISTING_URL) return listingHtml
      if (url === 'https://citymall.freshteam.com/jobs/wRX0jtUqbsww/backend-engineer-sde-iii-nodejs') {
        return backendEngineerDetailHtml
      }

      throw new Error(`Unexpected Citymall fixture URL: ${url}`)
    },
    now: () => '2026-07-14T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    citymall.LISTING_URL,
    'https://citymall.freshteam.com/jobs/wRX0jtUqbsww/backend-engineer-sde-iii-nodejs',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'citymall')
  assert.equal(jobs[0].company, 'Citymall')
  assert.equal(jobs[0].link, 'https://citymall.freshteam.com/jobs/wRX0jtUqbsww/backend-engineer-sde-iii-nodejs')
  assert.equal(jobs[0].scrapedAt, '2026-07-14T00:00:00.000Z')
})

test('Citymall scraper fails closed when the verified Freshteam board signature drifts', async () => {
  const citymall = await loadCitymallModule()

  await assert.rejects(
    citymall.createCitymallScraper().run({
      fetchText: async (url) => {
        if (url === citymall.LISTING_URL) {
          return listingHtml.replace('Careers - CityMall', 'Careers - Different Company')
        }

        throw new Error(`Unexpected Citymall fixture URL: ${url}`)
      },
    }),
    /verified public freshteam board/i,
  )
})
