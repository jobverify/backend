import assert from 'node:assert/strict'
import test from 'node:test'

const loadTataClassEdgeModule = async () => {
  try {
    return await import('../../scraper/tataclassedge/script.js')
  } catch {
    assert.fail('Expected Tata ClassEdge scraper module at ../../scraper/tataclassedge/script.js')
  }
}

const openingsPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Open Positions - TataClassEdge</title>
  </head>
  <body>
    <main>
      <h1>Open Positions</h1>

      <div data-elementor-type="loop-item" class="job type-job">
        <section>
          <div class="elementor-widget elementor-widget-theme-post-title">
            <div class="elementor-widget-container">
              <h5 class="elementor-heading-title elementor-size-default">Senior Sales Specialist</h5>
            </div>
          </div>
          <div class="elementor-widget location elementor-widget-icon-box">
            <div class="elementor-widget-container">
              <div class="elementor-icon-box-content">
                <h5 class="elementor-icon-box-title">
                  <span>Navi Mumbai</span>
                </h5>
              </div>
            </div>
          </div>
          <div class="elementor-widget elementor-widget-button">
            <div class="elementor-button-wrapper">
              <a class="elementor-button elementor-button-link elementor-size-sm" href="https://www.tataclassedge.com/job/senior-sales-specialist/">
                <span class="elementor-button-text">Apply</span>
              </a>
            </div>
          </div>
        </section>
      </div>

      <div data-elementor-type="loop-item" class="job type-job">
        <section>
          <div class="elementor-widget elementor-widget-theme-post-title">
            <div class="elementor-widget-container">
              <h5 class="elementor-heading-title elementor-size-default">Full Stack Developer</h5>
            </div>
          </div>
          <div class="elementor-widget location elementor-widget-icon-box">
            <div class="elementor-widget-container">
              <div class="elementor-icon-box-content">
                <h5 class="elementor-icon-box-title">
                  <span>Mumbai</span>
                </h5>
              </div>
            </div>
          </div>
          <div class="elementor-widget elementor-widget-button">
            <div class="elementor-button-wrapper">
              <a class="elementor-button elementor-button-link elementor-size-sm" href="https://www.tataclassedge.com/job/full-stack-developer/">
                <span class="elementor-button-text">Apply</span>
              </a>
            </div>
          </div>
        </section>
      </div>

      <div data-elementor-type="loop-item" class="job type-job">
        <section>
          <div class="elementor-widget elementor-widget-theme-post-title">
            <div class="elementor-widget-container">
              <h5 class="elementor-heading-title elementor-size-default">Sales</h5>
            </div>
          </div>
          <div class="elementor-widget location elementor-widget-icon-box">
            <div class="elementor-widget-container">
              <div class="elementor-icon-box-content">
                <h5 class="elementor-icon-box-title">
                  <span>Mumbai, Hyderabad, Bangalore, Delhi, Kolkata, North East</span>
                </h5>
              </div>
            </div>
          </div>
          <div class="elementor-widget elementor-widget-button">
            <div class="elementor-button-wrapper">
              <a class="elementor-button elementor-button-link elementor-size-sm" href="https://www.tataclassedge.com/job/sales/">
                <span class="elementor-button-text">Apply</span>
              </a>
            </div>
          </div>
        </section>
      </div>
    </main>
  </body>
</html>
`

const fullStackDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Full Stack Developer - TataClassEdge</title>
  </head>
  <body>
    <main>
      <a href="/careers/">Back to Careers</a>
      <h1>Full Stack Developer</h1>
      <h3>Location :</h3>
      <p>Mumbai</p>
      <h3>Responsibilities :</h3>
      <ul>
        <li>Assist in designing, implementing, and maintaining data pipelines and ETL processes using tools like Clickhouse, Superset, and Airflow.</li>
        <li>Collaborate with cross-functional teams to implement solutions aligned with business goals and participate in the new Clickhouse analytics project.</li>
        <li>Utilize Python and FastAPI to develop and maintain Full Stack web applications.</li>
        <li>Gain exposure to AWS technologies, including Glue Studio and S3, to optimize data storage, processing, and analytics capabilities.</li>
        <li>Assist in implementing real-time analytics for user-facing applications, business analytics, and data for machine learning.</li>
        <li>Learn and apply Golang for specific development needs and optimizations.</li>
        <li>Support containerization efforts using Docker for efficient deployment and application management.</li>
        <li>Participate in the implementation of continuous integration and deployment processes using GitHub Actions.</li>
      </ul>
      <h3>Qualification and Experience required:</h3>
      <ul>
        <li>Bachelor's or Master's degree in Computer Science, Software Engineering, or a related field.</li>
        <li>4-5 years of experience in data engineering, with exposure to tools like Clickhouse, Superset, and Airflow.</li>
        <li>Proficiency in Python, with experience in FastAPI.</li>
        <li>Familiarity with AWS services, particularly Glue Studio and S3.</li>
        <li>Basic understanding of Full Stack web app development using Node.js and Angular.</li>
        <li>Exposure to Golang development is a plus.</li>
        <li>Familiarity with Docker and containerization.</li>
        <li>Eagerness to learn and adapt to new technologies.</li>
        <li>Strong problem-solving skills and the ability to collaborate in a fast-paced environment.</li>
        <li>Excellent communication and interpersonal skills.</li>
      </ul>
      <h4>Apply for this Job:</h4>
      <form class="elementor-form">
        <input type="text" name="first_name" />
      </form>
    </main>
  </body>
</html>
`

const salesDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Sales - TataClassEdge</title>
  </head>
  <body>
    <main>
      <a href="/careers/">Back to Careers</a>
      <h1>Sales</h1>
      <h3>Location :</h3>
      <p>Mumbai, Hyderabad, Bangalore, Delhi, Kolkata, North East</p>
      <h3>Responsibilities :</h3>
      <ul>
        <li>Drive school partnerships across assigned territories.</li>
        <li>Coordinate with internal stakeholders to close regional opportunities.</li>
      </ul>
      <h3>Qualification and Experience required:</h3>
      <ul>
        <li>Graduate degree in any discipline.</li>
        <li>5+ years of B2B field-sales experience in education or enterprise solutions.</li>
      </ul>
      <h4>Apply for this Job:</h4>
      <form class="elementor-form">
        <input type="text" name="first_name" />
      </form>
    </main>
  </body>
</html>
`

test('Tata ClassEdge validates the verified official openings page and extracts first-party role cards', async () => {
  const tataClassEdge = await loadTataClassEdgeModule()

  assert.equal(tataClassEdge.SOURCE, 'tataclassedge')
  assert.equal(tataClassEdge.COMPANY, 'Tata ClassEdge')
  assert.equal(tataClassEdge.CAREERS_URL, 'https://www.tataclassedge.com/careers/')
  assert.equal(tataClassEdge.OPEN_POSITIONS_URL, 'https://www.tataclassedge.com/open-positions/')
  assert.equal(tataClassEdge.hasOfficialOpenPositionsSignal(openingsPageHtml), true)

  assert.deepEqual(tataClassEdge.extractOpenings(openingsPageHtml), [
    {
      title: 'Senior Sales Specialist',
      location: 'Navi Mumbai, India',
      city: 'Mumbai',
      sourceUrl: 'https://www.tataclassedge.com/job/senior-sales-specialist/',
      applyUrl: 'https://www.tataclassedge.com/job/senior-sales-specialist/',
      jobId: 'senior-sales-specialist',
      requisitionId: 'senior-sales-specialist',
    },
    {
      title: 'Full Stack Developer',
      location: 'Mumbai, India',
      city: 'Mumbai',
      sourceUrl: 'https://www.tataclassedge.com/job/full-stack-developer/',
      applyUrl: 'https://www.tataclassedge.com/job/full-stack-developer/',
      jobId: 'full-stack-developer',
      requisitionId: 'full-stack-developer',
    },
    {
      title: 'Sales',
      location: 'Mumbai, Hyderabad, Bangalore, Delhi, Kolkata, North East, India',
      city: 'Mumbai',
      sourceUrl: 'https://www.tataclassedge.com/job/sales/',
      applyUrl: 'https://www.tataclassedge.com/job/sales/',
      jobId: 'sales',
      requisitionId: 'sales',
    },
  ])
})

test('Tata ClassEdge extracts location, responsibilities, and qualifications from an official job detail page', async () => {
  const tataClassEdge = await loadTataClassEdgeModule()
  const sourceUrl = 'https://www.tataclassedge.com/job/full-stack-developer/'

  assert.deepEqual(tataClassEdge.extractJobDetail(fullStackDetailHtml, {
    title: 'Full Stack Developer',
    location: 'Mumbai, India',
    city: 'Mumbai',
    sourceUrl,
    applyUrl: sourceUrl,
    jobId: 'full-stack-developer',
    requisitionId: 'full-stack-developer',
  }), {
    title: 'Full Stack Developer',
    location: 'Mumbai, India',
    city: 'Mumbai',
    country: 'India',
    jobId: 'full-stack-developer',
    requisitionId: 'full-stack-developer',
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: null,
    experienceRequired: '4-5 years of experience in data engineering, with exposure to tools like Clickhouse, Superset, and Airflow.',
    department: null,
    minimumQualification: "Bachelor's or Master's degree in Computer Science, Software Engineering, or a related field.",
    preferredQualification: null,
    requiredSkills: [
      'Assist in designing, implementing, and maintaining data pipelines and ETL processes using tools like Clickhouse, Superset, and Airflow.',
      'Collaborate with cross-functional teams to implement solutions aligned with business goals and participate in the new Clickhouse analytics project.',
      'Utilize Python and FastAPI to develop and maintain Full Stack web applications.',
      'Gain exposure to AWS technologies, including Glue Studio and S3, to optimize data storage, processing, and analytics capabilities.',
      'Assist in implementing real-time analytics for user-facing applications, business analytics, and data for machine learning.',
      'Learn and apply Golang for specific development needs and optimizations.',
      'Support containerization efforts using Docker for efficient deployment and application management.',
      'Participate in the implementation of continuous integration and deployment processes using GitHub Actions.',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription: "Responsibilities: Assist in designing, implementing, and maintaining data pipelines and ETL processes using tools like Clickhouse, Superset, and Airflow. Collaborate with cross-functional teams to implement solutions aligned with business goals and participate in the new Clickhouse analytics project. Utilize Python and FastAPI to develop and maintain Full Stack web applications. Gain exposure to AWS technologies, including Glue Studio and S3, to optimize data storage, processing, and analytics capabilities. Assist in implementing real-time analytics for user-facing applications, business analytics, and data for machine learning. Learn and apply Golang for specific development needs and optimizations. Support containerization efforts using Docker for efficient deployment and application management. Participate in the implementation of continuous integration and deployment processes using GitHub Actions. Qualification and Experience required: Bachelor's or Master's degree in Computer Science, Software Engineering, or a related field. 4-5 years of experience in data engineering, with exposure to tools like Clickhouse, Superset, and Airflow. Proficiency in Python, with experience in FastAPI. Familiarity with AWS services, particularly Glue Studio and S3. Basic understanding of Full Stack web app development using Node.js and Angular. Exposure to Golang development is a plus. Familiarity with Docker and containerization. Eagerness to learn and adapt to new technologies. Strong problem-solving skills and the ability to collaborate in a fast-paced environment. Excellent communication and interpersonal skills.",
  })
})

test('Tata ClassEdge run fetches the official openings page, follows same-domain detail pages, and decorates final jobs', async () => {
  const tataClassEdge = await loadTataClassEdgeModule()
  const requestedUrls = []

  const jobs = await tataClassEdge.createTataClassEdgeScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === tataClassEdge.OPEN_POSITIONS_URL) return openingsPageHtml
      if (url === 'https://www.tataclassedge.com/job/senior-sales-specialist/') {
        return salesDetailHtml.replace(/Sales/g, 'Senior Sales Specialist')
      }
      if (url === 'https://www.tataclassedge.com/job/full-stack-developer/') return fullStackDetailHtml
      if (url === 'https://www.tataclassedge.com/job/sales/') return salesDetailHtml

      throw new Error(`Unexpected Tata ClassEdge URL: ${url}`)
    },
    now: () => '2026-07-10T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    tataClassEdge.OPEN_POSITIONS_URL,
    'https://www.tataclassedge.com/job/senior-sales-specialist/',
    'https://www.tataclassedge.com/job/full-stack-developer/',
    'https://www.tataclassedge.com/job/sales/',
  ])
  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs[0], {
    jobId: 'senior-sales-specialist',
    requisitionId: 'senior-sales-specialist',
    title: 'Senior Sales Specialist',
    company: 'Tata ClassEdge',
    department: null,
    location: 'Mumbai, Hyderabad, Bangalore, Delhi, Kolkata, North East, India',
    city: 'Mumbai',
    country: 'India',
    link: 'https://www.tataclassedge.com/job/senior-sales-specialist/',
    applyUrl: 'https://www.tataclassedge.com/job/senior-sales-specialist/',
    sourceUrl: 'https://www.tataclassedge.com/job/senior-sales-specialist/',
    source: 'tataclassedge',
    employmentType: null,
    experienceRequired: '5+ years of B2B field-sales experience in education or enterprise solutions.',
    jobDescription: 'Responsibilities: Drive school partnerships across assigned territories. Coordinate with internal stakeholders to close regional opportunities. Qualification and Experience required: Graduate degree in any discipline. 5+ years of B2B field-sales experience in education or enterprise solutions.',
    minimumQualification: 'Graduate degree in any discipline.',
    preferredQualification: null,
    requiredSkills: [
      'Drive school partnerships across assigned territories.',
      'Coordinate with internal stakeholders to close regional opportunities.',
    ],
    postingDate: null,
    closingDate: null,
    scrapedAt: '2026-07-10T00:00:00.000Z',
  })
  assert.equal(jobs[1].company, 'Tata ClassEdge')
  assert.equal(jobs[1].source, 'tataclassedge')
  assert.equal(jobs[1].scrapedAt, '2026-07-10T00:00:00.000Z')
})

test('Tata ClassEdge fails closed when the verified official openings page signal disappears', async () => {
  const tataClassEdge = await loadTataClassEdgeModule()

  await assert.rejects(
    tataClassEdge.createTataClassEdgeScraper().run({
      fetchText: async () => '<html><body><h1>Jobs</h1></body></html>',
    }),
    /verified Tata ClassEdge open positions surface/i,
  )
})
