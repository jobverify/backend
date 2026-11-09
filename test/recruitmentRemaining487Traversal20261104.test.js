import assert from 'node:assert/strict'
import test from 'node:test'
import {createVerifiedRecruitmentScraper} from '../scraper-support/utils/verifiedRecruitment.js'

const root='https://jobs.example.test/careers',search='https://jobs.example.test/search/?locationsearch=India'
const role='https://jobs.example.test/job/Pune-Engineer/123456/'
const description='Develop reliable production services, collaborate on system designs with engineers, investigate incidents and improve operational availability and performance.'

test('a published India role is read before translations of the same India search consume the page budget',async()=>{
 const calls=[]
 const posting={'@type':'JobPosting',title:'Engineer',description,url:role,hiringOrganization:{name:'Example'},jobLocation:{address:{addressCountry:'India',addressLocality:'Pune'}}}
 const languages=['bs_ID','cs_CZ','da_DK','de_DE','es_ES','fr_FR','hu_HU','it_IT','ja_JP']
 const result=await createVerifiedRecruitmentScraper({source:'example',companyName:'Example',companyCareerPage:root,companyDomain:'example.test',prioritizeRecruitmentSearch:true,prioritizeRecruitmentRoleDetails:true,allowDeclaredExternalCareersPages:true}).run({maxPages:3,
  fetchPage:async url=>{
   calls.push(url)
   return {status:200,url,html:url===root?`<h1>Example Careers</h1><a href="${search}">India jobs</a>`:url===role?
    `<h1>Engineer</h1><p>${description}</p><script type="application/ld+json">${JSON.stringify(posting)}</script>`:
    `<h1>Example India Jobs</h1>${languages.map(locale=>`<a href="${search}&locale=${locale}">${locale}</a>`).join('')}<a href="${role}">Engineer</a>`}
  }})
 assert.equal(result.length,1)
 assert.equal(result[0].country,'India')
 assert.deepEqual(calls,[root,search,role])
})

test('an India search yields its declared role before sort and pagination views exhaust discovery',async()=>{
 const calls=[]
 const posting={'@type':'JobPosting',title:'Engineer',description,url:role,hiringOrganization:{name:'Example'},jobLocation:{address:{addressCountry:'India',addressLocality:'Pune'}}}
 const result=await createVerifiedRecruitmentScraper({source:'example',companyName:'Example',companyCareerPage:root,companyDomain:'example.test',prioritizeRecruitmentSearch:true,prioritizeRecruitmentRoleDetails:true}).run({maxPages:3,
  fetchPage:async url=>{
   calls.push(url)
   const views=['&sortColumn=sort_title&sortDirection=desc','&sortColumn=sort_department&sortDirection=asc','&startrow=25']
   return {status:200,url,html:url===root?`<h1>Example Careers</h1><a href="${search}">India jobs</a>`:url===role?
    `<h1>Engineer</h1><p>${description}</p><script type="application/ld+json">${JSON.stringify(posting)}</script>`:
    `<h1>Example India Jobs</h1>${views.map(view=>`<a href="${search}${view}">Jobs</a>`).join('')}<a href="${role}">Engineer</a>`}
  }})
 assert.equal(result.length,1)
 assert.deepEqual(calls,[root,search,role])
})

test('an initial global careers page selects its India search before a foreign role',async()=>{
 const calls=[]
 await assert.rejects(createVerifiedRecruitmentScraper({source:'example',companyName:'Example',companyCareerPage:root,companyDomain:'example.test',prioritizeRecruitmentSearch:true}).run({maxPages:2,
  fetchPage:async url=>{calls.push(url);return {status:200,url,html:`<h1>Example Careers</h1><a href="${search}">India jobs</a><a href="https://jobs.example.test/job/London-Engineer/999999/">Engineer</a>`}}
 }),/inventory is unavailable/)
 assert.deepEqual(calls,[root,search])
})

test('a reviewed careers-domain search can use its declared native GET form',async()=>{
 const calls=[],home='https://jobs.example.test/',query='https://jobs.example.test/search/?q=India'
 const posting={'@type':'JobPosting',title:'Engineer',description,url:role,hiringOrganization:{name:'Example'},jobLocation:{address:{addressCountry:'India'}}}
 const jobs=await createVerifiedRecruitmentScraper({source:'example',companyName:'Example',companyDomain:'example.test',officialHomepageUrl:home,companyCareerPage:home,requireCorporateIdentityMatch:true,prioritizeRecruitmentSearch:true,prioritizeRecruitmentRoleDetails:true}).run({maxPages:3,
  fetchPage:async url=>{calls.push(url);return {status:200,url,html:url===home?'<title>Example Careers</title><form id="keywordsearch" method="get" action="/search/"><input type="text" name="q"></form>':url===query?`<h1>Example Jobs</h1><a href="${role}">Engineer</a>`:`<h1>Engineer</h1><p>${description}</p><script type="application/ld+json">${JSON.stringify(posting)}</script>`}}
 })
 assert.equal(jobs.length,1)
 assert.deepEqual(calls,[home,query,role])
})

