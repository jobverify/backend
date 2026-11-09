import assert from 'node:assert/strict'
import test from 'node:test'

const loadWorldlineIndiaModule = async () => {
  try {
    return await import('../../scraper/worldlineindia/script.js')
  } catch {
    assert.fail('Expected Worldline India scraper module at ../../scraper/worldlineindia/script.js')
  }
}

const searchPayload = {
  totalJobs: 14,
  jobSearchResult: [
    {
      response: {
        id: '302372',
        unifiedStandardTitle: 'Lead C++ Developer',
        unifiedUrlTitle: 'Lead-C%2B%2B-Developer',
        sfstd_jobLocation_obj: ['Pune'],
        jobLocationShort: ['Pune, IND'],
        unifiedStandardStart: '07/09/2026',
        unifiedStandardEnd: null,
      },
    },
    {
      response: {
        id: '999999',
        unifiedStandardTitle: 'Senior Product Manager',
        unifiedUrlTitle: 'Senior-Product-Manager',
        sfstd_jobLocation_obj: ['Paris'],
        jobLocationShort: ['Paris, FRA'],
        unifiedStandardStart: '07/08/2026',
        unifiedStandardEnd: null,
      },
    },
  ],
}

const detailHtml = `
<!doctype html>
<html>
  <body>
    <div class="jobDisplayShell" itemscope="itemscope" itemtype="http://schema.org/JobPosting">
      <div class="applylink pull-right">
        <a class="btn btn-primary btn-large btn-lg apply dialogApplyBtn " href="/talentcommunity/apply/302372/?locale=en_US">Apply</a>
      </div>
      <div class="joblayouttoken">
        <div class="inner">
          <div class="row">
            <div class="col-xs-12 fontalign-left">
              <h1>
                <span itemprop="title" data-careersite-propertyid="title">Lead C++ Developer</span>
              </h1>
            </div>
          </div>
        </div>
      </div>
      <span itemprop="description" data-careersite-propertyid="description" class="rtltextaligneligible">
        <span class="jobdescription">
          <p>Build payment platform capabilities for Worldline India engineering teams.</p>
          <ul>
            <li>Develop modern C++ services.</li>
            <li>Collaborate across Pune and Bengaluru teams.</li>
          </ul>
        </span>
      </span>
    </div>
  </body>
</html>
`

test('buildSearchRequestPayload keeps Worldline India requests on the public SuccessFactors jobs API contract', async () => {
  const {
    SEARCH_API_URL,
    SEARCH_PAGE_URL,
    buildSearchRequestPayload,
  } = await loadWorldlineIndiaModule()

  assert.equal(
    SEARCH_PAGE_URL,
    'https://jobs.worldline.com/search/?locationsearch=India&q=&searchResultView=LIST',
  )
  assert.equal(
    SEARCH_API_URL,
    'https://jobs.worldline.com/services/recruiting/v1/jobs',
  )

  assert.deepEqual(buildSearchRequestPayload(), {
    keywords: '',
    locale: 'en_US',
    location: 'India',
    pageNumber: 0,
    sortBy: 'recent',
  })
})

test('extractSearchResults maps Worldline India listings and excludes non-India rows', async () => {
  const {
    buildApplyUrl,
    buildDetailUrl,
    extractSearchResults,
    extractSearchSummary,
  } = await loadWorldlineIndiaModule()

  const jobs = extractSearchResults(searchPayload)

  assert.deepEqual(jobs, [
    {
      title: 'Lead C++ Developer',
      location: 'Pune, India',
      city: 'Pune',
      state: null,
      jobId: '302372',
      requisitionId: '302372',
      sourceUrl: buildDetailUrl('Lead-C%2B%2B-Developer', '302372'),
      applyUrl: buildApplyUrl('302372'),
      postingDate: '07/09/2026',
      closingDate: null,
    },
  ])

  assert.deepEqual(extractSearchSummary(searchPayload), {
    totalJobCount: 14,
    pageSize: 2,
  })
})

test('extractJobDetail maps Worldline India detail pages into shared scraper fields', async () => {
  const {
    buildApplyUrl,
    buildDetailUrl,
    extractJobDetail,
  } = await loadWorldlineIndiaModule()

  const detail = extractJobDetail(detailHtml, {
    title: 'Lead C++ Developer',
    location: 'Pune, India',
    city: 'Pune',
    state: null,
    jobId: '302372',
    requisitionId: '302372',
    sourceUrl: buildDetailUrl('Lead-C%2B%2B-Developer', '302372'),
    applyUrl: buildApplyUrl('302372'),
    postingDate: '07/09/2026',
    closingDate: null,
  })

  assert.equal(detail.title, 'Lead C++ Developer')
  assert.equal(detail.location, 'Pune, India')
  assert.equal(detail.city, 'Pune')
  assert.equal(detail.employmentType, 'Full-time')
  assert.match(detail.jobDescription, /worldline india engineering teams/i)
  assert.deepEqual(detail.requiredSkills, [
    'Develop modern C++ services.',
    'Collaborate across Pune and Bengaluru teams.',
  ])
  assert.equal(detail.applyUrl, 'https://jobs.worldline.com/talentcommunity/apply/302372/?locale=en_US')
  assert.equal(detail.sourceUrl, 'https://jobs.worldline.com/job/Lead-C%2B%2B-Developer/302372-en_US/')
})

test('run paginates Worldline India API results and decorates shared runner fields', async () => {
  const {
    SEARCH_API_URL,
    createWorldlineIndiaScraper,
  } = await loadWorldlineIndiaModule()

  const requests = []
  const jobs = await createWorldlineIndiaScraper().run({
    maxPages: 1,
    maxJobs: 1,
    fetchJson: async (url, options = {}) => {
      requests.push({
        url,
        method: options.method || 'GET',
        body: options.body || null,
      })

      if (url !== SEARCH_API_URL) {
        throw new Error(`Unexpected Worldline India URL: ${url}`)
      }

      return searchPayload
    },
    fetchText: async (url) => {
      if (url === 'https://jobs.worldline.com/job/Lead-C%2B%2B-Developer/302372-en_US/') {
        return detailHtml
      }
      throw new Error(`Unexpected Worldline India detail URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [{
    url: SEARCH_API_URL,
    method: 'POST',
    body: JSON.stringify({
      keywords: '',
      locale: 'en_US',
      location: 'India',
      pageNumber: 0,
      sortBy: 'recent',
    }),
  }])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Worldline India')
  assert.equal(jobs[0].source, 'worldlineindia')
  assert.equal(jobs[0].city, 'Pune')
  assert.equal(
    jobs[0].link,
    'https://jobs.worldline.com/talentcommunity/apply/302372/?locale=en_US',
  )
})
