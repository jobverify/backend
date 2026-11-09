import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
export const EMPLOYER_URL='https://www.linkedin.com/company/classklap/'
export const ORGANIZATION_ID='18717228'
export const activeDocument=html=>{
 const doc=document(html)
 const prune=(n,hidden=false)=>{n.inactive ||= hidden||/(?:^|;)\s*content-visibility\s*:\s*hidden\s*(?:!important\s*)?(?:;|$)/i.test((n.attrs?.style||'').replace(/\/\*[\s\S]*?\*\//g,''));for(const c of n.children.filter(v=>typeof v!=='string'))prune(c,n.inactive)}
 prune(doc.root);return doc
}
const check=(ok,reason)=>{if(!ok)throw Error(reason)}
const sensitive=/^(?:datePublished|datePosted|dateModified|validThrough|closingDate|expiryDate|expirationDate|expiresAt|addressCountry|country|jobLocation)$/i
const companyMatches=value=>{try{const u=new URL(value);return u.protocol==='https:'&&['www.linkedin.com','in.linkedin.com'].includes(u.hostname)&&u.pathname.replace(/\/$/,'')==='/company/classklap'}catch{return false}}
const review=doc=>{
 check(!doc.nodes(n=>Object.hasOwn(n.attrs,'itemprop')||/JobPosting/i.test(n.attrs.itemtype||'')||n.tag==='meta'&&sensitive.test(n.attrs.name||n.attrs.property||'')).length,'New native microdata country, publication, expiry or role requires review')
 const visit=(value,corporate=false)=>{
  if(!value||typeof value!=='object')return
  check(![value['@type']].flat().includes('JobPosting'),'New native JobPosting country, publication, expiry and application require review')
  for(const [key,v] of Object.entries(value)){
   check(!sensitive.test(key)||corporate&&key==='addressCountry'&&v==='IN','New native country, earliest publication or expiry requires review')
   visit(v,key==='address'&&value['@type']==='Organization'&&value.name==='ClassKlap'&&companyMatches(value.url))
  }
 }
 for(const n of doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json'))visit(JSON.parse(n.raw))
}
export const collectClassKlapNative=async({read})=>{
 const employer=activeDocument(await read(EMPLOYER_URL));review(employer)
 check(employer.nodes(n=>n.tag==='h1'&&employer.text(n)==='ClassKlap').length===1&&employer.nodes(n=>n.attrs['data-semaphore-content-urn']==='urn:li:organization:'+ORGANIZATION_ID).length===1,'Exact native ClassKlap employer identity changed')
 check(employer.nodes(n=>n.tag==='a'&&n.attrs['data-tracking-control-name']==='about_website').some(n=>{try{const u=new URL(n.attrs.href);return u.origin==='https://www.linkedin.com'&&u.pathname==='/redir/redirect'&&new URL(u.searchParams.get('url')).href==='http://www.classklap.com/'}catch{return false}}),'Native reciprocal corporate website changed')
 // The captured employer feed contains no structured vacancy or role link. Any
 // newly exposed role requires country, earliest-date, expiry and Apply review.
 check(employer.nodes(n=>n.tag==='a'&&/\/jobs\/view\//.test(n.attrs.href||'')).length===0,'New employer role link requires native vacancy review')
 const observations=[]
 for(const location of ['India','Worldwide']){
  const url='https://www.linkedin.com/jobs/search/?f_C='+ORGANIZATION_ID+'&location='+location
  const listing=activeDocument(await read(url));review(listing)
  check(listing.nodes(n=>n.tag==='input'&&n.attrs.name==='f_C'&&n.attrs.value===ORGANIZATION_ID&&Object.hasOwn(n.attrs,'checked')).length===1,'Exact checked native employer scope changed')
  const cards=listing.nodes(n=>listing.hasClass(n,'job-search-card'))
  check(cards.length===0&&listing.nodes(n=>n.tag==='h1'&&listing.text(n)==='We couldn\u2019t find a match for Jobs jobs in '+location).length===1,'Native listing changed; role country, earliest-public-date, expiry and active application require review')
  observations.push({url,location,observedNativeCardCount:cards.length,explicitNoMatch:true,wholeCompanyInventoryComplete:false})
 }
 const jobs=observations.flatMap(observation=>{check(observation.explicitNoMatch&&observation.observedNativeCardCount===0,'Unreviewed native inventory');return []})
 return {jobs,firstParty:false,inventoryStatus:'coverage-gap',facts:{nativeEmployerId:ORGANIZATION_ID,observations,nativeObservedRecordCount:0,sourceListingComplete:false,sourceScopeComplete:false},reason:'Exact native ClassKlap employer 18717228 reciprocates classklap.com. Exact checked employer-filtered India and Worldwide searches show no-match states. This bounded public observation does not establish whole-company emptiness; the corporate domain was expired in separate capture, and no official recruiting handoff is proven. Whole-company and India inventory counts remain unknown; coverage-gap and lifecycle cleanup disabled.'}
}
