import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-18T00:00:00.000Z'

const loadModule = async (relativePath) => {
  try {
    return await import(relativePath)
  } catch {
    assert.fail(`Expected scraper module at ${relativePath}`)
  }
}

const novigoCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Life @ Novigo</h1>
    <h2>Opportunities with us</h2>
    <p>See our current job openings and where you can fit in</p>
    <h3>.Net Developer (2-5 Years)</h3>
    <p>Bangalore / Mangalore / Remote work during Pandemic.</p>
    <h3>Requirements:</h3>
    <p>Overall 2+ years of relevant experience in .Net</p>
    <p>In-depth knowledge in .NET / MVC /Entity Framework, HTML, CSS, Javascript.</p>
    <p>Knowledge of OOPs, MVC, DB Design, Git</p>
    <p>See More</p>
    <p>Apply Now</p>
    <h3>Angular Developer (3-6 Years)</h3>
    <p>Bangalore / Mangalore / Remote work during Pandemic.</p>
    <h3>Requirements:</h3>
    <p>Minimum of 3 years experience of JavaScript front end development.</p>
    <p>Minimum of 3-5 years experience with Angular and AngularJS.</p>
    <p>Experience with Angular CLI, Webpack, Docker, Jenkins, Selenium, GIT, Swagger, SonarQube, Mocha, Karma, Jasmine.</p>
    <p>See More</p>
    <p>Apply Now</p>
    <h3>Python Developer (3-6 Years)</h3>
    <p>Bangalore / Mangalore / Remote work during Pandemic.</p>
    <h3>Requirements:</h3>
    <p>Minimum 3 years experience as a Software Engineer, including system analysis, design, development, and deployment.</p>
    <p>Minimum 2 years of experience in Python development (Python 3).</p>
    <p>Worked on XML, JSON formats, SOAP API development, RESTful APIs.</p>
    <p>See More</p>
    <p>Apply Now</p>
    <h4>Apply Online</h4>
    <p>Attach your Resume (pdf/docx Only, not more than 2MB)</p>
  </body>
</html>
`

const appliedCloudBoardHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Applied Cloud Computing</h1>
    <a href="https://www.appliedcloudcomputing.com/">Applied Cloud Computing</a>
    <h2>Careers at Applied Cloud Computing</h2>
    <label for="search-input">Search jobs</label>
    <input id="search-input" type="search" />
    <h2>Jobs at Applied Cloud Computing</h2>
    <p>Search by keyword or location to explore current openings.</p>
  </body>
</html>
`

