import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {canonicalNativeRecord} from '../../scraper-support/native-sources/collectCurrentOriginalRecords20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {runNative,inspectDetail} from './nativeCareers.js'
import {readUniqueLiteralJSON} from './literalJSON.js'
import {createCurrentReader} from './currentRead20261119.js'
import {CYBERTECH_SYSTEMS_AND_SOFTWARE_CATALOG as catalog} from './catalog.js'

const SOURCE='cybertechsystemsandsoftware',ORIGIN='https://cybertech.com'
const fail=message=>firstPartyFailure(SOURCE,message),need=(ok,message)=>{if(!ok)throw fail(message)}
const same=(left,right)=>canonicalNativeRecord(left)===canonicalNativeRecord(right)
const norm=value=>String(value??'').replace(/\s+/g,' ').trim()
const plain=value=>{const d=readNativeDocument(value);return d.text(d.nodes(n=>n.tag==='root')[0])}
const walk=node=>typeof node==='string'?[]:[node,...node.children.flatMap(walk)]
const json=text=>{const parsed=readUniqueLiteralJSON(text);need(!parsed.duplicateKeys.length,'native JSON has duplicate keys');return parsed.value}
const references={Mumbai:'https://mumbaicity.gov.in/en/about-district/administrative-setup/',Thane:'https://thane.nic.in/en/about-district/'}
const allowed=(value,kind)=>{
 try{
  const url=new URL(value)
  if(url.href!==value||url.origin!==ORIGIN||url.username||url.password||url.hash)return false
  if(kind==='html')return value===catalog.companyCareerPage||/^\/job\/[a-z0-9-]+\/$/.test(url.pathname)&&!url.search
  return kind==='json'&&/^\/wp-json\/wp\/v2\/(?:job(?:\/\d+)?|job-location|job-type)$/.test(url.pathname)
   &&[...url.searchParams].every(([name,v])=>['post','page','per_page'].includes(name)&&/^\d+$/.test(v))
 }catch{return false}
}

