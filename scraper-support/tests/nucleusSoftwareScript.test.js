import assert from 'node:assert/strict'
import test from 'node:test'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Nucleus Software: Join Our Dynamic Team of Innovators</title>
    <meta
      name="description"
      content="Join Nucleus Software to lead innovation in lending and transaction banking. Explore rewarding fintech careers, professional growth, and a dynamic culture. Apply now!"
    >
    <link rel="canonical" href="https://www.nucleussoftware.com/careers/">
    <meta property="og:site_name" content="Nucleus Software">
  </head>
  <body>
    <footer>Copyright © 2026 Nucleus Software Exports Ltd. All rights reserved.</footer>
    <h1>Build Your Future Explore Exciting Career Opportunities with Nucleus Software</h1>
    <a href="https://nucleussoftware.zohorecruit.in/jobs/Careers">Open Positions</a>
    <a href="https://nucleussoftware.zohorecruit.in/jobs/Careers">Explore opportunities</a>
    <a href="https://nucleussoftware.zohorecruit.in/jobs/Careers">Search Job Opportunities</a>
  </body>
</html>
`

const publicJobsPayload = {
  code: 'success',
  data: [
    {
      Client_Name: { name: 'CLOUD- CUSTOMER ENABLEMENT', id: '45488000015810534' },
      Posting_Title: 'Java Production Support Engineer',
      City: 'NOIDA',
      State: 'Uttar Pradesh',
      Country: 'India',
      Job_Description:
        'Production Support to support enterprise lending platforms. Analyze logs and deliver effective solutions.',
      Work_Experience: '4-8 Years',
      Job_Type: 'Offshore',
      Job_Opening_Name: 'Java Production Support Engineer',
      $url: 'https://nucleussoftware.zohorecruit.in/jobs/Careers/45488000015810540/Java-Production-Support-Engineer?source=CareerSite',
      id: '45488000015810540',
      Date_Opened: '14/05/2026',
      Remote_Job: false,
    },
    {
      Client_Name: { name: 'ENTERPRISE ANALYTICS', id: '45488000015810535' },
      Posting_Title: 'Data Analyst Intern',
      City: 'Mumbai',
      State: 'Maharashtra',
      Country: 'India',
      Job_Description:
        'Support reporting, build dashboards, and help business teams with data insights.',
      Work_Experience: null,
      Job_Type: 'Internship',
      Job_Opening_Name: 'Data Analyst Intern',
      $url: 'https://nucleussoftware.zohorecruit.in/jobs/Careers/45488000015810541/Data-Analyst-Intern?source=CareerSite',
      id: '45488000015810541',
      Date_Opened: '01/07/2026',
      Remote_Job: true,
    },
    {
      Client_Name: { name: 'GLOBAL SALES', id: '45488000015810536' },
      Posting_Title: 'Manager Sales',
      City: 'Tokyo',
      State: null,
      Country: 'Japan',
      Job_Description: 'Japan role that should be filtered out by the India provider.',
      Work_Experience: '10+ Years',
      Job_Type: 'Full-time',
      Job_Opening_Name: 'Manager Sales',
      $url: 'https://nucleussoftware.zohorecruit.in/jobs/Careers/45488000019250142/BDG---Manager-Sales?source=CareerSite',
      id: '45488000019250142',
      Date_Opened: '21/05/2026',
      Remote_Job: false,
    },
  ],
}

const loadNucleusSoftwareModule = async () => {
  try {
    return await import('../../scraper/nucleussoftware/script.js')
  } catch {
    assert.fail('Expected Nucleus Software scraper module at ../../scraper/nucleussoftware/script.js')
  }
}

test('Nucleus Software helper contract stays pinned to the verified careers page and public Zoho jobs feed', async () => {
  const nucleusSoftware = await loadNucleusSoftwareModule()

  assert.equal(nucleusSoftware.SOURCE, 'nucleussoftware')
  assert.equal(nucleusSoftware.COMPANY, 'Nucleus Software')
  assert.equal(nucleusSoftware.OFFICIAL_BRAND_NAME, 'Nucleus Software Exports Ltd.')
  assert.equal(nucleusSoftware.VERIFIED_ON, '2026-08-03')
  assert.equal(nucleusSoftware.HOMEPAGE_URL, 'https://www.nucleussoftware.com/')
  assert.equal(nucleusSoftware.CAREERS_URL, 'https://www.nucleussoftware.com/careers/')
  assert.equal(nucleusSoftware.CAREERS_PORTAL_URL, 'https://nucleussoftware.zohorecruit.in/jobs/Careers')
  assert.equal(
    nucleusSoftware.CAREERS_API_URL,
    'https://nucleussoftware.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(nucleusSoftware.hasOfficialCareersPageSignal(officialCareersHtml), true)
  assert.deepEqual(nucleusSoftware.extractIndiaJobs(publicJobsPayload), [
    {
      title: 'Java Production Support Engineer',
      company: 'Nucleus Software',
      department: 'CLOUD- CUSTOMER ENABLEMENT',
      location: 'Noida, Uttar Pradesh, India',
      city: 'Noida',
      state: 'Uttar Pradesh',
      country: 'India',
      jobId: '45488000015810540',
      requisitionId: '45488000015810540',
      sourceUrl: 'https://nucleussoftware.zohorecruit.in/jobs/Careers/45488000015810540/Java-Production-Support-Engineer?source=CareerSite',
      applyUrl: 'https://nucleussoftware.zohorecruit.in/jobs/Careers/45488000015810540/Java-Production-Support-Engineer?source=CareerSite',
      employmentType: 'Offshore',
      experienceRequired: '4-8 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-05-14',
      closingDate: null,
      jobDescription:
        'Production Support to support enterprise lending platforms. Analyze logs and deliver effective solutions.',
      remoteStatus: 'On-site',
    },
    {
      title: 'Data Analyst Intern',
      company: 'Nucleus Software',
      department: 'ENTERPRISE ANALYTICS',
      location: 'Mumbai, Maharashtra, India',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      jobId: '45488000015810541',
      requisitionId: '45488000015810541',
      sourceUrl: 'https://nucleussoftware.zohorecruit.in/jobs/Careers/45488000015810541/Data-Analyst-Intern?source=CareerSite',
      applyUrl: 'https://nucleussoftware.zohorecruit.in/jobs/Careers/45488000015810541/Data-Analyst-Intern?source=CareerSite',
      employmentType: 'Internship',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-01',
      closingDate: null,
      jobDescription:
        'Support reporting, build dashboards, and help business teams with data insights.',
      remoteStatus: 'Remote',
    },
  ])
})

test('Nucleus Software run keeps only India jobs from the verified public feed and stamps a stable scrape time', async () => {
  const nucleusSoftware = await loadNucleusSoftwareModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await nucleusSoftware.createNucleusSoftwareScraper({
    now: () => '2026-08-03T10:45:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      if (url === nucleusSoftware.CAREERS_URL) return officialCareersHtml
      throw new Error(`Unexpected Nucleus Software HTML URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      if (url === nucleusSoftware.CAREERS_API_URL) return publicJobsPayload
      throw new Error(`Unexpected Nucleus Software JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTextUrls, [nucleusSoftware.CAREERS_URL])
  assert.deepEqual(requestedJsonUrls, [nucleusSoftware.CAREERS_API_URL])
  assert.deepEqual(jobs, [
    {
      title: 'Java Production Support Engineer',
      company: 'Nucleus Software',
      department: 'CLOUD- CUSTOMER ENABLEMENT',
      location: 'Noida, Uttar Pradesh, India',
      city: 'Noida',
      state: 'Uttar Pradesh',
      country: 'India',
      jobId: '45488000015810540',
      requisitionId: '45488000015810540',
      sourceUrl: 'https://nucleussoftware.zohorecruit.in/jobs/Careers/45488000015810540/Java-Production-Support-Engineer?source=CareerSite',
      applyUrl: 'https://nucleussoftware.zohorecruit.in/jobs/Careers/45488000015810540/Java-Production-Support-Engineer?source=CareerSite',
      employmentType: 'Offshore',
      experienceRequired: '4-8 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-05-14',
      closingDate: null,
      jobDescription:
        'Production Support to support enterprise lending platforms. Analyze logs and deliver effective solutions.',
      remoteStatus: 'On-site',
      source: 'nucleussoftware',
      link: 'https://nucleussoftware.zohorecruit.in/jobs/Careers/45488000015810540/Java-Production-Support-Engineer?source=CareerSite',
      scrapedAt: '2026-08-03T10:45:00.000Z',
    },
    {
      title: 'Data Analyst Intern',
      company: 'Nucleus Software',
      department: 'ENTERPRISE ANALYTICS',
      location: 'Mumbai, Maharashtra, India',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      jobId: '45488000015810541',
      requisitionId: '45488000015810541',
      sourceUrl: 'https://nucleussoftware.zohorecruit.in/jobs/Careers/45488000015810541/Data-Analyst-Intern?source=CareerSite',
      applyUrl: 'https://nucleussoftware.zohorecruit.in/jobs/Careers/45488000015810541/Data-Analyst-Intern?source=CareerSite',
      employmentType: 'Internship',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-01',
      closingDate: null,
      jobDescription:
        'Support reporting, build dashboards, and help business teams with data insights.',
      remoteStatus: 'Remote',
      source: 'nucleussoftware',
      link: 'https://nucleussoftware.zohorecruit.in/jobs/Careers/45488000015810541/Data-Analyst-Intern?source=CareerSite',
      scrapedAt: '2026-08-03T10:45:00.000Z',
    },
  ])
})

test('Nucleus Software fails closed when the verified careers page or public jobs feed drifts', async () => {
  const nucleusSoftware = await loadNucleusSoftwareModule()

  await assert.rejects(
    nucleusSoftware.createNucleusSoftwareScraper().run({
      fetchText: async () => '<html><body><h1>Placeholder</h1></body></html>',
      fetchJson: async () => publicJobsPayload,
    }),
    /verified official Nucleus Software careers page/i,
  )

  await assert.rejects(
    nucleusSoftware.createNucleusSoftwareScraper().run({
      fetchText: async () => officialCareersHtml,
      fetchJson: async () => ({ code: 'success', data: { broken: true } }),
    }),
    /public jobs api/i,
  )
})