const appliedCloudListingPayload = {
  totalFound: 4,
  content: [
    {
      id: '744000143239951',
      name: 'Cloud Network Security Engineer',
      refNumber: 'ACC-1001',
      releasedDate: '2026-08-13T09:15:00.000Z',
      location: {
        city: 'Pune',
        region: 'MH',
        country: 'in',
        fullLocation: 'Pune, MH, India',
      },
      company: {
        identifier: 'AppliedCloudComputing',
        name: 'Applied Cloud Computing',
      },
      department: {
        label: 'Cloud Security',
      },
      typeOfEmployment: {
        id: 'full-time',
        label: 'Full-time',
      },
      experienceLevel: {
        id: 'senior',
        label: 'Senior',
      },
      ref: 'https://api.smartrecruiters.com/v1/companies/AppliedCloudComputing/postings/744000143239951',
    },
    {
      id: '744000143239952',
      name: 'OCI Cloud and Network Engineer',
      refNumber: 'ACC-1002',
      releasedDate: '2026-08-12T07:10:00.000Z',
      location: {
        city: 'Bengaluru',
        region: 'MH',
        country: 'in',
        fullLocation: 'Bengaluru, KA, India',
      },
      company: {
        identifier: 'AppliedCloudComputing',
        name: 'Applied Cloud Computing',
      },
      department: {
        label: 'Cloud Engineering',
      },
      typeOfEmployment: {
        id: 'full-time',
        label: 'Full-time',
      },
      experienceLevel: {
        id: 'senior',
        label: 'Senior',
      },
      ref: 'https://api.smartrecruiters.com/v1/companies/AppliedCloudComputing/postings/744000143239952',
    },
    {
      id: '744000143239953',
      name: 'Network Security Compliance Check & Remediation Engineer',
      refNumber: 'ACC-1003',
      releasedDate: '2026-08-11T10:00:00.000Z',
      location: {
        city: 'Mumbai',
        region: 'MH',
        country: 'in',
        fullLocation: 'Mumbai, MH, India',
      },
      company: {
        identifier: 'AppliedCloudComputing',
        name: 'Applied Cloud Computing',
      },
      department: {
        label: 'Compliance Engineering',
      },
      typeOfEmployment: {
        id: 'full-time',
        label: 'Full-time',
      },
      experienceLevel: {
        id: 'senior',
        label: 'Senior',
      },
      ref: 'https://api.smartrecruiters.com/v1/companies/AppliedCloudComputing/postings/744000143239953',
    },
    {
      id: '744000143239954',
      name: 'L2 CDN & Edge Security Engineer',
      refNumber: 'ACC-1004',
      releasedDate: '2026-08-10T08:00:00.000Z',
      location: {
        city: 'Navi Mumbai',
        region: 'MH',
        country: 'in',
        fullLocation: 'Navi Mumbai, MH, India',
      },
      company: {
        identifier: 'AppliedCloudComputing',
        name: 'Applied Cloud Computing',
      },
      department: {
        label: 'Edge Security',
      },
      typeOfEmployment: {
        id: 'full-time',
        label: 'Full-time',
      },
      experienceLevel: {
        id: 'mid-level',
        label: 'Mid-Level',
      },
      ref: 'https://api.smartrecruiters.com/v1/companies/AppliedCloudComputing/postings/744000143239954',
    },
  ],
}

