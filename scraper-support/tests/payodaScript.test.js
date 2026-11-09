import assert from 'node:assert/strict'
import test from 'node:test'

const loadPayodaModule = async () => {
  try {
    return await import('../../scraper/payoda/script.js')
  } catch {
    return null
  }
}

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers · Build the future of agentic AI at Payoda</title>
  </head>
  <body>
    <main>
      <h1>Build the future of agentic AI for the industries that move the world.</h1>
      <section>
        <h2>Open Roles</h2>
        <p>Click any role to read the full job description. Inside, apply through Gmail or Outlook in your browser, or hand off to your default mail app. Every option opens a pre-filled draft to joinus@payoda.com.</p>
        <button type="button" class="group flex items-center justify-between gap-4 p-5 sm:p-6 bg-white border border-g200 rounded-[12px] hover:border-burg/40 hover:shadow-[0_8px_28px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all min-h-[44px] text-left">
          <div class="min-w-0 flex-1">
            <h4 class="font-display font-semibold text-[1rem] sm:text-[1.05rem] text-black group-hover:text-burg transition-colors mb-1.5 leading-snug">Senior ReactJS Developer</h4>
            <div class="text-[0.74rem] text-g500 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span class="inline-flex items-center gap-1.5 bg-burg/8 text-burg px-2 py-0.5 rounded-full font-display font-semibold text-[0.66rem] uppercase tracking-[0.08em]">Engineering</span>
              <span class="flex items-center gap-1">Coimbatore · Chennai · Bangalore</span>
              <span class="text-g300">·</span>
              <span>5–10 yrs · Full-time</span>
            </div>
          </div>
          <span>View job</span>
        </button>
        <button type="button" class="group flex items-center justify-between gap-4 p-5 sm:p-6 bg-white border border-g200 rounded-[12px] hover:border-burg/40 hover:shadow-[0_8px_28px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all min-h-[44px] text-left">
          <div class="min-w-0 flex-1">
            <h4>Senior Golang Developer</h4>
            <div>
              <span>Engineering</span>
              <span>Coimbatore · Chennai · Bangalore</span>
              <span>·</span>
              <span>5–10 yrs · Full-time</span>
            </div>
          </div>
          <span>View job</span>
        </button>
        <button type="button" class="group flex items-center justify-between gap-4 p-5 sm:p-6 bg-white border border-g200 rounded-[12px] hover:border-burg/40 hover:shadow-[0_8px_28px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all min-h-[44px] text-left">
          <div class="min-w-0 flex-1">
            <h4>Backend Engineer (Scala / Play)</h4>
            <div>
              <span>Engineering</span>
              <span>Hyderabad</span>
              <span>·</span>
              <span>3+ yrs · Full-time</span>
            </div>
          </div>
          <span>View job</span>
        </button>
        <button type="button" class="group flex items-center justify-between gap-4 p-5 sm:p-6 bg-white border border-g200 rounded-[12px] hover:border-burg/40 hover:shadow-[0_8px_28px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all min-h-[44px] text-left">
          <div class="min-w-0 flex-1">
            <h4>Power Platform Developer</h4>
            <div>
              <span>Engineering</span>
              <span>Bangalore · Mumbai · Delhi · Jaipur</span>
              <span>·</span>
              <span>4–8 yrs · Full-time</span>
            </div>
          </div>
          <span>View job</span>
        </button>
        <button type="button" class="group flex items-center justify-between gap-4 p-5 sm:p-6 bg-white border border-g200 rounded-[12px] hover:border-burg/40 hover:shadow-[0_8px_28px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all min-h-[44px] text-left">
          <div class="min-w-0 flex-1">
            <h4>Support Engineer</h4>
            <div>
              <span>Customer Success</span>
              <span>Bangalore · Mumbai · Delhi · Jaipur</span>
              <span>·</span>
              <span>4–8 yrs · Full-time</span>
            </div>
          </div>
          <span>View job</span>
        </button>
        <button type="button" class="group flex items-center justify-between gap-4 p-5 sm:p-6 bg-white border border-g200 rounded-[12px] hover:border-burg/40 hover:shadow-[0_8px_28px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all min-h-[44px] text-left">
          <div class="min-w-0 flex-1">
            <h4>Digital Marketing Specialist</h4>
            <div>
              <span>Marketing</span>
              <span>Coimbatore · India</span>
              <span>·</span>
              <span>7–10 yrs · Full-time</span>
            </div>
          </div>
          <span>View job</span>
        </button>
      </section>
      <section>
        <a href="mailto:joinus@payoda.com?subject=CV%3A%20open%20application">Send us your CV</a>
      </section>
    </main>
  </body>
