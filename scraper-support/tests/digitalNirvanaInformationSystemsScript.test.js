import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Digital Nirvana: AI and Media Intelligence Solutions</title>
  </head>
  <body>
    <main>
      <h1>Digital Nirvana: AI and Media Intelligence Solutions</h1>
      <p>Managed Talent Solutions</p>
      <a href="https://digital-nirvana.com/careers-at-digital-nirvana/">Explore Career</a>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join Careers at Digital Nirvana Today</title>
  </head>
  <body>
    <main>
      <h1>Grow with Purpose: Your Rewarding Career at Digital Nirvana</h1>
      <h2>Browse By Location</h2>
      <ul>
        <li>
          <a href="#content-california">
            <span class="elementskit-tab-title">California, USA</span>
          </a>
        </li>
        <li>
          <a href="#content-hyderabad">
            <span class="elementskit-tab-title">Hyderabad, India</span>
          </a>
        </li>
        <li>
          <a href="#content-coimbatore">
            <span class="elementskit-tab-title">Coimbatore, India</span>
          </a>
        </li>
      </ul>

      <div class="tab-pane" id="content-california">
        <div class="ekit-heading">
          <h2 class="ekit-heading--title">Support Specialist</h2>
          <h4 class="ekit-heading--subtitle">Process: Sales &amp; Marketing</h4>
          <div class='ekit-heading__description'>
            <p>2+ years of related experience with computers, technical troubleshooting, and providing customer service in a call center environment.</p>
          </div>
        </div>
        <a href="mailto:jobs@digital-nirvana.com">
          <span class="elementor-button-text">Apply Now</span>
        </a>
      </div>

      <div class="tab-pane" id="content-hyderabad">
        <div class="ekit-heading">
          <h3 class="ekit-heading--title">Editor/Senior Editor - Financial Content</h3>
          <h4 class="ekit-heading--subtitle">Process: Business Transcription</h4>
          <div class='ekit-heading__description'>
            <p>Experience: Minimum 1+ Years as Editor/Proof Reader. Location: Work Form Home -Anywhere in India.</p>
          </div>
        </div>
        <a href="mailto:jobs@digital-nirvana.com">
          <span class="elementor-button-text">Apply Now</span>
        </a>

        <div class="ekit-heading">
          <h2 class="ekit-heading--title">Editor &amp; Captioner</h2>
          <h4 class="ekit-heading--subtitle">Process: Closed Caption Services</h4>
          <div class='ekit-heading__description'>
            <p>Exceptional audio sensitivity - ability to understand spoken English/Other languages in different accents across the globe.</p>
          </div>
        </div>
        <a href="mailto:jobs@digital-nirvana.com">
          <span class="elementor-button-text">Apply Now</span>
        </a>
      </div>

      <div class="tab-pane" id="content-coimbatore">
        <div class="ekit-heading">
          <h3 class="ekit-heading--title">Editor/Senior Editor - Financial Content</h3>
          <h4 class="ekit-heading--subtitle">Process: Business Transcription</h4>
          <div class='ekit-heading__description'>
            <p>Experience: Minimum 1+ Years as Editor/Proof Reader. Location: Work Form Home -Anywhere in India.</p>
          </div>
        </div>
        <a href="mailto:jobs@digital-nirvana.com">
          <span class="elementor-button-text">Apply Now</span>
        </a>
      </div>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/digitalnirvanainformationsystems/script.js')
  } catch {
    assert.fail('Expected Digital Nirvana Information Systems scraper module at ../../scraper/digitalnirvanainformationsystems/script.js')
  }
}

