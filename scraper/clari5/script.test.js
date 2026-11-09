import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_URL = 'https://www.clari5.com/'
const CAREERS_URL = 'https://www.clari5.com/careers/'
const CAREERS_PAGE_2_URL = 'https://www.clari5.com/careers/page/2/'
const AML_PRODUCT_MANAGER_URL =
  'https://www.clari5.com/careers/product-manager-transaction-monitoring-tm-analytics-reporting/'
const INDONESIA_SALES_DIRECTOR_URL =
  'https://www.clari5.com/careers/country-sales-director-indonesia/'
const UI_DEVELOPER_URL = 'https://www.clari5.com/careers/ui-developer/'
const SENIOR_SOFTWARE_ENGINEER_URL =
  'https://www.clari5.com/careers/senior-software-engineer-java-spring/'

const buildHomepageHtml = () => `
<!DOCTYPE html>
<html lang="en-US">
<head>
  <title>AI Fraud Detection &amp; AML Software for Banks | Clari5</title>
  <link rel="canonical" href="${HOMEPAGE_URL}" />
  <meta property="og:site_name" content="Clari5" />
  <script type="application/ld+json">
    {"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"Clari5","url":"https://www.clari5.com"}]}
  </script>
</head>
<body>
  <a href="${CAREERS_URL}">Careers</a>
  <p>Real-time fraud detection, AML compliance and financial crime prevention software trusted by global banks.</p>
</body>
</html>
`

const buildArchiveListingHtml = ({
  jobId,
  title,
  sourceUrl,
  employmentType,
  location,
  postedText,
  category,
  excerpt,
}) => `
<div class="list-data">
  <div class="v2 sjb-job-${jobId}">
    <header>
      <div class="row">
        <div class="col-md-12 col-sm-12">
          <div class="sjb-company-wrapper-details-list">
            <div class="row">
              <div class="col-md-8 col-sm-8">
                <div class="sjb-without-logo">
                  <div class="job-info job-without-company">
                    <h4>
                      <a href="${sourceUrl}">
                        <span class="job-title">${title}</span>
                      </a>
                    </h4>
                  </div>
                </div>
              </div>
              <div class="col-md-4 col-sm-4 col-xs-12 sjb-apply-now-btn">
                <p><a href="${sourceUrl}" class="btn btn-primary ">Apply Now</a></p>
              </div>
            </div>
          </div>
        </div>
        <div class="clearfix"></div>
        <div class="col-md-12 col-sm-12">
          <div class="sjb-job-type-location-date">
            <div class="row">
              <div class="col-md-2 col-sm-4 col-xs-12">
                <div class="job-type"><i class="fa fa-briefcase"></i>${employmentType}</div>
              </div>
              <div class="col-md-3 col-sm-4 col-xs-12">
                <div class="job-location"><i class="fa fa-map-marker"></i>${location}</div>
              </div>
              <div class="col-md-4 col-sm-4 col-xs-12">
                <div class="job-date"><i class="fa fa-calendar-check"></i>${postedText}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
    <div class="sjb_more_content" id="sjb_more_content_${jobId}">
      <strong>Summary:</strong>
      ${excerpt}
      <div class="job-features">
        <h3>Job Features</h3>
        <table class="table">
          <tbody>
            <div class="row">
              <div class="col-md-3 col-sm-6">
                <div class="sjb-title-value">
                  <h4><i class="fab fa-black-tie" aria-hidden="true"></i>Job Category</h4>
                  <p>${category}</p>
                </div>
              </div>
            </div>
          </tbody>
        </table>
      </div>
    </div>
    <div class="job-description-list">
      <div id="sjb_less_content_${jobId}"><p>${excerpt}</p></div>
    </div>
  </div>
</div>
`

