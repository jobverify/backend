import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadInnsparkModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Innspark scraper module at ./script.js')
  }
}

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const careersHtml = fs.readFileSync(
  path.join(currentDir, '../../scraper-support/tests/fixtures/innspark/careers.html'),
  'utf8',
)
const applyHtml = fs.readFileSync(
  path.join(currentDir, '../../scraper-support/tests/fixtures/innspark/apply.html'),
  'utf8',
)

test('Innspark scraper validates the verified first-party careers page and apply form', async () => {
  const innspark = await loadInnsparkModule()

  assert.equal(innspark.SOURCE, 'innspark')
  assert.equal(innspark.COMPANY, 'Innspark')
  assert.equal(innspark.CAREERS_URL, 'https://innspark.in/careers/')
  assert.equal(innspark.APPLY_URL, 'https://innspark.in/apply/')
  assert.equal(innspark.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(innspark.hasOfficialApplySignal(applyHtml), true)
  assert.deepEqual(innspark.extractApplyRoleOptions(applyHtml), [
    'Embedded Systems Engineer (Drone / UAS development)',
    'C++ Engineer Qt-based Application Development (Drone / UAS development)',
    'Computer Vision Engineer (Drone / UAS development)',
    'SOC Analyst (L1 / L2)',
    'Security Analyst',
    'Flutter Developer',
    'Technical Support Executive',
    'Technical Content Writer',
    'Sales Manager',
    'Video Editor & Animation',
    'Digital Marketing Expert',
    'Others',
  ])
})

test('Innspark scraper extracts current openings from the official careers page and validates them against the first-party apply form', async () => {
  const innspark = await loadInnsparkModule()

  const jobs = innspark.extractCareerJobs(careersHtml)
  assert.equal(jobs.length, 11)
  assert.deepEqual(jobs[0], {
    title: 'Embedded Systems Engineer (Drone / UAS development)',
    company: 'Innspark',
    department: null,
    location: 'Kerala, India',
    city: 'Kerala',
    country: 'India',
    jobId: 'innspark-embedded-systems-engineer-drone-uas-development',
    requisitionId: 'innspark-embedded-systems-engineer-drone-uas-development',
    sourceUrl: 'https://innspark.in/careers/',
    applyUrl: 'https://innspark.in/apply/',
    employmentType: 'Full-Time',
    experienceRequired: 'Minimum 2 year',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Job Title: Embedded Systems Engineer Location: Kerala Employment Type: Full-Time Experience Level: Minimum 2 year Job Overview: We are looking for an Embedded Systems Engineer - Electronics to design, develop, and test embedded systems for cutting-edge electronic applications.',
  })

  const titleSet = new Set(jobs.map((job) => job.title))
  assert.equal(titleSet.has('SOC Analyst (L1 / L2)'), true)
  assert.equal(titleSet.has('Security Analyst'), true)
  assert.equal(titleSet.has('Sales Manager'), true)
  assert.equal(titleSet.has('Digital Marketing Expert'), true)

  assert.doesNotThrow(() => innspark.assertApplyFormMatchesJobs(jobs, applyHtml))
})

test('Innspark run returns mapped jobs from the verified first-party careers flow', async () => {
  const innspark = await loadInnsparkModule()
  const requestedUrls = []

  const jobs = await innspark.createInnsparkScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === innspark.CAREERS_URL) return careersHtml
      if (url === innspark.APPLY_URL) return applyHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    innspark.CAREERS_URL,
    innspark.APPLY_URL,
  ])
  assert.equal(jobs.length, 11)
  assert.equal(jobs[0].source, 'innspark')
  assert.equal(jobs[0].link, innspark.APPLY_URL)
  assert.equal(jobs[0].company, 'Innspark')
})

test('Innspark run falls back to a tolerant HTTP parser when the live first-party pages return the broken HTTP/1.1 response shape', async () => {
  const innspark = await loadInnsparkModule()
  const requestedPrimaryUrls = []
  const requestedTolerantUrls = []

  const jobs = await innspark.createInnsparkScraper().run({
    fetchText: async (url) => {
      requestedPrimaryUrls.push(url)
      throw new TypeError('fetch failed | Response does not match the HTTP/1.1 protocol (Missing expected CR after header value)')
    },
    fetchProtocolTolerantText: async (url) => {
      requestedTolerantUrls.push(url)
      if (url === innspark.CAREERS_URL) return careersHtml
      if (url === innspark.APPLY_URL) return applyHtml
      throw new Error(`Unexpected tolerant URL: ${url}`)
    },
  })

  assert.deepEqual(requestedPrimaryUrls, [
    innspark.CAREERS_URL,
    innspark.APPLY_URL,
  ])
  assert.deepEqual(requestedTolerantUrls, [
    innspark.CAREERS_URL,
    innspark.APPLY_URL,
  ])
  assert.equal(jobs.length, 11)
  assert.equal(jobs[0].source, 'innspark')
  assert.equal(jobs[0].company, 'Innspark')
})

test('Innspark scraper fails closed when the verified first-party careers flow changes', async () => {
  const innspark = await loadInnsparkModule()

  await assert.rejects(
    innspark.createInnsparkScraper().run({
      fetchText: async (url) => {
        if (url === innspark.CAREERS_URL) {
          return '<html><body><h1>Careers</h1></body></html>'
        }

        return applyHtml
      },
    }),
    /verified official careers surface/i,
  )

  await assert.rejects(
    innspark.createInnsparkScraper().run({
      fetchText: async (url) => {
        if (url === innspark.CAREERS_URL) return careersHtml
        if (url === innspark.APPLY_URL) {
          return applyHtml.replace('Digital Marketing Expert', '')
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /first-party apply form no longer matches/i,
  )

  await assert.rejects(
    innspark.createInnsparkScraper().run({
      fetchText: async (url) => {
        if (url === innspark.CAREERS_URL) {
          return careersHtml.replace(
            '<h5>Sales Manager</h5>',
            '<h5>Threat Researcher</h5>',
          )
        }
        if (url === innspark.APPLY_URL) return applyHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /first-party apply form no longer matches/i,
  )
})
