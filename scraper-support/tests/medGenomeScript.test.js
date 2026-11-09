import assert from 'node:assert/strict'
import test from 'node:test'

const careersPageHtml = `
  <section class="about_banner_section">
    <h1 class="title_xxl">Careers</h1>
    <div class="banner_pera title_regular">Join us in transforming healthcare with the power of genomics.</div>
  </section>
  <section class="careers_listing_section">
    <h2>Be Part of the Mission</h2>
  </section>
  <script>
    var ajaxfilter = {"ajaxurl":"https://diagnostics.medgenome.com/wp-admin/admin-ajax.php"};
  </script>
`

const listingsPageOneHtml = `
  <div class="career_tab_row">
    <div class="career_tab_col">
      <h4 class="title_md">Zonal Business Manager</h4>
      <div class="career_content fs_regular">
        <p>Zonal Business Manager</p>
        <div class="common_btn">
          <a href="https://diagnostics.medgenome.com/careers/zonal-business-manager/">Apply Now</a>
        </div>
      </div>
      <ul class="fs_regular">
        <li>Full Time</li>
        | <li>Bangalore</li>
      </ul>
    </div>
    <div class="career_tab_col">
      <h4 class="title_md">Manager &#8211; Scientific Affairs</h4>
      <div class="career_content fs_regular">
        <p>Scientific Affairs Manager</p>
        <div class="common_btn">
          <a href="https://diagnostics.medgenome.com/careers/manager-scientific-affairs/">Apply Now</a>
        </div>
      </div>
      <ul class="fs_regular">
        <li>Part Time</li>
        | <li>New Delhi</li>
      </ul>
    </div>
  </div>
`

const listingsPageTwoHtml = `
  <div class="career_tab_row">
    <div class="career_tab_col">
      <h4 class="title_md">Area Sales Manager</h4>
      <div class="career_content fs_regular">
        <p>Area Sales Manager</p>
        <div class="common_btn">
          <a href="https://diagnostics.medgenome.com/careers/area-sales-manager/">Apply Now</a>
        </div>
      </div>
      <ul class="fs_regular">
        <li>Full Time</li>
        | <li>Hyderabad</li>
      </ul>
    </div>
  </div>
`

const zonalBusinessManagerDetailHtml = `
  <div class="careers_details_inner">
    <div class="careers_details_heading">
      <div class="careers_details_heading_left">
        <h2 class="title_xl">Zonal Business Manager</h2>
        <ul class="fs_regular">
          <li>Full Time</li> |
          <li>Bangalore</li>
        </ul>
      </div>
    </div>
    <div class="careers_details_responsibilities fs_regular">
      <div class="job_responsibilties">
        <h4 class="title_md">Job Description:</h4>
        <ul>
          <li>Leading Sales function.</li>
          <li>Managing the sales team.</li>
        </ul>
      </div>
      <hr class="hr_line">
      <div class="skills_xpertise">
        <h4 class="title_md">Educational Qualification:</h4>
        Graduation Master's Others
      </div>
    </div>
  </div>
`

const scientificAffairsDetailHtml = `
  <div class="careers_details_inner">
    <div class="careers_details_heading">
      <div class="careers_details_heading_left">
        <h2 class="title_xl">Manager - Scientific Affairs</h2>
        <ul class="fs_regular">
          <li>Part Time</li> |
          <li>New Delhi</li>
        </ul>
      </div>
    </div>
    <div class="careers_details_responsibilities fs_regular">
      <div class="job_responsibilties">
        <h4 class="title_md">Job Description:</h4>
        <ul>
          <li>Drive scientific affairs strategy.</li>
        </ul>
      </div>
      <hr class="hr_line">
      <div class="skills_xpertise">
        <h4 class="title_md">Educational Qualification:</h4>
        M.Sc. or Ph.D.
      </div>
    </div>
  </div>
`

const areaSalesManagerDetailHtml = `
  <div class="careers_details_inner">
    <div class="careers_details_heading">
      <div class="careers_details_heading_left">
        <h2 class="title_xl">Area Sales Manager</h2>
        <ul class="fs_regular">
          <li>Full Time</li> |
          <li>Hyderabad</li>
        </ul>
      </div>
    </div>
    <div class="careers_details_responsibilities fs_regular">
      <div class="job_responsibilties">
        <h4 class="title_md">Job Description:</h4>
        <ul>
          <li>Own city sales performance.</li>
        </ul>
      </div>
      <hr class="hr_line">
      <div class="skills_xpertise">
        <h4 class="title_md">Educational Qualification:</h4>
        MBA
      </div>
    </div>
  </div>
`

const loadMedGenomeModule = async () => {
  try {
    return await import('../../scraper/medgenome/script.js')
  } catch {
    assert.fail('Expected MedGenome scraper module at ../../scraper/medgenome/script.js')
  }
}

