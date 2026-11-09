import assert from 'node:assert/strict'
import test from 'node:test'
import { installWorkbookOfflineGuard } from './helpers/workbookBatchCatalogAssertions20261102.js'

test.beforeEach((t) => installWorkbookOfflineGuard(t))


const FIXED_SCRAPED_AT = '2026-07-18T00:00:00.000Z'

const htmlAttributeJson = (value) => JSON.stringify(value).replace(/"/g, '&quot;')

const loadModule = async (relativePath) => {
  try {
    return await import(relativePath)
  } catch {
    assert.fail(`Expected scraper module at ${relativePath}`)
  }
}

const thinkbridgeCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Search | thinkbridge - there's a new way there</title>
  </head>
  <body>
    <div role="listitem" class="c-jobitem w-dyn-item">
      <div class="career-card _w-100">
        <div class="j0-div">
          <div class="career-deets-wrap no-gap">
            <div class="category-tag country">India</div>
            <div class="category-tag static hide">App Dev</div>
            <div class="category-tag gray career hide">7 + Years</div>
          </div>
          <h3 class="space-top-small">ServiceNow Architect</h3>
          <div class="opacity-dark-text summary">Lead enterprise ServiceNow architecture and delivery.</div>
          <div class="margin-top-20px left-align"><div class="category-tag transparent">ServiceNow Architect, CMDB, Discovery</div></div>
        </div>
        <a href="/jobs/servicenow-architect" class="arrow-link w-inline-block"><div>Read more</div></a>
      </div>
    </div>
    <div role="listitem" class="c-jobitem w-dyn-item">
      <div class="career-card _w-100">
        <div class="j0-div">
          <div class="career-deets-wrap no-gap">
            <div class="category-tag country">USA</div>
            <div class="category-tag static hide">App Dev</div>
            <div class="category-tag gray career hide">7 + Years</div>
          </div>
          <h3 class="space-top-small">Solution Engineer</h3>
          <div class="opacity-dark-text summary">Bridge business and engineering teams with AI-powered solutions.</div>
          <div class="margin-top-20px left-align"><div class="category-tag transparent">Microsoft Azure, GCP, AWS</div></div>
        </div>
        <a href="/jobs/solution-engineer" class="arrow-link w-inline-block"><div>Read more</div></a>
      </div>
    </div>
    <div><h4>Sorry! No matching jobs found.</h4></div>
  </body>
</html>
`

const algonomyCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h2>Search Job Openings</h2>
    <h2>Why Algonomy</h2>
    <h2>We have global openings in core business and technical teams across our company.</h2>
    <p>Working at Algonomy is more than just a job. It's a mission.</p>
    <p>Algonomy is now part of ADA</p>
    <script id="gnewtonjs" type="text/javascript" src="//recruitingbypaycor.com/career/iframe.action?clientId=8a7883c6606d030901607ae3719c71a6"></script>
  </body>
</html>
`

const algonomyBoardHtml = `
<!doctype html>
<html lang="en">
  <body>
    <div>Algonomy Job Search</div>
    <script>
      var homeUrl = 'https://algonomy.com/careers/';
    </script>
    <div class="gnewtonCareerGroupHeaderClass">Delivery</div>
    <div class="gnewtonCareerGroupRowClass">
      <div class="gnewtonCareerGroupJobTitleClass">
        <a href="https://recruitingbypaycor.com/career/JobIntroduction.action?clientId=8a7883c6606d030901607ae3719c71a6&id=8a7887a87759248701776b7d28164319&source=&lang=en">Database Programmer (DBP)</a>
      </div>
      <div class="gnewtonCareerGroupJobDescriptionClass">Bangalore, India</div>
    </div>
    <div class="gnewtonCareerGroupRowClass">
      <div class="gnewtonCareerGroupJobTitleClass">
        <a href="https://recruitingbypaycor.com/career/JobIntroduction.action?clientId=8a7883c6606d030901607ae3719c71a6&id=8a7885a88488337301848a0dd6ec06bb&source=&lang=en">AWS Data Migration Engineer</a>
      </div>
      <div class="gnewtonCareerGroupJobDescriptionClass">Philadelphia Region (PA, NY, NJ, DE)</div>
    </div>
  </body>
</html>
`

const fciCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h2>Current Openings</h2>
    <a href="https://fci-ccm.zohorecruit.in/jobs/Careers">Career opportunities</a>
  </body>
</html>
`

const fciPageJson = {
  detail: {
    section: {
      data: [
        {
          blocktype: 'jobs',
          title: 'Join Our Team',
          subtitle: 'Current Openings',
        },
      ],
    },
  },
}

const fciModuleMeta = [
  {
    api_name: 'Job_Openings',
    fields: [
      { id: '85750000000003081', api_name: 'Job_Opening_Name' },
      { id: '85750000000003103', api_name: 'State' },
      { id: '85750000000003091', api_name: 'Date_Opened' },
      { id: '85750000000003107', api_name: 'Industry' },
      { id: '85750000000003067', api_name: 'Job_Type' },
      { id: '85750000000003125', api_name: 'Work_Experience' },
      { id: '85750000000003101', api_name: 'City' },
      { id: '85750000000003105', api_name: 'Country' },
      { id: '85750000000003143', api_name: 'Job_Description' },
    ],
  },
]

const fciMeta = {
  org_info: {
    company_name: 'Friends Color Images Pvt Ltd',
  },
  list_url: 'https://fci-ccm.zohorecruit.in/jobs/Careers',
  _no_longer: 'zr.pos.no.act',
}

const fciBoardHtml = `
<!doctype html>
<html lang="en">
  <body>
    <input type="hidden" value="${htmlAttributeJson(fciPageJson)}" id="pageJson">
    <input type="hidden" value="${htmlAttributeJson(fciModuleMeta)}" id="moduleMeta">
    <input type="hidden" value="${htmlAttributeJson([
      {
        id: '85750000010000001',
        Publish: true,
        '85750000000003081': 'Information Security Manager',
        '85750000000003103': 'Uttar Pradesh',
        '85750000000003091': '2026-03-19',
        '85750000000003107': 'Software Product',
        '85750000000003067': 'Full time',
        '85750000000003125': '6-8 Years',
        '85750000000003101': 'Noida',
        '85750000000003105': 'India',
        '85750000000003143': '<div>Own and improve the ISMS program.</div>',
      },
      {
        id: '85750000010000002',
        Publish: false,
        '85750000000003081': 'Senior JAVA Developer',
      },
    ])}" id="jobs">
    <input type="hidden" value="${htmlAttributeJson(fciMeta)}" id="meta">
  </body>
