import assert from 'node:assert/strict'
import test from 'node:test'

const currentOpeningsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers and Current Openings - Indusface</title>
  </head>
  <body>
    <section class="_currentOpenings">
      <div class="container">
        <h1>Your Journey to Success Starts Here</h1>
        <form method="GET" id="career-filter-form">
          <div class="filter-list">
            <input type="checkbox" class="category-filter" name="career_categories[]" value="managed-security-service" id="cat_386">
            <label for="cat_386">Managed Security Service</label>
          </div>
        </form>
        <div class="row g-4">
          <div class="col-md-12 col-lg-12 mb-4">
            <div class="card h-100 shadow-sm mb-3">
              <div class="card-body d-flex flex-column">
                <h5 class="card-title">Associate Engineer, Managed Security Services</h5>
                <p class="text-muted small mb-2">
                  <span>📍 Vadodara</span>
                </p>
                <p class="card-text flex-grow-1 mb-5">As an Associate Engineer, Managed Security Services you will be responsible for the delivery of Security Management and Monitoring services to clients world-wide. The Managed&hellip;</p>
                <a href="https://www.indusface.com/careers/current-openings/associate-engineer-managed-security-services/" class="btn btn-primary mt-auto">See Open Position <i class="fa fa-angle-right ml-1"></i></a>
              </div>
            </div>
          </div>
          <div class="col-md-12 col-lg-12 mb-4">
            <div class="card h-100 shadow-sm mb-3">
              <div class="card-body d-flex flex-column">
                <h5 class="card-title">Application Security Analyst</h5>
                <p class="text-muted small mb-2">
                  <span>📍 Mumbai / Vadodara</span>
                </p>
                <p class="card-text flex-grow-1 mb-5">This is a consulting position requiring project-oriented experience and a technical background in security consulting and ethical hacking. You will be required to carry out&hellip;</p>
                <a href="https://www.indusface.com/careers/current-openings/information-security-analyst/" class="btn btn-primary mt-auto">See Open Position <i class="fa fa-angle-right ml-1"></i></a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </body>
</html>
`

const associateEngineerDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Associate Engineer, Managed Security Services | Indusface</title>
  </head>
  <body>
    <main class="career-resource">
      <div class="_careersBanner">
        <div class="container">
          <h1>Associate Engineer, Managed Security Services</h1>
          <div class="_positionBox">
            <div class="op-loc pr-3">Vadodara </div>
            <div class="op-exp">0-2 years</div>
          </div>
        </div>
      </div>
      <section class="_careerSingle sp-50">
        <div class="_cs-Sec pb-1">
          <h3>Responsibilities:</h3>
          <p>As an Associate Engineer, Managed Security Services you will be responsible for the delivery of Security Management and Monitoring services to clients world-wide.</p>
        </div>
        <div class="_cs-Sec pb-1">
          <h3>Job Description:</h3>
          <ul>
            <li>Analyse daily vulnerability scan results and identify inconsistencies.</li>
            <li>Conduct manual validation of application and network layer security vulnerabilities.</li>
          </ul>
        </div>
      </section>
      <form method="post" action="/wp-content/themes/indusface/sentmail/" enctype="multipart/form-data">
        <input type="hidden" name="url" value="https://www.indusface.com/careers/current-openings/associate-engineer-managed-security-services/">
        <input type="submit" name="sendmail" class="join-submit">
      </form>
    </main>
  </body>
</html>
`

const applicationSecurityAnalystDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Looking for Information Security Analyst in Mumbai | Indusface</title>
  </head>
  <body>
    <main class="career-resource">
      <div class="_careersBanner">
        <div class="container">
          <h1>Application Security Analyst</h1>
          <div class="_positionBox">
            <div class="op-loc pr-3">Mumbai / Vadodara </div>
            <div class="op-exp">2-5 years</div>
          </div>
        </div>
      </div>
      <section class="_careerSingle sp-50">
        <div class="_cs-Sec pb-1">
          <h3>Responsibilities:</h3>
          <p>This is a consulting position requiring project-oriented experience and a technical background in security consulting and ethical hacking.</p>
        </div>
        <div class="_cs-Sec pb-1">
          <h3>Job Description:</h3>
          <ul>
            <li>Perform vulnerability assessment and penetration testing of web and mobile applications.</li>
            <li>Assist product engineering by identifying and showcasing new exploitation techniques.</li>
          </ul>
        </div>
      </section>
      <form method="post" action="/wp-content/themes/indusface/sentmail/" enctype="multipart/form-data">
        <input type="hidden" name="url" value="https://www.indusface.com/careers/current-openings/information-security-analyst/">
        <input type="submit" name="sendmail" class="join-submit">
      </form>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/indusface/script.js')
  } catch {
    assert.fail('Expected Indusface scraper module at ../../scraper/indusface/script.js')
  }
}

