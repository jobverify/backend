import{createHash}from'node:crypto'
import{parse}from'acorn'
import{isDeepStrictEqual as equal}from'node:util'
import{readNativeDocument}from'../../scraper-support/utils/activeNativeHtml.js'
import{clientScriptDeclarations,hasClientDocumentBase}from'../../scraper-support/utils/reviewedClientProgram.js'
export const sha=value=>createHash('sha256').update(value).digest('hex')
export const check=(ok,reason)=>{if(!ok)throw Object.assign(Error('IGT Solutions current native contract: '+reason),{abortRetries:true,failureKind:'parser_or_contract_error',sourceScopeComplete:false,lifecycleCleanupAllowed:false})}
const one=(rows,name)=>{check(rows.length===1,'unique '+name);return rows[0]}
const noncePaths=new Set(['elementorFrontendConfig.nonces.floatingButtonsClickTracking','elementorFrontendConfig.nonces.atomicFormsSendForm','ElementorProFrontendConfig.nonce','localize.nonce'])
export function readIgtPrograms(html){
 return clientScriptDeclarations(html).map(node=>{
  if(node.attrs.src)return{attrs:node.attrs}
  const source=node.raw??'',ast=parse(source,{ecmaVersion:'latest',sourceType:node.attrs.type==='module'?'module':'script'}),masks=[]
  const walk=(value,path)=>{if(value?.type!=='ObjectExpression')return;for(const p of value.properties){if(p.type!=='Property'||p.computed)continue;const next=[...path,p.key.name??p.key.value];if(noncePaths.has(next.join('.'))){check(p.value.type==='Literal'&&typeof p.value.value==='string'&&/^[a-f0-9]{10}$/.test(p.value.value),'typed current nonce literal');masks.push({path:next.join('.'),start:p.value.start,end:p.value.end})}else walk(p.value,next)}}
  for(const s of ast.body)if(s.type==='VariableDeclaration')for(const d of s.declarations)if(d.id.type==='Identifier')walk(d.init,[d.id.name])
  let skeleton=source;for(const m of masks.slice().sort((a,b)=>b.start-a.start))skeleton=skeleton.slice(0,m.start)+'<CURRENT-NONCE:'+m.path+'>'+skeleton.slice(m.end)
  return{attrs:node.attrs,noncePaths:masks.map(m=>m.path),wholeProgramSHA256:sha(skeleton)}
 })
}
export const nativeTree=node=>typeof node==='string'?node:{tag:node.tag,attrs:node.attrs,...(node.raw===undefined?{}:{raw:node.raw}),children:node.children.map(nativeTree)}
export function currentIgtPage(response,profile){
 const doc=readNativeDocument(response.text),root=one(doc.nodes(n=>n.tag==='root'),'document root'),html=one(root.children.filter(n=>typeof n!=='string'&&n.tag==='html'),'outer HTML'),head=one(html.children.filter(n=>typeof n!=='string'&&n.tag==='head'),'outer HTML head')
 check(!hasClientDocumentBase(response.text),'unexpected document base');check(equal(doc.nodes(n=>n.tag==='title',head).map(n=>n.raw?.replace(/\s+/g,' ').trim()),[profile.title]),'effective current title')
 const canonical=one(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical',head),'current canonical');check(canonical.attrs.href===profile.url,'effective canonical URL')
 const programs=readIgtPrograms(response.text);check(equal(programs,profile.programs),'complete current executable declaration graph')
 const links=doc.nodes(n=>n.tag==='a'&&n.attrs.href).map(n=>({attrs:n.attrs,text:doc.text(n)}))
 return{doc,model:{url:profile.url,title:profile.title,fullNativeHTML:response.text,bodySHA256:response.bodySHA256,programs,recruitmentLinks:links.filter(l=>/career|job|squad|recruit/i.test(l.attrs.href+' '+l.text))}}
}
export function currentIgtForm(doc,profile){
 const form=one(doc.nodes(n=>n.tag==='form'),'current native candidate intake'),controls=[]
 const visit=node=>{if(typeof node==='string')return;if(['input','select','textarea','button'].includes(node.tag))controls.push(nativeTree(node));for(const c of node.children)visit(c)};visit(form)
 const model={attrs:form.attrs,nativeDOM:nativeTree(form),controls};check(sha(JSON.stringify(model))===profile.formModelSHA256,'whole current generic form, hidden controls, questions and passive context')
 check(form.attrs.method==='post'&&form.attrs.action==='/join-the-squad/#wpcf7-f3916-p3868-o1'&&controls.some(c=>c.attrs.name==='_wpcf7'&&c.attrs.value==='3916'),'literal current generic intake identity')
 return model
}
