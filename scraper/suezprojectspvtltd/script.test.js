import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Suez Projects Pvt. Ltd. scraper module at ./script.js')
  }
}

const indiaCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | SUEZ in India</title>
  </head>
  <body>
    <div class="neo-link__container">
      <a
        href="https://hris-suez.csod.com/ux/ats/careersite/10/home?c=hris-suez&lang=en-GB"
        class="btn with-icon icon__external neo-link__secondary-1 cta-centered"
        target="_blank"
      >
        Discover our all offers
      </a>
    </div>
  </body>
</html>
`

const csodShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Candidate Portal</title>
  </head>
  <body>
    <div id="cs-root"></div>
    <script type="text/javascript">
      var csodPlayerRouteInfo = {
        package: 'career-site',
        page: 'home',
        cid: '10',
      }
    </script>
    <script type="text/javascript">
      if (!csod.context || !csod.context.token) {
        csod.context = {
          corp: 'hris-suez',
          cultureID: 2,
          cultureName: 'en-GB',
          endpoints: {
            cloud: 'https://uk.api.csod.com/',
            api: '/',
          },
          token: 'sample-token',
        }
      }
    </script>
    <script src="/player-career-site/1.25.6/pages/home.js"></script>
  </body>
</html>
`

const sampleSearchPayload = {
  data: {
    totalCount: 2,
    requisitions: [
      {
        requisitionId: 3181,
        displayJobTitle: 'Senior Project Engineer',
        postingEffectiveDate: '2026-07-01T00:00:00Z',
        postingExpirationDate: '2026-08-01T00:00:00Z',
        locations: [
          {
            city: 'Kochi',
            state: 'Kerala',
            country: 'India',
          },
        ],
      },
      {
        requisitionId: 4110,
        displayJobTitle: 'Wastewater Process Manager',
        postingEffectiveDate: '2026-07-03T00:00:00Z',
        postingExpirationDate: '2026-08-10T00:00:00Z',
        locations: [
          {
            city: 'Paris',
            state: 'Ile-de-France',
            country: 'France',
          },
        ],
      },
    ],
  },
}

const detailPayloadById = {
  3181: {
    displayTitle: 'Senior Project Engineer',
    ref: 'REQ-3181',
    externalDescription: '<p>Lead water infrastructure delivery for municipal projects.</p>',
    primaryLocation: {
      city: 'Kochi',
      state: 'Kerala',
      country: 'India',
    },
    additionalLocations: [],
  },
  4110: {
    displayTitle: 'Wastewater Process Manager',
    ref: 'REQ-4110',
    externalDescription: '<p>Lead plant optimization initiatives across France.</p>',
    primaryLocation: {
      city: 'Paris',
      state: 'Ile-de-France',
      country: 'France',
    },
    additionalLocations: [],
  },
}

test('Suez Projects Pvt. Ltd. scraper pins the verified official India careers handoff', async () => {
  const scraper = await loadModule()

  assert.equal(scraper.SOURCE, 'suezprojectspvtltd')
  assert.equal(scraper.COMPANY, 'Suez Projects Pvt. Ltd.')
  assert.equal(scraper.VERIFIED_AT, '2026-07-13')
  assert.equal(scraper.INDIA_CAREERS_PAGE_URL, 'https://www.suez.com/en/india/careers')
  assert.equal(
    scraper.CAREER_PAGE_URL,
    'https://hris-suez.csod.com/ux/ats/careersite/10/home?c=hris-suez&lang=en-GB',
  )
  assert.equal(scraper.SEARCH_API_URL, 'https://uk.api.csod.com/rec-job-search/external/jobs')
  assert.equal(
    scraper.buildDetailUrl(3181),
    'https://hris-suez.csod.com/services/x/job-requisition/v2/requisitions/3181/jobDetails?cultureId=2',
  )
  assert.equal(scraper.hasOfficialIndiaCareersSignal(indiaCareersHtml), true)
  assert.equal(scraper.hasPublicCsodShell(csodShellHtml), true)
  assert.deepEqual(scraper.extractContextFromHomePage(csodShellHtml), {
    corp: 'hris-suez',
    cultureID: 2,
    cultureName: 'en-GB',
    endpoints: {
      cloud: 'https://uk.api.csod.com/',
      api: '/',
    },
    token: 'sample-token',
  })
  assert.deepEqual(scraper.buildSearchRequest(), {
    careerSiteId: 10,
    careerSitePageId: 10,
    pageNumber: 1,
    pageSize: 20,
    cultureId: 2,
    cultureName: 'en-GB',
    searchText: '',
    states: '',
    countryCodes: '',
    cities: '',
    placeID: '',
    radius: 0,
    postingsWithinDays: 0,
    customFieldCheckboxKeys: [],
    customFieldDropdowns: [],
    customFieldRadios: [],
  })
})

