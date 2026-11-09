import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_LANDING_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Nagarro</title>
  </head>
  <body>
    <main>
      <h1>Thinking about becoming a Nagarrian?</h1>
      <h2>Find more details and open positions on these locations</h2>
      <p>China India Japan Philippines Singapore South Africa Sri Lanka Thailand</p>
    </main>
  </body>
</html>
`

const JOB_SEARCH_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Search | Career opportunities with Nagarro | Explore now</title>
  </head>
  <body>
    <main>
      <h1>Your future starts here</h1>
      <h2>Didn't find any open position?</h2>
      <p>All hope is not lost. Feel free to send us your application anyway. You never know.</p>
      <a
        href="https://join.smartrecruiters.com/Nagarro1/338a6454-a0d3-4121-a6c2-51696acb91a3-website-applications"
      >
        Apply
      </a>
    </main>
  </body>
</html>
`

const SMARTRECRUITERS_BOARD_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Nagarro</title>
  </head>
  <body>
    <a href="/">Home Page</a>
    <div>Search job openings, e.g. "manager"</div>
    <a href="#">Clear search results</a>
    <h1>Jobs at Nagarro</h1>
  </body>
</html>
`

const LISTINGS_PAYLOAD = {
  totalFound: 1,
  content: [
    {
      id: '744000138066871',
      name: 'Associate Principal Engineer, Dotnet Fullstack',
      refNumber: 'REF-NAG-100',
      releasedDate: '2026-07-10T08:15:00.000Z',
      location: {
        city: 'Chennai',
        region: '',
        country: 'in',
        fullLocation: 'Chennai, , India',
      },
      company: {
        identifier: 'Nagarro1',
        name: 'Nagarro',
      },
      department: {
        id: 'engineering',
        label: 'Engineering',
      },
      typeOfEmployment: {
        id: 'full-time',
        label: 'Full-time',
      },
      experienceLevel: {
        id: 'not-applicable',
        label: 'Not Applicable',
      },
      ref: 'https://api.smartrecruiters.com/v1/companies/Nagarro1/postings/744000138066871',
    },
  ],
}

const DETAIL_PAYLOAD = {
  id: '744000138066871',
  name: 'Associate Principal Engineer, Dotnet Fullstack',
  refNumber: 'REF-NAG-100',
  releasedDate: '2026-07-10T08:15:00.000Z',
  postingUrl:
    'https://jobs.smartrecruiters.com/Nagarro1/744000138066871-associate-principal-engineer-dotnet-fullstack',
  applyUrl:
    'https://jobs.smartrecruiters.com/Nagarro1/744000138066871-associate-principal-engineer-dotnet-fullstack?oga=true',
  location: {
    city: 'Chennai',
    region: '',
    country: 'in',
    fullLocation: 'Chennai, , India',
  },
  department: {
    id: 'engineering',
    label: 'Engineering',
  },
  typeOfEmployment: {
    id: 'full-time',
    label: 'Full-time',
  },
  experienceLevel: {
    id: 'not-applicable',
    label: 'Not Applicable',
  },
  jobAd: {
    sections: {
      jobDescription: {
        text: `
          <p>Build and maintain distributed backend services for enterprise clients.</p>
        `,
      },
      qualifications: {
        text: `
          <p>Strong experience with .NET, microservices, and modern cloud-native engineering.</p>
        `,
      },
      additionalInformation: {
        text: `
          <p>Experience collaborating with globally distributed engineering teams is preferred.</p>
        `,
      },
    },
  },
}

const loadModule = async () => {
  try {
    return await import('../../scraper/nagarro/script.js')
  } catch {
    assert.fail('Expected Nagarro scraper module at ../../scraper/nagarro/script.js')
  }
}

test('Nagarro constants stay pinned to the verified first-party careers pages and SmartRecruiters board', async () => {
  const nagarro = await loadModule()

  assert.equal(nagarro.SOURCE, 'nagarro')
  assert.equal(nagarro.COMPANY, 'Nagarro')
  assert.equal(nagarro.OFFICIAL_BRAND_NAME, 'Nagarro')
  assert.equal(nagarro.VERIFIED_ON, '2026-07-16')
  assert.equal(nagarro.CAREERS_LANDING_URL, 'https://www.nagarro.com/en/careers')
  assert.equal(nagarro.JOB_SEARCH_URL, 'https://www.nagarro.com/en/careers/job-search')
  assert.equal(nagarro.SMARTRECRUITERS_BOARD_URL, 'https://careers.smartrecruiters.com/Nagarro1')
  assert.equal(
    nagarro.SMARTRECRUITERS_LISTING_API_URL,
    'https://api.smartrecruiters.com/v1/companies/Nagarro1/postings',
  )
  assert.equal(
    nagarro.SMARTRECRUITERS_DETAIL_API_URL_TEMPLATE,
    'https://api.smartrecruiters.com/v1/companies/Nagarro1/postings/{{jobId}}',
  )
  assert.equal(
    nagarro.SMARTRECRUITERS_APPLY_URL,
    'https://join.smartrecruiters.com/Nagarro1/338a6454-a0d3-4121-a6c2-51696acb91a3-website-applications',
  )
  assert.equal(nagarro.DETAIL_FETCH_CONCURRENCY, 8)
  assert.equal(nagarro.hasOfficialCareersLandingSignal(CAREERS_LANDING_HTML), true)
  assert.equal(nagarro.hasOfficialJobSearchSignal(JOB_SEARCH_HTML), true)
  assert.equal(nagarro.hasVerifiedSmartRecruitersBoardSignal(SMARTRECRUITERS_BOARD_HTML), true)
  assert.equal(
    nagarro.extractSmartRecruitersCompanyIdentifier(DETAIL_PAYLOAD.postingUrl),
    'Nagarro1',
  )
})

test('Nagarro validates the first-party careers surface and maps SmartRecruiters India jobs', async () => {
  const nagarro = await loadModule()
  const requestedUrls = []

  const jobs = await nagarro.createNagarroScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === nagarro.CAREERS_LANDING_URL) return CAREERS_LANDING_HTML
      if (url === nagarro.JOB_SEARCH_URL) return JOB_SEARCH_HTML
      if (url === nagarro.SMARTRECRUITERS_BOARD_URL) return SMARTRECRUITERS_BOARD_HTML

      throw new Error(`Unexpected Nagarro text fixture URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requestedUrls.push(url)

      if (
        url
        === 'https://api.smartrecruiters.com/v1/companies/Nagarro1/postings?limit=100&country=in&offset=0'
      ) {
        assert.equal(options.method, 'GET')
        return LISTINGS_PAYLOAD
      }

      if (url === 'https://api.smartrecruiters.com/v1/companies/Nagarro1/postings/744000138066871') {
        return DETAIL_PAYLOAD
      }

      throw new Error(`Unexpected Nagarro JSON fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    nagarro.CAREERS_LANDING_URL,
    nagarro.JOB_SEARCH_URL,
    nagarro.SMARTRECRUITERS_BOARD_URL,
    'https://api.smartrecruiters.com/v1/companies/Nagarro1/postings?limit=100&country=in&offset=0',
    'https://api.smartrecruiters.com/v1/companies/Nagarro1/postings/744000138066871',
  ])

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Associate Principal Engineer, Dotnet Fullstack',
    company: 'Nagarro',
    location: 'Chennai, , India',
    city: 'Chennai',
    country: 'India',
    link:
      'https://jobs.smartrecruiters.com/Nagarro1/744000138066871-associate-principal-engineer-dotnet-fullstack',
    applyUrl:
      'https://jobs.smartrecruiters.com/Nagarro1/744000138066871-associate-principal-engineer-dotnet-fullstack?oga=true',
    sourceUrl:
      'https://jobs.smartrecruiters.com/Nagarro1/744000138066871-associate-principal-engineer-dotnet-fullstack',
    source: 'nagarro',
    jobId: '744000138066871',
    requisitionId: 'REF-NAG-100',
    department: 'Engineering',
    employmentType: 'Full-time',
    experienceRequired: null,
    experienceLevel: 'Not Applicable',
    postingDate: '2026-07-10T08:15:00.000Z',
    jobDescription: jobs[0].jobDescription,
    minimumQualification: jobs[0].minimumQualification,
    preferredQualification: jobs[0].preferredQualification,
    requiredSkills: [],
    remoteStatus: 'On-site',
    publicExperienceChecked: true,
    sourceDetailComplete: true,
    scrapedAt: jobs[0].scrapedAt,
  })

  assert.match(jobs[0].jobDescription ?? '', /distributed backend services/i)
  assert.match(jobs[0].minimumQualification ?? '', /microservices/i)
  assert.match(jobs[0].preferredQualification ?? '', /distributed engineering teams/i)
})

test('Nagarro preserves sparse public detail as incomplete without inventing an employer description', async () => {
  const nagarro = await loadModule()

  const jobs = await nagarro.createNagarroScraper().run({
    fetchText: async (url) => {
      if (url === nagarro.CAREERS_LANDING_URL) return CAREERS_LANDING_HTML
      if (url === nagarro.JOB_SEARCH_URL) return JOB_SEARCH_HTML
      if (url === nagarro.SMARTRECRUITERS_BOARD_URL) return SMARTRECRUITERS_BOARD_HTML
      throw new Error(`Unexpected Nagarro text fixture URL: ${url}`)
    },
    fetchJson: async (url) => {
      if (
        url
        === 'https://api.smartrecruiters.com/v1/companies/Nagarro1/postings?limit=100&country=in&offset=0'
      ) {
        return {
          totalFound: 1,
          content: [LISTINGS_PAYLOAD.content[0]],
        }
      }

      if (url === 'https://api.smartrecruiters.com/v1/companies/Nagarro1/postings/744000138066871') {
        return {
          ...DETAIL_PAYLOAD,
          jobAd: {
            sections: {
              jobDescription: { text: '' },
              qualifications: { text: '' },
              additionalInformation: {
                text:
                  '<p><a href="https://www.nagarro.com/hubfs/NagarroWebsiteRedesign-Aug2020/Assets/Docs/Applicant%20Privacy%20Notice-EN.pdf">Click here to access the application privacy notice</a></p>',
              },
            },
          },
        }
      }

      throw new Error(`Unexpected Nagarro JSON fixture URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].publicExperienceChecked, false)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceDetailFailureKind, 'missing-content')
  assert.equal(jobs[0].jobDescription, '')
  assert.match(
    jobs[0].preferredQualification ?? '',
    /application privacy notice|applicant%20privacy%20notice/i,
  )
})

