import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Engineering Services &amp; Design |Neilsoft </title>
  </head>
  <body>
    <p>
      Neilsoft headquartered in Pune (India), is a 1400+ people global Engineering Services &amp; Solutions company.
    </p>
    <ul>
      <li><a href="/services" title="Services">Engineering Services</a></li>
      <li><a href="/careers" title="Careers">Careers</a></li>
    </ul>
  </body>
</html>
`

const CURRENT_HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Engineering Services &amp; Design |Neilsoft </title>
  </head>
  <body>
    <ul>
      <li><a href="/careers" title="Careers">Careers</a></li>
      <li><a href="/careers/why-neilsoft">Why Neilsoft</a></li>
      <li><a href="/careers/employee-testimonials">Employee Testimonials</a></li>
      <li><a href="/careers/current-job-openings-india">Current Job Openings-India</a></li>
      <li><a href="/careers/current-job-openings-india/designer-sr-designer">Designer / Sr. Designer</a></li>
    </ul>
  </body>
</html>
`

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title> Careers at Neilsoft | Explore Opportunities</title>
  </head>
  <body>
    <div class="careers-box1">
      <h2><a href="/careers/why-neilsoft"> Why Neilsoft ?</a></h2>
    </div>
    <div class="careers-box2">
      <h2><a href="/careers/employee-testimonials">Employee Testimonials</a></h2>
    </div>
    <div class="careers-box3">
      <h2><a href="/careers/current-job-openings-india">Current Job Openings-India</a></h2>
    </div>
  </body>
</html>
`

const INDIA_OPENINGS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Current Job Openings in India | Neilsoft Careers</title>
  </head>
  <body>
    <h1>Current job openings India</h1>
    <p>
      A list of our current job openings is provided below. If your experience matches our current requirements,
      please email us your detailed resume at careers@neilsoft.com.
    </p>
    <h2>Job Categories</h2>
    <p><strong>Buildings &amp; Infrastructure</strong></p>

    <div class="panel panel-default">
      <div class="panel-body">
        <div class="Currer ">
          <span class="pull-right vcenter">
            <a href="/careers/current-job-openings-india/product-specialist">
              <span class="glyphicon glyphicon-menu-right"></span>
            </a>
            <p></p>
          </span>
        </div>
        <strong><a href="/careers/current-job-openings-india/product-specialist">Product Specialist</a></strong>
        <br/>
        Mahape, Navi Mumbai - Job code:
        <a href="mailto:careers@neilsoft.com?Subject=Product Specialist code:Product-PD-052023-004">
          [Product-PD-052023-004]
        </a>
      </div>
    </div>

    <div class="panel panel-default">
      <div class="panel-body">
        <div class="Currer ">
          <span class="pull-right vcenter">
            <a href="/careers/current-job-openings-india/bim-product-specialist">
              <span class="glyphicon glyphicon-menu-right"></span>
            </a>
            <p></p>
          </span>
        </div>
        <strong><a href="/careers/current-job-openings-india/bim-product-specialist">BIM Product Specialist</a></strong>
        <br/>
        Mumbai - Job code:
        <a href="mailto:careers@neilsoft.com?Subject=BIM Product Specialist code:Product-0423-002">
          [Product-0423-002]
        </a>
      </div>
    </div>

    <p><strong>Software Engineering</strong></p>

    <div class="panel panel-default">
      <div class="panel-body">
        <div class="Currer ">
          <span class="pull-right vcenter">
            <a href="/careers/current-job-openings-india/cad-software-engineer">
              <span class="glyphicon glyphicon-menu-right"></span>
            </a>
            <p></p>
          </span>
        </div>
        <strong><a href="/careers/current-job-openings-india/cad-software-engineer">CAD Software Engineer</a></strong>
        <br/>
        Pune - Job code:
        <a href="mailto:careers@neilsoft.com?Subject=CAD Software Engineer code:SES-0123-001">
          [SES-0123-001]
        </a>
      </div>
    </div>

    <h2>Share the page</h2>
  </body>
</html>
`

