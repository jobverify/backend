import assert from 'node:assert/strict'
import test from 'node:test'

const loadNestleModule = async () => {
  try {
    return await import('../../scraper/nestle/script.js')
  } catch {
    assert.fail('Expected Nestle scraper module at ../../scraper/nestle/script.js')
  }
}

const searchHtml = `
<!doctype html>
<html>
  <body>
    <div class="pagination-label-row">
      <span class="paginationLabel" aria-label="Results 1 to 2">Results <b>1 to 2</b> of <b>2</b></span>
      <span class="srHelp" style="font-size:0px">Page 1 of 1</span>
    </div>
    <table id="searchresults">
      <tbody>
        <tr class="data-row">
          <td class="colTitle">
            <span class="jobTitle hidden-phone">
              <a href="/job/Bangalore-Business-Analyst-Manager-Procurement-560103/1412067333/" class="jobTitle-link">Business Analyst Manager - Procurement</a>
            </span>
          </td>
          <td class="colDepartment"><span class="jobDepartment">Procurement</span></td>
          <td class="colLocation"><span class="jobLocation">India IT HUB, Bangalore</span></td>
          <td class="colDate"><span class="jobDate">Jul 9, 2026</span></td>
        </tr>
        <tr class="data-row">
          <td class="colTitle">
            <span class="jobTitle hidden-phone">
              <a href="/job/Arlington-Procurement-Manager-22201/1412067000/" class="jobTitle-link">Procurement Manager</a>
            </span>
          </td>
          <td class="colDepartment"><span class="jobDepartment">Procurement</span></td>
          <td class="colLocation"><span class="jobLocation">Arlington, Virginia, United States</span></td>
          <td class="colDate"><span class="jobDate">Jul 8, 2026</span></td>
        </tr>
      </tbody>
    </table>
  </body>
</html>
`

const detailHtml = `
<!doctype html>
<html>
  <body>
    <div class="jobDisplayShell" itemscope="itemscope" itemtype="http://schema.org/JobPosting">
      <span itemprop="jobLocation" itemscope itemtype="http://schema.org/Place">
        <span itemprop="address" itemscope itemtype="http://schema.org/PostalAddress">
          <meta itemprop="streetAddress" content="India IT HUB, Bangalore">
        </span>
      </span>
      <meta itemprop="datePosted" content="Thu Jul 09 00:00:00 UTC 2026">
      <div class="applylink pull-right">
        <a class="btn btn-primary btn-large btn-lg apply dialogApplyBtn " href="/talentcommunity/apply/1412067333/?locale=en_US">Apply now</a>
      </div>
      <div class="joblayouttoken">
        <div class="inner">
          <div class="row">
            <div class="col-xs-12 fontalign-left">
              <h1>
                <span itemprop="title" data-careersite-propertyid="title">Business Analyst Manager - Procurement</span>
              </h1>
            </div>
          </div>
        </div>
      </div>
      <span itemprop="description" data-careersite-propertyid="description" class="rtltextaligneligible">
        <span class="jobdescription">
          <p>Lead procurement analytics and business analysis for Nestle global stakeholders.</p>
          <ul>
            <li>Drive supplier insights and process improvements.</li>
            <li>Partner with procurement and IT teams.</li>
          </ul>
        </span>
      </span>
    </div>
  </body>
</html>
`

test('buildIndiaSearchUrl keeps Nestle listings on the official India-filtered SuccessFactors route', async () => {
  const { buildIndiaSearchUrl } = await loadNestleModule()

  assert.equal(
    buildIndiaSearchUrl(),
    'https://jobdetails.nestle.com/search/?createNewAlert=false&q=&locationsearch=&optionsFacetsDD_country=IN',
  )
  assert.equal(
    buildIndiaSearchUrl(25),
    'https://jobdetails.nestle.com/search/?createNewAlert=false&q=&locationsearch=&optionsFacetsDD_country=IN&startrow=25',
  )
})

test('extractSearchResults keeps only India-facing Nestle search rows from the public jobs host', async () => {
  const { extractSearchResults } = await loadNestleModule()
  const jobs = extractSearchResults(searchHtml)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Business Analyst Manager - Procurement',
    department: 'Procurement',
    location: 'India IT HUB, Bangalore',
    city: 'India IT HUB',
    jobId: '1412067333',
    requisitionId: '1412067333',
    sourceUrl: 'https://jobdetails.nestle.com/job/Bangalore-Business-Analyst-Manager-Procurement-560103/1412067333/',
    postingDate: 'Jul 9, 2026',
  })
})

test('extractJobDetail maps Nestle SuccessFactors detail pages into shared scraper fields', async () => {
  const { extractJobDetail } = await loadNestleModule()
  const detail = extractJobDetail(detailHtml, {
    title: 'Business Analyst Manager - Procurement',
    department: 'Procurement',
    location: 'India IT HUB, Bangalore',
    city: 'India IT HUB',
    jobId: '1412067333',
    requisitionId: '1412067333',
    sourceUrl: 'https://jobdetails.nestle.com/job/Bangalore-Business-Analyst-Manager-Procurement-560103/1412067333/',
    postingDate: 'Jul 9, 2026',
  })

  assert.deepEqual(detail, {
    title: 'Business Analyst Manager - Procurement',
    location: 'India IT HUB, Bangalore',
    city: 'India IT HUB',
    jobId: '1412067333',
    requisitionId: '1412067333',
    employmentType: 'Full-time',
    experienceRequired: null,
    jobDescription: 'Lead procurement analytics and business analysis for Nestle global stakeholders. - Drive supplier insights and process improvements. - Partner with procurement and IT teams.',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Drive supplier insights and process improvements.',
      'Partner with procurement and IT teams.',
    ],
    postingDate: 'Thu Jul 09 00:00:00 UTC 2026',
    closingDate: null,
    applyUrl: 'https://jobdetails.nestle.com/talentcommunity/apply/1412067333/?locale=en_US',
    sourceUrl: 'https://jobdetails.nestle.com/job/Bangalore-Business-Analyst-Manager-Procurement-560103/1412067333/',
  })
})

test('run fetches Nestle search results, skips non-India rows, and decorates shared runner fields', async () => {
  const nestle = await loadNestleModule()
  const requestedUrls = []
  const scraper = nestle.createNestleScraper()

  const jobs = await scraper.run({
    maxPages: 1,
    maxJobs: 1,
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === nestle.buildIndiaSearchUrl()) return searchHtml
      if (url === 'https://jobdetails.nestle.com/job/Bangalore-Business-Analyst-Manager-Procurement-560103/1412067333/') {
        return detailHtml
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(
    requestedUrls,
    [
      'https://jobdetails.nestle.com/search/?createNewAlert=false&q=&locationsearch=&optionsFacetsDD_country=IN',
      'https://jobdetails.nestle.com/job/Bangalore-Business-Analyst-Manager-Procurement-560103/1412067333/',
    ],
  )
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Nestle')
  assert.equal(jobs[0].source, 'nestle')
  assert.equal(jobs[0].department, 'Procurement')
  assert.equal(
    jobs[0].link,
    'https://jobdetails.nestle.com/talentcommunity/apply/1412067333/?locale=en_US',
  )
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
