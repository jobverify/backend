import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-18T00:00:00.000Z'

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs at Kumaran Systems Pvt Ltd</title>
    <meta
      name="description"
      content="Find our current openings below and initiate the first step towards becoming a Kumaranite."
    >
  </head>
  <body>
    <h1>Engineer What's Next Alongside People Who Care</h1>
    <a href="mailto:RBP_offshore@kumaran.com">Send Your Resume</a>
  </body>
</html>
`

const currentCareersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs at Kumaran Systems Pvt Ltd</title>
  </head>
  <body>
    <header>
      <a href="/careers/">Careers</a>
      <a href="mailto:info@kumaran.com">info@kumaran.com</a>
    </header>
    <main>
      <p>Founded in 1992, Kumaran Systems is a global technology partner helping enterprises modernize legacy systems.</p>
      <a href="/careers/">Life At Kumaran's</a>
    </main>
  </body>
</html>
`

const currentAstroCareersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta name="description" content="Find our current openings below and initiate the first step towards becoming a Kumaranite.">
    <title>Jobs at Kumaran Systems Pvt Ltd</title>
    <link rel="canonical" href="https://kumaran.com/careers/">
  </head>
  <body>
    <astro-island
      component-url="/_astro/Careers.Bg-ep3qH.js"
      component-export="default"
      client="only"
    ></astro-island>
  </body>
