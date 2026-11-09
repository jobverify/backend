import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/mksvision/script.js')
  } catch {
    assert.fail('Expected MKS Vision scraper module at ../../scraper/mksvision/script.js')
  }
}

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>MKS Vision</title>
    </head>
    <body>
      <header>
        <a href="https://mksvision.com">Home</a>
        <a href="career">People</a>
      </header>
      <main>
        <p>A Preferred Technology Partner</p>
        <h1>Connecting Insights, Ideas &amp; Innovation</h1>
      </main>
    </body>
  </html>
`

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>MKS Vision</title>
    </head>
    <body>
      <section class="article career-page">
        <h1>Career</h1>
        <h1>
          <span>We are Hiring</span>
        </h1>
        <div class="row career-list">
          <div class="col-md-6 job-titile">RPG</div>
          <div class="col-md-3 job-exp">5 to 10 years</div>
          <div class="col-md-3 text-center approve">
            <a href="https://www.naukri.com/job-listings-rpg-developer-mks-vision-hyderabad-secunderabad-coimbatore-5-to-8-years-210223006917?src=jobsearchDesk&sid=16915023868458296&xp=2&px=1" class="modelApply" target="_blank">Apply</a>
          </div>
        </div>
        <div class="row career-list">
          <div class="col-md-6 job-titile">SQL DBA</div>
          <div class="col-md-3 job-exp">4 to 9 years</div>
          <div class="col-md-3 text-center approve">
            <a href="https://www.naukri.com/job-listings-windows-administrator-mks-vision-hyderabad-secunderabad-coimbatore-tamil-nadu-5-to-10-years-080823009696?src=jobsearchDesk&sid=16915020437909134&xp=6&px=1&nignbevent_src=jobsearchDesk" class="modelApply" target="_blank">Apply</a>
          </div>
        </div>
        <div class="row career-list">
          <div class="col-md-6 job-titile">Datascience</div>
          <div class="col-md-3 job-exp">3 to 6 years</div>
          <div class="col-md-3 text-center approve">
            <a href="https://www.naukri.com/job-listings-data-scientist-mks-vision-hyderabad-secunderabad-coimbatore-tamil-nadu-3-to-6-years-170723004403?src=jobsearchDesk&sid=16915028136157675_2&xp=4&px=3&nignbevent_src=jobsearchDeskGNB" class="modelApply" target="_blank">Apply</a>
          </div>
        </div>
        <div class="row career-list">
          <div class="col-md-6 job-titile">Windows Admin</div>
          <div class="col-md-3 job-exp">5 to 10 years</div>
          <div class="col-md-3 text-center approve">
            <a href="https://www.naukri.com/job-listings-windows-administrator-mks-vision-hyderabad-secunderabad-coimbatore-tamil-nadu-5-to-10-years-080823009696?src=jobsearchDesk&sid=16915018328905234&xp=2&px=1&nignbevent_src=jobsearchDeskGNB" class="modelApply" target="_blank">Apply</a>
          </div>
        </div>
        <div class="row career-list">
          <div class="col-md-6 job-titile">CAD Customization Engineer</div>
          <div class="col-md-3 job-exp">3 to 5 years</div>
          <div class="col-md-3 text-center approve">
            <a href="https://www.naukri.com/job-listings-cad-customization-engineer-mks-vision-hyderabad-secunderabad-coimbatore-tamil-nadu-3-to-5-years-080823009530?src=jobsearchDesk&sid=16915016871232188&xp=5&px=1" class="modelApply" target="_blank">Apply</a>
          </div>
        </div>
      </section>
    </body>
  </html>
`

