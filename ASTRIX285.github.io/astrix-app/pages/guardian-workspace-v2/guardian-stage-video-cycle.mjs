const backdrop=document.querySelector('.stage-backdrop');

if(backdrop && !matchMedia('(prefers-reduced-motion: reduce)').matches){
  const sources=[
    '../../../video/Digital%20Growth%20Hero%20Pass%20A.mp4',
    '../../../video/Digital%20Growth%20Hero%20Pass%20B.mp4'
  ];
  const makeVideo=(source)=>{
    const video=document.createElement('video');
    video.className='stage-paradox-video';
    video.loop=true;
    video.muted=true;
    video.defaultMuted=true;
    video.playsInline=true;
    video.preload='auto';
    video.defaultPlaybackRate=1;
    video.playbackRate=1;
    video.src=source;
    backdrop.prepend(video);
    return video;
  };

  const videos=sources.map(makeVideo);
  const metadata=video=>new Promise(resolve=>{
    if(video.readyState>=1) resolve();
    else video.addEventListener('loadedmetadata',resolve,{once:true});
  });

  Promise.all(videos.map(metadata)).then(()=>{
    videos.forEach(video=>{
      video.play().catch(()=>{});
      requestAnimationFrame(()=>video.classList.add('is-active'));
    });
  });
}