test('extractSearchResults maps the public SUEZ CSOD requisitions into shared India-only job fields', async () => {
  const scraper = await loadModule()

  const jobs = scraper.extractSearchResults(sampleSearchPayload, {
    detailPayloadById,
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Senior Project Engineer',
    company: 'Suez Projects Pvt. Ltd.',
    department: null,
    location: 'Kochi, India',
    city: 'Kochi',
    country: 'India',
    jobId: '3181',
    requisitionId: 'REQ-3181',
    sourceUrl: 'https://hris-suez.csod.com/ux/ats/careersite/10/home/requisition/3181?c=hris-suez&lang=en-GB',
    applyUrl: 'https://hris-suez.csod.com/ux/ats/careersite/10/home/requisition/3181?c=hris-suez&lang=en-GB',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-01T00:00:00Z',
    closingDate: '2026-08-01T00:00:00Z',
    jobDescription: 'Lead water infrastructure delivery for municipal projects.',
  })
})

test('run verifies the official SUEZ India handoff, queries the public CSOD jobs API, and decorates runner fields', async () => {
  const scraper = await loadModule()
  const requests = []

  const jobs = await scraper.createSuezProjectsScraper().run({
    fetchText: async (url) => {
      requests.push({ type: 'text', url })

      if (url === scraper.INDIA_CAREERS_PAGE_URL) {
        return indiaCareersHtml
      }

      if (url === scraper.CAREER_PAGE_URL) {
        return csodShellHtml
      }

      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requests.push({ type: 'json', url })

      if (url === scraper.SEARCH_API_URL) {
        return sampleSearchPayload
      }

      const detailMatch = url.match(/requisitions\/(\d+)\/jobDetails/i)
      if (detailMatch) {
        return detailPayloadById[Number(detailMatch[1])]
      }

      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.deepEqual(
    requests.map((request) => request.url),
    [
      scraper.INDIA_CAREERS_PAGE_URL,
      scraper.CAREER_PAGE_URL,
      scraper.SEARCH_API_URL,
      scraper.buildDetailUrl(3181),
      scraper.buildDetailUrl(4110),
    ],
  )
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'suezprojectspvtltd')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})

test('Suez Projects Pvt. Ltd. scraper fails closed when the verified first-party surface drifts', async () => {
  const scraper = await loadModule()

  await assert.rejects(
    scraper.createSuezProjectsScraper().run({
      fetchText: async (url) => {
        if (url === scraper.INDIA_CAREERS_PAGE_URL) {
          return '<html><body><h1>Placeholder</h1></body></html>'
        }

        throw new Error(`Unexpected text URL: ${url}`)
      },
      fetchJson: async () => sampleSearchPayload,
    }),
    /verified official india careers page/i,
  )

  await assert.rejects(
    scraper.createSuezProjectsScraper().run({
      fetchText: async (url) => {
        if (url === scraper.INDIA_CAREERS_PAGE_URL) {
          return indiaCareersHtml
        }

        if (url === scraper.CAREER_PAGE_URL) {
          return '<html><body><h1>Unknown shell</h1></body></html>'
        }

        throw new Error(`Unexpected text URL: ${url}`)
      },
      fetchJson: async () => sampleSearchPayload,
    }),
    /verified public csod shell/i,
  )
})
