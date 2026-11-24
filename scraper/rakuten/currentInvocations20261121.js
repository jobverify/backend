import {need} from './currentFacts20261121.js'

// Normalize only finite literal arguments and native call/apply/bind forms.
// Original syntax and lexical identities are inspected, never evaluated.
export function normalizeInvocation(program,callee,args,{onArray=()=>{}}={}){
 const resolve=node=>program.resolve(node),member=node=>program.member(resolve(node))
 const property=(node,name)=>node?.type==='MemberExpression'&&member(node)===name
 const method=(node,name)=>node?.type==='CallExpression'&&property(node.callee,name)
 const array=node=>{const value=resolve(node);if(value?.type==='ArrayExpression')onArray(value);return value}
 const expand=(values,depth=0)=>{
  need(depth<16,'finite connected invocation spread exceeded')
  const args=[];let unknown=false
  for(const arg of values){
   if(arg?.type!=='SpreadElement'){args.push(arg);continue}
   const value=array(arg.argument)
   if(value?.type!=='ArrayExpression'){unknown=true;continue}
   const nested=expand(value.elements,depth+1);args.push(...nested.args);unknown||=nested.unknown
  }
  return{args,unknown}
 }
 const invoke=(callee,args,thisValue=null,depth=0)=>{
  need(depth<16,'finite connected invocation alias exceeded')
  const value=resolve(callee)
  if(value?.type==='CallExpression'&&method(value,'bind')){
   const bound=expand(value.arguments)
   if(bound.unknown)return{callee:value.callee.object,args:[],thisValue:null,unknown:true}
   return invoke(value.callee.object,[...bound.args.slice(1),...args],bound.args[0],depth+1)
  }
  if(value?.type==='MemberExpression'){
   const name=member(value)
   if(name==='bind')return null
   if(name==='apply'&&program.builtin(value.object,'Reflect')){
    const values=expand(args),items=array(values.args[2]),target=values.args[0],receiver=values.args[1]
    if(values.unknown||items?.type!=='ArrayExpression')return{callee:resolve(target),args:[],thisValue:receiver,unknown:true}
    return invoke(target,items.elements,receiver,depth+1)
   }
   if(name==='call'){
    const values=expand(args)
    if(values.unknown)return{callee:value.object,args:[],thisValue,unknown:true}
    if(property(value.object,'prototype')&&program.builtin(value.object.object,'Function'))return invoke(thisValue,values.args.slice(1),values.args[0],depth+1)
    return invoke(value.object,values.args.slice(1),values.args[0],depth+1)
   }
   if(name==='apply'){
    const values=expand(args),items=array(values.args[1])
    if(values.unknown||items&&items.type!=='ArrayExpression')return{callee:value.object,args:[],thisValue:values.args[0],unknown:true}
    return invoke(value.object,items?.elements??[],values.args[0],depth+1)
   }
  }
  const values=expand(args)
  return{callee:value,args:values.args,thisValue,unknown:values.unknown}
 }
 return invoke(callee,args)
}
