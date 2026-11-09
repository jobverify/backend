import reviewed from './reviewedSurfaces.json' with {type:'json'}
import {publicRead,structure,sha,norm,requireNative,error} from '../alkemlaboratories/publicRead.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {decodeLeaf} from '../bluebinaries/nativeVisibility.js'
const source='anrsoftwareprivatelimited',company='ANR Software Private Limited',entry='https://www.anrsoftware.com/career/',home='https://www.anrsoftware.com/'
const cls=(n,c)=>(n.attrs.class||'').split(/\s+/).includes(c),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),check=(ok,message)=>requireNative(ok,company,message)
const owned=(node,predicate)=>[...(predicate(node)?[node]:[]),...(node.children||[]).filter(c=>typeof c!=='string'&&!cls(c,'current-opening')).flatMap(c=>owned(c,predicate))]
const key=value=>{const u=new URL(value);return u.origin+u.pathname}
async function rendering(html,scope,phase){
 const tree=structure(html),styles=tree.nodes.filter(n=>n.tag==='link'&&n.attrs.rel==='stylesheet'&&n.attrs.media!=='print').map(n=>new URL(n.attrs.href,entry).href)
 let verified=styles.length===reviewed.stylesheets.length&&styles.every(url=>reviewed.stylesheets.some(row=>key(row.url)===key(url)))
 const issues=[]
 if(!verified)issues.push('external-stylesheet-set-changed')
 if(!same(tree.nodes.filter(n=>n.tag==='style').map(n=>sha(n.raw||'')),reviewed.inlineStyleSHA256)){verified=false;issues.push('inline-stylesheet-context-changed')}
 for(const url of styles){const known=reviewed.stylesheets.find(row=>key(row.url)===key(url));if(!known)continue;const body=await scope.read(url,{phase,kind:'css',retainBody:false});if(sha(body)!==known.sha256){verified=false;issues.push('stylesheet-bytes-changed:'+url)}}
 const published=tree.scripts.filter(s=>s.executable&&s.attrs.src).map(s=>new URL(s.attrs.src,entry).href)
 for(const client of reviewed.clients){if(!published.includes(client.url)){verified=false;issues.push('public-reveal-dependency-missing:'+client.url);continue}const body=await scope.read(client.url,{phase,kind:'javascript',retainBody:false});if(sha(body)!==client.sha256){verified=false;issues.push('public-reveal-dependency-changed:'+client.url)}}
 const inline=tree.scripts.filter(s=>s.executable&&!s.attrs.src&&/\.description-text|\.signup-modal-link/.test(s.body))
 if(!same(inline.map(s=>s.sha256),reviewed.inlineRevealSHA256)){verified=false;issues.push('inline-public-role-context-handler-changed')}
 return{verified,issues,tree,scriptStructure:tree.scripts,publicRevealProtocol:reviewed.publicRevealProtocol}
}
function qualify(audit,context){
 const tree=context.tree,cards=tree.nodes.filter(n=>cls(n,'current-opening')),byHash=new Map()
 for(const node of cards){const k=sha(JSON.stringify(node)),values=byHash.get(k)||[];values.push(node);byHash.set(k,values)}
 const publicNode=node=>{for(let n=node;n;n=tree.parents.get(n))if(n.inert||cls(n,'hide')||cls(n,'hidden'))return false;return true}
 const allowedClasses=new Set(['description-text','full-explaination','down-arrow','close-details','hide','hidden','keywords','job-category','category-name','glyphicon','glyphicon-star'])
 const supported=node=>{
  if(!publicNode(node))return true
  if((node.attrs.class||'').split(/\s+/).filter(Boolean).some(c=>!allowedClasses.has(c)))return false
  const css=node.attrs.style||''
  if(/(?:^|;)\s*(?:overflow(?:-x|-y)?|(?:max-|min-)?(?:width|height)|position|clip(?:-path)?|transform|filter|opacity|animation|text-indent|white-space|margin-left|visibility|content-visibility|display)\s*:/i.test(css)||/(?:^|;)\s*font-size\s*:\s*[+-]?0(?:[a-z%]*)(?:;|$)/i.test(css))return false
  return(node.children||[]).filter(c=>typeof c!=='string').every(supported)
 }
 const visibleText=node=>!publicNode(node)||['script','style'].includes(node.tag)?'':(node.children||[]).map(c=>typeof c==='string'?decodeLeaf(c):visibleText(c)).join(' ')
 let active=0,closed=0
 for(const row of audit.observations){
  const matches=byHash.get(sha(JSON.stringify(row.rawCardNode)))||[],card=matches.length===1?matches[0]:null
  const visible=Boolean(context.verified&&card&&publicNode(card)),branches=card?owned(card,n=>cls(n,'description-text')):[],publicBranches=branches.filter(publicNode)
  const controls=card?owned(card,n=>n.tag==='button'&&cls(n,'apply')&&cls(n,'signup-modal-link')&&publicNode(n)):[]
  const enabled=controls.filter(n=>!Object.hasOwn(n.attrs,'disabled')),disabled=controls.filter(n=>Object.hasOwn(n.attrs,'disabled'))
  const categories=card?owned(card,n=>cls(n,'job-category')).filter(publicNode):[]
  const publicText=norm([row.title,row.openingCountText,...categories.map(visibleText),...publicBranches.map(visibleText)].filter(Boolean).join(' ')),noVacancy=publicBranches.some(n=>/^No vacancy for this position now\. Visit again!$/.test(norm(visibleText(n))))
  const targets=publicBranches.flatMap(n=>owned(n,n=>cls(n,'full-explaination'))).filter(publicNode)
  const revealed=targets.length>0&&targets.every(target=>{
   const parent=tree.parents.get(target),elements=parent?.children.filter(c=>typeof c!=='string')||[],at=elements.indexOf(target),heading=elements[at-1]
   return parent&&cls(parent,'description-text')&&heading?.tag==='h4'&&owned(heading,n=>n.tag==='a'&&publicNode(n)&&norm(visibleText(n))==='Eligibility & Job Description').length===1
  })
  const criteriaSupported=[...categories,...publicBranches].every(supported)
  const activeRole=visible&&enabled.length===1&&!disabled.length&&!noVacancy&&Boolean(row.title)
  const nativeClosed=visible&&!enabled.length&&disabled.length===1&&noVacancy
  row.status=activeRole?'native-active-public-control':nativeClosed?'native-closed':'unresolved'
  row.sourceVisibilityVerified=visible;row.publicApplicationControlEnabled=visible?enabled.length===1:null
  row.publicCriteriaComplete=Boolean(activeRole&&revealed&&criteriaSupported&&/Eligibility:/.test(publicText)&&/Job Description:/.test(publicText))
  row.publicCriteriaText=row.publicCriteriaComplete?publicText:null
  row.publicObservedCriteriaText=visible?publicText:null
  row.publicCriteriaProvenance={rendererVerified:context.verified,publicRevealProved:revealed,criteriaMarkupSupported:criteriaSupported,protocol:context.publicRevealProtocol,originalCardSHA256:sha(JSON.stringify(row.rawCardNode))}
  row.sourceDetailComplete=false;row.sourceIdentityVerified=false;row.country=null;row.jobId=null
  row.remainingGaps=['native-unique-posting-identity-unavailable','explicit-role-work-country-unavailable',...(!row.publicCriteriaComplete&&activeRole?['public-full-criteria-unresolved']:[])]
  if(activeRole)active++;if(nativeClosed)closed++
 }
 return{activePublicRoleCount:context.verified?active:null,nativeClosedCardCount:context.verified?closed:null}
}
export async function runCurrentAnr(options={},inspect){
 return publicRead({source,company},options,async scope=>{
  const homepage=await scope.read(home),homeTree=structure(homepage)
  check(homeTree.doc.nodes(n=>n.tag==='title'&&/ANR Software/i.test(homeTree.text(n))).length===1&&homeTree.doc.nodes(n=>n.tag==='a'&&n.attrs.href===entry).length>0,'official corporate careers handoff changed')
  const collect=async phase=>{
   const html=await scope.read(entry,{phase}),audit=inspect(html),tree=structure(html)
   check(tree.doc.nodes(n=>n.tag==='title'&&/^Career - ANR Software Pvt Ltd\.$/i.test(tree.text(n))).length===1&&tree.doc.nodes(n=>/^h[1-6]$/.test(n.tag)&&tree.text(n)==='Current Job Openings').length===1,'native careers employer identity changed')
   const context=await rendering(html,scope,phase),counts=qualify(audit,context)
   return{audit,context,counts}
  }
  const initial=await collect('initial'),closing=await collect('closing')
  const signature=phase=>({observations:phase.audit.observations,counts:phase.counts,renderingVerified:phase.context.verified,issues:phase.context.issues})
  const closingReconciled=same(signature(initial),signature(closing)),renderingVerified=initial.context.verified&&closing.context.verified
  const evidence={status:'coverage-gap',surface:entry,firstParty:true,listingComplete:false,pagesFetched:scope.publicPages.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:scope.stamp(),reason:closingReconciled?'current-public-role-criteria-retained-native-posting-identities-and-work-countries-unavailable':'closing-native-role-card-criteria-or-controls-changed'}
  const jobs=attachInventoryEvidence([],evidence);attachSourceObservationEvidence(jobs,{source,recordKind:'mixed',observedRecordCount:initial.audit.observations.length,observedVacancyCount:initial.counts.activePublicRoleCount??0,sourceScopeComplete:false})
  await scope.audit({...initial.audit,...initial.counts,stage:'current-public-criteria-identity-and-country-gap',renderingVerified,renderingIssues:[...initial.context.issues,...closing.context.issues],closingReconciled,
   currentLiveQualification:false,noClosingProof:!closingReconciled,reasons:['unique native vacancy IDs unavailable','explicit role work countries unavailable',...(!renderingVerified?['current public renderer unverified']:[])],
   scriptStructure:[{phase:'initial',scripts:initial.context.scriptStructure},{phase:'closing',scripts:closing.context.scriptStructure}],inventoryEvidence:evidence})
  if(!closingReconciled)throw error(company,'closing native role card criteria changed')
  return jobs
 })
}
