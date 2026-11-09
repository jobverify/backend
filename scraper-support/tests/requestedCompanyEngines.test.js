import assert from 'node:assert/strict'
import test from 'node:test'

test('Jibe scraper paginates and normalizes India jobs', async () => {
  const { createJibeScraper } = await import('../shared/jibe.js')
  const requests = []
  const scraper = createJibeScraper({
    source: 'example',
    companyName: 'Example',
    baseUrl: 'https://jobs.example.com',
    query: { country: 'India' },
    pageSize: 2,
    now: () => '2026-07-23T00:00:00.000Z',
  })

  const jobs = await scraper.run({
    fetchJson: async (url) => {
      requests.push(url)
      const page = Number(new URL(url).searchParams.get('page'))
      return page === 1
        ? {
            totalCount: 3,
            jobs: [
              { data: {
                slug: '123-engineer', req_id: 'REQ-123', title: 'Engineer',
                city: 'Bengaluru', state: 'Karnataka', country: 'India',
                categories: [{ name: 'Engineering' }], tags2: 'Hybrid',
                employment_type: 'FULL_TIME', description: '<p>Build things.</p>',
                qualifications: '<p>Five years.</p>', responsibilities: '<p>Ship.</p>',
                posted_date: '2026-07-20', apply_url: 'https://apply.example.com/123',
              } },
              { data: {
                slug: '456-manager', req_id: 'REQ-456', title: 'Manager',
                city: 'Pune', state: 'Maharashtra', country: 'India',
                employment_type: 'FULL_TIME', description: 'Lead.',
              } },
            ],
          }
        : {
            totalCount: 3,
            jobs: [{ data: {
              slug: '789-analyst', req_id: 'REQ-789', title: 'Analyst',
              city: 'Gurugram', state: 'Haryana', country: 'India',
              employment_type: 'CONTRACT', description: 'Analyse.',
            } }],
          }
    },
  })

  assert.equal(requests.length, 2)
  assert.equal(new URL(requests[0]).searchParams.get('country'), 'India')
  assert.equal(new URL(requests[1]).searchParams.get('page'), '2')
  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs[0], {
    title: 'Engineer', company: 'Example', location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru', country: 'India',
    link: 'https://jobs.example.com/jobs/123-engineer?lang=en-us',
    sourceUrl: 'https://jobs.example.com/jobs/123-engineer?lang=en-us',
    applyUrl: 'https://apply.example.com/123', jobId: 'REQ-123', requisitionId: 'REQ-123',
    department: 'Engineering', employmentType: 'Full-time', remoteStatus: 'Hybrid',
    jobDescription: 'Build things.', minimumQualification: 'Five years.',
    preferredQualification: null, requiredSkills: [], postingDate: '2026-07-20',
    closingDate: null, source: 'example', scrapedAt: '2026-07-23T00:00:00.000Z',
  })
})

test('Jibe scraper rejects a repeated full page instead of looping forever', async () => {
  const { createJibeScraper } = await import('../shared/jibe.js')
  const scraper = createJibeScraper({
    source: 'example', companyName: 'Example', baseUrl: 'https://jobs.example.com',
    query: { country: 'India' }, pageSize: 2, maxPages: 5,
  })
  let calls = 0
  const repeatedPage = {
    jobs: [
      { data: { slug: 'one', req_id: '1', title: 'One', city: 'Pune', country: 'India' } },
      { data: { slug: 'two', req_id: '2', title: 'Two', city: 'Pune', country: 'India' } },
    ],
  }

  await assert.rejects(
    scraper.run({ fetchJson: async () => {
      calls += 1
      if (calls > 3) throw new Error('fixture emergency stop')
      return repeatedPage
    } }),
    /repeated|no progress/i,
  )
  assert.equal(calls, 2)
})

