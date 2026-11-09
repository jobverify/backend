import assert from 'node:assert/strict'
import test from 'node:test'

const loadZemosoModule = async () => {
  try {
    return await import('../../scraper/zemosotechnologies/script.js')
  } catch {
    assert.fail('Expected Zemoso Technologies scraper module at ../../scraper/zemosotechnologies/script.js')
  }
}

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Zemoso Careers</title>
  </head>
  <body>
    <main>
      <h1>We create opportunities for you to work with innovation masterminds at Fortune 500 global enterprises.</h1>
      <h2>JOB OPENINGS</h2>
      <a href="/careers/webflow-developer">Webflow Developer</a>
      <p>Experienced</p>
      <p>Full-time</p>
      <p>All</p>
      <a href="/careers/scrum-master">Scrum Master</a>
      <p>Experienced</p>
      <p>Full-time</p>
      <p>Mumbai</p>
      <a href="https://forms.gle/example">Apply now</a>
      <p>Interested in a design or engineering internship?</p>
      <p>Send us your resume — we’ll be in touch if something opens up.</p>
    </main>
    <footer>
      <p>Zemoso Technologies</p>
      <a href="/careers">Careers</a>
    </footer>
  </body>
</html>
`

const closedWebflowDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Webflow Developer</h1>
    <p>Full-time</p>
    <p>All</p>
    <h2>Responsibilities</h2>
    <ul>
      <li>Design, develop, manage, and maintain the company website.</li>
    </ul>
    <a href="https://www.linkedin.com/jobs/view/1">Apply on LinkedIn</a>
    <p>Position Closed</p>
    <a href="https://zemosolabs-v1-com.webflow.io/careers">View job openings</a>
  </body>
</html>
`

const closedScrumMasterDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Scrum Master</h1>
    <p>Full-time</p>
    <p>Mumbai</p>
    <h2>Responsibilities</h2>
    <ul>
      <li>Coordinate sprints, retrospective meetings, and daily stand-ups.</li>
    </ul>
    <a href="https://www.linkedin.com/jobs/view/2">Apply on LinkedIn</a>
    <p>Position Closed</p>
    <a href="https://zemosolabs-v1-com.webflow.io/careers">View job openings</a>
  </body>
</html>
`

const openRoleDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Backend Engineer</h1>
    <p>Full-time</p>
    <p>Hyderabad</p>
    <a href="https://www.linkedin.com/jobs/view/3">Apply on LinkedIn</a>
  </body>
</html>
`

test('hasOfficialCareersSignal recognizes the verified Zemoso careers page and closed detail pages', async () => {
  const zemoso = await loadZemosoModule()

  assert.equal(zemoso.CAREERS_URL, 'https://www.zemosolabs.com/careers')
  assert.equal(zemoso.hasOfficialCareersSignal(careersPageHtml), true)
  assert.equal(zemoso.hasClosedRoleSignal(closedWebflowDetailHtml), true)
  assert.equal(zemoso.hasClosedRoleSignal(openRoleDetailHtml), false)
})

test('extractListings keeps only same-domain Zemoso role detail pages from the official careers page', async () => {
  const zemoso = await loadZemosoModule()

  assert.deepEqual(zemoso.extractListings(careersPageHtml), [
    {
      title: 'Webflow Developer',
      sourceUrl: 'https://www.zemosolabs.com/careers/webflow-developer',
    },
    {
      title: 'Scrum Master',
      sourceUrl: 'https://www.zemosolabs.com/careers/scrum-master',
    },
  ])
})

test('run returns no jobs while every public Zemoso role detail page is marked closed', async () => {
  const zemoso = await loadZemosoModule()
  const requestedUrls = []

  const jobs = await zemoso.createZemosoTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === zemoso.CAREERS_URL) return careersPageHtml
      if (url === 'https://www.zemosolabs.com/careers/webflow-developer') return closedWebflowDetailHtml
      if (url === 'https://www.zemosolabs.com/careers/scrum-master') return closedScrumMasterDetailHtml
      throw new Error(`Unexpected Zemoso fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    zemoso.CAREERS_URL,
    'https://www.zemosolabs.com/careers/webflow-developer',
    'https://www.zemosolabs.com/careers/scrum-master',
  ])
  assert.deepEqual(jobs, [])
})

test('run fails closed when the verified Zemoso careers surface changes or exposes an open role', async () => {
  const zemoso = await loadZemosoModule()

  await assert.rejects(
    zemoso.createZemosoTechnologiesScraper().run({
      fetchText: async () => '<html><body>No public Zemoso jobs page here</body></html>',
    }),
    /verified official public careers surface/i,
  )

  await assert.rejects(
    zemoso.createZemosoTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === zemoso.CAREERS_URL) return careersPageHtml
        return openRoleDetailHtml
      },
    }),
    /now exposes open public roles/i,
  )
})
