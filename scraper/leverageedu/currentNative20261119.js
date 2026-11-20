import {readFileSync} from 'node:fs'
import {isDeepStrictEqual} from 'node:util'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {createCurrentReader} from './currentRead20261119.js'

const SOURCE='leverageedu',HOME='https://leverageedu.com/',CAREERS=HOME+'work-with-us/',ORGANIZATION=HOME+'#organization'
const profile=JSON.parse(readFileSync(new URL('./reviewedCurrent20261119.json',import.meta.url),'utf8'))
const need=(ok,message)=>{if(!ok)throw firstPartyFailure(SOURCE,message)}
const cap=(value,label)=>{if(value===undefined)return Infinity;need(Number.isSafeInteger(value)&&value>=0,'invalid '+label);return value}
const roleURL=url=>/^https:\/\/leverageedu\.com\/work-with-us\/job-details\/?\?id=[1-9]\d{0,8}$/.test(url)
const allowed=(url,kind)=>kind==='javascript'?profile.programs.some(p=>p.url===url):kind==='json'?url===profile.apiURL:kind==='application'?roleURL(url):[HOME,CAREERS].includes(url)
const publicKeys=['career_id','job_roles','job_description','status','category','last_date','created_at','min_salary','max_salary','job_location','job_level','job_type']
const publicRole=row=>Object.fromEntries(publicKeys.filter(key=>Object.hasOwn(row,key)).map(key=>[key,row[key]]))
const parseCareers=html=>{
 const d=readNativeDocument(html),models=d.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').flatMap(n=>{const model=JSON.parse(n.raw);return Array.isArray(model)?model:[model]})
 const organizations=models.filter(m=>m['@type']==='Organization'),lists=models.filter(m=>m['@type']==='ItemList'),roles=models.filter(m=>m['@type']==='JobPosting')
 need(organizations.length===1&&organizations[0]['@id']===ORGANIZATION&&organizations[0].name==='Leverage Edu'&&organizations[0].url===HOME,'current native employer identity changed')
 need(lists.length===1&&lists[0]['@id']===CAREERS+'#itemlist','native ItemList identity changed')
 const list=lists[0];need(Array.isArray(list.itemListElement)&&list.numberOfItems===list.itemListElement.length&&list.numberOfItems>0&&list.numberOfItems<=18&&roles.length===list.numberOfItems,'native role enumeration changed')
 need(new Set(list.itemListElement.map(r=>r.url)).size===roles.length&&list.itemListElement.every((r,i)=>r['@type']==='ListItem'&&r.position===i+1&&roleURL(r.url)&&new URL(r.url).pathname.endsWith('/')),'native role links changed')
 const declared=d.nodes(n=>n.tag==='script'&&n.attrs.src).map(n=>new URL(n.attrs.src,CAREERS).href)
 need(profile.programs.every(p=>declared.includes(p.url)),'reviewed native programme declaration changed')
 return {organization:organizations[0],list,roles}
}
export async function runCurrentLeverageEdu(options={}){
 const maxJobs=cap(options.maxJobs,'job cap'),maxPages=cap(options.maxPages,'page cap'),io=createCurrentReader(options,allowed)
 let audit={source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:0,observedVacancyCount:0,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,heldRecords:[],fullPublicModelsClosingReconciled:false,lastDateSemanticsQualified:false,applicationInteractions:0,publisherProgramsExecuted:false}
 const finish=()=>{const jobs=[];attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS,firstParty:io.stats().requests>0,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:io.stats().requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:typeof options.now==='function'?options.now():new Date().toISOString(),reason:maxJobs===0||maxPages===0?'caller-zero-cap-no-inventory-proof':'native-listed-roles-with-unavailable-mandatory-application-handoff'});attachSourceObservationEvidence(jobs,audit);Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{...audit,transport:io.stats()},configurable:true});return jobs}
 try{
  if(maxJobs===0||maxPages===0)return finish()
  const phase=async name=>{
   const home=readNativeDocument((await io.read(HOME,{phase:name})).text);need(home.nodes(n=>n.tag==='a'&&new URL(n.attrs.href??'',HOME).href===CAREERS).length>0,'own homepage careers link changed')
   const schema=parseCareers((await io.read(CAREERS,{phase:name})).text),programs=[]
   for(const p of profile.programs){const program=await io.read(p.url,{phase:name,kind:'javascript'});need(program.sha256===p.sha256,'reviewed native programme changed');programs.push({url:p.url,sha256:program.sha256})}
   const api=JSON.parse((await io.read(profile.apiURL,{phase:name,kind:'json'})).text)
   need(api?.meta?.status===true&&api.meta.code===200&&Array.isArray(api.data)&&api.data.length<=18,'current native API envelope changed')
   const rows=api.data.flatMap(group=>{need(typeof group.category==='string'&&Array.isArray(group.jobs)&&group.jobs.length<=18&&Object.keys(group).every(k=>['category','jobs'].includes(k)),'native category model changed');return group.jobs.map(row=>{need(row&&row.category===group.category&&Object.keys(row).every(k=>[...publicKeys,'created_by'].includes(k)),'native category binding or public record contract changed');return publicRole(row)})})
   need(rows.length===schema.roles.length&&new Set(rows.map(r=>r.career_id)).size===rows.length,'native API and ItemList identity/count changed')
   const records=[]
   for(const [i,item]of schema.list.itemListElement.entries()){
    const id=Number(new URL(item.url).searchParams.get('id')),row=rows.find(r=>r.career_id===id),role=schema.roles[i]
    need(row&&Number.isSafeInteger(row.career_id)&&row.career_id>0&&typeof row.job_roles==='string'&&row.job_roles===role.title&&row.category===role.occupationalCategory&&item.name===`${row.job_roles} – ${row.category}, ${row.job_location}`,'native per-role identity binding changed')
    need(role.hiringOrganization?.['@id']===ORGANIZATION,'native per-role employer changed')
    const address=role.jobLocation?.address;need(address?.addressLocality===row.job_location&&typeof address.addressCountry==='string','native per-role country or workplace binding changed')
    const clientURL=CAREERS+'job-details?id='+String(row.career_id),redirect=await io.read(clientURL,{phase:name,kind:'application',allowedStatuses:[308]})
    need(new URL(redirect.headers.location,clientURL).href===item.url,'native application redirect changed')
    const application=await io.read(item.url,{phase:name,kind:'application',allowedStatuses:[500]})
    records.push({nativeID:row.career_id,title:row.job_roles,nativeCountry:address.addressCountry,nativeWorkplace:structuredClone(role.jobLocation),nativeRecord:row,nativeJobPosting:role,nativeListItem:item,fullCriteriaRecovered:typeof row.job_description==='string'&&row.job_description.length>0&&row.job_description===role.description,application:{nativeClientURL:clientURL,nativeURL:item.url,redirectStatus:redirect.status,location:redirect.headers.location,status:application.status,bodySHA256:application.sha256},reason:'native-application-upstream-unavailable'})
   }
   return {schema,programs,apiMeta:api.meta,nativeCategories:api.data.map(g=>g.category),rows,records}
  }
  const opening=await phase('opening'),closing=await phase('closing')
  // Full public schema, API projection and declared programs must agree. Error
  // pages carry host request IDs, so their raw bytes are retained per receipt;
  // no closing equality or live application form is asserted for those pages.
  const model=p=>({schema:p.schema,programs:p.programs,apiMeta:p.apiMeta,nativeCategories:p.nativeCategories,rows:p.rows})
  need(isDeepStrictEqual(model(opening),model(closing)),'full native public models changed at closing')
  audit={...audit,observedRecordCount:opening.records.length,observedVacancyCount:opening.records.length,heldRecords:opening.records.map((r,i)=>({...r,closingApplication:closing.records[i].application})),fullPublicModelsClosingReconciled:true,wholeApplicationModelClosingReconciled:false,allEndpointFieldsInterpreted:false,nativeLastDateSemantics:profile.lastDateSemantics}
  return finish()
 }catch(error){io.check();if(error&&typeof error==='object'&&Object.isExtensible(error))error.sourceAudit={...audit,transport:io.stats()};throw error}finally{io.close()}
}
