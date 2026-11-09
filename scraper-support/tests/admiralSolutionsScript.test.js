import assert from 'node:assert/strict'
import test from 'node:test'

const loadAdmiralModule = async () => {
  try {
    return await import('../../scraper/admiralsolutions/script.js')
  } catch {
    assert.fail('Expected Admiral Solutions scraper module at ../../scraper/admiralsolutions/script.js')
  }
}

const vacanciesHtml = `
<!doctype html>
<html>
  <body>
    <div class="page-career-list">
      <div class="page-career-list-item">
        <div class="page-career-list-item-head"><h4>Customer Care Specialist - Customer Care</h4></div>
        <div class="page-career-list-item-body">
          <div class="page-career-list-item-body-benefits"><span>Salary & Benefits : </span><p>Fixed CTC INR 4,25,000 + Exciting Incentives</p></div>
          <div class="page-career-list-item-body-department"><span>Department : </span><p>Customer Services</p></div>
          <div class="page-career-list-item-body-date"><span>Closing Date : </span><p>01/08/2026</p></div>
          <div class="page-career-list-item-body-location"><p>Gurugram</p></div>
          <div class="page-career-list-item-body-button"><a class="box-button" href="/vacancies/519/customer_care_specialist_customer_care/">Full Description</a></div>
        </div>
      </div>
      <div class="page-career-list-item">
        <div class="page-career-list-item-head"><h4>People Partner Executive</h4></div>
        <div class="page-career-list-item-body">
          <div class="page-career-list-item-body-benefits"><span>Salary & Benefits : </span><p>CTC basis Current Package</p></div>
          <div class="page-career-list-item-body-department"><span>Department : </span><p>People Services</p></div>
          <div class="page-career-list-item-body-date"><span>Closing Date : </span><p>02/09/2026</p></div>
          <div class="page-career-list-item-body-location"><p>Gurugram</p></div>
          <div class="page-career-list-item-body-button"><a class="box-button" href="/vacancies/515/people_partner_executive/">Full Description</a></div>
        </div>
      </div>
    </div>
  </body>
</html>
`

test('extractSearchResults maps the Admiral Solutions vacancies list into scraper jobs', async () => {
  const admiral = await loadAdmiralModule()

  const jobs = admiral.extractSearchResults(vacanciesHtml)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Customer Care Specialist - Customer Care',
    company: 'Admiral Solutions',
    department: 'Customer Services',
    location: 'Gurugram, India',
    city: 'Gurugram',
    state: null,
    country: 'India',
    jobId: '519',
    requisitionId: '519',
    sourceUrl: 'https://career.admiralsolutions.in/vacancies/519/customer_care_specialist_customer_care/',
    applyUrl: 'https://career.admiralsolutions.in/vacancies/519/customer_care_specialist_customer_care/',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: '2026-08-01',
    jobDescription: 'Salary & Benefits: Fixed CTC INR 4,25,000 + Exciting Incentives',
    remoteStatus: 'On-site',
  })
  assert.equal(jobs[1].jobId, '515')
  assert.equal(jobs[1].department, 'People Services')
  assert.equal(jobs[1].closingDate, '2026-09-02')
})

test('run fetches the Admiral Solutions vacancies page and decorates the jobs', async () => {
  const admiral = await loadAdmiralModule()
  const requestedUrls = []

  const jobs = await admiral.createAdmiralSolutionsScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return vacanciesHtml
    },
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, ['https://career.admiralsolutions.in/vacancies/'])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'admiralsolutions')
  assert.equal(jobs[0].link, 'https://career.admiralsolutions.in/vacancies/519/customer_care_specialist_customer_care/')
  assert.equal(jobs[0].scrapedAt, '2026-07-18T00:00:00.000Z')
})
