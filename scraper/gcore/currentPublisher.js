import {createHash} from 'node:crypto'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {matchesStaticActivationClass} from './staticActivationClass20261107.js'

export const CURRENT_POSITIONS_URL='https://gcore.com/open-positions'
const MAIN='/main-O7XHEPYM.js'
// Genuine published component chain: main/custom route -> PageBuilder ->
// HtmlBlock -> widget registry -> VacanciesBlock -> vacancies service + env.
// Whole programs are pinned; dormant legacy CareersPage is not authority.
const resources=[
 ['main-O7XHEPYM.js','8bff7ca44a7443ee99edaefb043b1e24bee9ea3ca1fb86b819342820c52598b6'],
 ['chunk-WZK643GZ.js','9fb80280234a79d1ff306688e926185ce0f74258ca0c163c86d2ae2c73827a85'],
 ['chunk-ZYYTB62G.js','6a40a1fa70328cb1c8453d124725c35263099acf0ce0e33a9b7f2f8d4580cd70'],
 ['chunk-AUQ3PF4O.js','b5dfaf4f2815b0c3c40b1e0e13e707a7f09f024b0db9eeb0dda8422a0eaed0fe'],
 ['chunk-4WYRUOC6.js','1a7ae25faed4a4f99718e5afa7996e40e85d5b412e4f5ed66e0f0fd6b2e7d124'],
 ['chunk-F5DBS3U6.js','dc452782f464f8022689caf16409dbe30078e78ded658b41f90e580621e9f518'],
 ['chunk-ZZ33WBZD.js','47a22ea014d09a16963c3e70ddc46f54d61d23f0e18545c62f1d0cbc7b07e07b'],
 ['chunk-A4TY22EA.js','58d192d1cfbf6d8c1e1185374ce92e5fa0781df6641753898c18118279c2a021'],
]
const requireProof=(ok,message)=>{if(!ok)throw Object.assign(Error('Gcore current publisher: '+message),{incompleteScope:true,abortRetries:true,softFailure:true,upstreamOutage:false,failureKind:'surface_drift_or_fail_closed',lifecycleCleanupAllowed:false})}
// Complete genuine retained document activation profiles. Each fingerprint
// binds base placement/attributes, every script's placement/attributes/order/
// complete body hash (including inline antiBot and hydration programs), and
// event/frame/script-URL carriers. The separate finite issued-data class only
// compares seven typed literal spans; no values are executed or forwarded.
const reviewedActivations={
 'https://gcore.com/careers':[
  'f1ce72c0ee3498c11d954e0ff3ae07274ae7a16647de1178a86979215040b896',
  '216dc67745884fc11eb02c4ca556b2912fbff3b495dd9b1b67f2737cb5f241a7',
  '6c8aee8ece95f73625fecf3d0da936f200283ceb8665e02041aee7fe38254409',
 ],
 'https://gcore.com/open-positions':[
  '575bb2d8ceb20d1ad98d78753db623761dd0e4ade578463992fc1c8872625a03',
  'ffccfe0670fa1707bfec0cbd987c3851cca5a6786dc18f5eb61f29b8c8980cf5',
  '76b55fb163230cf1b18e56964a394533a0546abd3bdfccf6b98174a0da5d0235',
 ],
}
const sha=body=>createHash('sha256').update(body).digest('hex')
const ordered=object=>Object.fromEntries(Object.entries(object).sort(([a],[b])=>a.localeCompare(b)))
const activationNodes=html=>{
 const document=readNativeDocument(html),root=document.nodes(n=>n.tag==='root')[0]
 // Visibility does not disable HTML scripts/base/event handlers. Inspect the
 // complete parsed tree, including hidden nodes, rather than active text only.
 const walk=(node,path)=>[{node,path},...node.children.filter(child=>typeof child!=='string')
  .flatMap((child,index)=>walk(child,[...path,[child.tag,index]]))]
 return walk(root,[['root',0]])
}
export const verifyCurrentDocumentActivation=(html,url)=>{
 const nodes=activationNodes(html),bases=nodes.filter(({node})=>node.tag==='base')
 requireProof(reviewedActivations[url]&&bases.length===1&&bases[0].path.some(([tag])=>tag==='head')
  &&JSON.stringify(ordered(bases[0].node.attrs))===JSON.stringify({href:'/'})
  &&new URL(MAIN,new URL(bases[0].node.attrs.href,url)).href==='https://gcore.com'+MAIN,
  'unreviewed or ambiguous document base URI')
 const scripts=nodes.filter(({node})=>node.tag==='script')
  .map(({node,path})=>({path,attrs:ordered(node.attrs),bodySha256:sha(node.raw??'')}))
 const carriers=nodes.filter(({node})=>['iframe','object','embed'].includes(node.tag)
  ||node.tag==='meta'&&String(node.attrs['http-equiv']).toLowerCase()==='refresh'
  ||Object.entries(node.attrs).some(([key,value])=>/^on/i.test(key)||key==='srcdoc'||/^\s*(?:javascript|vbscript):/i.test(value)))
  .map(({node,path})=>({tag:node.tag,path,attrs:ordered(node.attrs)}))
 const activation={bases:bases.map(({node,path})=>({path,attrs:ordered(node.attrs)})),scripts,carriers}
 const signature=sha(JSON.stringify(activation))
 requireProof(reviewedActivations[url].includes(signature)
  ||matchesStaticActivationClass(url,activation,nodes.filter(({node})=>node.tag==='script').map(({node})=>node.raw??'')),
  'unreviewed complete document activation programs: '+url+' SHA256 '+signature)
 return signature
}
const descendants=(node,test)=>node.children.filter(child=>typeof child!=='string').flatMap(child=>[...(test(child)?[child]:[]),...descendants(child,test)])
const activeMain=(html,url)=>{
 verifyCurrentDocumentActivation(html,url)
 const doc=readNativeDocument(html)
 const scripts=doc.nodes(n=>n.tag==='script'&&n.attrs.src)
 const main=scripts.filter(n=>/^\/?main-[\w]+\.js$/.test(n.attrs.src)||n.attrs.src.startsWith('https://gcore.com/main-'))
 requireProof(scripts.length===1&&main.length===1&&main[0].attrs.src===MAIN&&main[0].attrs.type==='module'
  &&!Object.hasOwn(main[0].attrs,'nomodule')&&!Object.hasOwn(main[0].attrs,'integrity'),'unreviewed main program or activation')
}
const mountedVacancies=html=>{
 const raw=readNativeDocument(html),visible=readVisibleNativeDocument(html,{strict:true})
 const test=n=>n.attrs['data-block-type']==='widgets.vacancies'
 const all=raw.nodes(test),active=visible.nodes(test)
 const pages=visible.nodes(n=>n.tag==='gcore-page-builder-site-page')
 const blocks=pages.flatMap(page=>descendants(page,n=>n.tag==='gcore-html-block'))
 requireProof(all.length===1&&active.length===1&&pages.length===1&&blocks.length===1
  &&active[0].tag==='div'&&Object.hasOwn(active[0].attrs,'data-angular-vacancies')
  &&descendants(blocks[0],test).length===1,'vacancy widget mount missing, hidden, or ambiguous')
}
export const declaresCurrentOpenPositions=html=>{
 const document=readNativeDocument(html)
 return document.nodes(n=>n.tag==='a'&&n.attrs.href==='/open-positions'
  &&descendants(n,child=>child.tag==='h3'&&document.text(child).trim()==='Open positions').length>0).length>0
}

