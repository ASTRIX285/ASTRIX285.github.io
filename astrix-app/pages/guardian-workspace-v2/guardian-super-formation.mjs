import {cleanImageElement} from './guardian-bungie-icon-cleaner.mjs?v=20260824-icon-cleaner-2';

const BUNGIE='https://www.bungie.net';
const SUBCLASS_KEYS=Object.freeze(['void','arc','solar','strand','stasis','prismatic']);

function resolvedSuperIcon(item){
  if(!item)return '';
  const display=item?.definition?.displayProperties||item?.displayProperties||{};
  const sequenceFrame=Array.isArray(display?.iconSequences)
    ? display.iconSequences.flatMap(sequence=>Array.isArray(sequence?.frames)?sequence.frames:[]).find(Boolean)
    : '';
  return item.icon||display.icon||display.highResIcon||sequenceFrame||item?.definition?.secondaryIcon||item?.secondaryIcon||'';
}

function absoluteIcon(path){
  if(!path)return '';
  const value=String(path);
  return /^(?:https?:|data:|blob:)/i.test(value)?value:`${BUNGIE}${value}`;
}
function itemKey(item){return String(item?.hash??item?.itemHash??item?.name??resolvedSuperIcon(item)??'');}
function subclassKey(value,activeSuper){
  const text=[value,activeSuper?.element,activeSuper?.subclass,activeSuper?.damageType,activeSuper?.name].filter(Boolean).join(' ').toLowerCase();
  return SUBCLASS_KEYS.find(key=>text.includes(key))||'void';
}

function renderEquippedSubclass({root,iconNode,nameNode,metaNode,subclass='',subclassName='',characterClass='',icon=''}={}){
  if(!root)return;
  const key=subclassKey([subclass,subclassName].filter(Boolean).join(' '),null);
  const classLabel=String(characterClass||'Guardian').trim();
  const suppliedLabel=String(subclassName||subclass||'Subclass').trim();
  const subclassLabel=SUBCLASS_KEYS.includes(key)?key:suppliedLabel;
  const identity=suppliedLabel.toLowerCase().includes(classLabel.toLowerCase())
    ? suppliedLabel
    : `${subclassLabel} ${classLabel}`;

  document.documentElement.dataset.subclass=key;
  root.dataset.subclass=key;
  if(nameNode)nameNode.textContent=identity.toUpperCase();
  if(metaNode)metaNode.textContent=`${classLabel} SUBCLASS`.toUpperCase();
  if(iconNode){
    const src=absoluteIcon(icon);
    iconNode.alt=src?`${identity} subclass icon`:'';
    iconNode.hidden=!src;
    root.classList.toggle('has-live-icon',Boolean(src));
    if(src)void cleanImageElement(iconNode,src);
    else iconNode.removeAttribute('src');
  }
}

function setDiamondFromItem(diamond,item,fallbackTitle='Super unavailable'){
  if(!diamond)return;
  const holder=diamond.querySelector('span');
  if(!holder)return;
  const title=String(item?.name||item?.displayName||fallbackTitle).trim();
  const src=absoluteIcon(resolvedSuperIcon(item));
  diamond.onclick=null;
  diamond.onkeydown=null;
  diamond.removeAttribute('data-select-kind');
  diamond.removeAttribute('data-select-index');
  if(src){
    let image=holder.querySelector('img.super-feature__icon');
    if(!image){holder.textContent='';image=document.createElement('img');image.className='super-feature__icon';holder.appendChild(image);}
    image.alt=title;
    diamond.classList.add('has-live-icon');
    diamond.tabIndex=0;
    diamond.setAttribute('role','button');
    void cleanImageElement(image,src);
  }else{
    holder.replaceChildren();
    diamond.classList.remove('has-live-icon');
    diamond.tabIndex=-1;
    diamond.removeAttribute('role');
  }
  diamond.title=title;
  diamond.setAttribute('aria-label',title);
}

function renderSuperFormation({host,nameNode=null,activeSuper=null,superOptions=[],subclass='',selectKind='',onSelect=null}={}){
  if(!host)return;
  const feature=host.closest('.super-feature')||host;
  feature.dataset.superSubclass=subclassKey(subclass,activeSuper);
  const options=(Array.isArray(superOptions)?superOptions:[]).filter(Boolean).filter((item,index,rows)=>rows.findIndex(other=>itemKey(other)===itemKey(item))===index);
  const resolvedActive=activeSuper||options.find(item=>item?.isEquipped===true||item?.equipped===true)||null;
  const activeId=itemKey(resolvedActive);
  const alternates=options.filter(item=>itemKey(item)!==activeId).slice(0,5);
  const items=resolvedActive?[resolvedActive,...alternates]:[];
  /* The exact six-slot PSD frame is structural. Unresolved alternates remain
   * visible as transparent frames instead of collapsing the formation. */
  const slots=['equipped','alternate-5','alternate-4','alternate-3','alternate-2','alternate-1'].map(key=>host.querySelector(`[data-super-slot="${key}"]`));
  const resolvedCount=Math.min(6,items.length);
  host.dataset.superCount='6';
  feature.dataset.superCount='6';
  host.dataset.resolvedSuperCount=String(resolvedCount);
  feature.dataset.resolvedSuperCount=String(resolvedCount);
  host.dataset.activeSuper=activeId;
  host.dataset.superState=resolvedActive?'resolved':'unresolved';

  slots.forEach((slot,index)=>{
    const item=items[index]||null;
    if(slot)slot.hidden=false;
    setDiamondFromItem(slot,item,index===0?'Equipped Super unavailable':`Alternate Super ${index} unavailable`);
    slot?.classList.toggle('is-empty-super',!item);
    const selected=index===0&&Boolean(item);
    slot?.classList.toggle('is-selected',selected);
    slot?.classList.toggle('is-selected-super',selected);
    slot?.setAttribute('aria-current',selected?'true':'false');
    if(!slot||!item)return;
    const optionIndex=options.findIndex(option=>itemKey(option)===itemKey(item));
    if(selectKind&&optionIndex>=0){slot.dataset.selectKind=selectKind;slot.dataset.selectIndex=String(optionIndex);}
    if(typeof onSelect==='function'){
      const select=()=>{
        slots.forEach(node=>{node?.classList.toggle('is-selected',node===slot);node?.classList.toggle('is-selected-super',node===slot);node?.setAttribute('aria-current',node===slot?'true':'false');});
        if(nameNode)nameNode.textContent=item.name||item.displayName||'SELECTED SUPER';
        onSelect(item,optionIndex,slot);
      };
      slot.onclick=select;
      slot.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select();}};
    }
  });

  if(nameNode)nameNode.textContent=resolvedActive?.name||resolvedActive?.displayName||'SELECTED SUPER';
}

export {renderEquippedSubclass,renderSuperFormation,resolvedSuperIcon,setDiamondFromItem};
