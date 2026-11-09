import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-18T15:00:00.000Z'

const careersHtml = `
<!doctype html>
<html>
  <head>
    <title>Career At Cyntexa | Find Your Job and Apply Today</title>
  </head>
  <body>
    <h2>We are Cyntexa</h2>
    <h2>Job Opportunities</h2>
    <a href="https://cyntexa.com/careers/software-developer/">Software Developer</a>
    <p>Full-Time</p>
    <p>Jaipur</p>
    <p>2+ Years</p>
    <a href="https://cyntexa.com/careers/management-trainee/">Management Trainee</a>
    <p>Full-Time</p>
    <p>Jaipur</p>
    <p>Freshers</p>
    <a href="https://cyntexa.com/careers/salesforce-growth-strategy-consultant-usa/">Salesforce Growth & Strategy Consultant- USA</a>
    <p>Full Time</p>
    <p>USA</p>
    <p>2+ years</p>
  </body>
</html>
`

const softwareDeveloperDetailHtml = `
<!doctype html>
<html>
  <body>
    <h1>Software Developer</h1>
    <p>Full-Time</p>
    <p>Jaipur</p>
    <p>2+ Years</p>
    <h2>Job Summary</h2>
    <p>We are looking for Software Developers who are currently working in other technologies.</p>
    <h2>Industry</h2>
    <p>Information Technology</p>
    <h2>Department</h2>
    <p>Engineering</p>
    <h2>Key Responsibilities</h2>
    <p>Collaborate with stakeholders and build custom Salesforce solutions.</p>
    <h2>Are you interested?</h2>
    <p>Just send us your resume at hr@cyntexa.com</p>
  </body>
</html>
`

const managementTraineeDetailHtml = `
<!doctype html>
<html>
  <body>
    <h1>Management Trainee</h1>
    <p>Full-Time</p>
    <p>Jaipur</p>
    <p>Freshers</p>
    <h2>Job Summary</h2>
    <p>We are seeking dynamic and motivated Management Trainees to join our team.</p>
    <h2>Industry</h2>
    <p>Business Operations</p>
    <h2>Department</h2>
    <p>Growth & Strategy</p>
    <h2>Key Responsibilities</h2>
    <p>Contribute to key projects and learn the essential skills to grow with us.</p>
    <h2>Are you interested?</h2>
    <p>Apply Now</p>
  </body>
</html>
`

const driftedHtml = `
<!doctype html>
<html><body><h1>Cyntexa Careers</h1></body></html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/cyntexa/script.js')
  } catch {
    assert.fail('Expected Cyntexa scraper module at ../../scraper/cyntexa/script.js')
  }
}

test('Cyntexa helpers stay pinned to the verified careers index and detail contract', async () => {
  const cyntexa = await loadModule()

  assert.equal(cyntexa.hasVerifiedCareersIndexSignal(careersHtml), true)
  assert.deepEqual(cyntexa.extractJobLinks(careersHtml), [
    'https://cyntexa.com/careers/software-developer/',
    'https://cyntexa.com/careers/management-trainee/',
    'https://cyntexa.com/careers/salesforce-growth-strategy-consultant-usa/',
  ])
})

test('Cyntexa run parses India jobs from the verified careers index and detail pages', async () => {
  const cyntexa = await loadModule()
  const requestedUrls = []

  const jobs = await cyntexa.createCyntexaScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === cyntexa.CAREERS_URL) return careersHtml
      if (url === 'https://cyntexa.com/careers/software-developer/') return softwareDeveloperDetailHtml
      if (url === 'https://cyntexa.com/careers/management-trainee/') return managementTraineeDetailHtml
      if (url === 'https://cyntexa.com/careers/salesforce-growth-strategy-consultant-usa/') return softwareDeveloperDetailHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    cyntexa.CAREERS_URL,
    'https://cyntexa.com/careers/software-developer/',
    'https://cyntexa.com/careers/management-trainee/',
    'https://cyntexa.com/careers/salesforce-growth-strategy-consultant-usa/',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'Software Developer')
  assert.equal(jobs[0].department, 'Engineering')
  assert.equal(jobs[0].location, 'Jaipur, India')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(jobs[1].title, 'Management Trainee')
  assert.equal(jobs[1].experienceRequired, 'Freshers')
})

test('Cyntexa fails closed when the verified careers contract drifts', async () => {
  const cyntexa = await loadModule()

  await assert.rejects(
    cyntexa.createCyntexaScraper().run({
      fetchText: async () => driftedHtml,
    }),
    /verified Cyntexa careers index/i,
  )
})