test('Jibe scraper rejects premature empty pages and counts unique pagination progress', async () => {
  const { createJibeScraper } = await import('../shared/jibe.js')
  const create = () => createJibeScraper({
    source: 'example', companyName: 'Example', baseUrl: 'https://jobs.example.com',
    query: { country: 'India' }, pageSize: 2,
  })
  const raw = (id) => ({ data: {
    req_id: id, slug: `role-${id}`, title: `Role ${id}`, city: 'Pune', country: 'India',
  } })

  let calls = 0
  await assert.rejects(
    create().run({ fetchJson: async () => {
      calls += 1
      return calls === 1
        ? { totalCount: 4, jobs: [raw('1'), raw('2')] }
        : { totalCount: 4, jobs: [] }
    } }),
    /incomplete|total|premature/i,
  )

  calls = 0
  const jobs = await create().run({ fetchJson: async () => {
    calls += 1
    if (calls === 1) return { totalCount: 4, jobs: [raw(1), raw(2)] }
    if (calls === 2) return { totalCount: 4, jobs: [raw('2'), raw(3)] }
    return { totalCount: 4, jobs: [raw(4)] }
  } })
  assert.equal(calls, 3)
  assert.deepEqual(jobs.map((job) => job.jobId), ['1', '2', '3', '4'])
})

test('Jibe scraper rejects malformed or foreign jobs from an India-filtered page', async () => {
  const { createJibeScraper } = await import('../shared/jibe.js')
  const scraper = createJibeScraper({
    source: 'example', companyName: 'Example', baseUrl: 'https://jobs.example.com',
    query: { country: 'India' }, pageSize: 2,
  })
  await assert.rejects(scraper.run({ fetchJson: async () => ({
    totalCount: 1,
    jobs: [{ data: { req_id: '1', slug: 'foreign', title: 'Foreign', city: 'Boston', country: 'United States' } }],
  }) }), /foreign|India location|malformed/i)
})

test('PTC scraper discovers every India Workday location facet and paginates', async () => {
  const { createPtcScraper } = await import('../../scraper/ptc/script.js')
  const requests = []
  const scraper = createPtcScraper({
    pageSize: 1,
    now: () => '2026-07-23T00:00:00.000Z',
  })

  const facetPayload = {
    total: 164,
    facets: [{
      facetParameter: 'locationMainGroup',
      values: [{
        facetParameter: 'locations',
        values: [
          { descriptor: 'Pune, India', id: 'pune' },
          { descriptor: 'IND-Bangalore, KA', id: 'bangalore' },
          { descriptor: 'Boston, MA, USA', id: 'boston' },
        ],
      }],
    }],
  }
  const pages = [
    { total: 2, jobPostings: [{
      title: 'Principal Product Security Engineer',
      externalPath: '/job/Pune-India/Principal-Product-Security-Engineer_JR111911',
      locationsText: 'Pune, India', bulletFields: ['JR111911'], postedOn: 'Posted Today',
    }] },
    { total: 0, jobPostings: [{
      title: 'Software Engineer', externalPath: '/job/IND-Bangalore/Software-Engineer_JR2',
      locationsText: 'IND-Bangalore, KA', bulletFields: ['JR2'], postedOn: 'Posted Yesterday',
    }] },
  ]

  const jobs = await scraper.run({
    fetchPage: async () => { throw new Error('Controlled optional detail unavailable in pagination fixture') },
    fetchJobsPage: async (request) => {
      requests.push(request)
      return requests.length === 1 ? facetPayload : pages[requests.length - 2]
    },
  })

  assert.deepEqual(requests[1].appliedFacets, { locations: ['pune', 'bangalore'] })
  assert.equal(requests[2].offset, 1)
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].jobId, 'JR111911')
  assert.equal(jobs[0].sourceUrl, 'https://ptc.wd1.myworkdayjobs.com/PTC/job/Pune-India/Principal-Product-Security-Engineer_JR111911')
})

