import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'

const OFFICIAL_INDIA_OPENINGS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - SourceFuse</title>
  </head>
  <body>
    <section class="sf-jobs__hero">
      <h1 class="sf-jobs__hero-title">India Openings with <span class="sf-jobs__hero-accent">SourceFuse.</span></h1>
    </section>
    <section class="sf-jobs__list-section">
      <div class="sf-jobs__item">
        <div class="sf-jobs__header">
          <h3 class="sf-jobs__title" title="Senior Integration Engineer">
            <span class="sf-jobs__title-text">Senior Integration Engineer</span>
          </h3>
          <div class="sf-jobs__head">
            <ul class="sf-jobs__meta">
              <li class="sf-jobs__meta-item"><span class="sf-jobs__meta-text">Mohali/Noida, India</span></li>
              <li class="sf-jobs__meta-item"><span class="sf-jobs__meta-text">6-9 years experience</span></li>
              <li class="sf-jobs__meta-item"><span class="sf-jobs__meta-text">1 Position</span></li>
            </ul>
            <button type="button" class="sf-jobs__apply" data-job-title="Senior Integration Engineer">Apply Now</button>
          </div>
        </div>
        <div class="sf-jobs__panel">
          <div class="sf-jobs__description">
            <h2 class="wp-block-heading">Job Information:</h2>
            <p class="wp-block-paragraph">Work Experience: 6-9 Years<br>Industry: IT Services<br>Job Type: FULL TIME<br>Location: Mohali/Noida, India</p>
            <h2 class="wp-block-heading">Role Overview:</h2>
            <p class="wp-block-paragraph">Build CRM integration services for enterprise clients.</p>
          </div>
        </div>
      </div>
      <div class="sf-jobs__item">
        <div class="sf-jobs__header">
          <h3 class="sf-jobs__title" title="Senior Business Analyst">
            <span class="sf-jobs__title-text">Senior Business Analyst</span>
          </h3>
          <div class="sf-jobs__head">
            <ul class="sf-jobs__meta">
              <li class="sf-jobs__meta-item"><span class="sf-jobs__meta-text">Remote, India</span></li>
              <li class="sf-jobs__meta-item"><span class="sf-jobs__meta-text">8-12+ years experience</span></li>
              <li class="sf-jobs__meta-item"><span class="sf-jobs__meta-text">1 Position</span></li>
            </ul>
            <button type="button" class="sf-jobs__apply" data-job-title="Senior Business Analyst">Apply Now</button>
          </div>
        </div>
        <div class="sf-jobs__panel">
          <div class="sf-jobs__description">
            <h2 class="wp-block-heading">Job Information:</h2>
            <p class="wp-block-paragraph">Work Experience: 8-12+ Years<br>Industry: IT Services<br>Job Type: FULL TIME<br>Location: Remote, India</p>
            <h2 class="wp-block-heading">Role Overview:</h2>
            <p class="wp-block-paragraph">Lead discovery and business transformation initiatives for insurance clients.</p>
          </div>
        </div>
      </div>
    </section>
    <div class="sf-jobs-modal" aria-hidden="true">
      <form action="/careers/?location=India#wpcf7-f91356-o1" method="post" class="wpcf7-form init">
        <input class="wpcf7-form-control wpcf7-hidden" value="Job Name" type="hidden" name="your-job-name" />
        <input
          size="40"
          class="wpcf7-form-control wpcf7-drag-n-drop-file d-none"
          aria-required="true"
          type="file"
          multiple="multiple"
          data-name="your-cv"
          accept=".doc, .docx, .pdf"
        />
        <input class="wpcf7-form-control wpcf7-submit has-spinner" type="submit" value="SUBMIT Resume" />
      </form>
    </div>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/sourcefuse/script.js')
  } catch {
    assert.fail('Expected SourceFuse scraper module at ../../scraper/sourcefuse/script.js')
  }
}

test('SourceFuse helpers stay pinned to the verified official India openings page and inline application form', async () => {
  const sourceFuse = await loadModule()

  assert.equal(sourceFuse.SOURCE, 'sourcefuse')
  assert.equal(sourceFuse.COMPANY_NAME, 'SourceFuse')
  assert.equal(sourceFuse.OFFICIAL_BRAND_NAME, 'SourceFuse')
  assert.equal(sourceFuse.VERIFIED_ON, '2026-07-17')
  assert.equal(sourceFuse.CAREERS_LANDING_URL, 'https://www.sourcefuse.com/careers/')
  assert.equal(sourceFuse.INDIA_OPENINGS_URL, 'https://www.sourcefuse.com/careers/?location=India')
  assert.equal(sourceFuse.APPLICATION_FORM_ACTION, '/careers/?location=India#wpcf7-f91356-o1')
  assert.equal(sourceFuse.hasOfficialIndiaOpeningsSignal(OFFICIAL_INDIA_OPENINGS_HTML), true)
  assert.equal(
    sourceFuse.hasOfficialIndiaOpeningsSignal('<html><body><h1>India jobs</h1></body></html>'),
    false,
  )
  assert.equal(sourceFuse.hasApplicationFormSignal(OFFICIAL_INDIA_OPENINGS_HTML), true)
  assert.equal(
    sourceFuse.hasApplicationFormSignal(OFFICIAL_INDIA_OPENINGS_HTML.replace('accept=".doc, .docx, .pdf"', 'accept=".pdf"')),
    true,
  )
  assert.equal(
    sourceFuse.hasApplicationFormSignal('<form action="/careers/?location=India"></form>'),
    false,
  )

  assert.deepEqual(sourceFuse.extractJobCards(OFFICIAL_INDIA_OPENINGS_HTML), [
    {
      title: 'Senior Integration Engineer',
      location: 'Mohali/Noida, India',
      city: 'Mohali/Noida',
      experienceRequired: '6-9 Years',
      employmentType: 'FULL TIME',
      positions: '1 Position',
      jobDescription: 'Build CRM integration services for enterprise clients.',
      jobId: 'sourcefuse-senior-integration-engineer',
      remoteStatus: 'On-site',
    },
    {
      title: 'Senior Business Analyst',
      location: 'Remote, India',
      city: 'Remote',
      experienceRequired: '8-12+ Years',
      employmentType: 'FULL TIME',
      positions: '1 Position',
      jobDescription: 'Lead discovery and business transformation initiatives for insurance clients.',
      jobId: 'sourcefuse-senior-business-analyst',
      remoteStatus: 'Remote',
    },
  ])
})