test('MedGenome exports the verified careers and admin-ajax constants', async () => {
  const medGenome = await loadMedGenomeModule()

  assert.equal(medGenome.CAREERS_URL, 'https://diagnostics.medgenome.com/career/')
  assert.equal(medGenome.AJAX_URL, 'https://diagnostics.medgenome.com/wp-admin/admin-ajax.php')
  assert.equal(medGenome.AJAX_ACTION, 'career_listing')
  assert.equal(medGenome.hasOfficialCareersSurface(careersPageHtml), true)
})

test('MedGenome extracts listing cards from the verified admin-ajax HTML and detail data from public job pages', async () => {
  const medGenome = await loadMedGenomeModule()

  assert.deepEqual(medGenome.extractListingCards(listingsPageOneHtml), [
    {
      title: 'Zonal Business Manager',
      location: 'Bangalore',
      employmentType: 'Full Time',
      sourceUrl: 'https://diagnostics.medgenome.com/careers/zonal-business-manager/',
    },
    {
      title: 'Manager - Scientific Affairs',
      location: 'New Delhi',
      employmentType: 'Part Time',
      sourceUrl: 'https://diagnostics.medgenome.com/careers/manager-scientific-affairs/',
    },
  ])

  assert.deepEqual(medGenome.extractJobDetail(zonalBusinessManagerDetailHtml), {
    location: 'Bangalore',
    employmentType: 'Full Time',
    minimumQualification: "Graduation Master's Others",
    jobDescription: 'Leading Sales function. Managing the sales team.',
  })
})

test('MedGenome run verifies the first-party careers shell, paginates admin-ajax until empty, and enriches detail pages', async () => {
  const medGenome = await loadMedGenomeModule()
  const requested = []

  const jobs = await medGenome.createMedGenomeScraper({ maxJobs: 3 }).run({
    fetchText: async (url, options = {}) => {
      requested.push([url, options.method || 'GET', options.body || null])

      if (url === medGenome.CAREERS_URL) return careersPageHtml
      if (url === medGenome.AJAX_URL) {
        const page = String(new URLSearchParams(options.body).get('page'))
        if (page === '1') return listingsPageOneHtml
        if (page === '2') return listingsPageTwoHtml
        if (page === '3') return '   '
      }
      if (url === 'https://diagnostics.medgenome.com/careers/zonal-business-manager/') {
        return zonalBusinessManagerDetailHtml
      }
      if (url === 'https://diagnostics.medgenome.com/careers/manager-scientific-affairs/') {
        return scientificAffairsDetailHtml
      }
      if (url === 'https://diagnostics.medgenome.com/careers/area-sales-manager/') {
        return areaSalesManagerDetailHtml
      }

      throw new Error(`Unexpected MedGenome fixture URL: ${url}`)
    },
    now: () => '2026-07-16T00:00:00.000Z',
  })

  assert.deepEqual(requested, [
    [medGenome.CAREERS_URL, 'GET', null],
    [medGenome.AJAX_URL, 'POST', 'page=1&location_cat_id=0&career_cat_tab=0&action=career_listing'],
    [medGenome.AJAX_URL, 'POST', 'page=2&location_cat_id=0&career_cat_tab=0&action=career_listing'],
    [medGenome.AJAX_URL, 'POST', 'page=3&location_cat_id=0&career_cat_tab=0&action=career_listing'],
    ['https://diagnostics.medgenome.com/careers/zonal-business-manager/', 'GET', null],
    ['https://diagnostics.medgenome.com/careers/manager-scientific-affairs/', 'GET', null],
    ['https://diagnostics.medgenome.com/careers/area-sales-manager/', 'GET', null],
  ])
  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs[0], {
    title: 'Zonal Business Manager',
    company: 'MedGenome',
    location: 'Bangalore',
    city: 'Bangalore',
    country: 'India',
    source: 'medgenome',
    jobId: 'zonal-business-manager',
    requisitionId: 'zonal-business-manager',
    sourceUrl: 'https://diagnostics.medgenome.com/careers/zonal-business-manager/',
    applyUrl: 'https://diagnostics.medgenome.com/careers/zonal-business-manager/',
    link: 'https://diagnostics.medgenome.com/careers/zonal-business-manager/',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: "Graduation Master's Others",
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Leading Sales function. Managing the sales team.',
    remoteStatus: 'On-site',
    scrapedAt: '2026-07-16T00:00:00.000Z',
  })
  assert.equal(jobs[1].employmentType, 'Part-time')
  assert.equal(jobs[2].jobId, 'area-sales-manager')
})

test('MedGenome fails closed when the first-party careers page drifts away from the verified shell', async () => {
  const medGenome = await loadMedGenomeModule()

  await assert.rejects(
    medGenome.createMedGenomeScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected page</h1></body></html>',
    }),
    /verified MedGenome careers page/i,
  )
})
