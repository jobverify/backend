import assert from 'node:assert/strict'
import test from 'node:test'

const grse2026PortalHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Welcome to Online Registration</title>
    </head>
    <body>
      <div align="center"><h3>Welcome to Online Application in GRSE - 2026</h3></div>
      <ul>
        <li>
          <a class="btn1 btn-default1" href="javascript:window.location.assign('/GRSE2026CGMFin/Default.aspx');">
            <font color="purple" size="+1">[Employment Notification No.: 2026/04(O)] </font>:
            Apply for Engagement of Chief General Manager (E-8) (Finance)
          </a>
          <br>Last date to Apply: 27-Aug-2026
        </li>
        <li>
          <a class="btn1 btn-default1" href="javascript:window.location.assign('/GRSE2026OS3/Default.aspx');">
            <font color="purple" size="+1">[Employment Notification No.: 2026/03(O)] </font>:
            Apply for Engagement of Executive Director (E-9)/General Manager (E-7)/Additional GM(E-6)/ Sr. Manager (E-4)
          </a>
          <br>Last date to Apply: 29-Mar-2026
        </li>
        <li>
          <a class="btn1 btn-default1" href="javascript:window.location.assign('/GRSE2026E1Expert/Default.aspx');">
            <font color="purple" size="+1">[Employment Notification No.: 2026/01(E)] </font>:
            Apply for Engagement of EXPERT / SPECIALIST (ON CONTRACT BASIS)
          </a>
          <br>Last date to Apply: 30-Jan-2026
        </li>
      </ul>
      <b>Click below link to download:</b>
    </body>
  </html>
`

const grse2025PortalHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Welcome to Online Registration</title>
    </head>
    <body>
      <div align="center"><h3>Welcome to Online Application in GRSE - 2025</h3></div>
      <ul>
        <li>
          <a class="btn1 btn-default1" href="javascript:window.location.assign('/GRSE2026E1Expert/Default.aspx');">
            <font color="purple" size="+1">[Employment Notification No.: 2026/01(E)] </font>:
            Apply for Engagement of EXPERT / SPECIALIST (ON CONTRACT BASIS)
          </a>
          <br>Last date to Apply: 30-Jan-2026
        </li>
        <li>
          <a class="btn1 btn-default1" href="javascript:window.location.assign('/GRSE2025OS8/Default.aspx');">
            <font color="purple" size="+1">[Employment Notification No.: 2025/08 (O)] </font>:
            Apply for Officer Posts
          </a>
          <br>Last date to Apply: 12-Jan-2026 (EXTENDED)
        </li>
        <li>
          <a class="btn1 btn-default1" href="javascript:window.location.assign('/GRSE2025E9Expert/Default.aspx');">
            <font color="purple" size="+1">[Employment Notification No.: 2025/09 (E)] </font>:
            Apply for Expert / Specialist (Commercial Shipbuilding) (On Contract Basis)
          </a>
          <br>Last date to Apply: 31-Dec-2025
        </li>
      </ul>
      <font size="+1" color="red">Note:Written Test for the post of Assistant Manager Against Employment Notification No. 2025/08(O) has been scheduled for 01-Mar-2026(Sunday).</font>
    </body>
  </html>
`

const grse2026NoticeHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Welcome to Online Registration</title>
    </head>
    <body>
      <table width="90%">
        <tr class="tdheader">
          <td>
            <div align="center">
              <font size="+1">
                Welcome to Online Application for GRSE Recruitment
                <br>Employment Notification No. : 2026/04 (O)
              </font>
            </div>
          </td>
        </tr>
      </table>
      <marquee><font color="white">Last date to apply online is 27-Aug-2026</font></marquee>
      <a href="ADV-ENG2026OS4.pdf" target="_blank">View Advertisement - English version</a>
      <a href="AbridgedAdvt2026OS4.pdf" target="_blank">View Abridged Advertisement - English Version</a>
      <a href="Registration.aspx">Fresh Candidate to create Log In</a>
      <a href="Login.aspx">To Complete Registration Process</a>
      <a href="mailto:grse18@jobapply.in">grse18@jobapply.in</a>
    </body>
  </html>
