import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Zeon Charging</title>
    <link rel="canonical" href="https://zeoncharging.com/" />
  </head>
  <body>
    <h1>INDIA'S MOST RELIABLE EV CHARGING NETWORK</h1>
    <a href="/about_us">About Us</a>
    <a href="/careers">Careers</a>
    <a href="/contact_us">Contact Us</a>
    <span>Find Nearest Station</span>
    <span>Our Charging Network</span>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Who We Are</h1>
    <p>Zeon Electric Pvt Ltd is building EV charging infrastructure.</p>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Contact Us</h1>
    <p>care@zeoncharging.com</p>
    <p>Tiruppur, Tamil Nadu</p>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Join Us</h1>
    <h2>Open Positions</h2>
    <div class="card">
      <div class="row">
        <div class="col-xs-6 pad_lr">Tiruppur</div>
        <div class="experience col-xs-6">Fresher</div>
      </div>
      <div class="content col-xs-12 pad_lr">
        <h3 id="job_title_184653">Customer Support Executive</h3>
        <h6>Customer Support</h6>
        <p>
          Full-time customer support role handling phone, chat, and email queries.
          <a href="JavaScript:show_job_role('184653')" class="more_on_role">more..</a>
        </p>
      </div>
      <div id="job_role_184653" class="hide">
        <html>
          <body>
            <h2>Customer Support Executive</h2>
            <h3>Job Type</h3>
            <p>Full-time</p>
          </body>
        </html>
      </div>
      <div class="row">
        <a href="JavaScript:apply_job('184653')" class="zeon-btn-wl col-xs-6">Apply Now</a>
        <span class="date col-xs-6">Posted 6 weeks ago</span>
      </div>
    </div>
    <div class="card">
      <div class="row">
        <div class="col-xs-6 pad_lr">Tiruppur</div>
        <div class="experience col-xs-6">2 to 3 years</div>
      </div>
      <div class="content col-xs-12 pad_lr">
        <h3 id="job_title_184655">Team Lead - Customer Support</h3>
        <h6>Team Leader</h6>
        <p>
          The Customer Support Team Lead will oversee and mentor the support team.
          <a href="JavaScript:show_job_role('184655')" class="more_on_role">more..</a>
        </p>
      </div>
      <div id="job_role_184655" class="hide">
        <html>
          <body>
            <h2>Customer Support Team Lead</h2>
            <h3>Job Type</h3>
            <p>Full-time</p>
          </body>
        </html>
      </div>
      <div class="row">
        <a href="JavaScript:apply_job('184655')" class="zeon-btn-wl col-xs-6">Apply Now</a>
        <span class="date col-xs-6">Posted 2 weeks ago</span>
      </div>
    </div>
  </body>
