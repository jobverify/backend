import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-18T00:00:00.000Z'

const loadModule = async (relativePath) => {
  try {
    return await import(relativePath)
  } catch {
    assert.fail(`Expected scraper module at ${relativePath}`)
  }
}

const tangoeCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Join Our Innovative Global Team</h1>
    <p>Join Team Tangoe to help us shape the future and lead change.</p>
    <a href="https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=tangoe">Search Careers</a>
    <p>Competitive Salaries</p>
    <p>Remote Work</p>
  </body>
</html>
`

const sewCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Join the SEW Mission</h1>
    <p>We are looking for Skilled Individuals to Help Us Shape the Future.</p>
    <a href="/careers/product-engineer-net">Explore Job Openings</a>
  </body>
</html>
`

const sewIndiaDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Product Engineer- .Net</h1>
    <p>Noida (India)</p>
    <h2>Summary</h2>
    <p>The .NET developer will be part of an agile development team, building and working on enterprise software systems.</p>
    <h2>Apply for This Job</h2>
  </body>
</html>
`

const lumiqCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Careers</h1>
    <a href="https://lumiq.zohorecruit.in/jobs/Careers">See All Open Positions</a>
    <a href="https://lumiq.zohorecruit.in/jobs/Careers">Apply For All Open Positions</a>
    <p>Explore our current openings and find the role that aligns with your skills, interests, and career aspirations.</p>
  </body>
</html>
`

const lumiqPortalHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta property="og:url" content="https://lumiq.zohorecruit.in/jobs/Careers">
  </head>
  <body>
    <input type="hidden" id="pageJson" value="{}">
    <input type="hidden" id="moduleMeta" value="[]">
    <input type="hidden" id="jobs" value="[]">
  </body>
</html>
`

const lumiqApiPayload = {
  code: 'success',
  data: [
    {
      id: '700100000000000001',
      Job_Opening_Name: 'AI Engineer',
      Posting_Title: 'AI Engineer',
      Job_Type: 'Full time',
      City: 'Gurugram',
      State: 'Haryana',
      Country: 'India',
      Work_Experience: '4-8 years',
      Required_Skills: 'Python, LLMOps, AWS',
      Date_Opened: '2026-07-16',
      Job_Description: 'Build production-grade GenAI and ML systems for financial services clients.',
      $url: 'https://lumiq.zohorecruit.in/jobs/Careers/700100000000000001/AI-Engineer?source=CareerSite',
    },
    {
      id: '700100000000000002',
      Job_Opening_Name: 'Senior Data Engineer',
      Posting_Title: 'Senior Data Engineer',
      Job_Type: 'Full time',
      City: 'Bengaluru',
      State: 'Karnataka',
      Country: 'India',
      Work_Experience: '5-9 years',
      Required_Skills: 'Spark, Airflow, Snowflake',
      Date_Opened: '2026-07-15',
      Job_Description: 'Design modern data pipelines and cloud-native analytics platforms.',
      $url: 'https://lumiq.zohorecruit.in/jobs/Careers/700100000000000002/Senior-Data-Engineer?source=CareerSite',
    },
    {
      id: '700100000000000003',
      Job_Opening_Name: 'Account Executive',
      Posting_Title: 'Account Executive',
      Job_Type: 'Full time',
      City: 'New York',
      Country: 'United States',
      $url: 'https://lumiq.zohorecruit.in/jobs/Careers/700100000000000003/Account-Executive?source=CareerSite',
    },
  ],
}

const shipcoCareerHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Apply for a job</h1>
    <label>Title</label>
    <label>Office</label>
    <label>Job Type</label>
    <label>Date Of Publishing</label>
    <label>Description</label>
    <p>Career Opportunities</p>
  </body>
</html>
`

const flatworldFormHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Do you think you can s-t-r-e-t-c-h your limits?</h1>
    <h2>Please fill in the form below</h2>
    <label>Select profile applying for*</label>
    <p>Head of Recruitment Mortgage Processor Mortgage Underwriters Business Development Executive Jr .Net Developer</p>
    <h3>INDIA</h3>
    <p>Flatworld Mortgage Pvt. Ltd.</p>
    <p>No.744, 15th Cross, 24th Main, J P Nagar 6th Phase, Bangalore - 560 078</p>
  </body>
