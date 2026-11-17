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
  assert.equal(allstate.hasVerifiedSearchPageSignal(searchPageHtml), false)
  const {readFileSync} = await import('node:fs')
  const {gunzipSync} = await import('node:zlib')
  const {originals} = JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/allstate.workday/test-data/native-20261116.json.gz', import.meta.url))))
  const currentSearch = Buffer.from(originals.find(packet => packet.url === allstate.JOBS_SEARCH_URL).bodyBase64,'base64').toString()
  assert.equal(allstate.hasVerifiedSearchPageSignal(currentSearch), true)
  assert.deepEqual(allstate.extractSearchConfiguration(currentSearch), {
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

test('Allstate run reads the original native India feed while preserving complete descriptions and Workday apply links', async () => {
  const allstate = await loadAllstateModule()
  const {readFileSync} = await import('node:fs')
  const {gunzipSync} = await import('node:zlib')
  const {originals} = JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/allstate.workday/test-data/native-20261116.json.gz', import.meta.url))))
  const text = packet => Buffer.from(packet.bodyBase64, 'base64').toString()
  const payload = allstate.extractJsonpPayload(text(originals[1]))
  const requestedUrls = []
  const read = async url => {
    requestedUrls.push(url)
    const packet = originals.find(p => p.url === url)
    assert.ok(packet, `Uncaptured Allstate fixture URL: ${url}`)
    return text(packet)
  }
  const jobs = await allstate.run({now: () => FIXED_SCRAPED_AT, fetchText: read, fetchJsonpText: read})
  assert.equal(requestedUrls.length, 14)
  assert.equal(jobs.length, payload.totalHits)
  for (const job of jobs) {
    const record = payload.queryResult.find(r => r.ref === job.jobId)
    assert.ok(record)
    assert.equal(job.title, record.title)
    assert.equal(job.location, `${record.primary_city}, ${record.primary_state}, India`)
    assert.equal(job.city, record.primary_city)
    assert.equal(job.country, 'India')
    assert.equal(job.requisitionId, record.ref)
    assert.equal(job.department, record.primary_category || record.brand)
    assert.equal(job.employmentType, record.employment_type)
    assert.equal(job.sourceUrl, record.url)
    assert.equal(job.applyUrl, record.seo_url)
    assert.equal(job.link, record.seo_url)
    assert.equal(job.sourceDescription, record.description)
    assert.deepEqual(job.sourceNativeDetailPayload, record)
    assert.equal(job.source, 'allstate')
    assert.equal(job.company, 'Allstate')
    assert.equal(job.scrapedAt, FIXED_SCRAPED_AT)
  }
})