const buildArchivePageHtml = ({
  canonicalUrl,
  title,
  nextUrl = null,
  prevUrl = null,
  listings,
}) => `
<!DOCTYPE html>
<html lang="en-US">
<head>
  <title>${title}</title>
  <meta name="description" content="Jobs Archive - Clari5" />
  <link rel="canonical" href="${canonicalUrl}" />
  ${nextUrl ? `<link rel="next" href="${nextUrl}" />` : ''}
  ${prevUrl ? `<link rel="prev" href="${prevUrl}" />` : ''}
  <link rel="alternate" type="application/rss+xml" title="Clari5 Jobs Feed" href="${CAREERS_URL}feed/" />
  <link rel="stylesheet" id="sjb_shortcode_block-cgb-style-css-css" href="https://www.clari5.com/wp-content/plugins/simple-job-board/sjb-block/dist/blocks.style.build.css" media="all" />
</head>
<body class="archive post-type-archive post-type-archive-jobpost wp-theme-qiworks sjb">
  <div class="sjb-page">
    <div class="sjb-filters sjb-filters-v2">
      <div class="sjb-search-keywords col-md-12 col-xs-12">Keywords</div>
      <div class="sjb-search-categories col-md-3 col-xs-12">Category</div>
      <div class="sjb-search-job-type col-md-3 col-xs-12">Job Type</div>
      <div class="sjb-search-location col-md-3 col-xs-12">Location</div>
      <div class="sjb-search-button col-md-3 col-xs-12"><input class="btn-search btn btn-primary" value="&#xf002;" type="submit"></div>
    </div>
    <div class="sjb-listing">
      <div class="list-view">
        ${listings.join('\n')}
      </div>
    </div>
  </div>
  <script id="simple-job-board-front-end-js" src="https://www.clari5.com/wp-content/plugins/simple-job-board/public/js/simple-job-board-public.js?ver=1.4.0"></script>
</body>
</html>
`

const buildDetailPageHtml = ({
  jobId,
  title,
  canonicalUrl,
  employmentType,
  location,
  postedText,
  category,
  descriptionHtml,
}) => `
<!DOCTYPE html>
<html lang="en-US">
<head>
  <title>${title} - Clari5</title>
  <link rel="canonical" href="${canonicalUrl}" />
  <link rel="alternate" title="JSON" type="application/json" href="https://www.clari5.com/wp-json/wp/v2/jobpost/${jobId}" />
  <link rel="stylesheet" id="simple-job-board-frontend-css" href="https://www.clari5.com/wp-content/plugins/simple-job-board/public/css/simple-job-board-public.css?ver=3.0.0" media="all" />
</head>
<body class="wp-singular jobpost-template-default single single-jobpost postid-${jobId} wp-theme-qiworks sjb">
  <div class="sjb-page">
    <div class="sjb-detail">
      <div class="list-data">
        <div class="v2 sjb-job-popup-${jobId}">
          <header>
            <div class="row">
              <div class="header-margin-top sjb-job-info">
                <div class="sjb-company-wrapper-details">
                  <div class="row">
                    <div class="sjb-with-logo">
                      <div class="job-info job-without-company">
                        <h4></h4>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="sjb-job-characteristics">
                <div class="sjb-job-type-location-date">
                  <div class="row">
                    <div class="col-md-3 col-sm-4">
                      <div class="job-type"><i class="fa fa-briefcase"></i>${employmentType}</div>
                    </div>
                    <div class="col-md-3 col-sm-4">
                      <div class="job-location"><i class="fa fa-map-marker"></i>${location}</div>
                    </div>
                    <div class="col-md-3 col-sm-4">
                      <div class="job-date"><i class="fas fa-calendar-check"></i>${postedText}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </header>
          <div class="job-description">
            ${descriptionHtml}
          </div>
          <div class="job-features">
            <h3>Job Features</h3>
            <table class="table">
              <tbody>
                <div class="row">
                  <div class="col-md-3 col-sm-6">
                    <div class="sjb-title-value">
                      <h4><i class="fab fa-black-tie" aria-hidden="true"></i>Job Category</h4>
                      <p>${category}</p>
                    </div>
                  </div>
                </div>
              </tbody>
            </table>
          </div>
          <form class="jobpost-form sjb-job-detail-${jobId}" id="sjb-application-form" enctype="multipart/form-data">
            <h3>Apply For This Job</h3>
            <input type="hidden" name="job_id" value="${jobId}" />
            <input type="hidden" name="action" value="process_applicant_form" />
            <button class="btn btn-primary app-submit">Submit</button>
          </form>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`

const homepageHtml = buildHomepageHtml()

