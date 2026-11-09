import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { getScraperCatalog } from '../providers/index.js'

const loadModule = () => import('../../scraper/volkswagengrouptechnologysolutionsindia/script.js')

const FIXED_SCRAPED_AT = '2026-08-13T12:00:00.000Z'

const successFactorsBootstrapHtml = `
  <html>
    <head>
      <title>Career Opportunities</title>
    </head>
    <body>
      <div id="candidateProfileTitle">Career Opportunities</div>
      <input id="career_ns" value="job_listing_summary" />
      <input id="company" value="volkswag04" />
      <div id="careerJobSearchContainer"></div>
      <script>
        var ajaxSecKey="token-123";
        window.addEventListener("load", getInitialJobSearchData);
        careerJobSearchController.getInitialJobSearchData("", "", "", "Asia/Calcutta");
      </script>
    </body>
  </html>
`

const successFactorsDwrResponse = `
throw 'allowScriptTagRemoting is false.';
dwr.engine._remoteHandleCallback('0','0',{
  results: {
    postingCount: 3,
    detailURLPrefix: 'https://career10.successfactors.com/career?career_ns=job_listing&company=volkswag04&navBarLevel=JOB_SEARCH&rcm_site_locale=en_GB&career_job_req_id=',
    postings: [
      {
        id: '10325',
        title: 'Sr. Developer',
        postingDate: '13/08/2026',
        otherValues: []
      },
      {
        id: '10417',
        title: 'Technical Expert',
        postingDate: '12/08/2026',
        otherValues: []
      },
      {
        id: '10202',
        title: 'Design Engineer',
        postingDate: '11/08/2026',
        otherValues: []
      }
    ]
  }
});
`

test('the exact Volkswagen Group Technology Solutions India CSV name resolves to its verified provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nVolkswagen Group Technology Solutions India\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0]?.source, 'volkswagengrouptechnologysolutionsindia')
})

test('the Volkswagen provider catalog captures the live SuccessFactors DWR contract', () => {
  const provider = getScraperCatalog()
    .find((entry) => entry.source === 'volkswagengrouptechnologysolutionsindia')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Volkswagen Group Technology Solutions India')
  assert.equal(provider.atsPlatform, 'successfactors-dwr')
  assert.equal(provider.paginationStrategy, 'successfactors-dwr-initial-search')
  assert.equal(
    provider.extractionStrategy,
    'verified-successfactors-bootstrap+dwr-search-results+detail-pages',
  )
  assert.equal(provider.verifiedOn, '2026-08-13')
  assert.match(provider.verifiedSurfaceSummary, /Thursday, August 13, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /3 postings/i)
  assert.match(provider.verifiedSurfaceSummary, /Sr\. Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /Technical Expert/i)
})

test('the Volkswagen scraper parses the live SuccessFactors DWR postings and detail pages', async () => {
  const volkswagen = await loadModule()
  const requestedUrls = []

  const detailHtmlByUrl = {
    [volkswagen.buildDetailUrl('10325')]: `
      <html>
        <head><title>Career Opportunities: Sr. Developer (10325)</title></head>
        <body>
          <div class="jobdescription">
            <p>Build enterprise platform integrations and support backend delivery across India engineering teams.</p>
          </div>
        </body>
      </html>
    `,
    [volkswagen.buildDetailUrl('10417')]: `
      <html>
        <head><title>Career Opportunities: Technical Expert (10417)</title></head>
        <body>
          <div class="jobdescription">
            <p>Lead cloud foundation design, technical governance, and architecture reviews for digital products.</p>
          </div>
        </body>
      </html>
    `,
    [volkswagen.buildDetailUrl('10202')]: `
      <html>
        <head><title>Career Opportunities: Design Engineer (10202)</title></head>
        <body>
          <div class="jobdescription">
            <p>Drive design engineering collaboration, component development, and product readiness activities.</p>
          </div>
        </body>
      </html>
    `,
  }

  assert.equal(volkswagen.hasSuccessFactorsBoardShellSignal(successFactorsBootstrapHtml), true)
  assert.deepEqual(
    volkswagen.extractDwrSearchResults(successFactorsDwrResponse).map((job) => ({
      title: job.title,
      location: job.location,
      postingDate: job.postingDate,
    })),
    [
      {
        title: 'Sr. Developer',
        location: 'India',
        postingDate: '2026-08-13',
      },
      {
        title: 'Technical Expert',
        location: 'India',
        postingDate: '2026-08-12',
      },
      {
        title: 'Design Engineer',
        location: 'India',
        postingDate: '2026-08-11',
      },
    ],
  )

  const jobs = await volkswagen.createVolkswagenGroupTechnologySolutionsIndiaScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      if (url === volkswagen.BOARD_URL) {
        requestedUrls.push(url)
        return successFactorsBootstrapHtml
      }
      if (detailHtmlByUrl[url]) {
        requestedUrls.push(url)
        return detailHtmlByUrl[url]
      }
      throw new Error(`Unexpected Volkswagen URL: ${url}`)
    },
    getSearchPages: async ({ searchUrl }) => {
      assert.equal(searchUrl, volkswagen.BOARD_URL)
      return [successFactorsDwrResponse]
    },
  })

  assert.deepEqual(requestedUrls, [
    volkswagen.BOARD_URL,
    volkswagen.buildDetailUrl('10325'),
    volkswagen.buildDetailUrl('10417'),
    volkswagen.buildDetailUrl('10202'),
  ])
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      postingDate: job.postingDate,
      applyUrl: job.applyUrl,
      source: job.source,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Sr. Developer',
        location: 'India',
        postingDate: '2026-08-13',
        applyUrl: volkswagen.buildDetailUrl('10325'),
        source: 'volkswagengrouptechnologysolutionsindia',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'Technical Expert',
        location: 'India',
        postingDate: '2026-08-12',
        applyUrl: volkswagen.buildDetailUrl('10417'),
        source: 'volkswagengrouptechnologysolutionsindia',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'Design Engineer',
        location: 'India',
        postingDate: '2026-08-11',
        applyUrl: volkswagen.buildDetailUrl('10202'),
        source: 'volkswagengrouptechnologysolutionsindia',
        scrapedAt: FIXED_SCRAPED_AT,
      },
    ],
  )
  assert.match(jobs[0].jobDescription || '', /backend delivery/i)
  assert.match(jobs[1].jobDescription || '', /cloud foundation design/i)
  assert.match(jobs[2].jobDescription || '', /design engineering collaboration/i)
})

test('the Volkswagen scraper rejects SuccessFactors bootstrap drift instead of masking changes', async () => {
  const volkswagen = await loadModule()

  await assert.rejects(
    volkswagen.createVolkswagenGroupTechnologySolutionsIndiaScraper().run({
      fetchText: async () => '<html><body>Software Engineer Pune</body></html>',
    }),
    /SuccessFactors board bootstrap/i,
  )
})
