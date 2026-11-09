import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { extractJobs } from '../scraper/flexsintechnologies/script.js'
import { extractJobDetail as bahwanDetail } from '../scraper/bahwancybertek/script.js'
import { extractSearchResults, extractJobDetail as phenomDetail } from '../scraper/thermofisherscientific/script.js'
import { normalizeScrapedJob } from '../scraper-support/utils/normalizeScrapedJob.js'
import { postScrapeInput, resolvePostScrapeClassification } from '../src/services/postScrapeClassification.js'

const now = new Date('2026-11-06T04:00:00Z')
const prediction = { modelLabel: 'Full-time Experienced', windows: 1, fullDescriptionCovered: true,
  scores: { 'Full-time Experienced': .97, 'Full-time Fresher': .01, Intern: .01, Contract: .01 } }
const assertClassifiable = (job, expectedMinimum) => {
  const input = postScrapeInput(job, { now })
  assert.equal(input.incomplete, false)
  assert.equal(input.sourceFields.description, '')
  const result = resolvePostScrapeClassification(job, prediction, { now, mode: 'policy' })
  assert.equal(result.resolved.jobType, 'Full-time Experienced')
  assert.equal(result.resolved.employerExperienceProfile.minimumYears, expectedMinimum)
}

test('Flexsin native card experience remains employer evidence when its detail description is unavailable', () => {
  const [job] = extractJobs(`<ul class="jobsList"><li>
    <a href="https://www.flexsin.com/careers/software-engineer-python/" class="inner">
    <div class="hd">Software Engineer - Python</div><div class="info">1-3 Yrs</div>
    <div class="info location">Noida</div></a></li></ul>`)
  assert.equal(job.sourceExperienceRequired, '1-3 Yrs')
  assert.equal(job.jobDescription, null)
  const normalized = normalizeScrapedJob(job, { source: 'flexsintechnologies', companyName: 'Flexsin Technologies' })
  assert.equal(normalized.sourceExperienceRequired, '1-3 Yrs')
  assertClassifiable(normalized, 1)
})

test('Bahwan native XML experience survives an empty jobDesc without inventing description text', () => {
  const xml = readFileSync(new URL('../scraper-support/tests/fixtures/bahwancybertek/job-detail-888299.xml', import.meta.url), 'utf8')
    .replace(/<jobDesc>[\s\S]*?<\/jobDesc>/, '<jobDesc></jobDesc>')
  const detail = bahwanDetail(xml, { title: 'Database Admin', jobId: '888299' })
  assert.equal(detail.sourceExperienceRequired, '4 - 7 Years')
  const normalized = normalizeScrapedJob(detail, { source: 'bahwancybertek', companyName: 'Bahwan CyberTek' })
  assertClassifiable(normalized, 4)
})

test('Phenom listing metadata retains explicit native experience and employment provenance', () => {
  const [job] = extractSearchResults({ jobs: [{ reqId: 'R-123', jobId: 'R-123', title: 'Engineer',
    country: 'India', city: 'Bengaluru', type: 'Full time', experience: '5 years', ml_highlight: null }] })
  assert.equal(job.sourceExperienceRequired, '5 years')
  assert.equal(job.sourceEmploymentType, 'Full-time')
  const normalized = normalizeScrapedJob(job, { source: 'thermofisherscientific', companyName: 'Thermo Fisher Scientific' })
  assertClassifiable(normalized, 5)
})

test('Phenom listings without employer experience remain incomplete rather than inheriting inferred public values', () => {
  const [job] = extractSearchResults({ jobs: [{ reqId: 'R-124', title: 'Engineer', country: 'India', type: 'Full time' }] })
  assert.equal(job.sourceExperienceRequired ?? null, null)
  assert.equal(postScrapeInput(job, { now }).incomplete, true)
})

for (const [wording, expectedCategory] of [
  ['Preferred: 3 years of experience.', 'Full-time Experienced'],
  ['Fresh graduates or 3 years of experience may apply.', 'Full-time Fresher'],
]) test(`Phenom preserves native preferred/alternative context: ${wording}`, () => {
  const description = `${wording} Responsibilities: Develop software for customers and test production services.`
  const native = { reqId: 'R-context', title: 'Engineer', country: 'India', type: 'Full time',
    experience: wording, descriptionTeaser: description }
  const [listing] = extractSearchResults({ jobs: [native] })
  const nativeDetail = { ...native, ml_Description: description, experience_sentences: [wording] }
  const detail = phenomDetail(`<script>phApp.ddo = ${JSON.stringify({ jobDetail: { data: { job: nativeDetail } } })};</script>`, listing)
  for (const nativeRow of [listing, detail]) {
    const row = normalizeScrapedJob(nativeRow, { source: 'thermofisherscientific', companyName: 'Thermo Fisher Scientific' })
    assert.equal(row.sourceExperienceRequired ?? null, null)
    const result = resolvePostScrapeClassification(row, prediction, { now, mode: 'policy' })
    assert.equal(result.resolved.jobType, expectedCategory)
    if (wording.startsWith('Preferred')) {
      assert.equal(result.resolved.experienceProfile.minimumYears, null)
      assert.equal(result.resolved.experienceProfile.preferredMinimumYears, 3)
    }
  }
})
