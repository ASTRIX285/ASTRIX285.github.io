const backdrop=document.querySelector('.stage-backdrop');
if(backdrop && !matchMedia('(prefers-reduced-motion: reduce)').matches){
  const clips=[
    '../../../video/Digital%20Growth%206.mp4',
    '../../../video/Digital%20Growth%205.mp4'
  ];

  const existing=backdrop.querySelector('.stage-paradox-video');
  const makeVideo=(src)=>{
    const v=document.createElement('video');
    v.className='stage-paradox-video';
    v.autoplay=true;
    v.muted=true;
    v.playsInline=true;
    v.preload='auto';
    v.src=src;
    return v;
  };

  const a=existing || makeVideo(clips[0]);
  const b=makeVideo(clips[1]);
  if(!existing) backdrop.prepend(a);
  backdrop.insertBefore(b,backdrop.firstChild?.nextSibling || null);

  const videos=[a,b];
  videos.forEach(v=>{v.loop=false;v.muted=true;v.playsInline=true;});

  let active=0;
  let switching=false;
  const FADE_SECONDS=2.6;
  const SAFETY_SECONDS=3.2;

  async function activate(index,reset=true){
    const incoming=videos[index];
    const outgoing=videos[1-index];
    if(reset){
      try{incoming.currentTime=0;}catch{}
    }
    incoming.classList.remove('is-fading');
    outgoing.classList.add('is-fading');
    try{await incoming.play();}catch{}
    requestAnimationFrame(()=>incoming.classList.add('is-active'));
    outgoing.classList.remove('is-active');
    setTimeout(()=>{try{outgoing.pause();}catch{}},FADE_SECONDS*1000+250);
  }

  function maybeCrossfade(){
    const current=videos[active];
    if(!current.duration || !Number.isFinite(current.duration) || switching) return;
    const remaining=current.duration-current.currentTime;
    if(remaining<=Math.max(FADE_SECONDS+0.5,SAFETY_SECONDS)){
      switching=true;
      const next=1-active;
      activate(next,true).finally(()=>{
        active=next;
        setTimeout(()=>{switching=false;},FADE_SECONDS*1000);
      });
    }
  }

  videos.forEach(v=>{
    v.addEventListener('timeupdate',maybeCrossfade);
    v.addEventListener('ended',()=>{
      if(switching) return;
      switching=true;
      const next=1-active;
      activate(next,true).finally(()=>{
        active=next;
        setTimeout(()=>{switching=false;},FADE_SECONDS*1000);
      });
    });
  });

  a.addEventListener('loadedmetadata',()=>activate(0,false),{once:true});
  if(a.readyState>=1) activate(0,false);
}
