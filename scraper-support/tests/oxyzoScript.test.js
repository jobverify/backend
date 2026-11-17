import assert from 'node:assert/strict'
import test from 'node:test'


const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Work at Oxyzo - Shape the Future of Fintech</title>
  </head>
  <body>
    <main>
      <h1>Careers @ Oxyzo</h1>
      <p>Explore Roles</p>
      <a href="https://www.oxyzocareers.in/categories">Explore Roles</a>
      <p>career@oxyzo.in</p>
    </main>
  </body>
</html>
`

const LISTING_PAGE_1_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h3>Area Sales Manager - SME Lending</h3>
    <p>Business Development</p>
    <p>Full-Time</p>
    <p>3-8 Yrs</p>
    <p>Gurugram</p>
    <p>Posting:</p>
    <p>11 Jun 2026</p>
    <a href="https://www.oxyzocareers.in/jobs/area-sales-manager---sme-lending">View Details</a>

    <h3>Business Development Manager</h3>
    <p>Business Development</p>
    <p>Full-Time</p>
    <p>1-4</p>
    <p>Mumbai</p>
    <p>Posting:</p>
    <p>8 May 2026</p>
    <a href="https://www.oxyzocareers.in/jobs/business-development-manager">View Details</a>
  </body>
</html>
`

const AREA_SALES_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h2>Area Sales Manager - SME Lending</h2>
    <h2>Business Development</h2>
    <p>Full-Time</p>
    <p>3-8 Yrs</p>
    <p>Gurugram</p>
    <h6>Job ID:</h6>
    <h6>AS1213</h6>
    <h2>About the Business</h2>
    <p>OXYZO Financial Services Ltd. is a Leading Fintech NBFC headquartered in Gurugram.</p>
    <h2>What you will do.</h2>
    <p>Actively sourcing and acquiring SME and Mid Corporate clients.</p>
    <h2>What we are looking for.</h2>
    <p>Strong interest in working with SMEs & Emerging Corporates.</p>
    <h2>What we are offering.</h2>
    <p>Competitive Pay & Benefits.</p>
    <h5>Application Form</h5>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/oxyzo/script.js')
  } catch {
    assert.fail('Expected Oxyzo scraper module at ../../scraper/oxyzo/script.js')
  }
}

test('Oxyzo current catalog target remains separate from dated pure listing and detail helpers', async () => {
  const oxyzo = await loadModule()

  assert.equal(oxyzo.HOMEPAGE_URL, 'https://www.oxyzocareers.in/')
  assert.equal(oxyzo.CAREERS_PAGE_URL, 'https://www.oxyzocareers.in/')
  assert.equal(oxyzo.JOB_PAGE_PREFIX, 'https://www.oxyzocareers.in/jobs/')
  assert.equal(oxyzo.PAGINATION_QUERY_PARAM, 'comp-lyh6vd88_page')
  assert.equal(oxyzo.buildCategoriesPageUrl(1), 'https://www.oxyzocareers.in/')
  assert.equal(
    oxyzo.buildCategoriesPageUrl(2),
    'https://www.oxyzocareers.in/?comp-lyh6vd88_page=2',
  )
  assert.equal(oxyzo.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.deepEqual(
    oxyzo.extractJobDetailUrls(LISTING_PAGE_1_HTML),
    [
      'https://www.oxyzocareers.in/jobs/area-sales-manager---sme-lending',
      'https://www.oxyzocareers.in/jobs/business-development-manager',
    ],
  )
})

test('Oxyzo retains historical source detail without inferring India from a bare city', async () => {
  const oxyzo = await loadModule()

  const job = oxyzo.extractJobFromDetailPage(
    AREA_SALES_DETAIL_HTML,
    'https://www.oxyzocareers.in/jobs/area-sales-manager---sme-lending',
  )

  assert.deepEqual(job, {
    title: 'Area Sales Manager - SME Lending',
    company: 'Oxyzo',
    department: 'Business Development',
    location: 'Gurugram',
    city: null,
    country: null,
    jobId: 'AS1213',
    requisitionId: 'AS1213',
    sourceUrl: 'https://www.oxyzocareers.in/jobs/area-sales-manager---sme-lending',
    applyUrl: 'https://www.oxyzocareers.in/jobs/area-sales-manager---sme-lending',
    employmentType: 'Full-Time',
    experienceRequired: '3-8 Yrs',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: [
      'About the Business',
      'OXYZO Financial Services Ltd. is a Leading Fintech NBFC headquartered in Gurugram.',
      'What you will do.',
      'Actively sourcing and acquiring SME and Mid Corporate clients.',
      'What we are looking for.',
      'Strong interest in working with SMEs & Emerging Corporates.',
      'What we are offering.',
      'Competitive Pay & Benefits.',
    ].join('\n'),
  })
})


test('Oxyzo body-only historical city/detail fixtures cannot enter current publication',async()=>{
 const oxyzo=await loadModule();let calls=0;await assert.rejects(oxyzo.run({fetchText:async()=>{calls++;return HOMEPAGE_HTML},wait:async()=>{}}),/metadata|unsupported/);assert.equal(calls,0)
})
test('Oxyzo current configured corporate transport failure remains exact with no guessed fallback',async()=>{
 const oxyzo=await loadModule(),reason=Object.assign(new Error('fetch failed'),{cause:{code:'ECONNRESET'}});let calls=0;await assert.rejects(oxyzo.run({requestIntervalMs:0,fetchImpl:async()=>{calls++;throw reason}}),error=>error===reason);assert.equal(calls,1)
})
