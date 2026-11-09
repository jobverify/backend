import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadModule = () => import('../../scraper/renesas/script.js')
const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'renesas')
const fixture = (name) => fs.readFileSync(path.join(fixturesDir, name), 'utf8')
const FIXED_SCRAPED_AT = '2026-09-13T10:30:00.000Z'

const page = ({ page = 1, total = 2, jobs = [] } = {}) => `
  <div class="attrax-pagination__total-results">${total} result(s)</div>
  ${jobs.map((job) => `
    <div class="attrax-vacancy-tile" data-jobid="${job.id}">
      <a class="attrax-vacancy-tile__title" href="/job/${job.slug}">${job.title}</a>
      <div class="attrax-vacancy-tile__location-freetext"><p class="attrax-vacancy-tile__item-value">${job.location}</p></div>
      <div class="attrax-vacancy-tile__option-location"><p class="attrax-vacancy-tile__item-value">${job.city}</p></div>
      <div class="attrax-vacancy-tile__option-function"><p class="attrax-vacancy-tile__item-value">Engineering</p></div>
      <div class="attrax-vacancy-tile__option-type-of-employment"><p class="attrax-vacancy-tile__item-value">Full-time</p></div>
      <div class="attrax-vacancy-tile__option-remote"><p class="attrax-vacancy-tile__item-value">No</p></div>
      <div class="attrax-vacancy-tile__description-value">${job.description}</div>
    </div>
  `).join('')}
  <span data-page="${page}"></span>
`

test('Renesas parser extracts official India job cards', async () => {
  const scraper = await loadModule()
  const [job] = scraper.extractRenesasJobs(page({ jobs: [{
    id: '5997',
    slug: 'principal-engineer',
    title: 'Principal Software Engineer &amp; Test',
    location: 'Bengaluru, KA, India',
    city: 'Bengaluru',
    description: 'Build test automation with 10+ years of experience in embedded software validation.',
  }] }))

  assert.equal(job.title, 'Principal Software Engineer & Test')
  assert.equal(job.company, 'Renesas Electronics')
  assert.equal(job.city, 'Bengaluru')
  assert.equal(job.country, 'India')
  assert.equal(job.jobId, '5997')
  assert.equal(job.link, 'https://jobs.renesas.com/job/principal-engineer')
  assert.equal(job.department, 'Engineering')
  assert.equal(job.experienceRequired, '10+ years')
  assert.equal(job.publicExperienceChecked, false)
})

test('Renesas detail parser extracts complete source text with employer paragraph breaks', async () => {
  const scraper = await loadModule()
  const detail = scraper.extractRenesasJobDetail(fixture('job-detail.html'))

  assert.equal(detail.jobDescription, [
    'Job Description',
    '',
    'Design and verify next-generation SoCs for automotive products.',
    '',
    'Partner with architecture and RTL teams through sign-off.',
    '',
    'Key Responsibilities',
    '',
    '- Build reusable UVM verification environments',
    '- Review functional coverage and debug regressions',
    '',
    'Qualifications',
    '',
    'At least 3 years of experience in SoC verification and UVM.',
  ].join('\n'))
  assert.equal(detail.experienceRequired, '3+ years')
  assert.equal(detail.publicExperienceChecked, true)
})

test('Renesas detail parser rejects an unavailable-description placeholder', async () => {
  const scraper = await loadModule()
  const detail = scraper.extractRenesasJobDetail(`
    <div class="description-widget">
      <div aria-label="Job description">
        <div class="jobad-jobdescription">Job Description</div>
        <p>Job description unavailable.</p>
      </div>
    </div>
  `)

  assert.equal(detail, null)
})

