import assert from 'node:assert/strict'
import test from 'node:test'

const verifiedCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Rippling Careers | Work Will Never Be the Same</title>
  </head>
  <body>
    <main>
      <h1>Work will never be the same. Neither will you.</h1>
      <p>At Rippling, you can bring your curiosity, drive, and ambition to every day at work.</p>
      <a href="/careers/open-roles">See open roles</a>
    </main>
  </body>
</html>
`

const verifiedOpenRolesHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Open Roles | Rippling Careers</title>
  </head>
  <body>
    <main>
      <h1>Open roles</h1>
      <p>Every role at Rippling is mission-critical.</p>
      <p>
        We prioritize candidate safety. Please be aware that official communication will only come from @rippling.com email addresses.
      </p>
      <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
        props: {
          pageProps: {
            data: {
              algoliaIndexName: 'careers_en-US_production',
              listMode: 'pagination',
              pageData: {
                fields: {
                  title: 'Open roles',
                },
              },
            },
          },
        },
      })}</script>
    </main>
  </body>
</html>
`

const pageZeroPayload = {
  hits: [
    {
      objectID: '43953773-4092-476d-be50-2397e3a15f4e__bangalore-india',
      jobId: '43953773-4092-476d-be50-2397e3a15f4e',
      name: ' Senior Software Engineer (HRIS)',
      url: 'https://ats.rippling.com/rippling/jobs/43953773-4092-476d-be50-2397e3a15f4e',
      department: { name: 'Engineering' },
      departmentName: 'Engineering',
      locationNames: ['Bangalore, India'],
      locations: [
        {
          name: 'Bangalore, India',
          country: 'India',
          countryCode: 'IN',
          workplaceType: 'ONSITE',
        },
      ],
      isRemote: false,
    },
    {
      objectID: '46937e73-903e-46e6-86c2-c636e48c42b6__bangalore-india',
      jobId: '46937e73-903e-46e6-86c2-c636e48c42b6',
      name: 'Mid Market Account Executive - India',
      url: 'https://ats.rippling.com/rippling/jobs/46937e73-903e-46e6-86c2-c636e48c42b6',
      department: { name: 'Sales' },
      departmentName: 'Sales',
      locationNames: ['Bangalore, India'],
      locations: [
        {
          name: 'Bangalore, India',
          country: 'India',
          countryCode: 'IN',
          workplaceType: 'REMOTE',
        },
      ],
      isRemote: true,
    },
    {
      objectID: '528f45e5-4c17-4fb7-affe-41e0c12c7c15__san-antonio-tx',
      jobId: '528f45e5-4c17-4fb7-affe-41e0c12c7c15',
      name: 'Account Executive, Broker Channel (TOLA)',
      url: 'https://ats.rippling.com/rippling/jobs/528f45e5-4c17-4fb7-affe-41e0c12c7c15',
      department: { name: 'Sales' },
      departmentName: 'Sales',
      locationNames: ['San Antonio, TX'],
      locations: [
        {
          name: 'San Antonio, TX',
          country: 'United States',
          countryCode: 'US',
          workplaceType: 'REMOTE',
        },
      ],
      isRemote: true,
    },
  ],
  nbHits: 3,
  nbPages: 2,
  hitsPerPage: 2,
  page: 0,
}

const pageOnePayload = {
  hits: [
    {
      objectID: '5a0ca954-9196-40fe-91de-dadf7721bd61__bangalore-india',
      jobId: '5a0ca954-9196-40fe-91de-dadf7721bd61',
      name: 'SDR Manager, Outbound (India)',
      url: 'https://ats.rippling.com/rippling/jobs/5a0ca954-9196-40fe-91de-dadf7721bd61',
      department: { name: 'Sales' },
      departmentName: 'Sales',
      locationNames: ['Bangalore, India'],
      locations: [
        {
          name: 'Bangalore, India',
          country: 'India',
          countryCode: 'IN',
          workplaceType: 'ONSITE',
        },
      ],
      isRemote: false,
    },
  ],
  nbHits: 3,
  nbPages: 2,
  hitsPerPage: 2,
  page: 1,
}

const loadRipplingModule = async () => {
  try {
    return await import('../../scraper/rippling/script.js')
  } catch {
    assert.fail('Expected Rippling scraper module at ../../scraper/rippling/script.js')
  }
}

test('Rippling pins the verified careers shell, open roles next-data, and Algolia query contract', async () => {
  const rippling = await loadRipplingModule()

  assert.equal(rippling.SOURCE, 'rippling')
  assert.equal(rippling.COMPANY, 'Rippling')
  assert.equal(rippling.CAREERS_URL, 'https://www.rippling.com/careers')
  assert.equal(rippling.OPEN_ROLES_URL, 'https://www.rippling.com/careers/open-roles')
  assert.equal(
    rippling.ALGOLIA_SEARCH_URL,
    'https://6FNAX3TBEF-dsn.algolia.net/1/indexes/careers_en-US_production/query',
  )
  assert.equal(rippling.ALGOLIA_APPLICATION_ID, '6FNAX3TBEF')
  assert.equal(rippling.ALGOLIA_API_KEY, '416caa4690f002ff6fe4a2097623640b')
  assert.equal(rippling.ALGOLIA_INDEX_NAME, 'careers_en-US_production')
  assert.equal(rippling.DEFAULT_HITS_PER_PAGE, 1000)
  assert.equal(rippling.hasVerifiedCareersPageSignal(verifiedCareersHtml), true)
  assert.equal(rippling.hasVerifiedOpenRolesPageSignal(verifiedOpenRolesHtml), true)
  assert.deepEqual(rippling.extractOpenRolesSearchConfig(verifiedOpenRolesHtml), {
    algoliaIndexName: 'careers_en-US_production',
    listMode: 'pagination',
  })
  assert.equal(
    rippling.buildAlgoliaQueryUrl(),
    'https://6FNAX3TBEF-dsn.algolia.net/1/indexes/careers_en-US_production/query',
  )
  assert.deepEqual(rippling.buildAlgoliaQueryBody({ page: 1, hitsPerPage: 250 }), {
    params: 'query=&hitsPerPage=250&page=1',
  })
})

