import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-25T00:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers &#8211; Latest Opening at Upstox</title>
    <link rel="canonical" href="https://upstox.com/careers/" />
  </head>
  <body>
    <h1>Careers</h1>
    <p>Explore 9 open positions across our teams.</p>
    <input type="text" placeholder="Search jobs by title, department, or location..." />

    <div class="group relative cursor-pointer overflow-hidden rounded-lg border border-gray-200 bg-white transition-all duration-200 hover:bg-gray-50 hover:shadow-md">
      <div class="flex items-start justify-between p-6">
        <div class="min-w-0 flex-1">
          <div class="mb-2 flex items-start justify-between">
            <h3 class="flex-1 text-lg font-semibold text-gray-900 transition-colors group-hover:text-primary-base">SDE II - Backend</h3>
          </div>
          <div class="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600">
            <div class="flex items-center">
              <svg class="lucide lucide-building2 lucide-building-2"></svg>
              <span>Engineering</span>
            </div>
            <div class="flex items-center">
              <svg class="lucide lucide-map-pin"></svg>
              <span>Mumbai, Maharashtra</span>
            </div>
            <div class="flex flex-wrap gap-2">
              <span class="inline-flex items-center rounded-md bg-gray-100 px-2.5 py-1 text-xs text-gray-700">Relevant experience required</span>
              <span class="inline-flex items-center rounded-md bg-gray-100 px-2.5 py-1 text-xs text-gray-700">Location: Sunshine Tower, Mumbai, Maharashtra, India (BOM.001), Umiya Business Bay I, Bangalore, Karnataka, India (BANG.001)</span>
              <span class="inline-flex items-center rounded-md bg-gray-100 px-2.5 py-1 text-xs text-gray-700">Employee Type: Permanent</span>
            </div>
            <span class="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">Hybrid</span>
            <div class="flex items-center">
              <svg class="lucide lucide-briefcase"></svg>
              <span>Full-time</span>
            </div>
            <div class="flex items-center text-gray-500">
              <svg class="lucide lucide-clock"></svg>
              <span>Posted Jan 6</span>
            </div>
          </div>
          <p class="line-clamp-2 text-sm text-gray-600">Join our Tech (Engg+IT) team as a SDE II - Backend. Location: Sunshine Tower, Mumbai, Maharashtra, India (BOM.001), Umiya Business Bay I, Bangalore, Karnataka, India (BANG.001).</p>
        </div>
      </div>
      <div class="absolute left-0 top-0 h-full w-1 origin-top scale-y-0 transform"></div>
    </div>

    <div class="group relative cursor-pointer overflow-hidden rounded-lg border border-gray-200 bg-white transition-all duration-200 hover:bg-gray-50 hover:shadow-md">
      <div class="flex items-start justify-between p-6">
        <div class="min-w-0 flex-1">
          <div class="mb-2 flex items-start justify-between">
            <h3 class="flex-1 text-lg font-semibold text-gray-900 transition-colors group-hover:text-primary-base">Associate Director - HRBP &amp; Talent Management</h3>
          </div>
          <div class="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600">
            <div class="flex items-center">
              <svg class="lucide lucide-building2 lucide-building-2"></svg>
              <span>Human Resources</span>
            </div>
            <div class="flex items-center">
              <svg class="lucide lucide-map-pin"></svg>
              <span>Mumbai, Maharashtra</span>
            </div>
            <div class="flex flex-wrap gap-2">
              <span class="inline-flex items-center rounded-md bg-gray-100 px-2.5 py-1 text-xs text-gray-700">6-10 years of experience</span>
              <span class="inline-flex items-center rounded-md bg-gray-100 px-2.5 py-1 text-xs text-gray-700">Location: Sunshine Tower, Mumbai, Maharashtra, India (BOM.001)</span>
              <span class="inline-flex items-center rounded-md bg-gray-100 px-2.5 py-1 text-xs text-gray-700">Employee Type: Permanent</span>
            </div>
            <span class="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">Onsite</span>
            <div class="flex items-center">
              <svg class="lucide lucide-briefcase"></svg>
              <span>Full-time</span>
            </div>
            <div class="flex items-center text-gray-500">
              <svg class="lucide lucide-clock"></svg>
              <span>Posted Apr 16</span>
            </div>
          </div>
          <p class="line-clamp-2 text-sm text-gray-600">Join our HR team as a Associate Director - HRBP &amp; Talent Management. Experience required: 6-10 years. Location: Sunshine Tower, Mumbai, Maharashtra, India (BOM.001).</p>
        </div>
      </div>
      <div class="absolute left-0 top-0 h-full w-1 origin-top scale-y-0 transform"></div>
    </div>
  </body>
