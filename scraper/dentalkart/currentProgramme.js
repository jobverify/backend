import {parse} from 'acorn'
import {readFileSync} from 'node:fs'
import {readNativeAttributeTokens} from '../../scraper-support/utils/activeNativeHtml.js'
import {decodeHTML} from 'entities'
const reviewed=JSON.parse(readFileSync(new URL('./reviewedRoleURL20261120.json',import.meta.url)))
const walk=(node,fn)=>{if(!node||typeof node!=='object')return;fn(node);for(const value of Object.values(node))if(value&&typeof value==='object')Array.isArray(value)?value.forEach(part=>walk(part,fn)):walk(value,fn)}
const property=(node,key)=>node?.properties?.find(p=>(p.key?.name??p.key?.value)===key)?.value
const member=(node,object,key)=>node?.type==='MemberExpression'&&!node.computed&&(object==='this'?node.object?.type==='ThisExpression':node.object?.name===object)&&node.property?.name===key
const calls=(node,predicate)=>{const result=[];walk(node,n=>{if(n.type==='CallExpression'&&predicate(n))result.push(n)});return result}
const unchangedFormals=fn=>{if(!fn||fn.params.some(p=>p.type!=='Identifier'))return false;const names=new Set(fn.params.map(p=>p.name));let changed=false;const target=node=>node?.type==='Identifier'?names.has(node.name):node?.type==='MemberExpression'?target(node.object):false;const scan=node=>{if(!node||typeof node!=='object'||node!==fn&&/^(?:Function|ArrowFunction)/.test(node.type))return;if(node.type==='AssignmentExpression'&&target(node.left)||node.type==='UpdateExpression'&&target(node.argument)||node.type==='VariableDeclarator'&&target(node.id))changed=true;for(const value of Object.values(node))if(value&&typeof value==='object')Array.isArray(value)?value.forEach(scan):scan(value)};scan(fn);return !changed}
const expression=text=>JSON.stringify(parse('('+text+')',{ecmaVersion:'latest'}).body[0].expression, (key,value)=>['start','end','raw'].includes(key)?undefined:value)
export function readDentalkartProgramme(text,need){
 need(typeof text==='string'&&Buffer.byteLength(text)<=8*1024*1024,'Native client byte limit exceeded')
 const ast=parse(text,{ecmaVersion:'latest'}),helpers=calls(ast,n=>n.callee?.property?.name==='registerHelper'&&n.arguments[0]?.value==='getJobViewUrl')
 need(helpers.length===1&&member(helpers[0].callee.object,'Lyte','Component')&&alpha(helpers[0].arguments[1])===reviewed.model,'Native public role URL semantics changed')
 const functions=[],components=[];walk(ast,n=>{if(n.type==='FunctionDeclaration')functions.push(n);if(n.type==='CallExpression'&&n.callee?.property?.name==='register'&&n.callee.object?.property?.name==='Component'&&typeof n.arguments[0]?.value==='string')components.push(n)})
 const onlyFunction=name=>{const found=functions.filter(n=>n.id.name===name);need(found.length===1,'Native '+name+' identity changed');return found[0]}
 const init=onlyFunction('initializeJobList'),bindings=new Map();walk(init.body,n=>{if(n.type==='AssignmentExpression'&&n.left.type==='Identifier')bindings.set(n.left.name,n.right)})
 for(const[name,id]of [['portalPageJson','pageJson'],['moduleMeta','moduleMeta'],['jobs','jobs'],['meta','meta']])need(expression('JSON.parse($L('+JSON.stringify('#'+id)+').val())')===JSON.stringify(bindings.get(name),(k,v)=>['start','end','raw'].includes(k)?undefined:v),'Native hidden '+id+' record binding changed')
 const component=name=>{const found=components.filter(n=>n.arguments[0].value===name);need(found.length===1&&member(found[0].callee.object,'Lyte','Component'),'Native component identity changed');return found[0].arguments[1]}
 const attributes=template=>[...template.matchAll(/<([a-z][\w-]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi)].map(match=>({tag:match[1],attrs:Object.fromEntries(readNativeAttributeTokens(match[2]).map(([k,v])=>[k,decodeHTML(v)]))}))
 for(const name of ['career-website-job-layout2','career-website-job-layout3','career-website-job-listing-layout1']){
  const template=property(component(name),'_template')?.value;need(typeof template==='string','Native listing template missing')
  const links=attributes(template).filter(n=>n.tag==='a'&&n.attrs.href?.includes('getJobViewUrl'))
  need(links.length===1&&links[0].attrs.href==='{{getJobViewUrl(record.id,record.Posting_Title,meta)}}','Native record-to-role anchor changed')
 }
 const detail=component('career-website-detail'),template=property(detail,'_template')?.value
 const detailCall=components.find(n=>n.arguments[0].value==='career-website-detail'),attachedMixins=property(detailCall.arguments[2],'mixins')
 need(attachedMixins?.type==='ArrayExpression'&&attachedMixins.elements.length===1&&attachedMixins.elements[0]?.value==='career-website-mixin','Native detail application mixin owner changed')
 need(typeof template==='string'&&attributes(template).filter(n=>n.attrs.onclick==="{{action('apply',record.id,meta)}}").length===1,'Native role application carrier changed')
 const actions=property(detail,'actions'),apply=property(actions,'apply'),id=apply?.params?.[0]?.name,meta=apply?.params?.[1]?.name
 need(id&&meta&&unchangedFormals(apply)&&calls(apply,n=>member(n.callee,'this','getManualApplyForm')&&n.arguments.length===3&&n.arguments[0]?.name===id&&member(n.arguments[1],meta,'webform_id')&&member(n.arguments[2],meta,'page_name')).length===1,'Native application role identity changed')
 const mixins=calls(ast,n=>member(n.callee?.object,'Lyte','Mixin')&&n.callee.property?.name==='register'&&n.arguments[0]?.value==='career-website-mixin')
 need(mixins.length===1,'Native application mixin identity changed')
 const manual=property(mixins[0].arguments[1],'getManualApplyForm'),jobId=manual?.params?.[0]?.name,formId=manual?.params?.[1]?.name
 const isTrue=node=>node?.value===true||node?.type==='UnaryExpression'&&node.operator==='!'&&node.argument?.value===0
 need(jobId&&formId&&unchangedFormals(manual)&&calls(manual,n=>member(n.callee,'store','findRecord')&&n.arguments.length===6&&n.arguments[0]?.value==='webform'&&n.arguments[1]?.name===formId&&isTrue(property(n.arguments[5],'portal'))&&property(n.arguments[5],'jobId')?.name===jobId).length===1,'Native form job identity changed')
 const render=onlyFunction('renderJobDetail'),record=render.params[0]?.name,assignments=[];walk(render,n=>{if(n.type==='AssignmentExpression'&&n.left?.property?.name==='record'&&n.right?.name===record)assignments.push(n.left.object.name)})
 need(assignments.length===1&&calls(render,n=>n.callee?.property?.name==='render'&&n.arguments[0]?.value==='career-website-detail'&&n.arguments[1]?.name===assignments[0]).length===1,'Native full record-to-detail binding changed')
 return {publicRoleURLDeclared:true,recordBoundApplicationDeclared:true,activeApplyVerified:false,clientExecuted:false}
}
export function dentalkartRoleURL(record,meta){
 const slug=encodeURIComponent(record.Posting_Title.replace(/["~`!@#$%^&*()=+[\]{}|:;<>\\/,.?'\s]+/g,'-'))
 return meta.list_url+'/'+record.id+'/'+slug+'?source='+encodeURIComponent(meta.source)
}
export function readDentalkartBootstrap(owned,need){
 const found=owned.nodes.filter(n=>n.tag==='script'&&!n.attrs.src&&/initializeJobList\s*\(/.test(n.raw)&&/DOMContentLoaded/.test(n.raw));need(found.length===1,'Native recruitment bootstrap missing or ambiguous')
 const executable=node=>!node.inert&&!node.nativeTagUnqualified&&!Object.hasOwn(node.attrs,'nomodule')&&['','text/javascript','application/javascript'].includes((node.attrs.type??'').toLowerCase())
 need(executable(found[0]),'Native recruitment bootstrap is not an active executable declaration')
 const ast=parse(found[0].raw,{ecmaVersion:'latest'}),listeners=calls(ast,n=>member(n.callee,'document','addEventListener')&&n.arguments[0]?.value==='DOMContentLoaded')
 need(listeners.length===1,'Native recruitment bootstrap event changed')
 const body=listeners[0].arguments[1]?.body,initializers=calls(body,n=>n.callee?.name==='initializeJobList'),modules=calls(body,n=>member(n.callee,'store','pushPayload')&&n.arguments[0]?.value==='module'&&n.arguments[1]?.name==='moduleMeta')
 need(initializers.length===1&&modules.length===1,'Native original record initialization changed')
 let binding;walk(body,n=>{if(n.type==='VariableDeclarator'&&n.init===modules[0])binding=n.id.name})
 const moduleID=n=>member(n,binding,'id')||n?.type==='MemberExpression'&&n.property?.name==='id'&&n.object?.type==='MemberExpression'&&n.object.object?.name===binding&&n.object.property?.value===0
 const payloads=calls(body,n=>member(n.callee,'store','pushPayload')&&moduleID(n.arguments[0])&&n.arguments[1]?.name==='jobs'),renders=calls(body,n=>n.callee?.name==='renderJobListing'&&moduleID(n.arguments[0]))
 need(binding&&payloads.length===1&&renders.length===1&&initializers[0].start<modules[0].start&&modules[0].start<payloads[0].start&&payloads[0].start<renders[0].start,'Native records-to-listing binding changed')
 const clients=owned.nodes.filter(n=>n.tag==='script'&&typeof n.attrs.src==='string'&&/^https:\/\/static\.zohocdn\.com\/recruit\/javascript\/career-website-common\.[a-f\d]{32}\.js$/.test(n.attrs.src))
 need(clients.length===1&&executable(clients[0]),'Native recruitment client declaration missing, inert or ambiguous');return clients[0].attrs.src
}
function alpha(node,external={}){let serial=0;const bind=(pattern,scope)=>{if(!pattern)return;if(pattern.type==='Identifier'){if(!scope.has(pattern.name))scope.set(pattern.name,'local'+serial++);return}if(pattern.type==='ObjectPattern')for(const p of pattern.properties)bind(p.value??p.argument,scope);else if(pattern.type==='ArrayPattern')for(const p of pattern.elements)bind(p,scope);else if(pattern.type==='AssignmentPattern')bind(pattern.left,scope);else if(pattern.type==='RestElement')bind(pattern.argument,scope)},normalize=(value,scope)=>{if(value==null||typeof value!=='object')return value;if(Array.isArray(value))return value.map(n=>normalize(n,scope));if(value.type==='Identifier')return{type:'Identifier',name:scope.get(value.name)??value.name};if(['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(value.type)){const local=new Map(scope),own=[];if(value.id)own.push(value.id);own.push(...value.params);const collect=n=>{if(!n||typeof n!=='object')return;if(n!==value.body&&['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(n.type))return;if(n.type==='VariableDeclarator')own.push(n.id);for(const v of Object.values(n))if(v&&typeof v==='object')Array.isArray(v)?v.forEach(collect):collect(v)};collect(value.body);const names=new Map();for(const p of own)bind(p,names);for(const[n,token]of names)local.set(n,token);return Object.fromEntries(Object.entries(value).filter(([k])=>!['start','end','loc','raw'].includes(k)).map(([k,v])=>[k,normalize(v,local)]))}const result={};for(const[k,v]of Object.entries(value)){if(['start','end','loc','raw','shorthand'].includes(k))continue;if(k==='key'&&['Property','MethodDefinition'].includes(value.type)&&!value.computed||k==='property'&&value.type==='MemberExpression'&&!value.computed)result[k]=v.type==='Identifier'?{type:'Identifier',name:v.name}:normalize(v,scope);else result[k]=normalize(v,scope)}return result};return JSON.stringify(normalize(node,new Map(Object.entries(external))))}