const PRODUCT_SPECIALIST_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <meta property="og:title" content="Product Specialist"/>
  </head>
  <body>
    <h1>Product Specialist</h1>
    <p><strong>Job Code:</strong> PD-052023-004</p>
    <p><strong>Location:</strong> Mahape, Navi Mumbai</p>
    <p><strong>Position:</strong> Product Specialist</p>
    <p>
      <strong>Qualification:</strong> B.E. (Electrical)
    </p>
    <p><strong>Responsibilities:</strong></p>
    <ul>
      <li>Experience in product sales, market, and pre-sales activities for clients.</li>
      <li>Be part of the product development team and understand functionality.</li>
    </ul>
    <p><strong>Required Skills/Abilities:</strong></p>
    <ul>
      <li>7-12 years of experience dealing with electrical design software products.</li>
      <li>Involved in electrical design software product implementation.</li>
      <li>Strong client communication skills are required</li>
    </ul>
    <p>
      Please send your resume to
      <a href="mailto:careers@neilsoft.com">careers@neilsoft.com</a>.
    </p>
  </body>
</html>
`

const BIM_PRODUCT_SPECIALIST_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <meta property="og:title" content="BIM Product Specialist"/>
  </head>
  <body>
    <h1>BIM Product Specialist</h1>
    <p>
      <strong>Qualification:</strong> B.E. Civil
    </p>
    <p><strong>Responsibilities:</strong></p>
    <ul>
      <li>Support BIM product implementations for client programs.</li>
    </ul>
    <p><strong>Required Skills/Abilities:</strong></p>
    <ul>
      <li>Candidate should have 3 to 6 years of experience</li>
      <li>Strong BIM product knowledge is required</li>
    </ul>
    <p>
      Please send your resume to
      <a href="mailto:careers@neilsoft.com">careers@neilsoft.com</a>.
    </p>
  </body>
</html>
`

const CAD_SOFTWARE_ENGINEER_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <meta property="og:title" content="CAD Software Engineer"/>
  </head>
  <body>
    <h1>CAD Software Engineer</h1>
    <p><strong>Experience:</strong> 3 - 6 years</p>
    <p>
      <strong>Qualification:</strong> B.E. / B.Tech (Mechanical / Production)
    </p>
    <p><strong>Required Skills &amp; Experience:</strong></p>
    <ul>
      <li>Must have strong C++, CAD customization, and debugging skills
      <li>Knowledge of Creo or similar CAD platforms will be preferred
    </ul>
    <p>
      Please send your resume to
      <a href="mailto:careers@neilsoft.com">careers@neilsoft.com</a>.
    </p>
  </body>
</html>
`

const SALES_EXECUTIVE_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Sales Executive Jobs in India | Neilsoft Careers</title>
    <meta property="og:title" content="Sales Executive"/>
  </head>
  <body>
    <ul class="breadcrumb">
      <li><a href="/careers/current-job-openings-india">Current Job Openings-India</a></li>
    </ul>
    <h1>Sales Executive</h1>
    <div itemprop="articleBody">
      <p><strong>Job Code:</strong> Engineering solutions - Sales Executive</p>
      <p><strong>Location:</strong> Bangalore</p>
      <p><strong>Position:</strong> Sales Executive</p>
      <p><strong>Qualification:</strong> B.E. / B.Tech</p>
      <p><strong>Experience:</strong> 1 to 5 years</p>
      <p><strong>Duties &amp; Responsibilities:</strong></p>
      <ul class="listStyle">
        <li>Promote and sell a range of engineering software products.</li>
        <li>Collaborate with support staff to enhance personal effectiveness.</li>
      </ul>
      <p>Interested candidates please share resume on <a href="mailto:job_products@neilsoft.com">job_products@neilsoft.com</a></p>
      <h2>Share the page</h2>
    </div>
  </body>
</html>
`

