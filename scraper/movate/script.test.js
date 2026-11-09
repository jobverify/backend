import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import * as movate from './script.js'
const portal = fs.readFileSync(new URL('./fixtures/portal-listings.html',import.meta.url),'utf8')
const details = JSON.parse(fs.readFileSync(new URL('./fixtures/portal-details.json',import.meta.url),'utf8'))
const homepage = '<title>Careers at Movate</title><a href="https://www.movate.com/careers/latest-job-openings/">Latest Job Openings</a>'
const jobsPage = '<title>Latest Job Openings India - Movate</title><iframe src="https://movatecareers.movate.com/MovateJobOpenings"></iframe>'
const fetchText = async url => {
 if(url === movate.HOMEPAGE_URL)return homepage
 if(url === movate.JOBS_PAGE_URL)return jobsPage
 if(url === 'https://movatecareers.movate.com/MovateJobOpenings')return portal
 if(details[url])return details[url].html
 throw Error('Unexpected public route '+url)
}

test('Movate follows the first-party careers iframe and reads every DOM pagination card',async()=>{
 const jobs = await movate.createMovateScraper().run({fetchText})
 assert.equal(jobs.length,13)
 assert.deepEqual(jobs.map(j=>j.jobId),['43136','42984','42976','42954','42925','42905','42904','42903','42902','42901','42881','42876','42850'])
 assert.equal(jobs[0].title,'Manager - Analytics')
 assert.equal(jobs[0].city,'Bangalore')
 assert.equal(jobs[0].country,'India')
 assert.deepEqual(jobs[0].requiredSkills,['BI Tool','analytics','Dashboard Development'])
 assert.equal(jobs[0].minimumQualification,'B.E/B.Tech')
 assert.equal(jobs[0].experienceRequired,'10 - 15 Yrs')
 assert.match(jobs[0].jobDescription,/Exposure to Pre-sales will be an added advantage/)
 assert.equal(jobs[0].sourceUrl,'https://movatecareers.movate.com/MovateJobDetails.aspx?gHnhwlsHGMM5aJBrG+6Zcw==')
})

test('Movate validates iframe host and detail requisition identity',async()=>{
 await assert.rejects(movate.createMovateScraper().run({fetchText:async url=>url===movate.JOBS_PAGE_URL ? jobsPage.replace('movatecareers.movate.com','example.com') : fetchText(url)}),/verified|embedded/i)
 await assert.rejects(movate.createMovateScraper({maxJobs:1}).run({fetchText:async url=>details[url]?details[url].html.replace('RRF-43136','RRF-99999'):fetchText(url)}),/identity|requisition|detail/i)
})

test('Movate rejects missing portal cards and changed detail descriptions',async()=>{
 await assert.rejects(movate.createMovateScraper().run({fetchText:async url=>url==='https://movatecareers.movate.com/MovateJobOpenings'?'<title>Movate Job Openings</title><div class="mv-jobs-grid"></div>':fetchText(url)}),/verified|listings/i)
 await assert.rejects(movate.createMovateScraper({maxJobs:1}).run({fetchText:async url=>details[url]?details[url].html.replace(/<span id="lblJobDescription">[\s\S]*?<\/span>/,''):fetchText(url)}),/description|detail/i)
})
