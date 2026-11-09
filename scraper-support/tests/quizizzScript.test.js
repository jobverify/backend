import assert from 'node:assert/strict'
import test from 'node:test'

const exactNameCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Browse our Careers | Wayground (formerly Quizizz)</title>
  </head>
  <body>
    <main>
      <h1>Reimagine how the world learns</h1>
      <p>2025 Quizizz Inc. (DBA Wayground)</p>
    </main>
  </body>
</html>
`

const officialLeverBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Wayground (formerly Quizizz)</title>
    <meta property="og:description" content="Job openings at Wayground (formerly Quizizz)" />
  </head>
  <body>
    <h1>Wayground (formerly Quizizz)</h1>
    <section>Location type</section>
    <section>Location</section>
    <section>Team</section>
    <section>Work type</section>
    <a href="https://jobs.lever.co/Wayground/1f96f79c-0168-4a33-b0ae-f8fb649e69f2">Customer Success Manager</a>
    <a href="https://jobs.lever.co/Wayground/aae8a38e-404a-4c1f-8b26-3c356154bb01">Intern- Strategic Partnership</a>
  </body>
</html>
`

const sampleLeverJobs = [
  {
    id: '1f96f79c-0168-4a33-b0ae-f8fb649e69f2',
    text: 'Customer Success Manager',
    hostedUrl: 'https://jobs.lever.co/Wayground/1f96f79c-0168-4a33-b0ae-f8fb649e69f2',
    applyUrl: 'https://jobs.lever.co/Wayground/1f96f79c-0168-4a33-b0ae-f8fb649e69f2/apply',
    createdAt: 1_752_440_400_000,
    categories: {
      location: 'Bangalore',
      team: 'Customer Success',
      commitment: 'Full-time',
      allLocations: ['Bangalore'],
    },
    country: 'IN',
    workplaceType: 'onsite',
    descriptionPlain: 'Support school and district customers across the product lifecycle.',
  },
  {
    id: 'aae8a38e-404a-4c1f-8b26-3c356154bb01',
    text: 'Intern- Strategic Partnership',
    hostedUrl: 'https://jobs.lever.co/Wayground/aae8a38e-404a-4c1f-8b26-3c356154bb01',
    applyUrl: 'https://jobs.lever.co/Wayground/aae8a38e-404a-4c1f-8b26-3c356154bb01/apply',
    createdAt: 1_752_526_800_000,
    categories: {
      location: 'Bangalore',
      team: 'Growth',
      commitment: 'Internship',
      allLocations: ['Bangalore'],
    },
    country: 'IN',
    workplaceType: 'onsite',
    descriptionPlain: 'Support partnerships research and execution for the growth team.',
  },
  {
    id: 'us-role-0001',
    text: 'US Role',
    hostedUrl: 'https://jobs.lever.co/Wayground/us-role-0001',
    applyUrl: 'https://jobs.lever.co/Wayground/us-role-0001/apply',
    createdAt: 1_752_613_200_000,
    categories: {
      location: 'New York',
      team: 'Operations',
      commitment: 'Full-time',
      allLocations: ['New York'],
    },
    country: 'US',
    workplaceType: 'remote',
    descriptionPlain: 'Role outside India that must be filtered out.',
  },
]

const richerLeverJob = {
  id: 'de1283c4-fccd-483b-bbd9-9c9f7e57dabc',
  text: 'Account Executive - Skillet',
  hostedUrl: 'https://jobs.lever.co/Wayground/de1283c4-fccd-483b-bbd9-9c9f7e57dabc',
  applyUrl: 'https://jobs.lever.co/Wayground/de1283c4-fccd-483b-bbd9-9c9f7e57dabc/apply',
  createdAt: 1_785_403_026_117,
  categories: {
    location: 'Bangalore',
    team: 'Sales Development',
    commitment: 'Full-time',
    allLocations: ['Bangalore'],
  },
  country: 'IN',
  workplaceType: 'onsite',
  descriptionPlain: 'Skillet is an AI-powered platform for life sciences commercial teams.',
  additionalPlain: "Who you are You have 2+ years of experience selling B2B SaaS solutions, preferably to customers in the US or Europe.",
}

