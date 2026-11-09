import assert from 'node:assert/strict'
import test from 'node:test'

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>FamApp: Make payments with your own UPI and Card</title>
  </head>
  <body>
    <main>
      <p>#JoinTheFam</p>
      <h1>Be a part of the team setting the bar for new-world work culture</h1>
      <h2>So like, what does Fam do?</h2>
      <p>We are raising a new, financially aware generation of Indians who understand the fundamentals of personal finance.</p>
      <p>FamApp by Trio (formerly FamPay) focuses on financial inclusion of the next generation.</p>
      <script src="/_next/static/chunks/a57fc16ab57e4e2c.js"></script>
    </main>
  </body>
</html>
`

const careersBundleJs = `
  p:"#JoinTheFam";
  h1:"Be a part of the team setting the bar for new-world work culture";
  o.default,{buttonText:"View openings",path:"jobs",wrapStyle:{padding:"0 1.5rem",backgroundColor:"#FBAF03",fontSize:"16px",lineHeight:"3",fontWeight:"600"},activeStatus:!0}
`

const jobsPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>FamApp: Make payments with your own UPI and Card</title>
  </head>
  <body>
    <div id="__next"></div>
    <script src="/_next/static/chunks/46b0e91d4324e433.js"></script>
    <script id="__NEXT_DATA__" type="application/json">
      {"page":"/jobs"}
    </script>
  </body>
</html>
`

const jobsBundleJs = `
  async()=>{let e=await a.default.get("https://api.lever.co/v0/postings/fampay?group=team&mode=json").catch(()=>{f([])});
`

const blankTitleCareersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title></title>
  </head>
  <body>
    <main>
      <p>#JoinTheFam</p>
      <h1>Be a part of the team setting the bar for <span>new-world</span> work culture</h1>
      <h2>So like, what does Fam do?</h2>
      <p>FamApp by Trio (formerly FamPay) focuses on financial inclusion of the next generation.</p>
      <script src="/_next/static/chunks/a57fc16ab57e4e2c.js"></script>
    </main>
  </body>
</html>
`

const blankTitleJobsPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title></title>
  </head>
  <body>
    <div id="__next"></div>
    <script src="/_next/static/chunks/46b0e91d4324e433.js"></script>
    <script id="__NEXT_DATA__" type="application/json">
      {"page":"/jobs"}
    </script>
  </body>
</html>
`

const leverBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Fam</title>
    <meta name="twitter:title" content="Fam">
    <meta name="twitter:description" content="Job openings at Fam">
  </head>
  <body>
    <section>Location type</section>
    <section>Location</section>
    <section>Team</section>
    <section>Work type</section>
    <a href="https://jobs.lever.co/fampay/7c59fd4b-508e-4a91-9d73-164bc7d9abba">Architect (10+ Years)</a>
    <a href="https://jobs.lever.co/fampay/ed0b7a4f-112a-4768-b4f9-d2e8368e5ad8">Product Analyst Intern</a>
    <a href="https://www.famapp.in/">Fam Home Page</a>
    <p>Jobs powered by Lever</p>
  </body>
</html>
`

const leverBoardHtmlWithoutPoweredByLever = `
<!doctype html>
<html lang="en">
  <head>
    <title>Fam</title>
    <meta name="twitter:title" content="Fam">
    <meta name="twitter:description" content="Job openings at Fam">
  </head>
  <body>
    <section>Location type</section>
    <section>Location</section>
    <section>Team</section>
    <section>Work type</section>
    <a href="https://jobs.lever.co/fampay/7c59fd4b-508e-4a91-9d73-164bc7d9abba">Architect (10+ Years)</a>
    <a href="https://www.famapp.in/">Fam Home Page</a>
  </body>