test('SourceFuse accepts the current first-party India location formats without dropping public job cards', async () => {
  const sourceFuse = await loadModule()
  const currentFormatHtml = OFFICIAL_INDIA_OPENINGS_HTML
    .replace('India Openings with <span class="sf-jobs__hero-accent">SourceFuse.</span>', 'Careers at <span class="sf-jobs__hero-accent">SourceFuse.</span>')
    .replaceAll('<div class="sf-jobs__item">', '<div class="sf-jobs__item" data-sf-anim="fade-up">')
    .replace('Mohali/Noida, India', 'Bangalore')
    .replace('Location: Mohali/Noida, India', 'Location: Bangalore')
    .replace('Remote, India', 'Mohali, India (JST time zone)')
    .replace('Location: Remote, India', 'Location: Mohali, India (JST time zone)')

  assert.equal(sourceFuse.hasOfficialIndiaOpeningsSignal(currentFormatHtml), true)
  assert.deepEqual(sourceFuse.extractJobCards(currentFormatHtml), [
    {
      title: 'Senior Integration Engineer',
      location: 'Bangalore, India',
      city: 'Bangalore',
      experienceRequired: '6-9 Years',
      employmentType: 'FULL TIME',
      positions: '1 Position',
      jobDescription: 'Build CRM integration services for enterprise clients.',
      jobId: 'sourcefuse-senior-integration-engineer',
      remoteStatus: 'On-site',
    },
    {
      title: 'Senior Business Analyst',
      location: 'Mohali, India',
      city: 'Mohali',
      experienceRequired: '8-12+ Years',
      employmentType: 'FULL TIME',
      positions: '1 Position',
      jobDescription: 'Lead discovery and business transformation initiatives for insurance clients.',
      jobId: 'sourcefuse-senior-business-analyst',
      remoteStatus: 'On-site',
    },
  ])
})

test('SourceFuse run validates the official India openings page and maps live inline job panels', async () => {
  const sourceFuse = await loadModule()
  const requestedUrls = []

  const jobs = await sourceFuse.createSourceFuseScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return OFFICIAL_INDIA_OPENINGS_HTML
    },
  })

  assert.deepEqual(requestedUrls, [sourceFuse.INDIA_OPENINGS_URL])
  assert.deepEqual(jobs, [
    {
      title: 'Senior Integration Engineer',
      company: 'SourceFuse',
      department: null,
      location: 'Mohali/Noida, India',
      city: 'Mohali/Noida',
      state: null,
      country: 'India',
      jobId: 'sourcefuse-senior-integration-engineer',
      requisitionId: null,
      sourceUrl: 'https://www.sourcefuse.com/careers/?location=India',
      applyUrl: 'https://www.sourcefuse.com/careers/?location=India',
      employmentType: 'FULL TIME',
      experienceRequired: '6-9 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Build CRM integration services for enterprise clients.',
      remoteStatus: 'On-site',
      source: 'sourcefuse',
      link: 'https://www.sourcefuse.com/careers/?location=India',
      scrapedAt: FIXED_SCRAPED_AT,
    },
    {
      title: 'Senior Business Analyst',
      company: 'SourceFuse',
      department: null,
      location: 'Remote, India',
      city: 'Remote',
      state: null,
      country: 'India',
      jobId: 'sourcefuse-senior-business-analyst',
      requisitionId: null,
      sourceUrl: 'https://www.sourcefuse.com/careers/?location=India',
      applyUrl: 'https://www.sourcefuse.com/careers/?location=India',
      employmentType: 'FULL TIME',
      experienceRequired: '8-12+ Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Lead discovery and business transformation initiatives for insurance clients.',
      remoteStatus: 'Remote',
      source: 'sourcefuse',
      link: 'https://www.sourcefuse.com/careers/?location=India',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('SourceFuse fails closed when the verified India openings page or inline application form drifts', async () => {
  const sourceFuse = await loadModule()

  await assert.rejects(
    sourceFuse.createSourceFuseScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /verified india openings page/i,
  )

  await assert.rejects(
    sourceFuse.createSourceFuseScraper().run({
      fetchText: async () => OFFICIAL_INDIA_OPENINGS_HTML.replace(
        '/careers/?location=India#wpcf7-f91356-o1',
        '/careers/?location=India',
      ),
    }),
    /inline application form/i,
  )

  await assert.rejects(
    sourceFuse.createSourceFuseScraper().run({
      fetchText: async () => OFFICIAL_INDIA_OPENINGS_HTML.replace(
        /<div class="sf-jobs__item">[\s\S]*?<\/div>\s*<\/section>/,
        '</section>',
      ),
    }),
    /no public india job panels/i,
  )
})
