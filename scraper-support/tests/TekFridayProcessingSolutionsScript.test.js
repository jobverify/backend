import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Tekfriday :: Home</title>
  </head>
  <body>
    <nav>
      <a href="/index.html">Home</a>
      <a href="/careers.html">Careers</a>
      <a href="/Company.html">Company</a>
      <a href="/Technologies.html">Technologies</a>
      <a href="/ContactUs.html">Contact</a>
    </nav>
    <h2>Services</h2>
    <p>End to End Loan Portfolio Management for Credit across the Non-Prime spectrum</p>
    <p>Because no two businesses are alike</p>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Tekfriday :: Careers</title>
  </head>
  <body>
    <nav>
      <a href="/careers.html">Careers</a>
      <a href="/ContactUs.html">Contact</a>
    </nav>
    <h2>Open Positions</h2>
    <p>
      If you are passionate about Finance and Technology and are wanting to leave your mark in the world by being an evangelist for Financial Inclusion, TekFriday is your home.
    </p>
    <div id='rec_job_listing_div'></div>
    <script src='https://static.zohocdn.com/recruit/embed_careers_site/javascript/v1.1/embed_jobs.js'></script>
    <script>
      rec_embed_js.load({
        widget_id:'rec_job_listing_div',
        page_name:'Careers',
        source:'CareerSite',
        site:'https://tekfriday.zohorecruit.in',
        empty_job_msg:'No current Openings'
      });
    </script>
  </body>
</html>
`

const portalHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs at Careers</title>
    <meta property="og:url" content="https://tekfriday.zohorecruit.in/jobs/Careers" />
  </head>
  <body>
    <input id="pageJson" value="{}" />
    <input id="moduleMeta" value="{}" />
    <input id="jobs" value="[]" />
  </body>
</html>
`

