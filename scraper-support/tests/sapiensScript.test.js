import assert from 'node:assert/strict'
import test from 'node:test'

const loadSapiensModule = async () => {
  try {
    return await import('../../scraper/sapiens/script.js')
  } catch {
    assert.fail('Expected Sapiens scraper module at ../../scraper/sapiens/script.js')
  }
}

const searchPageHtml = `
<div class="searchResultsShell">
  <table id="searchresults" class="searchResults full table table-striped table-hover" aria-label="Search results for . Page 1 of 6, Results 1 to 15 of 90">
    <tbody>
      <tr class="data-row">
        <td class="colTitle" headers="hdrTitle">
          <span class="jobTitle hidden-phone">
            <a href="/job/Bangalore-L3-Architect/1413083733/" class="jobTitle-link">L3 Architect</a>
          </span>
        </td>
        <td class="colFacility hidden-phone" headers="hdrFacility">
          <span class="jobFacility">56618</span>
        </td>
        <td class="colLocation hidden-phone" headers="hdrLocation">
          <span class="jobLocation">Bangalore, IN</span>
        </td>
      </tr>
      <tr class="data-row">
        <td class="colTitle" headers="hdrTitle">
          <span class="jobTitle hidden-phone">
            <a href="/job/London-Business-Consultant/1402831533/" class="jobTitle-link">Business Consultant</a>
          </span>
        </td>
        <td class="colFacility hidden-phone" headers="hdrFacility">
          <span class="jobFacility">56538</span>
        </td>
        <td class="colLocation hidden-phone" headers="hdrLocation">
          <span class="jobLocation">London, GB</span>
        </td>
      </tr>
    </tbody>
  </table>
</div>
`

const detailPageHtml = `
<html>
  <head>
    <title>L3 Architect Job Details | SAPIENS</title>
    <meta itemprop="datePosted" content="Thu Jul 09 00:00:00 UTC 2026" />
  </head>
  <body>
    <h1>L3 Architect</h1>
    <p id="job-location">
      <span class="jobGeoLocation">Bangalore, IN</span>
    </p>
    <span data-careersite-propertyid="facility">56618</span>
    <div class="jobdescription">
      <p>Lead architecture for insurance platform modernization.</p>
      <ul>
        <li>Design scalable systems</li>
        <li>Partner with engineering teams</li>
      </ul>
    </div>
    <script type="text/javascript">
      j2w.Apply.init({
        jobID                    : 1413083733,
        sourceId                 : 'JATS-SapiensPRD',
        locale                   : 'en_US'
      });
    </script>
  </body>
</html>
`

const genericHeadingDetailPageHtml = `
<html>
  <head>
    <title>Senior Developer - R&amp;D Job Details | SAPIENS</title>
    <meta property="og:title" content="Senior Developer - R&amp;D" />
    <meta name="description" content="Bangalore Senior Developer - R&amp;D" />
  </head>
  <body>
    <h1>Your Journey Starts Here</h1>
    <span data-careersite-propertyid="title" class="rtltextaligneligible">Senior Developer - R&amp;D</span>
    <span class="jobGeoLocation">Bangalore, IN</span>
    <span data-careersite-propertyid="facility">56528</span>
    <div class="joblayouttoken">
      <div class="inner">
        Explore Your Next Role at Sapiens
        Senior Developer - R&amp;D
        Req ID: 56528
        Location: Bangalore, IN
        Sapiens is on the lookout for a Senior Java developer to become a key player in our Bangalore team.
        If you're ready to take your career to new heights, this role could be the perfect fit.
      </div>
    </div>
    <script type="text/javascript">
      j2w.Apply.init({
        jobID                    : 1400779733,
        sourceId                 : 'JATS-SapiensPRD',
        locale                   : 'en_US'
      });
    </script>
  </body>
</html>
`

