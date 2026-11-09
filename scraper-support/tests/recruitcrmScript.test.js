import assert from 'node:assert/strict'
import test from 'node:test'

const loadRecruitCrmModule = async () => {
  try {
    return await import('../../scraper/recruitcrm/script.js')
  } catch {
    assert.fail('Expected Recruit CRM scraper module at ../../scraper/recruitcrm/script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Join the dream team!</h1>
      <p>Recruit CRM is a fully remote company.</p>
      <a href="https://careers.recruitcrm.io">View open jobs</a>
    </main>
  </body>
</html>
`

const boardShellHtml = `
<!doctype html>
<html lang="en">
  <body>
    <script>
      self.__next_f.push([1,"{\\"project\\":{\\"_id\\":\\"68944694418f3334810e6b3b\\",\\"name\\":\\"Recruit CRM Careers\\"},\\"account\\":{\\"_id\\":\\"6838449a4c201efb4db9e96f\\",\\"uuid\\":\\"9fddca43-735a-4037-9865-a2daaf8e1e8f\\",\\"companyName\\":\\"Recruit CRM\\",\\"domainUrl\\":\\"https://careers.recruitcrm.io\\"}}"])
    </script>
    <script src="/_next/static/chunks/app/layout-58288282ab1b6fe0.js"></script>
  </body>
</html>
`

const layoutBundleJs = `
"use strict";
let getJobs=(0,createServerReference)("7febb022f05380eb95c91d8e2c918f197ae0003ade",callServer,void 0,findSourceMapURL,"getJobs")
let searchJobs=(0,createServerReference)("7f4f631f2b8ce3307a1f727bdad631ca6a0c5fba61",callServer,void 0,findSourceMapURL,"searchJobs")
`

const jobsActionResponse = `
0:{"a":"$@1","f":"","b":"0nViOcz1sZvu4-3hit7S_"}
1:{"success":true,"data":{"data":[{"job_id":"194","job_slug":"17829617619150132400PgA","name":"SDET/ Automation Engineer","number_of_openings":"1","city":"Pune","locality":"Remote","state":null,"country":"India","updated_on":"1782973687","job_type":"Full Time","job_category":"Engineering"},{"job_id":"184","job_slug":"17712190853810129269dFC","name":"Customer Success Associate -2026 (India)","number_of_openings":"15","city":"Remote","locality":null,"state":null,"country":null,"updated_on":"1773371570","job_type":"Full Time","job_category":null},{"job_id":"186","job_slug":"17773632789720028687ewo","name":"Sales Management Associate (Colombia)","number_of_openings":"4","city":"Remote","locality":null,"state":null,"country":null,"updated_on":"1777363285","job_type":"Full Time","job_category":null}],"count":3}}
`

const indiaSdetDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <script>
      (self.__next_s=self.__next_s||[]).push([0,{"type":"application/ld+json","children":"{\\"@context\\":\\"https://schema.org\\",\\"@type\\":\\"JobPosting\\",\\"title\\":\\"SDET/ Automation Engineer\\",\\"description\\":\\"\\u003cp\\u003eShip resilient automation across web, API, and mobile.\\u003c/p\\u003e\\",\\"jobLocation\\":{\\"@type\\":\\"Place\\",\\"address\\":{\\"@type\\":\\"PostalAddress\\",\\"addressLocality\\":\\"Remote\\",\\"addressCountry\\":\\"India\\"}},\\"validThrough\\":\\"2026-08-01\\",\\"employmentType\\":\\"FULL_TIME\\",\\"identifier\\":{\\"@type\\":\\"PropertyValue\\",\\"name\\":\\"Recruit CRM\\",\\"value\\":\\"17829617619150132400PgA\\"},\\"directApply\\":true,\\"industry\\":\\"Engineering\\"}"}])
    </script>
  </body>
</html>
`

const indiaCssaDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <script>
      (self.__next_s=self.__next_s||[]).push([0,{"type":"application/ld+json","children":"{\\"@context\\":\\"https://schema.org\\",\\"@type\\":\\"JobPosting\\",\\"title\\":\\"Customer Success Associate -2026 (India)\\",\\"description\\":\\"\\u003cp\\u003eSupport customers across India in a remote-first role.\\u003c/p\\u003e\\",\\"jobLocation\\":{\\"@type\\":\\"Place\\",\\"address\\":{\\"@type\\":\\"PostalAddress\\",\\"addressLocality\\":\\"Remote\\",\\"addressCountry\\":\\"India\\"}},\\"validThrough\\":\\"2026-07-15\\",\\"employmentType\\":\\"FULL_TIME\\",\\"identifier\\":{\\"@type\\":\\"PropertyValue\\",\\"name\\":\\"Recruit CRM\\",\\"value\\":\\"17712190853810129269dFC\\"},\\"directApply\\":true}"}])
    </script>
  </body>
</html>
`

test('Recruit CRM scraper validates the official careers handoff and parses the verified public board surfaces', async () => {
  const recruitCrm = await loadRecruitCrmModule()

  assert.equal(recruitCrm.SOURCE, 'recruitcrm')
  assert.equal(recruitCrm.COMPANY, 'Recruit CRM')
  assert.equal(recruitCrm.CAREERS_URL, 'https://recruitcrm.io/careers/')
  assert.equal(recruitCrm.JOBS_URL, 'https://careers.recruitcrm.io/')
  assert.equal(recruitCrm.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(recruitCrm.extractBoardUuid(boardShellHtml), '9fddca43-735a-4037-9865-a2daaf8e1e8f')
  assert.equal(
    recruitCrm.extractGetJobsActionIdFromBundle(layoutBundleJs),
    '7febb022f05380eb95c91d8e2c918f197ae0003ade',
  )
  assert.deepEqual(
    recruitCrm.extractListingsFromActionResponse(jobsActionResponse).map((job) => ({
      jobId: job.jobId,
      slug: job.slug,
      title: job.title,
      city: job.city,
      country: job.country,
    })),
    [
      {
        jobId: '194',
        slug: '17829617619150132400PgA',
        title: 'SDET/ Automation Engineer',
        city: 'Pune',
        country: 'India',
      },
      {
        jobId: '184',
        slug: '17712190853810129269dFC',
        title: 'Customer Success Associate -2026 (India)',
        city: 'Remote',
        country: null,
      },
      {
        jobId: '186',
        slug: '17773632789720028687ewo',
        title: 'Sales Management Associate (Colombia)',
        city: 'Remote',
        country: null,
      },
    ],
  )

  assert.deepEqual(
    recruitCrm.extractJobPostingJsonLd(indiaSdetDetailHtml),
    {
      title: 'SDET/ Automation Engineer',
      description: '<p>Ship resilient automation across web, API, and mobile.</p>',
      location: {
        city: 'Remote',
        country: 'India',
      },
      employmentType: 'FULL_TIME',
      validThrough: '2026-08-01',
      identifier: '17829617619150132400PgA',
    },
  )
})

test('Recruit CRM scraper returns only the India jobs exposed on the verified public board', async () => {
  const recruitCrm = await loadRecruitCrmModule()
  const requestedUrls = []
  const requestedActionKeys = []

  const jobs = await recruitCrm.createRecruitCrmScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === recruitCrm.CAREERS_URL) return officialCareersHtml
      if (url === recruitCrm.JOBS_URL) return boardShellHtml
      if (url === 'https://careers.recruitcrm.io/17829617619150132400PgA') return indiaSdetDetailHtml
      if (url === 'https://careers.recruitcrm.io/17712190853810129269dFC') return indiaCssaDetailHtml
      if (url === 'https://careers.recruitcrm.io/17773632789720028687ewo') {
        return `
          <!doctype html>
          <html><body>
            <script>
              (self.__next_s=self.__next_s||[]).push([0,{"type":"application/ld+json","children":"{\\"@context\\":\\"https://schema.org\\",\\"@type\\":\\"JobPosting\\",\\"title\\":\\"Sales Management Associate (Colombia)\\",\\"description\\":\\"\\u003cp\\u003eLead outbound sales in Colombia.\\u003c/p\\u003e\\",\\"jobLocation\\":{\\"@type\\":\\"Place\\",\\"address\\":{\\"@type\\":\\"PostalAddress\\",\\"addressLocality\\":\\"Remote\\",\\"addressCountry\\":\\"Colombia\\"}},\\"employmentType\\":\\"FULL_TIME\\",\\"identifier\\":{\\"@type\\":\\"PropertyValue\\",\\"name\\":\\"Recruit CRM\\",\\"value\\":\\"17773632789720028687ewo\\"}}"}])
            </script>
          </body></html>
        `
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchAction: async (boardUuid) => {
      requestedActionKeys.push(boardUuid)
      return jobsActionResponse
    },
  })

  assert.deepEqual(requestedActionKeys, ['9fddca43-735a-4037-9865-a2daaf8e1e8f'])
  assert.deepEqual(requestedUrls, [
    recruitCrm.CAREERS_URL,
    recruitCrm.JOBS_URL,
    'https://careers.recruitcrm.io/17829617619150132400PgA',
    'https://careers.recruitcrm.io/17712190853810129269dFC',
    'https://careers.recruitcrm.io/17773632789720028687ewo',
  ])
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      country: job.country,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      employmentType: job.employmentType,
      department: job.department,
      closingDate: job.closingDate,
    })),
    [
      {
        title: 'Customer Success Associate -2026 (India)',
        location: 'Remote, India',
        country: 'India',
        sourceUrl: 'https://careers.recruitcrm.io/17712190853810129269dFC',
        applyUrl: 'https://careers.recruitcrm.io/17712190853810129269dFC',
        employmentType: 'Full-time',
        department: null,
        closingDate: '2026-07-15',
      },
      {
        title: 'SDET/ Automation Engineer',
        location: 'Pune, Remote, India',
        country: 'India',
        sourceUrl: 'https://careers.recruitcrm.io/17829617619150132400PgA',
        applyUrl: 'https://careers.recruitcrm.io/17829617619150132400PgA',
        employmentType: 'Full-time',
        department: 'Engineering',
        closingDate: '2026-08-01',
      },
    ],
  )
})

test('Recruit CRM scraper discovers the live getJobs action id from the published bundle', async () => {
  const recruitCrm = await loadRecruitCrmModule()
  const requestedAssets = []

  const actionId = await recruitCrm.discoverGetJobsActionId(boardShellHtml, {
    fetchAssetText: async (url) => {
      requestedAssets.push(url)
      return layoutBundleJs
    },
  })

  assert.equal(actionId, '7febb022f05380eb95c91d8e2c918f197ae0003ade')
  assert.deepEqual(requestedAssets, [
    'https://careers.recruitcrm.io/_next/static/chunks/app/layout-58288282ab1b6fe0.js',
  ])
})

test('Recruit CRM scraper fails closed when the verified board uuid disappears', async () => {
  const recruitCrm = await loadRecruitCrmModule()

  await assert.rejects(
    recruitCrm.createRecruitCrmScraper().run({
      fetchText: async (url) => {
        if (url === recruitCrm.CAREERS_URL) return officialCareersHtml
        return '<html><body><p>Loading…</p></body></html>'
      },
      fetchAction: async () => jobsActionResponse,
    }),
    /public board uuid/i,
  )
})
