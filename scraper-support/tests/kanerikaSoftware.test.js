import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join Kanerika | Innovate and Excel in Your Career</title>
  </head>
  <body>
    <main>
      <h1>Thrive on Innovation and Excellence: Craft Your Career Path With Kanerika!</h1>
      <h2>Career Opportunities</h2>
      <p>Explore our open roles to take your career to the next level</p>
      <script>
        rec_embed_js.load({
          widget_id:"rec_job_listing_div",
          page_name:"Careers",
          source:"CareerSite",
          site:"https://kanerika.zohorecruit.com",
          brand_color:"#161717",
          empty_job_msg:"No current Openings"
        })
      </script>
    </main>
  </body>
</html>
`

const apiPayload = {
  code: 'success',
  data: [
    {
      id: '705962000014496924',
      Posting_Title: 'Data Engineer',
      Job_Opening_Name: 'Data Engineer',
      Job_Type: 'Full time',
      Work_Experience: '4+ years',
      City: 'Hyderabad',
      State: 'Telangana',
      Country: 'India',
      Date_Opened: '2026-07-01',
      Job_Description: 'Build modern data platforms.',
      Publish: true,
      Is_Locked: false,
      $url: 'https://kanerika.zohorecruit.com/jobs/Careers/705962000014496924/Data-Engineer?source=CareerSite',
    },
    {
      id: '705962000099999999',
      Posting_Title: 'US Data Architect',
      Job_Opening_Name: 'US Data Architect',
      Job_Type: 'Full time',
      Work_Experience: '8+ years',
      City: 'Dallas',
      State: 'Texas',
      Country: 'United States',
      Date_Opened: '2026-07-02',
      Job_Description: 'Overseas role.',
      Publish: true,
      Is_Locked: false,
      $url: 'https://kanerika.zohorecruit.com/jobs/Careers/705962000099999999/US-Data-Architect?source=CareerSite',
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/kanerikasoftware/script.js')
  } catch {
    assert.fail('Expected Kanerika Software scraper module at ../../scraper/kanerikasoftware/script.js')
  }
}

test('Kanerika Software helpers stay pinned to the verified first-party Zoho Recruit widget surface', async () => {
  const kanerika = await loadModule()

  assert.equal(kanerika.CAREERS_URL, 'https://kanerika.com/careers/')
  assert.equal(kanerika.ZOHO_SITE, 'https://kanerika.zohorecruit.com')
  assert.equal(
    kanerika.buildZohoJobsApiUrl(),
    'https://kanerika.zohorecruit.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(kanerika.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(
    kanerika.extractZohoJobs(apiPayload).map((job) => ({
      title: job.title,
      location: job.location,
      country: job.country,
      sourceUrl: job.sourceUrl,
    })),
    [
      {
        title: 'Data Engineer',
        location: 'Hyderabad, Telangana, India',
        country: 'India',
        sourceUrl: 'https://kanerika.zohorecruit.com/jobs/Careers/705962000014496924/Data-Engineer?source=CareerSite',
      },
    ],
  )
})

test('Kanerika Software run validates the first-party careers page and keeps only India Zoho Recruit jobs', async () => {
  const kanerika = await loadModule()

  const jobs = await kanerika.createKanerikaSoftwareScraper({
    now: () => '2026-07-18T00:00:00.000Z',
  }).run({
    fetchText: async () => careersHtml,
    fetchJson: async () => apiPayload,
  })

  assert.deepEqual(jobs, [
    {
      title: 'Data Engineer',
      company: 'Kanerika Software',
      location: 'Hyderabad, Telangana, India',
      city: 'Hyderabad',
      state: 'Telangana',
      country: 'India',
      jobId: '705962000014496924',
      requisitionId: '705962000014496924',
      sourceUrl: 'https://kanerika.zohorecruit.com/jobs/Careers/705962000014496924/Data-Engineer?source=CareerSite',
      applyUrl: 'https://kanerika.zohorecruit.com/jobs/Careers/705962000014496924/Data-Engineer?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: '4+ years',
      postingDate: '2026-07-01',
      jobDescription: 'Build modern data platforms.',
      link: 'https://kanerika.zohorecruit.com/jobs/Careers/705962000014496924/Data-Engineer?source=CareerSite',
      source: 'kanerikasoftware',
      scrapedAt: '2026-07-18T00:00:00.000Z',
    },
  ])
})
