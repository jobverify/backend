import {parseExpressionAt} from 'acorn'
import {decodeHTML as decode,decodeHTMLAttribute} from 'entities/decode'
// Source-owned nonexecuting reader retains original offsets and authored slices.
function rawDocument(html) {
 if(typeof html!=='string')throw Error('ASUS native HTML unavailable')
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
 const inner=node=>{if(!Number.isInteger(node.closeStart))throw Error('ASUS native unclosed content');return html.slice(node.openEnd,node.closeStart)}
 const outer=node=>{if(!Number.isInteger(node.end))throw Error('ASUS native unclosed element');return html.slice(node.start,node.end)}
 return{root,nodes,text,inner,outer,hasClass:(n,c)=>(n.attrs.class||'').split(/\s+/).includes(c)}
}



export const PRIMARY='https://careers.asus.com/',BOARD='https://jobs.jobvite.com/asus',SEARCH='https://careers-api.asus.com/api/api/regions/en/homepage/getSearchList?region=en',META='https://careers-api.asus.com/api/api/regions/en/getMeta?region=en',HEADER='https://careers-api.asus.com/api/api/regions/en/getHeader?region=en',EMPLOYER='ASUS Computer International'
const norm=v=>String(v??'').replace(/\s+/g,' ').trim(),children=n=>n.children.filter(v=>typeof v==='object'),all=(n,p)=>[...(p(n)?[n]:[]),...children(n).flatMap(c=>all(c,p))],nodes=d=>all(d.root,()=>true),has=(n,c)=>(n.attrs.class??'').split(/\s+/).includes(c),script=n=>n.raw??n.children.filter(v=>typeof v==='string').join('')
const text=n=>typeof n==='string'?norm(decode(n)):['script','style','template','noscript'].includes(n.tag)?'':norm(n.raw===undefined?n.children.map(text).join(' '):decode(n.raw))
const outer=(d,n)=>d.outer(n),carrier=(d,n,value=text(n))=>({attrs:{...n.attrs},nativeHTML:outer(d,n),authoredText:value,...(n.inactive?{inactive:true}:{})})
const head=d=>{const ns=nodes(d);return{titles:ns.filter(n=>n.tag==='title').map(text),canonicals:ns.filter(n=>n.tag==='link'&&(n.attrs.rel??'').toLowerCase().split(/\s+/).includes('canonical')).map(n=>n.attrs.href??null),metas:ns.filter(n=>n.tag==='meta').map(n=>({...n.attrs})),schemas:ns.filter(n=>n.tag==='script'&&(n.attrs.type??'').split(';')[0].trim().toLowerCase()==='application/ld+json').map(n=>({attrs:{...n.attrs},raw:script(n)}))}}
const property=(object,key,value)=>Object.defineProperty(object,key,{value,enumerable:true,writable:true,configurable:true})
function strictJSON(raw){
 const value=JSON.parse(raw),tree=parseExpressionAt(raw,0,{ecmaVersion:'latest'});if(raw.slice(tree.end).trim())throw Error('Trailing native JSON expression')
 const pending=[tree];while(pending.length){const n=pending.pop();if(n.type==='ObjectExpression'){const keys=new Set();for(const p of n.properties){if(p.type!=='Property'||p.computed||p.kind!=='init')throw Error('Executable native property');const key=p.key.type==='Identifier'?p.key.name:String(p.key.value);if(keys.has(key))throw Error('Duplicate native JSON property');keys.add(key);pending.push(p.value)}}else if(n.type==='ArrayExpression')pending.push(...n.elements);else if(n.type==='Literal'){if(typeof n.value==='number'&&!Number.isFinite(n.value))throw Error('Nonfinite native number')}else if(n.type==='UnaryExpression'&&n.operator==='-')pending.push(n.argument);else throw Error('Native value is not JSON data')}
 return value
}
function decodePool(pool){
 if(!Array.isArray(pool)||!pool.length||pool.length>10000)throw Error('Invalid or oversized native reference graph')
 const memo=new Map(),visiting=new Set()
 function resolve(index,depth=0){
  if(depth>=120||!Number.isInteger(index))throw Error('Invalid native reference depth/index')
  if(index<0){if(index< -6)throw Error('Unknown native reference sentinel');return{nativeDevalueSentinel:index}}
  if(index>=pool.length||visiting.has(index))throw Error('Out-of-range or cyclic native reference')
  if(memo.has(index))return memo.get(index)
  visiting.add(index);let value=pool[index]
  if(Array.isArray(value)){
   if(typeof value[0]==='string'){
    if(['ShallowReactive','Reactive','Ref','ShallowRef'].includes(value[0])){if(value.length!==2)throw Error('Malformed native reactive wrapper');value=resolve(value[1],depth+1)}
    else value={nativeDevalueTag:value[0],values:value.slice(1).map(v=>resolve(v,depth+1))}
   }else value=value.map(v=>resolve(v,depth+1))
  }else if(value!==null&&typeof value==='object'){const object={};for(const[key,ref]of Object.entries(value))property(object,key,resolve(ref,depth+1));value=object}
  visiting.delete(index);memo.set(index,value);return value
 }
 // Memoized weights count each alias occurrence without expanding it. This bounds
 // later deep comparison, cloning consumers and JSON evidence serialization.
 const weights=new Map(),limit=1000000
 const weigh=value=>{
  if(weights.has(value))return weights.get(value)
  let weight=0
  const add=n=>{weight+=n;if(weight>limit)throw Error('Expanded native reference evidence exceeds serialization weight bound')}
  if(value===null||typeof value!=='object')add(JSON.stringify(value).length)
  else if(Array.isArray(value)){add(2);for(const[i,child]of value.entries()){if(i)add(1);add(weigh(child))}}
  else{add(2);let first=true;for(const[key,child]of Object.entries(value)){if(!first)add(1);first=false;add(JSON.stringify(key).length+1);add(weigh(child))}}
  weights.set(value,weight);return weight
 }
 const value=resolve(0);weigh(value);return value
}
const criteriaText=n=>typeof n==='string'?norm(decode(n)):['script','style','template','noscript','button','input','select','option'].includes(n.tag)||has(n,'jv-button')||has(n,'jv-current-openings')?'':norm(n.raw===undefined?n.children.map(criteriaText).join(' '):decode(n.raw))
const rawText=n=>typeof n==='string'?norm(decode(n)):norm(n.raw===undefined?n.children.map(rawText).join(' '):decode(n.raw))
const inactiveCriteria=n=>all(n,v=>v.inactive&&!['script','style','noscript','title'].includes(v.tag)&&Boolean(rawText(v))).length>0
const message=e=>String(e?.message??e).slice(0,1024)
export function parsePrimary(html,url=PRIMARY){
 const d=rawDocument(html),nativeSSRCarriers=[],errors=[]
 for(const n of nodes(d).filter(n=>n.tag==='script'&&n.attrs.id==='__NUXT_DATA__')){
  const rawJSON=script(n),c={attrs:{...n.attrs},nativeHTML:outer(d,n),rawJSON,flatNativeGraph:null,decodedNativeGraph:null}
  if(n.inactive||Object.hasOwn(n.attrs,'src')||(n.attrs.type??'').split(';')[0].trim().toLowerCase()!=='application/json'||n.attrs['data-ssr']!=='true'||n.attrs['data-nuxt-data']!=='nuxt-app')errors.push({name:'SSR-carrier',message:'Inactive or unreviewed native SSR data carrier'})
  try{c.flatNativeGraph=strictJSON(rawJSON);c.decodedNativeGraph=decodePool(c.flatNativeGraph)}catch(e){errors.push({name:'SSR-data',message:message(e)})}nativeSSRCarriers.push(c)
 }
 if(nativeSSRCarriers.length!==1)errors.push({name:'SSR-carrier',message:'Missing or competing native SSR carriers'})
 const decoded=nativeSSRCarriers[0]?.decodedNativeGraph,regional=decoded?.data?.[SEARCH]??null,menu=decoded?.data?.[HEADER]?.result?.menuList,work=Array.isArray(menu)?menu.filter(v=>v?.link==='https://careers.asus.com/work-at-asus'):[],value={sourcePage:url,head:head(d),nativeSSRCarriers,nativeRegionalSearchResponse:regional,nativeRegionalRoutes:regional?.result?.regions??null,nativeRoleFamilies:work.length===1?work[0].subMenuList??null:null}
 if(errors.length)value.parseFailures=errors;return value
}
export function parseBoard(html,url=BOARD){
 const d=rawDocument(html),ns=nodes(d),tables=ns.filter(n=>n.tag==='table'&&has(n,'jv-job-list')),records=[],errors=[]
 for(const[tableIndex,table]of tables.entries())for(const n of all(table,n=>n.tag==='tr')){
  const cells=children(n).filter(v=>v.tag==='td'),names=cells.filter(v=>has(v,'jv-job-list-name'));if(!names.length)continue
  const anchors=all(n,v=>v.tag==='a'&&Object.hasOwn(v.attrs,'href')),links=anchors.map(a=>{let url=null;try{url=new URL(a.attrs.href,BOARD).href}catch{}return{attrs:{...a.attrs},nativeHTML:outer(d,a),text:text(a),url}})
  const nameLinks=names.flatMap(c=>all(c,v=>v.tag==='a'&&Object.hasOwn(v.attrs,'href')))
  if(n.inactive||names.length!==1||nameLinks.length!==1||nameLinks.some(v=>v.inactive||(()=>{try{return !/^https:\/\/jobs\.jobvite\.com\/asus\/job\/[A-Za-z0-9]+$/.test(new URL(v.attrs.href,BOARD).href)}catch{return true}})()))errors.push({name:'board-row',message:'Inactive or ambiguous native posting row',nativeObservationOrdinal:records.length})
  records.push({nativeObservationOrdinal:records.length,nativeTableOrdinal:tableIndex,attrs:{...n.attrs},nativeHTML:outer(d,n),cells:cells.map(c=>({tag:c.tag,...carrier(d,c)})),links})
 }
 if(ns.some(n=>n.tag==='a'&&((n.attrs.rel??'').split(/\s+/).some(v=>['next','prev'].includes(v))||/\bjv-pagination\b/.test(n.attrs.class??''))))errors.push({name:'pagination',message:'Unreviewed native pagination declaration'})
 const value={sourcePage:url,head:head(d),nativeHeadings:ns.filter(n=>['h2','h3'].includes(n.tag)).map(n=>({tag:n.tag,...carrier(d,n)})),nativeTables:tables.map(n=>carrier(d,n)),nativeFilters:ns.filter(n=>n.tag==='select').map(n=>({tag:n.tag,...carrier(d,n)})),records}
 if(errors.length)value.parseFailures=errors;return value
}
function postings(value){if(Array.isArray(value))return value.flatMap(postings);if(!value||typeof value!=='object')return[];const types=Array.isArray(value['@type'])?value['@type']:[value['@type']];return[...(types.includes('JobPosting')?[value]:[]),...postings(value['@graph']??[])]}
export function parseDetail(html,url){
 const d=rawDocument(html),ns=nodes(d),nativeSchemaCarriers=[],nativeJobRecords=[],errors=[]
 for(const n of ns.filter(n=>n.tag==='script'&&((n.attrs.type??'').split(';')[0].trim().toLowerCase()==='application/ld+json'||/^\s*[\[{][\s\S]*"@type"\s*:\s*"JobPosting"/.test(script(n))))){
  const rawJSON=script(n),c={attrs:{...n.attrs},nativeHTML:outer(d,n),rawJSON,value:null}
  if(n.inactive||Object.hasOwn(n.attrs,'src')||(n.attrs.type??'').split(';')[0].trim().toLowerCase()!=='application/ld+json')errors.push({name:'schema-carrier',message:'Inactive or unreviewed native structured posting carrier'})
  try{c.value=strictJSON(rawJSON);nativeJobRecords.push(...postings(c.value))}catch(e){errors.push({name:'schema-data',message:message(e)})}nativeSchemaCarriers.push(c)
 }
 const descriptions=ns.filter(n=>has(n,'jv-job-detail-description')),supplements=ns.filter(n=>has(n,'jv-job-detail-bottom-actions')),nativeDescriptionCarriers=descriptions.map(n=>carrier(d,n)),nativeSupplementalCriteriaCarriers=supplements.map(n=>carrier(d,n,criteriaText(n))),fullCriteriaText=norm([...nativeDescriptionCarriers,...nativeSupplementalCriteriaCarriers].map(v=>v.authoredText).join(' ')),inactive=[...descriptions,...supplements].some(inactiveCriteria)
 if(inactive)errors.push({name:'criteria',message:'Inactive native authored criteria'})
 if(ns.filter(n=>n.tag==='h2'&&has(n,'jv-header')).some(inactiveCriteria))errors.push({name:'title',message:'Inactive native posting title or meaningful title content'})
 if(ns.some(n=>['jv-page-closed-job','jv-page-job-expired','jv-job-no-longer-available'].some(c=>has(n,c))))errors.push({name:'publication',message:'Native closed or unavailable posting state'})
 const value={sourcePage:url,head:head(d),nativeSchemaCarriers,nativeJobRecords,nativeTitleCarriers:ns.filter(n=>n.tag==='h2'&&has(n,'jv-header')).map(n=>carrier(d,n)),nativeMetadataCarriers:ns.filter(n=>has(n,'jv-job-detail-meta')).map(n=>carrier(d,n)),nativeDescriptionCarriers,nativeSupplementalCriteriaCarriers,fullCriteriaText,nativeAuthoredCriteriaAvailable:descriptions.length>0&&nativeDescriptionCarriers.every(v=>Boolean(v.authoredText))&&Boolean(fullCriteriaText)&&!inactive,nativeApplicationLinkClaims:ns.filter(n=>n.tag==='a'&&has(n,'jv-button-apply')).map(n=>({attrs:{...n.attrs},nativeHTML:outer(d,n),text:text(n)}))}
 if(errors.length)value.parseFailures=errors;return value
}
export const schemaCriteriaText=html=>text(rawDocument(html).root)
