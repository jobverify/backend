import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
  <input type="hidden" value="[
    {&#34;Job_Description&#34;:&#34;Build scalable data products &amp; mentor engineers.&#34;,&#34;Work_Experience&#34;:&#34;10 - 14 years&#34;,&#34;Job_Type&#34;:&#34;Permanant (Full Time)&#34;,&#34;Job_Opening_Name&#34;:&#34;AI Engineer&#34;,&#34;Posting_Title&#34;:&#34;AI Engineer&#34;,&#34;Country&#34;:&#34;India&#34;,&#34;id&#34;:&#34;122109000008234001&#34;,&#34;City&#34;:&#34;Hyderabad&#34;,&#34;Publish&#34;:true},
    {&#34;Job_Description&#34;:&#34;Belgian retail role.&#34;,&#34;Work_Experience&#34;:&#34;5 years&#34;,&#34;Job_Type&#34;:&#34;Full Time&#34;,&#34;Posting_Title&#34;:&#34;Retail Analyst&#34;,&#34;Country&#34;:&#34;Belgium&#34;,&#34;id&#34;:&#34;122109000008234002&#34;,&#34;City&#34;:&#34;Halle&#34;,&#34;Publish&#34;:true}
  ]" id="jobs">
`

const loadColruytModule = async () => {
  try {
    return await import('../../scraper/colruytgroupindia/script.js')
  } catch {
    return null
  }
}

test('extractZohoCareerJobs reads official Colruyt Group India openings embedded in the public careers page', async () => {
  const colruyt = await loadColruytModule()
  assert.ok(colruyt)

  const jobs = colruyt.extractZohoCareerJobs(careersHtml)

  assert.deepEqual(jobs, [{
    jobId: '122109000008234001',
    requisitionId: '122109000008234001',
    title: 'AI Engineer',
    location: 'Hyderabad, India',
    city: 'Hyderabad',
    country: 'India',
    employmentType: 'Permanant (Full Time)',
    experienceRequired: '10 - 14 years',
    jobDescription: 'Build scalable data products & mentor engineers.',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    sourceUrl: 'https://careers.in.colruytgroup.com/jobs/Careers/122109000008234001/AI-Engineer?source=CareerSite',
    applyUrl: 'https://careers.in.colruytgroup.com/jobs/Careers/122109000008234001/AI-Engineer?source=CareerSite',
  }])
})

test('run fetches the public Colruyt Group India careers page and returns runner-ready jobs', async () => {
  const colruyt = await loadColruytModule()
  assert.ok(colruyt)

  const requested = []
  const jobs = await colruyt.createColruytGroupIndiaScraper().run({
    fetchText: async (url) => {
      requested.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requested, ['https://careers.in.colruytgroup.com/jobs/careers'])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Colruyt Group India')
  assert.equal(jobs[0].source, 'colruytgroupindia')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].country, 'India')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
