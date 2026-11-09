import { checkCurrentFactory,checkChangedPublisher } from '../native-sources/declaredGreenhouse/replayControls.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Prophecy Careers | The AI Data Analysis Platform</title>
    <meta
      name="description"
      content="Prophecy is redefining how the world of business works with data in the world of AI."
    />
    <link href="https://www.prophecy.ai/careers" rel="canonical" />
  </head>
  <body>
    <main>
      <div class="eyebrow-text text-color-brand">WE ARE HIRING!</div>
      <h1>Come transform your career with us</h1>
      <div class="eyebrow-text text-color-600">OPEN POSITIONS</div>
      <div id="job-board-container">
        <div class="job-listing_department-header">
          <h2 class="text-size-large text-color-brand">Software Engineering</h2>
          <div class="job-listing_department-item-count">5</div>
        </div>
        <div class="job-listing_job-item">
          <div class="job-listing_job-item-header">
            <h3 class="text-size-regular text-weight-semibold">Agentic-Workflow MLE</h3>
            <a href="#" class="job-listing_job-item-link w-inline-block">
              <div>View job</div>
            </a>
          </div>
          <div class="job-listing_job-item-location">San Francisco, California, USA (Hybrid)</div>
        </div>
      </div>
      <script>
        const departmentApi = "https://boards-api.greenhouse.io/v1/boards/prophecysimpledatalabs/departments"
        const template = "\${job.absolute_url}|\${job.location}"
      </script>
      <a href="https://my.greenhouse.io/users/sign_in?job_board=prophecysimpledatalabs&source=job_alert_board">
        Create Alert
      </a>
    </main>
  </body>
</html>
`

const departmentsPayload = {
  departments: [
    {
      id: 4025566007,
      name: 'Engineering ',
      parent_id: null,
      child_ids: [],
      jobs: [
        {
          absolute_url: 'https://job-boards.greenhouse.io/prophecysimpledatalabs/jobs/5159426007',
          internal_job_id: 4643003007,
          location: { name: 'Bengaluru, Karnataka, India' },
          metadata: null,
          id: 5159426007,
          updated_at: '2026-06-18T02:44:53-04:00',
          requisition_id: 'RNDENGINQ227199R',
          title: 'Senior DevOps Engineer',
          company_name: 'Prophecy',
          first_published: '2026-06-09T00:06:30-04:00',
          language: 'en',
          application_deadline: null,
        },
        {
          absolute_url: 'https://job-boards.greenhouse.io/prophecysimpledatalabs/jobs/5125696007',
          internal_job_id: 4626608007,
          location: { name: 'San Francisco, California, United States' },
          metadata: null,
          id: 5125696007,
          updated_at: '2026-07-02T19:19:32-04:00',
          requisition_id: 'RNDENGUSQ127193P',
          title: 'AI/ML Engineer (Mid-level to Principal)',
          company_name: 'Prophecy',
          first_published: '2026-05-04T12:35:16-04:00',
          language: 'en',
          application_deadline: null,
        },
      ],
    },
    {
      id: 4058017007,
      name: 'Marketing',
      parent_id: null,
      child_ids: [],
      jobs: [
        {
          absolute_url: 'https://job-boards.greenhouse.io/prophecysimpledatalabs/jobs/5181938007',
          internal_job_id: 4653827007,
          location: { name: 'San Francisco, CA' },
          metadata: null,
          id: 5181938007,
          updated_at: '2026-07-14T13:19:50-04:00',
          requisition_id: '223',
          title: 'Senior Product Marketing Manager',
          company_name: 'Prophecy',
          first_published: '2026-07-14T13:19:50-04:00',
          language: 'en',
          application_deadline: null,
        },
      ],
    },
  ],
}

const greenhouseJobDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Senior DevOps Engineer - Prophecy</title>
  </head>
  <body>
    <main>
      <h1>Senior DevOps Engineer</h1>
      <div class="content">
        <p><strong>What You'll Need</strong></p>
        <ul>
          <li>5-10 years of overall systems/infrastructure engineering experience, including hands-on work building and operating infrastructure platform-as-a-service capabilities.</li>
          <li>Strong hands-on knowledge of cloud services across at least one major cloud.</li>
        </ul>
      </div>
    </main>
  </body>
</html>
`

const loadProphecyModule = async () => {
  try {
    return await import('../../scraper/prophecy/script.js')
  } catch {
    assert.fail('Expected Prophecy scraper module at ../../scraper/prophecy/script.js')
  }
}

