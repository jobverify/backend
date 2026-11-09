import assert from 'node:assert/strict'
import test from 'node:test'

const searchPageHtml = `
<div class="pagination pagination-top">
  <span class="paginationLabel">Results 1 to 10 of 10</span>
  <span class="srHelp" style="font-size:0px">Page 1 of 1</span>
</div>
<div class="searchResultsShell">
  <table id="searchresults" class="searchResults full table table-striped table-hover" aria-label="Search results for India. Page 1 of 1, Results 1 to 10 of 10">
    <tbody>
      <tr class="data-row">
        <td class="colTitle" headers="hdrTitle">
          <span class="jobTitle hidden-phone">
            <a href="/job/Hyderabad-Tax-Lead%2C-India-TG-500081/1377285800/" class="jobTitle-link">Tax Lead, India</a>
          </span>
        </td>
        <td class="colLocation hidden-phone" headers="hdrLocation">
          <span class="jobLocation">Hyderabad, TG, IN, 500081</span>
        </td>
        <td class="colDate hidden-phone" headers="hdrDate">
          <span class="jobDate">22 Jun 2026</span>
        </td>
      </tr>
      <tr class="data-row">
        <td class="colTitle" headers="hdrTitle">
          <span class="jobTitle hidden-phone">
            <a href="/job/Toronto-Senior-Engineer-ON-M5H/1404343900/" class="jobTitle-link">Senior Engineer - Technical Services</a>
          </span>
        </td>
        <td class="colLocation hidden-phone" headers="hdrLocation">
          <span class="jobLocation">Toronto, ON, CA, M5H</span>
        </td>
        <td class="colDate hidden-phone" headers="hdrDate">
          <span class="jobDate">14 Jul 2026</span>
        </td>
      </tr>
    </tbody>
  </table>
</div>
<title>India - Orica Jobs</title>
`

const detailPageHtml = `
<html>
  <head>
    <title>Tax Lead, India Job Details | Orica</title>
    <meta itemprop="datePosted" content="Mon Jun 22 07:00:00 UTC 2026" />
  </head>
  <body>
    <div class="jobDisplay">
      <div class="jobTitle">
        <h1 id="job-title" itemprop="title">Tax Lead, India</h1>
        <a class="btn btn-primary btn-large btn-lg apply dialogApplyBtn " href="/talentcommunity/apply/1377285800/?locale=en_GB">Apply now</a>
      </div>
      <p id="job-location" class="jobLocation">
        <strong>Location:</strong>
        <span class="jobGeoLocation">Hyderabad, TG, IN, 500081</span>
      </p>
      <div class="job">
        <span itemprop="description" class="jobdescription">
          <p>Lead direct and indirect tax operations across India.</p>
          <ul>
            <li>Partner with finance and shared services teams</li>
            <li>Drive compliance and audit readiness</li>
          </ul>
        </span>
      </div>
    </div>
    <script type="text/javascript">
      j2w.Apply.init({
        jobID                    : 1377285800,
        sourceId                 : 'JATS-oricaaus01',
        locale                   : 'en_GB'
      });
    </script>
  </body>
</html>
`

const loadOricaIndiaModule = async () => {
  try {
    return await import('../../scraper/oricaindia/script.js')
  } catch {
    assert.fail('Expected Orica India scraper module at ../../scraper/oricaindia/script.js')
  }
}

test('buildSearchUrl keeps Orica India requests on the verified public India search route', async () => {
  const {
    SEARCH_PAGE_URL,
    buildSearchUrl,
  } = await loadOricaIndiaModule()

  assert.equal(
    SEARCH_PAGE_URL,
    'https://careers.orica.com/search/?createNewAlert=false&q=&locationsearch=India',
  )
  assert.equal(
    buildSearchUrl(),
    'https://careers.orica.com/search/?createNewAlert=false&q=&locationsearch=India',
  )
  assert.equal(
    buildSearchUrl({ startRow: 10 }),
    'https://careers.orica.com/search/?createNewAlert=false&q=&locationsearch=India&startrow=10',
  )
})

