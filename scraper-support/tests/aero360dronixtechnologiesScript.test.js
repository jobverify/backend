import assert from 'node:assert/strict'
import test from 'node:test'

const officialCareersHtml = `
  <html>
    <head><title>Careers - Aero360</title></head>
    <body>
      <header>Aero 360</header>
      <main>
        <h1>Careers</h1>
        <h2>Current Openings</h2>
        <h4>Edtech Business Developement</h4>
        <p>Identify and target potential clients, including schools and universities.</p>
        <h4>Ground Control Station software Developer</h4>
        <p>Design, develop, and maintain software for unmanned systems.</p>
        <h4>FLIGHT CONTROLS - SOFTWARE ENGINEER</h4>
        <p>Develop control systems for UAV flight control and navigation.</p>
        <a href="https://www.linkedin.com/jobs/view/flight-controls">Apply Now</a>
        <h2>Trainees and Interns</h2>
        <h4>Trainee UAV Engineer</h4>
        <p>Support the creation and modification of UAV prototypes.</p>
        <a href="https://forms.gle/trainee-uav-engineer">Apply Now</a>
      </main>
      <footer>Copyright Dronix Technologies Private Limited.</footer>
    </body>
  </html>
`

test('Aero360 maps official careers openings into runner-ready job records', async () => {
  const aero360 = await import('../../scraper/aero360dronixtechnologies/script.js')
  const requestedUrls = []

  assert.equal(aero360.hasOfficialCareersSignal(officialCareersHtml), true)

  const jobs = await aero360.createAero360DronixTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return officialCareersHtml
    },
  })

  assert.deepEqual(requestedUrls, [aero360.CAREERS_URL])
  assert.equal(jobs.length, 4)
  assert.deepEqual(jobs.map((job) => job.title), [
    'Edtech Business Developement',
    'Ground Control Station software Developer',
    'FLIGHT CONTROLS - SOFTWARE ENGINEER',
    'Trainee UAV Engineer',
  ])
  assert.equal(jobs[0].company, 'Aero360 - Dronix Technologies')
  assert.equal(jobs[0].location, 'Chennai, Tamil Nadu, India')
  assert.equal(jobs[0].sourceUrl, aero360.CAREERS_URL)
  assert.equal(jobs[0].applyUrl, aero360.CAREERS_URL)
  assert.equal(jobs[2].applyUrl, 'https://www.linkedin.com/jobs/view/flight-controls')
  assert.equal(jobs[3].applyUrl, 'https://forms.gle/trainee-uav-engineer')
  assert.equal(jobs[0].source, 'aero360dronixtechnologies')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('Aero360 refuses to scrape when the official careers surface changes', async () => {
  const aero360 = await import('../../scraper/aero360dronixtechnologies/script.js')

  await assert.rejects(
    aero360.createAero360DronixTechnologiesScraper().run({
      fetchText: async () => '<html><body>Unrelated site</body></html>',
    }),
    /official careers surface/i,
  )
})
