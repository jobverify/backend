import assert from 'node:assert/strict'
import test from 'node:test'

const loadEmbedurModule = async () => {
  try {
    return await import('../../scraper/embedur/script.js')
  } catch {
    assert.fail('Expected embedUR scraper module at ../../scraper/embedur/script.js')
  }
}

const portalHtml = `
  <html>
    <head>
      <title>Spark Your Career With Us!</title>
      <meta property="og:url" content="https://embedur.zohorecruit.in/jobs/Careers">
      <meta property="og:site_name" content="embedUR systems India Pvt Ltd">
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
      id: '166090000000385009',
      Job_Opening_Name: 'Entry Level Position',
      Posting_Title: 'Entry Level Position',
      Job_Type: 'Full time',
      City: 'Chennai',
      Country: 'India',
      Remote_Job: false,
      $url: 'https://embedur.zohorecruit.in/jobs/Careers/166090000000385009/Entry-Level-Position?source=CareerSite',
    },
    {
      id: '166090000000373001',
      Job_Opening_Name: 'Cloud Development Engineer',
      Posting_Title: 'Cloud Development Engineer',
      Job_Type: 'Full time',
      City: 'Chennai',
      Country: 'India',
      Remote_Job: false,
      $url: 'https://embedur.zohorecruit.in/jobs/Careers/166090000000373001/Cloud-Development-Engineer?source=CareerSite',
    },
    {
      id: '166090000000000001',
      Job_Opening_Name: 'US Role',
      Posting_Title: 'US Role',
      Job_Type: 'Full time',
      City: 'Austin',
      Country: 'United States',
      $url: 'https://embedur.zohorecruit.in/jobs/Careers/166090000000000001/US-Role?source=CareerSite',
    },
  ],
}

test('embedUR constants stay pinned to the official public Zoho Recruit careers surface', async () => {
  const embedur = await loadEmbedurModule()

  assert.equal(embedur.CAREERS_PORTAL_URL, 'https://embedur.zohorecruit.in/jobs/Careers')
  assert.equal(
    embedur.CAREERS_API_URL,
    'https://embedur.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(embedur.hasOfficialPortalSignal(portalHtml), true)
})

test('extractIndiaJobs keeps only India listings from the embedUR public jobs feed', async () => {
  const embedur = await loadEmbedurModule()
  const jobs = embedur.extractIndiaJobs(apiPayload)

  assert.deepEqual(jobs, [
    {
      title: 'Entry Level Position',
      company: 'embedUR',
      department: null,
      location: 'Chennai, India',
      city: 'Chennai',
      country: 'India',
      jobId: '166090000000385009',
      requisitionId: '166090000000385009',
      sourceUrl: 'https://embedur.zohorecruit.in/jobs/Careers/166090000000385009/Entry-Level-Position?source=CareerSite',
      applyUrl: 'https://embedur.zohorecruit.in/jobs/Careers/166090000000385009/Entry-Level-Position?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
    {
      title: 'Cloud Development Engineer',
      company: 'embedUR',
      department: null,
      location: 'Chennai, India',
      city: 'Chennai',
      country: 'India',
      jobId: '166090000000373001',
      requisitionId: '166090000000373001',
      sourceUrl: 'https://embedur.zohorecruit.in/jobs/Careers/166090000000373001/Cloud-Development-Engineer?source=CareerSite',
      applyUrl: 'https://embedur.zohorecruit.in/jobs/Careers/166090000000373001/Cloud-Development-Engineer?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
  ])
})

test('run validates the embedUR official portal before fetching and decorating India jobs', async () => {
  const embedur = await loadEmbedurModule()
  const requestedUrls = []

  const jobs = await embedur.createEmbedurScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return portalHtml
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      return apiPayload
    },
    now: () => '2026-07-08T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [embedur.CAREERS_PORTAL_URL, embedur.CAREERS_API_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'embedur')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-08T00:00:00.000Z')
})

test('run fails closed when the embedUR official portal signal disappears', async () => {
  const embedur = await loadEmbedurModule()

  await assert.rejects(
    embedur.createEmbedurScraper().run({
      fetchText: async () => '<html><body>Unexpected page</body></html>',
      fetchJson: async () => apiPayload,
    }),
    /official embedur careers portal/i,
  )
})