const appliedCloudDetailPayloadById = {
  '744000143239951': {
    id: '744000143239951',
    name: 'Cloud Network Security Engineer',
    refNumber: 'ACC-1001',
    releasedDate: '2026-08-13T09:15:00.000Z',
    postingUrl:
      'https://jobs.smartrecruiters.com/AppliedCloudComputing/744000143239951-cloud-network-security-engineer',
    applyUrl:
      'https://jobs.smartrecruiters.com/AppliedCloudComputing/744000143239951-cloud-network-security-engineer?oga=true',
    location: {
      city: 'Pune',
      region: 'MH',
      country: 'in',
      fullLocation: 'Pune, MH, India',
    },
    department: {
      label: 'Cloud Security',
    },
    typeOfEmployment: {
      id: 'full-time',
      label: 'Full-time',
    },
    experienceLevel: {
      id: 'senior',
      label: 'Senior',
    },
    jobAd: {
      sections: {
        jobDescription: {
          text: '<p>Design and operate network security controls for enterprise cloud workloads.</p>',
        },
        qualifications: {
          text: '<p>Strong hands-on experience with firewalls, proxy controls, and cloud network security.</p>',
        },
        additionalInformation: {
          text: '<p>Cross-team collaboration across Pune and hybrid client environments is preferred.</p>',
        },
      },
    },
  },
  '744000143239952': {
    id: '744000143239952',
    name: 'OCI Cloud and Network Engineer',
    refNumber: 'ACC-1002',
    releasedDate: '2026-08-12T07:10:00.000Z',
    postingUrl:
      'https://jobs.smartrecruiters.com/AppliedCloudComputing/744000143239952-oci-cloud-and-network-engineer',
    applyUrl:
      'https://jobs.smartrecruiters.com/AppliedCloudComputing/744000143239952-oci-cloud-and-network-engineer?oga=true',
    location: {
      city: 'Bengaluru',
      region: 'KA',
      country: 'in',
      fullLocation: 'Bengaluru, KA, India',
    },
    department: {
      label: 'Cloud Engineering',
    },
    typeOfEmployment: {
      id: 'full-time',
      label: 'Full-time',
    },
    experienceLevel: {
      id: 'senior',
      label: 'Senior',
    },
    jobAd: {
      sections: {
        jobDescription: {
          text: '<p>Build and support Oracle Cloud Infrastructure networking for production workloads.</p>',
        },
        qualifications: {
          text: '<p>Hands-on OCI networking, routing, and cloud automation experience is required.</p>',
        },
        additionalInformation: {
          text: '<p>Bengaluru collaboration with on-call support coverage is preferred.</p>',
        },
      },
    },
  },
  '744000143239953': {
    id: '744000143239953',
    name: 'Network Security Compliance Check & Remediation Engineer',
    refNumber: 'ACC-1003',
    releasedDate: '2026-08-11T10:00:00.000Z',
    postingUrl:
      'https://jobs.smartrecruiters.com/AppliedCloudComputing/744000143239953-network-security-compliance-check-remediation-engineer',
    applyUrl:
      'https://jobs.smartrecruiters.com/AppliedCloudComputing/744000143239953-network-security-compliance-check-remediation-engineer?oga=true',
    location: {
      city: 'Mumbai',
      region: 'MH',
      country: 'in',
      fullLocation: 'Mumbai, MH, India',
    },
    department: {
      label: 'Compliance Engineering',
    },
    typeOfEmployment: {
      id: 'full-time',
      label: 'Full-time',
    },
    experienceLevel: {
      id: 'senior',
      label: 'Senior',
    },
    jobAd: {
      sections: {
        jobDescription: {
          text: '<p>Own network security compliance checks and drive remediation across cloud estates.</p>',
        },
        qualifications: {
          text: '<p>Experience with audit remediation, security baselines, and cloud governance.</p>',
        },
        additionalInformation: {
          text: '<p>Financial-services security controls experience is beneficial.</p>',
        },
      },
    },
  },
  '744000143239954': {
    id: '744000143239954',
    name: 'L2 CDN & Edge Security Engineer',
    refNumber: 'ACC-1004',
    releasedDate: '2026-08-10T08:00:00.000Z',
    postingUrl:
      'https://jobs.smartrecruiters.com/AppliedCloudComputing/744000143239954-l2-cdn-edge-security-engineer',
    applyUrl:
      'https://jobs.smartrecruiters.com/AppliedCloudComputing/744000143239954-l2-cdn-edge-security-engineer?oga=true',
    location: {
      city: 'Navi Mumbai',
      region: 'MH',
      country: 'in',
      fullLocation: 'Navi Mumbai, MH, India',
    },
    department: {
      label: 'Edge Security',
    },
    typeOfEmployment: {
      id: 'full-time',
      label: 'Full-time',
    },
    experienceLevel: {
      id: 'mid-level',
      label: 'Mid-Level',
    },
    jobAd: {
      sections: {
        jobDescription: {
          text: '<p>Support CDN, edge protection, and incident handling for customer-facing platforms.</p>',
        },
        qualifications: {
          text: '<p>Experience with CDN platforms, WAF controls, and security troubleshooting.</p>',
        },
        additionalInformation: {
          text: '<p>Shift-based response and cross-functional coordination may be required.</p>',
        },
      },
    },
  },
}

const mobiloitteCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Careers at Mobiloitte That Build Your Future</h1>
    <p>Where Purpose Meets Possibility</p>
    <h2>Current Openings</h2>
    <p>Search Jobs</p>
    <p>Location All Locations India United Kingdom Singapore Ireland United Arab Emirates Remote Hybrid</p>
    <h3>No Jobs Found</h3>
    <p>We couldn't find any jobs matching your criteria. Try adjusting your filters.</p>
    <h3>Didn't find the right position?</h3>
    <p>We're always looking for talented individuals. Send us your resume and we'll keep you in mind for future opportunities.</p>
    <p>Upload PDF or Word file (max 5MB)</p>
    <p>Reach us via the Contact Us page or email careers@mobiloitte.com for hiring inquiries and updates.</p>
  </body>
</html>
`

const competentCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Competent Software | Careers</h1>
    <h2>Join our rich environment for learning and striving for excellence.</h2>
    <h3>Career opportunities with us:</h3>
    <ul>
      <li>Process Associate</li>
      <li>Data Analyst</li>
      <li>Software Developer</li>
      <li>Network Administrator</li>
      <li>Database Administrator</li>
    </ul>
    <p>Attach Resume</p>
    <p>Apply Now</p>
    <p>Note: Currently there are no open positions. Please check back later for updates. For any further queries, kindly write to us at careers@competentsoftware.com</p>
    <p>C-56/23, Sector 62, Noida, Uttar Pradesh - 201309, India.</p>
  </body>
</html>
`

const vserveCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Current Job Openings and Opportunities in Vserve Ebusiness Solutions</title>
  </head>
  <body>
    <h1>Careers</h1>
    <p>If you are passionate enough to work towards one common goal, click on the 'APPLY NOW' button under your interesting position.</p>
    <iframe data-lazy-src="https://recruit.zoho.com/recruit/Portal.na?iframe=false&#038;digest=test-digest"></iframe>
  </body>
</html>
`

const currentVserveCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Current Job Openings and Opportunities in Vserve Ebusiness Solutions</title>
  </head>
  <body>
    <h1>Careers</h1>
    <nav>
      <a href="/about-us/">About Us</a>
      <a href="/why-us/">Why Us</a>
      <a href="/careers/">Careers</a>
      <a href="/resources/">Resources</a>
    </nav>
    <p>Life at Vserve</p>
    <p>Our WorkCulture</p>
    <iframe data-lazy-src="https://recruit.zoho.com/recruit/Portal.na?iframe=false&#038;digest=test-digest"></iframe>
  </body>
</html>
`

const vserveZohoPortalHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers</title>
  </head>
  <body>
    <div id="zr-joblist-container-561596000000290237">
      <div class="jobListContainer">
        <table cellpadding="5" cellspacing="0" width="100%" class="jobListTable" id="zr-joblist-container">
          <tbody>
            <tr id="zr-joblist-header" class="jobHeaderRow" data-wid="561596000000290237">
              <th>Posting Title</th>
              <th>Job Type</th>
              <th>Date Opened</th>
              <th>City</th>
            </tr>
            <tr id="zr-joblist-detail_561596000068496005" class="jobDetailRow" data-rowid="561596000068496005" data-wid="561596000000290237">
              <td><a class='jobdetail' href='/recruit/PortalDetail.na?iframe=true&amp;digest=test-digest&amp;jobid=561596000068496005&amp;widgetid=561596000000290237&amp;embedsource=CareerSite'>Senior Full Stack Developer</a></td>
              <td>Full time</td>
              <td>07/20/2026</td>
              <td>Coimbatore</td>
            </tr>
            <tr id="zr-joblist-detail_561596000068137073" class="jobDetailRow" data-rowid="561596000068137073" data-wid="561596000000290237">
              <td><a class='jobdetail' href='/recruit/PortalDetail.na?iframe=true&amp;digest=test-digest&amp;jobid=561596000068137073&amp;widgetid=561596000000290237&amp;embedsource=CareerSite'>Technical Project Manager</a></td>
              <td>Full time</td>
              <td>06/26/2026</td>
              <td>Coimbatore</td>
            </tr>
            <tr id="zr-joblist-detail_561596000068474016" class="jobDetailRow" data-rowid="561596000068474016" data-wid="561596000000290237">
              <td><a class='jobdetail' href='/recruit/PortalDetail.na?iframe=true&amp;digest=test-digest&amp;jobid=561596000068474016&amp;widgetid=561596000000290237&amp;embedsource=CareerSite'>Business Insights Analyst</a></td>
              <td>Full time</td>
              <td>07/23/2026</td>
              <td>Pasig</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </body>
