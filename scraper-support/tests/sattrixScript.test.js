import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-18T00:00:00.000Z'

const VERIFIED_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Grow Your Career in Cybersecurity | Sattrix InfoSec</title>
  </head>
  <body>
    <main>
      <h1>Join Our Team</h1>
      <p>Take the first step towards a rewarding career with us!</p>
      <h2>Career Opportunities with Us!</h2>
      <p>Discover exciting career opportunities with us!</p>
      <h2>Current Openings</h2>

      <h2>Cybersecurity Associate</h2>
      <h4>Training Location</h4>
      <p>Ahmedabad</p>
      <h4>Job Location</h4>
      <p>Anywhere in India</p>
      <h4>Experience</h4>
      <p>Fresher</p>
      <h4>Department</h4>
      <p>Managed Security Services</p>
      <h3>Job description</h3>
      <ul>
        <li>Operate SIEM consoles in order to monitor environmental threats and incidents.</li>
        <li>Document and contain security incidents detected on the network.</li>
        <li>Ready to commit to work for 2 years.</li>
      </ul>
      <h3>Education and skills</h3>
      <ul>
        <li>Bachelor's degree or equivalent.</li>
        <li>Have strong knowledge of IT networking Concepts.</li>
        <li>Must skills - Excellent command of verbal and written English.</li>
      </ul>

      <h2>Cybersecurity Engineer - L1/L2/L3</h2>
      <h4>Training Location</h4>
      <p>Ahmedabad</p>
      <h4>Job Location</h4>
      <p>Anywhere in India</p>
      <h4>Experience</h4>
      <p>3-6 years</p>
      <h4>Department</h4>
      <p>Managed Security Services</p>
      <h3>Job description</h3>
      <ul>
        <li>Understand cyber-attack methods and perform analysis of security logs.</li>
        <li>Good understanding of vulnerabilities, threats, risks, and compliance.</li>
        <li>Expertise in ArcSight, Splunk, and other SIEM products essential.</li>
      </ul>

      <h2>Splunk Admin - L1/L2/L3</h2>
      <h4>Training Location</h4>
      <p>Ahmedabad</p>
      <h4>Job Location</h4>
      <p>Anywhere in India</p>
      <h4>Experience</h4>
      <p>3-6 years</p>
      <h4>Department</h4>
      <p>Managed Security Services</p>
      <h3>Job description</h3>
      <h4>Experience Tools and Technology</h4>
      <ul>
        <li>Splunk ES Implementation, integration.</li>
        <li>Integration of threat intelligence tools MISP with Splunk.</li>
      </ul>
      <h4>Responsibilities</h4>
      <ul>
        <li>Responsible for the SIEM management and upkeep.</li>
        <li>SOAR playbook development for end-to-end automation.</li>
      </ul>

      <h2>Couldn't find the job you are looking for?</h2>
      <a href="https://docs.google.com/forms/d/e/1FAIpQLSdzjRKoDdKMbn_U1b8TqztyHqpEdbV8X18fCdB5dAJ1tGcURg/viewform?usp=sf_link">Apply now!</a>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/sattrix/script.js')
  } catch {
    assert.fail('Expected Sattrix scraper module at ../../scraper/sattrix/script.js')
  }
}

test('Sattrix helpers stay pinned to the verified same-domain Current Openings structure', async () => {
  const sattrix = await loadModule()

  assert.equal(sattrix.SOURCE, 'sattrix')
  assert.equal(sattrix.COMPANY, 'Sattrix')
  assert.equal(sattrix.OFFICIAL_BRAND_NAME, 'Sattrix Information Security')
  assert.equal(sattrix.VERIFIED_ON, '2026-07-18')
  assert.equal(sattrix.CAREER_PAGE_URL, 'https://www.sattrix.com/career.php')
  assert.equal(
    sattrix.APPLICATION_FORM_URL,
    'https://docs.google.com/forms/d/e/1FAIpQLSdzjRKoDdKMbn_U1b8TqztyHqpEdbV8X18fCdB5dAJ1tGcURg/viewform?usp=sf_link',
  )
  assert.equal(sattrix.hasOfficialSattrixCareersSignal(VERIFIED_CAREERS_HTML), true)
  assert.equal(
    sattrix.extractApplicationFormUrl(VERIFIED_CAREERS_HTML),
    sattrix.APPLICATION_FORM_URL,
  )

  const jobs = sattrix.extractSearchResults(VERIFIED_CAREERS_HTML)
  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs[0], {
    title: 'Cybersecurity Associate',
    company: 'Sattrix',
    department: 'Managed Security Services',
    location: 'Anywhere in India',
    city: null,
    country: 'India',
    jobId: 'cybersecurity-associate',
    requisitionId: null,
    sourceUrl: 'https://www.sattrix.com/career.php#cybersecurity-associate',
    applyUrl: 'https://www.sattrix.com/career.php#cybersecurity-associate',
    employmentType: null,
    experienceRequired: 'Fresher',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      "Bachelor's degree or equivalent.",
      'Have strong knowledge of IT networking Concepts.',
      'Must skills - Excellent command of verbal and written English.',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription:
      'Operate SIEM consoles in order to monitor environmental threats and incidents. Document and contain security incidents detected on the network. Ready to commit to work for 2 years.',
  })
  assert.equal(jobs[1].title, 'Cybersecurity Engineer - L1/L2/L3')
  assert.equal(jobs[1].location, 'Anywhere in India')
  assert.equal(jobs[2].title, 'Splunk Admin - L1/L2/L3')
  assert.match(jobs[2].jobDescription, /SOAR playbook development/i)
})

test('Sattrix run validates the official careers page and returns the public same-page roles', async () => {
  const sattrix = await loadModule()
  const requestedUrls = []

  const jobs = await sattrix.createSattrixScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return VERIFIED_CAREERS_HTML
    },
  })

  assert.deepEqual(requestedUrls, [sattrix.CAREER_PAGE_URL])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'sattrix')
  assert.equal(jobs[0].company, 'Sattrix')
  assert.equal(jobs[0].link, 'https://www.sattrix.com/career.php#cybersecurity-associate')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

test('Sattrix fails closed when the verified first-party careers structure drifts materially', async () => {
  const sattrix = await loadModule()

  await assert.rejects(
    sattrix.createSattrixScraper().run({
      fetchText: async () => VERIFIED_CAREERS_HTML.replace('Current Openings', 'Open Roles'),
    }),
    /verified official careers page/i,
  )
})