test('Digital Nirvana Information Systems helpers stay pinned to the Sunday, August 2, 2026 homepage and careers-page contract', async () => {
  const digitalNirvana = await loadModule()

  assert.equal(digitalNirvana.SOURCE, 'digitalnirvanainformationsystems')
  assert.equal(digitalNirvana.COMPANY, 'Digital Nirvana Information Systems')
  assert.equal(digitalNirvana.HOMEPAGE_URL, 'https://digital-nirvana.com/')
  assert.equal(digitalNirvana.CAREERS_URL, 'https://digital-nirvana.com/careers-at-digital-nirvana/')
  assert.equal(digitalNirvana.VERIFIED_ON, '2026-08-02')
  assert.equal(digitalNirvana.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(digitalNirvana.hasOfficialCareersPageSignal(careersHtml), true)
  assert.deepEqual(digitalNirvana.extractLocationTabs(careersHtml), [
    { paneId: 'content-california', title: 'California, USA' },
    { paneId: 'content-hyderabad', title: 'Hyderabad, India' },
    { paneId: 'content-coimbatore', title: 'Coimbatore, India' },
  ])
  assert.equal(digitalNirvana.pageExposesStructuredJobListings(careersHtml), true)
  assert.deepEqual(digitalNirvana.extractIndiaJobsFromCareersPage(careersHtml), [
    {
      title: 'Editor/Senior Editor - Financial Content',
      department: 'Business Transcription',
      location: 'Anywhere in India',
      city: 'Remote',
      country: 'India',
      remoteStatus: 'Remote',
      applyUrl: 'mailto:jobs@digital-nirvana.com',
      jobDescription: 'Experience: Minimum 1+ Years as Editor/Proof Reader. Location: Work Form Home -Anywhere in India.',
      experienceRequired: 'Minimum 1+ Years as Editor/Proof Reader.',
      minimumQualification: null,
    },
    {
      title: 'Editor & Captioner',
      department: 'Closed Caption Services',
      location: 'Hyderabad, India',
      city: 'Hyderabad',
      country: 'India',
      remoteStatus: 'On-site',
      applyUrl: 'mailto:jobs@digital-nirvana.com',
      jobDescription: 'Exceptional audio sensitivity - ability to understand spoken English/Other languages in different accents across the globe.',
      experienceRequired: null,
      minimumQualification: null,
    },
  ])
})

test('Digital Nirvana Information Systems extracts the verified India careers-page roles into normalized jobs', async () => {
  const digitalNirvana = await loadModule()
  const requestedUrls = []

  const jobs = await digitalNirvana.createDigitalNirvanaInformationSystemsScraper({
    now: () => '2026-08-02T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === digitalNirvana.HOMEPAGE_URL) return homepageHtml
      if (url === digitalNirvana.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected Digital Nirvana URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    digitalNirvana.HOMEPAGE_URL,
    digitalNirvana.CAREERS_URL,
  ])
  assert.deepEqual(jobs, [
    {
      title: 'Editor/Senior Editor - Financial Content',
      company: 'Digital Nirvana Information Systems',
      department: 'Business Transcription',
      location: 'Anywhere in India',
      city: 'Remote',
      country: 'India',
      link: 'mailto:jobs@digital-nirvana.com',
      applyUrl: 'mailto:jobs@digital-nirvana.com',
      sourceUrl: 'https://digital-nirvana.com/careers-at-digital-nirvana/',
      source: 'digitalnirvanainformationsystems',
      jobId: 'editor-senior-editor-financial-content-anywhere-in-india',
      requisitionId: 'editor-senior-editor-financial-content-anywhere-in-india',
      employmentType: null,
      experienceRequired: 'Minimum 1+ Years as Editor/Proof Reader.',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      jobDescription: 'Experience: Minimum 1+ Years as Editor/Proof Reader. Location: Work Form Home -Anywhere in India.',
      remoteStatus: 'Remote',
      scrapedAt: '2026-08-02T00:00:00.000Z',
    },
    {
      title: 'Editor & Captioner',
      company: 'Digital Nirvana Information Systems',
      department: 'Closed Caption Services',
      location: 'Hyderabad, India',
      city: 'Hyderabad',
      country: 'India',
      link: 'mailto:jobs@digital-nirvana.com',
      applyUrl: 'mailto:jobs@digital-nirvana.com',
      sourceUrl: 'https://digital-nirvana.com/careers-at-digital-nirvana/',
      source: 'digitalnirvanainformationsystems',
      jobId: 'editor-captioner-hyderabad-india',
      requisitionId: 'editor-captioner-hyderabad-india',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      jobDescription: 'Exceptional audio sensitivity - ability to understand spoken English/Other languages in different accents across the globe.',
      remoteStatus: 'On-site',
      scrapedAt: '2026-08-02T00:00:00.000Z',
    },
  ])
})

test('Digital Nirvana Information Systems fails closed when the homepage or careers page drifts', async () => {
  const digitalNirvana = await loadModule()

  await assert.rejects(
    digitalNirvana.createDigitalNirvanaInformationSystemsScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified Digital Nirvana homepage/i,
  )

  await assert.rejects(
    digitalNirvana.createDigitalNirvanaInformationSystemsScraper().run({
      fetchText: async (url) => {
        if (url === digitalNirvana.HOMEPAGE_URL) return homepageHtml
        return '<html><body><h1>Careers</h1></body></html>'
      },
    }),
    /verified Digital Nirvana careers page/i,
  )
})
