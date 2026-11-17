import {readFileSync} from 'node:fs'
import {isDeepStrictEqual} from 'node:util'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {createCurrentReader,need} from './currentRead20261117.js'
const JOBS='https://skill-lync.com/careers/jobs',HOME='https://skill-lync.com/',ABOUT=HOME+'about',profile=JSON.parse(readFileSync(new URL('./reviewedCurrent20261117.json',import.meta.url))),programmes=profile.documents.filter(p=>p.url.endsWith('.js')),holds=['catalog-jobs-route-now-redirects-to-education-publisher-homepage','placement-records-course-targets-and-learner-profession-options-are-not-employer-vacancies','reviewed-current-publisher-subset-not-complete-native-or-company-inventory','country-role-criteria-application-and-employer-hiring-scope-unknown']
export async function runCurrentSkillLync(options={}){
 const io=createCurrentReader(options,[[JOBS,'redirect'],[HOME,'html'],[ABOUT,'html'],...programmes.map(p=>[p.url,'js'])],{maxReads:12,redirects:{[JOBS]:{status:301,target:'/'}}})
 try{
  const acquire=async()=>{
   const redirect=await io.read(JOBS);need(redirect.status===301&&redirect.location==='/'&&redirect.sha256===profile.documents[0].sha256,'exact native jobs301-to-home changed')
   const home=await io.read(HOME),doc=readNativeDocument(home.text)
   need(isDeepStrictEqual(activeHead(home.text).titles,['Skill-Lync — Industry-Ready Engineering Courses in CAE, CFD, EV & Embedded'])&&doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'&&n.attrs.href===HOME).length===1&&!doc.nodes(n=>n.tag==='base').length,'current education publisher identity changed')
   need(doc.nodes(n=>n.tag==='a'&&n.attrs.href==='/about').length>0&&!doc.nodes(n=>n.tag==='a'&&/^(?:careers|work with us|join our team)$/i.test(doc.text(n))).length,'current publisher recruitment/About declarations changed')
   const declared=doc.nodes(n=>n.tag==='script'&&n.attrs.src).map(n=>new URL(n.attrs.src,HOME).href);need(isDeepStrictEqual(declared,programmes.map(p=>p.url)),'complete current declared education programme cohort changed')
   const about=await io.read(ABOUT),ad=readNativeDocument(about.text),body=ad.nodes(n=>n.tag==='body').map(ad.text).join(' ')
   need(body.includes('Skill-Lync is an online engineering education company')&&body.includes('Skill-Lync is run by EpowerX Learning Technologies Private Limited.')&&!ad.nodes(n=>n.tag==='base').length&&!ad.nodes(n=>n.tag==='a'&&/^(?:careers|work with us|join our team)$/i.test(ad.text(n))).length,'current declared About/hiring authority changed')
   const programs=[];for(const p of programmes){const original=await io.read(p.url);need(original.sha256===p.sha256,'complete reviewed education/learner programme changed');programs.push({url:p.url,body:original.text})}
   return {redirect:{url:JOBS,status:redirect.status,location:redirect.location,body:redirect.text},home:{url:HOME,body:home.text},about:{url:ABOUT,body:about.text},programmes:programs}
  }
  const opening=await acquire(),closing=await acquire(),equal=isDeepStrictEqual(opening,closing);io.check()
  const currentHolds=equal?holds:[...holds,'whole-raw-publisher-opening-closing-differs-no-inventory-or-publication-promotion']
  const jobs=attachInventoryEvidence([],{status:'discovery-only',surface:JOBS,firstParty:true,listingComplete:false,pagesFetched:io.stats().requests,reportedTotal:null,indiaFacetCount:null,lifecycleCleanupAllowed:false,verifiedAt:new Date().toISOString(),reason:currentHolds.join('; ')})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{source:'skilllync',sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,observedEmployerVacancyCount:null,fullNativeClosingEqual:equal,allRawDifferencesRemainUnqualified:!equal,originalModels:{opening,closing},holds:currentHolds,acquisition:io.stats()},configurable:true});io.check();return jobs
 }finally{io.close()}
}
