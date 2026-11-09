import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
  <html>
    <head>
      <title>Best Consulting Firm in Life Sciences Industry &#8211; Drive pharma success with SRI — a leading healthcare market research firm combining AI and expert insight to power data-driven decisions.</title>
    </head>
    <body>
      <a href="https://www.srinsights.com/careers/">Careers</a>
      <h1>Highly Innovative Analytical Consulting Firm in the Life Sciences Industry</h1>
      <p>
        Strategic Research Insights (SRI) offers a unique blend of custom primary market research
        and secondary data analytics solutions for the pharmaceutical, biotech, and healthcare sectors.
      </p>
      <a href="mailto:inquiries@srinsights.com">inquiries@srinsights.com</a>
      <span>700 Alexander Park, Suite 100 - Princeton, NJ 08540, USA</span>
    </body>
  </html>
`

const careersHtml = `
  <html>
    <head>
      <title>Careers &#8211; Best Consulting Firm in Life Sciences Industry</title>
      <link rel="canonical" href="https://www.srinsights.com/careers/" />
    </head>
    <body>
      <h1>Careers at SRI</h1>
      <h2>Available Positions</h2>
      <div>We are always seeking well-qualified candidates for positions in market research, data analytics, project management, or business development.</div>
      <div id="jobs-grid" data-query-vars="{&quot;post_type&quot;:[&quot;job&quot;],&quot;posts_per_page&quot;:-1}">
        <div class="brxe-fpttti brxe-div job-div">
          <h3 class="brxe-yyqnoy brxe-heading site-small-heading">
            <a href="https://www.srinsights.com/job/sr-analyst-lead-analyst-survey-programming/">Sr. Analyst/Lead Analyst-Survey Programming</a>
          </h3>
          <div class="brxe-hxyctx brxe-text-basic body-content-small">
            We are seeking a highly skilled Sr. Analyst / Lead Analyst - Survey Programming to join our Programming and Quality Control team in Hyderabad.
          </div>
          <ul class="brxe-jyotwn brxe-social-icons">
            <li class="repeater-item no-link"><span>Hyderabad</span></li>
          </ul>
          <a class="brxe-kjgxgv brxe-button primary-button bricks-button bricks-background-primary" href="https://www.srinsights.com/job/sr-analyst-lead-analyst-survey-programming/">Read More</a>
        </div>
        <div class="brxe-fpttti brxe-div job-div">
          <h3 class="brxe-yyqnoy brxe-heading site-small-heading">
            <a href="https://www.srinsights.com/job/associate-consultant-business-insights/">Associate Consultant - Business Insights</a>
          </h3>
          <div class="brxe-hxyctx brxe-text-basic body-content-small">
            Strategic Research Insights, Inc. is a marketing consulting firm serving clients in the US and global pharmaceutical sector.
          </div>
          <ul class="brxe-jyotwn brxe-social-icons">
            <li class="repeater-item no-link"><span>Hyderabad</span></li>
          </ul>
          <a class="brxe-kjgxgv brxe-button primary-button bricks-button bricks-background-primary" href="https://www.srinsights.com/job/associate-consultant-business-insights/">Read More</a>
        </div>
        <div class="brxe-fpttti brxe-div job-div">
          <h3 class="brxe-yyqnoy brxe-heading site-small-heading">
            <a href="https://www.srinsights.com/job/associate-manager-analytics/">Associate Manager, Analytics</a>
          </h3>
          <div class="brxe-hxyctx brxe-text-basic body-content-small">
            In this client-facing role, you will guide pharmaceutical sales and marketing strategies.
          </div>
          <ul class="brxe-jyotwn brxe-social-icons">
            <li class="repeater-item no-link"><span>Princeton, NJ</span></li>
          </ul>
          <a class="brxe-kjgxgv brxe-button primary-button bricks-button bricks-background-primary" href="https://www.srinsights.com/job/associate-manager-analytics/">Read More</a>
        </div>
        <div class="brxe-fpttti brxe-div job-div">
          <h3 class="brxe-yyqnoy brxe-heading site-small-heading">
            <a href="https://www.srinsights.com/job/associate-manager-data-science/">Associate Manager - Data Science</a>
          </h3>
          <div class="brxe-hxyctx brxe-text-basic body-content-small">
            Candidates will support internal teams and clients in driving strategic decisions with predictive analytics and machine learning.
          </div>
          <ul class="brxe-jyotwn brxe-social-icons">
            <li class="repeater-item no-link"><span>Chennai, IN</span></li>
          </ul>
          <a class="brxe-kjgxgv brxe-button primary-button bricks-button bricks-background-primary" href="https://www.srinsights.com/job/associate-manager-data-science/">Read More</a>
        </div>
        <div class="brxe-fpttti brxe-div job-div">
          <h3 class="brxe-yyqnoy brxe-heading site-small-heading">
            <a href="https://www.srinsights.com/job/senior-analyst-data-science/">Senior Analyst - Data Science</a>
          </h3>
          <div class="brxe-hxyctx brxe-text-basic body-content-small">
            Candidates will support internal teams and clients in driving strategic decisions with predictive analytics and machine learning.
          </div>
          <ul class="brxe-jyotwn brxe-social-icons">
            <li class="repeater-item no-link"><span>Chennai, IN</span></li>
          </ul>
          <a class="brxe-kjgxgv brxe-button primary-button bricks-button bricks-background-primary" href="https://www.srinsights.com/job/senior-analyst-data-science/">Read More</a>
        </div>
      </div>
      <div>IN-CHN</div>
      <a href="mailto:Chennairecruiter@srinsights.com">(Chennairecruiter@srinsights.com)</a>
      <div>IN-HYD</div>
      <a href="mailto:Programmingrecruiter@srinsights.com">(Programmingrecruiter@srinsights.com)</a>
    </body>
  </html>
