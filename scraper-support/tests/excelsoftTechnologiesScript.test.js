import assert from 'node:assert/strict'
import test from 'node:test'

const loadExcelsoftModule = async () => {
  try {
    return await import('../../scraper/excelsofttechnologies/script.js')
  } catch {
    assert.fail('Expected Excelsoft Technologies scraper module at ../../scraper/excelsofttechnologies/script.js')
  }
}

const careersLandingHtml = `
<!doctype html>
<html>
  <head>
    <title>Culture and Careers | Excelsoft Technologies</title>
  </head>
  <body>
    <h1>One Team One Dream</h1>
    <p>Being an Excelian is just a choice away!</p>
    <p>An excellent opportunity to explore your career aspirations and scale up your career graph.</p>
    <script>
      rec_embed_js.load({widget_id:"rec_job_listing_div",page_name:"Excelsoft-Technology",source:"CareerSite",site:"https://excelsoftcorp.zohorecruit.com",empty_job_msg:"No current Openings"});
    </script>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html>
  <body>
    <h2>Open Positions</h2>
    <a href="/career/apply/software-engineer">Apply Now</a>
  </body>
</html>
`

test('Excelsoft Technologies recognises the verified branding-only careers landing page', async () => {
  const excelsoft = await loadExcelsoftModule()

  assert.equal(excelsoft.CAREER_PAGE_URL, 'https://www.excelsoftcorp.com/career/')
  assert.equal(excelsoft.hasOfficialZohoEmptyState(careersLandingHtml), true)
  assert.equal(excelsoft.isVerifiedBrandingOnlySurface(careersLandingHtml), true)
  assert.equal(excelsoft.isVerifiedBrandingOnlySurface(publicJobsHtml), false)
})

test('run returns no jobs only while Excelsoft stays on the verified no-public-openings surface', async () => {
  const excelsoft = await loadExcelsoftModule()
  const requestedUrls = []

  const jobs = await excelsoft.createExcelsoftTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersLandingHtml
    },
  })

  assert.deepEqual(requestedUrls, ['https://www.excelsoftcorp.com/career/'])
  assert.deepEqual(jobs, [])
})

test('run fails closed when Excelsoft exposes public openings on the first-party careers page', async () => {
  const excelsoft = await loadExcelsoftModule()

  await assert.rejects(
    excelsoft.createExcelsoftTechnologiesScraper().run({
      fetchText: async () => publicJobsHtml,
    }),
    /verified Excelsoft no-public-openings surface/i,
  )
})
