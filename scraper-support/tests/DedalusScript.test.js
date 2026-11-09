import assert from 'node:assert/strict'
import test from 'node:test'

import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const FIXED_SCRAPED_AT = '2026-07-17T18:00:00.000Z'

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Dedalus Global</title>
  </head>
  <body>
    <h1>CAREERS</h1>
    <p>Join Dedalus and become part of a pioneering industry leader!</p>
    <a href="https://www.dedalus.com/global/en/working-at-dedalus/our-job-offers/">Our Job Offers</a>
    <a href="https://www.dedalus.com/global/en/careers/why-dedalus/">WHY DEDALUS</a>
    <a href="https://www.dedalus.com/global/en/careers/career-path/">CAREER PATH</a>
  </body>
</html>
`

const jobOffersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Our Job Offers - Dedalus Global</title>
  </head>
  <body>
    <h1>Our Job Offers</h1>
    <p>Join the Dedalus adventure</p>
    <a href="https://dedalus.wd3.myworkdayjobs.com/en-US/External">Go to open positions</a>
  </body>
</html>
`

const workdayBoardHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <link rel="canonical" href="https://dedalus.wd3.myworkdayjobs.com/External" />
    <meta property="og:title" content="Careers" />
  </head>
  <body>
    <div id="mainContent">Open Jobs</div>
    <script src="https://wd3.myworkdaycdn.com/wday/asset/candidate-experience-jobs/cx-jobs.min.js"></script>
  </body>
</html>
`

const unfilteredPayload = {
  total: 109,
  jobPostings: [
    {
      title: 'Full Stack Developer (m/w/d)',
      externalPath: '/job/DEU---Trier/Full-Stack-Developer--m-w-d-_JR107060',
      locationsText: '2 Locations',
      postedOn: 'Posted Today',
      bulletFields: ['JR107060'],
    },
  ],
  facets: [
    {
      facetParameter: 'locationMainGroup',
      values: [
        {
          facetParameter: 'locationCountry',
          descriptor: 'Location Country',
          values: [
            {
              descriptor: 'India',
              id: 'c4f78be1a8f14da0ab49ce1162348a5e',
              count: 2,
            },
          ],
        },
      ],
    },
  ],
}

const filteredIndiaPayload = {
  total: 2,
  jobPostings: [
    {
      title: 'Integration Engineer - Healthcare',
      externalPath: '/job/IND---Chennai/PAS-Integration-Engineer_JR108480',
      locationsText: 'IND - Chennai',
      postedOn: 'Posted 11 Days Ago',
      bulletFields: ['JR108480'],
    },
    {
      title: 'Solution Architect',
      externalPath: '/job/IND---Chennai/Solution-Architect_JR108318',
      locationsText: '2 Locations',
      postedOn: 'Posted 25 Days Ago',
      bulletFields: ['JR108318'],
    },
  ],
}

const noIndiaFacetPayload = {
  total: 65,
  jobPostings: [
    {
      title: 'Kodierfachkraft',
      externalPath: '/job/DEU---Bonn/Kodierfachkraft_JR108805',
      locationsText: '2 Locations',
      postedOn: 'Posted Today',
      bulletFields: ['JR108805'],
    },
  ],
  facets: [
    {
      facetParameter: 'locationMainGroup',
      values: [
        {
          facetParameter: 'locationCountry',
          descriptor: 'Location Country',
          values: [
            {
              descriptor: 'Austria',
              id: 'd004c0d1a6c84511ab048669fcdf9fd7',
              count: 22,
            },
          ],
        },
      ],
    },
  ],
}

const integrationDetailHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <meta property="og:title" content="Integration Engineer - Healthcare" />
    <meta
      property="og:description"
      content="Join Dedalus, a global leader in healthcare technology, and help shape the future of digital healthcare as an Integration Engineer on our team R&amp;D team in Chennai, India. Application closing date: 6th August 2026."
    />
    <meta property="og:url" content="https://dedalus.wd3.myworkdayjobs.com/External/job/IND---Chennai/PAS-Integration-Engineer_JR108480" />
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        "title": "Integration Engineer - Healthcare",
        "datePosted": "2026-07-06",
        "description": "Join Dedalus in Chennai, India. Application closing date: 6th August 2026.",
        "jobLocation": {
          "@type": "Place",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "IND - Chennai"
          }
        }
      }
    </script>
  </head>
  <body></body>
</html>
`

const solutionArchitectDetailHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <meta property="og:title" content="Solution Architect" />
    <meta
      property="og:description"
      content="Join us as our EHR Solution Architect at Dedalus, working from Chennai and Noida, India to do the best work of your career. Application closing date: 22nd July 2026."
    />
    <meta property="og:url" content="https://dedalus.wd3.myworkdayjobs.com/External/job/IND---Chennai/Solution-Architect_JR108318" />
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        "title": "Solution Architect",
        "datePosted": "2026-06-22",
        "description": "Join us as our EHR Solution Architect at Dedalus, working from Chennai and Noida, India. Application closing date: 22nd July 2026.",
        "jobLocation": {
          "@type": "Place",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "IND - Chennai"
          }
        }
      }
    </script>
  </head>
  <body></body>
</html>
`

const blankIndiaDetailHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title></title>
    <meta name="title" property="og:title">
    <meta name="description" property="og:description">
  </head>
  <body></body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/dedalus.workday/script.js')
  } catch {
    assert.fail('Expected Dedalus scraper module at ../../scraper/dedalus.workday/script.js')
  }
}

test('Dedalus helpers stay pinned to the verified first-party careers handoff and India Workday contract', async () => {
  const dedalus = await loadModule()

  assert.equal(dedalus.SOURCE, 'dedalus')
  assert.equal(dedalus.COMPANY, 'Dedalus')
  assert.equal(dedalus.CAREERS_URL, 'https://www.dedalus.com/global/en/careers/')
  assert.equal(dedalus.JOB_OFFERS_URL, 'https://www.dedalus.com/global/en/working-at-dedalus/our-job-offers/')
  assert.equal(
    dedalus.WORKDAY_BOARD_URL,
    'https://dedalus.wd3.myworkdayjobs.com/External',
  )
  assert.equal(
    dedalus.JOBS_API_URL,
    'https://dedalus.wd3.myworkdayjobs.com/wday/cxs/dedalus/External/jobs',
  )
  assert.equal(dedalus.VERIFIED_ON, '2026-08-04')
  assert.equal(dedalus.hasOfficialCareersSignal(careersPageHtml), true)
  assert.equal(dedalus.hasOfficialJobOffersPageSignal(jobOffersPageHtml), true)
  assert.equal(
    dedalus.extractVerifiedWorkdayBoardUrl(jobOffersPageHtml),
    'https://dedalus.wd3.myworkdayjobs.com/External',
  )
  assert.equal(dedalus.hasOfficialWorkdayBoardSignal(workdayBoardHtml), true)
  assert.equal(
    dedalus.extractIndiaCountryFacetId(unfilteredPayload),
    'c4f78be1a8f14da0ab49ce1162348a5e',
  )
  assert.equal(dedalus.extractIndiaCountryFacetId(noIndiaFacetPayload), null)
  assert.equal(dedalus.hasVerifiedStaleIndiaDetailShell(blankIndiaDetailHtml), true)
  assert.deepEqual(
    JSON.parse(dedalus.buildUnfilteredJobsRequestBody({ offset: 0 })),
    {
      appliedFacets: {},
      limit: 20,
      offset: 0,
      searchText: '',
    },
  )
  assert.deepEqual(
    JSON.parse(
      dedalus.buildIndiaJobsRequestBody({
        offset: 20,
        countryFacetId: 'c4f78be1a8f14da0ab49ce1162348a5e',
      }),
    ),
    {
      appliedFacets: {
        locationCountry: ['c4f78be1a8f14da0ab49ce1162348a5e'],
      },
      limit: 20,
      offset: 20,
      searchText: '',
    },
  )
  assert.deepEqual(
    dedalus.extractJobFromDetailHtml(solutionArchitectDetailHtml, {
      title: 'Solution Architect',
      detailUrl: 'https://dedalus.wd3.myworkdayjobs.com/External/job/IND---Chennai/Solution-Architect_JR108318',
      jobId: 'JR108318',
      locationsText: '2 Locations',
      postedOn: 'Posted 25 Days Ago',
    }, { scrapedAt: FIXED_SCRAPED_AT }),
    {
      jobId: 'JR108318',
      title: 'Solution Architect',
      company: 'Dedalus',
      department: null,
      location: 'Chennai, India',
      city: 'Chennai',
      locations: ['IND - Chennai', 'IND - New Delhi - Noida'],
      country: 'India',
      sourceUrl:
        'https://dedalus.wd3.myworkdayjobs.com/External/job/IND---Chennai/Solution-Architect_JR108318',
      applyUrl:
        'https://dedalus.wd3.myworkdayjobs.com/External/job/IND---Chennai/Solution-Architect_JR108318/apply',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-06-22',
      closingDate: '2026-07-22',
      jobDescription:
        'Join us as our EHR Solution Architect at Dedalus, working from Chennai and Noida, India to do the best work of your career. Application closing date: 22nd July 2026.',
      requisitionId: 'JR108318',
      source: 'dedalus',
      link:
        'https://dedalus.wd3.myworkdayjobs.com/External/job/IND---Chennai/Solution-Architect_JR108318',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  )
})

test('Dedalus run validates the verified Workday handoff and extracts India jobs from the public jobs API', async () => {
  const dedalus = await loadModule()
  const requestedPages = []
  const requestedJsonBodies = []

  const jobs = await dedalus.createDedalusScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === dedalus.CAREERS_URL) {
        return { status: 200, url, html: careersPageHtml }
      }

      if (url === dedalus.JOB_OFFERS_URL) {
        return { status: 200, url, html: jobOffersPageHtml }
      }

      if (url === dedalus.WORKDAY_BOARD_URL) {
        return { status: 200, url, html: workdayBoardHtml }
      }

      if (url === 'https://dedalus.wd3.myworkdayjobs.com/External/job/IND---Chennai/PAS-Integration-Engineer_JR108480') {
        return { status: 200, url, html: integrationDetailHtml }
      }

      if (url === 'https://dedalus.wd3.myworkdayjobs.com/External/job/IND---Chennai/Solution-Architect_JR108318') {
        return { status: 200, url, html: solutionArchitectDetailHtml }
      }

      throw new Error(`Unexpected Dedalus page URL: ${url}`)
    },
    fetchJson: async (url, body) => {
      assert.equal(url, dedalus.JOBS_API_URL)
      requestedJsonBodies.push(JSON.parse(body))

      if (requestedJsonBodies.length === 1) return unfilteredPayload
      if (requestedJsonBodies.length === 2) return filteredIndiaPayload

      throw new Error(`Unexpected Dedalus jobs API call #${requestedJsonBodies.length}`)
    },
  })

  assert.deepEqual(requestedPages, [
    dedalus.CAREERS_URL,
    dedalus.JOB_OFFERS_URL,
    dedalus.WORKDAY_BOARD_URL,
    'https://dedalus.wd3.myworkdayjobs.com/External/job/IND---Chennai/PAS-Integration-Engineer_JR108480',
    'https://dedalus.wd3.myworkdayjobs.com/External/job/IND---Chennai/Solution-Architect_JR108318',
  ])
  assert.deepEqual(requestedJsonBodies, [
    JSON.parse(dedalus.buildUnfilteredJobsRequestBody({ offset: 0 })),
    JSON.parse(
      dedalus.buildIndiaJobsRequestBody({
        offset: 0,
        countryFacetId: 'c4f78be1a8f14da0ab49ce1162348a5e',
      }),
    ),
  ])
  assert.deepEqual(jobs, [
    {
      jobId: 'JR108480',
      title: 'Integration Engineer - Healthcare',
      company: 'Dedalus',
      department: null,
      location: 'Chennai, India',
      city: 'Chennai',
      locations: ['IND - Chennai'],
      country: 'India',
      sourceUrl:
        'https://dedalus.wd3.myworkdayjobs.com/External/job/IND---Chennai/PAS-Integration-Engineer_JR108480',
      applyUrl:
        'https://dedalus.wd3.myworkdayjobs.com/External/job/IND---Chennai/PAS-Integration-Engineer_JR108480/apply',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-06',
      closingDate: '2026-08-06',
      jobDescription:
        'Join Dedalus, a global leader in healthcare technology, and help shape the future of digital healthcare as an Integration Engineer on our team R&D team in Chennai, India. Application closing date: 6th August 2026.',
      requisitionId: 'JR108480',
      source: 'dedalus',
      link:
        'https://dedalus.wd3.myworkdayjobs.com/External/job/IND---Chennai/PAS-Integration-Engineer_JR108480',
      scrapedAt: FIXED_SCRAPED_AT,
      companyCareerPage: 'https://www.dedalus.com/global/en/careers/',
      companyDomain: 'dedalus.com',
      atsPlatform: 'workday',
    },
    {
      jobId: 'JR108318',
      title: 'Solution Architect',
      company: 'Dedalus',
      department: null,
      location: 'Chennai, India',
      city: 'Chennai',
      locations: ['IND - Chennai', 'IND - New Delhi - Noida'],
      country: 'India',
      sourceUrl:
        'https://dedalus.wd3.myworkdayjobs.com/External/job/IND---Chennai/Solution-Architect_JR108318',
      applyUrl:
        'https://dedalus.wd3.myworkdayjobs.com/External/job/IND---Chennai/Solution-Architect_JR108318/apply',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-06-22',
      closingDate: '2026-07-22',
      jobDescription:
        'Join us as our EHR Solution Architect at Dedalus, working from Chennai and Noida, India to do the best work of your career. Application closing date: 22nd July 2026.',
      requisitionId: 'JR108318',
      source: 'dedalus',
      link:
        'https://dedalus.wd3.myworkdayjobs.com/External/job/IND---Chennai/Solution-Architect_JR108318',
      scrapedAt: FIXED_SCRAPED_AT,
      companyCareerPage: 'https://www.dedalus.com/global/en/careers/',
      companyDomain: 'dedalus.com',
      atsPlatform: 'workday',
    },
  ])
})

