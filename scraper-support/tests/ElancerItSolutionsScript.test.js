import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html>
  <head><title>Careers | Elancer IT Solutions Pvt. Ltd </title></head>
  <body>
    <h2>Open Positions</h2>
    <span class="career-posting-title">Project Coordinator / Senior Team Coordinator</span>
    <span><i class="bi bi-geo-alt"></i> Hyderabad, Work From Office</span>
    <span><i class="bi bi-briefcase"></i> 3–7 Years</span>
    <span><i class="bi bi-clock"></i> Full-Time, General Shift</span>
    <span class="career-posting-title">Business Development Executive – AI & Data Services</span>
    <span><i class="bi bi-geo-alt"></i> Hyderabad, On-site/Hybrid</span>
    <span><i class="bi bi-briefcase"></i> 2–4 Years</span>
    <span><i class="bi bi-clock"></i> Full-Time</span>
    <p>Interested candidates: Send your resume to hr@elancerits.com</p>
  </body>
</html>
`

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/elanceritsolutions/script.js')
  } catch {
    assert.fail('Expected Elancer It Solutions scraper module at ../../scraper/elanceritsolutions/script.js')
  }
}

test('Elancer It Solutions extracts the verified same-page openings and email-apply links', async () => {
  const elancer = await loadScriptModule()

  assert.equal(elancer.hasOfficialCareersSignal(careersHtml), true)

  const jobs = await elancer.run({
    fetchText: async () => careersHtml,
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.deepEqual(jobs, [
    {
      title: 'Project Coordinator / Senior Team Coordinator',
      company: 'Elancer It Solutions',
      location: 'Hyderabad, Work From Office',
      country: 'India',
      experienceRequired: '3–7 Years',
      employmentType: 'Full-Time',
      sourceUrl: 'https://elancerits.com/careers.html',
      applyUrl:
        'mailto:hr@elancerits.com?subject=Project%20Coordinator%20%2F%20Senior%20Team%20Coordinator%20Application',
      link:
        'mailto:hr@elancerits.com?subject=Project%20Coordinator%20%2F%20Senior%20Team%20Coordinator%20Application',
      source: 'elanceritsolutions',
      scrapedAt: '2026-07-18T00:00:00.000Z',
    },
    {
      title: 'Business Development Executive – AI & Data Services',
      company: 'Elancer It Solutions',
      location: 'Hyderabad, On-site/Hybrid',
      country: 'India',
      experienceRequired: '2–4 Years',
      employmentType: 'Full-Time',
      sourceUrl: 'https://elancerits.com/careers.html',
      applyUrl:
        'mailto:hr@elancerits.com?subject=Business%20Development%20Executive%20%E2%80%93%20AI%20%26%20Data%20Services%20Application',
      link:
        'mailto:hr@elancerits.com?subject=Business%20Development%20Executive%20%E2%80%93%20AI%20%26%20Data%20Services%20Application',
      source: 'elanceritsolutions',
      scrapedAt: '2026-07-18T00:00:00.000Z',
    },
  ])
})
