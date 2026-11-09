import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>OneAdvanced Careers</title>
  </head>
  <body>
    <h1>Power the world of work with us</h1>
    <a href="https://careers-oneadvanced.icims.com/">Job Search</a>
  </body>
</html>
`

const listingHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>OneAdvanced | Careers Center | Welcome</title>
  </head>
  <body>
    <ul class="container-fluid iCIMS_JobsTable">
      <li class="iCIMS_JobCardItem">
        <div class="row">
          <div class="col-xs-6 header left">
            <span class="sr-only field-label">Job Locations</span>
            <span>IN-KA-Bengaluru</span>
          </div>
          <div class="col-xs-6 header right">
            <span class="sr-only field-label">Posted Date</span>
            <span title="10/7/2026 9:15 AM">1 week ago</span>
          </div>
          <div class="col-xs-12 title">
            <a href="https://careers-oneadvanced.icims.com/jobs/8709/principal-cyber-security-test-engineer/job?in_iframe=1" class="iCIMS_Anchor" title="8709 - Principal Cyber Security Test Engineer">
              <h3>Principal Cyber Security Test Engineer</h3>
            </a>
          </div>
          <div class="col-xs-12 description">Champion a shift-left security philosophy.</div>
          <div class="col-xs-12 additionalFields">
            <dl class="iCIMS_JobHeaderGroup">
              <div class="iCIMS_JobHeaderTag">
                <dt class="iCIMS_JobHeaderField">Category</dt>
                <dd class="iCIMS_JobHeaderData"><span>Technology</span></dd>
              </div>
              <div class="iCIMS_JobHeaderTag">
                <dt class="iCIMS_JobHeaderField">ID</dt>
                <dd class="iCIMS_JobHeaderData"><span>2026-8709</span></dd>
              </div>
            </dl>
          </div>
        </div>
      </li>
      <li class="iCIMS_JobCardItem">
        <div class="row">
          <div class="col-xs-6 header left">
            <span class="sr-only field-label">Job Locations</span>
            <span>UK-Birmingham</span>
          </div>
          <div class="col-xs-6 header right">
            <span class="sr-only field-label">Posted Date</span>
            <span title="11/7/2026 9:15 AM">1 week ago</span>
          </div>
          <div class="col-xs-12 title">
            <a href="https://careers-oneadvanced.icims.com/jobs/8694/cyber-security-ops-analyst/job?in_iframe=1" class="iCIMS_Anchor" title="8694 - Cyber Security Ops Analyst">
              <h3>Cyber Security Ops Analyst</h3>
            </a>
          </div>
          <div class="col-xs-12 description">UK-only role.</div>
          <div class="col-xs-12 additionalFields">
            <dl class="iCIMS_JobHeaderGroup">
              <div class="iCIMS_JobHeaderTag">
                <dt class="iCIMS_JobHeaderField">Category</dt>
                <dd class="iCIMS_JobHeaderData"><span>Technology</span></dd>
              </div>
              <div class="iCIMS_JobHeaderTag">
                <dt class="iCIMS_JobHeaderField">ID</dt>
                <dd class="iCIMS_JobHeaderData"><span>2026-8694</span></dd>
              </div>
            </dl>
          </div>
        </div>
      </li>
    </ul>
  </body>
</html>
`

const detailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Principal Cyber Security Test Engineer</h1>
    <div>Job Locations</div>
    <div>IN-KA-Bengaluru</div>
    <div>ID</div>
    <div>2026-8709</div>
    <div>Category</div>
    <div>Technology</div>
    <h2>Join OneAdvanced</h2>
    <p>We are looking for an experienced principal application security engineer.</p>
    <h2>What You Will Do</h2>
    <ul>
      <li>Integrate automated security analysis into CI/CD pipelines.</li>
      <li>Guide threat modelling sessions.</li>
    </ul>
    <h2>What You Will Have</h2>
    <ul>
      <li>5+ years of experience in application security.</li>
      <li>GitHub Actions CI/CD pipelines.</li>
    </ul>
    <a class="iCIMS_Anchor" title="Apply for this job online" href="https://careers-oneadvanced.icims.com/jobs/8709/principal-cyber-security-test-engineer/job?mode=apply&apply=yes&in_iframe=1">Apply for this job online</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/oneadvanced/script.js')
  } catch {
    assert.fail('Expected OneAdvanced scraper module at ../../scraper/oneadvanced/script.js')
  }
}

