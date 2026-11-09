import assert from 'node:assert/strict'
import test from 'node:test'

const loadFivePaisaModule = async () => {
  try {
    return await import('../../scraper/5paisa/script.js')
  } catch {
    return null
  }
}

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | 5paisa</title>
  </head>
  <body>
    <main>
      <h1>Careers At 5paisa</h1>
      <h2>Interested in pursuing career with 5paisa?</h2>
      <p>Explore a selection of newly available job opportunities listed below.</p>
      <ul>
        <li><a href="/careers/job-1">Performance Marketing Manager</a></li>
        <li><a href="/careers/job-2">Digital Revenue Manager</a></li>
        <li><a href="/careers/job-6">Business Intelligence - MIS</a></li>
      </ul>

      <section
        class="views-element-container career-vacncies block block-views block-views-blockcurrent-vacancies-block-1 clearfix"
        id="block-views-block-current-vacancies-block-1">
        <div class="view view-current-vacancies view-id-current_vacancies view-display-id-block_1">
          <div class="view-header">
            <div class="page-title py50">
              <h2> Current vacancies </h2>
              <span> These are the roles we are actively recruiting. If you're interested, please apply through Workable. </span>
            </div>
          </div>

          <div class="views-row">
            <div class="views-field views-field-nothing">
              <span class="field-content">
                <ul>
                  <li><span> Postion </span> Business Intelligence- MIS </li>
                  <li><span> Department </span></li>
                  <li><span> Location </span> Mumbai </li>
                  <li><span> Experience </span> 3 - 5 Years </li>
                  <li><span> Work Type </span> Full Time </li>
                  <li class="last-child">
                    <a href="/careers/job-6" aria-label="View details for Business Intelligence- MIS">
                      <i class="fa fa-angle-right" aria-hidden="true"></i>
                    </a>
                  </li>
                </ul>
              </span>
            </div>
          </div>

          <div class="views-row">
            <div class="views-field views-field-nothing">
              <span class="field-content">
                <ul>
                  <li><span> Postion </span> Digital Revenue Manager </li>
                  <li><span> Department </span> Revenue </li>
                  <li><span> Location </span> Mumbai </li>
                  <li><span> Experience </span> 10 - 15 Years </li>
                  <li><span> Work Type </span> Full Time </li>
                  <li class="last-child">
                    <a href="/careers/job-2" aria-label="View details for Digital Revenue Manager">
                      <i class="fa fa-angle-right" aria-hidden="true"></i>
                    </a>
                  </li>
                </ul>
              </span>
            </div>
          </div>
        </div>
      </section>

      <section class="home-banner intrest-banner">
        <h2>Interested in pursuing career with 5paisa?</h2>
        <form action="/careers" method="post">
          <label>Attach Resume/CV</label>
          <select name="departments_">
            <option value="">Departments</option>
            <option value="24">Marketing</option>
            <option value="332610">Revenue</option>
            <option value="2917">Technology</option>
          </select>
        </form>
      </section>
    </main>
  </body>
</html>
`

const job6DetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Business Intelligence- MIS | 5paisa</title>
  </head>
  <body>
    <main>
      <div class="banner-section-new bg-blue">
        <div class="container">
          <div class="page-title py35 social_links_sec">
            <h1> Business Intelligence- MIS </h1>
          </div>
          <ul class="titles_req_post">
            <li><span>Location : </span> Mumbai</li>
            <li><span>Experience : </span>3 - 5 Years</li>
            <li><span>Work Type : </span>Full Time</li>
          </ul>
        </div>
      </div>

      <div class="home-banner intrest-banner car-details-banner">
        <div class="desc_box mt-3">
          <h3>Job Description</h3>
          <p>We are seeking a skilled MIS professional with experience in Advance Excel, Power BI, MS-SQL, and Zoho Analytics.</p>
        </div>

        <div class="desc_box">
          <h3>Roles &amp; Responsibilities</h3>
          <ul class="reset chapter_parrent_droup">
            <li>Prepare and publish daily dashboards and visual reports using tools such as Excel, Power BI, and Zoho Analytics.</li>
            <li>Collaborate with stakeholders to understand their data requirements and deliver tailored reporting solutions.</li>
          </ul>
        </div>

        <div class="desc_box ">
          <h3>Qualifications:</h3>
          <ul class="reset chapter_parrent_droup">
            <li>Minimum graduation</li>
          </ul>
        </div>

        <div class="desc_box ">
          <h3>Requirement:</h3>
          <ul class="reset chapter_parrent_droup">
            <li>Minimum 3 years of experience working in MIS or a similar role with strong proficiency in Power BI.</li>
            <li>Excellent analytical and problem-solving abilities with a keen attention to detail.</li>
          </ul>
        </div>

        <p>To apply kindly send your CV along with the Cover Letter at <a href="mailto:hrteam@5paisa.com">hrteam@5paisa.com</a></p>

        <div class="banner-form career-form">
          <div class="form-content">
            <form
              class="webform-submission-apply-for-this-job-node-136360-add-form"
              enctype="multipart/form-data"
              action="/careers/job-6"
              method="post"
              accept-charset="UTF-8">
              <h3>Apply for this Job</h3>
              <label for="edit-attach-resume-cv-upload">Attach Resume/CV *</label>
              <input type="file" id="edit-attach-resume-cv-upload" name="files[attach_resume_cv_]" />
            </form>
          </div>
        </div>
      </div>
    </main>
  </body>
</html>
`

