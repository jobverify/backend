import assert from 'node:assert/strict'
import test from 'node:test'

const loadOgmenRoboticsModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Ogmen Robotics scraper module at ./script.js')
  }
}

const homepageHtml = `
  <html>
    <head>
      <title>Ogmen Robotics</title>
      <link rel="canonical" href="https://www.ogmenrobotics.com/" />
    </head>
    <body>
      <nav>
        <a class="nav-link" href="/careers">Careers</a>
      </nav>
      <p>At Ogmen, we are building the next-generation family robots to serve with the care we all seek!</p>
      <a href="/careers">Join Us</a>
      <p>contact@ogmenrobotics.com</p>
      <p>Copyright&copy; 2026 Ogmen Robotics Inc. All rights reserved.</p>
    </body>
  </html>
`

const careersHtml = `
  <html>
    <head>
      <title>Careers | Ogmen Robotics</title>
    </head>
    <body>
      <h1>Let's build together</h1>
      <a class="btn btn-primary btn-lg button-sky-blue arrow-btn" href="#joblistings">Jump to Open Roles</a>
      <section class="job-listing pt-0" id="joblistings">
        <h1>Our Open<span>Roles</span></h1>
        <p>We are a distributed, diverse team scattered across India and America.</p>
        <div class="job-business">
          <h5>Business Development</h5>
          <div class="job-title-container" onclick="loadJob('engineering', 'Marketing_Manager')">
            <span class="role">Marketing Manager</span>
            <span>
              <span class="location">Delhi</span>
              <span class="duration">Full Time</span>
            </span>
          </div>
          <div class="job-title-container" onclick="loadJob('engineering', 'Regional_Sales_Lead')">
            <span class="role">Regional Sales Lead</span>
            <span>
              <span class="location">USA</span>
              <span class="duration">Full Time</span>
            </span>
          </div>
        </div>
        <div class="job-business">
          <h5>Engineering</h5>
          <div class="job-title-container" onclick="loadJob('engineering', 'Robotics_Engineer')">
            <span class="role">Robotics Engineer</span>
            <span>
              <span class="location">Delhi</span>
              <span class="duration">Full Time</span>
            </span>
          </div>
        </div>
      </section>
      <script>
        function loadJob(category, opening) {
          location.replace("/job?category=" + category + "&opening=" + opening)
        }
      </script>
      <p>contact@ogmenrobotics.com</p>
    </body>
  </html>
`

const detailPageHtml = `
  <html>
    <head>
      <title>Jobs | Ogmen Robotics</title>
    </head>
    <body>
      <a href="/careers#joblistings">Back to careers</a>
      <div id="jobPosition"></div>
      <div id="jobDescription"></div>
      <form id="job-application-form" method="post" enctype="multipart/form-data" action="/ogmen-job-apply">
        <input type="hidden" name="jobCategory" id="job-application-form-job-category" />
        <input type="hidden" name="jobOpening" id="job-application-form-job-opening" />
        <label for="formFile" class="form-label">Resume/CV*</label>
        <input class="form-control" type="file" id="formFile" name="resume_file" required />
      </form>
      <script>
        fetch('https://s3.amazonaws.com/cdn.s3.webcontentor.com/OFFICE/OGMEN01/site_design/data/currentOpening.json')
      </script>
    </body>
  </html>
`

const currentOpenings = [
  {
    id: 'engineering',
    category: 'Engineering',
    positions: [
      {
        id: 'Marketing_Manager',
        position: 'Marketing Manager',
        basedOn: 'Full-time',
        onPreference: 'On-site',
        location: 'New Delhi',
        work: [
          'Must have: Demonstrable experience in marketing',
          'Must have: Experience in setting up Google AdWords campaigns',
        ],
        lookingFor: [
          'Develop strategies and tactics to get the word out about our company',
          'Deploy successful marketing campaigns and own their implementation from ideation to execution',
        ],
      },
      {
        id: 'Regional_Sales_Lead',
        position: 'Regional Sales Lead',
        basedOn: 'Full-time',
        onPreference: 'On-site',
        location: 'USA',
        work: [
          'Must have: Proven work experience as a Regional Sales Manager',
        ],
        lookingFor: [
          'Create regional sales plans and quotas in alignment with business objectives',
        ],
      },
      {
        id: 'Robotics_Engineer',
        position: 'Robotics Engineer',
        basedOn: 'Full-time',
        onPreference: 'On-site',
        location: 'New Delhi',
        work: [
          'Must have: 2+ years of experience in Python/C++',
          'Must have: Projects on ROS',
        ],
        lookingFor: [
          'Design robotic systems from start to finish',
          'Develop and implement software that will control robots',
        ],
      },
    ],
  },
]

