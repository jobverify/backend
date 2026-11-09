import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => import('./script.js')

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>TomTom Careers</title>
  </head>
  <body>
    <h1>Engineer the first real-time map</h1>
    <p>Find your place in the world</p>
    <a href="/careers/joboverview/">See all jobs</a>
    <a href="/careers/offices/pune/">Pune office</a>
  </body>
</html>
`

const puneOfficeHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Pune Office | TomTom Careers</title>
  </head>
  <body>
    <h1>Pune Office</h1>
    <div>TomTom India Pvt Ltd</div>
    <div>Pune, India</div>
    <div>Yerwada, Pune 411006</div>
    <a href="/careers/joboverview/?location=Pune,+India">See jobs</a>
  </body>
</html>
`

const puneJobsOverviewHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs | TomTom Careers</title>
  </head>
  <body>
    <div>Refine your search</div>
    <div>Location</div>
    <div>Team</div>
    <div>No filters were applied</div>
    <div>Loading job results...</div>
  </body>
</html>
`

const leverBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>TomTom</title>
  </head>
  <body>
    <h1>Job openings at TomTom</h1>
    <a href="http://tomtom.com/careers">TomTom careers</a>
    <div>Location type</div>
    <div>Location</div>
    <div>Team</div>
    <div>Work type</div>
    <div>Pune, India</div>
    <div>Enterprise IT</div>
    <div>Engineer III (SAP SD)</div>
    <a href="https://jobs.eu.lever.co/tomtom/9c282b10-e4e9-4465-b516-5d60d8ee841c">Open role</a>
  </body>
</html>
`

const leverApiPayload = [
  {
    id: '9c282b10-e4e9-4465-b516-5d60d8ee841c',
    text: 'Engineer III (SAP SD)',
    hostedUrl: 'https://jobs.eu.lever.co/tomtom/9c282b10-e4e9-4465-b516-5d60d8ee841c',
    applyUrl: 'https://jobs.eu.lever.co/tomtom/9c282b10-e4e9-4465-b516-5d60d8ee841c/apply',
    createdAt: 1747898269432,
    descriptionPlain:
      'As an SAP SD (Order-to-Cash) Senior Application Engineer, you will play a key role.',
    categories: {
      location: 'Pune, India',
      team: 'Enterprise IT',
      commitment: 'Employee, Full Time',
    },
  },
]

test('TomTom recognizes the current careers, Pune office, Pune jobs overview, and Lever board shells', async () => {
  const tomtom = await loadModule()

  assert.equal(tomtom.hasOfficialTomTomCareersSignals(careersHtml), true)
  assert.equal(tomtom.hasOfficialTomTomPuneOfficeSignals(puneOfficeHtml), true)
  assert.equal(tomtom.hasOfficialTomTomPuneJobsOverviewSignals(puneJobsOverviewHtml), true)
  assert.equal(tomtom.hasOfficialLeverBoardSignal(leverBoardHtml), true)
})

test('TomTom returns the current India Lever job after verifying the live first-party and board surfaces', async () => {
  const tomtom = await loadModule()

  const jobs = await tomtom.createTomTomScraper({
    now: () => '2026-08-06T00:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      if (url === tomtom.OFFICIAL_CAREERS_URL) return { status: 200, url, html: careersHtml }
      if (url === tomtom.OFFICIAL_PUNE_OFFICE_URL) return { status: 200, url, html: puneOfficeHtml }
      if (url === tomtom.OFFICIAL_PUNE_JOBS_OVERVIEW_URL) {
        return { status: 200, url, html: puneJobsOverviewHtml }
      }
      if (url === tomtom.LEVER_BOARD_URL) return { status: 200, url, html: leverBoardHtml }
      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchJson: async (url) => {
      assert.equal(url, tomtom.LEVER_API_URL)
      return leverApiPayload
    },
  })

  assert.deepEqual(jobs, [
    {
      title: 'Engineer III (SAP SD)',
      company: 'TomTom',
      department: 'Enterprise IT',
      location: 'Pune, India',
      city: 'Pune',
      jobId: '9c282b10-e4e9-4465-b516-5d60d8ee841c',
      requisitionId: '9c282b10-e4e9-4465-b516-5d60d8ee841c',
      sourceUrl: 'https://jobs.eu.lever.co/tomtom/9c282b10-e4e9-4465-b516-5d60d8ee841c',
      applyUrl: 'https://jobs.eu.lever.co/tomtom/9c282b10-e4e9-4465-b516-5d60d8ee841c/apply',
      employmentType: 'Employee, Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2025-05-22T07:17:49.432Z',
      closingDate: null,
      jobDescription:
        'As an SAP SD (Order-to-Cash) Senior Application Engineer, you will play a key role.',
      source: 'tomtom',
      link: 'https://jobs.eu.lever.co/tomtom/9c282b10-e4e9-4465-b516-5d60d8ee841c/apply',
      scrapedAt: '2026-08-06T00:00:00.000Z',
    },
  ])
})
