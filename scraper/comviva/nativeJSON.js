// JSON.parse keeps only the final duplicate member. Native country, identity
// and criterion fields must retain their original meaning, including an
// earlier conflicting member, so every object is checked before admission.
export function parseNativeJSON(source){
 const value=JSON.parse(source),stack=[]
 for(let index=0;index<source.length;index++){
  const char=source[index]
  if(char==='"'){
   const start=index++
   for(;index<source.length&&source[index]!=='"';index++)if(source[index]==='\\')index++
   const parent=stack.at(-1)
   if(parent?.keys&&parent.expectKey){
    const key=JSON.parse(source.slice(start,index+1))
    if(parent.keys.has(key))throw Error('comviva native duplicate JSON key: '+key)
    parent.keys.add(key);parent.expectKey=false
   }
  }else if(char==='{'){stack.push({keys:new Set(),expectKey:true});if(stack.length>64)throw Error('comviva native JSON nesting budget exceeded')}
  else if(char==='['){stack.push({});if(stack.length>64)throw Error('comviva native JSON nesting budget exceeded')}
  else if(char==='}'||char===']')stack.pop()
  else if(char===','&&stack.at(-1)?.keys)stack.at(-1).expectKey=true
 }
 return value
}
