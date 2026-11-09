import assert from 'node:assert/strict'
import test from 'node:test'

const loadTigerAnalyticsModule = async () => {
  try {
    return await import('../../scraper/tigeranalytics/script.js')
  } catch {
    assert.fail('Expected Tiger Analytics scraper module at ../../scraper/tigeranalytics/script.js')
  }
}

const LISTING_PAGE_1_HTML = String.raw`<!DOCTYPE html><html><body><script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"jobsData":{"rows":[{"id":56857,"created_on":1782151228524,"job_status":"OPEN","department":"Practices (TI_D) - Technology (TI_D_Tech) - AIML (TI_D_Tech_AIML)","title":"Sr. Associate AIML Engineer / AIML Engineer (Data Science)","location":"Chennai","experience_start":3,"experience_end":7,"description_external":"<div><b>Job Title: AIML Engineer (Data Science)</b></div><div><b>Locations: ChennaI 5 Days WFO</b></div><div><b>Notice period : Immediate to 30 Days</b></div><div><b>Skills : Data Science, Model Building, Python, Mode Deployment</b></div><div><b>Who we are</b></div><div>Tiger Analytics is a global leader in AI and analytics.</div><div><b>Required Skills &amp; Experience</b></div><ul><li>3-6 years of experience in Data Science.</li><li>Strong proficiency in Python.</li><li>Experience working with Apache Kafka.</li></ul>","job_type":"FULLTIME","code":"AIM03845","office":{"city":"Chennai","country":"India","location":"Chennai","name":"Kandanchavadi - OMR Chennai (Offshore Delivery Centre) ","state":"Tamilnadu","pin_code":"999999"}},{"id":56850,"created_on":1781853854886,"job_status":"OPEN","department":"Practices (TI_D) - Technology (TI_D_Tech) - IPE (TI_D_Tech_IPE) - Application Engineering (TI_D_Tech_Engg_App)","title":"Senior Engineer /Lead - Fullstack","location":"Pune","experience_start":3,"experience_end":8,"description_external":"<div><b>Title: Senior Engineer /Lead - React + Node</b></div><div>Location: Pune</div><div>Work Mode :3 Days WFO</div><div><b>Experience</b></div><div><b>Minimum professional experience as per the Level in full stack software development.</b></div><div><b>• Experience in a regulated industry is a plus</b></div>","job_type":"FULLTIME","code":"APP03838","office":{"city":"Chennai","country":"India","location":"Chennai","name":"Kandanchavadi - OMR Chennai (Offshore Delivery Centre) ","state":"Tamilnadu","pin_code":"999999"}},{"id":99999,"created_on":1782151228524,"job_status":"CLOSED","department":"Practices (TI_D) - Technology","title":"Closed Job","location":"Bangalore","experience_start":1,"experience_end":2,"description_external":"<div>Closed role</div>","job_type":"FULLTIME","code":"CLS0001","office":{"city":"Bangalore","country":"India","location":"Bangalore","name":"TA India - Bangalore - ODC","state":"Karnataka","pin_code":"999999"}}],"count":113}},"__N_SSP":true},"page":"/jobs","query":{},"buildId":"jEPRsaxO17zCozEuBEAkW","assetPrefix":"/careers","isFallback":false,"gssp":true,"customServer":true}</script></body></html>`

const LISTING_PAGE_2_HTML = String.raw`<!DOCTYPE html><html><body><script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"jobsData":{"rows":[{"id":56742,"created_on":1779431896436,"job_status":"OPEN","department":"Enablers (TI_ND) - Marketing and Communication (TI_ND_Marcom)","title":"Brand & Design Lead / Creative Lead","location":"Bangalore, Chennai","experience_start":10,"experience_end":15,"description_external":"<div><b>Brand &amp; Design Lead / Creative Lead</b></div><div>Chennai &amp; Bengaluru</div><div><b>Desired Experience &amp; Skills</b></div><div>Graphic Design, Presentation Design, Figma</div>","job_type":"FULLTIME","code":"MAR03732","office":{"city":"Bangalore","country":"India","location":"Bangalore","name":"TA India - Bangalore - ODC","state":"Karnataka","pin_code":"999999"}}],"count":113}},"__N_SSP":true},"page":"/jobs","query":{"page":"2"},"buildId":"jEPRsaxO17zCozEuBEAkW","assetPrefix":"/careers","isFallback":false,"gssp":true,"customServer":true}</script></body></html>`

