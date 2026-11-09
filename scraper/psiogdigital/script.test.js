import assert from 'node:assert/strict'
import test from 'node:test'

const loadPsiogDigitalModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Psiog Digital scraper module at ./script.js')
  }
}

const homepageHtml = `
  <html>
    <head>
      <title>Psiog | AI-Led Technology Consulting &amp; Services for Mid-Market Enterprises</title>
      <meta name="description" content="Psiog is a pure-play IT services &amp; consulting boutique delivering AI-enhanced digital solutions to global mid-market enterprises. Strategy-led. Business-first.">
      <meta property="og:url" content="https://psiog.com/">
      <meta property="og:site_name" content="psiog - Delivering Business Value Through AI Led Digital Solutions">
    </head>
    <body>
      <a href="https://psiog.com/about-us/">About Us</a>
      <a href="https://psiog.com/careers/">Careers</a>
      <a href="https://psiog.com/contact-us/">Contact Us</a>
      <h1>Delivering Business Value Through AI-Led Digital Solutions</h1>
      <p>We are Psiog, a pure-play IT services and technology consulting boutique, partnering with mid-market enterprises to drive strategy through new-age technology interventions.</p>
      <p>Global Delivery Centre, Chennai, India | psiog.com</p>
      <a href="mailto:info@psiog.com">info@psiog.com</a>
    </body>
  </html>
`

const aboutPageHtml = `
  <html>
    <head>
      <title>About Psiog | Our Story, Vision & Leadership Team</title>
      <meta property="og:url" content="https://psiog.com/about-us/">
      <meta property="og:site_name" content="psiog - Delivering Business Value Through AI Enhanced Digital Solutions">
    </head>
    <body>
      <h1>A name built from three cultures. A firm built on one principle.</h1>
      <p>Global Delivery Centre in Chennai, India enables Delivery Excellence for our clients.</p>
      <p>Kumar Sivaraman</p>
      <a href="https://psiog.com/careers/">Careers</a>
    </body>
  </html>
`

const careersPageHtml = `
  <html>
    <head>
      <title>Careers at Psiog | Join Our Growing IT Services Team</title>
      <meta property="og:url" content="https://psiog.com/careers/">
      <meta property="og:site_name" content="psiog - Delivering Business Value Through AI Enhanced Digital Solutions">
    </head>
    <body>
      <h2>Careers - Life at Psiog</h2>
      <h1>We Don't Just Hire Software Professionals. We Build Them.</h1>
      <p>Open Roles</p>
      <a href="https://psiog.com/recruitment/">View Open Roles</a>
      <a href="https://psiog.com/about-us/">About Us</a>
    </body>
  </html>
`

const recruitmentPageHtml = `
  <html>
    <head>
      <title>Recruitment - psiog</title>
      <meta property="og:url" content="https://psiog.com/recruitment/">
      <meta property="og:title" content="Recruitment - psiog">
    </head>
    <body>
      <script src="https://static.zohocdn.com/recruit/embed_careers_site/javascript/v1.1/embed_jobs.js"></script>
      <script>
        rec_embed_js.load({
          widget_id:"rec_job_listing_div",
          page_name:"Careers",
          source:"CareerSite",
          site:"https://psiog.zohorecruit.in"
        });
      </script>
      <p>Open Roles</p>
      <p>Copyright 2025 Psiog Digital Private Limited.</p>
    </body>
  </html>
`

const portalHtml = `
  <html>
    <head>
      <title>Jobs at Psiog</title>
      <meta property="og:url" content="https://psiog.zohorecruit.in/jobs/Careers">
      <meta property="og:site_name" content="Psiog">
      <meta property="og:description" content="Everyone at Psiog Digital is free to explore and work the way you want. Come join us!">
    </head>
    <body>
      <input type="hidden" id="pageJson" value="{}">
      <input type="hidden" id="moduleMeta" value="[]">
      <input type="hidden" id="jobs" value="[]">
    </body>
  </html>
`

const apiPayload = {
  code: 'success',
  data: [
    {
      id: '153233000000599055',
      Job_Opening_Name: 'Technical Lead - Data',
      Posting_Title: 'Technical Lead - Data',
      Job_Type: 'Full time',
      Job_Description: 'Lead enterprise data engineering engagements.',
      City: 'Chennai',
      Country: 'India',
      Publish: true,
      Date_Opened: '10/07/2026',
      $url: 'https://psiog.zohorecruit.in/jobs/Careers/153233000000599055/Technical-Lead---Data?source=CareerSite',
    },
    {
      id: '153233000001600125',
      Job_Opening_Name: 'Senior Software Engineer- .NET',
      Posting_Title: 'Senior Software Engineer- .NET',
      Job_Type: 'Full time',
      Job_Description: 'Build and maintain .NET solutions.',
      City: 'Chennai',
      Country: 'India',
      Publish: true,
      Date_Opened: '12/07/2026',
      $url: 'https://psiog.zohorecruit.in/jobs/Careers/153233000001600125/Senior-Software-Engineer--NET?source=CareerSite',
    },
    {
      id: '153233000001999999',
      Job_Opening_Name: 'US Data Architect',
      Posting_Title: 'US Data Architect',
      Job_Type: 'Full time',
      Job_Description: 'Out-of-scope non-India role.',
      City: 'Austin',
      Country: 'United States',
      Publish: true,
      Date_Opened: '12/07/2026',
      $url: 'https://psiog.zohorecruit.in/jobs/Careers/153233000001999999/US-Data-Architect?source=CareerSite',
    },
    {
      id: '153233000001888888',
      Job_Opening_Name: 'Hidden QA Engineer',
      Posting_Title: 'Hidden QA Engineer',
      Job_Type: 'Full time',
      Job_Description: 'This unpublished job should be excluded.',
      City: 'Chennai',
      Country: 'India',
      Publish: false,
      Date_Opened: '12/07/2026',
      $url: 'https://psiog.zohorecruit.in/jobs/Careers/153233000001888888/Hidden-QA-Engineer?source=CareerSite',
    },
  ],
}

