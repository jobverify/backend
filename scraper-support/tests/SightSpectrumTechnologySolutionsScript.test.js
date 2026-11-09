import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h3>Join Our Team</h3>
    <h1>These are positions currently open at SightSpectrum</h1>
    <section class="job-opening">
      <h2>Data Engineer</h2>
      <p>chennai</p>
      <p>Role Summary: Build and manage scalable data pipelines and infrastructure to support analytics and business insights.</p>
      <h3>Requirements</h3>
      <ul>
        <li>SQL</li>
        <li>Python</li>
        <li>Spark</li>
      </ul>
      <span>Apply</span>
    </section>
    <section class="job-opening">
      <h2>UI/UX Designer</h2>
      <p>Remote</p>
      <p>We are looking for a talented Frontend Engineer to join our dynamic team.</p>
      <h3>Requirements</h3>
      <ul>
        <li>React</li>
        <li>Vue.js</li>
        <li>HTML/CSS</li>
      </ul>
      <span>Apply</span>
    </section>
    <section class="job-opening">
      <h2>Sales Lead</h2>
      <p>Dallas</p>
      <p>Lead North America growth.</p>
    </section>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/sightspectrumtechnologysolutions/script.js')
  } catch {
    assert.fail('Expected SightSpectrum Technology Solutions scraper module at ../../scraper/sightspectrumtechnologysolutions/script.js')
  }
}

test('SightSpectrum historical helpers preserve identities and unknown country without invented experience', async () => {
  const sightspectrum = await loadModule()
  assert.equal(sightspectrum.SOURCE, 'sightspectrumtechnologysolutions')
  assert.equal(sightspectrum.COMPANY, 'SightSpectrum Technology Solutions')
  assert.equal(sightspectrum.CAREERS_URL, 'https://www.sightspectrum.com/careers')
  assert.equal(sightspectrum.VERIFIED_ON, '2026-07-18')
  assert.equal(sightspectrum.hasOfficialCareersSignal(careersHtml), true)
  const jobs = sightspectrum.extractJobs(careersHtml)
  assert.deepEqual(jobs.map(job => job.title), ['Data Engineer', 'UI/UX Designer', 'Sales Lead'])
  assert.ok(jobs.every(job => job.country === null && job.experienceRequired === null && job.sourceDetailComplete === false))
  assert.match(jobs[0].jobDescription, /SQL Python Spark/)
  assert.equal(jobs[1].remoteStatus, 'Remote')
})

test('SightSpectrum current runtime refuses obsolete body-only transport instead of manufacturing India jobs', async () => {
  const sightspectrum = await loadModule()
  await assert.rejects(sightspectrum.run({ fetchText: async () => careersHtml }), /metadata|transport/i)
})

test('SightSpectrum current runtime fails closed when the official careers surface drifts', async () => {
  const sightspectrum = await loadModule()
  await assert.rejects(sightspectrum.run({ fetchImpl: async url => {
    const response = new Response('<html><body><h1>SightSpectrum</h1></body></html>', { headers: { 'content-type': 'text/html' } })
    Object.defineProperty(response, 'url', { value: url })
    return response
  } }), /verified sightspectrum technology solutions careers surface/i)
})