test('MKS Vision scraper pins the verified homepage and careers surfaces', async () => {
  const mksvision = await loadModule()
  const literalAmpersandHomepageHtml = homepageHtml.replace(
    'Connecting Insights, Ideas &amp; Innovation',
    'Connecting Insights, Ideas & Innovation',
  )

  assert.equal(mksvision.HOMEPAGE_URL, 'https://mksvision.com/')
  assert.equal(mksvision.CAREER_PAGE_URL, 'https://mksvision.com/career')
  assert.equal(mksvision.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(mksvision.hasOfficialHomepageSignal(literalAmpersandHomepageHtml), true)
  assert.equal(mksvision.hasOfficialCareerSignal(careersHtml), true)
})

test('MKS Vision scraper extracts the current public jobs list from the official careers page', async () => {
  const mksvision = await loadModule()
  const requestedUrls = []

  const jobs = await mksvision.createMksVisionScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === mksvision.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === mksvision.CAREER_PAGE_URL) return { status: 200, url, html: careersHtml }
      throw new Error(`Unexpected MKS Vision URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    mksvision.HOMEPAGE_URL,
    mksvision.CAREER_PAGE_URL,
  ])
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      experienceRequired: job.experienceRequired,
      applyUrl: job.applyUrl,
      source: job.source,
      link: job.link,
    })),
    [
      {
        title: 'RPG',
        experienceRequired: '5 to 10 years',
        applyUrl: 'https://www.naukri.com/job-listings-rpg-developer-mks-vision-hyderabad-secunderabad-coimbatore-5-to-8-years-210223006917?src=jobsearchDesk&sid=16915023868458296&xp=2&px=1',
        source: 'mksvision',
        link: 'https://www.naukri.com/job-listings-rpg-developer-mks-vision-hyderabad-secunderabad-coimbatore-5-to-8-years-210223006917?src=jobsearchDesk&sid=16915023868458296&xp=2&px=1',
      },
      {
        title: 'SQL DBA',
        experienceRequired: '4 to 9 years',
        applyUrl: 'https://www.naukri.com/job-listings-windows-administrator-mks-vision-hyderabad-secunderabad-coimbatore-tamil-nadu-5-to-10-years-080823009696?src=jobsearchDesk&sid=16915020437909134&xp=6&px=1&nignbevent_src=jobsearchDesk',
        source: 'mksvision',
        link: 'https://www.naukri.com/job-listings-windows-administrator-mks-vision-hyderabad-secunderabad-coimbatore-tamil-nadu-5-to-10-years-080823009696?src=jobsearchDesk&sid=16915020437909134&xp=6&px=1&nignbevent_src=jobsearchDesk',
      },
      {
        title: 'Datascience',
        experienceRequired: '3 to 6 years',
        applyUrl: 'https://www.naukri.com/job-listings-data-scientist-mks-vision-hyderabad-secunderabad-coimbatore-tamil-nadu-3-to-6-years-170723004403?src=jobsearchDesk&sid=16915028136157675_2&xp=4&px=3&nignbevent_src=jobsearchDeskGNB',
        source: 'mksvision',
        link: 'https://www.naukri.com/job-listings-data-scientist-mks-vision-hyderabad-secunderabad-coimbatore-tamil-nadu-3-to-6-years-170723004403?src=jobsearchDesk&sid=16915028136157675_2&xp=4&px=3&nignbevent_src=jobsearchDeskGNB',
      },
      {
        title: 'Windows Admin',
        experienceRequired: '5 to 10 years',
        applyUrl: 'https://www.naukri.com/job-listings-windows-administrator-mks-vision-hyderabad-secunderabad-coimbatore-tamil-nadu-5-to-10-years-080823009696?src=jobsearchDesk&sid=16915018328905234&xp=2&px=1&nignbevent_src=jobsearchDeskGNB',
        source: 'mksvision',
        link: 'https://www.naukri.com/job-listings-windows-administrator-mks-vision-hyderabad-secunderabad-coimbatore-tamil-nadu-5-to-10-years-080823009696?src=jobsearchDesk&sid=16915018328905234&xp=2&px=1&nignbevent_src=jobsearchDeskGNB',
      },
      {
        title: 'CAD Customization Engineer',
        experienceRequired: '3 to 5 years',
        applyUrl: 'https://www.naukri.com/job-listings-cad-customization-engineer-mks-vision-hyderabad-secunderabad-coimbatore-tamil-nadu-3-to-5-years-080823009530?src=jobsearchDesk&sid=16915016871232188&xp=5&px=1',
        source: 'mksvision',
        link: 'https://www.naukri.com/job-listings-cad-customization-engineer-mks-vision-hyderabad-secunderabad-coimbatore-tamil-nadu-3-to-5-years-080823009530?src=jobsearchDesk&sid=16915016871232188&xp=5&px=1',
      },
    ],
  )
})
