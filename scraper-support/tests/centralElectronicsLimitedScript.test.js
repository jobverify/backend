import assert from 'node:assert/strict'
import test from 'node:test'

const emptyCareersHtml = `
  <html>
    <head><title>Career Opportunity - Central Electronics Limited</title></head>
    <body>
      <section id="formCareer">
        <table id="getAllCareerList">
          <tbody><tr><td>No Recruitment Notifications Found.</td></tr></tbody>
        </table>
      </section>
    </body>
  </html>
`

const listingsHtml = `
  <html>
    <head><title>Career Opportunity | Central Electronics Limited</title></head>
    <body>
      <table id="career-opportunity">
        <tbody>
          <tr>
            <td>1</td>
            <td>Advt No. 118/Pers/1/2026</td>
            <td>01-07-2026</td>
            <td>31-07-2026</td>
            <td><a href="/uploads/advt-118.pdf">Download</a></td>
            <td><a href="https://cel.applyonline.net.in/">Apply</a></td>
          </tr>
        </tbody>
      </table>
    </body>
  </html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/centralelectronicslimited/script.js')
  } catch {
    assert.fail('Expected Central Electronics Limited scraper module at ../../scraper/scraper/centralelectronicslimited/script.js')
  }
}

test('Central Electronics Limited verifies the official careers page and detects the zero-state', async () => {
  const cel = await loadModule()

  assert.equal(cel.SOURCE, 'centralelectronicslimited')
  assert.equal(cel.COMPANY, 'Central Electronics Limited')
  assert.equal(cel.CAREERS_URL, 'https://www.celindia.co.in/career-opportunity')
  assert.equal(cel.hasOfficialCareersSignal(emptyCareersHtml), true)
  assert.equal(cel.hasEmptyNotificationSignal(emptyCareersHtml), true)
})

test('extractOpenings maps recruitment rows with download and applyonline links', async () => {
  const cel = await loadModule()
  const openings = cel.extractOpenings(listingsHtml)

  assert.equal(openings.length, 1)
  assert.deepEqual(openings[0], {
    title: 'Advt No. 118/Pers/1/2026',
    company: 'Central Electronics Limited',
    department: null,
    location: 'India',
    city: null,
    state: null,
    country: 'India',
    jobId: 'centralelectronicslimited-1',
    requisitionId: 'centralelectronicslimited-1',
    sourceUrl: 'https://www.celindia.co.in/uploads/advt-118.pdf',
    applyUrl: 'https://cel.applyonline.net.in/',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-01T00:00:00.000Z',
    closingDate: '2026-07-31T00:00:00.000Z',
    jobDescription: 'Official Central Electronics Limited recruitment notice. See the advertisement for role details.',
  })
})

test('run returns an empty list when the verified zero-state is present', async () => {
  const cel = await loadModule()
  const jobs = await cel.createCentralElectronicsLimitedScraper().run({
    fetchText: async (url) => {
      assert.equal(url, cel.CAREERS_URL)
      return emptyCareersHtml
    },
  })

  assert.deepEqual(jobs, [])
})
