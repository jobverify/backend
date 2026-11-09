import assert from 'node:assert/strict'
import test from 'node:test'

const homepagePage = {
  status: 200,
  url: 'https://www.travis-ci.com/',
  html: `
    <html>
      <head><title>Simple, Flexible, Trustworthy CI/CD Tools - Travis CI</title></head>
      <body>
        <h1>How developers build simple, trustworthy CI/CD pipelines</h1>
        <p>Where developers trust Travis CI with testing and automation</p>
      </body>
    </html>
  `,
}

const aboutPage = {
  status: 200,
  url: 'https://www.travis-ci.com/about-us/',
  html: `
    <html>
      <head><title>Empowering Developers Worldwide Since 2011 - Travis CI</title></head>
      <body>
        <p>Founded in Berlin, Germany, in 2011</p>
        <p>In 2019, Travis CI became part of Idera, Inc.</p>
      </body>
    </html>
  `,
}

const imprintPage = {
  status: 200,
  url: 'https://docs.travis-ci.com/imprint.html',
  html: `
    <html>
      <head><title>Imprint - Travis CI</title></head>
      <body>
        <p>Travis CI GmbH</p>
        <p>51379 Leverkusen</p>
        <a href="https://apply.workable.com/travisci/">Work with Travis CI</a>
      </body>
    </html>
  `,
}

const careers404Page = {
  status: 404,
  url: 'https://www.travis-ci.com/careers',
  html: '<html><head><title>Page not found - Travis CI</title></head><body></body></html>',
}

const jobs404Page = {
  status: 404,
  url: 'https://www.travis-ci.com/jobs',
  html: '<html><head><title>Page not found - Travis CI</title></head><body></body></html>',
}

const workableBoardPage = {
  status: 200,
  url: 'https://apply.workable.com/travisci/',
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <title>Travis CI - Current Openings</title>
        <link rel="canonical" href="https://apply.workable.com/travisci/" />
        <meta name="subdomain" content="travisci" />
        <script>window.careers = { config: {} };</script>
      </head>
      <body><div id="app"></div></body>
    </html>
  `,
}

const emptyJobsMarkdown = `# Travis CI — All Open Positions

> Last updated: 2026-07-25

| Title | Department | Location | Type | Salary | Posted | Details |
|-------|-----------|----------|------|--------|--------|---------|

---
Powered by [Workable](https://www.workable.com)
`

const jobsMarkdownWithIndiaAndUsRoles = `# Travis CI — All Open Positions

> Last updated: 2026-07-25

| Title | Department | Location | Type | Salary | Posted | Details |
|-------|-----------|----------|------|--------|--------|---------|
| Developer Advocate | Engineering | Bengaluru, Karnataka, India | Full-time | - | 2026-07-25 | [View](https://apply.workable.com/travisci/jobs/view/ABC123.md) |
| Sales Engineer | Revenue | Austin, Texas, United States | Full-time | - | 2026-07-24 | [View](https://apply.workable.com/travisci/jobs/view/US999.md) |

---
Powered by [Workable](https://www.workable.com)
`

const emptyWidgetPayload = {
  name: 'Travis CI',
  description: 'Travis CI is a continuous integration and delivery platform.',
  jobs: [],
}

const widgetPayloadWithJobs = {
  name: 'Travis CI',
  description: 'Travis CI is a continuous integration and delivery platform.',
  jobs: [{ shortcode: 'ABC123' }],
}

const loadTravisCiModule = async () => {
  try {
    return await import('../../scraper/travisci/script.js')
  } catch {
    assert.fail('Expected Travis CI scraper module at ../../scraper/travisci/script.js')
  }
}

test('Travis CI helper predicates stay pinned to the verified homepage, imprint, 404, and Workable surfaces', async () => {
  const travisci = await loadTravisCiModule()

  assert.equal(travisci.SOURCE, 'travisci')
  assert.equal(travisci.COMPANY, 'Travis CI')
  assert.equal(travisci.OFFICIAL_BRAND_NAME, 'Travis CI')
  assert.equal(travisci.HOMEPAGE_URL, 'https://www.travis-ci.com/')
  assert.equal(travisci.ABOUT_PAGE_URL, 'https://www.travis-ci.com/about-us/')
  assert.equal(travisci.IMPRINT_PAGE_URL, 'https://docs.travis-ci.com/imprint.html')
  assert.equal(travisci.WORKABLE_BOARD_URL, 'https://apply.workable.com/travisci/')
  assert.equal(travisci.JOBS_FEED_URL, 'https://apply.workable.com/travisci/jobs.md')
  assert.equal(
    travisci.WIDGET_API_URL,
    'https://apply.workable.com/api/v1/widget/accounts/travisci',
  )
  assert.equal(travisci.hasOfficialHomepageSignal(homepagePage), true)
  assert.equal(travisci.hasAboutPageSignal(aboutPage), true)
  assert.equal(travisci.hasImprintSignal(imprintPage), true)
  assert.equal(
    travisci.hasVerifiedMissingJobRoute(careers404Page, 'https://www.travis-ci.com/careers'),
    true,
  )
  assert.equal(travisci.hasWorkableBoardSignal(workableBoardPage), true)
  assert.equal(travisci.hasOfficialJobsFeedSignal(emptyJobsMarkdown), true)
  assert.equal(travisci.hasWidgetApiSignal(emptyWidgetPayload), true)
  assert.deepEqual(
    travisci.extractJobsFromMarkdown(jobsMarkdownWithIndiaAndUsRoles),
    [
      {
        title: 'Developer Advocate',
        company: 'Travis CI',
        department: 'Engineering',
        location: 'Bengaluru, Karnataka, India',
        city: 'Bengaluru',
        state: 'Karnataka',
        country: 'India',
        jobId: 'ABC123',
        requisitionId: 'ABC123',
        sourceUrl: 'https://apply.workable.com/travisci/j/ABC123/',
        applyUrl: 'https://apply.workable.com/travisci/j/ABC123/apply',
        employmentType: 'Full-time',
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: '2026-07-25',
        closingDate: null,
        jobDescription: null,
      },
    ],
  )
})


test('Travis selected empty native feed remains a coverage gap without current handoff',async()=>{
 const module=await loadTravisCiModule(),{replay}=await import('../native-sources/publicWorkableSources/fixtureReplay.js'),r=replay()
 const jobs=await module.run(r.options)
 assert.deepEqual([...jobs],[]);assert.equal(r.audits[0].observations.length,0);assert.equal(r.audits[0].employerBindingQualified,false)
 assert.ok(r.audits[0].issues.includes('current-company-handoff-missing'))
})
test('Travis maxJobs zero does not skip the complete original empty-feed audit',async()=>{
 const module=await loadTravisCiModule(),{replay}=await import('../native-sources/publicWorkableSources/fixtureReplay.js'),r=replay()
 assert.equal((await module.createTravisCiScraper().run({...r.options,maxJobs:0})).length,0)
 assert.equal(r.audits[0].phases.length,2);assert.equal(r.audits[0].sourceScopeComplete,false)
 assert.ok(r.requests.includes('https://apply.workable.com/api/v1/accounts/travisci'))
})