test('PTC scraper enriches India Workday listings with public detail-page experience', async () => {
  const { createPtcScraper } = await import('../../scraper/ptc/script.js')
  const facets = {
    total: 1,
    facets: [{ facetParameter: 'locationMainGroup', values: [{
      facetParameter: 'locations',
      values: [{ descriptor: 'Pune, India', id: 'pune' }],
    }] }],
  }
  const jobs = await createPtcScraper({
    pageSize: 1,
    now: () => '2026-07-23T00:00:00.000Z',
  }).run({
    fetchJobsPage: async (request) => Object.keys(request.appliedFacets).length === 0
      ? facets
      : {
          total: 1,
          jobPostings: [{
            title: 'Principal Product Security Engineer',
            externalPath: '/job/Pune-India/Principal-Product-Security-Engineer_JR111911',
            locationsText: 'Pune, India',
            bulletFields: ['JR111911'],
            postedOn: 'Posted Today',
          }],
        },
    fetchPage: async (url) => ({
      status: 200,
      url,
      html: `
        <html>
          <body>
            <section data-automation-id="jobPostingDescription">
              <div>
                <p>Required Skills & Experience</p>
                <p>5+ years of hands-on experience in product security engineering and secure SDLC practices.</p>
              </div>
            </section>
          </body>
        </html>
      `,
    }),
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].experienceRequired, '5+ years')
  assert.match(jobs[0].jobDescription || '', /product security engineering/i)
})

test('PTC scraper rejects malformed or silently truncated Workday pagination', async () => {
  const { createPtcScraper } = await import('../../scraper/ptc/script.js')
  const facets = {
    total: 2,
    facets: [{ facetParameter: 'locationMainGroup', values: [{
      facetParameter: 'locations', values: [{ descriptor: 'Pune, India', id: 'pune' }],
    }] }],
  }

  await assert.rejects(
    createPtcScraper({ pageSize: 1, maxPages: 1 }).run({
      fetchJobsPage: async (request) => Object.keys(request.appliedFacets).length === 0
        ? facets
        : { total: 2, jobPostings: [{ title: 'One', externalPath: '/job/Pune/One_JR1', locationsText: 'Pune, India', bulletFields: ['JR1'] }] },
    }),
    /pagination limit|truncat/i,
  )

  await assert.rejects(
    createPtcScraper().run({
      fetchJobsPage: async (request) => Object.keys(request.appliedFacets).length === 0
        ? facets
        : { total: 2 },
    }),
    /jobPostings/i,
  )
})

test('PTC scraper fails closed when an India-filtered page returns a foreign posting', async () => {
  const { createPtcScraper } = await import('../../scraper/ptc/script.js')
  const facets = {
    total: 1,
    facets: [{ facetParameter: 'locationMainGroup', values: [{
      facetParameter: 'locations', values: [{ descriptor: 'Pune, India', id: 'pune' }],
    }] }],
  }

  await assert.rejects(
    createPtcScraper().run({
      fetchJobsPage: async (request) => Object.keys(request.appliedFacets).length === 0
        ? facets
        : {
            total: 1,
            jobPostings: [{
              title: 'Boston Engineer', externalPath: '/job/Boston-MA/Engineer_JR-US',
              locationsText: 'Boston, MA, United States', bulletFields: ['JR-US'],
            }],
          },
    }),
    /foreign|India evidence|location/i,
  )
})

test('PTC scraper rejects malformed rows from the filtered Workday page', async () => {
  const { createPtcScraper } = await import('../../scraper/ptc/script.js')
  const facets = {
    total: 1,
    facets: [{ facetParameter: 'locationMainGroup', values: [{
      facetParameter: 'locations', values: [{ descriptor: 'Pune, India', id: 'pune' }],
    }] }],
  }
  await assert.rejects(
    createPtcScraper().run({ fetchJobsPage: async (request) => (
      Object.keys(request.appliedFacets).length === 0
        ? facets
        : { total: 1, jobPostings: [{
            externalPath: '/job/Pune-India/Role_JR1', locationsText: 'Pune, India', bulletFields: ['JR1'],
          }] }
    ) }),
    /malformed|title|required/i,
  )
})

