import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Unistring Tech Solutions</title>
    </head>
    <body>
      <header>
        <nav>
          <a class="rkit-menu-text" href="https://unistring.com/career/">Career</a>
        </nav>
      </header>
      <main>
        <h1>Unistring Tech Solutions</h1>
        <h5>Empowering Spectrum Awareness</h5>
        <h2>Revolutionizing Electronic Warfare</h2>
        <p>Established in 2007, we are not just a company but a hub of creativity and advanced technology.</p>
        <p>Unistring Tech Solutions Pvt. Ltd.</p>
      </main>
    </body>
  </html>
`

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Career &#8211; Unistring Tech Solutions</title>
    </head>
    <body>
      <main>
        <h1>CAREER</h1>
        <p>Take your career to a new level</p>
        <h2>LIFE AT UTS</h2>
        <p>Chase your future</p>
        <h2>Current Openings</h2>

        <section class="opening-card">
          <h2>Digital Signal Processing Module Lead</h2>
          <a class="elementor-button-link" href="https://www.linkedin.com/posts/unistring-tech-solutions-pvt-ltd-uts-_dspjobs-digitalsignalprocessing-techcareers-activity-7288483221007216640-I8B_?utm_source=share&amp;utm_medium=member_desktop">Apply Now</a>
          <ul>
            <li><span class="elementor-icon-list-text">Experience : <style type="text/css">td {border: 1px solid #cccccc;}</style>5-10 Years</span></li>
            <li><span class="elementor-icon-list-text">Location : Hyderabad</span></li>
          </ul>
          <svg aria-hidden="true"><path d="M256 288c79.5 0 144-64.5 144-144"></path></svg>
          <p>We are looking for a Real-Time Firmware and Signal Processing Engineer to design, develop, and test VHDL-based firmware and signal processing algorithms for EW, RADAR, C-UAS, and Wireless Communication Systems.</p>
        </section>

        <section class="opening-card">
          <h2>Software Quality Assurance Engineer</h2>
          <a class="elementor-button-link" href="https://www.linkedin.com/posts/unistring-tech-solutions-pvt-ltd-uts-_sqaengineer-softwarequalityassurance-cmmi-activity-7275138564361801728-xDq-?utm_source=share&amp;utm_medium=member_desktop">Apply Now</a>
          <ul>
            <li><span class="elementor-icon-list-text">Experience : 4-5 Years</span></li>
            <li><span class="elementor-icon-list-text">Location : Hyderabad</span></li>
          </ul>
          <p>We are seeking an experienced Software Quality Assurance (SQA) Engineer with a strong background in quality assurance process and tools, specifically in the software industry.</p>
        </section>

        <section class="opening-card">
          <h2>Assistant Corporate Trainer /Corporate Trainer (Embedded Software)</h2>
          <a class="elementor-button-link" href="https://forms.gle/F7DPcrNRH4dA2Kvx9">Apply Now</a>
          <ul>
            <li><span class="elementor-icon-list-text">Experience : 0-5 Years</span></li>
            <li><span class="elementor-icon-list-text">Location : Hyderabad</span></li>
          </ul>
          <p>We are seeking an Assistant Corporate Trainer (Embedded Software) with expertise in C, C++, Python, and embedded systems programming to deliver engaging training sessions and develop comprehensive training materials.</p>
        </section>

        <h2>Join Us</h2>
        <ul>
          <li><a href="https://www.linkedin.com/feed/update/urn:li:activity:7172934061026390016">Junior RF Test Engineer</a></li>
          <li><a href="https://www.linkedin.com/feed/update/urn:li:activity:7172934061026390016">Junior Integration Engineer</a></li>
        </ul>
        <a href="https://accounts.google.com/">Job Application</a>
      </main>
    </body>
  </html>
`