</html>
`

const vserveSeniorFullStackDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Senior Full Stack Developer</title>
    <meta name="description" content="Senior Full Stack Developer PHP | WordPress | BigCommerce | Shopify | Magento 2 Experience 5 - 6 Years Job Type Full-Time Location Coimbatore - WFO Department Engineering / Web Development Reports To Team Lead Job Summary We are looking for an experienced full stack developer." />
  </head>
  <body>
    <script>
      data={"country":"India","jobTitle":"Senior Full Stack Developer","jobDescriptionDetails":[{"richText":{"fieldLabel":"Job Description","uitype":5501,"value":"<html><body><div>Senior Full Stack Developer<br></div><div>Experience<br></div><div>5 - 6 Years<br></div><div>Job Type<br></div><div>Full-Time<br></div><div>Location<br></div><div>Coimbatore - WFO<br></div><div>Department<br></div><div>Engineering / Web Development<br></div><div>Reports To<br></div><div>Team Lead<br></div><div>Job Summary<br></div><div>We are looking for an experienced Full Stack Developer with PHP, WordPress, BigCommerce, Shopify, and Magento 2 expertise.<br></div><div>Key Responsibilities<br></div><div>Build scalable ecommerce applications.<br></div><div>Required Skills &amp; Qualifications<br></div><div>PHP, WordPress, BigCommerce, Shopify, Magento 2<br></div></body></html>"}}],"jobType":"Full time","jobOtherDetails":[{"fieldLabel":"City","uitype":1,"value":"Coimbatore"},{"fieldLabel":"State/Province","uitype":1,"value":"Tamil Nadu"}],"headerName":"Senior Full Stack Developer","jobId":"561596000068496005","location":"Coimbatore"};
      var compiledTemplate = true;
    </script>
  </body>
</html>
`

const vserveTechnicalProjectManagerDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Technical Project Manager</title>
    <meta name="description" content="Technical Project Manager Location Coimbatore Department Project Management Job Summary Lead technical project delivery for ecommerce operations." />
  </head>
  <body>
    <script>
      data={"country":"India","jobTitle":"Technical Project Manager","jobDescriptionDetails":[{"richText":{"fieldLabel":"Job Description","uitype":5501,"value":"<html><body><div>Technical Project Manager<br></div><div>Location<br></div><div>Coimbatore<br></div><div>Department<br></div><div>Project Management<br></div><div>Job Summary<br></div><div>Lead technical project delivery for ecommerce operations.<br></div></body></html>"}}],"jobType":"Full time","jobOtherDetails":[{"fieldLabel":"City","uitype":1,"value":"Coimbatore"},{"fieldLabel":"State/Province","uitype":1,"value":"Tamil Nadu"}],"headerName":"Technical Project Manager","jobId":"561596000068137073","location":"Coimbatore"};
      var compiledTemplate = true;
    </script>
  </body>
</html>
`

const vserveBusinessInsightsAnalystDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Business Insights Analyst</title>
  </head>
  <body>
    <script>
      data={"country":"Philippines","jobTitle":"Business Insights Analyst","jobDescriptionDetails":[{"richText":{"fieldLabel":"Job Description","uitype":5501,"value":"<html><body><div>Business Insights Analyst<br></div><div>Location<br></div><div>Pasig<br></div><div>Department<br></div><div>Analytics<br></div><div>Job Summary<br></div><div>Support reporting and collections operations for the Pasig office.<br></div></body></html>"}}],"jobType":"Full time","jobOtherDetails":[{"fieldLabel":"City","uitype":1,"value":"Pasig"},{"fieldLabel":"State/Province","uitype":1,"value":"Metro Manila"}],"headerName":"Business Insights Analyst","jobId":"561596000068474016","location":"Pasig"};
      var compiledTemplate = true;
    </script>
  </body>
</html>
`

test('Novigo Solutions run returns normalized jobs from the verified first-party careers page', async () => {
  const novigo = await loadModule('../../scraper/novigosolutions/script.js')

  assert.equal(novigo.hasOfficialCareersSignal(novigoCareersHtml), true)
  assert.equal(novigo.extractVisibleRoles(novigoCareersHtml).length, 3)

  const jobs = await novigo.createNovigoSolutionsScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      assert.equal(url, novigo.CAREERS_URL)
      return novigoCareersHtml
    },
  })

  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].title, '.Net Developer')
  assert.equal(jobs[0].location, 'Bangalore / Mangalore / Remote work during Pandemic.')
  assert.equal(jobs[0].remoteStatus, 'Hybrid')
  assert.equal(jobs[1].title, 'Angular Developer')
  assert.match(jobs[1].jobDescription, /Angular CLI, Webpack, Docker/i)
  assert.equal(jobs[2].title, 'Python Developer')
  assert.match(jobs[2].jobDescription, /Python 3/i)
})

