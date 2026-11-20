import {readFileSync} from 'node:fs'
import {isDeepStrictEqual} from 'node:util'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {nativeCountryName,nativeLocationCountryName,nativeDate} from '../../scraper-support/shared/nativeJobPosting.js'
import {findExplicitNativeClosure} from '../../scraper-support/utils/sourceAvailability.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {createCurrentReader} from './currentRead20261120.js'
import {declaredCmsPrograms,readCmsProtocol} from './currentProtocol20261120.js'

const SOURCE='cmscomputers',HOME='https://www.cms.com/',CAREERS=HOME+'careers.php',CURRENT_CAREERS=HOME+'careers'
const profile=JSON.parse(readFileSync(new URL('./reviewedCurrent20261120.json',import.meta.url),'utf8'))
const API=profile.nativeAPIOrigin,common='career_site%5Baccount_slug%5D=cms&career_site%5Bbrand_id%5D='+profile.brandID
const CONFIG=API+'/internal_api/career_site/brands/configuration?'+common+'&career_site%5Blocale%5D=en-US'
const openingsURL=page=>API+'/internal_api/career_site/openings?'+common+'&career_site%5Bis_jobs_from_current_location%5D=true&page='+page+'&radius=any&sort_by=title&category=any&compensation_type=any&location=current_location&locale=en-US'
const locationsURL=page=>API+'/internal_api/career_site/locations?'+common+'&page='+page+'&per_page=50'
const formURL=slug=>API+'/internal_api/portal/cms/application_forms/new?funnel_id='+slug
const need=(ok,message)=>{if(!ok)throw firstPartyFailure(SOURCE,message)}
const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(s)
const cap=(value,label)=>{if(value===undefined)return Infinity;need(Number.isSafeInteger(value)&&value>=0,'invalid '+label);return value}
const slugOf=row=>{const prefix=API+'/cms/apply/';need(typeof row.apply_url==='string'&&row.apply_url.startsWith(prefix)&&/^[a-zA-Z0-9_-]{1,200}$/.test(row.apply_url.slice(prefix.length)),'native role application handoff left the configured account');return row.apply_url.slice(prefix.length)}
const allowed=(url,kind,programs)=>{
 if(kind==='javascript')return programs.has(url)
 if(kind==='html')return[HOME,CAREERS,CURRENT_CAREERS,profile.legacyBoard,profile.currentBoard].includes(url)||/^https:\/\/hire\.rekrutek\.ai\/cms\/apply\/[a-zA-Z0-9_-]{1,200}$/.test(url)||/^https:\/\/apply\.rekrutek\.ai\/apply\/cms\/opening\/[a-zA-Z0-9_-]{1,200}$/.test(url)
 if(kind!=='json')return false
 if(url===CONFIG)return true
 try{const u=new URL(url),p=Number(u.searchParams.get('page'));return Number.isSafeInteger(p)&&p>0&&p<=100&&(url===openingsURL(p)||p<=10&&url===locationsURL(p))||u.origin===API&&u.pathname==='/internal_api/portal/cms/application_forms/new'&&/^[a-zA-Z0-9_-]{1,200}$/.test(u.searchParams.get('funnel_id')??'')&&url===formURL(u.searchParams.get('funnel_id'))}catch{return false}
}
const countryOf=address=>{
 const country=nativeLocationCountryName(address);if(!country)return null
 // Written country alternatives must all agree; postal state abbreviations
 // are not interpreted as ISO country labels.
 for(const part of String(address).split(/[,;/|&]|\s+and\s+/i)){const text=part.trim();if(text.length<=2)continue;const other=nativeCountryName(text);if(other&&other!==country)return null}
 return country
}
const scopedConstraints=(row,funnel,now)=>{
 const dates={publications:[],expiries:[]},description=typeof funnel?.position_description_html==='string'?funnel.position_description_html:null
 const d=readNativeDocument(description??''),text=d.text(d.nodes(n=>n.tag==='root')[0]),norm=s=>String(s??'').replace(/\s+/g,' ').trim()
 if(findExplicitNativeClosure([text]))return{qualified:false,reason:'native-role-authored-description-explicitly-closed',dates,description}
 let reason=null
 const constraint=(rawLabel,value)=>{
  const label=norm(rawLabel.replace(/([a-z])([A-Z])/g,'$1 $2').replaceAll('_',' '));if(value===null||value===undefined||value==='')return
  if(/^(?:status|job status|publication status|availability)$/i.test(label)&&!/^(?:open|active|published|available)$/i.test(String(value)))reason='native-role-authored-publication-status-conflict'
  if(/^(?:(?:job|work|workplace)\s+)?country$/i.test(label)&&nativeCountryName(value)!=='India')reason='native-role-authored-country-conflict'
  if(/^(?:(?:job|work)\s+)?(?:workplace|location)$/i.test(label)&&typeof value==='string'){const country=countryOf(value);if(country&&country!=='India')reason='native-role-authored-workplace-conflict'}
  if(/^(?:company|company name|employer|legal employer|hiring organization)$/i.test(label)&&!/^(?:CMS|CMS INFO SYSTEMS(?: (?:LIMITED|LTD\.?))?)$/i.test(norm(value)))reason='native-role-authored-employer-conflict'
  const expiry=/^(?:closing date|application deadline|valid through|expiry date|expiration date)$/i.test(label),publication=/^(?:date posted|posted date|publication date|published date|posting date)$/i.test(label)
  if(expiry||publication){try{const date=nativeDate(value,{required:true});if(expiry&&(date.exact?Date.parse(date.iso)<Date.parse(now):date.iso.slice(0,10)<now.slice(0,10)))reason='native-role-authored-expired';if(publication&&Date.parse(date.iso)>Date.parse(now))reason='native-role-authored-publication-in-future';dates[expiry?'expiries':'publications'].push({label,...date})}catch{reason='native-role-authored-date-unqualified'}}
 }
 for(const [label,value]of Object.entries(row))constraint(label,value)
 for(const [label,value]of Object.entries(funnel??{}))constraint(label,value)
 for(const n of d.nodes(n=>['p','li','div','h1','h2','h3','h4','strong','b','td','dd'].includes(n.tag))){const value=norm(d.text(n)),match=/^([^:]{1,40})\s*:\s*(.+)$/.exec(value);if(match)constraint(match[1],match[2])}
 for(const values of Object.values(dates))values.sort((a,b)=>a.iso.localeCompare(b.iso))
 return{qualified:reason===null,reason,dates,description}
}
const documentModel=(html,from,target,title)=>{
 const d=readNativeDocument(html),titles=d.nodes(n=>n.tag==='title').map(n=>n.raw)
 need(!d.nodes(n=>n.tag==='base').length&&titles.length===1&&title.test(titles[0]),'current own CMS publisher identity changed')
 need(d.nodes(n=>n.tag==='a'&&n.attrs.href).some(n=>{try{return new URL(n.attrs.href,from).href===target}catch{return false}}),'current own CMS careers declaration changed')
 return{title:titles[0],declaredTarget:target}
}
const mediaIdentity=value=>{
 if(typeof value!=='string')return value
 try{const url=new URL(value);if(url.origin==='https://rekrutek-production-uploads-560576350398.s3.ap-south-1.amazonaws.com'&&url.pathname.startsWith('/uploads/accounts/brand/')&&[...url.searchParams.keys()].every(k=>['X-Amz-Expires','X-Amz-Date','X-Amz-Security-Token','X-Amz-Algorithm','X-Amz-Credential','X-Amz-SignedHeaders','X-Amz-Signature'].includes(k)))return url.origin+url.pathname}catch{}
 return value
}
const publicClosingModel=phase=>{
 const model=structuredClone(phase)
 for(const key of['logo_url','banner_url'])model.configuration[key]=mediaIdentity(model.configuration[key])
 for(const form of Object.values(model.forms))if(form.model?.brand?.logos)for(const key of['square_image_url','image_url'])form.model.brand.logos[key]=mediaIdentity(form.model.brand.logos[key])
 delete model.boardShellSHA256;delete model.representative.shellSHA256
 model.programs=model.programs.map(({kind,surface,protocol})=>({kind,surface,protocol})).sort((a,b)=>(a.surface+':'+a.kind).localeCompare(b.surface+':'+b.kind))
 return model
}
const pagination=(payload,page,rowsKey,maxPages)=>{
 const p=payload?.pagination;need(Array.isArray(payload?.[rowsKey])&&p&&p.current_page===page&&Number.isSafeInteger(p.total_pages)&&p.total_pages>=1&&p.total_pages<=maxPages&&Number.isSafeInteger(p.total_count)&&p.total_count>=0&&p.total_count<=1000&&p.per_page===(rowsKey==='openings'?10:50)&&p.next_page===(page<p.total_pages?page+1:null),'native '+rowsKey+' pagination contract changed');return p
}
const locationRecord=(row,locations,configuration)=>{
 const records=locations.filter(l=>l.name===row.location)
 if(records.length!==1)return null
 const record=records[0],configRows=configuration.locations.filter(l=>l.key===record.id)
 return uuid(record.id)&&configRows.length===1&&configRows[0].label===record.name&&countryOf(record.title)?record:null
}
const qualifyForm=(row,response,configuration,lookup=null)=>{
 if(response.status!==200)return{qualified:false,reason:'native-role-form-unapproved',country:null}
 const m=response.model,f=m?.funnel,brand=m?.brand,account=m?.account,slug=slugOf(row)
 if(!m||account?.external_id!==profile.accountID||account.name!=='CMS'||account.account_type!=='active'||brand?.external_id!==profile.brandID||brand.name!=='CMS'||brand.slug!=='cms')return{qualified:false,reason:'native-form-employer-or-brand-conflict',country:null}
 if(!f||f.external_id!==row.id||f.slug!==slug||f.title!==row.title||f.application_form_title!==row.title||f.active!==true||f.location?.name!==row.location||!uuid(f.location?.external_id))return{qualified:false,reason:'native-form-identity-publication-or-location-conflict',country:null}
 const configLocations=configuration.locations.filter(l=>l.key===f.location.external_id)
 if(configLocations.length!==1||configLocations[0].label!==row.location)return{qualified:false,reason:'native-form-location-ID-name-binding-conflict',country:null}
 if(lookup&&(lookup.id!==f.location.external_id||lookup.title!==f.address))return{qualified:false,reason:'native-form-and-lookup-address-country-conflict',country:null}
 const country=countryOf(f.address)
 if(!country)return{qualified:false,reason:'native-job-address-country-unqualified-phone-country-not-used',country:null}
 return{qualified:country==='India',reason:country==='India'?null:'native-job-address-country-outside-India',country,address:f.address,id:f.location.external_id,name:f.location.name}
}

