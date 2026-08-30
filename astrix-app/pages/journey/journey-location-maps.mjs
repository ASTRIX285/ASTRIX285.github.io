// Journey-owned interactive map registry and viewer.
// Add destinations one approved map at a time without changing the shared selector.

const JOURNEY_LOCATION_MAPS=Object.freeze({
  cosmodrome:Object.freeze({
    src:'./assets/maps/cosmodrome-director-map-4k.webp',
    alt:'Cosmodrome Director map showing Mothyards, The Steps, Skywatch, Forgotten Shore, The Divide and The Breach.'
  })
});

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
  viewport.append(image);
  figure.append(toolbar,viewport);

  const state={scale:1,x:0,y:0,dragging:false,startX:0,startY:0,originX:0,originY:0};
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

  function applyMapPosition(){
    const maxX=viewport.clientWidth*(state.scale-1)/2;
    const maxY=viewport.clientHeight*(state.scale-1)/2;
    state.x=clamp(state.x,-maxX,maxX);
    state.y=clamp(state.y,-maxY,maxY);
    image.style.transform=`translate3d(${state.x}px,${state.y}px,0) scale(${state.scale})`;
    zoomStatus.textContent=`${Math.round(state.scale*100)}%`;
    zoomOut.disabled=state.scale<=1;
    zoomIn.disabled=state.scale>=3;
  }

  function setScale(next){
    state.scale=Math.round(clamp(next,1,3)*4)/4;
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
