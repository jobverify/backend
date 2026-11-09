import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/appzen/script.js')
  } catch {
    assert.fail('Expected AppZen scraper module at ../../scraper/appzen/script.js')
  }
}

const VERIFIED_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Search Jobs and Apply Here | AppZen Careers</title>
    <link rel="canonical" href="https://www.appzen.com/careers" />
  </head>
  <body>
    <main>
      <h4>Careers at AppZen</h4>
      <h1>Shape the future of finance AI</h1>
      <h3>Current Openings</h3>
      <div id="lever-jump"><div id="lever-jobs-container">&nbsp;</div></div>
      <script type="text/javascript">
        window.leverJobsOptions = {accountName: 'appzen', includeCss: true};
      </script>
      <script
        type="text/javascript"
        src="https://andreasmb.github.io/lever-jobs-embed/index.js"
      ></script>
    </main>
  </body>
</html>
`

const VERIFIED_LEVER_BOARD_HTML = `
<!doctype html>
<html>
  <head>
    <title>AppZen, Inc.</title>
    <meta property="og:url" content="https://jobs.lever.co/appzen" />
    <meta property="og:description" content="Job openings at AppZen, Inc." />
  </head>
  <body>
    <section>
      <h1>AppZen, Inc.</h1>
      <span>Location type</span>
      <span>Location</span>
      <span>Team</span>
      <span>Work type</span>
      <a href="https://jobs.lever.co/appzen/7554ff68-99c2-4619-ac4e-d6df60892244">
        Customer success Manager
      </a>
      <a href="https://www.appzen.com/">AppZen, Inc. Home Page</a>
      <a href="https://www.lever.co/job-seeker-support/" class="image-link">
        <span>Powered by </span>
        <img alt="Lever logo" src="/img/lever-logo-full.svg" />
      </a>
    </section>
  </body>
