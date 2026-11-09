import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<html>
  <head><title>Verinite | Explore World of  Opportunities with Us</title></head>
  <body>
    <div class="job_box">
      <h5>Prime Test Lead</h5>
      <p class="mt_20 job_location"><span class="theme_text">Pune</span><span class="job_status">Full Time</span></p>
      <a href="lead-tsys-prime.html">Apply Now</a>
    </div>
    <div class="job_box">
      <h5>Powercard L2 Support</h5>
      <p class="mt_20 job_location"><span class="theme_text">Pune / Chennai</span><span class="job_status">Full Time</span></p>
      <a href="bau-analyst-2.html">Apply Now</a>
    </div>
  </body>
</html>
`

const loadVeriniteModule = async () => import('./script.js')

test('Verinite Technologies extracts verified job cards from the official careers page', async () => {
  const verinite = await loadVeriniteModule()
  const jobs = verinite.extractJobCards(careersHtml)

  assert.equal(verinite.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(jobs, [
    {
      title: 'Prime Test Lead',
      company: 'Verinite Technologies',
      department: null,
      location: 'Pune, India',
      city: 'Pune',
      country: 'India',
      jobId: 'lead-tsys-prime',
      requisitionId: 'lead-tsys-prime',
      sourceUrl: 'https://www.verinite.com/lead-tsys-prime.html',
      applyUrl: 'https://www.verinite.com/lead-tsys-prime.html',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
    {
      title: 'Powercard L2 Support',
      company: 'Verinite Technologies',
      department: null,
      location: 'Pune / Chennai, India',
      city: 'Pune',
      country: 'India',
      jobId: 'bau-analyst-2',
      requisitionId: 'bau-analyst-2',
      sourceUrl: 'https://www.verinite.com/bau-analyst-2.html',
      applyUrl: 'https://www.verinite.com/bau-analyst-2.html',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
  ])
})

test('Verinite Technologies run decorates verified openings with shared runner fields', async () => {
  const verinite = await loadVeriniteModule()
  const jobs = await verinite.createVeriniteTechnologiesScraper({
    now: () => '2026-07-18T00:00:00.000Z',
  }).run({
    fetchText: async () => careersHtml,
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'verinitetechnologies')
  assert.equal(jobs[0].scrapedAt, '2026-07-18T00:00:00.000Z')
})
