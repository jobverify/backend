import assert from 'node:assert/strict'
import test from 'node:test'

const careersLandingHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>MORE THAN JUST A JOB</h1>
    <h2>Jobs at OptiSol</h2>
    <a href="http://www.optisolbusiness.com/current-openings">Learn More</a>
  </body>
</html>
`

const currentOpeningsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Openings at OptiSol Chennai, Madurai | Hiring Software Developers | Web &amp; Mobile App Developers</title>
  </head>
  <body>
    <h2>Let's grow together</h2>
    <div id="rec_job_listing_div"></div>
    <script type="text/javascript" src="https://static.zohocdn.com/recruit/embed_careers_site/javascript/v1.1/embed_jobs.js"></script>
    <script type="text/javascript">
      rec_embed_js.load({
        widget_id: "rec_job_listing_div",
        page_name: "Careers",
        source: "CareerSite",
        site: "https://optisolbusiness.zohorecruit.in",
        brand_color: "#6875E2",
        empty_job_msg: "No current Openings"
      });
    </script>
  </body>
</html>
`

const apiPayload = {
  code: 'success',
  data: [
    {
      Posting_Title: 'Digital Marketing Associate',
      Is_Locked: false,
      City: 'Chennai',
      State: 'Tamil Nadu',
      Job_Description: `
        <p><strong>Experience:</strong> 1–2 Years</p>
        <p><strong>Location:</strong> Chennai (Work from Office)</p>
        <p><strong>Employment Type:</strong> FTE (Full-time)</p>
        <p>We are looking for a creative and data-driven Digital Marketing Executive to join our growing marketing team.</p>
      `,
      Job_Type: 'Full time',
      Job_Opening_Name: 'Digital Marketing Associate',
      Country: 'India',
      $url: 'https://optisolbusiness.zohorecruit.in/jobs/Careers/183543000002852061/Digital-Marketing-Associate?source=CareerSite',
      id: '183543000002852061',
      Publish: true,
      Date_Opened: '06/24/2026',
      Remote_Job: false,
    },
    {
      Posting_Title: 'Senior Product Marketing Manager',
      Is_Locked: false,
      City: 'Austin',
      Country: 'United States',
      Job_Description: '<p>Experience: 8+ Years</p>',
      Job_Type: 'Full time',
      Job_Opening_Name: 'Senior Product Marketing Manager',
      $url: 'https://optisolbusiness.zohorecruit.in/jobs/Careers/2/Senior-Product-Marketing-Manager?source=CareerSite',
      id: '2',
      Publish: true,
      Date_Opened: '06/20/2026',
      Remote_Job: true,
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/optisolbusinesssolutions/script.js')
  } catch {
    assert.fail('Expected OptiSol Business Solutions scraper module at ../../scraper/optisolbusinesssolutions/script.js')
  }
}

test('OptiSol Business Solutions validates the live first-party landing page and Zoho widget handoff', async () => {
  const optisol = await loadModule()

  assert.equal(optisol.CAREERS_LANDING_URL, 'https://www.optisolbusiness.com/join-with-us')
  assert.equal(optisol.CURRENT_OPENINGS_URL, 'https://www.optisolbusiness.com/current-openings')
  assert.equal(optisol.CAREERS_PORTAL_URL, 'https://optisolbusiness.zohorecruit.in/jobs/Careers')
  assert.equal(optisol.CAREERS_API_URL, 'https://optisolbusiness.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite')
  assert.equal(optisol.hasOfficialCareersLandingSignal(careersLandingHtml), true)
  assert.equal(optisol.hasOfficialCurrentOpeningsSignal(currentOpeningsHtml), true)
  assert.deepEqual(
    optisol.extractIndiaJobs(apiPayload).map((job) => [job.title, job.location, job.experienceRequired]),
    [['Digital Marketing Associate', 'Chennai, India', '1-2 years']],
  )
})

test('OptiSol Business Solutions run follows the current openings page and public Zoho API', async () => {
  const optisol = await loadModule()
  const requestedUrls = []

  const jobs = await optisol.createOptiSolBusinessSolutionsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === optisol.CAREERS_LANDING_URL) return careersLandingHtml
      if (url === optisol.CURRENT_OPENINGS_URL) return currentOpeningsHtml
      throw new Error(`Unexpected OptiSol text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      if (url === optisol.CAREERS_API_URL) return apiPayload
      throw new Error(`Unexpected OptiSol json URL: ${url}`)
    },
    now: () => '2026-08-03T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    optisol.CAREERS_LANDING_URL,
    optisol.CURRENT_OPENINGS_URL,
    optisol.CAREERS_API_URL,
  ])
  assert.deepEqual(jobs, [
    {
      title: 'Digital Marketing Associate',
      company: 'OptiSol Business Solutions',
      department: null,
      location: 'Chennai, India',
      city: 'Chennai',
      state: 'Tamil Nadu',
      country: 'India',
      jobId: '183543000002852061',
      requisitionId: '183543000002852061',
      sourceUrl: 'https://optisolbusiness.zohorecruit.in/jobs/Careers/183543000002852061/Digital-Marketing-Associate?source=CareerSite',
      applyUrl: 'https://optisolbusiness.zohorecruit.in/jobs/Careers/183543000002852061/Digital-Marketing-Associate?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: '1-2 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-06-24',
      closingDate: null,
      jobDescription: 'Experience: 1–2 Years Location: Chennai (Work from Office) Employment Type: FTE (Full-time) We are looking for a creative and data-driven Digital Marketing Executive to join our growing marketing team.',
      remoteStatus: 'On-site',
      source: 'optisolbusinesssolutions',
      link: 'https://optisolbusiness.zohorecruit.in/jobs/Careers/183543000002852061/Digital-Marketing-Associate?source=CareerSite',
      scrapedAt: '2026-08-03T00:00:00.000Z',
    },
  ])
})

test('OptiSol Business Solutions fails closed when the verified current openings widget drifts', async () => {
  const optisol = await loadModule()

  await assert.rejects(
    optisol.createOptiSolBusinessSolutionsScraper().run({
      fetchText: async (url) => {
        if (url === optisol.CAREERS_LANDING_URL) return careersLandingHtml
        return currentOpeningsHtml.replace('https://optisolbusiness.zohorecruit.in', 'https://example.zohorecruit.in')
      },
      fetchJson: async () => apiPayload,
    }),
    /verified current openings page/i,
  )
})
