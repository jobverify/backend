import assert from 'node:assert/strict'
import test from 'node:test'

const loadAabasoftModule = async () => {
  try {
    return await import('../../scraper/aabasoft/script.js')
  } catch {
    return null
  }
}

const verifiedHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Offshore Software Development Company Kerala, India | Aabasoft</title>
  </head>
  <body>
    <nav>
      <a href="/in-en/our-culture/">Our Culture</a>
      <a href="/in-en/career/">Careers</a>
      <a href="/in-en/placement-drive/">Campus Placement</a>
    </nav>
    <main>
      <h1>Transform your business with the power of WEB</h1>
    </main>
  </body>
</html>
`

const verifiedCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Aabasoft Careers| Aabasoft</title>
  </head>
  <body>
    <section class="inner-banner career-banner">
      <h2 class="main-head">Aabasoft <span>Career</span></h2>
    </section>
    <section class="career">
      <div class="container">
        <h2 class="main-head text-center">Current <span>Openings</span></h2>
        <ul id="portfolio-filter" class="clearfix">
          <li class="col-sm-2 col-xs-4">
            <a href="#careers-list-box" data-filter=".cloudtech">
              <div class="career-list-boxe">
                <h4>Cloud Technologies</h4>
                <button class="button">View Job</button>
              </div>
            </a>
          </li>
          <li class="col-sm-2 col-xs-4">
            <a href="#careers-list-box" data-filter=".bposervices">
              <div class="career-list-boxe">
                <h4>BPO Services</h4>
                <button class="button">View Job</button>
              </div>
            </a>
          </li>
        </ul>
      </div>
    </section>
    <section class="career-listing-filter" id="careers-list-box">
      <div class="container">
        <div id="portfolio" class="clearfix">
          <article class="col-md-3 col-sm-6 col-xs-12 portfolio-item bposervices">
            <div class="portfolio-desc">
              <div class="crescnt">
                <h3>BPO Services</h3>
                <span>SALES AND FINANCE ADVISOR</span>
                <p>We are hiring..</p>
              </div>
              <a class="button" href="/in-en/CarrerDetails/Sales-and-Finance-Advisor89410">Apply Now</a>
            </div>
          </article>
          <article class="col-md-3 col-sm-6 col-xs-12 portfolio-item cloudtech">
            <div class="portfolio-desc">
              <div class="crescnt">
                <h3>Cloud Technologies</h3>
                <span>BUSINESS DEVELOPMENT EXECUTIVE – CLOUD SERVICES</span>
                <p>We are Hiring..</p>
              </div>
              <a class="button" href="/in-en/CarrerDetails/Business-Development-Executive-–-Cloud-Services">Apply Now</a>
            </div>
          </article>
        </div>
      </div>
    </section>
  </body>
</html>
`

const salesAdvisorDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Sales and Finance Advisor</title>
  </head>
  <body>
    <section class="page-nav">
      <nav>
        <a href="/in-en/career/">Job List</a>
        <a href="#">Job Details</a>
      </nav>
    </section>
    <section class="career">
      <div class="container">
        <div class="row">
          <div class="col-md-7 career-det-left">
            <h3 class="career-head">Sales and Finance Advisor</h3>
            <p>Conduct outbound calls to potential customers to promote products.</p>
            <div class="panel-group" id="accordion" role="tablist" aria-multiselectable="true">
              <div class="panel panel-default">
                <div class="panel-heading" role="tab" id="headingOne">
                  <h4 class="panel-title">
                    <a role="button" data-toggle="collapse" data-parent="#accordion" href="#collapseOne">
                      <i class="fa fa-file-text" aria-hidden="true"></i>Requirements
                    </a>
                  </h4>
                </div>
                <div id="collapseOne" class="panel-collapse collapse in">
                  <div class="panel-body">
                    <ul>
                      <p>Ensure customer satisfaction through professional and effective communication.</p>
                      <p>Achieve daily/monthly call targets, lead generation goals, and performance KPIs.</p>
                    </ul>
                  </div>
                </div>
              </div>
              <div class="panel panel-default">
                <div class="panel-heading" role="tab" id="headingTwo">
                  <h4 class="panel-title">
                    <a class="collapsed" role="button" data-toggle="collapse" data-parent="#accordion" href="#collapseTwo">
                      <i class="fa fa-diamond" aria-hidden="true"></i> What we Expect from you?
                    </a>
                  </h4>
                </div>
                <div id="collapseTwo" class="panel-collapse collapse">
                  <div class="panel-body">
                    <p>Basic computer skills with hands-on experience in CRM tools.</p>
                    <p>Positive attitude, target-driven approach, and readiness to learn industry fundamentals.</p>
                  </div>
                </div>
              </div>
              <div class="panel panel-default">
                <div class="panel-heading" role="tab" id="headingThree">
                  <h4 class="panel-title">
                    <a class="collapsed" role="button" data-toggle="collapse" data-parent="#accordion" href="#collapseThree">
                      <i class="fa fa-briefcase" aria-hidden="true"></i> What you've got?
                    </a>
                  </h4>
                </div>
                <div id="collapseThree" class="panel-collapse collapse">
                  <div class="panel-body">
                    <p>Experience: Minimum 1 year of experience in loans or solar related roles are preferred.</p>
                    <p>Strong communication skills in English and Malayalam.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="col-md-5 career-det-right">
            <form action="/in-en/carrerdetails/" enctype="multipart/form-data" method="post">
              <input type="hidden" name="jUnique" value="Sales-and-Finance-Advisor89410" />
              <h3 class="career-head">Apply <span>Now</span></h3>
              <button type="submit" class="button">Send Application</button>
            </form>
          </div>
        </div>
      </div>
    </section>
  </body>
