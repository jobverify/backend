import {readFileSync} from 'node:fs'
import {isDeepStrictEqual} from 'node:util'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {createCurrentReader,need} from './currentRead20261117.js'
import {readNativeCmsChunk} from './currentBinary20261117.js'
const HOME='https://innspark.in/',PUBLISHER='https://www.innspark.in/',CAREERS=PUBLISHER+'career',profile=JSON.parse(readFileSync(new URL('./reviewedCurrent20261117.json',import.meta.url)))
const text=value=>String(value).replace(/\s+/g,' ').trim(),holds=['current-vacancy-employer-and-rendered-application-contract-unqualified','native-CMS-criteria-title-date-and-Link-fields-require-review','Framer-programme-dependency-closure-and-complete-company-scope-unqualified']
const roleURL=url=>{const p=new URL(url);return p.origin===new URL(PUBLISHER).origin&&/^\/career\/jobs\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.pathname)&&!p.search&&!p.hash}
function publisher(html,career){
 const doc=readNativeDocument(html),expected=career?CAREERS:PUBLISHER
 need(isDeepStrictEqual(activeHead(html).titles,[career?'Careers at Innspark | Build the Future with Us':'Innspark | Deeptech for Modern Enterprises'])&&!doc.nodes(n=>n.tag==='base').length,'current publisher identity/base changed')
 need(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'&&n.attrs.href===expected).length===1,'current own publisher canonical changed')
 if(!career)need(doc.nodes(n=>n.tag==='a'&&n.attrs.href==='./career'&&doc.text(n)==='Careers').length>0,'own declared careers route changed')
 else need(doc.nodes(n=>n.tag==='a'&&n.attrs.href==='./career#job').length>0,'own intake application declaration changed')
 return doc
}
function intake(doc){
 const forms=doc.nodes(n=>n.tag==='form');need(forms.length===1&&forms[0].attrs.method==='post'&&Object.hasOwn(forms[0].attrs,'data-framer-form'),'unique current general intake form changed')
 const form=forms[0],selectPreferences=doc.nodes(n=>n.tag==='select',form).map(n=>({attributes:n.attrs,options:doc.nodes(o=>o.tag==='option',n).map(o=>({attributes:o.attrs,text:doc.text(o)}))}))
 need(selectPreferences.length===2,'current intake preference fields changed')
 return {nativeId:null,sourceURL:CAREERS,recordKind:'general-application-intake',form,selectPreferences,applicantCityIsJobCountry:false,actualVacancyIdentityQualified:false}
}
function detail(html,row,url){
 const doc=readNativeDocument(html),f=row.fields,main=doc.nodes(n=>n.attrs.id==='main'),canonicals=doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical')
 need(!doc.nodes(n=>n.tag==='base').length&&canonicals.length===1&&canonicals[0].attrs.href===url&&main.length===1,'native detail canonical/carrier changed')
 const hydration=JSON.parse(main[0].attrs['data-framer-hydrate-v2']);need(hydration.routeId==='Nu3ghg3LN'&&hydration.localeId==='default'&&hydration.collectionItemId===f.id.value&&isDeepStrictEqual(hydration.pathVariables,{zwl5iu4RM:f.zwl5iu4RM.value}),'native CMS/detail identity binding changed')
 for(const key of ['jJ2myMsNq','PXYVfHs7p','jIhhvY0m2'])need(f[key]?.type===12&&f[key].value.trim(),'native complete CMS criteria field changed')
 const headings=doc.nodes(n=>n.tag==='h1').map(n=>doc.text(n)),body=doc.text(doc.nodes(n=>n.tag==='root')[0]);need(headings.length>0&&headings.every(h=>h===f.jJ2myMsNq.value)&&body.includes(text(f.PXYVfHs7p.value))&&body.includes(text(f.jIhhvY0m2.value)),'native detail title/location/complete description differs from own CMS row')
 need(f.T7avTTsmp?.type===11&&typeof f.T7avTTsmp.value==='string'&&Array.isArray(JSON.parse(f.T7avTTsmp.value))&&f.ZVE2y6Xas?.type===11&&typeof f.ZVE2y6Xas.value==='string'&&Array.isArray(JSON.parse(f.ZVE2y6Xas.value)),'native complete rich-text criteria unavailable')
 const forms=doc.nodes(n=>n.tag==='form'),applicationDeclarations=doc.nodes(n=>n.tag==='a'&&n.attrs.href&&doc.text(n).replace(/\s/g,'').toLowerCase()==='applynow').map(n=>({attributes:n.attrs,text:doc.text(n)}))
 need(forms.length>0&&applicationDeclarations.length>0,'current detail application carrier unavailable')
 return {nativeId:f.id.value,nativeSlug:f.zwl5iu4RM.value,nativePublishedTitle:f.jJ2myMsNq.value,nativePublishedLocation:f.PXYVfHs7p.value,nativePublishedDescription:f.jIhhvY0m2.value,nativeListedOn:f.tSjhve7ND?.value??null,nativeLink:f.Yyex_Qyg5?.value??null,rawNativeRecord:row,hydration,sourceURL:url,nativeApplicationForms:forms,nativeApplicationDeclarations:applicationDeclarations,country:null,city:null,location:null,jobDescription:null,postingDate:null,sourceEmployerQualified:false,sourceDetailComplete:false,holds}
}
export async function runCurrentInnspark(options={}){
 const admitted=[[HOME,'html'],...profile.documents.map(p=>[p.url,p.kind]),...profile.nativeBinaryCarriers.map(p=>[p.url,'binary'])],io=createCurrentReader(options,admitted,{maxReads:100,redirects:{[HOME]:{status:308,target:PUBLISHER}},roleURL})
 try{
  const acquire=async()=>{
   const redirect=await io.read(HOME);need(redirect.status===308&&redirect.location===PUBLISHER&&redirect.sha256===profile.redirects[0].sha256,'exact current308 publisher handoff changed')
   const originals=[{url:HOME,status:redirect.status,location:redirect.location,body:redirect.text}];let intakeForm
   for(const [i,p]of profile.documents.entries()){
    const page=await io.read(p.url);need(page.sha256===p.sha256,'current complete publisher/programme profile changed')
    if(i<2){const doc=publisher(page.text,i===1);if(i===1)intakeForm=intake(doc)}
    originals.push({url:p.url,body:page.text})
   }
   let nativeRows
   for(const p of profile.nativeBinaryCarriers){const page=await io.read(p.url);originals.push({url:p.url,bodyBase64:page.bytes.toString('base64')});if(p.url.includes('-chunk-'))nativeRows=readNativeCmsChunk(page.bytes)}
   need(Array.isArray(nativeRows),'complete native CMS chunk unavailable');const records=[]
   for(const row of nativeRows){const url=PUBLISHER+'career/jobs/'+row.fields.zwl5iu4RM.value;io.allowNativeDetail(url);const page=await io.read(url);originals.push({url,body:page.text});records.push(detail(page.text,row,url))}
   return {originals,nativeRows,nativeCmsRecords:records,intakeForms:[intakeForm]}
  }
  const opening=await acquire(),closing=await acquire();need(isDeepStrictEqual(opening,closing),'whole native publisher/programme/criteria/form/CMS closing changed');io.check()
  let jobs=attachInventoryEvidence([],{status:'discovery-only',surface:CAREERS,firstParty:true,listingComplete:false,pagesFetched:io.stats().requests,reportedTotal:null,indiaFacetCount:null,lifecycleCleanupAllowed:false,verifiedAt:new Date().toISOString(),reason:'Current general intake and published CMS records are unqualified hiring observations; '+holds.join('; ')})
  jobs=attachSourceObservationEvidence(jobs,{source:'innspark',recordKind:'hiring-signals',observedRecordCount:opening.nativeCmsRecords.length+opening.intakeForms.length,observedVacancyCount:0,sourceScopeComplete:false})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{source:'innspark',recordKind:'hiring-signals',observedRecordCount:opening.nativeCmsRecords.length+opening.intakeForms.length,observedVacancyCount:0,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,fullNativeClosingEqual:true,nativeCmsRecords:opening.nativeCmsRecords,intakeForms:opening.intakeForms,unqualifiedWholeProgrammeDependencyClosure:true,originalModels:{opening,closing},holds,acquisition:io.stats()},configurable:true});return jobs
 }finally{io.close()}
}
