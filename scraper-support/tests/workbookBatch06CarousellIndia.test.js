import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_BOARD_HTML = `
  <html>
    <head>
      <title>Careers at Carousell Group</title>
    </head>
    <body>
      <header>
        <a href="https://careers.carousell.com/who-we-are/">Home Page</a>
        <a href="/contact">Get in touch!</a>
      </header>
      <main>
        <h1>Careers at Carousell</h1>
        <h2>Jobs at Carousell</h2>
        <p>Browse by:</p>
        <p>Location</p>
        <section>
          <h3>Ho Chi Minh City, Vietnam</h3>
          <p>2 jobs</p>
          <a href="https://jobs.smartrecruiters.com/CarousellGroup/744000139194869-business-analyst-commercial-nha-tot">
            Business Analyst - Commercial (Nha Tot)
          </a>
          <p>Full-time</p>
          <a href="https://jobs.smartrecruiters.com/CarousellGroup/744000139911019-growth-specialist-seller-success-monetisation-nha-tot">
            Growth Specialist - Seller Success & Monetisation (Nha Tot)
          </a>
        </section>
      </main>
    </body>
  </html>
`

const LISTINGS_PAYLOAD = {
  totalFound: 3,
  content: [
    {
      id: '744000138024389',
      name: 'iOS intern (6 months internship)',
      refNumber: 'REF1356Z',
      releasedDate: '2026-07-16T04:32:52.079Z',
      location: {
        city: 'Bengaluru',
        region: 'KA',
        country: 'in',
        remote: true,
        hybrid: false,
        fullLocation: 'Bengaluru, KA, India',
      },
      company: {
        identifier: 'CarousellGroup',
        name: 'Carousell Group',
      },
      department: {
        label: 'Engineering - Paying Users',
      },
      typeOfEmployment: {
        label: 'Intern',
      },
      ref: 'https://api.smartrecruiters.com/v1/companies/CarousellGroup/postings/744000138024389',
    },
    {
      id: '744000139194869',
      name: 'Business Analyst - Commercial (Nha Tot)',
      refNumber: 'REF1440O',
      releasedDate: '2026-07-23T02:36:10.172Z',
      location: {
        city: 'Ho Chi Minh City',
        region: 'Ho Chi Minh',
        country: 'vn',
        remote: false,
        hybrid: false,
        fullLocation: 'Ho Chi Minh City, Ho Chi Minh, Vietnam',
      },
      company: {
        identifier: 'CarousellGroup',
        name: 'Carousell Group',
      },
      department: {
        label: 'Property',
      },
      typeOfEmployment: {
        label: 'Full-time',
      },
      ref: 'https://api.smartrecruiters.com/v1/companies/CarousellGroup/postings/744000139194869',
    },
    {
      id: '744000139257269',
      name: 'Frontliner (Offline Store)',
      refNumber: 'REF1432H',
      releasedDate: '2026-07-23T10:47:49.030Z',
      location: {
        city: 'Tangerang',
        region: 'Banten',
        country: 'id',
        remote: false,
        hybrid: false,
        fullLocation: 'Tangerang, Banten, Indonesia',
      },
      company: {
        identifier: 'CarousellGroup',
        name: 'Carousell Group',
      },
      department: {
        label: 'Sales Ops',
      },
      typeOfEmployment: {
        label: 'Contract',
      },
      ref: 'https://api.smartrecruiters.com/v1/companies/CarousellGroup/postings/744000139257269',
    },
  ],
}

const ZERO_INDIA_LISTINGS_PAYLOAD = {
  totalFound: 2,
  content: [
    {
      id: '744000139194869',
      name: 'Business Analyst - Commercial (Nha Tot)',
      refNumber: 'REF1440O',
      releasedDate: '2026-07-23T02:36:10.172Z',
      location: {
        city: 'Ho Chi Minh City',
        region: 'Ho Chi Minh',
        country: 'vn',
        remote: false,
        hybrid: false,
        fullLocation: 'Ho Chi Minh City, Ho Chi Minh, Vietnam',
      },
      company: {
        identifier: 'CarousellGroup',
        name: 'Carousell Group',
      },
      department: {
        label: 'Property',
      },
      typeOfEmployment: {
        label: 'Full-time',
      },
      ref: 'https://api.smartrecruiters.com/v1/companies/CarousellGroup/postings/744000139194869',
    },
    {
      id: '744000139257269',
      name: 'Frontliner (Offline Store)',
      refNumber: 'REF1432H',
      releasedDate: '2026-07-23T10:47:49.030Z',
      location: {
        city: 'Tangerang',
        region: 'Banten',
        country: 'id',
        remote: false,
        hybrid: false,
        fullLocation: 'Tangerang, Banten, Indonesia',
      },
      company: {
        identifier: 'CarousellGroup',
        name: 'Carousell Group',
      },
      department: {
        label: 'Sales Ops',
      },
      typeOfEmployment: {
        label: 'Contract',
      },
      ref: 'https://api.smartrecruiters.com/v1/companies/CarousellGroup/postings/744000139257269',
    },
  ],
}

