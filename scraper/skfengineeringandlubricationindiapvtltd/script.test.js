import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_HOME_URL,
  COMPANY,
  SEARCH_URL,
  SOURCE,
  buildSearchUrl,
  createSkfEngineeringAndLubricationIndiaScraper,
  extractJobDetail,
  extractResultsSummary,
  extractSearchResults,
  hasOfficialCareerHomeSignal,
  hasOfficialSearchResultsSignal,
  isIndiaLocation,
} from './script.js'

const careerHomeHtml = `
  <html>
    <head>
      <title>SKF Jobs</title>
      <meta name="title" content="SKF Jobs" />
    </head>
    <body>
      <script>
        var translations = {
          "en_GB": {
            "title": "Welcome to SKF job postings!"
          }
        }
      </script>
      <a href="https://www.skf.com/group/career/why-work-at-skf" title="Why work at SKF" target="_blank">Why work at SKF</a>
      <p>
        See job postings in
        <strong>
          <a
            href="https://career.skf.com/search/?createNewAlert=false&amp;amp;q=&amp;amp;optionsFacetsDD_location=&amp;amp;optionsFacetsDD_country=&amp;amp;optionsFacetsDD_customfield2=&amp;amp;optionsFacetsDD_department="
            target="_blank"
            title="Asia, Europe, Australia and Americas"
          >Asia, Europe, Australia and Americas</a>
        </strong>.
      </p>
      <a href="https://career.skf.com/search/">Follow this link to reach our Job Search page to search for available jobs in a more accessible format.</a>
    </body>
  </html>
`

const searchPageOneHtml = `
  <html>
    <head>
      <title>SKF Jobs</title>
    </head>
    <body>
      <h1>Welcome to SKF job postings!</h1>
      <h2>Search results for "".</h2>
      <div class="pagination-label-row">
        <span class="paginationLabel" aria-label="Results 1 – 15">Results <b>1 – 15</b> of <b>17</b></span>
        <span class="srHelp" style="font-size:0px">Page 1 of 2</span>
      </div>
      <table>
        <tr class="data-row">
          <td class="colTitle" headers="hdrTitle">
            <span class="jobTitle hidden-phone">
              <a href="/job/Pune-Manufacturing-Quality-Engineer/1393964733/" class="jobTitle-link">Manufacturing Quality Engineer</a>
            </span>
            <div class="jobdetail-phone visible-phone">
              <span class="jobLocation visible-phone"><span class="jobLocation"> Pune, IN </span></span>
              <span class="jobDate visible-phone">12 Jul 2026 </span>
            </div>
          </td>
          <td class="colDepartment hidden-phone" headers="hdrDepartment"><span class="jobDepartment">Quality</span></td>
          <td class="colLocation hidden-phone" headers="hdrLocation"><span class="jobLocation"> Pune, IN </span></td>
          <td class="colDate hidden-phone" headers="hdrDate"><span class="jobDate">12 Jul 2026 </span></td>
        </tr>
        <tr class="data-row">
          <td class="colTitle" headers="hdrTitle">
            <span class="jobTitle hidden-phone">
              <a href="/job/Berlin-Business-Line-Manager-Power-transmission/1413663033/" class="jobTitle-link">Business Line Manager - Power transmission</a>
            </span>
            <div class="jobdetail-phone visible-phone">
              <span class="jobLocation visible-phone"><span class="jobLocation"> Berlin, DE </span></span>
              <span class="jobDate visible-phone">10 Jul 2026 </span>
            </div>
          </td>
          <td class="colDepartment hidden-phone" headers="hdrDepartment"><span class="jobDepartment">Engineering &amp; Technology</span></td>
          <td class="colLocation hidden-phone" headers="hdrLocation"><span class="jobLocation"> Berlin, DE </span></td>
          <td class="colDate hidden-phone" headers="hdrDate"><span class="jobDate">10 Jul 2026 </span></td>
        </tr>
      </table>
    </body>
  </html>
`

