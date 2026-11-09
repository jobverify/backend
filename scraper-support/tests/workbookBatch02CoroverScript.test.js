import assert from 'node:assert/strict'
import test from 'node:test'

const loadCoRoverModule = async () => {
  try {
    return await import('../../scraper/corover/script.js')
  } catch {
    assert.fail('Expected CoRover scraper module at ../../scraper/corover/script.js')
  }
}

const officialCareersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | CoRover</title>
  </head>
  <body>
    <section>
      <p>Careers at CoRover</p>
      <h1>Join Our Mission</h1>
      <p>Build the future of Conversational AI with us.</p>
      <h2>Careers</h2>
      <p>We hire people with good problem-solving skills, good aptitude and attitude.</p>
      <h3>A glimpse of our recent offsite in GOA!</h3>
    </section>
    <section id="positions">
      <div class="grid">
        <div class="relative group cursor-pointer h-full block flex flex-col">
          <a class="h-full flex flex-col" href="/company/careers/program-manager-technology-it">
            <div>
              <span>01</span>
              <span>Project &amp; Program Management</span>
              <h3>Program Manager - Technology / IT</h3>
              <div>
                <span>Bangalore</span>
                <span>Full-Time</span>
                <span>24 Jul 2026</span>
              </div>
              <span>Apply Now</span>
            </div>
          </a>
        </div>
        <div class="relative group cursor-pointer h-full block flex flex-col">
          <a class="h-full flex flex-col" href="/company/careers/executive-assistant-admin">
            <div>
              <span>02</span>
              <span>Administration &amp; Facilities</span>
              <h3>Executive Assistant/Admin</h3>
              <div>
                <span>Bangalore</span>
                <span>Full-Time</span>
                <span>24 Jul 2026</span>
              </div>
              <span>Apply Now</span>
            </div>
          </a>
        </div>
        <div class="relative group cursor-pointer h-full block flex flex-col">
          <a class="h-full flex flex-col" href="/company/careers/principal-research-scientist-advanced-foundations-frontier-intelligence">
            <div>
              <span>03</span>
              <span>AI Research &amp; Development</span>
              <h3>Principal Research Scientist - Advanced Foundations &amp; Frontier Intelligence</h3>
              <div>
                <span>Bengaluru, New Delhi, Mumbai - India; London - UK; Silicon Valley - US</span>
                <span>Full-Time</span>
                <span>22 Jul 2026</span>
              </div>
              <span>Apply Now</span>
            </div>
          </a>
        </div>
        <div class="relative group cursor-pointer h-full block flex flex-col">
          <a class="h-full flex flex-col" href="/company/careers/full-stack-developer">
            <div>
              <span>04</span>
              <span>Engineering</span>
              <h3>Full Stack Developer</h3>
              <div>
                <span>Bengaluru, India</span>
                <span>Full-Time</span>
                <span>19 Jul 2026</span>
              </div>
              <span>Apply Now</span>
            </div>
          </a>
        </div>
      </div>
    </section>
  </body>
</html>
`

const programManagerDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Program Manager - Technology / IT | Careers at CoRover</title>
  </head>
  <body>
    <section>
      <p>Project &amp; Program Management</p>
      <h1>Program Manager - Technology / IT</h1>
      <p>
        As a Technical Program Manager, you will own the complete lifecycle of strategic AI products and platforms
        from product planning and roadmap definition to engineering execution, customer rollout, and continuous improvement.
      </p>
      <h2>Role Requirements</h2>
      <h3>Job Description</h3>
      <p>Ensure timely delivery of high-quality product releases.</p>
      <h2>Job Overview</h2>
      <p>Department</p>
      <p>Project &amp; Program Management</p>
      <p>Location</p>
      <p>Bangalore</p>
      <p>Job Type</p>
      <p>Full-Time</p>
      <p>Work Mode</p>
      <p>Hybrid</p>
      <p>Experience</p>
      <p>5-10 Years</p>
      <p>Date Posted</p>
      <p>24 July 2026</p>
      <h2>Apply for this Position</h2>
    </section>
  </body>
</html>
`

const executiveAssistantDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Executive Assistant/Admin | Careers at CoRover</title>
  </head>
  <body>
    <section>
      <p>Administration &amp; Facilities</p>
      <h1>Executive Assistant/Admin</h1>
      <p>
        Support leadership with scheduling, coordination, travel planning, document management,
        and office administration for a fast-moving AI business.
      </p>
      <h2>Job Overview</h2>
      <p>Department</p>
      <p>Administration &amp; Facilities</p>
      <p>Location</p>
      <p>Bangalore</p>
      <p>Job Type</p>
      <p>Full-Time</p>
      <p>Work Mode</p>
      <p>On-site</p>
      <p>Experience</p>
      <p>0-1 Years</p>
      <p>Date Posted</p>
      <p>24 July 2026</p>
      <h2>Apply for this Position</h2>
    </section>
  </body>
</html>
`

const principalResearchScientistDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Principal Research Scientist - Advanced Foundations &amp; Frontier Intelligence | Careers at CoRover</title>
  </head>
  <body>
    <section>
      <p>AI Research &amp; Development</p>
      <h1>Principal Research Scientist - Advanced Foundations &amp; Frontier Intelligence</h1>
      <p>
        Lead frontier intelligence research across foundation models, applied AI systems,
        and globally distributed enterprise programs.
      </p>
      <h2>Job Overview</h2>
      <p>Department</p>
      <p>AI Research &amp; Development</p>
      <p>Location</p>
      <p>Bengaluru, New Delhi, Mumbai - India; London - UK; Silicon Valley - US</p>
      <p>Job Type</p>
      <p>Full-Time</p>
      <p>Work Mode</p>
      <p>Hybrid</p>
      <p>Date Posted</p>
      <p>22 July 2026</p>
      <h2>Apply for this Position</h2>
    </section>
  </body>
</html>
`

const fullStackDeveloperDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Full Stack Developer | Careers at CoRover</title>
  </head>
  <body>
    <section>
      <p>Engineering</p>
      <h1>Full Stack Developer</h1>
      <p></p>
      <h2>Job Overview</h2>
      <p>Department</p>
      <p>Engineering</p>
      <p>Location</p>
      <p>Bengaluru, India</p>
      <p>Job Type</p>
      <p>Full-Time</p>
      <p>Work Mode</p>
      <p>On-site</p>
      <p>Date Posted</p>
      <p>19 July 2026</p>
      <h2>Apply for this Position</h2>
    </section>
  </body>
