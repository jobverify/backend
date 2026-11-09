import assert from 'node:assert/strict'
import test from 'node:test'

const loadSchnellModule = async () => {
  try {
    return await import('../../scraper/schnellenergyequipments/script.js')
  } catch {
    assert.fail('Expected Schnell Energy Equipments scraper module at ../../scraper/schnellenergyequipments/script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Careers</h1>
      <p>SCHNELL OPENINGS</p>
      <p>Interested Candidates can apply or send their resume to the given Mail Id Or Can Contact to the given number.</p>
      <a href="mailto:hr.talentacquisition@schnellenergy.com">hr.talentacquisition@schnellenergy.com</a>
      <a href="https://schnellenergy.com/job-application/">Apply Now</a>

      <section>
        <h5><strong>Site Engineers - Projects and O&amp;M (POM)</strong></h5>
        <h6>JD : Responsible for the end to end project activities in designated BBMP constituencies.</h6>
        <h6>Qualification: Electrical Engg Degree/Diploma. Experience: 5 Years Hands on Field Experience</h6>
        <p><b>No of Position</b></p>
        <p>5</p>
        <p><b>Location : Bangalore</b></p>
        <a href="https://schnellenergy.com/job-application/">APPLY NOW</a>
      </section>

      <section>
        <h5><strong>Technician - Projects and O&amp;M</strong></h5>
        <h6>JD : Rectify complaints CCMS controller given by the CMS team.</h6>
        <h6>Qualification: ITI / Diploma Electrical</h6>
        <p><b>No of Position</b></p>
        <p>12</p>
        <p><b>Location : Coimbatore, Tirupur, Avadi, Hosur.</b></p>
        <a href="https://schnellenergy.com/job-application/">APPLY NOW</a>
      </section>
    </main>
  </body>
</html>
`

test('Schnell Energy Equipments scraper validates the official careers page and extracts public openings', async () => {
  const schnell = await loadSchnellModule()

  assert.equal(schnell.SOURCE, 'schnellenergyequipments')
  assert.equal(schnell.COMPANY, 'Schnell Energy Equipments Private Limited')
  assert.equal(schnell.CAREERS_URL, 'https://schnellenergy.com/careers/')
  assert.equal(schnell.APPLY_URL, 'https://schnellenergy.com/job-application/')
  assert.equal(schnell.hasOfficialCareersSignal(officialCareersHtml), true)

  assert.deepEqual(schnell.extractOpenings(officialCareersHtml), [
    {
      title: 'Site Engineers - Projects and O&M (POM)',
      location: 'Bangalore, India',
      city: 'Bangalore',
      minimumQualification: 'Electrical Engg Degree/Diploma.',
      experienceRequired: '5 Years Hands on Field Experience',
      jobDescription: 'Responsible for the end to end project activities in designated BBMP constituencies.',
      openingCount: 5,
      sourceUrl: 'https://schnellenergy.com/careers/',
      applyUrl: 'https://schnellenergy.com/job-application/',
      remoteStatus: 'On-site',
    },
    {
      title: 'Technician - Projects and O&M',
      location: 'Coimbatore, Tirupur, Avadi, Hosur, India',
      city: 'Coimbatore',
      minimumQualification: 'ITI / Diploma Electrical',
      experienceRequired: null,
      jobDescription: 'Rectify complaints CCMS controller given by the CMS team.',
      openingCount: 12,
      sourceUrl: 'https://schnellenergy.com/careers/',
      applyUrl: 'https://schnellenergy.com/job-application/',
      remoteStatus: 'On-site',
    },
  ])
})

test('Schnell Energy Equipments run decorates the public openings with shared scraper metadata', async () => {
  const schnell = await loadSchnellModule()
  const requestedUrls = []

  const jobs = await schnell.createSchnellEnergyEquipmentsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return officialCareersHtml
    },
  })

  assert.deepEqual(requestedUrls, [schnell.CAREERS_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].company, 'Schnell Energy Equipments Private Limited')
  assert.equal(jobs[0].source, 'schnellenergyequipments')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(typeof jobs[0].scrapedAt, 'string')
  assert.notEqual(jobs[0].jobId, jobs[1].jobId)
})

test('Schnell Energy Equipments fails closed when the verified official careers page changes', async () => {
  const schnell = await loadSchnellModule()

  await assert.rejects(
    schnell.createSchnellEnergyEquipmentsScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /verified official public careers surface/i,
  )
})
