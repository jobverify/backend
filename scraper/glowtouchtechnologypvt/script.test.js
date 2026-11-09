import assert from 'node:assert/strict'
import test from 'node:test'

const loadGlowtouchTechnologyPvtModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Glowtouch Technology Pvt scraper module at ./script.js')
  }
}

const careersHtml = `
  <html lang="en-US">
    <head>
      <title>Careers | GlowTouch LLC</title>
      <meta name="description" content="GlowTouch careers in India">
    </head>
    <body>
      <h2>India Opportunities</h2>
      <h2>Join our dynamic, fast growing team working to help our clients succeed!</h2>
      <div class="elementor-posts-container">
        <article class="elementor-post category-careers category-jobs-india">
          <h3 class="elementor-post__title">
            <a href="https://www.glowtouch.com/project-manager/">Project Manager</a>
          </h3>
        </article>
        <article class="elementor-post category-careers category-jobs-india">
          <h3 class="elementor-post__title">
            <a href="https://www.glowtouch.com/web-application-backend-engineer-node-js/">Web Application Backend Engineer – Node.js</a>
          </h3>
        </article>
        <article class="elementor-post category-careers category-jobs-india">
          <h3 class="elementor-post__title">
            <a href="https://example.com/not-first-party/">Ignore me</a>
          </h3>
        </article>
      </div>
      <iframe
        id="Iframe"
        src="https://career.hrone.cloud/career-portal?appId=-MCufjenSxucsDip3JZT8yfBaRzDkuydSiZ7ueEeT_H5rgCyn7I1wAC4n5xWSlcW4AqEMge98WiCpsqZl5C8LRinNJ-kV0RgXPygFDU-q6S5haOv9Q7Di_Iv1Vw69_Id&dc=diya&rqt=UVozgs-AUV1ILPLBxDlf7A&cc=bWoPI4_sQHvvQj_N7rAQMQ"
      ></iframe>
      <p>
        Interested in joining our team but don’t see an open position that is perfect for you?
        Please <a href="mailto:talenthire.india@glowtouch.com">send us your resume</a>.
      </p>
    </body>
  </html>
`

const projectManagerHtml = `
  <html lang="en-US">
    <head>
      <title>Project Manager - GlowTouch LLC</title>
      <meta property="article:published_time" content="2023-04-19T07:36:00+00:00" />
    </head>
    <body>
      <h2>Project Manager</h2>
      <h2>About Company:</h2>
      <p>
        <a href="https://www.glowtouch.com/">GlowTouch Technologies</a>, (www.glowtouch.com) is
        delivering Customer Experience Management Solutions from Mangalore, Bangalore, Mysore in India.
      </p>
      <h2>Summary of Position:</h2>
      <p>
        This position is a multi-faceted key position. Based out of India, you will coordinate and
        lead the execution of this project from idea to production.
      </p>
      <h2>Skills and Responsibilities:</h2>
      <ul class="elementor-icon-list-items">
        <li class="elementor-icon-list-item">
          <span class="elementor-icon-list-text">6+ years of project management experience</span>
        </li>
        <li class="elementor-icon-list-item">
          <span class="elementor-icon-list-text">Experience building project plans using Agile or Waterfall methodologies</span>
        </li>
      </ul>
      <h2>Attributes</h2>
      <ul class="elementor-icon-list-items">
        <li class="elementor-icon-list-item">
          <span class="elementor-icon-list-text">Self-motivated leader with a desire to make things happen</span>
        </li>
      </ul>
      <a href="mailto:talenthire.india@glowtouch.com" target="_blank">APPLY NOW</a>
    </body>
  </html>
`

