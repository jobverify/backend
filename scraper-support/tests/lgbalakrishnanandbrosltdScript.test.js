import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'lgbalakrishnanandbrosltd',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const HOMEPAGE_HTML = readFixture('homepage.html')
const CAREERS_HTML = readFixture('careers.html')
const JOB_APPLY_A1494_HTML = readFixture('job-apply-a1494.html')

const loadModule = async () => {
  try {
    return await import('../../scraper/lgbalakrishnanandbrosltd/script.js')
  } catch {
    assert.fail('Expected L.G.Balakrishnan & Bros Ltd scraper module at ../../scraper/lgbalakrishnanandbrosltd/script.js')
  }
}

test('L.G.Balakrishnan & Bros Ltd scraper validates the verified homepage and careers portal, then extracts public job cards', async () => {
  const lgb = await loadModule()

  assert.equal(lgb.SOURCE, 'lgbalakrishnanandbrosltd')
  assert.equal(lgb.COMPANY, 'L.G.Balakrishnan & Bros Ltd')
  assert.equal(lgb.HOMEPAGE_URL, 'https://www.lgb.co.in/')
  assert.equal(lgb.CAREERS_URL, 'https://careers.lgbportal.co.in/')
  assert.equal(lgb.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(lgb.hasOfficialCareersSignal(CAREERS_HTML), true)

  const jobs = lgb.extractPublicJobs(CAREERS_HTML)

  assert.equal(jobs.length, 10)
  assert.deepEqual(jobs[0], {
    title: 'Assistant - Quality Inspection - Quality Assurance - Plant Function',
    company: 'L.G.Balakrishnan & Bros Ltd',
    department: null,
    location: 'VALLAM VADAGAL, ORAGADAM, KANCHEEPURAM-602105, India',
    city: 'KANCHEEPURAM',
    country: 'India',
    jobId: 'A1494',
    requisitionId: 'A1494',
    sourceUrl: 'https://careers.lgbportal.co.in/job_apply/500a04a2-0045-4da7-a703-801ab4092c42',
    applyUrl: 'https://careers.lgbportal.co.in/job_apply/500a04a2-0045-4da7-a703-801ab4092c42',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  })
  assert.equal(jobs.at(-1)?.jobId, 'A1295')
})

test('L.G.Balakrishnan & Bros Ltd extracts experience and qualifications from the official job apply page', async () => {
  const lgb = await loadModule()

  assert.deepEqual(lgb.extractPublicJobDetail(JOB_APPLY_A1494_HTML), {
    experienceRequired: '2 - 4 years',
    minimumQualification: 'Diploma - (Mechanical / Automobile Engineering) - Good, Certification - (Quality control tools) - Preferred',
    jobDescription: 'Inspect incoming and in-process components for quality compliance. Document defects and support corrective action follow-through.',
  })
})

test('L.G.Balakrishnan & Bros Ltd run fetches the verified first-party pages and decorates the job cards for persistence', async () => {
  const lgb = await loadModule()
  const requestedUrls = []

  const jobs = await lgb.createLgbalakrishnanAndBrosLtdScraper({
    now: () => '2026-07-11T07:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === lgb.HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === lgb.CAREERS_URL) return CAREERS_HTML
      if (url.startsWith('https://careers.lgbportal.co.in/job_apply/')) return JOB_APPLY_A1494_HTML

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.equal(requestedUrls[0], lgb.HOMEPAGE_URL)
  assert.equal(requestedUrls[1], lgb.CAREERS_URL)
  assert.equal(
    requestedUrls.includes('https://careers.lgbportal.co.in/job_apply/500a04a2-0045-4da7-a703-801ab4092c42'),
    true,
  )
  assert.equal(jobs.length, 10)
  assert.equal(jobs[0].source, 'lgbalakrishnanandbrosltd')
  assert.equal(jobs[0].companyCareerPage, 'https://careers.lgbportal.co.in/')
  assert.equal(jobs[0].companyDomain, 'lgb.co.in')
  assert.equal(jobs[0].atsPlatform, 'official-first-party-candidate-portal')
  assert.equal(jobs[0].scrapedAt, '2026-07-11T07:00:00.000Z')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].experienceRequired, '2 - 4 years')
  assert.equal(
    jobs[0].minimumQualification,
    'Diploma - (Mechanical / Automobile Engineering) - Good, Certification - (Quality control tools) - Preferred',
  )
})

test('L.G.Balakrishnan & Bros Ltd skips stale job cards whose public apply pages are no longer available', async () => {
  const lgb = await loadModule()

  const jobs = await lgb.createLgbalakrishnanAndBrosLtdScraper({
    now: () => '2026-08-01T11:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      if (url === lgb.HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === lgb.CAREERS_URL) return CAREERS_HTML
      if (url === 'https://careers.lgbportal.co.in/job_apply/fb1d5978-695d-4f9a-bf7f-e42fbc78274c') {
        const error = new Error(`HTTP 400 for ${url}`)
        error.status = 400
        throw error
      }
      if (url.startsWith('https://careers.lgbportal.co.in/job_apply/')) return JOB_APPLY_A1494_HTML

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 9)
  assert.equal(
    jobs.some((job) => job.applyUrl === 'https://careers.lgbportal.co.in/job_apply/fb1d5978-695d-4f9a-bf7f-e42fbc78274c'),
    false,
  )
})

test('L.G.Balakrishnan & Bros Ltd fails closed when the verified homepage or careers portal drifts', async () => {
  const lgb = await loadModule()

  await assert.rejects(
    lgb.createLgbalakrishnanAndBrosLtdScraper().run({
      fetchText: async (url) => {
        if (url === lgb.HOMEPAGE_URL) {
          return '<html><head><title>Unexpected</title></head><body>No LGB markers</body></html>'
        }

        return CAREERS_HTML
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    lgb.createLgbalakrishnanAndBrosLtdScraper().run({
      fetchText: async (url) => {
        if (url === lgb.HOMEPAGE_URL) return HOMEPAGE_HTML

        return CAREERS_HTML.replace('Your LGB journey starts here', 'Explore roles')
      },
    }),
    /verified official careers/i,
  )
})
