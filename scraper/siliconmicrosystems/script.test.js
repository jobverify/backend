import assert from 'node:assert/strict'
import test from 'node:test'

import {
  APPLICATION_EMAIL,
  CAREER_ROUTE_URL,
  HOMEPAGE_URL,
  buildApplyUrl,
  buildSearchUrl,
  createSiliconMicrosystemsScraper,
  extractCareerChunkUrl,
  extractMainBundleUrl,
  extractSearchResults,
  hasOfficialHomepageSignal,
} from './script.js'

const homepageHtml = `
  <html lang="en">
    <head>
      <title>Silicon Microsystems</title>
      <meta
        name="description"
        content="Silicon Microsystems (SIMS India) - 28+ years of expertise in VLSI, Embedded Systems, AI, Robotics & Advanced Electronics."
      />
      <meta property="og:url" content="https://simsindia.net" />
      <script type="module" crossorigin src="/assets/index-CDX8AhfU.js"></script>
    </head>
    <body>
      <div id="root"></div>
    </body>
  </html>
`

const mainBundleJs = `
  const routes = {
    "/training": () => import("./Training-abc123.js"),
    "/career": () => import("./Career-C3w29Hre.js"),
  };
`

const careerBundleJs = `
  const G=[{title:"Position Overview",paragraphs:["Support Electronics labs and customer deployments."]},{title:"Apply",paragraphs:["If you are passionate about technology, education and client engagement, we invite you to apply and grow with Silicon Microsystems."]}],
    Q=[{title:"Position Overview",paragraphs:["Support mechanical labs, robotics and CNC deployments."]}],
    V=[{title:"Position Overview",paragraphs:["Drive academic outreach and institutional relationships."]}],
    H=[{title:"Position Overview",paragraphs:["Coordinate technical sales activity and customer follow-up."]}],
    F=[
      {title:"FIELD APPLICATION ENGINEER (FAE - Electronics)",jobId:"26SiMS03FAEE",location:"South India (Extensive Travel Required)",travel:"50% or more",experience:"0 - 2 Years",compensation:"INR 4,20,000 per annum",probation:"9 months",richSections:G},
      {title:"FIELD APPLICATION ENGINEER (FAE - Mechanical)",jobId:"26SiMS03FAEM",location:"Across India (Extensive Travel Required)",travel:"50% or more",experience:"0 - 2 Years",compensation:"INR 4,20,000 per annum",probation:"9 months",richSections:Q},
      {title:"BUSINESS DEVELOPMENT EXECUTIVE",jobId:"26SiMS03BD",location:"India (Academic & student outreach)",travel:"As required",experience:"0 - 2 Years",compensation:"INR 3,60,000 per annum",probation:"9 months",richSections:V},
      {title:"TECHNICAL SALES ENGINEER - I (FEMALE ONLY)",jobId:"26SiMS03TS",location:"India (Higher education & technology ecosystem)",travel:"As required",experience:"0 - 3 Years",compensation:"INR 3,60,000 per annum",probation:"9 months",richSections:H}
    ];
  const applyHref = \`mailto:career@simsindia.net?subject=\${encodeURIComponent(\`Application for \${a.title}\${a.jobId?\` (\${a.jobId})\`:""}\`)}\`;
`

test('homepage helpers detect the verified Silicon Microsystems homepage and published career bundle routes', () => {
  assert.equal(HOMEPAGE_URL, 'https://www.simsindia.net/')
  assert.equal(CAREER_ROUTE_URL, 'https://www.simsindia.net/career')
  assert.equal(APPLICATION_EMAIL, 'career@simsindia.net')
  assert.equal(buildSearchUrl(), HOMEPAGE_URL)
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(extractMainBundleUrl(homepageHtml), 'https://www.simsindia.net/assets/index-CDX8AhfU.js')
  assert.equal(extractCareerChunkUrl(mainBundleJs), 'https://www.simsindia.net/assets/Career-C3w29Hre.js')
})

