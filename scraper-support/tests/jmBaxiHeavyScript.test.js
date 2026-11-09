import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const fixturesDir = new URL('../../scraper/jmbaxiheavy/fixtures/', import.meta.url)

const readFixture = (name) => readFileSync(new URL(name, fixturesDir), 'utf8')

const homepageHtml = readFixture('homepage.html')
const careersHtml = readFixture('career.html')
const jobSearchHtml = readFixture('job-search.html')
const jobListHtml = readFixture('job-list.html')
const jobListResponse = JSON.parse(readFixture('job-list-empty.json'))

const loadModule = async () => {
  try {
    return await import('../../scraper/jmbaxiheavy/script.js')
  } catch {
    assert.fail('Expected JM Baxi Heavy scraper module at ../../scraper/jmbaxiheavy/script.js')
  }
}

test('JM Baxi Heavy keeps the verified first-party careers surface constants pinned', async () => {
  const jmBaxiHeavy = await loadModule()
  const liveLikeHomepageHtml = homepageHtml
    .replace(/J M Baxi Group, founded in 1916/gi, 'Welcome to J M Baxi Group Founded in 1916')
    .replace(/Here['’]s to creating opportunities!?/gi, "India's maritime and trade landscape")
  const liveLikeJobSearchHtml = jobSearchHtml
    .replace(/Select Department Engineering/gi, 'Select Department Operations')
    .replace(/Select Location Navi Mumbai/gi, 'Find Authentic Jobs')
  const liveLikeJobListHtml = jobListHtml.replace(/<title>\s*Job Search \| J M Baxi\s*<\/title>/i, '<title>Job List | J M Baxi</title>')

  assert.equal(jmBaxiHeavy.SOURCE, 'jmbaxiheavy')
  assert.equal(jmBaxiHeavy.COMPANY, 'JM Baxi Heavy')
  assert.equal(jmBaxiHeavy.HOMEPAGE_URL, 'https://www.jmbaxi.com/')
  assert.equal(jmBaxiHeavy.CAREERS_URL, 'https://www.jmbaxi.com/career/')
  assert.equal(jmBaxiHeavy.JOB_SEARCH_URL, 'https://www.jmbaxi.com/career/job-search.html')
  assert.equal(
    jmBaxiHeavy.JOB_LIST_URL,
    'https://www.jmbaxi.com/career/job-list.html?home_action=home_search&home_department=Engineering',
  )
  assert.equal(
    jmBaxiHeavy.JOB_LIST_POST_URL,
    'https://www.jmbaxi.com/career/job-list.html',
  )
  assert.equal(
    jmBaxiHeavy.RESUME_SUBMIT_URL,
    'https://jmbone.darwinbox.in/ms/candidate/careers/others?apply=1',
  )
  assert.equal(jmBaxiHeavy.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(jmBaxiHeavy.hasOfficialHomepageSignal(liveLikeHomepageHtml), true)
  assert.equal(jmBaxiHeavy.hasCareersPageSignal(careersHtml), true)
  assert.equal(jmBaxiHeavy.hasJobSearchPageSignal(jobSearchHtml), true)
  assert.equal(jmBaxiHeavy.hasJobSearchPageSignal(liveLikeJobSearchHtml), true)
  assert.equal(jmBaxiHeavy.hasJobListShellSignal(jobListHtml), true)
  assert.equal(jmBaxiHeavy.hasJobListShellSignal(liveLikeJobListHtml), true)
  assert.equal(jmBaxiHeavy.isVerifiedNoJobsResponse(jobListResponse), true)
})

test('JM Baxi Heavy scraper returns no jobs while the verified first-party job board stays empty', async () => {
  const jmBaxiHeavy = await loadModule()
  const requested = []

  const jobs = await jmBaxiHeavy.createJmBaxiHeavyScraper().run({
    fetchText: async (url) => {
      requested.push({ method: 'GET', url })

      if (url === jmBaxiHeavy.HOMEPAGE_URL) return homepageHtml
      if (url === jmBaxiHeavy.CAREERS_URL) return careersHtml
      if (url === jmBaxiHeavy.JOB_SEARCH_URL) return jobSearchHtml
      if (url === jmBaxiHeavy.JOB_LIST_URL) return jobListHtml

      throw new Error(`Unexpected GET URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requested.push({ method: options.method || 'GET', url, options })

      assert.equal(url, jmBaxiHeavy.JOB_LIST_POST_URL)
      assert.equal(options.method, 'POST')
      assert.equal(options.headers['X-Requested-With'], 'XMLHttpRequest')
      assert.equal(options.headers.Referer, jmBaxiHeavy.JOB_LIST_URL)
      assert.equal(options.body, 'action=joblist&search_by_text=&selectedDesignationOpt=%5B%5D&selectedDepartmentOpt=%5B%22Engineering%22%5D&selectedLocationOpt=%5B%5D&page=1')

      return jobListResponse
    },
  })

  assert.equal(requested.length, 5)
  assert.deepEqual(requested.slice(0, 4), [
    { method: 'GET', url: jmBaxiHeavy.HOMEPAGE_URL },
    { method: 'GET', url: jmBaxiHeavy.CAREERS_URL },
    { method: 'GET', url: jmBaxiHeavy.JOB_SEARCH_URL },
    { method: 'GET', url: jmBaxiHeavy.JOB_LIST_URL },
  ])
  assert.equal(requested[4].method, 'POST')
  assert.equal(requested[4].url, jmBaxiHeavy.JOB_LIST_POST_URL)
  assert.deepEqual(jobs, [])
})

test('JM Baxi Heavy fails closed if the first-party job board starts returning public postings', async () => {
  const jmBaxiHeavy = await loadModule()

  await assert.rejects(
    jmBaxiHeavy.createJmBaxiHeavyScraper().run({
      fetchText: async (url) => {
        if (url === jmBaxiHeavy.HOMEPAGE_URL) return homepageHtml
        if (url === jmBaxiHeavy.CAREERS_URL) return careersHtml
        if (url === jmBaxiHeavy.JOB_SEARCH_URL) return jobSearchHtml
        if (url === jmBaxiHeavy.JOB_LIST_URL) return jobListHtml
        throw new Error(`Unexpected GET URL: ${url}`)
      },
      fetchJson: async () => ({
        ...jobListResponse,
        jobshtml: '<div class="job-card"><a href="/career/job-details.html?id=jm-001">Engineering Manager</a></div>',
        totalPages: 1,
        totalRecords: 1,
      }),
    }),
    /public job postings/i,
  )
})
