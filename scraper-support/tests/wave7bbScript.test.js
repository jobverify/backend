import assert from 'node:assert/strict'
import test from 'node:test'
import { installWorkbookOfflineGuard } from './helpers/workbookBatchCatalogAssertions20261102.js'

test.beforeEach((t) => installWorkbookOfflineGuard(t))


const FIXED_SCRAPED_AT = '2026-07-18T00:00:00.000Z'

const loadModule = async (relativePath) => {
  try {
    return await import(relativePath)
  } catch {
    assert.fail(`Expected scraper module at ${relativePath}`)
  }
}

const nuventoCareersHubHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h2>Careers</h2>
    <h6>Careers in India</h6>
    <a href="https://nuvento.com/careers/kochi/">Careers In INDIA</a>
  </body>
</html>
`

const nuventoIndiaCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta property="og:site_name" content="Nuvento" />
  </head>
  <body>
    <h2>Nuvento - India</h2>
    <h2>Build your Career with Nuvento</h2>
    <p>For all the enquiries and resume submission please email to naseeba.parvin@nuvento.com</p>
    <p>anindita.ghosal@nuvento.com</p>

    <h4>US Finance &amp; Accounts /<br>Senior Executive</h4>
    <h6>Location: Kochi, Kerala</h6>
    <h6>Key Responsibilities</h6>
    <ul>
      <li>Invoicing &amp; Revenue</li>
      <li>Accounts Receivable</li>
    </ul>
    <h6>Qualifications</h6>
    <ul>
      <li>Bachelor's in Commerce/Finance/Accounting</li>
      <li>2-5 years of experience in finance &amp; accounting</li>
    </ul>

    <h4>IT/Sr/JR Recruiter</h4>
    <h6>Location: Bangalore (Onsite)</h6>
    <p>Role Overview</p>
    <p>We are looking for a high-performing IT Recruiter with strong experience in niche technology hiring.</p>
    <h6>Key Responsibilities</h6>
    <ul>
      <li>Handle end-to-end recruitment lifecycle for Contract-to-Hire positions.</li>
      <li>Build strong talent pipelines.</li>
    </ul>
    <h6>Qualifications</h6>
    <ul>
      <li>2-10 years of IT recruitment experience.</li>
      <li>Strong understanding of technology stacks.</li>
    </ul>

    <h4>Team Lead -Python</h4>
    <h6>Experience: 10+ Years</h6>
    <p>Location: Kerala (Hybrid)</p>
    <h6>Key Responsibilities</h6>
    <ul>
      <li>Lead architecture and development of Django-based services.</li>
      <li>Build evaluation and monitoring for GenAI.</li>
    </ul>

    <h4>Sales and Marketing Intern (Paid Internship)</h4>
    <h6>Location: PAN India</h6>
    <p>Work Mode: Remote</p>
    <h6>Key Responsibilities</h6>
    <ul>
      <li>Assist in planning and executing digital marketing and sales campaigns.</li>
      <li>Support lead generation.</li>
    </ul>
    <h6>Required Skills</h6>
    <ul>
      <li>Excellent communication and presentation abilities.</li>
      <li>Strong interpersonal and customer engagement skills.</li>
    </ul>

    <h6>Address</h6>
    <p>Kochi</p>
  </body>
</html>
`

const qualeHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Generative AI - Quale Infotech</title>
    <link rel="canonical" href="https://qualeinfotech.com/" />
  </head>
  <body>
    <nav>
      <a href="/">Home</a>
      <a href="/about-us/">About Us</a>
      <a href="/contact-us/">Contact Us</a>
    </nav>
    <h1>Generative AI</h1>
    <p>Unlock Infinite Potential</p>
    <p>430-432 Tower A, Spaze I-Tech Park, Sector 49, Sohna Road, Gurugram 122018, Haryana.</p>
    <a href="/cdn-cgi/l/email-protection#abc2c5cdc4ebdadcca..." class="__cf_email__">[email protected]</a>
    <img alt="Experts say tech leap to create more &amp; better jobs" />
  </body>