test('extractSearchResults keeps only India rows from the official Orica search table', async () => {
  const {
    extractSearchResults,
    hasOfficialSearchResultsSignal,
  } = await loadOricaIndiaModule()

  assert.equal(hasOfficialSearchResultsSignal(searchPageHtml), true)
  assert.deepEqual(extractSearchResults(searchPageHtml), [{
    title: 'Tax Lead, India',
    location: 'Hyderabad, TG, India, 500081',
    city: 'Hyderabad',
    jobId: '1377285800',
    requisitionId: '1377285800',
    sourceUrl: 'https://careers.orica.com/job/Hyderabad-Tax-Lead%2C-India-TG-500081/1377285800/',
    postingDate: '2026-06-22',
  }])
})

test('extractResultsSummary reads Orica result counts from the public search page', async () => {
  const { extractResultsSummary } = await loadOricaIndiaModule()

  assert.deepEqual(extractResultsSummary(searchPageHtml), {
    totalResults: 10,
    currentPage: 1,
    totalPages: 1,
    pageSize: 10,
  })
})

test('extractJobDetail builds the public Orica apply handoff from the detail page', async () => {
  const {
    buildApplyUrl,
    extractJobDetail,
  } = await loadOricaIndiaModule()

  assert.equal(
    buildApplyUrl('1377285800'),
    'https://careers.orica.com/talentcommunity/apply/1377285800/?locale=en_GB',
  )

  assert.deepEqual(
    extractJobDetail(detailPageHtml, {
      title: 'Tax Lead, India',
      location: 'Hyderabad, TG, India, 500081',
      city: 'Hyderabad',
      jobId: '1377285800',
      requisitionId: '1377285800',
      sourceUrl: 'https://careers.orica.com/job/Hyderabad-Tax-Lead%2C-India-TG-500081/1377285800/',
      postingDate: '2026-06-22',
    }),
    {
      title: 'Tax Lead, India',
      location: 'Hyderabad, TG, India, 500081',
      city: 'Hyderabad',
      jobId: '1377285800',
      requisitionId: '1377285800',
      employmentType: null,
      experienceRequired: null,
      jobDescription:
        'Lead direct and indirect tax operations across India. Partner with finance and shared services teams Drive compliance and audit readiness',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [
        'Partner with finance and shared services teams',
        'Drive compliance and audit readiness',
      ],
      postingDate: '2026-06-22',
      closingDate: null,
      applyUrl: 'https://careers.orica.com/talentcommunity/apply/1377285800/?locale=en_GB',
      sourceUrl: 'https://careers.orica.com/job/Hyderabad-Tax-Lead%2C-India-TG-500081/1377285800/',
      department: null,
    },
  )
})

test('run fetches the official Orica India listing page first, then enriches India results via detail pages', async () => {
  const {
    SEARCH_PAGE_URL,
    createOricaIndiaScraper,
  } = await loadOricaIndiaModule()

  const requests = []
  const jobs = await createOricaIndiaScraper().run({
    maxPages: 1,
    fetchText: async (url) => {
      requests.push(url)
      if (url === SEARCH_PAGE_URL) return searchPageHtml
      if (url === 'https://careers.orica.com/job/Hyderabad-Tax-Lead%2C-India-TG-500081/1377285800/') {
        return detailPageHtml
      }

      throw new Error(`Unexpected Orica India URL: ${url}`)
    },
    now: () => '2026-07-17T00:00:00.000Z',
  })

  assert.deepEqual(requests, [
    SEARCH_PAGE_URL,
    'https://careers.orica.com/job/Hyderabad-Tax-Lead%2C-India-TG-500081/1377285800/',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Orica India')
  assert.equal(jobs[0].source, 'oricaindia')
  assert.equal(jobs[0].jobId, '1377285800')
  assert.equal(
    jobs[0].applyUrl,
    'https://careers.orica.com/talentcommunity/apply/1377285800/?locale=en_GB',
  )
  assert.equal(jobs[0].scrapedAt, '2026-07-17T00:00:00.000Z')
})
