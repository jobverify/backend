import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
  <div class="job-card">
    <button class='accordion'>Senior Software Engineer<span class='toggle-icon'>+</span></button>
    <div class='panel'><div class='job-desc'>
      <h4>About the Role</h4><p>Build high-throughput, real-time data applications.</p>
      <h4>Employee Status and Commitments</h4><p>Full-time position based in Bangalore.</p>
    </div></div>
  </div>
  <div class="job-card">
    <button class='accordion'>Senior RF Design Engineer<span class='toggle-icon'>+</span></button>
    <div class='panel'><div class='job-desc'>
      <p>Design RF and microwave hardware subsystems.</p>
      <p>Permanent full-time position located at our Hyderabad office.</p>
    </div></div>
  </div>
`

const loadConstelliModule = async () => {
  try {
    return await import('../../scraper/constelli/script.js')
  } catch {
    return null
  }
}

test('extractJobCards maps public Constelli role cards with India locations', async () => {
  const constelli = await loadConstelliModule()
  assert.ok(constelli, 'Constelli scraper module must exist')

  const jobs = constelli.extractJobCards(careersHtml)

  assert.deepEqual(jobs, [
    {
      title: 'Senior Software Engineer',
      company: 'Constelli Signals Private Limited',
      department: null,
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: 'senior-software-engineer',
      requisitionId: 'senior-software-engineer',
      sourceUrl: 'https://www.constelli.com/careers/',
      applyUrl: 'https://www.constelli.com/careers/',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'About the Role Build high-throughput, real-time data applications. Employee Status and Commitments Full-time position based in Bangalore.',
      remoteStatus: 'On-site',
      compensation: null,
    },
    {
      title: 'Senior RF Design Engineer',
      company: 'Constelli Signals Private Limited',
      department: null,
      location: 'Hyderabad, India',
      city: 'Hyderabad',
      country: 'India',
      jobId: 'senior-rf-design-engineer',
      requisitionId: 'senior-rf-design-engineer',
      sourceUrl: 'https://www.constelli.com/careers/',
      applyUrl: 'https://www.constelli.com/careers/',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Design RF and microwave hardware subsystems. Permanent full-time position located at our Hyderabad office.',
      remoteStatus: 'On-site',
      compensation: null,
    },
  ])
})

test('run fetches the official Constelli careers page and decorates runner fields', async () => {
  const constelli = await loadConstelliModule()
  assert.ok(constelli, 'Constelli scraper module must exist')

  const jobs = await constelli.createConstelliScraper().run({
    fetchText: async (url) => {
      assert.equal(url, constelli.CAREERS_URL)
      return careersHtml
    },
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'constelli')
  assert.equal(jobs[0].link, 'https://www.constelli.com/careers/')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})

test('extractJobCards retains Constelli roles whose official card omits a city', async () => {
  const constelli = await loadConstelliModule()
  assert.ok(constelli, 'Constelli scraper module must exist')

  const jobs = constelli.extractJobCards(`
    <div class="job-card">
      <button class='accordion'>Systems Engineer<span class='toggle-icon'>+</span></button>
      <div class='panel'><div class='job-desc'><p>Build real-time systems.</p></div></div>
    </div>
  `)

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Systems Engineer')
  assert.equal(jobs[0].location, 'India')
  assert.equal(jobs[0].city, null)
})