const loadModule = async () => {
  try {
    return await import('../../scraper/quizizz/script.js')
  } catch {
    assert.fail('Expected Quizizz scraper module at ../../scraper/quizizz/script.js')
  }
}

test('Quizizz scraper constants stay pinned to the verified exact-name careers redirect and Lever board contract', async () => {
  const quizizz = await loadModule()

  assert.equal(quizizz.SOURCE, 'quizizz')
  assert.equal(quizizz.COMPANY, 'Quizizz')
  assert.equal(quizizz.OFFICIAL_BRAND_NAME, 'Wayground (formerly Quizizz)')
  assert.equal(quizizz.CAREERS_URL, 'https://quizizz.com/home/careers?lng=en')
  assert.equal(quizizz.RESOLVED_CAREERS_URL, 'https://wayground.com/home/careers?lng=en')
  assert.equal(quizizz.LEVER_BOARD_URL, 'https://jobs.lever.co/Wayground')
  assert.equal(quizizz.LEVER_API_URL, 'https://api.lever.co/v0/postings/Wayground?mode=json')
  assert.equal(quizizz.VERIFIED_INDIA_COUNTRY_CODE, 'IN')
  assert.equal(quizizz.hasResolvedCareersSignal(exactNameCareersHtml), true)
  assert.equal(
    quizizz.extractLeverBoardUrl(exactNameCareersHtml),
    'https://jobs.lever.co/Wayground',
  )
  assert.equal(quizizz.hasOfficialLeverBoardSignal(officialLeverBoardHtml), true)
  assert.equal(
    quizizz.buildPublicJobUrl('1f96f79c-0168-4a33-b0ae-f8fb649e69f2'),
    'https://jobs.lever.co/Wayground/1f96f79c-0168-4a33-b0ae-f8fb649e69f2',
  )
})

test('Quizizz extracts only India roles from the Wayground Lever postings payload shape', async () => {
  const quizizz = await loadModule()
  const jobs = quizizz.extractIndiaLeverJobs(sampleLeverJobs)

  assert.deepEqual(jobs, [
    {
      title: 'Intern- Strategic Partnership',
      company: 'Quizizz',
      department: 'Growth',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: 'aae8a38e-404a-4c1f-8b26-3c356154bb01',
      requisitionId: 'aae8a38e-404a-4c1f-8b26-3c356154bb01',
      sourceUrl: 'https://jobs.lever.co/Wayground/aae8a38e-404a-4c1f-8b26-3c356154bb01',
      applyUrl: 'https://jobs.lever.co/Wayground/aae8a38e-404a-4c1f-8b26-3c356154bb01/apply',
      employmentType: 'Internship',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2025-07-14T21:00:00.000Z',
      closingDate: null,
      jobDescription: 'Support partnerships research and execution for the growth team.',
      remoteStatus: 'On-site',
    },
    {
      title: 'Customer Success Manager',
      company: 'Quizizz',
      department: 'Customer Success',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '1f96f79c-0168-4a33-b0ae-f8fb649e69f2',
      requisitionId: '1f96f79c-0168-4a33-b0ae-f8fb649e69f2',
      sourceUrl: 'https://jobs.lever.co/Wayground/1f96f79c-0168-4a33-b0ae-f8fb649e69f2',
      applyUrl: 'https://jobs.lever.co/Wayground/1f96f79c-0168-4a33-b0ae-f8fb649e69f2/apply',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2025-07-13T21:00:00.000Z',
      closingDate: null,
      jobDescription: 'Support school and district customers across the product lifecycle.',
      remoteStatus: 'On-site',
    },
  ])
})

test('Quizizz extracts experienceRequired from richer Lever text sections when descriptionPlain alone has no years', async () => {
  const quizizz = await loadModule()
  const [job] = quizizz.extractIndiaLeverJobs([richerLeverJob])

  assert.equal(job.experienceRequired, '2+ years')
  assert.match(job.jobDescription, /Skillet is an AI-powered platform/i)
  assert.match(job.jobDescription, /2\+ years of experience selling B2B SaaS solutions/i)
})