test('PTC scraper rejects title-slug India false positives and premature short pages', async () => {
  const { createPtcScraper } = await import('../../scraper/ptc/script.js')
  const facets = {
    total: 4,
    facets: [{ facetParameter: 'locationMainGroup', values: [{
      facetParameter: 'locations', values: [{ descriptor: 'Pune, India', id: 'pune' }],
    }] }],
  }

  await assert.rejects(createPtcScraper().run({
    fetchJobsPage: async (request) => Object.keys(request.appliedFacets).length === 0
      ? facets
      : { total: 1, jobPostings: [{
          title: 'India Sales Manager', externalPath: '/job/Warsaw/India-Sales-Manager_JR1',
          locationsText: 'Warsaw', bulletFields: ['JR1'],
        }] },
  }), /foreign|ambiguous|location/i)

  await assert.rejects(createPtcScraper({ pageSize: 2 }).run({
    fetchJobsPage: async (request) => Object.keys(request.appliedFacets).length === 0
      ? facets
      : { total: 4, jobPostings: [{
          title: 'Role', externalPath: '/job/Pune-India/Role_JR1',
          locationsText: 'Pune, India', bulletFields: ['JR1'],
        }] },
  }), /short page|declared total/i)

  await assert.rejects(createPtcScraper().run({
    fetchJobsPage: async (request) => Object.keys(request.appliedFacets).length === 0
      ? facets
      : { total: 1, jobPostings: [{
          title: 'Role', externalPath: '/job/Pune-India/Role_JR-PATH',
          locationsText: 'Pune, India', bulletFields: ['JR-BULLET'],
        }] },
  }), /identity|contradicts|job id/i)
})

test('HubSpot scraper queries details only for India jobs', async () => {
  const { createHubSpotScraper } = await import('../../scraper/hubspot/script.js')
  const detailIds = []
  const scraper = createHubSpotScraper({ now: () => '2026-07-23T00:00:00.000Z' })

  const jobs = await scraper.run({
    fetchGraphql: async (_query, variables) => {
      if (!variables) {
        return { jobs: [
          { id: '7005836', title: 'Account Executive', location: { name: 'India' }, office: { location: 'Office - Bengaluru, India' }, department: { name: 'Sales' } },
          { id: '999', title: 'US role', location: { name: 'United States' }, office: { location: 'Boston, MA' }, department: { name: 'Sales' } },
        ] }
      }
      detailIds.push(variables.id)
      return { job: { id: variables.id, title: 'Account Executive', content: '<p>Grow accounts.</p>', department: { name: 'Sales' }, office: { location: 'Office - Bengaluru, India' } } }
    },
  })

  assert.deepEqual(detailIds, ['7005836'])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].location, 'Office - Bengaluru, India')
  assert.equal(jobs[0].city, 'Bengaluru')
  assert.equal(jobs[0].jobDescription, 'Grow accounts.')
  assert.equal(jobs[0].sourceUrl, 'https://www.hubspot.com/careers/jobs/7005836')
})

test('HubSpot scraper rejects GraphQL contract drift and duplicate identities', async () => {
  const { createHubSpotScraper } = await import('../../scraper/hubspot/script.js')
  const scraper = createHubSpotScraper()

  await assert.rejects(
    scraper.run({ fetchGraphql: async () => ({}) }),
    /jobs array|listing/i,
  )

  await assert.rejects(
    scraper.run({ fetchGraphql: async (_query, variables) => variables
      ? { job: { id: variables.id, title: 'Role', content: 'Description', office: { location: 'Bengaluru, India' } } }
      : { jobs: [
          { id: '1', title: 'Role', location: { name: 'India' }, office: { location: 'Bengaluru, India' } },
          { id: '1', title: 'Duplicate', location: { name: 'India' }, office: { location: 'Bengaluru, India' } },
        ] } }),
    /duplicate/i,
  )
})

