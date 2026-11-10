import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate as turn } from 'node:timers/promises'
import { createChaseIndiaScraper, CORPORATE_CAREERS_URL, CANDIDATE_EXPERIENCE_URL, buildSearchUrl, buildJobDetailApiUrl } from '../../scraper/chaseindia/script.js'

const corporate = `<title>Careers | JPMorganChase</title><link rel="canonical" href="${CORPORATE_CAREERS_URL}">
  <a href="${CANDIDATE_EXPERIENCE_URL}">Join our team</a> Explore opportunities Equal Opportunity Employer`
const candidate = `<title>JPMC Candidate Experience page</title>
  <base href="/hcmUI/CandidateExperience/en/sites/CX_1001" data-apibaseurl="https://jpmc.fa.oraclecloud.com:443" data-sitenumber="CX_1001">
  Careers at Chase GLOBAL equal opportunity employer`
const roles = Array.from({ length: 8 }, (_, i) => ({ Id: String(910000 + i), Title: 'Engineer ' + i,
  PrimaryLocationCountry: 'IN', PrimaryLocation: 'Bengaluru, Karnataka, India', secondaryLocations: [] }))

test('registered Chase collection hydrates details in a bounded cohort and preserves inventory order', async () => {
  let active = 0, maximum = 0
  const jobs = await createChaseIndiaScraper({
    fetchText: async url => url === CORPORATE_CAREERS_URL ? corporate : candidate,
    fetchJson: async url => {
      if (url === buildSearchUrl()) return { items: [{ Limit: 24, TotalJobsCount: 8, requisitionList: roles }] }
      const role = roles.find(role => buildJobDetailApiUrl(role.Id) === url)
      assert.ok(role)
      maximum = Math.max(maximum, ++active)
      await turn()
      active--
      return { ...role, ExternalDescriptionStr: 'Design and build reliable engineering services, investigate production issues, and collaborate with the team on testing and delivery.' }
    },
  }).run()
  assert.equal(maximum, 4)
  assert.deepEqual(jobs.map(job => job.jobId), ['910000', '910001', '910002', '910003', '910004', '910005', '910006', '910007'])
  assert.ok(jobs.every(job => job.sourceDetailComplete))
})
