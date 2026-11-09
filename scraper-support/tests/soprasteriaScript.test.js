import assert from 'node:assert/strict'
import test from 'node:test'

const loadSopraSteriaModule = async () => {
  try {
    return await import('../../scraper/soprasteria/script.js')
  } catch {
    assert.fail('Expected Sopra Steria scraper module at ../../scraper/soprasteria/script.js')
  }
}

const indiaSearchPageHtml = `
  <html>
    <head><title>Join Sopra Steria</title></head>
    <body>
      <h1>Join Sopra Steria</h1>
      <div class="attrax-vacancy-tile attrax-vacancy-tile--noida attrax-vacancy-tile--india" data-jobid="7760">
        <a class="attrax-vacancy-tile__title attrax-vacancy-tile__item attrax-button" href="/job/tibco-bw-6-module-lead-in-noida-uttar-pradesh-india-jid-7760">
          TIBCO BW 6 - Module Lead
        </a>
        <div class="attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__item-label">Location</p>
          <p class="attrax-vacancy-tile__item-value">Noida, Uttar Pradesh, India</p>
        </div>
        <div class="attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__item-label">Job Type</p>
          <p class="attrax-vacancy-tile__item-value">Standard</p>
        </div>
        <div class="attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__item-label">Experience Level</p>
          <p class="attrax-vacancy-tile__item-value">3 to 5 years</p>
        </div>
        <div class="attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__item-label">Department</p>
          <p class="attrax-vacancy-tile__item-value">Engineering, Development, Applications</p>
        </div>
        <div class="attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__item-label">Description</p>
          <p class="attrax-vacancy-tile__item-value">
            Job Description - Developer TIBCO V6 Developer - TIBCO V6 Excellent communication skills are must.
          </p>
        </div>
        <div class="attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__item-label">Reference</p>
          <p class="attrax-vacancy-tile__item-value">30635cf9-e53b-4384-935a-94e5fce05686</p>
        </div>
        <div class="attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__item-label">Expiry Date</p>
          <p class="attrax-vacancy-tile__item-value">Jan 1, 0001</p>
        </div>
      </div>
      <div class="attrax-vacancy-tile attrax-vacancy-tile--paris" data-jobid="1000">
        <a class="attrax-vacancy-tile__title attrax-vacancy-tile__item attrax-button" href="/job/senior-consultant-in-paris-france-jid-1000">
          Senior Consultant
        </a>
        <div class="attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__item-label">Location</p>
          <p class="attrax-vacancy-tile__item-value">Paris, France</p>
        </div>
      </div>
      <div class="attrax-pagination__container">
        <a href="/jobs?page=1">1</a>
        <a href="/jobs?page=2">2</a>
        <a href="/jobs?page=10">10</a>
      </div>
    </body>
  </html>
`

const secondIndiaSearchPageHtml = `
  <html>
    <head><title>Join Sopra Steria</title></head>
    <body>
      <h1>Join Sopra Steria</h1>
      <div class="attrax-vacancy-tile attrax-vacancy-tile--bengaluru attrax-vacancy-tile--india" data-jobid="8123">
        <a class="attrax-vacancy-tile__title attrax-vacancy-tile__item attrax-button" href="/job/sap-abap-s4-hana-project-manager-in-bengaluru-karnataka-india-jid-8123">
          SAP ABAP (S4 HANA) / Project Manager
        </a>
        <div class="attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__item-label">Location</p>
          <p class="attrax-vacancy-tile__item-value">Bengaluru, Karnataka, India</p>
        </div>
        <div class="attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__item-label">Job Type</p>
          <p class="attrax-vacancy-tile__item-value">Standard</p>
        </div>
        <div class="attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__item-label">Experience Level</p>
          <p class="attrax-vacancy-tile__item-value">More than 10 years</p>
        </div>
        <div class="attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__item-label">Department</p>
          <p class="attrax-vacancy-tile__item-value">Project and Product Management</p>
        </div>
        <div class="attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__item-label">Reference</p>
          <p class="attrax-vacancy-tile__item-value">1e445ef9-64d2-4fd7-8930-ee40b27607a8</p>
        </div>
        <div class="attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__item-label">Description</p>
          <p class="attrax-vacancy-tile__item-value">
            Candidate must have strong understanding of SAP S4HANA and lead SAP technical teams.
          </p>
        </div>
      </div>
      <div class="attrax-pagination__container">
        <a href="/jobs?page=1">1</a>
        <a href="/jobs?page=2">2</a>
      </div>
    </body>
  </html>
`

const detailPageHtml = `
  <html>
    <head>
      <title>TIBCO BW 6 - Module Lead | Sopra Steria</title>
    </head>
    <body>
      <div class="vacancy-buttons-widget">
        <a class="jobApplyBtn btn btn-default" href="/Workflow?workflowId=2f98ce4d-a695-4f06-91c0-5d85f6f267bb&amp;vacancyId=7760">
          Apply
        </a>
      </div>
      <div class="description-widget">
        <div aria-label="Job description">
          <div class="jobad-jobdescription">About the role</div>
          <p>Developer TIBCO V6. Excellent communication skills are must.</p>
          <ul>
            <li>Design and support TIBCO BW 6 integrations.</li>
            <li>Coordinate with business teams on incident fixes.</li>
          </ul>
          <div class="jobad-qualifications">Qualifications</div>
          <ul>
            <li>4+ years of hands-on experience in TIBCO BW 6.</li>
            <li>Strong analytical and communication skills.</li>
          </ul>
        </div>
      </div>
    </body>
  </html>
`

