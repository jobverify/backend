import assert from 'node:assert/strict'
import test from 'node:test'

const loadOmronModule = async () => {
  try {
    return await import('../../scraper/omron/script.js')
  } catch {
    assert.fail('Expected OMRON scraper module at ../../scraper/omron/script.js')
  }
}

const listingHtml = `
<div class="searchResultsShell">
  <table id="searchresults" class="searchResults full table table-striped table-hover" cellpadding="0" cellspacing="0" aria-label="Search results for India. Page 1 of 1, Results 1 to 2 of 2">
    <tbody>
      <tr class="data-row">
        <td class="colTitle">
          <a class="jobTitle-link" href="/job/Noida-Software-Engineer/20012345/">Software Engineer</a>
        </td>
        <td class="colLocation">
          <span class="jobLocation">Noida, Uttar Pradesh, India</span>
        </td>
        <td class="colDate">
          <span class="jobDate">09 Jul 2026</span>
        </td>
      </tr>
      <tr class="data-row">
        <td class="colTitle">
          <a class="jobTitle-link" href="/job/Singapore-Regional-Sales-Manager/20054321/">Regional Sales Manager</a>
        </td>
        <td class="colLocation">
          <span class="jobLocation">Singapore, Singapore</span>
        </td>
        <td class="colDate">
          <span class="jobDate">08 Jul 2026</span>
        </td>
      </tr>
    </tbody>
  </table>
</div>
`

const detailHtml = `
<!doctype html>
<html>
  <head>
    <meta itemprop="datePosted" content="2026-07-09" />
    <meta itemprop="validThrough" content="2026-08-09" />
  </head>
  <body>
    <div class="jobDisplayShell" itemscope="itemscope" itemtype="http://schema.org/JobPosting">
      <div class="applylink pull-right">
        <a class="btn btn-primary btn-large btn-lg apply dialogApplyBtn " href="/talentcommunity/apply/20012345/?locale=en_US">Apply</a>
      </div>
      <div class="joblayouttoken">
        <div class="inner">
          <div class="row">
            <div class="col-xs-12 fontalign-left">
              <h1>
                <span itemprop="title" data-careersite-propertyid="title">Software Engineer</span>
              </h1>
            </div>
          </div>
        </div>
      </div>
      <dl>
        <dt>Location(s):</dt>
        <dd>Noida, Uttar Pradesh, India</dd>
        <dt>Job ID:</dt>
        <dd>20012345</dd>
        <dt>Type of position:</dt>
        <dd>Full-time</dd>
      </dl>
      <span itemprop="description" data-careersite-propertyid="description" class="rtltextaligneligible">
        <span class="jobdescription">
          <p>Build industrial automation products for OMRON India engineering teams.</p>
          <ul>
            <li>Develop Node.js services.</li>
            <li>Collaborate with QA automation teams.</li>
          </ul>
        </span>
      </span>
    </div>
  </body>
</html>
`

test('OMRON scraper stays on the official India SuccessFactors pages and normalizes shared fields', async () => {
  const {
    INDIA_SEARCH_URL,
    buildSearchUrl,
    createOmronScraper,
    extractJobDetail,
    extractSearchResults,
  } = await loadOmronModule()

  assert.equal(
    INDIA_SEARCH_URL,
    'https://careers.omron.com/search/?locationsearch=India&q=&searchResultView=LIST&locale=en_US',
  )
  assert.equal(
    buildSearchUrl(),
    'https://careers.omron.com/search/?locationsearch=India&q=&searchResultView=LIST&locale=en_US',
  )

  const listings = extractSearchResults(listingHtml)
  assert.deepEqual(listings, [{
    title: 'Software Engineer',
    location: 'Noida, Uttar Pradesh, India',
    city: 'Noida',
    jobId: '20012345',
    requisitionId: '20012345',
    sourceUrl: 'https://careers.omron.com/job/Noida-Software-Engineer/20012345/',
    postingDate: '2026-07-09',
  }])

  assert.deepEqual(extractJobDetail(detailHtml, listings[0]), {
    title: 'Software Engineer',
    location: 'Noida, Uttar Pradesh, India',
    city: 'Noida',
    jobId: '20012345',
    requisitionId: '20012345',
    employmentType: 'Full-time',
    experienceRequired: null,
    jobDescription: 'Build industrial automation products for OMRON India engineering teams. - Develop Node.js services. - Collaborate with QA automation teams.',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Develop Node.js services.',
      'Collaborate with QA automation teams.',
    ],
    postingDate: '2026-07-09',
    closingDate: '2026-08-09',
    applyUrl: 'https://careers.omron.com/talentcommunity/apply/20012345/?locale=en_US',
    sourceUrl: 'https://careers.omron.com/job/Noida-Software-Engineer/20012345/',
  })

  const requestedUrls = []
  const jobs = await createOmronScraper().run({
    maxPages: 1,
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === INDIA_SEARCH_URL) return listingHtml
      if (url === listings[0].sourceUrl) return detailHtml
      throw new Error(`Unexpected OMRON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [INDIA_SEARCH_URL, listings[0].sourceUrl])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'OMRON')
  assert.equal(jobs[0].source, 'omron')
  assert.equal(jobs[0].city, 'Noida')
  assert.equal(
    jobs[0].applyUrl,
    'https://careers.omron.com/talentcommunity/apply/20012345/?locale=en_US',
  )
  assert.equal(
    jobs[0].sourceUrl,
    'https://careers.omron.com/job/Noida-Software-Engineer/20012345/',
  )
})
