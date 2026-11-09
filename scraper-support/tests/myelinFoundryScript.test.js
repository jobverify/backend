import assert from 'node:assert/strict'
import test from 'node:test'

const loadMyelinFoundryModule = async () => {
  try {
    return await import('../../scraper/myelinfoundry/script.js')
  } catch {
    assert.fail('Expected Myelin Foundry scraper module at ../../scraper/myelinfoundry/script.js')
  }
}

const verifiedHomepageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Myelin Foundry | Agentic AI Solutions for Industries</title>
    <link rel="canonical" href="https://www.myelinfoundry.ai/" />
  </head>
  <body>
    <main>
      <h2>Myelin Foundry</h2>
      <h3>Agentic AI on the Edge</h3>
      <p>Myelin Foundry is a deep-tech pioneer building agentic AI for real-time, for edge-first deployment.</p>
      <a href="https://www.myelinfoundry.ai/careers/">Careers</a>
      <p>communications@myelinfoundry.com</p>
      <p>Myelin Foundry Pvt. Ltd.</p>
    </main>
  </body>
</html>
`

const verifiedCareersHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Careers at Myelin Foundry | Build the Future with AI</title>
    <link rel="canonical" href="https://www.myelinfoundry.ai/careers/" />
  </head>
  <body>
    <main>
      <section>
        <h3>Life at Myelin</h3>
        <h3>Equal Opportunity Employer</h3>
        <h3>Job openings</h3>
        <p>Empowering Careers. Connecting Futures.</p>
        <div class="brxe-block bricks-lazy-hidden">
          <div class="brxe-block bricks-lazy-hidden">
            <h3 class="brxe-heading">Head of sales</h3>
          </div>
          <div class="brxe-block bricks-lazy-hidden">
            <a class="brxe-button bricks-button" href="https://www.myelinfoundry.ai/wp-content/uploads/2025/07/JD-for-Head-of-Sales-2.pdf" target="_blank">View Details</a>
            <span class="brxe-button bricks-button" data-interactions="[{&quot;templateId&quot;:&quot;664&quot;}]">Apply</span>
          </div>
        </div>
        <div class="brxe-block bricks-lazy-hidden">
          <div class="brxe-block bricks-lazy-hidden">
            <h3 class="brxe-heading">Senior QA Engineer</h3>
          </div>
          <div class="brxe-block bricks-lazy-hidden">
            <a class="brxe-button bricks-button" href="https://www.myelinfoundry.ai/wp-content/uploads/2026/02/JD-for-Senior-QA.pdf" target="_blank">View Details</a>
            <span class="brxe-button bricks-button" data-interactions="[{&quot;templateId&quot;:&quot;664&quot;}]">Apply</span>
          </div>
        </div>
        <div class="brxe-block bricks-lazy-hidden">
          <div class="brxe-block bricks-lazy-hidden">
            <h3 class="brxe-heading">Administrative Assistant</h3>
          </div>
          <div class="brxe-block bricks-lazy-hidden">
            <a class="brxe-button bricks-button" href="https://www.myelinfoundry.ai/wp-content/uploads/2026/02/JD-for-Administrative-Assistant.pdf" target="_blank">View Details</a>
            <span class="brxe-button bricks-button" data-interactions="[{&quot;templateId&quot;:&quot;664&quot;}]">Apply</span>
          </div>
        </div>
        <div class="brxe-block bricks-lazy-hidden">
          <div class="brxe-block bricks-lazy-hidden">
            <h3 class="brxe-heading">Android developer</h3>
          </div>
          <div class="brxe-block bricks-lazy-hidden">
            <a class="brxe-button bricks-button" href="https://www.myelinfoundry.ai/wp-content/uploads/2025/07/JD-for-Android-Developer-2.pdf" target="_blank">View Details</a>
            <span class="brxe-button bricks-button" data-interactions="[{&quot;templateId&quot;:&quot;622&quot;}]">Apply</span>
          </div>
        </div>
        <div class="brxe-block bricks-lazy-hidden">
          <div class="brxe-block bricks-lazy-hidden">
            <h3 class="brxe-heading">Senior QA Engineer</h3>
          </div>
          <div class="brxe-block bricks-lazy-hidden">
            <a class="brxe-button bricks-button" href="https://www.myelinfoundry.ai/wp-content/uploads/2025/09/Senior-QA.pdf" target="_blank">View Details</a>
            <span class="brxe-button bricks-button" data-interactions="[{&quot;templateId&quot;:&quot;622&quot;}]">Apply</span>
          </div>
        </div>
        <div class="brxe-block bricks-lazy-hidden">
          <div class="brxe-block bricks-lazy-hidden">
            <h3 class="brxe-heading">Product Engineer AI</h3>
          </div>
          <div class="brxe-block bricks-lazy-hidden">
            <a class="brxe-button bricks-button" href="https://www.myelinfoundry.ai/wp-content/uploads/2025/09/JD-for-Product-Engineer-30032022.docx" target="_blank">View Details</a>
            <span class="brxe-button bricks-button" data-interactions="[{&quot;templateId&quot;:&quot;622&quot;}]">Apply</span>
          </div>
        </div>
      </section>
    </main>
    <footer>
      <h3>Job Application - Head of sales</h3>
      <label>Upload your CV</label>
      <button>Submit</button>
      <p>communications@myelinfoundry.com</p>
      <p>Myelin Foundry Pvt. Ltd.</p>
    </footer>
  </body>
</html>
`

