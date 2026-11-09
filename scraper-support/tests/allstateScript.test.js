import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-15T00:00:00.000Z'

const loadAllstateModule = async () => {
  try {
    return await import('../../scraper/allstate.workday/script.js')
  } catch {
    assert.fail('Expected Allstate scraper module at ../../scraper/allstate.workday/script.js')
  }
}

const searchPageHtml = `
<!doctype html>
<html>
  <head>
    <title>Allstate Job Search | Jobs Near Me &amp; Remote | Allstate Careers</title>
  </head>
  <body>
    <script>
      var cws_opts = {"org":"2030","api":"https:\\/\\/jobsapi-internal.m-cloud.io\\/api\\/","job_detail_path":"\\/job"};
    </script>
    <div class="widget-jobsearch-results">
      <h2 class="search-results-title">Open Jobs</h2>
    </div>
    <div class="search-checkbox-item checkbox-india">
      <input type="checkbox" name="compliment" value="India" data-param="facet" data-facet="compliment" />
    </div>
    <script type="text/javascript">
      jQuery(document).ready(function(){
        if(CWS && CWS.jobs){
          CWS.jobs.set_api("https://jobsapi-internal.m-cloud.io/api/");
          CWS.jobs.set_options({
            org_id: "2030",
            filters: ["ats_portalid:Workday-MuleAPI-External","is_internal:allstate_careers"]
          });
        }
      });
    </script>
    <script type="text/javascript">
      jQuery(document).ready(function(){
        if (CWS && CWS.jobs) {
          CWS.jobs.set_options({
            limit: 10
          });
        }
      });
    </script>
  </body>
</html>
`

const buildJsonpPayload = (payload, callbackName = 'testCallback') =>
  `${callbackName}(${JSON.stringify(payload)})`

test('Allstate exports the verified first-party public jobs API contract', async () => {
  const allstate = await loadAllstateModule()

  assert.equal(allstate.SOURCE, 'allstate')
  assert.equal(allstate.COMPANY, 'Allstate')
  assert.equal(allstate.JOBS_SEARCH_URL, 'https://www.allstate.jobs/job-search-results/')
  assert.equal(allstate.JOBS_API_URL, 'https://jobsapi-internal.m-cloud.io/api/job')
  assert.equal(allstate.DEFAULT_ORGANIZATION_ID, '2030')
  assert.deepEqual(allstate.DEFAULT_FILTERS, [
    'ats_portalid:Workday-MuleAPI-External',
    'is_internal:allstate_careers',
  ])
  assert.equal(allstate.INDIA_FACET, 'compliment:India')
  assert.equal(allstate.hasVerifiedSearchPageSignal(searchPageHtml), true)
  assert.deepEqual(allstate.extractSearchConfiguration(searchPageHtml), {
    apiBaseUrl: 'https://jobsapi-internal.m-cloud.io/api/',
    organizationId: '2030',
    filters: [
      'ats_portalid:Workday-MuleAPI-External',
      'is_internal:allstate_careers',
    ],
    limit: 10,
  })
  assert.equal(
    allstate.buildJobsApiUrl({
      organizationId: '2030',
      filters: [...allstate.DEFAULT_FILTERS, allstate.INDIA_FACET],
      limit: 1,
      offset: 2,
      callbackName: 'testCallback',
    }),
    'https://jobsapi-internal.m-cloud.io/api/job?Organization=2030&Limit=1&offset=2&sortfield=open_date&sortorder=descending&facet=ats_portalid%3AWorkday-MuleAPI-External&facet=is_internal%3Aallstate_careers&facet=compliment%3AIndia&callback=testCallback',
  )
})

