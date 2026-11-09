import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected VU-DYNAMICS scraper module at ./script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>VU-DYNAMICS</title>
  </head>
  <body>
    <main>
      <p><strong>At VU-DYNAMICS</strong> we aspire to actualize.</p>
      <p>Founded in 2022, with the vision of solving the defense requirements of the country.</p>
      <p>Born out of the corridors of IIT Kanpur.</p>
      <nav>
        <a href="https://vudynamics.co.in/careers/">Careers</a>
      </nav>
    </main>
  </body>
</html>
`

const careersPageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Careers - VU-DYNAMICS</title>
    <link rel="canonical" href="https://vudynamics.co.in/careers/" />
  </head>
  <body>
    <main>
      <h1>JOIN OUR TEAM</h1>
      <p>Exciting opportunities await - we're expanding and looking for talented individuals to join our journey.</p>
      <p><strong>HOW TO APPLY</strong></p>
      <p>Send your CV and Portfolio to this email address:
        <a href="mailto:careers@vudynamics.co.in">careers@vudynamics.co.in</a>
      </p>
    </main>
  </body>
</html>
`

const careersApiPayload = [
  {
    id: 216,
    slug: 'careers',
    link: 'https://vudynamics.co.in/careers/',
    title: { rendered: 'Careers' },
    content: {
      rendered: `
<p><strong>Embedded Systems Engineer</strong></p>
<p><strong>Job Description:</strong></p>
<p>We are looking for a passionate and skilled Embedded Systems Engineer with a minimum of 2 years of experience to join our dynamic R&D team.</p>
<p><strong>Location:</strong> R&D facility @C/O Startup Incubation and Innovation Center(SIIC-IITK), IIT Kanpur<br><strong>Employment Type</strong>: Full-time</p>
<p><strong>Qualifications</strong>: Bachelor's degree in Electrical, Electronics, or Computer fields, or equivalent practical experience.</p>
<p><strong>Experience</strong>: Minimum 2 Years</p>
<p><strong>Skills Required :</strong></p>
<ul>
  <li>Strong expertise in STM32 microcontrollers and firmware development.</li>
  <li>Knowledge of embedded systems development, ARM, RTOS concepts, and device drivers.</li>
</ul>
<p><strong>Why Join Us?</strong></p>
<ul>
  <li>Opportunity to work on innovative embedded system projects.</li>
  <li>Hands-on experience with state-of-the-art technologies.</li>
</ul>
<p><strong>Joining Date:</strong> Immediate</p>
<p><strong>Number of Positions: </strong>2</p>
<hr />
<p><strong>Media and Design Intern</strong></p>
<p><strong>Job Description:</strong></p>
<p>We are looking for a creative and motivated intern to assist with videography, photography, video editing, graphic design, and social media management.</p>
<p><strong>Location:</strong> R&D facility @C/O Startup Incubation and Innovation Center(SIIC-IITK), IIT Kanpur</p>
<ul>
  <li>Candidates can work from the R&D Facility at IIT Kanpur or remotely (Work from Home).</li>
  <li>Remote interns must ensure they have access to necessary software and a stable internet connection.</li>
</ul>
<p><strong>Employment Type</strong>: Full-time</p>
<p><strong>Qualifications</strong>: Currently pursuing or completed B.Tech in any discipline with an interest in media, design, or content creation.</p>
<p><strong>Experience</strong>: Freshers are also eligible</p>
<p><strong>Skills Required :</strong></p>
<ul>
  <li>Proficiency in Adobe Premiere Pro, After Effects, Photoshop, Illustrator, or similar software.</li>
  <li>Experience in video editing and motion graphics.</li>
</ul>
<p><strong>Date of joining</strong>: Immediate</p>
<p><strong>Number of Positions: </strong>1</p>
<hr />
<p><strong>HOW TO APPLY</strong></p>
<p>Send your CV and Portfolio to this email address, mentioning job position in the subject line:
  <strong><a href="mailto:careers@vudynamics.co.in">careers@vudynamics.co.in</a></strong>
</p>
      `,
    },
  },
]

