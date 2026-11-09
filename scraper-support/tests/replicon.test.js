import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/replicon/script.js')

const loadCatalog = async () => {
  try {
    return await import('../../scraper/replicon/catalog.js')
  } catch {
    assert.fail('Expected Replicon catalog module at ../../scraper/replicon/catalog.js')
  }
}

const loadScript = async () => {
  try {
    return await import('../../scraper/replicon/script.js')
  } catch {
    assert.fail('Expected Replicon scraper module at ../../scraper/replicon/script.js')
  }
}

const redirectedCareersPage = {
  status: 200,
  url: 'https://www.deltek.com/company/careers/',
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <title>Drive Your Career with #TeamDeltek | Search Jobs | Deltek</title>
      </head>
      <body>
        <h1>Drive Your Career with #TeamDeltek</h1>
        <p>Explore Deltek opportunities and Replicon product teams.</p>
        <a href="https://careers.deltek.com/">Search Jobs</a>
        <a href="https://careers.deltek.com/">Apply Now</a>
      </body>
    </html>
  `,
}

const deltekSearchPage = {
  status: 200,
  url: 'https://careers.deltek.com/',
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <title>Find Open Job Opportunities Near You</title>
      </head>
      <body>
        <script>
          var cws_opts = {
            "org":"companies\\/d78c5717-c840-461e-8f42-7e005f1a8068"
          };
        </script>
        <h1>Job Search Results</h1>
        <select>
          <option value="India">India (44)</option>
          <option value="United States">United States (30)</option>
        </select>
      </body>
    </html>
  `,
}

const firstPagePayload = {
  totalHits: 3,
  nextPageToken: 'next-page-token',
  searchResults: [
    {
      summary: {
        job_summary: 'Build AI-first platform experiences for Deltek teams.',
      },
      job: {
        id: 23644423,
        title: 'AI Solutions Engineer',
        ref: '11138BR',
        primary_city: 'Bengaluru',
        primary_state: 'Karnataka',
        primary_country: 'IN',
        primary_category: 'Engineering',
        location_type: 'Remote',
        url: 'https://careers.deltek.com/job/23644423/ai-solutions-engineer-remote/',
        seo_url: 'https://sjobs.brassring.com/TGnewUI/Search/home/HomeWithPreLoad?PageType=JobDetails&partnerid=25397&siteid=5259&jobid=623208&gqid=0&al=1',
        employment_type: 'Full-time',
        open_date: '2026-07-29T11:51:16',
        close_date: null,
        description: '<p>Build AI-first platform experiences for Deltek teams.</p>',
      },
    },
    {
      summary: {
        job_summary: 'Lead finance planning from Virginia.',
      },
      job: {
        id: 23555966,
        title: 'VP, Finance Planning & Analysis',
        ref: '11106BR',
        primary_city: 'Herndon',
        primary_state: 'VA',
        primary_country: 'US',
        primary_category: 'Finance',
        location_type: 'Remote',
        url: 'https://careers.deltek.com/job/23555966/vp-finance-planning-analysis-remote/',
        seo_url: 'https://sjobs.brassring.com/TGnewUI/Search/home/HomeWithPreLoad?PageType=JobDetails&partnerid=25397&siteid=5259&jobid=623137&gqid=0&al=1',
        employment_type: 'Full-time',
        open_date: '2026-07-01T14:15:01',
        close_date: null,
        description: '<p>Lead finance planning from Virginia.</p>',
      },
    },
  ],
}

const secondPagePayload = {
  totalHits: 3,
  nextPageToken: null,
  searchResults: [
    {
      summary: {
        job_summary: 'Own engineering quality for Bengaluru product teams.',
      },
      job: {
        id: 23606699,
        title: 'Principal Quality Assurance Engineer',
        ref: '11095BR',
        primary_city: 'Bengaluru',
        primary_state: 'Karnataka',
        primary_country: 'IN',
        primary_category: 'Engineering',
        location_type: 'Remote',
        employment_type: 'Full-time',
        open_date: '2026-07-27T10:23:05',
        close_date: null,
        google_locations: [
          {
            city: 'Bengaluru',
            state: 'KA',
            country: 'IN',
            address: 'Bengaluru, Karnataka, India',
          },
        ],
      },
    },
  ],
}