const DETAIL_PAYLOAD = {
  id: '744000138024389',
  name: 'iOS intern (6 months internship)',
  refNumber: 'REF1356Z',
  releasedDate: '2026-07-16T04:32:52.079Z',
  postingUrl:
    'https://jobs.smartrecruiters.com/CarousellGroup/744000138024389-ios-intern-6-months-internship-',
  applyUrl:
    'https://jobs.smartrecruiters.com/CarousellGroup/744000138024389-ios-intern-6-months-internship-?oga=true',
  location: {
    city: 'Bengaluru',
    region: 'KA',
    country: 'in',
    remote: true,
    hybrid: false,
    fullLocation: 'Bengaluru, KA, India',
  },
  company: {
    identifier: 'CarousellGroup',
    name: 'Carousell Group',
  },
  department: {
    label: 'Engineering - Paying Users',
  },
  experienceLevel: {
    label: 'Internship',
  },
  typeOfEmployment: {
    label: 'Intern',
  },
  jobAd: {
    sections: {
      jobDescription: {
        text: `
          <p>You will:</p>
          <ul>
            <li>Assist in the development of new features for our iOS applications.</li>
            <li>Integrate with backend services and APIs to ensure seamless functionality.</li>
          </ul>
        `,
      },
      qualifications: {
        text: `
          <ul>
            <li>Enrolled in a bachelor's or master's degree program in computer science, software engineering, or a related field.</li>
            <li>Basic understanding of iOS development and familiar with Swift programming language.</li>
          </ul>
        `,
      },
      additionalInformation: {
        text: `
          <p>Note: This is a 6-month internship role only.</p>
          <p>Read our Candidates Personal Data Privacy Statement.</p>
        `,
      },
    },
  },
}

const loadModule = async () => {
  try {
    return await import('../../scraper/carousellindia/script.js')
  } catch {
    assert.fail('Expected Carousell India scraper module at ../../scraper/carousellindia/script.js')
  }
}

test('Carousell India validates the verified public SmartRecruiters board and maps India jobs from the public API', async () => {
  const carousell = await loadModule()
  const indiaListings = carousell.extractIndiaListings(LISTINGS_PAYLOAD)
  const mappedJob = carousell.mapListingDetailToJob(
    indiaListings[0],
    DETAIL_PAYLOAD,
    '2026-07-25T00:00:00.000Z',
  )

  assert.equal(carousell.SOURCE, 'carousellindia')
  assert.equal(carousell.COMPANY, 'Carousell India')
  assert.equal(carousell.OFFICIAL_BRAND, 'Carousell Group')
  assert.equal(carousell.VERIFIED_ON, '2026-08-01')
  assert.equal(carousell.CAREERS_URL, 'https://careers.smartrecruiters.com/CarousellGroup')
  assert.equal(carousell.HOME_PAGE_URL, 'https://careers.carousell.com/who-we-are/')
  assert.equal(carousell.SMARTRECRUITERS_COMPANY_IDENTIFIER, 'CarousellGroup')
  assert.equal(
    carousell.DISPOSITION,
    'verified-public-smartrecruiters-board-plus-public-jobs-api',
  )
  assert.match(carousell.VERIFIED_SURFACE_SUMMARY, /Saturday, August 1, 2026/)
  assert.match(carousell.VERIFIED_SURFACE_SUMMARY, /careers\.smartrecruiters\.com\/CarousellGroup/i)
  assert.match(carousell.VERIFIED_SURFACE_SUMMARY, /no India postings in the live payload/i)
  assert.equal(carousell.hasVerifiedBoardSignal(VERIFIED_BOARD_HTML), true)
  assert.equal(
    carousell.extractHomePageUrl(VERIFIED_BOARD_HTML),
    'https://careers.carousell.com/who-we-are/',
  )
  assert.equal(
    carousell.buildListingsApiUrl({ limit: 100, offset: 0 }),
    'https://api.smartrecruiters.com/v1/companies/CarousellGroup/postings?limit=100&offset=0',
  )
  assert.equal(indiaListings.length, 1)
  assert.equal(indiaListings[0].name, 'iOS intern (6 months internship)')
  assert.deepEqual(mappedJob, {
    title: 'iOS intern (6 months internship)',
    company: 'Carousell India',
    department: 'Engineering - Paying Users',
    location: 'Bengaluru, KA, India',
    city: 'Bengaluru',
    country: 'India',
    link:
      'https://jobs.smartrecruiters.com/CarousellGroup/744000138024389-ios-intern-6-months-internship-',
    applyUrl:
      'https://jobs.smartrecruiters.com/CarousellGroup/744000138024389-ios-intern-6-months-internship-?oga=true',
    sourceUrl:
      'https://jobs.smartrecruiters.com/CarousellGroup/744000138024389-ios-intern-6-months-internship-',
    source: 'carousellindia',
    jobId: '744000138024389',
    requisitionId: 'REF1356Z',
    employmentType: 'Internship',
    experienceRequired: null,
    experienceLevel: 'Internship',
    postingDate: '2026-07-16T04:32:52.079Z',
    closingDate: null,
    jobDescription:
      'You will: Assist in the development of new features for our iOS applications. Integrate with backend services and APIs to ensure seamless functionality.',
    minimumQualification:
      "Enrolled in a bachelor's or master's degree program in computer science, software engineering, or a related field. Basic understanding of iOS development and familiar with Swift programming language.",
    preferredQualification:
      'Note: This is a 6-month internship role only. Read our Candidates Personal Data Privacy Statement.',
    requiredSkills: [],
    remoteStatus: 'Remote',
    scrapedAt: '2026-07-25T00:00:00.000Z',
  })
})

