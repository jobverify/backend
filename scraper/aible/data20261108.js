import {decodeHTML as decode,decodeHTMLAttribute} from 'entities/decode'
// Source-owned nonexecuting reader retains original offsets and authored slices.
function rawDocument(html) {
 if(typeof html!=='string')throw Error('Aible native HTML unavailable')
 const root={tag:'root',attrs:{},children:[],start:0,end:html.length},stack=[root]
 const raw=new Set(['script','style','textarea','title','xmp','iframe','noembed','noframes','plaintext','noscript']),voids=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'])
 const tokens=/<!--[\s\S]*?(?:-->|$)|<![^>]*>|<\/?([a-z][a-z0-9:_-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi
 let cursor=0,token
 while((token=tokens.exec(html))){const parent=stack.at(-1)
  if(token.index>cursor)parent.children.push(html.slice(cursor,token.index));cursor=tokens.lastIndex
  if(!token[1])continue
  const tag=token[1].toLowerCase()
  if(token[0].startsWith('</')){const at=stack.findLastIndex(n=>n.tag===tag),boundary=stack.findLastIndex(n=>n.tag==='template');if(at>0&&at>=boundary){const node=stack[at];node.closeStart=token.index;node.end=cursor;stack.length=at}continue}
  const attrs={};for(const a of token[2].matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)){const key=a[1].toLowerCase();if(!Object.hasOwn(attrs,key))Object.defineProperty(attrs,key,{value:decodeHTMLAttribute(a[2]??a[3]??a[4]??''),enumerable:true,writable:true,configurable:true})}
  const style=(attrs.style||'').replace(/\/\*[\s\S]*?\*\//g,'')
  const inactive=Object.hasOwn(attrs,'hidden')||Object.hasOwn(attrs,'inert')||attrs['aria-hidden']==='true'||/(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse))\s*(?:!important\s*)?(?:;|$)/i.test(style)
  const node={tag,attrs,children:[],start:token.index,openEnd:cursor,inactive:parent.inactive||inactive||tag==='template'||raw.has(tag)&&tag!=='script'};parent.children.push(node)
  if(raw.has(tag)){const end=new RegExp(`</${tag}\\s*>`,'ig');end.lastIndex=cursor;const close=tag==='plaintext'?null:end.exec(html);node.raw=html.slice(cursor,close?.index??html.length);node.closeStart=close?.index??html.length;node.end=close?end.lastIndex:html.length;cursor=node.end;tokens.lastIndex=cursor}
  else if(!voids.has(tag))stack.push(node);else{node.closeStart=cursor;node.end=cursor}
 }
 if(cursor<html.length)stack.at(-1).children.push(html.slice(cursor))
 const nodes=(predicate,node=root)=>node.inactive?[]:[...(predicate(node)?[node]:[]),...node.children.filter(c=>typeof c!=='string').flatMap(c=>nodes(predicate,c))]
 const text=node=>!node||node.inactive||node.tag==='script'?'':node.children.map(c=>typeof c==='string'?decode(c):text(c)).join(' ').replace(/\s+/g,' ').trim()
 const inner=node=>{if(!Number.isInteger(node.closeStart))throw Error('Aible native unclosed content');return html.slice(node.openEnd,node.closeStart)}
 const outer=node=>{if(!Number.isInteger(node.end))throw Error('Aible native unclosed element');return html.slice(node.start,node.end)}
 return{root,nodes,text,inner,outer,hasClass:(n,c)=>(n.attrs.class||'').split(/\s+/).includes(c)}
}

export const PRIMARY='https://www.aible.com/careers',SOURCE='aible'
const norm=v=>String(v??'').replace(/\s+/g,' ').trim(),children=n=>n.children.filter(v=>typeof v==='object'),all=(n,p)=>[...(p(n)?[n]:[]),...children(n).flatMap(c=>all(c,p))],has=(n,c)=>(n.attrs.class??'').split(/\s+/).includes(c),one=nodes=>nodes.length===1?nodes[0]:null
const text=n=>typeof n==='string'?norm(decode(n)):['script','style','template','noscript'].includes(n.tag)?'':norm(n.raw===undefined?n.children.map(text).join(' '):decode(n.raw)),script=n=>n.raw??n.children.filter(v=>typeof v==='string').join('')
const activeIdentityText=n=>!n||n.inactive?'':typeof n==='string'?norm(decode(n)):['script','style','template','noscript'].includes(n.tag)?'':norm(n.raw===undefined?n.children.map(activeIdentityText).join(' '):decode(n.raw))
const exactHTML=(doc,n)=>{try{return doc.outer(n)}catch{return null}},field=(doc,n)=>n?{tag:n.tag,attrs:{...n.attrs},text:text(n),nativeHTML:exactHTML(doc,n)}:null
const head=nodes=>({titles:nodes.filter(n=>n.tag==='title').map(text),canonicals:nodes.filter(n=>n.tag==='link'&&(n.attrs.rel??'').split(/\s+/).includes('canonical')).map(n=>n.attrs.href??null),metas:nodes.filter(n=>n.tag==='meta').map(n=>({...n.attrs})),schemas:nodes.filter(n=>n.tag==='script'&&(n.attrs.type??'').split(';')[0].trim().toLowerCase()==='application/ld+json').map(n=>({attrs:{...n.attrs},raw:script(n)}))})
export function parsePrimary(html){
 const doc=rawDocument(html),nodes=all(doc.root,()=>true),parents=new Map();for(const n of nodes)for(const c of children(n))parents.set(c,n)
 const sections=nodes.filter(n=>n.tag==='div'&&has(n,'careers-container')),section=one(sections),within=(n,a)=>{for(let at=n;at;at=parents.get(at))if(at===a)return true;return false},known=nodes.filter(n=>n.tag==='div'&&has(n,'careers-item')),unreviewed=new Set()
 for(const body of nodes.filter(n=>n.tag==='div'&&has(n,'careers-body')))if(!known.some(card=>within(body,card))){let selected=null;for(let at=parents.get(body);at&&at!==doc.root&&!has(at,'careers-container');at=parents.get(at)){const ns=all(at,()=>true);if(ns.filter(n=>has(n,'careers-body')).length!==1||ns.filter(n=>has(n,'careers-header-title')).length!==1)break;if(at.tag==='div')selected=at}if(selected)unreviewed.add(selected)}
 const cards=nodes.filter(n=>known.includes(n)||unreviewed.has(n)),records=[]
 for(const [ordinal,card]of cards.entries()){
  const ns=all(card,()=>true),title=one(ns.filter(n=>n.tag==='h3'&&has(n,'careers-header-title'))),header=one(ns.filter(n=>n.tag==='div'&&has(n,'careers-header'))),body=one(ns.filter(n=>n.tag==='div'&&has(n,'careers-body'))),modals=ns.filter(n=>n.tag==='div'&&has(n,'careers-modal')),parts=[]
  for(const n of body?.children??[]){if(typeof n==='string'){if(n.trim())parts.push({tag:'#text',attrs:{},text:norm(decode(n)),nativeHTML:n})}else parts.push(field(doc,n))}
  let description=null;if(body)try{description=doc.inner(body)}catch{}
  const fullCriteriaText=body?text(body):null,explicitlyInactive=Boolean(body&&(body.inactive||all(body,n=>n.inactive&&!['script','style','noscript'].includes(n.tag)).length)),model={ordinal,sourcePage:PRIMARY,title:title?text(title):null,attrs:{...card.attrs},nativeHTML:exactHTML(doc,card),header:field(doc,header),titleControl:field(doc,title),nativeDescriptionHTML:description,criteriaContainerHTML:body?exactHTML(doc,body):null,fullCriteriaText,sections:parts,nativeFormMarkup:modals.map(n=>exactHTML(doc,n)),nativeFormScripts:ns.filter(n=>n.tag==='script'&&modals.some(m=>within(n,m))).map(n=>({attrs:{...n.attrs},raw:script(n),nativeHTML:exactHTML(doc,n)})),applicationControls:ns.filter(n=>n.tag==='a'&&n.attrs.id==='apply-btn').map(n=>field(doc,n)),nativeEligibilityStatements:(body?all(body,n=>['p','li'].includes(n.tag)&&/\b(?:must be authorized|work authorization)\b/i.test(text(n))):[]).map(text),primaryWorkplace:null,primaryCountry:null,formalPostingID:null,formalRequisitionID:null,postingDate:null,closingDate:null,legalEmployer:null,nativeAuthoredCriteriaAvailable:Boolean(fullCriteriaText)&&!explicitlyInactive,nativeCriteriaVisibilityQualified:false,nativeCurrentPublicationQualified:false}
  if(unreviewed.has(card))model.nativeStructureUnqualified=true
  if(card.inactive||header?.inactive||title?.inactive||title&&!activeIdentityText(title))model.nativeIdentityVisibilityUnqualified=true
  records.push(model)
 }
 const value={sourcePage:PRIMARY,head:head(nodes),sectionHeading:field(doc,one(nodes.filter(n=>n.tag==='h2'&&has(n,'careers-title')))),sectionHTML:section?exactHTML(doc,section):null,sectionAttrs:section?{...section.attrs}:null,declaredCareerResources:nodes.filter(n=>n.tag==='script'&&(n.attrs.src??'').includes('module_Careers_Collapse.min.js')||n.tag==='link'&&(n.attrs.href??'').includes('module_Careers_Collapse.min.css')).map(n=>({tag:n.tag,attrs:{...n.attrs},nativeHTML:exactHTML(doc,n)})),records,observedNativeRecords:records.length,renderedCriteriaVisibilityQualified:false,companyGlobalTotal:null,companyIndiaTotal:null}
 if(sections.length!==1)value.unqualifiedSections=sections.map(n=>field(doc,n))
 const unknownBodies=nodes.filter(n=>has(n,'careers-body')&&!cards.some(card=>within(n,card)));if(unknownBodies.length)value.unqualifiedRoleFragments=unknownBodies.map(n=>field(doc,n))
 return value
}
