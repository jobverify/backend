import assert from 'node:assert/strict'
import test from 'node:test'

const loadIntelligenceBureauModule = async () => {
  try {
    return await import('../../scraper/intelligencebureau/script.js')
  } catch {
    assert.fail('Expected Intelligence Bureau scraper module at ../../scraper/intelligencebureau/script.js')
  }
}

const vacanciesPage1Html = `
<!doctype html>
<html lang="en">
  <head>
    <title>Vacancies | Ministry of Home Affairs</title>
  </head>
  <body>
    <main>
      <h1>Vacancies</h1>
      <table>
        <thead>
          <tr><th>SR-No</th><th>Keyword</th><th>Download/Link</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>Filling up of vacant posts at LPAI Sccretariat, New Delhi and its ICPs on deputation (Foreign Service), including short-term contract basis</td>
            <td><a href="/en/notifications/vacancies/lpai-secretariat">Download 9.73 MB</a></td>
          </tr>
          <tr>
            <td>4</td>
            <td>Vacancy for various post for direct recruitment through UPSC Adv no. 05/2026</td>
            <td><a href="/en/notifications/vacancies/upsc-advt-05-2026">Download 2.39 MB</a></td>
          </tr>
        </tbody>
      </table>
      <nav class="pager">
        <a href="?page=1">Current page 1</a>
        <a href="?page=2">Page 2</a>
        <a href="?page=3">Page 3</a>
      </nav>
    </main>
  </body>
</html>
`

const vacanciesPage2Html = `
<!doctype html>
<html lang="en">
  <head>
    <title>Vacancies | Ministry of Home Affairs</title>
  </head>
  <body>
    <main>
      <h1>Vacancies</h1>
      <div>Ministry of Home Affairs</div>
      <table>
        <thead>
          <tr><th>SR-No</th><th>Keyword</th><th>Download/Link</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>35</td>
            <td>Vacancy Circular for filling up various posts on deputation (including short term contract) in National Intelligence Grid, Ministry of Home Affairs- reg.</td>
            <td><a href="/en/notifications/vacancies/national-intelligence-grid">Download 7.88 MB</a></td>
          </tr>
        </tbody>
      </table>
      <nav class="pager">
        <a href="?page=1">Page 1</a>
        <a href="?page=2">Current page 2</a>
        <a href="?page=3">Page 3</a>
      </nav>
    </main>
  </body>
</html>
`

const vacanciesPage3Html = `
<!doctype html>
<html lang="en">
  <head>
    <title>Vacancies | Ministry of Home Affairs</title>
  </head>
  <body>
    <main>
      <h1>Vacancies</h1>
      <div>Ministry of Home Affairs</div>
      <table>
        <thead>
          <tr><th>SR-No</th><th>Keyword</th><th>Download/Link</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>42</td>
            <td>Filling up of two (02) posts of Constable in National Crime Records Bureau on deputation basis</td>
            <td><a href="/en/notifications/vacancies/ncrb-constable">Download 2.06 MB</a></td>
          </tr>
        </tbody>
      </table>
      <nav class="pager">
        <a href="?page=1">Page 1</a>
        <a href="?page=2">Page 2</a>
        <span>Current page 3</span>
      </nav>
    </main>
  </body>
</html>
`

const ibNoticeHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Vacancies | Ministry of Home Affairs</title>
  </head>
  <body>
    <main>
      <h1>Vacancies</h1>
      <div>Ministry of Home Affairs</div>
      <table>
        <thead>
          <tr><th>SR-No</th><th>Keyword</th><th>Download/Link</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>11</td>
            <td>Recruitment of Security Assistant/Executive in Intelligence Bureau</td>
            <td><a href="/en/notifications/vacancies/ib-security-assistant">Download 1.25 MB</a></td>
          </tr>
        </tbody>
      </table>
      <nav class="pager"><span>Current page 1</span></nav>
    </main>
  </body>
</html>
`

test('Intelligence Bureau scraper validates the official MHA vacancies surface and returns no jobs when no IB notice is present', async () => {
  const intelligenceBureau = await loadIntelligenceBureauModule()

  assert.equal(intelligenceBureau.VACANCIES_PAGE_URL, 'https://www.mha.gov.in/en/notifications/vacancies')
  assert.equal(intelligenceBureau.hasOfficialVacanciesSignal(vacanciesPage1Html), true)
  assert.deepEqual(intelligenceBureau.extractPageUrls(vacanciesPage1Html), [
    'https://www.mha.gov.in/en/notifications/vacancies?page=1',
    'https://www.mha.gov.in/en/notifications/vacancies?page=2',
    'https://www.mha.gov.in/en/notifications/vacancies?page=3',
  ])
  assert.deepEqual(intelligenceBureau.extractOpenings(vacanciesPage1Html), [])
  assert.deepEqual(intelligenceBureau.extractOpenings(vacanciesPage2Html), [])
  assert.deepEqual(intelligenceBureau.extractOpenings(vacanciesPage3Html), [])

  const requestedUrls = []
  const jobs = await intelligenceBureau.createIntelligenceBureauScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === intelligenceBureau.VACANCIES_PAGE_URL) return vacanciesPage1Html
      if (url === 'https://www.mha.gov.in/en/notifications/vacancies?page=1') return vacanciesPage1Html
      if (url === 'https://www.mha.gov.in/en/notifications/vacancies?page=2') return vacanciesPage2Html
      if (url === 'https://www.mha.gov.in/en/notifications/vacancies?page=3') return vacanciesPage3Html
      throw new Error(`Unexpected Intelligence Bureau fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    intelligenceBureau.VACANCIES_PAGE_URL,
    'https://www.mha.gov.in/en/notifications/vacancies?page=1',
    'https://www.mha.gov.in/en/notifications/vacancies?page=2',
    'https://www.mha.gov.in/en/notifications/vacancies?page=3',
  ])
  assert.deepEqual(jobs, [])
})

test('Intelligence Bureau scraper extracts an explicit IB notice from the official vacancies surface', async () => {
  const intelligenceBureau = await loadIntelligenceBureauModule()
  const jobs = intelligenceBureau.extractOpenings(ibNoticeHtml)

  assert.deepEqual(jobs, [{
    title: 'Recruitment of Security Assistant/Executive in Intelligence Bureau',
    company: 'Intelligence Bureau',
    department: null,
    location: 'India',
    city: null,
    state: null,
    country: 'India',
    jobId: 'intelligencebureau-11-recruitment-of-security-assistant-executive-in-intelligence-bureau',
    requisitionId: '11',
    sourceUrl: intelligenceBureau.VACANCIES_PAGE_URL,
    applyUrl: 'https://www.mha.gov.in/en/notifications/vacancies/ib-security-assistant',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Official Intelligence Bureau vacancy notice hosted on the Ministry of Home Affairs vacancies page. Review the government posting for eligibility and application details.',
  }])
})

test('Intelligence Bureau scraper fails closed when the verified vacancies surface changes', async () => {
  const intelligenceBureau = await loadIntelligenceBureauModule()

  await assert.rejects(
    intelligenceBureau.createIntelligenceBureauScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /Intelligence Bureau official MHA vacancies surface changed/i,
  )
})
