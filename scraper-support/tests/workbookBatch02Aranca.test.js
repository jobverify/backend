import assert from 'node:assert/strict'
import test from 'node:test'

import { getScraperCatalog } from '../providers/index.js'

const loadModule = async () => {
  try {
    return await import('../../scraper/aranca/script.js')
  } catch {
    assert.fail('Expected Aranca scraper module at ../../scraper/aranca/script.js')
  }
}

const VERIFIED_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join Our Team | Exciting Career Opportunities Await</title>
  </head>
  <body>
    <main>
      <h1>Join Our Global Community of Problem Solvers!</h1>
      <a href="https://www2.aranca.com/careers/" class="hack15-menu-button links" target="_blank">Explore Open Positions</a>
      <a class="call-to-action" href="https://www2.aranca.com/careers/" target="_blank">Current Openings</a>
    </main>
  </body>
</html>
`

const VERIFIED_BOARD_PAGE_1_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Current Openings | Aranca Careers</title>
  </head>
  <body>
    <aside class="widget widget_taxonomy_checkbox_filter">
      <form method="GET" action="https://www2.aranca.com/careers/" class="taxonomy-filter-form">
        <h3>LOCATION</h3>
        <div class="taxonomy-checkbox-wrapper">
          <label><input type="checkbox" name="location[]" value="mumbai" /> Mumbai <span class="jcount">(2)</span></label>
          <label><input type="checkbox" name="location[]" value="california" /> California <span class="jcount">(1)</span></label>
        </div>
      </form>
    </aside>
    <main id="main" class="site-main">
      <article class="post-439 post type-post status-publish format-standard hentry category-investment-research-analytics location-mumbai">
        <div class="post-content ast-width-md-6">
          <h2 class="entry-title ast-blog-single-element" itemprop="headline"><a href="https://www2.aranca.com/careers/jobdetails/job/439" rel="bookmark">Senior Analyst &#8211; Private Credit</a></h2>
          <div class="ast-excerpt-container ast-blog-single-element">
            <p>We are looking for candidates with hands-on experience in private credit underwriting and investment support.</p>
          </div>
          <a href="javascript:void(0);" class="applyclicklist" data-popup-id="144">Apply Now</a>
          <a href="https://www2.aranca.com/careers/jobdetails/job/439" class="readmorebtn">View More Details</a>
          <ul class="jobmetadetails">
            <li><i class="fa fa-map-marker" aria-hidden="true"></i> Mumbai</li>
            <li><i class="fa fa-sitemap" aria-hidden="true"></i> <span class="jobdeptspan">Investment Research &amp; Analytics</span></li>
            <li><span>Job#</span> <span class="listjid">IRA#439</span></li>
            <li><i class="fa fa-users" aria-hidden="true"></i> 1 Position</li>
          </ul>
        </div>
      </article>
      <article class="post-358 post type-post status-publish format-standard hentry category-sales location-california">
        <div class="post-content ast-width-md-6">
          <h2 class="entry-title ast-blog-single-element" itemprop="headline"><a href="https://www2.aranca.com/careers/jobdetails/job/358" rel="bookmark">Job Description: Vice President, Business Development (Valuation Services)</a></h2>
          <div class="ast-excerpt-container ast-blog-single-element">
            <p>Drive revenue growth across California and the broader West Coast.</p>
          </div>
          <a href="javascript:void(0);" class="applyclicklist" data-popup-id="144">Apply Now</a>
          <a href="https://www2.aranca.com/careers/jobdetails/job/358" class="readmorebtn">View More Details</a>
          <ul class="jobmetadetails">
            <li><i class="fa fa-map-marker" aria-hidden="true"></i> California</li>
            <li><i class="fa fa-sitemap" aria-hidden="true"></i> <span class="jobdeptspan">Sales</span></li>
            <li><span>Job#</span> <span class="listjid">SALES#358</span></li>
            <li><i class="fa fa-users" aria-hidden="true"></i> 1 Position</li>
          </ul>
        </div>
      </article>
      <nav class="pagination">
        <a class="page-numbers" href="https://www2.aranca.com/careers/page/2">2</a>
      </nav>
    </main>
  </body>
</html>
`

