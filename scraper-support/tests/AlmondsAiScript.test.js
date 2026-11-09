import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T18:00:00.000Z'

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Collaboration, Creativity, and Innovation</h1>
    <p>Open Positions</p>
    <section>
      <h5>Automation Tester</h5>
      <p>Role Type : Full Time</p>
      <p>Location : Gurugram</p>
      <p>Reporting To : Team Lead / Engineering Manager</p>
      <p>Salary Range : Open</p>
      <p>Objective of this role</p>
      <p>We are looking for an experienced Automation Tester proficient in Selenium, API testing, and database testing.</p>
      <p>Key Responsibility</p>
      <p>Develop and implement automated test scripts.</p>
      <p>Requirements:</p>
      <p>Bachelor's degree in Computer Science, Engineering, or a related field.</p>
      <p>Skills-</p>
      <p>Strong analytical and problem-solving skills.</p>
      <p>Technical Knowledge:</p>
      <p>Knowledge of Automation Tools.</p>
      <p>Desired Candidate Profile</p>
      <p>You are a fast learner and can think out-of-the-box.</p>
      <p>Note: Please add subject line before the email and send an email at hireme@almonds.ai</p>
      <a href="mailto:hireme@almonds.ai">Apply Now</a>
    </section>
    <section>
      <h5>Business Analyst</h5>
      <p>Role Type : Full Time</p>
      <p>Location : Gurugram</p>
      <p>Reporting To : Team Lead / Engineering Manager</p>
      <p>Salary Range : Open</p>
      <p>Objective of this role</p>
      <p>Drive project success by leveraging expertise in JIRA and cross-functional collaboration.</p>
      <p>Requirements:</p>
      <p>Bachelor's degree in Business, Engineering, or a related field.</p>
      <p>Skills-</p>
      <p>Stakeholder communication.</p>
      <p>Desired Candidate Profile</p>
      <p>Strong analytical mindset.</p>
      <p>Note: Please add subject line before the email and send an email at hireme@almonds.ai</p>
      <a href="mailto:hireme@almonds.ai">Apply Now</a>
    </section>
    <section>
      <h5>Tech Lead (Head of Technology)</h5>
      <p>Role Type : Full Time</p>
      <p>Location : Gurugram</p>
      <p>Salary Range : Open + Stocks</p>
      <a href="mailto:hireme@almonds.ai">Apply Now</a>
    </section>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/almondsai/script.js')
  } catch {
    assert.fail('Expected Almonds Ai scraper module at ../../scraper/almondsai/script.js')
  }
}

test('Almonds Ai helpers stay pinned to the verified first-party same-page roles surface', async () => {
  const almonds = await loadModule()

  assert.equal(almonds.SOURCE, 'almondsai')
  assert.equal(almonds.COMPANY, 'Almonds Ai')
  assert.equal(almonds.OFFICIAL_BRAND_NAME, 'Almonds Ai')
  assert.equal(almonds.CAREERS_URL, 'https://almondsdev.almonds.ai/career/')
  assert.equal(almonds.VERIFIED_ON, '2026-07-17')
  assert.equal(almonds.hasOfficialCareersSignal(careersPageHtml), true)
  assert.deepEqual(almonds.extractRoleSections(careersPageHtml).map((section) => section.title), [
    'Automation Tester',
    'Business Analyst',
    'Tech Lead (Head of Technology)',
  ])
  assert.deepEqual(
    almonds.extractJobFromRoleSection(almonds.extractRoleSections(careersPageHtml)[0], {
      scrapedAt: FIXED_SCRAPED_AT,
    }),
    {
      title: 'Automation Tester',
      company: 'Almonds Ai',
      department: null,
      location: 'Gurugram, India',
      city: 'Gurugram',
      country: 'India',
      jobId: 'automation-tester',
      requisitionId: 'automation-tester',
      sourceUrl: 'https://almondsdev.almonds.ai/career/#automation-tester',
      applyUrl: 'mailto:hireme@almonds.ai',
      employmentType: 'Full Time',
      experienceRequired: null,
      minimumQualification: "Bachelor's degree in Computer Science, Engineering, or a related field.",
      preferredQualification: null,
      requiredSkills: [
        'Strong analytical and problem-solving skills.',
        'Knowledge of Automation Tools.',
      ],
      postingDate: null,
      closingDate: null,
      jobDescription: 'We are looking for an experienced Automation Tester proficient in Selenium, API testing, and database testing. Develop and implement automated test scripts. You are a fast learner and can think out-of-the-box.',
      remoteStatus: 'On-site',
      source: 'almondsai',
      link: 'https://almondsdev.almonds.ai/career/#automation-tester',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  )
})

test('Almonds Ai run validates the page and returns normalized same-page jobs', async () => {
  const almonds = await loadModule()
  const jobs = await almonds.createAlmondsAiScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      assert.equal(url, almonds.CAREERS_URL)
      return careersPageHtml
    },
  })

  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].title, 'Automation Tester')
  assert.equal(jobs[1].title, 'Business Analyst')
  assert.equal(jobs[2].title, 'Tech Lead (Head of Technology)')
  assert.equal(jobs[0].applyUrl, 'mailto:hireme@almonds.ai')
})

test('Almonds Ai fails closed when the verified careers surface drifts', async () => {
  const almonds = await loadModule()

  await assert.rejects(
    almonds.createAlmondsAiScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /verified Almonds Ai careers page/i,
  )
})
