import assert from 'node:assert/strict'
import test from 'node:test'
import { sagCareersHtml, sagApplicationHtmlByUrl, sagExpectedRequests } from './fixtures/saginfotechLegacyCurrentOpenings.mjs'

const FIXED_SCRAPED_AT = '2026-07-18T00:00:00.000Z'

const htmlAttributeJson = (value) => JSON.stringify(value).replace(/"/g, '&quot;')
const hiddenInputWithValueFirst = (id, value) =>
  `<input type="hidden" value="${htmlAttributeJson(value)}" id="${id}">`

const loadModule = async (relativePath) => {
  try {
    return await import(relativePath)
  } catch {
    assert.fail(`Expected scraper module at ${relativePath}`)
  }
}

const cognusHomepageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <nav>
      <a href="/life-at-cognus">Life At Cognus</a>
      <a href="https://cognustechnology.zohorecruit.in/jobs/Careers">Join Us</a>
    </nav>
  </body>
</html>
`

const cognusModuleMeta = [
  {
    api_name: 'Job_Openings',
    id: '61921000000002481',
    module_name: 'Potentials',
    fields: [
      { id: '61921000000003081' },
      { id: '61921000000003067' },
      { id: '61921000000003125' },
      { id: '61921000000003103' },
      { id: '61921000000003101' },
      { id: '61921000000028001' },
      { id: '61921000000003105' },
      { id: '61921000000003107' },
      { id: '61921000000003091' },
      { id: '61921000000003143' },
    ],
    layouts: [
      {
        id: '61921000000002565',
        sections: [
          {
            id: '1',
            fields: [
              { id: '61921000000003081', api_name: 'Job_Opening_Name' },
              { id: '61921000000003067', api_name: 'Job_Type' },
              { id: '61921000000003125', api_name: 'Work_Experience' },
            ],
          },
          {
            id: '4',
            fields: [
              { id: '61921000000003103', api_name: 'State' },
              { id: '61921000000003101', api_name: 'City' },
              { id: '61921000000028001', api_name: 'Zip_Code' },
              { id: '61921000000003105', api_name: 'Country' },
            ],
          },
          {
            id: '5',
            fields: [
              { id: '61921000000003107', api_name: 'Industry' },
              { id: '61921000000003091', api_name: 'Date_Opened' },
            ],
          },
          {
            id: '3',
            fields: [
              { id: '61921000000003143', api_name: 'Job_Description' },
            ],
          },
        ],
      },
    ],
  },
]

const cognusPageJson = {
  detail: {
    section: {
      data: [
        {
          blocktype: 'jobs',
          title: 'Join us',
          subtitle: 'Current Openings',
        },
      ],
    },
  },
}

const cognusMeta = {
  org_info: {
    company_name: 'Cognus Technology',
    website: 'http://www.cognustechnology.com',
  },
  list_url: 'https://cognustechnology.zohorecruit.in/jobs/Careers',
  page_name: 'Careers',
  _no_longer: 'zr.pos.no.act',
}

const cognusCareersHtml = (jobsPayload) => `
<!doctype html>
<html lang="en">
  <body>
    ${hiddenInputWithValueFirst('pageJson', cognusPageJson)}
    ${hiddenInputWithValueFirst('moduleMeta', cognusModuleMeta)}
    ${hiddenInputWithValueFirst('jobs', jobsPayload)}
    ${hiddenInputWithValueFirst('meta', cognusMeta)}
    <div id="career-website-main"></div>
  </body>
</html>
`

const cognusCurrentJobsPayload = [
  {
    Industry: 'Education',
    Job_Type: 'Full time',
    Job_Opening_Name: 'Senior Manager',
    Posting_Title: 'Senior Manager',
    Country: 'Gradding',
    Is_Locked: false,
    id: '61921000006556014',
    City: 'Jaipur',
    Publish: true,
    Keep_on_Career_Site: false,
  },
]

const legacyWeakSagCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h2>Current Openings <span>(<strong>HR - </strong><a href="tel:9672850509">9672850509</a>)</span></h2>
    <div class="career-box">
      <div class="col-md-10 col-9"><h3>Tech Support <span>0-2 Years</span></h3></div>
      <p><span class="dispmsg">Tech Support Executive</span> (No. of Vacancies: 2)</p>
      <a class="btn send-btn-career" href="ApplyCareer.aspx?code=0023">APPLY NOW!<i class="fa fa-send"></i></a>
    </div>
    <div class="career-box">
      <div class="col-md-10 col-9"><h3>Angular Developer <span>1-5 Years</span></h3></div>
      <p><span class="dispmsg">Angular Developer</span> (No. of Vacancies: 2)</p>
      <a class="btn send-btn-career" href="ApplyCareer.aspx?code=0019">APPLY NOW!<i class="fa fa-send"></i></a>
    </div>
  </body>
</html>
`

const intechCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career - The INTECH Group</title>
  </head>
  <body>
    <p>At INTECH Creative Services, we believe that when people grow, businesses grow.</p>
    <h2>Find Your Perfect Role</h2>
    <div data-elementor-type="loop-item" data-elementor-id="12806" class="elementor elementor-12806 e-loop-item e-loop-item-17285 post-17285 jobs type-jobs status-publish hentry">
      <h2 class="elementor-heading-title elementor-size-default">Assistant Consultant - Oracle Fusion</h2>
      <h6 class="elementor-heading-title elementor-size-default">Department:</h6>
      <div class="elementor-widget-text-editor">Technical</div>
      <h6 class="elementor-heading-title elementor-size-default">Experience:</h6>
      <div class="elementor-widget-text-editor">8-10 years</div>
      <h6 class="elementor-heading-title elementor-size-default">Job Type:</h6>
      <div class="elementor-widget-text-editor">Permanent</div>
      <h6 class="elementor-heading-title elementor-size-default">Vacancies:</h6>
      <div class="elementor-widget-text-editor">1</div>
      <h6 class="elementor-heading-title elementor-size-default">Location:</h6>
      <div class="elementor-widget-text-editor">Work From Home</div>
      <a class="elementor-button elementor-button-link elementor-size-sm" href="https://theintechgroup.com/career/jobs/assistant-consultant-oracle-fusion-2/">
        <span class="elementor-button-text">Apply Now</span>
      </a>
    </div>
    <div data-elementor-type="loop-item" data-elementor-id="12806" class="elementor elementor-12806 e-loop-item e-loop-item-16979 post-16979 jobs type-jobs status-publish hentry">
      <h2 class="elementor-heading-title elementor-size-default">Assistant Consultant - Oracle Fusion</h2>
      <h6 class="elementor-heading-title elementor-size-default">Department:</h6>
      <div class="elementor-widget-text-editor">Technical</div>
      <h6 class="elementor-heading-title elementor-size-default">Experience:</h6>
      <div class="elementor-widget-text-editor">5-8 years</div>
      <h6 class="elementor-heading-title elementor-size-default">Job Type:</h6>
      <div class="elementor-widget-text-editor">Contractual</div>
      <h6 class="elementor-heading-title elementor-size-default">Vacancies:</h6>
      <div class="elementor-widget-text-editor">1</div>
      <h6 class="elementor-heading-title elementor-size-default">Location:</h6>
      <div class="elementor-widget-text-editor">Work From Home</div>
      <a class="elementor-button elementor-button-link elementor-size-sm" href="https://theintechgroup.com/career/jobs/assistant-consultant-oracle-fusion/">
        <span class="elementor-button-text">Apply Now</span>
      </a>
    </div>
    <div data-elementor-type="loop-item" data-elementor-id="12806" class="elementor elementor-12806 e-loop-item e-loop-item-16552 post-16552 jobs type-jobs status-publish hentry">
      <h2 class="elementor-heading-title elementor-size-default">Senior Executive - Implementation</h2>
      <h6 class="elementor-heading-title elementor-size-default">Department:</h6>
      <div class="elementor-widget-text-editor">Technical</div>
      <h6 class="elementor-heading-title elementor-size-default">Experience:</h6>
      <div class="elementor-widget-text-editor">5-8 years</div>
      <h6 class="elementor-heading-title elementor-size-default">Job Type:</h6>
      <div class="elementor-widget-text-editor">Permanent</div>
      <h6 class="elementor-heading-title elementor-size-default">Vacancies:</h6>
      <div class="elementor-widget-text-editor">1</div>
      <h6 class="elementor-heading-title elementor-size-default">Location:</h6>
      <div class="elementor-widget-text-editor">Bengaluru</div>
      <a class="elementor-button elementor-button-link elementor-size-sm" href="https://theintechgroup.com/career/jobs/senior-executive-implementation/">
        <span class="elementor-button-text">Apply Now</span>
      </a>
    </div>
  </body>
</html>
`

const mindfireCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Career Possibilities</h1>
    <a href="https://apply.mindfiresolutions.com/">APPLY NOW</a>
  </body>
</html>
`

const mindfireJobpostPayload = [
  {
    jobPostingId: 5100,
    position: 'AWS Data Engineer',
    locations: 'Bhubaneswar, Delhi - NCR, Remote Working',
    minExp: 3,
    maxExp: 5,
    jobDetails: 'Build and optimize scalable data platforms on AWS.',
    qualifications: '<div>- Bachelor degree in Computer Science.</div>',
    responsibilities: '<div>- Design ETL pipelines.</div>',
    requiredSkills: '<div>- Python</div><div>- SQL</div>',
    exposureSkills: '<div>- Exposure to Generative AI.</div>',
    compensation: null,
    jobType: 1,
    publishDate: '2026-04-09T00:00:00',
    isActive: 1,
    isPublished: 1,
  },
  {
    jobPostingId: 5102,
    position: 'AI/ML Engineer',
    locations: 'Bhubaneswar, Delhi - NCR, Remote Working',
    minExp: 2,
    maxExp: 4,
    jobDetails: 'Develop Generative AI and Agentic AI solutions.',
    qualifications: '<div>- Bachelor degree in Computer Science.</div>',
    responsibilities: '<div>- Build production AI systems.</div>',
    requiredSkills: '<div>- Python</div><div>- LangChain</div>',
    exposureSkills: null,
    compensation: null,
    jobType: 1,
    publishDate: '2026-05-05T00:00:00',
    isActive: 1,
    isPublished: 1,
  },
]

const hiddenBrainsCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h2>Join a People-first Environment Where Personal Growth and Achievements Are Celebrated</h2>
    <a href="#">ALL POSITIONS (15)</a>
    <div class="JobPostView_inner-box__8B_7h ">
      <div class="JobPostView_inner-title__e9SXi">Business Development Executive <span class="JobPostView_sub-title__vg5Ow"></span></div>
      <span class="JobPostView_openings-text__sLvQK">7 Openings</span>
      <ul><li>0 - 2 Years Experience</li><li>Full Time</li></ul>
      <a href="#" class="JobPostView_view-details-link__DJ1_Q ">View Details</a>
      <a href="#InquiryJob" class="JobPostView_apply-now-btn___CGti">APPLY NOW!</a>
    </div>
    <div class="JobPostView_inner-box__8B_7h ">
      <div class="JobPostView_inner-title__e9SXi">MERN Fullstack Developer - (Onsite - Abu Dhabi) <span class="JobPostView_sub-title__vg5Ow"></span></div>
      <span class="JobPostView_openings-text__sLvQK">10 Openings</span>
      <ul><li>5 - 8 Years Experience</li><li>Full Time</li></ul>
      <a href="#" class="JobPostView_view-details-link__DJ1_Q ">View Details</a>
      <a href="#InquiryJob" class="JobPostView_apply-now-btn___CGti">APPLY NOW!</a>
    </div>
    <div class="JobPostView_inner-box__8B_7h ">
      <div class="JobPostView_inner-title__e9SXi">Creative UI/UX Lead <span class="JobPostView_sub-title__vg5Ow"></span></div>
      <span class="JobPostView_openings-text__sLvQK">2 Openings</span>
      <ul><li>8 - 10 Years Experience</li><li>Full Time</li></ul>
      <a href="#" class="JobPostView_view-details-link__DJ1_Q ">View Details</a>
      <a href="#InquiryJob" class="JobPostView_apply-now-btn___CGti">APPLY NOW!</a>
    </div>
  </body>
</html>
`

test('Cognus Technology helper extraction stays pinned to the live official homepage handoff and hidden-input payload', async () => {
  const cognus = await loadModule('../../scraper/cognustechnology/script.js')
  const jobsHtml = cognusCareersHtml(cognusCurrentJobsPayload)

  assert.equal(cognus.CAREERS_URL, 'https://cognustechnology.zohorecruit.in/jobs/Careers')
  assert.equal(cognus.hasOfficialHomepageSignal(cognusHomepageHtml), true)
  assert.deepEqual(cognus.extractHiddenInputJson(jobsHtml, 'jobs'), cognusCurrentJobsPayload)
  assert.equal(cognus.hasOfficialCareersSignal(jobsHtml), true)

  const extractedJobs = cognus.extractJobsFromOfficialBoard(jobsHtml)
  assert.equal(extractedJobs.length, 1)
  assert.equal(extractedJobs[0].title, 'Senior Manager')
  assert.equal(extractedJobs[0].city, null)
  assert.equal(extractedJobs[0].country, null)
  assert.equal(extractedJobs[0].location, null)
  assert.equal(extractedJobs[0].sourceCountryScopeUnresolved, true)
  assert.equal(extractedJobs[0].nativeLocationEvidence.City, 'Jaipur')
  assert.equal(extractedJobs[0].nativeLocationEvidence.Country, 'Gradding')
  assert.equal(extractedJobs[0].nativeLocation, 'Jaipur, Gradding')
  assert.equal(extractedJobs[0].employmentType, 'Full time')

  const indiaJobs = cognus.extractJobsFromOfficialBoard(cognusCareersHtml(
    cognusCurrentJobsPayload.map(job => ({ ...job, Country: 'India' })),
  ))
  assert.equal(indiaJobs.length, 1)
  assert.equal(indiaJobs[0].title, 'Senior Manager')
  assert.equal(indiaJobs[0].employmentType, 'Full time')
  assert.equal(indiaJobs[0].city, 'Jaipur')
  assert.equal(indiaJobs[0].country, 'India')
  assert.equal(indiaJobs[0].location, 'Jaipur, India')
  assert.equal(indiaJobs[0].sourceCountryScopeUnresolved, false)

  const requestedUrls = []
  const liveJobs = await cognus.createCognusTechnologyScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchDetail: async () => { throw new Error('Detail unavailable in legacy listing fixture') },
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === cognus.HOMEPAGE_URL) return cognusHomepageHtml
      if (url === cognus.CAREERS_URL) return jobsHtml
      throw new Error(`Unexpected Cognus URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [cognus.HOMEPAGE_URL, cognus.CAREERS_URL])
  assert.equal(liveJobs.length, 1)
  assert.equal(liveJobs[0].title, 'Senior Manager')
  assert.equal(liveJobs[0].companyCareerPage, cognus.CAREERS_URL)
  assert.equal(liveJobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(liveJobs[0].nativeLocationEvidence.City, 'Jaipur')
  assert.equal(liveJobs[0].nativeLocationEvidence.Country, 'Gradding')
  assert.equal(liveJobs[0].city, null)
  assert.equal(liveJobs[0].country, null)
  assert.equal(liveJobs[0].location, null)
  assert.equal(liveJobs[0].sourceCountryScopeUnresolved, true)
  assert.equal(liveJobs[0].sourceDetailContentComplete, false)
  assert.equal(liveJobs[0].sourceDetailComplete, false)
  assert.equal(liveJobs[0].sourceDetailFailureKind, 'source-detail-access-failed')
  assert.equal(liveJobs[0].sourceListingComplete, false)
  assert.equal(liveJobs[0].sourceScopeComplete, false)
  assert.equal(liveJobs[0].lifecycleCleanupAllowed, false)

  const emptyJobs = await cognus.createCognusTechnologyScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      if (url === cognus.HOMEPAGE_URL) return cognusHomepageHtml
      if (url === cognus.CAREERS_URL) return cognusCareersHtml([])
      throw new Error(`Unexpected Cognus URL: ${url}`)
    },
  })

  assert.deepEqual(emptyJobs, [])
})

