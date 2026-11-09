import assert from 'node:assert/strict'
import test from 'node:test'

const loadPermisoModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Permiso scraper module at ./script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>UNCORPORATE CAREERS ARE MORE FUN</h1>
      <p>Uncorp your career and become a cloud security revolutionary at Permiso.</p>
      <a href="https://permiso.io/careers/openings/?hsLang=en">Current Openings</a>
    </main>
  </body>
</html>
`

const officialOpeningsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <div class="job-opening">
        <div id="grid-list" class="custom-job-opening-wrap grid">
          <div class="custom-job-opening-item sales full-time grid-item">
            <div class="custom-job-opening-col">
              <div class="custom-job-opening-date">Date posted: 08.8.25</div>
              <div class="custom-category-wrap">
                <span class="custom-job-opening-catergory-item">Sales</span>
              </div>
              <h3 class="custom-job-opening-title">Business Development Representative</h3>
              <p class="custom-job-opening-full-time">FULL TIME: Remote</p>
              <p class="custom-job-opening-location">Location: Remote</p>
              <div class="custom-job-opening-descrption">
                <div class="custom-job-opening-descrption-form">
                  <p>Location:&nbsp;Remote (North America)<br>Department:&nbsp;Sales / Business Development</p>
                  <p>About Us</p>
                  <p>Permiso Security is on a mission to transform identity security.</p>
                </div>
              </div>
            </div>
          </div>
          <div class="custom-job-opening-item engineering full-time grid-item">
            <div class="custom-job-opening-col">
              <div class="custom-job-opening-date">Date posted: 07.10.26</div>
              <div class="custom-category-wrap">
                <span class="custom-job-opening-catergory-item">Engineering</span>
              </div>
              <h3 class="custom-job-opening-title">Senior Detection Engineer</h3>
              <p class="custom-job-opening-full-time">FULL TIME: Bangalore</p>
              <p class="custom-job-opening-location">Location: Bangalore, India</p>
              <div class="custom-job-opening-descrption">
                <div class="custom-job-opening-descrption-form">
                  <p>Location:&nbsp;Bangalore, India<br>Department:&nbsp;Engineering</p>
                  <p>Build detections for identity-focused threats.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div id="hs_form_target_form_432811819"></div>
      </div>
    </main>
  </body>
</html>
`

test('Permiso scraper validates the official careers handoff and extracts inline opening cards', async () => {
  const permiso = await loadPermisoModule()

  assert.equal(permiso.SOURCE, 'permiso')
  assert.equal(permiso.COMPANY, 'Permiso')
  assert.equal(permiso.CAREERS_URL, 'https://permiso.io/careers')
  assert.equal(permiso.OPENINGS_URL, 'https://permiso.io/careers/openings/')
  assert.equal(permiso.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(permiso.hasOfficialOpeningsSignal(officialOpeningsHtml), true)

  assert.deepEqual(permiso.extractRoleCards(officialOpeningsHtml), [
    {
      title: 'Business Development Representative',
      department: 'Sales / Business Development',
      location: 'Remote (North America)',
      city: null,
      employmentType: 'FULL TIME',
      postingDate: '2025-08-08',
      jobDescription: 'About Us Permiso Security is on a mission to transform identity security.',
      sourceUrl: 'https://permiso.io/careers/openings/',
      applyUrl: 'https://permiso.io/careers/openings/',
    },
    {
      title: 'Senior Detection Engineer',
      department: 'Engineering',
      location: 'Bangalore, India',
      city: 'Bangalore',
      employmentType: 'FULL TIME',
      postingDate: '2026-07-10',
      jobDescription: 'Build detections for identity-focused threats.',
      sourceUrl: 'https://permiso.io/careers/openings/',
      applyUrl: 'https://permiso.io/careers/openings/',
    },
  ])
})

test('Permiso scraper returns only India openings from the verified public official surface', async () => {
  const permiso = await loadPermisoModule()
  const requestedUrls = []

  const jobs = await permiso.createPermisoScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === permiso.CAREERS_URL) return officialCareersHtml
      if (url === permiso.OPENINGS_URL) return officialOpeningsHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://permiso.io/careers',
    'https://permiso.io/careers/openings/',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Senior Detection Engineer')
  assert.equal(jobs[0].company, 'Permiso')
  assert.equal(jobs[0].source, 'permiso')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].link, 'https://permiso.io/careers/openings/')
  assert.equal(jobs[0].postingDate, '2026-07-10')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})

test('Permiso scraper fails closed when the official careers flow changes', async () => {
  const permiso = await loadPermisoModule()

  await assert.rejects(
    permiso.createPermisoScraper().run({
      fetchText: async () => '<html><body><h1>Permiso jobs</h1></body></html>',
    }),
    /verified official careers surface/i,
  )

  await assert.rejects(
    permiso.createPermisoScraper().run({
      fetchText: async (url) => {
        if (url === permiso.CAREERS_URL) return officialCareersHtml
        if (url === permiso.OPENINGS_URL) {
          return '<html><body><main><h1>Current Opening | Permiso</h1></main></body></html>'
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified public openings surface/i,
  )
})
