import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-18T12:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Intersoft</title>
  </head>
  <body>
    <h2>Work With Us</h2>
    <div>We help companies reach their full potential.</div>
    <h2>Current Openings</h2>
    <div class="vc_do_toggle vc_toggle vc_toggle_default">
      <div class="vc_toggle_title"><h4>Data Modeler</h4></div>
      <div class="vc_toggle_content">
        <p><strong>Required Skill Set :</strong></p>
        <ul>
          <li>Hands on experience with ERWIN Data Modeler.</li>
          <li>Working on the Enterprise Data Mart.</li>
        </ul>
        <p>Mail Resume to <a href="mailto:career@intsof.com">career@intsof.com</a> in the format [First name]_[Job Title].Pdf or [First name]_[Job Title].docx</p>
        <p>Location &#8211; India Development Centre</p>
      </div>
    </div>
    <div class="vc_do_toggle vc_toggle vc_toggle_default">
      <div class="vc_toggle_title"><h4>Core .NET Dev / Sr. Dev.</h4></div>
      <div class="vc_toggle_content">
        <p><strong>Candidates must have experience in :</strong></p>
        <ul>
          <li>.NET Core and ASP.NET MVC.</li>
          <li>Web API and SQL Server.</li>
        </ul>
        <p>Mail Resume to <a href="mailto:career@intsof.com">career@intsof.com</a> in the format [First name]_[Job Title].Pdf or [First name]_[Job Title].docx.</p>
        <p>Location &#8211; India Development Centre</p>
      </div>
    </div>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/intersoftdatalabs/script.js')
  } catch {
    assert.fail('Expected Intersoft Data Labs scraper module at ../../scraper/intersoftdatalabs/script.js')
  }
}

test('Intersoft Data Labs validates the verified first-party openings page and extracts toggle jobs', async () => {
  const intersoft = await loadModule()

  assert.equal(intersoft.SOURCE, 'intersoftdatalabs')
  assert.equal(intersoft.COMPANY, 'Intersoft Data Labs')
  assert.equal(intersoft.CAREERS_URL, 'https://intsof.com/careers/')
  assert.equal(intersoft.VERIFIED_ON, '2026-07-18')
  assert.equal(intersoft.hasOfficialCareersSignal(careersHtml), true)

  const openings = intersoft.extractJobToggles(careersHtml)
  assert.equal(openings.length, 2)
  assert.equal(openings[0].title, 'Data Modeler')
  assert.equal(openings[1].title, 'Core .NET Dev / Sr. Dev.')
})

test('Intersoft Data Labs run returns current openings with the resume email handoff', async () => {
  const intersoft = await loadModule()

  const jobs = await intersoft.createIntersoftDataLabsScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async () => careersHtml,
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'Data Modeler')
  assert.equal(jobs[0].location, 'India Development Centre')
  assert.match(jobs[0].applyUrl, /^mailto:career@intsof\.com/i)
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(jobs[1].title, 'Core .NET Dev / Sr. Dev.')
  assert.deepEqual(jobs[1].requiredSkills, ['.NET Core and ASP.NET MVC.', 'Web API and SQL Server.'])
})

test('Intersoft Data Labs fails closed when the verified openings contract changes', async () => {
  const intersoft = await loadModule()

  await assert.rejects(
    intersoft.createIntersoftDataLabsScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /verified intersoft careers surface/i,
  )
})

test('Intersoft Data Labs can recover with a browser-backed careers page when direct requests fail', async () => {
  const intersoft = await loadModule()
  const browserUrls = []

  const jobs = await intersoft.createIntersoftDataLabsScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async () => {
      throw new TypeError('fetch failed')
    },
    fetchBrowserText: async (url) => {
      browserUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(browserUrls, [intersoft.CAREERS_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'intersoftdatalabs')
})