const job2DetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Digital Revenue Manager | 5paisa</title>
  </head>
  <body>
    <main>
      <div class="banner-section-new bg-blue">
        <div class="container">
          <div class="page-title py35 social_links_sec">
            <h1> Digital Revenue Manager </h1>
          </div>
          <ul class="titles_req_post">
            <li><span>Department : </span>Revenue</li>
            <li><span>Location : </span> Mumbai</li>
            <li><span>Experience : </span>10 - 15 Years</li>
            <li><span>Work Type : </span>Full Time</li>
          </ul>
        </div>
      </div>

      <div class="home-banner intrest-banner car-details-banner">
        <div class="desc_box mt-3">
          <h3>Job Description</h3>
          <p>As the Lead of Digital Revenue, you will be responsible for driving the growth and profitability of our digital products and services.</p>
        </div>

        <div class="desc_box">
          <h3>Roles &amp; Responsibilities</h3>
          <ul class="reset chapter_parrent_droup">
            <li>Develop and execute a comprehensive digital revenue strategy.</li>
            <li>Lead the development and execution of data-driven digital marketing campaigns.</li>
          </ul>
        </div>

        <div class="desc_box ">
          <h3>Qualification</h3>
          <ul class="reset chapter_parrent_droup">
            <li>Minimum 10-15 years of experience in financial services or a related industry.</li>
            <li>Excellent communication, presentation, and interpersonal skills.</li>
          </ul>
        </div>

        <p>To apply kindly send your CV along with the Cover Letter at <a href="mailto:hrteam@5paisa.com">hrteam@5paisa.com</a></p>

        <div class="banner-form career-form">
          <div class="form-content">
            <form
              class="webform-submission-apply-for-this-job-node-202-add-form"
              enctype="multipart/form-data"
              action="/careers/job-2"
              method="post"
              accept-charset="UTF-8">
              <h3>Apply for this Job</h3>
              <label for="edit-attach-resume-cv-upload">Attach Resume/CV *</label>
              <input type="file" id="edit-attach-resume-cv-upload" name="files[attach_resume_cv_]" />
            </form>
          </div>
        </div>
      </div>
    </main>
  </body>
