import assert from 'node:assert/strict'
import test from 'node:test'

const JOB_OPENINGS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title> Job Openings | Official Website of BPCL, India </title>
    <link rel="canonical" href="https://www.bharatpetroleum.in/careers/job-openings" />
  </head>
  <body>
    <main>
      <h2 class="section-title">Job Openings</h2>
      <table class="table table-bordered main-tbl">
        <tbody>
          <tr>
            <th>NO.</th>
            <th>POSTS CALLED FOR</th>
            <th>DETAILS OF THE ADVERTISEMENT</th>
            <th>LAST DATE FOR APPLYING</th>
          </tr>
          <tr>
            <td><p>1</p></td>
            <td><p>Advertisement for the post of Director (Refineries), BPCL</p></td>
            <td>
              <p><a href="/images/files/advertisement-for-the-post-of-director-may26-eng.pdf">Advertisement (English)</a></p>
              <p><a href="/images/files/advertisement-for-the-post-of-director-hindi-may26.pdf">Advertisement (Hindi)</a></p>
            </td>
            <td><p>22.06.2026</p></td>
          </tr>
          <tr>
            <td><p>2</p></td>
            <td>
              <p>Recruitment for Mid/Senior Level Roles</p>
              <p>1. Bharat Petro Resources Ltd. (BPRL)</p>
              <p>2. Company Secretary</p>
              <p>3. Finance</p>
            </td>
            <td>
              <p>Applications for Mid/Senior level profiles open from 31st May 2026.</p>
              <p><a href="/images/files/BPCL-Mid-Senior-Level-Advertisement-May26.pdf">Click here to view Detailed Advertisement</a></p>
              <p><a aria-label="Apply Online" href="https://ibpsreg.ibps.in/bpcllmsmay26/">Click here to Apply Online</a></p>
              <p>UPDATE AS ON 11.06.2026 - Please find the Corrigendum.</p>
              <p>Please note that the last date of submission of the online applications is now extended to <strong><u>27th June, 2026</u></strong>.</p>
            </td>
            <td><p>27.06.2026</p></td>
          </tr>
          <tr>
            <td><p>3</p></td>
            <td><p>Recruitment for Entry Level Roles</p></td>
            <td>
              <p>Applications for Entry level profiles open from 18th April 2026.</p>
              <p><a href="/images/files/bpcl-entry-level-advertisement.pdf">Click here to view Detailed Advertisement</a></p>
              <p><a href="https://ibpsreg.ibps.in/bpclapr26/">Click here to Apply Online</a></p>
            </td>
            <td><p>24.05.2026</p></td>
          </tr>
        </tbody>
      </table>
    </main>
  </body>
</html>
`

const loadBharatPetroleumModule = async () => {
  try {
    return await import('../../scraper/bharatpetroleum/script.js')
  } catch {
    assert.fail('Expected Bharat Petroleum scraper module at ../../scraper/bharatpetroleum/script.js')
  }
}

test('Bharat Petroleum pins the verified official job-openings page', async () => {
  const bpcl = await loadBharatPetroleumModule()

  assert.equal(bpcl.JOB_OPENINGS_URL, 'https://www.bharatpetroleum.in/careers/job-openings')
  assert.equal(bpcl.isOfficialJobOpeningsPage(JOB_OPENINGS_HTML), true)
})

test('Bharat Petroleum extracts only active IBPS campaigns from the official page', async () => {
  const bpcl = await loadBharatPetroleumModule()

  const jobs = bpcl.extractActiveJobOpenings(JOB_OPENINGS_HTML, {
    now: () => '2026-06-01T00:00:00.000Z',
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Recruitment for Mid/Senior Level Roles',
    company: 'Bharat Petroleum',
    location: null,
    city: null,
    country: 'India',
    jobId: 'bharatpetroleum-bpcllmsmay26',
    requisitionId: 'bpcllmsmay26',
    sourceUrl: 'https://www.bharatpetroleum.in/images/files/BPCL-Mid-Senior-Level-Advertisement-May26.pdf',
    applyUrl: 'https://ibpsreg.ibps.in/bpcllmsmay26/',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-05-31',
    closingDate: '2026-06-27',
    jobDescription: 'Apply through the official IBPS recruitment portal before the closing date.',
    remoteStatus: null,
  })
})

test('Bharat Petroleum returns shared runner fields from the official page and can naturally return zero active roles', async () => {
  const bpcl = await loadBharatPetroleumModule()
  const requestedUrls = []

  const jobs = await bpcl.createBharatPetroleumScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === bpcl.JOB_OPENINGS_URL) return JOB_OPENINGS_HTML
      throw new Error(`Unexpected Bharat Petroleum URL: ${url}`)
    },
    now: () => '2026-06-01T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, ['https://www.bharatpetroleum.in/careers/job-openings'])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'bharatpetroleum')
  assert.equal(jobs[0].company, 'Bharat Petroleum')
  assert.equal(jobs[0].link, 'https://ibpsreg.ibps.in/bpcllmsmay26/')
  assert.equal(typeof jobs[0].scrapedAt, 'string')

  const noActiveJobs = bpcl.extractActiveJobOpenings(JOB_OPENINGS_HTML, {
    now: () => '2026-07-19T00:00:00.000Z',
  })

  assert.deepEqual(noActiveJobs, [])
})
