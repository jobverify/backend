import assert from 'node:assert/strict'
import test from 'node:test'

const loadGreenNetSparkModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected GreenNetSpark scraper module at ./script.js')
  }
}

const homepageHtml = `
  <html>
    <head>
      <title>GreenNetspark — Innovative Business Solutions</title>
      <link rel="icon" href="/GN.svg">
      <script type="module" crossorigin src="/assets/index-Dyfk6pAB.js"></script>
    </head>
    <body>
      <div id="root"></div>
    </body>
  </html>
`

const mainBundleJs = `
  const footerLinks = [
    { id: "careers", text: "Careers", href: "/careers" }
  ];
  const contactEmail = "info@greennetspark.in";
  const social = "https://www.linkedin.com/company/greennetspark";
  const CareersPage = () => import("./Careers-DhjYm3Po.js");
`

const careersChunkJs = `
  function Careers() {
    document.title = "Software Jobs & Engineering Careers | GreenNetspark Bangalore";
    const roles = [
      {title:"Senior Frontend Engineer",type:"Full-time",location:"Remote / Bangalore",department:"Engineering",description:"Architect and build high-performance web applications using React 19 and modern primitives."},
      {title:"Backend Systems Architect",type:"Full-time",location:"Bangalore",department:"Infrastructure",description:"Scale our distributed systems and optimize high-throughput data pipelines."},
      {title:"Product Designer (UI/UX)",type:"Full-time",location:"Remote",department:"Design",description:"Lead the design language for our suite of innovative business solutions."},
      {title:"Technical Intern",type:"Internship",location:"Bangalore",department:"Engineering",description:"Join our internship program and work on real-world projects."}
    ];
    return "Careers at GreenNetspark Current Openings Apply Now mailto:careers@greennetspark.in";
  }
`

test('GreenNetSpark constants stay pinned to the verified SPA homepage, main bundle, and careers chunk contract', async () => {
  const greennetspark = await loadGreenNetSparkModule()

  assert.equal(greennetspark.HOMEPAGE_URL, 'https://greennetspark.in/')
  assert.equal(greennetspark.CAREERS_PAGE_URL, 'https://greennetspark.in/careers')
  assert.equal(greennetspark.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(
    greennetspark.extractMainBundleUrl(homepageHtml),
    'https://greennetspark.in/assets/index-Dyfk6pAB.js',
  )
  assert.equal(greennetspark.hasOfficialMainBundleSignal(mainBundleJs), true)
  assert.equal(
    greennetspark.extractCareersChunkUrl(mainBundleJs),
    'https://greennetspark.in/assets/Careers-DhjYm3Po.js',
  )
  assert.equal(greennetspark.hasOfficialCareersChunkSignal(careersChunkJs), true)
})

test('extractJobsFromCareersChunk maps the verified GreenNetSpark openings into structured jobs', async () => {
  const greennetspark = await loadGreenNetSparkModule()

  assert.deepEqual(greennetspark.extractJobsFromCareersChunk(careersChunkJs), [
    {
      title: 'Senior Frontend Engineer',
      company: 'GreenNetSpark',
      department: 'Engineering',
      location: 'Remote / Bangalore',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
      jobId: 'greennetspark-senior-frontend-engineer',
      requisitionId: 'greennetspark-senior-frontend-engineer',
      sourceUrl: 'https://greennetspark.in/careers',
      applyUrl: 'mailto:careers@greennetspark.in?subject=Application for Senior Frontend Engineer&body=Hi GreenNetSpark Team,%0D%0A%0D%0AI am interested in the Senior Frontend Engineer position.%0D%0A%0D%0APlease find my resume attached.%0D%0A%0D%0ARegards',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Architect and build high-performance web applications using React 19 and modern primitives.',
      remoteStatus: 'Remote',
    },
    {
      title: 'Backend Systems Architect',
      company: 'GreenNetSpark',
      department: 'Infrastructure',
      location: 'Bangalore',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
      jobId: 'greennetspark-backend-systems-architect',
      requisitionId: 'greennetspark-backend-systems-architect',
      sourceUrl: 'https://greennetspark.in/careers',
      applyUrl: 'mailto:careers@greennetspark.in?subject=Application for Backend Systems Architect&body=Hi GreenNetSpark Team,%0D%0A%0D%0AI am interested in the Backend Systems Architect position.%0D%0A%0D%0APlease find my resume attached.%0D%0A%0D%0ARegards',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Scale our distributed systems and optimize high-throughput data pipelines.',
      remoteStatus: 'On-site',
    },
    {
      title: 'Product Designer (UI/UX)',
      company: 'GreenNetSpark',
      department: 'Design',
      location: 'Remote',
      city: null,
      state: null,
      country: 'India',
      jobId: 'greennetspark-product-designer-ui-ux',
      requisitionId: 'greennetspark-product-designer-ui-ux',
      sourceUrl: 'https://greennetspark.in/careers',
      applyUrl: 'mailto:careers@greennetspark.in?subject=Application for Product Designer (UI/UX)&body=Hi GreenNetSpark Team,%0D%0A%0D%0AI am interested in the Product Designer (UI/UX) position.%0D%0A%0D%0APlease find my resume attached.%0D%0A%0D%0ARegards',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Lead the design language for our suite of innovative business solutions.',
      remoteStatus: 'Remote',
    },
    {
      title: 'Technical Intern',
      company: 'GreenNetSpark',
      department: 'Engineering',
      location: 'Bangalore',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
      jobId: 'greennetspark-technical-intern',
      requisitionId: 'greennetspark-technical-intern',
      sourceUrl: 'https://greennetspark.in/careers',
      applyUrl: 'mailto:careers@greennetspark.in?subject=Application for Technical Intern&body=Hi GreenNetSpark Team,%0D%0A%0D%0AI am interested in the Technical Intern position.%0D%0A%0D%0APlease find my resume attached.%0D%0A%0D%0ARegards',
      employmentType: 'Internship',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Join our internship program and work on real-world projects.',
      remoteStatus: 'On-site',
    },
  ])
})

test('run validates the official GreenNetSpark SPA handoff chain before returning job cards', async () => {
  const greennetspark = await loadGreenNetSparkModule()
  const requestedUrls = []

  const jobs = await greennetspark.createGreenNetSparkScraper({ maxJobs: 2 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === greennetspark.HOMEPAGE_URL) return homepageHtml
      if (url === 'https://greennetspark.in/assets/index-Dyfk6pAB.js') return mainBundleJs
      if (url === 'https://greennetspark.in/assets/Careers-DhjYm3Po.js') return careersChunkJs

      assert.fail(`Unexpected request: ${url}`)
    },
    now: () => '2026-07-12T12:30:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    greennetspark.HOMEPAGE_URL,
    'https://greennetspark.in/assets/index-Dyfk6pAB.js',
    'https://greennetspark.in/assets/Careers-DhjYm3Po.js',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'greennetspark')
  assert.equal(jobs[0].scrapedAt, '2026-07-12T12:30:00.000Z')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
})

test('run fails closed when the GreenNetSpark careers chunk stops matching the verified openings contract', async () => {
  const greennetspark = await loadGreenNetSparkModule()

  await assert.rejects(
    greennetspark.createGreenNetSparkScraper().run({
      fetchText: async (url) => {
        if (url === greennetspark.HOMEPAGE_URL) return homepageHtml
        if (url.endsWith('index-Dyfk6pAB.js')) return mainBundleJs
        return 'export const Careers = () => "No public openings here";'
      },
    }),
    /official GreenNetSpark careers chunk/i,
  )
})
