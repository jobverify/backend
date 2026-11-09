import assert from 'node:assert/strict'
import test from 'node:test'

const portalHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs at Innover Inc.</title>
    <meta property="og:url" content="https://innoverdigital.zohorecruit.in/jobs/Careers">
  </head>
  <body>
    <input id="pageJson" type="hidden" value="{&quot;header&quot;:{&quot;headings&quot;:{&quot;button&quot;:&quot;View Open Positions&quot;,&quot;subtitle&quot;:&quot;Build a rewarding career with Innover&quot;}}}">
    <input id="moduleMeta" type="hidden" value="[]">
    <input id="jobs" type="hidden" value="[]">
    <p>Current Openings</p>
  </body>
</html>
`

const apiPayload = {
  code: 'success',
  data: [
    {
      Industry: 'Technology',
      Job_Type: 'Full time',
      Job_Opening_Name: 'Application Support Manager / Sr. Manager',
      Posting_Title: 'Application Support Manager / Sr. Manager',
      Country: 'India',
      City: 'Bangalore',
      id: '153957000007149915',
      Publish: true,
      $url: 'https://innoverdigital.zohorecruit.in/jobs/Careers/153957000007149915/Application-Support-Manager-Sr-Manager?source=CareerSite',
    },
    {
      Job_Opening_Name: 'US Delivery Lead',
      Country: 'United States',
      City: 'Dallas',
      id: '153957000007149999',
      $url: 'https://innoverdigital.zohorecruit.in/jobs/Careers/153957000007149999/US-Delivery-Lead?source=CareerSite',
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/innoverdigital/script.js')
  } catch {
    assert.fail('Expected Innover Digital scraper module at ../../scraper/innoverdigital/script.js')
  }
}

test('Innover Digital helpers stay pinned to the verified public Zoho Recruit portal contract', async () => {
  const innoverDigital = await loadModule()

  assert.equal(innoverDigital.SOURCE, 'innoverdigital')
  assert.equal(innoverDigital.COMPANY, 'Innover Digital')
  assert.equal(innoverDigital.CAREERS_PORTAL_URL, 'https://innoverdigital.zohorecruit.in/jobs/Careers')
  assert.equal(
    innoverDigital.CAREERS_API_URL,
    'https://innoverdigital.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(innoverDigital.VERIFIED_ON, '2026-07-17')
  assert.equal(innoverDigital.hasOfficialPortalSignal(portalHtml), true)
  assert.deepEqual(innoverDigital.extractIndiaJobs(apiPayload), [
    {
      title: 'Application Support Manager / Sr. Manager',
      company: 'Innover Digital',
      department: 'Technology',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '153957000007149915',
      requisitionId: '153957000007149915',
      sourceUrl: 'https://innoverdigital.zohorecruit.in/jobs/Careers/153957000007149915/Application-Support-Manager-Sr-Manager?source=CareerSite',
      applyUrl: 'https://innoverdigital.zohorecruit.in/jobs/Careers/153957000007149915/Application-Support-Manager-Sr-Manager?source=CareerSite',
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

test('Innover Digital validates the public portal and returns normalized India jobs from the public API', async () => {
  const innoverDigital = await loadModule()
  const requestedUrls = []

  const jobs = await innoverDigital.createInnoverDigitalScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return portalHtml
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      return apiPayload
    },
    now: () => '2026-07-17T12:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    innoverDigital.CAREERS_PORTAL_URL,
    innoverDigital.CAREERS_API_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'innoverdigital')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-17T12:00:00.000Z')
})

test('Innover Digital fails closed when the verified public portal signal or API contract disappears', async () => {
  const innoverDigital = await loadModule()

  await assert.rejects(
    innoverDigital.createInnoverDigitalScraper().run({
      fetchText: async () => '<html><body>Unexpected</body></html>',
      fetchJson: async () => apiPayload,
    }),
    /verified official Innover Digital careers portal/i,
  )

  await assert.rejects(
    innoverDigital.createInnoverDigitalScraper().run({
      fetchText: async () => portalHtml,
      fetchJson: async () => ({ code: 'error' }),
    }),
    /public jobs api/i,
  )
})