test('SAG Infotech run returns normalized jobs from the verified first-party current openings page', async () => {
  const sag = await loadModule('../../scraper/saginfotech/script.js')

  assert.equal(sag.hasOfficialCareersSignal(sagCareersHtml), true)
  assert.deepEqual(sag.extractOpeningCards(sagCareersHtml).map((job) => job.title), [
    'Tech Support Executive',
    'Angular Developer',
  ])

  const requestedUrls = []
  const jobs = await sag.createSagInfotechScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === sag.CAREERS_URL) {
        assert.equal(url, sag.CAREERS_URL)
        return sagCareersHtml
      }
      assert.ok(Object.hasOwn(sagApplicationHtmlByUrl, url), `Unexpected SAG application URL: ${url}`)
      return sagApplicationHtmlByUrl[url]
    },
  })

  assert.deepEqual(requestedUrls, sagExpectedRequests)
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'Angular Developer')
  assert.equal(jobs[0].applyUrl, 'https://saginfotech.com/ApplyCareer.aspx?code=0019')
  assert.equal(jobs[1].title, 'Tech Support Executive')
  assert.equal(jobs[1].openingsCount, 2)
  assert.match(jobs[0].jobDescription, /Proficiency with JavaScript and HTML5/)
  assert.ok(jobs.every(job => job.jobDescription.length > 200 && job.rawNativeRoleEvidence.applicationLandingIdentityQualified === true))
  assert.ok(jobs.every(job => job.country === null && job.location === null && job.city === null))
  assert.ok(jobs.every(job => job.postingDate === null && job.closingDate === null && job.scrapedAt === FIXED_SCRAPED_AT))
  assert.equal(jobs[0].nativeCollectionEvidence.sourceScopeComplete, false)
})

