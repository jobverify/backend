import assert from 'node:assert/strict'
import test from 'node:test'

const officialHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>MERU - Leading Organizations Through Change</title>
    <meta
      name="description"
      content="We are MERU: a values-driven, bottom-line focused team dedicated to fixing companies."
    />
  </head>
  <body>
    <main>
      <h1>Powered by people. Driven by values.</h1>
      <a href="https://wearemeru.com/careers/">Careers</a>
    </main>
    <footer>Copyright 2026 MERU, LLC. All Rights Reserved.</footer>
  </body>
</html>
`

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - MERU</title>
  </head>
  <body>
    <main>
      <h1>Join Our Team</h1>
      <p>Apply Here to explore current openings at MERU.</p>
      <a href="https://jobs.lever.co/wearemeru">Apply Here</a>
    </main>
  </body>
</html>
`

const officialLeverBoardHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>MERU</h1>
    <section>Location type</section>
    <section>Location</section>
    <section>Team</section>
    <section>Work type</section>
    <a href="https://jobs.lever.co/wearemeru/accounting-manager">Accounting Manager</a>
    <a href="https://jobs.lever.co/wearemeru/executive-assistant">Executive Assistant/Office Coordinator</a>
    <a href="https://jobs.lever.co/wearemeru/analytics-engineer">Analytics Engineer, Data Insights</a>
    <a href="https://www.lever.co/job-seeker-support/" class="image-link">
      <span>Jobs powered by </span>
      <img alt="Lever logo" src="/img/lever-logo-full.svg" />
    </a>
  </body>
