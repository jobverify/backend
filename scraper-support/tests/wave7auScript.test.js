import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs/promises'

import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const FIXED_SCRAPED_AT = '2026-07-18T00:00:00.000Z'

const loadModule = async (relativePath) => {
  try {
    return await import(relativePath)
  } catch {
    assert.fail(`Expected scraper module at ${relativePath}`)
  }
}

const excelraWordpressRenderedContent = `
<!doctype html>
<html lang="en">
  <body>
    <p>Excelra job opportunities</p>
    <h1>A more fulfilling career</h1>
    <h2>Current openings</h2>
    <div class="job-card">
      <h4 class="display-2 m-0 p-0 custom-theme-color"><span class="title">Senior DevOps Engineer</span></h4>
      <div class="iwithtext"><div class="iwt-text"><strong>Full Time Employment</strong></div></div>
      <div class="iwithtext"><div class="iwt-text"><strong>Hyderabad, India</strong></div></div>
      <div class="iwithtext"><div class="iwt-text"><strong>5-10 Years</strong></div></div>
      [nectar_btn size=&#8221;large&#8221; button_style=&#8221;regular&#8221; text=&#8221;Apply now&#8221; url=&#8221;https://excelra.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a55dd08b32d7&#8221;]
    </div>
    <div class="job-card">
      <h4 class="display-2 m-0 p-0 custom-theme-color"><span class="title">Medicinal Chemistry Consultant</span></h4>
      <div class="iwithtext"><div class="iwt-text"><strong>Consultant</strong></div></div>
      <div class="iwithtext"><div class="iwt-text"><strong>Hyderabad, India</strong></div></div>
      <div class="iwithtext"><div class="iwt-text"><strong>8-12 Years</strong></div></div>
      [nectar_btn size=&#8221;large&#8221; button_style=&#8221;regular&#8221; text=&#8221;Apply now&#8221; url=&#8221;https://excelra.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a4d517f7f8e2&#8221;]
    </div>
    <div class="job-card">
      <h4 class="display-2 m-0 p-0 custom-theme-color"><span class="title">Data Engineer</span></h4>
      <div class="iwithtext"><div class="iwt-text"><strong>Consultant</strong></div></div>
      <div class="iwithtext"><div class="iwt-text"><strong>Germany</strong></div></div>
      <div class="iwithtext"><div class="iwt-text"><strong>5-12 Years</strong></div></div>
      [nectar_btn size=&#8221;large&#8221; button_style=&#8221;regular&#8221; text=&#8221;Apply now&#8221; url=&#8221;https://excelra.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a3bc08f1459b&#8221;]
    </div>
  </body>
</html>
`

const excelraWordpressPagesPayload = [
  {
    slug: 'careers', status: 'publish', link: 'https://www.excelra.com/careers/',
    content: {
      rendered: excelraWordpressRenderedContent,
    },
  },
]

const blazeclanCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h2>Join us to grow your career by doing what you love to do and treading the path where you want to go.</h2>
    <a href="https://blazeclan.zohorecruit.in/jobs/Careers" class="cta-btn" target="_blank"><span>Current Openings</span></a>
  </body>
</html>
`

const blazeclanBrokenBoardHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>blazeclan.zohorecruit.in does not exist.</h1>
    <a href="https://recruit.zoho.in/">click here</a>
    <a href="https://www.zoho.in/">Powered by</a>
  </body>
</html>
`

const rebitCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>ReBIT - Reserve Bank Information Technology</title>
    <base href="/">
    <script src="https://www.google.com/recaptcha/api.js?render=explicit"></script>
    <script src="polyfills-5CFQRCPP.js"></script>
    <script src="main-DIP7EZNW.js"></script>
  </head>
  <body>
    <app-root></app-root>
  </body>
