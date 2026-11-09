import {structure,hasClass,within,inner,htmlEscape,need,publicRead,stable,sha} from './publicRead.js'
import {projectRevealPolicy} from './revealPolicy.js'
import reviewedReveal from './reveal-policy-20261103.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const SOURCE='alohatechnology',COMPANY='Aloha Technology'
export const CURRENT_HOME='https://www.alohatechnology.com/',CURRENT_CAREERS=CURRENT_HOME+'careers.html',CURRENT_CLIENT=CURRENT_HOME+'assets/shared.js',EMAIL='hr@alohatechnology.com'
const one=(nodes,label)=>{need(nodes.length===1,COMPANY,'missing or ambiguous '+label);return nodes[0]}
export function inspectCurrentCareers(html){
 const s=structure(html),organizations=s.scripts.filter(n=>n.attrs.type==='application/ld+json').flatMap(n=>{try{return[JSON.parse(n.body)]}catch{return[]}})
 need(organizations.some(n=>n['@type']==='Organization'&&n.name===COMPANY&&n.url===CURRENT_HOME),COMPANY,'current first-party organization identity changed')
 need(s.visible(n=>n.tag==='a'&&n.attrs.href==='mailto:'+EMAIL).length>0,COMPANY,'current public recruiting email is absent')
 const cards=s.nodes.filter(n=>hasClass(n,'role-card'))
 need(cards.length>0,COMPANY,'no current native role-card inventory')
 return{s,cards}
}
export function extractCurrentCareerJobs(html){
 const {s,cards}=inspectCurrentCareers(html),jobs=cards.map(card=>{
  const title=one(within(card,n=>hasClass(n,'role-title')),'native role title'),experience=one(within(card,n=>hasClass(n,'role-exp')),'native experience'),body=one(within(card,n=>hasClass(n,'role-body-inner')),'native profile body'),skills=within(body,n=>n.tag==='li').map(n=>s.text(n))
  need(s.text(title)&&skills.length>0&&skills.every(Boolean),COMPANY,'empty native role criterion')
  const experienceRequired=s.text(experience).replace(/^Experience\s*:\s*/i,'')
  return{title:s.text(title),company:COMPANY,department:null,location:null,city:null,country:null,countryCode:null,jobId:null,requisitionId:null,sourceUrl:CURRENT_CAREERS,applyUrl:'mailto:'+EMAIL,employmentType:null,experienceRequired,minimumQualification:null,preferredQualification:null,requiredSkills:skills,postingDate:null,closingDate:null,remoteStatus:null,
   jobDescription:'<p>'+htmlEscape(s.text(experience))+'</p>'+inner(body),nativeCriteriaText:s.text(experience)+' '+s.text(body),nativeCriteriaHtml:inner(body),nativeCriteriaSha256:sha(inner(body)),nativeIdentity:{postingId:null,formalRequisitionId:null,kind:'native-public-role-card-without-published-ID'},sourceDetailComplete:false,fullNativeCriteriaAvailable:false}
 })
 need(new Set(jobs.map(j=>j.title)).size===jobs.length,COMPANY,'duplicate public titles without native posting identities')
 return jobs
}
export const runCurrentAloha=(options={})=>publicRead({source:SOURCE,company:COMPANY},options,async({read,stamp,audit,publicPages})=>{
 const cap=options.maxJobs??Infinity;need(cap===Infinity||Number.isSafeInteger(cap)&&cap>=0,COMPANY,'invalid caller cap')
 if(cap===0){
  const jobs=attachInventoryEvidence([],{status:'coverage-gap',surface:CURRENT_CAREERS,firstParty:false,listingComplete:false,pagesFetched:0,reportedTotal:null,indiaFacetCount:null,verifiedAt:null,reason:'caller-zero-cap-no-inventory-proof'})
  return attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:0,observedVacancyCount:0,sourceScopeComplete:false})
 }
 const verifiedAt=stamp()
 const snapshot=async phase=>{
  const home=structure(await read(CURRENT_HOME,{phase})),html=await read(CURRENT_CAREERS,{phase}),{s,cards}=inspectCurrentCareers(html)
  need(home.visible(n=>n.tag==='a'&&new URL(n.attrs.href||'#',CURRENT_HOME).href===CURRENT_CAREERS).length>0,COMPANY,'current corporate careers handoff changed')
  need(s.scripts.filter(n=>n.executable&&n.attrs.src&&new URL(n.attrs.src,CURRENT_CAREERS).href===CURRENT_CLIENT).length===1,COMPANY,'current executable public reveal client missing')
  const client=await read(CURRENT_CLIENT,{phase,kind:'javascript'}),policy=projectRevealPolicy(html,client),policyMatches=policy.errors.length===0&&stable(policy)===stable(reviewedReveal)
  const records=extractCurrentCareerJobs(html),hiddenCandidates=cards.some(card=>within(card,n=>n.inert&&['div','li','p'].includes(n.tag)).length>0)
  return{records,policy,policyMatches,hiddenCandidates,rawRoles:cards.map(card=>({title:s.text(within(card,n=>hasClass(n,'role-title'))[0]),html:inner(card)}))}
 }
 const first=await snapshot('initial'),closing=await snapshot('closing')
 need(stable(first)===stable(closing),COMPANY,'closing native criteria, identity, public reveal or role cohort changed')
 const criteriaComplete=first.policyMatches&&!first.hiddenCandidates,records=first.records.map(row=>({...row,jobDescription:criteriaComplete?row.jobDescription:null,sourceDetailComplete:false,sourceDetailFailureKind:criteriaComplete?'native-country-and-posting-identity-unavailable':'native-country-identity-and-criteria-unavailable',sourceCountryScopeUnresolved:true,fullNativeCriteriaAvailable:criteriaComplete,source:SOURCE,link:row.applyUrl,scrapedAt:verifiedAt,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,nativeVisibilityEvidence:{kind:'public-intersection-scroll-and-native-whole-body-click-reveal',qualified:criteriaComplete,flowContextMatches:first.policyMatches,missingNativeCountry:true,postingIdentityUnpublished:true}}))
 const evidence={status:'coverage-gap',surface:CURRENT_CAREERS,firstParty:publicPages.every(p=>p.status===200&&p.responseIdentity==='validated-public-response'),listingComplete:false,pagesFetched:publicPages.length,reportedTotal:null,indiaFacetCount:null,verifiedAt,reason:'native-public-role-cards;work-countries-and-posting-identities-unpublished'+(criteriaComplete?'':';public-criteria-visibility-context-unqualified')}
 await audit({verifiedAt,observations:records.map((r,i)=>({...r,kind:criteriaComplete?'native-public-role':'unqualified-native-role-markup',originalNativeRoleHtml:first.rawRoles[i].html})),observedNativeVacancies:criteriaComplete?records.length:null,fullNativeCriteriaRecords:criteriaComplete?records.length:0,closingReconciled:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,publicRevealPolicy:first.policy,criteriaVisibilityQualified:criteriaComplete,inventoryEvidence:evidence})
 const jobs=attachInventoryEvidence(criteriaComplete?records.slice(0,cap):[],evidence)
 return attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:criteriaComplete?'vacancy-rows':'mixed',observedRecordCount:records.length,observedVacancyCount:criteriaComplete?records.length:0,sourceScopeComplete:false})
})