test('Tiger Analytics URL builders stay on the public India SenseHQ routes', async () => {
  const {
    API_BASE_URL,
    CAREER_PAGE_URL,
    buildJobUrl,
    buildListingUrl,
  } = await loadTigerAnalyticsModule()

  assert.equal(API_BASE_URL, 'https://tiger-analytics.sensehq.com/careers')
  assert.equal(CAREER_PAGE_URL, 'https://www.tigeranalytics.com/about-us/current-openings/')
  assert.equal(
    buildListingUrl(),
    'https://tiger-analytics.sensehq.com/careers/jobs',
  )
  assert.equal(
    buildListingUrl({ page: 2 }),
    'https://tiger-analytics.sensehq.com/careers/jobs?page=2',
  )
  assert.equal(
    buildJobUrl(56857),
    'https://tiger-analytics.sensehq.com/careers/jobs/56857',
  )
})

test('extractSearchResults keeps only open Tiger Analytics India jobs from the SenseHQ listings pages', async () => {
  const { extractPaginationSummary, extractSearchResults } = await loadTigerAnalyticsModule()
  const jobs = extractSearchResults(LISTING_PAGE_1_HTML)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Sr. Associate AIML Engineer / AIML Engineer (Data Science)',
    company: 'Tiger Analytics',
    department: 'Practices (TI_D) - Technology (TI_D_Tech) - AIML (TI_D_Tech_AIML)',
    location: 'Chennai, India',
    city: 'Chennai',
    jobId: '56857',
    requisitionId: 'AIM03845',
    sourceUrl: 'https://tiger-analytics.sensehq.com/careers/jobs/56857',
    applyUrl: 'https://tiger-analytics.sensehq.com/careers/jobs/56857',
    employmentType: 'Full-time',
    experienceRequired: '3-7 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Data Science',
      'Model Building',
      'Python',
      'Mode Deployment',
    ],
    postingDate: '2026-06-22',
    closingDate: null,
    jobDescription: 'Job Title: AIML Engineer (Data Science) Locations: ChennaI 5 Days WFO Notice period : Immediate to 30 Days Skills : Data Science, Model Building, Python, Mode Deployment Who we are Tiger Analytics is a global leader in AI and analytics. Required Skills & Experience 3-6 years of experience in Data Science. Strong proficiency in Python. Experience working with Apache Kafka.',
  })

  assert.deepEqual(extractPaginationSummary(LISTING_PAGE_1_HTML), {
    currentPage: 1,
    pageSize: 3,
    totalCount: 113,
    totalPages: 38,
    hasNext: true,
  })
})

test('run paginates Tiger Analytics listing pages, filters open jobs, and decorates shared runner fields', async () => {
  const {
    buildListingUrl,
    createTigerAnalyticsScraper,
  } = await loadTigerAnalyticsModule()
  const requests = []
  const scraper = createTigerAnalyticsScraper({ maxPages: 2, maxJobs: 3 })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requests.push(url)

      if (url === buildListingUrl({ page: 1 })) return LISTING_PAGE_1_HTML
      if (url === buildListingUrl({ page: 2 })) return LISTING_PAGE_2_HTML

      throw new Error(`Unexpected Tiger Analytics URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    buildListingUrl({ page: 1 }),
    buildListingUrl({ page: 2 }),
  ])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'tigeranalytics')
  assert.equal(jobs[0].company, 'Tiger Analytics')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[1].title, 'Senior Engineer /Lead - Fullstack')
  assert.equal(jobs[2].location, 'Bangalore, Chennai, India')
  assert.deepEqual(jobs[2].requiredSkills, [
    'Graphic Design',
    'Presentation Design',
    'Figma',
  ])
  assert.ok(jobs.every((job) => typeof job.scrapedAt === 'string' && job.scrapedAt.length > 0))
})
