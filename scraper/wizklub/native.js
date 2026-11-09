import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {nativeDate,nativeLocationCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
export const HOME_URL='https://dev.wizklub.com/'
export const EMPLOYERS=[
 {slug:'wizklub-learning',name:'WizKlub Learning Pvt Ltd',id:'74233894',website:'https://wizklub.com/'},
 {slug:'wizklubfuturz',name:'Wizklub Futurz',id:'53495338',website:'https://wizklub.com/'},
]
export const SEED_ROLES=[
 {id:'4480357313',slug:'coding-and-robotics-trainer-at-infinity-learn',title:'Coding and Robotics Trainer'},
 {id:'4478763469',slug:'area-sales-manager-at-infinity-learn',title:'Area Sales Manager'},
 {id:'4477806380',slug:'area-manager-at-infinity-learn',title:'Area Manager'},
]
const check=(ok,reason)=>{if(!ok)throw Error(reason)}
const activeDocument=html=>{
 const doc=document(html)
 const prune=(n,hidden=false)=>{n.inactive ||= hidden||/(?:^|;)\s*content-visibility\s*:\s*hidden\s*(?:!important\s*)?(?:;|$)/i.test((n.attrs?.style||'').replace(/\/\*[\s\S]*?\*\//g,''));for(const c of n.children.filter(v=>typeof v!=='string'))prune(c,n.inactive)}
 prune(doc.root);return doc
}
const schemas=doc=>doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').map(n=>JSON.parse(n.raw))
const review=(doc,{social=false}={})=>{
 const contains=v=>v&&typeof v==='object'&&([v['@type']].flat().includes('JobPosting')||Object.values(v).some(contains))
 check(!schemas(doc).some(contains),'New structured JobPosting country, publication and expiry requires reconciliation')
 check(!doc.nodes(n=>/JobPosting/i.test(n.attrs.itemtype||'')||/(?:^|\s)(?:addressCountry|country|jobLocation|hiringOrganization|datePosted|datePublished|dateModified|validThrough|closingDate|expiryDate)(?:\s|$)/i.test(n.attrs.itemprop||'')||n.tag==='meta'&&/^(?:addressCountry|country|jobLocation|datePosted|datePublished|dateModified|validThrough|closingDate|expiryDate)$/i.test(n.attrs.name||n.attrs.property||'')).length,'New native country, publication or expiry microdata requires reconciliation')
 const sensitive=/^(?:datePosted|datePublished|dateModified|validThrough|closingDate|expiryDate|expirationDate|expiresAt|jobLocation)$/i
 const visit=v=>{if(v&&typeof v==='object')for(const [k,value] of Object.entries(v)){check(!sensitive.test(k)||social&&v['@type']==='SocialMediaPosting'&&k==='datePublished','New structured publication or expiry requires reconciliation');if(social&&v['@type']==='SocialMediaPosting'&&k==='datePublished')nativeDate(value,{required:true});visit(value)}}
 schemas(doc).forEach(visit)
 return doc
}
const company=(value,slug)=>{try{const u=new URL(value);return u.protocol==='https:'&&['www.linkedin.com','in.linkedin.com'].includes(u.hostname)&&u.pathname.replace(/\/$/,'')==='/company/'+slug}catch{return false}}
const rolePath=value=>{const u=new URL(value);check(u.protocol==='https:'&&['www.linkedin.com','in.linkedin.com'].includes(u.hostname)&&/^\/jobs\/view\/[^/]+-\d+$/.test(u.pathname),'Native job URL changed');return u.pathname}
export const collectWizKlubNative=async({read,now})=>{
 const home=review(activeDocument(await read(HOME_URL)))
 const org=schemas(home).filter(v=>v['@type']==='Organization')
 check(org.length===1&&org[0].name==='Wizklub'&&org[0].url==='https://wizklub.com/'&&org[0].email==='support@infinitylearn.com'&&org[0].sameAs?.includes('Linkedin: https://in.linkedin.com/company/wizklubfuturz/'),'Official native brand and parent association changed')
 const scopeObservations=[]
 for(const employer of EMPLOYERS){
  const doc=review(activeDocument(await read('https://www.linkedin.com/company/'+employer.slug)))
  check(doc.nodes(n=>n.tag==='h1'&&doc.text(n)===employer.name).length===1&&doc.nodes(n=>n.attrs['data-semaphore-content-urn']==='urn:li:organization:'+employer.id).length===1,'Exact native employer identity changed')
  check(doc.nodes(n=>n.tag==='a'&&n.attrs['data-tracking-control-name']==='about_website').some(n=>{try{const u=new URL(n.attrs.href);return u.origin==='https://www.linkedin.com'&&new URL(u.searchParams.get('url')).href===employer.website}catch{return false}}),'Native reciprocal brand website changed')
  for(const location of ['India','Worldwide']){
   const url=`https://www.linkedin.com/jobs/search/?f_C=${employer.id}&location=${location}`
   const listing=review(activeDocument(await read(url)))
   check(listing.nodes(n=>n.tag==='input'&&n.attrs.name==='f_C'&&n.attrs.value===employer.id&&Object.hasOwn(n.attrs,'checked')).length===1,'Exact checked native employer scope changed')
   check(listing.nodes(n=>n.tag==='h1'&&listing.text(n)==='We couldn\u2019t find a match for Jobs jobs in '+location).length===1&&!listing.nodes(n=>listing.hasClass(n,'job-search-card')).length,'Native scope changed; new listing roles require review')
   scopeObservations.push({url,employerId:employer.id,location,observedNoMatch:true})
  }
 }
 const parent=review(activeDocument(await read('https://www.linkedin.com/company/infinity-learn-by-sri-chaitanya')),{social:true})
 check(parent.nodes(n=>n.tag==='h1'&&parent.text(n)==='Infinity Learn').length===1&&parent.nodes(n=>n.attrs['data-semaphore-content-urn']==='urn:li:organization:78106236').length===1,'Exact Indian parent employer changed')
 const parentOrganizations=schemas(parent).flatMap(v=>v['@graph']||[v]).filter(v=>v['@type']==='Organization')
 check(parentOrganizations.some(v=>v.name==='Infinity Learn'&&company(v.url,'infinity-learn-by-sri-chaitanya')&&v.address?.addressCountry==='IN'&&/Sri Chaitanya/.test(v.description)),'Parent organization native identity changed')
 check(!parent.nodes(n=>n.tag==='a'&&/\/jobs\/view\//.test(n.attrs.href||'')).length,'New parent social role links require earliest-publication reconciliation')
 const listingRecords=new Map()
 for(const location of ['India','Worldwide']){
  const url=`https://www.linkedin.com/jobs/search/?f_C=78106236&location=${location}`
  const listing=review(activeDocument(await read(url)))
  check(listing.nodes(n=>n.tag==='input'&&n.attrs.name==='f_C'&&n.attrs.value==='78106236'&&Object.hasOwn(n.attrs,'checked')).length===1,'Exact parent employer listing filter changed')
  const cards=listing.nodes(n=>listing.hasClass(n,'job-search-card'))
  const heading=listing.nodes(n=>n.tag==='h1'),total=heading.length===1?Number(listing.text(heading[0]).match(new RegExp('^(\\d+) Jobs in '+location+'$'))?.[1]):NaN
  check(cards.length>0&&cards.length<=100&&Number.isSafeInteger(total)&&total>=cards.length,'Parent native listing shape or count changed')
  for(const card of cards){
   const within=p=>listing.nodes(p,card),field=cls=>listing.text(within(n=>listing.hasClass(n,cls))[0])
   const id=card.attrs['data-entity-urn']?.match(/^urn:li:jobPosting:(\d+)$/)?.[1]
   const subtitle=within(n=>listing.hasClass(n,'base-search-card__subtitle'))[0]
   check(id&&listing.text(subtitle)==='Infinity Learn'&&listing.nodes(n=>n.tag==='a'&&company(n.attrs.href,'infinity-learn-by-sri-chaitanya'),subtitle).length===1,'Native parent listing exact employer changed')
   const links=within(n=>n.tag==='a'&&listing.hasClass(n,'base-card__full-link'))
   check(links.length===1&&rolePath(links[0].attrs.href).endsWith('-'+id),'Native listing role identity changed')
   const times=within(n=>n.tag==='time'),date=nativeDate(times.length===1?times[0].attrs.datetime:null,{required:true})
   check(Date.parse(date.iso)<=Date.parse(new Date(now).toISOString()),'Native parent listing publication is future')
   const fact={id,title:field('base-search-card__title'),location:field('job-search-card__location'),path:rolePath(links[0].attrs.href),date}
   check(fact.title&&fact.location,'Parent listing title or location missing')
   const prior=listingRecords.get(id)
   check(!prior||prior.title===fact.title&&prior.path===fact.path&&prior.location===fact.location,'Native scoped parent role identity conflict')
   if(!prior||date.iso<prior.date.iso)listingRecords.set(id,fact)
  }
  scopeObservations.push({url,employerId:'78106236',location,observedCardCount:cards.length,reportedScopeCount:total})
 }
 const nativeCandidates=[],jobs=[]
 for(const role of SEED_ROLES){
  const url=`https://www.linkedin.com/jobs/view/${role.slug}-${role.id}`
  const doc=review(activeDocument(await read(url)))
  const primary=doc.nodes(n=>doc.hasClass(n,'top-card-layout__entity-info'))
  check(primary.length===1&&!doc.nodes(n=>n.tag==='time',primary[0]).length,'New primary role time requires earliest-publication review')
  check(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'&&rolePath(n.attrs.href)===rolePath(url)).length===1&&doc.nodes(n=>n.tag==='h1'&&doc.text(n)===role.title).length===1,'Native role canonical or title changed')
  check(doc.nodes(n=>n.tag==='a'&&doc.hasClass(n,'topcard__org-name-link')&&company(n.attrs.href,'infinity-learn-by-sri-chaitanya')&&doc.text(n)==='Infinity Learn').length===1,'Native exact parent employer changed')
  const locationNodes=doc.nodes(n=>doc.hasClass(n,'topcard__flavor--bullet'),primary[0]).filter(n=>!/^\d+ applicants$|^Be among/.test(doc.text(n)))
  check(locationNodes.length===1,'Native primary location changed')
  const location=doc.text(locationNodes[0]),country=nativeLocationCountryName(location)
  const descriptions=doc.nodes(n=>doc.hasClass(n,'show-more-less-html__markup'))
  check(descriptions.length===1,'Native explicit brand content missing')
  const brandText=doc.text(descriptions[0])
  check(/About Wiz[Kk]lub|About WizKlub/.test(brandText),'Parent role does not explicitly name configured brand')
  const prose=n=>n.inactive||['h1','h2','h3','h4','h5','h6','b','strong'].includes(n.tag)?'':n.children.map(c=>typeof c==='string'?c:prose(c)).join(' ').replace(/\s+/g,' ').trim()
  const description=prose(descriptions[0]).length>=40&&prose(descriptions[0]).split(/\s+/).length>=6?brandText:null
  const closed=/No longer accepting applications/i.test(doc.text(primary[0]))
  const enabled=doc.nodes(n=>n.tag==='button'&&doc.text(n)==='Apply'&&n.attrs['data-tracking-control-name']==='public_jobs_apply-link-onsite'&&!Object.hasOwn(n.attrs,'disabled')&&n.attrs['aria-disabled']!=='true',primary[0]).length>0
  const sameRoleSignin=doc.nodes(n=>n.tag==='a'&&n.attrs['data-tracking-control-name']==='public_jobs_nav-header-signin').some(n=>{try{const u=new URL(n.attrs.href);return u.origin==='https://www.linkedin.com'&&u.pathname==='/login'&&rolePath(u.searchParams.get('session_redirect'))===rolePath(url)}catch{return false}})
  const activeApplyVerified=!closed&&enabled&&sameRoleSignin
  const relative=doc.nodes(n=>doc.hasClass(n,'posted-time-ago__text'),primary[0]).map(n=>doc.text(n))
  const listed=listingRecords.get(role.id)
  check(!listed||listed.title===role.title&&listed.location===location&&listed.path===rolePath(url),'Native parent listing/detail role conflict')
  const candidate={...role,url,location,country,nativeEmployer:'Infinity Learn',nativeEmployerSlug:'infinity-learn-by-sri-chaitanya',nativePrimaryRelativeDate:relative[0]??null,nativePostedDate:listed?.date??null,activeApplyVerified,jobDescription:description,sourceDetailStatus:description?'complete':'partial',exclusionReason:closed?'native-role-closed':!activeApplyVerified?'active-application-unproven':country!=='India'?'missing-explicit-India-country':!listed?'missing-absolute-native-publication-date':null}
  nativeCandidates.push(candidate)
  if(!candidate.exclusionReason)jobs.push({source:'wizklub',company:'WizKlub',title:role.title,jobId:role.id,requisitionId:role.id,location,country,postingDate:listed.date.raw,nativeListingPublicationDate:listed.date.raw,nativeDetailPublicationDate:null,closingDate:null,firstEverPublication:null,sourceUrl:url,applyUrl:url,link:url,activeApplyVerified:true,firstParty:false,nativeEmployer:'Infinity Learn',nativeEmployerOrganizationId:'78106236',nativeBrandAttribution:'explicit-native-role-About-WizKlub',jobDescription:description,sourceDescription:description,sourceDetailComplete:Boolean(description),sourceDetailStatus:description?'complete':'partial',sourceDetailFailureKind:description?null:'missing-content',sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false})
 }
 return {jobs,firstParty:false,inventoryStatus:jobs.length?'discovery-only':'coverage-gap',facts:{scopeObservations,nativeCandidates,nativeObservedRecordCount:nativeCandidates.length,nativeParentListingRecordCount:listingRecords.size,lifecycleCleanupAllowed:false,sourceListingComplete:false,sourceScopeComplete:false},reason:'Native old and current brand employer filters expose no-match states; these bounded observations do not prove company emptiness. Correct parent employer 78106236 exposes twenty scoped cards; only reviewed explicitly branded roles are visited. Two active explicit-India brand roles retain earliest observed native listing dates 2026-10-16 and 2026-10-13. Primary detail cards expose relative text only; unrelated recommendation dates are excluded. Closed roles are excluded. Unvisited parent roles and incomplete brand scope prevent company totals and cleanup; corporate schema association is not a recruiting handoff.'}
}