test('Applied Cloud Computing run validates the current SmartRecruiters board shell and maps live India jobs from the API', async () => {
  const appliedCloud = await loadModule('../../scraper/appliedcloudcomputing/script.js')
  const requestedUrls = []

  assert.equal(appliedCloud.hasVerifiedBoardSignal(appliedCloudBoardHtml), true)

  const jobs = await appliedCloud.createAppliedCloudComputingScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, appliedCloud.BOARD_URL)
      return appliedCloudBoardHtml
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)

      if (
        url
        === 'https://api.smartrecruiters.com/v1/companies/AppliedCloudComputing/postings?limit=100&country=in&offset=0'
      ) {
        return appliedCloudListingPayload
      }

      const detailId = url.split('/').pop()
      if (detailId && appliedCloudDetailPayloadById[detailId]) {
        return appliedCloudDetailPayloadById[detailId]
      }

      throw new Error(`Unexpected Applied Cloud Computing URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    appliedCloud.BOARD_URL,
    'https://api.smartrecruiters.com/v1/companies/AppliedCloudComputing/postings?limit=100&country=in&offset=0',
    'https://api.smartrecruiters.com/v1/companies/AppliedCloudComputing/postings/744000143239951',
    'https://api.smartrecruiters.com/v1/companies/AppliedCloudComputing/postings/744000143239952',
    'https://api.smartrecruiters.com/v1/companies/AppliedCloudComputing/postings/744000143239953',
    'https://api.smartrecruiters.com/v1/companies/AppliedCloudComputing/postings/744000143239954',
  ])

  assert.equal(jobs.length, 4)
  assert.deepEqual(
    jobs.map((job) => job.title),
    [
      'Cloud Network Security Engineer',
      'L2 CDN & Edge Security Engineer',
      'Network Security Compliance Check & Remediation Engineer',
      'OCI Cloud and Network Engineer',
    ],
  )
  assert.equal(jobs[0].department, 'Cloud Security')
  assert.equal(jobs[0].country, 'India')
  assert.equal(
    jobs[0].applyUrl,
    'https://jobs.smartrecruiters.com/AppliedCloudComputing/744000143239951-cloud-network-security-engineer?oga=true',
  )
  assert.match(jobs[1].jobDescription, /edge protection/i)
  assert.match(jobs[2].jobDescription, /remediation across cloud estates/i)
  assert.match(jobs[3].jobDescription, /Oracle Cloud Infrastructure networking/i)
})

test('Mobiloitte Technologies sentinel validates the official careers empty state and returns []', async () => {
  const mobiloitte = await loadModule('../../scraper/mobiloittetechnologies/script.js')

  assert.equal(mobiloitte.hasOfficialCareersSignal(mobiloitteCareersHtml), true)
  assert.equal(mobiloitte.hasNoJobsFoundState(mobiloitteCareersHtml), true)

  const jobs = await mobiloitte.createMobiloitteTechnologiesScraper().run({
    fetchText: async (url) => {
      assert.equal(url, mobiloitte.CAREERS_URL)
      return mobiloitteCareersHtml
    },
  })

  assert.deepEqual(jobs, [])
})

test('Competent Software sentinel validates the official careers no-open-positions note and returns []', async () => {
  const competent = await loadModule('../../scraper/competentsoftware/script.js')

  assert.equal(competent.hasOfficialCareersSignal(competentCareersHtml), true)
  assert.equal(competent.hasNoOpenPositionsNote(competentCareersHtml), true)

  const jobs = await competent.createCompetentSoftwareScraper().run({
    fetchText: async (url) => {
      assert.equal(url, competent.CAREERS_URL)
      return competentCareersHtml
    },
  })

  assert.deepEqual(jobs, [])
})

test('Vserve Ebusiness Solutions run validates the first-party careers page, extracts the embedded Zoho portal, and keeps only India-scoped jobs', async () => {
  const vserve = await loadModule('../../scraper/vserveebusinesssolutions/script.js')
  const requestedUrls = []

  assert.equal(vserve.hasOfficialCareersSignal(vserveCareersHtml), true)
  assert.equal(
    vserve.extractEmbeddedZohoPortalUrl(vserveCareersHtml),
    'https://recruit.zoho.com/recruit/Portal.na?iframe=false&digest=test-digest',
  )
  assert.equal(vserve.hasZohoJobPortalSignal(vserveZohoPortalHtml), true)
  assert.equal(
    vserve.extractPortalListings(
      vserveZohoPortalHtml,
      'https://recruit.zoho.com/recruit/Portal.na?iframe=false&digest=test-digest',
    ).length,
    3,
  )

  const jobs = await vserve.createVserveEbusinessSolutionsScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === vserve.CAREERS_URL) return vserveCareersHtml
      if (url === 'https://recruit.zoho.com/recruit/Portal.na?iframe=false&digest=test-digest') return vserveZohoPortalHtml
      if (url === 'https://recruit.zoho.com/recruit/PortalDetail.na?iframe=true&digest=test-digest&jobid=561596000068496005&widgetid=561596000000290237&embedsource=CareerSite') return vserveSeniorFullStackDetailHtml
      if (url === 'https://recruit.zoho.com/recruit/PortalDetail.na?iframe=true&digest=test-digest&jobid=561596000068137073&widgetid=561596000000290237&embedsource=CareerSite') return vserveTechnicalProjectManagerDetailHtml
      if (url === 'https://recruit.zoho.com/recruit/PortalDetail.na?iframe=true&digest=test-digest&jobid=561596000068474016&widgetid=561596000000290237&embedsource=CareerSite') return vserveBusinessInsightsAnalystDetailHtml
      throw new Error(`Unexpected Vserve URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    vserve.CAREERS_URL,
    'https://recruit.zoho.com/recruit/Portal.na?iframe=false&digest=test-digest',
    'https://recruit.zoho.com/recruit/PortalDetail.na?iframe=true&digest=test-digest&jobid=561596000068496005&widgetid=561596000000290237&embedsource=CareerSite',
    'https://recruit.zoho.com/recruit/PortalDetail.na?iframe=true&digest=test-digest&jobid=561596000068137073&widgetid=561596000000290237&embedsource=CareerSite',
    'https://recruit.zoho.com/recruit/PortalDetail.na?iframe=true&digest=test-digest&jobid=561596000068474016&widgetid=561596000000290237&embedsource=CareerSite',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'Senior Full Stack Developer')
  assert.equal(jobs[0].location, 'Coimbatore, Tamil Nadu, India')
  assert.equal(jobs[0].department, 'Engineering / Web Development')
  assert.match(jobs[0].jobDescription, /Magento 2/i)
  assert.equal(jobs[1].title, 'Technical Project Manager')
  assert.equal(jobs[1].location, 'Coimbatore, Tamil Nadu, India')
  assert.equal(jobs[1].department, 'Project Management')
})