</html>
`

const qualeAboutHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h2>About Us</h2>
    <h3>Who We Are</h3>
    <p>Quale Infotech is a leading innovator at the forefront of digital transformation.</p>
    <p>Transparency</p>
    <p>Trust</p>
    <p>Innovation</p>
  </body>
</html>
`

const qualeContactHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h2>Contact Us</h2>
    <p>How can we help?</p>
    <p>Ready to unlock the potential of next-generation technology and transform your operations?</p>
    <p>India - Gurugram</p>
    <p>India - Delhi</p>
    <p>India - Bengaluru</p>
  </body>
</html>
`

const capitalNumbersCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <p>Beware of Fake Job or Freelancing Offers</p>
    <h1>Stable, Rewarding Remote Work Opportunities from Capital Numbers</h1>
    <p>See Current Openings</p>
    <p>Rated 4.2 out of 5 on Glassdoor</p>
    <h2>Build Your Career with Capital Numbers</h2>
    <p>Great opportunities begin with great people.</p>
    <p>Please email your current resume and a cover letter to jobs@capitalnumbers.com.</p>
    <p>If your profile matches our current or upcoming requirements, our recruitment team will get in touch.</p>
    <h2>Perks &amp; Benefits</h2>
  </body>
</html>
`

const inTimeTecCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Join Our Team - In Time Tec</title>
  </head>
  <body>
    <h1>Join us in creating</h1>
    <p>It takes a special kind of person to stand with us on our platform of abundance.</p>
    <a href="https://ats.rippling.com/intimetec">USA Careers</a>
    <a href="https://careers.intimetec.in/intimetec/">India Careers</a>
    <p>Careers at In Time Tec offer personal and professional development as well as traditional benefits.</p>
  </body>
</html>
`

const inTimeTecJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>In Time Tec - Careers</title>
    <meta name="description" content="In Time Tec Careers">
    <base href="/intimetec/">
    <link href="styles.1cee6c376ce09708.css" rel="stylesheet">
    <script src="main.3ea212f43af15350.js"></script>
  </head>
  <body>
    <app-root></app-root>
  </body>
</html>
`

const inTimeTecSearchPayloadPage1 = {
  data: {
    hasMoreData: true,
    totalCount: 3,
    facetedSearchConfig: {
      paginationHowMuch: '2',
    },
    data: [
      {
        _source: {
          jobTitle: 'Senior AI Engineer - Vision Language Models (VLM)',
          DepartmentName: 'AI Labs',
          location: 'Jaipur, Rajasthan, India;Bangalore, Karnataka, India',
          locAgg: 'Jaipur, Rajasthan, India;Bangalore, Karnataka, India',
          jobCode: '10526',
          referenceNumber: '10526',
          jobUrl: 'senior-ai-engineer-vlm',
          experienceUIField: '4-7 years',
          mandatorySkills: ['VLM', 'Multimodal AI'],
          modifiedDate: 1785429767734,
          jobLocationRecord: [
            {
              city: 'Jaipur',
              state: 'Rajasthan',
              country: 'India',
              location: 'Jaipur, Rajasthan, India',
            },
            {
              city: 'Bangalore',
              state: 'Karnataka',
              country: 'India',
              location: 'Bangalore, Karnataka, India',
            },
          ],
          otherStatusOne: 'Live',
          otherStatusTwo: 'Open',
        },
      },
      {
        _source: {
          jobTitle: 'US Network Engineer',
          DepartmentName: 'Infrastructure',
          location: 'Austin, Texas, United States',
          locAgg: 'Austin, Texas, United States',
          jobCode: '10527',
          referenceNumber: '10527',
          jobUrl: 'us-network-engineer',
          experienceUIField: '5-7 years',
          mandatorySkills: ['Routing', 'Switching'],
          modifiedDate: 1785429767000,
          jobLocationRecord: [
            {
              city: 'Austin',
              state: 'Texas',
              country: 'United States',
              location: 'Austin, Texas, United States',
            },
          ],
          otherStatusOne: 'Live',
          otherStatusTwo: 'Open',
        },
      },
    ],
  },
}