`

const grse2026NoticePdfText = `
GRSE: Employment Notification No. 2026/04 (O)
GARDEN REACH SHIPBUILDERS & ENGINEERS LIMITED
EMPLOYMENT NOTIFICATION NO. 2026/04 (O)
DETAILED ADVERTISEMENT FOR OFFICER POST
Opening date for Online registration: 07 August 2026 (from 14:00 Hrs.)
Closing date for Online registration: 27 August 2026 (upto 23:59 Hrs.)
A PERMANENT EMPLOYMENT
1 Chief General Manager (E-8) 120000-3%-280000 54 yrs. Finance-01 (UR)
Chartered Accountant (CA) OR Cost & Management Accountant (CMA)
24 years' post qualification experience in dealing with financial matters, either singularly or collectively,
in Budgeting/ Costing/ Banking/ Taxation/ Finalization of accounts/ Exposure in Audit Related matters/
Financial Concurrence in various procurements/ Compliance matters related to Finance.
`

const loadModule = async () => {
  try {
    return await import('../../scraper/gardenreachshipbuilders/script.js')
  } catch {
    assert.fail('Expected Garden Reach Shipbuilders scraper module at ../../scraper/gardenreachshipbuilders/script.js')
  }
}

test('Garden Reach Shipbuilders recognizes the verified reachable GRSE apply-portal indexes', async () => {
  const gardenReachShipbuilders = await loadModule()

  assert.equal(
    gardenReachShipbuilders.hasOfficialPortalIndexSignal(grse2026PortalHtml, { portalYear: '2026' }),
    true,
  )
  assert.equal(
    gardenReachShipbuilders.hasOfficialPortalIndexSignal(grse2025PortalHtml, { portalYear: '2025' }),
    true,
  )
  assert.deepEqual(
    gardenReachShipbuilders.extractPortalNotices(grse2026PortalHtml, {
      portalIndexUrl: 'https://jobapply.in/grse2026/',
    }),
    [
      {
        title: 'Chief General Manager (E-8) (Finance)',
        notificationId: '2026/04(O)',
        detailUrl: 'https://jobapply.in/GRSE2026CGMFin/Default.aspx',
        sourceUrl: 'https://jobapply.in/grse2026/',
        closingDate: '2026-08-27T00:00:00.000Z',
      },
      {
        title: 'Executive Director (E-9)/General Manager (E-7)/Additional GM(E-6)/ Sr. Manager (E-4)',
        notificationId: '2026/03(O)',
        detailUrl: 'https://jobapply.in/GRSE2026OS3/Default.aspx',
        sourceUrl: 'https://jobapply.in/grse2026/',
        closingDate: '2026-03-29T00:00:00.000Z',
      },
      {
        title: 'EXPERT / SPECIALIST (ON CONTRACT BASIS)',
        notificationId: '2026/01(E)',
        detailUrl: 'https://jobapply.in/GRSE2026E1Expert/Default.aspx',
        sourceUrl: 'https://jobapply.in/grse2026/',
        closingDate: '2026-01-30T00:00:00.000Z',
      },
    ],
  )
})

test('Garden Reach Shipbuilders returns the one active August 15, 2026 opening from the reachable official GRSE portal-plus-PDF contract', async () => {
  const gardenReachShipbuilders = await loadModule()
  const requestedTextUrls = []
  const requestedDocumentUrls = []

  const jobs = await gardenReachShipbuilders.createGardenReachShipbuildersScraper({
    asOfDate: '2026-08-15',
    now: () => '2026-08-15T10:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)

      if (url === 'https://jobapply.in/grse2026/') return grse2026PortalHtml
      if (url === 'https://jobapply.in/grse2025/') return grse2025PortalHtml
      if (url === 'https://jobapply.in/GRSE2026CGMFin/Default.aspx') return grse2026NoticeHtml

      throw new Error(`Unexpected Garden Reach Shipbuilders text URL: ${url}`)
    },
    fetchDocumentText: async (url) => {
      requestedDocumentUrls.push(url)

      if (url === 'https://jobapply.in/GRSE2026CGMFin/ADV-ENG2026OS4.pdf') {
        return grse2026NoticePdfText
      }

      throw new Error(`Unexpected Garden Reach Shipbuilders document URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTextUrls, [
    'https://jobapply.in/grse2026/',
    'https://jobapply.in/grse2025/',
    'https://jobapply.in/GRSE2026CGMFin/Default.aspx',
  ])
  assert.deepEqual(requestedDocumentUrls, ['https://jobapply.in/GRSE2026CGMFin/ADV-ENG2026OS4.pdf'])
  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Chief General Manager (E-8) (Finance) [Employment Notification 2026/04(O)]',
    company: 'Garden Reach Shipbuilders',
    department: null,
    location: 'India',
    city: null,
    state: null,
    country: 'India',
    jobId: 'gardenreachshipbuilders-2026-04-o',
    requisitionId: '2026/04(O)',
    sourceUrl: 'https://jobapply.in/GRSE2026CGMFin/Default.aspx',
    applyUrl: 'https://jobapply.in/GRSE2026CGMFin/Default.aspx',
    employmentType: 'Full-time',
    experienceRequired: '24 years post qualification experience',
    minimumQualification: 'Chartered Accountant (CA) OR Cost & Management Accountant (CMA)',
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-08-07T00:00:00.000Z',
    closingDate: '2026-08-27T00:00:00.000Z',
    jobDescription: grse2026NoticePdfText.trim(),
    remoteStatus: 'On-site',
    publicExperienceChecked: true,
    source: 'gardenreachshipbuilders',
    link: 'https://jobapply.in/GRSE2026CGMFin/Default.aspx',
    scrapedAt: '2026-08-15T10:00:00.000Z',
  })
})

test('Garden Reach Shipbuilders returns no active openings after the 2026/04(O) closing date passes', async () => {
  const gardenReachShipbuilders = await loadModule()

  const jobs = await gardenReachShipbuilders.createGardenReachShipbuildersScraper({
    asOfDate: '2026-08-28',
  }).run({
    fetchText: async (url) => {
      if (url === 'https://jobapply.in/grse2026/') return grse2026PortalHtml
      if (url === 'https://jobapply.in/grse2025/') return grse2025PortalHtml
      throw new Error(`Unexpected Garden Reach Shipbuilders URL: ${url}`)
    },
    fetchDocumentText: async () => {
      assert.fail('Garden Reach Shipbuilders should not fetch notice documents when no listings are active')
    },
  })

  assert.deepEqual(jobs, [])
})

test('Garden Reach Shipbuilders fails closed when the verified reachable apply-portal contract drifts', async () => {
  const gardenReachShipbuilders = await loadModule()

  await assert.rejects(
    gardenReachShipbuilders.createGardenReachShipbuildersScraper({
      asOfDate: '2026-08-15',
    }).run({
      fetchText: async (url) => {
        if (url === 'https://jobapply.in/grse2026/') {
          return '<html><body><h1>Unexpected portal shell</h1></body></html>'
        }

        throw new Error(`Unexpected Garden Reach Shipbuilders URL: ${url}`)
      },
    }),
    /verified official grse apply portal surface/i,
  )
})