test('VU-DYNAMICS validates the verified official homepage, careers page, and careers API payload', async () => {
  const vudynamics = await loadModule()

  assert.equal(vudynamics.SOURCE, 'vudynamicsprivatelimited')
  assert.equal(vudynamics.COMPANY, 'VU-DYNAMICS Private Limited')
  assert.equal(vudynamics.HOMEPAGE_URL, 'https://vudynamics.co.in/')
  assert.equal(vudynamics.CAREERS_URL, 'https://vudynamics.co.in/careers/')
  assert.equal(
    vudynamics.CAREERS_API_URL,
    'https://vudynamics.co.in/wp-json/wp/v2/pages?slug=careers&_fields=id,slug,link,title,content',
  )

  assert.equal(vudynamics.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(vudynamics.hasOfficialCareersPageSignal(careersPageHtml), true)
  assert.equal(vudynamics.hasVerifiedCareersApiPayload(careersApiPayload), true)

  const jobs = vudynamics.extractJobsFromCareersHtml(careersApiPayload[0].content.rendered)
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      employmentType: job.employmentType,
      experienceRequired: job.experienceRequired,
      minimumQualification: job.minimumQualification,
      requiredSkills: job.requiredSkills,
    })),
    [
      {
        title: 'Embedded Systems Engineer',
        location: 'R&D facility @C/O Startup Incubation and Innovation Center(SIIC-IITK), IIT Kanpur',
        employmentType: 'Full-time',
        experienceRequired: 'Minimum 2 Years',
        minimumQualification: "Bachelor's degree in Electrical, Electronics, or Computer fields, or equivalent practical experience.",
        requiredSkills: [
          'Strong expertise in STM32 microcontrollers and firmware development.',
          'Knowledge of embedded systems development, ARM, RTOS concepts, and device drivers.',
        ],
      },
      {
        title: 'Media and Design Intern',
        location: 'R&D facility @C/O Startup Incubation and Innovation Center(SIIC-IITK), IIT Kanpur',
        employmentType: 'Full-time',
        experienceRequired: 'Freshers are also eligible',
        minimumQualification: 'Currently pursuing or completed B.Tech in any discipline with an interest in media, design, or content creation.',
        requiredSkills: [
          'Proficiency in Adobe Premiere Pro, After Effects, Photoshop, Illustrator, or similar software.',
          'Experience in video editing and motion graphics.',
        ],
      },
    ],
  )
})

test('VU-DYNAMICS scraper returns jobs from the verified official first-party careers surface', async () => {
  const vudynamics = await loadModule()
  const requestedTexts = []
  const requestedJson = []

  const jobs = await vudynamics.createVuDynamicsPrivateLimitedScraper().run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === vudynamics.HOMEPAGE_URL) return homepageHtml
      if (url === vudynamics.CAREERS_URL) return careersPageHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      if (url === vudynamics.CAREERS_API_URL) return careersApiPayload
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTexts, [
    vudynamics.HOMEPAGE_URL,
    vudynamics.CAREERS_URL,
  ])
  assert.deepEqual(requestedJson, [vudynamics.CAREERS_API_URL])
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      company: job.company,
      city: job.city,
      country: job.country,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
    })),
    [
      {
        title: 'Embedded Systems Engineer',
        company: 'VU-DYNAMICS Private Limited',
        city: 'Kanpur',
        country: 'India',
        sourceUrl: 'https://vudynamics.co.in/careers/',
        applyUrl: 'mailto:careers@vudynamics.co.in?subject=Embedded%20Systems%20Engineer',
      },
      {
        title: 'Media and Design Intern',
        company: 'VU-DYNAMICS Private Limited',
        city: 'Kanpur',
        country: 'India',
        sourceUrl: 'https://vudynamics.co.in/careers/',
        applyUrl: 'mailto:careers@vudynamics.co.in?subject=Media%20and%20Design%20Intern',
      },
    ],
  )
})

test('VU-DYNAMICS scraper fails closed when the verified homepage, careers page, or careers API surface drifts', async () => {
  const vudynamics = await loadModule()

  await assert.rejects(
    vudynamics.createVuDynamicsPrivateLimitedScraper().run({
      fetchText: async (url) => {
        if (url === vudynamics.HOMEPAGE_URL) {
          return '<html><body><a href="/careers/">Careers</a></body></html>'
        }
        return careersPageHtml
      },
      fetchJson: async () => careersApiPayload,
    }),
    /official homepage/i,
  )

  await assert.rejects(
    vudynamics.createVuDynamicsPrivateLimitedScraper().run({
      fetchText: async (url) => {
        if (url === vudynamics.HOMEPAGE_URL) return homepageHtml
        if (url === vudynamics.CAREERS_URL) {
          return '<html><head><title>Careers</title></head><body><p>Contact us</p></body></html>'
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
      fetchJson: async () => careersApiPayload,
    }),
    /official careers page/i,
  )

  await assert.rejects(
    vudynamics.createVuDynamicsPrivateLimitedScraper().run({
      fetchText: async (url) => {
        if (url === vudynamics.HOMEPAGE_URL) return homepageHtml
        if (url === vudynamics.CAREERS_URL) return careersPageHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
      fetchJson: async () => ([]),
    }),
    /careers api/i,
  )
})