test('run validates the verified Ogmen homepage, careers page, current openings feed, and detail apply surface and returns India jobs', async () => {
  const ogmenRobotics = await loadOgmenRoboticsModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []

  assert.equal(ogmenRobotics.HOMEPAGE_URL, 'https://www.ogmenrobotics.com/')
  assert.equal(ogmenRobotics.CAREERS_URL, 'https://www.ogmenrobotics.com/careers')
  assert.equal(
    ogmenRobotics.CURRENT_OPENINGS_URL,
    'https://s3.amazonaws.com/cdn.s3.webcontentor.com/OFFICE/OGMEN01/site_design/data/currentOpening.json',
  )

  const jobs = await ogmenRobotics.createOgmenRoboticsScraper({
    now: () => '2026-07-11T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)

      if (url === ogmenRobotics.HOMEPAGE_URL) return homepageHtml
      if (url === ogmenRobotics.CAREERS_URL) return careersHtml
      if (url === `${ogmenRobotics.DETAIL_BASE_URL}?category=engineering&opening=Marketing_Manager`) {
        return detailPageHtml
      }

      assert.fail(`Unexpected text URL requested: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      assert.equal(url, ogmenRobotics.CURRENT_OPENINGS_URL)
      return currentOpenings
    },
  })

  assert.deepEqual(requestedTextUrls, [
    ogmenRobotics.HOMEPAGE_URL,
    ogmenRobotics.CAREERS_URL,
    `${ogmenRobotics.DETAIL_BASE_URL}?category=engineering&opening=Marketing_Manager`,
  ])
  assert.deepEqual(requestedJsonUrls, [ogmenRobotics.CURRENT_OPENINGS_URL])

  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      department: job.department,
      location: job.location,
      city: job.city,
      country: job.country,
      employmentType: job.employmentType,
      remoteStatus: job.remoteStatus,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      jobId: job.jobId,
      requisitionId: job.requisitionId,
      source: job.source,
      company: job.company,
      companyCareerPage: job.companyCareerPage,
      companyDomain: job.companyDomain,
      atsPlatform: job.atsPlatform,
      scrapedAt: job.scrapedAt,
      requiredSkills: job.requiredSkills,
    })),
    [
      {
        title: 'Marketing Manager',
        department: 'Business Development',
        location: 'New Delhi, India',
        city: 'New Delhi',
        country: 'India',
        employmentType: 'Full Time',
        remoteStatus: 'On-site',
        sourceUrl: 'https://www.ogmenrobotics.com/job?category=engineering&opening=Marketing_Manager',
        applyUrl: 'https://www.ogmenrobotics.com/job?category=engineering&opening=Marketing_Manager',
        jobId: 'ogmenrobotics-marketing-manager',
        requisitionId: 'Marketing_Manager',
        source: 'ogmenrobotics',
        company: 'Ogmen Robotics',
        companyCareerPage: 'https://www.ogmenrobotics.com/careers',
        companyDomain: 'ogmenrobotics.com',
        atsPlatform: 'official-company-careers',
        scrapedAt: '2026-07-11T00:00:00.000Z',
        requiredSkills: [
          'Must have: Demonstrable experience in marketing',
          'Must have: Experience in setting up Google AdWords campaigns',
        ],
      },
      {
        title: 'Robotics Engineer',
        department: 'Engineering',
        location: 'New Delhi, India',
        city: 'New Delhi',
        country: 'India',
        employmentType: 'Full Time',
        remoteStatus: 'On-site',
        sourceUrl: 'https://www.ogmenrobotics.com/job?category=engineering&opening=Robotics_Engineer',
        applyUrl: 'https://www.ogmenrobotics.com/job?category=engineering&opening=Robotics_Engineer',
        jobId: 'ogmenrobotics-robotics-engineer',
        requisitionId: 'Robotics_Engineer',
        source: 'ogmenrobotics',
        company: 'Ogmen Robotics',
        companyCareerPage: 'https://www.ogmenrobotics.com/careers',
        companyDomain: 'ogmenrobotics.com',
        atsPlatform: 'official-company-careers',
        scrapedAt: '2026-07-11T00:00:00.000Z',
        requiredSkills: [
          'Must have: 2+ years of experience in Python/C++',
          'Must have: Projects on ROS',
        ],
      },
    ],
  )

  assert.match(jobs[0].jobDescription, /Technicals:/i)
  assert.match(jobs[0].jobDescription, /What you'll be doing:/i)
  assert.equal(jobs[0].link, jobs[0].applyUrl)
})

test('run fails closed when a listed Ogmen India role no longer matches the verified current openings feed', async () => {
  const ogmenRobotics = await loadOgmenRoboticsModule()

  await assert.rejects(
    ogmenRobotics.createOgmenRoboticsScraper().run({
      fetchText: async (url) => {
        if (url === ogmenRobotics.HOMEPAGE_URL) return homepageHtml
        if (url === ogmenRobotics.CAREERS_URL) return careersHtml
        if (url === `${ogmenRobotics.DETAIL_BASE_URL}?category=engineering&opening=Marketing_Manager`) {
          return detailPageHtml
        }

        assert.fail(`Unexpected text URL requested: ${url}`)
      },
      fetchJson: async () => [
        {
          id: 'engineering',
          category: 'Engineering',
          positions: [
            {
              id: 'Marketing_Manager',
              position: 'Growth Marketing Lead',
              basedOn: 'Full-time',
              onPreference: 'On-site',
              location: 'New Delhi',
              work: ['Must have: Marketing'],
              lookingFor: ['Lead campaigns'],
            },
          ],
        },
      ],
    }),
    /Marketing Manager/i,
  )
})
