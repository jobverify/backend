import {structure,need,publicRead,stable,norm,failure,sha} from '../bizongo/publicRead.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
export const CURRENT_CORPORATE='https://www.bootlabstech.com/careers',CURRENT_PROFILE='https://www.linkedin.com/company/bootlabs-technologies/jobs/'
const COMPANY='BootLabs',TENANT='/company/bootlabs-technologies',COMPANY_ID='14621861'
const profile=value=>{try{const u=new URL(value);return u.protocol==='https:'&&['www.linkedin.com','in.linkedin.com'].includes(u.hostname)&&!u.port&&!u.username&&!u.password&&!u.search&&!u.hash&&[TENANT,TENANT+'/',TENANT+'/jobs',TENANT+'/jobs/'].includes(u.pathname)}catch{return false}}
const profileUrls=[CURRENT_PROFILE,'https://www.linkedin.com'+TENANT,'https://www.linkedin.com'+TENANT+'/','https://in.linkedin.com'+TENANT,'https://in.linkedin.com'+TENANT+'/']
function corporate(html){
 const s=structure(html)
 need(s.visible(n=>n.tag==='title').some(n=>/Careers/i.test(s.text(n))&&/BootLabs/i.test(s.text(n)))&&s.visible(n=>n.tag==='link'&&n.attrs.rel==='canonical'&&['https://bootlabstech.com/careers',CURRENT_CORPORATE].includes(n.attrs.href)).length===1,COMPANY,'current corporate careers identity changed')
 const links=s.visible(n=>n.tag==='a'&&profile(n.attrs.href)&&/open roles|careers|jobs/i.test(s.text(n))).map(n=>({text:s.text(n),href:n.attrs.href}))
 need(links.some(n=>n.href===CURRENT_PROFILE),COMPANY,'active corporate public jobs handoff missing')
 return{employer:COMPANY,links}
}
export function inspectCurrentProfile(html){
 const s=structure(html),schemas=s.visible(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').flatMap(n=>{let parsed;try{parsed=JSON.parse(n.raw)}catch{throw failure(COMPANY,'malformed public employer schema')};return[parsed,...(parsed['@graph']||[])]})
 const organizations=schemas.filter(n=>n['@type']==='Organization'&&n.name===COMPANY&&profile(n.url))
 need(organizations.length===1&&organizations[0].sameAs==='https://www.bootlabstech.com/',COMPANY,'native employer website identity changed')
 need(s.visible(n=>n.tag==='h1').some(n=>norm(s.text(n))===COMPANY),COMPANY,'native employer heading identity changed')
 const ids=[]
 for(const node of s.visible(n=>n.tag==='a'&&n.attrs.href))try{
  const outer=new URL(node.attrs.href),redirect=outer.searchParams.get('session_redirect');if(!redirect)continue
  const u=new URL(redirect);if(!['www.linkedin.com','in.linkedin.com'].includes(u.hostname)||u.pathname!=='/search/results/people/')continue
  const facet=u.searchParams.get('facetCurrentCompany');if(facet){const values=JSON.parse(facet);if(Array.isArray(values))ids.push(...values.map(String))}
 }catch{ /* Non-employer public navigation is not a company identity binding. */ }
 need(ids.length>0&&ids.every(id=>id===COMPANY_ID),COMPANY,'native public company facet identity changed')
 // Native commentary has inline hashtag/mention links. Joining every inline
 // child with a new space would change its original punctuation and wording.
 const commentary=node=>!s.active(node)||node.tag==='script'?'':node.tag==='br'?'\n':node.children.map(c=>typeof c==='string'?decodeNativeEntities(c):commentary(c)).join('')
 const visiblePosts=s.visible(n=>n.attrs['data-test-id']==='main-feed-activity-card__commentary').map(n=>norm(commentary(n)))
 const observations=schemas.filter(n=>n['@type']==='SocialMediaPosting').map(post=>{
  need(post.author?.['@type']==='Organization'&&post.author.name===COMPANY&&profile(post.author.url),COMPANY,'native announcement employer identity changed')
  const u=new URL(post.url),id=u.pathname.match(/^\/posts\/bootlabs-technologies_[^/]+-activity-(\d+)-[^/]+$/)?.[1]
  need(u.protocol==='https:'&&u.hostname==='www.linkedin.com'&&!u.search&&!u.hash&&id&&post.mainEntityOfPage===post.url,COMPANY,'native public announcement identity changed')
  need(typeof post.text==='string'&&post.text.trim()&&visiblePosts.includes(norm(post.text)),COMPANY,'complete native announcement text is not publicly rendered')
  need(typeof post.datePublished==='string'&&Number.isFinite(Date.parse(post.datePublished)),COMPANY,'native announcement timestamp changed')
  const hiringSignal=/\b(?:we[’']?re hiring|we are hiring|is hiring|hiring (?:ai|in |gcp|for )|apply(?: now)?\s*:)/i.test(post.text)&&/ta@bootlabstech\.com/i.test(post.text)
  return{kind:'native-public-employer-announcement',hiringSignal,nativeAnnouncementId:id,sourceUrl:post.url,originalText:post.text,originalTextSha256:sha(post.text),announcementPublishedAt:post.datePublished,jobPostingDate:null,country:null,jobId:null,requisitionId:null,currentVacancyCount:null,applicationSubmitted:false}
 })
 need(new Set(observations.map(n=>n.nativeAnnouncementId)).size===observations.length,COMPANY,'duplicate native announcement identity')
 const jobsLinks=s.visible(n=>n.tag==='a'&&n.attrs.href).filter(n=>{try{const u=new URL(n.attrs.href);return ['www.linkedin.com','in.linkedin.com'].includes(u.hostname)&&(/^\/jobs\/view\//.test(u.pathname)||u.searchParams.get('f_C')===COMPANY_ID)}catch{return false}}).map(n=>({text:s.text(n),href:n.attrs.href}))
 return{employer:COMPANY,nativeCompanyId:COMPANY_ID,observations,jobsLinks,sourceScopeComplete:false}
}
export const runCurrentBootLabs=options=>publicRead({source:'bootlabstechnologies',company:COMPANY},options,async({read,stamp,audit,publicPages})=>{
 const verifiedAt=stamp(),snapshot=async phase=>({corporate:corporate(await read(CURRENT_CORPORATE,{phase})),profile:inspectCurrentProfile(await read(CURRENT_PROFILE,{phase,allowedFinalUrls:profileUrls}))}),first=await snapshot('initial'),last=await snapshot('closing'),closingMatches=stable(first)===stable(last)
 const evidence={status:'coverage-gap',surface:CURRENT_PROFILE,firstParty:true,listingComplete:false,pagesFetched:publicPages.length,reportedTotal:null,indiaFacetCount:null,verifiedAt,reason:'published-jobs-link-redirects-to-employer-announcements;vacancy-inventory-and-native-work-countries-unverified;keyword-no-match-is-not-zero-evidence'}
 await audit({verifiedAt,...first.profile,corporate:first.corporate,closingMatches,closingComparison:'native-employer-identity-and-complete-public-announcement-models',companyGlobalTotal:null,companyIndiaTotal:null,inventoryEvidence:evidence})
 if(!closingMatches)throw failure(COMPANY,'closing public employer announcements changed')
 if(first.profile.jobsLinks.length)throw failure(COMPANY,'a current public job board requires a native vacancy collector','PUBLIC_VACANCY_COLLECTOR_REQUIRED')
 const jobs=attachInventoryEvidence([],evidence)
 return attachSourceObservationEvidence(jobs,{source:'bootlabstechnologies',recordKind:'hiring-signals',observedRecordCount:first.profile.observations.length,observedVacancyCount:0,sourceScopeComplete:false})
})
