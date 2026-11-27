import{createHash}from'node:crypto'
import{isDeepStrictEqual as equal}from'node:util'
import{parse}from'acorn'
import{readNativeDocument,activeIframeDeclarations,extractActiveDescription}from'../../scraper-support/utils/activeNativeHtml.js'
export const sha=value=>createHash('sha256').update(value).digest('hex')
export const norm=value=>String(value??'').replace(/\s+/g,' ').trim()
export const check=(ok,reason)=>{if(!ok)throw Object.assign(Error('KANINI current native contract: '+reason),{abortRetries:true,failureKind:'parser_or_contract_error',sourceScopeComplete:false,lifecycleCleanupAllowed:false})}
const one=(rows,name)=>{check(rows.length===1,'unique '+name);return rows[0]}
const noncePaths=new Set(['elementorFrontendConfig.nonces.floatingButtonsClickTracking','elementorProFrontendConfig.nonce','ElementorProFrontendConfig.nonce','localize.nonce'])
const proNonceProfile={original:'efa53166bae286915d11944fa4c0791bfd364d94b749a56047f6ee58ba7fedf3',
 skeleton:'f8976a75291ed41f615d7446f9d1c1e065c35a72f059a6d0e6cfe5936e0dd98c'}
// November 18 ordinary public deployment: the complete emoji bootstrap differs
// only in its literal wp-emoji-release.min.js query, 6.8.12 -> 6.8.13. All job
// query, renderer, employer and form programs retain their existing profiles.
const emojiRevision=['85d9342f9efb02bf550ecb1bb7d6c6c5ea0b20656ff29e322e7f9d295465bb7f',
 '633b900004b5e802a7670be5a5a44b9bdef854dfaf3b2fdfc94704f40ebd2413']
