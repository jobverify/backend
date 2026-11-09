import assert from 'node:assert/strict'
import test from 'node:test'

const loadIsocratesModule = async () => {
  try {
    return await import('../../scraper/isocrates/script.js')
  } catch {
    assert.fail('Expected iSOCRATES scraper module at ../../scraper/isocrates/script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Global Leader in MADTECH Resource Planning and Execution™</title>
  </head>
  <body>
    <h1>MADTECH (MarTech, AdTech &amp; DataTech) is complex, expensive, time-consuming, and hard to staff.</h1>
    <p>Picking the right business partner is crucial.</p>
    <a href="https://isocrates.com/careers/">Careers</a>
  </body>
</html>
`.replace(
  /<title>[^<]*<\/title>/i,
  '<title>Global Leader in MADTECH Resource Planning and Execution&#x2122;</title>',
)

const careersHtml = `
<!doctype html>
<html>
  <head>
    <title>Careers | iSOCRATES</title>
  </head>
  <body>
    <script>
      window.khConfig = {
        identifier: '53772be4-e756-4beb-b9d6-91966b560812',
        domain: 'https://isocrates.keka.com/careers/',
        targetContainer: '#khembedjobs'
      };
    </script>
    <h1>Join us to do purposeful work that shapes the future of marketing intelligence</h1>
    <h2>Open positions</h2>
    <div id="khembedjobs"></div>
    <script src="https://isocrates.keka.com/careers/api/embedjobs/js/53772be4-e756-4beb-b9d6-91966b560812"></script>
  </body>
</html>
`

const careersLinkOnlyHtml = `
<!doctype html>
<html>
  <head>
    <title>Careers | iSOCRATES</title>
  </head>
  <body>
    <a href="https://isocrates.keka.com/careers/">Browse jobs</a>
  </body>
</html>
`

const kekaShellHtml = `
<!doctype html>
<html>
  <head>
    <script>window.isCareersPage = true;</script>
  </head>
  <body>
    <div id="content-container"></div>
    <script>
      fetch('/ats/documents/53772be4-e756-4beb-b9d6-91966b560812/careerportal/838f8bc6f3204cfc8d13e6fe4f352bc7.html')
        .then((response) => response.text())
        .then((data) => {
          document.getElementById('content-container').innerHTML = data
        })
    </script>
  </body>
</html>
`

test('iSOCRATES verifies the official homepage and resolves the first-party Keka careers config', async () => {
  const isocrates = await loadIsocratesModule()

  assert.equal(isocrates.SOURCE, 'isocrates')
  assert.equal(isocrates.COMPANY, 'iSOCRATES')
  assert.equal(isocrates.HOMEPAGE_URL, 'https://isocrates.com/')
  assert.equal(isocrates.CAREER_PAGE_URL, 'https://isocrates.com/careers/')
  assert.equal(isocrates.EXPECTED_IDENTIFIER, '53772be4-e756-4beb-b9d6-91966b560812')
  assert.equal(isocrates.EXPECTED_KEKA_DOMAIN, 'https://isocrates.keka.com/careers/')

  assert.equal(isocrates.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(isocrates.hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(
    isocrates.extractEmbeddedCareersDocumentPath(kekaShellHtml),
    '/ats/documents/53772be4-e756-4beb-b9d6-91966b560812/careerportal/838f8bc6f3204cfc8d13e6fe4f352bc7.html',
  )
  assert.deepEqual(isocrates.extractCareerConfig(careersHtml), {
    identifier: '53772be4-e756-4beb-b9d6-91966b560812',
    domain: 'https://isocrates.keka.com/careers/',
    portalName: 'default',
  })
  assert.equal(
    isocrates.buildActiveJobsUrl(isocrates.extractCareerConfig(careersHtml)),
    'https://isocrates.keka.com/careers/api/embedjobs/default/active/53772be4-e756-4beb-b9d6-91966b560812',
  )
})

test('iSOCRATES maps India roles from the verified Keka feed into the shared scraper contract', async () => {
  const isocrates = await loadIsocratesModule()
  const jobs = isocrates.extractSearchResults(
    [
      {
        id: 73365,
        title: 'Engineering Manager',
        description: '<div>Lead engineering across platform and data systems.</div>',
        departmentName: 'MADTECH.AI',
        jobLocations: [
          {
            id: 3452,
            name: 'Bengaluru, KA, IND',
            city: 'Bengaluru',
            state: 'KA',
            countryCode: 'IN',
            countryName: 'India',
          },
          {
            id: 9999,
            name: 'Austin, TX, USA',
            city: 'Austin',
            state: 'TX',
            countryCode: 'US',
            countryName: 'United States',
          },
        ],
        jobType: 2,
        experience: '12+ Years',
        salaryRangeFormat: 'INR 50,00,000.00 - 70,00,000.00',
        publishedOn: '2026-05-29T09:00:20.803Z',
        skillNames: ['AWS Cloud & Microservices Architecture', 'Leadership'],
      },
    ],
    {
      domain: 'https://isocrates.keka.com/careers/',
    },
  )

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Engineering Manager',
    company: 'iSOCRATES',
    department: 'MADTECH.AI',
    location: 'Bengaluru, KA, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '73365',
    requisitionId: '73365',
    sourceUrl: 'https://isocrates.keka.com/careers/jobdetails/73365',
    applyUrl: 'https://isocrates.keka.com/careers/applyjob/73365',
    employmentType: 'Full Time',
    experienceRequired: '12+ Years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['AWS Cloud & Microservices Architecture', 'Leadership'],
    postingDate: '2026-05-29',
    closingDate: null,
    jobDescription: 'Lead engineering across platform and data systems.',
    remoteStatus: 'On-site',
    compensation: 'INR 50,00,000.00 - 70,00,000.00',
  })
})

test('iSOCRATES can recover with browser-backed homepage, careers page, and Keka jobs when direct requests time out', async () => {
  const isocrates = await loadIsocratesModule()
  const browserTextUrls = []
  const browserJsonUrls = []
  const activeJobsUrl = 'https://isocrates.keka.com/careers/api/embedjobs/default/active/53772be4-e756-4beb-b9d6-91966b560812'

  const jobs = await isocrates.createIsocratesScraper({ maxJobs: 1 }).run({
    fetchText: async () => {
      throw new Error('fetch failed | Connect Timeout Error (attempted address: isocrates.com:443, timeout: 10000ms)')
    },
    fetchJson: async () => {
      throw new Error('fetch failed | Connect Timeout Error (attempted address: isocrates.keka.com:443, timeout: 10000ms)')
    },
    fetchBrowserText: async (url) => {
      browserTextUrls.push(url)
      if (url === isocrates.HOMEPAGE_URL) return homepageHtml
      if (url === isocrates.CAREER_PAGE_URL) return careersHtml
      throw new Error(`Unexpected browser text URL: ${url}`)
    },
    fetchBrowserJson: async (url) => {
      browserJsonUrls.push(url)
      if (url === activeJobsUrl) {
        return [
          {
            id: 73365,
            title: 'Engineering Manager',
            description: '<div>Lead engineering across platform and data systems.</div>',
            departmentName: 'MADTECH.AI',
            jobLocations: [
              {
                id: 3452,
                name: 'Bengaluru, KA, IND',
                city: 'Bengaluru',
                state: 'KA',
                countryCode: 'IN',
                countryName: 'India',
              },
            ],
            jobType: 2,
            experience: '12+ Years',
            publishedOn: '2026-05-29T09:00:20.803Z',
            skillNames: ['AWS Cloud & Microservices Architecture', 'Leadership'],
          },
        ]
      }

      throw new Error(`Unexpected browser JSON URL: ${url}`)
    },
  })

  assert.deepEqual(browserTextUrls, [
    isocrates.HOMEPAGE_URL,
    isocrates.CAREER_PAGE_URL,
  ])
  assert.deepEqual(browserJsonUrls, [activeJobsUrl])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'isocrates')
})

test('iSOCRATES can resolve the verified Keka config from a first-party direct board handoff', async () => {
  const isocrates = await loadIsocratesModule()
  const activeJobsUrl = 'https://isocrates.keka.com/careers/api/embedjobs/default/active/53772be4-e756-4beb-b9d6-91966b560812'
  const embeddedDocumentUrl = 'https://isocrates.keka.com/ats/documents/53772be4-e756-4beb-b9d6-91966b560812/careerportal/838f8bc6f3204cfc8d13e6fe4f352bc7.html'

  const jobs = await isocrates.createIsocratesScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      if (url === isocrates.HOMEPAGE_URL) return homepageHtml
      if (url === isocrates.CAREER_PAGE_URL) return careersLinkOnlyHtml
      if (url === isocrates.EXPECTED_KEKA_DOMAIN) return kekaShellHtml
      if (url === embeddedDocumentUrl) return careersHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      if (url === activeJobsUrl) {
        return [
          {
            id: 73365,
            title: 'Engineering Manager',
            description: '<div>Lead engineering across platform and data systems.</div>',
            departmentName: 'MADTECH.AI',
            jobLocations: [
              {
                id: 3452,
                name: 'Bengaluru, KA, IND',
                city: 'Bengaluru',
                state: 'KA',
                countryCode: 'IN',
                countryName: 'India',
              },
            ],
            jobType: 2,
            experience: '12+ Years',
            publishedOn: '2026-05-29T09:00:20.803Z',
            skillNames: ['AWS Cloud & Microservices Architecture', 'Leadership'],
          },
        ]
      }

      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'isocrates')
})

test('iSOCRATES follows the new first-party Keka address for the same verified tenant', async () => {
  const isocrates = await loadIsocratesModule()
  const currentDomain = 'https://madtechai.keka.com/careers/'
  const handoff = careersLinkOnlyHtml.replace(/isocrates\.keka\.com/g, 'madtechai.keka.com')
  const currentConfig = careersHtml.replace(/isocrates\.keka\.com/g, 'madtechai.keka.com')
  const embeddedDocumentUrl = new URL(isocrates.extractEmbeddedCareersDocumentPath(kekaShellHtml), currentDomain).toString()
  const requested = []

  assert.equal(isocrates.hasOfficialCareersPageSignal(handoff), true)
  assert.equal(isocrates.hasOfficialCareersPageSignal(handoff.replace('madtechai.keka.com', 'unrelated.keka.com')), false)
  const jobs = await isocrates.createIsocratesScraper().run({
    fetchText: async (url) => {
      requested.push(url)
      if (url === isocrates.HOMEPAGE_URL) return homepageHtml
      if (url === isocrates.CAREER_PAGE_URL) return handoff
      if (url === currentDomain) return kekaShellHtml
      if (url === embeddedDocumentUrl) return currentConfig
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      assert.equal(url, `${currentDomain}api/embedjobs/default/active/${isocrates.EXPECTED_IDENTIFIER}`)
      return [{ id: 73365, title: 'Engineering Manager', jobLocations: [{ city: 'Bengaluru', countryCode: 'IN' }] }]
    },
  })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceUrl, `${currentDomain}jobdetails/73365`)
  assert.deepEqual(requested, [isocrates.HOMEPAGE_URL, isocrates.CAREER_PAGE_URL, currentDomain, embeddedDocumentUrl])

  await assert.rejects(isocrates.createIsocratesScraper().run({
    fetchText: async (url) => url === isocrates.HOMEPAGE_URL ? homepageHtml : currentConfig.replace(isocrates.EXPECTED_IDENTIFIER, '11111111-2222-3333-4444-555555555555'),
    fetchJson: async () => { throw new Error('Unverified tenant must not be queried') },
  }), /verified Keka job surface changed materially/i)
})

test('iSOCRATES fails closed when the verified homepage, careers shell, or Keka config changes', async () => {
  const isocrates = await loadIsocratesModule()

  await assert.rejects(
    isocrates.createIsocratesScraper().run({
      fetchText: async (url) => {
        if (url === isocrates.HOMEPAGE_URL) {
          return '<html><body><h1>Unexpected homepage</h1></body></html>'
        }

        return careersHtml
      },
      fetchBrowserText: async (url) => {
        if (url === isocrates.HOMEPAGE_URL) {
          return '<html><body><h1>Unexpected homepage</h1></body></html>'
        }

        return careersHtml
      },
      fetchJson: async () => [],
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    isocrates.createIsocratesScraper().run({
      fetchText: async (url) => {
        if (url === isocrates.HOMEPAGE_URL) return homepageHtml
        if (url === isocrates.CAREER_PAGE_URL) {
          return '<html><head><title>Careers | iSOCRATES</title></head><body>No public jobs handoff</body></html>'
        }
        return homepageHtml
      },
      fetchBrowserText: async (url) => {
        if (url === isocrates.HOMEPAGE_URL) return homepageHtml
        if (url === isocrates.CAREER_PAGE_URL) {
          return '<html><head><title>Careers | iSOCRATES</title></head><body>No public jobs handoff</body></html>'
        }
        return homepageHtml
      },
      fetchJson: async () => [],
    }),
    /verified careers page/i,
  )

  await assert.rejects(
    isocrates.createIsocratesScraper().run({
      fetchText: async (url) => {
        if (url === isocrates.HOMEPAGE_URL) return homepageHtml
        if (url === isocrates.CAREER_PAGE_URL) {
          return careersHtml.replace(
            '53772be4-e756-4beb-b9d6-91966b560812',
            '11111111-2222-3333-4444-555555555555',
          )
        }
        return homepageHtml
      },
      fetchBrowserText: async (url) => {
        if (url === isocrates.HOMEPAGE_URL) return homepageHtml
        if (url === isocrates.CAREER_PAGE_URL) {
          return careersHtml.replace(
            '53772be4-e756-4beb-b9d6-91966b560812',
            '11111111-2222-3333-4444-555555555555',
          )
        }
        return homepageHtml
      },
      fetchJson: async () => [],
    }),
    /verified Keka job surface changed materially/i,
  )
})
