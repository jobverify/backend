import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Travel Tech Jobs & Careers at Infiniti Software Solutions</title>
  </head>
  <body>
    <h1>Dream Bold. Fly Higher. With Infiniti.</h1>
    <h2 class="elementor-heading-title elementor-size-default">Explore Job Opportunities</h2>
    <div class="elementor-element elementor-element-1ed8fbe e-con-full e-flex e-con e-child">
      <div class="elementor-widget elementor-widget-heading">
        <div class="elementor-widget-container">
          <h2 class="elementor-heading-title elementor-size-default">Customer Success Manager</h2>
        </div>
      </div>
      <div class="elementor-element elementor-widget elementor-widget-text-editor">
        <div class="elementor-widget-container">
          <p>Build long-term customer relationships by driving product adoption, ensuring client success, identifying growth opportunities, and delivering exceptional experiences that create lasting business value.</p>
        </div>
      </div>
      <div class="elementor-icon-box-title"><span>10+ Years</span></div>
      <div class="elementor-icon-box-title"><span>Chennai</span></div>
      <div class="elementor-button-wrapper">
        <a class="elementor-button elementor-button-link elementor-size-sm" href="https://app.goodfit.so/apply/CUSTOMER-SUCCESS">Apply</a>
      </div>
    </div>
    <div class="elementor-element elementor-element-622041d e-con-full e-flex e-con e-child">
      <div class="elementor-widget elementor-widget-heading">
        <div class="elementor-widget-container">
          <h2 class="elementor-heading-title elementor-size-default">Security Compliance Lead</h2>
        </div>
      </div>
      <div class="elementor-element elementor-widget elementor-widget-text-editor">
        <div class="elementor-widget-container">
          <div>
            <div>Responsible for managing the organizationâ€™s security, risk, and compliance programs, ensuring adherence to standards like SOC 2, ISO 27001, PCI DSS, and GDPR.</div>
          </div>
        </div>
      </div>
      <div class="elementor-icon-box-title"><span>1 - 3 Years</span></div>
      <div class="elementor-icon-box-title"><span>Chennai</span></div>
      <div class="elementor-button-wrapper">
        <a class="elementor-button elementor-button-link elementor-size-sm" href="https://app.goodfit.so/apply/SECURITY-COMPLIANCE">Apply</a>
      </div>
    </div>
    <div class="elementor-element elementor-element-87f879c e-con-full e-flex e-con e-child">
      <div class="elementor-widget elementor-widget-heading">
        <div class="elementor-widget-container">
          <h2 class="elementor-heading-title elementor-size-default">Sales Executive</h2>
        </div>
      </div>
      <div class="elementor-element elementor-widget elementor-widget-text-editor">
        <div class="elementor-widget-container">
          Drive business growth by building strong client relationships, identifying new opportunities, and delivering impactful SaaS solutions through consultative selling and strategic engagement.
        </div>
      </div>
      <div class="elementor-icon-box-title"><span>3 - 6 Years</span></div>
      <div class="elementor-icon-box-title"><span>Mumbai</span></div>
      <div class="elementor-button-wrapper">
        <a class="elementor-button elementor-button-link elementor-size-sm" href="https://v2.app.goodfit.so/jobs/infiniti-solutions/Sales-Executive?id=019e25b9-c372-7634-a220-babd2373919c">Apply</a>
      </div>
    </div>
    <div class="elementor-element elementor-element-foreign e-con-full e-flex e-con e-child">
      <div class="elementor-widget elementor-widget-heading">
        <div class="elementor-widget-container">
          <h2 class="elementor-heading-title elementor-size-default">London Partnerships Lead</h2>
        </div>
      </div>
      <div class="elementor-element elementor-widget elementor-widget-text-editor">
        <div class="elementor-widget-container">
          <p>Grow our UK travel partnerships.</p>
        </div>
      </div>
      <div class="elementor-icon-box-title"><span>8+ Years</span></div>
      <div class="elementor-icon-box-title"><span>London</span></div>
      <div class="elementor-button-wrapper">
        <a class="elementor-button elementor-button-link elementor-size-sm" href="https://app.goodfit.so/apply/LONDON-PARTNERSHIPS">Apply</a>
      </div>
    </div>
    <h2 class="elementor-heading-title elementor-size-default">Life at Infiniti</h2>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/infinitisoftwaresolutions/script.js')
  } catch {
    assert.fail('Expected Infiniti Software Solutions scraper module at ../../scraper/infinitisoftwaresolutions/script.js')
  }
}

