import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(currentDir, '../../scraper/estuatesoftwarepvtltd/fixtures')

const loadEstuateModule = async () => {
  try {
    return await import('../../scraper/estuatesoftwarepvtltd/script.js')
  } catch {
    assert.fail('Expected Estuate Software Pvt Ltd scraper module at ../../scraper/estuatesoftwarepvtltd/script.js')
  }
}

const readFixture = async (name) => readFile(path.join(fixturesDir, name), 'utf8')
const readJsonFixture = async (name) => JSON.parse(await readFixture(name))

test('Estuate validates the verified official homepage and careers surfaces and maps the first-party AWSM feed into India jobs', async () => {
  const estuate = await loadEstuateModule()
  const homepageHtml = await readFixture('homepage.html')
  const careersHtml = await readFixture('careers.html')
  const listings = await readJsonFixture('jobs-page-1.json')

  assert.equal(estuate.SOURCE, 'estuatesoftwarepvtltd')
  assert.equal(estuate.COMPANY, 'Estuate Software Pvt Ltd')
  assert.equal(estuate.HOMEPAGE_URL, 'https://www.estuate.com/')
  assert.equal(estuate.CAREERS_URL, 'https://www.estuate.com/company/careers')
  assert.equal(estuate.CAREERS_API_URL, 'https://www.estuate.com/wp-json/wp/v2/awsm_job_openings')

  assert.equal(estuate.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(estuate.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(
    estuate.buildSearchUrl(1),
    'https://www.estuate.com/wp-json/wp/v2/awsm_job_openings?_fields=id%2Clink%2Ctitle%2Ccontent%2Cclass_list&per_page=100&page=1',
  )

  const jobs = estuate.extractSearchResults(listings)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'SFDC Admin',
    company: 'Estuate Software Pvt Ltd',
    department: null,
    location: 'Anywhere in India',
    city: null,
    country: 'India',
    jobId: '62512',
    requisitionId: '62512',
    sourceUrl: 'https://www.estuate.com/jobs/sfdc-admin/',
    applyUrl: 'https://www.estuate.com/jobs/sfdc-admin/',
    employmentType: 'Full Time',
    experienceRequired: '5+ Years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Experience as an SFDC Administrator',
      'Experience with GitLab',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Currently, we are looking for a SFDC Admin to join our team. Job Description Experience as an SFDC Administrator Experience with GitLab',
    remoteStatus: 'Remote',
  })
  assert.equal(jobs[1].location, 'Bengaluru, India')
  assert.equal(jobs[1].experienceRequired, '7+ Years')
  assert.equal(jobs[1].remoteStatus, 'Hybrid')
})

test('Estuate run validates the official first-party surfaces, paginates the AWSM feed, and decorates runner fields', async () => {
  const estuate = await loadEstuateModule()
  const homepageHtml = await readFixture('homepage.html')
  const careersHtml = await readFixture('careers.html')
  const listings = await readJsonFixture('jobs-page-1.json')
  const emptyPage = await readJsonFixture('jobs-page-2-empty.json')
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await estuate.createEstuateSoftwarePvtLtdScraper({ pageSize: 2 }).run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      if (url === estuate.HOMEPAGE_URL) return homepageHtml
      if (url === estuate.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected HTML URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      if (url === estuate.buildSearchUrl(1, 2)) return listings.slice(0, 2)
      if (url === estuate.buildSearchUrl(2, 2)) return emptyPage
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
    now: () => '2026-07-10T06:00:00.000Z',
  })

  assert.deepEqual(requestedTextUrls, [
    'https://www.estuate.com/',
    'https://www.estuate.com/company/careers',
  ])
  assert.deepEqual(requestedJsonUrls, [
    'https://www.estuate.com/wp-json/wp/v2/awsm_job_openings?_fields=id%2Clink%2Ctitle%2Ccontent%2Cclass_list&per_page=2&page=1',
    'https://www.estuate.com/wp-json/wp/v2/awsm_job_openings?_fields=id%2Clink%2Ctitle%2Ccontent%2Cclass_list&per_page=2&page=2',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'estuatesoftwarepvtltd')
  assert.equal(jobs[0].link, 'https://www.estuate.com/jobs/sfdc-admin/')
  assert.equal(jobs[0].scrapedAt, '2026-07-10T06:00:00.000Z')
})

test('Estuate fails closed when the homepage, careers page, or AWSM feed changes materially', async () => {
  const estuate = await loadEstuateModule()
  const homepageHtml = await readFixture('homepage.html')
  const careersHtml = await readFixture('careers.html')

  await assert.rejects(
    estuate.createEstuateSoftwarePvtLtdScraper().run({
      fetchText: async (url) => {
        if (url === estuate.HOMEPAGE_URL) return '<html><title>Unexpected</title></html>'
        throw new Error(`Unexpected HTML URL: ${url}`)
      },
      fetchJson: async () => [],
    }),
    /verified official homepage surface/i,
  )

  await assert.rejects(
    estuate.createEstuateSoftwarePvtLtdScraper().run({
      fetchText: async (url) => {
        if (url === estuate.HOMEPAGE_URL) return homepageHtml
        if (url === estuate.CAREERS_URL) return '<html><title>Unexpected</title></html>'
        throw new Error(`Unexpected HTML URL: ${url}`)
      },
      fetchJson: async () => [],
    }),
    /verified official careers surface/i,
  )

  await assert.rejects(
    estuate.createEstuateSoftwarePvtLtdScraper().run({
      fetchText: async (url) => {
        if (url === estuate.HOMEPAGE_URL) return homepageHtml
        if (url === estuate.CAREERS_URL) return careersHtml
        throw new Error(`Unexpected HTML URL: ${url}`)
      },
      fetchJson: async () => ({ total: 0 }),
    }),
    /verified wp job openings feed/i,
  )
})
