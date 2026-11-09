import assert from 'node:assert/strict'
import test from 'node:test'

const loadVeriniteModule = async () => {
  try {
    return await import('../../scraper/verinitetechnologies/script.js')
  } catch {
    assert.fail('Expected Verinite Technologies scraper module at ../../scraper/verinitetechnologies/script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Verinite | Explore World of Opportunities with Us</title>
  </head>
  <body>
    <div class="job_box">
      <h5>BDE-EXSITING MARKET</h5>
      <p class="job_location">
        <span class="theme_text">Pune</span>
        <span class="job_status">Full-Time</span>
      </p>
      <a href="/bde-ext-mkt.html">Apply Now</a>
    </div>
    <div class="job_box">
      <h5>Prime Test Lead</h5>
      <p class="job_location">
        <span class="theme_text">Pune</span>
        <span class="job_status">Full Time</span>
      </p>
      <a href="/lead-tsys-prime.html">Apply Now</a>
    </div>
    <div>Powercard L2 Support</div>
  </body>
</html>
`

const bdeDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Verinite | Join us as a BDE-EXSITING MARKET</title>
  </head>
  <body>
    <div class="tab-content">
      <div id="overview" class="tab-pane fade in active">
        <div class="job__JobDescriptionWrapper-sc-1kh4fw-0 eKNloy">
          <p><strong>Experience</strong></p>
          <p>2 years in IT Sales</p>
          <p><strong>Location</strong></p>
          <p>Pune (work from office)</p>
          <p><strong>What do we want to accomplish and why do we need you?</strong></p>
          <p>Promote IT products and services and drive profitable new business.</p>
          <p><strong>Job Responsibility</strong></p>
          <p>Responsible to promote IT Product and Services.</p>
        </div>
      </div>
    </div>
  </body>
</html>
`

const primeDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Verinite | Join us as a Prime Test Lead</title>
  </head>
  <body>
    <div class="tab-content">
      <div id="overview" class="tab-pane fade in active">
        <div class="job__JobDescriptionWrapper-sc-1kh4fw-0 eKNloy">
          <p><strong>Experience</strong></p>
          <p>5 to 7 years</p>
          <p><strong>Location</strong></p>
          <p>Pune</p>
          <p><strong>What do we want to accomplish and why do we need you?</strong></p>
          <p>Lead the TSYS Prime testing delivery and stakeholder coordination.</p>
          <p><strong>Essential Skills for the Job Role</strong></p>
          <p>Strong experience on TSYS Prime and Online platform.</p>
        </div>
      </div>
    </div>
  </body>
</html>
`

test('Verinite validates the verified careers page and extracts public detail-page experience', async () => {
  const verinite = await loadVeriniteModule()

  assert.equal(verinite.SOURCE, 'verinitetechnologies')
  assert.equal(verinite.COMPANY, 'Verinite Technologies')
  assert.equal(verinite.CAREERS_URL, 'https://www.verinite.com/careers.html')
  assert.equal(verinite.hasOfficialCareersSignal(officialCareersHtml), true)

  const cards = verinite.extractJobCards(officialCareersHtml)
  assert.equal(cards.length, 2)
  assert.equal(cards[0].title, 'BDE-EXSITING MARKET')

  const bdeDetail = verinite.extractJobDetail(bdeDetailHtml)
  assert.equal(bdeDetail.experienceRequired, '2 years')
  assert.ok(bdeDetail.jobDescription.includes('Promote IT products and services'))
  assert.equal(bdeDetail.publicExperienceChecked, true)
})

test('Verinite run enriches the first-party cards with public detail-page descriptions and experience', async () => {
  const verinite = await loadVeriniteModule()
  const requestedUrls = []

  const jobs = await verinite.createVeriniteTechnologiesScraper({
    now: () => '2026-08-06T12:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === verinite.CAREERS_URL) return officialCareersHtml
      if (url === 'https://www.verinite.com/bde-ext-mkt.html') return bdeDetailHtml
      if (url === 'https://www.verinite.com/lead-tsys-prime.html') return primeDetailHtml
      throw new Error(`Unexpected Verinite URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    verinite.CAREERS_URL,
    'https://www.verinite.com/bde-ext-mkt.html',
    'https://www.verinite.com/lead-tsys-prime.html',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].experienceRequired, '2 years')
  assert.ok(jobs[0].jobDescription.includes('Promote IT products and services'))
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.equal(jobs[1].experienceRequired, '5 - 7 years')
  assert.ok(jobs[1].jobDescription.includes('TSYS Prime testing delivery'))
  assert.equal(jobs[1].publicExperienceChecked, true)
})