test('Dedalus returns [] when the public Workday board no longer exposes an India facet and the old India detail URLs are blank shells', async () => {
  const dedalus = await loadModule()
  const requestedPages = []

  const jobs = await dedalus.createDedalusScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === dedalus.CAREERS_URL) return { status: 200, url, html: careersPageHtml }
      if (url === dedalus.JOB_OFFERS_URL) return { status: 200, url, html: jobOffersPageHtml }
      if (url === dedalus.WORKDAY_BOARD_URL) return { status: 200, url, html: workdayBoardHtml }
      if (dedalus.VERIFIED_INDIA_JOB_URLS.includes(url)) return { status: 200, url, html: blankIndiaDetailHtml }

      throw new Error(`Unexpected Dedalus page URL: ${url}`)
    },
    fetchJson: async (url, body) => {
      assert.equal(url, dedalus.JOBS_API_URL)
      assert.deepEqual(JSON.parse(body), JSON.parse(dedalus.buildUnfilteredJobsRequestBody({ offset: 0 })))
      return noIndiaFacetPayload
    },
  })

  assert.deepEqual(requestedPages, [
    dedalus.CAREERS_URL,
    dedalus.JOB_OFFERS_URL,
    dedalus.WORKDAY_BOARD_URL,
    ...dedalus.VERIFIED_INDIA_JOB_URLS,
  ])
  assert.deepEqual(jobs, [])
  assert.deepEqual(readInventoryEvidence(jobs), {
    status: 'complete-inventory',
    surface: dedalus.JOBS_API_URL,
    firstParty: true,
    listingComplete: true,
    pagesFetched: 1,
    reportedTotal: 65,
    indiaFacetCount: 0,
    verifiedAt: FIXED_SCRAPED_AT,
    reason: 'dedalus-workday-board-without-india-country-facet',
  })
})

