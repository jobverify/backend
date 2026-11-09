import assert from 'node:assert/strict'
import test from 'node:test'

const officialHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Fi Money - Savings Account, Credit Cards &amp; Loans App</title>
  </head>
  <body>
    <main>
      <h1>One app for all things money</h1>
      <p>Loved by 35 Lakh+ Indians</p>
    </main>
  </body>
</html>
`

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Fi Money | Careers | Join us to build the future of fintech</title>
    <link rel="canonical" href="https://fi.money/careers" />
  </head>
  <body>
    <main>
      <h1>Help banking time travel &amp; have fun doing it 😇</h1>
      <p>Our creed isn\u2019t relentless disruption. It\u2019s to always do the right thing \u2013 both for the team and our users.</p>
      <a href="https://jobs.lever.co/epifi">VIEW OPEN ROLES</a>
    </main>
  </body>
</html>
`

const officialLeverBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Workloom</title>
  </head>
  <body>
    <section>Location type</section>
    <section>Location</section>
    <section>Team</section>
    <section>Work type</section>
    <div>Bangalore</div>
    <a href="https://jobs.lever.co/epifi/08c743e8-2b29-4f78-827e-5bd90476ed86">Ai Engg Intern</a>
    <a href="https://jobs.lever.co/epifi/f1417887-7e7f-4a03-9c39-8017752d659c">GTM - sales</a>
    <a href="https://tetriz.ai">Workloom Home Page</a>
    <a href="https://www.lever.co/job-seeker-support/" class="image-link">
      <span>Jobs powered by </span>
      <img alt="Lever logo" src="/img/lever-logo-full.svg" />
    </a>
  </body>
