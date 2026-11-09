import assert from 'node:assert/strict'
import test from 'node:test'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join Our Team | KredX</title>
  </head>
  <body>
    <main>
      <h1>Join Our Team</h1>
      <h2>Current Openings</h2>
      <a href="/join-our-team/manager-supplier-acquisition">
        Manager / Senior Manager - Supplier Acquisition
      </a>
      <a href="/join-our-team/company-secretary">Company Secretary</a>
      <a href="/join-our-team/manager-mid-and-large-corporate-acquisition">
        Manager / Senior Manager – Mid & Large Corporate Acquisition
      </a>
      <a href="/join-our-team/product-manager">Product Manager</a>
      <a href="https://careers.smartrecruiters.com/Kredx">join us</a>
    </main>
  </body>
</html>
`

const smartRecruitersBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Kredx</title>
  </head>
  <body>
    <h1>Jobs at Kredx</h1>
    <section>
      <p>Bengaluru, India</p>
      <a href="https://jobs.smartrecruiters.com/Kredx/744000131627550-product-manager-">
        Product Manager
      </a>
    </section>
    <section>
      <p>Mumbai, India</p>
      <a href="https://jobs.smartrecruiters.com/Kredx/744000135555555-company-secretary">
        Company Secretary
      </a>
    </section>
  </body>
</html>
`

const smartRecruitersListingsPayload = {
  totalFound: 1,
  content: [
    {
      id: '744000131627550',
      name: 'Product Manager',
      refNumber: 'REF232M',
      releasedDate: '2026-07-01T05:30:00.000Z',
      location: {
        city: 'Bengaluru',
        region: 'KA',
        country: 'in',
        fullLocation: 'Bengaluru, KA, India',
      },
      company: {
        identifier: 'Kredx',
        name: 'KredX',
      },
      department: {
        id: 'product',
        label: 'Product',
      },
      typeOfEmployment: {
        id: 'permanent',
        label: 'Full-time',
      },
      experienceLevel: {
        id: 'mid-senior',
        label: 'Mid-Senior level',
      },
      ref: 'https://api.smartrecruiters.com/v1/companies/Kredx/postings/744000131627550',
    },
  ],
}

const smartRecruitersDetailPayload = {
  id: '744000131627550',
  name: 'Product Manager',
  refNumber: 'REF232M',
  releasedDate: '2026-07-01T05:30:00.000Z',
  postingUrl:
    'https://jobs.smartrecruiters.com/Kredx/744000131627550-product-manager-',
  applyUrl:
    'https://jobs.smartrecruiters.com/Kredx/744000131627550-product-manager-?oga=true',
  location: {
    city: 'Bengaluru',
    region: 'KA',
    country: 'in',
    fullLocation: 'Bengaluru, KA, India',
  },
  department: {
    id: 'product',
    label: 'Product',
  },
  typeOfEmployment: {
    id: 'permanent',
    label: 'Full-time',
  },
  experienceLevel: {
    id: 'mid-senior',
    label: 'Mid-Senior level',
  },
  jobAd: {
    sections: {
      jobDescription: {
        text: `
          <p>Own the product roadmap for the supply-chain finance platform.</p>
        `,
      },
      qualifications: {
        text: `
          <p>5+ years of product management experience in B2B fintech.</p>
        `,
      },
      additionalInformation: {
        text: `
          <p>Comfort working with business, risk, and engineering stakeholders.</p>
        `,
      },
    },
  },
}

const loadKredXModule = async () => {
  try {
    return await import('../../scraper/kredx/script.js')
  } catch {
    assert.fail('Expected KredX scraper module at ../../scraper/kredx/script.js')
  }
}

