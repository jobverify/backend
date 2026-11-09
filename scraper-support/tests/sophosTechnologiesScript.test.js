import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => import('../../scraper/sophostechnologies/script.js')

const principalFirewallEngineer = {
  id: '76606093-369d-436c-8541-ad2e8571e6c8',
  text: ' Principal Software Engineer 1 (NSG Firewall) ',
  country: 'IN',
  categories: {
    location: 'India',
    allLocations: ['India', 'Bangalore, India'],
    team: 'Software Engineering',
    commitment: 'Permanent',
  },
  hostedUrl: 'https://jobs.lever.co/sophos/76606093-369d-436c-8541-ad2e8571e6c8',
  applyUrl: 'https://jobs.lever.co/sophos/76606093-369d-436c-8541-ad2e8571e6c8/apply',
  createdAt: 1779693383670,
  workplaceType: 'remote',
  descriptionPlain: 'Shape the next generation of Sophos Firewall.',
  lists: [
    { text: 'What you will bring', content: '<ul><li>C/C++</li><li>Network security</li></ul>' },
  ],
}

const canadaJob = {
  ...principalFirewallEngineer,
  id: '11111111-1111-4111-8111-111111111111',
  text: 'Senior Python Engineer',
  country: 'CA',
  categories: {
    ...principalFirewallEngineer.categories,
    location: 'Canada',
    allLocations: ['Canada'],
  },
  hostedUrl: 'https://jobs.lever.co/sophos/11111111-1111-4111-8111-111111111111',
  applyUrl: 'https://jobs.lever.co/sophos/11111111-1111-4111-8111-111111111111/apply',
}

const indiaZuoraEngineer = {
  ...principalFirewallEngineer,
  id: '4c793de5-2927-4ba6-9239-d90f6879b55e',
  text: 'Zuora Billing- Senior Developer',
  categories: {
    location: 'India',
    allLocations: ['India', 'Ahmedabad, India'],
    team: 'Enterprise Applications',
    commitment: 'Permanent',
  },
  hostedUrl: 'https://jobs.lever.co/sophos/4c793de5-2927-4ba6-9239-d90f6879b55e',
  applyUrl: 'https://jobs.lever.co/sophos/4c793de5-2927-4ba6-9239-d90f6879b55e/apply',
}

test('Sophos Technologies pins the verified first-party Lever board and API', async () => {
  const sophos = await loadModule()

  assert.equal(sophos.SOURCE, 'sophostechnologies')
  assert.equal(sophos.COMPANY, 'Sophos Technologies')
  assert.equal(sophos.OFFICIAL_BRAND_NAME, 'Sophos')
  assert.equal(sophos.CAREERS_URL, 'https://www.sophos.com/en-us/company/careers')
  assert.equal(sophos.LEVER_BOARD_URL, 'https://jobs.lever.co/sophos')
  assert.equal(sophos.LEVER_POSTINGS_API_URL, 'https://api.lever.co/v0/postings/sophos')
  assert.equal(sophos.VERIFIED_ON, '2026-08-14')
})