test('Rippling extracts only India jobs from the verified Algolia payload', async () => {
  const rippling = await loadRipplingModule()
  const jobs = rippling.extractRipplingIndiaJobsFromAlgoliaPayload(pageZeroPayload, {
    scrapedAt: '2026-07-17T00:00:00.000Z',
  })

  assert.deepEqual(jobs, [
    {
      title: 'Senior Software Engineer (HRIS)',
      company: 'Rippling',
      department: 'Engineering',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      workplaceType: 'ONSITE',
      jobId: '43953773-4092-476d-be50-2397e3a15f4e',
      requisitionId: '43953773-4092-476d-be50-2397e3a15f4e',
      sourceUrl: 'https://ats.rippling.com/rippling/jobs/43953773-4092-476d-be50-2397e3a15f4e',
      applyUrl: 'https://ats.rippling.com/rippling/jobs/43953773-4092-476d-be50-2397e3a15f4e',
      link: 'https://ats.rippling.com/rippling/jobs/43953773-4092-476d-be50-2397e3a15f4e',
      source: 'rippling',
      scrapedAt: '2026-07-17T00:00:00.000Z',
    },
    {
      title: 'Mid Market Account Executive - India',
      company: 'Rippling',
      department: 'Sales',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      workplaceType: 'REMOTE',
      jobId: '46937e73-903e-46e6-86c2-c636e48c42b6',
      requisitionId: '46937e73-903e-46e6-86c2-c636e48c42b6',
      sourceUrl: 'https://ats.rippling.com/rippling/jobs/46937e73-903e-46e6-86c2-c636e48c42b6',
      applyUrl: 'https://ats.rippling.com/rippling/jobs/46937e73-903e-46e6-86c2-c636e48c42b6',
      link: 'https://ats.rippling.com/rippling/jobs/46937e73-903e-46e6-86c2-c636e48c42b6',
      source: 'rippling',
      scrapedAt: '2026-07-17T00:00:00.000Z',
    },
  ])
})

test('Rippling run validates the official pages and paginates the verified Algolia index', async () => {
  const rippling = await loadRipplingModule()
  const requested = []

  const jobs = await rippling.createRipplingScraper({ hitsPerPage: 2 }).run({
    fetchText: async (url) => {
      if (url.startsWith('https://ats.rippling.com/rippling/jobs/')) return { status: 404, url, html: '' }
      requested.push({ type: 'text', url })
      if (url === rippling.CAREERS_URL) return verifiedCareersHtml
      if (url === rippling.OPEN_ROLES_URL) return verifiedOpenRolesHtml
      throw new Error(`Unexpected Rippling fixture URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      const body = JSON.parse(options.body)
      const params = new URLSearchParams(body.params)
      const page = Number(params.get('page') || '0')
      const hitsPerPage = Number(params.get('hitsPerPage') || '0')

      requested.push({
        type: 'json',
        url,
        method: options.method,
        page,
        hitsPerPage,
      })

      if (page === 0) return pageZeroPayload
      if (page === 1) return pageOnePayload
      throw new Error(`Unexpected Rippling page ${page}`)
    },
    now: () => '2026-07-17T00:00:00.000Z',
  })

  assert.deepEqual(requested, [
    { type: 'text', url: rippling.CAREERS_URL },
    { type: 'text', url: rippling.OPEN_ROLES_URL },
    {
      type: 'json',
      url: 'https://6FNAX3TBEF-dsn.algolia.net/1/indexes/careers_en-US_production/query',
      method: 'POST',
      page: 0,
      hitsPerPage: 2,
    },
    {
      type: 'json',
      url: 'https://6FNAX3TBEF-dsn.algolia.net/1/indexes/careers_en-US_production/query',
      method: 'POST',
      page: 1,
      hitsPerPage: 2,
    },
  ])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[2].title, 'SDR Manager, Outbound (India)')
  assert.equal(jobs[2].source, 'rippling')
})

test('Rippling fails closed when the verified open roles contract or Algolia payload drifts', async () => {
  const rippling = await loadRipplingModule()

  await assert.rejects(
    rippling.createRipplingScraper().run({
      fetchText: async (url) => {
        if (url === rippling.CAREERS_URL) return verifiedCareersHtml
        if (url === rippling.OPEN_ROLES_URL) {
          return verifiedOpenRolesHtml.replace('careers_en-US_production', 'other_index')
        }
        throw new Error(`Unexpected Rippling fixture URL: ${url}`)
      },
      fetchJson: async () => pageZeroPayload,
    }),
    /verified open roles surface/i,
  )

  await assert.rejects(
    rippling.createRipplingScraper().run({
      fetchText: async (url) => {
        if (url === rippling.CAREERS_URL) return verifiedCareersHtml
        if (url === rippling.OPEN_ROLES_URL) return verifiedOpenRolesHtml
        throw new Error(`Unexpected Rippling fixture URL: ${url}`)
      },
      fetchJson: async () => ({ hits: null, nbPages: 1, page: 0 }),
    }),
    /Algolia payload/i,
  )
})