const careersPage1Html = buildArchivePageHtml({
  canonicalUrl: CAREERS_URL,
  title: 'Jobs - Clari5',
  nextUrl: CAREERS_PAGE_2_URL,
  listings: [
    buildArchiveListingHtml({
      jobId: '66558',
      title: 'AML Product Manager - KYC, Transaction Monitoring, Analytics, Reporting',
      sourceUrl: AML_PRODUCT_MANAGER_URL,
      employmentType: 'Full Time',
      location: 'Bangalore',
      postedText: 'Posted 3 months ago',
      category: 'Product Management',
      excerpt:
        'About Clari5: Clari5 is a category leader in real-time enterprise financial crime risk management and is expanding its AML capabilities.',
    }),
    buildArchiveListingHtml({
      jobId: '63908',
      title: 'Country Sales Director - Indonesia',
      sourceUrl: INDONESIA_SALES_DIRECTOR_URL,
      employmentType: 'Full Time',
      location: 'Jakarta',
      postedText: 'Posted 5 months ago',
      category: 'Sales',
      excerpt:
        'Role Overview: We are seeking a dynamic and results-driven Country Sales Director to lead Clari5 business development in Indonesia.',
    }),
    buildArchiveListingHtml({
      jobId: '62226',
      title: 'UI Developer',
      sourceUrl: UI_DEVELOPER_URL,
      employmentType: 'Full Time',
      location: 'Bangalore',
      postedText: 'Posted 6 months ago',
      category: 'Product Engineering',
      excerpt:
        'Responsibilities: Should be a team player with a keen eye for detail and problem-solving skills. React coding is must.',
    }),
  ],
})

const careersPage2Html = buildArchivePageHtml({
  canonicalUrl: CAREERS_PAGE_2_URL,
  title: 'Jobs - Page 2 of 2 - Clari5',
  prevUrl: CAREERS_URL,
  listings: [
    buildArchiveListingHtml({
      jobId: '52956',
      title: 'Senior Software Engineer - Java &amp; Spring',
      sourceUrl: SENIOR_SOFTWARE_ENGINEER_URL,
      employmentType: 'Full Time',
      location: 'Bangalore',
      postedText: 'Posted 1 year ago',
      category: 'Product Engineering',
      excerpt:
        'About the Role: We are looking for a highly skilled and experienced Senior Software Engineer with deep expertise in Java and the Spring ecosystem.',
    }),
  ],
})

const amlProductManagerHtml = buildDetailPageHtml({
  jobId: '66558',
  title: 'AML Product Manager - KYC, Transaction Monitoring, Analytics, Reporting',
  canonicalUrl: AML_PRODUCT_MANAGER_URL,
  employmentType: 'Full Time',
  location: 'Bangalore',
  postedText: 'Posted 3 months ago',
  category: 'Product Management',
  descriptionHtml: `
    <p><strong>About Clari5:</strong></p>
    <p>Clari5 is a category leader in real-time enterprise financial crime risk management.</p>
    <p><strong>About the Role:</strong></p>
    <p>Clari5 is building an advanced AML suite designed to redefine transaction intelligence and regulatory compliance.</p>
    <p><strong>Key Responsibilities:</strong></p>
    <ul>
      <li>Own the transaction monitoring module covering detection, alerting, and analytics.</li>
      <li>Collaborate with data science and engineering teams for scenario tuning and model optimization.</li>
    </ul>
    <p><strong>Preferred Experience / Expertise:</strong></p>
    <ul>
      <li>8-12 years in AML or Financial Crime Technology with TM focus.</li>
      <li>CAMS or equivalent AML certification preferred.</li>
    </ul>
    <p><strong>Experience:</strong></p>
    <p>8-12 years</p>
    <p><strong>Department:</strong></p>
    <p>Product Management Group (PMG) - AML</p>
  `,
})

const uiDeveloperHtml = buildDetailPageHtml({
  jobId: '62226',
  title: 'UI Developer',
  canonicalUrl: UI_DEVELOPER_URL,
  employmentType: 'Full Time',
  location: 'Bangalore',
  postedText: 'Posted 6 months ago',
  category: 'Product Engineering',
  descriptionHtml: `
    <p><strong>Responsibilities:</strong></p>
    <ul>
      <li>Should be a team player with a keen eye for detail and problem-solving skills.</li>
      <li>Writing and implementing programs that work as per specifications.</li>
    </ul>
    <p><strong>Requirements:</strong></p>
    <ul>
      <li>Bachelor&#8217;s degree in computer science or higher.</li>
      <li>React coding is must.</li>
      <li>Good communication skills - both written and verbal.</li>
    </ul>
    <p><strong>Qualification:</strong></p>
    <ul>
      <li>Should have relevant experience of 2-4 years.</li>
      <li>Minimum qualification: BE in CSE/IS/ECE or equivalent streams/MCA or MSc in Maths/Electronics/Computer science.</li>
    </ul>
  `,
})