test('HubSpot emits the exact India-bearing location when office metadata is foreign', async () => {
  const { createHubSpotScraper } = await import('../../scraper/hubspot/script.js')
  const jobs = await createHubSpotScraper().run({ fetchGraphql: async (_query, variables) => (
    variables
      ? { job: {
          id: '1', title: 'India Role', content: 'Work.',
          location: { name: 'India' }, office: { location: 'London, United Kingdom' },
        } }
      : { jobs: [{
          id: '1', title: 'India Role',
          location: { name: 'India' }, office: { location: 'London, United Kingdom' },
        }] }
  ) })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].location, 'India')
  assert.equal(jobs[0].city, null)

  await assert.rejects(createHubSpotScraper().run({ fetchGraphql: async (_query, variables) => (
    variables
      ? { job: { id: '2', title: 'Moved Role', office: { location: 'London, United Kingdom' } } }
      : { jobs: [{
          id: '2', title: 'Moved Role',
          location: { name: 'India' }, office: { location: 'Bengaluru, India' },
        }] }
  ) }), /contradicts|location/i)

  const remote = await createHubSpotScraper().run({ fetchGraphql: async (_query, variables) => (
    variables
      ? { job: { id: '3', title: 'Remote Role', location: { name: 'Remote - India' } } }
      : { jobs: [{ id: '3', title: 'Remote Role', location: { name: 'Remote - India' } }] }
  ) })
  assert.equal(remote[0].city, null)
  assert.equal(remote[0].remoteStatus, 'Remote')
})

test('Pega scraper follows server-rendered listing pages and keeps India jobs', async () => {
  const { createPegaScraper } = await import('../../scraper/pega/script.js')
  const fetched = []
  const scraper = createPegaScraper({ now: () => '2026-07-23T00:00:00.000Z' })
  const pageZero = `
    <article class="bolt-card-replacement">
      <a href="/about/careers/23493/lead-system-architect">
        <h3>Lead System Architect</h3><p>India - Karnataka - Bangalore</p>
      </a>
    </article>
    <article class="bolt-card-replacement">
      <a href="/about/careers/111/us-role"><h3>US role</h3><p>United States</p></a>
    </article>
    <button data-url="?page=1">Load More</button>`
  const pageOne = `
    <article class="bolt-card-replacement">
      <a href="/about/careers/23494/cloud-engineer"><h3>Cloud Engineer</h3><p>India - Remote</p></a>
    </article>`
  const detail = (title) => `<main><h1>${title}</h1><div class="c-text-block"><p>Build cloud systems.</p></div><div class="c-webform-card">Apply</div></main>`

  const jobs = await scraper.run({
    fetchText: async (url) => {
      fetched.push(url)
      if (url.endsWith('?page=1')) return pageOne
      if (url.includes('/about/careers/23493/')) return detail('Lead System Architect')
      if (url.includes('/about/careers/23494/')) return detail('Cloud Engineer')
      return pageZero
    },
  })

  assert.equal(fetched.filter((url) => url.includes('job-listings')).length, 2)
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs.map((job) => job.title), ['Lead System Architect', 'Cloud Engineer'])
  assert.ok(jobs.every((job) => job.country === 'India'))
  assert.deepEqual(jobs.map((job) => job.city), ['Bangalore', null])
  assert.equal(jobs[0].jobDescription, 'Build cloud systems.')
})

