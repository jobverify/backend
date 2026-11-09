import assert from 'node:assert/strict'
import test from 'node:test'

const executiveFutureHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career - Executives | Executive Career Openings at Mazagon Dock</title>
  </head>
  <body>
    <h3 class="inner-heading">Career - Executives</h3>
    <table id="tbl-career" class="table table-bordered table-striped">
      <thead>
        <tr>
          <th>Sr.No.</th>
          <th>Date Of Posting</th>
          <th>Advertisement Reference No</th>
          <th>Post</th>
          <th>Details</th>
          <th>Closing Date</th>
          <th>Link</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1</td>
          <td>10/07/2026</td>
          <td><p>MDL/HR-TA-MP/Exec/90/2026</p></td>
          <td><p>Consultant (Ship Design)</p></td>
          <td><p>Notice: Engagement of Consultant (Ship Design) on Contract Basis</p></td>
          <td>20/07/2026</td>
          <td><a href="https://mazagondock.in/app/writereaddata/career/consultant-ship-design.pdf">CLICK HERE FOR MORE DETAILS</a></td>
        </tr>
        <tr>
          <td>2</td>
          <td>12/07/2026</td>
          <td><p>MDL/HR-TA-MP/Exec/90/2026</p></td>
          <td><p>Consultant (Ship Design)</p></td>
          <td><p>Notice : List of Selected Candidate for Consultant (Ship Design)</p></td>
          <td></td>
          <td><a href="https://mazagondock.in/app/writereaddata/career/selected.pdf">CLICK HERE FOR MORE DETAILS</a></td>
        </tr>
      </tbody>
    </table>
  </body>
</html>
`

const executiveCurrentHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career - Executives | Executive Career Openings at Mazagon Dock</title>
  </head>
  <body>
    <h3 class="inner-heading">Career - Executives</h3>
    <table id="tbl-career" class="table table-bordered table-striped">
      <thead>
        <tr>
          <th>Sr.No.</th>
          <th>Date Of Posting</th>
          <th>Advertisement Reference No</th>
          <th>Post</th>
          <th>Details</th>
          <th>Closing Date</th>
          <th>Link</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1</td>
          <td>20/05/2026</td>
          <td><p>MDL/HR-TA-MP/Exec/86/2026</p></td>
          <td><p>Engagement of Consultant (Offshore Projects)</p></td>
          <td><p>Notice : List of Selected Candidate for Engagement of Consultant (Offshore Projects)</p></td>
          <td></td>
          <td><a href="https://mazagondock.in/app/writereaddata/career/selected-consultant.pdf">CLICK HERE FOR MORE DETAILS</a></td>
        </tr>
        <tr>
          <td>2</td>
          <td>17/02/2026</td>
          <td><p>MDL/HR-TA-MP/Exec/86/2026</p></td>
          <td><p>Consultant (Offshore Projects)</p></td>
          <td><p>Notice: Engagement of Consultant (Offshore Projects) on Contract Basis</p></td>
          <td>02/03/2026</td>
          <td><a href="https://mazagondock.in/app/writereaddata/career/consultant-offshore.pdf">CLICK HERE FOR MORE DETAILS</a></td>
        </tr>
      </tbody>
    </table>
  </body>
</html>
`

const apprenticeFutureHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career - Apprentice | Apprenticeship Programs at Mazagon Dock</title>
  </head>
  <body>
    <h3 class="inner-heading">Career - Apprentice</h3>
    <table id="tbl-career" class="table table-bordered table-striped">
      <thead>
        <tr>
          <th>Sr.No.</th>
          <th>DATE OF POSTING</th>
          <th>ADVERTISEMENT REFERENCE NO</th>
          <th>CLOSING DATE</th>
          <th>LINK</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1</td>
          <td>15/07/2026</td>
          <td>
            <p><strong>Advt. No. - MDLATS/03/2026 – Selection of Trade Apprentices, Batch 2026</strong> - corrigendum on extension of last date of application to 20-07-2026</p>
          </td>
          <td></td>
          <td><a href="https://mazagondock.in/app/writereaddata/career/trade-apprentices.pdf">CLICK HERE FOR MORE DETAILS</a></td>
        </tr>
        <tr>
          <td>2</td>
          <td>10/07/2026</td>
          <td>
            <p><strong>Advt. No. - MDLATS/03/2026 – Selection of Trade Apprentices, Batch 2026</strong> - Information Brochure - Rules and Regulation related to Application Process</p>
          </td>
          <td></td>
          <td><a href="https://mazagondock.in/app/writereaddata/career/brochure.pdf">CLICK HERE FOR MORE DETAILS</a></td>
        </tr>
      </tbody>
    </table>
  </body>