const VERIFIED_BOARD_PAGE_2_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Current Openings | Aranca Careers</title>
  </head>
  <body>
    <main id="main" class="site-main">
      <article class="post-72 post type-post status-publish format-standard hentry category-valuation-advisory location-mumbai-gurgaon">
        <div class="post-content ast-width-md-6">
          <h2 class="entry-title ast-blog-single-element" itemprop="headline"><a href="https://www2.aranca.com/careers/jobdetails/job/72" rel="bookmark">Senior Consultant/Assistant Manager &#8211; Financial Modeling</a></h2>
          <div class="ast-excerpt-container ast-blog-single-element">
            <p>Support valuation and financial-modeling engagements for global clients.</p>
          </div>
          <a href="javascript:void(0);" class="applyclicklist" data-popup-id="144">Apply Now</a>
          <a href="https://www2.aranca.com/careers/jobdetails/job/72" class="readmorebtn">View More Details</a>
          <ul class="jobmetadetails">
            <li><i class="fa fa-map-marker" aria-hidden="true"></i> Mumbai / Gurgaon</li>
            <li><i class="fa fa-sitemap" aria-hidden="true"></i> <span class="jobdeptspan">Valuation &amp; Financial Advisory</span></li>
            <li><span>Job#</span> <span class="listjid">VFA#72</span></li>
            <li><i class="fa fa-users" aria-hidden="true"></i> 1 Position</li>
          </ul>
        </div>
      </article>
    </main>
  </body>
</html>
`

const SENIOR_ANALYST_DETAIL_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Senior Analyst - Private Credit | Aranca Careers</title>
    <meta property="og:url" content="https://www2.aranca.com/careers/jobdetails/job/439" />
  </head>
  <body>
    <main id="main" class="site-main">
      <article class="post post-article postid-439">
        <div class="topjob-desc">
          <header class="entry-header">
            <h1 class="entry-title posttitlejob" itemprop="headline">Senior Analyst &#8211; Private Credit</h1>
            <p class="jobdept_for_email" style="display:none;">Investment Research &amp; Analytics</p>
            <p class="jobid" style="display:none;">IRA#439</p>
            <a href="javascript:void(0);" class="applyclick">Apply Now</a>
          </header>
          <div class="jobspecifications-box">
            <ul>
              <li><i class="fa fa-map-marker" aria-hidden="true"></i> Mumbai</li>
              <li><a href="https://www.aranca.com/investment-research.php" target="_blank"><i class="fa fa-sitemap" aria-hidden="true"></i> Investment Research &amp; Analytics</a></li>
              <li><span>Job#</span> <span class="">IRA#439</span></li>
            </ul>
            <ul>
              <li><i class="fa fa-briefcase" aria-hidden="true"></i> 4-6 yrs</li>
              <li><i class="fa fa-users" aria-hidden="true"></i> 1 Position</li>
            </ul>
          </div>
        </div>
        <div class="entry-content clear">
          <h2 class="jprofile-title">Job Profile</h2>
          <p>Deal Screening &amp; Underwriting</p>
          <p>Build detailed financial models, assess credit risk, and support investment-committee materials.</p>
          <p>Functional Requirements</p>
          <p>CA / MBA Finance / CFA preferred with strong credit-research experience.</p>
        </div>
        <div class="about-companyblock">
          <h2 class="aboutcompany-title">About Company</h2>
        </div>
      </article>
    </main>
  </body>
</html>
`

const FINANCIAL_MODELING_DETAIL_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Senior Consultant/Assistant Manager - Financial Modeling | Aranca Careers</title>
    <meta property="og:url" content="https://www2.aranca.com/careers/jobdetails/job/72" />
  </head>
  <body>
    <main id="main" class="site-main">
      <article class="post post-article postid-72">
        <div class="topjob-desc">
          <header class="entry-header">
            <h1 class="entry-title posttitlejob" itemprop="headline">Senior Consultant/Assistant Manager &#8211; Financial Modeling</h1>
            <p class="jobdept_for_email" style="display:none;">Valuation &amp; Financial Advisory</p>
            <p class="jobid" style="display:none;">VFA#72</p>
            <a href="javascript:void(0);" class="applyclick">Apply Now</a>
          </header>
          <div class="jobspecifications-box">
            <ul>
              <li><i class="fa fa-map-marker" aria-hidden="true"></i> Mumbai / Gurgaon</li>
              <li><a href="https://www.aranca.com/valuation-advisory.php" target="_blank"><i class="fa fa-sitemap" aria-hidden="true"></i> Valuation &amp; Financial Advisory</a></li>
              <li><span>Job#</span> <span class="">VFA#72</span></li>
            </ul>
            <ul>
              <li><i class="fa fa-briefcase" aria-hidden="true"></i> 3-5 yrs</li>
              <li><i class="fa fa-users" aria-hidden="true"></i> 1 Position</li>
            </ul>
          </div>
        </div>
        <div class="entry-content clear">
          <h2 class="jprofile-title">Job Profile</h2>
          <p>Create financial models, support valuation deliverables, and work with cross-functional deal teams.</p>
          <p>Position Requirements</p>
          <p>Strong Excel and financial-modeling fundamentals with valuation-advisory experience.</p>
        </div>
        <div class="about-companyblock">
          <h2 class="aboutcompany-title">About Company</h2>
        </div>
      </article>
    </main>
  </body>
