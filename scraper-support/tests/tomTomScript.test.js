import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-06T00:00:00.000Z'

const OFFICIAL_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>TomTom Careers</title>
  </head>
  <body>
    <main>
      <h1>Engineer the first real-time map</h1>
      <p>Find your place in the world</p>
      <a href="/careers/joboverview/">See all jobs</a>
      <a href="/careers/offices/pune/">Pune office</a>
    </main>
  </body>
</html>
`

const OFFICIAL_PUNE_OFFICE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Pune Office | TomTom Careers</title>
  </head>
  <body>
    <main>
      <h1>Pune, India</h1>
      <p>Pune Office</p>
      <p>TomTom India Pvt Ltd</p>
      <p>3rd floor, ShantiOne, 88/4, Nagar Road. Next to Aga Khan Palace, Yerwada, Pune 411006, Maharashtra, India</p>
      <a href="/careers/joboverview/?location=Pune,+India">See jobs</a>
      <a href="/careers/joboverview/?location=Pune,+India">Join us</a>
    </main>
  </body>
</html>
`

const OFFICIAL_PUNE_JOBS_OVERVIEW_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs | TomTom Careers</title>
  </head>
  <body>
    <main>
      <h1>Jobs</h1>
      <p>Refine your search</p>
      <p>Location</p>
      <p>Team</p>
      <p>No filters were applied</p>
      <p>Loading job results...</p>
    </main>
  </body>
</html>
`

const OFFICIAL_LEVER_BOARD_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>TomTom</title>
    <meta name="twitter:description" content="Job openings at TomTom">
  </head>
  <body>
    <h1>TomTom</h1>
    <section>Location type</section>
    <section>Location</section>
    <section>Team</section>
    <section>Work type</section>
    <a href="https://www.tomtom.com/careers/">TomTom careers</a>
    <a href="https://jobs.eu.lever.co/tomtom/tomtom-pune-001">Engineer III (SAP SD)</a>
  </body>
</html>
`

const SAMPLE_LEVER_JOBS = [
  {
    id: 'tomtom-pune-001',
    text: 'Engineer III (SAP SD)',
    hostedUrl: 'https://jobs.eu.lever.co/tomtom/tomtom-pune-001',
    applyUrl: 'https://jobs.eu.lever.co/tomtom/tomtom-pune-001/apply',
    createdAt: 1_752_566_400_000,
    categories: {
      location: 'Pune, India',
      team: 'Enterprise IT',
      commitment: 'Employee, Full Time',
      allLocations: ['Pune, India'],
    },
    workplaceType: 'hybrid',
    descriptionPlain: 'Support SAP SD systems and shared-services workflows.',
  },
  {
    id: 'tomtom-amsterdam-001',
    text: 'Platform Engineer - Developer Platform',
    hostedUrl: 'https://jobs.eu.lever.co/tomtom/tomtom-amsterdam-001',
    applyUrl: 'https://jobs.eu.lever.co/tomtom/tomtom-amsterdam-001/apply',
    createdAt: 1_752_480_000_000,
    categories: {
      location: 'Amsterdam, The Netherlands',
      team: 'Platform Engineering',
      commitment: 'Employee, Full Time',
      allLocations: ['Amsterdam, The Netherlands'],
    },
    workplaceType: 'hybrid',
    descriptionPlain: 'Ignore this non-India role.',
  },
]

const loadModule = async () => {
  try {
    return await import('../../scraper/tomtom/script.js')
  } catch {
    assert.fail('Expected TomTom scraper module at ../../scraper/tomtom/script.js')
  }
}