test('Indusface pins the verified current-openings card markup and first-party detail-page join form contract from July 16, 2026', async () => {
  const indusface = await loadModule()

  assert.equal(indusface.SOURCE, 'indusface')
  assert.equal(indusface.COMPANY, 'Indusface')
  assert.equal(indusface.OFFICIAL_BRAND_NAME, 'Indusface')
  assert.equal(indusface.VERIFIED_AT, '2026-07-16')
  assert.equal(indusface.HOMEPAGE_URL, 'https://www.indusface.com/career/')
  assert.equal(indusface.CAREERS_URL, 'https://www.indusface.com/careers/current-openings/')
  assert.equal(indusface.JOIN_FORM_ACTION_PATH, '/wp-content/themes/indusface/sentmail/')
  assert.equal(indusface.hasOfficialCurrentOpeningsSignal(currentOpeningsHtml), true)
  assert.deepEqual(indusface.extractJobCards(currentOpeningsHtml), [
    {
      title: 'Associate Engineer, Managed Security Services',
      location: 'Vadodara',
      summary:
        'As an Associate Engineer, Managed Security Services you will be responsible for the delivery of Security Management and Monitoring services to clients world-wide. The Managed...',
      detailUrl:
        'https://www.indusface.com/careers/current-openings/associate-engineer-managed-security-services/',
      jobSlug: 'associate-engineer-managed-security-services',
    },
    {
      title: 'Application Security Analyst',
      location: 'Mumbai / Vadodara',
      summary:
        'This is a consulting position requiring project-oriented experience and a technical background in security consulting and ethical hacking. You will be required to carry out...',
      detailUrl:
        'https://www.indusface.com/careers/current-openings/information-security-analyst/',
      jobSlug: 'information-security-analyst',
    },
  ])
  assert.equal(
    indusface.hasOfficialDetailPageSignal(applicationSecurityAnalystDetailHtml, {
      title: 'Application Security Analyst',
      detailUrl: 'https://www.indusface.com/careers/current-openings/information-security-analyst/',
    }),
    true,
  )
  assert.deepEqual(
    indusface.extractDetailContext(applicationSecurityAnalystDetailHtml, {
      title: 'Application Security Analyst',
      detailUrl: 'https://www.indusface.com/careers/current-openings/information-security-analyst/',
    }),
    {
      title: 'Application Security Analyst',
      location: 'Mumbai / Vadodara',
      experienceRequired: '2-5 years',
      applyUrl: 'https://www.indusface.com/careers/current-openings/information-security-analyst/',
      jobDescription: [
        'Responsibilities:',
        'This is a consulting position requiring project-oriented experience and a technical background in security consulting and ethical hacking.',
        '',
        'Job Description:',
        'Perform vulnerability assessment and penetration testing of web and mobile applications.',
        'Assist product engineering by identifying and showcasing new exploitation techniques.',
      ].join('\n'),
    },
  )

  assert.deepEqual(
    indusface.mapJobCardToJob(
      {
        title: 'Application Security Analyst',
        location: 'Mumbai / Vadodara',
        summary:
          'This is a consulting position requiring project-oriented experience and a technical background in security consulting and ethical hacking. You will be required to carry out...',
        detailUrl: 'https://www.indusface.com/careers/current-openings/information-security-analyst/',
        jobSlug: 'information-security-analyst',
      },
      {
        title: 'Application Security Analyst',
        location: 'Mumbai / Vadodara',
        experienceRequired: '2-5 years',
        applyUrl: 'https://www.indusface.com/careers/current-openings/information-security-analyst/',
        jobDescription: [
          'Responsibilities:',
          'This is a consulting position requiring project-oriented experience and a technical background in security consulting and ethical hacking.',
          '',
          'Job Description:',
          'Perform vulnerability assessment and penetration testing of web and mobile applications.',
          'Assist product engineering by identifying and showcasing new exploitation techniques.',
        ].join('\n'),
      },
      { scrapedAt: '2026-07-16T09:15:00.000Z' },
    ),
    {
      title: 'Application Security Analyst',
      company: 'Indusface',
      department: null,
      location: 'Mumbai / Vadodara',
      city: null,
      country: 'India',
      sourceUrl: 'https://www.indusface.com/careers/current-openings/information-security-analyst/',
      applyUrl: 'https://www.indusface.com/careers/current-openings/information-security-analyst/',
      jobId: 'indusface-information-security-analyst',
      requisitionId: null,
      employmentType: null,
      workplaceType: null,
      experienceRequired: '2-5 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      compensation: null,
      postingDate: null,
      closingDate: null,
      jobDescription: [
        'Responsibilities:',
        'This is a consulting position requiring project-oriented experience and a technical background in security consulting and ethical hacking.',
        '',
        'Job Description:',
        'Perform vulnerability assessment and penetration testing of web and mobile applications.',
        'Assist product engineering by identifying and showcasing new exploitation techniques.',
      ].join('\n'),
      source: 'indusface',
      companyCareerPage: 'https://www.indusface.com/careers/current-openings/',
      companyDomain: 'indusface.com',
      atsPlatform: 'official-first-party-html-jobs-form',
      link: 'https://www.indusface.com/careers/current-openings/information-security-analyst/',
      scrapedAt: '2026-07-16T09:15:00.000Z',
    },
  )
})

