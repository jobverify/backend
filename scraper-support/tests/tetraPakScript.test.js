import assert from 'node:assert/strict'
import test from 'node:test'

const loadTetraPakModule = async () => {
  try {
    return await import('../../scraper/tetrapak/script.js')
  } catch {
    assert.fail('Expected Tetra Pak scraper module at ../../scraper/tetrapak/script.js')
  }
}

const searchPayload = {
  totalJobs: 19,
  jobSearchResult: [
    {
      response: {
        id: '96289',
        unifiedStandardTitle: 'Project Engineer',
        unifiedUrlTitle: 'Project-Engineer',
        sfstd_jobLocation_obj: ['Pune'],
        jobLocationShort: ['Pune, IND'],
        unifiedStandardStart: '07/09/2026',
        unifiedStandardEnd: null,
      },
    },
    {
      response: {
        id: '90001',
        unifiedStandardTitle: 'Project Manager',
        unifiedUrlTitle: 'Project-Manager',
        sfstd_jobLocation_obj: ['Lund'],
        jobLocationShort: ['Lund, SWE'],
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
        <a class="btn btn-primary btn-large btn-lg apply dialogApplyBtn " href="/talentcommunity/apply/96289/?locale=en_GB&jobID=96289#tracked">Apply</a>
      </div>
      <div class="joblayouttoken">
        <div class="inner">
          <div class="row">
            <div class="col-xs-12 fontalign-left">
              <h1>
                <span itemprop="title" data-careersite-propertyid="title">Project Engineer</span>
              </h1>
            </div>
          </div>
        </div>
      </div>
      <span itemprop="description" data-careersite-propertyid="description" class="rtltextaligneligible">
        <span class="jobdescription">
          <p>Deliver packaging equipment projects for Tetra Pak India customers.</p>
          <ul>
            <li>Coordinate installation and commissioning work.</li>
            <li>Partner with Pune engineering teams.</li>
          </ul>
        </span>
      </span>
    </div>
  </body>
</html>
`

test('buildSearchRequestPayload keeps Tetra Pak requests on the public SuccessFactors jobs API contract', async () => {
  const {
    SEARCH_API_URL,
    SEARCH_PAGE_URL,
    buildSearchRequestPayload,
  } = await loadTetraPakModule()

  assert.equal(
    SEARCH_PAGE_URL,
    'https://jobs.tetrapak.com/search/?locationsearch=India&q=&searchResultView=LIST&locale=en_GB',
  )
  assert.equal(
    SEARCH_API_URL,
    'https://jobs.tetrapak.com/services/recruiting/v1/jobs',
  )

  assert.deepEqual(buildSearchRequestPayload(), {
    keywords: '',
    locale: 'en_GB',
    location: 'India',
    pageNumber: 0,
    sortBy: 'recent',
  })
})

test('extractSearchResults maps Tetra Pak listings and excludes non-India rows', async () => {
  const {
    buildDetailUrl,
    extractSearchResults,
    extractSearchSummary,
  } = await loadTetraPakModule()

  const jobs = extractSearchResults(searchPayload)

  assert.deepEqual(jobs, [
    {
      title: 'Project Engineer',
      location: 'Pune, India',
      city: 'Pune',
      state: null,
      jobId: '96289',
      requisitionId: '96289',
      sourceUrl: buildDetailUrl('Project-Engineer', '96289'),
      applyUrl: buildDetailUrl('Project-Engineer', '96289'),
      postingDate: '07/09/2026',
      closingDate: null,
    },
  ])

  assert.deepEqual(extractSearchSummary(searchPayload), {
    totalJobCount: 19,
    pageSize: 2,
  })
})

test('extractJobDetail keeps the public detail page as the safe Tetra Pak apply fallback', async () => {
  const {
    buildDetailUrl,
    extractJobDetail,
  } = await loadTetraPakModule()

  const detail = extractJobDetail(detailHtml, {
    title: 'Project Engineer',
    location: 'Pune, India',
    city: 'Pune',
    state: null,
    jobId: '96289',
    requisitionId: '96289',
    sourceUrl: buildDetailUrl('Project-Engineer', '96289'),
    applyUrl: buildDetailUrl('Project-Engineer', '96289'),
    postingDate: '07/09/2026',
    closingDate: null,
  })

  assert.equal(detail.title, 'Project Engineer')
  assert.equal(detail.location, 'Pune, India')
  assert.equal(detail.city, 'Pune')
  assert.equal(detail.employmentType, 'Full-time')
  assert.match(detail.jobDescription, /tetra pak india customers/i)
  assert.deepEqual(detail.requiredSkills, [
    'Coordinate installation and commissioning work.',
    'Partner with Pune engineering teams.',
  ])
  assert.equal(detail.applyUrl, 'https://jobs.tetrapak.com/job/Project-Engineer/96289-en_GB/')
  assert.equal(detail.sourceUrl, 'https://jobs.tetrapak.com/job/Project-Engineer/96289-en_GB/')
})

test('run paginates Tetra Pak API results and decorates shared runner fields', async () => {
  const {
    SEARCH_API_URL,
    createTetraPakScraper,
  } = await loadTetraPakModule()

  const requests = []
  const jobs = await createTetraPakScraper().run({
    maxPages: 1,
    maxJobs: 1,
    fetchJson: async (url, options = {}) => {
      requests.push({
        url,
        method: options.method || 'GET',
        body: options.body || null,
      })

      if (url !== SEARCH_API_URL) {
        throw new Error(`Unexpected Tetra Pak URL: ${url}`)
      }

      return searchPayload
    },
    fetchText: async (url) => {
      if (url === 'https://jobs.tetrapak.com/job/Project-Engineer/96289-en_GB/') {
        return detailHtml
      }
      throw new Error(`Unexpected Tetra Pak detail URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [{
    url: SEARCH_API_URL,
    method: 'POST',
    body: JSON.stringify({
      keywords: '',
      locale: 'en_GB',
      location: 'India',
      pageNumber: 0,
      sortBy: 'recent',
    }),
  }])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Tetra Pak')
  assert.equal(jobs[0].source, 'tetrapak')
  assert.equal(jobs[0].city, 'Pune')
  assert.equal(
    jobs[0].link,
    'https://jobs.tetrapak.com/job/Project-Engineer/96289-en_GB/',
  )
})