</html>
`

const nextJsCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>EV Charging Jobs in India | Careers at Zeon Charging</title>
  </head>
  <body>
    <main>
      <section>
        <h1>Join Us in Building the Future of EV Charging</h1>
        <h2>Open Positions</h2>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "JobPosting",
            "title": "Network Operations Executive",
            "description": "<p>Support charger uptime and field issue triage across Zeon sites.</p>",
            "employmentType": "FULL_TIME",
            "jobLocation": {
              "@type": "Place",
              "address": {
                "@type": "PostalAddress",
                "addressCountry": "IN",
                "addressLocality": "Tiruppur",
                "addressRegion": "Tamil Nadu"
              }
            },
            "url": "https://zeoncharging.com/forms/apply_job?job_id=186002",
            "datePosted": "2026-08-25",
            "validThrough": "2026-11-23"
          }
        </script>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "JobPosting",
            "title": "Accounts Manager",
            "description": "<p>Lead accounting operations, compliance, and audits for Zeon International.</p>",
            "employmentType": "FULL_TIME",
            "jobLocation": {
              "@type": "Place",
              "address": {
                "@type": "PostalAddress",
                "addressCountry": "IN",
                "addressLocality": "Tiruppur",
                "addressRegion": "Tamil Nadu"
              }
            },
            "url": "https://zeoncharging.com/forms/apply_job?job_id=186001",
            "datePosted": "2026-08-20",
            "validThrough": "2026-11-18"
          }
        </script>
      </section>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/zeoncharging/script.js')
  } catch {
    assert.fail('Expected Zeon Charging scraper module at ../../scraper/zeoncharging/script.js')
  }
}

test.skip('Zeon Charging recognizes the current official homepage and card-based careers page', async () => {
  const zeon = await loadModule()

  assert.equal(zeon.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(zeon.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(zeon.hasOfficialContactSignal(contactHtml), true)
  assert.equal(zeon.hasOfficialCareersSignal(careersHtml), true)

  assert.deepEqual(zeon.extractJobCards(careersHtml), [
    {
      title: 'Customer Support Executive',
      company: 'Zeon Electric Pvt Ltd',
      department: 'Customer Support',
      location: 'Tiruppur, India',
      city: 'Tiruppur',
      state: null,
      country: 'India',
      jobId: 'zeoncharging-184653',
      requisitionId: '184653',
      sourceUrl: 'https://zeoncharging.com/careers#job-184653',
      applyUrl: 'https://zeoncharging.com/careers#job-184653',
      employmentType: 'Full-time',
      experienceRequired: 'Fresher',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Full-time customer support role handling phone, chat, and email queries.',
      remoteStatus: 'On-site',
    },
    {
      title: 'Team Lead - Customer Support',
      company: 'Zeon Electric Pvt Ltd',
      department: 'Team Leader',
      location: 'Tiruppur, India',
      city: 'Tiruppur',
      state: null,
      country: 'India',
      jobId: 'zeoncharging-184655',
      requisitionId: '184655',
      sourceUrl: 'https://zeoncharging.com/careers#job-184655',
      applyUrl: 'https://zeoncharging.com/careers#job-184655',
      employmentType: 'Full-time',
      experienceRequired: '2 to 3 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'The Customer Support Team Lead will oversee and mentor the support team.',
      remoteStatus: 'On-site',
    },
  ])
})

test.skip('Zeon Charging run verifies homepage, about, contact, and careers surfaces', async () => {
  const zeon = await loadModule()
  const requestedUrls = []

  const jobs = await zeon.createZeonChargingScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === zeon.LEGACY_HOMEPAGE_URL) {
        return { status: 200, url: zeon.HOMEPAGE_URL, html: homepageHtml }
      }
      if (url === zeon.ABOUT_URL) {
        return { status: 200, url, html: aboutHtml }
      }
      if (url === zeon.CONTACT_URL) {
        return { status: 200, url, html: contactHtml }
      }
      if (url === zeon.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      throw new Error(`Unexpected Zeon URL: ${url}`)
    },
    now: () => '2026-08-01T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    zeon.LEGACY_HOMEPAGE_URL,
    zeon.ABOUT_URL,
    zeon.CONTACT_URL,
    zeon.CAREERS_URL,
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'zeoncharging')
  assert.equal(jobs[0].scrapedAt, '2026-08-01T00:00:00.000Z')
  assert.equal(jobs[1].jobId, 'zeoncharging-184655')
})

test('Zeon Charging also extracts live Next.js JSON-LD job cards from the official careers page', async () => {
  const zeon = await loadModule()

  assert.equal(zeon.hasOfficialCareersSignal(nextJsCareersHtml), true)
  assert.deepEqual(zeon.extractJobCards(nextJsCareersHtml), [
    {
      title: 'Network Operations Executive',
      company: 'Zeon Electric Pvt Ltd',
      department: null,
      location: 'Tiruppur, Tamil Nadu, India',
      city: 'Tiruppur',
      state: 'Tamil Nadu',
      country: 'India',
      jobId: 'zeoncharging-186002',
      requisitionId: '186002',
      sourceUrl: 'https://zeoncharging.com/forms/apply_job?job_id=186002',
      applyUrl: 'https://zeoncharging.com/forms/apply_job?job_id=186002',
      employmentType: 'FULL_TIME',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-08-25',
      closingDate: '2026-11-23',
      jobDescription: 'Support charger uptime and field issue triage across Zeon sites.',
      remoteStatus: 'On-site',
    },
    {
      title: 'Accounts Manager',
      company: 'Zeon Electric Pvt Ltd',
      department: null,
      location: 'Tiruppur, Tamil Nadu, India',
      city: 'Tiruppur',
      state: 'Tamil Nadu',
      country: 'India',
      jobId: 'zeoncharging-186001',
      requisitionId: '186001',
      sourceUrl: 'https://zeoncharging.com/forms/apply_job?job_id=186001',
      applyUrl: 'https://zeoncharging.com/forms/apply_job?job_id=186001',
      employmentType: 'FULL_TIME',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-08-20',
      closingDate: '2026-11-18',
      jobDescription: 'Lead accounting operations, compliance, and audits for Zeon International.',
      remoteStatus: 'On-site',
    },
  ])
})