</html>
`

const apprenticeCurrentHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career - Apprentice | Apprenticeship Programs at Mazagon Dock</title>
  </head>
  <body>
    <h3 class="inner-heading">Career - Apprentice</h3>
    <table id="tbl-career" class="table table-bordered table-striped">
      <thead>
        <tr>
          <th>Sr.No.</th>
          <th>DATE OF POSTING</th>
          <th>ADVERTISEMENT REFERENCE NO</th>
          <th>CLOSING DATE</th>
          <th>LINK</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1</td>
          <td>08/07/2026</td>
          <td>
            <p><strong>Advt. No. - MDLATS/01/2026 – Selection of Trade Apprentices, Batch 2026</strong> - corrigendum on extension of last date of application to 15-07-2026</p>
          </td>
          <td></td>
          <td><a href="https://mazagondock.in/app/writereaddata/career/trade-apprentices-current.pdf">CLICK HERE FOR MORE DETAILS</a></td>
        </tr>
        <tr>
          <td>2</td>
          <td>10/06/2026</td>
          <td>
            <p><strong>Advt. No. - MDLATS/01/2026 – Selection of Trade Apprentices, Batch 2026</strong> - Information Brochure - Rules and Regulation related to Application Process</p>
          </td>
          <td></td>
          <td><a href="https://mazagondock.in/app/writereaddata/career/brochure-current.pdf">CLICK HERE FOR MORE DETAILS</a></td>
        </tr>
      </tbody>
    </table>
  </body>
</html>
`

const nonExecutiveEmptyHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career - Non-Executives | Apply for Non-Executive Careers at Mazagon Dock</title>
  </head>
  <body>
    <h3 class="inner-heading">Career - Non-Executives</h3>
    <table id="tbl-career" class="table table-bordered table-striped">
      <thead>
        <tr>
          <th>Sr.No.</th>
          <th>DATE OF POSTING</th>
          <th>ADVERTISEMENT REFERENCE NO</th>
          <th>CLOSING DATE</th>
          <th>LINK</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  </body>