test('buildSearchUrl keeps Sapiens requests on the official public SuccessFactors search route', async () => {
  const {
    SEARCH_PAGE_URL,
    buildSearchUrl,
  } = await loadSapiensModule()

  assert.equal(
    SEARCH_PAGE_URL,
    'https://careers.sapiens.com/search/?createNewAlert=false&q=&locationsearch=',
  )
  assert.equal(
    buildSearchUrl(),
    'https://careers.sapiens.com/search/?createNewAlert=false&q=&locationsearch=',
  )
  assert.equal(
    buildSearchUrl({ startRow: 15 }),
    'https://careers.sapiens.com/search/?createNewAlert=false&q=&locationsearch=&startrow=15',
  )
})

test('extractSearchResults keeps only India rows from the official Sapiens search table', async () => {
  const { extractSearchResults } = await loadSapiensModule()

  assert.deepEqual(extractSearchResults(searchPageHtml), [{
    title: 'L3 Architect',
    location: 'Bangalore, India',
    city: 'Bangalore',
    jobId: '56618',
    requisitionId: '56618',
    sourceUrl: 'https://careers.sapiens.com/job/Bangalore-L3-Architect/1413083733/',
    detailJobId: '1413083733',
  }])
})

test('extractPaginationSummary reads Sapiens result counts from the public search page', async () => {
  const { extractPaginationSummary } = await loadSapiensModule()

  assert.deepEqual(extractPaginationSummary(searchPageHtml), {
    currentPage: 1,
    totalPages: 6,
    totalJobCount: 90,
    pageSize: 15,
  })
})

test('extractJobDetail builds the public Sapiens apply handoff from the detail job id', async () => {
  const {
    buildApplyUrl,
    extractJobDetail,
  } = await loadSapiensModule()

  assert.equal(
    buildApplyUrl('1413083733'),
    'https://careers.sapiens.com/talentcommunity/apply/1413083733/?locale=en_US',
  )

  assert.deepEqual(
    extractJobDetail(detailPageHtml, {
      title: 'L3 Architect',
      location: 'Bangalore, India',
      city: 'Bangalore',
      jobId: '56618',
      requisitionId: '56618',
      sourceUrl: 'https://careers.sapiens.com/job/Bangalore-L3-Architect/1413083733/',
      detailJobId: '1413083733',
    }),
    {
      title: 'L3 Architect',
      location: 'Bangalore, India',
      city: 'Bangalore',
      jobId: '56618',
      requisitionId: '56618',
      employmentType: null,
      experienceRequired: null,
      jobDescription:
        'Lead architecture for insurance platform modernization. Design scalable systems Partner with engineering teams',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [
        'Design scalable systems',
        'Partner with engineering teams',
      ],
      postingDate: '2026-07-09',
      closingDate: null,
      applyUrl: 'https://careers.sapiens.com/talentcommunity/apply/1413083733/?locale=en_US',
      sourceUrl: 'https://careers.sapiens.com/job/Bangalore-L3-Architect/1413083733/',
      department: null,
      publicExperienceChecked: true,
    },
  )
})

test('extractJobDetail prefers Sapiens embedded title metadata when the visible heading is generic', async () => {
  const { extractJobDetail } = await loadSapiensModule()

  const detail = extractJobDetail(genericHeadingDetailPageHtml, {
    title: 'Senior Developer - R&D',
    location: 'Bangalore, India',
    city: 'Bangalore',
    jobId: '56528',
    requisitionId: '56528',
    sourceUrl: 'https://careers.sapiens.com/job/Bangalore-Senior-Developer-R&D/1400779733/',
    detailJobId: '1400779733',
  })

  assert.equal(detail.title, 'Senior Developer - R&D')
  assert.equal(detail.applyUrl, 'https://careers.sapiens.com/talentcommunity/apply/1400779733/?locale=en_US')
  assert.equal(detail.publicExperienceChecked, true)
  assert.match(detail.jobDescription || '', /Sapiens is on the lookout/i)
})

test('current sapiens extraction requires transport response identity', async () => {
  const module = await import('../../scraper/sapiens/script.js')
  await assert.rejects(module.createSapiensScraper().run({ fetchText: async () => '' }), /transport requires fetchPage/)
  assert.equal(module.PROVIDER_METADATA.atsPlatform, 'hibob')
  assert.equal(module.PROVIDER_METADATA.countryFilter, 'India')
})
