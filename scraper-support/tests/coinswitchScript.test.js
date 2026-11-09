import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  createCoinSwitchScraper,
  extractRecruiterflowJobs,
} from '../../scraper/coinswitch/script.js'

const pageHtml = `
  <script>
    window.jobsList = {"department":[["Engineering",[{"apply_link":"coinswitch/jobs/662","details":"Bengaluru","employment_type":"Full time","job_id":662,"job_name":"Enterprise Security Engineer","last_opened":"2026-04-08T07:05:07+0000","remote_type":null}]],["Operations",[{"apply_link":"coinswitch/jobs/693","details":"Mumbai","employment_type":"Contract","job_id":693,"job_name":"Customer Experience Analyst","last_opened":"2026-06-12T08:58:22+0000","remote_type":"Remote"}]]],"group":[]};
  </script>
`

test('extractRecruiterflowJobs maps CoinSwitch Recruiterflow jobs into India records', () => {
  const jobs = extractRecruiterflowJobs(pageHtml)

  assert.deepEqual(jobs, [
    {
      title: 'Enterprise Security Engineer',
      company: 'CoinSwitch',
      department: 'Engineering',
      location: 'Bengaluru',
      city: 'Bengaluru',
      country: 'India',
      jobId: '662',
      requisitionId: '662',
      sourceUrl: 'https://recruiterflow.com/coinswitch/jobs/662',
      applyUrl: 'https://recruiterflow.com/coinswitch/jobs/662',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-04-08T07:05:07+0000',
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
    {
      title: 'Customer Experience Analyst',
      company: 'CoinSwitch',
      department: 'Operations',
      location: 'Mumbai',
      city: 'Mumbai',
      country: 'India',
      jobId: '693',
      requisitionId: '693',
      sourceUrl: 'https://recruiterflow.com/coinswitch/jobs/693',
      applyUrl: 'https://recruiterflow.com/coinswitch/jobs/693',
      employmentType: 'Contract',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-06-12T08:58:22+0000',
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'Remote',
    },
  ])
})

test('run fetches and decorates CoinSwitch jobs from the official Recruiterflow board', async () => {
  const scraper = createCoinSwitchScraper()
  const jobs = await scraper.run({
    fetchText: async (url) => {
      assert.equal(url, CAREER_PAGE_URL)
      return pageHtml
    },
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'coinswitch')
  assert.equal(jobs[0].link, 'https://recruiterflow.com/coinswitch/jobs/662')
  assert.ok(Date.parse(jobs[0].scrapedAt))
})