test('KredX pins the verified first-party openings page and SmartRecruiters board handoff', async () => {
  const kredx = await loadKredXModule()

  assert.equal(kredx.SOURCE, 'kredx')
  assert.equal(kredx.COMPANY_NAME, 'KredX')
  assert.equal(kredx.CAREERS_URL, 'https://www.kredx.com/join-our-team')
  assert.equal(kredx.SMARTRECRUITERS_BOARD_URL, 'https://careers.smartrecruiters.com/Kredx')
  assert.equal(
    kredx.SMARTRECRUITERS_LISTING_API_URL,
    'https://api.smartrecruiters.com/v1/companies/Kredx/postings',
  )
  assert.equal(kredx.VERIFIED_ON, '2026-07-16')
  assert.equal(kredx.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.deepEqual(kredx.extractVisibleFirstPartyJobTitles(officialCareersHtml), [
    'Manager / Senior Manager - Supplier Acquisition',
    'Company Secretary',
    'Manager / Senior Manager – Mid & Large Corporate Acquisition',
    'Product Manager',
  ])
  assert.equal(kredx.hasVerifiedSmartRecruitersBoardSignal(smartRecruitersBoardHtml), true)
})

test('KredX validates the first-party careers surface and maps SmartRecruiters jobs', async () => {
  const kredx = await loadKredXModule()
  const requestedUrls = []

  const jobs = await kredx.createKredXScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === kredx.CAREERS_URL) return officialCareersHtml
      if (url === kredx.SMARTRECRUITERS_BOARD_URL) return smartRecruitersBoardHtml

      throw new Error(`Unexpected KredX text fixture URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requestedUrls.push(url)

      if (
        url
        === 'https://api.smartrecruiters.com/v1/companies/Kredx/postings?limit=100&country=in&offset=0'
      ) {
        assert.equal(options.method, 'GET')
        return smartRecruitersListingsPayload
      }

      if (url === 'https://api.smartrecruiters.com/v1/companies/Kredx/postings/744000131627550') {
        return smartRecruitersDetailPayload
      }

      throw new Error(`Unexpected KredX JSON fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    kredx.CAREERS_URL,
    kredx.SMARTRECRUITERS_BOARD_URL,
    'https://api.smartrecruiters.com/v1/companies/Kredx/postings?limit=100&country=in&offset=0',
    'https://api.smartrecruiters.com/v1/companies/Kredx/postings/744000131627550',
  ])

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Product Manager',
    company: 'KredX',
    location: 'Bengaluru, KA, India',
    city: 'Bengaluru',
    country: 'India',
    link: 'https://jobs.smartrecruiters.com/Kredx/744000131627550-product-manager-',
    applyUrl: 'https://jobs.smartrecruiters.com/Kredx/744000131627550-product-manager-?oga=true',
    sourceUrl: 'https://jobs.smartrecruiters.com/Kredx/744000131627550-product-manager-',
    source: 'kredx',
    jobId: '744000131627550',
    requisitionId: 'REF232M',
    department: 'Product',
    employmentType: 'Full-time',
    experienceRequired: null,
    experienceLevel: 'Mid-Senior level',
    postingDate: '2026-07-01T05:30:00.000Z',
    jobDescription: jobs[0].jobDescription,
    minimumQualification: jobs[0].minimumQualification,
    preferredQualification: jobs[0].preferredQualification,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
  })

  assert.match(jobs[0].jobDescription ?? '', /product roadmap/i)
  assert.match(jobs[0].minimumQualification ?? '', /5\+ years/i)
  assert.match(jobs[0].preferredQualification ?? '', /engineering stakeholders/i)
})

test('KredX fails closed when the verified first-party surface or API overlap changes', async () => {
  const kredx = await loadKredXModule()

  await assert.rejects(
    kredx.createKredXScraper().run({
      fetchText: async (url) => {
        if (url === kredx.CAREERS_URL) return '<html><body><h1>KredX</h1></body></html>'
        if (url === kredx.SMARTRECRUITERS_BOARD_URL) return smartRecruitersBoardHtml
        throw new Error(`Unexpected KredX text fixture URL: ${url}`)
      },
      fetchJson: async () => smartRecruitersListingsPayload,
    }),
    /official careers surface changed/i,
  )

  await assert.rejects(
    kredx.createKredXScraper().run({
      fetchText: async (url) => {
        if (url === kredx.CAREERS_URL) return officialCareersHtml
        if (url === kredx.SMARTRECRUITERS_BOARD_URL) return '<html><body><h1>Kredx</h1></body></html>'
        throw new Error(`Unexpected KredX text fixture URL: ${url}`)
      },
      fetchJson: async () => smartRecruitersListingsPayload,
    }),
    /smartrecruiters board/i,
  )

  await assert.rejects(
    kredx.createKredXScraper().run({
      fetchText: async (url) => {
        if (url === kredx.CAREERS_URL) return officialCareersHtml
        if (url === kredx.SMARTRECRUITERS_BOARD_URL) return smartRecruitersBoardHtml
        throw new Error(`Unexpected KredX text fixture URL: ${url}`)
      },
      fetchJson: async (url) => {
        if (
          url
          === 'https://api.smartrecruiters.com/v1/companies/Kredx/postings?limit=100&country=in&offset=0'
        ) {
          return {
            totalFound: 1,
            content: [
              {
                ...smartRecruitersListingsPayload.content[0],
                id: '744000199999999',
                name: 'Collections Analyst',
                refNumber: 'REF999Z',
                ref: 'https://api.smartrecruiters.com/v1/companies/Kredx/postings/744000199999999',
              },
            ],
          }
        }

        if (url === 'https://api.smartrecruiters.com/v1/companies/Kredx/postings/744000199999999') {
          return {
            ...smartRecruitersDetailPayload,
            id: '744000199999999',
            name: 'Collections Analyst',
            refNumber: 'REF999Z',
          }
        }

        throw new Error(`Unexpected KredX JSON fixture URL: ${url}`)
      },
    }),
    /no overlap between first-party openings and smartrecruiters jobs/i,
  )
})
