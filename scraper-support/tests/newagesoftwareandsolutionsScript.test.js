import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-21T00:00:00.000Z'

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Freight Software and Logistics BPO Careers | Newage</title>
  </head>
  <body>
    <h1>Learn and Grow With Us</h1>
    <p>Join Newage and be part of a global team driving innovation in cloud technology, where your ideas are valued and your growth is supported.</p>
    <a href="/careers/inside-sales-specialist" class="card group v2 w-inline-block">
      <h3 class="text-23">Inside Sales Specialist</h3>
      <div class="font-bold text--graphite">Mumbai</div>
    </a>
    <div class="source-modal-content">
      <strong>Experience:</strong> 3 to 5 years
      <div class="rt--careers-page w-richtext">Support pipeline generation and business growth across India, the Middle East (GCC), and the Americas.</div>
      <div class="flex"><a href="/apply-now" class="btn secondary w-inline-block apply-now">APPLY NOW</a></div>
    </div>
    <a href="/careers/enterprise-account-management---freight-forwarding-saas" class="card group v2 w-inline-block">
      <h3 class="text-23">Enterprise Account Management – Freight Forwarding SaaS</h3>
      <div class="font-bold text--graphite">UAE, Dubai</div>
    </a>
    <div class="source-modal-content">
      <strong>Experience:</strong> 8+ years
      <div class="rt--careers-page w-richtext">Lead strategic account development for freight forwarding customers.</div>
      <div class="flex"><a href="/apply-now" class="btn secondary w-inline-block apply-now">APPLY NOW</a></div>
    </div>
    <a href="/careers/senior-associate" class="card group v2 w-inline-block">
      <h3 class="text-23">Senior Associate</h3>
      <div class="font-bold text--graphite">Chennai, India</div>
    </a>
    <div class="source-modal-content">
      <strong>Experience:</strong> 2 to 4 years
      <div class="rt--careers-page w-richtext">Handle end-to-end shipping import/export documentation back-office process.</div>
      <div class="flex"><a href="/apply-now" class="btn secondary w-inline-block apply-now">APPLY NOW</a></div>
    </div>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/newagesoftwareandsolutions/script.js')
  } catch {
    assert.fail('Expected NewAge scraper module at ../../scraper/newagesoftwareandsolutions/script.js')
  }
}

test('NewAge accepts the live August 21, 2026 careers title and still extracts inline role cards', async () => {
  const newage = await loadModule()

  assert.equal(newage.hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.deepEqual(newage.extractRoleCards(CAREERS_HTML), [
    {
      jobId: 'inside-sales-specialist',
      title: 'Inside Sales Specialist',
      location: 'Mumbai',
      detailUrl: 'https://www.newage-global.com/careers/inside-sales-specialist',
      applyUrl: 'https://www.newage-global.com/apply-now',
      description: 'Support pipeline generation and business growth across India, the Middle East (GCC), and the Americas.',
      experienceRequired: '3 to 5 years',
    },
    {
      jobId: 'enterprise-account-management-freight-forwarding-saas',
      title: 'Enterprise Account Management – Freight Forwarding SaaS',
      location: 'UAE, Dubai',
      detailUrl: 'https://www.newage-global.com/careers/enterprise-account-management---freight-forwarding-saas',
      applyUrl: 'https://www.newage-global.com/apply-now',
      description: 'Lead strategic account development for freight forwarding customers.',
      experienceRequired: '8+ years',
    },
    {
      jobId: 'senior-associate',
      title: 'Senior Associate',
      location: 'Chennai, India',
      detailUrl: 'https://www.newage-global.com/careers/senior-associate',
      applyUrl: 'https://www.newage-global.com/apply-now',
      description: 'Handle end-to-end shipping import/export documentation back-office process.',
      experienceRequired: '2 to 4 years',
    },
  ])
})

test('NewAge run still returns only the India-facing roles from the live page shape', async () => {
  const newage = await loadModule()

  const jobs = await newage.createNewAgeSoftwareAndSolutionsScraper({
    fetchText: async () => CAREERS_HTML,
    now: () => FIXED_SCRAPED_AT,
  }).run()

  assert.deepEqual(jobs.map((job) => ({
    title: job.title,
    location: job.location,
    city: job.city,
    source: job.source,
    scrapedAt: job.scrapedAt,
  })), [
    {
      title: 'Inside Sales Specialist',
      location: 'Mumbai',
      city: 'Mumbai',
      source: 'newagesoftwareandsolutions',
      scrapedAt: FIXED_SCRAPED_AT,
    },
    {
      title: 'Senior Associate',
      location: 'Chennai, India',
      city: 'Chennai',
      source: 'newagesoftwareandsolutions',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})
