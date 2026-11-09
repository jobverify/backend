import assert from 'node:assert/strict'
import test from 'node:test'

const currentOpeningsHtml = `
<html>
  <head><title>Girmiti Software | Current Openings</title></head>
  <body>
    <div class="row animate-box other_page current_openings_container">
      <div class="result col-sm-8">
        <h4>E-mail your CV at <a href="mailto:careers@girmiti.com">careers@girmiti.com</a></h4>
        <div class="java">
          <h5>Technical Lead or Senior Engineer - Java/J2EE Framework and Security Specialist</h5>
          <h6>Job Code: GJ-00A001</h6>
          <p>Job Location : Bangalore</p>
          <p>Job Description:</p>
          <span>Primary responsibility consists of ownership of the Java framework components.</span>
        </div>
        <div class="headpro">
          <h5>Head Products</h5>
          <h6>Job Code: GJ-00A006</h6>
          <p>Job Location : New York, New Jersey, California, Florida</p>
          <p>Job Description:</p>
          <span>Strategise, manage, own products and associated services offerings.</span>
        </div>
      </div>
    </div>
  </body>
</html>
`

const loadGirmitiModule = async () => import('./script.js')

test('Girmiti Software extracts verified inline current opening blocks', async () => {
  const girmiti = await loadGirmitiModule()
  const jobs = girmiti.extractOpenings(currentOpeningsHtml)

  assert.equal(girmiti.hasOfficialCurrentOpeningsSignal(currentOpeningsHtml), true)
  assert.deepEqual(jobs, [
    {
      title: 'Technical Lead or Senior Engineer - Java/J2EE Framework and Security Specialist',
      company: 'Girmiti Software',
      department: null,
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: 'GJ-00A001',
      requisitionId: 'GJ-00A001',
      sourceUrl: 'https://www.girmiti.com/current_openings.html#GJ-00A001',
      applyUrl: 'mailto:careers@girmiti.com?subject=GJ-00A001%20Technical%20Lead%20or%20Senior%20Engineer%20-%20Java%2FJ2EE%20Framework%20and%20Security%20Specialist',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Primary responsibility consists of ownership of the Java framework components.',
    },
    {
      title: 'Head Products',
      company: 'Girmiti Software',
      department: null,
      location: 'New York, New Jersey, California, Florida',
      city: 'New York',
      country: 'United States',
      jobId: 'GJ-00A006',
      requisitionId: 'GJ-00A006',
      sourceUrl: 'https://www.girmiti.com/current_openings.html#GJ-00A006',
      applyUrl: 'mailto:careers@girmiti.com?subject=GJ-00A006%20Head%20Products',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Strategise, manage, own products and associated services offerings.',
    },
  ])
})

test('Girmiti Software run decorates verified openings with shared runner fields', async () => {
  const girmiti = await loadGirmitiModule()
  const jobs = await girmiti.createGirmitiSoftwareScraper({
    now: () => '2026-07-18T00:00:00.000Z',
  }).run({
    fetchText: async () => currentOpeningsHtml,
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'girmitisoftware')
  assert.equal(jobs[0].scrapedAt, '2026-07-18T00:00:00.000Z')
})