test('TomTom scraper constants stay pinned to the verified first-party careers pages and Lever board', async () => {
  const tomTom = await loadModule()

  assert.equal(tomTom.SOURCE, 'tomtom')
  assert.equal(tomTom.COMPANY, 'TomTom')
  assert.equal(tomTom.OFFICIAL_BRAND_NAME, 'TomTom')
  assert.equal(tomTom.OFFICIAL_CAREERS_URL, 'https://www.tomtom.com/careers/')
  assert.equal(tomTom.OFFICIAL_PUNE_OFFICE_URL, 'https://www.tomtom.com/careers/offices/pune/')
  assert.equal(
    tomTom.OFFICIAL_PUNE_JOBS_OVERVIEW_URL,
    'https://www.tomtom.com/careers/joboverview/?location=Pune,+India',
  )
  assert.equal(tomTom.LEVER_BOARD_URL, 'https://jobs.eu.lever.co/tomtom')
  assert.equal(tomTom.LEVER_API_URL, 'https://api.eu.lever.co/v0/postings/tomtom?mode=json')
  assert.equal(tomTom.hasOfficialTomTomCareersSignals(OFFICIAL_CAREERS_HTML), true)
  assert.equal(tomTom.hasOfficialTomTomPuneOfficeSignals(OFFICIAL_PUNE_OFFICE_HTML), true)
  assert.equal(tomTom.hasOfficialTomTomPuneJobsOverviewSignals(OFFICIAL_PUNE_JOBS_OVERVIEW_HTML), true)
  assert.equal(tomTom.hasOfficialLeverBoardSignal(OFFICIAL_LEVER_BOARD_HTML), true)
  assert.equal(
    tomTom.hasOfficialLeverBoardSignal(
      OFFICIAL_LEVER_BOARD_HTML.replace('Engineer III (SAP SD)', 'Platform Engineer'),
    ),
    true,
  )
  assert.equal(
    tomTom.hasOfficialLeverBoardSignal(
      OFFICIAL_LEVER_BOARD_HTML.replace('Job openings at TomTom', 'Jobs at Another Company'),
    ),
    false,
  )
})

test('TomTom extracts only India roles from the verified EU Lever postings payload shape', async () => {
  const tomTom = await loadModule()
  const jobs = tomTom.extractIndiaLeverJobs(SAMPLE_LEVER_JOBS)

  assert.deepEqual(jobs, [
    {
      title: 'Engineer III (SAP SD)',
      company: 'TomTom',
      department: 'Enterprise IT',
      location: 'Pune, India',
      city: 'Pune',
      jobId: 'tomtom-pune-001',
      requisitionId: 'tomtom-pune-001',
      sourceUrl: 'https://jobs.eu.lever.co/tomtom/tomtom-pune-001',
      applyUrl: 'https://jobs.eu.lever.co/tomtom/tomtom-pune-001/apply',
      employmentType: 'Employee, Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2025-07-15T08:00:00.000Z',
      closingDate: null,
      jobDescription: 'Support SAP SD systems and shared-services workflows.',
    },
  ])
})