</html>
`

const sampleLeverJobs = [
  {
    id: '08c743e8-2b29-4f78-827e-5bd90476ed86',
    text: 'Ai Engg Intern',
    hostedUrl: 'https://jobs.lever.co/epifi/08c743e8-2b29-4f78-827e-5bd90476ed86',
    applyUrl: 'https://jobs.lever.co/epifi/08c743e8-2b29-4f78-827e-5bd90476ed86/apply',
    createdAt: 1_783_071_737_738,
    categories: {
      location: 'Bangalore',
      team: 'Backend',
      department: 'Engineering',
      commitment: 'Intern',
      allLocations: ['Bangalore'],
    },
    country: 'IN',
    workplaceType: 'onsite',
    descriptionBody: `
      <div>Tetriz helps engineering organizations become AI-native, faster.</div>
      <ul>
        <li>Build and ship real product features.</li>
      </ul>
    `,
  },
  {
    id: 'f1417887-7e7f-4a03-9c39-8017752d659c',
    text: 'GTM - sales',
    hostedUrl: 'https://jobs.lever.co/epifi/f1417887-7e7f-4a03-9c39-8017752d659c',
    applyUrl: 'https://jobs.lever.co/epifi/f1417887-7e7f-4a03-9c39-8017752d659c/apply',
    createdAt: 1_781_079_632_765,
    categories: {
      location: 'Bangalore',
      team: 'Sales',
      department: 'Business',
      commitment: 'Full-time',
      allLocations: ['Bangalore'],
    },
    country: 'IN',
    workplaceType: 'hybrid',
    descriptionPlain: 'Own GTM sales motions for the Bangalore team.',
  },
  {
    id: 'us-role-1',
    text: 'US Only Role',
    hostedUrl: 'https://jobs.lever.co/epifi/us-role-1',
    applyUrl: 'https://jobs.lever.co/epifi/us-role-1/apply',
    createdAt: 1_781_079_632_000,
    categories: {
      location: 'New York',
      team: 'Sales',
      department: 'Business',
      commitment: 'Full-time',
      allLocations: ['New York'],
    },
    country: 'US',
    workplaceType: 'remote',
    descriptionPlain: 'Must be filtered out.',
  },
]

const loadModule = async () => {
  try {
    return await import('../../scraper/epifi/script.js')
  } catch {
    assert.fail('Expected Epifi scraper module at ../../scraper/epifi/script.js')
  }
}

test('Epifi scraper constants stay pinned to the verified first-party Fi Money careers and Lever board contract', async () => {
  const epifi = await loadModule()

  assert.equal(epifi.SOURCE, 'epifi')
  assert.equal(epifi.COMPANY, 'Epifi')
  assert.equal(epifi.OFFICIAL_BRAND_NAME, 'Fi Money')
  assert.equal(epifi.HOMEPAGE_URL, 'https://epifi.com/')
  assert.equal(epifi.RESOLVED_HOMEPAGE_URL, 'https://fi.money/')
  assert.equal(epifi.CAREERS_URL, 'https://fi.money/careers')
  assert.equal(epifi.LEVER_BOARD_URL, 'https://jobs.lever.co/epifi')
  assert.equal(epifi.LEVER_API_URL, 'https://api.lever.co/v0/postings/epifi?mode=json')
  assert.equal(epifi.VERIFIED_INDIA_COUNTRY_CODE, 'IN')
  assert.equal(epifi.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(epifi.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(
    epifi.extractLeverBoardUrl(officialCareersHtml),
    'https://jobs.lever.co/epifi',
  )
  assert.equal(epifi.hasOfficialLeverBoardSignal(officialLeverBoardHtml), true)
  assert.equal(
    epifi.buildPublicJobUrl('08c743e8-2b29-4f78-827e-5bd90476ed86'),
    'https://jobs.lever.co/epifi/08c743e8-2b29-4f78-827e-5bd90476ed86',
  )
})

test('Epifi extracts only India roles from the Lever postings payload shape', async () => {
  const epifi = await loadModule()
  const jobs = epifi.extractIndiaLeverJobs(sampleLeverJobs)

  assert.deepEqual(jobs, [
    {
      title: 'Ai Engg Intern',
      company: 'Epifi',
      department: 'Backend',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '08c743e8-2b29-4f78-827e-5bd90476ed86',
      requisitionId: '08c743e8-2b29-4f78-827e-5bd90476ed86',
      sourceUrl: 'https://jobs.lever.co/epifi/08c743e8-2b29-4f78-827e-5bd90476ed86',
      applyUrl: 'https://jobs.lever.co/epifi/08c743e8-2b29-4f78-827e-5bd90476ed86/apply',
      employmentType: 'Intern',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-03T09:42:17.738Z',
      closingDate: null,
      jobDescription:
        'Tetriz helps engineering organizations become AI-native, faster. Build and ship real product features.',
      remoteStatus: 'On-site',
    },
    {
      title: 'GTM - sales',
      company: 'Epifi',
      department: 'Sales',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: 'f1417887-7e7f-4a03-9c39-8017752d659c',
      requisitionId: 'f1417887-7e7f-4a03-9c39-8017752d659c',
      sourceUrl: 'https://jobs.lever.co/epifi/f1417887-7e7f-4a03-9c39-8017752d659c',
      applyUrl: 'https://jobs.lever.co/epifi/f1417887-7e7f-4a03-9c39-8017752d659c/apply',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-06-10T08:20:32.765Z',
      closingDate: null,
      jobDescription: 'Own GTM sales motions for the Bangalore team.',
      remoteStatus: 'Hybrid',
    },
  ])
})

test('Epifi run validates the first-party redirect and careers handoff before returning India jobs from the public Lever feed', async () => {
  const epifi = await loadModule()
  const pageRequests = []
  const jsonRequests = []

  const jobs = await epifi.createEpifiScraper({
    now: () => '2026-07-15T12:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      pageRequests.push(url)

      if (url === epifi.HOMEPAGE_URL) {
        return {
          status: 200,
          url: epifi.RESOLVED_HOMEPAGE_URL,
          html: officialHomepageHtml,
        }
      }

      if (url === epifi.CAREERS_URL) {
        return {
          status: 200,
          url,
          html: officialCareersHtml,
        }
      }

      if (url === epifi.LEVER_BOARD_URL) {
        return {
          status: 200,
          url,
          html: officialLeverBoardHtml,
        }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchJson: async (url) => {
      jsonRequests.push(url)

      if (url === epifi.LEVER_API_URL) {
        return sampleLeverJobs
      }

      throw new Error(`Unexpected json URL: ${url}`)
    },
  })

  assert.deepEqual(pageRequests, [
    epifi.HOMEPAGE_URL,
    epifi.CAREERS_URL,
    epifi.LEVER_BOARD_URL,
  ])
  assert.deepEqual(jsonRequests, [epifi.LEVER_API_URL])
  assert.deepEqual(jobs, [
    {
      title: 'Ai Engg Intern',
      company: 'Epifi',
      department: 'Backend',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '08c743e8-2b29-4f78-827e-5bd90476ed86',
      requisitionId: '08c743e8-2b29-4f78-827e-5bd90476ed86',
      sourceUrl: 'https://jobs.lever.co/epifi/08c743e8-2b29-4f78-827e-5bd90476ed86',
      applyUrl: 'https://jobs.lever.co/epifi/08c743e8-2b29-4f78-827e-5bd90476ed86/apply',
      employmentType: 'Intern',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-03T09:42:17.738Z',
      closingDate: null,
      jobDescription:
        'Tetriz helps engineering organizations become AI-native, faster. Build and ship real product features.',
      remoteStatus: 'On-site',
      source: 'epifi',
      companyCareerPage: 'https://fi.money/careers',
      companyDomain: 'fi.money',
      atsPlatform: 'lever',
      link: 'https://jobs.lever.co/epifi/08c743e8-2b29-4f78-827e-5bd90476ed86/apply',
      scrapedAt: '2026-07-15T12:00:00.000Z',
    },
    {
      title: 'GTM - sales',
      company: 'Epifi',
      department: 'Sales',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: 'f1417887-7e7f-4a03-9c39-8017752d659c',
      requisitionId: 'f1417887-7e7f-4a03-9c39-8017752d659c',
      sourceUrl: 'https://jobs.lever.co/epifi/f1417887-7e7f-4a03-9c39-8017752d659c',
      applyUrl: 'https://jobs.lever.co/epifi/f1417887-7e7f-4a03-9c39-8017752d659c/apply',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-06-10T08:20:32.765Z',
      closingDate: null,
      jobDescription: 'Own GTM sales motions for the Bangalore team.',
      remoteStatus: 'Hybrid',
      source: 'epifi',
      companyCareerPage: 'https://fi.money/careers',
      companyDomain: 'fi.money',
      atsPlatform: 'lever',
      link: 'https://jobs.lever.co/epifi/f1417887-7e7f-4a03-9c39-8017752d659c/apply',
      scrapedAt: '2026-07-15T12:00:00.000Z',
    },
  ])
})

test('Epifi fails closed when the verified homepage redirect, careers handoff, or Lever board changes materially', async () => {
  const epifi = await loadModule()

  await assert.rejects(
    epifi.createEpifiScraper().run({
      fetchPage: async (url) => {
        if (url === epifi.HOMEPAGE_URL) {
          return {
            status: 200,
            url: epifi.HOMEPAGE_URL,
            html: '<html><head><title>Home</title></head><body>placeholder</body></html>',
          }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async () => sampleLeverJobs,
    }),
    /verified official homepage redirect changed materially/i,
  )

  await assert.rejects(
    epifi.createEpifiScraper().run({
      fetchPage: async (url) => {
        if (url === epifi.HOMEPAGE_URL) {
          return {
            status: 200,
            url: epifi.RESOLVED_HOMEPAGE_URL,
            html: officialHomepageHtml,
          }
        }

        if (url === epifi.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: officialCareersHtml.replace('https://jobs.lever.co/epifi', 'https://jobs.lever.co/other-company'),
          }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async () => sampleLeverJobs,
    }),
    /verified public lever board/i,
  )

  await assert.rejects(
    epifi.createEpifiScraper().run({
      fetchPage: async (url) => {
        if (url === epifi.HOMEPAGE_URL) {
          return {
            status: 200,
            url: epifi.RESOLVED_HOMEPAGE_URL,
            html: officialHomepageHtml,
          }
        }

        if (url === epifi.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: officialCareersHtml,
          }
        }

        if (url === epifi.LEVER_BOARD_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Workloom</title></head><body><h1>Empty</h1></body></html>',
          }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async () => sampleLeverJobs,
    }),
    /verified public lever board/i,
  )
})
