import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/fulcrumdigital/script.js')
  } catch {
    assert.fail('Expected Fulcrum Digital scraper module at ../../scraper/fulcrumdigital/script.js')
  }
}

const jobsPayload = [
  {
    id: '156931000000111111',
    Job_Opening_Name: 'SOC Analyst',
    Posting_Title: 'SOC Analyst',
    Job_Type: 'Full time',
    Work_Experience: '3-5 years',
    Job_Description: 'Strengthen detection and incident response.',
    City: 'Pune',
    Country: 'India',
    Date_Opened: '2026-07-16',
    Remote_Job: false,
    Publish: true,
    Keep_on_Career_Site: false,
  },
  {
    id: '156931000000222222',
    Job_Opening_Name: 'AI QA Engineer',
    Posting_Title: 'AI QA Engineer',
    Job_Type: 'Full time',
    Work_Experience: '4-6 years',
    Job_Description: 'Validate AI-powered product releases.',
    City: 'Pune City',
    Country: 'India',
    Date_Opened: '2026-06-30',
    Remote_Job: false,
    Publish: true,
    Keep_on_Career_Site: false,
    $url: 'https://fulcrumdigital.zohorecruit.com/jobs/Careers/156931000000222222/AI-QA-Engineer?source=CareerSite',
  },
  {
    id: '156931000000999999',
    Job_Opening_Name: 'US Data Architect',
    Posting_Title: 'US Data Architect',
    Job_Type: 'Full time',
    Work_Experience: '8+ years',
    Job_Description: 'Out-of-scope non-India role.',
    City: 'Dallas',
    Country: 'United States',
    Date_Opened: '2026-07-01',
    Remote_Job: true,
    Publish: true,
    Keep_on_Career_Site: true,
  },
]

const portalHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs at Fulcrum Digital</title>
    <meta property="og:url" content="https://fulcrumdigital.zohorecruit.com/jobs/Careers">
  </head>
  <body>
    <input type="hidden" id="pageJson" value="{&quot;theme&quot;:&quot;default&quot;}">
    <input type="hidden" id="moduleMeta" value="[{&quot;api_name&quot;:&quot;Job_Openings&quot;}]">
    <input type="hidden" id="jobs" value="${
      JSON.stringify(jobsPayload).replaceAll('"', '&#34;')
    }">
    <input type="hidden" id="meta" value="{&quot;company_name&quot;:&quot;Fulcrum Digital&quot;,&quot;website&quot;:&quot;www.fulcrumdigital.com&quot;,&quot;list_url&quot;:&quot;https://fulcrumdigital.zohorecruit.com/jobs/Careers&quot;}">
  </body>
</html>
`

test('Fulcrum Digital constants stay pinned to the verified company-branded Zoho board', async () => {
  const fulcrum = await loadModule()

  assert.equal(fulcrum.SOURCE, 'fulcrumdigital')
  assert.equal(fulcrum.COMPANY, 'Fulcrum Digital')
  assert.equal(fulcrum.CAREERS_URL, 'https://fulcrumdigital.zohorecruit.com/careers')
  assert.equal(fulcrum.JOBS_BOARD_URL, 'https://fulcrumdigital.zohorecruit.com/jobs/Careers')
  assert.equal(fulcrum.hasOfficialPortalSignal(portalHtml), true)
})

test('Fulcrum Digital extracts India jobs from the hidden Zoho jobs input even when Keep_on_Career_Site is false', async () => {
  const fulcrum = await loadModule()

  assert.deepEqual(fulcrum.extractIndiaJobs(portalHtml), [
    {
      title: 'SOC Analyst',
      company: 'Fulcrum Digital',
      department: null,
      location: 'Pune, India',
      city: 'Pune',
      state: null,
      country: 'India',
      jobId: '156931000000111111',
      requisitionId: '156931000000111111',
      sourceUrl: 'https://fulcrumdigital.zohorecruit.com/jobs/Careers/156931000000111111/SOC-Analyst?source=CareerSite',
      applyUrl: 'https://fulcrumdigital.zohorecruit.com/jobs/Careers/156931000000111111/SOC-Analyst?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: '3-5 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-16',
      closingDate: null,
      jobDescription: 'Strengthen detection and incident response.',
      remoteStatus: 'On-site',
    },
    {
      title: 'AI QA Engineer',
      company: 'Fulcrum Digital',
      department: null,
      location: 'Pune City, India',
      city: 'Pune City',
      state: null,
      country: 'India',
      jobId: '156931000000222222',
      requisitionId: '156931000000222222',
      sourceUrl: 'https://fulcrumdigital.zohorecruit.com/jobs/Careers/156931000000222222/AI-QA-Engineer?source=CareerSite',
      applyUrl: 'https://fulcrumdigital.zohorecruit.com/jobs/Careers/156931000000222222/AI-QA-Engineer?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: '4-6 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-06-30',
      closingDate: null,
      jobDescription: 'Validate AI-powered product releases.',
      remoteStatus: 'On-site',
    },
  ])
})

test('Fulcrum Digital run validates the official board signal and decorates extracted India jobs', async () => {
  const fulcrum = await loadModule()
  const jobs = await fulcrum.createFulcrumDigitalScraper({ maxJobs: 1 }).run({
    fetchText: async () => portalHtml,
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'fulcrumdigital')
  assert.equal(
    jobs[0].link,
    'https://fulcrumdigital.zohorecruit.com/jobs/Careers/156931000000111111/SOC-Analyst?source=CareerSite',
  )
  assert.equal(jobs[0].scrapedAt, '2026-07-18T00:00:00.000Z')
})

test('Fulcrum Digital fails closed when the verified Zoho board signal disappears', async () => {
  const fulcrum = await loadModule()

  await assert.rejects(
    fulcrum.createFulcrumDigitalScraper().run({
      fetchText: async () => '<html><body>Unexpected page</body></html>',
    }),
    /verified Fulcrum Digital careers board/i,
  )
})