test('Myelin Foundry scraper validates the verified homepage and first-party careers jobs surface', async () => {
  const myelinFoundry = await loadMyelinFoundryModule()

  assert.equal(myelinFoundry.SOURCE, 'myelinfoundry')
  assert.equal(myelinFoundry.COMPANY, 'Myelin Foundry')
  assert.equal(myelinFoundry.HOMEPAGE_URL, 'https://myelinfoundry.com/')
  assert.equal(myelinFoundry.CAREERS_URL, 'https://www.myelinfoundry.ai/careers/')
  assert.equal(myelinFoundry.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(myelinFoundry.hasOfficialCareersSignal(verifiedCareersHtml), true)
  assert.deepEqual(myelinFoundry.extractCareerJobs(verifiedCareersHtml), [
    {
      title: 'Head of sales',
      company: 'Myelin Foundry',
      department: null,
      location: 'India',
      city: null,
      country: 'India',
      jobId: 'myelinfoundry-jd-for-head-of-sales-2',
      requisitionId: 'myelinfoundry-jd-for-head-of-sales-2',
      sourceUrl: 'https://www.myelinfoundry.ai/wp-content/uploads/2025/07/JD-for-Head-of-Sales-2.pdf',
      applyUrl: 'https://www.myelinfoundry.ai/careers/',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Official Myelin Foundry role details document for Head of sales. Review the first-party document and apply through the official Myelin Foundry careers page.',
    },
    {
      title: 'Senior QA Engineer',
      company: 'Myelin Foundry',
      department: null,
      location: 'India',
      city: null,
      country: 'India',
      jobId: 'myelinfoundry-jd-for-senior-qa',
      requisitionId: 'myelinfoundry-jd-for-senior-qa',
      sourceUrl: 'https://www.myelinfoundry.ai/wp-content/uploads/2026/02/JD-for-Senior-QA.pdf',
      applyUrl: 'https://www.myelinfoundry.ai/careers/',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Official Myelin Foundry role details document for Senior QA Engineer. Review the first-party document and apply through the official Myelin Foundry careers page.',
    },
    {
      title: 'Administrative Assistant',
      company: 'Myelin Foundry',
      department: null,
      location: 'India',
      city: null,
      country: 'India',
      jobId: 'myelinfoundry-jd-for-administrative-assistant',
      requisitionId: 'myelinfoundry-jd-for-administrative-assistant',
      sourceUrl: 'https://www.myelinfoundry.ai/wp-content/uploads/2026/02/JD-for-Administrative-Assistant.pdf',
      applyUrl: 'https://www.myelinfoundry.ai/careers/',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Official Myelin Foundry role details document for Administrative Assistant. Review the first-party document and apply through the official Myelin Foundry careers page.',
    },
    {
      title: 'Android developer',
      company: 'Myelin Foundry',
      department: null,
      location: 'India',
      city: null,
      country: 'India',
      jobId: 'myelinfoundry-jd-for-android-developer-2',
      requisitionId: 'myelinfoundry-jd-for-android-developer-2',
      sourceUrl: 'https://www.myelinfoundry.ai/wp-content/uploads/2025/07/JD-for-Android-Developer-2.pdf',
      applyUrl: 'https://www.myelinfoundry.ai/careers/',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Official Myelin Foundry role details document for Android developer. Review the first-party document and apply through the official Myelin Foundry careers page.',
    },
    {
      title: 'Senior QA Engineer',
      company: 'Myelin Foundry',
      department: null,
      location: 'India',
      city: null,
      country: 'India',
      jobId: 'myelinfoundry-senior-qa',
      requisitionId: 'myelinfoundry-senior-qa',
      sourceUrl: 'https://www.myelinfoundry.ai/wp-content/uploads/2025/09/Senior-QA.pdf',
      applyUrl: 'https://www.myelinfoundry.ai/careers/',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Official Myelin Foundry role details document for Senior QA Engineer. Review the first-party document and apply through the official Myelin Foundry careers page.',
    },
    {
      title: 'Product Engineer AI',
      company: 'Myelin Foundry',
      department: null,
      location: 'India',
      city: null,
      country: 'India',
      jobId: 'myelinfoundry-jd-for-product-engineer-30032022',
      requisitionId: 'myelinfoundry-jd-for-product-engineer-30032022',
      sourceUrl: 'https://www.myelinfoundry.ai/wp-content/uploads/2025/09/JD-for-Product-Engineer-30032022.docx',
      applyUrl: 'https://www.myelinfoundry.ai/careers/',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Official Myelin Foundry role details document for Product Engineer AI. Review the first-party document and apply through the official Myelin Foundry careers page.',
    },
  ])
})

test('Myelin Foundry scraper fetches the verified homepage and careers page and decorates the first-party jobs', async () => {
  const myelinFoundry = await loadMyelinFoundryModule()
  const requestedUrls = []

  const jobs = await myelinFoundry.createMyelinFoundryScraper({
    now: () => '2026-07-11T07:30:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === myelinFoundry.HOMEPAGE_URL) return verifiedHomepageHtml
      if (url === myelinFoundry.CAREERS_URL) return verifiedCareersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    myelinFoundry.HOMEPAGE_URL,
    myelinFoundry.CAREERS_URL,
  ])
  assert.equal(jobs.length, 6)
  assert.equal(jobs[0].source, 'myelinfoundry')
  assert.equal(jobs[0].company, 'Myelin Foundry')
  assert.equal(jobs[0].link, 'https://www.myelinfoundry.ai/careers/')
  assert.equal(jobs[0].scrapedAt, '2026-07-11T07:30:00.000Z')
})

test('Myelin Foundry scraper fails closed when the verified homepage or careers jobs surface drifts', async () => {
  const myelinFoundry = await loadMyelinFoundryModule()

  await assert.rejects(
    myelinFoundry.createMyelinFoundryScraper().run({
      fetchText: async (url) => {
        if (url === myelinFoundry.HOMEPAGE_URL) {
          return verifiedHomepageHtml.replace('Agentic AI on the Edge', 'Edge AI for Everyone')
        }
        return verifiedCareersHtml
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    myelinFoundry.createMyelinFoundryScraper().run({
      fetchText: async (url) => {
        if (url === myelinFoundry.HOMEPAGE_URL) return verifiedHomepageHtml
        return verifiedCareersHtml.replace('View Details', 'Download JD')
      },
    }),
    /job cards changed shape|verified official careers page/i,
  )
})