export function inspectPrograms(doc,expected){
 const scripts=doc.nodes(n=>n.tag==='script'&&!Object.hasOwn(n.attrs,'nomodule')&&/^(?:|module|(?:text|application)\/javascript)$/i.test(n.attrs.type??''))
 check(scripts.length===expected.length,'whole active program declaration graph')
 // The current home and listing exchange only these two adjacent, unchanged
 // marketing declarations. All attributes, other positions and inline code
 // remain bound to the reviewed graph; no general script reordering is allowed.
 const marketingIndex=expected.findIndex(n=>n.attrs.src==='https://crmplus.zoho.in/crm/javascript/zcga.js')
 if(marketingIndex>=0&&expected[marketingIndex+1]?.attrs.src==='https://cdn-in.pagesense.io/js/kaninimarketing8600/ae35999531d1419dabbb72c65b68a6c4.js'
  &&equal(scripts[marketingIndex].attrs,expected[marketingIndex+1].attrs)&&equal(scripts[marketingIndex+1].attrs,expected[marketingIndex].attrs)){
  expected=[...expected];[expected[marketingIndex],expected[marketingIndex+1]]=[expected[marketingIndex+1],expected[marketingIndex]]
 }
 for(let i=0;i<scripts.length;i++){const n=scripts[i],want=expected[i];check(equal(n.attrs,want.attrs),'exact declared program attributes');if(n.attrs.src)continue
  const source=n.raw??'',ast=parse(source,{ecmaVersion:'latest'}),masks=[]
  const walk=(node,path)=>{if(node?.type!=='ObjectExpression')return;for(const p of node.properties){if(p.type!=='Property'||p.computed)continue;const key=p.key.name??p.key.value,next=[...path,key];if(noncePaths.has(next.join('.'))){check(p.value.type==='Literal'&&typeof p.value.value==='string'&&/^[a-f0-9]{10}$/i.test(p.value.value),'exact typed nonce carrier');masks.push({path:next.join('.'),start:p.value.start,end:p.value.end})}else walk(p.value,next)}}
  for(const s of ast.body)if(s.type==='VariableDeclaration')for(const d of s.declarations)if(d.id.type==='Identifier')walk(d.init,[d.id.name]);let skeleton=source
  for(const m of masks.slice().sort((a,b)=>b.start-a.start))skeleton=skeleton.slice(0,m.start)+'<NATIVE-NONCE:'+m.path+'>'+skeleton.slice(m.end)
  const program=sha(skeleton),reviewedEmoji=want.programSHA256===emojiRevision[0]&&program===emojiRevision[1]
  const reviewedPro=want.attrs.id==='elementor-pro-frontend-js-before'&&want.programSHA256===proNonceProfile.original
  const expectedPaths=reviewedPro?['ElementorProFrontendConfig.nonce']:want.noncePaths
  check(equal(masks.map(m=>m.path),expectedPaths)&&(program===(reviewedPro?proNonceProfile.skeleton:want.programSHA256)||reviewedEmoji),'whole current program changed outside exact nonce fields')
 }
 return scripts
}
export function corporate(html,entry,title){
 const doc=readNativeDocument(html),root=one(doc.nodes(n=>n.tag==='root'),'document root'),documentElement=one(root.children.filter(n=>typeof n!=='string'&&n.tag==='html'),'outer document element')
 const head=one(documentElement.children.filter(n=>typeof n!=='string'&&n.tag==='head'),'effective outer HTML head'),titles=doc.nodes(n=>n.tag==='title',head).map(n=>norm(n.raw))
 check(equal(titles,[title]),'official effective title');check(doc.nodes(n=>n.tag==='base').length===0,'unexpected base URL')
 const canonical=doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical',head);check(canonical.length===1&&canonical[0].attrs.href===entry.url,'current corporate canonical')
 inspectPrograms(doc,entry.scripts);return doc
}
const tree=n=>typeof n==='string'?n:{tag:n.tag,attrs:n.attrs,...(n.raw!==undefined?{raw:n.raw}:{}),children:n.children.map(tree)}
const attr=v=>String(v).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')
const serialize=n=>typeof n==='string'?n:'<'+n.tag+Object.entries(n.attrs).map(([k,v])=>' '+k+'="'+attr(v)+'"').join('')+'>'+(n.raw??n.children.map(serialize).join(''))+(['br','hr','img','input','wbr'].includes(n.tag)?'':'</'+n.tag+'>')
export function cards(text){
 if(['','0'].includes(text.trim()))return[]
 const doc=readNativeDocument(text),anchors=doc.nodes(n=>n.tag==='a'),cards=anchors.map(n=>{
  let url;try{url=new URL(n.attrs.href)}catch{check(false,'native card URL')}
  check(url.origin==='https://kanini.com'&&url.pathname==='/jobs'&&!url.username&&!url.password&&!url.hash&&!url.port
   &&equal([...url.searchParams.keys()],['job_id'])&&/^\d{8,30}$/.test(url.searchParams.get('job_id')),'native card role identity')
  const title=norm(doc.text(one(doc.nodes(x=>x.tag==='h2',n),'native card title'))),location=norm(doc.text(one(doc.nodes(x=>x.tag==='h3',n),'native card location'))),experience=norm(doc.text(one(doc.nodes(x=>x.tag==='p',n),'native card experience')))
  check(title&&location.split('|').length===2&&experience,'complete native card metadata')
  return{id:url.searchParams.get('job_id'),url:url.href,title,location,country:location.split('|')[1].trim(),experience,nativeCardModel:tree(n)}
 })
 check(cards.length>0&&cards.length<=12&&new Set(cards.map(c=>c.id)).size===cards.length,'complete nonempty bounded native card response')
 check(doc.nodes(n=>n.tag==='script'||n.tag==='iframe'||n.tag==='form').length===0,'unqualified native query carrier');return cards
}
function criteriaQualified(node,profile){
 if(typeof node==='string')return true
 if(node.inert||!profile.criteriaFormats.some(f=>f.tag===node.tag&&equal(f.attrs,node.attrs)))return false
 if(/(?:^|;)\s*(?:display|visibility|content-visibility|clip(?:-path)?|height|max-height|overflow(?:-[xy])?|opacity)\s*:/i.test(node.attrs.style??''))return false
 return node.children.every(n=>criteriaQualified(n,profile))
}
export function detail(html,card,profile){
 const doc=readNativeDocument(html);inspectPrograms(doc,profile.detailScripts)
 const styles=[...html.matchAll(/<style\b([^>]*)>([\s\S]*?)<\/style\s*>/gi)].map(m=>({attributes:m[1],sha256:sha(m[2])}));check(equal(styles,profile.detailInlineStyles),'current whole inline CSS profile')
 const banner=one(doc.nodes(n=>n.tag==='div'&&doc.hasClass(n,'bann-cont')),'native role banner'),title=norm(doc.text(one(doc.nodes(n=>n.tag==='h2',banner),'native role title'))),location=norm(doc.text(one(doc.nodes(n=>n.tag==='h3',banner),'native role location')))
 check(title===card.title&&location===card.location,'complete native listing/detail title and explicit geography')
 const criteria=one(doc.nodes(n=>n.tag==='div'&&doc.hasClass(n,'cont-jder')),'full native criteria container'),qualified=criteriaQualified(criteria,profile),descriptionHTML=serialize(criteria),description=extractActiveDescription(descriptionHTML)
 check(typeof description==='string'&&description.length>100,'full substantive native description')
 const frames=activeIframeDeclarations(html).filter(f=>f.href.startsWith('https://kanini.zohorecruit.in/'))
 check(frames.length===1&&frames[0].href===profile.form.url,'active exact employer recruitment form; marketing forms excluded')
 const parents=new Map(),visit=n=>{if(typeof n==='string')return;for(const child of n.children){if(typeof child!=='string'){parents.set(child,n);visit(child)}}};visit(doc.nodes(n=>n.tag==='root')[0])
 let panel=banner;while(parents.get(panel)&&!panel.children.some(c=>typeof c!=='string'&&c.tag==='div'&&doc.hasClass(c,'jd-cont')))panel=parents.get(panel)
 check(panel.tag==='div'&&panel.attrs.class==='','whole native role panel carrier')
 const fields=doc.nodes(n=>['h2','h3','p'].includes(n.tag),banner)
 check(equal(fields.map(n=>n.tag),['p','h3','h2','p'])&&fields.every(n=>n.children.every(c=>typeof c==='string')),'exact native banner text data carriers')
 const shape=n=>typeof n==='string'?n:{tag:n.tag,attrs:n.attrs,...(n.raw!==undefined?{raw:n.raw}:{}),children:n===criteria?['<NATIVE-FULL-CRITERIA>']:fields.includes(n)?['<NATIVE-BANNER-TEXT:'+fields.indexOf(n)+'>']:n.children.map(shape)}
 check(sha(JSON.stringify(shape(panel)))===profile.rolePanelSkeletonSHA256,'whole native role panel changed outside exact full criteria and text fields')
 return{id:card.id,title,location,experience:card.experience,employment:doc.nodes(n=>n.tag==='div'&&doc.hasClass(n,'remo-bg'),banner).map(n=>norm(doc.text(n))),description,descriptionHTML,criteriaQualified:qualified,
  nativeCriteriaModel:tree(criteria),nativeRolePanelModel:tree(panel),nativeApplicationDeclarations:frames}
}
export function application(payload,profile){
 check(payload&&Array.isArray(payload.webforms)&&payload.webforms.length===1&&!payload.error&&!payload.errors,'whole native public form response')
 const form=payload.webforms[0];check(form.id===profile.formId&&form.module?.api_name==='Candidates'&&form.module.name==='Leads'&&payload.info?.company===profile.nativeCompany
  &&payload.info.website===profile.nativeWebsite&&Array.isArray(payload.info.layout_rules)&&Array.isArray(form.sections)&&form.sections.length>0,'native form/employer/website/schema identity')
 const fields=form.sections.flatMap(s=>[...(s.fields??[]),...(s.attachmenttypes??[])]),ids=new Set()
 for(const f of fields){check(f&&typeof f.id==='string'&&/^\d{8,30}$/.test(f.id)&&!ids.has(f.id)&&norm(f.api_name)&&norm(f.field_label)&&norm(f.data_type)&&typeof f.required==='boolean','complete typed native question');ids.add(f.id)}
 check(fields.some(f=>f.api_name==='Applied_Job_ID'&&f.required===true),'native manual Job ID requirement preserved')
 return payload
}