test('Sopra Steria scraper constants point to the official Attrax jobs pages', async () => {
  const { CAREERS_URL, COMPANY, buildSearchPageUrl } = await loadSopraSteriaModule()

  assert.equal(CAREERS_URL, 'https://careers.soprasteria.in/jobs')
  assert.equal(COMPANY, 'Sopra Steria')
  assert.equal(
    buildSearchPageUrl(),
    'https://careers.soprasteria.in/jobs?page=1',
  )
  assert.equal(
    buildSearchPageUrl(3),
    'https://careers.soprasteria.in/jobs?page=3',
  )
})

test('extractSearchResults keeps India Attrax vacancies and normalizes shared scraper fields', async () => {
  const { extractSearchResults, extractTotalPages } = await loadSopraSteriaModule()

  const jobs = extractSearchResults(indiaSearchPageHtml)

  assert.equal(extractTotalPages(indiaSearchPageHtml), 10)
  assert.deepEqual(jobs, [{
    title: 'TIBCO BW 6 - Module Lead',
    company: 'Sopra Steria',
    department: 'Engineering, Development, Applications',
    location: 'Noida, Uttar Pradesh, India',
    city: 'Noida',
    country: 'India',
    jobId: '7760',
    requisitionId: '30635cf9-e53b-4384-935a-94e5fce05686',
    sourceUrl: 'https://careers.soprasteria.in/job/tibco-bw-6-module-lead-in-noida-uttar-pradesh-india-jid-7760',
    applyUrl: 'https://careers.soprasteria.in/job/tibco-bw-6-module-lead-in-noida-uttar-pradesh-india-jid-7760',
    employmentType: 'Standard',
    experienceRequired: '3 to 5 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Job Description - Developer TIBCO V6 Developer - TIBCO V6 Excellent communication skills are must.',
  }])
})

test('extractJobDetail enriches Sopra Steria detail pages with workflow apply links and qualifications', async () => {
  const { extractJobDetail, extractSearchResults } = await loadSopraSteriaModule()

  const [listing] = extractSearchResults(indiaSearchPageHtml)
  const job = extractJobDetail(detailPageHtml, listing)

  assert.deepEqual(job, {
    ...listing,
    applyUrl: 'https://careers.soprasteria.in/Workflow?workflowId=2f98ce4d-a695-4f06-91c0-5d85f6f267bb&vacancyId=7760',
    minimumQualification: '4+ years of hands-on experience in TIBCO BW 6.',
    requiredSkills: [
      '4+ years of hands-on experience in TIBCO BW 6.',
      'Strong analytical and communication skills.',
    ],
    jobDescription: 'About the role Developer TIBCO V6. Excellent communication skills are must. Design and support TIBCO BW 6 integrations. Coordinate with business teams on incident fixes. Qualifications 4+ years of hands-on experience in TIBCO BW 6. Strong analytical and communication skills.',
  })
})

test('run crawls Sopra Steria paginated listing pages and enriches detail pages', async () => {
  const { createSopraSteriaScraper } = await loadSopraSteriaModule()

  const requests = []
  const scraper = createSopraSteriaScraper({
    maxPages: 2,
    fetchText: async (url) => {
      requests.push(url)

      if (url === 'https://careers.soprasteria.in/jobs?page=1') {
        return indiaSearchPageHtml
      }

      if (url === 'https://careers.soprasteria.in/jobs?page=2') {
        return secondIndiaSearchPageHtml
      }

      if (url === 'https://careers.soprasteria.in/job/tibco-bw-6-module-lead-in-noida-uttar-pradesh-india-jid-7760') {
        return detailPageHtml
      }

      if (url === 'https://careers.soprasteria.in/job/sap-abap-s4-hana-project-manager-in-bengaluru-karnataka-india-jid-8123') {
        return detailPageHtml
          .replace(/7760/g, '8123')
          .replace(/TIBCO BW 6 - Module Lead/g, 'SAP ABAP (S4 HANA) / Project Manager')
          .replace(/Developer TIBCO V6\. Excellent communication skills are must\./g, 'Candidate must have strong understanding of SAP S4HANA and lead SAP technical teams.')
          .replace(/TIBCO BW 6/g, 'SAP S4HANA')
      }

      throw new Error(`Unexpected Sopra Steria URL: ${url}`)
    },
    now: () => '2026-07-09T00:00:00.000Z',
  })

  const jobs = await scraper.run()

  assert.deepEqual(requests, [
    'https://careers.soprasteria.in/jobs?page=1',
    'https://careers.soprasteria.in/job/tibco-bw-6-module-lead-in-noida-uttar-pradesh-india-jid-7760',
    'https://careers.soprasteria.in/jobs?page=2',
    'https://careers.soprasteria.in/job/sap-abap-s4-hana-project-manager-in-bengaluru-karnataka-india-jid-8123',
  ])

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'soprasteria')
  assert.equal(jobs[0].company, 'Sopra Steria')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-09T00:00:00.000Z')
  assert.equal(jobs[1].city, 'Bengaluru')
  assert.equal(
    jobs[1].applyUrl,
    'https://careers.soprasteria.in/Workflow?workflowId=2f98ce4d-a695-4f06-91c0-5d85f6f267bb&vacancyId=8123',
  )
})
