import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Home | Official Website of Bharat Dynamics Limited (BDL) under the Ministry of Defence, Government of India.</title>
  </head>
  <body>
    <nav>
      <a href="/recruitments" title="Recruitment" data-drupal-link-system-path="recruitments">Recruitment</a>
    </nav>
    <main>
      <h1>Bharat Dynamics Limited</h1>
    </main>
  </body>
</html>
`

const VERIFIED_RECRUITMENTS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Recruitments - Page 1 | Official Website of Bharat Dynamics Limited (BDL) under the Ministry of Defence, Government of India.</title>
  </head>
  <body>
    <header>
      <div class="row">
        <div class="col-sm-9">
          <p><a href="https://www.ncs.gov.in/" target="_blank" title="vacancies on National Career Service (NCS)Portal">Click here for vacancies on National Career Service (NCS) Portal</a></p>
        </div>
      </div>
    </header>

    <div class="table-responsive">
      <table>
        <thead>
          <tr>
            <th>Sr. No.</th>
            <th>Title</th>
            <th>Issue Date</th>
            <th>Download</th>
            <th>Location</th>
          </tr>
        </thead>
        <tbody>
          <tr class="align-top">
            <td>1</td>
            <td><div id="1">List of provisionally Selected Candidate(s) for the posts of Project Engineer(s) on contract basis vide Advt 2026-1</div></td>
            <td>30/06/2026</td>
            <td><a href="/sites/default/files/selected%20candidate-Project%20Engineer%28s%29-Advt.2026-1.pdf">List of provisionally Selected Candidate(s) for the posts of Project Engineer(s) on contract basis vide Advt 2026-1</a></td>
            <td>BDL</td>
          </tr>
          <tr class="align-top">
            <td>2</td>
            <td><div id="2">Addendum of Para-8.3 in Advt. No. BDL/C-HR (TA &amp; CP)/2026-1.</div></td>
            <td>28/05/2026</td>
            <td><a href="/sites/default/files/addendum-para-8-3-advt-2026-1.pdf">Addendum of Para-8.3 in Advt. No. BDL/C-HR (TA &amp; CP)/2026-1.</a></td>
            <td>BDL</td>
          </tr>
          <tr class="align-top">
            <td>3</td>
            <td><div id="3">Recruitment of PROJECT ENGINEERS vide Advt.2026-1 through walk-in interview in BENGALURU on 06th &amp; 07th June 2026</div></td>
            <td>27/05/2026</td>
            <td><a href="/sites/default/files/BDL_Advt_2026-1_27052026.pdf">Advt No. 2026-1</a></td>
            <td>All Locations of BDL</td>
          </tr>
          <tr class="align-top">
            <td>4</td>
            <td><div id="4">Interview Schedule for the post(s) of Management Trainee in various disciplines vide ADVT No. 2025-4</div></td>
            <td>15/01/2026</td>
            <td><a href="/sites/default/files/mt-interview-schedule-2025-4.pdf">Interview Schedule for the post(s) of Management Trainee in various disciplines vide ADVT No. 2025-4</a></td>
            <td>BDL</td>
          </tr>
        </tbody>
      </table>
    </div>

    <a href="?page=1" title="Go to next page" rel="next">next</a>
  </body>
</html>
`

const PAGE_TWO_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Recruitments - Page 2 | Official Website of Bharat Dynamics Limited (BDL) under the Ministry of Defence, Government of India.</title>
  </head>
  <body>
    <header>
      <p><a href="https://www.ncs.gov.in/" target="_blank">Click here for vacancies on National Career Service (NCS) Portal</a></p>
    </header>

    <div class="table-responsive">
      <table>
        <thead>
          <tr>
            <th>Sr. No.</th>
            <th>Title</th>
            <th>Issue Date</th>
            <th>Download</th>
            <th>Location</th>
          </tr>
        </thead>
        <tbody>
          <tr class="align-top">
            <td>1</td>
            <td><div id="5">Recruitment for the post of TRAINEE ENGINEER / TRAINEE OFFICER / TRAINEE DIPLOMA ASSISTANT / TRAINEE ASSISTANT vide Advt. No. C-HR (TA &amp; CP) / 2025-3</div></td>
            <td>18/10/2025</td>
            <td><a href="/sites/default/files/trainee-2025-3.pdf">Recruitment for the post of TRAINEE ENGINEER / TRAINEE OFFICER / TRAINEE DIPLOMA ASSISTANT / TRAINEE ASSISTANT vide Advt. No. C-HR (TA &amp; CP) / 2025-3</a></td>
            <td>All Locations of BDL</td>
          </tr>
          <tr class="align-top">
            <td>2</td>
            <td><div id="6">Notification for the posts of SM/Manager(Marketing&amp;BD) on immediate absorption basis / re-employed pensioner in BDL.</div></td>
            <td>06/09/2025</td>
            <td><a href="/sites/default/files/marketing-bd-notification.pdf">Notification for the posts of SM/Manager(Marketing&amp;BD) on immediate absorption basis / re-employed pensioner in BDL.</a></td>
            <td>BDL</td>
          </tr>
        </tbody>
      </table>
    </div>
  </body>