</html>
`

const loyltyCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <title>Loylty Rewardz</title>
    <section>
      <h2>Join Us</h2>
      <h2>Bringing value to the workplace for a well-rounded worklife</h2>
      <div>Health & Wellness</div>
      <footer>© 2024 Loylty Rewardz Mngt Pvt. Ltd. All rights reserved.</footer>
    </section>
  </body>
</html>
`

const xoxodayCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <section id="open-roles">
      <h2>See who we're hiring right now.</h2>
      <p>Live listings, straight from our applicant tracking system. Apply directly - we read every application.</p>
      <h1>Explore roles shaping the future of rewards</h1>
    </section>
  </body>
</html>
`

const xoxodayKekaShellHtml = `
<!doctype html>
<html lang="en">
  <body>
    <script>
      fetch('/ats/documents/1d58bf68-c78d-495e-8a38-d17ff1298707/careerportal/28df30a54dfb4594bebb0761ccbe3782.html')
    </script>
  </body>
</html>
`

const currentThinkbridgeCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Search | thinkbridge - there&#x27;s a new way there</title>
  </head>
  <body>
    <div role="listitem" class="c-jobitem w-dyn-item">
      <div class="career-card _w-100">
        <div class="j0-div">
          <div class="career-deets-wrap no-gap">
            <div class="category-tag country">India</div>
            <div class="category-tag static hide">App Dev</div>
            <div class="category-tag gray career hide">4 + Years</div>
          </div>
          <h3 class="space-top-small">Developer - C#.NET &amp; Firebase (Store &amp; Functions)</h3>
          <div class="opacity-dark-text summary">Build and evolve modern product integrations.</div>
          <div class="margin-top-20px left-align"><div class="category-tag transparent">C#.NET, Firebase, Store, Functions</div></div>
        </div>
        <a href="/jobs/developer-csharp-dotnet-firebase" class="arrow-link w-inline-block"><div>Read more</div></a>
      </div>
    </div>
    <div role="listitem" class="c-jobitem w-dyn-item">
      <div class="career-card _w-100">
        <div class="j0-div">
          <div class="career-deets-wrap no-gap">
            <div class="category-tag country">Singapore</div>
            <div class="category-tag static hide">Growth</div>
            <div class="category-tag gray career hide">5 + Years</div>
          </div>
          <h3 class="space-top-small">Business Development Specialist</h3>
          <div class="opacity-dark-text summary">Drive expansion with enterprise prospects across the region.</div>
          <div class="margin-top-20px left-align"><div class="category-tag transparent">Enterprise Sales, Partnerships</div></div>
        </div>
        <a href="/jobs/business-development-specialist" class="arrow-link w-inline-block"><div>Read more</div></a>
      </div>
    </div>
    <div><h4>Sorry! No matching jobs found.</h4></div>
  </body>
</html>
`

const xoxodayBlockedCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Vercel Security Checkpoint</title>
  </head>
  <body>
    <h1>Vercel Security Checkpoint</h1>
    <p>Please enable JavaScript to continue.</p>
  </body>
</html>
`

const xoxodayPayload = [
  {
    id: 135128,
    title: 'Key Account Manager - Enetrprise Sales, Mumbai',
    description: '<div>Grow enterprise revenue.</div>',
    departmentName: 'Sales Farming',
    jobLocations: [
      { name: 'Mumbai', city: 'Mumbai', state: 'MH', countryCode: 'IN', countryName: 'India' },
    ],
    jobType: 2,
    experience: '5+',
    salaryRangeFormat: '',
    publishedOn: '2026-07-17T12:16:31.48Z',
    skillNames: [],
  },
  {
    id: 118001,
    title: 'Strategic Account Manager',
    description: '<div>Own long-term account growth in the Philippines.</div>',
    departmentName: 'Customer Success',
    jobLocations: [
      { name: 'Philippines', city: 'Philippines', state: 'ABR', countryCode: 'RP', countryName: 'Philippines' },
    ],
    jobType: 2,
    experience: '3-6 Years',
    salaryRangeFormat: '',
    publishedOn: '2026-01-27T12:49:22.697Z',
    skillNames: [],
  },
]

// Controlled DTO fixtures for the current careers/detail contract. These are
// synthetic test roles; the two original Webflow layouts above remain negative
// history and must not be silently promoted into current source inventory.
const controlledThinkbridgeRoles = [
  { title: 'ServiceNow Architect', slug: 'controlled-servicenow', location: 'India', mode: 'remote' },
  { title: 'Solution Engineer', slug: 'controlled-solution', location: 'USA', mode: 'onsite' },
].map(role => ({ ...role, sourceUrl: 'https://www.thinkbridge.com/careers/' + role.slug,
  applyUrl: 'https://careers.thinkbridge.com/jobs/Careers/' + role.slug }))
const controlledThinkbridgeCareers = '<html><head><title>Careers at thinkbridge | Remote-first engineering work</title></head><body><p>2 open roles</p>'
  + controlledThinkbridgeRoles.map(role => '<li data-loc="' + role.mode + '"><a class="role" href="/careers/' + role.slug
    + '"><span class="role-t">' + role.title + '</span><span class="role-m">' + role.location
    + ' &middot; Full-time &middot; 7+ Years</span></a></li>').join('') + '</body></html>'
const controlledThinkbridgeDetail = role => '<html><head><title>' + role.title + ' job | thinkbridge</title><link rel="canonical" href="'
  + role.sourceUrl + '"><meta name="description" content="Build reliable enterprise integrations."></head><body><h1>' + role.title
  + '</h1><a href="' + role.applyUrl + '">Apply for this role</a></body></html>'

test('thinkbridge runs the current careers and detail identity contract from controlled fixtures', async () => {
  const thinkbridge = await loadModule('../../scraper/thinkbridge/script.js')
  const requests = []
  assert.equal(thinkbridge.hasOfficialCareersSignal(controlledThinkbridgeCareers), true)
  assert.equal(thinkbridge.extractJobCards(controlledThinkbridgeCareers).length, 2)
  const jobs = await thinkbridge.createThinkbridgeScraper({ now: () => FIXED_SCRAPED_AT }).run({
    fetchText: async url => {
      requests.push(url)
      if (url === thinkbridge.CAREERS_URL) return controlledThinkbridgeCareers
      const role = controlledThinkbridgeRoles.find(role => role.sourceUrl === url)
      assert.ok(role, 'Uncontrolled role detail: ' + url)
      return controlledThinkbridgeDetail(role)
    },
  })
  assert.deepEqual(requests, [thinkbridge.CAREERS_URL, ...controlledThinkbridgeRoles.map(role => role.sourceUrl)])
  assert.deepEqual(jobs.map(job => [job.title, job.location, job.department, job.sourceUrl]),
    controlledThinkbridgeRoles.map(role => [role.title, role.location, null, role.sourceUrl]))
  assert.deepEqual(jobs.map(job => job.applyUrl), controlledThinkbridgeRoles.map(role => role.applyUrl))
  assert.deepEqual(jobs[0].requiredSkills, [])
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[1].country, null)
  assert.ok(jobs.every(job => job.jobDescription === 'Build reliable enterprise integrations.' && job.scrapedAt === FIXED_SCRAPED_AT))
})

test('thinkbridge rejects both legacy Webflow layouts and changed native role identities', async () => {
  const thinkbridge = await loadModule('../../scraper/thinkbridge/script.js')
  for (const legacy of [thinkbridgeCareersHtml, currentThinkbridgeCareersHtml]) {
    assert.equal(thinkbridge.hasOfficialCareersSignal(legacy), false)
    const requests = []
    await assert.rejects(thinkbridge.run({ fetchText: async url => { requests.push(url); return legacy } }), /changed materially/)
    assert.deepEqual(requests, [thinkbridge.CAREERS_URL])
  }
  for (const mutate of [
    html => html.replace('<h1>ServiceNow Architect</h1>', '<h1>Other Role</h1>'),
    html => html.replace(controlledThinkbridgeRoles[0].sourceUrl, 'https://other-employer.invalid/careers/role'),
    html => html.replace('https://careers.thinkbridge.com/', 'https://other-employer.invalid/'),
  ]) {
    await assert.rejects(thinkbridge.run({ fetchText: async url => {
      if (url === thinkbridge.CAREERS_URL) return controlledThinkbridgeCareers
      assert.equal(url, controlledThinkbridgeRoles[0].sourceUrl)
      return mutate(controlledThinkbridgeDetail(controlledThinkbridgeRoles[0]))
    } }), /detail page changed materially/)
  }
})

test('Algonomy run returns grouped public jobs from the embedded Paycor board', async () => {
  const algonomy = await loadModule('../../scraper/algonomy/script.js')
  const requestedUrls = []

  assert.equal(algonomy.hasOfficialCareersSignal(algonomyCareersHtml), true)
  assert.equal(
    algonomy.extractPaycorScriptUrl(algonomyCareersHtml),
    'https://recruitingbypaycor.com/career/iframe.action?clientId=8a7883c6606d030901607ae3719c71a6',
  )
  assert.equal(algonomy.hasOfficialPaycorBoardSignal(algonomyBoardHtml), true)
  assert.equal(algonomy.extractJobsFromPaycorBoard(algonomyBoardHtml).length, 2)

  const jobs = await algonomy.createAlgonomyScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === algonomy.CAREERS_URL) return algonomyCareersHtml
      if (url === algonomy.PAYCOR_BOARD_URL) return algonomyBoardHtml
      throw new Error(`Unexpected Algonomy URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [algonomy.CAREERS_URL, algonomy.PAYCOR_BOARD_URL])
  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.department, job.country]),
    [
      ['Database Programmer (DBP)', 'Bangalore, India', 'Delivery', 'India'],
      ['AWS Data Migration Engineer', 'Philadelphia Region (PA, NY, NJ, DE)', 'Delivery', 'United States'],
    ],
  )
})

