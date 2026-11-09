import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-03T00:00:00.000Z'

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers and Life @ Novigo Solutions</title>
  </head>
  <body>
    <main>
      <h1>Life @ Novigo</h1>
      <h2>Opportunities <span>with us</span></h2>
      <p>See our current job openings and where you can fit in</p>

      <div class="job-list no-border">
        <h3 class="ns-job-head job-requirements">.Net Developer <span>(2-5 Years)</span></h3>
        <p class="ns-job-text no-bullet">
          <span class="pinimg"><img src="images/pin.svg" /></span>
          Bangalore / Mangalore / Remote work during Pandemic.
        </p>
        <div class="job-details">
          <h3 class="ns-job-sub-head">Requirements:</h3>
          <p class="ns-job-text">Overall 2+ years of relevant experience in .Net</p>
          <p class="ns-job-text">In-depth knowledge in .NET / MVC /Entity Framework, HTML, CSS, Javascript.</p>
        </div>
      </div>
      <div class="panel-default">
        <div id="modal-jobs1" class="panel-collapse collapse">
          <p class="ns-job-text">Knowledge of OOPs, MVC, DB Design, Git</p>
          <p class="ns-job-text">Working knowledge on MySQL, MongoDB or any other database.</p>
        </div>
      </div>
      <p>Apply Now <img src="images/apply.png" /></p>

      <div class="job-list no-border">
        <h3 class="ns-job-head job-requirements">Angular Developer <span>(3-6 Years)</span></h3>
        <p class="ns-job-text no-bullet">
          <span class="pinimg"><img src="images/pin.svg" /></span>
          Bangalore / Mangalore / Remote work during Pandemic.
        </p>
        <div class="job-details">
          <h3 class="ns-job-sub-head">Requirements:</h3>
          <p class="ns-job-text">Minimum of 3 years experience of JavaScript front end development.</p>
          <p class="ns-job-text">Experience with Bootstrap or similar frameworks.</p>
        </div>
      </div>
      <p>Apply Now <img src="images/apply.png" /></p>

      <div class="job-list no-border">
        <h3 class="ns-job-head job-requirements">Test Engineer <span>(3-6 Years)</span></h3>
        <p class="ns-job-text no-bullet">
          <span class="pinimg"><img src="images/pin.svg" /></span>
          Bangalore / Mangalore / Remote work during Pandemic.
        </p>
        <div class="job-details">
          <h3 class="ns-job-sub-head">Requirements:</h3>
          <p class="ns-job-text">Test analysis based on requirements / user stories.</p>
          <p class="ns-job-text">REST/ API testing.</p>
          <p class="ns-job-text">Selenium, TestNG, Jenkins.</p>
        </div>
      </div>

      <h4>Apply Online</h4>
      <p>Applying for</p>
      <p>Name*</p>
      <p>Email*</p>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/novigosolutions/script.js')
  } catch {
    assert.fail('Expected Novigo Solutions scraper module at ../../scraper/novigosolutions/script.js')
  }
}

test('Novigo Solutions scraper parses nested heading spans and stops before the apply form', async () => {
  const novigo = await loadModule()

  assert.equal(novigo.SOURCE, 'novigosolutions')
  assert.equal(novigo.COMPANY, 'Novigo Solutions')
  assert.equal(novigo.CAREERS_URL, 'https://www.novigosolutions.com/careers-life-at-novigo')
  assert.equal(novigo.VERIFIED_ON, '2026-08-03')
  assert.equal(novigo.hasOfficialCareersSignal(CAREERS_HTML), true)

  const roles = novigo.extractVisibleRoles(CAREERS_HTML)
  assert.equal(roles.length, 3)
  assert.deepEqual(roles[0], {
    title: '.Net Developer',
    experienceRequired: '2-5 Years',
    location: 'Bangalore / Mangalore / Remote work during Pandemic.',
    requirements: [
      'Overall 2+ years of relevant experience in .Net',
      'In-depth knowledge in .NET / MVC /Entity Framework, HTML, CSS, Javascript.',
      'Knowledge of OOPs, MVC, DB Design, Git',
      'Working knowledge on MySQL, MongoDB or any other database.',
    ],
  })
  assert.equal(roles[2].title, 'Test Engineer')
  assert.equal(roles[2].experienceRequired, '3-6 Years')
  assert.deepEqual(roles[2].requirements, [
    'Test analysis based on requirements / user stories.',
    'REST/ API testing.',
    'Selenium, TestNG, Jenkins.',
  ])
  assert.ok(!roles[2].requirements.includes('Applying for'))
  assert.ok(!roles[2].requirements.includes('Name*'))

  const jobs = await novigo.createNovigoSolutionsScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      assert.equal(url, novigo.CAREERS_URL)
      return CAREERS_HTML
    },
  })

  assert.equal(jobs.length, 3)
  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.experienceRequired, job.remoteStatus]),
    [
      ['.Net Developer', 'Bangalore / Mangalore / Remote work during Pandemic.', '2-5 Years', 'Hybrid'],
      ['Angular Developer', 'Bangalore / Mangalore / Remote work during Pandemic.', '3-6 Years', 'Hybrid'],
      ['Test Engineer', 'Bangalore / Mangalore / Remote work during Pandemic.', '3-6 Years', 'Hybrid'],
    ],
  )
  assert.equal(jobs[0].source, 'novigosolutions')
  assert.equal(jobs[0].applyUrl, novigo.CAREERS_URL)
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.match(jobs[2].jobDescription, /REST\/ API testing/i)
  assert.doesNotMatch(jobs[2].jobDescription, /Applying for|Name\*|Email\*/i)
})