</html>
`


const rebitClientFixture = await fs.readFile(new URL('../../scraper/reservebankinformationtechnology/fixtures/current-client.js.txt', import.meta.url), 'utf8')
const rebitConfigFixture = await fs.readFile(new URL('../../scraper/reservebankinformationtechnology/fixtures/current-config.js.txt', import.meta.url), 'utf8')
const rebitFetchText = async url => {
  if (url === 'https://rebit.org.in/careers/') return rebitCareersHtml
  if (url === 'https://rebit.org.in/main-DIP7EZNW.js') return rebitClientFixture
  if (url === 'https://rebit.org.in/chunk-DFJHAP4Q.js') return rebitConfigFixture
  assert.fail('Unexpected ReBIT fixture URL: ' + url)
}

const rebitAuthResponse = {
  status: 'success',
  access_token: 'token-123',
  refresh_token: 'refresh-123',
  expires_in: 900,
  token_type: 'Bearer',
}

const rebitCurrentOpeningsPayload = [
  {
    id: '169',
    job_title: 'Lead - Application Security SSDLC',
    job_icon: '',
    department: 'Cyber Security',
    leadership_position: false,
    location: 'Navi Mumbai, Bengaluru',
    job_experience: '6 - 8',
    created_on: '29 June 2026',
    apply_now_link: 'https://rebithr.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6788af7cc042e',
    job_status: true,
    job_desc: '',
    key_responsibilities: [],
    requirements: [],
    leadership_message: {
      leadership_designation: '',
      leadership_message_title: '',
      leadership_message_video: '',
    },
  },
  {
    id: '168',
    job_title: 'SOC - SIEM Admin Specialist',
    job_icon: '',
    department: 'Cyber Security',
    leadership_position: false,
    location: 'Navi Mumbai, Maharashtra, India',
    job_experience: '4 - 6 Years',
    created_on: '29 June 2026',
    apply_now_link: 'https://rebithr.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a66698045ca954',
    job_status: true,
    job_desc: '',
    key_responsibilities: [],
    requirements: [],
    leadership_message: {
      leadership_designation: '',
      leadership_message_title: '',
      leadership_message_video: '',
    },
  },
]

const amtexCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h2 class="amtex-form-title">Join Our Team</h2>
    <div class="tiles3a tiles3color1">
      <a class="tiles3A randomise" href="/career-list/business-analyst"></a>
      <a class="tiles3A randomise" href="#"></a>
      <a class="tiles3A randomise" href="#"></a>
    </div>
    <label class="amtex-label">Position Applying For <span class="required">*</span></label>
    <select>
      <option value="Software Engineer">Software Engineer</option>
      <option value="Senior Software Engineer">Senior Software Engineer</option>
      <option value="Business Analyst">Business Analyst</option>
    </select>
  </body>
</html>
`

const amtexBusinessAnalystDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h2 class="amtex-form-title">Apply for Business Intelligence Analyst/Developer</h2>
    <p class="amtex-form-subtitle">Join our team in New York, NY</p>
    <label class="amtex-label">Position Applying For <span class="required">*</span></label>
  </body>
</html>
`

const nucsoftCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Unlock Your Potential with</h1>
    <h2>NUCSOFT</h2>
    <a href="https://nucsoft.com/openings">View career opportunities</a>
    <div class="career-card">
      <p class="card-header">Flutter Developer</p>
      <p>Review software specs and UI mockups to develop cross-platform Flutter apps using Dart.</p>
      <a href="https://nucsoft.com/openings?job=Flutter%20Developer" class="apply-button">Apply Now</a>
    </div>
    <div class="career-card">
      <p class="card-header">DBA/SQL Developer</p>
      <p>Develop and maintain secure, high-availability SQL databases with MySQL expertise.</p>
      <a href="https://nucsoft.com/openings?job=DBA%2FSQL%20Developer" class="apply-button">Apply Now</a>
    </div>
  </body>
</html>
`