test('extractSearchResults maps first-party published Silicon Microsystems jobs into shared scraper fields', () => {
  const jobs = extractSearchResults(careerBundleJs)

  assert.deepEqual(jobs, [
    {
      title: 'FIELD APPLICATION ENGINEER (FAE - Electronics)',
      company: 'Silicon Microsystems',
      department: null,
      location: 'South India (Extensive Travel Required), India',
      city: null,
      country: 'India',
      jobId: '26SiMS03FAEE',
      requisitionId: '26SiMS03FAEE',
      sourceUrl: 'https://www.simsindia.net/career',
      applyUrl: 'mailto:career@simsindia.net?subject=Application%20for%20FIELD%20APPLICATION%20ENGINEER%20(FAE%20-%20Electronics)%20(26SiMS03FAEE)',
      employmentType: null,
      experienceRequired: '0 - 2 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Position Overview: Support Electronics labs and customer deployments. Apply: If you are passionate about technology, education and client engagement, we invite you to apply and grow with Silicon Microsystems.',
      remoteStatus: 'On-site',
    },
    {
      title: 'FIELD APPLICATION ENGINEER (FAE - Mechanical)',
      company: 'Silicon Microsystems',
      department: null,
      location: 'Across India (Extensive Travel Required), India',
      city: null,
      country: 'India',
      jobId: '26SiMS03FAEM',
      requisitionId: '26SiMS03FAEM',
      sourceUrl: 'https://www.simsindia.net/career',
      applyUrl: 'mailto:career@simsindia.net?subject=Application%20for%20FIELD%20APPLICATION%20ENGINEER%20(FAE%20-%20Mechanical)%20(26SiMS03FAEM)',
      employmentType: null,
      experienceRequired: '0 - 2 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Position Overview: Support mechanical labs, robotics and CNC deployments.',
      remoteStatus: 'On-site',
    },
    {
      title: 'BUSINESS DEVELOPMENT EXECUTIVE',
      company: 'Silicon Microsystems',
      department: null,
      location: 'India (Academic & student outreach)',
      city: null,
      country: 'India',
      jobId: '26SiMS03BD',
      requisitionId: '26SiMS03BD',
      sourceUrl: 'https://www.simsindia.net/career',
      applyUrl: 'mailto:career@simsindia.net?subject=Application%20for%20BUSINESS%20DEVELOPMENT%20EXECUTIVE%20(26SiMS03BD)',
      employmentType: null,
      experienceRequired: '0 - 2 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Position Overview: Drive academic outreach and institutional relationships.',
      remoteStatus: 'On-site',
    },
    {
      title: 'TECHNICAL SALES ENGINEER - I (FEMALE ONLY)',
      company: 'Silicon Microsystems',
      department: null,
      location: 'India (Higher education & technology ecosystem)',
      city: null,
      country: 'India',
      jobId: '26SiMS03TS',
      requisitionId: '26SiMS03TS',
      sourceUrl: 'https://www.simsindia.net/career',
      applyUrl: 'mailto:career@simsindia.net?subject=Application%20for%20TECHNICAL%20SALES%20ENGINEER%20-%20I%20(FEMALE%20ONLY)%20(26SiMS03TS)',
      employmentType: null,
      experienceRequired: '0 - 3 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Position Overview: Coordinate technical sales activity and customer follow-up.',
      remoteStatus: 'On-site',
    },
  ])
})

test('buildApplyUrl creates the verified first-party mailto handoff', () => {
  assert.equal(
    buildApplyUrl({
      title: 'FIELD APPLICATION ENGINEER (FAE - Electronics)',
      jobId: '26SiMS03FAEE',
    }),
    'mailto:career@simsindia.net?subject=Application%20for%20FIELD%20APPLICATION%20ENGINEER%20(FAE%20-%20Electronics)%20(26SiMS03FAEE)',
  )
})

test('run verifies the homepage, discovers the career chunk, and decorates published jobs', async () => {
  const requestedUrls = []
  const scraper = createSiliconMicrosystemsScraper({ maxJobs: 2 })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) return homepageHtml
      if (url === 'https://www.simsindia.net/assets/index-CDX8AhfU.js') return mainBundleJs
      if (url === 'https://www.simsindia.net/assets/Career-C3w29Hre.js') return careerBundleJs

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    HOMEPAGE_URL,
    'https://www.simsindia.net/assets/index-CDX8AhfU.js',
    'https://www.simsindia.net/assets/Career-C3w29Hre.js',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'siliconmicrosystems')
  assert.equal(
    jobs[0].link,
    'mailto:career@simsindia.net?subject=Application%20for%20FIELD%20APPLICATION%20ENGINEER%20(FAE%20-%20Electronics)%20(26SiMS03FAEE)',
  )
  assert.match(jobs[0].scrapedAt, /\d{4}-\d{2}-\d{2}T/)
})

test('run fails closed when the homepage stops matching the verified Silicon Microsystems surface', async () => {
  await assert.rejects(
    createSiliconMicrosystemsScraper().run({
      fetchText: async () => '<html><head><title>Placeholder</title></head><body>Coming soon</body></html>',
    }),
    /Silicon Microsystems homepage no longer matches the verified official site/i,
  )
})
