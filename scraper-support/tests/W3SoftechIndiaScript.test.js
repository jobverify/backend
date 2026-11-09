import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Job Search | Job Opportunities | w3softech</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <p>Below is a list of our current vacancies. To apply for any other position forward your resume at careers@w3softech.com</p>
      <table>
        <tbody>
          <tr>
            <td>W3S054</td>
            <td>Python Developer</td>
            <td>0 to 1 Years</td>
            <td>Hyderabad</td>
            <td><button>Apply</button></td>
          </tr>
          <tr>
            <td>W3S053</td>
            <td>MuleSoft Developer</td>
            <td>12 to 15 Years</td>
            <td>Hyderabad</td>
            <td><button>Apply</button></td>
          </tr>
        </tbody>
      </table>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/w3softechindia/script.js')
  } catch {
    assert.fail('Expected W3Softech India scraper module at ../../scraper/w3softechindia/script.js')
  }
}

test('W3Softech India helpers stay pinned to the verified first-party careers table from Friday, July 17, 2026', async () => {
  const w3 = await loadModule()

  assert.equal(w3.SOURCE, 'w3softechindia')
  assert.equal(w3.COMPANY, 'W3Softech India')
  assert.equal(w3.CAREERS_URL, 'https://w3softech.com/career')
  assert.equal(w3.VERIFIED_ON, '2026-07-17')
  assert.equal(w3.hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.equal(w3.hasOfficialCareersSignal('<html><body>Careers</body></html>'), false)
  assert.deepEqual(w3.extractJobs(CAREERS_HTML), [
    {
      title: 'Python Developer',
      company: 'W3Softech India',
      location: 'Hyderabad, India',
      city: 'Hyderabad',
      country: 'India',
      jobId: 'W3S054',
      requisitionId: 'W3S054',
      sourceUrl: 'https://w3softech.com/career',
      applyUrl: 'https://w3softech.com/career',
      employmentType: null,
      experienceRequired: '0 to 1 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
    {
      title: 'MuleSoft Developer',
      company: 'W3Softech India',
      location: 'Hyderabad, India',
      city: 'Hyderabad',
      country: 'India',
      jobId: 'W3S053',
      requisitionId: 'W3S053',
      sourceUrl: 'https://w3softech.com/career',
      applyUrl: 'https://w3softech.com/career',
      employmentType: null,
      experienceRequired: '12 to 15 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
  ])
})

test('W3Softech India run validates the verified careers table and decorates jobs', async () => {
  const w3 = await loadModule()
  const jobs = await w3.createW3SoftechIndiaScraper({
    now: () => '2026-07-17T12:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      assert.equal(url, w3.CAREERS_URL)
      return CAREERS_HTML
    },
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'w3softechindia')
  assert.equal(jobs[0].link, 'https://w3softech.com/career')
  assert.equal(jobs[0].scrapedAt, '2026-07-17T12:00:00.000Z')
})

test('W3Softech India fails closed when the verified careers table drifts', async () => {
  const w3 = await loadModule()

  await assert.rejects(
    w3.createW3SoftechIndiaScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1><p>No jobs today</p></body></html>',
    }),
    /verified W3Softech India careers page/i,
  )
})