test('Quizizz run validates the exact-name careers redirect and returns only India jobs from the public Lever feed', async () => {
  const quizizz = await loadModule()
  const pageRequests = []
  const jsonRequests = []

  const jobs = await quizizz.createQuizizzScraper({
    now: () => '2026-07-17T12:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      pageRequests.push(url)

      if (url === quizizz.CAREERS_URL) {
        return { status: 200, url: quizizz.RESOLVED_CAREERS_URL, html: exactNameCareersHtml }
      }

      if (url === quizizz.LEVER_BOARD_URL) {
        return { status: 200, url, html: officialLeverBoardHtml }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchJson: async (url) => {
      jsonRequests.push(url)

      if (url === quizizz.LEVER_API_URL) {
        return sampleLeverJobs
      }

      throw new Error(`Unexpected json URL: ${url}`)
    },
  })

  assert.deepEqual(pageRequests, [
    quizizz.CAREERS_URL,
    quizizz.LEVER_BOARD_URL,
  ])
  assert.deepEqual(jsonRequests, [quizizz.LEVER_API_URL])
  assert.deepEqual(jobs, [
    {
      title: 'Intern- Strategic Partnership',
      company: 'Quizizz',
      department: 'Growth',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: 'aae8a38e-404a-4c1f-8b26-3c356154bb01',
      requisitionId: 'aae8a38e-404a-4c1f-8b26-3c356154bb01',
      sourceUrl: 'https://jobs.lever.co/Wayground/aae8a38e-404a-4c1f-8b26-3c356154bb01',
      applyUrl: 'https://jobs.lever.co/Wayground/aae8a38e-404a-4c1f-8b26-3c356154bb01/apply',
      employmentType: 'Internship',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2025-07-14T21:00:00.000Z',
      closingDate: null,
      jobDescription: 'Support partnerships research and execution for the growth team.',
      remoteStatus: 'On-site',
      source: 'quizizz',
      companyCareerPage: 'https://quizizz.com/home/careers?lng=en',
      companyDomain: 'quizizz.com',
      atsPlatform: 'lever',
      link: 'https://jobs.lever.co/Wayground/aae8a38e-404a-4c1f-8b26-3c356154bb01/apply',
      scrapedAt: '2026-07-17T12:00:00.000Z',
    },
    {
      title: 'Customer Success Manager',
      company: 'Quizizz',
      department: 'Customer Success',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '1f96f79c-0168-4a33-b0ae-f8fb649e69f2',
      requisitionId: '1f96f79c-0168-4a33-b0ae-f8fb649e69f2',
      sourceUrl: 'https://jobs.lever.co/Wayground/1f96f79c-0168-4a33-b0ae-f8fb649e69f2',
      applyUrl: 'https://jobs.lever.co/Wayground/1f96f79c-0168-4a33-b0ae-f8fb649e69f2/apply',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2025-07-13T21:00:00.000Z',
      closingDate: null,
      jobDescription: 'Support school and district customers across the product lifecycle.',
      remoteStatus: 'On-site',
      source: 'quizizz',
      companyCareerPage: 'https://quizizz.com/home/careers?lng=en',
      companyDomain: 'quizizz.com',
      atsPlatform: 'lever',
      link: 'https://jobs.lever.co/Wayground/1f96f79c-0168-4a33-b0ae-f8fb649e69f2/apply',
      scrapedAt: '2026-07-17T12:00:00.000Z',
    },
  ])
})

test('Quizizz fails closed when the verified redirect or Lever board changes materially', async () => {
  const quizizz = await loadModule()

  await assert.rejects(
    quizizz.createQuizizzScraper().run({
      fetchPage: async (url) => {
        if (url === quizizz.CAREERS_URL) {
          return { status: 200, url: quizizz.CAREERS_URL, html: exactNameCareersHtml }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async () => sampleLeverJobs,
    }),
    /exact-name careers redirect/i,
  )

  await assert.rejects(
    quizizz.createQuizizzScraper().run({
      fetchPage: async (url) => {
        if (url === quizizz.CAREERS_URL) {
          return { status: 200, url: quizizz.RESOLVED_CAREERS_URL, html: exactNameCareersHtml }
        }

        if (url === quizizz.LEVER_BOARD_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Wayground</title></head><body><h1>Wayground</h1></body></html>',
          }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async () => sampleLeverJobs,
    }),
    /verified public lever board/i,
  )
})