</html>
`

const driftHtml = '<html><head><title>Unexpected</title></head><body>Placeholder</body></html>'

const loadModule = async () => {
  try {
    return await import('../../scraper/mazagondockshipbuilders/script.js')
  } catch {
    assert.fail('Expected Mazagon Dock Shipbuilders scraper module at ../../scraper/mazagondockshipbuilders/script.js')
  }
}

test('Mazagon Dock Shipbuilders parses the official executive and apprentice recruitment tables conservatively', async () => {
  const mazagon = await loadModule()

  assert.equal(
    mazagon.EXECUTIVE_CAREER_PAGE_URL,
    'https://mazagondock.in/English/career/Career-Executives',
  )
  assert.equal(
    mazagon.NON_EXECUTIVE_CAREER_PAGE_URL,
    'https://mazagondock.in/English/career/Career-Non-Executives',
  )
  assert.equal(
    mazagon.APPRENTICE_CAREER_PAGE_URL,
    'https://mazagondock.in/English/career/Career-Apprentice',
  )
  assert.equal(
    mazagon.ONLINE_RECRUITMENT_PORTAL_URL,
    'https://mazagondock.in/app/MDLJobPortal/Welcome.aspx',
  )
  assert.equal(mazagon.hasOfficialExecutiveCareersSignal(executiveFutureHtml), true)
  assert.equal(mazagon.hasOfficialNonExecutiveCareersSignal(nonExecutiveEmptyHtml), true)
  assert.equal(mazagon.hasOfficialApprenticeCareersSignal(apprenticeFutureHtml), true)

  assert.deepEqual(
    mazagon.extractExecutiveOpenings(executiveFutureHtml, { referenceDate: '2026-07-16' }),
    [
      {
        title: 'Consultant (Ship Design)',
        company: 'Mazagon Dock Shipbuilders Limited',
        department: 'Executive Recruitment',
        location: 'Mumbai, Maharashtra, India',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        jobId: 'mazagondockshipbuilders-mdl-hr-ta-mp-exec-90-2026-2026-07-10',
        requisitionId: 'MDL/HR-TA-MP/Exec/90/2026',
        sourceUrl: 'https://mazagondock.in/app/writereaddata/career/consultant-ship-design.pdf',
        applyUrl: 'https://mazagondock.in/app/MDLJobPortal/Welcome.aspx',
        employmentType: 'Contract',
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: '2026-07-10T00:00:00.000Z',
        closingDate: '2026-07-20T00:00:00.000Z',
        jobDescription: 'Official Mazagon Dock Shipbuilders executive recruitment notice. Notice: Engagement of Consultant (Ship Design) on Contract Basis',
      },
    ],
  )

  assert.deepEqual(
    mazagon.extractApprenticeOpenings(apprenticeFutureHtml, { referenceDate: '2026-07-16' }),
    [
      {
        title: 'Selection of Trade Apprentices, Batch 2026',
        company: 'Mazagon Dock Shipbuilders Limited',
        department: 'Apprentice Recruitment',
        location: 'Mumbai, Maharashtra, India',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        jobId: 'mazagondockshipbuilders-mdlats-03-2026-2026-07-15',
        requisitionId: 'MDLATS/03/2026',
        sourceUrl: 'https://mazagondock.in/app/writereaddata/career/trade-apprentices.pdf',
        applyUrl: 'https://mazagondock.in/app/MDLJobPortal/Welcome.aspx',
        employmentType: 'Apprenticeship',
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: '2026-07-15T00:00:00.000Z',
        closingDate: '2026-07-20T00:00:00.000Z',
        jobDescription: 'Official Mazagon Dock Shipbuilders apprenticeship recruitment notice. Advt. No. - MDLATS/03/2026 - Selection of Trade Apprentices, Batch 2026 - corrigendum on extension of last date of application to 20-07-2026',
      },
    ],
  )
})

test('Mazagon Dock Shipbuilders returns no jobs for the verified Thursday, July 16, 2026 state because every public posting is closed or notice-only', async () => {
  const mazagon = await loadModule()
  const requestedUrls = []

  const jobs = await mazagon.createMazagonDockShipbuildersScraper({
    now: () => '2026-07-16T12:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === mazagon.EXECUTIVE_CAREER_PAGE_URL) return executiveCurrentHtml
      if (url === mazagon.NON_EXECUTIVE_CAREER_PAGE_URL) return nonExecutiveEmptyHtml
      if (url === mazagon.APPRENTICE_CAREER_PAGE_URL) return apprenticeCurrentHtml

      throw new Error(`Unexpected Mazagon Dock Shipbuilders URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    mazagon.EXECUTIVE_CAREER_PAGE_URL,
    mazagon.NON_EXECUTIVE_CAREER_PAGE_URL,
    mazagon.APPRENTICE_CAREER_PAGE_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Mazagon Dock Shipbuilders fails closed when any verified official recruitment page changes materially', async () => {
  const mazagon = await loadModule()

  await assert.rejects(
    mazagon.createMazagonDockShipbuildersScraper().run({
      fetchText: async (url) => {
        if (url === mazagon.EXECUTIVE_CAREER_PAGE_URL) return driftHtml
        if (url === mazagon.NON_EXECUTIVE_CAREER_PAGE_URL) return nonExecutiveEmptyHtml
        if (url === mazagon.APPRENTICE_CAREER_PAGE_URL) return apprenticeCurrentHtml
        throw new Error(`Unexpected Mazagon Dock Shipbuilders URL: ${url}`)
      },
    }),
    /executive careers page/i,
  )

  await assert.rejects(
    mazagon.createMazagonDockShipbuildersScraper().run({
      fetchText: async (url) => {
        if (url === mazagon.EXECUTIVE_CAREER_PAGE_URL) return executiveCurrentHtml
        if (url === mazagon.NON_EXECUTIVE_CAREER_PAGE_URL) return driftHtml
        if (url === mazagon.APPRENTICE_CAREER_PAGE_URL) return apprenticeCurrentHtml
        throw new Error(`Unexpected Mazagon Dock Shipbuilders URL: ${url}`)
      },
    }),
    /non-executive careers page/i,
  )

  await assert.rejects(
    mazagon.createMazagonDockShipbuildersScraper().run({
      fetchText: async (url) => {
        if (url === mazagon.EXECUTIVE_CAREER_PAGE_URL) return executiveCurrentHtml
        if (url === mazagon.NON_EXECUTIVE_CAREER_PAGE_URL) return nonExecutiveEmptyHtml
        if (url === mazagon.APPRENTICE_CAREER_PAGE_URL) return driftHtml
        throw new Error(`Unexpected Mazagon Dock Shipbuilders URL: ${url}`)
      },
    }),
    /apprentice careers page/i,
  )
})