const inTimeTecSearchPayloadPage2 = {
  data: {
    hasMoreData: false,
    totalCount: 3,
    facetedSearchConfig: {
      paginationHowMuch: '2',
    },
    data: [
      {
        _source: {
          jobTitle: 'Linux Administrator',
          DepartmentName: 'Infrastructure',
          location: 'Bangalore, Karnataka, India',
          locAgg: 'Bangalore, Karnataka, India',
          jobCode: '10528',
          referenceNumber: '10528',
          jobUrl: 'linux-administrator',
          experienceUIField: '3-5 years',
          mandatorySkills: ['Linux', 'Bash'],
          modifiedDate: 1785200000000,
          jobLocationRecord: [
            {
              city: 'Bangalore',
              state: 'Karnataka',
              country: 'India',
              location: 'Bangalore, Karnataka, India',
            },
          ],
          otherStatusOne: 'Live',
          otherStatusTwo: 'Open',
        },
      },
    ],
  },
}

const inTimeTecSeniorAiDetailPayload = {
  jobTitle: 'Senior AI Engineer - Vision Language Models (VLM)',
  jobCode: '10526',
  jobUrl: 'senior-ai-engineer-vlm',
  location: 'Jaipur, Rajasthan, India;Bangalore, Karnataka, India',
  referenceNumber: '10526',
  departmentName: 'AI Labs',
  department: {
    departmentName: 'AI Labs',
  },
  employeeType: 'Full Time',
  skillSet: 'VLM, Multimodal AI, PyTorch',
  createDate: '28-Jul-2026',
  longDescription: '<p>Design multimodal AI systems.</p><p>Optimize video understanding pipelines.</p>',
  jobConfigurationData: {
    Description: '<p>Design multimodal AI systems.</p><p>Optimize video understanding pipelines.</p>',
    Department: 'AI Labs',
    'Skills Required': 'VLM, Multimodal AI, PyTorch',
    Location: 'Jaipur, Rajasthan, India;Bangalore, Karnataka, India',
    'Education/Qualification': 'B.Tech / M.Tech',
    'Years Of Exp': '4 to 7 years',
    'Posted On': '28-Jul-2026',
  },
}

const inTimeTecLinuxAdminDetailPayload = {
  jobTitle: 'Linux Administrator',
  jobCode: '10528',
  jobUrl: 'linux-administrator',
  location: 'Bangalore, Karnataka, India',
  referenceNumber: '10528',
  departmentName: 'Infrastructure',
  department: {
    departmentName: 'Infrastructure',
  },
  skillSet: 'Linux, Bash, Monitoring',
  createDate: '27-Jul-2026',
  longDescription: '<p>Manage Linux production systems.</p><p>Improve observability and patching workflows.</p>',
  jobConfigurationData: {
    Description: '<p>Manage Linux production systems.</p><p>Improve observability and patching workflows.</p>',
    Department: 'Infrastructure',
    'Skills Required': 'Linux, Bash, Monitoring',
    Location: 'Bangalore, Karnataka, India',
    'Years Of Exp': '3 to 5 years',
    'Posted On': '27-Jul-2026',
  },
}

const miracleCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h3>Contact Notice</h3>
    <p>If you have applied for a job please be aware that Miracle recruiters, HR or leadership will only contact you via email, phone or LinkedIn.</p>
    <div class="oc-item">
      <div class="tagcloud clearfix bottommargin">
        <a class="tag-badge">Open Positions</a>
      </div>
      <h1 class="text-white mb-3">ServiceNow ITSM Architect</h1>
      <h4 class="text-white"><i class="icon-calendar-alt"></i> August 3rd, 2026 &nbsp; <i class="icon-location"></i> Miracle Heights, India</h4>
      <a href="open-positions/open-positions-sub?jobId=MSSJ3046" target="_blank" class="button button-rounded button-large nott ls0">Apply Now</a>
    </div>

    <div class="oc-item">
      <div class="tagcloud clearfix bottommargin">
        <a class="tag-badge">Open Positions</a>
      </div>
      <h1 class="text-white mb-3">Microsoft Dynamics 365 (D365) Technical Consultant</h1>
      <h4 class="text-white"><i class="icon-calendar-alt"></i> August 3rd, 2026 &nbsp; <i class="icon-location"></i> Miracle Heights, India</h4>
      <a href="open-positions/open-positions-sub?jobId=MSSJ3045" target="_blank" class="button button-rounded button-large nott ls0">Apply Now</a>
    </div>

    <div class="oc-item">
      <div class="tagcloud clearfix bottommargin">
        <a class="tag-badge">Open Positions</a>
      </div>
      <h1 class="text-white mb-3">SAP FI/ABAP Support Consultant</h1>
      <h4 class="text-white"><i class="icon-calendar-alt"></i> August 3rd, 2026 &nbsp; <i class="icon-location"></i> Miracle Heights, India</h4>
      <a href="open-positions/open-positions-sub?jobId=MSSJ3044" target="_blank" class="button button-rounded button-large nott ls0">Apply Now</a>
    </div>

    <div class="oc-item">
      <div class="tagcloud clearfix bottommargin">
        <a class="tag-badge">Open Positions</a>
      </div>
      <h1 class="text-white mb-3">SQL/UKG Developer</h1>
      <h4 class="text-white"><i class="icon-calendar-alt"></i> August 3rd, 2026 &nbsp; <i class="icon-location"></i> Miracle Heights, India</h4>
      <a href="open-positions/open-positions-sub?jobId=MSSJ3043" target="_blank" class="button button-rounded button-large nott ls0">Apply Now</a>
    </div>
  </body>
</html>
`

test('Nuvento Systems run returns normalized jobs from the verified India careers page', async () => {
  const nuvento = await loadModule('../../scraper/nuventosystems/script.js')
  const requestedUrls = []

  assert.equal(nuvento.hasOfficialCareersHubSignal(nuventoCareersHubHtml), true)
  assert.equal(nuvento.hasOfficialIndiaCareersSignal(nuventoIndiaCareersHtml), true)
  assert.equal(nuvento.extractRoleSections(nuventoIndiaCareersHtml).length, 4)

  const jobs = await nuvento.createNuventoSystemsScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === nuvento.CAREERS_HUB_URL) return nuventoCareersHubHtml
      if (url === nuvento.CAREERS_URL) return nuventoIndiaCareersHtml
      throw new Error(`Unexpected Nuvento URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [nuvento.CAREERS_HUB_URL, nuvento.CAREERS_URL])
  assert.equal(jobs.length, 4)
  assert.deepEqual(jobs.map((job) => job.title), [
    'IT/Sr/JR Recruiter',
    'Sales and Marketing Intern (Paid Internship)',
    'Team Lead -Python',
    'US Finance & Accounts / Senior Executive',
  ])
  assert.equal(jobs[0].location, 'Bangalore (Onsite)')
  assert.equal(jobs[1].workplaceType, 'Remote')
  assert.equal(jobs[2].experienceRequired, '10+ Years')
  assert.equal(jobs[3].city, 'Kochi')
})