test('Replicon catalog records the verified Deltek handoff and public jobs API contract', async () => {
  const { REPLICON_CATALOG, default: defaultCatalog } = await loadCatalog()
  const provider = hydrateProviderCatalogEntry(REPLICON_CATALOG)
  const report = generateCompanyCoverageReport({
    csvText: 'Replicon\n',
    catalog: [provider],
  })

  assert.equal(defaultCatalog, REPLICON_CATALOG)
  assert.equal(provider.source, 'replicon')
  assert.equal(provider.companyName, 'Replicon')
  assert.equal(provider.officialBrandName, 'Replicon')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.replicon.com/company/careers/')
  assert.equal(provider.redirectCareersUrl, 'https://www.deltek.com/company/careers/')
  assert.equal(provider.genericSearchJobsUrl, 'https://careers.deltek.com/')
  assert.equal(provider.searchApiUrl, 'https://jobsapi-google.m-cloud.io/api/job/search')
  assert.equal(provider.searchApiCompanyName, 'companies/d78c5717-c840-461e-8f42-7e005f1a8068')
  assert.equal(provider.upstreamCompanyName, 'Deltek')
  assert.equal(provider.companyDomain, 'replicon.com')
  assert.equal(provider.atsPlatform, 'deltek-careers-google-jobs-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-replicon-redirect-plus-deltek-page-token-search-api')
  assert.equal(
    provider.extractionStrategy,
    'verified-replicon-careers-redirect+verified-deltek-search-page+discovered-companyname+jobsapi-google-search',
  )
  assert.equal(provider.verifiedOn, '2026-08-04')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /replicon[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /August 4, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /jobsapi-google\.m-cloud\.io/i)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('Replicon infers experience from public Deltek detail HTML when it is present', async () => {
  const replicon = await loadScript()

  assert.equal(
    replicon.inferExperienceFromDescription('<li>Prior customer service experience of 2+ years.</li>'),
    '2+ years',
  )
  assert.equal(
    replicon.inferExperienceFromDescription('<p>Hands-on experience architecting cloud AI systems.</p>'),
    null,
  )
})

test('Replicon discovers the Deltek jobs feed from the official redirect and paginates India jobs', async () => {
  const replicon = await loadScript()

  assert.equal(replicon.CAREERS_URL, 'https://www.replicon.com/company/careers/')
  assert.equal(replicon.REDIRECT_CAREERS_URL, 'https://www.deltek.com/company/careers/')
  assert.equal(replicon.SEARCH_PAGE_URL, 'https://careers.deltek.com/')
  assert.equal(replicon.SEARCH_API_URL, 'https://jobsapi-google.m-cloud.io/api/job/search')
  assert.equal(
    replicon.extractSearchJobsUrl(redirectedCareersPage.html),
    'https://careers.deltek.com/',
  )
  assert.equal(
    replicon.extractSearchApiCompanyName(deltekSearchPage.html),
    'companies/d78c5717-c840-461e-8f42-7e005f1a8068',
  )
  assert.equal(replicon.hasRedirectedDeltekCareersSignal(redirectedCareersPage), true)
  assert.equal(replicon.hasDeltekSearchPageSignal(deltekSearchPage), true)
  assert.equal(
    replicon.buildSearchUrl(),
    'https://jobsapi-google.m-cloud.io/api/job/search?CompanyName=companies%2Fd78c5717-c840-461e-8f42-7e005f1a8068&limit=20&sortfield=open_date&sortorder=descending',
  )

  const requestedPages = []
  const requestedJsonUrls = []
  const jobs = await replicon.createRepliconScraper().run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === replicon.CAREERS_URL) return redirectedCareersPage
      if (url === 'https://careers.deltek.com/') return deltekSearchPage

      throw new Error(`Unexpected Replicon page URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)

      if (requestedJsonUrls.length === 1) return firstPagePayload
      if (requestedJsonUrls.length === 2) return secondPagePayload

      throw new Error(`Unexpected Replicon API URL: ${url}`)
    },
    now: () => '2026-08-04T12:00:00.000Z',
  })

  assert.deepEqual(requestedPages, [
    'https://www.replicon.com/company/careers/',
    'https://careers.deltek.com/',
  ])
  assert.deepEqual(requestedJsonUrls, [
    'https://jobsapi-google.m-cloud.io/api/job/search?CompanyName=companies%2Fd78c5717-c840-461e-8f42-7e005f1a8068&limit=20&sortfield=open_date&sortorder=descending',
    'https://jobsapi-google.m-cloud.io/api/job/search?CompanyName=companies%2Fd78c5717-c840-461e-8f42-7e005f1a8068&limit=20&sortfield=open_date&sortorder=descending&pageToken=next-page-token',
  ])
  assert.deepEqual(jobs, [
    {
      title: 'AI Solutions Engineer',
      company: 'Replicon',
      department: 'Engineering',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      jobId: '23644423',
      requisitionId: '11138BR',
      sourceUrl: 'https://careers.deltek.com/job/23644423/ai-solutions-engineer-remote/',
      applyUrl: 'https://sjobs.brassring.com/TGnewUI/Search/home/HomeWithPreLoad?PageType=JobDetails&partnerid=25397&siteid=5259&jobid=623208&gqid=0&al=1',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-29T11:51:16',
      closingDate: null,
      jobDescription: '<p>Build AI-first platform experiences for Deltek teams.</p>',
      publicExperienceChecked: true,
      source: 'replicon',
      link: 'https://sjobs.brassring.com/TGnewUI/Search/home/HomeWithPreLoad?PageType=JobDetails&partnerid=25397&siteid=5259&jobid=623208&gqid=0&al=1',
      scrapedAt: '2026-08-04T12:00:00.000Z',
    },
    {
      title: 'Principal Quality Assurance Engineer',
      company: 'Replicon',
      department: 'Engineering',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      jobId: '23606699',
      requisitionId: '11095BR',
      sourceUrl: 'https://careers.deltek.com/job/23606699/principal-quality-assurance-engineer-bengaluru-karnataka/',
      applyUrl: 'https://careers.deltek.com/job/23606699/principal-quality-assurance-engineer-bengaluru-karnataka/',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-27T10:23:05',
      closingDate: null,
      jobDescription: 'Own engineering quality for Bengaluru product teams.',
      publicExperienceChecked: true,
      source: 'replicon',
      link: 'https://careers.deltek.com/job/23606699/principal-quality-assurance-engineer-bengaluru-karnataka/',
      scrapedAt: '2026-08-04T12:00:00.000Z',
    },
  ])
})

test('Replicon fails closed when the verified Deltek handoff drifts', async () => {
  const replicon = await loadScript()

  await assert.rejects(
    replicon.createRepliconScraper().run({
      fetchPage: async () => ({
        status: 200,
        url: 'https://www.replicon.com/company/careers/',
        html: '<html><body><h1>Unexpected Replicon Careers</h1></body></html>',
      }),
    }),
    /Replicon careers redirect/i,
  )
})