test('Infiniti Software Solutions helpers stay pinned to the verified first-party careers page and Goodfit apply links', async () => {
  const infiniti = await loadModule()

  assert.equal(infiniti.SOURCE, 'infinitisoftwaresolutions')
  assert.equal(infiniti.COMPANY, 'Infiniti Software Solutions')
  assert.equal(infiniti.CAREERS_URL, 'https://www.infinitisoftware.net/careers/')
  assert.equal(infiniti.VERIFIED_ON, '2026-07-17')
  assert.equal(infiniti.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(infiniti.hasOfficialCareersSignal('<html><body><h1>Explore Job Opportunities</h1></body></html>'), false)
  assert.deepEqual(infiniti.extractJobs(careersHtml), [
    {
      title: 'Customer Success Manager',
      company: 'Infiniti Software Solutions',
      department: null,
      location: 'Chennai, India',
      city: 'Chennai',
      country: 'India',
      jobId: 'CUSTOMER-SUCCESS',
      requisitionId: 'CUSTOMER-SUCCESS',
      sourceUrl: 'https://app.goodfit.so/apply/CUSTOMER-SUCCESS',
      applyUrl: 'https://app.goodfit.so/apply/CUSTOMER-SUCCESS',
      employmentType: null,
      experienceRequired: '10+ Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription:
        'Build long-term customer relationships by driving product adoption, ensuring client success, identifying growth opportunities, and delivering exceptional experiences that create lasting business value.',
      remoteStatus: 'On-site',
    },
    {
      title: 'Security Compliance Lead',
      company: 'Infiniti Software Solutions',
      department: null,
      location: 'Chennai, India',
      city: 'Chennai',
      country: 'India',
      jobId: 'SECURITY-COMPLIANCE',
      requisitionId: 'SECURITY-COMPLIANCE',
      sourceUrl: 'https://app.goodfit.so/apply/SECURITY-COMPLIANCE',
      applyUrl: 'https://app.goodfit.so/apply/SECURITY-COMPLIANCE',
      employmentType: null,
      experienceRequired: '1 - 3 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription:
        'Responsible for managing the organizationâ€™s security, risk, and compliance programs, ensuring adherence to standards like SOC 2, ISO 27001, PCI DSS, and GDPR.',
      remoteStatus: 'On-site',
    },
    {
      title: 'Sales Executive',
      company: 'Infiniti Software Solutions',
      department: null,
      location: 'Mumbai, India',
      city: 'Mumbai',
      country: 'India',
      jobId: 'Sales-Executive',
      requisitionId: 'Sales-Executive',
      sourceUrl: 'https://v2.app.goodfit.so/jobs/infiniti-solutions/Sales-Executive?id=019e25b9-c372-7634-a220-babd2373919c',
      applyUrl: 'https://v2.app.goodfit.so/jobs/infiniti-solutions/Sales-Executive?id=019e25b9-c372-7634-a220-babd2373919c',
      employmentType: null,
      experienceRequired: '3 - 6 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription:
        'Drive business growth by building strong client relationships, identifying new opportunities, and delivering impactful SaaS solutions through consultative selling and strategic engagement.',
      remoteStatus: 'On-site',
    },
  ])
})

test('Infiniti Software Solutions run validates the verified careers page before decorating extracted jobs', async () => {
  const infiniti = await loadModule()
  const requestedUrls = []

  const jobs = await infiniti.createInfinitiSoftwareSolutionsScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === infiniti.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected Infiniti URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [infiniti.CAREERS_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'infinitisoftwaresolutions')
  assert.equal(jobs[0].link, 'https://app.goodfit.so/apply/CUSTOMER-SUCCESS')
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('Infiniti Software Solutions run fails closed when the verified careers surface drifts', async () => {
  const infiniti = await loadModule()

  await assert.rejects(
    infiniti.createInfinitiSoftwareSolutionsScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified infiniti software solutions careers surface/i,
  )
})