test('Prophecy pins the verified first-party careers page and embedded Greenhouse departments API contract', async () => {
  const prophecy = await loadProphecyModule()

  assert.equal(prophecy.SOURCE, 'prophecy')
  assert.equal(prophecy.COMPANY, 'Prophecy')
  assert.equal(prophecy.OFFICIAL_BRAND_NAME, 'Prophecy')
  assert.equal(prophecy.VERIFIED_ON, null)
  assert.equal(prophecy.CAREERS_URL, 'https://www.prophecy.ai/careers')
  assert.equal(
    prophecy.GREENHOUSE_DEPARTMENTS_API_URL,
    'https://boards-api.greenhouse.io/v1/boards/prophecysimpledatalabs/departments',
  )
  assert.equal(
    prophecy.GREENHOUSE_JOB_BOARD_PREFIX,
    'https://job-boards.greenhouse.io/prophecysimpledatalabs/jobs/',
  )
  assert.equal(typeof prophecy.hasOfficialCareersSignal, 'function')
  assert.equal(typeof prophecy.extractGreenhouseDepartmentsApiUrl, 'function')
  assert.equal(typeof prophecy.normalizeGreenhouseJobUrl, 'function')
  assert.equal(typeof prophecy.buildGreenhouseApplyUrl, 'function')
  assert.equal(typeof prophecy.extractIndiaJobsFromDepartmentsPayload, 'function')
  assert.equal(typeof prophecy.createProphecyScraper, 'function')

  assert.equal(prophecy.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(
    prophecy.hasOfficialCareersSignal('<html><body><h1>Unexpected</h1></body></html>'),
    false,
  )
  assert.equal(
    prophecy.extractGreenhouseDepartmentsApiUrl(officialCareersHtml),
    'https://boards-api.greenhouse.io/v1/boards/prophecysimpledatalabs/departments',
  )
  assert.equal(
    prophecy.normalizeGreenhouseJobUrl(
      'https://job-boards.greenhouse.io/prophecysimpledatalabs/jobs/5159426007',
      5159426007,
    ),
    'https://job-boards.greenhouse.io/prophecysimpledatalabs/jobs/5159426007',
  )
  assert.equal(
    prophecy.buildGreenhouseApplyUrl(
      'https://job-boards.greenhouse.io/prophecysimpledatalabs/jobs/5159426007',
      5159426007,
    ),
    'https://job-boards.greenhouse.io/prophecysimpledatalabs/jobs/5159426007#application',
  )
})

test('Prophecy extracts only India jobs from the verified Greenhouse departments payload', async () => {
  const { extractIndiaJobsFromDepartmentsPayload } = await loadProphecyModule()
  const jobs = extractIndiaJobsFromDepartmentsPayload(departmentsPayload, {
    scrapedAt: FIXED_SCRAPED_AT,
  })

  assert.deepEqual(jobs, [
    {
      title: 'Senior DevOps Engineer',
      company: 'Prophecy',
      department: 'Engineering',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: '5159426007',
      requisitionId: 'RNDENGINQ227199R',
      sourceUrl: 'https://job-boards.greenhouse.io/prophecysimpledatalabs/jobs/5159426007',
      applyUrl: 'https://job-boards.greenhouse.io/prophecysimpledatalabs/jobs/5159426007#application',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-06-09T00:06:30-04:00',
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
      source: 'prophecy',
      link: 'https://job-boards.greenhouse.io/prophecysimpledatalabs/jobs/5159426007',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('Prophecy extracts experience from the official Greenhouse detail page', async () => {
  const prophecy = await loadProphecyModule()
  const listing = prophecy.extractIndiaJobsFromDepartmentsPayload(departmentsPayload, {
    scrapedAt: FIXED_SCRAPED_AT,
  })[0]

  assert.equal(prophecy.hasOfficialGreenhouseJobDetailSignal(greenhouseJobDetailHtml), true)
  assert.deepEqual(
    prophecy.extractGreenhouseJobDetail(greenhouseJobDetailHtml, listing),
    {
      ...listing,
      experienceRequired: '5 - 10 years',
    },
  )
})

test('prophecy actual factory retains complete original native models before selection',async()=>{
 const prophecy=await loadProphecyModule();await checkCurrentFactory('prophecy',prophecy.createProphecyScraper)
})

test('prophecy changed primary publisher holds current source qualification',async()=>{
 const prophecy=await loadProphecyModule();await checkChangedPublisher('prophecy',prophecy.createProphecyScraper)
})