`

const detailPages = {
  'https://www.srinsights.com/job/sr-analyst-lead-analyst-survey-programming/': `
    <html>
      <head>
        <title>Sr. Analyst/Lead Analyst-Survey Programming | Best Consulting Firm In Life Sciences Industry</title>
      </head>
      <body>
        <h1 id="brxe-nknjgr" class="brxe-heading banner-heading">Sr. Analyst/Lead Analyst-Survey Programming</h1>
        <ul id="brxe-qrfrgi" class="brxe-social-icons">
          <li class="repeater-item no-link"><span>IND - Hyderabad</span></li>
        </ul>
        <div id="brxe-dkjlpa" class="brxe-text body-content">
          <h2>Basic Information</h2>
          <p><strong>Job Title:</strong> Sr. Analyst/Lead Analyst-Survey Programming<br /><strong>Job Location:</strong> Hyderabad, India</p>
          <h2>Position Summary</h2>
          <p>We are seeking a highly skilled Sr. Analyst / Lead Analyst - Survey Programming to join our Programming and Quality Control team in Hyderabad.</p>
          <h2>Required Skills:</h2>
          <ul>
            <li>Lead Analyst: 4+ years Needed</li>
            <li>Confirmit / Decipher survey scripting</li>
          </ul>
        </div>
        <h2 id="brxe-oednkd" class="brxe-heading site-heading-medium">How to Apply</h2>
        <div id="brxe-tmrxgw" class="brxe-text body-content-20px">
          <ul>
            <li>Please apply directly to SRI at <a href="mailto:Programmingrecruiter@srinsights.com">Programmingrecruiter@srinsights.com</a></li>
          </ul>
        </div>
        <a id="brxe-qnkwbz" class="brxe-button primary-button bricks-button bricks-background-primary" href="mailto:programmingrecruiter@srinsights.com?subject=Application%20for%20Survey%20Programming">Apply now</a>
      </body>
    </html>
  `,
  'https://www.srinsights.com/job/associate-consultant-business-insights/': `
    <html>
      <head>
        <title>Associate Consultant - Business Insights | Best Consulting Firm In Life Sciences Industry</title>
      </head>
      <body>
        <h1 id="brxe-nknjgr" class="brxe-heading banner-heading">Associate Consultant - Business Insights</h1>
        <ul id="brxe-qrfrgi" class="brxe-social-icons">
          <li class="repeater-item no-link"><span>IND - Hyderabad</span></li>
        </ul>
        <div id="brxe-dkjlpa" class="brxe-text body-content">
          <h2>Company Description</h2>
          <p>Strategic Research Insights, Inc. is a marketing consulting firm serving clients in the US and global pharmaceutical sector headquartered in Princeton, NJ, USA.</p>
          <h2>Position Summary</h2>
          <p>Associate Consultants manage projects, extract insights, and present recommendations to clients.</p>
          <h2>Required Skills:</h2>
          <ul>
            <li>Associate Consultant: 2+ years Needed</li>
            <li>Strong data interpretation skills</li>
          </ul>
        </div>
        <h2 id="brxe-oednkd" class="brxe-heading site-heading-medium">How to Apply</h2>
        <div id="brxe-tmrxgw" class="brxe-text body-content-20px">
          <ul>
            <li>Please apply directly to SRI at <a href="mailto:Insightsrecruiter@srinsights.com">Insightsrecruiter@srinsights.com</a></li>
          </ul>
        </div>
        <a id="brxe-qnkwbz" class="brxe-button primary-button bricks-button bricks-background-primary" href="mailto:insightsrecruiter@srinsights.com?subject=Application%20for%20Business%20Insights">Apply now</a>
      </body>
    </html>
  `,
  'https://www.srinsights.com/job/associate-manager-data-science/': `
    <html>
      <head>
        <title>Associate Manager - Data Science | Best Consulting Firm In Life Sciences Industry</title>
      </head>
      <body>
        <h1 id="brxe-nknjgr" class="brxe-heading banner-heading">Associate Manager - Data Science</h1>
        <ul id="brxe-qrfrgi" class="brxe-social-icons">
          <li class="repeater-item no-link"><span>IND - Chennai</span></li>
        </ul>
        <div id="brxe-dkjlpa" class="brxe-text body-content">
          <h2>Company Description</h2>
          <p>Strategic Research Insights LLP. is a boutique healthcare consulting firm specializing in global market research and analytics.</p>
          <h2>Position Summary</h2>
          <p>Candidates would support internal teams and clients in driving strategic decisions, applying advanced statistical, predictive analytics and machine learning concepts.</p>
          <h2>Required Skills and Qualifications</h2>
          <ul>
            <li>Associate manager: 5+ years Needed</li>
            <li>Python, Power BI, Snowflake</li>
          </ul>
        </div>
        <h2 id="brxe-oednkd" class="brxe-heading site-heading-medium">How to Apply</h2>
        <div id="brxe-tmrxgw" class="brxe-text body-content-20px">
          <ul>
            <li>Please apply directly to SRI at <a href="mailto:Chennairecruiter@srinsights.com">Chennairecruiter@srinsights.com</a></li>
          </ul>
        </div>
        <a id="brxe-qnkwbz" class="brxe-button primary-button bricks-button bricks-background-primary" href="mailto:chennairecruiter@srinsights.com?subject=Application%20for%20Data%20Science">Apply now</a>
      </body>
    </html>
  `,
  'https://www.srinsights.com/job/senior-analyst-data-science/': `
    <html>
      <head>
        <title>Senior Analyst - Data Science | Best Consulting Firm In Life Sciences Industry</title>
      </head>
      <body>
        <h1 id="brxe-nknjgr" class="brxe-heading banner-heading">Senior Analyst - Data Science</h1>
        <ul id="brxe-qrfrgi" class="brxe-social-icons">
          <li class="repeater-item no-link"><span>IND - Chennai</span></li>
        </ul>
        <div id="brxe-dkjlpa" class="brxe-text body-content">
          <h2>Position Summary</h2>
          <p>Candidates would support internal teams and clients in driving strategic decisions, applying predictive analytics and machine learning concepts to solve business problems within the pharmaceutical domain.</p>
          <h2>Required Skills and Qualifications</h2>
          <ul>
            <li>Senior Analyst: 3+ years Needed</li>
            <li>Python, SAS, Tableau</li>
          </ul>
        </div>
        <h2 id="brxe-oednkd" class="brxe-heading site-heading-medium">How to Apply</h2>
        <div id="brxe-tmrxgw" class="brxe-text body-content-20px">
          <ul>
            <li>Please apply directly to SRI at <a href="mailto:Chennairecruiter@srinsights.com">Chennairecruiter@srinsights.com</a></li>
          </ul>
        </div>
        <a id="brxe-qnkwbz" class="brxe-button primary-button bricks-button bricks-background-primary" href="mailto:chennairecruiter@srinsights.com?subject=Application%20for%20Senior%20Data%20Science">Apply now</a>
      </body>
    </html>
  `,
}

const loadSriModule = async () => {
  try {
    return await import('./script.js')
  } catch (error) {
    assert.fail(
      `Expected Strategic Research Insights scraper module at ./script.js (${error.code || error.message})`,
    )
  }
}

test('Strategic Research Insights constants stay pinned to the verified official surfaces', async () => {
  const sri = await loadSriModule()

  assert.equal(sri.SOURCE, 'strategicresearchinsightssri')
  assert.equal(sri.COMPANY, 'Strategic Research Insights')
  assert.equal(sri.HOMEPAGE_URL, 'https://www.srinsights.com/')
  assert.equal(sri.CAREERS_URL, 'https://www.srinsights.com/careers/')
  assert.equal(sri.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(sri.hasOfficialCareersSignal(careersHtml), true)
})

test('extractJobCards parses the verified careers grid and narrows it to India openings', async () => {
  const sri = await loadSriModule()

  const cards = sri.extractJobCards(careersHtml)
  const indiaCards = sri.extractIndiaJobCards(careersHtml)

  assert.equal(cards.length, 5)
  assert.equal(indiaCards.length, 4)
  assert.deepEqual(indiaCards.map((card) => card.title), [
    'Sr. Analyst/Lead Analyst-Survey Programming',
    'Associate Consultant - Business Insights',
    'Associate Manager - Data Science',
    'Senior Analyst - Data Science',
  ])
  assert.deepEqual(indiaCards[0], {
    title: 'Sr. Analyst/Lead Analyst-Survey Programming',
    summary: 'We are seeking a highly skilled Sr. Analyst / Lead Analyst - Survey Programming to join our Programming and Quality Control team in Hyderabad.',
    location: 'Hyderabad',
    detailUrl: 'https://www.srinsights.com/job/sr-analyst-lead-analyst-survey-programming/',
    jobId: 'sr-analyst-lead-analyst-survey-programming',
    requisitionId: 'sr-analyst-lead-analyst-survey-programming',
  })
})

test('extractJobDetail enriches an India opening from the verified first-party detail page', async () => {
  const sri = await loadSriModule()

  const listing = sri.extractIndiaJobCards(careersHtml)[0]
  const detail = sri.extractJobDetail(
    detailPages['https://www.srinsights.com/job/sr-analyst-lead-analyst-survey-programming/'],
    listing,
  )

  assert.deepEqual(detail, {
    title: 'Sr. Analyst/Lead Analyst-Survey Programming',
    company: 'Strategic Research Insights',
    department: null,
    location: 'Hyderabad, India',
    city: 'Hyderabad',
    state: null,
    country: 'India',
    jobId: 'sr-analyst-lead-analyst-survey-programming',
    requisitionId: 'sr-analyst-lead-analyst-survey-programming',
    sourceUrl: 'https://www.srinsights.com/job/sr-analyst-lead-analyst-survey-programming/',
    applyUrl: 'mailto:programmingrecruiter@srinsights.com?subject=Application%20for%20Survey%20Programming',
    employmentType: null,
    workplaceType: null,
    experienceRequired: '4+ years Needed',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'BASIC INFORMATION: Job Title: Sr. Analyst/Lead Analyst-Survey Programming Job Location: Hyderabad, India POSITION SUMMARY: We are seeking a highly skilled Sr. Analyst / Lead Analyst - Survey Programming to join our Programming and Quality Control team in Hyderabad. REQUIRED SKILLS: - Lead Analyst: 4+ years Needed - Confirmit / Decipher survey scripting',
  })
})

test('run validates the official surfaces, follows India detail pages, and decorates the results', async () => {
  const sri = await loadSriModule()
  const requestedUrls = []

  const jobs = await sri.createStrategicResearchInsightsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === sri.HOMEPAGE_URL) return homepageHtml
      if (url === sri.CAREERS_URL) return careersHtml
      if (detailPages[url]) return detailPages[url]

      throw new Error(`Unexpected Strategic Research Insights fixture URL: ${url}`)
    },
    now: () => '2026-07-13T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    sri.HOMEPAGE_URL,
    sri.CAREERS_URL,
    'https://www.srinsights.com/job/sr-analyst-lead-analyst-survey-programming/',
    'https://www.srinsights.com/job/associate-consultant-business-insights/',
    'https://www.srinsights.com/job/associate-manager-data-science/',
    'https://www.srinsights.com/job/senior-analyst-data-science/',
  ])
  assert.equal(jobs.length, 4)
  assert.deepEqual(jobs.map((job) => job.title), [
    'Sr. Analyst/Lead Analyst-Survey Programming',
    'Associate Consultant - Business Insights',
    'Associate Manager - Data Science',
    'Senior Analyst - Data Science',
  ])
  assert.equal(jobs[0].source, 'strategicresearchinsightssri')
  assert.equal(jobs[0].companyCareerPage, 'https://www.srinsights.com/careers/')
  assert.equal(jobs[0].companyDomain, 'srinsights.com')
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
  assert.equal(jobs[0].link, 'mailto:programmingrecruiter@srinsights.com?subject=Application%20for%20Survey%20Programming')
  assert.equal(jobs[0].scrapedAt, '2026-07-13T00:00:00.000Z')
})

test('the scraper fails closed when the verified homepage, careers page, or detail contract drifts', async () => {
  const sri = await loadSriModule()

  await assert.rejects(
    sri.createStrategicResearchInsightsScraper().run({
      fetchText: async (url) => {
        if (url === sri.HOMEPAGE_URL) {
          return homepageHtml.replace('https://www.srinsights.com/careers/', 'https://www.srinsights.com/about-us/')
        }

        throw new Error(`Unexpected Strategic Research Insights fixture URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    sri.createStrategicResearchInsightsScraper().run({
      fetchText: async (url) => {
        if (url === sri.HOMEPAGE_URL) return homepageHtml
        if (url === sri.CAREERS_URL) {
          return careersHtml.replace('data-query-vars="{&quot;post_type&quot;:[&quot;job&quot;],&quot;posts_per_page&quot;:-1}"', '')
        }

        throw new Error(`Unexpected Strategic Research Insights fixture URL: ${url}`)
      },
    }),
    /verified public careers page/i,
  )

  await assert.rejects(
    sri.createStrategicResearchInsightsScraper().run({
      fetchText: async (url) => {
        if (url === sri.HOMEPAGE_URL) return homepageHtml
        if (url === sri.CAREERS_URL) return careersHtml
        if (url === 'https://www.srinsights.com/job/sr-analyst-lead-analyst-survey-programming/') {
          return detailPages[url].replace('Apply now', 'Contact us')
        }
        if (detailPages[url]) return detailPages[url]

        throw new Error(`Unexpected Strategic Research Insights fixture URL: ${url}`)
      },
    }),
    /verified first-party detail page/i,
  )
})