</html>
`

const sampleGroupedLeverJobs = [
  {
    title: 'Business',
    postings: [
      {
        id: '76e5974a-aa6f-4342-81f3-2a99821c2adc',
        text: 'Business & Partnerships Associate',
        hostedUrl: 'https://jobs.lever.co/fampay/76e5974a-aa6f-4342-81f3-2a99821c2adc',
        applyUrl: 'https://jobs.lever.co/fampay/76e5974a-aa6f-4342-81f3-2a99821c2adc/apply',
        createdAt: 1_783_326_818_676,
        categories: {
          location: 'Bengaluru',
          team: 'Business',
          commitment: 'Full Time',
          allLocations: ['Bengaluru'],
        },
        country: 'IN',
        workplaceType: 'onsite',
        descriptionPlain: 'Build and grow partnerships for Fam.',
      },
    ],
  },
  {
    title: 'Data & Analytics',
    postings: [
      {
        id: 'ed0b7a4f-112a-4768-b4f9-d2e8368e5ad8',
        text: 'Product Analyst Intern',
        hostedUrl: 'https://jobs.lever.co/fampay/ed0b7a4f-112a-4768-b4f9-d2e8368e5ad8',
        applyUrl: 'https://jobs.lever.co/fampay/ed0b7a4f-112a-4768-b4f9-d2e8368e5ad8/apply',
        createdAt: 1_779_089_282_642,
        categories: {
          location: 'Bengaluru',
          team: 'Data & Analytics',
          commitment: 'Intern',
          allLocations: ['Bengaluru'],
        },
        country: 'IN',
        workplaceType: 'onsite',
        descriptionBodyPlain:
          'Fuel decisions with data and help shape strategic business decisions at Fam.',
      },
      {
        id: 'us-only-role',
        text: 'US Role',
        hostedUrl: 'https://jobs.lever.co/fampay/us-only-role',
        applyUrl: 'https://jobs.lever.co/fampay/us-only-role/apply',
        createdAt: 1_779_000_000_000,
        categories: {
          location: 'New York',
          team: 'Data & Analytics',
          commitment: 'Full Time',
          allLocations: ['New York'],
        },
        country: 'US',
        workplaceType: 'remote',
        descriptionPlain: 'Should be filtered out.',
      },
    ],
  },
]

const loadModule = async () => {
  try {
    return await import('../../scraper/fampay/script.js')
  } catch {
    assert.fail('Expected Fampay scraper module at ../../scraper/fampay/script.js')
  }
}

test('Fampay helpers stay pinned to the verified Fam careers shell, jobs shell, and grouped Lever API contract', async () => {
  const fampay = await loadModule()

  assert.equal(fampay.SOURCE, 'fampay')
  assert.equal(fampay.COMPANY, 'Fampay')
  assert.equal(fampay.OFFICIAL_BRAND_NAME, 'FamApp by Trio')
  assert.equal(fampay.HOMEPAGE_URL, 'https://www.famapp.in/')
  assert.equal(fampay.CAREERS_URL, 'https://www.famapp.in/careers/')
  assert.equal(fampay.JOBS_PAGE_URL, 'https://www.famapp.in/jobs/')
  assert.equal(fampay.CAREERS_BUNDLE_URL, 'https://www.famapp.in/_next/static/chunks/a57fc16ab57e4e2c.js')
  assert.equal(fampay.JOBS_BUNDLE_URL, 'https://www.famapp.in/_next/static/chunks/46b0e91d4324e433.js')
  assert.equal(fampay.LEVER_BOARD_URL, 'https://jobs.lever.co/fampay')
  assert.equal(fampay.LEVER_API_URL, 'https://api.lever.co/v0/postings/fampay?group=team&mode=json')
  assert.equal(fampay.VERIFIED_INDIA_COUNTRY_CODE, 'IN')
  assert.equal(fampay.VERIFIED_ON, '2026-07-15')
  assert.match(fampay.VERIFIED_SURFACE_SUMMARY, /17 India roles/i)
  assert.equal(fampay.hasOfficialCareersSignal(careersPageHtml), true)
  assert.equal(fampay.hasVerifiedCareersBundleReference(careersPageHtml), true)
  assert.equal(fampay.hasCareersBundleJobsHandoff(careersBundleJs), true)
  assert.equal(fampay.hasOfficialJobsShellSignal(jobsPageHtml), true)
  assert.equal(fampay.hasVerifiedJobsBundleReference(jobsPageHtml), true)
  assert.equal(fampay.hasJobsBundleLeverApiSignal(jobsBundleJs), true)
  assert.equal(fampay.hasOfficialLeverBoardSignal(leverBoardHtml), true)
  assert.equal(
    fampay.buildPublicJobUrl('7c59fd4b-508e-4a91-9d73-164bc7d9abba'),
    'https://jobs.lever.co/fampay/7c59fd4b-508e-4a91-9d73-164bc7d9abba',
  )
})

test('Fampay accepts the current blank-title server-rendered careers and jobs shells', async () => {
  const fampay = await loadModule()

  assert.equal(fampay.hasOfficialCareersSignal(blankTitleCareersPageHtml), true)
  assert.equal(fampay.hasVerifiedCareersBundleReference(blankTitleCareersPageHtml), true)
  assert.equal(fampay.hasOfficialJobsShellSignal(blankTitleJobsPageHtml), true)
  assert.equal(fampay.hasVerifiedJobsBundleReference(blankTitleJobsPageHtml), true)
  assert.equal(fampay.hasOfficialLeverBoardSignal(leverBoardHtmlWithoutPoweredByLever), true)
})

test('Fampay extracts only India roles from the grouped Lever postings payload shape', async () => {
  const fampay = await loadModule()
  const jobs = fampay.extractIndiaLeverJobs(sampleGroupedLeverJobs)

  assert.deepEqual(jobs, [
    {
      title: 'Business & Partnerships Associate',
      company: 'Fampay',
      department: 'Business',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '76e5974a-aa6f-4342-81f3-2a99821c2adc',
      requisitionId: '76e5974a-aa6f-4342-81f3-2a99821c2adc',
      sourceUrl: 'https://jobs.lever.co/fampay/76e5974a-aa6f-4342-81f3-2a99821c2adc',
      applyUrl: 'https://jobs.lever.co/fampay/76e5974a-aa6f-4342-81f3-2a99821c2adc/apply',
      employmentType: 'Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-06T08:33:38.676Z',
      closingDate: null,
      jobDescription: 'Build and grow partnerships for Fam.',
      remoteStatus: 'On-site',
    },
    {
      title: 'Product Analyst Intern',
      company: 'Fampay',
      department: 'Data & Analytics',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: 'ed0b7a4f-112a-4768-b4f9-d2e8368e5ad8',
      requisitionId: 'ed0b7a4f-112a-4768-b4f9-d2e8368e5ad8',
      sourceUrl: 'https://jobs.lever.co/fampay/ed0b7a4f-112a-4768-b4f9-d2e8368e5ad8',
      applyUrl: 'https://jobs.lever.co/fampay/ed0b7a4f-112a-4768-b4f9-d2e8368e5ad8/apply',
      employmentType: 'Intern',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-05-18T07:28:02.642Z',
      closingDate: null,
      jobDescription: 'Fuel decisions with data and help shape strategic business decisions at Fam.',
      remoteStatus: 'On-site',
    },
  ])
})

test('Fampay run validates the first-party careers shell, jobs shell bundle, and grouped Lever feed before returning India jobs', async () => {
  const fampay = await loadModule()
  const pageRequests = []
  const jsonRequests = []

  const jobs = await fampay.createFampayScraper({
    now: () => '2026-07-15T12:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      pageRequests.push(url)

      if (url === fampay.CAREERS_URL) {
        return { status: 200, url, html: careersPageHtml }
      }

      if (url === fampay.CAREERS_BUNDLE_URL) {
        return { status: 200, url, html: careersBundleJs }
      }

      if (url === fampay.JOBS_PAGE_URL) {
        return { status: 200, url, html: jobsPageHtml }
      }

      if (url === fampay.JOBS_BUNDLE_URL) {
        return { status: 200, url, html: jobsBundleJs }
      }

      if (url === fampay.LEVER_BOARD_URL) {
        return { status: 200, url, html: leverBoardHtml }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchJson: async (url) => {
      jsonRequests.push(url)

      if (url === fampay.LEVER_API_URL) {
        return sampleGroupedLeverJobs
      }

      throw new Error(`Unexpected json URL: ${url}`)
    },
  })

  assert.deepEqual(pageRequests, [
    fampay.CAREERS_URL,
    fampay.CAREERS_BUNDLE_URL,
    fampay.JOBS_PAGE_URL,
    fampay.JOBS_BUNDLE_URL,
    fampay.LEVER_BOARD_URL,
  ])
  assert.deepEqual(jsonRequests, [fampay.LEVER_API_URL])
  assert.deepEqual(jobs, [
    {
      title: 'Business & Partnerships Associate',
      company: 'Fampay',
      department: 'Business',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '76e5974a-aa6f-4342-81f3-2a99821c2adc',
      requisitionId: '76e5974a-aa6f-4342-81f3-2a99821c2adc',
      sourceUrl: 'https://jobs.lever.co/fampay/76e5974a-aa6f-4342-81f3-2a99821c2adc',
      applyUrl: 'https://jobs.lever.co/fampay/76e5974a-aa6f-4342-81f3-2a99821c2adc/apply',
      employmentType: 'Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-06T08:33:38.676Z',
      closingDate: null,
      jobDescription: 'Build and grow partnerships for Fam.',
      remoteStatus: 'On-site',
      source: 'fampay',
      companyCareerPage: 'https://www.famapp.in/careers/',
      companyDomain: 'famapp.in',
      atsPlatform: 'lever',
      link: 'https://jobs.lever.co/fampay/76e5974a-aa6f-4342-81f3-2a99821c2adc/apply',
      scrapedAt: '2026-07-15T12:00:00.000Z',
    },
    {
      title: 'Product Analyst Intern',
      company: 'Fampay',
      department: 'Data & Analytics',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: 'ed0b7a4f-112a-4768-b4f9-d2e8368e5ad8',
      requisitionId: 'ed0b7a4f-112a-4768-b4f9-d2e8368e5ad8',
      sourceUrl: 'https://jobs.lever.co/fampay/ed0b7a4f-112a-4768-b4f9-d2e8368e5ad8',
      applyUrl: 'https://jobs.lever.co/fampay/ed0b7a4f-112a-4768-b4f9-d2e8368e5ad8/apply',
      employmentType: 'Intern',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-05-18T07:28:02.642Z',
      closingDate: null,
      jobDescription: 'Fuel decisions with data and help shape strategic business decisions at Fam.',
      remoteStatus: 'On-site',
      source: 'fampay',
      companyCareerPage: 'https://www.famapp.in/careers/',
      companyDomain: 'famapp.in',
      atsPlatform: 'lever',
      link: 'https://jobs.lever.co/fampay/ed0b7a4f-112a-4768-b4f9-d2e8368e5ad8/apply',
      scrapedAt: '2026-07-15T12:00:00.000Z',
    },
  ])
})

test('Fampay fails closed when the verified careers shell, jobs bundle, or Lever board changes materially', async () => {
  const fampay = await loadModule()

  await assert.rejects(
    fampay.createFampayScraper().run({
      fetchPage: async (url) => {
        if (url === fampay.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Fam</h1></body></html>',
          }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async () => sampleGroupedLeverJobs,
    }),
    /verified first-party careers surface changed materially/i,
  )

  await assert.rejects(
    fampay.createFampayScraper().run({
      fetchPage: async (url) => {
        if (url === fampay.CAREERS_URL) {
          return { status: 200, url, html: careersPageHtml }
        }

        if (url === fampay.CAREERS_BUNDLE_URL) {
          return {
            status: 200,
            url,
            html: 'buttonText:"View openings",path:"careers"',
          }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async () => sampleGroupedLeverJobs,
    }),
    /verified careers bundle handoff changed materially/i,
  )

  await assert.rejects(
    fampay.createFampayScraper().run({
      fetchPage: async (url) => {
        if (url === fampay.CAREERS_URL) {
          return { status: 200, url, html: careersPageHtml }
        }

        if (url === fampay.CAREERS_BUNDLE_URL) {
          return { status: 200, url, html: careersBundleJs }
        }

        if (url === fampay.JOBS_PAGE_URL) {
          return { status: 200, url, html: jobsPageHtml }
        }

        if (url === fampay.JOBS_BUNDLE_URL) {
          return {
            status: 200,
            url,
            html: 'https://api.lever.co/v0/postings/other-company?group=team&mode=json',
          }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async () => sampleGroupedLeverJobs,
    }),
    /verified jobs bundle api handoff changed materially/i,
  )

  await assert.rejects(
    fampay.createFampayScraper().run({
      fetchPage: async (url) => {
        if (url === fampay.CAREERS_URL) {
          return { status: 200, url, html: careersPageHtml }
        }

        if (url === fampay.CAREERS_BUNDLE_URL) {
          return { status: 200, url, html: careersBundleJs }
        }

        if (url === fampay.JOBS_PAGE_URL) {
          return { status: 200, url, html: jobsPageHtml }
        }

        if (url === fampay.JOBS_BUNDLE_URL) {
          return { status: 200, url, html: jobsBundleJs }
        }

        if (url === fampay.LEVER_BOARD_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Fam</h1></body></html>',
          }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async () => sampleGroupedLeverJobs,
    }),
    /verified public lever board changed materially/i,
  )
})
