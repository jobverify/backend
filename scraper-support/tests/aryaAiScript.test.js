import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html data-wf-domain="arya.ai" lang="en">
  <head>
    <title>Arya.ai: Enterprise-Grade AI Solutions</title>
  </head>
  <body>
    <nav>
      <a href="https://arya.ai/about-us">About Us</a>
      <a href="https://arya.ai/careers">Careers</a>
      <a href="https://arya.ai/contact-us">Contact Us</a>
    </nav>
    <main>
      <h1>Arya.ai: Enterprise-Grade AI Solutions</h1>
      <p>Enterprise-Grade AI Solutions</p>
      <p>Autonomous Finance for banks, insurers, and global enterprises.</p>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html data-wf-domain="arya.ai" lang="en">
  <head>
    <title>Careers at Arya.ai – Shape the Future of Enterprise AI</title>
  </head>
  <body>
    <main>
      <h1>Shape the Future of Enterprise AI</h1>
      <h2 class="ar-h2 is-white">Open Positions</h2>
      <div class="car_list-wrap">
        <div class="w-form">
          <form fs-cmsfilter-element="filters">
            <div class="car_dept-wrap">
              <label fs-cmsfilter-field="dept" class="car_radio is-active w-radio"><span class="w-form-label">View all</span></label>
              <label fs-cmsfilter-field="dept" class="car_radio is-active w-radio"><span class="w-form-label">Growth</span></label>
              <label fs-cmsfilter-field="dept" class="car_radio is-active w-radio"><span class="w-form-label">Research</span></label>
              <label fs-cmsfilter-field="dept" class="car_radio is-active w-radio"><span class="w-form-label">Engineering</span></label>
            </div>
          </form>
        </div>
        <div class="car_col-wrap w-dyn-list">
          <div fs-cmsfilter-element="list" role="list" class="car_col-list w-dyn-items">
            <div role="listitem" class="car_col-item w-dyn-item">
              <div class="car_item">
                <div class="flex-vertical-32">
                  <div class="car_top-wrap">
                    <div class="car_content">
                      <h3 class="car_h3">Senior Data Scientist</h3>
                      <div class="car_dept-border">
                        <div class="car_dept"><div fs-cmsfilter-field="dept">Research</div></div>
                      </div>
                      <div class="car_dept-border d-none">
                        <div class="car_dept"><div fs-cmsfilter-field="dept">View all</div></div>
                      </div>
                      <div class="car_dept-border">
                        <div class="car_dept"><div>On-site</div></div>
                      </div>
                    </div>
                    <a href="https://wellfound.com/jobs/3542202-senior-data-scientist" class="ar-button is-small is-car is-inter w-button">Apply now</a>
                  </div>
                  <div>As a Senior Research Scientist, you will be responsible for designing and validating the deep learning models that power our core product. You will lead research initiatives to convert theoretical concepts into scalable, production-grade AI modules that solve critical industry challenges.</div>
                </div>
                <div></div>
                <div class="car_contract">
                  <img src="https://cdn.prod.website-files.com/time-five.png" loading="lazy" alt="" class="car_contract-image"/>
                  <div>Full Time</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </body>
</html>
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://arya.ai</loc></url>
  <url><loc>https://arya.ai/blog</loc></url>
  <url><loc>https://arya.ai/about-us</loc></url>
  <url><loc>https://arya.ai/careers</loc></url>
</urlset>
`

const missingRouteHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Not Found</title>
  </head>
  <body>
    <h1>404</h1>
  </body>
</html>
`

const loadAryaAiModule = async () => {
  try {
    return await import('../../scraper/aryaai/script.js')
  } catch {
    assert.fail('Expected Arya.ai scraper module at ../../scraper/aryaai/script.js')
  }
}

