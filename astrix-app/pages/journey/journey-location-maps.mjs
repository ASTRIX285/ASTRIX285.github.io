// Journey-owned interactive map registry and viewer.
// Add destinations one approved map at a time without changing the shared selector.

const JOURNEY_LOCATION_MAPS=Object.freeze({
  cosmodrome:Object.freeze({
    src:'./assets/maps/cosmodrome-director-map-4k.webp',
    detailSrc:'./assets/maps/cosmodrome-director-map-6k.webp',
    alt:'Cosmodrome Director map showing Mothyards, The Steps, Skywatch, Forgotten Shore, The Divide and The Breach.',
    markers:Object.freeze([
      Object.freeze({key:'grasp-of-avarice',type:'dungeon',name:'Grasp of Avarice',x:42,y:22}),
      Object.freeze({key:'skywatch-landing-zone',type:'landing',name:'Skywatch',x:56,y:25}),
      Object.freeze({key:'the-disgraced',type:'strike',name:'The Disgraced',x:79,y:40}),
      Object.freeze({key:'the-devils-lair',type:'strike',name:"The Devils' Lair",x:54,y:60}),
      Object.freeze({key:'fallen-saber',type:'strike',name:'Fallen S.A.B.E.R.',x:80,y:57}),
      Object.freeze({key:'veles-labyrinth',type:'lost-sector',name:'Veles Labyrinth',x:76,y:70}),
      Object.freeze({key:'shaw-han',type:'vendor',name:'Shaw Han',x:28,y:69}),
      Object.freeze({key:'the-steppes-landing-zone',type:'landing',name:'The Steppes',x:34,y:77}),
      Object.freeze({key:'exodus-garden-2a',type:'lost-sector',name:'Exodus Garden 2A',x:43,y:86})
    ])
  })
});

const MARKER_TYPE_LABELS=Object.freeze({
  landing:'Landing zone',
  'lost-sector':'Lost Sector',
  strike:'Strike',
  dungeon:'Dungeon',
  vendor:'Vendor'
});

function markerIcon(type){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 32 32');
  svg.setAttribute('aria-hidden','true');
  svg.classList.add('journey-map-marker-glyph');
  const paths={
    landing:'<circle cx="16" cy="16" r="13"/><path d="M9 12h14l-7 9z"/>',
    'lost-sector':'<path d="M7 4h18v18l-9 6-9-6z"/><path d="M11 21v-7a5 5 0 0 1 10 0v7M14 21v-7a2 2 0 0 1 4 0v7"/>',
    strike:'<path d="M6 4h20v17l-10 7-10-7z"/><path d="m9 12 7-4 7 4v3l-7-4-7 4zm0 6 7-4 7 4v3l-7-4-7 4z"/>',
    dungeon:'<circle cx="16" cy="16" r="13"/><path d="M10 22V9h12v13M13 9v13m6-13v13M9 13h14M9 18h14"/>',
    vendor:'<path d="M7 4h18v18l-9 6-9-6z"/><circle cx="16" cy="12" r="4"/><path d="M10 22c1-4 3-6 6-6s5 2 6 6z"/>'
  };
  svg.innerHTML=paths[type]||'';
  return svg;
}

function createStaticMarkers(markers){
  const layer=document.createElement('div');
  layer.className='journey-map-marker-layer';
  layer.setAttribute('aria-label','Cosmodrome activity locations');
  for(const marker of markers||[]){
    const item=document.createElement('span');
    item.className='journey-map-marker';
    item.dataset.markerKey=marker.key;
    item.dataset.markerType=marker.type;
    item.style.left=`${marker.x}%`;
    item.style.top=`${marker.y}%`;
    item.setAttribute('role','img');
    item.setAttribute('aria-label',`${MARKER_TYPE_LABELS[marker.type]}: ${marker.name}`);

    const icon=document.createElement('span');
    icon.className='journey-map-marker-icon';
    icon.append(markerIcon(marker.type));

    const copy=document.createElement('span');
    copy.className='journey-map-marker-copy';
    const name=document.createElement('strong');
    name.textContent=marker.name;
    const type=document.createElement('small');
    type.textContent=MARKER_TYPE_LABELS[marker.type];
    copy.append(name,type);
    item.append(icon,copy);
    layer.append(item);
  }
  return layer;
}

