import assert from 'node:assert/strict'
import test from 'node:test'

const loadOmninosModule = async () => {
  try {
    return await import('../../scraper/omninossolutions/script.js')
  } catch {
    assert.fail('Expected Omninos Solutions scraper module at ../../scraper/omninossolutions/script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Current Job Openings at Omninos | Grow Your Career With Us</title>
  </head>
  <body>
    <h1>Current Openings at Omninos for Technology and Digital Professionals</h1>
    <div class="job-card">
      <span class="designation">UI/UX Designer</span>
      <span class="location">Mohali, India<i class="fad fa-angle-right"></i></span>
    </div>
    <div class="job-card">
      <span class="designation">Product Manager</span>
      <span class="location">Mohali, India<i class="fad fa-angle-right"></i></span>
    </div>
    <div class="job-card">
      <span class="designation">Marketing Manager</span>
      <span class="location">Mohali, India<i class="fad fa-angle-right"></i></span>
    </div>
  </body>
</html>
`

test('Omninos validates the verified current openings page and marks same-page cards as checked', async () => {
  const omninos = await loadOmninosModule()

  assert.equal(omninos.SOURCE, 'omninossolutions')
  assert.equal(omninos.COMPANY, 'Omninos Solutions')
  assert.equal(omninos.CAREERS_URL, 'https://omninos.in/current-opening.php')
  assert.equal(omninos.hasOfficialCareersSignal(officialCareersHtml), true)

  assert.deepEqual(omninos.extractRoles(officialCareersHtml), [
    { title: 'UI/UX Designer', location: 'Mohali, India' },
    { title: 'Product Manager', location: 'Mohali, India' },
    { title: 'Marketing Manager', location: 'Mohali, India' },
  ])

  const jobs = await omninos.run({
    fetchText: async (url) => {
      assert.equal(url, omninos.CAREERS_URL)
      return officialCareersHtml
    },
    now: () => '2026-08-06T12:00:00.000Z',
  })

  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs[0], {
    title: 'UI/UX Designer',
    company: 'Omninos Solutions',
    location: 'Mohali, India',
    country: 'India',
    sourceUrl: 'https://omninos.in/current-opening.php',
    applyUrl: 'https://omninos.in/current-opening.php',
    link: 'https://omninos.in/current-opening.php',
    source: 'omninossolutions',
    scrapedAt: '2026-08-06T12:00:00.000Z',
    publicExperienceChecked: true,
  })
  assert.ok(jobs.every((job) => job.publicExperienceChecked === true))
})

test('Omninos runStandalone writes dry-run output to jobs.json', async () => {
  const omninos = await loadOmninosModule()
  const savedFiles = []
  const savedDatabases = []

  await omninos.runStandalone({
    argv: ['node', 'omninossolutions/script.js', '--dry-run'],
    fetchText: async (url) => {
      assert.equal(url, omninos.CAREERS_URL)
      return officialCareersHtml
    },
    now: () => '2026-08-06T12:00:00.000Z',
    saveToFile: (jobs, filePath) => {
      savedFiles.push({ jobs, filePath })
    },
    saveToDB: async (jobs, source) => {
      savedDatabases.push({ jobs, source })
    },
  })

  assert.equal(savedFiles.length, 1)
  assert.equal(savedDatabases.length, 0)
  assert.match(savedFiles[0].filePath, /omninossolutions[\\/]jobs\.json$/)
  assert.equal(savedFiles[0].jobs.length, 3)
  assert.ok(savedFiles[0].jobs.every((job) => job.publicExperienceChecked === true))
})
