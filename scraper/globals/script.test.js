import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_PAGE_URL,
  CURRENT_OPENINGS_API_URL,
  CURRENT_OPENINGS_PAGE_URL,
  HOMEPAGE_URL,
  createGlobalsScraper,
  extractPublishedJobs,
  hasOfficialCareersPageSignal,
  hasOfficialCurrentOpeningsSignal,
  hasOfficialHomepageSignal,
  hasVerifiedJobDetailPage,
} from './script.js'

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Home Page - Globals Corporate Website</title>
      <meta property="og:url" content="https://www.globalsinc.com/" />
      <meta property="og:site_name" content="Globals Corporate Website" />
    </head>
    <body>
      <nav>
        <a href="/about-us/">About us</a>
        <a href="/careers/">Careers</a>
      </nav>
      <main>
        <h1>Defending Cyber Threats</h1>
        <p>Certified Great Place to Work</p>
      </main>
    </body>
  </html>
`

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Careers - Globals Corporate Website</title>
      <meta property="og:url" content="https://www.globalsinc.com/careers/" />
    </head>
    <body>
      <main>
        <a href="https://globalsinc.com/careers/jobs/">See Current Opportunities</a>
        <p>Visit <a href="https://globalsinc.com/careers/current-openings/">our opportunities page</a> to view detailed job descriptions and submit your application.</p>
        <p>careers[at]globalsinc[dot]com</p>
      </main>
    </body>
  </html>
`

const openingsHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Current Openings - Globals Corporate Website</title>
      <meta property="og:url" content="https://www.globalsinc.com/careers/current-openings/" />
    </head>
    <body>
      <main>
        <h1>Current Openings</h1>
        <div id="rec_job_listing_div"></div>
        <script src="https://static.zohocdn.com/recruit/embed_careers_site/javascript/v1.1/embed_jobs.js"></script>
        <script>
          rec_embed_js.load({
            widget_id:"rec_job_listing_div",
            page_name:"Careers",
            source:"CareerSite",
            site:"https://globals.zohorecruit.in",
            brand_color:"#6875E2",
            empty_job_msg:"No current Openings"
          });
        </script>
      </main>
    </body>
  </html>