test('Excelra Knowledge Solutions run returns only India jobs from the verified WordPress careers payload', async () => {
  const excelra = await loadModule('../../scraper/excelraknowledgesolutions/script.js')

  assert.equal(excelra.hasOfficialCareersSignal(excelraWordpressRenderedContent), true)
  assert.equal(excelra.extractVisibleJobCards(excelraWordpressRenderedContent).length, 3)

  const jobs = await excelra.createExcelraKnowledgeSolutionsScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchJson: async (url) => {
      assert.equal(url, excelra.CAREERS_WORDPRESS_API_URL)
      return excelraWordpressPagesPayload
    },
    fetchText: async (url) => {
      assert.fail(`fetchText should not be called when ${url} has a healthy WordPress API payload`)
    },
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      employmentType: job.employmentType,
      experienceRequired: job.experienceRequired,
      applyUrl: job.applyUrl,
    })),
    [
      {
        title: 'Medicinal Chemistry Consultant',
        location: 'Hyderabad, India',
        employmentType: 'Contract',
        experienceRequired: '8-12 Years',
        applyUrl: 'https://excelra.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a4d517f7f8e2',
      },
      {
        title: 'Senior DevOps Engineer',
        location: 'Hyderabad, India',
        employmentType: 'Full-time',
        experienceRequired: '5-10 Years',
        applyUrl: 'https://excelra.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a55dd08b32d7',
      },
    ],
  )
})

test('Excelra Knowledge Solutions fails closed when the verified WordPress careers contract drifts', async () => {
  const excelra = await loadModule('../../scraper/excelraknowledgesolutions/script.js')

  await assert.rejects(
    excelra.createExcelraKnowledgeSolutionsScraper({
      now: () => FIXED_SCRAPED_AT,
    }).run({
      fetchJson: async () => [{
        content: {
          rendered: '<html><body><h1>Current openings</h1></body></html>',
        },
      }],
      fetchText: async () => {
        assert.fail('fetchText should not be called when the WordPress API responds')
      },
    }),
    /verified first-party careers page/i,
  )
})