</html>
`

const jobsApiPayload = {
  code: 'success',
  data: [
    {
      Job_Opening_Name: 'QA Engineer - ETL & DWH',
      Posting_Title: 'QA Engineer - ETL & DWH',
      City: 'Siruseri, Chennai',
      State: 'Tamilnadu',
      Country: 'India',
      Work_Experience: '5+ years',
      Job_Type: 'Full time',
      Job_Description: 'Hands-on experience with EDW testing and Snowflake validation.',
      Department_Name: { name: 'Insurance', id: 'dept-insurance' },
      Date_Opened: '07/12/2026',
      Publish: true,
      $url: 'https://careers.kumaran.com/jobs/Careers/31840000017996502/QA-Engineer---ETL-DWH?source=CareerSite',
      id: '31840000017996502',
    },
    {
      Job_Opening_Name: '.Net Fullstack Developer',
      Posting_Title: '.Net Fullstack Developer',
      City: 'Hyderabad',
      State: 'Telengana',
      Country: 'India',
      Work_Experience: '6 - 10 Years',
      Job_Type: 'Full time',
      Job_Description: 'Design and build Azure-hosted enterprise applications.',
      Department_Name: { name: 'Banking', id: 'dept-banking' },
      Date_Opened: '03/31/2026',
      Publish: true,
      $url: 'https://careers.kumaran.com/jobs/Careers/31840000017232223/Net-Fullstack-Developer?source=CareerSite',
      id: '31840000017232223',
    },
    {
      Job_Opening_Name: 'Automation QA Lead',
      Posting_Title: 'Automation QA Lead',
      City: 'Toronto',
      State: 'Ontario',
      Country: 'Canada',
      Work_Experience: '5+ years',
      Job_Type: 'Full time',
      Job_Description: 'Lead QA automation for banking platforms.',
      Department_Name: { name: 'Banking', id: 'dept-banking' },
      Date_Opened: '05/27/2026',
      Publish: true,
      $url: 'https://careers.kumaran.com/jobs/Careers/31840000017757204/Automation-QA-Lead?source=CareerSite',
      id: '31840000017757204',
    },
    {
      Job_Opening_Name: 'Hidden Role',
      Posting_Title: 'Hidden Role',
      City: 'Chennai',
      State: 'Tamil Nadu',
      Country: 'India',
      Work_Experience: '3+ years',
      Job_Type: 'Full time',
      Job_Description: 'Not published yet.',
      Department_Name: { name: 'Internal', id: 'dept-internal' },
      Date_Opened: '07/17/2026',
      Publish: false,
      $url: 'https://careers.kumaran.com/jobs/Careers/31840000019999999/Hidden-Role?source=CareerSite',
      id: '31840000019999999',
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/kumaransystems/script.js')
  } catch {
    assert.fail('Expected Kumaran Systems scraper module at ../../scraper/kumaransystems/script.js')
  }
}

test('Kumaran Systems helpers stay pinned to the verified first-party careers page and public jobs API', async () => {
  const kumaran = await loadModule()

  assert.equal(kumaran.SOURCE, 'kumaransystems')
  assert.equal(kumaran.COMPANY, 'Kumaran Systems')
  assert.equal(kumaran.CAREERS_URL, 'https://kumaran.com/careers/')
  assert.equal(
    kumaran.JOBS_API_URL,
    'https://careers.kumaran.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(kumaran.hasOfficialCareersSignal(careersPageHtml), true)
  assert.equal(kumaran.hasOfficialCareersSignal(currentCareersPageHtml), true)
  assert.equal(kumaran.hasOfficialCareersSignal(currentAstroCareersPageHtml), true)
  assert.equal(kumaran.hasOfficialCareersSignal('<html><body>Unexpected</body></html>'), false)
  assert.deepEqual(kumaran.extractIndiaJobs(jobsApiPayload), [
    {
      title: 'QA Engineer - ETL & DWH',
      location: 'Siruseri, Chennai, Tamilnadu, India',
      experience: '5+ years',
      sourceUrl: 'https://careers.kumaran.com/jobs/Careers/31840000017996502/QA-Engineer---ETL-DWH?source=CareerSite',
      applyUrl: 'https://careers.kumaran.com/jobs/Careers/31840000017996502/QA-Engineer---ETL-DWH?source=CareerSite',
      jobId: '31840000017996502',
      department: 'Insurance',
      jobType: 'Full time',
      postingDate: '2026-07-12',
      jobDescription: 'Hands-on experience with EDW testing and Snowflake validation.',
    },
    {
      title: '.Net Fullstack Developer',
      location: 'Hyderabad, Telengana, India',
      experience: '6 - 10 Years',
      sourceUrl: 'https://careers.kumaran.com/jobs/Careers/31840000017232223/Net-Fullstack-Developer?source=CareerSite',
      applyUrl: 'https://careers.kumaran.com/jobs/Careers/31840000017232223/Net-Fullstack-Developer?source=CareerSite',
      jobId: '31840000017232223',
      department: 'Banking',
      jobType: 'Full time',
      postingDate: '2026-03-31',
      jobDescription: 'Design and build Azure-hosted enterprise applications.',
    },
  ])
})

test('Kumaran Systems run hydrates only published India jobs from the public first-party API', async () => {
  const kumaran = await loadModule()

  const jobs = await kumaran.run({
    fetchText: async (url) => {
      assert.equal(url, kumaran.CAREERS_URL)
      return careersPageHtml
    },
    fetchJson: async (url) => {
      assert.equal(url, kumaran.JOBS_API_URL)
      return jobsApiPayload
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'QA Engineer - ETL & DWH',
    location: 'Siruseri, Chennai, Tamilnadu, India',
    experience: '5+ years',
    sourceUrl: 'https://careers.kumaran.com/jobs/Careers/31840000017996502/QA-Engineer---ETL-DWH?source=CareerSite',
    applyUrl: 'https://careers.kumaran.com/jobs/Careers/31840000017996502/QA-Engineer---ETL-DWH?source=CareerSite',
    jobId: '31840000017996502',
    department: 'Insurance',
    jobType: 'Full time',
    postingDate: '2026-07-12',
    jobDescription: 'Hands-on experience with EDW testing and Snowflake validation.',
    company: 'Kumaran Systems',
    country: 'India',
    link: 'https://careers.kumaran.com/jobs/Careers/31840000017996502/QA-Engineer---ETL-DWH?source=CareerSite',
    source: 'kumaransystems',
    scrapedAt: FIXED_SCRAPED_AT,
  })
})

test('Kumaran Systems run fails closed when the verified careers page drifts', async () => {
  const kumaran = await loadModule()

  await assert.rejects(
    kumaran.run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
      fetchJson: async () => jobsApiPayload,
    }),
    /Kumaran verified first-party careers page changed materially/i,
  )
})
