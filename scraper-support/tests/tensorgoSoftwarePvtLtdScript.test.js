import assert from 'node:assert/strict'
import test from 'node:test'

const loadTensorGoModule = async () => {
  try {
    return await import('../../scraper/tensorgosoftwarepvtltd/script.js')
  } catch {
    assert.fail('Expected TensorGo Software Pvt Ltd scraper module at ../../scraper/tensorgosoftwarepvtltd/script.js')
  }
}

const careersHtml = `
<!DOCTYPE html>
<html lang="en">
  <body>
    <h1>Careers</h1>
    <p>Careers at TensorGo</p>
    <a href="#jobs">Explore Open Positions</a>
    <section id="jobs">
      <div id="job-results">
        <div id="initial-jobs">
          <a href="https://tensorgo.com/jobs/ai-engineer/">Apply</a>
          <a href="https://tensorgo.com/jobs/founders-office-intern/">Apply</a>
        </div>
      </div>
    </section>
  </body>
</html>
`

const listingPage1 = [
  {
    id: 4576,
    date: '2026-05-16T06:19:32',
    link: 'https://tensorgo.com/jobs/ai-engineer/',
    title: {
      rendered: 'AI Engineer',
    },
  },
]

const listingPage2 = [
  {
    id: 4519,
    date: '2026-01-30T04:55:03',
    link: 'https://tensorgo.com/jobs/founders-office-intern/',
    title: {
      rendered: 'Founder&#8217;s Office Intern',
    },
  },
]

const aiEngineerDetailHtml = `
<!DOCTYPE html>
<html lang="en">
  <body>
    <section>
      <h1>AI Engineer</h1>
      <div class="job_specification">
        <p>Job ID</p>
        <h5>AE162605</h5>
      </div>
      <div class="job_specification">
        <p>Role</p>
        <h5>AI Engineer</h5>
      </div>
      <div class="job_specification">
        <p>Location</p>
        <h5>Hyderabad/Delhi (WFO)</h5>
      </div>
      <div class="job_specification">
        <p>Experience</p>
        <h5>1 to 3 years</h5>
      </div>
    </section>

    <div class="descriptions">
      <div class="descriptions_box" data-aos="fade-right">
        <h2 class="title mb-4">Profile</h2>
        <p>Build, deploy, and optimize AI-powered solutions across products and internal systems.</p>
      </div>
      <div class="descriptions_box" data-aos="fade-right">
        <h2 class="title mb-4">Responsibilities</h2>
        <ul>
          <li>Design and deploy production AI systems.</li>
          <li>Translate business requirements into scalable AI workflows.</li>
        </ul>
      </div>
      <div class="descriptions_box" data-aos="fade-right">
        <h2 class="title mb-4">Qualifications</h2>
        <ul>
          <li>Hands-on experience with AI/ML frameworks such as TensorFlow and PyTorch.</li>
          <li>Experience working with LLMs such as GPT and Claude.</li>
        </ul>
      </div>
      <div class="descriptions_box" data-aos="fade-right">
        <h2 class="title mb-4">Why Join Us</h2>
        <p>Build impactful AI products with a fast-moving team.</p>
      </div>
    </div>

    <div class="descriptions_box" data-aos="fade-right">
      <h2 class="title mb-4">Join the awesome squad. Apply now!</h2>
      <form action="/jobs/ai-engineer/#wpcf7-f446-o1"></form>
    </div>
  </body>
</html>
`

const foundersOfficeDetailHtml = `
<!DOCTYPE html>
<html lang="en">
  <body>
    <section>
      <h1>Founder&#8217;s Office Intern</h1>
      <div class="job_specification">
        <p>Job ID</p>
        <h5>FOI302601</h5>
      </div>
      <div class="job_specification">
        <p>Role</p>
        <h5>Founder&#8217;s Office Intern</h5>
      </div>
      <div class="job_specification">
        <p>Location</p>
        <h5>Hyderabad</h5>
      </div>
      <div class="job_specification">
        <p>Experience</p>
        <h5>0 to 1 Year</h5>
      </div>
    </section>

    <div class="descriptions">
      <div class="descriptions_box">
        <h2 class="title mb-4">Profile</h2>
        <p>Support the founder’s office across strategy, operations, and special projects.</p>
      </div>
      <div class="descriptions_box">
        <h2 class="title mb-4">Responsibilities</h2>
        <ul>
          <li>Drive research for strategic initiatives.</li>
          <li>Coordinate execution across internal stakeholders.</li>
        </ul>
      </div>
      <div class="descriptions_box">
        <h2 class="title mb-4">Qualifications</h2>
        <ul>
          <li>Strong written and verbal communication skills.</li>
        </ul>
      </div>
    </div>

    <div class="descriptions_box">
      <h2 class="title mb-4">Join the awesome squad. Apply now!</h2>
      <form action="/jobs/founders-office-intern/#wpcf7-f446-o1"></form>
    </div>
  </body>
</html>
`

