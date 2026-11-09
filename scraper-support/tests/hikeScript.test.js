import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html><html><head><title>Open roles — Hike Careers</title></head><body>
  <h1>Build what a billion people feel.</h1>
  <p>Hike is building a family of apps — Messenger, Cinema, Travel and Sports.</p>
  <div class="public-job-card"><div><div class="title"><a href="/jobs/JOB-ONE">Senior Android Engineer</a></div><div class="meta"><span>Engineering</span><span class="meta-dot"></span><span>India</span></div></div><div class="actions"><a class="btn btn-primary" href="/jobs/JOB-ONE/apply">Apply</a></div></div>
  <div class="public-job-card"><div><div class="title"><a href="/jobs/JOB-TWO">Product Intern</a></div><div class="meta"><span>Product</span><span class="meta-dot"></span><span>India</span></div></div><div class="actions"><a class="btn btn-primary" href="/jobs/JOB-TWO/apply">Apply</a></div></div>
</body></html>
`

const buildDetail = ({ title, location, experience }) => `
<!doctype html><html><head><title>${title} — Hike Careers</title></head><body>
  <h1>${title}</h1><h3>About the role</h3>
  <div class="jd">Job Title: ${title}\nLocation: ${location}\nExperience: ${experience}\nBuild products for Hike users.</div>
  <a class="btn btn-primary" href="/jobs/apply">Apply</a>
</body></html>
`

const loadHikeModule = async () => import('../../scraper/hike/script.js')

test('Hike parses current first-party careers cards and role-level detail locations', async () => {
  const hike = await loadHikeModule()
  assert.equal(hike.CAREERS_URL, 'https://careers.hikeapp.com/jobs')
  assert.equal(hike.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(hike.extractJobCards(careersHtml).length, 2)

  const jobs = await hike.createHikeScraper({
    now: () => '2026-09-13T00:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      if (url === hike.CAREERS_URL) return { status: 200, url, html: careersHtml }
      if (url.endsWith('/JOB-ONE')) {
        return { status: 200, url, html: buildDetail({ title: 'Senior Android Engineer', location: 'Gurgaon, India (Onsite)', experience: '6-9 Years' }) }
      }
      if (url.endsWith('/JOB-TWO')) {
        return { status: 200, url, html: buildDetail({ title: 'Product Intern', location: 'India', experience: '0-1 Years' }) }
      }
      throw new Error(`Unexpected URL ${url}`)
    },
  })

  assert.deepEqual(jobs.map(({ title, location, city, remoteStatus, experienceRequired }) => ({ title, location, city, remoteStatus, experienceRequired })), [
    { title: 'Senior Android Engineer', location: 'Gurgaon, India', city: 'Gurgaon', remoteStatus: 'On-site', experienceRequired: '6-9 Years' },
    { title: 'Product Intern', location: 'India', city: null, remoteStatus: null, experienceRequired: '0-1 Years' },
  ])
})

test('Hike fails closed when its careers listing or a role detail drifts', async () => {
  const hike = await loadHikeModule()
  await assert.rejects(
    hike.run({ fetchPage: async (url) => ({ status: 200, url, html: '<html>No jobs</html>' }) }),
    /official careers page/i,
  )

  await assert.rejects(
    hike.run({
      fetchPage: async (url) => url === hike.CAREERS_URL
        ? { status: 200, url, html: careersHtml }
        : { status: 404, url, html: 'gone' },
    }),
    /job detail/i,
  )
})