</html>
`

test('CoRover pins the verified first-party careers page and same-origin detail flow', async () => {
  const corover = await loadCoRoverModule()

  assert.equal(corover.SOURCE, 'corover')
  assert.equal(corover.COMPANY, 'CoRover')
  assert.equal(corover.VERIFIED_ON, '2026-07-30')
  assert.equal(corover.CAREERS_URL, 'https://corover.ai/company/careers')
  assert.equal(corover.hasOfficialCareersPageSignal(officialCareersPageHtml), true)
  assert.equal(corover.hasOfficialDetailPageSignal(programManagerDetailHtml), true)
})

test('CoRover run validates the official careers page and maps the current India job details', async () => {
  const corover = await loadCoRoverModule()
  const requestedUrls = []

  const jobs = await corover.createCoRoverScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === corover.CAREERS_URL) return officialCareersPageHtml
      if (url === 'https://corover.ai/company/careers/program-manager-technology-it') {
        return programManagerDetailHtml
      }
      if (url === 'https://corover.ai/company/careers/executive-assistant-admin') {
        return executiveAssistantDetailHtml
      }
      if (
        url
        === 'https://corover.ai/company/careers/principal-research-scientist-advanced-foundations-frontier-intelligence'
      ) {
        return principalResearchScientistDetailHtml
      }
      if (url === 'https://corover.ai/company/careers/full-stack-developer') {
        return fullStackDeveloperDetailHtml
      }

      throw new Error(`Unexpected CoRover fixture URL: ${url}`)
    },
    now: () => '2026-07-30T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    corover.CAREERS_URL,
    'https://corover.ai/company/careers/program-manager-technology-it',
    'https://corover.ai/company/careers/executive-assistant-admin',
    'https://corover.ai/company/careers/principal-research-scientist-advanced-foundations-frontier-intelligence',
    'https://corover.ai/company/careers/full-stack-developer',
  ])

  assert.deepEqual(jobs, [
    {
      title: 'Program Manager - Technology / IT',
      company: 'CoRover',
      department: 'Project & Program Management',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      link: 'https://corover.ai/company/careers/program-manager-technology-it',
      applyUrl: 'https://corover.ai/company/careers/program-manager-technology-it',
      sourceUrl: 'https://corover.ai/company/careers/program-manager-technology-it',
      source: 'corover',
      jobId: 'program-manager-technology-it',
      requisitionId: 'program-manager-technology-it',
      employmentType: 'Full-Time',
      experienceRequired: '5-10 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-24',
      closingDate: null,
      jobDescription:
        'As a Technical Program Manager, you will own the complete lifecycle of strategic AI products and platforms from product planning and roadmap definition to engineering execution, customer rollout, and continuous improvement. Ensure timely delivery of high-quality product releases.',
      remoteStatus: 'Hybrid',
      scrapedAt: '2026-07-30T00:00:00.000Z',
    },
    {
      title: 'Executive Assistant/Admin',
      company: 'CoRover',
      department: 'Administration & Facilities',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      link: 'https://corover.ai/company/careers/executive-assistant-admin',
      applyUrl: 'https://corover.ai/company/careers/executive-assistant-admin',
      sourceUrl: 'https://corover.ai/company/careers/executive-assistant-admin',
      source: 'corover',
      jobId: 'executive-assistant-admin',
      requisitionId: 'executive-assistant-admin',
      employmentType: 'Full-Time',
      experienceRequired: '0-1 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-24',
      closingDate: null,
      jobDescription:
        'Support leadership with scheduling, coordination, travel planning, document management, and office administration for a fast-moving AI business.',
      remoteStatus: 'On-site',
      scrapedAt: '2026-07-30T00:00:00.000Z',
    },
    {
      title: 'Principal Research Scientist - Advanced Foundations & Frontier Intelligence',
      company: 'CoRover',
      department: 'AI Research & Development',
      location: 'Bengaluru, New Delhi, Mumbai - India; London - UK; Silicon Valley - US',
      city: 'Bengaluru',
      country: 'India',
      link: 'https://corover.ai/company/careers/principal-research-scientist-advanced-foundations-frontier-intelligence',
      applyUrl: 'https://corover.ai/company/careers/principal-research-scientist-advanced-foundations-frontier-intelligence',
      sourceUrl: 'https://corover.ai/company/careers/principal-research-scientist-advanced-foundations-frontier-intelligence',
      source: 'corover',
      jobId: 'principal-research-scientist-advanced-foundations-frontier-intelligence',
      requisitionId: 'principal-research-scientist-advanced-foundations-frontier-intelligence',
      employmentType: 'Full-Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-22',
      closingDate: null,
      jobDescription:
        'Lead frontier intelligence research across foundation models, applied AI systems, and globally distributed enterprise programs.',
      remoteStatus: 'Hybrid',
      scrapedAt: '2026-07-30T00:00:00.000Z',
    },
    {
      title: 'Full Stack Developer',
      company: 'CoRover',
      department: 'Engineering',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      country: 'India',
      link: 'https://corover.ai/company/careers/full-stack-developer',
      applyUrl: 'https://corover.ai/company/careers/full-stack-developer',
      sourceUrl: 'https://corover.ai/company/careers/full-stack-developer',
      source: 'corover',
      jobId: 'full-stack-developer',
      requisitionId: 'full-stack-developer',
      employmentType: 'Full-Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-19',
      closingDate: null,
      jobDescription: 'Apply via the CoRover careers page.',
      remoteStatus: 'On-site',
      scrapedAt: '2026-07-30T00:00:00.000Z',
    },
  ])
})

test('CoRover fails closed when the verified careers page or detail contract changes', async () => {
  const corover = await loadCoRoverModule()

  await assert.rejects(
    corover.createCoRoverScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /verified official careers page/i,
  )

  await assert.rejects(
    corover.createCoRoverScraper().run({
      fetchText: async (url) => {
        if (url === corover.CAREERS_URL) return officialCareersPageHtml
        return '<html><body><h1>Program Manager</h1></body></html>'
      },
    }),
    /verified detail page/i,
  )
})
