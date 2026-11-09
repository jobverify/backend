import assert from 'node:assert/strict'
import test from 'node:test'

const loadCariadModule = async () => {
  try {
    return await import('../../scraper/cariad/script.js')
  } catch {
    return null
  }
}

const searchHtml = `
<!doctype html>
<html>
  <body>
    <div class="pagination-label-row">
      <span class="paginationLabel" aria-label="Results 1 – 2">Results <b>1 – 2</b> of <b>2</b></span>
      <span class="srHelp" style="font-size:0px">Page 1 of 1</span>
    </div>
    <table id="searchresults">
      <tbody>
        <tr class="data-row">
          <td class="colTitle">
            <span class="jobTitle hidden-phone">
              <a href="/cariad/job/Bengaluru-Software-Engineer-560001/1400000000/" class="jobTitle-link">Software Engineer</a>
            </span>
          </td>
          <td class="colFacility"><span class="jobFacility">CARIAD SE</span></td>
          <td class="colDepartment"><span class="jobDepartment">Engineering</span></td>
          <td class="colLocation"><span class="jobLocation">Bengaluru, IN, 560001</span></td>
          <td class="colDate"><span class="jobDate">Jul 1, 2026</span></td>
        </tr>
        <tr class="data-row">
          <td class="colTitle">
            <span class="jobTitle hidden-phone">
              <a href="/cariad/job/Berlin-Platform-Engineer-10587/1400000001/" class="jobTitle-link">Platform Engineer</a>
            </span>
          </td>
          <td class="colFacility"><span class="jobFacility">CARIAD SE</span></td>
          <td class="colDepartment"><span class="jobDepartment">Engineering</span></td>
          <td class="colLocation"><span class="jobLocation">Berlin, DE, 10587</span></td>
          <td class="colDate"><span class="jobDate">Jul 2, 2026</span></td>
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
          <meta itemprop="streetAddress" content="Bengaluru, IN, 560001">
        </span>
      </span>
      <meta itemprop="datePosted" content="Tue Jul 01 00:00:00 UTC 2026">
      <div class="applylink pull-right">
        <a class="btn btn-primary btn-large btn-lg apply dialogApplyBtn " href="/talentcommunity/apply/1400000000/?locale=en_US">Apply now »</a>
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
      <span itemprop="description" data-careersite-propertyid="description" class="rtltextaligneligible">
        <span class="jobdescription">
          <p>Build connected vehicle platforms for CARIAD India.</p>
          <ul>
            <li>Design backend services.</li>
            <li>Collaborate with product teams.</li>
          </ul>
        </span>
      </span>
    </div>
  </body>
</html>
`

test('parsed CARIAD rows retain both countries and never invent native requisitions from public IDs', async () => {
  const cariad = await loadCariadModule()
  assert.ok(cariad)

  const results = cariad.extractSearchResults(searchHtml)

  assert.equal(results.length, 2)
  assert.deepEqual(results[0], {
    title: 'Software Engineer',
    department: 'Engineering',
    location: 'Bengaluru, IN, 560001',
    city: 'Bengaluru',
    jobId: '1400000000',
    requisitionId: null,
    sourceUrl: 'https://jobs.volkswagen-group.com/cariad/job/Bengaluru-Software-Engineer-560001/1400000000/',
    postingDate: 'Jul 1, 2026',
  })
})

test('extractJobDetail maps CARIAD SuccessFactors detail pages into shared scraper fields', async () => {
  const cariad = await loadCariadModule()
  assert.ok(cariad)

  const detail = cariad.extractJobDetail(detailHtml, {
    title: 'Software Engineer',
    department: 'Engineering',
    location: 'Bengaluru, IN, 560001',
    city: 'Bengaluru',
    jobId: '1400000000',
    requisitionId: '1400000000',
    sourceUrl: 'https://jobs.volkswagen-group.com/cariad/job/Bengaluru-Software-Engineer-560001/1400000000/',
    postingDate: 'Jul 1, 2026',
  })

  assert.deepEqual(detail, {
    title: 'Software Engineer',
    location: 'Bengaluru, IN, 560001',
    city: 'Bengaluru',
    jobId: '1400000000',
    requisitionId: null,
    employmentType: null,
    experienceRequired: null,
    jobDescription: 'Build connected vehicle platforms for CARIAD India. - Design backend services. - Collaborate with product teams.',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Design backend services.',
      'Collaborate with product teams.',
    ],
    postingDate: 'Tue Jul 01 00:00:00 UTC 2026',
    closingDate: null,
    applyUrl: 'https://jobs.volkswagen-group.com/talentcommunity/apply/1400000000/?locale=en_US',
    sourceUrl: 'https://jobs.volkswagen-group.com/cariad/job/Bengaluru-Software-Engineer-560001/1400000000/',
  })
})

test('CARIAD native execution refuses parsed-only legacy transport instead of claiming current original HTTP proof', async () => {
  const cariad = await loadCariadModule()
  assert.ok(cariad)
  await assert.rejects(cariad.createCariadScraper().run({fetchText: async () => searchHtml}), /original|fetchPage/i)
})