test('Pega scraper distinguishes a valid empty result from page drift and truncation', async () => {
  const { createPegaScraper } = await import('../../scraper/pega/script.js')

  const empty = await createPegaScraper().run({
    fetchText: async () => '<main><p>No jobs found</p></main>',
  })
  assert.deepEqual(empty, [])

  await assert.rejects(
    createPegaScraper().run({ fetchText: async () => '<main><div>New careers shell</div></main>' }),
    /recognizable|listing|contract/i,
  )

  await assert.rejects(
    createPegaScraper().run({ fetchText: async () => `
      <article class="bolt-card-replacement">
        <a href="/redesigned/path"><h4>Role</h4><div>India - Pune</div></a>
      </article>`,
    }),
    /malformed|card|contract/i,
  )

  await assert.rejects(
    createPegaScraper().run({ fetchText: async () => `
      <nav><span>0 jobs saved</span></nav>
      <article class="bolt-card-replacement">
        <a href="/new-careers-path"><h4>Redesigned role</h4><div>Pune</div></a>
      </article>`,
    }),
    /recognizable|listing|contract/i,
  )

  await assert.rejects(
    createPegaScraper({ maxPages: 1 }).run({
      fetchText: async () => `
        <article class="bolt-card-replacement">
          <a href="/about/careers/1/role"><h3>Role</h3><p>India - Pune</p></a>
        </article>
        <button data-url="?page=1">Load More</button>`,
    }),
    /pagination limit|truncat/i,
  )

  const multiLocation = await createPegaScraper().run({ fetchText: async (url) => (
    url.includes('/about/careers/2/')
      ? '<main><h1>Role</h1><div class="job-description">Build.</div></main>'
      : `<article class="bolt-card-replacement">
          <a href="/about/careers/2/role"><h3>Role</h3><p>India - Karnataka - Bangalore + 1 other locations</p></a>
        </article>`
  ) })
  assert.equal(multiLocation[0].city, 'Bangalore')
})

test('GoDaddy scraper extracts current India result cards', async () => {
  const { createGoDaddyScraper } = await import('../../scraper/godaddy/script.js')
  const scraper = createGoDaddyScraper({ now: () => '2026-07-23T00:00:00.000Z' })
  const html = `
    <article class="job-search-results-card">
      <a href="/jobs/senior-engineer-gurugram-haryana-india"><h2>Senior Engineer</h2></a>
      <span class="job-id">R023815</span><span class="location">Gurugram, Haryana, India</span>
      <span class="department">Engineering</span>
    </article>
    <article class="job-search-results-card">
      <a href="/jobs/us-role"><h2>US role</h2></a><span class="location">Tempe, Arizona</span>
    </article>`

  const jobs = await scraper.run({ fetchText: async () => html })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Senior Engineer')
  assert.equal(jobs[0].location, 'Gurugram, Haryana, India')
  assert.equal(jobs[0].jobId, 'R023815')
  assert.equal(jobs[0].sourceUrl, 'https://careers.godaddy/jobs/senior-engineer-gurugram-haryana-india')

  const deduped = await scraper.run({ fetchText: async () => `${html}${html}` })
  assert.equal(deduped.length, 1)

  const indiaWide = await scraper.run({ fetchText: async () => `
    <article class="job-search-results-card">
      <a href="/jobs/india-role"><h2>India Role</h2></a>
      <span class="job-id">R1</span><span class="location">India</span>
    </article>`,
  })
  assert.equal(indiaWide[0].city, null)
})

test('GoDaddy scraper reports an API-only migration error for an AWS WAF challenge', async () => {
  const { createGoDaddyScraper } = await import('../../scraper/godaddy/script.js')

  await assert.rejects(
    createGoDaddyScraper().run({
      fetchText: async () => '<html><head><script src="https://edge.sdk.awswaf.com/challenge.js"></script></head></html>',
      renderSearchPage: async () => assert.fail('GoDaddy must not launch a browser'),
    }),
    (error) => error.softFailure === true
      && error.failureKind === 'blocked_or_access_denied'
      && /\[godaddy\].*access challenge/i.test(error.message),
  )

  await assert.rejects(
    createGoDaddyScraper().run({
      fetchText: async () => `
        <html>
          <body>
            <h1>JavaScript is disabled</h1>
            <p>In order to continue, we need to verify that you're not a robot.</p>
            <p>This requires JavaScript.</p>
          </body>
        </html>
      `,
      renderSearchPage: async () => assert.fail('GoDaddy must not launch a browser'),
    }),
    (error) => error.softFailure === true
      && error.failureKind === 'blocked_or_access_denied'
      && /\[godaddy\].*access challenge/i.test(error.message),
  )

  await assert.rejects(
    createGoDaddyScraper().run({
      fetchText: async () => { throw new Error('HTTP 403') },
      renderSearchPage: async () => assert.fail('GoDaddy must not launch a browser'),
    }),
    /\[godaddy\] API-only migration.*HTTP 403/i,
  )
})