test('Allstate run reads India jobs from the official public JSONP API while preserving Workday apply links', async () => {
  const allstate = await loadAllstateModule()

  const firstJob = {
    title: 'Software Engineer Senior Consultant I',
    ref: 'R32932',
    company_name: 'Allstate',
    primary_city: 'Pune',
    primary_state: 'Maharashtra',
    primary_country: 'IN',
    primary_address: 'Gera Commerzone',
    description: '<p>Job Description</p><p>Build software systems.</p><p>Experience</p><p>3 or more years of experience (Preferred)</p>',
    primary_category: 'Technology',
    brand: 'Allstate',
    employment_type: 'Full time',
    compliment: 'India',
    open_date: '2026-08-13T00:00:00Z',
    url: 'https://www.allstate.jobs/job/23713993/software-engineer-senior-consultant-i-pune-in/',
    seo_url: 'https://allstate.wd5.myworkdayjobs.com/allstate_careers/job/Ind--Pune/Software-Engineer-Senior-Consultant-I_R32932-1/apply',
    location_type: 'Hybrid',
  }
  const secondJob = {
    title: 'Reconciliations Analyst II',
    ref: 'R29050',
    company_name: 'Allstate',
    primary_city: 'Pune',
    primary_state: 'Maharashtra',
    primary_country: 'IN',
    primary_address: 'SEZ 1',
    description: "<p>Education</p><p>Bachelor's degree in Commerce</p><p>Experience</p><p>Minimum 2 years of experience in Accounting is mandatory</p>",
    primary_category: 'Legal & Compliance',
    brand: 'Allstate',
    employment_type: 'Full time',
    compliment: 'India',
    open_date: '2026-08-10T00:00:00Z',
    url: 'https://www.allstate.jobs/job/23644204/reconciliations-analyst-ii-pune-in/',
    seo_url: 'https://allstate.wd5.myworkdayjobs.com/allstate_careers/job/Ind--Pune/Reconciliations-Analyst-II_R29050/apply',
    location_type: 'Hybrid',
  }

  const requestedUrls = []
  const jobs = await allstate.createAllstateScraper({
    now: () => FIXED_SCRAPED_AT,
    pageSize: 1,
    callbackName: 'testCallback',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === allstate.JOBS_SEARCH_URL) {
        return searchPageHtml
      }

      throw new Error(`Unexpected Allstate text fixture URL: ${url}`)
    },
    fetchJsonpText: async (url) => {
      requestedUrls.push(url)

      if (url.includes('offset=1')) {
        return buildJsonpPayload({
          totalHits: 2,
          queryResult: [firstJob],
        })
      }

      if (url.includes('offset=2')) {
        return buildJsonpPayload({
          totalHits: 2,
          queryResult: [secondJob],
        })
      }

      throw new Error(`Unexpected Allstate JSONP fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    allstate.JOBS_SEARCH_URL,
    'https://jobsapi-internal.m-cloud.io/api/job?Organization=2030&Limit=1&offset=1&sortfield=open_date&sortorder=descending&facet=ats_portalid%3AWorkday-MuleAPI-External&facet=is_internal%3Aallstate_careers&facet=compliment%3AIndia&callback=testCallback',
    'https://jobsapi-internal.m-cloud.io/api/job?Organization=2030&Limit=1&offset=2&sortfield=open_date&sortorder=descending&facet=ats_portalid%3AWorkday-MuleAPI-External&facet=is_internal%3Aallstate_careers&facet=compliment%3AIndia&callback=testCallback',
  ])
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      city: job.city,
      country: job.country,
      jobId: job.jobId,
      requisitionId: job.requisitionId,
      department: job.department,
      employmentType: job.employmentType,
      experienceRequired: job.experienceRequired,
      minimumQualification: job.minimumQualification,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      source: job.source,
      company: job.company,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Software Engineer Senior Consultant I',
        location: 'Pune, Maharashtra, India',
        city: 'Pune',
        country: 'India',
        jobId: 'R32932',
        requisitionId: 'R32932',
        department: 'Technology',
        employmentType: 'Full time',
        experienceRequired: '3 or more years of experience',
        minimumQualification: null,
        sourceUrl: 'https://www.allstate.jobs/job/23713993/software-engineer-senior-consultant-i-pune-in/',
        applyUrl: 'https://allstate.wd5.myworkdayjobs.com/allstate_careers/job/Ind--Pune/Software-Engineer-Senior-Consultant-I_R32932-1/apply',
        source: 'allstate',
        company: 'Allstate',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'Reconciliations Analyst II',
        location: 'Pune, Maharashtra, India',
        city: 'Pune',
        country: 'India',
        jobId: 'R29050',
        requisitionId: 'R29050',
        department: 'Legal & Compliance',
        employmentType: 'Full time',
        experienceRequired: 'Minimum 2 years of experience',
        minimumQualification: "Bachelor's degree in Commerce",
        sourceUrl: 'https://www.allstate.jobs/job/23644204/reconciliations-analyst-ii-pune-in/',
        applyUrl: 'https://allstate.wd5.myworkdayjobs.com/allstate_careers/job/Ind--Pune/Reconciliations-Analyst-II_R29050/apply',
        source: 'allstate',
        company: 'Allstate',
        scrapedAt: FIXED_SCRAPED_AT,
      },
    ],
  )
})
