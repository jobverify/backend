import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => import('./script.js')

const careersHtml = `
<!doctype html>
<html>
  <head>
    <title>Careers - Kissflow</title>
  </head>
  <body>
    <h1>We’re Redefining Work</h1>
    <p>We’re changing how work gets done — both in our office and around the world</p>
    <a href="/life-at-kissflow">Find your calling</a>
    <h2>Open Positions</h2>
    <a href="/solution-advisor">Solution Advisor Experience: 8 - 12 years Explore More</a>
    <a href="/client-director">Client Director Experience: 14 - 18 years Explore More</a>
    <h3>Always looking for passionate people to make our team better</h3>
    <h4>Contact Sales</h4>
  </body>
</html>
`

const solutionAdvisorHtml = `
<!doctype html>
<html>
  <head>
    <title>Solution Advisor</title>
  </head>
  <body>
    <h1>Solution Advisor</h1>
    <p>Experience: 8 - 12 years</p>
    <p>Work Location: Delhi&Mumbai</p>
    <a href="#apply">Apply now</a>
    <h2>Job Description:</h2>
    <p>As a Kissflow Solution Advisor, you will be the innovation driver and thought leader.</p>
    <h3>Required Skills</h3>
    <ul>
      <li>Enterprise solution design</li>
      <li>Workflow automation</li>
    </ul>
    <h3>Applicant Details</h3>
  </body>
</html>
`

const clientDirectorHtml = `
<!doctype html>
<html>
  <head>
    <title>Client Director</title>
  </head>
  <body>
    <h1>Client Director</h1>
    <p>Experience: 14 - 18 years</p>
    <p>Work Location: Chennai&Delhi&Mumbai</p>
    <a href="#apply">Apply now</a>
    <h2>Job Description:</h2>
    <p>The Kissflow Client Director will serve as a strategic advisor and trusted partner.</p>
    <h3>Required Skills</h3>
    <ul>
      <li>Digital transformation leadership</li>
    </ul>
    <h3>Applicant Details</h3>
  </body>
</html>
`

test('Kissflow recognizes the current careers page and extracts the live role cards', async () => {
  const kissflow = await loadModule()

  assert.equal(kissflow.hasVerifiedCareersPageSignal(careersHtml), true)

  const cards = kissflow.extractListingCards(careersHtml)
  assert.deepEqual(cards, [
    {
      title: 'Solution Advisor',
      sourceUrl: 'https://careers.kissflow.com/solution-advisor',
      experienceRequired: '8 - 12 years',
    },
    {
      title: 'Client Director',
      sourceUrl: 'https://careers.kissflow.com/client-director',
      experienceRequired: '14 - 18 years',
    },
  ])
})

test('Kissflow extracts the current generic detail-page headings and inline apply form content', async () => {
  const kissflow = await loadModule()

  const detail = kissflow.extractJobDetail(solutionAdvisorHtml, {
    title: 'Solution Advisor',
    sourceUrl: 'https://careers.kissflow.com/solution-advisor',
  })

  assert.equal(detail.title, 'Solution Advisor')
  assert.equal(detail.location, 'Delhi, Mumbai, India')
  assert.equal(detail.city, 'Delhi')
  assert.equal(detail.experienceRequired, '8 - 12 years')
  assert.match(detail.jobDescription, /innovation driver and thought leader/i)
  assert.deepEqual(detail.requiredSkills, [
    'Enterprise solution design',
    'Workflow automation',
  ])
})

test('Kissflow returns the current first-party India openings from the live careers site', async () => {
  const kissflow = await loadModule()

  const jobs = await kissflow.createKissflowScraper().run({
    fetchText: async (url) => {
      if (url === kissflow.CAREERS_URL) return careersHtml
      if (url === 'https://careers.kissflow.com/solution-advisor') return solutionAdvisorHtml
      if (url === 'https://careers.kissflow.com/client-director') return clientDirectorHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-08-15T12:00:00.000Z',
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'Solution Advisor')
  assert.equal(jobs[0].location, 'Delhi, Mumbai, India')
  assert.equal(jobs[1].title, 'Client Director')
  assert.equal(jobs[1].location, 'Chennai, Delhi, Mumbai, India')
})
