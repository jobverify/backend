import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const loadImsLearningResourcesModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected IMS Learning Resources scraper module at ./script.js')
  }
}

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const officialCareersHtml = fs.readFileSync(
  path.join(currentDir, '../../scraper-support/tests/fixtures/imslearningresources/join-our-team.html'),
  'utf8',
)

test('IMS Learning Resources scraper validates the verified first-party join-our-team zero-jobs surface', async () => {
  const imsLearningResources = await loadImsLearningResourcesModule()

  assert.equal(imsLearningResources.SOURCE, 'imslearningresources')
  assert.equal(imsLearningResources.COMPANY, 'IMS Learning Resources')
  assert.equal(imsLearningResources.CAREERS_URL, 'https://www.imsindia.com/about-us/join-our-team/')
  assert.equal(imsLearningResources.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.deepEqual(imsLearningResources.extractSuspiciousPublicJobLinks(officialCareersHtml), [])
})

test('IMS Learning Resources scraper returns no jobs while the first-party page remains email-only', async () => {
  const imsLearningResources = await loadImsLearningResourcesModule()
  const requestedUrls = []

  const jobs = await imsLearningResources.createImsLearningResourcesScraper({
    now: () => '2026-09-14T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return officialCareersHtml
    },
  })

  assert.deepEqual(requestedUrls, [imsLearningResources.CAREERS_URL])
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs)?.status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs)?.reason, 'ims-learning-resources-email-only-careers-page')
})

test('IMS Learning Resources scraper fails closed when the verified page changes or public job links appear', async () => {
  const imsLearningResources = await loadImsLearningResourcesModule()

  await assert.rejects(
    imsLearningResources.createImsLearningResourcesScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /verified official careers surface/i,
  )

  await assert.rejects(
    imsLearningResources.createImsLearningResourcesScraper().run({
      fetchText: async () => officialCareersHtml.replace(
        '</main>',
        '<a href="https://jobs.imsindia.com/software-engineer">Current Openings</a></main>',
      ),
    }),
    /public job links/i,
  )

  await assert.rejects(
    imsLearningResources.createImsLearningResourcesScraper().run({
      fetchText: async () => officialCareersHtml.replace(
        '</main>',
        '<a href="https://job-boards.greenhouse.io/imslearningresources">See openings</a></main>',
      ),
    }),
    /public job links/i,
  )
})
