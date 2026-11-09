import assert from 'node:assert/strict'
import test from 'node:test'

const loadRuckusModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Ruckus Networks scraper module at ./script.js')
  }
}

const searchPage1Html = `
<div class="job-tile-result-container" role="region" aria-label="Search results for &quot;&quot;.">
  <span id="tile-search-results-label">Showing 1 to 25 of 26 Jobs</span>
  <ul id="job-tile-list" class="container job-list" data-record-returned="25">
    <li class="job-tile job-id-1403946900 job-row-index-23" data-url="/job/Noida-Partner-Account-Manager-NCR/1403946900/" data-row-index="23">
      <div class="job-tile-cell">
        <div class="tiletitle">
          <a class="jobTitle-link" href="/job/Noida-Partner-Account-Manager-NCR/1403946900/">Partner Account Manager</a>
        </div>
        <div id="job-1403946900-desktop-section-customfield1"><span>Req ID</span><div>81838</div></div>
        <div id="job-1403946900-desktop-section-date"><span>Date</span><div>Jun 29, 2026</div></div>
        <div id="job-1403946900-desktop-section-location"><span>Location</span><div>Noida, NCR, India</div></div>
        <div id="job-1403946900-desktop-section-dept"><span>Department</span><div>Sales</div></div>
      </div>
    </li>
    <li class="job-tile job-id-1390864900 job-row-index-24" data-url="/job/Virtual-Senior-Systems-Engineer-Sao-01000/1390864900/" data-row-index="24">
      <div class="job-tile-cell">
        <div class="tiletitle">
          <a class="jobTitle-link" href="/job/Virtual-Senior-Systems-Engineer-Sao-01000/1390864900/">Senior Systems Engineer</a>
        </div>
        <div id="job-1390864900-desktop-section-customfield1"><span>Req ID</span><div>90001</div></div>
        <div id="job-1390864900-desktop-section-date"><span>Date</span><div>Jul 10, 2026</div></div>
        <div id="job-1390864900-desktop-section-location"><span>Location</span><div>Virtual, Sao Paulo, Brazil, 01000</div></div>
        <div id="job-1390864900-desktop-section-dept"><span>Department</span><div>Engineering</div></div>
      </div>
    </li>
  </ul>
</div>
`

const searchPage2Html = `
<li class="job-tile job-id-1403551500 job-row-index-26" data-url="/job/Bangalore-Sourcing-Analyst-Indirect-Procurement-Karn/1403551500/" data-row-index="26">
  <div class="job-tile-cell">
    <div class="tiletitle">
      <a class="jobTitle-link" href="/job/Bangalore-Sourcing-Analyst-Indirect-Procurement-Karn/1403551500/">Sourcing Analyst, Indirect Procurement</a>
    </div>
    <div id="job-1403551500-desktop-section-customfield1"><span>Req ID</span><div>81899</div></div>
    <div id="job-1403551500-desktop-section-date"><span>Date</span><div>Jul 03, 2026</div></div>
    <div id="job-1403551500-desktop-section-location"><span>Location</span><div>Bangalore, Karn, India</div></div>
    <div id="job-1403551500-desktop-section-dept"><span>Department</span><div>Supply Chain</div></div>
  </div>
</li>
`

const noidaDetailHtml = `
<html>
  <head>
    <meta itemprop="datePosted" content="Mon Jun 29 00:00:00 UTC 2026">
    <meta itemprop="validThrough" content="Fri Jul 17 18:30:00 UTC 2026">
  </head>
  <body>
    <span itemprop="title">Partner Account Manager</span>
    <div class="joblayouttoken">
      <span class="joblayouttoken-label">Req ID:</span>
      <span data-careersite-propertyid="customfield1">81838</span>
    </div>
    <span data-careersite-propertyid="location">
      <p id="job-location" class="jobLocation job-location-inline">
        <span class="jobGeoLocation">Noida, NCR, India</span>
      </p>
    </span>
    <span itemprop="description">
      <span class="jobdescription">
        <p>In our always on world, we believe it is essential to have a genuine connection with the work you do.</p>
        <p>Ruckus Networks is looking to add a <strong>Sales Manager</strong> based in the Noida or Mumbai, India.</p>
        <ul>
          <li>Own the sales go-to-market strategy</li>
          <li>Work with channel partners</li>
        </ul>
      </span>
    </span>
    <a class="btn apply dialogApplyBtn" href="/talentcommunity/apply/1403946900/?locale=en_US">Apply now</a>
  </body>
</html>
`

