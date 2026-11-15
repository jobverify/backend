import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {readNativeAttributeTokens,readNativeDocument} from '../../../scraper-support/utils/activeNativeHtml.js'

export const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./current-native-20261114.json.gz',import.meta.url))))
export const packet=phase=>fixture.packets.find(row=>row.phase===phase)
export const BOARD='https://enerparc.zohorecruit.in/jobs/Careers',CORPORATE='https://enerparc.in/apply-now/'
export const COMMON=packet('literal-declared-native-common-client').requestedUrl,DETAIL_CLIENT=packet('literal-declared-native-detail-client').requestedUrl,ROLE=packet('opening-role').requestedUrl
const hash=value=>createHash('sha256').update(value).digest('hex')
const all=node=>[node,...node.children.filter(child=>typeof child!=='string').flatMap(all)]
export function response(row,changes={}){
 const original=Buffer.from(row.bodyBase64,'base64');assert.equal(hash(original),row.sha256)
 const bytes=changes.bytes??original,value=new Response(bytes,{status:changes.status??row.status,headers:changes.headers??row.headers})
 Object.defineProperty(value,'url',{value:changes.url??row.finalUrl})
 if(Object.hasOwn(changes,'redirected'))Object.defineProperty(value,'redirected',{value:changes.redirected})
 return value
}
export function replay(transform=()=>({})){
 const requests=[],counts=new Map()
 const select=url=>{const count=(counts.get(url)??0)+1;counts.set(url,count)
  if(url===BOARD)return{row:packet(count===1?'opening-native':'post-detail-closing-listing'),count}
  if(url===COMMON)return{row:packet('literal-declared-native-common-client'),count}
  if(url===DETAIL_CLIENT)return{row:packet('literal-declared-native-detail-client'),count}
  if(url===ROLE)return{row:packet(count===1?'opening-role':'closing-role'),count}
  if(url===CORPORATE)return{row:fixture.packets.find(row=>row.status===403),count}
  assert.fail('Undeclared native request '+url)
 }
 return{requests,options:{now:()=> '2026-11-14T20:45:00.000Z',fetchImpl:async(url,init)=>{
  requests.push({url,init});const {row,count}=select(url),changes=await transform({url,count,row,init,bytes:Buffer.from(row.bodyBase64,'base64')})
  return response(row,changes)
 },fetchPage:async(url,init)=>{
  requests.push({url,init,legacy:true});const {row,count}=select(url),changes=await transform({url,count,row,init,bytes:Buffer.from(row.bodyBase64,'base64')}),bytes=changes.bytes??Buffer.from(row.bodyBase64,'base64')
  const original=response(row,changes)
  return{status:original.status,url:original.url,redirected:original.redirected,headers:Object.fromEntries(original.headers),bodyBase64:bytes.toString('base64'),bytes:bytes.length,sha256:hash(bytes),html:bytes.toString('utf8')}
 }}}
}
const literal=node=>node.type==='Literal'?node.value:node.type==='ArrayExpression'?node.elements.map(literal):node.type==='ObjectExpression'?Object.fromEntries(node.properties.map(field=>[field.key.name??field.key.value,literal(field.value)])):(()=>{throw Error('Not test literal '+node.type)})()
export function changeDetailBinding(bytes,name,mutate){
 const html=bytes.toString('utf8'),raw=readNativeDocument(html),scripts=all(raw.nodes(node=>node.tag==='root')[0]).filter(node=>node.tag==='script'&&!node.attrs.src&&node.raw?.length<200000)
 for(const script of scripts){
  const ast=parse(script.raw,{ecmaVersion:'latest'}),declaration=ast.body.flatMap(statement=>statement.type==='VariableDeclaration'?statement.declarations:[]).find(field=>field.id.name===name&&field.init)
  if(!declaration)continue
  const init=declaration.init,jsonCall=init.type==='CallExpression'&&init.callee.object?.name==='JSON'&&init.callee.property?.name==='parse',value=jsonCall?JSON.parse(literal(init.arguments[0])):literal(init),copy=structuredClone(value),changed=mutate(copy)??copy
  assert.notDeepEqual(changed,value,'The negative/availability probe must change actual native data')
  const expression=jsonCall?'JSON.parse('+JSON.stringify(JSON.stringify(changed))+')':JSON.stringify(changed),program=script.raw.slice(0,init.start)+expression+script.raw.slice(init.end)
  assert.equal(html.split(script.raw).length,2);return Buffer.from(html.replace(script.raw,program))
 }
 assert.fail('Missing test native binding '+name)
}
export function changeHiddenCarrier(bytes,id,mutate){
 const html=bytes.toString('utf8'),raw=readNativeDocument(html),nodes=all(raw.nodes(node=>node.tag==='root')[0]),owners=nodes.filter(node=>node.attrs.id===id)
 assert.equal(owners.length,1);const value=JSON.parse(owners[0].attrs.value),copy=structuredClone(value),changed=mutate(copy)??copy
 const tags=[...html.matchAll(/<input\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi)].map(match=>match[0]).filter(candidate=>readNativeAttributeTokens(candidate.slice(6,-1)).some(([name,value])=>name==='id'&&value===id))
 assert.equal(tags.length,1,'Original hidden input lexical owner');const tag=tags[0]
 assert.notDeepEqual(changed,value,'The negative/availability probe must change actual native data')
 const encoded=JSON.stringify(changed).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll("'",'&#39;').replaceAll('<','&lt;').replaceAll('>','&gt;'),replacement=tag.replace(/(\bvalue=)(["'])([\s\S]*?)\2/i,(_all,key,quote)=>key+quote+encoded+quote)
 assert.notEqual(replacement,tag);return Buffer.from(html.replace(tag,replacement))
}
