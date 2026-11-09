import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'cisco',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const loadAppDynamicsModule = async () => {
  try {
    return await import('../../scraper/appdynamics/script.js')
  } catch {
    assert.fail('Expected AppDynamics scraper module at ../../scraper/appdynamics/script.js')
  }
}

test('buildSearchResultsPageUrl keeps AppDynamics listings on the verified Cisco Careers Splunk route', async () => {
  const appDynamics = await loadAppDynamicsModule()

  assert.equal(
    appDynamics.buildSearchResultsPageUrl(),
    'https://careers.cisco.com/global/en/splunk/search-page?sortBy=Most+recent&size=100',
  )
  assert.equal(
    appDynamics.buildSearchResultsPageUrl(10),
    'https://careers.cisco.com/global/en/splunk/search-page?sortBy=Most+recent&size=100&from=10',
  )
})

test('run reuses the shared Phenom parser and decorates AppDynamics runner metadata', async () => {
  const appDynamics = await loadAppDynamicsModule()
  const requestedUrls = []

  const jobs = await appDynamics.run({
    maxPages: 1,
    maxJobs: 1,
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === appDynamics.buildSearchResultsPageUrl()) {
        return readFixture('search-results-page-0.html')
      }
      if (url === 'https://careers.cisco.com/global/en/job/2012591/ASIC-Signal-and-Power-Integrity-Technical-Leader-10-to-16-Years-BangaloreChennai') {
        return readFixture('job-detail-2012591.html')
      }
      throw new Error(`Unexpected AppDynamics fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    appDynamics.buildSearchResultsPageUrl(),
    'https://careers.cisco.com/global/en/job/2012591/ASIC-Signal-and-Power-Integrity-Technical-Leader-10-to-16-Years-BangaloreChennai',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'AppDynamics')
  assert.equal(jobs[0].source, 'appdynamics')
  assert.equal(jobs[0].jobId, '2012591')
  assert.equal(jobs[0].sourceUrl, 'https://careers.cisco.com/global/en/job/2012591/ASIC-Signal-and-Power-Integrity-Technical-Leader-10-to-16-Years-BangaloreChennai')
  assert.equal(jobs[0].applyUrl, 'https://cisco.wd5.myworkdayjobs.com/Cisco_Careers/job/Bangalore-India/ASIC---Signal-and-Power-Integrity-Technical-Leader---12-to-17-Years---Bangalore-Chennai_2012591/apply')
})
