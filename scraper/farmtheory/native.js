import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
export const HOME_URL='https://farmtheory.in/'
export const EMPLOYER_URL='https://www.linkedin.com/company/farmtheory'
const check=(ok,reason)=>{if(!ok)throw Error(reason)}
const review=doc=>{
 const posting=v=>v&&typeof v==='object'&&([v['@type']].flat().includes('JobPosting')||Object.values(v).some(posting))
 for(const n of doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json'))check(!posting(JSON.parse(n.raw)),'New JobPosting requires country, earliest date, expiry and active application review')
 check(!doc.nodes(n=>/JobPosting/i.test(n.attrs.itemtype||'')||/(?:^|\s)(?:addressCountry|jobLocation|datePosted|datePublished|validThrough|closingDate|expiryDate)(?:\s|$)/i.test(n.attrs.itemprop||'')).length,'New native role metadata requires review')
 return doc
}
export const collectFarmTheoryNative=async({read})=>{
 const home=review(document(await read(HOME_URL)))
 check(home.text(home.root).includes('Farmtheory')&&home.nodes(n=>n.tag==='h1'&&home.text(n)==='Great produce doesn’t have to look perfect.').length===1,'Corporate identity changed')
 check(!home.nodes(n=>n.tag==='a'&&/careers?|vacanc|hiring|jobs|lever|greenhouse|workable|ashby/i.test((n.attrs.href||'')+' '+home.text(n))).length,'New corporate recruiting handoff requires review')
 // A corporate storefront or an access gate cannot establish vacancy emptiness.
 // Do not infer vacancy country from headquarters or refresh publication from capture time.
 const employer=review(document(await read(EMPLOYER_URL)))
 check(employer.nodes(n=>n.tag==='h1'&&employer.text(n)==='Farmtheory').length===1&&employer.nodes(n=>n.attrs['data-semaphore-content-urn']==='urn:li:organization:94727677').length===1,'Exact employer identity changed')
 check(employer.nodes(n=>n.tag==='a'&&n.attrs['data-tracking-control-name']==='about_website').some(n=>{try{const u=new URL(n.attrs.href);return u.origin==='https://www.linkedin.com'&&u.pathname==='/redir/redirect'&&new URL(u.searchParams.get('url')).href==='http://farmtheory.in/'}catch{return false}}),'Reciprocal corporate domain changed')
 for(const location of ['India','Worldwide']){
  const listing=review(document(await read('https://www.linkedin.com/jobs/search/?f_C=94727677&location='+location)))
  check(listing.nodes(n=>n.tag==='input'&&n.attrs.name==='f_C'&&n.attrs.value==='94727677'&&Object.hasOwn(n.attrs,'checked')).length===1,'Native exact employer scope changed')
  check(listing.nodes(n=>n.tag==='h1'&&listing.text(n)==='We couldn’t find a match for Jobs jobs in '+location).length===1&&!listing.nodes(n=>listing.hasClass(n,'job-search-card')).length,'Native vacancy listing changed; country, earliest publication, expiry and active application review required')
 }
 throw Error('Observed exact employer 94727677 India and Worldwide no-match searches; corporate storefront has no recruiting handoff. Whole-company inventory unknown; no active eligible vacancy verified, cleanup prohibited')
}