</html>
`

const VERIFIED_LEVER_PAYLOAD = [
  {
    id: '7554ff68-99c2-4619-ac4e-d6df60892244',
    text: 'Customer success Manager',
    country: 'IN',
    workplaceType: 'onsite',
    createdAt: Date.parse('2026-07-24T12:00:00.000Z'),
    categories: {
      commitment: 'Full-time',
      department: 'Customer Success',
      team: 'Customer Account Management',
      location: 'Pune',
      allLocations: ['Pune'],
    },
    description:
      '<div>Lead customer adoption across AP workflows for Fortune 500 accounts.</div>',
    hostedUrl: 'https://jobs.lever.co/appzen/7554ff68-99c2-4619-ac4e-d6df60892244',
    applyUrl: 'https://jobs.lever.co/appzen/7554ff68-99c2-4619-ac4e-d6df60892244/apply',
  },
  {
    id: 'e6a48b55-dbfa-4a84-8020-9b692ccc816f',
    text: 'Enterprise Account Executive',
    country: 'US',
    workplaceType: 'remote',
    createdAt: Date.parse('2026-07-24T15:30:00.000Z'),
    categories: {
      commitment: 'Full-time',
      department: 'Sales',
      team: 'Direct Sales',
      location: 'Atlanta, Georgia',
      allLocations: ['Atlanta, Georgia'],
    },
    description: '<div>Outside India role.</div>',
    hostedUrl: 'https://jobs.lever.co/appzen/e6a48b55-dbfa-4a84-8020-9b692ccc816f',
    applyUrl: 'https://jobs.lever.co/appzen/e6a48b55-dbfa-4a84-8020-9b692ccc816f/apply',
  },
]

test('AppZen validates the verified first-party careers embed and public Lever board contract', async () => {
  const appzen = await loadModule()

  assert.equal(appzen.SOURCE, 'appzen')
  assert.equal(appzen.COMPANY, 'AppZen')
  assert.equal(appzen.VERIFIED_ON, '2026-08-01')
  assert.equal(appzen.CAREERS_URL, 'https://www.appzen.com/careers')
  assert.equal(appzen.LEVER_ACCOUNT, 'appzen')
  assert.equal(appzen.LEVER_BOARD_URL, 'https://jobs.lever.co/appzen')
  assert.equal(appzen.LEVER_API_URL, 'https://api.lever.co/v0/postings/appzen?mode=json')
  assert.equal(
    appzen.DISPOSITION,
    'verified-first-party-careers-page-plus-public-lever-jobs-api',
  )
  assert.match(appzen.VERIFIED_SURFACE_SUMMARY, /Saturday, August 1, 2026/)
  assert.equal(appzen.hasOfficialCareersPageSignal(VERIFIED_CAREERS_HTML), true)
  assert.equal(appzen.extractLeverAccountName(VERIFIED_CAREERS_HTML), 'appzen')
  assert.equal(appzen.hasOfficialLeverBoardSignal(VERIFIED_LEVER_BOARD_HTML), true)
})

test('AppZen keeps only India jobs from the verified Lever payload and maps them to the shared shape', async () => {
  const appzen = await loadModule()

  const jobs = appzen.extractIndiaLeverJobs(VERIFIED_LEVER_PAYLOAD)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Customer success Manager',
    company: 'AppZen',
    department: 'Customer Account Management',
    location: 'Pune',
    city: 'Pune',
    country: 'India',
    jobId: '7554ff68-99c2-4619-ac4e-d6df60892244',
    requisitionId: '7554ff68-99c2-4619-ac4e-d6df60892244',
    sourceUrl: 'https://jobs.lever.co/appzen/7554ff68-99c2-4619-ac4e-d6df60892244',
    applyUrl: 'https://jobs.lever.co/appzen/7554ff68-99c2-4619-ac4e-d6df60892244/apply',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-24T12:00:00.000Z',
    closingDate: null,
    jobDescription: 'Lead customer adoption across AP workflows for Fortune 500 accounts.',
    remoteStatus: 'On-site',
  })
})

test('AppZen run validates the verified careers embed, public Lever board, and decorates India jobs', async () => {
  const appzen = await loadModule()
  const requestedTexts = []
  const requestedJson = []

  const jobs = await appzen.createAppZenScraper().run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === appzen.CAREERS_URL) return VERIFIED_CAREERS_HTML
      if (url === appzen.LEVER_BOARD_URL) return VERIFIED_LEVER_BOARD_HTML
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      if (url === appzen.LEVER_API_URL) return VERIFIED_LEVER_PAYLOAD
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
    now: () => '2026-07-25T00:00:00.000Z',
  })

  assert.deepEqual(requestedTexts, [appzen.CAREERS_URL, appzen.LEVER_BOARD_URL])
  assert.deepEqual(requestedJson, [appzen.LEVER_API_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'appzen')
  assert.equal(
    jobs[0].link,
    'https://jobs.lever.co/appzen/7554ff68-99c2-4619-ac4e-d6df60892244/apply',
  )
  assert.equal(jobs[0].scrapedAt, '2026-07-25T00:00:00.000Z')
})

test('AppZen fails closed when the verified careers embed or public Lever board changes', async () => {
  const appzen = await loadModule()

  await assert.rejects(
    appzen.createAppZenScraper().run({
      fetchText: async (url) => {
        if (url === appzen.CAREERS_URL) {
          return VERIFIED_CAREERS_HTML.replace("accountName: 'appzen'", "accountName: 'example'")
        }

        return VERIFIED_LEVER_BOARD_HTML
      },
      fetchJson: async () => VERIFIED_LEVER_PAYLOAD,
    }),
    /verified official careers page/i,
  )

  await assert.rejects(
    appzen.createAppZenScraper().run({
      fetchText: async (url) => {
        if (url === appzen.CAREERS_URL) return VERIFIED_CAREERS_HTML
        return VERIFIED_LEVER_BOARD_HTML.replace('Powered by ', 'Apply now')
      },
      fetchJson: async () => VERIFIED_LEVER_PAYLOAD,
    }),
    /verified public Lever board/i,
  )
})