test('TensorGo helpers stay pinned to the verified official careers page, WP jobs feed, and detail-page parsing', async () => {
  const tensorgo = await loadTensorGoModule()

  assert.equal(tensorgo.CAREERS_PAGE_URL, 'https://tensorgo.com/careers-at-tensorgo/')
  assert.equal(tensorgo.JOBS_API_URL, 'https://tensorgo.com/wp-json/wp/v2/jobs')
  assert.equal(
    tensorgo.buildListingsApiUrl(1),
    'https://tensorgo.com/wp-json/wp/v2/jobs?_fields=id%2Cdate%2Clink%2Ctitle&per_page=100&page=1',
  )
  assert.equal(tensorgo.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(tensorgo.extractJobDetail(aiEngineerDetailHtml), {
    jobId: 'AE162605',
    requisitionId: 'AE162605',
    location: 'Hyderabad/Delhi (WFO), India',
    city: null,
    state: null,
    country: 'India',
    experienceRequired: '1 to 3 years',
    employmentType: null,
    requiredSkills: [
      'Hands-on experience with AI/ML frameworks such as TensorFlow and PyTorch.',
      'Experience working with LLMs such as GPT and Claude.',
    ],
    jobDescription: [
      'Profile: Build, deploy, and optimize AI-powered solutions across products and internal systems.',
      'Responsibilities: Design and deploy production AI systems. Translate business requirements into scalable AI workflows.',
      'Qualifications: Hands-on experience with AI/ML frameworks such as TensorFlow and PyTorch. Experience working with LLMs such as GPT and Claude.',
      'Why Join Us: Build impactful AI products with a fast-moving team.',
    ].join('\n\n'),
    remoteStatus: 'On-site',
  })
})

test('TensorGo marker-only app programs cannot authorize an unreviewed current API handoff', async () => {
  const tensorgo = await loadTensorGoModule()
  const bundle = [
    'const api="https://api.humains.one";',
    'client.get("/api/jobs");',
    'client.get("/api/jobs/".concat(slug));',
    'path:"/careers";',
    'path:"/careers/:slug";',
    '"JobPosting";',
    '"TensorGo";',
  ].join('')
  const shell = `
    <html><head>
      <title>HumAIn by TensorGo | The World's First Pre-AGI Teammates</title>
      <link rel="canonical" href="https://tensorgo.com/">
      <script type="application/ld+json">{"name":"TensorGo"}</script>
      <script defer src="/static/js/main.current.js"></script>
    </head><body><div id="root"></div></body></html>
  `
  assert.equal(tensorgo.hasVerifiedRetiredCareersSignal(shell), true)
  const requestedTextUrls = []
  const requestedJsonUrls = []
  await assert.rejects(
    tensorgo.run({
      fetchText: async (url) => {
        requestedTextUrls.push(url)
        if (url === tensorgo.CAREERS_PAGE_URL) return shell
        if (url === 'https://tensorgo.com/static/js/main.current.js') return bundle
        throw new Error(`Unexpected TensorGo text URL: ${url}`)
      },
      fetchJson: async (url) => {
        requestedJsonUrls.push(url)
        if (url === 'https://api.humains.one/api/jobs') return { items: [] }
        throw new Error(`Unexpected TensorGo JSON URL: ${url}`)
      },
    }),
    /current public job API handoff program contract changed/,
  )
  assert.deepEqual(requestedTextUrls, [
    tensorgo.CAREERS_PAGE_URL,
    'https://tensorgo.com/static/js/main.current.js',
  ])
  assert.deepEqual(requestedJsonUrls, [])
})

test('run pages through the verified TensorGo jobs feed, fetches first-party detail pages, and decorates jobs', async () => {
  const tensorgo = await loadTensorGoModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await tensorgo.createTensorGoSoftwarePvtLtdScraper({ pageSize: 1 }).run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      if (url === tensorgo.CAREERS_PAGE_URL) return careersHtml
      if (url === 'https://tensorgo.com/jobs/ai-engineer/') return aiEngineerDetailHtml
      if (url === 'https://tensorgo.com/jobs/founders-office-intern/') return foundersOfficeDetailHtml
      throw new Error(`Unexpected HTML URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      if (url === tensorgo.buildListingsApiUrl(1, 1)) return listingPage1
      if (url === tensorgo.buildListingsApiUrl(2, 1)) return listingPage2
      if (url === tensorgo.buildListingsApiUrl(3, 1)) return []
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
    now: () => '2026-07-10T00:00:00.000Z',
  })

  assert.deepEqual(requestedTextUrls, [
    tensorgo.CAREERS_PAGE_URL,
    'https://tensorgo.com/jobs/ai-engineer/',
    'https://tensorgo.com/jobs/founders-office-intern/',
  ])
  assert.deepEqual(requestedJsonUrls, [
    tensorgo.buildListingsApiUrl(1, 1),
    tensorgo.buildListingsApiUrl(2, 1),
    tensorgo.buildListingsApiUrl(3, 1),
  ])
  assert.deepEqual(jobs, [
    {
      title: 'AI Engineer',
      company: 'TensorGo Software Pvt Ltd',
      department: null,
      location: 'Hyderabad/Delhi (WFO), India',
      city: null,
      state: null,
      country: 'India',
      jobId: 'AE162605',
      requisitionId: 'AE162605',
      sourceUrl: 'https://tensorgo.com/jobs/ai-engineer/',
      applyUrl: 'https://tensorgo.com/jobs/ai-engineer/',
      employmentType: null,
      experienceRequired: '1 to 3 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [
        'Hands-on experience with AI/ML frameworks such as TensorFlow and PyTorch.',
        'Experience working with LLMs such as GPT and Claude.',
      ],
      postingDate: '2026-05-16',
      closingDate: null,
      jobDescription: [
        'Profile: Build, deploy, and optimize AI-powered solutions across products and internal systems.',
        'Responsibilities: Design and deploy production AI systems. Translate business requirements into scalable AI workflows.',
        'Qualifications: Hands-on experience with AI/ML frameworks such as TensorFlow and PyTorch. Experience working with LLMs such as GPT and Claude.',
        'Why Join Us: Build impactful AI products with a fast-moving team.',
      ].join('\n\n'),
      remoteStatus: 'On-site',
      source: 'tensorgosoftwarepvtltd',
      link: 'https://tensorgo.com/jobs/ai-engineer/',
      scrapedAt: '2026-07-10T00:00:00.000Z',
    },
    {
      title: "Founder's Office Intern",
      company: 'TensorGo Software Pvt Ltd',
      department: null,
      location: 'Hyderabad, India',
      city: 'Hyderabad',
      state: null,
      country: 'India',
      jobId: 'FOI302601',
      requisitionId: 'FOI302601',
      sourceUrl: 'https://tensorgo.com/jobs/founders-office-intern/',
      applyUrl: 'https://tensorgo.com/jobs/founders-office-intern/',
      employmentType: null,
      experienceRequired: '0 to 1 Year',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [
        'Strong written and verbal communication skills.',
      ],
      postingDate: '2026-01-30',
      closingDate: null,
      jobDescription: [
        "Profile: Support the founder's office across strategy, operations, and special projects.",
        'Responsibilities: Drive research for strategic initiatives. Coordinate execution across internal stakeholders.',
        'Qualifications: Strong written and verbal communication skills.',
      ].join('\n\n'),
      remoteStatus: 'On-site',
      source: 'tensorgosoftwarepvtltd',
      link: 'https://tensorgo.com/jobs/founders-office-intern/',
      scrapedAt: '2026-07-10T00:00:00.000Z',
    },
  ])
})

test('run fails closed when the verified TensorGo careers page or jobs feed changes shape', async () => {
  const tensorgo = await loadTensorGoModule()

  await assert.rejects(
    tensorgo.createTensorGoSoftwarePvtLtdScraper().run({
      fetchText: async (url) => {
        if (url === tensorgo.CAREERS_PAGE_URL) return '<html><body>Unexpected</body></html>'
        throw new Error(`Unexpected HTML URL: ${url}`)
      },
      fetchJson: async () => [],
    }),
    /verified official TensorGo careers surface/i,
  )

  await assert.rejects(
    tensorgo.createTensorGoSoftwarePvtLtdScraper().run({
      fetchText: async (url) => {
        if (url === tensorgo.CAREERS_PAGE_URL) return careersHtml
        throw new Error(`Unexpected HTML URL: ${url}`)
      },
      fetchJson: async () => ({ total: 0 }),
    }),
    /verified TensorGo jobs feed/i,
  )

  await assert.rejects(
    tensorgo.createTensorGoSoftwarePvtLtdScraper().run({
      fetchText: async (url) => {
        if (url === tensorgo.CAREERS_PAGE_URL) return careersHtml
        if (url === 'https://tensorgo.com/jobs/ai-engineer/') return '<html><body>Broken detail</body></html>'
        throw new Error(`Unexpected HTML URL: ${url}`)
      },
      fetchJson: async () => listingPage1,
    }),
    /verified TensorGo job detail surface/i,
  )
})
