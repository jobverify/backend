import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-18T05:30:00.000Z'

const boardHtml = `
<!doctype html>
<html>
  <head>
    <title>Jobs at Proziod Analytics</title>
  </head>
  <body>
    <h1>Jobs at Proziod Analytics</h1>
    <p>Want to join our team? We have 3 open jobs!</p>
    <p>3 Job openings</p>
    <a class="gohire-job" href="https://careers.proziod.com/design-verification-engineers-dv-294085/">
      <h3 class="job-title client-brand-text notranslate">Design Verification Engineers (DV)</h3>
      <p class="careers-location">Bengaluru, India</p>
      <p class="date-posted">Posted 7 July, 2026</p>
    </a>
    <a class="gohire-job" href="https://careers.proziod.com/customer-support-specialist-288743/">
      <h3 class="job-title client-brand-text notranslate">Customer Support Specialist</h3>
      <p class="careers-location">Bengaluru, India</p>
      <p class="date-posted">Posted 18 May, 2026</p>
    </a>
    <a class="gohire-job" href="https://careers.proziod.com/team-leader-270444/">
      <h3 class="job-title client-brand-text notranslate">Team Leader</h3>
      <p class="careers-location">Bengaluru, India</p>
      <p class="date-posted">Posted 18 May, 2026</p>
    </a>
    <p>Powered by</p>
    <p>GoHire</p>
  </body>
</html>
`

const designVerificationHtml = `
<!doctype html>
<html>
  <head>
    <title>Design Verification Engineers (DV) at Proziod Analytics | Jobs at Proziod Analytics</title>
  </head>
  <body>
    <h1>Design Verification Engineers (DV) at Proziod Analytics</h1>
    <p class="jp-sidebar-item-title">Location</p>
    <p>Bengaluru, India</p>
    <p class="jp-sidebar-item-title">Salary</p>
    <p>Best in Industry</p>
    <p class="jp-sidebar-item-title">Job Type</p>
    <p>Full-time</p>
    <div class="jp-text">
      <p>We are hiring Design verification Engineers PCIe Design IP R &amp; D Team at Bangalore.</p>
      <p>Skills: Strong Experience in SV/UVM/Test bench development, working knowledge of PCIe / CXL Protocol</p>
      <p>Experience : 5+ yrs</p>
      <p>Notice period: Immediate to 60 days</p>
      <p>Salary : Best in Industry</p>
      <p>Key Responsibilities:</p>
      <ol>
        <li>Lead end to end IP verification activities</li>
        <li>Develop detail test plans and verification strategies</li>
        <li>Build and maintain UVM based test benches using system verilog</li>
        <li>Knowledge of protocols (AXI/ AHB/APB) and PCIe is must</li>
      </ol>
    </div>
    <div class="btn"><p>Apply Now</p></div>
  </body>
</html>
`

const customerSupportHtml = `
<!doctype html>
<html>
  <head>
    <title>Customer Support Specialist at Proziod Analytics | Jobs at Proziod Analytics</title>
  </head>
  <body>
    <h1>Customer Support Specialist at Proziod Analytics</h1>
    <p class="jp-sidebar-item-title">Location</p>
    <p>Bengaluru, India</p>
    <p class="jp-sidebar-item-title">Salary</p>
    <p>300000 - 350000 GBP</p>
    <p class="jp-sidebar-item-title">Job Type</p>
    <p>Full-time</p>
    <div class="jp-text">
      <h2>Customer Support Executive</h2>
      <p><strong>Location:</strong> Hoodi / Mahadevapura, Bangalore</p>
      <p><strong>Job Type:</strong> Full-time (Hybrid)</p>
      <p><strong>Experience Required:</strong> 2-3 Years</p>
      <h3>Job Summary</h3>
      <p>We are looking for a dedicated and customer-focused Customer Support Executive to join our team.</p>
      <h3>Requirements</h3>
      <ul>
        <li>2-3 years of experience in Customer Support / Customer Service.</li>
        <li>Proficiency in both Hindi and English (spoken and written) is mandatory.</li>
      </ul>
      <h3>Preferred Skills</h3>
      <ul>
        <li>Experience in handling voice and non-voice support.</li>
        <li>Team player with a positive attitude.</li>
      </ul>
      <h3>How to Apply</h3>
      <p>Interested candidates can send their updated CV to <a href="mailto:siva@proziod.com">siva@proziod.com</a></p>
    </div>
    <div class="btn"><p>Apply Now</p></div>
  </body>
</html>
`

const teamLeaderHtml = `
<!doctype html>
<html>
  <head>
    <title>Team Leader at Proziod Analytics | Jobs at Proziod Analytics</title>
  </head>
  <body>
    <h1>Team Leader at Proziod Analytics</h1>
    <p class="jp-sidebar-item-title">Location</p>
    <p>Bengaluru, India</p>
    <p class="jp-sidebar-item-title">Salary</p>
    <p>400000 - 500000 INR</p>
    <p class="jp-sidebar-item-title">Job Type</p>
    <p>Full-time</p>
    <div class="jp-text">
      <p>We are looking for a qualified Team Leader to manage our team and provide effective guidance.</p>
      <p>Responsibilities</p>
      <ul>
        <li>Lead, manage, and motivate a cross-functional operations team</li>
        <li>Prepare and maintain Excel-based reports, trackers, and dashboards</li>
      </ul>
      <p><strong>Requirements</strong></p>
      <ul>
        <li>Good PC skills, especially MS Excel</li>
        <li>Excellent communication and leadership skills</li>
      </ul>
      <h4><strong>What We're Looking For</strong></h4>
      <p>A self-driven leader, not a task follower</p>
    </div>
    <div class="btn"><p>Apply Now</p></div>
  </body>
</html>
`

