import assert from 'node:assert/strict'
import test from 'node:test'

const loadThinkRoboticsModule = async () => {
  try {
    return await import('../../scraper/thinkrobotics/script.js')
  } catch {
    assert.fail('Expected ThinkRobotics scraper module at ../../scraper/thinkrobotics/script.js')
  }
}

const careersPageHtml = `
  <html>
    <body>
      <a href="https://jobs.thinkrobotics.com/jobs/Careers">Careers</a>
      <footer>
        ThinkRobotics is a registered trademark of Atlantis Robotics Private Limited.
      </footer>
    </body>
  </html>
`

const jobsPayload = [
  {
    id: '156931000000333156',
    Job_Opening_Name: 'Technical Content Creator',
    Posting_Title: 'Technical Content Creator',
    Job_Type: 'Training',
    Work_Experience: 'Fresher',
    Job_Description: 'Create beginner-friendly robotics content.',
    City: 'Delhi',
    Country: 'India',
    Date_Opened: '2025-01-21',
    Remote_Job: false,
    Publish: true,
    Keep_on_Career_Site: false,
  },
  {
    id: '156931000000416022',
    Job_Opening_Name: 'Search Engine Optimization Specialist',
    Posting_Title: 'Search Engine Optimization Specialist',
    Job_Type: 'Full time',
    Work_Experience: '1-3 years',
    Job_Description: 'Own organic growth across the catalog.',
    City: 'New Delhi',
    Country: 'India',
    Date_Opened: '2025-04-18',
    Remote_Job: false,
    Publish: true,
    Keep_on_Career_Site: true,
  },
  {
    id: '156931000000521001',
    Job_Opening_Name: 'Semi-Conductor Sales Associate',
    Posting_Title: 'Semi-Conductor Sales Associate',
    Job_Type: 'Full time',
    Work_Experience: '4-5 years',
    Job_Description: 'Grow semiconductor distribution partnerships.',
    City: 'New Delhi',
    Country: 'India',
    Date_Opened: '2025-07-21',
    Remote_Job: false,
    Publish: true,
    Keep_on_Career_Site: false,
  },
  {
    id: '156931000001003001',
    Job_Opening_Name: 'Manager – Sales',
    Posting_Title: 'Manager – Sales',
    Job_Type: 'Full time',
    Work_Experience: '5+ years',
    Job_Description: 'Lead the India sales motion.',
    City: 'New Delhi',
    Country: 'India',
    Date_Opened: '2026-02-26',
    Remote_Job: false,
    Publish: true,
    Keep_on_Career_Site: false,
  },
  {
    id: '156931000009999999',
    Job_Opening_Name: 'US Robotics Partnerships Lead',
    Posting_Title: 'US Robotics Partnerships Lead',
    Job_Type: 'Full time',
    Work_Experience: '6+ years',
    Job_Description: 'Out-of-scope non-India role.',
    City: 'Austin',
    Country: 'United States',
    Date_Opened: '2026-03-01',
    Remote_Job: true,
    Publish: true,
    Keep_on_Career_Site: true,
  },
]

const portalHtml = `
  <html>
    <head>
      <title>Jobs at ThinkRobotics - Atlantis Robotics Pvt. Ltd.</title>
      <meta property="og:url" content="https://jobs.thinkrobotics.com/jobs/Careers">
    </head>
    <body>
      <input type="hidden" id="pageJson" value="{&quot;theme&quot;:&quot;default&quot;}">
      <input type="hidden" id="moduleMeta" value="[{&quot;api_name&quot;:&quot;Job_Openings&quot;}]">
      <input type="hidden" id="jobs" value="${
        JSON.stringify(jobsPayload).replaceAll('"', '&#34;')
      }">
    </body>
  </html>
`

test('ThinkRobotics constants stay pinned to the verified official homepage and public jobs portal', async () => {
  const thinkrobotics = await loadThinkRoboticsModule()

  assert.equal(thinkrobotics.CAREERS_PAGE_URL, 'https://thinkrobotics.com/')
  assert.equal(thinkrobotics.CAREERS_PORTAL_URL, 'https://jobs.thinkrobotics.com/jobs/Careers')
  assert.equal(thinkrobotics.COMPANY, 'Atlantis Robotics Pvt. Ltd.')
  assert.equal(thinkrobotics.SOURCE, 'thinkrobotics')
  assert.equal(thinkrobotics.hasOfficialCareersPageSignal(careersPageHtml), true)
  assert.equal(thinkrobotics.hasOfficialPortalSignal(portalHtml), true)
})

