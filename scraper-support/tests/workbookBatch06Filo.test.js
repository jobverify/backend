import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_CAREERS_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Job Opportunities At Filo. Check For Recent Career Options</title>
    <meta name="description" content="At Filo, we are always looking to expand our team in a lot of verticals.">
  </head>
  <body>
    <h1>Career at Filo</h1>
    <h3>JOIN OUR TEAM</h3>
    <p>Departments</p>
    <p>Analytics</p>
    <p>Engineering</p>
    <p>Design</p>
    <p>Business Analyst</p>
    <p>Senior Backend Developer</p>
    <p>Senior Product Designer</p>
    <p>© Copyright Filo EdTech INC. 2025</p>
    <script id="__NEXT_DATA__" type="application/json">
      {
        "props": {
          "pageProps": {
            "data": {
              "Analytics": [
                {
                  "position": "Business Analyst",
                  "department": "Analytics",
                  "documentUrl": "https://docs.google.com/document/d/e/2PACX-1vQ1ZORwPdib8TbiQLbMT0oB9-cYCJSOk99RG9GWbaz4GGoeBbCZt7hvkFLm-fnSR_wwUIo89UiP6--C/pub"
                }
              ],
              "Engineering": [
                {
                  "position": "Senior Backend Developer",
                  "department": "Engineering",
                  "documentUrl": "https://docs.google.com/document/d/e/2PACX-1vRCtOZD8N2aANxVFPQjYACNTnMEgs1BNWQ_zyO50V9f7m_Bzsuuf26LdizsuQLooFLbiAI3iuoc5MLG/pub"
                }
              ],
              "Design": [
                {
                  "position": "Senior Product Designer",
                  "department": "Design",
                  "documentUrl": "https://docs.google.com/document/d/e/2PACX-1vR2h8JjSOG_Ogq1vA8qSC8Hxz18MUnL9Cd3us1guzFfZOQxpA6TZxclGJJ3Ma-Ce1tb1Utm4K1zcGLI/pub"
                }
              ]
            }
          }
        }
      }
    </script>
  </body>
</html>
`

const VERIFIED_BACKEND_DOC_HTML = `
<!doctype html>
<html>
  <head>
    <title>Senior Backend Developer</title>
  </head>
  <body>
    <div id="publish-banner-text">Published using Google Docs</div>
    <div id="title">Senior Backend Developer</div>
    <div id="contents">
      <p>Senior Backend Developer</p>
      <p>Experience: Minimum 3 years of experience in developing Backend.</p>
      <p>About Filo If you've come to the realization that despite so much growth in the education sector there is still a lot that can be done, Filo is the right place for you to change that.</p>
      <p>Roles and Responsibilities Design and build reliable distributed systems that handle high volumes of data with low latency. Maintain, support and enhance business critical systems.</p>
      <p>Requirements Experienced with building services in any of (but not limited to) GoLang, Scala, Java, Spring etc. Is a great problem solver who takes pride in their work.</p>
      <p>What we offer Internal tech guilds, Hackathon and public Meetups, and a learning environment where you can extend your skills.</p>
    </div>
  </body>
</html>
`

const VERIFIED_ANALYTICS_DOC_HTML = `
<!doctype html>
<html>
  <head>
    <title>Business Analyst</title>
  </head>
  <body>
    <div id="publish-banner-text">Published using Google Docs</div>
    <div id="title">Business Analyst</div>
    <div id="contents">
      <p>Business Analyst</p>
      <p>Experience: Minimum 2 years in analytics or business analysis.</p>
      <p>Roles and Responsibilities Work with business, growth, and product teams to identify growth opportunities.</p>
      <p>Requirements Excellent SQL skills and structured problem solving.</p>
    </div>
  </body>
</html>
`

const VERIFIED_DESIGN_DOC_HTML = `
<!doctype html>
<html>
  <head>
    <title>Senior Product Designer</title>
  </head>
  <body>
    <div id="publish-banner-text">Published using Google Docs</div>
    <div id="title">Senior Product Designer</div>
    <div id="contents">
      <p>Senior Product Designer</p>
      <p>Experience: 4+ years in product design.</p>
      <p>Roles and Responsibilities Drive user-centric design across Filo's learning journeys.</p>
      <p>Requirements Strong UX craft, visual design, and product thinking.</p>
    </div>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/filo/script.js')
  } catch {
    assert.fail('Expected Filo scraper module at ../../scraper/filo/script.js')
  }
}

