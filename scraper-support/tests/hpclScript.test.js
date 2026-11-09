import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-16T00:00:00.000Z'

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>HPCL Careers | Oil Gas Industry Jobs | Hindustan Petroleum Corporation Ltd</title>
  </head>
  <body>
    <h3>Careers</h3>
    <div>Latest Announcements</div>
    <div>Documents</div>
    <a href="/job-openings">Job Openings</a>
    <a href="https://jobs.hpcl.co.in/Recruit_New/recruitlogin.jsp" target="_blank">Candidate Login</a>
    <strong>FRAUD ALERT!</strong>
    <p>This is to bring to your attention that a fraudulent email is currently circulating among colleges and students.</p>
    <h4>What's Your Interest</h4>
  </body>
</html>
`

const jobOpeningsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Opening | HPCL Careers | Oil Gas Industry Jobs</title>
  </head>
  <body>
    <h4 class="inner-page-block-heading">Our Current Openings</h4>

    <div class="card">
      <div class="card-header">
        <span>Engagement of HPCL Graduate Apprentice Trainees (2026-27)</span>
      </div>
      <div class="card-body">
        <ul class="bullet">
          <li><a href="../../scraper/documents/pdf/Advertisement of HPCL ALL INDIA MARKETING Apprentice Engagement - English.pdf">Advertisement copy English</a></li>
          <li><a href="../../scraper/documents/pdf/Advertisement of HPCL ALL INDIA MARKETING Apprentice Engagement - Hindi.pdf">Advertisement copy Hindi</a></li>
          <li><a href="http://jobs.hpcl.co.in/Recruit_New/recruitlogin.jsp">Click here to Apply</a></li>
        </ul>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span>Recruitment of Officers 2026-27</span>
      </div>
      <div class="card-body">
        <ul class="bullet">
          <li><a href="../../scraper/documents/pdf/140X160 MM AD.pdf">Corrigendum/ Addendum dated 2nd July, 2026</a></li>
          <li><a href="../../scraper/documents/pdf/Officers 26-27.pdf">View Window Advertisement</a></li>
          <li><a href="../../scraper/documents/pdf/Recruitment of Officers- July-26_Final_1.pdf">Detailed Advertisement (pdf attached)</a></li>
          <li><a href="https://jobs.hpcl.co.in/Recruit_New/recruitlogin.jsp">Click here to Apply</a></li>
          <li>Online Application will be accepted from 1600 hrs on 1st July 2026 till 1500 hrs on 20th July 2026.</li>
        </ul>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span>Advertisement for the Selection for the post for Director (Marketing), HPCL, a scheduled 'A' CPSE</span>
      </div>
      <div class="card-body">
        <ul class="bullet">
          <li><a href="../../scraper/documents/pdf/Advertisement -Dir Marketing.pdf">View Window Advertisement</a></li>
          <li><a href="https://pesb.gov.in/UserAccount/Login">Click here to Apply</a></li>
        </ul>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span>Recruitment of Officers 2026</span>
      </div>
      <div class="card-body">
        <ul class="bullet">
          <li><a href="../../scraper/documents/pdf/CBT Cut-offs.pdf">Position Wise Cut-off Marks in all Categories for Computer Based Test (CBT) held on 3rd May, 2026</a></li>
          <li>Results for Computer Based Test (CBT) held on 3rd May, 2026 have been made live for all positions. Candidates can view their results under Candidate Login.</li>
          <li><a href="../../scraper/documents/pdf/Recruitment of Officers- Feb 2026_Final_as on 9th March 2026.pdf">Detailed Advertisement (pdf attached)</a></li>
          <li><a href="https://jobs.hpcl.co.in/Recruit_New/recruitlogin.jsp">Click here to Apply</a></li>
        </ul>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span>Engagement of HPCL Graduate Apprentice Trainees (2026-27) for Refineries Division</span>
      </div>
      <div class="card-body">
        <ul class="bullet">
          <li><a href="../../scraper/documents/pdf/Advertisement of  HPCL GAT - Refineries Division FY26-27.pdf">View Window Advertisement</a></li>
          <li><a href="https://jobs.hpcl.co.in/Recruit_New/recruitlogin.jsp">Click here to Apply</a></li>
        </ul>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span>Engagement of HPCL Graduate Apprentice Trainees (2026-27)</span>
      </div>
      <div class="card-body">
        <ul class="bullet">
          <li><a href="../../scraper/documents/pdf/Engagement_of_HPCL_Graduate_Apprentice_Trainees_2025-26_Advt_English.pdf">View Detailed Advertisement - (English)</a></li>
          <li><a href="../../scraper/documents/pdf/Engagement_of_HPCL_Graduate_Apprentice_Trainees_2025-26_Advt_Hindi.pdf">View Detailed Advertisement - (Hindi)</a></li>
          <li><a href="https://jobs.hpcl.co.in/Recruit_New/recruitlogin.jsp">Click here to Apply</a></li>
        </ul>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span>Job Updates Form</span>
      </div>
      <div class="card-body">
        <ul class="bullet">
          <li><a href="https://careerpages.hpcl.co.in/CareerPages/preContactForm">Click here</a></li>
        </ul>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span>Documents</span>
      </div>
      <div class="card-body">
        <ul class="bullet">
          <li><a href="../../scraper/images/HP_OBC.pdf">Download Caste Certificate format for OBC</a></li>
        </ul>
      </div>
    </div>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/hpcl/script.js')
  } catch {
    assert.fail('Expected HPCL scraper module at ../../scraper/hpcl/script.js')
  }
}

test('HPCL pins the verified first-party careers page, job-openings page, and apply portals', async () => {
  const hpcl = await loadModule()

  assert.equal(hpcl.SOURCE, 'hpcl')
  assert.equal(hpcl.COMPANY, 'HPCL')
  assert.equal(hpcl.CAREERS_URL, 'https://www.hindustanpetroleum.com/careers')
  assert.equal(hpcl.JOB_OPENINGS_URL, 'https://www.hindustanpetroleum.com/job-openings')
  assert.deepEqual(hpcl.VERIFIED_APPLY_PORTAL_URLS, [
    'https://jobs.hpcl.co.in/Recruit_New/recruitlogin.jsp',
    'https://pesb.gov.in/UserAccount/Login',
  ])
  assert.equal(hpcl.hasOfficialCareersSignal(careersPageHtml), true)
  assert.equal(hpcl.hasOfficialJobOpeningsSignal(jobOpeningsHtml), true)
  assert.equal(hpcl.normalizeApplyUrl('http://jobs.hpcl.co.in/Recruit_New/recruitlogin.jsp'), 'https://jobs.hpcl.co.in/Recruit_New/recruitlogin.jsp')
  assert.equal(hpcl.parseApplicationWindow('Online Application will be accepted from 1600 hrs on 1st July 2026 till 1500 hrs on 20th July 2026.'), JSON.stringify({
    postingDate: '2026-07-01',
    closingDate: '2026-07-20',
  }))

  const cards = hpcl.extractOpeningCards(jobOpeningsHtml)
  assert.equal(cards.length, 6)
  assert.equal(cards[0].title, 'Engagement of HPCL Graduate Apprentice Trainees (2026-27)')
  assert.equal(cards[1].title, 'Recruitment of Officers 2026-27')
  assert.equal(cards[3].title, 'Recruitment of Officers 2026')
  assert.equal(cards[4].title, 'Engagement of HPCL Graduate Apprentice Trainees (2026-27) for Refineries Division')
  assert.equal(hpcl.isLikelyActiveOpening(cards[3]), false)
  assert.equal(hpcl.isLikelyActiveOpening(cards[1]), true)
})

test('HPCL run validates the official pages and returns only active current opening cards', async () => {
  const hpcl = await loadModule()
  const requestedUrls = []

  const jobs = await hpcl.createHpclScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === hpcl.CAREERS_URL) return careersPageHtml
      if (url === hpcl.JOB_OPENINGS_URL) return jobOpeningsHtml

      throw new Error(`Unexpected HPCL text URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    hpcl.CAREERS_URL,
    hpcl.JOB_OPENINGS_URL,
  ])
  assert.equal(jobs.length, 5)
  assert.deepEqual(jobs.map((job) => [job.title, job.applyUrl, job.postingDate, job.closingDate, job.employmentType]), [
    [
      'Engagement of HPCL Graduate Apprentice Trainees (2026-27)',
      'https://jobs.hpcl.co.in/Recruit_New/recruitlogin.jsp',
      null,
      null,
      'Apprenticeship',
    ],
    [
      'Recruitment of Officers 2026-27',
      'https://jobs.hpcl.co.in/Recruit_New/recruitlogin.jsp',
      '2026-07-01',
      '2026-07-20',
      null,
    ],
    [
      "Advertisement for the Selection for the post for Director (Marketing), HPCL, a scheduled 'A' CPSE",
      'https://pesb.gov.in/UserAccount/Login',
      null,
      null,
      null,
    ],
    [
      'Engagement of HPCL Graduate Apprentice Trainees (2026-27) for Refineries Division',
      'https://jobs.hpcl.co.in/Recruit_New/recruitlogin.jsp',
      null,
      null,
      'Apprenticeship',
    ],
    [
      'Engagement of HPCL Graduate Apprentice Trainees (2026-27)',
      'https://jobs.hpcl.co.in/Recruit_New/recruitlogin.jsp',
      null,
      null,
      'Apprenticeship',
    ],
  ])
  assert.deepEqual(jobs.map((job) => job.source), ['hpcl', 'hpcl', 'hpcl', 'hpcl', 'hpcl'])
  assert.deepEqual(jobs.map((job) => job.scrapedAt), [
    FIXED_SCRAPED_AT,
    FIXED_SCRAPED_AT,
    FIXED_SCRAPED_AT,
    FIXED_SCRAPED_AT,
    FIXED_SCRAPED_AT,
  ])
})