</html>
`

const cloudSalesDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Business Development Executive – Cloud Services</title>
  </head>
  <body>
    <section class="page-nav">
      <nav>
        <a href="/in-en/career/">Job List</a>
        <a href="#">Job Details</a>
      </nav>
    </section>
    <section class="career">
      <div class="container">
        <div class="row">
          <div class="col-md-7 career-det-left">
            <h3 class="career-head">Business Development Executive – Cloud Services</h3>
            <p>Business Development by formulating and executing effective sales strategy.</p>
            <div class="panel-group" id="accordion" role="tablist" aria-multiselectable="true">
              <div class="panel panel-default">
                <div class="panel-heading" role="tab" id="headingOne">
                  <h4 class="panel-title">
                    <a role="button" data-toggle="collapse" data-parent="#accordion" href="#collapseOne">
                      <i class="fa fa-file-text" aria-hidden="true"></i>Requirements
                    </a>
                  </h4>
                </div>
                <div id="collapseOne" class="panel-collapse collapse in">
                  <div class="panel-body">
                    <ul>
                      <p>Developing a database of qualified leads through referrals, telephone canvassing, and Digital Marketing.</p>
                      <p>The candidate must have minimum total 4 years' experience and 2 years' relevant experience of successfully selling Cloud services and solutions.</p>
                    </ul>
                  </div>
                </div>
              </div>
              <div class="panel panel-default">
                <div class="panel-heading" role="tab" id="headingTwo">
                  <h4 class="panel-title">
                    <a class="collapsed" role="button" data-toggle="collapse" data-parent="#accordion" href="#collapseTwo">
                      <i class="fa fa-diamond" aria-hidden="true"></i> What we Expect from you?
                    </a>
                  </h4>
                </div>
                <div id="collapseTwo" class="panel-collapse collapse">
                  <div class="panel-body">
                    <p>The candidate should be experienced in handling OEM's.</p>
                    <p>Job Location – Chennai &amp; Hyderabad, Trivandrum &amp; Calicut, Kochi</p>
                  </div>
                </div>
              </div>
              <div class="panel panel-default">
                <div class="panel-heading" role="tab" id="headingThree">
                  <h4 class="panel-title">
                    <a class="collapsed" role="button" data-toggle="collapse" data-parent="#accordion" href="#collapseThree">
                      <i class="fa fa-briefcase" aria-hidden="true"></i> What you've got?
                    </a>
                  </h4>
                </div>
                <div id="collapseThree" class="panel-collapse collapse">
                  <div class="panel-body">
                    <p>Strong project management skills with the ability to manage multiple priorities and meet deadlines.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="col-md-5 career-det-right">
            <form action="/in-en/carrerdetails/" enctype="multipart/form-data" method="post">
              <input type="hidden" name="jUnique" value="Business-Development-Executive-–-Cloud-Services" />
              <h3 class="career-head">Apply <span>Now</span></h3>
              <button type="submit" class="button">Send Application</button>
            </form>
          </div>
        </div>
      </div>
    </section>
  </body>
</html>
`

const kochiListingCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Aabasoft Careers| Aabasoft</title>
  </head>
  <body>
    <h2 class="main-head">Aabasoft <span>Career</span></h2>
    <h2 class="main-head text-center">Current <span>Openings</span></h2>
    <section id="careers-list-box">
      <article class="col-md-3 portfolio-item webmobile">
        <div class="portfolio-desc">
          <h3>Web &amp; Mobile</h3>
          <span>BUSINESS ANALYST</span>
          <p>We are hiring for Kochi location..</p>
          <a class="button" href="/in-en/CarrerDetails/Business-Analyst">Apply Now</a>
        </div>
      </article>
    </section>
  </body>