const seniorSoftwareEngineerHtml = buildDetailPageHtml({
  jobId: '52956',
  title: 'Senior Software Engineer - Java &amp; Spring',
  canonicalUrl: SENIOR_SOFTWARE_ENGINEER_URL,
  employmentType: 'Full Time',
  location: 'Bangalore',
  postedText: 'Posted 1 year ago',
  category: 'Product Engineering',
  descriptionHtml: `
    <h3>About the Role</h3>
    <p>We are looking for a highly skilled and experienced Senior Software Engineer with deep expertise in Java and the Spring ecosystem.</p>
    <h3>Key Responsibilities</h3>
    <ul>
      <li>Design, develop, and maintain Java-based applications using Spring Framework and ReactJS.</li>
      <li>Write clean, maintainable, and testable code following industry best practices.</li>
    </ul>
    <h3>Technical Skills &amp; Qualifications</h3>
    <p>Must-Have:</p>
    <ul>
      <li>4+ years of experience in backend software development using Java 8 and above.</li>
      <li>Strong command of Java and Spring Framework.</li>
      <li>Experience with unit testing frameworks (JUnit, Mockito) and CI/CD pipelines.</li>
    </ul>
    <p>Bonus!</p>
    <ul>
      <li>Experience in fraud detection, risk scoring, or financial compliance systems.</li>
      <li>Expertise in ReactJS.</li>
    </ul>
  `,
})

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Clari5 scraper module at ./script.js')
  }
}

