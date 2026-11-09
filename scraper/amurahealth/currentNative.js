import {parse} from 'acorn'
import {publicRead,structure,norm,requireNative,error} from '../alkemlaboratories/publicRead.js'
import {possibleVacancyMarkup} from '../abmknowledgeware/publicIntake.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const company='Amura Health',source='amurahealth',entry='https://amura.ai/jobs/',home='https://amura.ai/'
const check=(ok,message)=>requireNative(ok,company,message)
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
export function publicPosts(html){
 const tree=structure(html),groups=new Map()
 for(const node of tree.doc.nodes(n=>n.tag==='a'&&n.attrs.href)){
  let url;try{url=new URL(node.attrs.href,entry)}catch{continue}
  if(url.origin!=='https://amura.ai'||!/^\/jobs\/\d{4}\/\d{2}\/\d{2}\/[^/]+\/$/.test(url.pathname)||url.search||url.hash)continue
  const title=tree.text(node);if(!title||/^\d{4}-\d{2}-\d{2}$/.test(title))continue
  const values=groups.get(url.href)||new Set();values.add(title);groups.set(url.href,values)
 }
 return[...groups].map(([url,titles])=>({url,title:titles.size===1?[...titles][0]:null}))
}
export function jobsBlogIdentity(html){const t=structure(html);return t.doc.nodes(n=>n.tag==='title'&&/^Jobs at Amura\b/.test(t.text(n))).length===1&&t.doc.nodes(n=>/^h[1-6]$/.test(n.tag)&&t.text(n)==='Working at Amura').length===1}
function executableHints(body){
 let ast;try{ast=parse(body,{ecmaVersion:'latest',sourceType:'module'})}catch{return{parserStatus:'unparsed-public-script',hints:[]}}
 const pending=[ast],hints=[]
 while(pending.length){const node=pending.pop();if(node.type==='CallExpression'&&(node.callee?.name==='fetch'||node.callee?.property?.name==='get')&&typeof node.arguments?.[0]?.value==='string'&&/(?:\/(?:api\/)?(?:jobs?|positions|openings)(?:\/|\?|$)|boards-api\.greenhouse|jobs\.lever\.co)/i.test(node.arguments[0].value))hints.push({kind:'unreviewed-executable-role-client',url:node.arguments[0].value})
  for(const value of Object.values(node))if(value&&typeof value==='object'){if(Array.isArray(value))pending.push(...value.filter(v=>v&&typeof v==='object'));else pending.push(value)}
 }
 return{parserStatus:'parsed-without-execution',hints}
}
export async function runCurrentAmura(options={}){
 return publicRead({source,company},options,async scope=>{
  const companyHTML=await scope.read(home),companyTree=structure(companyHTML)
  check(/Amura Health Private Limited/i.test(companyTree.doc.text(companyTree.root)),'corporate legal employer identity changed')
  const collect=async phase=>{
   const html=await scope.read(entry,{phase});check(jobsBlogIdentity(html),'official public jobs blog identity changed')
   const posts=publicPosts(html),tree=structure(html),observations=[],possible=[],scriptStructure=[],blogNavigation=[]
   check(posts.every(row=>row.title),'ambiguous native career editorial identity')
   const pagination=tree.doc.nodes(n=>n.tag==='a'&&(/\bnext\b/i.test(n.attrs.rel||'')||/wp-block-query-pagination-(?:next|numbers)/.test(n.attrs.class||'')))
   if(pagination.length)possible.push({kind:'public-career-blog-continuation-unresolved',urls:pagination.map(n=>n.attrs.href)})
   const inspect=async(page,url)=>{
    const parsed=structure(page),record={url,scripts:parsed.scripts};scriptStructure.push(record)
    for(const row of possibleVacancyMarkup(page,url)){
     if(posts.some(post=>post.url===row.url))continue
     let target;try{target=new URL(row.url)}catch{ /* Structured role records do not require a URL. */ }
     if(target?.origin==='https://amura.ai'&&(/^\/jobs\/(?:category|tag|author)\//.test(target.pathname)||target.hash==='#wp--skip-link--target'&&row.text==='Skip to content')){blogNavigation.push(row);continue}
     possible.push(row)
    }
    for(const script of record.scripts.filter(s=>s.executable)){
     let body=script.body
     if(script.attrs.src){const asset=new URL(script.attrs.src,url);if(asset.origin!=='https://amura.ai')continue;body=await scope.read(asset.href,{phase,kind:'javascript',retainBody:false})}
     const assessment=executableHints(body);Object.assign(script,assessment);possible.push(...assessment.hints.map(row=>({...row,publishedByPage:url,clientSHA256:script.sha256})))
    }
   }
   await inspect(html,entry)
   for(const post of posts){
    const page=await scope.read(post.url,{phase}),parsed=structure(page),heads=parsed.doc.nodes(n=>n.tag==='h1'&&parsed.text(n)===post.title)
    check(heads.length===1,'public career editorial title/detail binding changed')
    const fullPublicText=norm(parsed.doc.text(parsed.root));check(fullPublicText.length>post.title.length,'public career editorial full content missing')
    observations.push({kind:'public-career-editorial-content',url:post.url,title:post.title,fullPublicText,vacancy:null,jobId:null,country:null,postingDate:null,closingDate:null,sourceDetailComplete:false,publicationDateContext:'native blog date is not a job publication date'})
    await inspect(page,post.url)
   }
   return{posts,observations,possible,scriptStructure,blogNavigation}
  }
  const initial=await collect('initial'),closing=await collect('closing'),closingMatches=same(initial.posts,closing.posts)&&same(initial.observations,closing.observations),possible=[...initial.possible,...closing.possible]
  const evidence={status:'coverage-gap',surface:entry,firstParty:true,listingComplete:false,pagesFetched:scope.publicPages.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:scope.stamp(),reason:possible.length?'public-native-role-or-continuation-discovery-requires-collector':closingMatches?'public-career-editorial-has-no-enumerable-native-vacancy-inventory':'closing-public-career-content-changed'}
  const jobs=attachInventoryEvidence([],evidence);attachSourceObservationEvidence(jobs,{source,recordKind:'hiring-signals',observedRecordCount:initial.observations.length,observedVacancyCount:0,sourceScopeComplete:false})
  await scope.audit({observations:initial.observations,closingMatches,possibleVacancyMarkup:possible,unresolvedBlogArchives:initial.blogNavigation.filter(row=>/\/jobs\/(?:category|tag|author)\//.test(row.url)),scriptStructure:[...initial.scriptStructure,...closing.scriptStructure],inventoryEvidence:evidence,sourceScopeComplete:false,companyLegalIdentity:'Amura Health Private Limited'})
  if(possible.length)throw error(company,'public native role or continuation requires a collector','PUBLIC_NATIVE_ROLE_COLLECTOR_REQUIRED')
  if(!closingMatches)throw error(company,'closing public career content changed')
  return jobs
 })
}
