import {createHash} from 'node:crypto'
import {types,isDeepStrictEqual} from 'node:util'
import {readNativeDocument,readNativeAttributeTokens,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {parseEightfoldJson} from '../../scraper-support/utils/recruitmentEightfoldData.js'
import {certifyAshbyRendererSource} from '../../scraper-support/utils/ashbyRendererSourceCertificate20261111.js'

export const CORPORATE='https://front.com/jobs'
export const FEED=CORPORATE+'/feed'
export const BOARD='https://jobs.ashbyhq.com/frontcareers'
export const API='https://api.ashbyhq.com/posting-api/job-board/frontcareers'
export const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/
export const sha=value=>createHash('sha256').update(value).digest('hex')
export const failure=(reason,message)=>Object.assign(Error('[front] '+message),{code:'FRONT_PROGRAMME_HOLD',reason,
  softFailure:true,failureKind:'coverage_gap',upstreamOutage:false,abortRetries:true})
export const need=(condition,reason,message)=>{if(!condition)throw failure(reason,message)}
export const shape=(value,names,reason)=>need(value&&typeof value==='object'&&!Array.isArray(value)
  &&isDeepStrictEqual(Object.keys(value).sort(),[...names].sort()),reason,'Unreviewed original field model')
export function originalJSON(text){
  try{return parseEightfoldJson(text)}catch(error){throw failure('json','Original JSON rejected: '+error.message)}
}
const plain=value=>value&&typeof value==='object'&&!types.isProxy(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value))
function data(value,key,reason){
  need(plain(value),reason,'Expected an original plain data record')
  const descriptor=Object.getOwnPropertyDescriptor(value,key)
  need(descriptor&&Object.hasOwn(descriptor,'value'),reason,'Original own data field unavailable: '+key)
  return descriptor.value
}
export function originalHeaders(headers,headerEntries){
  need(plain(headers),'security','Original header view unavailable')
  const result={}
  for(const name of Object.keys(headers)){
    const value=data(headers,name,'security'),key=name.toLowerCase()
    need(!Object.hasOwn(result,key)&&typeof value==='string','security','Ambiguous original response header')
    result[key]=value
  }
  if(headerEntries!==null&&headerEntries!==undefined){
    need(Array.isArray(headerEntries)&&!types.isProxy(headerEntries),'security','Invalid original header entries')
    const second={}
    for(const pair of headerEntries){
      need(Array.isArray(pair)&&!types.isProxy(pair)&&pair.length===2&&pair.every(v=>typeof v==='string'),'security','Invalid original header entry')
      const key=pair[0].toLowerCase()
      need(!Object.hasOwn(second,key),'security','Duplicate original response header');second[key]=pair[1]
    }
    need(isDeepStrictEqual(result,second),'security','Original header views disagree')
  }
  return result
}
export const active=({node,ancestors})=>!node.inert&&!node.nativeTagUnqualified
  &&!ancestors.some(n=>n.inert||n.nativeTagUnqualified||['svg','math','template','noscript','object'].includes(n.tag))
export function frontDocument(text){
  const document=readNativeDocument(text),entries=[]
  const visit=(node,ancestors)=>{
    entries.push({node,ancestors})
    for(const child of node.children)if(typeof child!=='string')visit(child,[...ancestors,node])
  }
  visit(document.nodes(n=>n.tag==='root')[0],[])
  return {document,entries}
}
export function identityAttributes(html){
  for(const match of html.matchAll(/<([a-z][^\s/>]*)\s+([^>]*)>/gi)){
    const tokens=readNativeAttributeTokens(match[2]),tag=match[1].toLowerCase()
    if(!['script','meta','link'].includes(tag)&&!tokens.some(([name,value])=>name==='id'&&['root','csp-nonce','__NEXT_DATA__'].includes(decodeNativeEntities(value))))continue
    const seen=new Set()
    for(const [name] of tokens){need(!seen.has(name),'native-carrier','Duplicate identity attribute');seen.add(name)}
  }
}
const securityNames=['content-security-policy','content-security-policy-report-only','x-content-type-options','cross-origin-embedder-policy',
  'cross-origin-opener-policy','cross-origin-resource-policy','permissions-policy','document-policy','x-frame-options']
const controlHeaders=['refresh','location','content-location','content-disposition','www-authenticate','proxy-authenticate','authentication-info',
  'proxy-authentication-info','cf-mitigated','cf-chl-out','cf-chl-bypass','x-captcha','x-captcha-required','x-challenge']