test('Sophos Technologies paginates Lever until a short page and keeps India jobs from the final page', async () => {
  const sophos = await loadModule()
  const requestedUrls = []

  const jobs = await sophos.createSophosTechnologiesScraper({ pageSize: 2 }).run({
    fetchJson: async (url) => {
      requestedUrls.push(url)
      if (url.endsWith('skip=0')) return [principalFirewallEngineer, canadaJob]
      if (url.endsWith('skip=2')) return [indiaZuoraEngineer]
      assert.fail(`Unexpected page request: ${url}`)
    },
    now: () => '2026-07-23T10:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    'https://api.lever.co/v0/postings/sophos?mode=json&limit=2&skip=0',
    'https://api.lever.co/v0/postings/sophos?mode=json&limit=2&skip=2',
  ])
  assert.deepEqual(jobs.map((job) => job.title), [
    'Principal Software Engineer 1 (NSG Firewall)',
    'Zuora Billing- Senior Developer',
  ])
  assert.deepEqual(jobs[0], {
    title: 'Principal Software Engineer 1 (NSG Firewall)',
    company: 'Sophos Technologies',
    department: 'Software Engineering',
    location: 'Bangalore, India',
    locations: ['India', 'Bangalore, India'],
    city: 'Bangalore',
    country: 'India',
    jobId: '76606093-369d-436c-8541-ad2e8571e6c8',
    requisitionId: '76606093-369d-436c-8541-ad2e8571e6c8',
    sourceUrl: 'https://jobs.lever.co/sophos/76606093-369d-436c-8541-ad2e8571e6c8',
    applyUrl: 'https://jobs.lever.co/sophos/76606093-369d-436c-8541-ad2e8571e6c8/apply',
    link: 'https://jobs.lever.co/sophos/76606093-369d-436c-8541-ad2e8571e6c8/apply',
    source: 'sophostechnologies',
    employmentType: 'Permanent',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: new Date(1779693383670).toISOString(),
    closingDate: null,
    jobDescription: 'Shape the next generation of Sophos Firewall. What you will bring C/C++ Network security',
    remoteStatus: 'Remote',
    scrapedAt: '2026-07-23T10:00:00.000Z',
    companyCareerPage: 'https://www.sophos.com/en-us/company/careers',
    companyDomain: 'sophos.com',
    atsPlatform: 'lever',
  })
})

test('Sophos Technologies recognizes India from allLocations and deduplicates postings by id', async () => {
  const { extractIndiaJobsFromLeverPostings } = await loadModule()
  const locationOnlyIndiaJob = {
    ...indiaZuoraEngineer,
    country: null,
    categories: {
      ...indiaZuoraEngineer.categories,
      location: 'Remote',
      allLocations: ['Remote', 'Ahmedabad, India'],
    },
  }

  const jobs = extractIndiaJobsFromLeverPostings(
    [locationOnlyIndiaJob, canadaJob, locationOnlyIndiaJob],
    { scrapedAt: '2026-07-23T10:00:00.000Z' },
  )

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].location, 'Ahmedabad, India')
  assert.equal(jobs[0].city, 'Ahmedabad')
  assert.deepEqual(jobs[0].locations, ['Remote', 'Ahmedabad, India'])
})

test('Sophos Technologies leaves required skills empty until extraction is section-aware', async () => {
  const { extractIndiaJobsFromLeverPostings } = await loadModule()

  const jobs = extractIndiaJobsFromLeverPostings([principalFirewallEngineer])

  assert.deepEqual(jobs[0].requiredSkills, [])
})

test('Sophos Technologies displays the India location when the primary location is foreign', async () => {
  const { extractIndiaJobsFromLeverPostings } = await loadModule()
  const jobs = extractIndiaJobsFromLeverPostings([{
    ...indiaZuoraEngineer,
    country: null,
    categories: {
      ...indiaZuoraEngineer.categories,
      location: 'London, United Kingdom',
      allLocations: ['London, United Kingdom', 'Bengaluru, Karnataka, India'],
    },
  }])

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].location, 'Bengaluru, Karnataka, India')
  assert.equal(jobs[0].city, 'Bengaluru')
})

test('Sophos Technologies rejects India country metadata with foreign-only locations', async () => {
  const { extractIndiaJobsFromLeverPostings } = await loadModule()
  for (const foreignLocation of ['Boston, Massachusetts, United States', 'Warsaw, Poland']) {
    const jobs = extractIndiaJobsFromLeverPostings([{
      ...indiaZuoraEngineer,
      country: 'IN',
      categories: {
        ...indiaZuoraEngineer.categories,
        location: foreignLocation,
        allLocations: [foreignLocation],
      },
    }])

    assert.deepEqual(jobs, [])
  }
})