const searchPageTwoHtml = `
  <html>
    <head>
      <title>SKF Jobs</title>
    </head>
    <body>
      <h1>Welcome to SKF job postings!</h1>
      <h2>Search results for "".</h2>
      <div class="pagination-label-row">
        <span class="paginationLabel" aria-label="Results 16 – 17">Results <b>16 – 17</b> of <b>17</b></span>
        <span class="srHelp" style="font-size:0px">Page 2 of 2</span>
      </div>
      <table>
        <tr class="data-row">
          <td class="colTitle" headers="hdrTitle">
            <span class="jobTitle hidden-phone">
              <a href="/job/Bengaluru-Product-Owner-Design-Automation/1393716433/" class="jobTitle-link">Product Owner - Design Automation</a>
            </span>
            <div class="jobdetail-phone visible-phone">
              <span class="jobLocation visible-phone"><span class="jobLocation"> Bengaluru, IN </span></span>
              <span class="jobDate visible-phone">11 Jul 2026 </span>
            </div>
          </td>
          <td class="colDepartment hidden-phone" headers="hdrDepartment"><span class="jobDepartment">Engineering &amp; Technology</span></td>
          <td class="colLocation hidden-phone" headers="hdrLocation"><span class="jobLocation"> Bengaluru, IN </span></td>
          <td class="colDate hidden-phone" headers="hdrDate"><span class="jobDate">11 Jul 2026 </span></td>
        </tr>
      </table>
    </body>
  </html>
`

const manufacturingQualityEngineerHtml = `
  <html>
    <head>
      <title>Manufacturing Quality Engineer Job Details | SKF</title>
      <meta name="keywords" content="Pune Manufacturing Quality Engineer" />
      <meta name="description" content="Pune Manufacturing Quality Engineer" />
      <link rel="canonical" href="https://career.skf.com/job/Pune-Manufacturing-Quality-Engineer/1393964733/" />
    </head>
    <body>
      <div class="jobDisplayShell" itemscope="itemscope" itemtype="http://schema.org/JobPosting">
        <span itemprop="jobLocation" itemscope itemtype="http://schema.org/Place">
          <span itemprop="address" itemscope itemtype="http://schema.org/PostalAddress">
            <meta itemprop="streetAddress" content="Pune, IN">
          </span>
        </span>
        <meta itemprop="datePosted" content="Sun Jul 12 02:01:00 UTC 2026">
        <meta itemprop="hiringOrganization" content="SKF">
        <div class="jobTitle">
          <h1><span itemprop="title" data-careersite-propertyid="title" class="rtltextaligneligible">Manufacturing Quality Engineer</span></h1>
        </div>
        <p id="job-location" class="jobLocation job-location-inline">
          <span class="jobGeoLocation">Pune, IN </span>
        </p>
        <span itemprop="description" data-careersite-propertyid="description" class="rtltextaligneligible">
          <span class="jobdescription">
            <p><strong>About SKF</strong></p>
            <p>Lead quality improvements across the plant.</p>
            <ul>
              <li>Lead audits</li>
              <li>Improve CAPA workflows</li>
            </ul>
          </span>
        </span>
        <a class="btn btn-primary btn-large btn-lg apply dialogApplyBtn " href="/talentcommunity/apply/1393964733/?locale=en_GB">Apply now »</a>
      </div>
    </body>
  </html>
`

const productOwnerHtml = `
  <html>
    <head>
      <title>Product Owner - Design Automation Job Details | SKF</title>
      <meta name="description" content="Bengaluru Product Owner - Design Automation" />
      <link rel="canonical" href="https://career.skf.com/job/Bengaluru-Product-Owner-Design-Automation/1393716433/" />
    </head>
    <body>
      <div class="jobDisplayShell" itemscope="itemscope" itemtype="http://schema.org/JobPosting">
        <span itemprop="jobLocation" itemscope itemtype="http://schema.org/Place">
          <span itemprop="address" itemscope itemtype="http://schema.org/PostalAddress">
            <meta itemprop="streetAddress" content="Bengaluru, IN">
          </span>
        </span>
        <meta itemprop="datePosted" content="Sat Jul 11 02:01:00 UTC 2026">
        <div class="jobTitle">
          <h1><span itemprop="title">Product Owner - Design Automation</span></h1>
        </div>
        <p id="job-location" class="jobLocation job-location-inline">
          <span class="jobGeoLocation">Bengaluru, IN </span>
        </p>
        <span itemprop="description" class="rtltextaligneligible">
          <span class="jobdescription">
            <p><strong>About SKF</strong></p>
            <p>Own the design automation roadmap.</p>
            <ul>
              <li>Documented leadership and communication skills</li>
              <li>Strong problem-solving skills and attention to detail</li>
            </ul>
          </span>
        </span>
        <a class="btn btn-primary btn-large btn-lg apply dialogApplyBtn " href="/talentcommunity/apply/1393716433/?locale=en_GB">Apply now »</a>
      </div>
    </body>
  </html>
`

