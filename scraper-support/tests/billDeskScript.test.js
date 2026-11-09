import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-14T15:00:00.000Z'

const careersShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>BillDesk - Integrated Payment Solutions</title>
    <link rel="canonical" href="https://www.billdesk.com" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/web/assets/index-CoF-wxI2.js"></script>
  </body>
</html>
`

const careersBundle = `
const routes=[{path:"/web/job_description/:job_id",exact:!0,component:Nh}];
const careerCopy={"applyFor":"Apply For Job","applyForContent1":"To apply for this job","applyForContent2":" email your details to","emailaddress":"careers@billdesk.com","jobNav":"Jobs","currentOpenings":[
  {"jobId":"BD03","jobHeader":"Java Backend Developer","department":"Technology","location":"Mumbai","info":"4 to 8 years | Technology | Mumbai","description":"Build resilient backend services for payments at scale.","responsiblities":["Develop payment APIs","Optimize Java microservices"],"qualifications":["B.E. / B.Tech"],"technology":["Java","Spring Boot"],"experience":"4 to 8 years","skills":["Java","REST APIs"]},
  {"jobId":"BD01","jobHeader":"Banking Alliances and Partnerships","department":"Business","location":"Mumbai","info":"3 to 6 years | Business | Mumbai","description":"Support strategic partner programs.","responsiblities":["Manage partner relationships"],"qualifications":["MBA"],"technology":[],"experience":"3 to 6 years","skills":["Partnership Management"]}
]};
`

const loadBillDeskModule = async () => {
  try {
    return await import('../../scraper/billdesk/script.js')
  } catch {
    assert.fail('Expected BillDesk scraper module at ../../scraper/billdesk/script.js')
  }
}

test('BillDesk validates the official careers shell, extracts the bundle URL, and maps embedded openings', async () => {
  const billDesk = await loadBillDeskModule()

  assert.equal(billDesk.SOURCE, 'billdesk')
  assert.equal(billDesk.COMPANY, 'BillDesk')
  assert.equal(billDesk.CAREERS_URL, 'https://www.billdesk.com/web/careers')
  assert.equal(billDesk.pageIndicatesCareersShell(careersShellHtml), true)
  assert.equal(
    billDesk.extractBundleUrl(careersShellHtml),
    'https://www.billdesk.com/web/assets/index-CoF-wxI2.js',
  )
  assert.equal(billDesk.bundleIndicatesCareerContent(careersBundle), true)

  const jobs = billDesk.extractJobsFromBundle(careersBundle)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Java Backend Developer',
    company: 'BillDesk',
    department: 'Technology',
    location: 'Mumbai, India',
    city: 'Mumbai',
    country: 'India',
    jobId: 'BD03',
    requisitionId: 'BD03',
    sourceUrl: 'https://www.billdesk.com/web/job_description/jd=BD03',
    applyUrl: 'https://www.billdesk.com/web/job_description/jd=BD03',
    employmentType: null,
    experienceRequired: '4 to 8 years',
    minimumQualification: 'B.E. / B.Tech',
    preferredQualification: null,
    requiredSkills: ['Java', 'REST APIs', 'Spring Boot'],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Build resilient backend services for payments at scale.',
    remoteStatus: 'On-site',
  })
})

test('BillDesk run validates the first-party careers shell before fetching the first-party bundle and decorating jobs', async () => {
  const billDesk = await loadBillDeskModule()
  const requestedUrls = []

  const jobs = await billDesk.createBillDeskScraper({ now: () => FIXED_SCRAPED_AT }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === billDesk.CAREERS_URL) return careersShellHtml
      if (url === 'https://www.billdesk.com/web/assets/index-CoF-wxI2.js') return careersBundle
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.billdesk.com/web/careers',
    'https://www.billdesk.com/web/assets/index-CoF-wxI2.js',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'billdesk')
  assert.equal(jobs[0].link, 'https://www.billdesk.com/web/job_description/jd=BD03')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

test('BillDesk fails closed when the careers shell or embedded openings bundle changes', async () => {
  const billDesk = await loadBillDeskModule()

  await assert.rejects(
    billDesk.createBillDeskScraper().run({
      fetchText: async () => '<html><body>Unexpected page</body></html>',
    }),
    /BillDesk careers page no longer exposes the verified first-party careers shell/i,
  )

  await assert.rejects(
    billDesk.createBillDeskScraper().run({
      fetchText: async (url) => {
        if (url === billDesk.CAREERS_URL) return careersShellHtml
        return 'const emptyState = true'
      },
    }),
    /BillDesk careers bundle no longer exposes the verified embedded openings content/i,
  )
})

test('BillDesk stays API-only and surfaces direct timeout failures without a browser fallback', async () => {
  const billDesk = await loadBillDeskModule()

  await assert.rejects(
    billDesk.createBillDeskScraper({ now: () => FIXED_SCRAPED_AT }).run({
      fetchText: async () => {
        throw new Error('The operation was aborted due to timeout')
      },
    }),
    /The operation was aborted due to timeout/,
  )
})