test('extractIndiaJobs keeps the visible India ThinkRobotics openings even when Zoho Keep_on_Career_Site is false', async () => {
  const thinkrobotics = await loadThinkRoboticsModule()

  assert.deepEqual(thinkrobotics.extractIndiaJobs(portalHtml), [
    {
      title: 'Technical Content Creator',
      company: 'Atlantis Robotics Pvt. Ltd.',
      department: null,
      location: 'Delhi, India',
      city: 'Delhi',
      state: null,
      country: 'India',
      jobId: '156931000000333156',
      requisitionId: '156931000000333156',
      sourceUrl: 'https://jobs.thinkrobotics.com/jobs/Careers/156931000000333156/Technical-Content-Creator?source=CareerSite',
      applyUrl: 'https://jobs.thinkrobotics.com/jobs/Careers/156931000000333156/Technical-Content-Creator?source=CareerSite',
      employmentType: 'Training',
      experienceRequired: 'Fresher',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2025-01-21',
      closingDate: null,
      jobDescription: 'Create beginner-friendly robotics content.',
      remoteStatus: 'On-site',
    },
    {
      title: 'Search Engine Optimization Specialist',
      company: 'Atlantis Robotics Pvt. Ltd.',
      department: null,
      location: 'New Delhi, India',
      city: 'New Delhi',
      state: null,
      country: 'India',
      jobId: '156931000000416022',
      requisitionId: '156931000000416022',
      sourceUrl: 'https://jobs.thinkrobotics.com/jobs/Careers/156931000000416022/Search-Engine-Optimization-Specialist?source=CareerSite',
      applyUrl: 'https://jobs.thinkrobotics.com/jobs/Careers/156931000000416022/Search-Engine-Optimization-Specialist?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: '1-3 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2025-04-18',
      closingDate: null,
      jobDescription: 'Own organic growth across the catalog.',
      remoteStatus: 'On-site',
    },
    {
      title: 'Semi-Conductor Sales Associate',
      company: 'Atlantis Robotics Pvt. Ltd.',
      department: null,
      location: 'New Delhi, India',
      city: 'New Delhi',
      state: null,
      country: 'India',
      jobId: '156931000000521001',
      requisitionId: '156931000000521001',
      sourceUrl: 'https://jobs.thinkrobotics.com/jobs/Careers/156931000000521001/Semi-Conductor-Sales-Associate?source=CareerSite',
      applyUrl: 'https://jobs.thinkrobotics.com/jobs/Careers/156931000000521001/Semi-Conductor-Sales-Associate?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: '4-5 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2025-07-21',
      closingDate: null,
      jobDescription: 'Grow semiconductor distribution partnerships.',
      remoteStatus: 'On-site',
    },
    {
      title: 'Manager – Sales',
      company: 'Atlantis Robotics Pvt. Ltd.',
      department: null,
      location: 'New Delhi, India',
      city: 'New Delhi',
      state: null,
      country: 'India',
      jobId: '156931000001003001',
      requisitionId: '156931000001003001',
      sourceUrl: 'https://jobs.thinkrobotics.com/jobs/Careers/156931000001003001/Manager-%E2%80%93-Sales?source=CareerSite',
      applyUrl: 'https://jobs.thinkrobotics.com/jobs/Careers/156931000001003001/Manager-%E2%80%93-Sales?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: '5+ years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-02-26',
      closingDate: null,
      jobDescription: 'Lead the India sales motion.',
      remoteStatus: 'On-site',
    },
  ])
})

test('run validates the official ThinkRobotics homepage handoff and decorates public jobs from the portal', async () => {
  const thinkrobotics = await loadThinkRoboticsModule()
  const requestedUrls = []

  const jobs = await thinkrobotics.createThinkRoboticsScraper({ maxJobs: 2 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === thinkrobotics.CAREERS_PAGE_URL) return careersPageHtml
      if (url === thinkrobotics.CAREERS_PORTAL_URL) return portalHtml

      assert.fail(`Unexpected HTML request: ${url}`)
    },
    now: () => '2026-07-10T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    'https://thinkrobotics.com/',
    'https://jobs.thinkrobotics.com/jobs/Careers',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'thinkrobotics')
  assert.equal(
    jobs[0].link,
    'https://jobs.thinkrobotics.com/jobs/Careers/156931000000333156/Technical-Content-Creator?source=CareerSite',
  )
  assert.equal(jobs[0].scrapedAt, '2026-07-10T00:00:00.000Z')
})

test('run fails closed when the verified ThinkRobotics portal signal disappears', async () => {
  const thinkrobotics = await loadThinkRoboticsModule()

  await assert.rejects(
    thinkrobotics.createThinkRoboticsScraper().run({
      fetchText: async (url) => {
        if (url === thinkrobotics.CAREERS_PAGE_URL) return careersPageHtml
        return '<html><body>Unexpected page</body></html>'
      },
    }),
    /official ThinkRobotics careers portal/i,
  )
})
