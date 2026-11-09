import assert from 'node:assert/strict'
import test from 'node:test'

const loadInfiniteComputerSolutionsModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Infinite Computer Solutions scraper module at ./script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Infinite | Explore Job Opportunities &amp; Build Your Future</title>
  </head>
  <body>
    <main>
      <h1>Welcome to Careers at Infinite</h1>
      <p>The work we do impacts the world, and the future!</p>
      <a href="https://sjobs.brassring.com/TGNewUI/Search/Home/Home?partnerid=26656&amp;siteid=5008#home">
        Explore Current Openings
      </a>
      <section>
        <p>Our team will reach out to you when we have the opening.</p>
        <a href="https://sjobs.brassring.com/TGNewUI/Search/Home/Home?partnerid=26656&amp;siteid=5008#home">
          Submit Your Resume
        </a>
      </section>
    </main>
  </body>
</html>
`

const encodeHtmlAttributeJson = (value) => JSON.stringify(value)
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')

const buildSearchJob = ({
  reqid,
  title,
  autoreq,
  location,
  lastupdated = '14-Aug-2026',
  description = `<p>${title} public description.</p>`,
}) => ({
  Applied: false,
  ApplyDiff: 0,
  CurrentSubmissions: 0,
  IsActive: false,
  Language: null,
  Link: `https://sjobs.brassring.com/TGnewUI/Search/home/HomeWithPreLoad?partnerid=26656&siteid=5008&PageType=JobDetails&jobid=${reqid}`,
  NextApplyDate: null,
  NoOfDaysToExpire: 0,
  NoOfHoursToExpire: 0,
  Questions: [
    { QuestionName: 'reqid', Value: reqid },
    { QuestionName: 'hotjob', Value: 'No' },
    { QuestionName: 'clientid', Value: '26656' },
    { QuestionName: 'siteid', Value: '5008' },
    { QuestionName: 'gqid', Value: '204' },
    { QuestionName: 'jobreqlanguage', Value: '1' },
    { QuestionName: 'latitude', Value: '0.0' },
    { QuestionName: 'longitude', Value: '0.0' },
    { QuestionName: 'lastupdated', Value: lastupdated },
    { QuestionName: 'jobtitle', Value: title },
    { QuestionName: 'jobdescription', Value: description },
    { QuestionName: 'autoreq', Value: autoreq },
    { QuestionName: 'formtext4', Value: location },
  ],
})

const publicSearchLandingPayload = {
  HotJobs: {
    Job: [
      buildSearchJob({
        reqid: '54664',
        title: 'Technical Lead',
        autoreq: '48929BR',
        location: 'Bangalore - Campus ',
      }),
    ],
  },
  TotalCount: 577,
  KeywordCustomSolrFields: 'JobTitle,AutoReq',
  LocationCustomSolrFields: 'FORMTEXT4',
  JobFieldsToDisplay: {
    Position1: null,
    JobTitle: 'jobtitle',
    Position3: ['autoreq', 'formtext4'],
    Summary: 'jobdescription',
  },
}

const publicBrassringLandingHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Search Jobs at | Infinite Computer Solutions</title>
  </head>
  <body>
    <main>
      <h1>Search Jobs at Infinite Computer Solutions</h1>
      <p>Search job opportunities that match your interests</p>
      <p>Search location</p>
      <p>There are no jobs that match your criteria</p>
    </main>
    <input name="__RequestVerificationToken" value="verified-rft-token" />
    <input id="CookieValue" value="verified-encrypted-session" />
    <input id="linkId" value="0" />
    <input
      id="searchResults"
      type="hidden"
      value="${encodeHtmlAttributeJson(publicSearchLandingPayload)}"
    />
  </body>
