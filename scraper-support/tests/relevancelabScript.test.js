import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_HTML = `
  <html>
    <head>
      <title>Careers | Relevance Lab</title>
    </head>
    <body>
      <h1>Work that Makes a Difference</h1>
      <h2>Explore Job Opportunities</h2>
      <div class="job_wrapper_accordion">
        <div class="job_accordion_toggle">
          <h3>India</h3>
          <div class="job_counter">No Opening Yet</div>
        </div>
        <nav class="job_accordion_list_wrapper">
          <div role="list" class="w-dyn-items">
            <div role="listitem" class="job_offer_wrapper w-dyn-item">
              <h4>Gen AI QA Engineer</h4>
              <a href="/careers/gen-ai-qa-engineer" class="job_apply_link w-inline-block">
                <div class="job_apply_link_txt">Apply</div>
              </a>
            </div>
            <div role="listitem" class="job_offer_wrapper w-dyn-item">
              <h4>Solution Cloud Data Architect</h4>
              <a href="/careers/solution-cloud-data-architect" class="job_apply_link w-inline-block">
                <div class="job_apply_link_txt">Apply</div>
              </a>
            </div>
          </div>
        </nav>
      </div>
      <div class="job_wrapper_accordion">
        <div class="job_accordion_toggle">
          <h4>USA</h4>
          <div class="job_counter">No Opening Yet</div>
        </div>
        <nav class="job_accordion_list_wrapper">
          <div role="list" class="w-dyn-items">
            <div role="listitem" class="job_offer_wrapper w-dyn-item">
              <h4>Systems Analyst</h4>
              <a href="/careers/systems-analyst" class="job_apply_link w-inline-block">
                <div class="job_apply_link_txt">Apply</div>
              </a>
            </div>
          </div>
        </nav>
      </div>
    </body>
  </html>
`

const DETAIL_HTML = {
  'https://www.relevancelab.com/careers/gen-ai-qa-engineer': `
    <html>
      <head>
        <title>Gen AI QA Engineer</title>
      </head>
      <body>
        <h1>Gen AI QA Engineer</h1>
        <h2>Location</h2>
        <p>Bengaluru | India</p>
        <h2>Work Mode</h2>
        <p>Hybrid</p>
        <h2>Commitment</h2>
        <p>Full-Time</p>
        <h2>No of Positions</h2>
        <p>1</p>
        <h2>Experience</h2>
        <p>4-6 years</p>
        <h2>Required Skills</h2>
        <p>Gen AI, LLM, Manual Testing and Unit Testing</p>
        <h2>Job Description</h2>
        <ul>
          <li>Design, develop, and implement GenAI models using Python and deep learning frameworks.</li>
          <li>Implement and execute tests to ensure the functionality of the GenAI models.</li>
        </ul>
        <h2>How to Apply</h2>
        <p>Be part of a collaborative, fast-paced team.</p>
      </body>
    </html>
  `,
  'https://www.relevancelab.com/careers/solution-cloud-data-architect': `
    <html>
      <head>
        <title>Solution Cloud Data Architect</title>
      </head>
      <body>
        <h1>Solution Cloud Data Architect</h1>
        <h2>Location</h2>
        <p>Bengaluru | India</p>
        <h2>Work Mode</h2>
        <p>Hybrid</p>
        <h2>Commitment</h2>
        <p>Full-Time</p>
        <h2>No of Positions</h2>
        <p>1</p>
        <h2>Experience</h2>
        <p>12-18 years</p>
        <h2>Required Skills</h2>
        <p>Azure Data bricks, Azure Data, Snowflake, Solutioning Cloud</p>
        <h2>Job Description</h2>
        <ul>
          <li>Lead the design and implementation of cloud-based data architectures.</li>
        </ul>
        <h2>How to Apply</h2>
        <p>Bring your data architecture experience to Relevance Lab.</p>
      </body>
    </html>
  `,
}

const loadRelevanceLabModule = async () => {
  try {
    return await import('../../scraper/relevancelab/script.js')
  } catch {
    assert.fail('Expected Relevance Lab scraper module at ../../scraper/relevancelab/script.js')
  }
}

test('extractIndiaJobCards keeps only India Relevance Lab job cards from the first-party careers page', async () => {
  const relevancelab = await loadRelevanceLabModule()

  assert.equal(relevancelab.hasOfficialCareersSignal(CAREERS_HTML), true)

  const cards = relevancelab.extractIndiaJobCards(CAREERS_HTML)

  assert.deepEqual(cards, [
    {
      title: 'Gen AI QA Engineer',
      detailUrl: 'https://www.relevancelab.com/careers/gen-ai-qa-engineer',
    },
    {
      title: 'Solution Cloud Data Architect',
      detailUrl: 'https://www.relevancelab.com/careers/solution-cloud-data-architect',
    },
  ])
})

test('extractJobDetail parses structured fields from a Relevance Lab job detail page', async () => {
  const relevancelab = await loadRelevanceLabModule()

  const job = relevancelab.extractJobDetail(
    'Solution Cloud Data Architect',
    'https://www.relevancelab.com/careers/solution-cloud-data-architect',
    DETAIL_HTML['https://www.relevancelab.com/careers/solution-cloud-data-architect'],
  )

  assert.deepEqual(job, {
    title: 'Solution Cloud Data Architect',
    company: 'Relevance Lab',
    department: null,
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    state: null,
    country: 'India',
    jobId: 'solution-cloud-data-architect',
    requisitionId: 'solution-cloud-data-architect',
    sourceUrl: 'https://www.relevancelab.com/careers/solution-cloud-data-architect',
    applyUrl: 'https://www.relevancelab.com/careers/solution-cloud-data-architect',
    employmentType: 'Full-Time',
    experienceRequired: '12-18 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['Azure Data bricks', 'Azure Data', 'Snowflake', 'Solutioning Cloud'],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Lead the design and implementation of cloud-based data architectures.',
  })
})

test('run fetches the verified Relevance Lab careers page and decorates India jobs', async () => {
  const relevancelab = await loadRelevanceLabModule()
  const requestedUrls = []

  const jobs = await relevancelab.createRelevanceLabScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return DETAIL_HTML[url] || CAREERS_HTML
    },
  })

  assert.deepEqual(requestedUrls, [
    relevancelab.CAREERS_URL,
    'https://www.relevancelab.com/careers/gen-ai-qa-engineer',
    'https://www.relevancelab.com/careers/solution-cloud-data-architect',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'relevancelab')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})