</html>
`

const sampleLeverJobs = [
  {
    id: 'india-solutions-architect',
    text: 'Principal Solutions Architect, Data Insights',
    hostedUrl: 'https://jobs.lever.co/wearemeru/india-solutions-architect',
    applyUrl: 'https://jobs.lever.co/wearemeru/india-solutions-architect/apply',
    createdAt: new Date('2026-07-16T08:00:00.000Z').getTime(),
    categories: {
      location: 'Bengaluru, India',
      team: 'Data Insights',
      commitment: 'Full-time',
      allLocations: ['Bengaluru, India'],
    },
    workplaceType: 'remote',
    descriptionPlain: 'Shape data modernization programs for enterprise clients.',
  },
  {
    id: 'us-accounting-manager',
    text: 'Accounting Manager',
    hostedUrl: 'https://jobs.lever.co/wearemeru/us-accounting-manager',
    applyUrl: 'https://jobs.lever.co/wearemeru/us-accounting-manager/apply',
    createdAt: new Date('2026-07-16T09:00:00.000Z').getTime(),
    categories: {
      location: 'Atlanta, GA',
      team: 'Finance',
      commitment: 'Full-time',
      allLocations: ['Atlanta, GA'],
    },
    workplaceType: 'remote',
    descriptionPlain: 'Ignore this non-India role.',
  },
]

const liveBoardShapeWithoutIndiaJobs = [
  {
    id: 'us-accounting-manager',
    text: 'Accounting Manager',
    hostedUrl: 'https://jobs.lever.co/wearemeru/us-accounting-manager',
    applyUrl: 'https://jobs.lever.co/wearemeru/us-accounting-manager/apply',
    createdAt: new Date('2026-07-16T09:00:00.000Z').getTime(),
    categories: {
      location: 'Atlanta, GA',
      team: 'Finance',
      commitment: 'Full-time',
      allLocations: ['Atlanta, GA'],
    },
    workplaceType: 'remote',
    descriptionPlain: 'Current US role.',
  },
  {
    id: 'us-analytics-engineer',
    text: 'Analytics Engineer, Data Insights',
    hostedUrl: 'https://jobs.lever.co/wearemeru/us-analytics-engineer',
    applyUrl: 'https://jobs.lever.co/wearemeru/us-analytics-engineer/apply',
    createdAt: new Date('2026-07-16T10:00:00.000Z').getTime(),
    categories: {
      location: 'San Francisco',
      team: 'Data Insights',
      commitment: 'Full-time',
      allLocations: ['San Francisco'],
    },
    workplaceType: 'remote',
    descriptionPlain: 'Current US role.',
  },
]

const loadMeruModule = async () => {
  try {
    return await import('../../scraper/meru/script.js')
  } catch {
    assert.fail('Expected Meru scraper module at ../../scraper/meru/script.js')
  }
}

test('Meru scraper constants stay pinned to the verified first-party homepage, careers page, and Lever board', async () => {
  const meru = await loadMeruModule()

  assert.equal(meru.SOURCE, 'meru')
  assert.equal(meru.COMPANY, 'Meru')
  assert.equal(meru.HOMEPAGE_URL, 'https://wearemeru.com/')
  assert.equal(meru.CAREERS_URL, 'https://wearemeru.com/careers/')
  assert.equal(meru.LEVER_BOARD_URL, 'https://jobs.lever.co/wearemeru')
  assert.equal(meru.LEVER_API_URL, 'https://api.lever.co/v0/postings/wearemeru?mode=json')
  assert.equal(meru.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(meru.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(
    meru.extractLeverBoardUrl(officialCareersHtml),
    'https://jobs.lever.co/wearemeru',
  )
  assert.equal(meru.hasOfficialLeverBoardSignal(officialLeverBoardHtml), true)
})

test('Meru extracts only India roles from the verified Lever postings payload shape', async () => {
  const meru = await loadMeruModule()
  const jobs = meru.extractLeverJobs(sampleLeverJobs)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Principal Solutions Architect, Data Insights',
    company: 'Meru',
    department: 'Data Insights',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: 'india-solutions-architect',
    requisitionId: 'india-solutions-architect',
    sourceUrl: 'https://jobs.lever.co/wearemeru/india-solutions-architect',
    applyUrl: 'https://jobs.lever.co/wearemeru/india-solutions-architect/apply',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: new Date(sampleLeverJobs[0].createdAt).toISOString(),
    closingDate: null,
    jobDescription: 'Shape data modernization programs for enterprise clients.',
    remoteStatus: 'Remote',
  })
})

test('Meru run returns an honest zero-job result while the verified public Lever board exposes no India roles', async () => {
  const meru = await loadMeruModule()
  const requestedPages = []
  const requestedJson = []

  const jobs = await meru.createMeruScraper({
    now: () => '2026-07-16T00:00:00.000Z',
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === meru.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          html: officialHomepageHtml,
        }
      }

      if (url === meru.CAREERS_URL) {
        return {
          status: 200,
          url,
          html: officialCareersHtml,
        }
      }

      if (url === meru.LEVER_BOARD_URL) {
        return {
          status: 200,
          url,
          html: officialLeverBoardHtml,
        }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)

      if (url === meru.LEVER_API_URL) {
        return liveBoardShapeWithoutIndiaJobs
      }

      throw new Error(`Unexpected json URL: ${url}`)
    },
  }).run()

  assert.deepEqual(requestedPages, [
    meru.HOMEPAGE_URL,
    meru.CAREERS_URL,
    meru.LEVER_BOARD_URL,
  ])
  assert.deepEqual(requestedJson, [meru.LEVER_API_URL])
  assert.deepEqual(jobs, [])
})

test('Meru fails closed when the verified homepage, careers page, or Lever board changes materially', async () => {
  const meru = await loadMeruModule()

  await assert.rejects(
    meru.createMeruScraper({
      fetchPage: async (url) => {
        if (url === meru.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Meru homepage changed</h1></body></html>',
          }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async () => liveBoardShapeWithoutIndiaJobs,
    }).run(),
    /verified official homepage/i,
  )

  await assert.rejects(
    meru.createMeruScraper({
      fetchPage: async (url) => {
        if (url === meru.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: officialHomepageHtml,
          }
        }

        if (url === meru.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: officialCareersHtml,
          }
        }

        if (url === meru.LEVER_BOARD_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Board changed</h1></body></html>',
          }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async () => liveBoardShapeWithoutIndiaJobs,
    }).run(),
    /verified public lever board/i,
  )
})