function createLocationMap(key,spec){
  const figure=document.createElement('figure');
  figure.className='journey-location-map';
  figure.dataset.mapKey=key;

  const toolbar=document.createElement('figcaption');
  toolbar.className='journey-map-toolbar';

  const instruction=document.createElement('span');
  instruction.className='journey-map-instruction';
  instruction.textContent='DRAG TO EXPLORE · SCROLL TO ZOOM';

  const controls=document.createElement('span');
  controls.className='journey-map-controls';
  controls.setAttribute('aria-label','Map zoom controls');

  const zoomOut=document.createElement('button');
  zoomOut.type='button';
  zoomOut.dataset.mapAction='out';
  zoomOut.setAttribute('aria-label','Zoom out');
  zoomOut.textContent='−';

  const zoomStatus=document.createElement('output');
  zoomStatus.className='journey-map-zoom';
  zoomStatus.setAttribute('aria-live','polite');
  zoomStatus.textContent='100%';

  const zoomIn=document.createElement('button');
  zoomIn.type='button';
  zoomIn.dataset.mapAction='in';
  zoomIn.setAttribute('aria-label','Zoom in');
  zoomIn.textContent='+';

  const reset=document.createElement('button');
  reset.type='button';
  reset.dataset.mapAction='reset';
  reset.className='journey-map-reset';
  reset.textContent='RESET';

  controls.append(zoomOut,zoomStatus,zoomIn,reset);
  toolbar.append(instruction,controls);

  const viewport=document.createElement('div');
  viewport.className='journey-map-viewport';
  viewport.tabIndex=0;
  viewport.setAttribute('aria-label','Interactive Cosmodrome map. Drag to move, use the mouse wheel or controls to zoom, and use arrow keys to pan.');

  const image=document.createElement('img');
  image.className='journey-map-image';
  image.src=spec.src;
  image.alt=spec.alt;
  image.draggable=false;
  const stage=document.createElement('div');
  stage.className='journey-map-stage';
  stage.append(image,createStaticMarkers(spec.markers));
  viewport.append(stage);
  figure.append(toolbar,viewport);

  const state={scale:1,x:0,y:0,dragging:false,startX:0,startY:0,originX:0,originY:0};
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

  function requestDetailSource(){
    if(!spec.detailSrc||image.dataset.detailRequested==='true')return;
    image.dataset.detailRequested='true';
    image.src=spec.detailSrc;
  }

  function applyMapPosition(){
    const maxX=viewport.clientWidth*(state.scale-1)/2;
    const maxY=viewport.clientHeight*(state.scale-1)/2;
    state.x=clamp(state.x,-maxX,maxX);
    state.y=clamp(state.y,-maxY,maxY);
    stage.style.transform=`translate3d(${state.x}px,${state.y}px,0) scale(${state.scale})`;
    stage.style.setProperty('--journey-marker-scale',String(1/state.scale));
    zoomStatus.textContent=`${Math.round(state.scale*100)}%`;
    zoomOut.disabled=state.scale<=1;
    zoomIn.disabled=state.scale>=3;
  }

  function setScale(next){
    state.scale=Math.round(clamp(next,1,3)*4)/4;
    if(state.scale>1)requestDetailSource();
    if(state.scale===1){state.x=0;state.y=0;}
    applyMapPosition();
  }

  viewport.addEventListener('pointerdown',(event)=>{
    if(event.button!==0)return;
    state.dragging=true;
    state.startX=event.clientX;
    state.startY=event.clientY;
    state.originX=state.x;
    state.originY=state.y;
    viewport.classList.add('is-dragging');
    viewport.setPointerCapture(event.pointerId);
  });
  viewport.addEventListener('pointermove',(event)=>{
    if(!state.dragging)return;
    state.x=state.originX+(event.clientX-state.startX);
    state.y=state.originY+(event.clientY-state.startY);
    applyMapPosition();
  });
  const stopDragging=(event)=>{
    if(!state.dragging)return;
    state.dragging=false;
    viewport.classList.remove('is-dragging');
    if(viewport.hasPointerCapture(event.pointerId))viewport.releasePointerCapture(event.pointerId);
  };
  viewport.addEventListener('pointerup',stopDragging);
  viewport.addEventListener('pointercancel',stopDragging);
  viewport.addEventListener('wheel',(event)=>{
    event.preventDefault();
    setScale(state.scale+(event.deltaY<0?.25:-.25));
  },{passive:false});
  viewport.addEventListener('keydown',(event)=>{
    const step=32;
    if(event.key==='ArrowLeft')state.x+=step;
    else if(event.key==='ArrowRight')state.x-=step;
    else if(event.key==='ArrowUp')state.y+=step;
    else if(event.key==='ArrowDown')state.y-=step;
    else if(event.key==='+'||event.key==='=')setScale(state.scale+.25);
    else if(event.key==='-')setScale(state.scale-.25);
    else if(event.key==='0'){state.x=0;state.y=0;setScale(1);}
    else return;
    event.preventDefault();
    applyMapPosition();
  });
  controls.addEventListener('click',(event)=>{
    const action=event.target.closest('button')?.dataset.mapAction;
    if(action==='in')setScale(state.scale+.25);
    if(action==='out')setScale(state.scale-.25);
    if(action==='reset'){state.x=0;state.y=0;setScale(1);}
  });
  image.addEventListener('load',applyMapPosition,{once:true});
  applyMapPosition();
  return figure;
}

export function initJourneyLocationMaps(detail){
  const render=(event)=>{
    const key=event?.detail?.key||globalThis.AstrixDestinations?.current();
    const spec=JOURNEY_LOCATION_MAPS[key];
    if(!spec||detail.querySelector(`[data-map-key="${key}"]`))return;
    detail.append(createLocationMap(key,spec));
  };
  document.addEventListener('astrix:destination-changed',render);
  render();
}
