import assert from 'node:assert/strict'
import test from 'node:test'

const loadUplModule = async () => {
  try {
    return await import('../../scraper/upl/script.js')
  } catch {
    assert.fail('Expected UPL scraper module at ../../scraper/upl/script.js')
  }
}

const listingHtml = `
<div class="searchResultsShell">
  <table id="searchresults" class="searchResults full table table-striped table-hover">
    <tbody>
      <tr class="data-row">
        <td class="colTitle">
          <a class="jobTitle-link" href="/job/Mumbai-Area-Sales-Manager/1250901/">Area Sales Manager</a>
        </td>
        <td class="colLocation">
          <span class="jobLocation">Mumbai, Maharashtra, India</span>
        </td>
        <td class="colDate">
          <span class="jobDate">08 Jul 2026</span>
        </td>
      </tr>
      <tr class="data-row">
        <td class="colTitle">
          <a class="jobTitle-link" href="/job/Sao-Paulo-Regional-Marketing-Lead/1250999/">Regional Marketing Lead</a>
        </td>
        <td class="colLocation">
          <span class="jobLocation">Sao Paulo, Brazil</span>
        </td>
        <td class="colDate">
          <span class="jobDate">07 Jul 2026</span>
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
    <meta itemprop="datePosted" content="2026-07-08" />
  </head>
  <body>
    <div class="jobDisplayShell">
      <div class="applylink pull-right">
        <a class="btn btn-primary btn-large btn-lg apply dialogApplyBtn " href="/talentcommunity/apply/1250901/?locale=en_US">Apply now</a>
      </div>
      <div class="joblayouttoken">
        <div class="inner">
          <div class="row">
            <div class="col-xs-12 fontalign-left">
              <h1 id="job-title" itemprop="title">Area Sales Manager</h1>
            </div>
          </div>
        </div>
      </div>
      <p id="job-location">
        <span class="jobGeoLocation">Mumbai, Maharashtra, India</span>
      </p>
      <p class="jobDate" id="job-date"><strong>Date:</strong> 08 Jul 2026</p>
      <input type="text" value="1250901" name="jobid" id="jobid" />
      <span itemprop="description" data-careersite-propertyid="description" class="rtltextaligneligible">
        <span class="jobdescription">
          <p>Lead regional crop solutions sales for the UPL India business.</p>
        </span>
      </span>
    </div>
  </body>
</html>
`

const detailHtmlWithExplicitExperience = `
<!doctype html>
<html>
  <body>
    <div class="jobDisplayShell">
      <div class="applylink pull-right">
        <a class="btn btn-primary btn-large btn-lg apply dialogApplyBtn " href="/talentcommunity/apply/1250901/?locale=en_US">Apply now</a>
      </div>
      <div class="joblayouttoken">
        <div class="inner">
          <div class="row">
            <div class="col-xs-12 fontalign-left">
              <h1 id="job-title" itemprop="title">Area Sales Manager</h1>
            </div>
          </div>
        </div>
      </div>
      <p id="job-location">
        <span class="jobGeoLocation">Mumbai, Maharashtra, India</span>
      </p>
      <p class="jobDate" id="job-date"><strong>Date:</strong> 08 Jul 2026</p>
      <input type="text" value="1250901" name="jobid" id="jobid" />
      <span itemprop="description" data-careersite-propertyid="description" class="rtltextaligneligible">
        <span class="jobdescription">
          <p>5-7 years of experience in regional crop protection sales.</p>
          <p>Lead regional crop solutions sales for the UPL India business.</p>
        </span>
      </span>
    </div>
  </body>
</html>
`

test('buildSearchPageUrl keeps UPL listings on the official public SuccessFactors search route', async () => {
  const { buildSearchPageUrl } = await loadUplModule()

  assert.equal(
    buildSearchPageUrl(),
    'https://careers.upl-ltd.com/search/?q=&sortColumn=referencedate&sortDirection=desc',
  )
  assert.equal(
    buildSearchPageUrl(25),
    'https://careers.upl-ltd.com/search/?q=&sortColumn=referencedate&sortDirection=desc&startrow=25',
  )
})

test('run keeps UPL on the public SuccessFactors search/detail/apply flow and filters to India jobs', async () => {
  const {
    buildSearchPageUrl,
    extractJobDetail,
    extractSearchResults,
    run,
  } = await loadUplModule()
  const requestedUrls = []

  const listings = extractSearchResults(listingHtml)
  assert.equal(listings.length, 2)
  assert.deepEqual(listings[0], {
    title: 'Area Sales Manager',
    location: 'Mumbai, Maharashtra, India',
    city: 'Mumbai',
    jobId: '1250901',
    requisitionId: '1250901',
    sourceUrl: 'https://careers.upl-ltd.com/job/Mumbai-Area-Sales-Manager/1250901/',
    postingDate: '08 Jul 2026',
  })

  assert.deepEqual(extractJobDetail(detailHtml, listings[0]), {
    title: 'Area Sales Manager',
    location: 'Mumbai, Maharashtra, India',
    city: 'Mumbai',
    jobId: '1250901',
    requisitionId: '1250901',
    employmentType: 'Full-time',
    experienceRequired: null,
    jobDescription: 'Lead regional crop solutions sales for the UPL India business.',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '08 Jul 2026',
    closingDate: null,
    applyUrl: 'https://careers.upl-ltd.com/talentcommunity/apply/1250901/?locale=en_US',
    sourceUrl: 'https://careers.upl-ltd.com/job/Mumbai-Area-Sales-Manager/1250901/',
    publicExperienceChecked: true,
  })

  const jobs = await run({
    maxPages: 1,
    maxJobs: 5,
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === buildSearchPageUrl()) return listingHtml
      if (url === listings[0].sourceUrl) return detailHtml
      throw new Error(`Unexpected UPL fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://careers.upl-ltd.com/search/?q=&sortColumn=referencedate&sortDirection=desc',
    'https://careers.upl-ltd.com/job/Mumbai-Area-Sales-Manager/1250901/',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'UPL')
  assert.equal(jobs[0].source, 'upl')
  assert.equal(jobs[0].city, 'Mumbai')
  assert.equal(jobs[0].jobId, '1250901')
  assert.equal(
    jobs[0].applyUrl,
    'https://careers.upl-ltd.com/talentcommunity/apply/1250901/?locale=en_US',
  )
  assert.equal(
    jobs[0].link,
    'https://careers.upl-ltd.com/talentcommunity/apply/1250901/?locale=en_US',
  )
  assert.equal(jobs[0].publicExperienceChecked, true)
})

test('extractJobDetail captures explicit experience from the live UPL SuccessFactors description block', async () => {
  const { extractJobDetail } = await loadUplModule()

  assert.equal(
    extractJobDetail(detailHtmlWithExplicitExperience, {
      title: 'Area Sales Manager',
      location: 'Mumbai, Maharashtra, India',
      city: 'Mumbai',
      jobId: '1250901',
      sourceUrl: 'https://careers.upl-ltd.com/job/Mumbai-Area-Sales-Manager/1250901/',
    }).experienceRequired,
    '5-7 years',
  )
})
