import assert from 'node:assert/strict'
import test from 'node:test'

const verifiedCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Online Share & Stock Market Trading Company in India- Nirmal Bang</title>
    <link rel="canonical" href="https://www.nirmalbang.com/static/career.aspx" />
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <p>Nirmal Bang Is Where Ambition Meets Opportunity</p>
      <p>Browse our current openings below and find a role that fits where you are today and where you want to go.</p>
      <b>Find open positions at NirmalBang that are best suited to you.</b>
      <div class="row careerfullsec"></div>
      <div class="careermore" id="loadmore_career" onclick="bindnxtcareer();">
        <a href="javascript://">More Openings</a>
      </div>
      <a href="mailto:careers@nirmalbang.com">careers@nirmalbang.com</a>
    </main>
  </body>
</html>
`

const listingsPageZero = [
  `<div class='careersec'><span>Administration Manager<i>Malad, Mumbai</i></span> <em>08-Jun-26 </em> <a onclick="loadcareerpopById('1216')" data-toggle='modal' data-target='#careermodalpopup'>APPLY NOW</a></div>`,
  `<div class='careersec'><span>Commodity Dealer<i>Jaipur</i></span> <em>14-May-26 </em> <a onclick="loadcareerpopById('1215')" data-toggle='modal' data-target='#careermodalpopup'>APPLY NOW</a></div>`,
  `<div class='careersec'><span>IT Senior Executive<i>Malad, Mumbai</i></span> <em>14-May-26 </em> <a onclick="loadcareerpopById('1214')" data-toggle='modal' data-target='#careermodalpopup'>APPLY NOW</a></div>`,
  `*1*4`,
].join('')

const listingsPageOne = '*1*4'

const administrationManagerDetail = [
  'Administration Manager',
  'Malad, Mumbai',
  '29/05/2026',
  'Ensure smooth functioning of office facilities. Identify and manage vendors.',
  'Should have sound knowledge of admin activities.',
  '1-5 Years',
].join('*')

const commodityDealerDetail = [
  'Commodity Dealer',
  'Jaipur',
  '14/05/2026',
  'Manage commodity trading activities on MCX and NCDEX exchanges.',
  'Should have prior trading experience.',
  '1-5 Years',
].join('*')

const itSeniorExecutiveDetail = [
  'IT Senior Executive',
  'Malad, Mumbai',
  '14/05/2026',
  'Act as first point support for trading app users.',
  'Candidate with prior experience in broking industry will be preferred.',
  '1-3 Years',
].join('*')

const loadNirmalBangModule = async () => {
  try {
    return await import('../../scraper/nirmalbang/script.js')
  } catch {
    assert.fail('Expected Nirmal Bang scraper module at ../../scraper/nirmalbang/script.js')
  }
}

test('Nirmal Bang verifies the first-party careers page and extracts listings plus detail payloads from the public Ajax endpoints', async () => {
  const nirmalBang = await loadNirmalBangModule()

  assert.equal(
    nirmalBang.buildListingsUrl(0),
    'https://www.nirmalbang.com/Ajaxpages/Ajax_fillcareers.aspx?pg=0',
  )
  assert.equal(
    nirmalBang.buildDetailUrl('1216'),
    'https://www.nirmalbang.com/Ajaxpages/Ajax_fillcareerspop.aspx?Cid=1216',
  )
  assert.equal(nirmalBang.hasVerifiedCareersPageSignal(verifiedCareersHtml), true)
  assert.deepEqual(nirmalBang.extractListingCards(listingsPageZero), [
    {
      title: 'Administration Manager',
      location: 'Malad, Mumbai',
      listingDate: '2026-06-08',
      jobId: '1216',
      requisitionId: '1216',
      sourceUrl: 'https://www.nirmalbang.com/Ajaxpages/Ajax_fillcareerspop.aspx?Cid=1216',
      applyUrl: 'https://www.nirmalbang.com/static/career.aspx',
    },
    {
      title: 'Commodity Dealer',
      location: 'Jaipur',
      listingDate: '2026-05-14',
      jobId: '1215',
      requisitionId: '1215',
      sourceUrl: 'https://www.nirmalbang.com/Ajaxpages/Ajax_fillcareerspop.aspx?Cid=1215',
      applyUrl: 'https://www.nirmalbang.com/static/career.aspx',
    },
    {
      title: 'IT Senior Executive',
      location: 'Malad, Mumbai',
      listingDate: '2026-05-14',
      jobId: '1214',
      requisitionId: '1214',
      sourceUrl: 'https://www.nirmalbang.com/Ajaxpages/Ajax_fillcareerspop.aspx?Cid=1214',
      applyUrl: 'https://www.nirmalbang.com/static/career.aspx',
    },
  ])
  assert.deepEqual(
    nirmalBang.extractJobDetailPayload(administrationManagerDetail),
    {
      title: 'Administration Manager',
      location: 'Malad, Mumbai',
      postingDate: '2026-05-29',
      jobDescription: 'Ensure smooth functioning of office facilities. Identify and manage vendors.',
      candidateProfile: 'Should have sound knowledge of admin activities.',
      experienceRequired: '1-5 Years',
    },
  )
})

test('Nirmal Bang run validates the careers page, paginates the public listings endpoint, and hydrates job details', async () => {
  const nirmalBang = await loadNirmalBangModule()
  const requestedUrls = []

  const jobs = await nirmalBang.createNirmalBangScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === nirmalBang.CAREERS_URL) return verifiedCareersHtml
      if (url === nirmalBang.buildListingsUrl(0)) return listingsPageZero
      if (url === nirmalBang.buildListingsUrl(1)) return listingsPageOne
      if (url === nirmalBang.buildDetailUrl('1216')) return administrationManagerDetail
      if (url === nirmalBang.buildDetailUrl('1215')) return commodityDealerDetail
      if (url === nirmalBang.buildDetailUrl('1214')) return itSeniorExecutiveDetail
      throw new Error(`Unexpected Nirmal Bang fixture URL: ${url}`)
    },
    now: () => '2026-07-16T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    nirmalBang.CAREERS_URL,
    'https://www.nirmalbang.com/Ajaxpages/Ajax_fillcareers.aspx?pg=0',
    'https://www.nirmalbang.com/Ajaxpages/Ajax_fillcareerspop.aspx?Cid=1216',
    'https://www.nirmalbang.com/Ajaxpages/Ajax_fillcareerspop.aspx?Cid=1215',
    'https://www.nirmalbang.com/Ajaxpages/Ajax_fillcareerspop.aspx?Cid=1214',
    'https://www.nirmalbang.com/Ajaxpages/Ajax_fillcareers.aspx?pg=1',
  ])
  assert.deepEqual(jobs, [
    {
      title: 'Administration Manager',
      company: 'Nirmal Bang',
      department: null,
      location: 'Malad, Mumbai',
      city: 'Mumbai',
      country: 'India',
      jobId: '1216',
      requisitionId: '1216',
      sourceUrl: 'https://www.nirmalbang.com/Ajaxpages/Ajax_fillcareerspop.aspx?Cid=1216',
      applyUrl: 'https://www.nirmalbang.com/static/career.aspx',
      link: 'https://www.nirmalbang.com/static/career.aspx',
      experienceRequired: '1-5 Years',
      postingDate: '2026-05-29',
      jobDescription: 'Ensure smooth functioning of office facilities. Identify and manage vendors.',
      candidateProfile: 'Should have sound knowledge of admin activities.',
      source: 'nirmalbang',
      scrapedAt: '2026-07-16T00:00:00.000Z',
    },
    {
      title: 'Commodity Dealer',
      company: 'Nirmal Bang',
      department: null,
      location: 'Jaipur',
      city: 'Jaipur',
      country: 'India',
      jobId: '1215',
      requisitionId: '1215',
      sourceUrl: 'https://www.nirmalbang.com/Ajaxpages/Ajax_fillcareerspop.aspx?Cid=1215',
      applyUrl: 'https://www.nirmalbang.com/static/career.aspx',
      link: 'https://www.nirmalbang.com/static/career.aspx',
      experienceRequired: '1-5 Years',
      postingDate: '2026-05-14',
      jobDescription: 'Manage commodity trading activities on MCX and NCDEX exchanges.',
      candidateProfile: 'Should have prior trading experience.',
      source: 'nirmalbang',
      scrapedAt: '2026-07-16T00:00:00.000Z',
    },
    {
      title: 'IT Senior Executive',
      company: 'Nirmal Bang',
      department: null,
      location: 'Malad, Mumbai',
      city: 'Mumbai',
      country: 'India',
      jobId: '1214',
      requisitionId: '1214',
      sourceUrl: 'https://www.nirmalbang.com/Ajaxpages/Ajax_fillcareerspop.aspx?Cid=1214',
      applyUrl: 'https://www.nirmalbang.com/static/career.aspx',
      link: 'https://www.nirmalbang.com/static/career.aspx',
      experienceRequired: '1-3 Years',
      postingDate: '2026-05-14',
      jobDescription: 'Act as first point support for trading app users.',
      candidateProfile: 'Candidate with prior experience in broking industry will be preferred.',
      source: 'nirmalbang',
      scrapedAt: '2026-07-16T00:00:00.000Z',
    },
  ])
})

test('Nirmal Bang fails closed when the verified careers page or public Ajax contracts drift', async () => {
  const nirmalBang = await loadNirmalBangModule()

  await assert.rejects(
    nirmalBang.createNirmalBangScraper().run({
      fetchText: async (url) => {
        if (url === nirmalBang.CAREERS_URL) {
          return verifiedCareersHtml.replace('Find open positions at NirmalBang', 'Explore opportunities')
        }
        throw new Error(`Unexpected Nirmal Bang fixture URL: ${url}`)
      },
    }),
    /verified careers page/i,
  )

  await assert.rejects(
    nirmalBang.createNirmalBangScraper().run({
      fetchText: async (url) => {
        if (url === nirmalBang.CAREERS_URL) return verifiedCareersHtml
        if (url === nirmalBang.buildListingsUrl(0)) return '*1*4'
        throw new Error(`Unexpected Nirmal Bang fixture URL: ${url}`)
      },
    }),
    /public listings ajax/i,
  )

  await assert.rejects(
    nirmalBang.createNirmalBangScraper().run({
      fetchText: async (url) => {
        if (url === nirmalBang.CAREERS_URL) return verifiedCareersHtml
        if (url === nirmalBang.buildListingsUrl(0)) return listingsPageZero
        if (url === nirmalBang.buildDetailUrl('1216')) return 'Administration Manager*Malad, Mumbai'
        throw new Error(`Unexpected Nirmal Bang fixture URL: ${url}`)
      },
    }),
    /public detail ajax/i,
  )
})
