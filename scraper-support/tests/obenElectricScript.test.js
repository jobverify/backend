import assert from 'node:assert/strict'
import test from 'node:test'

const loadObenElectricModule = async () => {
  try {
    return await import('../../scraper/obenelectric/script.js')
  } catch {
    assert.fail('Expected Oben Electric scraper module at ../../scraper/obenelectric/script.js')
  }
}

const aboutPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Us | Oben Electric</title>
  </head>
  <body>
    <main>
      <h1>About Us</h1>
      <h2>Be a part of the future at Oben Electric</h2>
      <a href="https://careers.obenelectric.com/jobs/Careers">Explore Careers</a>
    </main>
  </body>
</html>
`

const currentAboutPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Us - Oben Electric</title>
  </head>
  <body>
    <main>
      <h1>About Us</h1>
      <p>Purpose-built electric motorcycles for India.</p>
      <a href="https://careers.obenelectric.com/jobs/Careers">Explore Careers</a>
    </main>
  </body>
</html>
`

const portalHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Oben Electric</title>
    <meta property="og:url" content="https://careers.obenelectric.com/jobs/Careers" />
  </head>
  <body>
    <input id="pageJson" type="hidden" value="{}" />
    <input id="moduleMeta" type="hidden" value="{}" />
    <input id="jobs" type="hidden" value="[]" />
    <section>
      <h1>Careers at Oben Electric</h1>
      <button>View Open Positions</button>
      <div>CareerSite</div>
      <div>Job Openings</div>
    </section>
  </body>
</html>
`

const jobsPayload = {
  code: 'success',
  data: [
    {
      id: '142786000001000001',
      Posting_Title: 'In-Process Quality Inspection Specialist',
      Job_Type: 'Full-Time',
      Work_Experience: '2 - 4 Years',
      Date_Opened: '07/16/2026',
      City: 'Bengaluru',
      Country: 'India',
      Job_Description:
        'Conduct detailed inspections of electric bikes and critical components on the production line.',
      $url:
        'https://careers.obenelectric.com/jobs/Careers/142786000001000001/In-Process-Quality-Inspection-Specialist?source=CareerSite',
      Client_Name: {
        name: 'Production',
      },
      Required_Qualification: [
        'Diploma in Mechanical Engineering',
        'Diploma in Electrical Engineering',
      ],
    },
    {
      id: '142786000001000002',
      Posting_Title: 'Procurement Manager',
      Job_Type: 'Full-Time',
      Work_Experience: '5 - 7 Years',
      Date_Opened: '07/15/2026',
      City: 'Bengaluru',
      Country: 'India',
      Job_Description: 'Own supplier strategy, negotiation, and sourcing operations for EV manufacturing.',
      $url:
        'https://careers.obenelectric.com/jobs/Careers/142786000001000002/Procurement-Manager?source=CareerSite',
      Client_Name: {
        name: 'Supply Chain',
      },
      Required_Qualification: ['MBA', 'BTech'],
    },
  ],
}

const driftedAboutPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About</title>
  </head>
  <body>
    <main>
      <h1>About</h1>
      <a href="/apply">Apply</a>
    </main>
  </body>
</html>
`

