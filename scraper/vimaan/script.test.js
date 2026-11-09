import assert from 'node:assert/strict'
import test from 'node:test'

const loadVimaanModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
  <html>
    <body>
      <h1>100% Inventory Accuracy &amp; Visibility</h1>
      <p>Computer vision that brings real-world accuracy to your warehouse.</p>
      <p>Dozens of Warehouses Use Vimaan</p>
      <a href="https://vimaan.ai/careers/">Careers</a>
    </body>
  </html>
`

const aboutHtml = `
  <html>
    <body>
      <h1>About Vimaan</h1>
      <h2>At Vimaan We Have No Limits</h2>
      <p>Vimaan is a computer vision and AI solution company dedicated to providing 3PLs, Brands and Retailers with a 100% accurate view of their warehouse inventory.</p>
      <p>Based in the heart of Silicon Valley, Vimaan was founded by KG Ganapathi in 2017.</p>
      <p>Roles include Full Stack Engineers and Computer Vision Engineers &amp; Scientists.</p>
    </body>
  </html>
`

const contactHtml = `
  <html>
    <body>
      <h2>Let’s Talk</h2>
      <p>Our Warehouse Automation Experts are available.</p>
      <p>We typically get back to queries within a single day!</p>
      <p>sales@vimaan.ai</p>
      <p>2391 Zanker Rd, Suite 360, San Jose, CA 95131</p>
    </body>
  </html>
`

const careersShellHtml = `
  <html>
    <body>
      <h1>Careers</h1>
      <h2>big brains wanted</h2>
      <h2>vimaan job openings</h2>
      <p>It’s true, we only want you for your brain</p>
      <p>The demand for Vimaan solutions has never been greater, and we are actively building our teams across the company in all departments.</p>
      <p>AI – COMPUTER VISION – MACHINE LEARNING – ROBOTICS – ENGINEERING</p>
      <label>Keywords</label>
      <label>Location</label>
      <label>Remote positions only</label>
      <p>Your browser does not support JavaScript, or it is disabled. JavaScript must be enabled in order to view listings.</p>
      <button>Load more listings</button>
    </body>
  </html>
`

const publicJobsHtml = `
  <html>
    <body>
      <h2>vimaan job openings</h2>
      <article class="job_listing type-job_listing">
        <a href="https://vimaan.ai/jobs/full-stack-engineer/">Full Stack Engineer</a>
        <a href="https://vimaan.ai/jobs/full-stack-engineer/">Apply for job</a>
      </article>
    </body>
  </html>