test('Clari5 sentinels recognize the verified homepage and paginated first-party careers archive', async () => {
  const clari5 = await loadModule()

  assert.equal(clari5.SOURCE, 'clari5')
  assert.equal(clari5.COMPANY, 'Clari5')
  assert.equal(clari5.HOMEPAGE_URL, HOMEPAGE_URL)
  assert.equal(clari5.CAREERS_URL, CAREERS_URL)
  assert.equal(clari5.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(clari5.hasOfficialCareersPageSignal(careersPage1Html), true)
  assert.equal(clari5.hasOfficialCareersPageSignal(careersPage2Html), true)
  assert.equal(clari5.extractNextPageUrl(careersPage1Html), CAREERS_PAGE_2_URL)
  assert.equal(clari5.extractNextPageUrl(careersPage2Html), null)
})

test('Clari5 extracts first-party archive listings across India and non-India locations', async () => {
  const clari5 = await loadModule()

  assert.deepEqual(clari5.extractArchiveListings(careersPage1Html), [
    {
      jobId: '66558',
      title: 'AML Product Manager - KYC, Transaction Monitoring, Analytics, Reporting',
      sourceUrl: AML_PRODUCT_MANAGER_URL,
      employmentType: 'Full Time',
      location: 'Bangalore',
      postedText: 'Posted 3 months ago',
      category: 'Product Management',
      excerpt:
        'About Clari5: Clari5 is a category leader in real-time enterprise financial crime risk management and is expanding its AML capabilities.',
    },
    {
      jobId: '63908',
      title: 'Country Sales Director - Indonesia',
      sourceUrl: INDONESIA_SALES_DIRECTOR_URL,
      employmentType: 'Full Time',
      location: 'Jakarta',
      postedText: 'Posted 5 months ago',
      category: 'Sales',
      excerpt:
        'Role Overview: We are seeking a dynamic and results-driven Country Sales Director to lead Clari5 business development in Indonesia.',
    },
    {
      jobId: '62226',
      title: 'UI Developer',
      sourceUrl: UI_DEVELOPER_URL,
      employmentType: 'Full Time',
      location: 'Bangalore',
      postedText: 'Posted 6 months ago',
      category: 'Product Engineering',
      excerpt:
        'Responsibilities: Should be a team player with a keen eye for detail and problem-solving skills. React coding is must.',
    },
  ])

  assert.deepEqual(clari5.extractArchiveListings(careersPage2Html), [
    {
      jobId: '52956',
      title: 'Senior Software Engineer - Java & Spring',
      sourceUrl: SENIOR_SOFTWARE_ENGINEER_URL,
      employmentType: 'Full Time',
      location: 'Bangalore',
      postedText: 'Posted 1 year ago',
      category: 'Product Engineering',
      excerpt:
        'About the Role: We are looking for a highly skilled and experienced Senior Software Engineer with deep expertise in Java and the Spring ecosystem.',
    },
  ])
})

test('Clari5 trusts same-domain job detail pages with Simple Job Board apply forms and extracts structured job data', async () => {
  const clari5 = await loadModule()

  assert.equal(clari5.hasOfficialJobDetailSignal(amlProductManagerHtml, AML_PRODUCT_MANAGER_URL), true)
  assert.equal(clari5.hasOfficialJobDetailSignal(uiDeveloperHtml, UI_DEVELOPER_URL), true)
  assert.equal(
    clari5.hasOfficialJobDetailSignal(seniorSoftwareEngineerHtml, SENIOR_SOFTWARE_ENGINEER_URL),
    true,
  )

  const amlProductManager = clari5.extractJobDetail(amlProductManagerHtml, {
    jobId: '66558',
    title: 'AML Product Manager - KYC, Transaction Monitoring, Analytics, Reporting',
    sourceUrl: AML_PRODUCT_MANAGER_URL,
    employmentType: 'Full Time',
    location: 'Bangalore',
    category: 'Product Management',
    postedText: 'Posted 3 months ago',
  })

  assert.deepEqual(
    {
      title: amlProductManager.title,
      company: amlProductManager.company,
      department: amlProductManager.department,
      location: amlProductManager.location,
      city: amlProductManager.city,
      state: amlProductManager.state,
      country: amlProductManager.country,
      jobId: amlProductManager.jobId,
      requisitionId: amlProductManager.requisitionId,
      sourceUrl: amlProductManager.sourceUrl,
      applyUrl: amlProductManager.applyUrl,
      employmentType: amlProductManager.employmentType,
      experienceRequired: amlProductManager.experienceRequired,
      minimumQualification: amlProductManager.minimumQualification,
      preferredQualification: amlProductManager.preferredQualification,
    },
    {
      title: 'AML Product Manager - KYC, Transaction Monitoring, Analytics, Reporting',
      company: 'Clari5',
      department: 'Product Management Group (PMG) - AML',
      location: 'Bangalore',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
      jobId: '66558',
      requisitionId: '66558',
      sourceUrl: AML_PRODUCT_MANAGER_URL,
      applyUrl: AML_PRODUCT_MANAGER_URL,
      employmentType: 'Full Time',
      experienceRequired: '8-12 years',
      minimumQualification: null,
      preferredQualification: 'CAMS or equivalent AML certification preferred.',
    },
  )
  assert.ok(
    amlProductManager.requiredSkills.includes(
      'Own the transaction monitoring module covering detection, alerting, and analytics.',
    ),
  )
  assert.match(amlProductManager.jobDescription, /advanced AML suite/i)

  const uiDeveloper = clari5.extractJobDetail(uiDeveloperHtml, {
    jobId: '62226',
    title: 'UI Developer',
    sourceUrl: UI_DEVELOPER_URL,
    employmentType: 'Full Time',
    location: 'Bangalore',
    category: 'Product Engineering',
    postedText: 'Posted 6 months ago',
  })

  assert.deepEqual(
    {
      title: uiDeveloper.title,
      department: uiDeveloper.department,
      location: uiDeveloper.location,
      city: uiDeveloper.city,
      state: uiDeveloper.state,
      jobId: uiDeveloper.jobId,
      employmentType: uiDeveloper.employmentType,
      experienceRequired: uiDeveloper.experienceRequired,
      minimumQualification: uiDeveloper.minimumQualification,
      preferredQualification: uiDeveloper.preferredQualification,
    },
    {
      title: 'UI Developer',
      department: 'Product Engineering',
      location: 'Bangalore',
      city: 'Bangalore',
      state: 'Karnataka',
      jobId: '62226',
      employmentType: 'Full Time',
      experienceRequired: 'Should have relevant experience of 2-4 years.',
      minimumQualification:
        'BE in CSE/IS/ECE or equivalent streams/MCA or MSc in Maths/Electronics/Computer science.',
      preferredQualification: null,
    },
  )
  assert.ok(uiDeveloper.requiredSkills.includes('React coding is must.'))

  const seniorSoftwareEngineer = clari5.extractJobDetail(seniorSoftwareEngineerHtml, {
    jobId: '52956',
    title: 'Senior Software Engineer - Java & Spring',
    sourceUrl: SENIOR_SOFTWARE_ENGINEER_URL,
    employmentType: 'Full Time',
    location: 'Bangalore',
    category: 'Product Engineering',
    postedText: 'Posted 1 year ago',
  })

  assert.equal(
    seniorSoftwareEngineer.experienceRequired,
    '4+ years of experience in backend software development using Java 8 and above.',
  )
  assert.equal(seniorSoftwareEngineer.department, 'Product Engineering')
  assert.ok(seniorSoftwareEngineer.requiredSkills.includes('Strong command of Java and Spring Framework.'))
})

test('Clari5 run verifies the trusted first-party surfaces, follows pagination, and only keeps India openings', async () => {
  const clari5 = await loadModule()
  const requestedUrls = []

  const jobs = await clari5.createClari5Scraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) return homepageHtml
      if (url === CAREERS_URL) return careersPage1Html
      if (url === CAREERS_PAGE_2_URL) return careersPage2Html
      if (url === AML_PRODUCT_MANAGER_URL) return amlProductManagerHtml
      if (url === UI_DEVELOPER_URL) return uiDeveloperHtml
      if (url === SENIOR_SOFTWARE_ENGINEER_URL) return seniorSoftwareEngineerHtml

      throw new Error(`Unexpected Clari5 URL: ${url}`)
    },
    now: () => '2026-07-14T09:30:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    HOMEPAGE_URL,
    CAREERS_URL,
    CAREERS_PAGE_2_URL,
    AML_PRODUCT_MANAGER_URL,
    UI_DEVELOPER_URL,
    SENIOR_SOFTWARE_ENGINEER_URL,
  ])

  assert.equal(jobs.length, 3)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      source: job.source,
      company: job.company,
      location: job.location,
      link: job.link,
      companyCareerPage: job.companyCareerPage,
      companyDomain: job.companyDomain,
      atsPlatform: job.atsPlatform,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'AML Product Manager - KYC, Transaction Monitoring, Analytics, Reporting',
        source: 'clari5',
        company: 'Clari5',
        location: 'Bangalore',
        link: AML_PRODUCT_MANAGER_URL,
        companyCareerPage: CAREERS_URL,
        companyDomain: 'clari5.com',
        atsPlatform: 'official-company-careers',
        scrapedAt: '2026-07-14T09:30:00.000Z',
      },
      {
        title: 'UI Developer',
        source: 'clari5',
        company: 'Clari5',
        location: 'Bangalore',
        link: UI_DEVELOPER_URL,
        companyCareerPage: CAREERS_URL,
        companyDomain: 'clari5.com',
        atsPlatform: 'official-company-careers',
        scrapedAt: '2026-07-14T09:30:00.000Z',
      },
      {
        title: 'Senior Software Engineer - Java & Spring',
        source: 'clari5',
        company: 'Clari5',
        location: 'Bangalore',
        link: SENIOR_SOFTWARE_ENGINEER_URL,
        companyCareerPage: CAREERS_URL,
        companyDomain: 'clari5.com',
        atsPlatform: 'official-company-careers',
        scrapedAt: '2026-07-14T09:30:00.000Z',
      },
    ],
  )
})