const loadProziodModule = async () => {
  try {
    return await import('../../scraper/proziodanalytics/script.js')
  } catch {
    assert.fail('Expected Proziod Analytics scraper module at ../../scraper/proziodanalytics/script.js')
  }
}

test('Proziod Analytics pins the verified first-party GoHire board and live role cards', async () => {
  const proziod = await loadProziodModule()

  assert.equal(proziod.SOURCE, 'proziodanalytics')
  assert.equal(proziod.COMPANY, 'Proziod Analytics')
  assert.equal(proziod.COMPANY_DOMAIN, 'careers.proziod.com')
  assert.equal(proziod.CAREERS_URL, 'https://careers.proziod.com/')
  assert.equal(proziod.VERIFIED_ON, '2026-07-18')
  assert.equal(proziod.hasOfficialBoardSignal(boardHtml), true)
  assert.deepEqual(proziod.extractJobCards(boardHtml), [
    {
      title: 'Design Verification Engineers (DV)',
      sourceUrl: 'https://careers.proziod.com/design-verification-engineers-dv-294085/',
      applyUrl: 'https://careers.proziod.com/design-verification-engineers-dv-294085/',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      country: 'India',
      postingDate: '2026-07-07',
      jobId: '294085',
    },
    {
      title: 'Customer Support Specialist',
      sourceUrl: 'https://careers.proziod.com/customer-support-specialist-288743/',
      applyUrl: 'https://careers.proziod.com/customer-support-specialist-288743/',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      country: 'India',
      postingDate: '2026-05-18',
      jobId: '288743',
    },
    {
      title: 'Team Leader',
      sourceUrl: 'https://careers.proziod.com/team-leader-270444/',
      applyUrl: 'https://careers.proziod.com/team-leader-270444/',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      country: 'India',
      postingDate: '2026-05-18',
      jobId: '270444',
    },
  ])
})

test('Proziod Analytics detail parsing handles multiple live job page variants', async () => {
  const proziod = await loadProziodModule()

  const designVerification = proziod.extractJobDetail(designVerificationHtml, {
    title: 'Design Verification Engineers (DV)',
    sourceUrl: 'https://careers.proziod.com/design-verification-engineers-dv-294085/',
    applyUrl: 'https://careers.proziod.com/design-verification-engineers-dv-294085/',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    postingDate: '2026-07-07',
    jobId: '294085',
  })
  assert.equal(designVerification.title, 'Design Verification Engineers (DV)')
  assert.equal(designVerification.location, 'Bengaluru, India')
  assert.equal(designVerification.city, 'Bengaluru')
  assert.equal(designVerification.experienceRequired, '5+ yrs')
  assert.equal(designVerification.employmentType, 'Full-time')
  assert.equal(designVerification.salary, 'Best in Industry')
  assert.ok(
    designVerification.requiredSkills.some((skill) => /SV\/UVM\/Test bench development/i.test(skill)),
  )
  assert.match(designVerification.jobDescription, /PCIe Design IP R & D Team/i)

  const customerSupport = proziod.extractJobDetail(customerSupportHtml, {
    title: 'Customer Support Specialist',
    sourceUrl: 'https://careers.proziod.com/customer-support-specialist-288743/',
    applyUrl: 'https://careers.proziod.com/customer-support-specialist-288743/',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    postingDate: '2026-05-18',
    jobId: '288743',
  })
  assert.equal(customerSupport.title, 'Customer Support Specialist')
  assert.equal(customerSupport.experienceRequired, '2-3 Years')
  assert.equal(customerSupport.applyUrl, 'mailto:siva@proziod.com')
  assert.ok(
    customerSupport.requiredSkills.some((skill) => /Hindi and English/i.test(skill)),
  )
})

test('Proziod Analytics run fetches the board and details, then decorates live roles', async () => {
  const proziod = await loadProziodModule()
  const requestedUrls = []

  const jobs = await proziod.createProziodAnalyticsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === proziod.CAREERS_URL) return boardHtml
      if (url === 'https://careers.proziod.com/design-verification-engineers-dv-294085/') {
        return designVerificationHtml
      }
      if (url === 'https://careers.proziod.com/customer-support-specialist-288743/') {
        return customerSupportHtml
      }
      if (url === 'https://careers.proziod.com/team-leader-270444/') {
        return teamLeaderHtml
      }
      throw new Error(`Unexpected Proziod URL: ${url}`)
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requestedUrls, [
    proziod.CAREERS_URL,
    'https://careers.proziod.com/design-verification-engineers-dv-294085/',
    'https://careers.proziod.com/customer-support-specialist-288743/',
    'https://careers.proziod.com/team-leader-270444/',
  ])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'proziodanalytics')
  assert.equal(jobs[0].company, 'Proziod Analytics')
  assert.equal(jobs[0].companyCareerPage, proziod.CAREERS_URL)
  assert.equal(jobs[0].companyDomain, 'careers.proziod.com')
  assert.equal(jobs[0].atsPlatform, 'gohire')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(jobs[1].applyUrl, 'mailto:siva@proziod.com')
  assert.equal(jobs[2].title, 'Team Leader')
})

test('Proziod Analytics fails closed when the verified board drifts materially', async () => {
  const proziod = await loadProziodModule()

  await assert.rejects(
    proziod.createProziodAnalyticsScraper().run({
      fetchText: async () => '<html><title>Unexpected</title></html>',
    }),
    /verified Proziod Analytics board/i,
  )
})
