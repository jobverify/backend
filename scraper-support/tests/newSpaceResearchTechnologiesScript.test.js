import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadModule = async () => {
  try {
    return await import('../../scraper/newspaceresearchtechnologies/script.js')
  } catch (error) {
    assert.fail(
      `Expected New Space Research Technologies scraper module at ../../scraper/newspaceresearchtechnologies/script.js (${error.code || error.message})`,
    )
  }
}

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(currentDir, 'fixtures', 'newspaceresearchtechnologies')

const homepageHtml = readFileSync(path.join(fixturesDir, 'homepage.html'), 'utf8')
const listingHtml = readFileSync(path.join(fixturesDir, 'freshteam-jobs.html'), 'utf8')
const associateProjectManagerDetailHtml = readFileSync(
  path.join(fixturesDir, 'associate-project-manager.html'),
  'utf8',
)
const talentManagementInternDetailHtml = readFileSync(
  path.join(fixturesDir, 'talent-management-intern-project-engineer.html'),
  'utf8',
)
const liveBoardHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Careers</h1>
      <div>#56 Jobs</div>
      <h2>Open Positions</h2>
      <li data-portal-role="Manufacturing - SP">
        <a href="https://newspace-talent.freshteam.com/jobs/QhcwQK0cckYH/manufacturing-sp">
          <div class="job-title">Manufacturing - SP</div>
          <div class="job-desc">Who we are: We are a start-up based out of Bengaluru &amp; Delhi NCR.</div>
        </a>
      </li>
    </main>
  </body>
