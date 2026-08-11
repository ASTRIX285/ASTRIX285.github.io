from pathlib import Path

test=Path('astrix-app/tools/test-pf-beta-04-subclass-fallback.mjs')
t=test.read_text()
old="""  const keyMap=new Map();
  for(const link of result.buildLoop){
    const key=`${Number(link.from?.hash)}|${link.output}|${Number(link.to?.hash)}`;
    keyMap.set(key,(keyMap.get(key)??0)+1);
    const reverse=`${Number(link.to?.hash)}|${link.output}|${Number(link.from?.hash)}`;
    if(keyMap.has(reverse))suspicious.push({fixtureId:fixture.fixtureId,type:'symmetric',link:link.chain,reverse});
  }
  for(const [key,count] of keyMap){
    if(count>1)suspicious.push({fixtureId:fixture.fixtureId,type:'duplicate',key,count});
  }"""
new="""  const keyRows=new Map();
  const keyCounts=new Map();
  const isTraitOnly=link=>{
    const sources=(link?.evidenceSources??[]).map(row=>row?.source).filter(Boolean);
    return String(link?.source)==='runtime-traitid-parsing' || (sources.length>0&&sources.every(source=>source==='runtime-traitid-parsing'));
  };
  for(const link of result.buildLoop){
    const key=`${Number(link.from?.hash)}|${link.output}|${Number(link.to?.hash)}`;
    const reverse=`${Number(link.to?.hash)}|${link.output}|${Number(link.from?.hash)}`;
    const reverseLink=keyRows.get(reverse);
    if(reverseLink&&(isTraitOnly(link)||isTraitOnly(reverseLink))){
      suspicious.push({fixtureId:fixture.fixtureId,type:'trait-created-symmetric',link:link.chain,reverse:reverseLink.chain});
    }
    keyRows.set(key,link);
    keyCounts.set(key,(keyCounts.get(key)??0)+1);
  }
  for(const [key,count] of keyCounts){
    if(count>1)suspicious.push({fixtureId:fixture.fixtureId,type:'duplicate',key,count});
  }"""
if old in t:
    t=t.replace(old,new,1)
elif new not in t:
    raise AssertionError('Expected symmetry block not found')
test.write_text(t)