test('Dedalus fails closed when the verified careers handoff, country facet, or India detail pages drift', async () => {
  const dedalus = await loadModule()

  await assert.rejects(
    dedalus.createDedalusScraper().run({
      fetchPage: async (url) => {
        if (url === dedalus.CAREERS_URL) {
          return { status: 200, url, html: '<html><body><h1>Careers</h1></body></html>' }
        }

        throw new Error(`Unexpected Dedalus page URL: ${url}`)
      },
      fetchJson: async () => filteredIndiaPayload,
    }),
    /verified official careers surface/i,
  )

  await assert.rejects(
    dedalus.createDedalusScraper().run({
      fetchPage: async (url) => {
        if (url === dedalus.CAREERS_URL) {
          return { status: 200, url, html: careersPageHtml }
        }

        if (url === dedalus.JOB_OFFERS_URL) {
          return {
            status: 200,
            url,
            html: jobOffersPageHtml.replace(
              'https://dedalus.wd3.myworkdayjobs.com/en-US/External',
              'https://example.com/jobs',
            ),
          }
        }

        throw new Error(`Unexpected Dedalus page URL: ${url}`)
      },
      fetchJson: async () => filteredIndiaPayload,
    }),
    /verified job offers handoff changed/i,
  )

  await assert.rejects(
    dedalus.createDedalusScraper().run({
      fetchPage: async (url) => {
        if (url === dedalus.CAREERS_URL) return { status: 200, url, html: careersPageHtml }
        if (url === dedalus.JOB_OFFERS_URL) return { status: 200, url, html: jobOffersPageHtml }
        if (url === dedalus.WORKDAY_BOARD_URL) return { status: 200, url, html: workdayBoardHtml }
        if (dedalus.VERIFIED_INDIA_JOB_URLS.includes(url)) {
          return { status: 200, url, html: integrationDetailHtml }
        }

        throw new Error(`Unexpected Dedalus page URL: ${url}`)
      },
      fetchJson: async () => noIndiaFacetPayload,
    }),
    /verified India-empty Workday sentinel changed materially/i,
  )
})


for (const [status, html, failureKind] of [
  [200, '<title>Workday is currently unavailable.</title>', 'network_or_timeout'],
  [503, 'Service unavailable', 'network_or_timeout'],
  [403, 'Forbidden', 'blocked_or_access_denied'],
]) {
  test('dedalus recognizes upstream Workday board failures for HTTP ' + status, async () => {
    const mod = await import('../../scraper/dedalus.workday/script.js')
    const {classifyScraperError} = await import('../utils/failureClassification.js')
    await assert.rejects(mod.createDedalusScraper().run({
      fetchPage: async url => {
        if (url === mod.WORKDAY_BOARD_URL) return {status,url,html}
        if (url === mod.CAREERS_URL) return {status:200,url,html:careersPageHtml}; if (url === mod.JOB_OFFERS_URL) return {status:200,url,html:jobOffersPageHtml}
        throw new Error('Unexpected page: ' + url)
      },
      fetchJson: async () => assert.fail('Unavailable board must not request job listings'),
    }), error => {
      assert.deepEqual(classifyScraperError(error), {softFailure:true,upstreamOutage:true,failureKind})
      return true
    })
  })
}
