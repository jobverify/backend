import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BOARD_URL,
  CAREERS_URL,
  createEbizOnDigitalScraper,
  extractBoardJobs,
  hasOfficialCareersSignal,
  hasVerifiedBoardSignal,
} from './script.js'

const officialCareersHtml = `
  <html>
    <head><title>Careers | EbizON</title></head>
    <body>
      <h2>EbizON Seeks Out Driven A Class Members That Crave Solving Unique Technical & Marketing Problems.</h2>
      <section>
        <h2>Current Openings</h2>
        <a href="https://ebizon.applytojob.com/apply">APPLY NOW</a>
        <a href="https://ebizon.applytojob.com/apply">View More</a>
      </section>
      <div>EbizON Digital Headquarters</div>
      <div>Dehradun Development Center</div>
    </body>
  </html>
`

const boardHtml = `
  <html>
    <head><title>Ebizon - Career Page</title></head>
    <body>
      <a href="https://www.ebizondigital.com">View Our Website</a>
      <h2>Thanks for visiting our Career Page. Please review our open positions and apply to the positions that match your qualifications.</h2>
      <h2>Current Openings</h2>
      <ul>
        <li>
          <h3><a href="/apply/ByksQiOipi/Associate-Consultant-Business-Development-II-Noida">Associate Consultant - Business Development II Noida</a></h3>
          <div>Noida, Uttar Pradesh, India</div>
        </li>
        <li>
          <h3><a href="/apply/ByksQiOipi/Associate-Consultant-Business-Development-II-Noida">Associate Consultant - Business Development II Noida</a></h3>
          <div>Noida, Uttar Pradesh, India</div>
        </li>
        <li>
          <h3><a href="/apply/apCTzZpxye/EbizON-Agentforce-QA-Engineer-Voice-Testing">EbizON Agentforce QA Engineer (Voice Testing)</a></h3>
          <div>Remote</div>
        </li>
        <li>
          <h3><a href="/apply/USONLY01/Sales-Manager">Sales Manager</a></h3>
          <div>Austin, Texas, United States</div>
        </li>
      </ul>
    </body>
  </html>
`

test('validates the official EbizON careers page and verified ApplyToJob board handoff', () => {
  assert.equal(CAREERS_URL, 'https://www.ebizondigital.com/careers/')
  assert.equal(BOARD_URL, 'https://ebizon.applytojob.com/apply')
  assert.equal(hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(hasOfficialCareersSignal('<main>Careers</main>'), false)
  assert.equal(hasVerifiedBoardSignal(boardHtml), true)
  assert.equal(hasVerifiedBoardSignal('<main>No board links</main>'), false)
})

test('extractBoardJobs keeps unique India and remote EbizON roles only', () => {
  assert.deepEqual(extractBoardJobs(boardHtml), [
    {
      title: 'Associate Consultant - Business Development II Noida',
      company: 'EbizON Digital',
      department: null,
      location: 'Noida, Uttar Pradesh, India',
      city: 'Noida',
      country: 'India',
      jobId: 'ByksQiOipi',
      requisitionId: 'ByksQiOipi',
      sourceUrl: 'https://ebizon.applytojob.com/apply/ByksQiOipi/Associate-Consultant-Business-Development-II-Noida',
      applyUrl: 'https://ebizon.applytojob.com/apply/ByksQiOipi/Associate-Consultant-Business-Development-II-Noida',
      employmentType: null,
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
      title: 'EbizON Agentforce QA Engineer (Voice Testing)',
      company: 'EbizON Digital',
      department: null,
      location: 'Remote, India',
      city: null,
      country: 'India',
      jobId: 'apCTzZpxye',
      requisitionId: 'apCTzZpxye',
      sourceUrl: 'https://ebizon.applytojob.com/apply/apCTzZpxye/EbizON-Agentforce-QA-Engineer-Voice-Testing',
      applyUrl: 'https://ebizon.applytojob.com/apply/apCTzZpxye/EbizON-Agentforce-QA-Engineer-Voice-Testing',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'Remote',
    },
  ])
})

test('run validates both verified surfaces before decorating extracted jobs', async () => {
  const requestedUrls = []
  const jobs = await createEbizOnDigitalScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === CAREERS_URL) return officialCareersHtml
      if (url === BOARD_URL) return boardHtml
      if (url.includes('/apply/ByksQiOipi/')) return {
        status: 200, url, html: '<script type="application/ld+json">' + JSON.stringify({
          '@type': 'JobPosting', title: 'Associate Consultant - Business Development ll Noida',
          hiringOrganization: { name: 'EbizON' }, identifier: { value: 'ByksQiOipi' }, url,
          description: '<p>Develop new business opportunities with the EbizON team.</p>',
        }) + '</script>',
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [CAREERS_URL, BOARD_URL,
    'https://ebizon.applytojob.com/apply/ByksQiOipi/Associate-Consultant-Business-Development-II-Noida'])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'ebizondigital')
  assert.equal(
    jobs[0].link,
    'https://ebizon.applytojob.com/apply/ByksQiOipi/Associate-Consultant-Business-Development-II-Noida',
  )
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.match(jobs[0].sourceDescription, /Develop new business opportunities/)
})

test('run fails closed when the official EbizON careers page no longer matches the verified surface', async () => {
  await assert.rejects(
    createEbizOnDigitalScraper().run({
      fetchText: async (url) => (url === CAREERS_URL ? '<html><body>Careers</body></html>' : boardHtml),
    }),
    /official EbizON careers page/i,
  )
})

test('run fails closed when the public board no longer matches the verified EbizON handoff', async () => {
  await assert.rejects(
    createEbizOnDigitalScraper().run({
      fetchText: async (url) => (url === CAREERS_URL ? officialCareersHtml : '<html><body>Jobs</body></html>'),
    }),
    /verified EbizON ApplyToJob board/i,
  )
})

test('production EbizON transport keeps the final detail URL and verified employer content', async t => {
  const role = extractBoardJobs(boardHtml)[0]
  const description = '<p>Develop new business opportunities with the EbizON team.</p>'
  t.mock.method(globalThis, 'fetch', async (url) => {
    const html = url === CAREERS_URL ? officialCareersHtml : url === BOARD_URL ? boardHtml
      : '<script type="application/ld+json">' + JSON.stringify({
        '@type': 'JobPosting', title: role.title, hiringOrganization: { name: 'EbizON' },
        identifier: { value: role.jobId }, url, description,
      }) + '</script>'
    const response = new Response(html, { status: 200 })
    Object.defineProperty(response, 'url', { value: url })
    return response
  })
  const jobs = await createEbizOnDigitalScraper({ maxJobs: 1 }).run()
  assert.equal(jobs[0].sourceDescription, description)
  assert.equal(jobs[0].sourceDetailComplete, true)
})
