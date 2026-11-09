import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(currentDir, 'fixtures', 'healthiummedtech')
const healthiumJsonFixturePath = path.join(fixturesDir, 'careers-page-live.json')
const healthiumHtmlFixturePath = path.join(fixturesDir, 'careers-live.html')

const loadHealthiumModule = async () => {
  try {
    return await import('../../scraper/healthiummedtech/script.js')
  } catch {
    return null
  }
}

test('Healthium Medtech scraper extracts accordion jobs from the verified WordPress careers surface', async () => {
  const healthium = await loadHealthiumModule()
  assert.ok(healthium, 'Expected Healthium Medtech scraper module at ../../scraper/healthiummedtech/script.js')

  const [pagePayloadText, careersHtml] = await Promise.all([
    readFile(healthiumJsonFixturePath, 'utf8'),
    readFile(healthiumHtmlFixturePath, 'utf8'),
  ])

  const renderedHtml = healthium.extractRenderedHtmlFromPagePayload(pagePayloadText)
  const jsonJobs = healthium.extractAccordionJobs(renderedHtml)
  const htmlJobs = healthium.extractAccordionJobs(careersHtml)

  assert.equal(healthium.COMPANY, 'Healthium Medtech')
  assert.equal(healthium.SOURCE, 'healthiummedtech')
  assert.equal(
    healthium.CAREERS_PAGE_URL,
    'https://healthiummedtech.com/careers/',
  )
  assert.equal(
    healthium.CAREERS_PAGE_API_URL,
    'https://healthiummedtech.com/wp-json/wp/v2/pages?slug=careers',
  )

  assert.equal(jsonJobs.length, htmlJobs.length)
  assert.ok(jsonJobs.length >= 25, 'Expected the verified careers snapshot to expose many accordion jobs')

  const maintenanceJob = jsonJobs.find((job) => job.title === 'Executive - Maintenance')
  assert.ok(maintenanceJob, 'Expected Executive - Maintenance to be present in the verified careers snapshot')
  assert.equal(maintenanceJob.location, 'Noida, India')
  assert.equal(maintenanceJob.city, 'Noida')
  assert.equal(maintenanceJob.country, 'India')
  assert.equal(maintenanceJob.department, null)
  assert.equal(maintenanceJob.experienceRequired, '3+ years')
  assert.equal(maintenanceJob.applyUrl, 'mailto:careers@healthiummedtech.com')
  assert.match(maintenanceJob.jobDescription, /Roles & Responsibilities/i)
  assert.match(maintenanceJob.jobDescription, /Perform preventive and breakdown maintenance activities\./i)
  assert.match(maintenanceJob.jobDescription, /Qualifications/i)
  assert.match(maintenanceJob.jobDescription, /Diploma or Degree in Engineering\./i)

  const endoJob = jsonJobs.find((job) => job.title === 'Product Manager - Endo')
  assert.ok(endoJob, 'Expected Product Manager - Endo to be present in the verified careers snapshot')
  assert.equal(endoJob.department, null)
  assert.equal(endoJob.location, 'Hebbal, Bengaluru, India')
  assert.equal(endoJob.city, 'Bangalore')
  assert.equal(endoJob.experienceRequired, '5+ years')
})

test('run fetches the verified Healthium Medtech WordPress careers payload and decorates jobs', async () => {
  const healthium = await loadHealthiumModule()
  assert.ok(healthium, 'Expected Healthium Medtech scraper module at ../../scraper/healthiummedtech/script.js')

  const pagePayloadText = await readFile(healthiumJsonFixturePath, 'utf8')
  const requestedUrls = []

  const jobs = await healthium.createHealthiumMedtechScraper({ maxJobs: 1 }).run({
    fetchJson: async (url) => {
      requestedUrls.push(url)
      if (url !== healthium.CAREERS_PAGE_API_URL) {
        throw new Error(`Unexpected URL: ${url}`)
      }

      return JSON.parse(pagePayloadText)
    },
  })

  assert.deepEqual(requestedUrls, [healthium.CAREERS_PAGE_API_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'healthiummedtech')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].applyUrl, 'mailto:careers@healthiummedtech.com')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
