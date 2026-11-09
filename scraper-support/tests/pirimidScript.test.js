import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'

const verifiedCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Pirimid Fintech</title>
  </head>
  <body>
    <h1>Interested? We're Hiring</h1>
    <div id="openPositions" class="section open-positions right-triangle vertical-divider">
      <h2>Open Positions</h2>
      <p>Join our team to work hard, make a difference and succeed in a fast-paced environment.</p>
      <div class="panel-group pmd-accordion" id="accordion" role="tablist" aria-multiselectable="true">
        <div class="panel panel-default">
          <div class="panel-heading" role="tab" id="job-opening1">
            <h4 class="panel-title">
              <a href="#opening-1">
                <span class="pmd-card-title-text">Director of Sales</span><br />
                <span class="pmd-card-subtitle-text">Ahmedabad [Hybrid]</span>
              </a>
            </h4>
          </div>
          <div id="opening-1" class="panel-collapse collapse" role="tabpanel" aria-labelledby="job-opening1">
            <div class="panel-body">
              <h5 class="panel-subtitle">No. of Openings: <span>1</span></h5>
              <p><strong><b>Reporting To:</b></strong> Founder / CEO</p>
              <p><strong><b>About the Company</b></strong></p>
              <p>Pirimid FinTech is a service-based technology company specializing in the financial services domain.</p>
              <p><strong><b>About the Role</b></strong></p>
              <p>We are seeking a <strong><b>Director of Sales</b></strong> to own and scale Pirimid Fintech's global revenue function.</p>
              <p><strong><b>Requirements – Must Have</b></strong></p>
              <ul>
                <li>6+ years of B2B sales experience in IT services or software outsourcing.</li>
                <li>Strong background selling to international fintech clients.</li>
              </ul>
            </div>
            <div class="apply-section">
              <a href="#apply-form-1" data-toggle="modal" class="btn mt-16 btn-primary pmd-btn-raised pmd-ripple-effect">Apply Now</a>
            </div>
            <div class="dynamic-modal-content-1">
              <h2 class="pmd-card-title-text"><span>Apply for</span><br /><strong>Director of Sales</strong></h2>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="container">
      <h3><a href="mailto:careers@pirimidtech.com">careers@pirimidtech.com</a></h3>
    </div>
  </body>
</html>
`

const emptyOpenPositionsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Pirimid Fintech</title>
  </head>
  <body>
    <h1>Interested? We're Hiring</h1>
    <div id="openPositions" class="section open-positions right-triangle vertical-divider">
      <h2>Open Positions</h2>
      <p>Join our team to work hard, make a difference and succeed in a fast-paced environment.</p>
      <p>Don't see what you're looking for? Send an email introducing yourself and we'll be in touch.</p>
    </div>
    <div class="container">
      <h3><a href="mailto:careers@pirimidtech.com">careers@pirimidtech.com</a></h3>
    </div>
  </body>
</html>
`

const loadPirimidModule = async () => {
  try {
    return await import('../../scraper/pirimid/script.js')
  } catch {
    assert.fail('Expected Pirimid scraper module at ../../scraper/pirimid/script.js')
  }
}

test('Pirimid scraper pins the verified first-party open positions section and same-page apply anchor contract', async () => {
  const pirimid = await loadPirimidModule()

  assert.equal(pirimid.SOURCE, 'pirimid')
  assert.equal(pirimid.COMPANY, 'Pirimid')
  assert.equal(pirimid.OFFICIAL_BRAND_NAME, 'Pirimid Fintech')
  assert.equal(pirimid.CAREERS_URL, 'https://pirimidtech.com/careers/')
  assert.equal(pirimid.CAREERS_EMAIL, 'careers@pirimidtech.com')
  assert.equal(pirimid.CAREERS_MAILTO_URL, 'mailto:careers@pirimidtech.com')
  assert.equal(pirimid.VERIFIED_ON, '2026-07-17')
  assert.equal(pirimid.hasOfficialPirimidCareersSignal(verifiedCareersHtml), true)
  assert.deepEqual(pirimid.extractListings(verifiedCareersHtml), [
    {
      title: 'Director of Sales',
      locationLabel: 'Ahmedabad [Hybrid]',
      location: 'Ahmedabad, India',
      city: 'Ahmedabad',
      country: 'India',
      openingsCount: 1,
      sourceUrl: 'https://pirimidtech.com/careers/#openPositions',
      applyUrl: 'https://pirimidtech.com/careers/#apply-form-1',
      jobId: 'director-of-sales',
      requisitionId: 'director-of-sales',
      jobDescription:
        "No. of Openings: 1 Reporting To: Founder / CEO About the Company Pirimid FinTech is a service-based technology company specializing in the financial services domain. About the Role We are seeking a Director of Sales to own and scale Pirimid Fintech's global revenue function. Requirements - Must Have 6+ years of B2B sales experience in IT services or software outsourcing. Strong background selling to international fintech clients.",
      requiredSkills: [
        '6+ years of B2B sales experience in IT services or software outsourcing.',
        'Strong background selling to international fintech clients.',
      ],
      remoteStatus: 'Hybrid',
    },
  ])
})

test('Pirimid run returns the live first-party inline role from the verified careers surface', async () => {
  const pirimid = await loadPirimidModule()
  const requestedUrls = []

  const jobs = await pirimid.createPirimidScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === pirimid.CAREERS_URL) return verifiedCareersHtml
      throw new Error(`Unexpected Pirimid URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [pirimid.CAREERS_URL])
  assert.deepEqual(jobs, [
    {
      title: 'Director of Sales',
      company: 'Pirimid',
      department: null,
      location: 'Ahmedabad, India',
      city: 'Ahmedabad',
      country: 'India',
      jobId: 'director-of-sales',
      requisitionId: 'director-of-sales',
      sourceUrl: 'https://pirimidtech.com/careers/#openPositions',
      applyUrl: 'https://pirimidtech.com/careers/#apply-form-1',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [
        '6+ years of B2B sales experience in IT services or software outsourcing.',
        'Strong background selling to international fintech clients.',
      ],
      postingDate: null,
      closingDate: null,
      jobDescription:
        "No. of Openings: 1 Reporting To: Founder / CEO About the Company Pirimid FinTech is a service-based technology company specializing in the financial services domain. About the Role We are seeking a Director of Sales to own and scale Pirimid Fintech's global revenue function. Requirements - Must Have 6+ years of B2B sales experience in IT services or software outsourcing. Strong background selling to international fintech clients.",
      remoteStatus: 'Hybrid',
      source: 'pirimid',
      link: 'https://pirimidtech.com/careers/#apply-form-1',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('Pirimid returns [] for a verified empty open-positions section and fails closed when the trusted careers shell drifts', async () => {
  const pirimid = await loadPirimidModule()

  const jobs = await pirimid.createPirimidScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async () => emptyOpenPositionsHtml,
  })

  assert.deepEqual(jobs, [])

  await assert.rejects(
    pirimid.createPirimidScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified Pirimid careers page no longer matches the trusted first-party surface/i,
  )
})