test('SAG Infotech legacy weak careers markup cannot certify employer, role requirements or application identity', async () => {
  const sag = await loadModule('../../scraper/saginfotech/script.js')
  assert.equal(sag.hasOfficialCareersSignal(legacyWeakSagCareersHtml), true)
  assert.throws(() => sag.extractOpeningCards(legacyWeakSagCareersHtml), /employer careers identity/)
  const requestedUrls = []
  await assert.rejects(sag.createSagInfotechScraper({ now: () => FIXED_SCRAPED_AT }).run({
    fetchText: async url => { requestedUrls.push(url); assert.equal(url, sag.CAREERS_URL); return legacyWeakSagCareersHtml },
  }), /employer careers identity/)
  assert.deepEqual(requestedUrls, [sag.CAREERS_URL])
})

test('SAG Infotech requires the corresponding exact native application landing identity', async () => {
  const sag = await loadModule('../../scraper/saginfotech/script.js'), requestedUrls = []
  await assert.rejects(sag.createSagInfotechScraper({ now: () => FIXED_SCRAPED_AT }).run({
    fetchText: async url => {
      requestedUrls.push(url)
      if (url === sag.CAREERS_URL) return sagCareersHtml
      assert.equal(url, 'https://saginfotech.com/ApplyCareer.aspx?code=0023')
      return sagApplicationHtmlByUrl['https://saginfotech.com/ApplyCareer.aspx?code=0019']
    },
  }), /application role title\/code contradiction/)
  assert.deepEqual(requestedUrls, [sag.CAREERS_URL, 'https://saginfotech.com/ApplyCareer.aspx?code=0023'])
})