function nativeSecurity(headers,nonce){
  need(/^text\/html(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?\s*$/i.test(headers['content-type']||''),'encoding','Native HTML declaration must be UTF8')
  need(controlHeaders.every(name=>!Object.hasOwn(headers,name)),'security','Unreviewed native navigation/authentication/challenge header')
  const policy=headers['content-security-policy'],token="'nonce-"+nonce+"'"
  need(typeof policy==='string'&&policy.split(';').filter(d=>/^\s*script-src\s/.test(d)).length===1
    &&policy.split(';').find(d=>/^\s*script-src\s/.test(d)).trim().split(/\s+/).filter(v=>v===token).length===1
    &&[...policy.matchAll(/'nonce-[^']+'/g)].length===1,'security','Enforced CSP does not bind the original nonce')
  const original=Object.fromEntries(securityNames.map(name=>[name,headers[name]??null])),comparison={...original,
    'content-security-policy':policy.replace(token,"'nonce-[BOUND_NATIVE_NONCE]'")}
  const hash=sha(JSON.stringify(comparison))
  need(['86b662a993d53ad147f8931cd6861b8938a3353141e8f351c22e188d35e75866',
    'f748d4d78eaf1f5e5e9c37ab8d032fcc897e519379eca50f3be11719773033e5'].includes(hash),'security','Unreviewed native policy profile')
  return {original,nonceBoundSecuritySHA256:hash,originalNonce:nonce,HTMLRewritten:false}
}
function literal(raw){
  const prefix=/^\s*window\.__appData\s*=\s*/.exec(raw)
  need(prefix&&raw[prefix[0].length]==='{','native-carrier','Unconditional original boot JSON unavailable')
  const start=prefix[0].length;let depth=0,quoted=false,escaped=false
  for(let i=start;i<raw.length;i++){
    const c=raw[i]
    if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue}
    if(c==='"')quoted=true
    else if(c==='{'||c==='[')depth++
    else if((c==='}'||c===']')&&!--depth)return {start,end:i+1}
  }
  throw failure('native-carrier','Unterminated original boot JSON')
}
const base='https://cdn.ashbyprd.com/frontend_non_user/'
const deploymentOffsets=[236,2798,3157,4035]
function declaration(raw,range){
  const outside=raw.slice(0,range.start)+'[ORIGINAL_NATIVE_MODEL]'+raw.slice(range.end),at=deploymentOffsets[0]+base.length
  const version=outside.slice(at,at+40)
  need(outside.length===4929&&/^[a-f0-9]{40}$/.test(version),'native-bootstrap','Unreviewed native loader length/declaration')
  let comparison=outside
  for(const offset of [...deploymentOffsets].reverse()){
    need(outside.slice(offset,offset+base.length+41)===base+version+'/','native-bootstrap','Native loader declaration binding changed')
    comparison=comparison.slice(0,offset+base.length)+'0'.repeat(40)+comparison.slice(offset+base.length+40)
  }
  need(sha(comparison)==='ffa62de326939b91a2ce1789170cf5465a44e942e46f1a0443543023f6b73ad8','native-bootstrap','Unreviewed complete loader bytes')
  return {version,manifestURL:base+version+'/.vite/manifest.json'}
}
function headLinks(entries,source){
  const links=entries.filter(e=>e.node.tag==='link').map(e=>({attrs:{...e.node.attrs},ancestorTags:e.ancestors.map(n=>n.tag)}))
  need(links.length===10,'native-head','Unknown native resource declaration')
  const comparison=structuredClone(links)
  for(const index of [0,1,2,5,6,7,8,9]){
    const prefix='https://cdn.ashbyprd.com/'+(index===5?'frontend_non_user/':'cdn_assets/')
    need(links[index].attrs.href.startsWith(prefix+source.version+'/'),'native-head','Mixed native head deployment')
    comparison[index].attrs.href=links[index].attrs.href.replace(prefix+source.version+'/',prefix+'0'.repeat(40)+'/')
  }
  need(sha(JSON.stringify(comparison))==='cf7c71c6d6af4384c0ea3d9666a51a3075cac3bfe6205acec82a19e12a807bf5','native-head','Unreviewed complete native head declarations')
}

export function readFrontNativeHtml({text,url,headers,headerEntries}={}){
  need(typeof text==='string'&&Buffer.byteLength(text)>0&&Buffer.byteLength(text)<=4194304,'native-carrier','Original native HTML unavailable/oversize')
  const roleURL=new RegExp('^'+BOARD.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'/([a-f0-9-]{36})$').exec(url)
  need(url===BOARD||roleURL&&UUID.test(roleURL[1]),'root-route','Unknown exact native route/query/account')
  const isRole=Boolean(roleURL),parsed=frontDocument(text),entries=parsed.entries
  identityAttributes(text)
  const scripts=entries.filter(e=>e.node.tag==='script'),boots=scripts.filter(e=>e.node.raw?.includes('window.__appData'))
  need(boots.length===1&&active(boots[0])&&boots[0].ancestors.map(n=>n.tag).join('/')==='root/html/body','native-carrier','Unique active HTML boot unavailable')
  shape(boots[0].node.attrs,['nonce'],'native-carrier')
  const boot=boots[0].node,range=literal(boot.raw),rawAppData=boot.raw.slice(range.start,range.end),model=originalJSON(rawAppData)
  shape(model,['ddRumApplicationId','ddRumClientToken','environment','maintenanceMode','schedulingMaintenanceMode','organization','posting','jobBoard','routerPrefix','recaptchaUniversalPublicSiteKey'],'native-model')
  need(model.environment==='production'&&model.maintenanceMode===false&&model.schedulingMaintenanceMode===false&&model.routerPrefix==='/','native-model','Native availability/routing changed')
  need(sha(JSON.stringify(model.organization))==='24ce17e83fecb9fe502e4dab9ff977d76eb04da3e087a3fbaef496548a661434','native-organization','Front account/theme/programme changed')
  const nonce=boot.attrs.nonce,metas=entries.filter(e=>e.node.tag==='meta'),nonces=entries.filter(e=>e.node.attrs.id==='csp-nonce')
  need(typeof nonce==='string'&&/^[A-Za-z0-9_-]{43}$/.test(nonce)&&nonces.length===1&&active(nonces[0])
    &&nonces[0].node.tag==='meta'&&nonces[0].ancestors.map(n=>n.tag).join('/')==='root/html/head','native-carrier','Unique original native nonce unavailable')
  shape(nonces[0].node.attrs,['name','id','content'],'native-carrier')
  need(nonces[0].node.attrs.name==='csp-nonce'&&nonces[0].node.attrs.content===nonce&&text.split(nonce).length===3,'native-carrier','Original head/boot nonce changed')
  const originalHeaderView=originalHeaders(headers,headerEntries),securityFacts=nativeSecurity(originalHeaderView,nonce)
  const source=declaration(boot.raw,range);headLinks(entries,source)
  const mounts=entries.filter(e=>e.node.attrs.id==='root'),visible=readVisibleNativeDocument(text,{strict:true})
  need(mounts.length===1&&active(mounts[0])&&visible.nodes(n=>n.attrs.id==='root').length===1,'native-mount','Unique active native mount unavailable')
  shape(mounts[0].node.attrs,['id'],'native-mount')
  need(visible.text(visible.nodes(n=>n.tag==='root')[0])==='','native-carrier','Additional visible native publication')
  need(!entries.some(e=>['svg','math','a','form','input','select','button','textarea','iframe','object','embed'].includes(e.node.tag)),
    'native-carrier','Additional/foreign native programme or control')
  const lds=scripts.filter(e=>e.node.attrs.type==='application/ld+json')
  need(scripts.length===(isRole?2:1)&&lds.length===(isRole?1:0),'native-carrier','Additional or missing native script/schema')
  if(isRole){need(active(lds[0])&&lds[0].ancestors.map(n=>n.tag).join('/')==='root/html/head','native-carrier','Unqualified own schema carrier');shape(lds[0].node.attrs,['type'],'native-carrier')}
  const titles=entries.filter(e=>e.node.tag==='title')
  need(titles.length===1&&active(titles[0])&&titles[0].ancestors.map(n=>n.tag).join('/')==='root/html/head','native-title','Unique native document title unavailable')
  const title=decodeNativeEntities(titles[0].node.raw),expected=isRole?model.posting?.title+' @ Front':'Front Jobs'
  need(title===expected,'native-title','Native document title contradicts own identity')
  need(isRole?model.posting?.id===roleURL[1]&&model.jobBoard===null:model.posting===null,'native-model','Native board/own identity changed')
  const head={}
  for(const entry of metas){
    need(active(entry)&&entry.ancestors.map(n=>n.tag).join('/')==='root/html/head','native-head','Unqualified native metadata carrier')
    const attrs=entry.node.attrs,key=attrs.name??attrs.property??(Object.hasOwn(attrs,'charset')?'charset':null)
    need(typeof key==='string'&&!Object.hasOwn(head,key),'native-head','Unknown/duplicate native metadata')
    shape(attrs,key==='charset'?['charset']:key==='csp-nonce'?['name','id','content']:key.startsWith('og:')?['property','content']:['name','content'],'native-head')
    head[key]=attrs
  }
  shape(head,['charset','viewport','theme-color','csp-nonce','title','description','twitter:card','og:url','og:type','og:title','og:description','og:image','twitter:title','twitter:description'],'native-head')
  need(metas.length===14&&head.charset?.charset==='utf-8'&&head['og:url']?.content===url,'native-head','Native charset/OG identity changed')
  const labels={'viewport':'width=device-width, initial-scale=1, shrink-to-fit=no','theme-color':'#473BCE','twitter:card':'summary','og:type':'website'}
  for(const [key,value]of Object.entries(labels))need(head[key]?.content===value,'native-head','Unreviewed native head presentation')
  for(const key of ['title','og:title','twitter:title'])need(head[key]?.content===(key==='title'?expected:isRole?model.posting.title:expected),'native-title','Contradictory native title metadata')
  const descriptions=['description','og:description','twitter:description'].map(key=>head[key]?.content)
  need(descriptions.every(v=>typeof v==='string'&&v.length>0)&&descriptions.every(v=>v===descriptions[0]),'native-head','Native description metadata disagreement')
  return {originalAppData:model,originalLD:isRole?originalJSON(lds[0].node.raw):null,rawAppData,rawLD:isRole?lds[0].node.raw:null,
    originalHTML:text,originalHeaders:originalHeaderView,originalHeaderEntries:headerEntries??null,htmlSHA256:sha(text),documentTitle:title,headDescriptions:descriptions,
    declaration:source,routeFacts:{url,isRole,id:roleURL?.[1]??null,search:'',hash:'',sourceBodiesQualified:false},
    carrierFacts:{uniqueHTMLBoot:true,uniqueMount:true,sourceBodiesQualified:false},securityFacts}
}

const TypedArray=Object.getPrototypeOf(Uint8Array.prototype),lengthGetter=Object.getOwnPropertyDescriptor(TypedArray,'length').get
const nativeSet=TypedArray.set
function originalNativePacket(native){
  const requestedURL=data(native,'requestedURL','native-raw'),finalURL=data(native,'finalURL','native-raw'),status=data(native,'status','native-raw')
  need(requestedURL===finalURL&&status===200,'native-raw','Exact original own response route/status unavailable')
  const source=data(native,'body','native-raw')
  need(types.isUint8Array(source),'native-raw','Original native byte view unavailable')
  const length=Reflect.apply(lengthGetter,source,[])
  need(length>0&&length<=4194304,'native-raw','Original own byte bounds exceeded')
  const snapshot=new Uint8Array(length);Reflect.apply(nativeSet,snapshot,[source])
  let text
  try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(snapshot)}catch{throw failure('encoding','Invalid original UTF8 entity')}
  need(!text.startsWith('\uFEFF')&&Buffer.compare(Buffer.from(text),Buffer.from(snapshot.buffer))===0,'encoding','Ambiguous native entity decoding')
  const entry=Object.getOwnPropertyDescriptor(native,'headerEntries')
  need(!entry||Object.hasOwn(entry,'value'),'native-raw','Unqualified original header entries')
  return readFrontNativeHtml({text,url:finalURL,headers:data(native,'headers','native-raw'),headerEntries:entry?.value??null})
}
export function deriveFrontBoardRoot({native,sourceInput}={}){
  const parsed=originalNativePacket(native)
  let certificate
  try{certificate=certifyAshbyRendererSource(sourceInput)}catch(error){
    if(error.code!=='ASHBY_SOURCE_CERTIFICATE_HOLD')throw error
    throw failure('source-certificate',error.message)
  }
  need(isDeepStrictEqual(parsed.declaration,certificate.declaration),'source-binding','Native/source declarations disagree')
  const model=parsed.originalAppData
  need(parsed.routeFacts.isRole&&!Object.hasOwn(model,'customDomainData')&&model.organization.hostedJobsPageSlug==='frontcareers'
    &&model.organization.customJobsPageUrl===null&&model.organization.theme.jobPostingBackUrl===null&&model.routerPrefix==='/','root-route','Unreviewed native root emitter branch')
  // Both accepted complete source profiles pin the 27 reviewed emitter/history
  // contexts. This is a static route derivation, never browser execution.
  return {url:BOARD,sourceCertificate:certificate,emissionFacts:{ownURL:parsed.routeFacts.url,organizationId:model.organization.organizationId,
    slug:model.organization.hostedJobsPageSlug,routerPrefix:model.routerPrefix,customDomainDataPresent:false,customJobsPageUrl:null,jobPostingBackUrl:null,
    pathname:'/frontcareers',search:'',hash:'',trailingSlash:false,browserExecutionQualified:false,currentnessQualified:false,inventoryQualified:false}}
}