</html>
`

const currentCareersPageHtml = careersPageHtml
  .replaceAll('View job', 'View role')
  .replaceAll('Â·', '·')
  .replaceAll('5â€“10 yrs', '5–10 yrs')
  .replaceAll('4â€“8 yrs', '4–8 yrs')
  .replaceAll('7â€“10 yrs', '7–10 yrs')

test('Payoda scraper recognizes the verified official careers page and extracts the live public role cards', async () => {
  const payoda = await loadPayodaModule()
  assert.ok(payoda, 'Expected Payoda scraper module at ../../scraper/payoda/script.js')

  assert.equal(payoda.CAREERS_URL, 'https://www.payoda.com/careers')
  assert.equal(payoda.COMPANY, 'Payoda')
  assert.equal(payoda.SOURCE, 'payoda')
  assert.equal(payoda.APPLICATION_EMAIL, 'joinus@payoda.com')
  assert.equal(payoda.hasOfficialCareersSignal(careersPageHtml), true)

  assert.deepEqual(payoda.extractRoleCards(careersPageHtml), [
    {
      title: 'Senior ReactJS Developer',
      department: 'Engineering',
      location: 'Coimbatore · Chennai · Bangalore, India',
      city: 'Coimbatore',
      experienceRequired: '5-10 yrs',
      employmentType: 'Full-time',
      sourceUrl: 'https://www.payoda.com/careers',
      applyUrl: 'mailto:joinus@payoda.com?subject=CV%3A%20open%20application',
    },
    {
      title: 'Senior Golang Developer',
      department: 'Engineering',
      location: 'Coimbatore · Chennai · Bangalore, India',
      city: 'Coimbatore',
      experienceRequired: '5-10 yrs',
      employmentType: 'Full-time',
      sourceUrl: 'https://www.payoda.com/careers',
      applyUrl: 'mailto:joinus@payoda.com?subject=CV%3A%20open%20application',
    },
    {
      title: 'Backend Engineer (Scala / Play)',
      department: 'Engineering',
      location: 'Hyderabad, India',
      city: 'Hyderabad',
      experienceRequired: '3+ yrs',
      employmentType: 'Full-time',
      sourceUrl: 'https://www.payoda.com/careers',
      applyUrl: 'mailto:joinus@payoda.com?subject=CV%3A%20open%20application',
    },
    {
      title: 'Power Platform Developer',
      department: 'Engineering',
      location: 'Bangalore · Mumbai · Delhi · Jaipur, India',
      city: 'Bangalore',
      experienceRequired: '4-8 yrs',
      employmentType: 'Full-time',
      sourceUrl: 'https://www.payoda.com/careers',
      applyUrl: 'mailto:joinus@payoda.com?subject=CV%3A%20open%20application',
    },
    {
      title: 'Support Engineer',
      department: 'Customer Success',
      location: 'Bangalore · Mumbai · Delhi · Jaipur, India',
      city: 'Bangalore',
      experienceRequired: '4-8 yrs',
      employmentType: 'Full-time',
      sourceUrl: 'https://www.payoda.com/careers',
      applyUrl: 'mailto:joinus@payoda.com?subject=CV%3A%20open%20application',
    },
    {
      title: 'Digital Marketing Specialist',
      department: 'Marketing',
      location: 'Coimbatore · India',
      city: 'Coimbatore',
      experienceRequired: '7-10 yrs',
      employmentType: 'Full-time',
      sourceUrl: 'https://www.payoda.com/careers',
      applyUrl: 'mailto:joinus@payoda.com?subject=CV%3A%20open%20application',
    },
  ])
})

test('Payoda scraper accepts the current View role CTA and Unicode role metadata separators', async () => {
  const payoda = await loadPayodaModule()
  assert.ok(payoda, 'Expected Payoda scraper module at ../../scraper/payoda/script.js')

  assert.equal(payoda.hasOfficialCareersSignal(currentCareersPageHtml), true)

  const roles = payoda.extractRoleCards(currentCareersPageHtml)
  assert.equal(roles.length, 6)
  assert.deepEqual(roles[0], {
    title: 'Senior ReactJS Developer',
    department: 'Engineering',
    location: 'Coimbatore · Chennai · Bangalore, India',
    city: 'Coimbatore',
    experienceRequired: '5-10 yrs',
    employmentType: 'Full-time',
    sourceUrl: 'https://www.payoda.com/careers',
    applyUrl: 'mailto:joinus@payoda.com?subject=CV%3A%20open%20application',
  })
})

test('run decorates Payoda jobs with the shared runner fields from the official public careers page', async () => {
  const payoda = await loadPayodaModule()
  assert.ok(payoda, 'Expected Payoda scraper module at ../../scraper/payoda/script.js')

  const requestedUrls = []
  const jobs = await payoda.createPayodaScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === payoda.CAREERS_URL) return careersPageHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, ['https://www.payoda.com/careers'])
  assert.equal(jobs.length, 6)
  assert.equal(jobs[0].company, 'Payoda')
  assert.equal(jobs[0].source, 'payoda')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].link, 'mailto:joinus@payoda.com?subject=CV%3A%20open%20application')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