</html>
`

test('Aranca catalog entry points to the verified careers handoff and public jobs board', async () => {
  const aranca = await loadModule()
  const provider = getScraperCatalog().find((entry) => entry.source === aranca.SOURCE)
  const listings = aranca.extractBoardListings(VERIFIED_BOARD_PAGE_1_HTML)

  assert.equal(aranca.SOURCE, 'aranca')
  assert.equal(aranca.COMPANY, 'Aranca')
  assert.equal(aranca.VERIFIED_ON, '2026-07-30')
  assert.equal(aranca.CAREERS_URL, 'https://www.aranca.com/careers.php')
  assert.equal(aranca.JOBS_BOARD_URL, 'https://www2.aranca.com/careers/')
  assert.equal(
    aranca.DISPOSITION,
    'verified-first-party-careers-page-plus-public-paginated-jobs-board',
  )
  assert.equal(
    aranca.extractOfficialJobsBoardUrl(VERIFIED_CAREERS_HTML),
    'https://www2.aranca.com/careers/',
  )
  assert.equal(aranca.hasOfficialCareersPageSignal(VERIFIED_CAREERS_HTML), true)
  assert.deepEqual(
    aranca.extractPaginationUrls(VERIFIED_BOARD_PAGE_1_HTML),
    ['https://www2.aranca.com/careers/page/2'],
  )
  assert.equal(listings.length, 2)
  assert.deepEqual(
    listings.map((listing) => ({
      title: listing.title,
      location: listing.location,
      department: listing.department,
      jobId: listing.jobId,
      detailUrl: listing.detailUrl,
    })),
    [
      {
        title: 'Senior Analyst - Private Credit',
        location: 'Mumbai',
        department: 'Investment Research & Analytics',
        jobId: 'IRA#439',
        detailUrl: 'https://www2.aranca.com/careers/jobdetails/job/439',
      },
      {
        title: 'Job Description: Vice President, Business Development (Valuation Services)',
        location: 'California',
        department: 'Sales',
        jobId: 'SALES#358',
        detailUrl: 'https://www2.aranca.com/careers/jobdetails/job/358',
      },
    ],
  )
  assert.match(provider?.modulePath || '', /[\\/]aranca[\\/]script\.js$/i)
  assert.equal(provider?.companyCareerPage, aranca.CAREERS_URL)
  assert.equal(provider?.companyDomain, 'aranca.com')
  assert.equal(provider?.atsPlatform, aranca.DISPOSITION)
  assert.equal(provider?.verifiedPublicJobCount, 17)
  assert.equal(provider?.verifiedIndiaJobCount, 16)
  assert.match(provider?.verifiedSurfaceSummary || '', /Thursday, July 30, 2026/i)
  assert.match(provider?.verifiedSurfaceSummary || '', /https:\/\/www\.aranca\.com\/careers\.php/i)
  assert.match(provider?.verifiedSurfaceSummary || '', /https:\/\/www2\.aranca\.com\/careers\//i)
})

test('Aranca extracts normalized India jobs from the verified board and detail pages', async () => {
  const aranca = await loadModule()

  const seniorAnalyst = aranca.extractJobDetail(SENIOR_ANALYST_DETAIL_HTML)
  const financialModeling = aranca.extractJobDetail(FINANCIAL_MODELING_DETAIL_HTML)

  assert.deepEqual(seniorAnalyst, {
    title: 'Senior Analyst - Private Credit',
    department: 'Investment Research & Analytics',
    location: 'Mumbai',
    city: 'Mumbai',
    country: 'India',
    jobId: 'IRA#439',
    requisitionId: 'IRA#439',
    sourceUrl: 'https://www2.aranca.com/careers/jobdetails/job/439',
    applyUrl: 'https://www2.aranca.com/careers/jobdetails/job/439',
    employmentType: null,
    experienceRequired: '4-6 years',
    jobDescription: [
      'Job Profile',
      'Deal Screening & Underwriting',
      'Build detailed financial models, assess credit risk, and support investment-committee materials.',
      'Functional Requirements',
      'CA / MBA Finance / CFA preferred with strong credit-research experience.',
    ].join(' '),
  })
  assert.deepEqual(financialModeling, {
    title: 'Senior Consultant/Assistant Manager - Financial Modeling',
    department: 'Valuation & Financial Advisory',
    location: 'Mumbai / Gurgaon',
    city: 'Mumbai',
    country: 'India',
    jobId: 'VFA#72',
    requisitionId: 'VFA#72',
    sourceUrl: 'https://www2.aranca.com/careers/jobdetails/job/72',
    applyUrl: 'https://www2.aranca.com/careers/jobdetails/job/72',
    employmentType: null,
    experienceRequired: '3-5 years',
    jobDescription: [
      'Job Profile',
      'Create financial models, support valuation deliverables, and work with cross-functional deal teams.',
      'Position Requirements',
      'Strong Excel and financial-modeling fundamentals with valuation-advisory experience.',
    ].join(' '),
  })
})

test('Aranca run validates the official careers handoff, walks pagination, and fetches only India detail pages', async () => {
  const aranca = await loadModule()
  const requestedUrls = []

  const jobs = await aranca.createArancaScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === aranca.CAREERS_URL) return VERIFIED_CAREERS_HTML
      if (url === aranca.JOBS_BOARD_URL) return VERIFIED_BOARD_PAGE_1_HTML
      if (url === 'https://www2.aranca.com/careers/page/2') return VERIFIED_BOARD_PAGE_2_HTML
      if (url === 'https://www2.aranca.com/careers/jobdetails/job/439') {
        return SENIOR_ANALYST_DETAIL_HTML
      }
      if (url === 'https://www2.aranca.com/careers/jobdetails/job/72') {
        return FINANCIAL_MODELING_DETAIL_HTML
      }
      throw new Error(`Unexpected Aranca fixture URL: ${url}`)
    },
    now: () => '2026-07-30T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    aranca.CAREERS_URL,
    aranca.JOBS_BOARD_URL,
    'https://www2.aranca.com/careers/page/2',
    'https://www2.aranca.com/careers/jobdetails/job/439',
    'https://www2.aranca.com/careers/jobdetails/job/72',
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs, [
    {
      title: 'Senior Analyst - Private Credit',
      company: 'Aranca',
      department: 'Investment Research & Analytics',
      location: 'Mumbai, India',
      city: 'Mumbai',
      country: 'India',
      jobId: 'IRA#439',
      requisitionId: 'IRA#439',
      sourceUrl: 'https://www2.aranca.com/careers/jobdetails/job/439',
      applyUrl: 'https://www2.aranca.com/careers/jobdetails/job/439',
      employmentType: null,
      experienceRequired: '4-6 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: [
        'Job Profile',
        'Deal Screening & Underwriting',
        'Build detailed financial models, assess credit risk, and support investment-committee materials.',
        'Functional Requirements',
        'CA / MBA Finance / CFA preferred with strong credit-research experience.',
      ].join(' '),
      remoteStatus: null,
      source: 'aranca',
      link: 'https://www2.aranca.com/careers/jobdetails/job/439',
      scrapedAt: '2026-07-30T00:00:00.000Z',
    },
    {
      title: 'Senior Consultant/Assistant Manager - Financial Modeling',
      company: 'Aranca',
      department: 'Valuation & Financial Advisory',
      location: 'Mumbai / Gurgaon, India',
      city: 'Mumbai',
      country: 'India',
      jobId: 'VFA#72',
      requisitionId: 'VFA#72',
      sourceUrl: 'https://www2.aranca.com/careers/jobdetails/job/72',
      applyUrl: 'https://www2.aranca.com/careers/jobdetails/job/72',
      employmentType: null,
      experienceRequired: '3-5 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: [
        'Job Profile',
        'Create financial models, support valuation deliverables, and work with cross-functional deal teams.',
        'Position Requirements',
        'Strong Excel and financial-modeling fundamentals with valuation-advisory experience.',
      ].join(' '),
      remoteStatus: null,
      source: 'aranca',
      link: 'https://www2.aranca.com/careers/jobdetails/job/72',
      scrapedAt: '2026-07-30T00:00:00.000Z',
    },
  ])
})

test('Aranca fails closed when the verified official careers handoff changes materially', async () => {
  const aranca = await loadModule()

  await assert.rejects(
    aranca.createArancaScraper().run({
      fetchText: async () => '<html><head><title>Unexpected Aranca careers page</title></head><body>No trusted jobs board handoff here.</body></html>',
    }),
    /Aranca verified official careers page changed materially/i,
  )
})