</html>
`

const ACTIONABLE_RECRUITMENTS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Recruitments - Page 1 | Official Website of Bharat Dynamics Limited (BDL) under the Ministry of Defence, Government of India.</title>
  </head>
  <body>
    <header>
      <p><a href="https://www.ncs.gov.in/" target="_blank">Click here for vacancies on National Career Service (NCS) Portal</a></p>
    </header>

    <div class="table-responsive">
      <table>
        <thead>
          <tr>
            <th>Sr. No.</th>
            <th>Title</th>
            <th>Issue Date</th>
            <th>Download</th>
            <th>Location</th>
          </tr>
        </thead>
        <tbody>
          <tr class="align-top">
            <td>1</td>
            <td><div id="7">Recruitment of PROJECT ENGINEERS vide Advt.2026-9 through walk-in interview in HYDERABAD on 20th &amp; 21st July 2026</div></td>
            <td>14/07/2026</td>
            <td><a href="/sites/default/files/BDL_Advt_2026-9_14072026.pdf">Advt No. 2026-9</a></td>
            <td>All Locations of BDL</td>
          </tr>
          <tr class="align-top">
            <td>2</td>
            <td><div id="8">List of candidates Selected for the post(s) of Management Trainee in various disciplines vide Advt. No.2025-4</div></td>
            <td>20/01/2026</td>
            <td><a href="/sites/default/files/selected-mt-2025-4.pdf">List of candidates Selected for the post(s) of Management Trainee in various disciplines vide Advt. No.2025-4</a></td>
            <td>BDL</td>
          </tr>
        </tbody>
      </table>
    </div>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/bharatdynamics/script.js')
  } catch {
    assert.fail('Expected Bharat Dynamics scraper module at ../../scraper/bharatdynamics/script.js')
  }
}

test('Bharat Dynamics exports the verified first-party recruitment-table contract', async () => {
  const bdl = await loadModule()

  assert.equal(bdl.SOURCE, 'bharatdynamics')
  assert.equal(bdl.COMPANY, 'Bharat Dynamics')
  assert.equal(bdl.HOMEPAGE_URL, 'https://bdl-india.in/')
  assert.equal(bdl.RECRUITMENTS_URL, 'https://bdl-india.in/recruitments')
  assert.equal(bdl.NCS_URL, 'https://www.ncs.gov.in/')
  assert.equal(bdl.buildRecruitmentsPageUrl(1), 'https://bdl-india.in/recruitments')
  assert.equal(bdl.buildRecruitmentsPageUrl(2), 'https://bdl-india.in/recruitments?page=1')
  assert.equal(bdl.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(
    bdl.extractRecruitmentUrl(HOMEPAGE_HTML),
    'https://bdl-india.in/recruitments',
  )
  assert.equal(bdl.hasOfficialRecruitmentsPageSignal(VERIFIED_RECRUITMENTS_HTML), true)
  assert.equal(bdl.extractNcsUrl(VERIFIED_RECRUITMENTS_HTML), 'https://www.ncs.gov.in/')
})

test('Bharat Dynamics extracts only clearly actionable recruitment notices and filters archive rows', async () => {
  const bdl = await loadModule()

  const jobs = bdl.extractActionableRecruitmentNotices(ACTIONABLE_RECRUITMENTS_HTML, {
    now: () => '2026-07-15T00:00:00.000Z',
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Recruitment of PROJECT ENGINEERS vide Advt.2026-9 through walk-in interview in HYDERABAD on 20th & 21st July 2026',
    company: 'Bharat Dynamics',
    department: null,
    location: 'All Locations of BDL',
    city: null,
    state: null,
    country: 'India',
    jobId: 'bharatdynamics-recruitment-of-project-engineers-vide-advt-2026-9-through-walk-in-interview-in-hyderabad-on-20th-21st-july-2026-2026-07-14',
    requisitionId: 'advt-no-2026-9',
    sourceUrl: 'https://bdl-india.in/sites/default/files/BDL_Advt_2026-9_14072026.pdf',
    applyUrl: 'https://bdl-india.in/sites/default/files/BDL_Advt_2026-9_14072026.pdf',
    employmentType: 'Contract',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-14T00:00:00.000Z',
    closingDate: '2026-07-21',
    jobDescription: 'Official Bharat Dynamics recruitment notice PDF. Review the advertisement for eligibility, schedule, and application instructions.',
  })
})

test('Bharat Dynamics runner validates the official homepage and paginated recruitment table, and currently returns zero actionable openings on the verified July 15, 2026 surface', async () => {
  const bdl = await loadModule()
  const requestedUrls = []

  const jobs = await bdl.createBharatDynamicsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === bdl.HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === bdl.RECRUITMENTS_URL) return VERIFIED_RECRUITMENTS_HTML
      if (url === bdl.buildRecruitmentsPageUrl(2)) return PAGE_TWO_HTML

      throw new Error(`Unexpected Bharat Dynamics URL: ${url}`)
    },
    now: () => '2026-07-15T12:00:00.000Z',
    maxPages: 2,
  })

  assert.deepEqual(requestedUrls, [
    'https://bdl-india.in/',
    'https://bdl-india.in/recruitments',
    'https://bdl-india.in/recruitments?page=1',
  ])
  assert.deepEqual(jobs, [])
})

test('Bharat Dynamics fails closed when the official recruitment surface changes away from the verified layout', async () => {
  const bdl = await loadModule()

  await assert.rejects(
    bdl.createBharatDynamicsScraper().run({
      fetchText: async (url) => {
        if (url === bdl.HOMEPAGE_URL) return HOMEPAGE_HTML
        if (url === bdl.RECRUITMENTS_URL) {
          return `
            <html>
              <head><title>Recruitments - Page 1 | Official Website of Bharat Dynamics Limited (BDL) under the Ministry of Defence, Government of India.</title></head>
              <body>
                <h1>Recruitments</h1>
                <p>No table available.</p>
              </body>
            </html>
          `
        }

        throw new Error(`Unexpected Bharat Dynamics URL: ${url}`)
      },
    }),
    /recruitments page no longer matches the verified official surface/i,
  )
})