test('Vserve Ebusiness Solutions accepts the Monday, August 17, 2026 careers-page copy refresh while preserving the embedded Zoho portal', async () => {
  const vserve = await loadModule('../../scraper/vserveebusinesssolutions/script.js')

  assert.equal(vserve.hasOfficialCareersSignal(currentVserveCareersHtml), true)

  const jobs = await vserve.createVserveEbusinessSolutionsScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      if (url === vserve.CAREERS_URL) return currentVserveCareersHtml
      if (url === 'https://recruit.zoho.com/recruit/Portal.na?iframe=false&digest=test-digest') return vserveZohoPortalHtml
      if (url === 'https://recruit.zoho.com/recruit/PortalDetail.na?iframe=true&digest=test-digest&jobid=561596000068496005&widgetid=561596000000290237&embedsource=CareerSite') return vserveSeniorFullStackDetailHtml
      if (url === 'https://recruit.zoho.com/recruit/PortalDetail.na?iframe=true&digest=test-digest&jobid=561596000068137073&widgetid=561596000000290237&embedsource=CareerSite') return vserveTechnicalProjectManagerDetailHtml
      if (url === 'https://recruit.zoho.com/recruit/PortalDetail.na?iframe=true&digest=test-digest&jobid=561596000068474016&widgetid=561596000000290237&embedsource=CareerSite') return vserveBusinessInsightsAnalystDetailHtml
      throw new Error(`Unexpected Vserve URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => job.title),
    ['Senior Full Stack Developer', 'Technical Project Manager'],
  )
})
