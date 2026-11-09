import {isDeepStrictEqual} from 'node:util'
import {document,one,all,within,cls,norm,flow,snapshot,byClass,childByClass,originalInner} from './currentHtml.js'
import {readJSONLD,verifyStyles,applicationURL,COMPANY,HOME,need} from './currentDeclarations.js'
import {publication} from './currentDates.js'
import {SAFE_CRITERIA_CLASS_VALUES,SAFE_ROLE_CLASS_VALUES,ROLE_ATTRIBUTE_KEYS} from './currentRendererContract.js'
const keys=(object,allowed)=>Object.keys(object).every(k=>allowed.includes(k))
const tags=new Set(['div','p','blockquote','span','strong','b','em','i','ul','ol','li','br','h3','h4','h5'])
const india=value=>typeof value==='string'&&/^(?:India|IN|IND)$/i.test(value.trim())
const street=value=>norm(value||'').replace(/[,\s]+$/,'').toLowerCase()
function countryFor(model,card,publisher){
 const places=card.nativeLocation.split(' and ').map(norm);need(places.every(Boolean),'incomplete native workplace labels')
 const address=model.jobLocation?.address
 need(model.jobLocation?.['@type']==='Place'&&Object.hasOwn(model.jobLocation,'address')&&keys(model.jobLocation,['@type','address']),'unreviewed native worksite model')
 if(address!==null){
  need(address&&typeof address==='object'&&!Array.isArray(address)&&address['@type']==='PostalAddress'&&typeof address.addressCountry==='string'&&typeof address.addressLocality==='string','unreviewed native role address')
  need(places.length===1&&address.addressLocality.toLowerCase()===places[0].toLowerCase(),'native role address and published worksite differ')
  const sameOffice=publisher.model.address.filter(a=>a.addressLocality.toLowerCase()===address.addressLocality.toLowerCase()&&a.postalCode===address.postalCode&&street(a.streetAddress)===street(address.streetAddress)),conflict=sameOffice.some(a=>india(a.addressCountry)!==india(address.addressCountry)),qualified=india(address.addressCountry)&&!conflict
  return{qualified,country:qualified?'India':null,city:qualified?address.addressLocality:null,proof:{kind:'own-typed-role-postal-address',roleURL:card.url,nativeAddress:address,matchedOwnOfficeAddresses:sameOffice,conflicting:conflict,roleAddressCountryLiteral:true,cityDictionaryUsed:false,headquartersCountryDefaultUsed:false,exactWorksiteAddressVerified:false},reason:conflict?'native-role-and-own-office-country-conflict':qualified?null:'native-role-work-country-not-qualified-as-india'}
 }
 const bindings=places.map(city=>({city,addresses:publisher.model.address.filter(a=>a.addressLocality.toLowerCase()===city.toLowerCase())}))
 const qualified=bindings.every(b=>b.addresses.length>0&&b.addresses.every(a=>india(a.addressCountry)))
 return{qualified,country:qualified?'India':null,city:qualified&&places.length===1?places[0]:null,proof:{kind:'exact-role-workplace-to-current-own-organization-postal-country-relations',contextURL:publisher.url,nativeRoleAddress:null,roleWorkplace:card.nativeLocation,officeBindings:bindings,roleAddressCountryLiteral:false,cityDictionaryUsed:false,headquartersCountryDefaultUsed:false,exactWorksiteAddressVerified:false},reason:qualified?null:'native-workplace-country-context-unresolved'}
}
export function readRole(html,card,publisher,at){
 const doc=document(html),styles=verifyStyles(doc,'role'),scope=byClass(doc,'job-opening-container'),body=childByClass(scope,'job-opening__body'),posting=readJSONLD(doc,'JobPosting')
 need(keys(posting,['@context','@type','title','description','hiringOrganization','datePosted','validThrough','employmentType','jobLocation','baseSalary']),'unreviewed native posting fields')
 need(posting['@context']==='https://schema.org/'&&posting.title===card.title&&norm(flow(childByClass(scope,'job-opening__head-title')))===card.title,'native posting and published card title differ')
 const employer=posting.hiringOrganization;need(employer&&keys(employer,['@type','name','sameAs','logo'])&&employer['@type']==='Organization'&&employer.name===COMPANY&&employer.sameAs===HOME.slice(0,-1),'native hiring organization differs')
 need(norm(flow(childByClass(scope,'job-opening__head-loc'))).toLowerCase()===card.nativeLocation.toLowerCase(),'native visible worksite and card differ')
 const button=childByClass(scope,'job-opening__head-btn'),links=within(button,n=>n.tag==='a');need(links.length===1&&applicationURL(links[0].attrs.href)===card.applyURL,'native application declaration and card differ')
 for(const n of all(scope)){need(!n.inert,'hidden or inert native role component');need(Object.keys(n.attrs).every(k=>(ROLE_ATTRIBUTE_KEYS[n.tag]||[]).includes(k)),'unreviewed native role attributes');need(!Object.hasOwn(n.attrs,'class')||SAFE_ROLE_CLASS_VALUES.includes(n.attrs.class),'unreviewed native role CSS class')}
 for(const n of all(body)){need(!n.inert&&tags.has(n.tag),'hidden, inert, external or unsupported native criteria');need(Object.keys(n.attrs).every(k=>k==='class'),'unreviewed native criteria attributes');need(!Object.hasOwn(n.attrs,'class')||SAFE_CRITERIA_CLASS_VALUES.includes(n.attrs.class),'unreviewed criteria CSS class')}
 const responsibility=childByClass(scope,'job-responsibility__desc'),qualification=childByClass(scope,'job-qualification__desc'),structured=document(posting.description),structuredRoot=one(structured.nodes(n=>n.tag==='root'),'structured responsibilities')
 for(const n of all(structuredRoot))need(!n.inert&&(n.tag==='root'||tags.has(n.tag)),'hidden or unsupported structured responsibilities')
 const responsibilityText=norm(flow(responsibility)),qualificationText=norm(flow(qualification)),description=norm(flow(body))
 need(responsibilityText===card.description&&qualificationText===card.qualifications&&norm(flow(structuredRoot))===responsibilityText,'whole native listing, responsibilities or qualifications differ')
 need(description.length>=100&&!/\b(?:insert job description|job description coming soon|placeholder description)\b/i.test(description),'missing full native criteria')
 const statements=[...all(scope).map(n=>norm(flow(n))),...flow(scope).split(/\n+/).map(norm)]
 for(const text of statements){
  need(!/\b(?:(?:this|the) (?:position|job|vacancy|role) (?:has been filled|is (?:filled|closed)|is no longer (?:available|open|accepting applications))|no longer accepting applications)(?=[\s.!?;,:]|$)/i.test(text),'explicit closed or filled native vacancy')
  need(!/\b(?:(?:(?:job|position|vacancy|role)\s+)?status\s*[:\-\u2013\u2014]\s*(?:closed|filled|expired|withdrawn|cancelled)|applications\s+(?:are|have been|are now)\s+closed)(?=[\s.!?;,:]|$)/i.test(text),'explicit native closure status or applications notice')
  need(!/^(?:employer|legal employer|hiring (?:company|organization)|(?:(?:work(?:site|place)?|job|office|position)\s+)?(?:location|country)|mandatory work assignment)(?:\s*[:\-\u2013\u2014]|\s*$)/i.test(text),'unreviewed native employer or placement assertion')
  need(!/\b(?:this|the) (?:position|role|job|vacancy)\s+(?:is|will be|must be)\s+(?:(?:based|located|posted|stationed)\s+(?:in|at|out of)|working\s+(?:in|at|across|from)|assigned\s+to)\b/i.test(text),'unreviewed native placement prose')
 }
 const geo=countryFor(posting,card,publisher),dates=publication(posting,at),htmlBody=originalInner(html,body)
 need(posting.employmentType==='FULL_TIME','unreviewed native employment type')
 const model={url:card.url,jobPosting:posting,scopeTree:snapshot(scope),bodyTree:snapshot(body),bodyHTML:htmlBody,description,responsibilities:responsibilityText,qualifications:qualificationText,styles,nativeRoleLocation:norm(flow(childByClass(scope,'job-opening__head-loc')))}
 return{model,geo,dates,eligible:geo.qualified&&dates.activityProved,heldReason:!geo.qualified?geo.reason:dates.activityProved?null:'native-publication-or-deadline-calendar-unresolved-or-inactive'}
}
export const reconcile=(a,b,label)=>need(isDeepStrictEqual(a,b),'closing whole '+label+' changed')
export function mapRole(card,open,close,publisher,at){
 const m=open.model
 return{source:'greatlearning',company:COMPANY,companyName:COMPANY,title:card.title,jobId:null,requisitionId:null,canonicalRoleURL:null,nativeIdentity:{kind:'published-role-url',url:card.url,postingId:null,formalRequisitionId:null},nativeLocation:card.nativeLocation,location:card.nativeLocation,country:'India',city:open.geo.city,state:null,remoteStatus:null,workplaceType:null,employmentType:m.jobPosting.employmentType,
  sourceUrl:card.url,jobUrl:card.url,link:card.url,applyUrl:card.applyURL,applicationUrlIsGeneric:true,applicationVisited:false,activeApplyVerified:false,legalEmployer:null,jobDescription:m.description,description:m.description,sourceDescription:m.bodyHTML,postingDate:null,postedAt:null,closingDate:null,firstEverPublication:null,
  nativeHiringOrganization:m.jobPosting.hiringOrganization,nativeSourceRecord:{listing:card,jobPosting:m.jobPosting,roleModel:m,publisher:publisher.model},nativeClosingRecord:{listing:card,jobPosting:close.model.jobPosting,roleModel:close.model,publisher:publisher.model},nativePublicationFields:open.dates,sourceWorksiteCountryProof:open.geo.proof,nativeCriteriaComplete:true,nativeGeographyQualified:true,nativeEmployerReconciled:true,nativeRoleClosingReconciled:true,sourceDetailComplete:true,sourceCountryScopeUnresolved:false,sourceScopeComplete:false,sourceListingComplete:false,companyInventoryComplete:false,lifecycleCleanupAllowed:false,sourceCapturedAt:at,scrapedAt:at}
}
