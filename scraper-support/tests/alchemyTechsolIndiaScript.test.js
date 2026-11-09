import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
const {captures}=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/alchemytechsolindia/test-data/native-20261103.json.gz',import.meta.url))))
const currentNativeHtml=Buffer.from(captures['production-careers'].body,'base64').toString()

const careersHtml = `
<!doctype html>
<html>
  <head>
    <title>Career - Alchemy Techsol</title>
    <link rel="canonical" href="https://alchemytechsol.com/career/" />
  </head>
  <body>
    <h1>Join Our Team</h1>
    <p>Build Your Future with Alchemy Techsol</p>
    <h1>Current Openings</h1>
    <div class="job_listings" data-per_page="10" data-post_id="54">
      <noscript>
        Your browser does not support JavaScript, or it is disabled.
        JavaScript must be enabled in order to view listings.
      </noscript>
      <ul class="job_listings"></ul>
      <a class="load_more_jobs" href="#"><strong>Load more listings</strong></a>
    </div>
    <script>
      var job_manager_ajax_filters = {"ajax_url":"\\/jm-ajax\\/%%endpoint%%\\/"};
    </script>
    <script src="https://alchemytechsol.com/wp-content/plugins/wp-job-manager/assets/dist/js/ajax-filters.js"></script>
    <h2>Ready to Elevate Your Career?</h2>
  </body>
</html>
`

const emptyListingsPayload = {
  found_jobs: false,
  max_num_pages: 0,
  showing: '',
  html: '<li class="no_job_listings_found">There are no listings matching your search.</li>',
}

const firstListingsPage = {
  found_jobs: true,
  max_num_pages: 2,
  showing: 'Showing 1-2 of 3 jobs',
  html: `
    <li class="post-501 job_listing type-job_listing status-publish job-type-full-time">
      <a href="https://alchemytechsol.com/job/cloud-engineer/">
        <div class="position"><h3>Cloud Engineer</h3></div>
        <div class="location">Bengaluru</div>
        <ul class="meta"><li class="job-type full-time">Full Time</li></ul>
      </a>
    </li>
    <li class="post-502 job_listing type-job_listing status-publish job-type-full-time">
      <a href="https://alchemytechsol.com/job/account-executive/">
        <div class="position"><h3>Account Executive</h3></div>
        <div class="location">Austin, TX</div>
        <ul class="meta"><li class="job-type full-time">Full Time</li></ul>
      </a>
    </li>
  `,
}

const secondListingsPage = {
  found_jobs: true,
  max_num_pages: 2,
  showing: 'Showing 3 of 3 jobs',
  html: `
    <li class="post-503 job_listing type-job_listing status-publish job-type-internship">
      <a href="https://alchemytechsol.com/job/data-engineering-intern/">
        <div class="position"><h3>Data Engineering Intern</h3></div>
        <div class="location">Hyderabad, India</div>
        <ul class="meta"><li class="job-type internship">Internship</li></ul>
      </a>
    </li>
  `,
}

const loadModule = async () => {
  try {
    return await import('../../scraper/alchemytechsolindia/script.js')
  } catch {
    assert.fail('Expected Alchemy Techsol India scraper module at ../../scraper/alchemytechsolindia/script.js')
  }
}

test('Alchemy Techsol returns zero jobs only when its official dynamic listings feed explicitly reports no listings', async () => {
  const alchemy = await loadModule()

  assert.equal(alchemy.JOB_LISTINGS_AJAX_URL, 'https://alchemytechsol.com/jm-ajax/get_listings/')

  assert.equal(alchemy.pageIndicatesOfficialCareersSurface(careersHtml), true)
  assert.deepEqual(alchemy.extractCurrentOpenings(careersHtml), [])
  assert.equal(alchemy.hasExpectedAjaxListingsSignal(emptyListingsPayload), true)

  const jobs = await alchemy.createAlchemyTechsolIndiaScraper({
    now: () => '2026-07-25T20:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      assert.equal(url, alchemy.CAREERS_URL)
      return currentNativeHtml
    },
    fetchJson: async (url) => {
      assert.equal(url, alchemy.JOB_LISTINGS_AJAX_URL)
      return emptyListingsPayload
    },
  })

  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs).status,'verified-empty')
})

test('Alchemy archived positive cards remain discovery without full native criteria and typed countries', async () => {
  const alchemy = await loadModule()

  assert.deepEqual(alchemy.extractAjaxOpenings(firstListingsPage), [
    {
      title: 'Cloud Engineer',
      location: 'Bengaluru',
      employmentType: 'Full Time',
      sourceUrl: 'https://alchemytechsol.com/job/cloud-engineer/',
      applyUrl: 'https://alchemytechsol.com/job/cloud-engineer/',
    },
    {
      title: 'Account Executive',
      location: 'Austin, TX',
      employmentType: 'Full Time',
      sourceUrl: 'https://alchemytechsol.com/job/account-executive/',
      applyUrl: 'https://alchemytechsol.com/job/account-executive/',
    },
  ])

  const requestedPages = []
  const jobs = await alchemy.createAlchemyTechsolIndiaScraper({
    now: () => '2026-09-12T12:00:00.000Z',
  }).run({
    fetchText: async () => currentNativeHtml,
    fetchJson: async (url, options) => {
      assert.equal(url, alchemy.JOB_LISTINGS_AJAX_URL)
      const page = Number(new URLSearchParams(options.body).get('page'))
      requestedPages.push(page)
      return page === 1 ? firstListingsPage : secondListingsPage
    },
  })

  assert.deepEqual(requestedPages, [1, 1])
  assert.deepEqual(jobs.map((job) => ({
    title: job.title,
    location: job.location,
    city: job.city,
    employmentType: job.employmentType,
    sourceUrl: job.sourceUrl,
    applyUrl: job.applyUrl,
    source: job.source,
    scrapedAt: job.scrapedAt,
  })), [])
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('Alchemy Techsol fails closed when the dynamic listings response is unknown or inconsistent', async () => {
  const alchemy = await loadModule()

  assert.equal(alchemy.hasExpectedAjaxListingsSignal({}), false)
  assert.equal(alchemy.hasExpectedAjaxListingsSignal({
    found_jobs: true,
    max_num_pages: 1,
    html: emptyListingsPayload.html,
  }), false)

  await assert.rejects(
    alchemy.createAlchemyTechsolIndiaScraper().run({
      fetchText: async () => currentNativeHtml,
      fetchJson: async () => ({ found_jobs: false, max_num_pages: 0, html: '' }),
    }),
    /dynamic listings feed/i,
  )
})
