import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Work with Us, Create your Career @ Schbang</title>
  </head>
  <body>
    <main>
      <h1>taking the best of creative talent from India to the world.</h1>
      <a href="https://careers.schbang.com/jobs/Careers" target="_blank">See all Openings</a>
    </main>
  </body>
</html>
`

const apiPayload = {
  code: 'success',
  data: [
    {
      Posting_Title: 'Creative Strategist',
      Job_Opening_Name: 'Creative Strategist',
      Is_Locked: false,
      City: 'Mumbai',
      State: 'Maharashtra',
      Country: 'India',
      Industry: 'Media',
      Job_Description: 'Shape strategy and creative proposals for Schbang client pitches.',
      Work_Experience: '1-2 years',
      Job_Type: 'Full time',
      Date_Opened: '23/02/2026',
      $url: 'https://schbang.zohorecruit.com/jobs/Careers/596430000028680174/Creative-Strategist?source=CareerSite',
      id: '596430000028680174',
      Keep_on_Career_Site: true,
    },
    {
      Posting_Title: 'Creative Strategist - Dubai',
      Job_Opening_Name: 'Creative Strategist - Dubai',
      City: 'Dubai',
      Country: 'United Arab Emirates',
      Job_Type: 'Full time',
      $url: 'https://schbang.zohorecruit.com/jobs/Careers/596430000099999999/Creative-Strategist-Dubai?source=CareerSite',
      id: '596430000099999999',
      Keep_on_Career_Site: true,
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/schbang/script.js')
  } catch {
    assert.fail('Expected Schbang scraper module at ../../scraper/schbang/script.js')
  }
}

test('Schbang constants stay pinned to the verified official careers, hiring portal, and public jobs API surfaces', async () => {
  const schbang = await loadModule()

  assert.equal(schbang.CAREERS_PAGE_URL, 'https://www.schbang.com/careers')
  assert.equal(schbang.CAREERS_PORTAL_URL, 'https://careers.schbang.com/jobs/Careers')
  assert.equal(
    schbang.CAREERS_API_URL,
    'https://careers.schbang.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(schbang.hasOfficialCareersPageSignal(careersPageHtml), true)
  assert.equal(
    schbang.extractOfficialPortalUrl(careersPageHtml),
    'https://careers.schbang.com/jobs/Careers',
  )
  assert.equal(
    schbang.buildCareersApiUrl('https://careers.schbang.com/jobs/Careers'),
    'https://careers.schbang.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
})

test('Schbang extractIndiaJobs keeps only India listings from the verified public Zoho feed and derives apply URLs', async () => {
  const schbang = await loadModule()
  const jobs = schbang.extractIndiaJobs(apiPayload)

  assert.deepEqual(jobs, [
    {
      title: 'Creative Strategist',
      company: 'Schbang',
      department: 'Media',
      location: 'Mumbai, Maharashtra, India',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      jobId: '596430000028680174',
      requisitionId: '596430000028680174',
      sourceUrl: 'https://schbang.zohorecruit.com/jobs/Careers/596430000028680174/Creative-Strategist?source=CareerSite',
      applyUrl: 'https://schbang.zohorecruit.com/jobs/Careers/596430000028680174/Creative-Strategist?source=CareerSite&$apply=true',
      employmentType: 'Full-time',
      experienceRequired: '1-2 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-02-23',
      closingDate: null,
      jobDescription: 'Shape strategy and creative proposals for Schbang client pitches.',
      remoteStatus: 'On-site',
    },
  ])
})

test('Schbang run validates the official careers handoff before fetching and decorating India jobs', async () => {
  const schbang = await loadModule()
  const requestedUrls = []

  const jobs = await schbang.createSchbangScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === schbang.CAREERS_PAGE_URL) return careersPageHtml
      throw new Error(`Unexpected Schbang text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      return apiPayload
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requestedUrls, [
    schbang.CAREERS_PAGE_URL,
    schbang.CAREERS_API_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'schbang')
  assert.equal(
    jobs[0].link,
    'https://schbang.zohorecruit.com/jobs/Careers/596430000028680174/Creative-Strategist?source=CareerSite&$apply=true',
  )
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

test('Schbang fails closed when the official careers page or public jobs API drift', async () => {
  const schbang = await loadModule()

  await assert.rejects(
    schbang.createSchbangScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
      fetchJson: async () => apiPayload,
    }),
    /verified official schbang careers page/i,
  )

  await assert.rejects(
    schbang.createSchbangScraper().run({
      fetchText: async () =>
        careersPageHtml.replaceAll('https://careers.schbang.com/jobs/Careers', 'https://careers.schbang.com/jobs/JoinUs'),
      fetchJson: async () => apiPayload,
    }),
    /verified schbang hiring portal handoff/i,
  )

  await assert.rejects(
    schbang.createSchbangScraper().run({
      fetchText: async () => careersPageHtml,
      fetchJson: async () => ({ postings: [] }),
    }),
    /verified schbang public jobs api/i,
  )
})