test('Filo validates the verified careers shell and extracts the public roles from the official page payload', async () => {
  const filo = await loadModule()
  const roles = filo.extractPublicRoles(VERIFIED_CAREERS_HTML)

  assert.equal(filo.SOURCE, 'filo')
  assert.equal(filo.COMPANY, 'Filo')
  assert.equal(filo.VERIFIED_ON, '2026-10-09')
  assert.equal(filo.CAREERS_URL, 'https://askfilo.com/careers')
  assert.equal(
    filo.DISPOSITION,
    'verified-first-party-careers-page-plus-public-role-details',
  )
  assert.match(filo.VERIFIED_SURFACE_SUMMARY, /October 9, 2026/)
  assert.match(filo.VERIFIED_SURFACE_SUMMARY, /https:\/\/askfilo\.com\/careers/i)
  assert.match(filo.VERIFIED_SURFACE_SUMMARY, /India location/i)
  assert.match(filo.VERIFIED_SURFACE_SUMMARY, /application URL/i)
  assert.equal(filo.hasOfficialCareersPageSignal(VERIFIED_CAREERS_HTML), true)
  assert.deepEqual(roles, [
    {
      title: 'Business Analyst',
      department: 'Analytics',
      documentUrl: 'https://docs.google.com/document/d/e/2PACX-1vQ1ZORwPdib8TbiQLbMT0oB9-cYCJSOk99RG9GWbaz4GGoeBbCZt7hvkFLm-fnSR_wwUIo89UiP6--C/pub',
    },
    {
      title: 'Senior Backend Developer',
      department: 'Engineering',
      documentUrl: 'https://docs.google.com/document/d/e/2PACX-1vRCtOZD8N2aANxVFPQjYACNTnMEgs1BNWQ_zyO50V9f7m_Bzsuuf26LdizsuQLooFLbiAI3iuoc5MLG/pub',
    },
    {
      title: 'Senior Product Designer',
      department: 'Design',
      documentUrl: 'https://docs.google.com/document/d/e/2PACX-1vR2h8JjSOG_Ogq1vA8qSC8Hxz18MUnL9Cd3us1guzFfZOQxpA6TZxclGJJ3Ma-Ce1tb1Utm4K1zcGLI/pub',
    },
  ])
})

test('Filo parses a published Google Doc detail page conservatively', async () => {
  const filo = await loadModule()
  const detail = filo.extractPublishedRoleDetails(VERIFIED_BACKEND_DOC_HTML, {
    title: 'Senior Backend Developer',
    department: 'Engineering',
    documentUrl: 'https://docs.google.com/document/d/e/2PACX-1vRCtOZD8N2aANxVFPQjYACNTnMEgs1BNWQ_zyO50V9f7m_Bzsuuf26LdizsuQLooFLbiAI3iuoc5MLG/pub',
  })

  assert.deepEqual(detail, {
    title: 'Senior Backend Developer',
    experienceRequired: 'Minimum 3 years',
    jobDescription:
      'Design and build reliable distributed systems that handle high volumes of data with low latency. Maintain, support and enhance business critical systems.',
    minimumQualification:
      'Experienced with building services in any of (but not limited to) GoLang, Scala, Java, Spring etc. Is a great problem solver who takes pride in their work.',
  })
})

