import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  KULA_JOBS_URL,
  createLionsbotScraper,
  extractKulaInventoryJobs,
  hasOfficialCareersSignal,
} from './script.js'

const careersHtml = `
  <title>Careers at LionsBot | Robotics Jobs in Singapore</title>
  <h1>Start your career at LionsBot.</h1>
  <p>Openings change often, so the live list is on the job board rather than on this page.</p>
  <a href="https://careers.kula.ai/lionsbot">See open roles</a>
`
const boardHtml = (jobs) => `
  <title>LionsBot International Pte Ltd Careers | Open Jobs</title>
  <link rel="canonical" href="https://careers.kula.ai/lionsbot" />
  <script>self.__next_f.push(${JSON.stringify([1, `1:{"jobs":${JSON.stringify(jobs)},"departments":[],"accountName":"lionsbot"}`])})</script>
`
const roles = [
  { id: 1001, title: 'India Support Engineer', ats_job: { offices: [{ country: 'India', location: 'Tamil Nadu, India' }] } },
  { id: 1002, title: 'Singapore Engineer', ats_job: { offices: [{ country: 'Singapore', location: 'Singapore, Central Singapore' }] } },
]

test('LionsBot parses the complete current Kula React Flight inventory', async () => {
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
  assert.equal(extractKulaInventoryJobs(boardHtml(roles)).length, 2)
  const requested = []
  const jobs = await createLionsbotScraper().run({
    fetchText: async (url) => {
      requested.push(url)
      if (url === CAREER_PAGE_URL) return careersHtml
      if (url === KULA_JOBS_URL) return boardHtml(roles)
      throw new Error(`Unexpected URL: ${url}`)
    },
  })
  assert.deepEqual(requested, [CAREER_PAGE_URL, KULA_JOBS_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'India Support Engineer')
  assert.equal(jobs[0].location, 'Tamil Nadu, India')
})

test('LionsBot rejects a branded board without a complete jobs payload', async () => {
  assert.throws(() => extractKulaInventoryJobs(boardHtml(roles).replaceAll('jobs', 'staleJobs')))
})