test('Quale Infotech sentinel validates the verified homepage, about, and contact pages before returning []', async () => {
  const quale = await loadModule('../../scraper/qualeinfotech/script.js')
  const requestedUrls = []

  assert.equal(quale.hasOfficialHomepageSignal(qualeHomepageHtml), true)
  assert.equal(quale.hasOfficialAboutSignal(qualeAboutHtml), true)
  assert.equal(quale.hasOfficialContactSignal(qualeContactHtml), true)
  assert.equal(quale.hasPublicCareersSignal(qualeHomepageHtml), false)
  assert.equal(
    quale.hasPublicCareersSignal(`
      <html><body><a href="https://qualeinfotech.com/careers/">Careers</a></body></html>
    `),
    true,
  )

  const jobs = await quale.createQualeInfotechScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === quale.HOMEPAGE_URL) return qualeHomepageHtml
      if (url === quale.ABOUT_URL) return qualeAboutHtml
      if (url === quale.CONTACT_URL) return qualeContactHtml
      throw new Error(`Unexpected Quale URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [quale.HOMEPAGE_URL, quale.ABOUT_URL, quale.CONTACT_URL])
  assert.deepEqual(jobs, [])
})

test('Capital Numbers Infotech sentinel validates the email-resume-only careers page and returns []', async () => {
  const capitalNumbers = await loadModule('../../scraper/capitalnumbersinfotech/script.js')

  assert.equal(capitalNumbers.hasOfficialCareersSignal(capitalNumbersCareersHtml), true)
  assert.equal(capitalNumbers.hasPublicJobListingSignal(capitalNumbersCareersHtml), false)

  const jobs = await capitalNumbers.createCapitalNumbersInfotechScraper().run({
    fetchText: async (url) => {
      assert.equal(url, capitalNumbers.CAREERS_URL)
      return capitalNumbersCareersHtml
    },
  })

  assert.deepEqual(jobs, [])
})

test('In Time Tec Visionsoft extracts India jobs from the verified public zwayam board', async () => {
  const inTimeTec = await loadModule('../../scraper/intimetecvisionsoft/script.js')
  const jsonRequests = []

  assert.equal(inTimeTec.hasOfficialCareersSignal(inTimeTecCareersHtml), true)
  assert.equal(inTimeTec.hasOfficialIndiaJobsSignal(inTimeTecJobsHtml), true)
  assert.deepEqual(inTimeTec.buildSearchPayload(), {
    filterCri: JSON.stringify({
      paginationStartNo: 0,
      selectedCall: 'sort',
      sortCriteria: {
        name: 'modifiedDate',
        isAscending: false,
      },
      anyOfTheseWords: '',
    }),
    domain: 'careers.intimetec.in',
    companyId: 'MTUxOTQ=',
  })
  assert.deepEqual(inTimeTec.extractPaginationSummary(inTimeTecSearchPayloadPage1), {
    hasNext: true,
    pageSize: 2,
    nextOffset: 2,
    totalCount: 3,
  })

  const jobs = await inTimeTec.createInTimeTecVisionsoftScraper().run({
    fetchText: async (url) => {
      if (url === inTimeTec.CAREERS_URL) return inTimeTecCareersHtml
      if (url === inTimeTec.INDIA_JOBS_URL) return inTimeTecJobsHtml
      throw new Error(`Unexpected In Time Tec URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      jsonRequests.push({ url, options })

      if (url === inTimeTec.SEARCH_API_URL) {
        const payload = JSON.parse(options.form.filterCri)
        return payload.paginationStartNo === 0
          ? inTimeTecSearchPayloadPage1
          : inTimeTecSearchPayloadPage2
      }

      if (url === inTimeTec.DETAIL_API_URL) {
        if (options.json.jobUrl === 'senior-ai-engineer-vlm') return inTimeTecSeniorAiDetailPayload
        if (options.json.jobUrl === 'linux-administrator') return inTimeTecLinuxAdminDetailPayload
      }

      throw new Error(`Unexpected In Time Tec JSON URL: ${url}`)
    },
  })

  assert.deepEqual(jsonRequests, [
    {
      url: 'https://public.zwayam.com/jobs/search',
      options: {
        method: 'POST',
        form: {
          filterCri: JSON.stringify({
            paginationStartNo: 0,
            selectedCall: 'sort',
            sortCriteria: {
              name: 'modifiedDate',
              isAscending: false,
            },
            anyOfTheseWords: '',
          }),
          domain: 'careers.intimetec.in',
          companyId: 'MTUxOTQ=',
        },
      },
    },
    {
      url: 'https://public.zwayam.com/jobs-service/v1/jobs/careersite',
      options: {
        method: 'POST',
        json: {
          jobUrl: 'senior-ai-engineer-vlm',
          externalSource: 'CareerSite',
          campusUrl: 'empty',
          companyId: '15194',
        },
      },
    },
    {
      url: 'https://public.zwayam.com/jobs/search',
      options: {
        method: 'POST',
        form: {
          filterCri: JSON.stringify({
            paginationStartNo: 2,
            selectedCall: 'sort',
            sortCriteria: {
              name: 'modifiedDate',
              isAscending: false,
            },
            anyOfTheseWords: '',
          }),
          domain: 'careers.intimetec.in',
          companyId: 'MTUxOTQ=',
        },
      },
    },
    {
      url: 'https://public.zwayam.com/jobs-service/v1/jobs/careersite',
      options: {
        method: 'POST',
        json: {
          jobUrl: 'linux-administrator',
          externalSource: 'CareerSite',
          campusUrl: 'empty',
          companyId: '15194',
        },
      },
    },
  ])

  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      city: job.city,
      state: job.state,
      country: job.country,
      jobId: job.jobId,
      requisitionId: job.requisitionId,
      minimumQualification: job.minimumQualification,
      applyUrl: job.applyUrl,
    })),
    [
      {
        title: 'Linux Administrator',
        location: 'Bangalore, Karnataka, India',
        city: 'Bangalore',
        state: 'Karnataka',
        country: 'India',
        jobId: '10528',
        requisitionId: '10528',
        minimumQualification: null,
        applyUrl: 'https://careers.intimetec.in/intimetec/jobview/linux-administrator',
      },
      {
        title: 'Senior AI Engineer - Vision Language Models (VLM)',
        location: 'Jaipur, Rajasthan, India; Bangalore, Karnataka, India',
        city: 'Jaipur',
        state: 'Rajasthan',
        country: 'India',
        jobId: '10526',
        requisitionId: '10526',
        minimumQualification: 'B.Tech / M.Tech',
        applyUrl: 'https://careers.intimetec.in/intimetec/jobview/senior-ai-engineer-vlm',
      },
    ],
  )
  assert.match(jobs[0].jobDescription, /Manage Linux production systems/i)
  assert.match(jobs[1].jobDescription, /Design multimodal AI systems/i)
})

test('Miracle Software Systems run returns normalized open positions from the first-party careers page', async () => {
  const miracle = await loadModule('../../scraper/miraclesoftwaresystems/script.js')

  assert.equal(miracle.hasOfficialCareersSignal(miracleCareersHtml), true)
  assert.equal(miracle.extractVisibleJobCards(miracleCareersHtml).length, 4)

  const jobs = await miracle.createMiracleSoftwareSystemsScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      assert.equal(url, miracle.CAREERS_URL)
      return miracleCareersHtml
    },
  })

  assert.equal(jobs.length, 4)
  assert.deepEqual(jobs.map((job) => job.title), [
    'Microsoft Dynamics 365 (D365) Technical Consultant',
    'SAP FI/ABAP Support Consultant',
    'ServiceNow ITSM Architect',
    'SQL/UKG Developer',
  ])
  assert.equal(
    jobs[0].applyUrl,
    'https://careers.miraclesoft.com/open-positions/open-positions-sub?jobId=MSSJ3045',
  )
  assert.equal(jobs[1].postingDate, '2026-08-03')
  assert.equal(jobs[3].location, 'Miracle Heights, India')
})