test('Globant scraper paginates the current API and retains the requested legacy opening', async () => {
  const { createGlobantScraper } = await import('../../scraper/globant/script.js')
  const scraper = createGlobantScraper({ now: () => '2026-07-23T00:00:00.000Z' })
  const jobs = await scraper.run({
    fetchJson: async (_url, options) => {
      assert.deepEqual(JSON.parse(options.body), { page: 1, q: [], country: ['IN'], deparment: [] })
      return {
        total: 1,
        showMore: false,
        jobRequisition: [{
          country: 'India', location: 'Karnataka, India', jobReqId: '78868',
          createdDateTime: '2026-07-21T07:51:54.000Z', jobTitle: 'Salesforce Developer Bangalore',
          jobDescription: '<p>Build Salesforce products.</p>',
          area: [{ label: 'Software Engineering' }],
        }],
      }
    },
    fetchText: async () => `
      <main><h1>Senior Node.js Developer - India</h1>
        <span class="jobLocation">Pune, Maha, India</span>
        <span class="jobId">571978017</span>
        <div class="jobDescription"><p>Build Node.js platforms.</p></div>
        <button type="button">Apply</button><script>{"status":"Approved"}</script>
      </main>`,
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'Salesforce Developer Bangalore')
  assert.equal(jobs[0].sourceUrl, 'https://career.globant.com/job/salesforce-developer-bangalore/78868')
  assert.equal(jobs[1].title, 'Senior Node.js Developer - India')
  assert.equal(jobs[1].city, 'Pune')
  assert.equal(jobs[1].jobDescription, 'Build Node.js platforms.')
  assert.equal(jobs[1].jobId, '571978017')
})

test('Globant scraper rejects API drift and does not revive a closed legacy page', async () => {
  const { createGlobantScraper } = await import('../../scraper/globant/script.js')

  await assert.rejects(
    createGlobantScraper().run({
      fetchJson: async () => ({ showMore: false }),
      fetchText: async () => '',
    }),
    /jobRequisition|contract/i,
  )

  const jobs = await createGlobantScraper().run({
    fetchJson: async () => ({
      total: 1,
      showMore: false,
      jobRequisition: [{
        country: 'India', location: 'Karnataka, India', jobReqId: '78868',
        jobTitle: 'Salesforce Developer Bangalore', jobDescription: '#LI-Hybrid Build.',
      }],
    }),
    fetchText: async () => `
      <main><h1>Senior Node.js Developer - India</h1>
        <span class="jobLocation">Pune, Maha, India</span>
        <span class="jobId">571978017</span><p>This role is no longer available.</p>
      </main>`,
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].city, 'Bangalore')
  assert.equal(jobs[0].remoteStatus, 'Hybrid')

  await assert.rejects(
    createGlobantScraper().run({
      fetchJson: async () => ({
        total: 2, showMore: false,
        jobRequisition: [{ country: 'India', location: 'Pune, India', jobReqId: '1', jobTitle: 'One' }],
      }),
      fetchText: async () => '',
    }),
    /total|incomplete|partial/i,
  )

  await assert.rejects(
    createGlobantScraper().run({
      fetchJson: async () => ({
        total: 1, showMore: false,
        jobRequisition: [{
          country: 'India', location: 'Warsaw, Poland', jobReqId: 'foreign', jobTitle: 'Foreign Role',
        }],
      }),
      fetchText: async () => '',
    }),
    /foreign|location|malformed/i,
  )
})

test('Qlik scraper validates a healthy Eightfold zero result and pagination progress', async () => {
  const { createQlikScraper } = await import('../../scraper/qlik/script.js')
  const requests = []
  const empty = await createQlikScraper({ pageSize: 2 }).run({ fetchJson: async (url) => {
    requests.push(url)
    return { data: { positions: [], count: 0 } }
  } })
  assert.deepEqual(empty, [])
  assert.equal(new URL(requests[0]).searchParams.get('location'), 'India')
  assert.equal(new URL(requests[0]).searchParams.get('start'), '0')
  assert.equal(new URL(requests[0]).searchParams.get('limit'), '2')

  await assert.rejects(
    createQlikScraper().run({ fetchJson: async () => ({ data: { count: 0 } }) }),
    /positions|contract/i,
  )

  const position = (id) => ({
    id, displayJobId: `REQ-${id}`, name: `Role ${id}`,
    locations: ['Bangalore, Karnataka, India'], department: 'Engineering',
  })
  const mapped = await createQlikScraper({ pageSize: 2, now: () => '2026-07-23T00:00:00.000Z' }).run({
    fetchJson: async (url) => url.includes('position_details')
      ? { data: {
          publicUrl: 'https://careerhub.qlik.com/careers/job/100',
          jobDescription: '<p>Build analytics products.</p>',
        } }
      : { data: { positions: [position('1')], count: 1 } },
  })
  assert.equal(mapped.length, 1)
  assert.equal(mapped[0].city, 'Bangalore')
  assert.equal(mapped[0].remoteStatus, null)
  assert.equal(mapped[0].sourceUrl, 'https://careerhub.qlik.com/careers/job/1')

  let calls = 0
  await assert.rejects(
    createQlikScraper({ pageSize: 2 }).run({ fetchJson: async (url) => {
      if (url.includes('position_details')) return { data: { publicUrl: `https://careerhub.qlik.com/careers/job/${new URL(url).searchParams.get('position_id')}` } }
      calls += 1
      return { data: { positions: [position('1'), position('2')], count: 4 } }
    } }),
    /repeated|progress/i,
  )
  assert.equal(calls, 2)
})

test('requested company providers use full-company adapters', async () => {
  const { TARGETED_OPENING_PROVIDERS } = await import('../providers/targetedOpeningProviders.js')
  const bySource = new Map(TARGETED_OPENING_PROVIDERS.map((provider) => [provider.source, provider]))

  assert.equal(bySource.get('ptc')?.adapter, 'script')
  assert.equal(bySource.get('ptc')?.modulePath, '../../scraper/ptc/script.js')
  assert.equal(bySource.get('qlik')?.adapter, 'script')
  assert.equal(bySource.get('qlik')?.modulePath, '../../scraper/qlik/script.js')
  for (const source of ['hubspot', 'docusign', 'pega', 'qlik', 'godaddy', 'globant', 'zsassociates']) {
    assert.equal(bySource.get(source)?.adapter, 'script')
    assert.notEqual(bySource.get(source)?.modulePath, '../shared/targetedOpening.js')
  }
})

test('all thirteen requested companies are registered exactly once', async () => {
  const { getScraperCatalog } = await import('../providers/index.js')
  const catalog = getScraperCatalog()
  const sources = [
    'ptc', 'blackline', 'hubspot', 'docusign', 'sentinelone',
    'sophostechnologies', 'pega', 'qlik', 'godaddy', 'globant',
    'zsassociates', 'manhatten', 'tenable',
  ]

  for (const source of sources) {
    assert.equal(
      catalog.filter((provider) => provider.source === source).length,
      1,
      `${source} should have one provider registration`,
    )
  }
})