`

const apiPayload = {
  code: 'success',
  data: [
    {
      Posting_Title: 'Space Systems Engineer',
      Job_Opening_Name: 'Space Systems Engineer',
      Job_Type: 'Full time',
      Work_Experience: '0-1 year',
      City: 'Bangalore North',
      State: 'Karnataka',
      Country: 'India',
      Industry: 'IT Services',
      Job_Description: 'Build and test satellite subsystems.',
      Date_Opened: '06/15/2026',
      $url: 'https://globals.zohorecruit.in/jobs/Careers/140088000003307002/Space-Systems-Engineer?source=CareerSite',
      id: '140088000003307002',
      Publish: true,
      Is_Locked: false,
    },
    {
      Posting_Title: 'SOC Engineer-L2',
      Job_Opening_Name: 'SOC Engineer-L2',
      Job_Type: 'Full time',
      Work_Experience: '1-3 years',
      City: 'Delhi',
      State: null,
      Country: 'India',
      Industry: 'IT Services',
      Job_Description: 'Management of SOC operations.',
      Date_Opened: '02/03/2026',
      $url: 'https://globals.zohorecruit.in/jobs/Careers/140088000002125596/SOC-Engineer-L2?source=CareerSite',
      id: '140088000002125596',
      Publish: true,
      Is_Locked: false,
    },
  ],
}

const detailPage = {
  status: 200,
  url: 'https://globals.zohorecruit.in/jobs/Careers/140088000003307002/Space-Systems-Engineer?source=CareerSite',
  html: `
    <!doctype html>
    <html>
      <head><title>Space Systems Engineer</title></head>
      <body>
        <h1>Space Systems Engineer</h1>
        <p>Globals</p>
      </body>
    </html>
  `,
}

test('detects the verified Globals homepage, careers page, and first-party current openings surface', () => {
  assert.equal(HOMEPAGE_URL, 'https://www.globalsinc.com/')
  assert.equal(CAREERS_PAGE_URL, 'https://www.globalsinc.com/careers/')
  assert.equal(CURRENT_OPENINGS_PAGE_URL, 'https://www.globalsinc.com/careers/current-openings/')
  assert.equal(
    CURRENT_OPENINGS_API_URL,
    'https://globals.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )

  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(hasOfficialCurrentOpeningsSignal(openingsHtml), true)

  assert.equal(hasOfficialHomepageSignal('<html><body>Placeholder</body></html>'), false)
  assert.equal(hasOfficialCareersPageSignal('<html><body>Careers</body></html>'), false)
  assert.equal(hasOfficialCurrentOpeningsSignal('<html><body>Current Openings</body></html>'), false)
})

test('extractPublishedJobs normalizes live Globals Zoho Recruit records', () => {
  assert.deepEqual(extractPublishedJobs(apiPayload), [
    {
      title: 'Space Systems Engineer',
      company: 'Globals',
      department: 'IT Services',
      location: 'Bangalore North, Karnataka, India',
      city: 'Bangalore North',
      state: 'Karnataka',
      country: 'India',
      jobId: '140088000003307002',
      requisitionId: '140088000003307002',
      sourceUrl: 'https://globals.zohorecruit.in/jobs/Careers/140088000003307002/Space-Systems-Engineer?source=CareerSite',
      applyUrl: 'https://globals.zohorecruit.in/jobs/Careers/140088000003307002/Space-Systems-Engineer?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: '0-1 year',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '06/15/2026',
      closingDate: null,
      jobDescription: 'Build and test satellite subsystems.',
    },
    {
      title: 'SOC Engineer-L2',
      company: 'Globals',
      department: 'IT Services',
      location: 'Delhi, India',
      city: 'Delhi',
      state: null,
      country: 'India',
      jobId: '140088000002125596',
      requisitionId: '140088000002125596',
      sourceUrl: 'https://globals.zohorecruit.in/jobs/Careers/140088000002125596/SOC-Engineer-L2?source=CareerSite',
      applyUrl: 'https://globals.zohorecruit.in/jobs/Careers/140088000002125596/SOC-Engineer-L2?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: '1-3 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '02/03/2026',
      closingDate: null,
      jobDescription: 'Management of SOC operations.',
    },
  ])
})

test('hasVerifiedJobDetailPage accepts the verified Globals Zoho Recruit detail surface', () => {
  assert.equal(
    hasVerifiedJobDetailPage(detailPage, {
      title: 'Space Systems Engineer',
      sourceUrl: detailPage.url,
    }),
    true,
  )

  assert.equal(
    hasVerifiedJobDetailPage(
      { ...detailPage, html: '<html><body>Position filled</body></html>' },
      { title: 'Space Systems Engineer', sourceUrl: detailPage.url },
    ),
    false,
  )
})

test('run returns decorated Globals jobs from the verified first-party Zoho Recruit feed', async () => {
  const pageRequests = []
  const jsonRequests = []
  const jobs = await createGlobalsScraper().run({
    fetchPage: async (url) => {
      pageRequests.push(url)
      if (url === HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === CAREERS_PAGE_URL) return { status: 200, url, html: careersHtml }
      if (url === CURRENT_OPENINGS_PAGE_URL) return { status: 200, url, html: openingsHtml }
      if (url === detailPage.url) return detailPage
      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchJson: async (url) => {
      jsonRequests.push(url)
      return apiPayload
    },
    now: () => '2026-07-13T00:00:00.000Z',
  })

  assert.deepEqual(pageRequests, [
    HOMEPAGE_URL,
    CAREERS_PAGE_URL,
    CURRENT_OPENINGS_PAGE_URL,
    detailPage.url,
  ])
  assert.deepEqual(jsonRequests, [CURRENT_OPENINGS_API_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'globals')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-13T00:00:00.000Z')
})

test('run fails closed when the verified Globals public surface drifts', async () => {
  await assert.rejects(
    createGlobalsScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) return { status: 200, url, html: '<html><body>Home</body></html>' }
        if (url === CAREERS_PAGE_URL) return { status: 200, url, html: careersHtml }
        return { status: 200, url, html: openingsHtml }
      },
      fetchJson: async () => apiPayload,
    }),
    /homepage no longer matches the verified official public site/i,
  )

  await assert.rejects(
    createGlobalsScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === CAREERS_PAGE_URL) return { status: 200, url, html: '<html><body>Careers</body></html>' }
        return { status: 200, url, html: openingsHtml }
      },
      fetchJson: async () => apiPayload,
    }),
    /careers page no longer matches the verified official public jobs surface/i,
  )

  await assert.rejects(
    createGlobalsScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === CAREERS_PAGE_URL) return { status: 200, url, html: careersHtml }
        return { status: 200, url, html: '<html><body><h1>Current Openings</h1></body></html>' }
      },
      fetchJson: async () => apiPayload,
    }),
    /current openings page no longer matches the verified official public jobs surface/i,
  )
})