`

test('Vimaan sentinel stays pinned to the verified first-party pages and the careers-shell contract', async () => {
  const vimaan = await loadVimaanModule()
  assert.ok(vimaan, 'Expected Vimaan scraper module at ./script.js')

  assert.equal(vimaan.SOURCE, 'vimaan')
  assert.equal(vimaan.COMPANY, 'Vimaan')
  assert.equal(vimaan.HOMEPAGE_URL, 'https://vimaan.ai/')
  assert.equal(vimaan.ABOUT_URL, 'https://vimaan.ai/company/')
  assert.equal(vimaan.CONTACT_URL, 'https://vimaan.ai/contact-us/')
  assert.equal(vimaan.CAREERS_URL, 'https://vimaan.ai/careers/')
  assert.equal(vimaan.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(vimaan.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(vimaan.hasOfficialContactSignal(contactHtml), true)
  assert.equal(vimaan.hasOfficialCareersSignal(careersShellHtml), true)
  assert.equal(vimaan.hasRenderedPublicJobCards(careersShellHtml), false)
  assert.equal(vimaan.hasRenderedPublicJobCards(publicJobsHtml), true)
})

test('run returns an empty list when Vimaan exposes only a verified JavaScript jobs shell without rendered public job cards', async () => {
  const vimaan = await loadVimaanModule()
  assert.ok(vimaan, 'Expected Vimaan scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await vimaan.createVimaanScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === vimaan.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === vimaan.ABOUT_URL) {
        return { status: 200, url, html: aboutHtml }
      }

      if (url === vimaan.CONTACT_URL) {
        return { status: 200, url, html: contactHtml }
      }

      if (url === vimaan.CAREERS_URL) {
        return { status: 200, url, html: careersShellHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    vimaan.HOMEPAGE_URL,
    vimaan.ABOUT_URL,
    vimaan.CONTACT_URL,
    vimaan.CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

test('current Vimaan homepage enumerates the unfiltered WordPress jobs inventory before reporting zero India roles', async () => {
  const vimaan = await import('./script.js')
  const requests=[]
  const jobs = await vimaan.run({
    fetchPage: async url => ({status:200,url,html:url===vimaan.HOMEPAGE_URL?"<title>AI for Inventory Visibility and Inventory Accuracy | Vimaan</title><link rel=\"canonical\" href=\"https://vimaan.ai/\" /><meta property=\"og:site_name\" content=\"VIMAAN\" /><p>Vimaan provides AI-powered computer vision products enabling 100% inventory accuracy</p><p>StorTRACK PalletSCAN ParcelSCAN PackVIEW</p><a href=\"https://vimaan.ai/careers/\">Careers</a>":url===vimaan.ABOUT_URL?aboutHtml:url===vimaan.CONTACT_URL?contactHtml:careersShellHtml+'<script>var job_manager_ajax_filters={"ajax_url":"/jm-ajax/%%endpoint%%/"}</script>'}),
    fetchListings: async request => { requests.push(request); return {"found_jobs":true,"showing":"","max_num_pages":1,"showing_links":"<a href=\"https://vimaan.ai?feed=job_feed&#038;job_types&#038;search_location&#038;job_categories&#038;search_keywords&#038;author\" class=\"rss_link\">RSS</a>","html":"<li class=\"post-23935 job_listing type-job_listing status-publish has-post-thumbnail hentry job_position_featured\" data-longitude=\"\" data-latitude=\"\">\n\t<a href=\"https://vimaan.ai/job/field-engineer-2/\">\n\t\t<img class=\"company_logo\" src=\"https://vimaan.ai/wp-content/uploads/2022/01/mstile-310x150-1-150x150.png\" alt=\"\" />\t\t<div class=\"position\">\n\t\t\t<h3>Field Engineer</h3>\n\t\t\t<div class=\"company\">\n\t\t\t\t\t\t\t\t\t\t\t</div>\n\t\t</div>\n\t\t<div class=\"location\">\n\t\t\tSan Jose, CA\t\t</div>\n\t\t<ul class=\"meta\">\n\t\t\t\n\t\t\t\n\t\t\t<li class=\"date\"><time datetime=\"2024-12-17\">Posted 2 years ago</time></li>\n\n\t\t\t\t\t</ul>\n\t</a>\n</li>\n"} },
  })
  assert.equal(jobs.length,0)
  assert.equal(requests.length,1)
  assert.equal(requests[0].page,1)
  assert.equal(requests[0].search_location,'')
  assert.equal(readInventoryEvidence(jobs)?.status,'complete-inventory')
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal,1)
  assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount,0)
})

test('Vimaan does not report a generic remote job as zero India inventory',async()=>{
  const vimaan=await import('./script.js')
  await assert.rejects(vimaan.run({
    fetchPage: async url=>({status:200,url,html:url===vimaan.HOMEPAGE_URL?homepageHtml:url===vimaan.ABOUT_URL?aboutHtml:url===vimaan.CONTACT_URL?contactHtml:careersShellHtml+'<script>var job_manager_ajax_filters={"ajax_url":"/jm-ajax/%%endpoint%%/"}</script>'}),
    fetchListings:async()=>({...{"found_jobs":true,"showing":"","max_num_pages":1,"showing_links":"<a href=\"https://vimaan.ai?feed=job_feed&#038;job_types&#038;search_location&#038;job_categories&#038;search_keywords&#038;author\" class=\"rss_link\">RSS</a>","html":"<li class=\"post-23935 job_listing type-job_listing status-publish has-post-thumbnail hentry job_position_featured\" data-longitude=\"\" data-latitude=\"\">\n\t<a href=\"https://vimaan.ai/job/field-engineer-2/\">\n\t\t<img class=\"company_logo\" src=\"https://vimaan.ai/wp-content/uploads/2022/01/mstile-310x150-1-150x150.png\" alt=\"\" />\t\t<div class=\"position\">\n\t\t\t<h3>Field Engineer</h3>\n\t\t\t<div class=\"company\">\n\t\t\t\t\t\t\t\t\t\t\t</div>\n\t\t</div>\n\t\t<div class=\"location\">\n\t\t\tSan Jose, CA\t\t</div>\n\t\t<ul class=\"meta\">\n\t\t\t\n\t\t\t\n\t\t\t<li class=\"date\"><time datetime=\"2024-12-17\">Posted 2 years ago</time></li>\n\n\t\t\t\t\t</ul>\n\t</a>\n</li>\n"},html:"<li class=\"post-23935 job_listing type-job_listing status-publish has-post-thumbnail hentry job_position_featured\" data-longitude=\"\" data-latitude=\"\">\n\t<a href=\"https://vimaan.ai/job/field-engineer-2/\">\n\t\t<img class=\"company_logo\" src=\"https://vimaan.ai/wp-content/uploads/2022/01/mstile-310x150-1-150x150.png\" alt=\"\" />\t\t<div class=\"position\">\n\t\t\t<h3>Field Engineer</h3>\n\t\t\t<div class=\"company\">\n\t\t\t\t\t\t\t\t\t\t\t</div>\n\t\t</div>\n\t\t<div class=\"location\">\n\t\t\tRemote\t\t</div>\n\t\t<ul class=\"meta\">\n\t\t\t\n\t\t\t\n\t\t\t<li class=\"date\"><time datetime=\"2024-12-17\">Posted 2 years ago</time></li>\n\n\t\t\t\t\t</ul>\n\t</a>\n</li>\n"}),
  }),/country scope|location/i)
})

test('Vimaan rejects empty inventories with contradictory or incomplete page ranges', async () => {
  const { verifyPublicInventory } = await import('./publicInventory.js')
  await assert.rejects(verifyPublicInventory(async () => ({ found_jobs: false, max_num_pages: 2, html: '<li class="no_jobs_found">No jobs found</li>' })), /pagination|incomplete/i)
  const card = '<li class="post-23935 job_listing"><a href="https://vimaan.ai/job/field-engineer-2/"><h3>Field Engineer</h3><div class="location">San Jose, CA</div></a></li>'
  await assert.rejects(verifyPublicInventory(async () => ({ found_jobs: true, max_num_pages: 0, html: card })), /pagination|incomplete/i)
  await assert.rejects(verifyPublicInventory(async ({ page }) => ({ found_jobs: page === 1, max_num_pages: 2, html: page === 1 ? card : '<li class="no_jobs_found">No jobs found</li>' })), /pagination|incomplete/i)
})

test('Vimaan verifies explicit empty inventory only on a single empty page', async () => {
  const { verifyPublicInventory } = await import('./publicInventory.js')
  for (const pages of [0, 1]) {
    const jobs = await verifyPublicInventory(async () => ({ found_jobs: false, max_num_pages: pages, html: '<li class="no_jobs_found">No jobs found</li>' }))
    assert.equal(readInventoryEvidence(jobs)?.status, 'verified-empty')
    assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 0)
    assert.equal(readInventoryEvidence(jobs)?.pagesFetched, 1)
  }
})
