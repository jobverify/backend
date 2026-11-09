import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T12:45:00.000Z'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Searching for a genuine career opportunity?</title>
    <link rel="canonical" href="https://www.sumologic.com/company/careers" />
    <meta
      name="description"
      content="Is your career in the cloud? For a rewarding career with endless growth potential, join Sumo Logic and be on the front line of the advanced log analytics revolution. Find openings and internship opportunities."
    />
  </head>
  <body>
    <main>
      <p>Work With Us</p>
      <h1>Help make the digital world faster, reliable, and secure</h1>
    </main>
  </body>
</html>
`

const officialCareersMarkdown = `
---
title: "Searching for a genuine career opportunity?"
page_name: "Careers"
url: "https://www.sumologic.com/company/careers"
canonical: "https://www.sumologic.com/company/careers"
markdown_url: "https://www.sumologic.com/company/careers.md"
excerpt: "Is your career in the cloud? For a rewarding career with endless growth potential, join Sumo Logic and be on the front line of the advanced log analytics revolution. Find openings and internship opportunities."
---

Work With Us

# Help make the digital world faster, reliable, and secure

[View openings](#openings)
`

const greenhousePayload = {
  jobs: [
    {
      id: 7882141,
      title: 'Senior Backend Engineer - Distributed Systems & Agentic AI',
      location: { name: 'Noida, Uttar Pradesh, India' },
      absolute_url: 'https://job-boards.greenhouse.io/sumologic/jobs/7882141',
      requisition_id: '4064',
      company_name: 'Sumo Logic',
      updated_at: '2026-07-15T08:36:57-04:00',
      first_published: '2026-05-04T03:02:43-04:00',
      content: `
        &lt;h2&gt;&lt;strong&gt;Senior Software Engineer - Distributed Systems &amp;amp; Agentic AI&lt;/strong&gt;&lt;/h2&gt;
        &lt;h3&gt;&lt;strong&gt;Location:&lt;/strong&gt; Bangalore or Noida&lt;/h3&gt;
        &lt;h3&gt;&lt;strong&gt;About the Role&lt;/strong&gt;&lt;/h3&gt;
        &lt;p&gt;Build backend systems that reliably ingest, manage, and process large-scale machine data while delivering real-time insight.&lt;/p&gt;
        &lt;h3&gt;&lt;strong&gt;Required Qualifications&lt;/strong&gt;&lt;/h3&gt;
        &lt;ul&gt;
          &lt;li&gt;BTech, MTech, or equivalent in Computer Science, Data Science, or a related discipline.&lt;/li&gt;
          &lt;li&gt;4-6 years of industry experience with a proven track record of ownership and delivery.&lt;/li&gt;
        &lt;/ul&gt;
      `,
      departments: [{ name: 'Software Engineering' }],
      offices: [{ location: 'Noida, Uttar Pradesh, India' }],
      metadata: [{ name: 'Office Requirement', value: 'Hybrid' }],
    },
    {
      id: 7927113,
      title: 'Product Manager',
      location: { name: 'Bangalore, Karnataka, India' },
      absolute_url: 'https://job-boards.greenhouse.io/sumologic/jobs/7927113',
      requisition_id: '4075',
      company_name: 'Sumo Logic',
      updated_at: '2026-07-15T08:36:57-04:00',
      first_published: '2026-05-19T02:57:13-04:00',
      content: `
        &lt;h2&gt;Product Manager&lt;/h2&gt;
        &lt;p&gt;Drive product strategy for security operations workflows and AI-assisted experiences.&lt;/p&gt;
      `,
      departments: [{ name: 'Product Management' }],
      offices: [{ location: 'Bangalore, Karnataka, India' }],
      metadata: [{ name: 'Office Requirement', value: 'Hybrid' }],
    },
    {
      id: 7065821,
      title: 'Talent Pipeline - Product Engineering',
      location: { name: 'Remote, India' },
      absolute_url: 'https://job-boards.greenhouse.io/sumologic/jobs/7065821',
      requisition_id: null,
      company_name: 'Sumo Logic',
      updated_at: '2026-07-15T08:36:57-04:00',
      first_published: '2025-07-11T13:01:45-04:00',
      content: '&lt;p&gt;Join our India product engineering talent pipeline.&lt;/p&gt;',
      departments: [{ name: 'Engineering' }],
      offices: [{ location: 'Remote, India' }],
      metadata: [{ name: 'Office Requirement', value: 'Remote' }],
    },
    {
      id: 7306781,
      title: 'AI Tech Lead - Staff Machine Learning Engineer',
      location: { name: 'United States' },
      absolute_url: 'https://job-boards.greenhouse.io/sumologic/jobs/7306781',
      requisition_id: '3886',
      company_name: 'Sumo Logic',
      updated_at: '2026-07-15T08:36:56-04:00',
      first_published: '2026-01-26T14:25:16-05:00',
      content: '&lt;p&gt;US-only role.&lt;/p&gt;',
      departments: [{ name: 'Software Engineering' }],
      offices: [{ location: 'United States' }],
      metadata: [{ name: 'Office Requirement', value: 'Remote' }],
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/sumologic/script.js')
  } catch {
    assert.fail('Expected Sumo Logic scraper module at ../../scraper/sumologic/script.js')
  }
}

test('Sumo Logic helpers stay pinned to the verified first-party careers shell and public Greenhouse API contract', async () => {
  const sumoLogic = await loadModule()

  assert.equal(sumoLogic.SOURCE, 'sumologic')
  assert.equal(sumoLogic.COMPANY, 'Sumo Logic')
  assert.equal(sumoLogic.CAREERS_URL, 'https://www.sumologic.com/company/careers')
  assert.equal(sumoLogic.CAREERS_MARKDOWN_URL, 'https://www.sumologic.com/company/careers.md')
  assert.equal(sumoLogic.GREENHOUSE_BOARD_URL, 'https://job-boards.greenhouse.io/sumologic')
  assert.equal(
    sumoLogic.buildGreenhouseJobsApiUrl(),
    'https://boards-api.greenhouse.io/v1/boards/sumologic/jobs?content=true',
  )
  assert.equal(sumoLogic.VERIFIED_ON, '2026-07-17')
  assert.equal(sumoLogic.hasOfficialCareersPageSignal(officialCareersHtml), true)
  assert.equal(sumoLogic.hasOfficialCareersMarkdownSignal(officialCareersMarkdown), true)

  const jobs = sumoLogic.extractIndiaJobsFromGreenhousePayload(greenhousePayload, {
    scrapedAt: FIXED_SCRAPED_AT,
  })

  assert.equal(jobs.length, 3)
  const backendRole = jobs.find((job) => job.title === 'Senior Backend Engineer - Distributed Systems & Agentic AI')
  assert.deepEqual(backendRole, {
    title: 'Senior Backend Engineer - Distributed Systems & Agentic AI',
    company: 'Sumo Logic',
    department: 'Software Engineering',
    location: 'Noida, Uttar Pradesh, India',
    city: 'Noida',
    country: 'India',
    jobId: 7882141,
    requisitionId: '4064',
    sourceUrl: 'https://job-boards.greenhouse.io/sumologic/jobs/7882141',
    applyUrl: 'https://job-boards.greenhouse.io/sumologic/jobs/7882141',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-05-04',
    closingDate: null,
    jobDescription:
      'Senior Software Engineer - Distributed Systems & Agentic AI Location: Bangalore or Noida About the Role Build backend systems that reliably ingest, manage, and process large-scale machine data while delivering real-time insight. Required Qualifications BTech, MTech, or equivalent in Computer Science, Data Science, or a related discipline. 4-6 years of industry experience with a proven track record of ownership and delivery.',
    remoteStatus: 'Hybrid',
    source: 'sumologic',
    link: 'https://job-boards.greenhouse.io/sumologic/jobs/7882141',
    scrapedAt: FIXED_SCRAPED_AT,
  })
})

test('Sumo Logic run validates the official careers surfaces before fetching the public Greenhouse jobs API', async () => {
  const sumoLogic = await loadModule()
  const requested = []

  const jobs = await sumoLogic.createSumoLogicScraper().run({
    fetchText: async (url) => {
      requested.push({ type: 'text', url })
      if (url === sumoLogic.CAREERS_URL) return officialCareersHtml
      if (url === sumoLogic.CAREERS_MARKDOWN_URL) return officialCareersMarkdown
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requested.push({ type: 'json', url, options })
      return greenhousePayload
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requested, [
    { type: 'text', url: sumoLogic.CAREERS_URL },
    { type: 'text', url: sumoLogic.CAREERS_MARKDOWN_URL },
    {
      type: 'json',
      url: 'https://boards-api.greenhouse.io/v1/boards/sumologic/jobs?content=true',
      options: { method: 'GET' },
    },
  ])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].companyCareerPage, 'https://www.sumologic.com/company/careers')
  assert.equal(jobs[0].companyDomain, 'sumologic.com')
  assert.equal(jobs[0].atsPlatform, 'greenhouse')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(jobs.at(-1).title, 'Talent Pipeline - Product Engineering')
  assert.equal(jobs.at(-1).remoteStatus, 'Remote')
})

test('Sumo Logic fails closed when the careers shell or Greenhouse payload drifts materially', async () => {
  const sumoLogic = await loadModule()

  await assert.rejects(
    sumoLogic.createSumoLogicScraper().run({
      fetchText: async (url) => {
        if (url === sumoLogic.CAREERS_URL) return '<html><body><h1>Unexpected</h1></body></html>'
        if (url === sumoLogic.CAREERS_MARKDOWN_URL) return officialCareersMarkdown
        throw new Error(`Unexpected text URL: ${url}`)
      },
      fetchJson: async () => greenhousePayload,
    }),
    /verified Sumo Logic careers page/i,
  )

  await assert.rejects(
    sumoLogic.createSumoLogicScraper().run({
      fetchText: async (url) => {
        if (url === sumoLogic.CAREERS_URL) return officialCareersHtml
        if (url === sumoLogic.CAREERS_MARKDOWN_URL) return officialCareersMarkdown.replace('[View openings](#openings)', 'No openings')
        throw new Error(`Unexpected text URL: ${url}`)
      },
      fetchJson: async () => greenhousePayload,
    }),
    /verified Sumo Logic careers markdown/i,
  )

  await assert.rejects(
    sumoLogic.createSumoLogicScraper().run({
      fetchText: async (url) => {
        if (url === sumoLogic.CAREERS_URL) return officialCareersHtml
        if (url === sumoLogic.CAREERS_MARKDOWN_URL) return officialCareersMarkdown
        throw new Error(`Unexpected text URL: ${url}`)
      },
      fetchJson: async () => ({
        jobs: [{
          ...greenhousePayload.jobs[0],
          company_name: 'Different Company',
        }],
      }),
    }),
    /Greenhouse jobs API no longer maps to the verified company identity/i,
  )
})