test('Oben Electric helper exports stay pinned to the verified about page, custom careers portal, and public jobs API', async () => {
  const obenElectric = await loadObenElectricModule()

  assert.equal(obenElectric.SOURCE, 'obenelectric')
  assert.equal(obenElectric.COMPANY, 'Oben Electric')
  assert.equal(obenElectric.VERIFIED_ON, '2026-07-17')
  assert.equal(obenElectric.HOMEPAGE_URL, 'https://obenelectric.com/')
  assert.equal(obenElectric.ABOUT_PAGE_URL, 'https://obenelectric.com/about-us')
  assert.equal(
    obenElectric.CAREERS_PORTAL_URL,
    'https://careers.obenelectric.com/jobs/Careers',
  )
  assert.equal(
    obenElectric.CAREERS_API_URL,
    'https://careers.obenelectric.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(obenElectric.hasOfficialAboutPageSignal(aboutPageHtml), true)
  assert.equal(obenElectric.hasOfficialAboutPageSignal(currentAboutPageHtml), true)
  assert.equal(
    obenElectric.extractOfficialCareersPortalUrl(aboutPageHtml),
    'https://careers.obenelectric.com/jobs/Careers',
  )
  assert.equal(obenElectric.hasOfficialPortalSignal(portalHtml), true)
  assert.deepEqual(obenElectric.extractIndiaJobs(jobsPayload), [
    {
      title: 'In-Process Quality Inspection Specialist',
      company: 'Oben Electric',
      department: 'Production',
      location: 'Bengaluru, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '142786000001000001',
      requisitionId: '142786000001000001',
      sourceUrl:
        'https://careers.obenelectric.com/jobs/Careers/142786000001000001/In-Process-Quality-Inspection-Specialist?source=CareerSite',
      applyUrl:
        'https://careers.obenelectric.com/jobs/Careers/142786000001000001/In-Process-Quality-Inspection-Specialist?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: '2 - 4 Years',
      minimumQualification:
        'Diploma in Mechanical Engineering; Diploma in Electrical Engineering',
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-16T00:00:00.000Z',
      closingDate: null,
      jobDescription:
        'Conduct detailed inspections of electric bikes and critical components on the production line.',
      remoteStatus: 'On-site',
    },
    {
      title: 'Procurement Manager',
      company: 'Oben Electric',
      department: 'Supply Chain',
      location: 'Bengaluru, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '142786000001000002',
      requisitionId: '142786000001000002',
      sourceUrl:
        'https://careers.obenelectric.com/jobs/Careers/142786000001000002/Procurement-Manager?source=CareerSite',
      applyUrl:
        'https://careers.obenelectric.com/jobs/Careers/142786000001000002/Procurement-Manager?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: '5 - 7 Years',
      minimumQualification: 'MBA; BTech',
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-15T00:00:00.000Z',
      closingDate: null,
      jobDescription:
        'Own supplier strategy, negotiation, and sourcing operations for EV manufacturing.',
      remoteStatus: 'On-site',
    },
  ])
})

test('Oben Electric run validates the verified first-party handoff and public Zoho API conservatively', async () => {
  const obenElectric = await loadObenElectricModule()
  const requestedTexts = []
  const requestedJson = []

  const jobs = await obenElectric.createObenElectricScraper({
    now: () => '2026-07-17T08:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedTexts.push(url)

      if (url === obenElectric.ABOUT_PAGE_URL) return aboutPageHtml
      if (url === obenElectric.CAREERS_PORTAL_URL) return portalHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      assert.equal(url, obenElectric.CAREERS_API_URL)
      return jobsPayload
    },
  })

  assert.deepEqual(requestedTexts, [
    'https://obenelectric.com/about-us',
    'https://careers.obenelectric.com/jobs/Careers',
  ])
  assert.deepEqual(requestedJson, [
    'https://careers.obenelectric.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  ])
  assert.deepEqual(jobs, [
    {
      jobId: '142786000001000001',
      requisitionId: '142786000001000001',
      title: 'In-Process Quality Inspection Specialist',
      company: 'Oben Electric',
      department: 'Production',
      location: 'Bengaluru, India',
      city: 'Bangalore',
      country: 'India',
      link:
        'https://careers.obenelectric.com/jobs/Careers/142786000001000001/In-Process-Quality-Inspection-Specialist?source=CareerSite',
      sourceUrl:
        'https://careers.obenelectric.com/jobs/Careers/142786000001000001/In-Process-Quality-Inspection-Specialist?source=CareerSite',
      applyUrl:
        'https://careers.obenelectric.com/jobs/Careers/142786000001000001/In-Process-Quality-Inspection-Specialist?source=CareerSite',
      source: 'obenelectric',
      employmentType: 'Full-time',
      experienceRequired: '2 - 4 Years',
      minimumQualification:
        'Diploma in Mechanical Engineering; Diploma in Electrical Engineering',
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-16T00:00:00.000Z',
      closingDate: null,
      jobDescription:
        'Conduct detailed inspections of electric bikes and critical components on the production line.',
      remoteStatus: 'On-site',
      scrapedAt: '2026-07-17T08:00:00.000Z',
    },
    {
      jobId: '142786000001000002',
      requisitionId: '142786000001000002',
      title: 'Procurement Manager',
      company: 'Oben Electric',
      department: 'Supply Chain',
      location: 'Bengaluru, India',
      city: 'Bangalore',
      country: 'India',
      link:
        'https://careers.obenelectric.com/jobs/Careers/142786000001000002/Procurement-Manager?source=CareerSite',
      sourceUrl:
        'https://careers.obenelectric.com/jobs/Careers/142786000001000002/Procurement-Manager?source=CareerSite',
      applyUrl:
        'https://careers.obenelectric.com/jobs/Careers/142786000001000002/Procurement-Manager?source=CareerSite',
      source: 'obenelectric',
      employmentType: 'Full-time',
      experienceRequired: '5 - 7 Years',
      minimumQualification: 'MBA; BTech',
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-15T00:00:00.000Z',
      closingDate: null,
      jobDescription:
        'Own supplier strategy, negotiation, and sourcing operations for EV manufacturing.',
      remoteStatus: 'On-site',
      scrapedAt: '2026-07-17T08:00:00.000Z',
    },
  ])
})

test('Oben Electric fails closed when the verified about-page handoff or public API contract drifts', async () => {
  const obenElectric = await loadObenElectricModule()

  await assert.rejects(
    obenElectric.createObenElectricScraper().run({
      fetchText: async (url) => {
        if (url === obenElectric.ABOUT_PAGE_URL) return driftedAboutPageHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official about page/i,
  )

  await assert.rejects(
    obenElectric.createObenElectricScraper().run({
      fetchText: async (url) => {
        if (url === obenElectric.ABOUT_PAGE_URL) return aboutPageHtml
        if (url === obenElectric.CAREERS_PORTAL_URL) return portalHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
      fetchJson: async () => ({ code: 'error', data: null }),
    }),
    /public jobs api/i,
  )
})