</html>
`

const loadUpstoxModule = async () => {
  try {
    return await import('../../scraper/upstox/script.js')
  } catch {
    assert.fail('Expected Upstox scraper module at ../../scraper/upstox/script.js')
  }
}

test('Upstox pins the verified first-party careers shell and server-rendered job cards', async () => {
  const upstox = await loadUpstoxModule()

  assert.equal(upstox.SOURCE, 'upstox')
  assert.equal(upstox.COMPANY_NAME, 'Upstox')
  assert.equal(upstox.COMPANY, 'Upstox')
  assert.equal(upstox.VERIFIED_ON, '2026-07-25')
  assert.equal(upstox.OFFICIAL_SITE_URL, 'https://upstox.com/')
  assert.equal(upstox.CAREERS_PAGE_URL, 'https://upstox.com/careers/')
  assert.equal(upstox.hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(upstox.extractJobCards(careersHtml).length, 2)

  const jobs = upstox.extractJobsFromPage(careersHtml)
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'SDE II - Backend',
    company: 'Upstox',
    department: 'Engineering',
    location: 'Sunshine Tower, Mumbai, Maharashtra, India (BOM.001), Umiya Business Bay I, Bangalore, Karnataka, India (BANG.001)',
    city: 'Mumbai',
    country: 'India',
    jobId: 'sde-ii-backend',
    requisitionId: 'sde-ii-backend',
    sourceUrl: 'https://upstox.com/careers/#sde-ii-backend',
    applyUrl: 'https://upstox.com/careers/#sde-ii-backend',
    employmentType: 'Full-time',
    experienceRequired: 'Relevant experience required',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription:
      'Join our Tech (Engg+IT) team as a SDE II - Backend. Location: Sunshine Tower, Mumbai, Maharashtra, India (BOM.001), Umiya Business Bay I, Bangalore, Karnataka, India (BANG.001). Verified location: Sunshine Tower, Mumbai, Maharashtra, India (BOM.001), Umiya Business Bay I, Bangalore, Karnataka, India (BANG.001). Work model: Hybrid. Employment type: Full-time. Experience: Relevant experience required. Posted: Jan 6.',
    remoteStatus: 'Hybrid',
  })
  assert.equal(jobs[1].title, 'Associate Director - HRBP & Talent Management')
  assert.equal(jobs[1].department, 'Human Resources')
  assert.equal(jobs[1].experienceRequired, '6-10 years of experience')
  assert.equal(jobs[1].remoteStatus, 'On-site')
})

test('Upstox run validates the first-party careers page and returns same-page job cards', async () => {
  const upstox = await loadUpstoxModule()
  const requestedUrls = []

  const jobs = await upstox.createUpstoxScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requestedUrls, [upstox.CAREERS_PAGE_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'upstox')
  assert.equal(jobs[0].link, 'https://upstox.com/careers/#sde-ii-backend')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

test('Upstox fails closed when the first-party careers surface changes materially', async () => {
  const upstox = await loadUpstoxModule()

  await assert.rejects(
    upstox.createUpstoxScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified upstox careers page/i,
  )
})
