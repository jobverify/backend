import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers &amp; Job Opportunities | SmartIMS</title>
  </head>
  <body>
    <main>
      <h1>Building Impactful Careers</h1>
      <section>
        <h2>Openings</h2>
        <p>Select a region to view job openings.</p>
        <a href="https://www1.jobdiva.com/portal/?a=example-americas">Smart IMS Americas</a>
        <a href="https://www1.jobdiva.com/portal/?a=example-india">Smart IMS India</a>
        <a href="https://www1.jobdiva.com/portal/?a=example-apac">Smart IMS APAC</a>
      </section>
      <section id="current-openings">
        <h2>Current Job Openings</h2>
        <div class="e-n-accordion">
          <details class="e-n-accordion-item">
            <summary>
              <span class="e-n-accordion-item-title-header">
                <div class="e-n-accordion-item-title-text"> Job Description: Data Engineer II </div>
              </span>
            </summary>
            <div class="elementor-element">
              <div class="elementor-widget-container">
                <p><strong>Experience</strong>: 3-5 Years<br /><strong>Location</strong>: Hyderabad (or as applicable)<br /><strong>Team</strong>: Data Platform &amp; Engineering</p>
                <p>To apply send your profile to <a href="/cdn-cgi/l/email-protection#f6bf98929f9795978493938485b6a59b978482bfbba5d895999b"><span class="__cf_email__" data-cfemail="f6bf98929f9795978493938485b6a59b978482bfbba5d895999b">[email&#160;protected]</span></a></p>
              </div>
            </div>
          </details>
          <details class="e-n-accordion-item">
            <summary>
              <span class="e-n-accordion-item-title-header">
                <div class="e-n-accordion-item-title-text"> Java Backend Software Development Engineer (SDE-2) </div>
              </span>
            </summary>
            <div class="elementor-element">
              <div class="elementor-widget-container">
                <p><strong>Location</strong>: Hyderabad<br /><strong>Experience</strong>: Minimum 4 &#8211; 6 Years<br /><strong>No of Positions</strong>: 10</p>
                <p>To apply send your profile to <a href="/cdn-cgi/l/email-protection#f3ba9d979a9290928196968180b3a09e928187babea0dd909c9e"><span class="__cf_email__" data-cfemail="f3ba9d979a9290928196968180b3a09e928187babea0dd909c9e">[email&#160;protected]</span></a></p>
              </div>
            </div>
          </details>
          <details class="e-n-accordion-item">
            <summary>
              <span class="e-n-accordion-item-title-header">
                <div class="e-n-accordion-item-title-text"> Front End Developer </div>
              </span>
            </summary>
            <div class="elementor-element">
              <div class="elementor-widget-container">
                <p><strong>Location</strong>: Hyderabad<br /><strong>Experience</strong>: Minimum 3 – 6 Years<br /><strong>No of Positions</strong>: 10</p>
                <p>To apply send your profile to <a href="/cdn-cgi/l/email-protection#034a6d676a626062716666717043506e6271774a4e502d606c6e"><span class="__cf_email__" data-cfemail="034a6d676a626062716666717043506e6271774a4e502d606c6e">[email&#160;protected]</span></a></p>
              </div>
            </div>
          </details>
        </div>
      </section>
    </main>
  </body>
</html>
`

test('Smart IMS parses the current first-party openings accordion', async () => {
  const smartIms = await loadModule()
  assert.ok(smartIms, 'Expected scraper module at ./script.js')

  assert.equal(smartIms.SOURCE, 'smartims')
  assert.equal(smartIms.COMPANY, 'Smart IMS')
  assert.equal(smartIms.CAREERS_URL, 'https://www.smartims.com/careers/')
  assert.equal(smartIms.VERIFIED_ON, '2026-08-04')
  assert.equal(smartIms.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(smartIms.extractSmartImsJobCards(careersHtml).length, 3)
  assert.equal(
    smartIms.decodeCloudflareEmail('f6bf98929f9795978493938485b6a59b978482bfbba5d895999b'),
    'Indiacareers@SmartIMS.com',
  )

  const jobs = smartIms.extractJobsFromCareersHtml(careersHtml)
  assert.deepEqual(jobs, [
    {
      title: 'Data Engineer II',
      location: 'Hyderabad (or as applicable)',
      applyUrl: 'mailto:Indiacareers@SmartIMS.com',
      experience: '3-5 Years',
      team: 'Data Platform & Engineering',
      openingsCount: null,
      jobDescription: 'Experience: 3-5 Years Location: Hyderabad (or as applicable) Team: Data Platform & Engineering To apply send your profile to [email protected]',
      detailUrl: 'https://www.smartims.com/careers/',
      sourceUrl: 'https://www.smartims.com/careers/',
    },
    {
      title: 'Java Backend Software Development Engineer (SDE-2)',
      location: 'Hyderabad',
      applyUrl: 'mailto:Indiacareers@SmartIMS.com',
      experience: 'Minimum 4 - 6 Years',
      team: null,
      openingsCount: '10',
      jobDescription: 'Location: Hyderabad Experience: Minimum 4 - 6 Years No of Positions: 10 To apply send your profile to [email protected]',
      detailUrl: 'https://www.smartims.com/careers/',
      sourceUrl: 'https://www.smartims.com/careers/',
    },
    {
      title: 'Front End Developer',
      location: 'Hyderabad',
      applyUrl: 'mailto:Indiacareers@SmartIMS.com',
      experience: 'Minimum 3 - 6 Years',
      team: null,
      openingsCount: '10',
      jobDescription: 'Location: Hyderabad Experience: Minimum 3 - 6 Years No of Positions: 10 To apply send your profile to [email protected]',
      detailUrl: 'https://www.smartims.com/careers/',
      sourceUrl: 'https://www.smartims.com/careers/',
    },
  ])
})

test('Smart IMS scraper returns parsed jobs and fails closed on drift', async () => {
  const smartIms = await loadModule()
  assert.ok(smartIms, 'Expected scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await smartIms.createSmartImsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requestedUrls, [smartIms.CAREERS_URL])
  assert.equal(jobs.length, 3)

  await assert.rejects(
    smartIms.createSmartImsScraper().run({
      fetchText: async () => '<html><body><h1>Smart IMS Careers</h1></body></html>',
    }),
    /changed materially/i,
  )
})
