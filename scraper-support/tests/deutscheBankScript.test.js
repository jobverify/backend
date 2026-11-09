import assert from 'node:assert/strict'
import test from 'node:test'

const officialHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Home – Deutsche Bank Careers</title>
  </head>
  <body>
    <main>
      <nav>
        <a href="/professionals/search-roles">Search Roles</a>
        <a href="https://careers.db.com/students-graduates/search-programmes/">Search Programmes</a>
      </nav>
      <section>
        <h2>Professionals</h2>
        <p>Discover the opportunity for you</p>
      </section>
    </main>
  </body>
</html>
`

const searchRolesHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Search Roles – Deutsche Bank Careers</title>
  </head>
  <body>
    <main>
      <h1>Search Roles</h1>
      <div
        id="job-module"
        data-jobmodule="PROFESSIONAL"
      ></div>
      <script src="/application/project/js/careersJs.js?v40"></script>
    </main>
  </body>
</html>
`

const countryLookupPayload = {
  lookup: {
    items: [
      { id: 46, label: 'Germany' },
      { id: 81, label: 'India' },
      { id: 231, label: 'United States' },
    ],
  },
}

const indiaPageOnePayload = {
  SearchResult: {
    SearchResultCount: 1,
    SearchResultCountAll: 2,
    SearchResultItems: [
      {
        MatchedObjectDescriptor: {
          PositionID: '65090',
          PositionTitle: 'Apprentice Hiring for 2026- 2027',
          PositionURI: '/index.php?ac=jobad&id=65090',
          PublicationStartDate: '2026-07-14',
          PositionLocation: [
            {
              CityName: 'Mumbai',
              CountryName: 'Indien',
            },
          ],
          PositionOfferingType: [
            {
              Name: 'Befristet',
            },
          ],
          PositionSchedule: [
            {
              Name: 'Vollzeit',
            },
          ],
        },
      },
    ],
    UserArea: {
      Facets: {
        'PositionLocation.Country': {
          Terms: [
            { Term: '81', Count: 234 },
          ],
        },
      },
    },
  },
}

const indiaPageAllPayload = {
  SearchResult: {
    SearchResultCount: 2,
    SearchResultCountAll: 2,
    SearchResultItems: [
      ...indiaPageOnePayload.SearchResult.SearchResultItems,
      {
        MatchedObjectDescriptor: {
          PositionID: '65345',
          PositionTitle: 'Senior Engineer – SAP SDLC / Cloud ALM, VP',
          PositionURI: '/index.php?ac=jobad&id=65345',
          PublicationStartDate: '2026-07-14',
          PositionLocation: [
            {
              CityName: 'Pune',
              CountryName: 'Indien',
            },
          ],
          PositionOfferingType: [
            {
              Name: 'Festanstellung',
            },
          ],
          PositionSchedule: [
            {
              Name: 'Vollzeit',
            },
          ],
        },
      },
    ],
  },
}

const apprenticeDetailPayload = {
  apply_uri:
    'https://db.wd3.myworkdayjobs.com/DBWebsite/job/Mumbai-Nirlon-Know-Pk-B4-B5/Apprentice---Non-Technology_R0357981/apply',
  html: `
    <div id="db-jobad">
      <h1> Apprentice Hiring for 2026- 2027 </h1>
      <div id="headerbox" class="clearfix">
        <table>
          <tr>
            <td><strong>Job ID:</strong>R0357981</td>
            <td><strong>Listed: </strong>2026-07-14</td>
          </tr>
          <tr>
            <td><strong>Regular/Temporary: </strong>Temporary</td>
            <td></td>
          </tr>
          <tr>
            <td colspan="2"><strong>Location: </strong>Mumbai</td>
          </tr>
        </table>
      </div>
      <h2>Position Overview</h2>
      <p>Join Deutsche Bank as an apprentice in Mumbai.</p>
    </div>
  `,
}

const seniorEngineerDetailPayload = {
  apply_uri:
    'https://db.wd3.myworkdayjobs.com/DBWebsite/job/Pune/SAP-Basis-Operations-Expert--VP_R0394318/apply',
  html: `
    <div id="db-jobad">
      <h1> Senior Engineer – SAP SDLC / Cloud ALM, VP </h1>
      <div id="headerbox" class="clearfix">
        <table>
          <tr>
            <td><strong>Job ID:</strong>R0394318</td>
            <td><strong>Full/Part-Time: </strong>Full-time</td>
          </tr>
          <tr>
            <td><strong>Listed: </strong>2026-07-14</td>
            <td></td>
          </tr>
          <tr>
            <td colspan="2"><strong>Location: </strong>Pune</td>
          </tr>
        </table>
      </div>
      <h2>Role Description</h2>
      <p>Own SAP SDLC and Cloud ALM engineering.</p>
    </div>
  `,
}