function nativeIdentity(html,post){
 const d=readNativeDocument(html),mains=d.nodes(n=>n.attrs.id==='main-content'&&!n.inert),headings=d.nodes(n=>n.tag==='h1'&&!n.inert)
 const titles=headings.map(n=>d.text(n)),title=plain(post.title.rendered)
 need(mains.length===1&&titles.length===1&&titles[0]===title,'native role title/owner identity disagrees')
 const urls=d.nodes(n=>n.tag==='link'&&(n.attrs.rel??'').split(/\s+/).includes('canonical')).map(n=>n.attrs.href)
 urls.push(...d.nodes(n=>n.tag==='meta'&&n.attrs.property==='og:url').map(n=>n.attrs.content))
 need(urls.length>0&&urls.every(url=>url===post.link),'native canonical role identity disagrees')
 const alternate=d.nodes(n=>n.tag==='link'&&n.attrs.type==='application/json'&&(n.attrs.rel??'').split(/\s+/).includes('alternate'))
 const own=post._links?.self
 need(alternate.length===1&&Array.isArray(own)&&own.length===1&&alternate[0].attrs.href===own[0].href,'native role JSON authority disagrees')
 const nodes=walk(mains[0]),forms=nodes.filter(n=>n.tag==='form'&&!n.inert)
 need(forms.length===1,'native own role application form is missing or ambiguous')
 const controls=walk(forms[0]).filter(n=>['input','select','textarea'].includes(n.tag)&&!n.inert)
 const field=name=>controls.filter(n=>n.attrs.name===name)
 need(field('input_11').length===1&&field('input_11')[0].attrs.value===title&&field('input_12').length===1&&field('input_12')[0].attrs.value===post.link,'native application title/URL is bound to another role')
 const action=new URL(forms[0].attrs.action??'',post.link);action.hash=''
 need((forms[0].attrs.method??'').toLowerCase()==='post'&&action.href===post.link,'native application action leaves the own role')
 const mainText=d.text(mains[0]),apply=nodes.findIndex(n=>/^h[1-6]$/.test(n.tag)&&/^apply now$/i.test(d.text(n)))
 const apiCriteria=plain(post.content.rendered),detail=inspectDetail(html,post.link,post)
 need(!apiCriteria||typeof detail.criteriaText==='string'&&detail.criteriaText.includes(apiCriteria),'nonempty whole native API criteria contradict the own role HTML')
 const criteriaNodes=apply<0?nodes:nodes.slice(0,apply)
 for(const node of criteriaNodes.filter(n=>['p','li','h2','h3','h4'].includes(n.tag))){
  const line=norm(d.text(node)),country=/^(?:(?:work|job|workplace)\s+)?country\s*:\s*(.+)$/i.exec(line)
  if(country)need(/^(?:India|IN|IND)$/i.test(country[1]),'explicit native role country conflicts')
  const employer=/^(?:employer|hiring company)\s*:\s*(.+)$/i.exec(line)
  if(employer)need(['cybertech','cybertechsystemsandsoftware'].includes(employer[1].replace(/[^a-z]/gi,'').toLowerCase()),'explicit native employer conflicts')
 }
 need(!/\b(?:this\s+(?:job|role|position)\s+(?:(?:is|was|has been)\s+)?(?:now\s+)?(?:closed|filled|expired)|no longer accepting applications|applications are closed|(?:our|the) client is (?:hiring|seeking|looking))\b/i.test(mainText),'native role is closed or advertises a separate client employer')
 for(const node of d.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json'))need(!/JobPosting|jobLocation|applicantLocationRequirements/.test(node.raw??''),'new native structured job country model requires review')
 return {title,forms:forms.map(form=>({attrs:{...form.attrs},controls:walk(form).filter(n=>['input','select','textarea'].includes(n.tag)).map(n=>({tag:n.tag,attrs:{...n.attrs},text:d.text(n)}))})),boundToRole:true,activationVerified:false,allControlsQualified:false}
}

export async function runCurrentCybertech(options={}){
 const observedAt=typeof options.now==='function'?options.now():options.now??new Date().toISOString()
 need(typeof observedAt==='string'&&Number.isFinite(Date.parse(observedAt)),'invalid native observation clock')
 need(options.maxJobs==null||Number.isSafeInteger(options.maxJobs)&&options.maxJobs>=0,'invalid source output cap')
 const reader=createCurrentReader(options,allowed)
 let audit=null;const held=[],closingModels=[]
 try{
  const observations=await runNative({signal:options.signal,now:()=>observedAt,onAudit:value=>{audit=value},fetchText:async url=>{
   const page=await reader.read(url,{kind:url.includes('/wp-json/')?'json':'html',phase:'native-opening-and-listing-closing'})
   return {html:page.text,status:page.status,url:page.url,headers:page.headers,bodyBase64:page.bodyBase64}
  }})
  reader.check();need(audit,'whole original native audit unavailable')
  need(audit.nativeOpening.complete&&audit.nativeClosing.complete
   &&[audit.nativeOpening.rows,audit.nativeClosing.rows].every(rows=>rows.every(post=>Number.isSafeInteger(post.id)&&post.id>0)&&new Set(rows.map(post=>post.id)).size===rows.length),'native published collection boundaries are incomplete or contain duplicate identities')
  const opening=new Map(audit.nativeOpening.rows.map(post=>[post.id,post])),closing=new Map(audit.nativeClosing.rows.map(post=>[post.id,post])),qualified=[]
  for(const job of observations){
   const post=job.sourceNativeWordPressPost,location=job.sourceNativeLocations,types=post?._links?.['wp:term']?.filter(row=>['job-type','job-location'].includes(row.taxonomy))??[]
   try{
    need(post&&post.status==='publish'&&same(opening.get(post.id),post)&&same(closing.get(post.id),post),'whole native published role changed or is missing at a listing boundary')
    const names=location?.originalTerms?.map(term=>term.name)
    need(location?.coherent&&Array.isArray(names)&&names.length>0&&names.every(name=>Object.hasOwn(references,name)),'whole native workplace alternatives are unqualified')
    need(!Object.hasOwn(post,'jobLocation')&&!Object.hasOwn(post,'applicantLocationRequirements'),'new native structured country model requires review')
    const page=audit.rawPages.find(page=>page.url===post.link&&page.usable&&page.transportQualified)
    need(page?.bodyBase64&&page.originalHTML,'original own role HTML unavailable')
    const application=nativeIdentity(page.originalHTML,post)
    const end=await reader.read(post.link,{phase:'closing-qualified-role'}),endApplication=nativeIdentity(end.text,post)
    need(page.bodySHA256===end.sha256&&same(application,endApplication),'whole own role HTML/criteria/application changed at closing')
    const taxonomies=[]
    for(const relation of types){
     const endpoint=ORIGIN+'/wp-json/wp/v2/'+relation.taxonomy,expected=post[relation.taxonomy]
     need(relation.href===endpoint+'?post='+post.id&&Array.isArray(expected)&&expected.length>0&&new Set(expected).size===expected.length&&expected.every(id=>Number.isSafeInteger(id)&&id>0),'native taxonomy is not bound to this role and term identity')
     const original=audit.rawPages.find(page=>page.url===relation.href&&page.usable&&page.transportQualified)
     need(original?.bodyBase64,'original own role taxonomy unavailable')
     const after=await reader.read(relation.href,{kind:'json',phase:'closing-qualified-taxonomy'})
     const beforeTerms=json(original.originalHTML),afterTerms=json(after.text)
     need(same(beforeTerms,afterTerms),'whole native role taxonomy changed at closing')
     for(const [terms,headers] of [[beforeTerms,original.headers],[afterTerms,after.headers]]){
      need(Array.isArray(terms)&&terms.length===expected.length&&new Set(terms.map(term=>term.id)).size===terms.length
       &&terms.every(term=>expected.includes(term.id)&&term.taxonomy===relation.taxonomy&&typeof term.name==='string'&&norm(term.name)
        &&term._links?.self?.length===1&&term._links.self[0].href===endpoint+'/'+term.id
        &&term._links?.collection?.length===1&&term._links.collection[0].href===endpoint)
       &&headers['x-wp-total']===String(expected.length)&&headers['x-wp-totalpages']==='1'
       &&!/<[^>]+>;\s*rel=["']?next["']?/i.test(headers.link??''),'whole native role taxonomy identity or authoritative counts are unreconciled')
     }
     taxonomies.push({relation:structuredClone(relation),opening:beforeTerms,closing:afterTerms})
    }
    need(types.length===2&&new Set(types.map(row=>row.taxonomy)).size===2,'native role taxonomy identity is ambiguous')
    closingModels.push({jobId:job.jobId,roleHTML:end.text,application:endApplication,taxonomies})
    qualified.push({...job,country:'India',countryCode:'IN',location:names.join(' / '),locations:names,city:names.length===1?names[0]:null,state:'Maharashtra',
     sourceCountryScopeUnresolved:false,sourceCountryEvidence:{kind:'reviewed-whole-native-workplace-geography',nativeWholeAlternatives:names,references:[...new Set(names.map(name=>references[name]))]},
     sourceNativeApplication:application,sourceNativeOpeningWordPressPost:opening.get(post.id),sourceNativeClosingWordPressPost:closing.get(post.id),
     sourceNativeOpeningRoleHTML:page.originalHTML,sourceNativeClosingRoleHTML:end.text,sourceNativeClosingTaxonomies:taxonomies,
     sourceClosingReconciled:true,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,nativeLegalEmployer:null,
     sourceRoleIdentityQualified:true,sourceNativeCriteriaRetained:true,backendApplicationActivationVerified:false,applicationSubmitted:false,
     sourceDetailComplete:job.sourceDetailComplete===true,scrapedAt:observedAt})
   }catch(error){reader.check();held.push({jobId:job.jobId,reason:error.message,originalObservation:job,openingPost:opening.get(post?.id)??null,closingPost:closing.get(post?.id)??null})}
  }
  const jobs=options.maxJobs==null?qualified:qualified.slice(0,options.maxJobs)
  const evidence={source:SOURCE,recordKind:'vacancy-rows',nativeObservedRecords:observations.length,qualifiedIndiaRecords:qualified.length,heldRecords:held,observations,openingAudit:audit,closingModels,reader:reader.stats(),wholePublishedNativeModelsClosingReconciled:true,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,companyIndiaZeroProven:false,lifecycleCleanupAllowed:false,applicationInteractions:0}
  attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:observations.length,observedVacancyCount:observations.length,sourceScopeComplete:false})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:evidence,configurable:true})
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:catalog.companyCareerPage,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:evidence.reader.requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,reason:'own-current-native-vacancies-and-whole-workplaces-qualified;full-original-role-and-taxonomy-closing-reconciled;company-inventory-and-backend-application-held'})
  await options.onAudit?.(structuredClone(evidence));reader.check();return jobs
 }catch(error){reader.check();try{Object.defineProperty(error,'recruitmentObservations',{value:{source:SOURCE,audit,heldRecords:held,closingModels,reader:reader.stats(),lifecycleCleanupAllowed:false},enumerable:true})}catch{/* A frozen caller reason must retain its exact identity. */}throw error}
 finally{reader.close()}
}
