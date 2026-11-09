import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  CONTACT_PAGE_URL,
  LINKEDIN_COMPANY_PAGE_URL,
  bundleIndicatesCareerContent,
  createAethroneAerospaceScraper,
  extractBundleUrl,
  extractJobsFromBundle,
  pageIndicatesCareerShell,
} from './script.js'

const careerShellHtml = `
  <html>
    <head>
      <title>Aethrone Aerospace Careers</title>
      <script type="module" crossorigin src="/assets/index-a1b2c3.js"></script>
    </head>
    <body>
      <div id="root">Aethrone Aerospace</div>
    </body>
  </html>
`

const careersBundle = `
  heading:"Open Positions"
  children:"Aerodynamic Design Engineer"}),o.jsx("small",{className:"mt-1 mt-md-4",children:"Design aerodynamic systems for next-generation aerospace programs."}),o.jsx("p",{className:"maincolor fontsecondary",children:"Explore more opportunities on our LinkedIn page."})
  href:"https://www.linkedin.com/company/aethrone-aerospace/jobs/"
  heading:"Open Lap Internships"
  children:["Open to ",o.jsx("span",{className:"fw-bold",children:"B.Tech, M.Tech, and Ph.D. candidates"})," for a ",o.jsx("span",{className:"text-primary",children:"duration of 6 months"})," across the year"]
  children:"High performers may receive Pre-Placement Offers (PPOs) after review"
  children:"Interns have the opportunity to work across engineering and design to research and development teams."
`

test('Aethrone Aerospace scraper identifies the public career shell and bundle URL', () => {
  assert.equal(CAREER_PAGE_URL, 'https://aethroneaerospace.com/career')
  assert.equal(CONTACT_PAGE_URL, 'https://aethroneaerospace.com/contact-us')
  assert.equal(LINKEDIN_COMPANY_PAGE_URL, 'https://www.linkedin.com/company/aethrone-aerospace/')
  assert.equal(pageIndicatesCareerShell(careerShellHtml), true)
  assert.equal(
    extractBundleUrl(careerShellHtml),
    'https://aethroneaerospace.com/assets/index-a1b2c3.js',
  )
})

test('extractJobsFromBundle maps the visible open position and internship from the frontend bundle', () => {
  assert.equal(bundleIndicatesCareerContent(careersBundle), true)
  assert.deepEqual(extractJobsFromBundle(careersBundle), [{
    title: 'Aerodynamic Design Engineer',
    company: 'AETHRONE AEROSPACE',
    department: 'Engineering',
    location: 'India',
    city: null,
    country: 'India',
    jobId: 'aethroneaerospace-aerodynamic-design-engineer',
    requisitionId: 'aethroneaerospace-aerodynamic-design-engineer',
    sourceUrl: CAREER_PAGE_URL,
    applyUrl: CONTACT_PAGE_URL,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Design aerodynamic systems for next-generation aerospace programs. Explore more opportunities on the AETHRONE AEROSPACE LinkedIn page. Apply via the AETHRONE AEROSPACE contact page.',
  }, {
    title: 'Open Lap Internship',
    company: 'AETHRONE AEROSPACE',
    department: 'Internship',
    location: 'India',
    city: null,
    country: 'India',
    jobId: 'aethroneaerospace-open-lap-internship',
    requisitionId: 'aethroneaerospace-open-lap-internship',
    sourceUrl: CAREER_PAGE_URL,
    applyUrl: CONTACT_PAGE_URL,
    employmentType: 'Internship',
    experienceRequired: null,
    minimumQualification: 'B.Tech, M.Tech, and Ph.D. candidates',
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'At AETHRONE AEROSPACE, the open lab internship program offers hands-on experience to b.tech, m.tech, and ph.d. candidates The internship duration is 6 months during both sessions. Internship performance may lead to Pre-Placement Offers (PPOs), and interns can explore verticals across engineering, design, research, and development. Apply via the AETHRONE AEROSPACE contact page.',
  }])
})

test('run fetches the public shell and bundle, then decorates extracted jobs', async () => {
  const requestedUrls = []
  const scraper = createAethroneAerospaceScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === CAREER_PAGE_URL) return careerShellHtml
      if (url === 'https://aethroneaerospace.com/assets/index-a1b2c3.js') return careersBundle
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    CAREER_PAGE_URL,
    'https://aethroneaerospace.com/assets/index-a1b2c3.js',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'aethroneaerospace')
  assert.equal(jobs[0].link, CONTACT_PAGE_URL)
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
  assert.equal(jobs[1].source, 'aethroneaerospace')
  assert.equal(jobs[1].link, CONTACT_PAGE_URL)
  assert.match(jobs[1].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})