test('Clari5 fails closed when the trusted careers archive or detail apply form drifts', async () => {
  const clari5 = await loadModule()

  await assert.rejects(
    clari5.createClari5Scraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return homepageHtml
        if (url === CAREERS_URL) {
          return careersPage1Html.replace('post-type-archive-jobpost', 'unexpected-archive')
        }

        throw new Error(`Unexpected Clari5 URL: ${url}`)
      },
    }),
    /verified Clari5 careers archive/i,
  )

  await assert.rejects(
    clari5.createClari5Scraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return homepageHtml
        if (url === CAREERS_URL) return careersPage1Html
        if (url === CAREERS_PAGE_2_URL) return careersPage2Html
        if (url === AML_PRODUCT_MANAGER_URL) {
          // The current reader binds the native action and role ID. A heading
          // alone does not establish or invalidate that application contract.
          return amlProductManagerHtml.replace('value="process_applicant_form"', 'value="request_information"')
        }
        if (url === UI_DEVELOPER_URL) return uiDeveloperHtml
        if (url === SENIOR_SOFTWARE_ENGINEER_URL) return seniorSoftwareEngineerHtml

        throw new Error(`Unexpected Clari5 URL: ${url}`)
      },
    }),
    /verified Clari5 job detail/i,
  )
})

test('Clari5 keeps the same native role when only the application heading changes', async () => {
  const clari5 = await loadModule()
  const listing = clari5.extractArchiveListings(careersPage1Html).find(row => row.sourceUrl === AML_PRODUCT_MANAGER_URL)
  const changed = amlProductManagerHtml.replace('Apply For This Job', 'Apply Now')
  assert.notEqual(changed, amlProductManagerHtml)
  assert.deepEqual(clari5.extractJobDetail(changed, listing), clari5.extractJobDetail(amlProductManagerHtml, listing))
})
