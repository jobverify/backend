import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'

export const HOME_URL='https://www.supergrad.co.in/'
// The public search index describes an EDGE training/admissions provider at this
// exact domain. It does not establish a native employer vacancy inventory.
export const collectSupergradNative=async({read})=>{
 const body=await read(HOME_URL),doc=document(body)
 const prune=(node,hidden=false)=>{node.inactive ||= hidden||/(?:^|;)\s*content-visibility\s*:\s*hidden\s*(?:!important\s*)?(?:;|$)/i.test((node.attrs?.style||'').replace(/\/\*[\s\S]*?\*\//g,''));for(const child of node.children.filter(v=>typeof v!=='string'))prune(child,node.inactive)}
 prune(doc.root)
 const text=doc.text(doc.root)
 if(/cloudflare|connection timed out|error code\s*522|checking your browser|just a moment|verify you are human/i.test(text))throw Error('Official domain origin/challenge unavailable; no native inventory verified')
 const schemas=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').map(n=>JSON.parse(n.raw))
 const review=value=>{
  if(!value||typeof value!=='object')return
  if([value['@type']].flat().includes('JobPosting')||Object.keys(value).some(k=>/^(?:addressCountry|country|datePosted|datePublished|dateModified|validThrough|closingDate|expiryDate|expirationDate|jobLocation|hiringOrganization)$/i.test(k)))throw Error('New structured role country, publication, expiry and application requires review')
  Object.values(value).forEach(review)
 }
 schemas.forEach(review)
 if(doc.nodes(n=>/JobPosting/i.test(n.attrs.itemtype||'')||/(?:^|\s)(?:addressCountry|country|jobLocation|hiringOrganization|datePosted|datePublished|dateModified|validThrough|closingDate|expiryDate)(?:\s|$)/i.test(n.attrs.itemprop||'')||n.tag==='meta'&&/^(?:addressCountry|country|jobLocation|datePosted|datePublished|dateModified|validThrough|closingDate|expiryDate)$/i.test(n.attrs.name||n.attrs.property||'')).length)throw Error('New native role country/date/expiry microdata requires review')
 if(!/Supergrad/i.test(text)||!/professional certification and training organisation/i.test(text)||!doc.nodes(n=>n.tag==='a'&&n.attrs.href==='mailto:contact@supergrad.co.in').length)throw Error('Exact co.in training employer identity unverified; UK SuperGrad and TopRankers Supergrads are not substitutes')
 const discoveredRecruitingLinks=doc.nodes(n=>n.tag==='a'&&/careers?(?:\/|$)|\/jobs(?:\/|$)|join\s+(?:our|the)\s+team|work\s+with\s+us|current\s+openings/i.test((n.attrs.href||'')+' '+doc.text(n))).map(n=>({label:doc.text(n),href:n.attrs.href}))
 throw Object.assign(Error(discoveredRecruitingLinks.length?'New potential employer recruiting handoff requires exact employer, role country, earliest publication, expiry and same-role application review':'Exact training homepage is readable but admissions, course projects and placement claims do not establish employer vacancy inventory'),{discoveredRecruitingLinks})
}
