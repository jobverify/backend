import assert from 'node:assert/strict'
import test from 'node:test'

const loadDatamaticsModule = async () => {
  try {
    return await import('../../scraper/datamatics/script.js')
  } catch {
    assert.fail('Expected Datamatics scraper module at ../../scraper/scraper/datamatics/script.js')
  }
}

const careersHtml = `
  <div class="accordion-item boxed clearfix collapsed">
    <div class="accordion-header"><div class="accordion-title">Technical Project Manager | EXP : 13-18 yrs</div></div>
    <div class="accordion-body clearfix hs-richtext">
      <table><tr><td>Experience</td><td>13-18 years of relevant experience</td></tr>
      <tr><td>Qualifications</td><td>Bachelor's in Computer Science/Engineering.</td></tr>
      <tr><td>Job Desc</td><td>Lead delivery for enterprise technology projects.</td></tr>
      <tr><td>Job Location</td><td>Mumbai, India</td></tr></table>
      <a href="mailto:careers@datamatics.com?subject=Technical%20Project%20Manager">APPLY</a>
    </div>
  </div>
  <div class="accordion-item boxed clearfix collapsed">
    <div class="accordion-header"><div class="accordion-title">Sales Director | EXP : 15+ yrs</div></div>
    <div class="accordion-body clearfix hs-richtext">
      <table><tr><td>Job Location</td><td>Remote, USA</td></tr></table>
      <a href="mailto:careers@datamatics.com">APPLY</a>
    </div>
  </div>
`

test('extractDatamaticsJobs maps India listings from the official careers page', async () => {
  const datamatics = await loadDatamaticsModule()

  assert.deepEqual(datamatics.extractDatamaticsJobs(careersHtml), [{
    title: 'Technical Project Manager',
    company: 'Datamatics Global Services Limited',
    location: 'Mumbai, India',
    city: 'Mumbai',
    country: 'India',
    jobId: 'datamatics-technical-project-manager-mumbai-india',
    requisitionId: 'technical-project-manager-mumbai-india',
    sourceUrl: datamatics.CAREERS_URL,
    applyUrl: 'mailto:careers@datamatics.com?subject=Technical%20Project%20Manager',
    employmentType: null,
    experienceRequired: '13-18 years of relevant experience',
    minimumQualification: "Bachelor's in Computer Science/Engineering.",
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Lead delivery for enterprise technology projects.',
  }])
})

test('run fetches the official Datamatics careers page and decorates jobs', async () => {
  const datamatics = await loadDatamaticsModule()
  const scraper = datamatics.createDatamaticsScraper({
    fetchText: async (url) => {
      assert.equal(url, datamatics.CAREERS_URL)
      return careersHtml
    },
  })

  const jobs = await scraper.run()

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'datamatics')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})