const loadModule = async () => {
  try {
    return await import('../../scraper/deutschebank/script.js')
  } catch {
    assert.fail('Expected Deutsche Bank scraper module at ../../scraper/deutschebank/script.js')
  }
}

test('Deutsche Bank scraper constants stay pinned to the verified first-party careers pages and public Beesite API contract', async () => {
  const deutscheBank = await loadModule()

  assert.equal(deutscheBank.SOURCE, 'deutschebank')
  assert.equal(deutscheBank.COMPANY, 'Deutsche Bank')
  assert.equal(deutscheBank.HOMEPAGE_URL, 'https://careers.db.com/')
  assert.equal(
    deutscheBank.SEARCH_ROLES_URL,
    'https://careers.db.com/professionals/search-roles/',
  )
  assert.equal(
    deutscheBank.COUNTRY_LOOKUP_URL,
    'https://api-deutschebank.beesite.de/lookup/country/lang/2',
  )
  assert.equal(
    deutscheBank.SEARCH_API_URL,
    'https://api-deutschebank.beesite.de/search',
  )
  assert.equal(
    deutscheBank.JOB_DETAIL_API_PREFIX,
    'https://api-deutschebank.beesite.de/jobhtml/',
  )
  assert.equal(deutscheBank.VERIFIED_INDIA_COUNTRY_ID, 81)
  assert.equal(deutscheBank.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(deutscheBank.hasSearchRolesPageSignal(searchRolesHtml), true)
  assert.equal(
    deutscheBank.extractVerifiedIndiaCountryId(countryLookupPayload),
    81,
  )
  assert.deepEqual(deutscheBank.buildIndiaSearchCriteria(), [
    {
      CriterionName: 'PositionLocation.Country',
      CriterionValue: 81,
    },
  ])

  const payload = deutscheBank.buildSearchRequestPayload({
    count: 2,
    criteria: deutscheBank.buildIndiaSearchCriteria(),
  })

  assert.deepEqual(payload, {
    LanguageCode: 'en',
    SearchParameters: {
      FirstItem: 1,
      CountItem: 2,
      MatchedObjectDescriptor: deutscheBank.MATCHED_OBJECT_DESCRIPTOR,
      Sort: [
        {
          Criterion: 'PublicationStartDate',
          Direction: 'DESC',
        },
      ],
    },
    SearchCriteria: [
      {
        CriterionName: 'PositionLocation.Country',
        CriterionValue: 81,
      },
    ],
  })

  const searchApiUrl = deutscheBank.buildSearchApiUrl(payload)
  const encodedPayload = new URL(searchApiUrl).searchParams.get('data')
  assert.deepEqual(JSON.parse(encodedPayload), payload)

  assert.equal(
    deutscheBank.buildPublicJobUrl('65090'),
    'https://careers.db.com/professionals/search-roles/#/professional/job/65090',
  )
  assert.equal(
    deutscheBank.buildJobDetailUrl('65090'),
    'https://api-deutschebank.beesite.de/jobhtml/65090.json',
  )
})

test('Deutsche Bank run validates the verified first-party careers surface and returns normalized India jobs', async () => {
  const deutscheBank = await loadModule()
  const pageRequests = []
  const jsonRequests = []

  const jobs = await deutscheBank.createDeutscheBankScraper({
    now: () => '2026-08-01T12:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      pageRequests.push(url)

      if (url === deutscheBank.HOMEPAGE_URL) {
        return { status: 200, url, html: officialHomepageHtml }
      }

      if (url === deutscheBank.SEARCH_ROLES_URL) {
        return { status: 200, url, html: searchRolesHtml }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchJson: async (url) => {
      jsonRequests.push(url)

      if (url === deutscheBank.COUNTRY_LOOKUP_URL) {
        return countryLookupPayload
      }

      if (
        url === deutscheBank.buildSearchApiUrl(
          deutscheBank.buildSearchRequestPayload({
            count: 1,
            criteria: deutscheBank.buildIndiaSearchCriteria(),
          }),
        )
      ) {
        return indiaPageOnePayload
      }

      if (
        url === deutscheBank.buildSearchApiUrl(
          deutscheBank.buildSearchRequestPayload({
            count: 2,
            criteria: deutscheBank.buildIndiaSearchCriteria(),
          }),
        )
      ) {
        return indiaPageAllPayload
      }

      if (url === deutscheBank.buildJobDetailUrl('65090')) {
        return apprenticeDetailPayload
      }

      if (url === deutscheBank.buildJobDetailUrl('65345')) {
        return seniorEngineerDetailPayload
      }

      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.deepEqual(pageRequests, [
    deutscheBank.HOMEPAGE_URL,
    deutscheBank.SEARCH_ROLES_URL,
  ])
  assert.deepEqual(jsonRequests, [
    deutscheBank.COUNTRY_LOOKUP_URL,
    deutscheBank.buildSearchApiUrl(
      deutscheBank.buildSearchRequestPayload({
        count: 1,
        criteria: deutscheBank.buildIndiaSearchCriteria(),
      }),
    ),
    deutscheBank.buildSearchApiUrl(
      deutscheBank.buildSearchRequestPayload({
        count: 2,
        criteria: deutscheBank.buildIndiaSearchCriteria(),
      }),
    ),
    deutscheBank.buildJobDetailUrl('65090'),
    deutscheBank.buildJobDetailUrl('65345'),
  ])
  assert.deepEqual(jobs, [
    {
      title: 'Apprentice Hiring for 2026- 2027',
      company: 'Deutsche Bank',
      department: null,
      location: 'Mumbai, India',
      city: 'Mumbai',
      state: null,
      country: 'India',
      sourceUrl: 'https://careers.db.com/professionals/search-roles/#/professional/job/65090',
      applyUrl: 'https://db.wd3.myworkdayjobs.com/DBWebsite/job/Mumbai-Nirlon-Know-Pk-B4-B5/Apprentice---Non-Technology_R0357981/apply',
      jobId: '65090',
      requisitionId: 'R0357981',
      employmentType: 'Temporary',
      workplaceType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      compensation: null,
      postingDate: '2026-07-14',
      closingDate: null,
      jobDescription: 'Position Overview\nJoin Deutsche Bank as an apprentice in Mumbai.',
      source: 'deutschebank',
      companyCareerPage: 'https://careers.db.com/professionals/search-roles/',
      companyDomain: 'db.com',
      atsPlatform: 'first-party-beesite-search-api',
      link: 'https://db.wd3.myworkdayjobs.com/DBWebsite/job/Mumbai-Nirlon-Know-Pk-B4-B5/Apprentice---Non-Technology_R0357981/apply',
      scrapedAt: '2026-08-01T12:00:00.000Z',
    },
    {
      title: 'Senior Engineer - SAP SDLC / Cloud ALM, VP',
      company: 'Deutsche Bank',
      department: null,
      location: 'Pune, India',
      city: 'Pune',
      state: null,
      country: 'India',
      sourceUrl: 'https://careers.db.com/professionals/search-roles/#/professional/job/65345',
      applyUrl: 'https://db.wd3.myworkdayjobs.com/DBWebsite/job/Pune/SAP-Basis-Operations-Expert--VP_R0394318/apply',
      jobId: '65345',
      requisitionId: 'R0394318',
      employmentType: 'Full-time',
      workplaceType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      compensation: null,
      postingDate: '2026-07-14',
      closingDate: null,
      jobDescription: 'Role Description\nOwn SAP SDLC and Cloud ALM engineering.',
      source: 'deutschebank',
      companyCareerPage: 'https://careers.db.com/professionals/search-roles/',
      companyDomain: 'db.com',
      atsPlatform: 'first-party-beesite-search-api',
      link: 'https://db.wd3.myworkdayjobs.com/DBWebsite/job/Pune/SAP-Basis-Operations-Expert--VP_R0394318/apply',
      scrapedAt: '2026-08-01T12:00:00.000Z',
    },
  ])
})

test('Deutsche Bank fails closed when the verified careers pages or public country lookup drift', async () => {
  const deutscheBank = await loadModule()

  await assert.rejects(
    deutscheBank.createDeutscheBankScraper().run({
      fetchPage: async (url) => {
        if (url === deutscheBank.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Home</title></head><body>Placeholder</body></html>',
          }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async () => countryLookupPayload,
    }),
    /verified official careers homepage/i,
  )

  await assert.rejects(
    deutscheBank.createDeutscheBankScraper().run({
      fetchPage: async (url) => {
        if (url === deutscheBank.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === deutscheBank.SEARCH_ROLES_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Search Roles</title></head><body><h1>Search Roles</h1></body></html>',
          }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async () => countryLookupPayload,
    }),
    /verified search roles surface/i,
  )

  await assert.rejects(
    deutscheBank.createDeutscheBankScraper().run({
      fetchPage: async (url) => {
        if (url === deutscheBank.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === deutscheBank.SEARCH_ROLES_URL) {
          return { status: 200, url, html: searchRolesHtml }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async (url) => {
        if (url === deutscheBank.COUNTRY_LOOKUP_URL) {
          return { lookup: { items: [{ id: 46, label: 'Germany' }] } }
        }

        return indiaPageOnePayload
      },
    }),
    /verified india country lookup/i,
  )
})
