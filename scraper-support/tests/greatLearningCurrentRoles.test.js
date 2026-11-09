import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createGreatLearningScraper, extractGreatLearningJobs } from '../../scraper/greatlearning/script.js'

const html = readFileSync(new URL('./fixtures/greatlearning/current-openings.html', import.meta.url), 'utf8')
const run = (page = html) => createGreatLearningScraper({ darwinboxScraper: { run: () => assert.fail('Current forms must use the first-party role cards') } }).run({ fetchText: async () => page })

test('Great Learning retains all five archived text cards as unqualified observations without invented IDs or countries', async () => {
  const jobs = await run()
  assert.equal(jobs.length, 5)
  assert.equal(new Set(jobs.map(job => job.sourceUrl)).size, 5)
  assert.ok(jobs.every(job => job.jobId === null && job.requisitionId === null && job.sourceDetailComplete === false))
  assert.equal(jobs.filter(job => job.applyUrl === 'https://forms.gle/bUvqUzojCZtJYgqi8').length, 2)
  assert.ok(jobs.every(job => job.country === null && job.sourceUrl.startsWith('https://www.mygreatlearning.com/careers/')))
  assert.ok(jobs.every(job => job.jobDescription.length > 250))
  assert.match(jobs.find(job => job.title.startsWith('Lead, Development')).jobDescription, /Ensure programs deliver strong learner outcomes/)
  assert.match(jobs.find(job => job.title.startsWith('Manager')).jobDescription, /Manage email lifecycles/)
  assert.equal(jobs.find(job => job.title.startsWith('Data Scientist')).experienceRequired, '1+ years')
  assert.equal(jobs.find(job => job.title.startsWith('Spanish')).experienceRequired, '0–2 years')
})

test('Great Learning fails closed if any current card loses its role, location, details or application', async () => {
  for (const page of [
    html.replace('class="job-position"', 'class="position-changed"'),
    html.replace('class="location-name"', 'class="location-changed"'),
    html.replace('class="job-details"', 'class="details-changed"'),
    html.replace('https://forms.gle/iKvK3TsqfgFrrn7e7', 'https://unrelated.example/apply'),
    html.replace('data-job-link=', 'data-changed-link='),
  ]) await assert.rejects(run(page), /incomplete|card|application/i)
})

test('Great Learning does not infer India from an unknown or Indianapolis location', async () => {
  for (const location of ['Remote', 'Indianapolis, IN, US']) {
    const jobs = await run(html.replaceAll('Bangalore and Gurgaon', location))
    assert.ok(jobs.some(job => job.nativeLocation === location))
    assert.ok(jobs.every(job => job.country === null && job.location === null && job.sourceCountryScopeUnresolved))
  }
})

test('Great Learning rejects a duplicate card instead of silently dropping it', () => {
  const card = html.match(/<li[\s\S]*?<\/li>/)[0]
  assert.throws(() => extractGreatLearningJobs(html.replace('</ul>', `${card}</ul>`)), /duplicate|complete/i)
})

test('Great Learning cancellation reaches the listing transport', async () => {
  const controller = new AbortController()
  const reason = new Error('cancel Great Learning')
  controller.abort(reason)
  await assert.rejects(createGreatLearningScraper().run({ signal: controller.signal, fetchText: () => assert.fail('aborted') }), error => error === reason)
})
