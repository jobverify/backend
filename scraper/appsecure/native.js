import {document,norm} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {nativeDate} from '../../scraper-support/shared/nativeJobPosting.js'

export const HOME='https://www.appsecure.security/', ABOUT=HOME+'about'
export const EMPLOYER='https://www.linkedin.com/company/appsecure-security'
export const POST='https://www.linkedin.com/posts/sandeephodkasia_bugbounty-hiring-pentesting-activity-7492483018570235905-l4xZ'
export const ORGANIZATION_ID='13392021'
export function activeDocument(html){
 const doc=document(html)
 const prune=(node,inherited=false)=>{node.inactive ||= inherited || /(?:^|;)\s*content-visibility\s*:\s*hidden\s*(?:!important\s*)?(?:;|$)/i.test((node.attrs?.style||'').replace(/\/\*[\s\S]*?\*\//g,''));for(const child of node.children.filter(c=>typeof c!=='string'))prune(child,node.inactive)}
 prune(doc.root);return doc
}
export async function collectNative({read,now,gap}){
 const check=(condition,reason)=>{if(!condition)throw gap(reason)}
 const one=(rows,reason)=>{check(rows.length===1,reason);return rows[0]}
 const readDocument=async url=>{
  const doc=activeDocument(await read(url)),search=url.includes('/jobs/search/')
  const sensitive=/(?:jobposting|dateposted|datepublished|datemodified|validthrough|expir\w*|addresscountry|country|joblocation|applicantlocationrequirements)/i
  for(const node of doc.nodes(()=>true)){
   check(!['itemtype','itemprop','property','name'].some(attr=>sensitive.test(node.attrs[attr]||'')),'Unreviewed active native job/date/country/expiry microdata')
  }
  const walk=value=>{
   if(!value||typeof value!=='object')return
   if(Array.isArray(value)){value.forEach(walk);return}
   const types=Array.isArray(value['@type'])?value['@type']:[value['@type']]
   check(!types.some(type=>typeof type==='string'&&/(?:^|[/#:])JobPosting$/i.test(type)),'New active native JobPosting requires review')
   check(!Object.keys(value).some(key=>/^(?:datePosted|validThrough|expir\w*|jobLocation|applicantLocationRequirements)$/i.test(key)),'Unreviewed native job date/country/expiry schema')
   if(search)check(!Object.keys(value).some(key=>sensitive.test(key)),'New native search publication/country/expiry schema requires review')
   Object.values(value).forEach(walk)
  }
  for(const script of doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json'))walk(JSON.parse(script.raw))
  return doc
 }
 const home=await readDocument(HOME),about=await readDocument(ABOUT)
 for(const doc of [home,about])check(doc.nodes(n=>n.tag==='a'&&n.attrs.href===EMPLOYER+'/').length===1,'Active corporate employer social handoff changed')
 check(home.text(home.root).includes('AppSecure')&&about.text(about.root).includes('Sandeep Hodkasia')&&about.text(about.root).includes('Founder & CEO'),'Exact corporate employer/founder identity changed')
 check(about.nodes(n=>n.tag==='a'&&n.attrs.href==='mailto:careers@appsecure.security?subject=Careers%20%40%20Appsecure'&&about.text(n)==='Apply Now').length===1,'Corporate generic careers invitation changed')
 const employer=await readDocument(EMPLOYER)
 check(employer.text(one(employer.nodes(n=>n.tag==='h1'),'Native employer title missing'))==='AppSecure Security','Native employer title changed')
 check(employer.nodes(n=>n.attrs['data-semaphore-content-urn']==='urn:li:organization:'+ORGANIZATION_ID).length===1,'Native organization identity changed')
 check(employer.nodes(n=>n.tag==='a'&&n.attrs['data-tracking-control-name']==='about_website').some(n=>{try{const url=new URL(n.attrs.href);return url.origin==='https://www.linkedin.com'&&url.pathname==='/redir/redirect'&&url.searchParams.get('url')==='https://appsecure.security'}catch{return false}}),'Reciprocal corporate domain changed')
 const post=await readDocument(POST)
 check(post.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'&&n.attrs.href===POST).length===1,'Founder post canonical changed')
 const schema=JSON.parse(one(post.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json'),'Founder native structured evidence missing').raw)
 const allowed=new Set(['@context','@type','@id','datePublished','headline','comment','commentCount','image','articleBody','author','interactionStatistic','hasPart'])
 check(Object.keys(schema).every(k=>allowed.has(k)),'Unreviewed native publication/country/expiry contract')
 check(schema['@type']==='SocialMediaPosting'&&schema['@id']===POST&&schema.author?.name==='Sandeep H.'&&schema.author?.url==='https://www.linkedin.com/in/sandeephodkasia','Exact native founder author identity changed')
 check(schema.headline==='We are hiring bug bounty hunters in our pentesting team at Appsecure Security.','Native hiring identity changed')
 const commentary=one(post.nodes(n=>n.attrs['data-test-id']==='main-feed-activity-card__commentary'),'Active native hiring prose missing')
 const visible=post.text(commentary),nativeText=norm(schema.articleBody?.replaceAll('\\n',' '))
 check(visible===nativeText&&visible.includes('Fully remote, work from anywhere within India or Singapore')&&visible.includes('careers@appsecure.security'),'Native and active public hiring facts disagree')
 const date=nativeDate(schema.datePublished,{required:true}),at=new Date(typeof now==='function'?now():now).getTime()
 check(Number.isFinite(at)&&new Date(date.iso).getTime()<=at,'Native publication is future or invalid')
 // A social hiring invitation does not prove a currently open requisition.
 // Retain the actual old invitation, but never mint an active job from it.
 check(at-new Date(date.iso).getTime()>30*86400000,'Recent founder invitation requires active application/expiry review')
 const searches=[]
 for(const location of ['India','Worldwide']){
  const url='https://www.linkedin.com/jobs/search/?f_C='+ORGANIZATION_ID+'&location='+location,doc=await readDocument(url)
  check(doc.nodes(n=>n.tag==='input'&&n.attrs.name==='f_C'&&n.attrs.value===ORGANIZATION_ID&&Object.hasOwn(n.attrs,'checked')).length===1,'Native search employer scope changed')
  check(doc.nodes(n=>n.tag==='h1'&&doc.text(n)==='We couldn’t find a match for Jobs jobs in '+location).length===1&&!doc.nodes(n=>doc.hasClass(n,'job-search-card')).length,'Native search inventory changed; new role review required')
  searches.push({url,location,observedCards:0,wholeCompanyComplete:false})
 }
 return {jobs:[],firstParty:true,observations:{nativeEmployer:{organizationID:ORGANIZATION_ID,corporateHandoff:'active footer social link; generic careers email'},searches},
  exclusions:[{id:'7492483018570235905',nativeRecordType:'SocialMediaPosting',sourceUrl:POST,title:schema.headline,nativePublicationDate:date,nativeCountries:['India','Singapore'],nativeLocationText:'Fully remote, work from anywhere within India or Singapore',nativeApplicationInstruction:'careers@appsecure.security',nativeDescription:visible,firstParty:false,sourceDetailComplete:true,activeRequisitionVerified:false,exclusionReason:'native-publication-older-than-30-days;active-requisition-unverified'}],
  reason:'Corporate footer binds exact AppSecure Security native employer; generic careers email and independently published founder hiring invitation recovered. Founder native publication is 2026-08-10, older than 30 days, and active requisition unverified. Exact employer India and Worldwide scoped searches show no matching cards; they do not prove complete company inventory. Totals unknown; cleanup disabled.'}
}