test('FCI CCM run returns only published jobs from the official Zoho hidden-input payload', async () => {
  const fci = await loadModule('../../scraper/fciccm/script.js')

  assert.equal(fci.hasOfficialCareersSignal(fciCareersHtml), true)
  assert.equal(fci.hasOfficialZohoBoardSignal(fciBoardHtml), true)
  assert.equal(fci.extractJobsFromOfficialBoard(fciBoardHtml).length, 1)

  const jobs = await fci.createFciCcmScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      if (url === fci.CAREERS_URL) return fciCareersHtml
      if (url === fci.BOARD_URL) return fciBoardHtml
      throw new Error(`Unexpected FCI URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Information Security Manager')
  assert.equal(jobs[0].location, 'Noida, Uttar Pradesh, India')
  assert.equal(jobs[0].department, 'Software Product')
  assert.equal(jobs[0].employmentType, 'Full time')
})

test('Loylty Rewardz Mngt stays fail-closed on the culture-only first-party page and rejects ATS handoffs', async () => {
  const loylty = await loadModule('../../scraper/loyltyrewardzmngt/script.js')

  assert.equal(loylty.hasOfficialCareersSignal(loyltyCareersHtml), true)
  assert.equal(loylty.hasPublicJobsSignal(loyltyCareersHtml), false)

  const jobs = await loylty.createLoyltyRewardzMngtScraper().run({
    fetchText: async (url) => {
      assert.equal(url, loylty.CAREERS_URL)
      return loyltyCareersHtml
    },
  })

  assert.deepEqual(jobs, [])

  await assert.rejects(
    loylty.createLoyltyRewardzMngtScraper().run({
      fetchText: async () => `${loyltyCareersHtml}<a href="https://example.keka.com/careers/">Open roles</a>`,
    }),
    /public jobs surface/i,
  )
})

test('Xoxoday run returns global jobs from the verified Keka shell and embed jobs API', async () => {
  const xoxoday = await loadModule('../../scraper/xoxoday/script.js')
  const requestedUrls = []

  assert.equal(xoxoday.hasOfficialCareersSignal(xoxodayCareersHtml), true)
  assert.equal(xoxoday.hasKekaShellSignal(xoxodayKekaShellHtml), true)
  assert.equal(xoxoday.extractJobsFromKekaPayload(xoxodayPayload).length, 2)

  const jobs = await xoxoday.createXoxodayScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === xoxoday.CAREERS_URL) return xoxodayCareersHtml
      if (url === xoxoday.KEKA_CAREERS_URL) return xoxodayKekaShellHtml
      throw new Error(`Unexpected Xoxoday URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, xoxoday.JOBS_API_URL)
      return xoxodayPayload
    },
  })

  assert.deepEqual(requestedUrls, [
    xoxoday.CAREERS_URL,
    xoxoday.KEKA_CAREERS_URL,
    xoxoday.JOBS_API_URL,
  ])
  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.country]),
    [
      ['Key Account Manager - Enetrprise Sales, Mumbai', 'Mumbai, MH, India', 'India'],
      ['Strategic Account Manager', 'Philippines, ABR', 'Philippines'],
    ],
  )
})

test('Xoxoday accepts the current blocked first-party careers page while the Keka shell and jobs API remain live', async () => {
  const xoxoday = await loadModule('../../scraper/xoxoday/script.js')
  const requestedUrls = []

  assert.equal(xoxoday.hasVercelSecurityCheckpointSignal(xoxodayBlockedCareersHtml), true)

  const jobs = await xoxoday.createXoxodayScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === xoxoday.CAREERS_URL) {
        return {
          status: 429,
          url,
          html: xoxodayBlockedCareersHtml,
        }
      }

      if (url === xoxoday.KEKA_CAREERS_URL) {
        return {
          status: 200,
          url,
          html: xoxodayKekaShellHtml,
        }
      }

      throw new Error(`Unexpected Xoxoday page URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, xoxoday.JOBS_API_URL)
      return xoxodayPayload
    },
  })

  assert.deepEqual(requestedUrls, [
    xoxoday.CAREERS_URL,
    xoxoday.KEKA_CAREERS_URL,
    xoxoday.JOBS_API_URL,
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'xoxoday')
})