test('TomTom run validates the verified official surfaces before mapping India jobs', async () => {
  const { createTomTomScraper } = await loadModule()
  const requestedPages = []
  const requestedJson = []

  const jobs = await createTomTomScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === 'https://www.tomtom.com/careers/') {
        return {
          status: 200,
          url,
          html: OFFICIAL_CAREERS_HTML,
        }
      }

      if (url === 'https://www.tomtom.com/careers/offices/pune/') {
        return {
          status: 200,
          url,
          html: OFFICIAL_PUNE_OFFICE_HTML,
        }
      }

      if (url === 'https://www.tomtom.com/careers/joboverview/?location=Pune,+India') {
        return {
          status: 200,
          url,
          html: OFFICIAL_PUNE_JOBS_OVERVIEW_HTML,
        }
      }

      if (url === 'https://jobs.eu.lever.co/tomtom') {
        return {
          status: 200,
          url,
          html: OFFICIAL_LEVER_BOARD_HTML,
        }
      }

      throw new Error(`Unexpected TomTom page URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)

      if (url === 'https://api.eu.lever.co/v0/postings/tomtom?mode=json') {
        return SAMPLE_LEVER_JOBS
      }

      throw new Error(`Unexpected TomTom json URL: ${url}`)
    },
  })

  assert.deepEqual(requestedPages, [
    'https://www.tomtom.com/careers/',
    'https://www.tomtom.com/careers/offices/pune/',
    'https://www.tomtom.com/careers/joboverview/?location=Pune,+India',
    'https://jobs.eu.lever.co/tomtom',
  ])
  assert.deepEqual(requestedJson, ['https://api.eu.lever.co/v0/postings/tomtom?mode=json'])
  assert.deepEqual(jobs, [
    {
      title: 'Engineer III (SAP SD)',
      company: 'TomTom',
      department: 'Enterprise IT',
      location: 'Pune, India',
      city: 'Pune',
      jobId: 'tomtom-pune-001',
      requisitionId: 'tomtom-pune-001',
      sourceUrl: 'https://jobs.eu.lever.co/tomtom/tomtom-pune-001',
      applyUrl: 'https://jobs.eu.lever.co/tomtom/tomtom-pune-001/apply',
      employmentType: 'Employee, Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2025-07-15T08:00:00.000Z',
      closingDate: null,
      jobDescription: 'Support SAP SD systems and shared-services workflows.',
      source: 'tomtom',
      link: 'https://jobs.eu.lever.co/tomtom/tomtom-pune-001/apply',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('TomTom fails closed when the verified careers, Pune office, Pune jobs overview, or board surface drifts', async () => {
  const { createTomTomScraper } = await loadModule()

  await assert.rejects(
    createTomTomScraper().run({
      fetchPage: async (url) => {
        if (url === 'https://www.tomtom.com/careers/') {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Unexpected</h1></body></html>',
          }
        }

        throw new Error(`Unexpected TomTom page URL: ${url}`)
      },
      fetchJson: async () => SAMPLE_LEVER_JOBS,
    }),
    /verified official careers surface/i,
  )

  await assert.rejects(
    createTomTomScraper().run({
      fetchPage: async (url) => {
        if (url === 'https://www.tomtom.com/careers/') {
          return { status: 200, url, html: OFFICIAL_CAREERS_HTML }
        }
        if (url === 'https://www.tomtom.com/careers/offices/pune/') {
          return {
            status: 200,
            url,
            html: OFFICIAL_PUNE_OFFICE_HTML.replace('TomTom India Pvt Ltd', 'TomTom Office'),
          }
        }
        throw new Error(`Unexpected TomTom page URL: ${url}`)
      },
      fetchJson: async () => SAMPLE_LEVER_JOBS,
    }),
    /verified pune office careers surface/i,
  )

  await assert.rejects(
    createTomTomScraper().run({
      fetchPage: async (url) => {
        if (url === 'https://www.tomtom.com/careers/') {
          return { status: 200, url, html: OFFICIAL_CAREERS_HTML }
        }
        if (url === 'https://www.tomtom.com/careers/offices/pune/') {
          return { status: 200, url, html: OFFICIAL_PUNE_OFFICE_HTML }
        }
        if (url === 'https://www.tomtom.com/careers/joboverview/?location=Pune,+India') {
          return {
            status: 200,
            url,
            html: OFFICIAL_PUNE_JOBS_OVERVIEW_HTML.replace('Loading job results...', 'Jobs are loading soon'),
          }
        }
        throw new Error(`Unexpected TomTom page URL: ${url}`)
      },
      fetchJson: async () => SAMPLE_LEVER_JOBS,
    }),
    /verified pune jobs-overview surface/i,
  )

  await assert.rejects(
    createTomTomScraper().run({
      fetchPage: async (url) => {
        if (url === 'https://www.tomtom.com/careers/') {
          return { status: 200, url, html: OFFICIAL_CAREERS_HTML }
        }
        if (url === 'https://www.tomtom.com/careers/offices/pune/') {
          return { status: 200, url, html: OFFICIAL_PUNE_OFFICE_HTML }
        }
        if (url === 'https://www.tomtom.com/careers/joboverview/?location=Pune,+India') {
          return { status: 200, url, html: OFFICIAL_PUNE_JOBS_OVERVIEW_HTML }
        }
        if (url === 'https://jobs.eu.lever.co/tomtom') {
          return {
            status: 200,
            url,
            html: '<html><head><title>TomTom</title></head><body><h1>TomTom</h1><p>Board changed</p></body></html>',
          }
        }
        throw new Error(`Unexpected TomTom page URL: ${url}`)
      },
      fetchJson: async () => SAMPLE_LEVER_JOBS,
    }),
    /verified public lever board/i,
  )
})
