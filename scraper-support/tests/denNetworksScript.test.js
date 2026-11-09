import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html>
  <head>
    <title>DEN Networks - Top Cable Service Provider in India</title>
  </head>
  <body>
    <a href="https://dennetworks.com/about-us">About us</a>
    <a href="https://dennetworks.com/careers">Careers</a>
    <a href="https://dennetworks.com/news">News</a>
    <p>DEN Networks - Top Cable Service Provider</p>
    <p>© 2017 DEN Networks Ltd. - All Rights Reserved</p>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html>
  <head>
    <title>Make your Career Brighter with DEN Networks</title>
  </head>
  <body>
    <h1>Life @DEN</h1>
    <p>We promote a culture of growth and success, for our business as much as our people.</p>
    <h2>Opportunities</h2>
    <a href="https://dennetworks.com/home/career_detail/1">Administration</a>
    <a href="https://dennetworks.com/home/career_detail/2">Content & Carriage</a>
    <a href="https://dennetworks.com/home/career_detail/3">Advertisment -Sales</a>
    <a href="https://dennetworks.com/home/career_detail/4">Customer Experience</a>
    <a href="https://dennetworks.com/home/career_detail/5">Finance</a>
    <a href="https://dennetworks.com/home/career_detail/6">Human Resources</a>
    <a href="https://dennetworks.com/home/career_detail/7">Technical - Cable</a>
    <a href="https://dennetworks.com/home/career_detail/8">Technical - Broadband</a>
    <a href="https://dennetworks.com/home/career_detail/9">Legal</a>
    <a href="https://dennetworks.com/home/career_detail/10">Logistics</a>
    <a href="https://dennetworks.com/home/career_detail/11">Marketing</a>
    <a href="https://dennetworks.com/home/career_detail/12">Operations</a>
    <a href="https://dennetworks.com/home/career_detail/13">Sales</a>
    <a href="https://dennetworks.com/home/career_detail/14">Others</a>
    <p>Drop your CV and we will get back to you.</p>
    <select id="experience">
      <option value="">Select Experience</option>
      <option value="0-1">0-1</option>
      <option value="1-3">1-3</option>
    </select>
  </body>
</html>
`

const noOpeningDetailHtml = `
<!doctype html>
<html>
  <head>
    <title>DEN</title>
  </head>
  <body>
    <h1>Life @DEN</h1>
    <select class="input-xlarge focused" id="select_post" name="select_post">
      <option value="1" selected>Administration</option>
      <option value="3">Advertisment -Sales</option>
    </select>
    <div class="jobopening">
      <div class="noopening">There are currently no opening.</div>
    </div>
  </body>
</html>
`

const liveOpeningDetailHtml = `
<!doctype html>
<html>
  <head>
    <title>DEN</title>
  </head>
  <body>
    <h1>Life @DEN</h1>
    <select class="input-xlarge focused" id="select_post" name="select_post">
      <option value="1">Administration</option>
      <option value="3" selected>Advertisment -Sales</option>
      <option value="11">Marketing</option>
    </select>
    <div class="jobopening">
      <div class="joblist">
        <div class="jobtopSection">
          <h5 id="title1">Corporate Communication</h5>
          <ul>
            <li id="loc1">gurgaon </li>
            <li>3-6 Years Experience</li>
          </ul>
        </div>
        <div class="jobbottomSection">
          <div class="jobdescpt">
            <p>Corporate Communication</p>
            <a class="applybtn" href="#hello" onclick="save_data('Corporate Communication','gurgaon');"> Apply for position </a>
          </div>
        </div>
      </div>
    </div>
    <div class="reveal-modal" id="hello">
      <form action="https://dennetworks.com/home/upload_resume" role="form" id="form_career_detail" enctype="multipart/form-data" method="post" accept-charset="utf-8">
        <input type="hidden" name="action" value="resume">
        <select name="experience" id="experience" class="inputapply">
          <option value="">Select Experience</option>
          <option value="3-5">3-5</option>
        </select>
        <input type="submit" value="Apply now" class="appresume">
      </form>
    </div>
  </body>
</html>
`

const brokenDetailHtml = `
<!doctype html>
<html>
  <head>
    <title>DEN</title>
  </head>
  <body>
    <h1>Life @DEN</h1>
    <div class="jobopening">
      <div class="joblist">
        <div class="jobtopSection">
          <h5 id="title1">Corporate Communication</h5>
        </div>
      </div>
    </div>
  </body>