const technicalSupportNonvoiceHtml = `
  <html lang="en-US">
    <head>
      <title>Technical Support Nonvoice - GlowTouch LLC</title>
      <meta property="article:published_time" content="2023-02-20T06:15:51+00:00" />
    </head>
    <body>
      <h2>Technical Support - Chat process</h2>
      <h2>About Company:</h2>
      <p>
        GlowTouch Technologies is an award-winning technology services firm headquartered in
        Mangalore, India.
      </p>
      <h2>Our Vision</h2>
      <p>
        Deliver exceptional support experiences for global customers from our India operations.
      </p>
      <h2>What you will do</h2>
      <ul class="elementor-icon-list-items">
        <li class="elementor-icon-list-item">
          <span class="elementor-icon-list-text">Provide chat-based technical support to customers</span>
        </li>
      </ul>
      <h2>What is your learning</h2>
      <ul class="elementor-icon-list-items">
        <li class="elementor-icon-list-item">
          <span class="elementor-icon-list-text">Learn customer support workflows and tooling</span>
        </li>
      </ul>
      <h2>Eligibility Criteria: ( what you need to have )</h2>
      <ul class="elementor-icon-list-items">
        <li class="elementor-icon-list-item">
          <span class="elementor-icon-list-text">Flexible to work rotational shifts</span>
        </li>
      </ul>
      <h2>Education and other attributes</h2>
      <ul class="elementor-icon-list-items">
        <li class="elementor-icon-list-item">
          <span class="elementor-icon-list-text">Excellent written communication</span>
        </li>
      </ul>
      <a href="mailto:talenthire.india@glowtouch.com" target="_blank">APPLY NOW</a>
    </body>
  </html>
`

test('Glowtouch Technology Pvt pins the verified first-party careers page and India role links', async () => {
  const glowtouch = await loadGlowtouchTechnologyPvtModule()

  assert.equal(glowtouch.CAREERS_URL, 'https://www.glowtouch.com/careers/')
  assert.equal(glowtouch.SOURCE, 'glowtouchtechnologypvt')
  assert.equal(glowtouch.COMPANY_NAME, 'Glowtouch Technology Pvt')
  assert.equal(glowtouch.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(
    glowtouch.extractEmbeddedHrOneUrl(careersHtml),
    'https://career.hrone.cloud/career-portal?appId=-MCufjenSxucsDip3JZT8yfBaRzDkuydSiZ7ueEeT_H5rgCyn7I1wAC4n5xWSlcW4AqEMge98WiCpsqZl5C8LRinNJ-kV0RgXPygFDU-q6S5haOv9Q7Di_Iv1Vw69_Id&dc=diya&rqt=UVozgs-AUV1ILPLBxDlf7A&cc=bWoPI4_sQHvvQj_N7rAQMQ',
  )
  assert.equal(
    glowtouch.isTrustedEmbeddedHrOneUrl(
      'https://career.hrone.cloud/career-portal?appId=-MCufjenSxucsDip3JZT8yfBaRzDkuydSiZ7ueEeT_H5rgCyn7I1wAC4n5xWSlcW4AqEMge98WiCpsqZl5C8LRinNJ-kV0RgXPygFDU-q6S5haOv9Q7Di_Iv1Vw69_Id&dc=diya&rqt=UVozgs-AUV1ILPLBxDlf7A&cc=bWoPI4_sQHvvQj_N7rAQMQ',
    ),
    true,
  )
  assert.equal(glowtouch.isTrustedEmbeddedHrOneUrl('https://example.com/jobs'), false)
  assert.deepEqual(glowtouch.extractIndiaRoleLinks(careersHtml), [
    {
      title: 'Project Manager',
      url: 'https://www.glowtouch.com/project-manager/',
    },
    {
      title: 'Web Application Backend Engineer – Node.js',
      url: 'https://www.glowtouch.com/web-application-backend-engineer-node-js/',
    },
  ])
})

test('extractJobDetail normalizes a first-party GlowTouch role detail page', async () => {
  const glowtouch = await loadGlowtouchTechnologyPvtModule()

  assert.deepEqual(
    glowtouch.extractJobDetail({
      detailUrl: 'https://www.glowtouch.com/project-manager/',
      html: projectManagerHtml,
    }),
    {
      title: 'Project Manager',
      company: 'Glowtouch Technology Pvt',
      department: null,
      location: 'India',
      city: null,
      country: 'India',
      jobId: 'glowtouchtechnologypvt-project-manager',
      requisitionId: 'glowtouchtechnologypvt-project-manager',
      sourceUrl: 'https://www.glowtouch.com/project-manager/',
      applyUrl: 'mailto:talenthire.india@glowtouch.com',
      employmentType: null,
      experienceRequired: '6+ years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [
        '6+ years of project management experience',
        'Experience building project plans using Agile or Waterfall methodologies',
        'Self-motivated leader with a desire to make things happen',
      ],
      postingDate: '2023-04-19T07:36:00+00:00',
      closingDate: null,
      jobDescription:
        'Summary of Position: This position is a multi-faceted key position. Based out of India, you will coordinate and lead the execution of this project from idea to production. Skills and Responsibilities: 6+ years of project management experience; Experience building project plans using Agile or Waterfall methodologies. Attributes: Self-motivated leader with a desire to make things happen.',
    },
  )
})

