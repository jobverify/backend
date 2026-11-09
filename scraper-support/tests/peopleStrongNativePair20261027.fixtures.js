import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'

import {getScraperCatalog,createCatalogScraper} from '../providers/index.js'
const parts='basic,organisational,descriprion,workflow,skill,qualification,certification,language,applied'
const programs=JSON.parse(gunzipSync(readFileSync(new URL('../../test/test-data/recruitmentGoal20261106/peoplestrong-current-clients.json.gz',import.meta.url))))

// SYNTHETIC roles using retained native field/protocol shapes. These responses
// are regression scenarios, not evidence of currently advertised postings.
// Executable bodies are the genuine retained current programs for both
// configured tenants; surrounding HTTP and role records remain synthetic.
export function scenario(source='amararajaenergymobility',change={}){
 const amara=source==='amararajaenergymobility',origin=amara?'https://amararajacareers.peoplestrong.com':'https://anthemhrcp.peoplestrong.com',base=origin+'/api/cp/rest/altone/cp/',employer=amara?'Amara Raja Energy & Mobility Limited':'Anthem Biosciences'
 const listing={jobCode:'P-9001',requisitionId:null,jobTitle:'Engineer - Native Regression',organizationUnit:employer,organizationUnitComplete:(amara?'Amara Raja Group>':'')+employer+'>Engineering',jobDetailUrl:origin+'/job/detail/P-9001',jobPostedDate:'2026-10-21',jobClosureDate:'2026-11-30',entityID:339,hrOrgUnitID:234,worksiteID:123,locationHierarchy:'Worksite',locationHierarchyComplete:'Asia>India>Karnataka>Bangalore>Worksite',skills:{mustTohave:['PREVIEW ONLY']},jobDescription:'PREVIEW ONLY'}
 const detail={requisitionCode:'P-9001',requisitionId:'1800001',jobTitle:listing.jobTitle,entityID:'339',hrOrgUnitID:'234',worksiteID:'123',organizationUnitComplete:listing.organizationUnitComplete,requisitionStatus:'OPEN',CandidatePortalStartDate:'2026-10-21 00:00:00.0',CandidatePortalEndDate:'2026-11-30 00:00:00.0',jobDescription:'<p>Full native responsibilities &amp; safety.</p><p hidden>HIDDEN CRITERIA</p><template>INERT CRITERIA</template>',internalJobDescription:'PRIVATE INTERNAL DESCRIPTION',qualifications:['B.Tech','Safety diploma'],skills:[{text:'Process safety',mandatory:true},{text:'CAD',mandatory:false}],certifications:['Safety certificate'],languages:['English'],minimumExp:'2',maximumExp:'5',employmentType:'Permanent',employmentTenureType:'Full time',roleType:'Individual Contributor',Onsite:'Yes'}
 const org={industry:'Manufacturing',functionalArea:'Engineering',role:'Process Engineering',orgUnitHierarchy:[...(amara?[{orgUnitType:'Group',orgUnitName:'Amara Raja Group'}]:[]),{orgUnitType:'Company Name',orgUnitName:employer},{orgUnitType:'Department',orgUnitName:'Engineering'}],workSiteHierarchy:[{orgUnitType:'Working location',orgUnitName:'Worksite'},{orgUnitType:'Town',orgUnitName:'Bangalore'},{orgUnitType:'State',orgUnitName:'Karnataka'},{orgUnitType:'Country',orgUnitName:'India'}]}
 change.mutate?.({listing,detail,org})
 const total=change.empty?0:change.copies??1
 const listings=Array.from({length:total},(_,index)=>index===0?listing:{...structuredClone(listing),jobCode:'P-'+(9001+index),jobDetailUrl:origin+'/job/detail/P-'+(9001+index)})
 const calls=[],envelope=response=>JSON.stringify({messageCode:{code:200,messages:'success'},response})
 const fetchPage=async(url,init={})=>{
  calls.push({url,method:init.method??'GET',body:init.body})
  if(change.deny===url)return{status:403,url,body:'Access denied'}
  let body,status=200
  if(url==='https://amararaja.com/amara-raja-energy-and-mobility-ltd/')body='<title>Amara Raja Energy &amp; Mobility</title><a href="//www.amararajaeandm.com">Company</a><a href="https://amararaja.com/careers/">Careers</a>'
  else if(url==='https://www.amararajaeandm.com')body='<title>Amara Raja Energy &amp; Mobility Limited</title><a href="'+(change.exactEmployerDelegation===false?'https://www.amararaja.com/careers/obsolete':'https://amararaja.com/careers/')+'">Careers</a>'
  else if(url==='https://amararaja.com/careers/')body='<title>Careers - Amara Raja Group</title><a href="https://amararajacareers.peoplestrong.com/home">Open roles</a>'
  else if(url==='https://anthembio.com/')body='<title>Anthem - Home - Anthem</title><link rel="canonical" href="https://anthembio.com/"><img alt="Anthem Biosciences Logo"><a href="https://anthembio.com/careers/">Careers</a>'
  else if(url==='https://anthembio.com/careers/')body='<title>Careers - Anthem</title><link rel="canonical" href="https://anthembio.com/careers/"><img alt="Anthem Biosciences Logo"><p>We are not just following the science, we are leading it. We need YOU. Wealth Creation Opportunity</p><a href="https://anthemhrcp.peoplestrong.com/">Open Positions ('+(change.corporateCount??total)+')</a>'
  else if(url===origin+(amara?'/home':'/')){status=amara?404:200;body='<title>Candidate Portal</title><app-root data-testid="src-index-app-root-page-1"></app-root><script src="main-PUBLIC123.js"></script><!-- candidate-portal -->'}
  else if(url===origin+'/main-PUBLIC123.js')body=programs.main
  else if(url===origin+'/chunk-MP77JDEN.js')body=programs.job
  else if(url===origin+'/chunk-ZKMRUQJB.js')body=programs.filter
  else if(url===origin+'/chunk-IFMVPRQ7.js')body=programs['import-1']
  else if(url===base+'urlinfo')body=envelope({url:new URL(origin).hostname})
  else if(url===base+'layout?isPreview=false')body=envelope([{heading:amara?'Amara Raja Group':'Anthem Biosciences'}])
  else if(url.startsWith(base+'jobs/v1?')){assert.equal(init.method,'POST');assert.equal(init.body,'{}');const offset=Number(new URL(url).searchParams.get('offset'));body=JSON.stringify({messageCode:{code:200},totalRecords:total,response:offset===0&&listings.length?listings:null})}
  else if(url===base+'job/P-9001/v2?part='+parts+'&isReqId=false')body=envelope(detail)
  else if(url===base+'job/organizationDetails?jobCode=P-9001')body=envelope(org)
  else if(listings.slice(1).some(row=>url===base+'job/'+row.jobCode+'/v2?part='+parts+'&isReqId=false')){
   const index=listings.findIndex(row=>url===base+'job/'+row.jobCode+'/v2?part='+parts+'&isReqId=false')
   body=envelope({...structuredClone(detail),requisitionCode:listings[index].jobCode,requisitionId:String(1800001+index)})
  }
  else if(listings.slice(1).some(row=>url===base+'job/organizationDetails?jobCode='+row.jobCode))body=envelope(org)
  else throw Error('Unexpected offline URL '+url)
  return{url,status,body,html:body}
 }
 return{source,origin,base,listing,detail,org,calls,fetchPage,fetchJson:async()=>({totalRecords:total,response:listings.length?listings:null})}
}
export async function registered(s,options={}){
 let report
 const provider=getScraperCatalog().find(p=>p.source===s.source)
 const jobs=await createCatalogScraper(provider).run({fetchPage:s.fetchPage,fetchJson:s.fetchJson,now:'2026-10-27T06:00:00Z',onReport:r=>{report=r},...options})
 return{jobs,report}
}