const loadNeilsoftModule = async () => {
  try {
    return await import('../../scraper/neilsoft/script.js')
  } catch {
    assert.fail('Expected Neilsoft scraper module at ../../scraper/neilsoft/script.js')
  }
}

test('Neilsoft validators accept the Monday, August 3, 2026 panel-wrapped India openings surface', async () => {
  const neilsoft = await loadNeilsoftModule()

  assert.equal(neilsoft.SOURCE, 'neilsoft')
  assert.equal(neilsoft.COMPANY, 'Neilsoft Ltd')
  assert.equal(neilsoft.HOMEPAGE_URL, 'https://neilsoft.com/')
  assert.equal(neilsoft.CAREERS_URL, 'https://neilsoft.com/careers')
  assert.equal(neilsoft.INDIA_OPENINGS_URL, 'https://neilsoft.com/careers/current-job-openings-india')
  assert.equal(neilsoft.APPLICATION_EMAIL, 'careers@neilsoft.com')
  assert.equal(neilsoft.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(neilsoft.hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.equal(neilsoft.hasOfficialIndiaOpeningsSignal(INDIA_OPENINGS_HTML), true)
  assert.equal(neilsoft.hasOfficialJobDetailSignal(PRODUCT_SPECIALIST_DETAIL_HTML, 'Product Specialist'), true)
})

test('Neilsoft accepts the current homepage careers module on Friday, August 7, 2026', async () => {
  const neilsoft = await loadNeilsoftModule()

  assert.equal(neilsoft.hasOfficialHomepageSignal(CURRENT_HOMEPAGE_HTML), true)
})

test('Neilsoft extracts jobs from department paragraphs and nested panel cards', async () => {
  const neilsoft = await loadNeilsoftModule()

  assert.deepEqual(neilsoft.extractJobsFromIndiaOpeningsPage(INDIA_OPENINGS_HTML), [
    {
      title: 'Product Specialist',
      company: 'Neilsoft Ltd',
      department: 'Buildings & Infrastructure',
      location: 'Mahape, Navi Mumbai, India',
      city: 'Mahape',
      country: 'India',
      jobId: 'Product-PD-052023-004',
      requisitionId: 'Product-PD-052023-004',
      sourceUrl: 'https://neilsoft.com/careers/current-job-openings-india/product-specialist',
      applyUrl: 'mailto:careers@neilsoft.com?Subject=Product Specialist code:Product-PD-052023-004',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
    {
      title: 'BIM Product Specialist',
      company: 'Neilsoft Ltd',
      department: 'Buildings & Infrastructure',
      location: 'Mumbai, India',
      city: 'Mumbai',
      country: 'India',
      jobId: 'Product-0423-002',
      requisitionId: 'Product-0423-002',
      sourceUrl: 'https://neilsoft.com/careers/current-job-openings-india/bim-product-specialist',
      applyUrl: 'mailto:careers@neilsoft.com?Subject=BIM Product Specialist code:Product-0423-002',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
    {
      title: 'CAD Software Engineer',
      company: 'Neilsoft Ltd',
      department: 'Software Engineering',
      location: 'Pune, India',
      city: 'Pune',
      country: 'India',
      jobId: 'SES-0123-001',
      requisitionId: 'SES-0123-001',
      sourceUrl: 'https://neilsoft.com/careers/current-job-openings-india/cad-software-engineer',
      applyUrl: 'mailto:careers@neilsoft.com?Subject=CAD Software Engineer code:SES-0123-001',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
  ])
})

test('Neilsoft run enriches panel-wrapped openings with detail-page fields', async () => {
  const neilsoft = await loadNeilsoftModule()
  const requestedUrls = []

  const jobs = await neilsoft.createNeilsoftScraper({
    now: () => '2026-08-03T08:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === neilsoft.HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === neilsoft.CAREERS_URL) return CAREERS_HTML
      if (url === neilsoft.INDIA_OPENINGS_URL) return INDIA_OPENINGS_HTML
      if (url === 'https://neilsoft.com/careers/current-job-openings-india/product-specialist') {
        return PRODUCT_SPECIALIST_DETAIL_HTML
      }
      if (url === 'https://neilsoft.com/careers/current-job-openings-india/bim-product-specialist') {
        return BIM_PRODUCT_SPECIALIST_DETAIL_HTML
      }
      if (url === 'https://neilsoft.com/careers/current-job-openings-india/cad-software-engineer') {
        return CAD_SOFTWARE_ENGINEER_DETAIL_HTML
      }

      throw new Error(`Unexpected Neilsoft URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    neilsoft.HOMEPAGE_URL,
    neilsoft.CAREERS_URL,
    neilsoft.INDIA_OPENINGS_URL,
    'https://neilsoft.com/careers/current-job-openings-india/product-specialist',
    'https://neilsoft.com/careers/current-job-openings-india/bim-product-specialist',
    'https://neilsoft.com/careers/current-job-openings-india/cad-software-engineer',
  ])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].minimumQualification, 'B.E. (Electrical)')
  assert.equal(jobs[0].experienceRequired, '7-12 years')
  assert.deepEqual(jobs[0].requiredSkills, [
    'Experience in product sales, market, and pre-sales activities for clients.',
    'Be part of the product development team and understand functionality.',
    'Involved in electrical design software product implementation.',
    'Strong client communication skills are required',
  ])
  assert.equal(jobs[0].scrapedAt, '2026-08-03T08:00:00.000Z')
  assert.equal(jobs[2].link, 'https://neilsoft.com/careers/current-job-openings-india/cad-software-engineer')
  assert.equal(jobs[2].experienceRequired, '3 - 6 years')
  assert.deepEqual(jobs[2].requiredSkills, [
    'Must have strong C++, CAD customization, and debugging skills',
    'Knowledge of Creo or similar CAD platforms will be preferred',
  ])
})

test('Neilsoft accepts first-party product-sales detail pages that use the job_products mailbox', async () => {
  const neilsoft = await loadNeilsoftModule()

  assert.equal(neilsoft.hasOfficialJobDetailSignal(SALES_EXECUTIVE_DETAIL_HTML, 'Sales Executive'), true)
  assert.deepEqual(
    neilsoft.extractJobDetail(
      SALES_EXECUTIVE_DETAIL_HTML,
      'https://neilsoft.com/careers/current-job-openings-india/sales-executive',
    ),
    {
      title: 'Sales Executive',
      minimumQualification: 'B.E. / B.Tech',
      experienceRequired: '1 to 5 years',
      preferredQualification: null,
      requiredSkills: [
        'Promote and sell a range of engineering software products.',
        'Collaborate with support staff to enhance personal effectiveness.',
      ],
      jobDescription:
        'Qualification: B.E. / B.Tech Experience: 1 to 5 years Promote and sell a range of engineering software products. Collaborate with support staff to enhance personal effectiveness.',
      applyUrl: 'mailto:job_products@neilsoft.com',
      sourceUrl: 'https://neilsoft.com/careers/current-job-openings-india/sales-executive',
    },
  )
})

test('Neilsoft fails closed when the verified India openings surface changes materially', async () => {
  const neilsoft = await loadNeilsoftModule()

  await assert.rejects(
    neilsoft.createNeilsoftScraper().run({
      fetchText: async (url) => {
        if (url === neilsoft.HOMEPAGE_URL) return HOMEPAGE_HTML
        if (url === neilsoft.CAREERS_URL) return CAREERS_HTML
        return '<html><body><h1>Jobs</h1></body></html>'
      },
    }),
    /Neilsoft official India openings page changed/i,
  )
})