test('SKF board helpers stay pinned to the verified official jobs home and paginated search markup', () => {
  assert.equal(SOURCE, 'skfengineeringandlubricationindiapvtltd')
  assert.equal(COMPANY, 'SKF Engineering and Lubrication India Pvt Ltd')
  assert.equal(CAREER_HOME_URL, 'https://career.skf.com/')
  assert.equal(SEARCH_URL, 'https://career.skf.com/search/?q=&sortColumn=referencedate&sortDirection=desc')
  assert.equal(buildSearchUrl(), SEARCH_URL)
  assert.equal(buildSearchUrl(15), 'https://career.skf.com/search/?q=&sortColumn=referencedate&sortDirection=desc&startrow=15')
  assert.equal(hasOfficialCareerHomeSignal(careerHomeHtml), true)
  assert.equal(hasOfficialSearchResultsSignal(searchPageOneHtml), true)
  assert.equal(isIndiaLocation('Pune, IN'), true)
  assert.equal(isIndiaLocation('Bengaluru, IN'), true)
  assert.equal(isIndiaLocation('Berlin, DE'), false)
  assert.deepEqual(extractResultsSummary(searchPageOneHtml), {
    totalResults: 17,
    currentPage: 1,
    totalPages: 2,
    pageSize: 15,
  })
  assert.deepEqual(extractSearchResults(searchPageOneHtml), [
    {
      title: 'Manufacturing Quality Engineer',
      department: 'Quality',
      location: 'Pune, IN',
      city: 'Pune',
      country: 'India',
      jobId: '1393964733',
      requisitionId: '1393964733',
      sourceUrl: 'https://career.skf.com/job/Pune-Manufacturing-Quality-Engineer/1393964733/',
      postingDate: '2026-07-12',
    },
    {
      title: 'Business Line Manager - Power transmission',
      department: 'Engineering & Technology',
      location: 'Berlin, DE',
      city: 'Berlin',
      country: 'DE',
      jobId: '1413663033',
      requisitionId: '1413663033',
      sourceUrl: 'https://career.skf.com/job/Berlin-Business-Line-Manager-Power-transmission/1413663033/',
      postingDate: '2026-07-10',
    },
  ])
})

test('extractJobDetail reads official SKF detail pages and keeps stable apply links', () => {
  assert.deepEqual(
    extractJobDetail(manufacturingQualityEngineerHtml, {
      title: 'Manufacturing Quality Engineer',
      department: 'Quality',
      location: 'Pune, IN',
      city: 'Pune',
      country: 'India',
      jobId: '1393964733',
      requisitionId: '1393964733',
      sourceUrl: 'https://career.skf.com/job/Pune-Manufacturing-Quality-Engineer/1393964733/',
      postingDate: '2026-07-12',
    }),
    {
      title: 'Manufacturing Quality Engineer',
      department: 'Quality',
      location: 'Pune, IN',
      city: 'Pune',
      country: 'India',
      jobId: '1393964733',
      requisitionId: '1393964733',
      employmentType: null,
      jobDescription: 'About SKF Lead quality improvements across the plant. Lead audits Improve CAPA workflows',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Lead audits', 'Improve CAPA workflows'],
      postingDate: '2026-07-12',
      closingDate: null,
      applyUrl: 'https://career.skf.com/talentcommunity/apply/1393964733/?locale=en_GB',
      sourceUrl: 'https://career.skf.com/job/Pune-Manufacturing-Quality-Engineer/1393964733/',
    },
  )
})

