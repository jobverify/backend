import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(currentDir, 'fixtures')

const loadMcMenonModule = async () => import('./script.js')

const homepageHtml = fs.readFileSync(path.join(fixturesDir, 'homepage.html'), 'utf8')
const careersHtml = fs.readFileSync(path.join(fixturesDir, 'careers.html'), 'utf8')

test('McMenon Engineering Services recognizes the verified homepage and email-only careers page', async () => {
  const mcmenon = await loadMcMenonModule()

  assert.equal(mcmenon.SOURCE, 'mcmenonengineeringservices')
  assert.equal(mcmenon.COMPANY, 'McMenon Engineering Services Ltd.')
  assert.equal(mcmenon.HOMEPAGE_URL, 'https://www.mcmenon.com/')
  assert.equal(mcmenon.CAREERS_URL, 'https://www.mcmenon.com/careers/')
  assert.equal(mcmenon.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(mcmenon.hasVerifiedCareersLink(homepageHtml), true)
  assert.equal(mcmenon.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(mcmenon.hasEmailOnlyCareersSignal(careersHtml), true)
  assert.equal(mcmenon.hasPublicJobsSignal(careersHtml), false)
})

test('McMenon Engineering Services returns no jobs from the verified first-party careers surface', async () => {
  const mcmenon = await loadMcMenonModule()
  const requestedUrls = []

  const jobs = await mcmenon.createMcMenonEngineeringServicesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === mcmenon.HOMEPAGE_URL) {
        return homepageHtml
      }

      if (url === mcmenon.CAREERS_URL) {
        return careersHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [mcmenon.HOMEPAGE_URL, mcmenon.CAREERS_URL])
  assert.deepEqual(jobs, [])
})


test('McMenon validates its current relative careers handoff and explicit empty vacancy inventory', async () => {
  const mcmenon = await loadMcMenonModule()
  const { readInventoryEvidence } = await import('../../scraper-support/utils/inventoryEvidence.js')
  const currentHome = fs.readFileSync(path.join(fixturesDir, 'homepage-current.html'), 'utf8')
  const currentCareers = fs.readFileSync(path.join(fixturesDir, 'careers-current.html'), 'utf8')
  const jobs = await mcmenon.run({ fetchText: async (url) => url === mcmenon.HOMEPAGE_URL ? currentHome : currentCareers })
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(mcmenon.hasVerifiedCareersLink(currentHome.replaceAll('href="/careers/"', 'href="https://unrelated.example/careers/"')), false)
  assert.equal(mcmenon.hasPublicJobsSignal(currentCareers.replace('</main>', '<p>Vacancy: CNC Machinist. Apply now</p></main>')), true)
})


test('McMenon rejects actual postings or missing current vacancy state even beside the known empty copy', async () => {
  const mcmenon = await loadMcMenonModule()
  const currentHome = fs.readFileSync(path.join(fixturesDir, 'homepage-current.html'), 'utf8')
  const currentCareers = fs.readFileSync(path.join(fixturesDir, 'careers-current.html'), 'utf8')
  for (const html of [
    currentCareers.replace('</main>', '<script type="application/ld+json">{"@type":"JobPosting","title":"CNC Machinist"}</script></main>'),
    currentCareers.replaceAll('There are no current vacancies at the moment.', 'Inventory temporarily unavailable'),
    currentCareers.replace('</main>', '<a href="/careers/cnc-machinist/">CNC Machinist</a></main>'),
  ]) {
    await assert.rejects(mcmenon.run({ fetchText: async (url) => url === mcmenon.HOMEPAGE_URL ? currentHome : html }), /public jobs surface|vacancy inventory is unavailable/i)
  }
})