test('Psiog Digital constants stay pinned to the verified first-party handoff and public Zoho surfaces', async () => {
  const psiogDigital = await loadPsiogDigitalModule()

  assert.equal(psiogDigital.HOMEPAGE_URL, 'https://psiog.com/')
  assert.equal(psiogDigital.ABOUT_PAGE_URL, 'https://psiog.com/about-us/')
  assert.equal(psiogDigital.CAREERS_PAGE_URL, 'https://psiog.com/careers/')
  assert.equal(psiogDigital.RECRUITMENT_PAGE_URL, 'https://psiog.com/recruitment/')
  assert.equal(psiogDigital.CAREERS_PORTAL_URL, 'https://psiog.zohorecruit.in/jobs/Careers')
  assert.equal(
    psiogDigital.CAREERS_API_URL,
    'https://psiog.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(psiogDigital.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(psiogDigital.hasOfficialAboutPageSignal(aboutPageHtml), true)
  assert.equal(psiogDigital.hasOfficialCareersPageSignal(careersPageHtml), true)
  assert.equal(psiogDigital.hasOfficialRecruitmentPageSignal(recruitmentPageHtml), true)
  assert.equal(psiogDigital.hasOfficialPortalSignal(portalHtml), true)
})

test('extractIndiaJobs keeps only published India jobs from the verified Psiog public feed', async () => {
  const psiogDigital = await loadPsiogDigitalModule()

  assert.deepEqual(psiogDigital.extractIndiaJobs(apiPayload), [
    {
      title: 'Technical Lead - Data',
      company: 'Psiog Digital',
      department: null,
      location: 'Chennai, India',
      city: 'Chennai',
      state: null,
      country: 'India',
      jobId: '153233000000599055',
      requisitionId: '153233000000599055',
      sourceUrl: 'https://psiog.zohorecruit.in/jobs/Careers/153233000000599055/Technical-Lead---Data?source=CareerSite',
      applyUrl: 'https://psiog.zohorecruit.in/jobs/Careers/153233000000599055/Technical-Lead---Data?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '10/07/2026',
      closingDate: null,
      jobDescription: 'Lead enterprise data engineering engagements.',
      remoteStatus: 'On-site',
    },
    {
      title: 'Senior Software Engineer- .NET',
      company: 'Psiog Digital',
      department: null,
      location: 'Chennai, India',
      city: 'Chennai',
      state: null,
      country: 'India',
      jobId: '153233000001600125',
      requisitionId: '153233000001600125',
      sourceUrl: 'https://psiog.zohorecruit.in/jobs/Careers/153233000001600125/Senior-Software-Engineer--NET?source=CareerSite',
      applyUrl: 'https://psiog.zohorecruit.in/jobs/Careers/153233000001600125/Senior-Software-Engineer--NET?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '12/07/2026',
      closingDate: null,
      jobDescription: 'Build and maintain .NET solutions.',
      remoteStatus: 'On-site',
    },
  ])
})

test('run validates the official Psiog first-party handoff chain before decorating public India jobs', async () => {
  const psiogDigital = await loadPsiogDigitalModule()
  const requestedUrls = []

  const jobs = await psiogDigital.createPsiogDigitalScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === psiogDigital.HOMEPAGE_URL) return homepageHtml
      if (url === psiogDigital.ABOUT_PAGE_URL) return aboutPageHtml
      if (url === psiogDigital.CAREERS_PAGE_URL) return careersPageHtml
      if (url === psiogDigital.RECRUITMENT_PAGE_URL) return recruitmentPageHtml
      if (url === psiogDigital.CAREERS_PORTAL_URL) return portalHtml

      assert.fail(`Unexpected HTML request: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      return apiPayload
    },
    now: () => '2026-07-12T12:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    psiogDigital.HOMEPAGE_URL,
    psiogDigital.ABOUT_PAGE_URL,
    psiogDigital.CAREERS_PAGE_URL,
    psiogDigital.RECRUITMENT_PAGE_URL,
    psiogDigital.CAREERS_PORTAL_URL,
    psiogDigital.CAREERS_API_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'psiogdigital')
  assert.equal(
    jobs[0].link,
    'https://psiog.zohorecruit.in/jobs/Careers/153233000000599055/Technical-Lead---Data?source=CareerSite',
  )
  assert.equal(jobs[0].scrapedAt, '2026-07-12T12:00:00.000Z')
})

test('run fails closed when the verified Psiog recruitment handoff disappears', async () => {
  const psiogDigital = await loadPsiogDigitalModule()

  await assert.rejects(
    psiogDigital.createPsiogDigitalScraper().run({
      fetchText: async (url) => {
        if (url === psiogDigital.HOMEPAGE_URL) return homepageHtml
        if (url === psiogDigital.ABOUT_PAGE_URL) return aboutPageHtml
        if (url === psiogDigital.CAREERS_PAGE_URL) return careersPageHtml
        return '<html><body>Unexpected page</body></html>'
      },
      fetchJson: async () => apiPayload,
    }),
    /official Psiog recruitment handoff/i,
  )
})
