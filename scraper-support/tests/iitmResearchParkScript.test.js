import assert from 'node:assert/strict'
import test from 'node:test'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers Page | IIT Madras Research Park</title>
  </head>
  <body>
    <section>
      <h2>Launch your future with our open roles</h2>
      <div class="career-card">
        <h4>Electrical Engineer &ndash; Maintenance &amp; Projects (3 Positions)</h4>
        <div class="mb-3">
          <span class="badge-custom">Facilities</span>
          <span class="badge-custom">Electrical</span>
        </div>
        <span class="experience-years fw-medium">5 - 10 Years</span>
        <p class="job-description">Experienced Electrical Engineer with expertise in MEP maintenance.</p>
        <p>Valid till: July 09, 2026</p>
        <a href="https://iitmadras4-my.sharepoint.com/example">View / Apply Job</a>
      </div>
      <div class="career-card">
        <h4>Project Manager - Zoho Implementation</h4>
        <div class="mb-3">
          <span class="badge-custom">Zoho Manager</span>
          <span class="badge-custom">IT</span>
        </div>
        <span class="experience-years fw-medium">6 - 10 Years</span>
        <p class="job-description">Responsible for administering and optimizing Zoho applications.</p>
        <p>Valid till: July 15, 2026</p>
        <a href="https://respark.iitm.ac.in/img/carrer/Project-Manager-Zoho-implementation.doc">View / Apply Job</a>
      </div>
      <div class="career-card">
        <h4>Construction Manager - Civil</h4>
        <div class="mb-3">
          <span class="badge-custom">Civil</span>
          <span class="badge-custom">Construction</span>
        </div>
        <span class="experience-years fw-medium">12 - 18 Years</span>
        <p class="job-description">Manage site activities and contractor performance for a precast project.</p>
        <p>Valid till: July 15, 2026</p>
        <a href="https://respark.iitm.ac.in/img/carrer/Manager-civil.docx">View / Apply Job</a>
      </div>
      <div class="career-card">
        <h4>Senior Manager &ndash; Legal</h4>
        <div class="mb-3">
          <span class="badge-custom">Management</span>
          <span class="badge-custom">Regulatory Compliance</span>
        </div>
        <span class="experience-years fw-medium">15 Years</span>
        <p class="job-description">Manage legal, contractual, regulatory, compliance, governance, and liaison functions.</p>
        <p>Valid till: August 15, 2026</p>
        <a href="https://respark.iitm.ac.in/img/carrer/JD-Legal.docx">View / Apply Job</a>
      </div>
      <div class="career-card">
        <h4>Executive - Research Collaboration</h4>
        <div class="mb-3">
          <span class="badge-custom">Research</span>
          <span class="badge-custom">Industry-Academia</span>
        </div>
        <span class="experience-years fw-medium">2 - 4 Years</span>
        <p class="job-description">Coordinate with industry partners, startups, and researchers.</p>
        <p>Valid till: July 31, 2026</p>
        <a href="https://respark.iitm.ac.in/img/carrer/ExecutiveResearchCollaboration.docx">View / Apply Job</a>
      </div>
    </section>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/iitmresearchpark/script.js')
  } catch {
    assert.fail('Expected IITM Research Park scraper module at ../../scraper/iitmresearchpark/script.js')
  }
}

test('IITM Research Park pins the verified official careers page and extracts the observed job cards', async () => {
  const iitmResearchPark = await loadModule()

  assert.equal(iitmResearchPark.SOURCE, 'iitmresearchpark')
  assert.equal(iitmResearchPark.COMPANY_NAME, 'IITM Research Park')
  assert.equal(iitmResearchPark.CAREERS_URL, 'https://respark.iitm.ac.in/careers/')
  assert.equal(iitmResearchPark.VERIFIED_ON, '2026-08-02')
  assert.equal(iitmResearchPark.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.deepEqual(iitmResearchPark.extractObservedJobTitles(officialCareersHtml), [
    'Electrical Engineer - Maintenance & Projects (3 Positions)',
    'Project Manager - Zoho Implementation',
    'Construction Manager - Civil',
    'Senior Manager - Legal',
    'Executive - Research Collaboration',
  ])
  assert.deepEqual(iitmResearchPark.extractValidTillDates(officialCareersHtml), [
    '2026-07-09',
    '2026-07-15',
    '2026-07-15',
    '2026-08-15',
    '2026-07-31',
  ])
  assert.equal(iitmResearchPark.hasLivePublicListings(officialCareersHtml), true)
  assert.equal(iitmResearchPark.matchesVerifiedExpiredSnapshot(officialCareersHtml), true)
})

test('IITM Research Park returns only the still-live cards from the verified careers page', async () => {
  const iitmResearchPark = await loadModule()
  const requestedUrls = []

  const jobs = await iitmResearchPark.createIITMResearchParkScraper().run({
    now: () => '2026-08-02T00:00:00.000Z',
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === iitmResearchPark.CAREERS_URL) return officialCareersHtml
      throw new Error(`Unexpected IITM Research Park text URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [iitmResearchPark.CAREERS_URL])
  assert.deepEqual(jobs, [
    {
      jobId: 'senior-manager-legal',
      requisitionId: 'senior-manager-legal',
      title: 'Senior Manager - Legal',
      company: 'IITM Research Park',
      businessUnit: null,
      department: 'Management | Regulatory Compliance',
      location: null,
      city: null,
      country: 'India',
      link: 'https://respark.iitm.ac.in/img/carrer/JD-Legal.docx',
      applyUrl: 'https://respark.iitm.ac.in/img/carrer/JD-Legal.docx',
      sourceUrl: 'https://respark.iitm.ac.in/careers/',
      source: 'iitmresearchpark',
      employmentType: null,
      experienceRequired: '15 Years',
      jobDescription: 'Manage legal, contractual, regulatory, compliance, governance, and liaison functions.',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [
        'Management',
        'Regulatory Compliance',
      ],
      postingDate: null,
      closingDate: '2026-08-15',
      scrapedAt: '2026-08-02T00:00:00.000Z',
    },
  ])
})

test('IITM Research Park returns [] when all visible cards are past their closing dates and fails closed on page drift', async () => {
  const iitmResearchPark = await loadModule()

  const expiredOnlyHtml = officialCareersHtml.replace('August 15, 2026', 'July 15, 2026')

  const jobs = await iitmResearchPark.createIITMResearchParkScraper({
    today: '2026-08-02',
  }).run({
    fetchText: async () => expiredOnlyHtml,
  })

  assert.deepEqual(jobs, [])

  await assert.rejects(
    iitmResearchPark.createIITMResearchParkScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /official careers page no longer matches the verified public surface/i,
  )
})
