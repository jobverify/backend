import assert from 'node:assert/strict'
import test from 'node:test'

const OFFICIAL_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Gate Careers | Crypto & Web3 Jobs at Gate | Gate.com</title>
  </head>
  <body>
    <main>
      <h1>Join Gate &amp; Shape A New Career Chapter|</h1>
      <p>Join global innovators to shape the future of crypto finance and create your own impact.</p>
      <p>0 Open Positions 0 Job Categories Remote Global Team</p>
      <section>
        <h2>Our Culture, One Gate</h2>
        <p>Direct communication, clear ownership, and results-driven collaboration.</p>
      </section>
      <section>
        <h2>Our Core Values</h2>
        <p>Innovation, cooperation, insight, curiosity, and integrity - the principles that guide how we work.</p>
      </section>
      <section>
        <h2>Why Gate</h2>
        <p>Rewards, growth, flexibility, and a global stage - all here.</p>
      </section>
      <section>
        <h2>Unlock Your Next Career Chapter</h2>
        <p>View All Positions (0)</p>
      </section>
      <section>
        <h2>Gate News &amp; Insights</h2>
        <a href="https://www.linkedin.com/company/gateio/">LinkedIn</a>
      </section>
    </main>
  </body>
</html>
`

const LEVER_BOARD_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Gate</title>
  </head>
  <body>
    <main>
      <label>Location type</label>
      <p>Location All</p>
      <p>Team All</p>
      <label>Work type</label>
      <a href="https://www.gate.com/">Gate Home Page</a>
      <article>
        <h2>Business Development Manager</h2>
        <button>Apply</button>
      </article>
    </main>
  </body>
</html>
`

const LEVER_JOBS = [
  {
    id: 'gate-1',
    text: 'Business Development Manager',
    hostedUrl: 'https://jobs.lever.co/gate/gate-1',
    applyUrl: 'https://jobs.lever.co/gate/gate-1/apply',
    createdAt: 1761772800000,
    country: 'IN',
    workplaceType: 'Remote',
    categories: {
      location: 'Remote',
      team: 'Business Development',
      commitment: 'Full-time remote',
    },
    descriptionPlain: 'Build strategic partnerships.',
  },
  {
    id: 'gate-2',
    text: 'AML Analyst',
    hostedUrl: 'https://jobs.lever.co/gate/gate-2',
    createdAt: 1761859200000,
    country: 'SG',
    workplaceType: 'Onsite',
    categories: {
      location: 'Singapore',
      team: 'Risk Control',
    },
    descriptionPlain: 'Support AML reviews.',
  },
]

const loadGateModule = async () => {
  try {
    return await import('../../scraper/gate/script.js')
  } catch {
    assert.fail('Expected Gate scraper module at ../../scraper/gate/script.js')
  }
}

test('Gate preserves the legacy Lever parser without using its retired board at runtime', async () => {
  const gate = await loadGateModule()

  assert.equal(gate.SOURCE, 'gate')
  assert.equal(gate.COMPANY, 'Gate')
  assert.equal(gate.OFFICIAL_CAREERS_URL, 'https://www.gate.com/careers')
  assert.equal(gate.LEVER_BOARD_URL, 'https://jobs.lever.co/gate')
  assert.equal(gate.LEVER_ENDPOINT, 'https://api.lever.co/v0/postings/gate?mode=json')
  assert.equal(gate.hasOfficialCareersSignal(OFFICIAL_CAREERS_HTML), true)
  assert.equal(gate.hasLeverBoardSignal(LEVER_BOARD_HTML), true)
  assert.deepEqual(gate.extractLeverJobs(LEVER_JOBS), [
    {
      title: 'Business Development Manager',
      company: 'Gate',
      department: 'Business Development',
      location: 'Remote',
      city: 'Remote',
      country: 'India',
      jobId: 'gate-1',
      requisitionId: 'gate-1',
      sourceUrl: 'https://jobs.lever.co/gate/gate-1',
      applyUrl: 'https://jobs.lever.co/gate/gate-1/apply',
      employmentType: 'Full-time remote',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2025-10-29T21:20:00.000Z',
      closingDate: null,
      jobDescription: 'Build strategic partnerships.',
      remoteStatus: 'Remote',
    },
    {
      title: 'AML Analyst',
      company: 'Gate',
      department: 'Risk Control',
      location: 'Singapore',
      city: 'Singapore',
      country: 'Singapore',
      jobId: 'gate-2',
      requisitionId: 'gate-2',
      sourceUrl: 'https://jobs.lever.co/gate/gate-2',
      applyUrl: 'https://jobs.lever.co/gate/gate-2',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2025-10-30T21:20:00.000Z',
      closingDate: null,
      jobDescription: 'Support AML reviews.',
      remoteStatus: 'On-site',
    },
  ])
})

test('Gate run confirms zero from its first-party API rather than the loading shell', async () => {
  const gate = await loadGateModule()
  const jobs = await gate.run({
    fetchText: async (url) => { assert.equal(url, 'https://www.gate.com/careers'); return OFFICIAL_CAREERS_HTML },
    fetchJson: async (url) => {
      const path = new URL(url).pathname
      if (path.endsWith('/taxonomies')) return { code: 0, data: { job_categories: [], employment_types: [] } }
      assert.equal(path, '/api/web/v1/tst/career/positions')
      return { code: 0, data: { total: 0, page: 1, limit: 50, list: [] } }
    },
  })
  assert.deepEqual(jobs, [])
})
test('Gate rejects changed careers identity and propagates upstream failure', async () => {
  const gate = await loadGateModule()
  await assert.rejects(gate.run({ fetchText: async () => '<title>Other careers</title>' }), /official Gate careers surface/)
  await assert.rejects(gate.run({ fetchText: async () => OFFICIAL_CAREERS_HTML, fetchJson: async () => { throw new Error('HTTP 503 upstream') } }), /HTTP 503 upstream/)
})