test('Sophos Technologies prefers a named India city over a generic remote India location', async () => {
  const { extractIndiaJobsFromLeverPostings } = await loadModule()
  const jobs = extractIndiaJobsFromLeverPostings([{
    ...indiaZuoraEngineer,
    categories: {
      ...indiaZuoraEngineer.categories,
      location: 'Remote, India',
      allLocations: ['Remote, India', 'Bengaluru, Karnataka, India'],
    },
  }])

  assert.equal(jobs[0].location, 'Bengaluru, Karnataka, India')
  assert.equal(jobs[0].city, 'Bengaluru')
})

test('Sophos Technologies accepts the full country name when a location is city-only', async () => {
  const { extractIndiaJobsFromLeverPostings } = await loadModule()
  const fullNameCountryJob = {
    ...indiaZuoraEngineer,
    country: 'India',
    categories: {
      ...indiaZuoraEngineer.categories,
      location: 'Bengaluru',
      allLocations: ['Bengaluru'],
    },
  }

  const jobs = extractIndiaJobsFromLeverPostings([fullNameCountryJob])

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].location, 'Bengaluru')
  assert.equal(jobs[0].city, 'Bengaluru')
  assert.equal(jobs[0].country, 'India')
})

test('Sophos Technologies accepts a generic India location when Lever explicitly cross-lists India for a foreign primary country', async () => {
  const { extractIndiaJobsFromLeverPostings } = await loadModule()
  const crossListedIndiaJob = {
    ...principalFirewallEngineer,
    id: '566fcac4-599c-480d-b904-83d01f58cbbf',
    text: 'Data Quality Analyst (Salesforce Data Steward)',
    country: 'PH',
    categories: {
      location: 'Philippines',
      allLocations: ['Philippines', 'India'],
      team: 'Financial Business Systems and Operations',
      commitment: 'Permanent',
    },
    hostedUrl: 'https://jobs.lever.co/sophos/566fcac4-599c-480d-b904-83d01f58cbbf',
    applyUrl: 'https://jobs.lever.co/sophos/566fcac4-599c-480d-b904-83d01f58cbbf/apply',
  }

  const jobs = extractIndiaJobsFromLeverPostings([crossListedIndiaJob])

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].location, 'India')
  assert.equal(jobs[0].city, null)
  assert.equal(jobs[0].country, 'India')
})

test('Sophos Technologies keeps a missing Lever createdAt as an unknown posting date', async () => {
  const { extractIndiaJobsFromLeverPostings } = await loadModule()

  const jobs = extractIndiaJobsFromLeverPostings([{
    ...principalFirewallEngineer,
    createdAt: null,
  }])

  assert.equal(jobs[0].postingDate, null)
})

test('Sophos Technologies rejects malformed Lever pages and refuses silent max-page truncation', async () => {
  const { fetchAllLeverPostings } = await loadModule()

  await assert.rejects(
    fetchAllLeverPostings({
      fetchJson: async () => ({ postings: [] }),
      pageSize: 2,
    }),
    /expected an array/i,
  )

  let truncationPage = 0
  await assert.rejects(
    fetchAllLeverPostings({
      fetchJson: async () => {
        truncationPage += 1
        return [principalFirewallEngineer, canadaJob].map((posting, index) => ({
          ...posting,
          id: `${posting.id}-${truncationPage}-${index}`,
        }))
      },
      pageSize: 2,
      maxPages: 2,
    }),
    /pagination limit/i,
  )

  let calls = 0
  await assert.rejects(
    fetchAllLeverPostings({
      fetchJson: async () => {
        calls += 1
        return [principalFirewallEngineer, canadaJob]
      },
      pageSize: 2,
      maxPages: 3,
    }),
    /repeated|progress/i,
  )
  assert.equal(calls, 2)
})

test('Sophos Technologies rejects an India posting outside the verified Sophos Lever route', async () => {
  const { extractIndiaJobsFromLeverPostings } = await loadModule()

  assert.throws(
    () => extractIndiaJobsFromLeverPostings([{
      ...principalFirewallEngineer,
      hostedUrl: 'https://example.com/sophos/job',
    }]),
    /verified Sophos Lever URL/i,
  )
})
