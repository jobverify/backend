import {nativeDate} from '../../scraper-support/shared/nativeJobPosting.js'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
export const EMPLOYER_URL='https://www.linkedin.com/company/giottus/'
export const HOME_URL='https://www.giottus.com/'
export const INDIA_LISTING_URL='https://www.linkedin.com/jobs/search/?f_C=13603844&location=India'
export const WORLDWIDE_LISTING_URL='https://www.linkedin.com/jobs/search/?f_C=13603844&location=Worldwide'
export const activeDocument=html=>{
 const doc=document(html)
 const prune=(node,inherited=false)=>{
  node.inactive ||= inherited || /(?:^|;)\s*content-visibility\s*:\s*hidden\s*(?:!important\s*)?(?:;|$)/i.test((node.attrs?.style||'').replace(/\/\*[\s\S]*?\*\//g,''))
  for(const child of node.children.filter(value=>typeof value!=='string'))prune(child,node.inactive)
 }
 prune(doc.root)
 return doc
}
export const POST_URL='https://www.linkedin.com/posts/giottus_hiring-jobs-bengalurujobs-activity-7480196975502573570-awU_'
export const WELLFOUND_URL='https://wellfound.com/company/giottus/jobs'
const check=(condition,reason)=>{if(!condition)throw new Error(reason)}
const containsJob=value=>Array.isArray(value)?value.some(containsJob):value&&typeof value==='object'&&([value['@type']].flat().includes('JobPosting')||Object.values(value).some(containsJob))
const sensitive=/^(?:datePublished|datePosted|dateModified|validThrough|closingDate|expiryDate|expirationDate|expiresAt|addressCountry|country|jobLocation)$/i
const assertNoUnreviewedMarkup=doc=>check(!doc.nodes(n=>Object.hasOwn(n.attrs,'itemprop')||/JobPosting/i.test(n.attrs.itemtype||'')||n.tag==='meta'&&sensitive.test(n.attrs.name||n.attrs.property||'')).length,'New native country, publication, expiry or JobPosting markup requires review')
const assertNoNestedFields=(value,root=true)=>{if(!value||typeof value!=='object')return;for(const [k,v] of Object.entries(value)){check(!(sensitive.test(k)&&!(root&&k==='datePublished')),'New nested social date, country or expiry requires review');assertNoNestedFields(v,false)}}
const structured=doc=>doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').map(n=>JSON.parse(n.raw))
export const collectGiottusNative=async({read,now})=>{
 const home=activeDocument(await read(HOME_URL))
 const graphs=structured(home)
 const organizations=graphs.flatMap(v=>v['@graph']||[v]).filter(v=>[v['@type']].flat().includes('Organization'))
 check(organizations.length===1&&organizations[0].legalName==='Giottus Technologies Pvt Ltd'
  &&organizations[0]['@id']==='https://www.giottus.com/#organization'&&organizations[0].name==='Giottus'
  &&organizations[0].url==='https://www.giottus.com'
  &&organizations[0].sameAs?.includes('https://linkedin.com/company/giottus'),'Official organization identity or employer association changed')
 check(!graphs.some(containsJob),'New corporate JobPosting fields require country, public-date, expiry and application reconciliation')
 const employer=activeDocument(await read(EMPLOYER_URL))
 check(employer.nodes(n=>n.tag==='h1'&&employer.text(n)==='Giottus Crypto Platform').length===1
  &&employer.nodes(n=>n.attrs['data-semaphore-content-urn']==='urn:li:organization:13603844').length===1,'Exact native employer identity changed')
 check(employer.nodes(n=>n.tag==='a'&&n.attrs['data-tracking-control-name']==='about_website').some(n=>{
  try{const u=new URL(n.attrs.href);return u.origin==='https://www.linkedin.com'&&u.pathname==='/redir/redirect'&&new URL(u.searchParams.get('url')).href===HOME_URL}catch{return false}
 }),'Native reciprocal corporate domain changed')
 check(employer.text(employer.root).includes('Chennai, tamil nadu 600041, IN'),'Native employer address changed')
 for(const [url,location] of [[INDIA_LISTING_URL,'India'],[WORLDWIDE_LISTING_URL,'Worldwide']]){
  const listing=activeDocument(await read(url))
  assertNoUnreviewedMarkup(listing)
  check(listing.nodes(n=>n.tag==='input'&&n.attrs.name==='f_C'&&n.attrs.value==='13603844'&&Object.hasOwn(n.attrs,'checked')).length===1,'Exact native employer scope changed')
  check(listing.nodes(n=>n.tag==='h1'&&listing.text(n)==='We couldn\u2019t find a match for Jobs jobs in '+location).length===1
   &&listing.nodes(n=>listing.hasClass(n,'job-search-card')).length===0,'Native scoped listing changed; role identity, explicit country, earliest public date, expiry and active application review required')
  check(!structured(listing).some(containsJob)
   &&!listing.nodes(n=>n.tag==='meta'&&/^(?:datePosted|validThrough|closingDate|expiryDate|addressCountry|jobLocation)$/i.test(n.attrs.itemprop||n.attrs.name||n.attrs.property||'')).length,
  'New native country, publication or expiry fields require review')
 }
 const post=activeDocument(await read(POST_URL))
 const postings=structured(post).filter(v=>v['@type']==='SocialMediaPosting')
 check(postings.length===1,'Native social posting schema changed')
 const posting=postings[0]
 assertNoUnreviewedMarkup(post)
 assertNoNestedFields(posting)
 check(posting['@id']===POST_URL&&posting.author?.name==='Giottus Crypto Platform'&&posting.author?.url==='https://in.linkedin.com/company/giottus'
  &&posting.headline==='We are Hiring: Customer Engagement Executives','Native social employer, identifier or title changed')
 const allowed=new Set(['@context','@type','@id','datePublished','headline','comment','commentCount','image','articleBody','author','interactionStatistic','hasPart'])
 check(Object.keys(posting).every(k=>allowed.has(k)),'New social metadata requires native country, earliest-public-date and expiry review')
 check(!post.nodes(n=>n.tag==='meta'&&/^(?:datePosted|dateModified|validThrough|closingDate|expiryDate|addressCountry|jobLocation)$/i.test(n.attrs.itemprop||n.attrs.name||n.attrs.property||'')).length,'New social date, country or expiry metadata requires review')
 const nativePostedDate=nativeDate(posting.datePublished,{required:true})
 check(Date.parse(nativePostedDate.iso)<=Date.parse(new Date(now).toISOString()),'Native social publication is future')
 check(typeof posting.articleBody==='string'&&posting.articleBody.includes('Location : Bengaluru (Work from Office)')
  &&posting.articleBody.includes('Apply now: hr@giottus.com')&&post.text(post.root).includes('Location : Bengaluru (Work from Office)'), 'Native social location or application changed')
 check(!/Location\s*:[^\n]*\bIndia\b/.test(posting.articleBody.replaceAll('\\n','\n')),'New explicit job country requires review')
 let blocked=false
 try{await read(WELLFOUND_URL)}catch(error){if(error.status!==403)throw error;blocked=true}
 check(blocked,'Official-linked Wellfound is newly accessible; native employer, country, publication, expiry and application review required')
 const excludedNativeCandidates=[{id:'7480196975502573570',title:'Customer Engagement Executives',sourceURL:POST_URL,nativePostedDate,country:null,location:'Bengaluru (Work from Office)',applicationEmail:'hr@giottus.com',exclusionReason:'missing-explicit-job-country'}]
 return {jobs:[],inventoryStatus:'coverage-gap',firstParty:false,facts:{excludedNativeCandidates,wellfoundStatus:403,nativeEmployerId:'13603844',scopedSearchObservedCards:0,sourceListingComplete:false,sourceScopeComplete:false},
  reason:'Exact native Giottus employer and reciprocal official corporate domain verified. Employer-filtered India and Worldwide searches each expose an explicit no-match state and no active job cards. This bounded native observation does not establish whole-company emptiness; Corporate-associated Wellfound jobs returns HTTP403, leaving native scope unresolved. A native employer-authored social candidate has public date 2026-07-07 and city-only Bengaluru; excluded without inferring country. Corporate social identity association is not a careers handoff. Whole-company counts unknown and lifecycle cleanup disabled.'}
}