export async function runCurrentCms(options={}){
 const maxJobs=cap(options.maxJobs,'job cap'),maxPages=cap(options.maxPages,'page cap'),declaredPrograms=new Set(),io=createCurrentReader(options,(url,kind)=>allowed(url,kind,declaredPrograms))
 let audit={source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:0,observedVacancyCount:0,nativeObservedRecords:0,qualifiedIndiaRecords:0,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,fullPublicModelsClosingReconciled:false,rawSignedMediaDTOEqualityClaimed:false,heldRecords:[],applicationInteractions:0,publisherProgramsExecuted:false}
 const finish=jobs=>{attachInventoryEvidence(jobs,{status:'coverage-gap',surface:profile.currentBoard,firstParty:io.stats().requests>0,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:io.stats().requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:typeof options.now==='function'?options.now():new Date().toISOString(),reason:maxJobs===0||maxPages===0?'caller-zero-cap-no-inventory-proof':'current-own-CMS-published-unique-role-IDs-exact-native-location-country-and-authored-application-qualified;explicit-partial-criteria-backend-and-company-inventory-held'});attachSourceObservationEvidence(jobs,audit);Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{...audit,transport:io.stats()},configurable:true});return jobs}
 try{
  if(maxJobs===0||maxPages===0)return finish([])
  const phase=async name=>{
   const html=async url=>io.read(url,{phase:name}),json=async(url,allowedStatuses=[200])=>{const p=await io.read(url,{phase:name,kind:'json',allowedStatuses});return{status:p.status,model:readLiteralModel(p.text).value}}
   const home=documentModel((await html(HOME)).text,HOME,CAREERS,/CMS Info Systems/),careersRedirect=await io.read(CAREERS,{phase:name,allowedStatuses:[301]})
   need(new URL(careersRedirect.headers.location,CAREERS).href===CURRENT_CAREERS,'declared own careers redirect changed')
   const careers=documentModel((await html(CURRENT_CAREERS)).text,CURRENT_CAREERS,profile.legacyBoard,/CMS Info Systems/)
   const legacy=await io.read(profile.legacyBoard,{phase:name,allowedStatuses:[301]});need(new URL(legacy.headers.location,profile.legacyBoard).href===profile.currentBoard,'declared current board redirect changed')
   const shell=await html(profile.currentBoard),boardDocument=readNativeDocument(shell.text),programs=[]
   const readPrograms=async(origin,doc,surface)=>{for(const program of declaredCmsPrograms(doc,origin)){declaredPrograms.add(program.url);const p=await io.read(program.url,{phase:name,kind:'javascript'}),protocol=readCmsProtocol(p.text,{kind:program.kind,surface});programs.push({...program,surface,sha256:p.sha256,protocol})}}
   await readPrograms('https://careers.rekrutek.ai/',boardDocument,'board')
   const configuration=(await json(CONFIG)).model;need(configuration.name==='CMS'&&Array.isArray(configuration.brands)&&configuration.brands.filter(b=>b.key===profile.brandID&&b.value==='CMS').length===1&&Array.isArray(configuration.locations)&&configuration.settings?.sso_enabled===false,'native configured public brand/employer changed')
   const locationPages=[],locations=[];let page=1,totalPages=1
   do{const payload=(await json(locationsURL(page))).model,p=pagination(payload,page,'locations',10);locationPages.push(payload);locations.push(...payload.locations);totalPages=p.total_pages;page++}while(page<=totalPages)
   need(locations.length===locationPages[0].pagination.total_count&&new Set(locations.map(l=>l.id)).size===locations.length,'native location identity/count changed')
   const openingPages=[],rows=[];page=1;totalPages=1
   do{need(page<=maxPages,'caller page limit prevents full native closure');const payload=(await json(openingsURL(page))).model,p=pagination(payload,page,'openings',100);openingPages.push(payload);rows.push(...payload.openings);totalPages=p.total_pages;page++}while(page<=totalPages)
   need(rows.length>0&&rows.length===openingPages[0].pagination.total_count&&new Set(rows.map(r=>r.id)).size===rows.length,'native opening identity/count or duplicate IDs changed')
   for(const row of rows){need(uuid(row.id)&&typeof row.title==='string'&&row.title.trim()&&typeof row.location==='string'&&row.location.trim(),'native role identity/workplace fields unavailable');slugOf(row)}
   const forms={}
   for(const row of rows.filter(r=>!locationRecord(r,locations,configuration))){need(Object.keys(forms).length<100,'native fallback form cap exceeded');forms[row.id]=await json(formURL(slugOf(row)),[200,401]);if(forms[row.id].status===401)need(forms[row.id].model?.message==='Funnel not approved','native denied form is not an identified scoped unapproved vacancy')}
   const sample=rows[0],redirect=await io.read(sample.apply_url,{phase:name,allowedStatuses:[302]}),applyURL=profile.nativeApplyOrigin+'/apply/cms/opening/'+slugOf(sample)
   need(new URL(redirect.headers.location,sample.apply_url).href===applyURL,'declared native application redirect changed')
   const applyShell=await html(applyURL);await readPrograms(profile.nativeApplyOrigin+'/',readNativeDocument(applyShell.text),'apply')
   forms[sample.id]??=await json(formURL(slugOf(sample)),[200,401])
   const representative=qualifyForm(sample,forms[sample.id],configuration,locationRecord(sample,locations,configuration))
   need(representative.qualified,'representative native application identity/employer/address country conflict: '+representative.reason)
   return{home,careers,boardShellSHA256:shell.sha256,programs,configuration,locationPages,locations,openingPages,rows,forms,representative:{nativeID:sample.id,nativeURL:sample.apply_url,redirectStatus:redirect.status,location:redirect.headers.location,applyURL,shellSHA256:applyShell.sha256,qualification:representative}}
  }
  const opening=await phase('opening'),closing=await phase('closing')
  need(isDeepStrictEqual(publicClosingModel(opening),publicClosingModel(closing)),'full native public models changed at closing')
  const jobs=[],held=[];let lookupQualified=0,formQualified=0
  const at=typeof options.now==='function'?options.now():new Date().toISOString();need(Number.isFinite(Date.parse(at)),'invalid observation clock')
  for(const row of opening.rows){
   const lookup=locationRecord(row,opening.locations,opening.configuration),fallback=opening.forms[row.id]
   let proof=lookup?{qualified:countryOf(lookup.title)==='India',country:countryOf(lookup.title),address:lookup.title,id:lookup.id,name:lookup.name,reason:'native-lookup-workplace-outside-India'}:qualifyForm(row,fallback,opening.configuration)
   if(fallback){const corroboration=qualifyForm(row,fallback,opening.configuration,lookup);if(!corroboration.qualified)proof=corroboration}
   const criteria=scopedConstraints(row,fallback?.model?.funnel,at);if(!criteria.qualified)proof={...proof,qualified:false,reason:criteria.reason}
   if(!proof.qualified){held.push({nativeID:row.id,title:row.title,reason:proof.reason,nativeOpening:row,nativeLocation:lookup,nativeForm:fallback??null});continue}
   if(lookup)lookupQualified++;else formQualified++
   jobs.push({source:SOURCE,company:'CMS Info Systems',jobId:row.id,requisitionId:null,title:row.title,location:proof.address,country:'India',city:null,state:null,sourceUrl:row.apply_url,applyUrl:row.apply_url,link:row.apply_url,postingDate:criteria.dates.publications[0]?.raw??null,closingDate:criteria.dates.expiries[0]?.raw??null,sourceNativeDates:criteria.dates,employmentType:row.job_type??null,experienceRequired:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],jobDescription:criteria.description||null,sourceDescription:criteria.description||null,sourceNativeRecord:row,sourceNativeLocation:lookup??null,sourceNativeFormFunnel:fallback?.model?.funnel??null,sourceCountryEvidence:{basis:lookup?'unique-whole-current-vacancy-location-name-ID-address-join':'same-role-current-native-form-location-ID-name-address',nativeLocationID:proof.id,nativeLocationName:proof.name,nativeWorkplaceAddress:proof.address,country:'India',phoneCountryCodeUsed:false},sourceNativeEmployer:{corporatePublisher:HOME,nativeAccountSlug:'cms',nativeAccountID:profile.accountID,nativeBrandID:profile.brandID,nativeBrandName:'CMS'},sourceNativeApplication:{kind:'current-publisher-authored-own-account-role-apply-handoff',nativeURL:row.apply_url,nativeOpeningID:row.id,nativeSlug:slugOf(row),nativeFormFetched:Boolean(fallback),allRoleFormsVisited:false,fullControlsQualified:false,backendActivationVerified:false,applicationSubmitted:false},sourceDetailComplete:false,sourceDetailStatus:'partial',fullCriteriaRecovered:false,sourceDetailFailureKind:'published-native-opening-with-country-and-authored-handoff-full-rendered-criteria-and-application-controls-unqualified',sourceNativeClosingReconciled:true,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,backendApplicationActivationVerified:false,applicationSubmitted:false,scrapedAt:at})
  }
  audit={...audit,observedRecordCount:opening.rows.length,observedVacancyCount:opening.rows.length,nativeObservedRecords:opening.rows.length,qualifiedIndiaRecords:jobs.length,lookupCountryQualifiedRecords:lookupQualified,formCountryQualifiedRecords:formQualified,partialCriteriaRecords:jobs.length,fullPublicModelsClosingReconciled:true,rawSignedMediaDTOEqualityClaimed:false,signedMediaQualification:'Only the exact four public brand logo/banner AWS lease queries are excluded from semantic closing equality; every original URL and native body remains retained.',heldRecords:held,opening,closing,wholeCorporateHTMLClosingReconciled:false,wholeApplicationControlsQualified:false,allRoleFormsVisited:false,wholeUIProgramClosingEqualityClaimed:false,programQualification:'Current declared filenames are discovered afresh; selected GET method/account/role/query bindings, production API origin, title-sort values and application route are read as AST data. UI programs are never executed; full original bodies remain in HTTP capture.'}
  return finish(jobs.slice(0,maxJobs))
 }catch(error){io.check();if(error&&typeof error==='object'&&Object.isExtensible(error))error.sourceAudit={...audit,transport:io.stats()};throw error}finally{io.close()}
}
