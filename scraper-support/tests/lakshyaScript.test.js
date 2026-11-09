import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'lakshya',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const verifiedHomepageHtml = readFixture('homepage.html')
const verifiedCareersHtml = readFixture('careers.html')
const animationLeadMarkdown = readFixture('3d-animation-lead.md')

const loadLakshyaModule = async () => {
  try {
    return await import('../../scraper/lakshya/script.js')
  } catch {
    assert.fail('Expected Lakshya scraper module at ../../scraper/lakshya/script.js')
  }
}

test('Lakshya scraper recognizes the verified homepage and first-party careers listings shell', async () => {
  const lakshya = await loadLakshyaModule()

  assert.equal(lakshya.SOURCE, 'lakshya')
  assert.equal(lakshya.COMPANY, 'Lakshya')
  assert.equal(lakshya.HOMEPAGE_URL, 'https://lakshyadigital.com/')
  assert.equal(lakshya.CAREERS_URL, 'https://lakshyadigital.com/careers/')
  assert.equal(lakshya.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(lakshya.hasOfficialCareersSignal(verifiedCareersHtml), true)

  const jobs = lakshya.extractPublicJobs(verifiedCareersHtml)
  const titles = jobs.map((job) => job.title)

  assert.equal(jobs.length, 22)
  assert.ok(titles.includes('Dot Net Developer'))
  assert.ok(titles.includes('Junior Realtime VFX Artist'))
  assert.ok(titles.includes('Rigging Internship Program'))
  assert.ok(!titles.includes('VFX Artist Reviewer'))
  assert.ok(!titles.includes('3D Environment Artist / Sr. Environment Artist'))
  assert.ok(
    jobs.every((job) =>
      job.company === 'Lakshya'
      && job.country === 'India'
      && job.location.endsWith(', India')
      && job.workplaceType
      && job.applyUrl === job.sourceUrl
      && job.sourceUrl.startsWith('https://apply.workable.com/j/')
      && job.jobId === job.requisitionId),
  )
  assert.ok(jobs.some((job) => job.city === 'Gurugram' && job.state === 'Haryana'))
  assert.ok(jobs.some((job) => job.city === 'Pune' && job.state === 'Maharashtra'))
})

test('Lakshya scraper extracts experience from the official Workable markdown view', async () => {
  const lakshya = await loadLakshyaModule()

  assert.equal(
    lakshya.buildWorkableMarkdownUrl('7CBF88DEEF'),
    'https://apply.workable.com/lakshyadigitalglobal/jobs/view/7CBF88DEEF.md',
  )
  const detail = lakshya.extractWorkableJobDetail(animationLeadMarkdown)
  assert.equal(detail.department, 'Lakshya India')
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.experienceRequired, '3+ years')
  assert.ok(detail.jobDescription?.includes('Lakshya is Looking for Animation Lead'))
  assert.equal(detail.publicExperienceChecked, true)
})

test('Lakshya scraper returns the public India roles from the verified careers page', async () => {
  const lakshya = await loadLakshyaModule()
  const requestedUrls = []

  const jobs = await lakshya.createLakshyaScraper({
    now: () => '2026-07-11T06:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === lakshya.HOMEPAGE_URL) return verifiedHomepageHtml
      if (url === lakshya.CAREERS_URL) return verifiedCareersHtml
      if (url === 'https://apply.workable.com/lakshyadigitalglobal/jobs/view/7CBF88DEEF.md') {
        return animationLeadMarkdown
      }
      if (url.startsWith('https://apply.workable.com/lakshyadigitalglobal/jobs/view/')) {
        return '# Placeholder role'
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.equal(requestedUrls[0], lakshya.HOMEPAGE_URL)
  assert.equal(requestedUrls[1], lakshya.CAREERS_URL)
  assert.equal(
    requestedUrls.includes('https://apply.workable.com/lakshyadigitalglobal/jobs/view/7CBF88DEEF.md'),
    true,
  )
  assert.equal(jobs.length, 22)
  assert.equal(jobs[0].source, 'lakshya')
  assert.equal(jobs[0].company, 'Lakshya')
  assert.equal(jobs[0].companyCareerPage, 'https://lakshyadigital.com/careers/')
  assert.equal(jobs[0].companyDomain, 'lakshyadigital.com')
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
  assert.equal(jobs[0].scrapedAt, '2026-07-11T06:00:00.000Z')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(
    jobs.find((job) => job.title === '3D Animation Lead')?.experienceRequired,
    '3+ years',
  )
  assert.ok(
    jobs.find((job) => job.title === '3D Animation Lead')?.jobDescription?.includes('Lakshya is Looking for Animation Lead'),
  )
  assert.ok(
    jobs.find((job) => job.title === '3D Animation Lead')?.publicExperienceChecked === true,
  )
})

test('Lakshya scraper fails closed when the verified homepage or careers shell drifts materially', async () => {
  const lakshya = await loadLakshyaModule()

  await assert.rejects(
    lakshya.createLakshyaScraper().run({
      fetchText: async (url) => {
        if (url === lakshya.HOMEPAGE_URL) return '<html><title>Unexpected</title></html>'
        return verifiedCareersHtml
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    lakshya.createLakshyaScraper().run({
      fetchText: async (url) => {
        if (url === lakshya.HOMEPAGE_URL) return verifiedHomepageHtml
        return verifiedCareersHtml.replace(
          'Browse Current Openings',
          'Browse Open Roles',
        )
      },
    }),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    lakshya.createLakshyaScraper().run({
      fetchText: async (url) => {
        if (url === lakshya.HOMEPAGE_URL) return verifiedHomepageHtml
        return verifiedCareersHtml.replace(
          '<h4>Dot Net Developer</h4>',
          '<h5>Dot Net Developer</h5>',
        )
      },
    }),
    /job cards changed shape/i,
  )
})
