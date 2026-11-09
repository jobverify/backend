import assert from 'node:assert/strict'
import test from 'node:test'

const loadDanlawTechnologiesModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const careersHtml = `
  <section>
    <h2>Discover Your Career</h2>
    <div class="col-md-12" id="jb-hover">
      <ul class="nw-ul"><li><h4>Technical Lead - Embedded </h4></li></ul>
      <h3>description</h3>
      <p>
        <div><b>Location: Hyderabad</b></div>
        <div><b>Experience: 8 to 12 years</b></div>
        <div><b>Qualification: B.E./B.Tech/M.E./M.Tech</b></div>
        <div>• Ability to work on embedded development.</div>
      </p>
      <h6><a href="https://danlawtechnologies.com/career-detail/Technical-Lead-Embedded">Apply</a></h6>
    </div>
    <div class="col-md-12" id="jb-hover">
      <ul class="nw-ul"><li><h4>Customer Service Engineer</h4></li></ul>
      <h3>description</h3>
      <p><div>Location: Chennai</div><div>Experience: 3 to 5 years</div><div>Qualification: Diploma/ BE - Electronics &amp; Communication</div><div>• Troubleshooting telematics devices.</div></p>
      <h6><a href="https://danlawtechnologies.com/career-detail/Customer-Service-Engineer">Apply</a></h6>
    </div>
  </section>
`

test('extractJobs maps official Danlaw career cards into shared scraper fields', async () => {
  const danlaw = await loadDanlawTechnologiesModule()
  assert.ok(danlaw)

  const jobs = danlaw.extractJobs(careersHtml)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Technical Lead - Embedded',
    company: 'Danlaw Technologies',
    department: null,
    location: 'Hyderabad, India',
    city: 'Hyderabad',
    country: 'India',
    jobId: 'technical-lead-embedded',
    requisitionId: 'technical-lead-embedded',
    sourceUrl: 'https://danlawtechnologies.com/career-detail/Technical-Lead-Embedded',
    applyUrl: 'https://danlawtechnologies.com/career-detail/Technical-Lead-Embedded',
    employmentType: null,
    experienceRequired: '8 to 12 years',
    minimumQualification: 'B.E./B.Tech/M.E./M.Tech',
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Ability to work on embedded development.',
    remoteStatus: 'On-site',
    salary: null,
  })
  assert.equal(jobs[1].title, 'Customer Service Engineer')
  assert.equal(jobs[1].location, 'Chennai, India')
  assert.equal(jobs[1].jobId, 'customer-service-engineer')
})

test('run fetches the official Danlaw careers page and decorates normalized jobs', async () => {
  const danlaw = await loadDanlawTechnologiesModule()
  assert.ok(danlaw)

  const requestedUrls = []
  const jobs = await danlaw.createDanlawTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requestedUrls, [danlaw.CAREER_PAGE_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'danlawtechnologies')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
