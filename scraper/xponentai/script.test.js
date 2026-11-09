import assert from 'node:assert/strict'
import test from 'node:test'
import {replay,mutateBody,fixture} from '../../test/test-data/xponentai20261108.js'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>xponent.ai</title>
  </head>
  <body>
    <main>
      <h1>xponent.ai</h1>
      <p>AI-led product engineering for modern enterprises.</p>
      <a href="https://xponent.ai/career/">Careers</a>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career &#8211; xponent.ai - accelerating outcomes</title>
  </head>
  <body>
    <main>
      <p>Join a team building AI-first products.</p>
      <section class="wp-job-openings">
        <h2>Current Openings</h2>
      </section>
      <div class="awsm-job-listings awsm-lists"></div>
    </main>
  </body>
</html>
`

const listings = [
  {
    id: 101,
    link: 'https://xponent.ai/jobs/ai-engineer/',
    title: { rendered: 'AI Engineer' },
    content: {
      rendered: `
        <p>Build production AI systems.</p>
        <ul>
          <li>Python</li>
          <li>LLM Ops</li>
        </ul>
      `,
    },
    class_list: [
      'post-101',
      'awsm_job_openings',
      'type-awsm_job_openings',
      'status-publish',
      'job-location-bengaluru',
      'job-type-full-time',
      'job-category-engineering',
      'job-mode-hybrid',
    ],
  },
  {
    id: 102,
    link: 'https://xponent.ai/jobs/genai-architect/',
    title: { rendered: 'GenAI Architect' },
    content: {
      rendered: `
        <p>Design enterprise GenAI platforms.</p>
        <ul>
          <li>Solution Architecture</li>
        </ul>
      `,
    },
    class_list: [
      'post-102',
      'awsm_job_openings',
      'type-awsm_job_openings',
      'status-publish',
      'job-location-remote',
      'job-type-contract',
      'job-category-architecture',
      'job-mode-remote',
    ],
  },
]

test('xponent.ai legacy helpers retain native evidence without inferring country or requisition identity', async () => {
  const xponent = await loadModule()
  assert.ok(xponent, 'xponent.ai scraper module should load')

  assert.equal(xponent.SOURCE, 'xponentai')
  assert.equal(xponent.COMPANY, 'xponent.ai')
  assert.equal(xponent.HOMEPAGE_URL, 'https://xponent.ai/')
  assert.equal(xponent.CAREERS_URL, 'https://xponent.ai/career/')
  assert.equal(xponent.CAREERS_API_URL, 'https://xponent.ai/wp-json/wp/v2/awsm_job_openings')
  assert.equal(xponent.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(xponent.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(
    xponent.buildSearchUrl(1),
    'https://xponent.ai/wp-json/wp/v2/awsm_job_openings?per_page=100&page=1',
  )

  const jobs = xponent.extractSearchResults(listings)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'AI Engineer',
    company: 'xponent.ai',
    department: 'Engineering',
    location: 'Bangalore',
    city: 'Bangalore',
    country: null,
    jobId: '101',
    requisitionId: null,
    sourceUrl: 'https://xponent.ai/jobs/ai-engineer/',
    applyUrl: 'https://xponent.ai/jobs/ai-engineer/',
    employmentType: 'Full Time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Python',
      'LLM Ops',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Build production AI systems. Python LLM Ops',
    remoteStatus: 'Hybrid',
  })
  assert.deepEqual(jobs[1], {
    title: 'GenAI Architect',
    company: 'xponent.ai',
    department: 'Architecture',
    location: 'Remote',
    city: null,
    country: null,
    jobId: '102',
    requisitionId: null,
    sourceUrl: 'https://xponent.ai/jobs/genai-architect/',
    applyUrl: 'https://xponent.ai/jobs/genai-architect/',
    employmentType: 'Contract',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Solution Architecture',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Design enterprise GenAI platforms. Solution Architecture',
    remoteStatus: 'Remote',
  })
})

test('xponent.ai factory runs the paired full-native route with captured responses and runner fields', async () => {
  const xponent = await loadModule()
  assert.ok(xponent, 'xponent.ai scraper module should load')
  const r = replay()
  let records
  const jobs = await xponent.createXponentAiScraper({...r.options, maxJobs: 2}).run({onRecords: value => { records = value }})
  assert.equal(jobs.length, 2)
  assert.equal(records.length, 10, 'selection must follow complete native retention')
  assert.equal(r.requests.length, 46)
  assert.deepEqual(r.uncaptured, [])
  assert.equal(jobs[0].source, 'xponentai')
  assert.equal(jobs[0].link, fixture.expected.nativeModels[0].link)
  assert.equal(jobs[0].scrapedAt, fixture.captureCompletedAt)
  assert.equal(jobs[0].sourceDescription, fixture.expected.roles[0].description)
  assert.equal(jobs[0].country, null)
  assert.equal(jobs[0].requisitionId, null)
})

test('xponent.ai holds changed primary and native collection contracts without uncontrolled requests', async () => {
  const xponent = await loadModule()
  assert.ok(xponent, 'xponent.ai scraper module should load')
  for (const surface of ['primary', 'feed']) {
    const r = replay({transform: packet => {
      if (surface === 'primary' && packet.requestedURL === xponent.CAREERS_URL) mutateBody(packet, '<html><body><h1>Placeholder</h1></body></html>')
      if (surface === 'feed' && packet.requestedURL === xponent.CAREERS_API_URL) mutateBody(packet, '{"total":0}')
    }})
    await assert.rejects(xponent.createXponentAiScraper().run(r.options), error => error.code === 'XPONENT_NATIVE_PROOF')
    assert.deepEqual(r.uncaptured, [])
    assert.equal(r.requests.length, surface === 'primary' ? 1 : 3)
  }
})