test('Unistring validates the verified first-party homepage and careers surface markers', async () => {
  const unistring = await loadModule()
  assert.ok(unistring, 'Unistring scraper module should load')

  assert.equal(unistring.SOURCE, 'unistring')
  assert.equal(unistring.COMPANY, 'Unistring Tech Solutions')
  assert.equal(unistring.HOMEPAGE_URL, 'https://unistring.com/')
  assert.equal(unistring.CAREERS_URL, 'https://unistring.com/career/')
  assert.equal(unistring.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(unistring.hasOfficialCareersSignal(careersHtml), true)
})

test('Unistring extracts jobs from the verified Current Openings section only', async () => {
  const unistring = await loadModule()
  assert.ok(unistring, 'Unistring scraper module should load')

  assert.deepEqual(unistring.extractJobsFromCareersPage(careersHtml), [
    {
      title: 'Assistant Corporate Trainer /Corporate Trainer (Embedded Software)',
      company: 'Unistring Tech Solutions',
      department: null,
      location: 'Hyderabad, Telangana, India',
      city: 'Hyderabad',
      country: 'India',
      jobId: 'assistant-corporate-trainer-corporate-trainer-embedded-software',
      requisitionId: 'assistant-corporate-trainer-corporate-trainer-embedded-software',
      sourceUrl: 'https://unistring.com/career/',
      applyUrl: 'https://forms.gle/F7DPcrNRH4dA2Kvx9',
      employmentType: null,
      experienceRequired: '0-5 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'We are seeking an Assistant Corporate Trainer (Embedded Software) with expertise in C, C++, Python, and embedded systems programming to deliver engaging training sessions and develop comprehensive training materials.',
    },
    {
      title: 'Digital Signal Processing Module Lead',
      company: 'Unistring Tech Solutions',
      department: null,
      location: 'Hyderabad, Telangana, India',
      city: 'Hyderabad',
      country: 'India',
      jobId: 'digital-signal-processing-module-lead',
      requisitionId: 'digital-signal-processing-module-lead',
      sourceUrl: 'https://unistring.com/career/',
      applyUrl: 'https://www.linkedin.com/posts/unistring-tech-solutions-pvt-ltd-uts-_dspjobs-digitalsignalprocessing-techcareers-activity-7288483221007216640-I8B_?utm_source=share&utm_medium=member_desktop',
      employmentType: null,
      experienceRequired: '5-10 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'We are looking for a Real-Time Firmware and Signal Processing Engineer to design, develop, and test VHDL-based firmware and signal processing algorithms for EW, RADAR, C-UAS, and Wireless Communication Systems.',
    },
    {
      title: 'Software Quality Assurance Engineer',
      company: 'Unistring Tech Solutions',
      department: null,
      location: 'Hyderabad, Telangana, India',
      city: 'Hyderabad',
      country: 'India',
      jobId: 'software-quality-assurance-engineer',
      requisitionId: 'software-quality-assurance-engineer',
      sourceUrl: 'https://unistring.com/career/',
      applyUrl: 'https://www.linkedin.com/posts/unistring-tech-solutions-pvt-ltd-uts-_sqaengineer-softwarequalityassurance-cmmi-activity-7275138564361801728-xDq-?utm_source=share&utm_medium=member_desktop',
      employmentType: null,
      experienceRequired: '4-5 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'We are seeking an experienced Software Quality Assurance (SQA) Engineer with a strong background in quality assurance process and tools, specifically in the software industry.',
    },
  ])
})

test('Unistring run adds scraper metadata and ignores the older Join Us teaser links', async () => {
  const unistring = await loadModule()
  assert.ok(unistring, 'Unistring scraper module should load')

  const requestedUrls = []
  const jobs = await unistring.createUnistringScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === unistring.HOMEPAGE_URL) return homepageHtml
      if (url === unistring.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected Unistring URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://unistring.com/',
    'https://unistring.com/career/',
  ])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'unistring')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.match(jobs[0].scrapedAt, /\d{4}-\d{2}-\d{2}T/)
  assert.equal(jobs.some((job) => /Junior RF Test Engineer/i.test(job.title)), false)
})

test('Unistring fails closed when the homepage, careers markers, or job-card contract drifts', async () => {
  const unistring = await loadModule()
  assert.ok(unistring, 'Unistring scraper module should load')

  await assert.rejects(
    unistring.createUnistringScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected homepage</h1></body></html>',
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    unistring.createUnistringScraper().run({
      fetchText: async (url) => {
        if (url === unistring.HOMEPAGE_URL) return homepageHtml
        return '<html><body><h1>Unexpected careers page</h1></body></html>'
      },
    }),
    /verified careers page/i,
  )

  await assert.rejects(
    unistring.createUnistringScraper().run({
      fetchText: async (url) => {
        if (url === unistring.HOMEPAGE_URL) return homepageHtml
        return careersHtml.replace(
          'Experience : 4-5 Years',
          'Experience details removed',
        )
      },
    }),
    /job-card contract/i,
  )
})
