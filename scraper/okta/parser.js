import {document,norm} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {requireNative,nativeDate,nativeLocationCountryName,plainNativeHTML} from '../../scraper-support/shared/nativeJobPosting.js'
export const SOURCE='okta',COMPANY='Okta',ORIGIN='https://www.okta.com'
export const HOME=ORIGIN+'/company/careers/',BOARD=HOME+'job-listing/'
const ensure=(value,message)=>requireNative(value,'Okta: '+message)
const one=(values,label)=>{ensure(values.length===1,'Missing/ambiguous '+label);return values[0]}
const canonical=(d,url)=>ensure(one(d.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'canonical URL').attrs.href===url,'Native canonical URL conflict')
const writtenIndia=label=>/(?:^|,\s*)India$/.test(norm(label))
const idFromURL=url=>/-(\d+)\/$/.exec(new URL(url).pathname)?.[1]??new URL(url).pathname.slice('/company/careers/'.length).replace(/\/$/,'').replaceAll('/','--')

export function createSourceConfig({now=()=>new Date().toISOString(),maxJobs}={}){
 const current=Date.parse(now()),allowedDetails=new Set(),seenExternalIDs=new Set()
 ensure(Number.isFinite(current),'Invalid observation clock')
 ensure(maxJobs==null,'Partial maxJobs limit unsupported;native inventory must be read completely')
 const config={source:SOURCE,companyName:COMPANY,boardURL:BOARD,detailConcurrency:4,maxAggregateBytes:192*1024*1024,compactResponseReferences:true,
  sameReadIdentity:(a,b)=>a===b,
  validateURL(value){
   ensure(typeof value==='string','Invalid public URL')
   const url=new URL(value)
   ensure(!url.username&&!url.password&&!url.search&&!url.hash&&url.origin===ORIGIN,'Unqualified public origin/query/credentials')
   ensure(value===HOME||value===BOARD||allowedDetails.has(value),'Unlisted public resource or application action')
  },
  handoffs:[{url:HOME,verify(html){
   const d=document(html);canonical(d,HOME)
   ensure(d.nodes(n=>n.tag==='a'&&typeof n.attrs.href==='string'&&new URL(n.attrs.href,ORIGIN).href===BOARD).length>0
    &&/<title>[^<]*\bOkta\b/i.test(html),'Official careers/search/company binding missing')
  }}],
  parseListing(html,url){
   ensure(url===BOARD,'Unknown listing page');const d=document(html);canonical(d,BOARD)
   ensure(d.nodes(n=>n.tag==='form'&&n.attrs['data-drupal-selector']==='views-exposed-form-careers-main').length===1,
    'Missing unique native careers listing container')
   ensure(!d.nodes(n=>n.tag==='a'&&(n.attrs.rel||'').split(/\s+/).includes('next')
    ||['nav','li'].includes(n.tag)&&/(?:^|\s)(?:pager|pager__item|pagination)(?:\s|$)/.test(n.attrs.class||'')).length,
   'Native board gained pagination controls;single-page enumeration unverified')
   const rows=d.nodes(n=>d.hasClass(n,'views-row'));ensure(rows.length>0&&rows.length<=2000,'Native board missing or exceeds listing bound')
   const records=[],errors=[]
   for(const node of rows)try{
    const link=one(d.nodes(n=>n.tag==='a'&&typeof n.attrs.href==='string',node),'listing role link')
    const role=new URL(link.attrs.href,ORIGIN)
    ensure(role.origin===ORIGIN&&!role.username&&!role.password&&!role.search&&!role.hash
     &&/^\/company\/careers\/(?:[a-z0-9-]+\/){1,2}$/.test(role.pathname)
     &&!role.pathname.slice('/company/careers/'.length).split('/').some(part=>['job-listing','apply','application','login','register','sign-in','account'].includes(part)),
    'Unqualified listing role URL')
    const title=d.text(link),location=d.text(one(d.nodes(n=>d.hasClass(n,'views-field-field-job-location'),node),'listing location'))
    ensure(title&&location,'Missing native title/location')
    // A country is recognized only when written in the location field. The
    // India locale,company name and city alone never establish India scope.
    ensure(!/\bIndia\b/.test(location)||writtenIndia(location),'Ambiguous native India listing location')
    const india=writtenIndia(location);if(india)allowedDetails.add(role.href)
    records.push({id:idFromURL(role.href),title,url:role.href,locations:[location],countries:india?['India']:[],
     nativeLocation:location,nativeURLJobID:/-(\d+)\/$/.exec(role.pathname)?.[1]??null,nativeListingHTML:d.outer(node)})
   }catch(error){errors.push({message:error.message,rawCandidate:{rawHTML:d.outer(node)}})}
   // The board has no advertised numeric total. Keep that unknown instead of
   // relabeling a count of observed DOM rows as an upstream reported total.
   return{pageNumber:1,lastPage:1,reportedTotal:null,observedRows:rows.length,records,errors,nextURL:null,terminationKnown:true}
  },
  pageFingerprint:page=>JSON.stringify([page.observedRows,page.records.map(r=>[r.id,r.title,r.url,r.nativeLocation]),page.errors]),
  candidateForIndia:row=>row.countries.includes('India'),
  parseDetail(html,row){
   const d=document(html);canonical(d,row.url)
   const postings=d.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').map(n=>JSON.parse(n.raw)).filter(p=>p['@type']==='JobPosting')
   const schema=one(postings,'native JobPosting'),title=d.text(one(d.nodes(n=>n.tag==='h1'),'visible title'))
   ensure(norm(schema.title)===row.title&&title===row.title,'Native listing/schema/visible title conflict')
   ensure(schema.hiringOrganization?.name==='Okta, Inc.'&&schema.hiringOrganization.sameAs==='http://www.okta.com/',
    'Native hiring organization identity conflict')
   const jobNode=one(d.nodes(n=>n.tag==='article'&&d.hasClass(n,'Job__content')),'full native role article')
   ensure(new URL(jobNode.attrs.about,ORIGIN).href===row.url,'Native article identity conflict')
   const nativeHTML=d.inner(jobNode),text=d.text(jobNode)
   ensure(text&&!/\b(?:this job is no longer available|this position has been filled)\b/i.test(text),'Missing or closed native role body')
   ensure(typeof schema.description==='string'&&plainNativeHTML(schema.description),'Missing native schema teaser')
   // The schema text is a truncated teaser ending in a period. It is retained
   // separately. Require authored material after the shared first paragraph
   // and before the native benefits footer;never substitute the teaser.
   const paragraphs=jobNode.children.filter(n=>typeof n!=='string'),firstParagraph=paragraphs[0]
   ensure(firstParagraph&&firstParagraph.tag==='p','Missing native role introduction paragraph')
   const intro=d.text(firstParagraph)
   let authored=text
   if(/^Secure Every Identity, from AI to Human/.test(intro))authored=authored.slice(intro.length).trim()
   for(const marker of ['What you can look forward to as an Okta employee!','The Okta Experience']){
    const at=authored.indexOf(marker);if(at>=0)authored=authored.slice(0,at).trim()
   }
   ensure(authored&&authored.replace(/\s/g,'')!==plainNativeHTML(schema.description).replace(/\s/g,''),
    'Missing employer-authored role content beyond company teaser/footer')
   ensure(!d.nodes(n=>n.tag==='form',jobNode).length,'Native role article unexpectedly contains application form')
   const locations=Array.isArray(schema.jobLocation)?schema.jobLocation:[schema.jobLocation]
   ensure(locations.length>0&&locations.length<=32,'Missing native JobPosting locations')
   const addresses=locations.map(place=>{
    ensure(place?.['@type']==='Place'&&typeof place.address==='string'&&norm(place.address),'Missing native address string')
    const country=nativeLocationCountryName(place.address);ensure(country,'Unrecognized native written country')
    return{raw:place.address,country,nativeCountryRaw:place.address,nativeAddressFormat:'original JobPosting Place.address string'}
   })
   const india=addresses.filter(a=>a.country==='India')
   ensure(india.length>0&&india.some(a=>norm(a.raw)===row.nativeLocation),'Native listing/schema India location conflict')
   const visible=d.text(one(d.nodes(n=>n.tag==='div'&&d.hasClass(n,'mb-4')&&d.hasClass(n,'h5')),'visible native location'))
   ensure(visible===row.nativeLocation,'Native visible/listing location conflict')
   const posted=nativeDate(schema.datePosted,{required:true}),closing=nativeDate(schema.validThrough)
   ensure(Date.parse(posted.iso)<=current&&(!closing.iso||closing.iso>=posted.iso),'Future posting or invalid native expiry chronology')
   const ids=one(d.nodes(n=>typeof n.attrs['data-job-id']==='string'),'native public job identifier').attrs
   const external=ids['data-job-id'],internal=ids['data-job-id-internal']
   ensure(/^[1-9]\d{4,11}$/.test(external)&&/^[1-9]\d{4,11}$/.test(internal)
    &&(!row.nativeURLJobID||external===row.nativeURLJobID),'Native public/internal job ID or listing URL conflict')
   ensure(!seenExternalIDs.has(external),'Duplicate native external job ID across distinct listing URLs');seenExternalIDs.add(external)
   return{id:external,title:row.title,sourceURL:row.url,nativeListingRecord:row,nativeJobPosting:schema,nativeJobPostingIdentifier:schema.identifier??null,
    nativeHiringOrganization:schema.hiringOrganization,nativeCountryAddresses:addresses,nativeVisibleLocationTexts:[visible],
    nativeSchemaDescription:schema.description,nativeVisibleDescriptionHTML:nativeHTML,nativeDescriptionHTML:nativeHTML,
    nativeDescriptionOrigin:'exact original Job__content article HTML;schema teaser retained separately;application form outside article',
    nativePostedDate:posted,nativeValidThrough:closing,nativeApplicationURL:null,nativeExternalJobID:external,nativeInternalJobID:internal,
    nativeIndiaLocationLabels:india.map(a=>norm(a.raw)),sourceRequisitionID:null,nativeApplicationFormAttributesReadOnly:true,
    applicationsVisited:false,firstEverPublication:null,legalEmployer:null,sourceScopeComplete:false}
  },
 }
 return config
}