test('Carousell India run validates the public SmartRecruiters board and returns India jobs only', async () => {
  const carousell = await loadModule()
  const requestedUrls = []

  const jobs = await carousell.createCarousellIndiaScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, carousell.CAREERS_URL)
      return VERIFIED_BOARD_HTML
    },
    fetchJson: async (url, options = {}) => {
      requestedUrls.push(url)
      assert.equal(options.method, 'GET')

      if (
        url
        === 'https://api.smartrecruiters.com/v1/companies/CarousellGroup/postings?limit=100&offset=0'
      ) {
        return LISTINGS_PAYLOAD
      }

      if (
        url
        === 'https://api.smartrecruiters.com/v1/companies/CarousellGroup/postings/744000138024389'
      ) {
        return DETAIL_PAYLOAD
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-25T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    carousell.CAREERS_URL,
    'https://api.smartrecruiters.com/v1/companies/CarousellGroup/postings?limit=100&offset=0',
    'https://api.smartrecruiters.com/v1/companies/CarousellGroup/postings/744000138024389',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'carousellindia')
  assert.equal(jobs[0].company, 'Carousell India')
  assert.equal(jobs[0].location, 'Bengaluru, KA, India')
  assert.equal(jobs[0].employmentType, 'Internship')
  assert.equal(jobs[0].remoteStatus, 'Remote')
  assert.equal(jobs[0].link, jobs[0].sourceUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-25T00:00:00.000Z')
})

test('Carousell India returns an empty list when the verified board is healthy but the public API has no India roles', async () => {
  const carousell = await loadModule()
  const requestedUrls = []

  const jobs = await carousell.createCarousellIndiaScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, carousell.CAREERS_URL)
      return VERIFIED_BOARD_HTML
    },
    fetchJson: async (url, options = {}) => {
      requestedUrls.push(url)
      assert.equal(options.method, 'GET')
      assert.equal(
        url,
        'https://api.smartrecruiters.com/v1/companies/CarousellGroup/postings?limit=100&offset=0',
      )
      return ZERO_INDIA_LISTINGS_PAYLOAD
    },
    now: () => '2026-08-01T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    carousell.CAREERS_URL,
    'https://api.smartrecruiters.com/v1/companies/CarousellGroup/postings?limit=100&offset=0',
  ])
  assert.deepEqual(jobs, [])
})

test('Carousell India fails closed when the verified SmartRecruiters contract drifts', async () => {
  const carousell = await loadModule()

  await assert.rejects(
    carousell.createCarousellIndiaScraper().run({
      fetchText: async () => VERIFIED_BOARD_HTML.replace('Jobs at Carousell', 'Open Roles'),
      fetchJson: async () => LISTINGS_PAYLOAD,
    }),
    /verified public SmartRecruiters board changed materially/i,
  )

  await assert.rejects(
    carousell.createCarousellIndiaScraper().run({
      fetchText: async () =>
        VERIFIED_BOARD_HTML.replace('https://careers.carousell.com/who-we-are/', 'https://example.com/'),
      fetchJson: async () => LISTINGS_PAYLOAD,
    }),
    /verified Home Page link changed materially/i,
  )

  await assert.rejects(
    carousell.createCarousellIndiaScraper({ maxJobs: 1 }).run({
      fetchText: async () => VERIFIED_BOARD_HTML,
      fetchJson: async (url) => {
        if (
          url
          === 'https://api.smartrecruiters.com/v1/companies/CarousellGroup/postings?limit=100&offset=0'
        ) {
          return LISTINGS_PAYLOAD
        }

        return {
          ...DETAIL_PAYLOAD,
          company: {
            identifier: 'AnotherCompany',
            name: 'Another Company',
          },
        }
      },
    }),
    /company identifier changed materially/i,
  )
})
