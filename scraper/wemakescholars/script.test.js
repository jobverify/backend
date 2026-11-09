import assert from 'node:assert/strict'
import test from 'node:test'

const loadWeMakeScholarsModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const careersHtml = `
<!doctype html>
<html lang="en-IN">
  <head>
    <title>Careers at WeMakeScholars</title>
    <meta name="description" content="Want to work with us?Apply for the various positions at WeMakeScholars here.">
    <link href="https://www.wemakescholars.com/hiring" rel="canonical">
  </head>
  <body>
    <main>
      <form id="application-form" action="/hiring" method="post">
        <h3 id="applying_job_span">Apply for Role!</h3>
        <select
          id="hiring-position"
          name="job_id"
          data-title-map="{&quot;1&quot;:&quot;Financial Operations Trainee&quot;,&quot;11&quot;:&quot;Campus Delegate&quot;,&quot;14&quot;:&quot;Academic Advisor&quot;}"
        >
          <option value="">Select Role to apply</option>
          <option value="1">Financial Operations Trainee</option>
          <option value="11">Campus Delegate</option>
          <option value="14">Academic Advisor</option>
        </select>
        <select id="language_dropdown" name="languages[]" multiple>
          <option value="1">English</option>
          <option value="2">Telugu</option>
          <option value="11">Odia</option>
        </select>
      </form>

      <h3 class="loan-title text-center">Positions open</h3>

      <section>
        <h4 class="subtitle category">Loan Team</h4>
        <div class="row position panel" id="hiring1">
          <div class="position-title">Financial Operations Trainee</div>
          <span>Hyderabad, Telangana- India</span>
          <span>5.10 to 6 LPA</span>
          <span>Full Time</span>
          <button type="button" class="btn btn-view position-description-show" data-id="1">Job Detail</button>
          <a href="#" class="btn btn-new quick-apply" data-id="1" onclick="Apply('financialConsultant','1','Financial Operations Trainee')">Quick Apply</a>
          <div class="position-description-hide-1 hide">
            <div class="job-overview">
              <p><strong>About The Organisation:</strong></p>
              <p>WeMakeScholars is India&rsquo;s Largest Education Finance platform.</p>
              <p><strong>Job Description:</strong></p>
              <p>Your role as a Financial Officer is to discuss with students and guide education loan applications.</p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h4 class="subtitle category">Other</h4>
        <div class="row position panel" id="hiring11">
          <div class="position-title">Campus Delegate</div>
          <span>Hyderabad, Begumpet</span>
          <span>16000</span>
          <span>Remote</span>
          <button type="button" class="btn btn-view position-description-show" data-id="11">Job Detail</button>
          <a href="#" class="btn btn-new quick-apply" data-id="11" onclick="Apply('intern','11','Campus Delegate')">Quick Apply</a>
          <div class="position-description-hide-11 hide">
            <div class="job-overview">
              <p><strong>Job Description:</strong></p>
              <p>Raise awareness about the HEST Scholarship among students planning to study abroad.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  </body>
</html>
`

test('WeMakeScholars extracts official role cards from the verified hiring page', async () => {
  const wemakescholars = await loadWeMakeScholarsModule()
  assert.ok(wemakescholars, 'Expected WeMakeScholars scraper module at ./script.js')

  assert.equal(wemakescholars.SOURCE, 'wemakescholars')
  assert.equal(wemakescholars.COMPANY, 'WeMakeScholars')
  assert.equal(wemakescholars.CAREERS_URL, 'https://www.wemakescholars.com/hiring')
  assert.equal(wemakescholars.hasOfficialCareersSignal(careersHtml), true)

  assert.deepEqual(wemakescholars.extractRoleCards(careersHtml), [
    {
      jobId: '1',
      requisitionId: '1',
      title: 'Financial Operations Trainee',
      company: 'WeMakeScholars',
      department: 'Loan Team',
      location: 'Hyderabad, Telangana, India',
      city: 'Hyderabad',
      country: 'India',
      sourceUrl: 'https://www.wemakescholars.com/hiring#hiring1',
      applyUrl: 'https://www.wemakescholars.com/hiring?post_id=1',
      employmentType: 'Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: "About The Organisation: WeMakeScholars is India's Largest Education Finance platform. Job Description: Your role as a Financial Officer is to discuss with students and guide education loan applications.",
      remoteStatus: 'On-site',
      salary: '5.10 to 6 LPA',
    },
    {
      jobId: '11',
      requisitionId: '11',
      title: 'Campus Delegate',
      company: 'WeMakeScholars',
      department: 'Other',
      location: 'Hyderabad, Begumpet, India',
      city: 'Hyderabad',
      country: 'India',
      sourceUrl: 'https://www.wemakescholars.com/hiring#hiring11',
      applyUrl: 'https://www.wemakescholars.com/hiring?post_id=11',
      employmentType: 'Remote',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Job Description: Raise awareness about the HEST Scholarship among students planning to study abroad.',
      remoteStatus: 'Remote',
      salary: '16000',
    },
  ])
})

test('WeMakeScholars run fetches the verified public hiring page and decorates roles', async () => {
  const wemakescholars = await loadWeMakeScholarsModule()
  assert.ok(wemakescholars, 'Expected WeMakeScholars scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await wemakescholars.createWeMakeScholarsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requestedUrls, [wemakescholars.CAREERS_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'wemakescholars')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('WeMakeScholars fails closed when the verified official hiring surface changes', async () => {
  const wemakescholars = await loadWeMakeScholarsModule()
  assert.ok(wemakescholars, 'Expected WeMakeScholars scraper module at ./script.js')

  await assert.rejects(
    wemakescholars.createWeMakeScholarsScraper().run({
      fetchText: async () => '<html><body><h1>Home</h1></body></html>',
    }),
    /verified official public hiring surface/i,
  )

  await assert.rejects(
    wemakescholars.createWeMakeScholarsScraper().run({
      fetchText: async () => `
        <html>
          <head>
            <title>Careers at WeMakeScholars</title>
            <meta name="description" content="Want to work with us?Apply for the various positions at WeMakeScholars here.">
            <link href="https://www.wemakescholars.com/hiring" rel="canonical">
          </head>
          <body>
            <form id="application-form"></form>
            <h3>Positions open</h3>
            <select id="hiring-position"></select>
          </body>
        </html>
      `,
    }),
    /public role cards/i,
  )
})
