import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
  <html>
    <body>
      <h1>Come drive the future of logistics</h1>
      <h2>Open roles</h2>
      <p>Email us at careers@shipsy.io</p>

      <a href="/careers/software-engineer-core-platform">
        <span>Generalist IC</span>
        <span>2-4 yrs</span>
        <strong>Software Engineer, Core Platform</strong>
        <span>Strong foundations, any pillar.</span>
        <span>Gurugram.</span>
        <span>Read the role &rarr;</span>
      </a>

      <a href="/careers/director-engineering">
        <span>Pillar Owner</span>
        <span>5-8 yrs</span>
        <strong>Director, Engineering</strong>
        <span>Own a pillar end-to-end.</span>
        <span>Gurugram.</span>
        <span>Read the role &rarr;</span>
      </a>

      <a href="/careers/lead-events-emea">
        <span>Lead: Events — EMEA</span>
      </a>

      <a href="/careers">View all careers</a>
    </body>
  </html>
`

const detailHtml = `
  <html>
    <body>
      <h1>Software Engineer, Core Platform</h1>
      <p>Team</p>
      <p>Engineering</p>
      <p>Experience</p>
      <p>2-4 yrs</p>
      <p>Employment</p>
      <p>Full-time</p>
      <p>Gurugram</p>
      <h2>About the role</h2>
      <p>Build across the platform.</p>
      <p>Strong foundations. Generalist by design.</p>
      <h2>Show your interest</h2>
      <a href="mailto:careers@shipsy.io?subject=Software%20Engineer%2C%20Core%20Platform">Apply</a>
    </body>
  </html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/shipsy/script.js')
  } catch {
    assert.fail('Expected Shipsy scraper module at ../../scraper/shipsy/script.js')
  }
}

test('Shipsy recognizes the verified careers page and current role-link shape', async () => {
  const shipsy = await loadModule()

  assert.equal(shipsy.SOURCE, 'shipsy')
  assert.equal(shipsy.COMPANY, 'Shipsy')
  assert.equal(shipsy.CAREERS_URL, 'https://www.shipsy.ai/careers')
  assert.equal(shipsy.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(shipsy.extractRoleCards(careersHtml), [
    {
      title: 'Software Engineer, Core Platform',
      detailUrl: 'https://www.shipsy.ai/careers/software-engineer-core-platform',
    },
    {
      title: 'Director, Engineering',
      detailUrl: 'https://www.shipsy.ai/careers/director-engineering',
    },
  ])
})

test('Shipsy detail parsing keeps the live Gurugram role contract normalized', async () => {
  const shipsy = await loadModule()

  assert.deepEqual(
    shipsy.extractJobFromDetailHtml(
      detailHtml,
      {
        title: 'Software Engineer, Core Platform',
        detailUrl: 'https://www.shipsy.ai/careers/software-engineer-core-platform',
      },
      { scrapedAt: '2026-07-24T12:00:00.000Z' },
    ),
    {
      title: 'Software Engineer, Core Platform',
      company: 'Shipsy',
      department: 'Engineering',
      location: 'Gurugram, India',
      city: 'Gurugram',
      country: 'India',
      jobId: 'software-engineer-core-platform',
      requisitionId: 'software-engineer-core-platform',
      sourceUrl: 'https://www.shipsy.ai/careers/software-engineer-core-platform',
      applyUrl: 'mailto:careers@shipsy.io?subject=Software%20Engineer%2C%20Core%20Platform',
      employmentType: 'Full-time',
      experienceRequired: '2-4 yrs',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Strong foundations. Generalist by design.'],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Build across the platform. Strong foundations. Generalist by design.',
      remoteStatus: 'On-site',
      source: 'shipsy',
      link: 'https://www.shipsy.ai/careers/software-engineer-core-platform',
      scrapedAt: '2026-07-24T12:00:00.000Z',
    },
  )
})

test('Shipsy run ignores unrelated careers links and returns normalized India jobs', async () => {
  const shipsy = await loadModule()
  const requestedUrls = []

  const jobs = await shipsy.createShipsyScraper({
    now: () => '2026-07-24T12:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === shipsy.CAREERS_URL) return careersHtml
      if (url === 'https://www.shipsy.ai/careers/software-engineer-core-platform') return detailHtml
      if (url === 'https://www.shipsy.ai/careers/director-engineering') return detailHtml
      throw new Error(`Unexpected URL ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    shipsy.CAREERS_URL,
    'https://www.shipsy.ai/careers/software-engineer-core-platform',
    'https://www.shipsy.ai/careers/director-engineering',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'shipsy')
  assert.equal(jobs[0].country, 'India')
})