export const verifyCurrentPublisher=async({official,readPage,verifyNavigation})=>{
 verifyNavigation(official,'/open-positions')
 activeMain(official,'https://gcore.com/careers')
 const page=await readPage(CURRENT_POSITIONS_URL)
 requireProof(page?.status===200&&page.url===CURRENT_POSITIONS_URL&&/^text\/html\b/i.test(page.contentType??'')
  &&typeof page.body==='string'&&Buffer.byteLength(page.body)<=4000000,'positions response status/URL/MIME/cap changed')
 verifyNavigation(page.body,'/open-positions')
 activeMain(page.body,CURRENT_POSITIONS_URL)
 mountedVacancies(page.body)
 const receipts=[]
 for(const[file,expected]of resources){
  const url='https://gcore.com/'+file,response=await readPage(url)
  requireProof(response?.status===200&&response.url===url&&/^(?:application|text)\/javascript\b/i.test(response.contentType??'')
   &&typeof response.body==='string'&&Buffer.byteLength(response.body)<=4000000,'client response status/URL/MIME/cap changed: '+file)
  const sha256=createHash('sha256').update(response.body).digest('hex')
  requireProof(sha256===expected,'unreviewed complete mounted vacancy program: '+file)
  receipts.push({url,sha256,bytes:Buffer.byteLength(response.body),status:response.status,contentType:response.contentType})
 }
 return{surface:CURRENT_POSITIONS_URL,declaredAPI:'https://api.smartrecruiters.com/v1/companies/Gcore/postings',declaredLimit:100,
  generalApplicationUsedAsAuthority:false,staticPreviewUsedAsVacancies:false,resources:receipts}
}