test('Nagarro preserves motivational native text and marks its role description incomplete', async () => {
  const nagarro = await loadModule()

  const jobs = await nagarro.createNagarroScraper().run({
    fetchText: async (url) => {
      if (url === nagarro.CAREERS_LANDING_URL) return CAREERS_LANDING_HTML
      if (url === nagarro.JOB_SEARCH_URL) return JOB_SEARCH_HTML
      if (url === nagarro.SMARTRECRUITERS_BOARD_URL) return SMARTRECRUITERS_BOARD_HTML
      throw new Error(`Unexpected Nagarro text fixture URL: ${url}`)
    },
    fetchJson: async (url) => {
      if (
        url
        === 'https://api.smartrecruiters.com/v1/companies/Nagarro1/postings?limit=100&country=in&offset=0'
      ) {
        return {
          totalFound: 1,
          content: [LISTINGS_PAYLOAD.content[0]],
        }
      }

      if (url === 'https://api.smartrecruiters.com/v1/companies/Nagarro1/postings/744000138066871') {
        return {
          ...DETAIL_PAYLOAD,
          name: 'Associate Staff Engineer',
          postingUrl:
            'https://jobs.smartrecruiters.com/Nagarro1/744000138066871-associate-staff-engineer',
          applyUrl:
            'https://jobs.smartrecruiters.com/Nagarro1/744000138066871-associate-staff-engineer?oga=true',
          jobAd: {
            sections: {
              jobDescription: {
                text: `
                  <p>By this point in your career, it is not just about the tech you know or how well you can code.</p>
                  <p>It is about what more you want to do with that knowledge.</p>
                  <p>Were you given the tools to go beyond solving for X?</p>
                  <p>Can you help your teammates proceed in the right direction?</p>
                `,
              },
              qualifications: { text: '' },
              additionalInformation: {
                text:
                  '<p><a href="https://www.nagarro.com/hubfs/NagarroWebsiteRedesign-Aug2020/Assets/Docs/Applicant%20Privacy%20Notice-EN.pdf">Click here to access the application privacy notice</a></p>',
              },
            },
          },
        }
      }

      throw new Error(`Unexpected Nagarro JSON fixture URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].publicExperienceChecked, false)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceDetailFailureKind, 'missing-content')
  assert.match(jobs[0].jobDescription ?? '', /by this point in your career/i)
  assert.doesNotMatch(jobs[0].jobDescription ?? '', /official nagarro smartrecruiters posting/i)
})

test('Nagarro retains native qualifications separately while its missing JD remains incomplete', async () => {
  const nagarro = await loadModule()

  const jobs = await nagarro.createNagarroScraper().run({
    fetchText: async (url) => {
      if (url === nagarro.CAREERS_LANDING_URL) return CAREERS_LANDING_HTML
      if (url === nagarro.JOB_SEARCH_URL) return JOB_SEARCH_HTML
      if (url === nagarro.SMARTRECRUITERS_BOARD_URL) return SMARTRECRUITERS_BOARD_HTML
      throw new Error(`Unexpected Nagarro text fixture URL: ${url}`)
    },
    fetchJson: async (url) => {
      if (
        url
        === 'https://api.smartrecruiters.com/v1/companies/Nagarro1/postings?limit=100&country=in&offset=0'
      ) {
        return {
          totalFound: 1,
          content: [LISTINGS_PAYLOAD.content[0]],
        }
      }

      if (url === 'https://api.smartrecruiters.com/v1/companies/Nagarro1/postings/744000138066871') {
        return {
          ...DETAIL_PAYLOAD,
          name: 'Associate Principal Consultant, Business Analyst',
          postingUrl:
            'https://jobs.smartrecruiters.com/Nagarro1/744000138066871-associate-principal-consultant-business-analyst',
          applyUrl:
            'https://jobs.smartrecruiters.com/Nagarro1/744000138066871-associate-principal-consultant-business-analyst?oga=true',
          jobAd: {
            sections: {
              jobDescription: { text: '' },
              qualifications: {
                text: `
                  <ul>
                    <li>8+ years of experience in business analysis, with a focus on software development projects.</li>
                    <li>Strong expertise in software development processes, methodologies, and tools.</li>
                  </ul>
                `,
              },
              additionalInformation: {
                text:
                  '<p><a href="https://www.nagarro.com/hubfs/NagarroWebsiteRedesign-Aug2020/Assets/Docs/Applicant%20Privacy%20Notice-EN.pdf">Click here to access the application privacy notice</a></p>',
              },
            },
          },
        }
      }

      throw new Error(`Unexpected Nagarro JSON fixture URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].publicExperienceChecked, false)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceDetailFailureKind, 'missing-content')
  assert.equal(jobs[0].jobDescription, '')
  assert.match(jobs[0].minimumQualification ?? '', /8\+ years of experience in business analysis/i)
})

test('Nagarro overlaps detail API fetches so the large India job feed does not crawl serially', async () => {
  const nagarro = await loadModule()
  let activeDetailRequests = 0
  let maxActiveDetailRequests = 0

  const listingsPayload = {
    totalFound: 3,
    content: [
      {
        ...LISTINGS_PAYLOAD.content[0],
        id: '744000138066871',
        refNumber: 'REF-NAG-100',
      },
      {
        ...LISTINGS_PAYLOAD.content[0],
        id: '744000138066872',
        refNumber: 'REF-NAG-101',
        name: 'Lead Engineer, Java',
      },
      {
        ...LISTINGS_PAYLOAD.content[0],
        id: '744000138066873',
        refNumber: 'REF-NAG-102',
        name: 'Principal Engineer, Data',
      },
    ],
  }

  const detailPayloads = new Map([
    [
      'https://api.smartrecruiters.com/v1/companies/Nagarro1/postings/744000138066871',
      DETAIL_PAYLOAD,
    ],
    [
      'https://api.smartrecruiters.com/v1/companies/Nagarro1/postings/744000138066872',
      {
        ...DETAIL_PAYLOAD,
        id: '744000138066872',
        refNumber: 'REF-NAG-101',
        name: 'Lead Engineer, Java',
        postingUrl: 'https://jobs.smartrecruiters.com/Nagarro1/744000138066872-lead-engineer-java',
        applyUrl:
          'https://jobs.smartrecruiters.com/Nagarro1/744000138066872-lead-engineer-java?oga=true',
      },
    ],
    [
      'https://api.smartrecruiters.com/v1/companies/Nagarro1/postings/744000138066873',
      {
        ...DETAIL_PAYLOAD,
        id: '744000138066873',
        refNumber: 'REF-NAG-102',
        name: 'Principal Engineer, Data',
        postingUrl:
          'https://jobs.smartrecruiters.com/Nagarro1/744000138066873-principal-engineer-data',
        applyUrl:
          'https://jobs.smartrecruiters.com/Nagarro1/744000138066873-principal-engineer-data?oga=true',
      },
    ],
  ])

  const jobs = await nagarro.createNagarroScraper({ maxJobs: 3 }).run({
    fetchText: async (url) => {
      if (url === nagarro.CAREERS_LANDING_URL) return CAREERS_LANDING_HTML
      if (url === nagarro.JOB_SEARCH_URL) return JOB_SEARCH_HTML
      if (url === nagarro.SMARTRECRUITERS_BOARD_URL) return SMARTRECRUITERS_BOARD_HTML
      throw new Error(`Unexpected Nagarro text fixture URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      if (
        url
        === 'https://api.smartrecruiters.com/v1/companies/Nagarro1/postings?limit=100&country=in&offset=0'
      ) {
        assert.equal(options.method, 'GET')
        return listingsPayload
      }

      const detailPayload = detailPayloads.get(url)
      if (!detailPayload) {
        throw new Error(`Unexpected Nagarro JSON fixture URL: ${url}`)
      }

      activeDetailRequests += 1
      maxActiveDetailRequests = Math.max(maxActiveDetailRequests, activeDetailRequests)
      await new Promise((resolve) => setTimeout(resolve, 25))
      activeDetailRequests -= 1

      return detailPayload
    },
  })

  assert.equal(jobs.length, 3)
  assert.ok(
    maxActiveDetailRequests >= 2,
    `Expected overlapping Nagarro detail requests, saw max concurrency ${maxActiveDetailRequests}`,
  )
})

test('Nagarro fails closed when the verified first-party careers surface or SmartRecruiters company wiring drifts', async () => {
  const nagarro = await loadModule()

  await assert.rejects(
    nagarro.createNagarroScraper().run({
      fetchText: async (url) => {
        if (url === nagarro.CAREERS_LANDING_URL) return '<html><body><h1>Nagarro</h1></body></html>'
        if (url === nagarro.JOB_SEARCH_URL) return JOB_SEARCH_HTML
        if (url === nagarro.SMARTRECRUITERS_BOARD_URL) return SMARTRECRUITERS_BOARD_HTML
        throw new Error(`Unexpected Nagarro text fixture URL: ${url}`)
      },
      fetchJson: async () => LISTINGS_PAYLOAD,
    }),
    /official careers landing page changed/i,
  )

  await assert.rejects(
    nagarro.createNagarroScraper().run({
      fetchText: async (url) => {
        if (url === nagarro.CAREERS_LANDING_URL) return CAREERS_LANDING_HTML
        if (url === nagarro.JOB_SEARCH_URL) return '<html><body><h1>Search</h1></body></html>'
        if (url === nagarro.SMARTRECRUITERS_BOARD_URL) return SMARTRECRUITERS_BOARD_HTML
        throw new Error(`Unexpected Nagarro text fixture URL: ${url}`)
      },
      fetchJson: async () => LISTINGS_PAYLOAD,
    }),
    /official job-search page changed/i,
  )

  await assert.rejects(
    nagarro.createNagarroScraper().run({
      fetchText: async (url) => {
        if (url === nagarro.CAREERS_LANDING_URL) return CAREERS_LANDING_HTML
        if (url === nagarro.JOB_SEARCH_URL) return JOB_SEARCH_HTML
        if (url === nagarro.SMARTRECRUITERS_BOARD_URL) return '<html><body><h1>Careers</h1></body></html>'
        throw new Error(`Unexpected Nagarro text fixture URL: ${url}`)
      },
      fetchJson: async () => LISTINGS_PAYLOAD,
    }),
    /smartrecruiters board/i,
  )

  await assert.rejects(
    nagarro.createNagarroScraper().run({
      fetchText: async (url) => {
        if (url === nagarro.CAREERS_LANDING_URL) return CAREERS_LANDING_HTML
        if (url === nagarro.JOB_SEARCH_URL) return JOB_SEARCH_HTML
        if (url === nagarro.SMARTRECRUITERS_BOARD_URL) return SMARTRECRUITERS_BOARD_HTML
        throw new Error(`Unexpected Nagarro text fixture URL: ${url}`)
      },
      fetchJson: async (url) => {
        if (
          url
          === 'https://api.smartrecruiters.com/v1/companies/Nagarro1/postings?limit=100&country=in&offset=0'
        ) {
          return LISTINGS_PAYLOAD
        }

        if (url === 'https://api.smartrecruiters.com/v1/companies/Nagarro1/postings/744000138066871') {
          return {
            ...DETAIL_PAYLOAD,
            postingUrl: 'https://jobs.smartrecruiters.com/AnotherCompany/744000138066871-role',
            applyUrl: 'https://jobs.smartrecruiters.com/AnotherCompany/744000138066871-role?oga=true',
          }
        }

        throw new Error(`Unexpected Nagarro JSON fixture URL: ${url}`)
      },
    }),
    /smartrecruiters company identifier changed/i,
  )
})
