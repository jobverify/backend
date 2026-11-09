import assert from 'node:assert/strict'
import test from 'node:test'

const officialCareersHtml = `
  <html>
    <head><title>Careers at Lepton Software, Build Geospatial Intelligence | Lepton Software</title></head>
    <body>
      <p>For job-related queries email us at hr@leptonmaps.com</p>
      <script>fetch('https://leptonsoftware.keka.com/careers/api/jobs/default/active')</script>
    </body>
  </html>
`

const currentCareersHtml = `
  <html>
    <head><title>Careers at Lepton Software, Build Geospatial Intelligence | Lepton Software</title></head>
    <body>
      <h1>Careers</h1>
      <p>Build the geo-stack behind 425 enterprises.</p>
      <p>Open roles 12 positions across 4 departments.</p>
      <a href="https://leptonsoftware.keka.com/careers/jobdetails/64107">Executive Assistant – Founder’s Office</a>
      <a href="mailto:hr@leptonmaps.com">hr@leptonmaps.com</a>
    </body>
  </html>
`

const detailedJobHtml = `
  <html>
    <body>
      <div class="job-details-container pb-5">
        <div class="max-w-800 mx-auto">
          <div class="row no-gutters justify-content-between">
            <div class="col-lg-8 col-sm-12 mb-5 p-4">
              <div class="job-description-container ">
                <div><strong>QUALIFICATION &amp; SKILLSET</strong></div>
                <div>3-5 years of experience with modern QA automation stacks.</div>
              </div>
            </div>
            <div class="col-lg-4 col-sm-12 mb-5 p-4"></div>
          </div>
        </div>
      </div>
      <button id="apply-job">Apply for this job</button>
      <div selectedJobId="62858"></div>
      <span>LEPTON SOFTWARE</span>
    </body>
  </html>
`

const placeholderJobHtml = `
  <html>
    <body>
      <div class="job-details-container pb-5">
        <div class="max-w-800 mx-auto">
          <div class="row no-gutters justify-content-between">
            <div class="col-lg-8 col-sm-12 mb-5 p-4">
              <div class="job-description-container ">NA</div>
            </div>
            <div class="col-lg-4 col-sm-12 mb-5 p-4"></div>
          </div>
        </div>
      </div>
      <button id="apply-job">Apply for this job</button>
      <div selectedJobId="62867"></div>
      <span>LEPTON SOFTWARE</span>
    </body>
  </html>
`

const jobsPayload = [
  {
    id: 64107,
    title: "EXECUTIVE ASSISTANT - FOUNDER'S OFFICE",
    description: '<p>Support leadership.</p>',
    departmentName: 'ADMIN.',
    jobLocations: [{ city: 'Gurgaon', state: 'HR', countryCode: 'IN', countryName: 'India' }],
    jobType: 2,
    jobNumber: 'LEP-64107',
    publishedOn: '2026-03-27T00:00:00Z',
    skillNames: ['Calendar Management'],
    experience: '1 - 2 YEARS',
  },
]

test('Lepton Software Export & Research recognizes the verified careers page and maps the public Keka jobs payload', async () => {
  const lepton = await import('../../scraper/leptonsoftwareexportresearch/script.js')

  assert.equal(lepton.hasOfficialLeptonCareersSignals(officialCareersHtml), true)
  assert.equal(lepton.hasOfficialLeptonCareersSignals(currentCareersHtml), true)
  assert.deepEqual(lepton.extractJobs(jobsPayload), [
    {
      title: "EXECUTIVE ASSISTANT - FOUNDER'S OFFICE",
      company: 'Lepton Software Export & Research',
      department: 'ADMIN.',
      location: 'Gurgaon, HR, India',
      city: 'Gurgaon',
      country: 'India',
      jobId: '64107',
      requisitionId: 'LEP-64107',
      sourceUrl: 'https://leptonsoftware.keka.com/careers/jobdetails/64107',
      applyUrl: 'https://leptonsoftware.keka.com/careers/applyjob/64107',
      employmentType: 'Full Time',
      experienceRequired: '1 - 2 YEARS',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Calendar Management'],
      postingDate: '2026-03-27',
      closingDate: null,
      jobDescription: 'Support leadership.',
    },
  ])
})

test('Lepton Software Export & Research scraper returns public India Keka jobs', async () => {
  const lepton = await import('../../scraper/leptonsoftwareexportresearch/script.js')

  const jobs = await lepton.createLeptonSoftwareExportResearchScraper({
    now: () => '2026-07-18T00:00:00.000Z',
  }).run({
    fetchText: async () => officialCareersHtml,
    fetchJson: async () => jobsPayload,
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'leptonsoftwareexportresearch')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
})

test('Lepton Software Export & Research enriches missing Keka experience from the public detail page', async () => {
  const lepton = await import('../../scraper/leptonsoftwareexportresearch/script.js')

  const jobs = await lepton.createLeptonSoftwareExportResearchScraper({
    now: () => '2026-08-05T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      if (url === lepton.CAREERS_URL) return officialCareersHtml
      if (url === 'https://leptonsoftware.keka.com/careers/jobdetails/62858') return detailedJobHtml
      throw new Error(`Unexpected URL ${url}`)
    },
    fetchJson: async () => [
      {
        id: 62858,
        title: 'QA ENGINEER (QA 2)',
        description: 'NA',
        departmentName: 'SOFTWARE',
        jobLocations: [{ city: 'Gurgaon', state: 'HR', countryCode: 'IN', countryName: 'India' }],
        jobType: 2,
        jobNumber: 'LEP-62858',
        publishedOn: '2026-03-19T00:00:00Z',
        skillNames: [],
        experience: null,
      },
    ],
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].applyUrl, 'https://leptonsoftware.keka.com/careers/applyjob/62858')
  assert.equal(jobs[0].experienceRequired, '3-5 years of experience')
  assert.equal(jobs[0].jobDescription, 'QUALIFICATION & SKILLSET 3-5 years of experience with modern QA automation stacks.')
  assert.equal(jobs[0].publicExperienceChecked, true)
})

test('Lepton Software Export & Research marks public experience as checked when the detail page explicitly says NA', async () => {
  const lepton = await import('../../scraper/leptonsoftwareexportresearch/script.js')

  const jobs = await lepton.createLeptonSoftwareExportResearchScraper({
    now: () => '2026-08-05T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      if (url === lepton.CAREERS_URL) return officialCareersHtml
      if (url === 'https://leptonsoftware.keka.com/careers/jobdetails/62867') return placeholderJobHtml
      throw new Error(`Unexpected URL ${url}`)
    },
    fetchJson: async () => [
      {
        id: 62867,
        title: 'SOFTWARE DEVELOPMENT ENGINEER (SDE 1) (BACK-END)',
        description: 'NA NA',
        departmentName: 'SOFTWARE',
        jobLocations: [{ city: 'Gurgaon', state: 'HR', countryCode: 'IN', countryName: 'India' }],
        jobType: 2,
        jobNumber: 'LEP-62867',
        publishedOn: '2026-03-19T00:00:00Z',
        skillNames: [],
        experience: null,
      },
    ],
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].applyUrl, 'https://leptonsoftware.keka.com/careers/applyjob/62867')
  assert.equal(jobs[0].experienceRequired, null)
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(jobs[0].publicExperienceChecked, true)
})
