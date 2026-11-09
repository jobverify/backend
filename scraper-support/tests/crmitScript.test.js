import assert from 'node:assert/strict'
import test from 'node:test'

const loadCrmitModule = async () => {
  try {
    return await import('../../scraper/crmit/script.js')
  } catch {
    return null
  }
}

const sampleHtml = `
  <section class="job-listing">
    <div class="jobTitle"><h2><a href="/careers/mulesoft-lead-bangalore.html">MuleSoft Lead</a></h2></div>
    <div class="location"><p>Bangalore, India (Hybrid)</p></div>
    <div class="experience"><p>8+ years</p></div>
    <a class="elementor-button" href="/careers/mulesoft-lead-bangalore.html">Apply Now</a>
  </section>
  <section class="job-listing">
    <div class="jobTitle"><h2><a href="/careers/salesforce-mulesoft-architect.html">Salesforce Mulesoft Architect</a></h2></div>
    <div class="location"><p>India - Bangalore</p></div>
    <a class="elementor-button" href="/careers/salesforce-mulesoft-architect.html">Position Closed</a>
  </section>
  <section class="job-listing">
    <div class="jobTitle"><h2><a href="/careers/client-partner.html">Client Partner</a></h2></div>
    <div class="location"><p>Atlanta, GA / Dallas, TX</p></div>
    <a class="elementor-button" href="/careers/client-partner.html">Apply Now</a>
  </section>
`

test('extractOpenings returns active India openings from CRMIT official job cards', async () => {
  const crmit = await loadCrmitModule()
  assert.ok(crmit)

  assert.deepEqual(crmit.extractOpenings(sampleHtml), [
    {
      title: 'MuleSoft Lead',
      company: 'CRMIT Solutions',
      location: 'Bangalore, India (Hybrid)',
      city: 'Bangalore',
      country: 'India',
      jobId: 'crmit-mulesoft-lead',
      requisitionId: 'crmit-mulesoft-lead',
      sourceUrl: crmit.CAREER_PAGE_URL,
      applyUrl: 'https://www.crmit.com/careers/mulesoft-lead-bangalore.html',
      employmentType: null,
      experienceRequired: '8+ years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Apply for MuleSoft Lead through the CRMIT Solutions careers page.',
    },
  ])
})

test('run fetches the official CRMIT job search page and decorates the active India opening', async () => {
  const crmit = await loadCrmitModule()
  assert.ok(crmit)

  const requestedUrls = []
  const jobs = await crmit.createCrmitScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return sampleHtml
    },
  })

  assert.deepEqual(requestedUrls, [crmit.CAREER_PAGE_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'crmit')
  assert.equal(jobs[0].link, 'https://www.crmit.com/careers/mulesoft-lead-bangalore.html')
  assert.ok(jobs[0].scrapedAt)
})
