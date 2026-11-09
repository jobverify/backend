/** Experimental numeric transport; rendering and fact validation remain unchanged. */
export function minimalPlanTransport(schema,messages) {
  const categories=schema.properties.categories;
  const enums=categories.minItems?categories.items.map(item=>item.enum):[];
  const overview=schema.properties.overviewFactId.enum||[null];
  const literal=value=>JSON.stringify(JSON.stringify(value));
  const alternatives=values=>'('+values.map(literal).join(' | ')+')';
  const grammar='root ::= "[" '+[overview,...enums].map(alternatives).join(' "," ')+ ' "]"\n';
  return {
    grammar,
    messages:messages.map(message=>message.role==='system'?{...message,content:message.content+
      ' Output format: [overviewFactId, category0, category1, ...]. The first value is the overview ID (null if none); subsequent values are categories for unlabelled facts in order. Return only this JSON array.'}:message),
    decode(value){
      if(!Array.isArray(value)||value.length!==enums.length+1||!overview.includes(value[0]))return null;
      if(enums.some((allowed,index)=>!allowed.includes(value[index+1])))return null;
      return {overviewFactId:value[0],categories:value.slice(1)};
    },
  };
}
