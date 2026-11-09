import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import * as cambridge from '../../scraper/cambridgetechnologyenterprises/script.js'
const fixture = (name) => readFileSync(new URL('./fixtures/cambridgetechnologyenterprises/' + name, import.meta.url), 'utf8')
const board = fixture('current-jobs.html')
const detail = fixture('current-detail.html')
const homepage = '<title>AI Cloud Solutions | Cambridge Technology Inc.</title><p>Cambridge Technology</p><a href="https://cambridgetechnology.freshteam.com/jobs">Open Positions</a>'
const runBoard = (listingHtml, detailHtml = detail) => cambridge.run({ fetchText: async (url) => url === cambridge.OFFICIAL_HOMEPAGE_URL ? homepage : url === cambridge.LISTING_URL ? listingHtml : detailHtml })

test('Cambridge reads all nine current Freshteam rows with separate title and location anchors', () => {
  const jobs = cambridge.extractListingJobs(board)
  assert.equal(jobs.length, 9)
  assert.equal(jobs[0].title, 'Business Analyst')
  assert.equal(jobs[0].locationText, 'Hyderabad, Telangana')
  assert.equal(jobs[0].employmentType, 'Full Time')
  assert.equal(new Set(jobs.map(j => j.detailUrl)).size, 9)
})

test('Cambridge rejects a partial row or an unrelated company detail URL', () => {
  assert.throws(() => cambridge.extractListingJobs(board.replace('class="job-title"', 'class="unrecognized-title"')), /incomplete/i)
  assert.throws(() => cambridge.extractListingJobs(board.replaceAll('/jobs/2WE1ZMkfs7C8/business-analyst', 'https://unrelated.example/jobs/2WE1ZMkfs7C8/business-analyst')), /trusted|first-party/i)
})

test('Cambridge validates current detail identity and excludes application form text from description', () => {
  const listing = { title: 'Business Analyst', detailUrl: 'https://cambridgetechnology.freshteam.com/jobs/2WE1ZMkfs7C8/business-analyst', locationText: 'Hyderabad, Telangana' }
  const job = cambridge.extractJobDetail(detail, listing)
  assert.equal(job.location, 'Hyderabad, Telangana, India')
  assert.match(job.jobDescription, /requirements gathering/i)
  assert.doesNotMatch(job.jobDescription, /Submit Your Application|Resume|First Name/i)
  assert.throws(() => cambridge.extractJobDetail(detail.replace('<h1 class="brand-color">Business Analyst', '<h1 class="brand-color">Another Vacancy'), listing), /detail|identity/i)
})

test('Cambridge does not return an empty success for an unparsed board or unknown remote geography', async () => {
  await assert.rejects(runBoard('<h1>Careers</h1><h2>Open Positions</h2><p>Choose Location</p>'), /incomplete|unverified|listing/i)
  await assert.rejects(runBoard(board.replaceAll('Hyderabad, Telangana', 'Remote')), /location|scope/i)
})


test('Cambridge homepage identity and careers handoff remain valid when marketing hero copy changes', () => {
  const current = '<title>AI Cloud Solutions | Cambridge Technology Inc.</title><p>Cambridge Technology</p><h1>Empowering Innovation</br>with Agentic AI</h1><a href="https://www.ctepl.com/careers/">Careers</a>'
  assert.equal(cambridge.hasOfficialHomepageSignal(current), true)
  assert.equal(cambridge.hasOfficialHomepageSignal(current.replace('AI Cloud Solutions | Cambridge Technology Inc.', 'Another Company')), false)
})