</html>
`

test('5paisa parses the verified current vacancies block and ignores stale intro links outside the active vacancies surface', async () => {
  const fivePaisa = await loadFivePaisaModule()

  assert.ok(
    fivePaisa,
    'Expected 5paisa scraper module at ../../scraper/5paisa/script.js',
  )

  assert.equal(fivePaisa.hasOfficialCareersSignal(careersHtml), true)

  const listings = fivePaisa.extractCurrentVacancyListings(careersHtml)

  assert.deepEqual(
    listings.map((listing) => ({
      jobId: listing.jobId,
      title: listing.title,
      department: listing.department,
      location: listing.location,
      experienceRequired: listing.experienceRequired,
      employmentType: listing.employmentType,
      sourceUrl: listing.sourceUrl,
    })),
    [
      {
        jobId: 'job-6',
        title: 'Business Intelligence- MIS',
        department: null,
        location: 'Mumbai, Maharashtra, India',
        experienceRequired: '3 - 5 Years',
        employmentType: 'Full Time',
        sourceUrl: 'https://www.5paisa.com/careers/job-6',
      },
      {
        jobId: 'job-2',
        title: 'Digital Revenue Manager',
        department: 'Revenue',
        location: 'Mumbai, Maharashtra, India',
        experienceRequired: '10 - 15 Years',
        employmentType: 'Full Time',
        sourceUrl: 'https://www.5paisa.com/careers/job-2',
      },
    ],
  )
})

test('5paisa extracts first-party job detail pages into normalized India job records', async () => {
  const fivePaisa = await loadFivePaisaModule()
  assert.ok(fivePaisa)

  const listings = fivePaisa.extractCurrentVacancyListings(careersHtml)

  assert.equal(
    fivePaisa.hasOfficialJobDetailSignal(job6DetailHtml, listings[0]),
    true,
  )
  assert.equal(
    fivePaisa.hasOfficialJobDetailSignal(job2DetailHtml, listings[1]),
    true,
  )

  const job6 = fivePaisa.extractJobDetail(job6DetailHtml, listings[0])
  const job2 = fivePaisa.extractJobDetail(job2DetailHtml, listings[1])

  assert.deepEqual(job6, {
    jobId: 'job-6',
    requisitionId: 'job-6',
    title: 'Business Intelligence- MIS',
    company: '5paisa',
    department: null,
    location: 'Mumbai, Maharashtra, India',
    city: 'Mumbai',
    country: 'India',
    sourceUrl: 'https://www.5paisa.com/careers/job-6',
    applyUrl: 'https://www.5paisa.com/careers/job-6',
    employmentType: 'Full Time',
    experienceRequired: '3 - 5 Years',
    minimumQualification: 'Minimum graduation',
    preferredQualification: null,
    requiredSkills: [
      'Minimum 3 years of experience working in MIS or a similar role with strong proficiency in Power BI.',
      'Excellent analytical and problem-solving abilities with a keen attention to detail.',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription: [
      'Job Description',
      'We are seeking a skilled MIS professional with experience in Advance Excel, Power BI, MS-SQL, and Zoho Analytics.',
      '',
      'Roles & Responsibilities',
      '- Prepare and publish daily dashboards and visual reports using tools such as Excel, Power BI, and Zoho Analytics.',
      '- Collaborate with stakeholders to understand their data requirements and deliver tailored reporting solutions.',
      '',
      'Requirement',
      '- Minimum 3 years of experience working in MIS or a similar role with strong proficiency in Power BI.',
      '- Excellent analytical and problem-solving abilities with a keen attention to detail.',
      '',
      'Apply via the first-party 5paisa job page or email hrteam@5paisa.com.',
    ].join('\n'),
  })

  assert.equal(job2.department, 'Revenue')
  assert.equal(job2.minimumQualification, null)
  assert.deepEqual(job2.requiredSkills, [
    'Minimum 10-15 years of experience in financial services or a related industry.',
    'Excellent communication, presentation, and interpersonal skills.',
  ])
  assert.match(job2.jobDescription, /digital revenue strategy/i)
})

test('5paisa run validates the verified first-party careers surface and returns only the active India vacancies', async () => {
  const fivePaisa = await loadFivePaisaModule()
  assert.ok(fivePaisa)

  const requestedUrls = []
  const jobs = await fivePaisa.createFivePaisaScraper({
    now: () => '2026-07-14T00:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === fivePaisa.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (url === 'https://www.5paisa.com/careers/job-6') {
        return { status: 200, url, html: job6DetailHtml }
      }

      if (url === 'https://www.5paisa.com/careers/job-2') {
        return { status: 200, url, html: job2DetailHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    fivePaisa.CAREERS_URL,
    'https://www.5paisa.com/careers/job-6',
    'https://www.5paisa.com/careers/job-2',
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => [job.title, job.source, job.link, job.scrapedAt]),
    [
      [
        'Business Intelligence- MIS',
        '5paisa',
        'https://www.5paisa.com/careers/job-6',
        '2026-07-14T00:00:00.000Z',
      ],
      [
        'Digital Revenue Manager',
        '5paisa',
        'https://www.5paisa.com/careers/job-2',
        '2026-07-14T00:00:00.000Z',
      ],
    ],
  )
})

test('5paisa fails closed when the verified careers page or job detail application surface drifts', async () => {
  const fivePaisa = await loadFivePaisaModule()
  assert.ok(fivePaisa)

  await assert.rejects(
    fivePaisa.createFivePaisaScraper().run({
      fetchPage: async (url) => {
        if (url === fivePaisa.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Careers</h1><p>No current vacancies.</p></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    fivePaisa.createFivePaisaScraper().run({
      fetchPage: async (url) => {
        if (url === fivePaisa.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === 'https://www.5paisa.com/careers/job-6') {
          return {
            status: 200,
            url,
            html: job6DetailHtml.replace('Attach Resume/CV *', 'Resume upload removed'),
          }
        }

        if (url === 'https://www.5paisa.com/careers/job-2') {
          return { status: 200, url, html: job2DetailHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified first-party job detail/i,
  )
})