test('extractJobDetail supports the verified alternate GlowTouch support-role template', async () => {
  const glowtouch = await loadGlowtouchTechnologyPvtModule()

  assert.deepEqual(
    glowtouch.extractJobDetail({
      detailUrl: 'https://www.glowtouch.com/technical-support-nonvoice/',
      html: technicalSupportNonvoiceHtml,
    }),
    {
      title: 'Technical Support - Chat process',
      company: 'Glowtouch Technology Pvt',
      department: null,
      location: 'India',
      city: null,
      country: 'India',
      jobId: 'glowtouchtechnologypvt-technical-support-chat-process',
      requisitionId: 'glowtouchtechnologypvt-technical-support-chat-process',
      sourceUrl: 'https://www.glowtouch.com/technical-support-nonvoice/',
      applyUrl: 'mailto:talenthire.india@glowtouch.com',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [
        'Provide chat-based technical support to customers',
        'Learn customer support workflows and tooling',
        'Flexible to work rotational shifts',
        'Excellent written communication',
      ],
      postingDate: '2023-02-20T06:15:51+00:00',
      closingDate: null,
      jobDescription:
        'Summary of Position: Deliver exceptional support experiences for global customers from our India operations. Skills and Responsibilities: Provide chat-based technical support to customers; Learn customer support workflows and tooling; Flexible to work rotational shifts. Attributes: Excellent written communication.',
    },
  )
})

test('run fetches the verified careers page and same-domain detail pages', async () => {
  const glowtouch = await loadGlowtouchTechnologyPvtModule()
  const events = []
  const scraper = glowtouch.createGlowtouchTechnologyPvtScraper({ maxJobs: 1 })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      events.push(url)
      if (url === glowtouch.CAREERS_URL) return careersHtml
      if (url === 'https://www.glowtouch.com/project-manager/') return projectManagerHtml
      if (url === 'https://www.glowtouch.com/web-application-backend-engineer-node-js/') {
        return projectManagerHtml
          .replace(/Project Manager/g, 'Web Application Backend Engineer – Node.js')
          .replace(
            'https://www.glowtouch.com/project-manager/',
            'https://www.glowtouch.com/web-application-backend-engineer-node-js/',
          )
      }
      throw new Error(`Unexpected url ${url}`)
    },
  })

  assert.deepEqual(events, [
    glowtouch.CAREERS_URL,
    'https://www.glowtouch.com/project-manager/',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Project Manager')
  assert.equal(jobs[0].source, glowtouch.SOURCE)
  assert.equal(jobs[0].link, 'mailto:talenthire.india@glowtouch.com')
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('run fails closed when the verified GlowTouch careers surface changes', async () => {
  const glowtouch = await loadGlowtouchTechnologyPvtModule()
  const scraper = glowtouch.createGlowtouchTechnologyPvtScraper()

  await assert.rejects(
    scraper.run({
      fetchText: async () => '<main><h1>Careers</h1></main>',
    }),
    /verified official careers surface/i,
  )

  await assert.rejects(
    scraper.run({
      fetchText: async (url) => {
        if (url === glowtouch.CAREERS_URL) return careersHtml
        return projectManagerHtml.replace('mailto:talenthire.india@glowtouch.com', 'mailto:jobs@example.com')
      },
    }),
    /trusted apply route/i,
  )
})