test('Filo run returns the verified public roles from the careers page and published Google Docs', async () => {
  const filo = await loadModule()
  const requestedUrls = []

  const jobs = await filo.createFiloScraper({ maxJobs: 2 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === filo.CAREERS_URL) return VERIFIED_CAREERS_HTML
      if (url === 'https://docs.google.com/document/d/e/2PACX-1vQ1ZORwPdib8TbiQLbMT0oB9-cYCJSOk99RG9GWbaz4GGoeBbCZt7hvkFLm-fnSR_wwUIo89UiP6--C/pub') {
        return VERIFIED_ANALYTICS_DOC_HTML
      }
      if (url === 'https://docs.google.com/document/d/e/2PACX-1vRCtOZD8N2aANxVFPQjYACNTnMEgs1BNWQ_zyO50V9f7m_Bzsuuf26LdizsuQLooFLbiAI3iuoc5MLG/pub') {
        return VERIFIED_BACKEND_DOC_HTML
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-25T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    filo.CAREERS_URL,
    'https://docs.google.com/document/d/e/2PACX-1vQ1ZORwPdib8TbiQLbMT0oB9-cYCJSOk99RG9GWbaz4GGoeBbCZt7hvkFLm-fnSR_wwUIo89UiP6--C/pub',
    'https://docs.google.com/document/d/e/2PACX-1vRCtOZD8N2aANxVFPQjYACNTnMEgs1BNWQ_zyO50V9f7m_Bzsuuf26LdizsuQLooFLbiAI3iuoc5MLG/pub',
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Business Analyst',
    company: 'Filo',
    department: 'Analytics',
    location: null,
    city: null,
    country: null,
    jobId: 'business-analyst',
    requisitionId: 'business-analyst',
    sourceUrl: 'https://docs.google.com/document/d/e/2PACX-1vQ1ZORwPdib8TbiQLbMT0oB9-cYCJSOk99RG9GWbaz4GGoeBbCZt7hvkFLm-fnSR_wwUIo89UiP6--C/pub',
    applyUrl: 'https://docs.google.com/document/d/e/2PACX-1vQ1ZORwPdib8TbiQLbMT0oB9-cYCJSOk99RG9GWbaz4GGoeBbCZt7hvkFLm-fnSR_wwUIo89UiP6--C/pub',
    employmentType: null,
    experienceRequired: 'Minimum 2 years',
    minimumQualification: 'Excellent SQL skills and structured problem solving.',
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Work with business, growth, and product teams to identify growth opportunities.',
    source: 'filo',
    link: 'https://docs.google.com/document/d/e/2PACX-1vQ1ZORwPdib8TbiQLbMT0oB9-cYCJSOk99RG9GWbaz4GGoeBbCZt7hvkFLm-fnSR_wwUIo89UiP6--C/pub',
    scrapedAt: '2026-07-25T00:00:00.000Z',
  })
  assert.equal(jobs[1].title, 'Senior Backend Developer')
  assert.equal(jobs[1].department, 'Engineering')
  assert.equal(jobs[1].experienceRequired, 'Minimum 3 years')
  assert.match(
    jobs[1].jobDescription,
    /Design and build reliable distributed systems that handle high volumes of data with low latency/i,
  )
  assert.equal(jobs[1].source, 'filo')
})

test('Filo fails closed when the verified careers contract drifts and skips mismatched doc details', async () => {
  const filo = await loadModule()

  await assert.rejects(
    filo.run({
      fetchText: async () => `
        <html>
          <body>
            <h1>Careers</h1>
          </body>
        </html>
      `,
    }),
    /verified official careers surface/i,
  )

  await assert.rejects(
    filo.run({
      fetchText: async () => `
        ${VERIFIED_CAREERS_HTML.replace(
          'https://docs.google.com/document/d/e/2PACX-1vRCtOZD8N2aANxVFPQjYACNTnMEgs1BNWQ_zyO50V9f7m_Bzsuuf26LdizsuQLooFLbiAI3iuoc5MLG/pub',
          'https://boards.greenhouse.io/filo/jobs/12345',
        )}
      `,
    }),
    /public role document contract changed materially/i,
  )

  const originalWarn = console.warn
  const warnings = []

  try {
    console.warn = (message) => warnings.push(String(message))

    const jobs = await filo.createFiloScraper({ maxJobs: 2 }).run({
      fetchText: async (url) => {
        if (url === filo.CAREERS_URL) return VERIFIED_CAREERS_HTML
        if (url === 'https://docs.google.com/document/d/e/2PACX-1vQ1ZORwPdib8TbiQLbMT0oB9-cYCJSOk99RG9GWbaz4GGoeBbCZt7hvkFLm-fnSR_wwUIo89UiP6--C/pub') {
          return VERIFIED_ANALYTICS_DOC_HTML
        }
        if (url === 'https://docs.google.com/document/d/e/2PACX-1vRCtOZD8N2aANxVFPQjYACNTnMEgs1BNWQ_zyO50V9f7m_Bzsuuf26LdizsuQLooFLbiAI3iuoc5MLG/pub') {
          return VERIFIED_BACKEND_DOC_HTML.replace(
            '<title>Senior Backend Developer</title>',
            '<title>Some Other Role</title>',
          )
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
      now: () => '2026-07-25T00:00:00.000Z',
    })

    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].title, 'Business Analyst')
    assert.equal(warnings.length, 1)
    assert.match(warnings[0], /\[filo\] Skipping Senior Backend Developer/i)
  } finally {
    console.warn = originalWarn
  }
})