test('run scrapes only India jobs from the official SKF board and decorates them for Jobverify', async () => {
  const requestedUrls = []
  const scraper = createSkfEngineeringAndLubricationIndiaScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === CAREER_HOME_URL) return careerHomeHtml
      if (url === SEARCH_URL) return searchPageOneHtml
      if (url === buildSearchUrl(15)) return searchPageTwoHtml
      if (url === 'https://career.skf.com/job/Pune-Manufacturing-Quality-Engineer/1393964733/') {
        return manufacturingQualityEngineerHtml
      }
      if (url === 'https://career.skf.com/job/Bengaluru-Product-Owner-Design-Automation/1393716433/') {
        return productOwnerHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-13T10:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    CAREER_HOME_URL,
    SEARCH_URL,
    'https://career.skf.com/job/Pune-Manufacturing-Quality-Engineer/1393964733/',
    buildSearchUrl(15),
    'https://career.skf.com/job/Bengaluru-Product-Owner-Design-Automation/1393716433/',
  ])

  assert.deepEqual(jobs, [
    {
      jobId: '1393964733',
      requisitionId: '1393964733',
      title: 'Manufacturing Quality Engineer',
      company: 'SKF Engineering and Lubrication India Pvt Ltd',
      department: 'Quality',
      location: 'Pune, IN',
      city: 'Pune',
      country: 'India',
      link: 'https://career.skf.com/talentcommunity/apply/1393964733/?locale=en_GB',
      applyUrl: 'https://career.skf.com/talentcommunity/apply/1393964733/?locale=en_GB',
      sourceUrl: 'https://career.skf.com/job/Pune-Manufacturing-Quality-Engineer/1393964733/',
      source: 'skfengineeringandlubricationindiapvtltd',
      employmentType: null,
      jobDescription: 'About SKF Lead quality improvements across the plant. Lead audits Improve CAPA workflows',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Lead audits', 'Improve CAPA workflows'],
      postingDate: '2026-07-12',
      closingDate: null,
      scrapedAt: '2026-07-13T10:00:00.000Z',
    },
    {
      jobId: '1393716433',
      requisitionId: '1393716433',
      title: 'Product Owner - Design Automation',
      company: 'SKF Engineering and Lubrication India Pvt Ltd',
      department: 'Engineering & Technology',
      location: 'Bengaluru, IN',
      city: 'Bengaluru',
      country: 'India',
      link: 'https://career.skf.com/talentcommunity/apply/1393716433/?locale=en_GB',
      applyUrl: 'https://career.skf.com/talentcommunity/apply/1393716433/?locale=en_GB',
      sourceUrl: 'https://career.skf.com/job/Bengaluru-Product-Owner-Design-Automation/1393716433/',
      source: 'skfengineeringandlubricationindiapvtltd',
      employmentType: null,
      jobDescription: 'About SKF Own the design automation roadmap. Documented leadership and communication skills Strong problem-solving skills and attention to detail',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [
        'Documented leadership and communication skills',
        'Strong problem-solving skills and attention to detail',
      ],
      postingDate: '2026-07-11',
      closingDate: null,
      scrapedAt: '2026-07-13T10:00:00.000Z',
    },
  ])
})

test('run fails closed when the verified SKF jobs surfaces drift', async () => {
  await assert.rejects(
    createSkfEngineeringAndLubricationIndiaScraper().run({
      fetchText: async (url) => {
        if (url === CAREER_HOME_URL) return '<html><head><title>Home</title></head><body>No jobs</body></html>'
        return searchPageOneHtml
      },
    }),
    /SKF jobs home no longer matches the verified official first-party surface/,
  )

  await assert.rejects(
    createSkfEngineeringAndLubricationIndiaScraper().run({
      fetchText: async (url) => {
        if (url === CAREER_HOME_URL) return careerHomeHtml
        return '<html><head><title>SKF Jobs</title></head><body>Coming soon</body></html>'
      },
    }),
    /SKF jobs search page no longer matches the verified public listings surface/,
  )
})