test('Arya.ai helpers stay pinned to the verified first-party homepage, careers page, sitemap, and visible role-card structure', async () => {
  const aryaAi = await loadAryaAiModule()

  assert.equal(aryaAi.SOURCE, 'aryaai')
  assert.equal(aryaAi.COMPANY, 'Arya.ai')
  assert.equal(aryaAi.OFFICIAL_BRAND_NAME, 'Arya.ai')
  assert.equal(aryaAi.VERIFIED_ON, '2026-07-15')
  assert.equal(aryaAi.HOMEPAGE_URL, 'https://arya.ai/')
  assert.equal(aryaAi.CAREERS_URL, 'https://arya.ai/careers')
  assert.equal(aryaAi.SITEMAP_URL, 'https://arya.ai/sitemap.xml')
  assert.deepEqual(aryaAi.CHECKED_MISSING_ROUTE_URLS, [
    'https://arya.ai/career',
    'https://arya.ai/jobs',
    'https://arya.ai/join-us',
    'https://arya.ai/openings',
    'https://arya.ai/work-with-us',
  ])
  assert.deepEqual(aryaAi.VERIFIED_APPLY_URLS, [
    'https://wellfound.com/jobs/3542202-senior-data-scientist',
  ])
  assert.equal(aryaAi.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(aryaAi.extractCareersUrl(homepageHtml), 'https://arya.ai/careers')
  assert.equal(aryaAi.hasVerifiedCareersPageSignal(careersHtml), true)
  assert.equal(aryaAi.hasSitemapCareersSignal(sitemapXml), true)
  assert.equal(
    aryaAi.isMissingCareersRoute({
      status: 404,
      url: aryaAi.CHECKED_MISSING_ROUTE_URLS[0],
      html: missingRouteHtml,
    }),
    true,
  )
  assert.deepEqual(aryaAi.extractJobCards(careersHtml), [
    {
      title: 'Senior Data Scientist',
      department: 'Research',
      location: 'On-site',
      employmentType: 'Full Time',
      applyUrl: 'https://wellfound.com/jobs/3542202-senior-data-scientist',
      jobId: '3542202-senior-data-scientist',
      requisitionId: '3542202-senior-data-scientist',
      jobDescription:
        'As a Senior Research Scientist, you will be responsible for designing and validating the deep learning models that power our core product. You will lead research initiatives to convert theoretical concepts into scalable, production-grade AI modules that solve critical industry challenges.',
    },
  ])
})

test('Arya.ai current run retains a brief observation instead of promoting it to a full vacancy', async () => {
  const aryaAi = await loadAryaAiModule(), requestedUrls = [], audits = []
  const jobs = await aryaAi.createAryaAiScraper({now: () => '2026-07-15T00:00:00.000Z'}).run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === aryaAi.HOMEPAGE_URL) return {status:200,url,html:homepageHtml}
      if (url === aryaAi.CAREERS_URL) return {status:200,url,html:careersHtml}
      if (url === aryaAi.VERIFIED_APPLY_URLS[0]) return {status:410,url,html:'<title>Gone</title>'}
      throw Error('Unexpected public URL: '+url)
    }, onAudit:a=>audits.push(a),
  })
  assert.deepEqual(jobs, [])
  assert.deepEqual(requestedUrls,[aryaAi.HOMEPAGE_URL,aryaAi.CAREERS_URL,aryaAi.VERIFIED_APPLY_URLS[0],aryaAi.HOMEPAGE_URL,aryaAi.CAREERS_URL])
  assert.equal(audits[0].observations.length,1)
  assert.equal(audits[0].observations[0].jobId,'3542202')
  assert.equal(audits[0].observations[0].requisitionId,null)
  assert.equal(audits[0].observations[0].country,null)
  assert.equal(audits[0].observations[0].sourceDetailComplete,false)
  assert.equal(audits[0].inventoryEvidence.listingComplete,false)
})

test('Arya.ai holds changed homepage identity, active careers handoff and exact native role URL', async () => {
  const aryaAi=await loadAryaAiModule()
  for(const variant of ['homepage','careers-link','native-link']){
    await assert.rejects(aryaAi.run({fetchPage:async url=>{
      if(url===aryaAi.HOMEPAGE_URL)return{status:200,url,html:variant==='homepage'?'<title>Unexpected</title>':variant==='careers-link'?homepageHtml.replace('https://arya.ai/careers','https://arya.ai/jobs'):homepageHtml}
      if(url===aryaAi.CAREERS_URL)return{status:200,url,html:careersHtml.replace('https://wellfound.com/jobs/3542202-senior-data-scientist','https://example.com/jobs/3542202')}
      throw Error('Unqualified handoff was fetched')
    }}))
  }
})