</html>
`

test('New Space Research Technologies constants stay pinned to the verified homepage and Freshteam board', async () => {
  const newspace = await loadModule()

  assert.equal(newspace.SOURCE, 'newspaceresearchtechnologies')
  assert.equal(newspace.COMPANY, 'New Space Research Technologies')
  assert.equal(newspace.HOMEPAGE_URL, 'https://newspace.co.in/')
  assert.equal(newspace.LISTING_URL, 'https://newspace-talent.freshteam.com/jobs')
  assert.equal(
    newspace.DETAIL_URL_PATTERN,
    'https://newspace-talent.freshteam.com/jobs/{opaque_id}/{slug}',
  )
  assert.equal(newspace.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(newspace.hasOfficialJobsBoardSignal(listingHtml), true)
  assert.equal(
    newspace.buildDetailUrl('zidPYD4pTSsg', 'associate-project-manager'),
    'https://newspace-talent.freshteam.com/jobs/zidPYD4pTSsg/associate-project-manager',
  )
  assert.equal(newspace.hasOfficialJobsBoardSignal(liveBoardHtml), true)
})

test('extractListingJobs parses the verified Freshteam board and preserves department, summary, and work type', async () => {
  const newspace = await loadModule()

  const listings = newspace.extractListingJobs(listingHtml)

  assert.equal(listings.length, 3)
  assert.deepEqual(listings[0], {
    title: 'Associate Project Manager',
    summary: 'Who we are: We are a start-up based out of Bengaluru & Delhi NCR. We are engaged in development of next generation missions and technologies.',
    department: 'Project Management',
    detailUrl: 'https://newspace-talent.freshteam.com/jobs/zidPYD4pTSsg/associate-project-manager',
    jobId: 'zidPYD4pTSsg',
    requisitionId: 'zidPYD4pTSsg',
    slug: 'associate-project-manager',
    locationText: null,
    employmentType: 'Full Time',
    remoteFlag: 'false',
  })
  assert.equal(listings[1].title, 'Talent management intern/project engineer')
  assert.equal(listings[1].department, 'Enabling Function')
  assert.equal(listings[1].employmentType, 'Internship')
  assert.equal(listings[2].title, 'Stores Jr Executive')
  assert.equal(listings[2].employmentType, 'Contract')
})

test('extractJobDetail enriches a healthy detail page and falls back to the listing summary when the detail page is broken', async () => {
  const newspace = await loadModule()
  const listings = newspace.extractListingJobs(listingHtml)

  assert.deepEqual(
    newspace.extractJobDetail(associateProjectManagerDetailHtml, listings[0]),
    {
      title: 'Associate Project Manager',
      company: 'New Space Research Technologies',
      department: 'Project Management',
      location: 'India',
      city: null,
      country: 'India',
      jobId: 'zidPYD4pTSsg',
      requisitionId: 'zidPYD4pTSsg',
      sourceUrl: 'https://newspace-talent.freshteam.com/jobs/zidPYD4pTSsg/associate-project-manager',
      applyUrl: 'https://newspace-talent.freshteam.com/jobs/zidPYD4pTSsg/associate-project-manager',
      employmentType: 'Full-time',
      experienceRequired: '1-2 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: [
        'Who we are:',
        'We are a start-up based out of Bengaluru & Delhi NCR. We are engaged in development of next generation missions and technologies towards future warfare needs of the Indian defence forces.',
        'Roles and Responsibilities:',
        'Plan project communications and facilitate stakeholder updates.',
        'Create and maintain project management documents according to ISO / AS9100 standards.',
        'Track project health and schedule via collaborative task management tools.',
        'Skill Set',
        'Must have:',
        'Prior experience of working in the UAV industry.',
        '1-2 years of experience in driving project coordination, PMO, or project execution workflows.',
      ].join(' '),
      publicExperienceChecked: true,
      remoteStatus: 'On-site',
    },
  )

  assert.deepEqual(
    newspace.extractJobDetail(talentManagementInternDetailHtml, listings[1]),
    {
      title: 'Talent management intern/project engineer',
      company: 'New Space Research Technologies',
      department: 'Enabling Function',
      location: 'India',
      city: null,
      country: 'India',
      jobId: 'NDNnMWS4t4iQ',
      requisitionId: 'NDNnMWS4t4iQ',
      sourceUrl: 'https://newspace-talent.freshteam.com/jobs/NDNnMWS4t4iQ/talent-management-intern-project-engineer',
      applyUrl: 'https://newspace-talent.freshteam.com/jobs/NDNnMWS4t4iQ/talent-management-intern-project-engineer',
      employmentType: 'Internship',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Talent management intern / project engineer.',
      publicExperienceChecked: true,
      remoteStatus: 'On-site',
    },
  )
})

test('run validates the homepage and Freshteam board before fetching detail pages and decorating jobs', async () => {
  const newspace = await loadModule()
  const requestedUrls = []

  const jobs = await newspace.createNewSpaceResearchTechnologiesScraper({ maxJobs: 2 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === newspace.HOMEPAGE_URL) return homepageHtml
      if (url === newspace.LISTING_URL) return listingHtml
      if (url === 'https://newspace-talent.freshteam.com/jobs/zidPYD4pTSsg/associate-project-manager') {
        return associateProjectManagerDetailHtml
      }
      if (url === 'https://newspace-talent.freshteam.com/jobs/NDNnMWS4t4iQ/talent-management-intern-project-engineer') {
        return talentManagementInternDetailHtml
      }

      throw new Error(`Unexpected New Space Research Technologies fixture URL: ${url}`)
    },
    now: () => '2026-07-11T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    newspace.HOMEPAGE_URL,
    newspace.LISTING_URL,
    'https://newspace-talent.freshteam.com/jobs/zidPYD4pTSsg/associate-project-manager',
    'https://newspace-talent.freshteam.com/jobs/NDNnMWS4t4iQ/talent-management-intern-project-engineer',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'newspaceresearchtechnologies')
  assert.equal(jobs[0].company, 'New Space Research Technologies')
  assert.equal(jobs[0].link, 'https://newspace-talent.freshteam.com/jobs/zidPYD4pTSsg/associate-project-manager')
  assert.equal(jobs[0].scrapedAt, '2026-07-11T00:00:00.000Z')
  assert.equal(jobs[1].jobId, 'NDNnMWS4t4iQ')
  assert.equal(jobs[1].employmentType, 'Internship')
  assert.equal(jobs[1].jobDescription, 'Talent management intern / project engineer.')
})

test('run tolerates an unreachable homepage when the company-specific Freshteam board and detail pages remain live', async () => {
  const newspace = await loadModule()
  const requestedUrls = []

  const jobs = await newspace.createNewSpaceResearchTechnologiesScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === newspace.HOMEPAGE_URL) {
        throw new Error(
          'fetch failed | Connect Timeout Error (attempted addresses: 89.117.188.198:443, timeout: 10000ms)',
        )
      }
      if (url === newspace.LISTING_URL) return listingHtml
      if (url === 'https://newspace-talent.freshteam.com/jobs/zidPYD4pTSsg/associate-project-manager') {
        return associateProjectManagerDetailHtml
      }

      throw new Error(`Unexpected New Space Research Technologies fixture URL: ${url}`)
    },
    now: () => '2026-08-03T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    newspace.HOMEPAGE_URL,
    newspace.LISTING_URL,
    'https://newspace-talent.freshteam.com/jobs/zidPYD4pTSsg/associate-project-manager',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'newspaceresearchtechnologies')
  assert.equal(jobs[0].scrapedAt, '2026-08-03T00:00:00.000Z')
})

test('the scraper fails closed when the verified homepage or jobs board signatures drift', async () => {
  const newspace = await loadModule()

  await assert.rejects(
    newspace.createNewSpaceResearchTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === newspace.HOMEPAGE_URL) {
          return homepageHtml.replace(
            "Engineering tomorrow's missions, today",
            'Unexpected homepage',
          )
        }

        throw new Error(`Unexpected New Space Research Technologies fixture URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    newspace.createNewSpaceResearchTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === newspace.HOMEPAGE_URL) return homepageHtml
        if (url === newspace.LISTING_URL) {
          return listingHtml.replaceAll(
            'NewSpace Research &amp; Technologies',
            'Different Company',
          )
        }

        throw new Error(`Unexpected New Space Research Technologies fixture URL: ${url}`)
      },
    }),
    /verified public freshteam board/i,
  )
})