</html>
`

const loadDenNetworksModule = async () => {
  try {
    return await import('../../scraper/dennetworks/script.js')
  } catch {
    assert.fail('Expected Den Networks scraper module at ../../scraper/dennetworks/script.js')
  }
}

test('Den Networks scraper helpers stay pinned to the verified homepage, careers hub, and linked detail-page extraction contract', async () => {
  const denNetworks = await loadDenNetworksModule()

  assert.equal(denNetworks.SOURCE, 'dennetworks')
  assert.equal(denNetworks.COMPANY, 'Den Networks')
  assert.equal(denNetworks.HOMEPAGE_URL, 'https://dennetworks.com/')
  assert.equal(denNetworks.CAREERS_PAGE_URL, 'https://dennetworks.com/careers')
  assert.equal(denNetworks.CAREER_DETAIL_BASE_URL, 'https://dennetworks.com/home/career_detail/')
  assert.equal(denNetworks.UPLOAD_RESUME_URL, 'https://dennetworks.com/home/upload_resume')
  assert.equal(denNetworks.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(denNetworks.hasOfficialCareersPageSignal(careersHtml), true)
  assert.deepEqual(denNetworks.extractCareerDetailUrls(careersHtml), [
    'https://dennetworks.com/home/career_detail/1',
    'https://dennetworks.com/home/career_detail/2',
    'https://dennetworks.com/home/career_detail/3',
    'https://dennetworks.com/home/career_detail/4',
    'https://dennetworks.com/home/career_detail/5',
    'https://dennetworks.com/home/career_detail/6',
    'https://dennetworks.com/home/career_detail/7',
    'https://dennetworks.com/home/career_detail/8',
    'https://dennetworks.com/home/career_detail/9',
    'https://dennetworks.com/home/career_detail/10',
    'https://dennetworks.com/home/career_detail/11',
    'https://dennetworks.com/home/career_detail/12',
    'https://dennetworks.com/home/career_detail/13',
    'https://dennetworks.com/home/career_detail/14',
  ])
  assert.equal(denNetworks.isNoOpeningDetailPage(noOpeningDetailHtml), true)
  assert.equal(denNetworks.isNoOpeningDetailPage(liveOpeningDetailHtml), false)
  assert.deepEqual(
    denNetworks.extractOpeningsFromDetailPage(
      liveOpeningDetailHtml,
      'https://dennetworks.com/home/career_detail/3',
    ),
    [
      {
        title: 'Corporate Communication',
        company: 'Den Networks',
        department: 'Advertisment -Sales',
        location: 'Gurgaon, India',
        city: 'Gurgaon',
        country: 'India',
        jobId: 'dennetworks-3-corporate-communication-gurgaon',
        requisitionId: 'dennetworks-3-corporate-communication-gurgaon',
        sourceUrl: 'https://dennetworks.com/home/career_detail/3',
        applyUrl: 'https://dennetworks.com/home/career_detail/3',
        employmentType: null,
        experienceRequired: '3-6 Years Experience',
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: 'Corporate Communication',
        remoteStatus: null,
      },
    ],
  )
})

test('Den Networks run returns live first-party openings from the linked career detail pages and skips verified no-opening routes', async () => {
  const denNetworks = await loadDenNetworksModule()
  const requestedUrls = []
  const expectedDetailUrls = denNetworks.extractCareerDetailUrls(careersHtml)

  const jobs = await denNetworks.createDenNetworksScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === denNetworks.HOMEPAGE_URL) return homepageHtml
      if (url === denNetworks.CAREERS_PAGE_URL) return careersHtml
      if (url === 'https://dennetworks.com/home/career_detail/3') return liveOpeningDetailHtml
      if (expectedDetailUrls.includes(url)) return noOpeningDetailHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-15T12:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    denNetworks.HOMEPAGE_URL,
    denNetworks.CAREERS_PAGE_URL,
    ...expectedDetailUrls,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Corporate Communication')
  assert.equal(jobs[0].department, 'Advertisment -Sales')
  assert.equal(jobs[0].location, 'Gurgaon, India')
  assert.equal(jobs[0].city, 'Gurgaon')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].source, 'dennetworks')
  assert.equal(jobs[0].company, 'Den Networks')
  assert.equal(jobs[0].atsPlatform, 'first-party-careers-pages-plus-upload-resume-form')
  assert.equal(jobs[0].applyUrl, 'https://dennetworks.com/home/career_detail/3')
  assert.equal(jobs[0].link, 'https://dennetworks.com/home/career_detail/3')
  assert.equal(jobs[0].experienceRequired, '3-6 Years Experience')
  assert.equal(jobs[0].scrapedAt, '2026-07-15T12:00:00.000Z')
})

test('Den Networks fails closed when the homepage, careers hub, or linked detail pages drift away from the verified contract', async () => {
  const denNetworks = await loadDenNetworksModule()
  const expectedDetailUrls = denNetworks.extractCareerDetailUrls(careersHtml)

  await assert.rejects(
    denNetworks.createDenNetworksScraper().run({
      fetchText: async (url) => {
        if (url === denNetworks.HOMEPAGE_URL) {
          return '<html><head><title>Unexpected</title></head><body>No careers link</body></html>'
        }

        throw new Error('Should not fetch further')
      },
    }),
    /homepage no longer matches the verified official surface/i,
  )

  await assert.rejects(
    denNetworks.createDenNetworksScraper().run({
      fetchText: async (url) => {
        if (url === denNetworks.HOMEPAGE_URL) return homepageHtml
        if (url === denNetworks.CAREERS_PAGE_URL) return '<html><head><title>Careers</title></head><body>No detail links</body></html>'

        throw new Error('Should not fetch further')
      },
    }),
    /careers page no longer matches the verified official surface/i,
  )

  await assert.rejects(
    denNetworks.createDenNetworksScraper().run({
      fetchText: async (url) => {
        if (url === denNetworks.HOMEPAGE_URL) return homepageHtml
        if (url === denNetworks.CAREERS_PAGE_URL) return careersHtml
        if (url === 'https://dennetworks.com/home/career_detail/3') return brokenDetailHtml
        if (expectedDetailUrls.includes(url)) return noOpeningDetailHtml

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /career detail page no longer matches the verified public surface/i,
  )
})