</html>
`

const businessAnalystDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Business Analyst</title>
  </head>
  <body>
    <a href="/in-en/career/">Job List</a>
    <a href="#">Job Details</a>
    <div class="col-md-7 career-det-left">
      <h3 class="career-head">Business Analyst</h3>
      <p>Translate business needs into clear functional requirements.</p>
      <div class="panel-group">
        <div class="panel panel-default">
          <h4 class="panel-title"><a>Requirements</a></h4>
          <div class="panel-body"><p>Strong analytical and documentation skills.</p></div>
        </div>
      </div>
    </div>
    <form action="/in-en/carrerdetails/" method="post">
      <button type="submit">Send Application</button>
    </form>
  </body>
</html>
`

const workLocationCareersHtml = kochiListingCareersHtml
  .replace('We are hiring for Kochi location..', 'We are hiring..')

const workLocationDetailHtml = businessAnalystDetailHtml
  .replace(
    'Translate business needs into clear functional requirements.',
    'Translate business needs into clear functional requirements.</p><p>Work Location: Kochi',
  )

test('Aabasoft validates the verified homepage, careers page, listing cards, and detail pages', async () => {
  const aabasoft = await loadAabasoftModule()
  assert.ok(aabasoft, 'Expected Aabasoft scraper module at ../../scraper/aabasoft/script.js')

  assert.equal(aabasoft.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(aabasoft.hasOfficialCareersSignal(verifiedCareersHtml), true)
  assert.deepEqual(
    aabasoft.extractListingCards(verifiedCareersHtml),
    [
      {
        department: 'BPO Services',
        listingTitle: 'SALES AND FINANCE ADVISOR',
        listingSummary: 'We are hiring..',
        sourceUrl: 'https://www.aabasoft.com/in-en/CarrerDetails/Sales-and-Finance-Advisor89410',
      },
      {
        department: 'Cloud Technologies',
        listingTitle: 'BUSINESS DEVELOPMENT EXECUTIVE – CLOUD SERVICES',
        listingSummary: 'We are Hiring..',
        sourceUrl: 'https://www.aabasoft.com/in-en/CarrerDetails/Business-Development-Executive-%E2%80%93-Cloud-Services',
      },
    ],
  )
  assert.equal(aabasoft.hasOfficialDetailPageSignal(salesAdvisorDetailHtml), true)
  assert.equal(aabasoft.hasOfficialDetailPageSignal(cloudSalesDetailHtml), true)
})

test('Aabasoft uses an official listing-card location when the detail page omits location', async () => {
  const aabasoft = await loadAabasoftModule()
  assert.ok(aabasoft, 'Expected Aabasoft scraper module at ../../scraper/aabasoft/script.js')

  const jobs = await aabasoft.createAabasoftScraper({
    now: () => '2026-09-12T10:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      if (url === aabasoft.HOMEPAGE_URL) return verifiedHomepageHtml
      if (url === aabasoft.CAREERS_URL) return kochiListingCareersHtml
      if (url === 'https://www.aabasoft.com/in-en/CarrerDetails/Business-Analyst') {
        return businessAnalystDetailHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Business Analyst')
  assert.equal(jobs[0].location, 'Kochi')
  assert.equal(jobs[0].city, 'Kochi')
})

test('Aabasoft extracts an explicit work-location label from detail content', async () => {
  const aabasoft = await loadAabasoftModule()
  assert.ok(aabasoft, 'Expected Aabasoft scraper module at ../../scraper/aabasoft/script.js')

  const jobs = await aabasoft.createAabasoftScraper().run({
    fetchText: async (url) => {
      if (url === aabasoft.HOMEPAGE_URL) return verifiedHomepageHtml
      if (url === aabasoft.CAREERS_URL) return workLocationCareersHtml
      if (url === 'https://www.aabasoft.com/in-en/CarrerDetails/Business-Analyst') {
        return workLocationDetailHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.equal(jobs[0].location, 'Kochi')
  assert.equal(jobs[0].city, 'Kochi')
})

test('Aabasoft run validates the first-party careers flow and returns normalized jobs from detail pages', async () => {
  const aabasoft = await loadAabasoftModule()
  assert.ok(aabasoft, 'Expected Aabasoft scraper module at ../../scraper/aabasoft/script.js')

  const requestedUrls = []

  const jobs = await aabasoft.createAabasoftScraper({
    now: () => '2026-07-14T10:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === aabasoft.HOMEPAGE_URL) return verifiedHomepageHtml
      if (url === aabasoft.CAREERS_URL) return verifiedCareersHtml
      if (url === 'https://www.aabasoft.com/in-en/CarrerDetails/Sales-and-Finance-Advisor89410') {
        return salesAdvisorDetailHtml
      }
      if (url === 'https://www.aabasoft.com/in-en/CarrerDetails/Business-Development-Executive-%E2%80%93-Cloud-Services') {
        return cloudSalesDetailHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    aabasoft.HOMEPAGE_URL,
    aabasoft.CAREERS_URL,
    'https://www.aabasoft.com/in-en/CarrerDetails/Sales-and-Finance-Advisor89410',
    'https://www.aabasoft.com/in-en/CarrerDetails/Business-Development-Executive-%E2%80%93-Cloud-Services',
  ])

  assert.deepEqual(
    jobs.map((job) => job.title),
    [
      'Business Development Executive – Cloud Services',
      'Sales and Finance Advisor',
    ],
  )

  const cloudRole = jobs.find((job) => job.jobId === 'aabasoft-business-development-executive-cloud-services')
  const salesRole = jobs.find((job) => job.jobId === 'aabasoft-sales-and-finance-advisor89410')

  assert.deepEqual(cloudRole, {
    title: 'Business Development Executive – Cloud Services',
    company: 'Aabasoft',
    department: 'Cloud Technologies',
    location: 'Chennai & Hyderabad, Trivandrum & Calicut, Kochi',
    city: 'Chennai',
    country: 'India',
    jobId: 'aabasoft-business-development-executive-cloud-services',
    requisitionId: 'aabasoft-business-development-executive-cloud-services',
    sourceUrl: 'https://www.aabasoft.com/in-en/CarrerDetails/Business-Development-Executive-%E2%80%93-Cloud-Services',
    applyUrl: 'https://www.aabasoft.com/in-en/CarrerDetails/Business-Development-Executive-%E2%80%93-Cloud-Services',
    employmentType: null,
    workplaceType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Developing a database of qualified leads through referrals, telephone canvassing, and Digital Marketing.',
      "The candidate must have minimum total 4 years' experience and 2 years' relevant experience of successfully selling Cloud services and solutions.",
      "The candidate should be experienced in handling OEM's.",
      'Strong project management skills with the ability to manage multiple priorities and meet deadlines.',
    ],
    compensation: null,
    postingDate: null,
    closingDate: null,
    jobDescription: [
      'Business Development by formulating and executing effective sales strategy.',
      '',
      'Requirements',
      '- Developing a database of qualified leads through referrals, telephone canvassing, and Digital Marketing.',
      "- The candidate must have minimum total 4 years' experience and 2 years' relevant experience of successfully selling Cloud services and solutions.",
      '',
      'What we Expect from you?',
      "- The candidate should be experienced in handling OEM's.",
      '- Job Location – Chennai & Hyderabad, Trivandrum & Calicut, Kochi',
      '',
      "What you've got?",
      '- Strong project management skills with the ability to manage multiple priorities and meet deadlines.',
    ].join('\n'),
    source: 'aabasoft',
    companyCareerPage: 'https://www.aabasoft.com/in-en/career/',
    companyDomain: 'aabasoft.com',
    atsPlatform: 'official-company-careers',
    link: 'https://www.aabasoft.com/in-en/CarrerDetails/Business-Development-Executive-%E2%80%93-Cloud-Services',
    scrapedAt: '2026-07-14T10:00:00.000Z',
  })

  assert.deepEqual(salesRole, {
    title: 'Sales and Finance Advisor',
    company: 'Aabasoft',
    department: 'BPO Services',
    location: null,
    city: null,
    country: 'India',
    jobId: 'aabasoft-sales-and-finance-advisor89410',
    requisitionId: 'aabasoft-sales-and-finance-advisor89410',
    sourceUrl: 'https://www.aabasoft.com/in-en/CarrerDetails/Sales-and-Finance-Advisor89410',
    applyUrl: 'https://www.aabasoft.com/in-en/CarrerDetails/Sales-and-Finance-Advisor89410',
    employmentType: null,
    workplaceType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Ensure customer satisfaction through professional and effective communication.',
      'Achieve daily/monthly call targets, lead generation goals, and performance KPIs.',
      'Basic computer skills with hands-on experience in CRM tools.',
      'Positive attitude, target-driven approach, and readiness to learn industry fundamentals.',
      'Experience: Minimum 1 year of experience in loans or solar related roles are preferred.',
      'Strong communication skills in English and Malayalam.',
    ],
    compensation: null,
    postingDate: null,
    closingDate: null,
    jobDescription: [
      'Conduct outbound calls to potential customers to promote products.',
      '',
      'Requirements',
      '- Ensure customer satisfaction through professional and effective communication.',
      '- Achieve daily/monthly call targets, lead generation goals, and performance KPIs.',
      '',
      'What we Expect from you?',
      '- Basic computer skills with hands-on experience in CRM tools.',
      '- Positive attitude, target-driven approach, and readiness to learn industry fundamentals.',
      '',
      "What you've got?",
      '- Experience: Minimum 1 year of experience in loans or solar related roles are preferred.',
      '- Strong communication skills in English and Malayalam.',
    ].join('\n'),
    source: 'aabasoft',
    companyCareerPage: 'https://www.aabasoft.com/in-en/career/',
    companyDomain: 'aabasoft.com',
    atsPlatform: 'official-company-careers',
    link: 'https://www.aabasoft.com/in-en/CarrerDetails/Sales-and-Finance-Advisor89410',
    scrapedAt: '2026-07-14T10:00:00.000Z',
  })
})

test('Aabasoft fails closed when the verified homepage, careers page, or detail page drifts', async () => {
  const aabasoft = await loadAabasoftModule()
  assert.ok(aabasoft, 'Expected Aabasoft scraper module at ../../scraper/aabasoft/script.js')

  await assert.rejects(
    aabasoft.createAabasoftScraper().run({
      fetchText: async (url) => {
        if (url === aabasoft.HOMEPAGE_URL) return '<html><title>Unexpected</title></html>'
        if (url === aabasoft.CAREERS_URL) return verifiedCareersHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    aabasoft.createAabasoftScraper().run({
      fetchText: async (url) => {
        if (url === aabasoft.HOMEPAGE_URL) return verifiedHomepageHtml
        if (url === aabasoft.CAREERS_URL) {
          return verifiedCareersHtml.replace('Current <span>Openings</span>', 'Career Stories')
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified careers page/i,
  )

  await assert.rejects(
    aabasoft.createAabasoftScraper().run({
      fetchText: async (url) => {
        if (url === aabasoft.HOMEPAGE_URL) return verifiedHomepageHtml
        if (url === aabasoft.CAREERS_URL) return verifiedCareersHtml
        if (url === 'https://www.aabasoft.com/in-en/CarrerDetails/Sales-and-Finance-Advisor89410') {
          return '<html><title>Sales and Finance Advisor</title><body><h1>Broken</h1></body></html>'
        }
        if (url === 'https://www.aabasoft.com/in-en/CarrerDetails/Business-Development-Executive-%E2%80%93-Cloud-Services') {
          return cloudSalesDetailHtml
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /detail page/i,
  )
})


const currentCmsPosting = (guid, city) => ({
  guid, contentType: 'careerDetails',
  properties: {
    cdVacancyTitle: { value: 'Business Development Manager – Cloud Services' },
    cdJobLocation: { value: [{ name: city }] },
  },
})

test('Aabasoft retains distinct CMS roles that share the official title-based application URL', async () => {
  const aabasoft = await loadAabasoftModule()
  assert.ok(aabasoft)
  const jobs = aabasoft.normalizeCurrentJobs([
    currentCmsPosting('0dd48335-37df-4af4-84e1-0b9121af5073', 'Bangalore'),
    currentCmsPosting('e7c856bd-bd57-483e-8dca-0de266cc1740', 'Kochi'),
  ], () => '2026-10-08T17:00:00.000Z')
  assert.deepEqual(jobs.map(job => [job.jobId, job.city]), [
    ['0dd48335-37df-4af4-84e1-0b9121af5073', 'Bangalore'],
    ['e7c856bd-bd57-483e-8dca-0de266cc1740', 'Kochi'],
  ])
  assert.ok(jobs.every(job => job.applyUrl === 'https://aabasoft.com/in-en/join-our-team/business-development-manager-cloud-services'))
})

test('Aabasoft still rejects duplicate CMS role IDs', async () => {
  const aabasoft = await loadAabasoftModule()
  assert.ok(aabasoft)
  assert.throws(() => aabasoft.normalizeCurrentJobs([
    currentCmsPosting('0dd48335-37df-4af4-84e1-0b9121af5073', 'Bangalore'),
    currentCmsPosting('0dd48335-37df-4af4-84e1-0b9121af5073', 'Kochi'),
  ], () => '2026-10-08T17:00:00.000Z'), /invalid or duplicate role/)
})