</html>
`

const globalSearchPageOnePayload = {
  JobsCount: 4,
  Jobs: {
    Job: [
      buildSearchJob({
        reqid: '54664',
        title: 'Technical Lead',
        autoreq: '48929BR',
        location: 'Bangalore - Campus ',
      }),
      buildSearchJob({
        reqid: '55824',
        title: 'Product Owner',
        autoreq: '50001BR',
        location: 'Maryland ',
      }),
    ],
  },
}

const globalSearchPageTwoPayload = {
  JobsCount: 4,
  Jobs: {
    Job: [
      buildSearchJob({
        reqid: '52872',
        title: 'Senior Solution Engineer',
        autoreq: '47419BR',
        location: 'Noida ',
        lastupdated: '13-Aug-2026',
      }),
      buildSearchJob({
        reqid: '56135',
        title: 'Senior Developer – Pega',
        autoreq: '50002BR',
        location: 'Georgia ',
        lastupdated: '13-Aug-2026',
      }),
    ],
  },
}

test('Infinite Computer Solutions validates the official careers page and public BrassRing search landing config', async () => {
  const infinite = await loadInfiniteComputerSolutionsModule()

  assert.equal(infinite.SOURCE, 'infinitecomputersolutions')
  assert.equal(infinite.COMPANY, 'Infinite Computer Solutions')
  assert.equal(infinite.CAREERS_URL, 'https://www.infinite.com/careers')
  assert.equal(
    infinite.BRASSRING_URL,
    'https://sjobs.brassring.com/TGNewUI/Search/Home/Home?partnerid=26656&siteid=5008',
  )
  assert.equal(
    infinite.INDIA_BRASSRING_SEARCH_URL,
    'https://sjobs.brassring.com/TGNewUI/Search/Home/Home?partnerid=26656&siteid=5008#keyWordSearch=&locationSearch=India',
  )
  assert.equal(infinite.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(infinite.extractBrassringUrl(officialCareersHtml), infinite.BRASSRING_URL)
  assert.deepEqual(
    infinite.extractLandingSearchConfig(publicBrassringLandingHtml),
    {
      requestVerificationToken: 'verified-rft-token',
      encryptedSessionValue: 'verified-encrypted-session',
      sessionCookie: null,
      linkId: '0',
      keywordCustomSolrFields: 'JobTitle,AutoReq',
      locationCustomSolrFields: 'FORMTEXT4',
    },
  )
})

test('Infinite Computer Solutions ignores stale empty-state copy, paginates the public BrassRing search API, and keeps only India formtext4 jobs', async () => {
  const infinite = await loadInfiniteComputerSolutionsModule()
  const requestedPageUrls = []
  const requestedSearchBodies = []

  const jobs = await infinite.createInfiniteComputerSolutionsScraper().run({
    fetchPage: async (url) => {
      requestedPageUrls.push(url)

      if (url === infinite.CAREERS_URL) {
        return {
          status: 200,
          url,
          html: officialCareersHtml,
          headers: {},
        }
      }

      if (url === infinite.INDIA_BRASSRING_SEARCH_URL) {
        return {
          status: 200,
          url: infinite.BRASSRING_URL,
          html: publicBrassringLandingHtml,
          headers: {
            'set-cookie': 'TS01da7edd=verified-cookie-value; Path=/; Domain=.sjobs.brassring.com',
          },
        }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      assert.equal(url, infinite.SEARCH_API_URL)

      const parsedBody = JSON.parse(options.body)
      requestedSearchBodies.push(parsedBody)

      if (parsedBody.pageNumber === 1) return globalSearchPageOnePayload
      if (parsedBody.pageNumber === 2) return globalSearchPageTwoPayload

      throw new Error(`Unexpected search page number: ${parsedBody.pageNumber}`)
    },
    now: () => '2026-08-15T09:30:00.000Z',
  })

  assert.deepEqual(requestedPageUrls, [
    infinite.CAREERS_URL,
    infinite.INDIA_BRASSRING_SEARCH_URL,
  ])
  assert.deepEqual(
    requestedSearchBodies,
    [
      {
        partnerId: '26656',
        siteId: '5008',
        keyword: '',
        location: '',
        keywordCustomSolrFields: 'JobTitle,AutoReq',
        locationCustomSolrFields: 'FORMTEXT4',
        facetfilterfields: { Facet: [] },
        powersearchoptions: { PowerSearchOption: [] },
        linkId: '0',
        Latitude: 0,
        Longitude: 0,
        SortType: '',
        pageNumber: 1,
        encryptedSessionValue: 'verified-encrypted-session',
      },
      {
        partnerId: '26656',
        siteId: '5008',
        keyword: '',
        location: '',
        keywordCustomSolrFields: 'JobTitle,AutoReq',
        locationCustomSolrFields: 'FORMTEXT4',
        facetfilterfields: { Facet: [] },
        powersearchoptions: { PowerSearchOption: [] },
        linkId: '0',
        Latitude: 0,
        Longitude: 0,
        SortType: '',
        pageNumber: 2,
        encryptedSessionValue: 'verified-encrypted-session',
      },
    ],
  )
  assert.deepEqual(jobs, [
    {
      title: 'Technical Lead',
      company: 'Infinite Computer Solutions',
      location: 'Bangalore - Campus',
      city: 'Bangalore',
      country: 'India',
      jobId: '54664',
      requisitionId: '48929BR',
      sourceUrl: 'https://sjobs.brassring.com/TGnewUI/Search/home/HomeWithPreLoad?partnerid=26656&siteid=5008&PageType=JobDetails&jobid=54664',
      applyUrl: 'https://sjobs.brassring.com/TGnewUI/Search/home/HomeWithPreLoad?partnerid=26656&siteid=5008&PageType=JobDetails&jobid=54664',
      jobDescription: '<p>Technical Lead public description.</p>',
      postingDate: '2026-08-14T00:00:00.000Z',
      source: 'infinitecomputersolutions',
      link: 'https://sjobs.brassring.com/TGnewUI/Search/home/HomeWithPreLoad?partnerid=26656&siteid=5008&PageType=JobDetails&jobid=54664',
      companyCareerPage: 'https://www.infinite.com/careers',
      companyDomain: 'infinite.com',
      atsPlatform: 'brassring-public-search-api-location-filter',
    },
    {
      title: 'Senior Solution Engineer',
      company: 'Infinite Computer Solutions',
      location: 'Noida',
      city: 'Noida',
      country: 'India',
      jobId: '52872',
      requisitionId: '47419BR',
      sourceUrl: 'https://sjobs.brassring.com/TGnewUI/Search/home/HomeWithPreLoad?partnerid=26656&siteid=5008&PageType=JobDetails&jobid=52872',
      applyUrl: 'https://sjobs.brassring.com/TGnewUI/Search/home/HomeWithPreLoad?partnerid=26656&siteid=5008&PageType=JobDetails&jobid=52872',
      jobDescription: '<p>Senior Solution Engineer public description.</p>',
      postingDate: '2026-08-13T00:00:00.000Z',
      source: 'infinitecomputersolutions',
      link: 'https://sjobs.brassring.com/TGnewUI/Search/home/HomeWithPreLoad?partnerid=26656&siteid=5008&PageType=JobDetails&jobid=52872',
      companyCareerPage: 'https://www.infinite.com/careers',
      companyDomain: 'infinite.com',
      atsPlatform: 'brassring-public-search-api-location-filter',
    },
  ])
})

test('Infinite Computer Solutions fails closed when the official careers flow changes or the public BrassRing session config drifts', async () => {
  const infinite = await loadInfiniteComputerSolutionsModule()

  await assert.rejects(
    infinite.createInfiniteComputerSolutionsScraper().run({
      fetchPage: async () => ({
        status: 200,
        url: infinite.CAREERS_URL,
        html: '<main><h1>Infinite Careers</h1></main>',
        headers: {},
      }),
    }),
    /verified official careers surface/i,
  )

  await assert.rejects(
    infinite.createInfiniteComputerSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === infinite.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: officialCareersHtml,
            headers: {},
          }
        }

        if (url === infinite.INDIA_BRASSRING_SEARCH_URL) {
          return {
            status: 200,
            url: infinite.BRASSRING_URL,
            html: '<main><h1>Search Jobs at Infinite Computer Solutions</h1></main>',
            headers: {},
          }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
    }),
    /verified public brassring search session config/i,
  )
})