test('Blazeclan Technologies reports a missing Zoho tenant as discovery-only inventory evidence', async () => {
  const blazeclan = await loadModule('../../scraper/blazeclantechnologies/script.js')
  const requestedUrls = []

  assert.equal(blazeclan.hasOfficialCareersSignal(blazeclanCareersHtml), true)
  assert.equal(blazeclan.isBrokenZohoBoardPage(blazeclanBrokenBoardHtml), true)

  const jobs = await blazeclan.createBlazeclanTechnologiesScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === blazeclan.CAREERS_URL) return blazeclanCareersHtml
      if (url === blazeclan.BROKEN_BOARD_URL) return blazeclanBrokenBoardHtml
      throw new Error(`Unexpected Blazeclan URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [blazeclan.CAREERS_URL, blazeclan.BROKEN_BOARD_URL])
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs)?.status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs)?.surface, blazeclan.CAREERS_URL)
})

test('Reserve Bank Information Technology run authenticates against the first-party careers API and returns current openings with experience', async () => {
  const rebit = await loadModule('../../scraper/reservebankinformationtechnology/script.js')
  const authRequests = []
  const apiRequests = []

  assert.equal(rebit.hasOfficialCareersSignal(rebitCareersHtml), true)
  assert.equal(rebit.extractIndiaJobsFromCurrentOpeningsPayload(rebitCurrentOpeningsPayload, {
    scrapedAt: FIXED_SCRAPED_AT,
  }).length, 2)

  const jobs = await rebit.createReserveBankInformationTechnologyScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: rebitFetchText,
    postJson: async (url, body) => {
      authRequests.push({ url, body })
      return rebitAuthResponse
    },
    fetchJson: async (url, options) => {
      apiRequests.push({ url, options })
      return rebitCurrentOpeningsPayload
    },
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(authRequests, [
    {
      url: rebit.CAREERS_LOGIN_API_URL,
      body: {
        username: authRequests[0]?.body?.username,
        password: authRequests[0]?.body?.password,
      },
    },
  ])
  assert.equal(typeof authRequests[0]?.body?.username, 'string')
  assert.equal(typeof authRequests[0]?.body?.password, 'string')
  assert.deepEqual(apiRequests, [
    {
      url: rebit.CURRENT_OPENINGS_API_URL,
      options: {
        accessToken: 'token-123',
      },
    },
  ])
  assert.equal(jobs[0].title, 'Lead - Application Security SSDLC')
  assert.equal(jobs[0].location, 'Navi Mumbai, Bengaluru')
  assert.equal(jobs[0].department, 'Cyber Security')
  assert.equal(jobs[0].experienceRequired, '6 - 8 Years')
  assert.equal(jobs[0].postingDate, '2026-06-29')
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.equal(jobs[1].title, 'SOC - SIEM Admin Specialist')
  assert.equal(jobs[1].location, 'Navi Mumbai, Maharashtra, India')
  assert.equal(jobs[1].experienceRequired, '4 - 6 Years')
})

test('Reserve Bank Information Technology run enriches Darwinbox detail pages only when the first-party API omits experience', async () => {
  const rebit = await loadModule('../../scraper/reservebankinformationtechnology/script.js')
  const requestedDetailUrls = []

  const jobs = await rebit.createReserveBankInformationTechnologyScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: rebitFetchText,
    postJson: async () => rebitAuthResponse,
    fetchJson: async () => ([
      {
        ...rebitCurrentOpeningsPayload[0],
        job_experience: '',
      },
      rebitCurrentOpeningsPayload[1],
    ]),
    fetchPublicJobText: async (url) => {
      requestedDetailUrls.push(url)

      if (url.endsWith('/a6788af7cc042e')) {
        return `
          <html>
            <body>
              <h1>Lead - Application Security SSDLC</h1>
              <section>
                <h2>Responsibilities</h2>
                <p>8+ years of experience in application security, threat modeling, and secure SDLC delivery.</p>
                <p>Lead SSDLC controls across high-trust banking platforms.</p>
              </section>
            </body>
          </html>
        `
      }

      throw new Error(`Unexpected ReBIT detail URL: ${url}`)
    },
  })

  assert.deepEqual(requestedDetailUrls, [
    'https://rebithr.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6788af7cc042e',
  ])
  assert.equal(jobs[0].experienceRequired, '8+ years')
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.match(jobs[0].jobDescription || '', /secure SDLC delivery/i)
  assert.equal(jobs[1].experienceRequired, '4 - 6 Years')
  assert.equal(jobs[1].publicExperienceChecked, true)
})

test('Amtex Systems run verifies the live detail-link shell and filters out the current non-India opening', async () => {
  const amtex = await loadModule('../../scraper/amtexsystems/script.js')
  const requestedUrls = []

  assert.equal(amtex.hasOfficialCareersSignal(amtexCareersHtml), true)
  assert.deepEqual(amtex.extractRealCareerLinks(amtexCareersHtml), [
    'https://www.amtexsystems.com/career-list/business-analyst',
  ])

  const jobs = await amtex.createAmtexSystemsScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === amtex.CAREERS_URL) return amtexCareersHtml
      if (url === 'https://www.amtexsystems.com/career-list/business-analyst') {
        return amtexBusinessAnalystDetailHtml
      }
      throw new Error(`Unexpected Amtex URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    amtex.CAREERS_URL,
    'https://www.amtexsystems.com/career-list/business-analyst',
  ])
  assert.deepEqual(jobs, [])
})

test('Nucsoft run returns normalized openings from the verified first-party careers cards', async () => {
  const nucsoft = await loadModule('../../scraper/nucsoft/script.js')

  assert.equal(nucsoft.hasOfficialCareersSignal(nucsoftCareersHtml), true)
  assert.equal(nucsoft.extractVisibleJobCards(nucsoftCareersHtml).length, 2)

  const jobs = await nucsoft.createNucsoftScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      assert.equal(url, nucsoft.CAREERS_URL)
      return nucsoftCareersHtml
    },
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'DBA/SQL Developer')
  assert.equal(jobs[0].location, 'India')
  assert.equal(jobs[0].applyUrl, 'https://nucsoft.com/openings?job=DBA%2FSQL%20Developer')
  assert.equal(jobs[1].title, 'Flutter Developer')
  assert.equal(jobs[1].location, 'India')
})