test('Indusface run validates the official current-openings page and first-party detail pages before returning normalized jobs', async () => {
  const indusface = await loadModule()
  const requestedUrls = []

  const jobs = await indusface.createIndusfaceScraper({
    now: () => '2026-07-16T10:30:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === indusface.CAREERS_URL) {
        return currentOpeningsHtml
      }

      if (url === 'https://www.indusface.com/careers/current-openings/associate-engineer-managed-security-services/') {
        return associateEngineerDetailHtml
      }

      if (url === 'https://www.indusface.com/careers/current-openings/information-security-analyst/') {
        return applicationSecurityAnalystDetailHtml
      }

      throw new Error(`Unexpected Indusface URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    indusface.CAREERS_URL,
    'https://www.indusface.com/careers/current-openings/associate-engineer-managed-security-services/',
    'https://www.indusface.com/careers/current-openings/information-security-analyst/',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'Associate Engineer, Managed Security Services')
  assert.equal(jobs[0].location, 'Vadodara')
  assert.equal(jobs[0].city, 'Vadodara')
  assert.equal(jobs[0].applyUrl, jobs[0].sourceUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-16T10:30:00.000Z')
  assert.equal(jobs[1].title, 'Application Security Analyst')
  assert.equal(jobs[1].experienceRequired, '2-5 years')
  assert.match(jobs[1].jobDescription, /Perform vulnerability assessment/i)
})

test('Indusface fails closed when the verified current-openings page or detail-form surface drifts', async () => {
  const indusface = await loadModule()

  await assert.rejects(
    indusface.createIndusfaceScraper().run({
      fetchText: async () => '<html><body><h1>Jobs</h1></body></html>',
    }),
    /verified current-openings page/i,
  )

  await assert.rejects(
    indusface.createIndusfaceScraper().run({
      fetchText: async (url) => {
        if (url === indusface.CAREERS_URL) {
          return currentOpeningsHtml.replace('See Open Position', 'Learn More')
        }

        throw new Error(`Unexpected Indusface URL: ${url}`)
      },
    }),
    /no public job cards/i,
  )

  await assert.rejects(
    indusface.createIndusfaceScraper().run({
      fetchText: async (url) => {
        if (url === indusface.CAREERS_URL) {
          return currentOpeningsHtml
        }

        if (url === 'https://www.indusface.com/careers/current-openings/associate-engineer-managed-security-services/') {
          return associateEngineerDetailHtml
        }

        if (url === 'https://www.indusface.com/careers/current-openings/information-security-analyst/') {
          return applicationSecurityAnalystDetailHtml.replace(
            '/wp-content/themes/indusface/sentmail/',
            '/apply-now/',
          )
        }

        throw new Error(`Unexpected Indusface URL: ${url}`)
      },
    }),
    /verified detail page/i,
  )
})
