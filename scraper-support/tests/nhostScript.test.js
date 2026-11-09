import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  VERIFIED_ROLE_URLS,
  createNhostScraper,
  extractCareerRoleUrls,
  extractRoleDetail,
  hasOfficialCareersPageSignal,
  hasOfficialRoleDetailSignal,
} from '../../scraper/nhost/script.js'

const ROLE_URL = 'https://nhost.io/careers/senior-software-engineer-backend-operations'
const CAREERS_HTML = `
  <title>Careers and Open Positions | Nhost</title>
  <h1>Build the future of application development with us</h1>
  <h3>Remote, global, async</h3><h2>Open positions</h2>
  <p>1 open role — find the one that fits.</p>
  <a href="${ROLE_URL}">Senior Software Engineer, Backend & Operations</a>
  <a href="mailto:careers@nhost.io">Contact us</a>
`
const ROLE_HTML = `
  <title>Senior Software Engineer, Backend & Operations | Nhost</title>
  <a href="/careers">All open positions</a>
  <div>Engineering</div><h1>Senior Software Engineer, Backend & Operations</h1>
  <div>Remote Full-time 25-30 days vacation</div>
  <a href="mailto:careers@nhost.io?subject=Senior%20Software%20Engineer">Apply for this role</a>
  <h2>About the role</h2><p>Build backend systems.</p>
  <h2>What will you do?</h2><ul><li>Build cloud-native systems.</li></ul>
  <h2>What are we looking for?</h2><ul><li>4+ years of experience with Go.</li></ul>
  <h2>How to apply</h2><p>Email careers@nhost.io.</p>
`

test('Nhost validates the current complete first-party role inventory and detail', async () => {
  assert.deepEqual(VERIFIED_ROLE_URLS, [ROLE_URL])
  assert.deepEqual(extractCareerRoleUrls(CAREERS_HTML), [ROLE_URL])
  assert.equal(hasOfficialCareersPageSignal(CAREERS_HTML), true)
  assert.equal(hasOfficialRoleDetailSignal(ROLE_HTML, ROLE_URL), true)
  const job = extractRoleDetail(ROLE_HTML, ROLE_URL)
  assert.equal(job.title, 'Senior Software Engineer, Backend & Operations')
  assert.equal(job.country, 'Global')
  assert.equal(job.applyUrl, 'mailto:careers@nhost.io')
  assert.equal(job.jobId, 'senior-software-engineer-backend-operations')

  const requested = []
  const jobs = await createNhostScraper().run({
    fetchText: async (url) => {
      requested.push(url)
      if (url === CAREERS_URL) return CAREERS_HTML
      if (url === ROLE_URL) return ROLE_HTML
      throw new Error(`Unexpected URL: ${url}`)
    },
  })
  assert.deepEqual(requested, [CAREERS_URL, ROLE_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceUrl, ROLE_URL)
})

test('Nhost rejects inventory drift and unverified role details', async () => {
  assert.equal(hasOfficialCareersPageSignal(CAREERS_HTML.replace('1 open role', '2 open roles')), false)
  assert.equal(hasOfficialCareersPageSignal(CAREERS_HTML.replace(ROLE_URL, 'https://nhost.io/careers/other')), false)
  assert.equal(hasOfficialRoleDetailSignal(ROLE_HTML, 'https://nhost.io/careers/other'), false)
})
