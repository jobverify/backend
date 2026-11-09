import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadKreetiTechnologiesModule = async () => {
  try {
    return await import('../../scraper/kreetitechnologies/script.js')
  } catch {
    assert.fail('Expected Kreeti Technologies scraper module at ../../scraper/kreetitechnologies/script.js')
  }
}

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(currentDir, 'fixtures', 'kreetitechnologies')

const homepageHtml = readFileSync(path.join(fixturesDir, 'homepage.html'), 'utf8')
const careersHomeHtml = readFileSync(path.join(fixturesDir, 'careers-home.html'), 'utf8')
const candidatesHtml = readFileSync(path.join(fixturesDir, 'candidates.html'), 'utf8')
const jobDetailHtml = readFileSync(path.join(fixturesDir, 'job-48.html'), 'utf8')
const currentHomepageHtml = homepageHtml.replace(
  '<title>Web Development and Custom Application Development Company</title>',
  '<title>Kawach | Kreeti Technologies Pvt. Ltd.</title>',
).replace('150+ Successful Projects', '150 + Successful Projects')
  .replace('18 Years in Business', '18 Years of Excellence')

test('Kreeti Technologies scraper keeps the verified first-party homepage and careers app pinned', async () => {
  const kreeti = await loadKreetiTechnologiesModule()

  assert.equal(kreeti.SOURCE, 'kreetitechnologies')
  assert.equal(kreeti.COMPANY, 'Kreeti Technologies')
  assert.equal(kreeti.HOMEPAGE_URL, 'https://www.kreeti.com/')
  assert.equal(kreeti.CAREERS_HOME_URL, 'https://careers.kreeti.com/')
  assert.equal(kreeti.CANDIDATES_URL, 'https://careers.kreeti.com/candidates')
  assert.equal(kreeti.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(kreeti.hasOfficialHomepageSignal(currentHomepageHtml), true)
  assert.equal(kreeti.hasOfficialCareersHomeSignal(careersHomeHtml), true)
  assert.equal(kreeti.hasOfficialCandidatesSignal(candidatesHtml), true)

  assert.deepEqual(kreeti.extractListings(candidatesHtml), [])
})

test('Kreeti Technologies scraper enriches the verified first-party detail page into a normalized job record', async () => {
  const kreeti = await loadKreetiTechnologiesModule()

  const listing = { title: 'Agile Project Manager', jobId: '48', requisitionId: '48' }
  const job = kreeti.extractJobDetail(jobDetailHtml, listing)

  assert.equal(job.title, 'Agile Project Manager')
  assert.equal(job.jobId, '48')
  assert.equal(job.requisitionId, '48')
  assert.equal(job.sourceUrl, 'https://careers.kreeti.com/jobs/48')
  assert.equal(job.applyUrl, 'https://careers.kreeti.com/candidates/new?job_id=48')
  assert.equal(job.experienceRequired, '3 - 8 yrs')
  assert.equal(job.minimumQualification, 'Master of Business Administration (M.B.A.)')
  assert.ok(job.requiredSkills.includes('Agile Project Management'))
  assert.match(job.jobDescription, /Develop and execute activities related to end-to-end project management/i)
  assert.match(job.jobDescription, /Manages technical components of moderately complex IT projects/i)
})

test('Kreeti Technologies does not fetch stale detail pages linked only by the general-interest form', async () => {
  const kreeti = await loadKreetiTechnologiesModule()
  const requestedUrls = []
  const jobs = await kreeti.createKreetiTechnologiesScraper().run({ fetchText: async url => {
    requestedUrls.push(url)
    if (url === kreeti.HOMEPAGE_URL) return homepageHtml
    if (url === kreeti.CAREERS_HOME_URL) return careersHomeHtml
    if (url === kreeti.CANDIDATES_URL) return candidatesHtml
    assert.fail('General-interest roles are not active vacancies')
  } })
  assert.deepEqual(requestedUrls, [kreeti.HOMEPAGE_URL, kreeti.CAREERS_HOME_URL, kreeti.CANDIDATES_URL])
  assert.deepEqual(jobs, [])
})

test('Kreeti Technologies scraper returns no jobs when the verified candidates page has no public job options', async () => {
  const kreeti = await loadKreetiTechnologiesModule()

  const jobs = await kreeti.createKreetiTechnologiesScraper().run({
    fetchText: async (url) => {
      if (url === kreeti.HOMEPAGE_URL) return homepageHtml
      if (url === kreeti.CAREERS_HOME_URL) return careersHomeHtml
      if (url === kreeti.CANDIDATES_URL) {
        return candidatesHtml.replace('<option value="48">Agile Project Manager</option>', '')
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('Kreeti Technologies scraper fails closed when the verified first-party surface drifts', async () => {
  const kreeti = await loadKreetiTechnologiesModule()

  await assert.rejects(
    kreeti.createKreetiTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === kreeti.HOMEPAGE_URL) return '<html><body><h1>Unexpected homepage</h1></body></html>'
        if (url === kreeti.CAREERS_HOME_URL) return careersHomeHtml
        if (url === kreeti.CANDIDATES_URL) return candidatesHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    kreeti.createKreetiTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === kreeti.HOMEPAGE_URL) return homepageHtml
        if (url === kreeti.CAREERS_HOME_URL) return careersHomeHtml
        if (url === kreeti.CANDIDATES_URL) {
          return candidatesHtml
            .replace('<option value="48">Agile Project Manager</option>', '')
            .replace('No Open Positions', 'Open Positions')
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /candidate jobs page/i,
  )


})