test('Renesas scraper replaces a card preview with its complete detail and fetch timestamp', async () => {
  const scraper = await loadModule()
  const jobs = await scraper.createRenesasScraper({ now: () => FIXED_SCRAPED_AT }).run({
    fetchText: async (url) => url.includes('/Jobs?')
      ? page({ jobs: [{
          id: '5997',
          slug: 'principal-verification-engineer',
          title: 'Principal Verification Engineer',
          location: 'Bengaluru, KA, India',
          city: 'Bengaluru',
          description: 'Short card preview that ends before the qualifications.',
        }] })
      : fixture('job-detail.html'),
  })

  assert.equal(jobs.length, 1)
  assert.match(jobs[0].jobDescription, /Partner with architecture and RTL teams through sign-off\.\n\nKey Responsibilities/)
  assert.equal(jobs[0].jobDescription.includes('Short card preview'), false)
  assert.equal(jobs[0].experienceRequired, '3+ years')
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(jobs[0].scrapedTimestamp, FIXED_SCRAPED_AT)
})

test('Renesas scraper retains the job without publishing its incomplete card preview when detail fetch fails', async () => {
  const scraper = await loadModule()
  const jobs = await scraper.createRenesasScraper({
    now: () => FIXED_SCRAPED_AT,
    onDetailError: () => {},
  }).run({
    fetchText: async (url) => {
      if (url.includes('/Jobs?')) {
        return page({ jobs: [{
          id: '5997',
          slug: 'principal-verification-engineer',
          title: 'Principal Verification Engineer',
          location: 'Bengaluru, KA, India',
          city: 'Bengaluru',
          description: 'Short source-card preview.',
        }] })
      }
      throw new Error('detail unavailable')
    },
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Principal Verification Engineer')
  assert.equal(jobs[0].sourceUrl, 'https://jobs.renesas.com/job/principal-verification-engineer')
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(jobs[0].experienceRequired, null)
  assert.equal(jobs[0].publicExperienceChecked, false)
  assert.equal(jobs[0].preserveExistingSourceContent, true)
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(jobs[0].scrapedTimestamp, FIXED_SCRAPED_AT)
})

test('Renesas scraper paginates the official India result set, de-duplicates IDs, and bounds detail concurrency', async () => {
  const scraper = await loadModule()
  const listingPages = []
  const detailIds = []
  let activeDetails = 0
  let maximumActiveDetails = 0
  const responses = {
    1: fixture('search-results-page-1.html'),
    2: fixture('search-results-page-2.html'),
  }

  const jobs = await scraper.createRenesasScraper({
    detailConcurrency: 2,
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      const parsedUrl = new URL(url)
      if (/\/Jobs$/i.test(parsedUrl.pathname)) {
        const pageNumber = Number(parsedUrl.searchParams.get('page'))
        listingPages.push(pageNumber)
        return responses[pageNumber]
      }

      detailIds.push(parsedUrl.pathname.split('/').at(-1))
      activeDetails += 1
      maximumActiveDetails = Math.max(maximumActiveDetails, activeDetails)
      await new Promise((resolve) => setImmediate(resolve))
      activeDetails -= 1
      return fixture('job-detail.html')
    },
  })

  assert.deepEqual(listingPages, [1, 2])
  assert.deepEqual(jobs.map((job) => job.jobId), ['1', '2', '3'])
  assert.deepEqual(detailIds, ['one', 'two', 'three'])
  assert.equal(maximumActiveDetails, 2)
})

test('Renesas exact CSV company name resolves through the isolated alias extension', async () => {
  const { buildCompanyLookup, getCompanyAliasMap, normalizeCompanyNameExact } = await import('../providers/companyCoverage.js')
  const aliases = getCompanyAliasMap()

  assert.equal(aliases['Renesas Electronics India'], 'renesas')
  assert.equal(normalizeCompanyNameExact('Renesas Electronics India'), 'renesas electronics india')
  assert.equal(buildCompanyLookup({
    catalog: [{ source: 'renesas', companyName: 'Renesas Electronics' }],
  }).get(normalizeCompanyNameExact('Renesas Electronics India')), 'renesas')
})
