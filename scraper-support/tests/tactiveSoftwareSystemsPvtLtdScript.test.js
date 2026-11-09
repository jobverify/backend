import assert from 'node:assert/strict'
import test from 'node:test'

const loadTactiveModule = async () => {
  try {
    return await import('../../scraper/tactivesoftwaresystemspvtltd/script.js')
  } catch {
    assert.fail('Expected Tactive Software Systems Pvt. Ltd. scraper module at ../../scraper/tactivesoftwaresystemspvtltd/script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Join Our Team at Tactive Construction ERP Software</title>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "url": "https://www.tactivesoft.com/",
        "name": "Tactive Software Systems Private Limited"
      }
    </script>
  </head>
  <body>
    <main>
      <h2 class="title">Current <span>Openings</span></h2>

      <details id="e-n-accordion-item-2610" class="e-n-accordion-item">
        <summary class="e-n-accordion-item-title">
          <span class="e-n-accordion-item-title-header">
            <div class="e-n-accordion-item-title-text">Senior Quality Engineer - Manual Testing</div>
          </span>
        </summary>
        <div class="elementor-widget-container">
          <p><strong>Position :</strong> Senior Quality Engineer - Manual Testing</p>
          <p><strong>Experience Required :</strong> 5 -7 Years</p>
          <p><strong>Skills Required :</strong></p>
          <ul>
            <li>Excellent communication, time management skills, fast learner, self-motivated.</li>
            <li>Hands on experience in Selenium, Appium, Webdriver IO.</li>
          </ul>
          <p><strong>JOB Description:</strong></p>
          <ul>
            <li>Plan, develop, and execute test strategy across products and releases.</li>
            <li>Guide team quality efforts towards successful project delivery.</li>
          </ul>
          <a class="elementor-button elementor-button-link elementor-size-sm" href="#jobApplyForm">
            <span class="elementor-button-text">Apply</span>
          </a>
        </div>
      </details>

      <details id="e-n-accordion-item-2611" class="e-n-accordion-item">
        <summary class="e-n-accordion-item-title">
          <span class="e-n-accordion-item-title-header">
            <div class="e-n-accordion-item-title-text">SQL Developer</div>
          </span>
        </summary>
        <div class="elementor-widget-container">
          <p><strong>Department:</strong> Development</p>
          <p><strong>Location:</strong> Erode/ Chennai</p>
          <p><strong>No. Of Openings:</strong> 3</p>
          <p><strong>Experience &amp; Qualification :</strong> Bachelor's degree or equal demonstrated academic qualification with 2-4 years of experience in development using SQL Server.</p>
          <p><strong>Skills:</strong> Strong experience in writing complex SQL queries for data retrieval and analysis.</p>
          <p><strong>JOB Description:</strong></p>
          <ul>
            <li>Create tables, views, indexes, stored procedures, triggers and functions in SQL Server.</li>
            <li>Build reliable SQL data pipelines for product workflows.</li>
          </ul>
          <a class="elementor-button elementor-button-link elementor-size-sm" href="#jobApplyForm">
            <span class="elementor-button-text">Apply</span>
          </a>
        </div>
      </details>

      <details id="e-n-accordion-item-2612" class="e-n-accordion-item">
        <summary class="e-n-accordion-item-title">
          <span class="e-n-accordion-item-title-header">
            <div class="e-n-accordion-item-title-text">Development Lead (.NET, SQL)</div>
          </span>
        </summary>
        <div class="elementor-widget-container">
          <p><strong>Department:</strong> Development</p>
          <p><strong>Location:</strong> Chennai</p>
          <p><strong>No Of Openings :</strong> 4</p>
          <p><strong>Experience &amp; Qualification :</strong> Bachelor's degree or equal academic demonstrated qualification with 7+years of experience in development using ASP.NET, C#, JQuery, JavaScript, JSON, HTML, CSS and Restful APIs and strong in writing complex SQL queries.</p>
          <p><strong>Skills:</strong> Team management skills, time management skills, and ability to mentor engineers.</p>
          <p><strong>JOB Description:</strong></p>
          <ul>
            <li>Lead product engineering delivery across .NET and SQL systems.</li>
            <li>Coordinate technical design, code review, and release planning.</li>
          </ul>
          <a class="elementor-button elementor-button-link elementor-size-sm" href="#jobApplyForm">
            <span class="elementor-button-text">Apply</span>
          </a>
        </div>
      </details>
    </main>

    <section id="jobApplyForm">
      <h2>Apply Now</h2>
      <form>
        <input type="text" name="name" />
      </form>
    </section>
  </body>
</html>
`

test('Tactive validates the verified official careers page and extracts public accordion roles', async () => {
  const tactive = await loadTactiveModule()

  assert.equal(tactive.SOURCE, 'tactivesoftwaresystemspvtltd')
  assert.equal(tactive.COMPANY, 'Tactive Software Systems Pvt. Ltd.')
  assert.equal(tactive.CAREERS_URL, 'https://www.tactivesoft.com/careers/')
  assert.equal(tactive.APPLY_URL, 'https://www.tactivesoft.com/careers/#jobApplyForm')
  assert.equal(tactive.hasOfficialCareersSignal(officialCareersHtml), true)

  const jobs = tactive.extractOpenings(officialCareersHtml)

  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      department: job.department,
      location: job.location,
      city: job.city,
      country: job.country,
      jobId: job.jobId,
      requisitionId: job.requisitionId,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      experienceRequired: job.experienceRequired,
      remoteStatus: job.remoteStatus,
    })),
    [
      {
        title: 'Senior Quality Engineer - Manual Testing',
        department: 'Quality Assurance',
        location: 'India',
        city: null,
        country: 'India',
        jobId: 'tactivesoftwaresystemspvtltd-senior-quality-engineer-manual-testing-india',
        requisitionId: 'tactivesoftwaresystemspvtltd-senior-quality-engineer-manual-testing-india',
        sourceUrl: 'https://www.tactivesoft.com/careers/',
        applyUrl: 'https://www.tactivesoft.com/careers/#jobApplyForm',
        experienceRequired: '5-7 Years',
        remoteStatus: 'On-site',
      },
      {
        title: 'SQL Developer',
        department: 'Development',
        location: 'Erode/Chennai, India',
        city: null,
        country: 'India',
        jobId: 'tactivesoftwaresystemspvtltd-sql-developer-erode-chennai-india',
        requisitionId: 'tactivesoftwaresystemspvtltd-sql-developer-erode-chennai-india',
        sourceUrl: 'https://www.tactivesoft.com/careers/',
        applyUrl: 'https://www.tactivesoft.com/careers/#jobApplyForm',
        experienceRequired: '2-4 years',
        remoteStatus: 'On-site',
      },
      {
        title: 'Development Lead (.NET, SQL)',
        department: 'Development',
        location: 'Chennai, India',
        city: 'Chennai',
        country: 'India',
        jobId: 'tactivesoftwaresystemspvtltd-development-lead-net-sql-chennai-india',
        requisitionId: 'tactivesoftwaresystemspvtltd-development-lead-net-sql-chennai-india',
        sourceUrl: 'https://www.tactivesoft.com/careers/',
        applyUrl: 'https://www.tactivesoft.com/careers/#jobApplyForm',
        experienceRequired: '7+ years',
        remoteStatus: 'On-site',
      },
    ],
  )

  assert.match(jobs[0].jobDescription, /execute test strategy across products and releases/i)
  assert.match(jobs[1].jobDescription, /stored procedures, triggers and functions/i)
  assert.match(jobs[2].jobDescription, /Lead product engineering delivery across \.NET and SQL systems/i)
})

test('Tactive run decorates the extracted careers-page roles from the shared first-party apply anchor', async () => {
  const tactive = await loadTactiveModule()
  const requestedUrls = []

  const jobs = await tactive.createTactiveSoftwareSystemsPvtLtdScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return officialCareersHtml
    },
  })

  assert.deepEqual(requestedUrls, ['https://www.tactivesoft.com/careers/'])
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      company: job.company,
      source: job.source,
      link: job.link,
      location: job.location,
    })),
    [
      {
        title: 'Senior Quality Engineer - Manual Testing',
        company: 'Tactive Software Systems Pvt. Ltd.',
        source: 'tactivesoftwaresystemspvtltd',
        link: 'https://www.tactivesoft.com/careers/#jobApplyForm',
        location: 'India',
      },
      {
        title: 'SQL Developer',
        company: 'Tactive Software Systems Pvt. Ltd.',
        source: 'tactivesoftwaresystemspvtltd',
        link: 'https://www.tactivesoft.com/careers/#jobApplyForm',
        location: 'Erode/Chennai, India',
      },
      {
        title: 'Development Lead (.NET, SQL)',
        company: 'Tactive Software Systems Pvt. Ltd.',
        source: 'tactivesoftwaresystemspvtltd',
        link: 'https://www.tactivesoft.com/careers/#jobApplyForm',
        location: 'Chennai, India',
      },
    ],
  )
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})

test('Tactive fails closed when the verified careers shell changes or the accordion roles disappear', async () => {
  const tactive = await loadTactiveModule()

  await assert.rejects(
    tactive.createTactiveSoftwareSystemsPvtLtdScraper().run({
      fetchText: async () => `
        <html>
          <head><title>Careers - Join Our Team at Tactive Construction ERP Software</title></head>
          <body><main><h2>Current Openings</h2></main></body>
        </html>
      `,
    }),
    /Tactive careers page no longer matches the verified official public jobs surface/i,
  )

  await assert.rejects(
    tactive.createTactiveSoftwareSystemsPvtLtdScraper().run({
      fetchText: async () => `
        <html>
          <head>
            <title>Careers - Join Our Team at Tactive Construction ERP Software</title>
            <script type="application/ld+json">
              {"name":"Tactive Software Systems Private Limited"}
            </script>
          </head>
          <body>
            <main>
              <h2 class="title">Current <span>Openings</span></h2>
              <section id="jobApplyForm"><h2>Apply Now</h2></section>
            </main>
          </body>
        </html>
      `,
    }),
    /Tactive verified public openings changed or disappeared/i,
  )
})