</html>
`

test('Tangoe sentinel validates the first-party careers shell and opaque ADP handoff before returning []', async () => {
  const tangoe = await loadModule('../../scraper/tangoe/script.js')

  assert.equal(tangoe.hasOfficialCareersSignal(tangoeCareersHtml), true)
  assert.equal(tangoe.hasOpaqueAdpHandoffSignal(tangoeCareersHtml), true)

  const jobs = await tangoe.createTangoeScraper().run({
    fetchText: async (url) => {
      assert.equal(url, tangoe.CAREERS_URL)
      return tangoeCareersHtml
    },
  })

  assert.deepEqual(jobs, [])
})

test('Smart Energy Water sentinel validates the careers shell and known India detail page before returning []', async () => {
  const sew = await loadModule('../../scraper/smartenergywater/script.js')
  const requestedUrls = []

  assert.equal(sew.hasOfficialCareersSignal(sewCareersHtml), true)
  assert.equal(sew.hasVerifiedIndiaDetailSignal(sewIndiaDetailHtml), true)

  const jobs = await sew.createSmartEnergyWaterScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === sew.CAREERS_URL) return sewCareersHtml
      if (url === sew.INDIA_DETAIL_URL) return sewIndiaDetailHtml
      throw new Error(`Unexpected SEW URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [sew.CAREERS_URL, sew.INDIA_DETAIL_URL])
  assert.deepEqual(jobs, [])
})

test('Lumiq run validates the first-party careers handoff and public Zoho board before extracting India jobs', async () => {
  const lumiq = await loadModule('../../scraper/lumiq/script.js')
  const requestedUrls = []

  assert.equal(lumiq.hasOfficialCareersPageSignal(lumiqCareersHtml), true)
  assert.equal(lumiq.hasOfficialPortalSignal(lumiqPortalHtml), true)

  const jobs = await lumiq.createLumiqScraper({ maxJobs: 2 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === lumiq.CAREERS_PAGE_URL) return lumiqCareersHtml
      if (url === lumiq.CAREERS_PORTAL_URL) return lumiqPortalHtml.replace('id="jobs" value="[]"', 'id="jobs" value="' + JSON.stringify(lumiqApiPayload.data).replaceAll('"', '&quot;') + '"')
      throw new Error(`Unexpected Lumiq HTML request: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, lumiq.CAREERS_API_URL)
      return lumiqApiPayload
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requestedUrls, [
    lumiq.CAREERS_PAGE_URL,
    lumiq.CAREERS_PORTAL_URL,
    lumiq.CAREERS_API_URL,
  ])
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      city: job.city,
      state: job.state,
      country: job.country,
      employmentType: job.employmentType,
      applyUrl: job.applyUrl,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'AI Engineer',
        location: 'Gurugram, Haryana, India',
        city: 'Gurugram',
        state: 'Haryana',
        country: 'India',
        employmentType: 'Full-time',
        applyUrl: 'https://lumiq.zohorecruit.in/jobs/Careers/700100000000000001/AI-Engineer?source=CareerSite&$apply=true',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'Senior Data Engineer',
        location: 'Bengaluru, Karnataka, India',
        city: 'Bengaluru',
        state: 'Karnataka',
        country: 'India',
        employmentType: 'Full-time',
        applyUrl: 'https://lumiq.zohorecruit.in/jobs/Careers/700100000000000002/Senior-Data-Engineer?source=CareerSite&$apply=true',
        scrapedAt: FIXED_SCRAPED_AT,
      },
    ],
  )
  assert.match(jobs[0].jobDescription, /GenAI/i)
  assert.match(jobs[1].jobDescription, /data pipelines/i)
})

test('Shipco It sentinel validates the client-rendered careers search shell and returns []', async () => {
  const shipco = await loadModule('../../scraper/shipcoit/script.js')

  assert.equal(shipco.hasVerifiedCareersShellSignal(shipcoCareerHtml), true)
  assert.equal(shipco.hasServerRenderedJobCards(shipcoCareerHtml), false)

  const jobs = await shipco.createShipcoItScraper().run({
    fetchText: async (url) => {
      assert.equal(url, shipco.CAREERS_URL)
      return shipcoCareerHtml
    },
  })

  assert.deepEqual(jobs, [])
})

test('Flatworld Mortgage Processing sentinel validates the generic application form and returns []', async () => {
  const flatworld = await loadModule('../../scraper/flatworldmortgageprocessing/script.js')

  assert.equal(flatworld.hasVerifiedApplicationFormSignal(flatworldFormHtml), true)
  assert.equal(flatworld.hasPublicJobListingsSignal(flatworldFormHtml), false)

  const jobs = await flatworld.createFlatworldMortgageProcessingScraper().run({
    fetchText: async (url) => {
      assert.equal(url, flatworld.CAREERS_URL)
      return flatworldFormHtml
    },
  })

  assert.deepEqual(jobs, [])
})
