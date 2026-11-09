import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { hydrateProviderCatalogEntry } from '../providers/index.js'
import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'
import { postScrapeInput } from '../../src/services/postScrapeClassification.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/akriviaautomation/script.js')

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Akrivia Automation - Enterprise SaaS | Digital Transformation</title>
  </head>
  <body>
    <h1>Careers @ Akrivia</h1>
    <h2>JOB APPLICATION FORM</h2>
    <form action="assets/jobformmail.php">
      <label>Job *</label>
      <select name="field_6" id="field_6">
        <option>- Please Select Option -</option>
        <option>UI/UX Designer</option>
        <option>SEO</option>
        <option>Backend Developer</option>
        <option>Job Title 4</option>
        <option>More Jobs Here</option>
      </select>
      <input type="submit" value="Submit">
    </form>
    <p>Akrivia Automation Pvt. Ltd.</p>
  </body>
</html>
`

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/akriviaautomation/catalog.js')
  } catch {
    assert.fail('Expected Akrivia Automation catalog module at ../../scraper/akriviaautomation/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/akriviaautomation/script.js')
  } catch {
    assert.fail('Expected Akrivia Automation scraper module at ../../scraper/akriviaautomation/script.js')
  }
}

test('Akrivia application options preserve missing source descriptions through classification input', async () => {
  const akrivia = await loadScriptModule()
  const jobs = await akrivia.createAkriviaAutomationScraper().run({ fetchText: async () => careersHtml })
  assert.ok(jobs.length > 0)
  for (const job of jobs) {
    assert.equal(job.jobDescription, null)
    assert.equal(job.preserveExistingSourceContent, true)
    assert.equal(job.publicExperienceChecked, true)
    const normalized = normalizeScrapedJob(job)
    assert.equal(normalized.sourceDescription, '')
    assert.equal(normalized.jobDescription, null)
    assert.equal(normalized.experienceRequired, null)
    const input = postScrapeInput(normalized)
    assert.equal(input.body, '')
    assert.equal(input.incomplete, true)
  }
})

test('Akrivia Automation local catalog captures the verified first-party careers form surface', async () => {
  const { AKRIVIA_AUTOMATION_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(AKRIVIA_AUTOMATION_CATALOG)

  assert.equal(defaultCatalog, AKRIVIA_AUTOMATION_CATALOG)
  assert.equal(provider.source, 'akriviaautomation')
  assert.equal(provider.companyName, 'Akrivia Automation')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.akrivia.in/career/jobs/careers.html')
  assert.equal(provider.companyDomain, 'akrivia.in')
  assert.equal(provider.atsPlatform, 'official-company-careers-form')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-form-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-form+inline-job-select-options+same-page-application-form',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /UI\/UX Designer/i)
  assert.match(provider.verifiedSurfaceSummary, /Backend Developer/i)
})

test('Akrivia Automation scraper keeps only non-placeholder public job options from the first-party form', async () => {
  const akrivia = await loadScriptModule()

  assert.equal(akrivia.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(
    akrivia.extractJobOptions(careersHtml),
    ['UI/UX Designer', 'SEO', 'Backend Developer'],
  )
})

test('Akrivia Automation run validates the careers form and returns same-page apply jobs', async () => {
  const akrivia = await loadScriptModule()
  const jobs = await akrivia.createAkriviaAutomationScraper().run({
    fetchText: async () => careersHtml,
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.deepEqual(
    jobs.map((job) => [job.title, job.applyUrl, job.location, job.country]),
    [
      ['UI/UX Designer', akrivia.CAREERS_URL, 'India', 'India'],
      ['SEO', akrivia.CAREERS_URL, 'India', 'India'],
      ['Backend Developer', akrivia.CAREERS_URL, 'India', 'India'],
    ],
  )
})