const bangaloreDetailHtml = `
<html>
  <head>
    <meta itemprop="datePosted" content="Thu Jul 03 00:00:00 UTC 2026">
  </head>
  <body>
    <span itemprop="title">Sourcing Analyst, Indirect Procurement</span>
    <div class="joblayouttoken">
      <span class="joblayouttoken-label">Req ID:</span>
      <span data-careersite-propertyid="customfield1">81899</span>
    </div>
    <span data-careersite-propertyid="location">
      <span class="jobGeoLocation">Bangalore, Karn, India</span>
    </span>
    <span itemprop="description">
      <span class="jobdescription">
        <p>Drive sourcing execution for indirect procurement.</p>
      </span>
    </span>
    <a class="btn apply dialogApplyBtn" href="/talentcommunity/apply/1403551500/?locale=en_US">Apply now</a>
  </body>
</html>
`

test('Ruckus Networks scraper extracts India jobs from the official RUCKUS category page and follows the first-party more-results endpoint', async () => {
  const {
    CAREER_PAGE_URL,
    MORE_RESULTS_API_PATH,
    buildMoreResultsUrl,
    createRuckusNetworksScraper,
    extractJobDetail,
    extractSearchResults,
    extractTotalJobs,
  } = await loadRuckusModule()

  assert.equal(CAREER_PAGE_URL, 'https://jobs.vistancenetworks.com/go/RUCKUS-Jobs/9892600/')
  assert.equal(MORE_RESULTS_API_PATH, 'tile-search-results/category/9892600')
  assert.equal(
    buildMoreResultsUrl(25),
    'https://jobs.vistancenetworks.com/tile-search-results/category/9892600/?startrow=25',
  )

  assert.equal(extractTotalJobs(searchPage1Html), 26)
  assert.deepEqual(extractSearchResults(searchPage1Html), [{
    title: 'Partner Account Manager',
    location: 'Noida, NCR, India',
    city: 'Noida',
    jobId: '1403946900',
    requisitionId: '81838',
    department: 'Sales',
    postingDate: '2026-06-29',
    sourceUrl: 'https://jobs.vistancenetworks.com/job/Noida-Partner-Account-Manager-NCR/1403946900/',
    applyUrl: 'https://jobs.vistancenetworks.com/job/Noida-Partner-Account-Manager-NCR/1403946900/',
  }])

  assert.deepEqual(extractSearchResults(searchPage2Html), [{
    title: 'Sourcing Analyst, Indirect Procurement',
    location: 'Bangalore, Karn, India',
    city: 'Bangalore',
    jobId: '1403551500',
    requisitionId: '81899',
    department: 'Supply Chain',
    postingDate: '2026-07-03',
    sourceUrl: 'https://jobs.vistancenetworks.com/job/Bangalore-Sourcing-Analyst-Indirect-Procurement-Karn/1403551500/',
    applyUrl: 'https://jobs.vistancenetworks.com/job/Bangalore-Sourcing-Analyst-Indirect-Procurement-Karn/1403551500/',
  }])

  assert.deepEqual(extractJobDetail(noidaDetailHtml, extractSearchResults(searchPage1Html)[0]), {
    title: 'Partner Account Manager',
    location: 'Noida, NCR, India',
    city: 'Noida',
    country: 'India',
    jobId: '1403946900',
    requisitionId: '81838',
    department: 'Sales',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Own the sales go-to-market strategy',
      'Work with channel partners',
    ],
    postingDate: '2026-06-29',
    closingDate: '2026-07-17',
    jobDescription: 'In our always on world, we believe it is essential to have a genuine connection with the work you do. Ruckus Networks is looking to add a Sales Manager based in the Noida or Mumbai, India. - Own the sales go-to-market strategy - Work with channel partners',
    sourceUrl: 'https://jobs.vistancenetworks.com/job/Noida-Partner-Account-Manager-NCR/1403946900/',
    applyUrl: 'https://jobs.vistancenetworks.com/talentcommunity/apply/1403946900/?locale=en_US',
  })

  const requestedUrls = []
  const jobs = await createRuckusNetworksScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === CAREER_PAGE_URL) return searchPage1Html
      if (url === buildMoreResultsUrl(25)) return searchPage2Html
      if (url === 'https://jobs.vistancenetworks.com/job/Noida-Partner-Account-Manager-NCR/1403946900/') return noidaDetailHtml
      if (url === 'https://jobs.vistancenetworks.com/job/Bangalore-Sourcing-Analyst-Indirect-Procurement-Karn/1403551500/') return bangaloreDetailHtml
      throw new Error(`Unexpected Ruckus URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    CAREER_PAGE_URL,
    buildMoreResultsUrl(25),
    'https://jobs.vistancenetworks.com/job/Noida-Partner-Account-Manager-NCR/1403946900/',
    'https://jobs.vistancenetworks.com/job/Bangalore-Sourcing-Analyst-Indirect-Procurement-Karn/1403551500/',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].company, 'Ruckus Networks')
  assert.equal(jobs[0].source, 'ruckusnetworks')
  assert.equal(jobs[0].link, 'https://jobs.vistancenetworks.com/talentcommunity/apply/1403946900/?locale=en_US')
  assert.equal(jobs[1].jobId, '1403551500')
})