test('OneAdvanced validates the official careers shell and extracts India listings from the public iCIMS search page', async () => {
  const oneadvanced = await loadModule()

  assert.equal(oneadvanced.SOURCE, 'oneadvanced')
  assert.equal(oneadvanced.COMPANY, 'OneAdvanced')
  assert.equal(oneadvanced.CAREERS_URL, 'https://careers.oneadvanced.com/')
  assert.equal(oneadvanced.SEARCH_PAGE_URL, 'https://careers-oneadvanced.icims.com/jobs/search?ss=1&in_iframe=1')
  assert.equal(oneadvanced.ICIMS_USER_AGENT, 'Mozilla/5.0')
  assert.doesNotMatch(oneadvanced.ICIMS_USER_AGENT, /Chrome|Safari|Windows NT/i)
  assert.equal(oneadvanced.hasVerifiedCareersPageSignal(careersHtml), true)
  assert.equal(oneadvanced.hasOfficialSearchPageSignal(listingHtml), true)
  assert.equal(
    oneadvanced.extractJobListings(listingHtml)[0].sourceUrl,
    'https://careers-oneadvanced.icims.com/jobs/8709/principal-cyber-security-test-engineer/job?in_iframe=1',
  )
})

test('OneAdvanced run filters to India rows and enriches them from the iCIMS detail page', async () => {
  const oneadvanced = await loadModule()
  const requestedUrls = []

  const jobs = await oneadvanced.createOneadvancedScraper({
    now: () => '2026-07-18T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === oneadvanced.CAREERS_URL) return careersHtml
      if (url === oneadvanced.SEARCH_PAGE_URL) return listingHtml
      if (url === 'https://careers-oneadvanced.icims.com/jobs/8709/principal-cyber-security-test-engineer/job?in_iframe=1') {
        return detailHtml
      }
      throw new Error(`Unexpected OneAdvanced fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    oneadvanced.CAREERS_URL,
    oneadvanced.SEARCH_PAGE_URL,
    'https://careers-oneadvanced.icims.com/jobs/8709/principal-cyber-security-test-engineer/job?in_iframe=1',
  ])

  assert.deepEqual(jobs, [
    {
      title: 'Principal Cyber Security Test Engineer',
      company: 'OneAdvanced',
      department: 'Technology',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: '2026-8709',
      requisitionId: '2026-8709',
      sourceUrl: 'https://careers-oneadvanced.icims.com/jobs/8709/principal-cyber-security-test-engineer/job?in_iframe=1',
      applyUrl: 'https://careers-oneadvanced.icims.com/jobs/8709/principal-cyber-security-test-engineer/job?mode=apply&apply=yes&in_iframe=1',
      employmentType: null,
      requiredSkills: [
        '5+ years of experience in application security.',
        'GitHub Actions CI/CD pipelines.',
      ],
      postingDate: '2026-07-10',
      jobDescription: 'We are looking for an experienced principal application security engineer. Integrate automated security analysis into CI/CD pipelines. Guide threat modelling sessions. 5+ years of experience in application security. GitHub Actions CI/CD pipelines.',
      link: 'https://careers-oneadvanced.icims.com/jobs/8709/principal-cyber-security-test-engineer/job?mode=apply&apply=yes&in_iframe=1',
      source: 'oneadvanced',
      scrapedAt: '2026-07-18T00:00:00.000Z',
    },
  ])
})

test('OneAdvanced fails closed when the careers shell or iCIMS search contract drifts', async () => {
  const oneadvanced = await loadModule()

  await assert.rejects(
    oneadvanced.createOneadvancedScraper().run({
      fetchText: async (url) => {
        if (url === oneadvanced.CAREERS_URL) return careersHtml.replace('Power the world of work with us', 'Another company')
        throw new Error(`Unexpected OneAdvanced fixture URL: ${url}`)
      },
    }),
    /verified careers shell/i,
  )

  await assert.rejects(
    oneadvanced.createOneadvancedScraper().run({
      fetchText: async (url) => {
        if (url === oneadvanced.CAREERS_URL) return careersHtml
        if (url === oneadvanced.SEARCH_PAGE_URL) return listingHtml.replace('iCIMS_JobsTable', 'OtherJobsTable')
        throw new Error(`Unexpected OneAdvanced fixture URL: ${url}`)
      },
    }),
    /verified icims search page/i,
  )
})