test('Intech Creative Services card helpers retain the verified older native URL route', async () => {
  const intech = await loadModule('../../scraper/intechcreativeservices/script.js')
  assert.equal(intech.hasOfficialCareersSignal(intechCareersHtml), true)
  const cards = intech.extractLoopGridJobCards(intechCareersHtml)
  assert.equal(cards.length, 3)
  assert.equal(cards[0].title, 'Assistant Consultant - Oracle Fusion')
  assert.equal(cards[0].location, 'Work From Home')
  assert.equal(cards[1].employmentType, 'Contractual')
  assert.equal(cards[2].location, 'Bengaluru')
  assert.match(cards[2].sourceUrl, /\/career\/jobs\/senior-executive-implementation\/$/)
})

test('Mindfire Solutions run returns normalized jobs from the public jobpost API payload', async () => {
  const mindfire = await loadModule('../../scraper/mindfiresolutions/script.js')
  const requestedUrls = []

  assert.equal(mindfire.hasOfficialCareersSignal(mindfireCareersHtml), true)
  assert.deepEqual(mindfire.extractJobsFromJobpostPayload(mindfireJobpostPayload).map((job) => job.title), [
    'AI/ML Engineer',
    'AWS Data Engineer',
  ])

  const jobs = await mindfire.createMindfireSolutionsScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, mindfire.CAREERS_URL)
      return mindfireCareersHtml
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, mindfire.JOBS_API_URL)
      return mindfireJobpostPayload
    },
  })

  assert.deepEqual(requestedUrls, [mindfire.CAREERS_URL, mindfire.JOBS_API_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'AI/ML Engineer')
  assert.equal(jobs[1].location, 'Bhubaneswar, Delhi - NCR, Remote Working')
  assert.equal(jobs[1].employmentType, 'Full Time')
})

test('Hidden Brains InfoTech run returns visible ALL POSITIONS jobs and excludes the Abu Dhabi opening', async () => {
  const hiddenBrains = await loadModule('../../scraper/hiddenbrainsinfotech/script.js')

  assert.equal(hiddenBrains.hasOfficialCareersSignal(hiddenBrainsCareersHtml), true)
  assert.equal(hiddenBrains.extractVisibleJobCards(hiddenBrainsCareersHtml).length, 3)

  const jobs = await hiddenBrains.createHiddenBrainsInfotechScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      assert.equal(url, hiddenBrains.CAREERS_URL)
      return hiddenBrainsCareersHtml
    },
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs.map((job) => job.title), [
    'Business Development Executive',
    'Creative UI/UX Lead',
  ])
  assert.equal(jobs[0].applyUrl, 'https://www.hiddenbrains.com/careers.html#InquiryJob')
  assert.equal(jobs[1].experienceRequired, '8 - 10 Years')
})