const apiPayload = {
  code: 'success',
  data: [
    {
      Posting_Title: '.Net8 Developers',
      Job_Opening_Name: '.Net8 Developers',
      Job_Type: 'Full time',
      Job_Description: 'We are seeking a highly skilled Application Developer with 3-5 years of experience in building scalable, high-performance applications.',
      Work_Experience: null,
      City: 'Hyderabad',
      State: 'Telangana',
      Country: 'India',
      $url: 'https://tekfriday.zohorecruit.in/jobs/Careers/153081000003608121/Net8-Developers?source=CareerSite',
      id: '153081000003608121',
      Date_Opened: '12/12/2025',
    },
    {
      Posting_Title: 'Management Trainee',
      Job_Opening_Name: 'Management Trainee',
      Job_Type: 'Full time',
      Job_Description: 'Position Title: Management Trainee Location: Hyderabad Education: MBA About the Role We are seeking a dynamic and results-driven professional.',
      Work_Experience: '1-2 years',
      City: 'Hyderabad',
      State: 'Telangana',
      Country: 'India',
      $url: 'https://tekfriday.zohorecruit.in/jobs/Careers/153081000003909001/Management-Trainee?source=CareerSite',
      id: '153081000003909001',
      Date_Opened: '01/05/2026',
    },
    {
      Posting_Title: 'Business Analyst',
      Job_Opening_Name: 'Business Analyst',
      Job_Type: 'Full time',
      Job_Description: 'We are looking for a Business Analyst to bridge product, delivery, and client stakeholders across the lending platform.',
      Work_Experience: null,
      City: 'Hyderabad',
      State: 'Telangana',
      Country: 'India',
      $url: 'https://tekfriday.zohorecruit.in/jobs/Careers/153081000003777777/Business-Analyst?source=CareerSite',
      id: '153081000003777777',
      Date_Opened: '12/30/2025',
    },
    {
      Posting_Title: 'Collection Manager',
      Job_Opening_Name: 'Collection Manager',
      Job_Type: 'Full time',
      Job_Description: 'This role supports the collections team in India.',
      Work_Experience: '5+ years',
      City: 'Dubai',
      State: 'Dubai',
      Country: 'United Arab Emirates',
      $url: 'https://tekfriday.zohorecruit.in/jobs/Careers/153081000009999999/Collection-Manager?source=CareerSite',
      id: '153081000009999999',
      Date_Opened: '01/20/2026',
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/tekfridayprocessingsolutions/script.js')
  } catch {
    assert.fail('Expected TekFriday Processing Solutions scraper module at ../../scraper/tekfridayprocessingsolutions/script.js')
  }
}

test('TekFriday Processing Solutions validators stay pinned to the verified embedded Zoho Recruit careers contract', async () => {
  const tekfriday = await loadModule()

  assert.equal(tekfriday.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(tekfriday.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(tekfriday.hasOfficialPortalSignal(portalHtml), true)
  assert.deepEqual(tekfriday.extractIndiaJobs(apiPayload), [
    {
      title: '.Net8 Developers',
      company: 'TekFriday Processing Solutions',
      location: 'Hyderabad, Telangana, India',
      city: 'Hyderabad',
      state: 'Telangana',
      country: 'India',
      sourceUrl: 'https://tekfriday.zohorecruit.in/jobs/Careers/153081000003608121/Net8-Developers?source=CareerSite',
      applyUrl: 'https://tekfriday.zohorecruit.in/jobs/Careers/153081000003608121/Net8-Developers?source=CareerSite&$apply=true',
      requisitionId: '153081000003608121',
      jobId: '153081000003608121',
      employmentType: 'Full-time',
      experienceRequired: '3-5 years',
      postingDate: '12/12/2025',
      closingDate: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      jobDescription: 'We are seeking a highly skilled Application Developer with 3-5 years of experience in building scalable, high-performance applications.',
      remoteStatus: 'On-site',
      publicExperienceChecked: true,
    },
    {
      title: 'Management Trainee',
      company: 'TekFriday Processing Solutions',
      location: 'Hyderabad, Telangana, India',
      city: 'Hyderabad',
      state: 'Telangana',
      country: 'India',
      sourceUrl: 'https://tekfriday.zohorecruit.in/jobs/Careers/153081000003909001/Management-Trainee?source=CareerSite',
      applyUrl: 'https://tekfriday.zohorecruit.in/jobs/Careers/153081000003909001/Management-Trainee?source=CareerSite&$apply=true',
      requisitionId: '153081000003909001',
      jobId: '153081000003909001',
      employmentType: 'Full-time',
      experienceRequired: '1-2 years',
      postingDate: '01/05/2026',
      closingDate: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      jobDescription: 'Position Title: Management Trainee Location: Hyderabad Education: MBA About the Role We are seeking a dynamic and results-driven professional.',
      remoteStatus: 'On-site',
      publicExperienceChecked: true,
    },
    {
      title: 'Business Analyst',
      company: 'TekFriday Processing Solutions',
      location: 'Hyderabad, Telangana, India',
      city: 'Hyderabad',
      state: 'Telangana',
      country: 'India',
      sourceUrl: 'https://tekfriday.zohorecruit.in/jobs/Careers/153081000003777777/Business-Analyst?source=CareerSite',
      applyUrl: 'https://tekfriday.zohorecruit.in/jobs/Careers/153081000003777777/Business-Analyst?source=CareerSite&$apply=true',
      requisitionId: '153081000003777777',
      jobId: '153081000003777777',
      employmentType: 'Full-time',
      experienceRequired: null,
      postingDate: '12/30/2025',
      closingDate: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      jobDescription: 'We are looking for a Business Analyst to bridge product, delivery, and client stakeholders across the lending platform.',
      remoteStatus: 'On-site',
      publicExperienceChecked: true,
    },
  ])
})

test('TekFriday Processing Solutions run uses the first-party Zoho embed handoff and public jobs API', async () => {
  const tekfriday = await loadModule()
  const textRequests = []
  const jsonRequests = []

  const jobs = await tekfriday.run({
    now: () => '2026-08-05T12:00:00.000Z',
    fetchText: async (url) => {
      textRequests.push(url)
      if (url === tekfriday.HOMEPAGE_URL) return homepageHtml
      if (url === tekfriday.CAREERS_URL) return careersHtml
      if (url === tekfriday.CAREERS_PORTAL_URL) return portalHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchJson: async (url) => {
      jsonRequests.push(url)
      assert.equal(url, tekfriday.CAREERS_API_URL)
      return apiPayload
    },
  })

  assert.deepEqual(textRequests, [
    tekfriday.HOMEPAGE_URL,
    tekfriday.CAREERS_URL,
    tekfriday.CAREERS_PORTAL_URL,
  ])
  assert.deepEqual(jsonRequests, [tekfriday.CAREERS_API_URL])
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      experienceRequired: job.experienceRequired,
      publicExperienceChecked: job.publicExperienceChecked,
      applyUrl: job.applyUrl,
    })),
    [
      {
        title: '.Net8 Developers',
        location: 'Hyderabad, Telangana, India',
        experienceRequired: '3-5 years',
        publicExperienceChecked: true,
        applyUrl: 'https://tekfriday.zohorecruit.in/jobs/Careers/153081000003608121/Net8-Developers?source=CareerSite&$apply=true',
      },
      {
        title: 'Management Trainee',
        location: 'Hyderabad, Telangana, India',
        experienceRequired: '1-2 years',
        publicExperienceChecked: true,
        applyUrl: 'https://tekfriday.zohorecruit.in/jobs/Careers/153081000003909001/Management-Trainee?source=CareerSite&$apply=true',
      },
      {
        title: 'Business Analyst',
        location: 'Hyderabad, Telangana, India',
        experienceRequired: null,
        publicExperienceChecked: true,
        applyUrl: 'https://tekfriday.zohorecruit.in/jobs/Careers/153081000003777777/Business-Analyst?source=CareerSite&$apply=true',
      },
    ],
  )
})

test('TekFriday Processing Solutions fails closed when the verified embedded careers handoff or public API drifts', async () => {
  const tekfriday = await loadModule()

  await assert.rejects(
    tekfriday.run({
      fetchText: async (url) => {
        if (url === tekfriday.HOMEPAGE_URL) return homepageHtml
        if (url === tekfriday.CAREERS_URL) return '<html><body><h1>Careers</h1></body></html>'
        return portalHtml
      },
      fetchJson: async () => apiPayload,
    }),
    /verified TekFriday Processing Solutions careers surface/i,
  )

  await assert.rejects(
    tekfriday.run({
      fetchText: async (url) => {
        if (url === tekfriday.HOMEPAGE_URL) return homepageHtml
        if (url === tekfriday.CAREERS_URL) return careersHtml
        return '<html><body><h1>Jobs</h1></body></html>'
      },
      fetchJson: async () => apiPayload,
    }),
    /verified TekFriday Processing Solutions careers portal/i,
  )

  await assert.rejects(
    tekfriday.run({
      fetchText: async (url) => {
        if (url === tekfriday.HOMEPAGE_URL) return homepageHtml
        if (url === tekfriday.CAREERS_URL) return careersHtml
        return portalHtml
      },
      fetchJson: async () => ({ code: 'error', data: null }),
    }),
    /public jobs api/i,
  )
})
