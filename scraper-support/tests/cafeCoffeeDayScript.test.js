import assert from 'node:assert/strict'
import test from 'node:test'

const loadCafeCoffeeDayModule = async () => {
  try {
    return await import('../../scraper/cafecoffeeday/script.js')
  } catch {
    return null
  }
}

const openingsHtml = `
<div class="lease-listings">
  <ul class="header-ul animated">
    <li class="list-region">S.N</li>
    <li class="list-email">Location</li>
    <li class="list-person">Position</li>
    <li class="list-number">Experience</li>
  </ul>
  <ul class="animated">
    <li class="list-region">01</li>
    <li class="list-person">Delhi</li>
    <li class="list-number">Team Member<br/>Guest Relation Executive(GRE)<br/>ASST. CAFÉ MANAGER(ACM)/CAFÉ MANAGER(CM)</li>
    <li class="list-email">2 Years</li>
  </ul>
  <ul class="animated">
    <li class="list-region">02</li>
    <li class="list-person">Karnataka</li>
    <li class="list-number">Team Member<br/>Guest Relation Executive(GRE)<br/>ASST. CAFÉ MANAGER(ACM)/CAFÉ MANAGER(CM)</li>
    <li class="list-email">2 Yrs</li>
  </ul>
</div>
`

test('extractSearchResults expands each official Cafe Coffee Day role-location listing', async () => {
  const cafeCoffeeDay = await loadCafeCoffeeDayModule()
  assert.ok(cafeCoffeeDay)

  const jobs = cafeCoffeeDay.extractSearchResults(openingsHtml)

  assert.equal(jobs.length, 6)
  assert.deepEqual(jobs[0], {
    title: 'Team Member',
    company: 'Cafe Coffee Day',
    department: null,
    location: 'Delhi, India',
    city: 'Delhi',
    country: 'India',
    jobId: 'ccd-01-team-member',
    requisitionId: 'ccd-01-team-member',
    sourceUrl: 'https://www.cafecoffeeday.com/careers/openings#opening-01',
    applyUrl: 'https://www.cafecoffeeday.com/careers/apply-now',
    employmentType: null,
    experienceRequired: '2 Years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    remoteStatus: 'On-site',
  })
  assert.equal(jobs[2].title, 'ASST. CAFE MANAGER(ACM)/CAFE MANAGER(CM)')
  assert.equal(jobs[2].jobId, 'ccd-01-asst-cafe-manager-acm-cafe-manager-cm')
  assert.equal(jobs[3].location, 'Karnataka, India')
  assert.equal(jobs[3].experienceRequired, '2 Yrs')
})

test('run fetches Cafe Coffee Day openings and decorates jobs for the runner', async () => {
  const cafeCoffeeDay = await loadCafeCoffeeDayModule()
  assert.ok(cafeCoffeeDay)

  const requests = []
  const scraper = cafeCoffeeDay.createCafeCoffeeDayScraper()
  const jobs = await scraper.run({
    fetchText: async (url) => {
      requests.push(url)
      if (url === cafeCoffeeDay.OPENINGS_URL) return openingsHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [cafeCoffeeDay.OPENINGS_URL])
  assert.equal(jobs.length, 6)
  assert.equal(jobs[0].source, 'cafecoffeeday')
  assert.equal(jobs[0].link, 'https://www.cafecoffeeday.com/careers/apply-now')
  assert.equal(jobs[0].company, 'Cafe Coffee Day')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})

test('run can recover Cafe Coffee Day openings with a browser-backed fetch when direct requests fail certificate validation', async () => {
  const cafeCoffeeDay = await loadCafeCoffeeDayModule()
  assert.ok(cafeCoffeeDay)

  const browserUrls = []
  const scraper = cafeCoffeeDay.createCafeCoffeeDayScraper()
  const jobs = await scraper.run({
    fetchText: async () => {
      throw new Error('fetch failed | unable to verify the first certificate')
    },
    fetchBrowserText: async (url) => {
      browserUrls.push(url)
      return openingsHtml
    },
  })

  assert.deepEqual(browserUrls, [cafeCoffeeDay.OPENINGS_URL])
  assert.equal(jobs.length, 6)
  assert.equal(jobs[0].source, 'cafecoffeeday')
})
