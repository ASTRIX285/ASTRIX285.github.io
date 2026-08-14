const backdrop=document.querySelector('.stage-backdrop');

if(backdrop && !matchMedia('(prefers-reduced-motion: reduce)').matches){
  const source='../../../video/Digital%20Growth%20Hero%20Loop%20Slow.mp4';
  const makeVideo=()=>{
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

  const videos=[makeVideo(),makeVideo()];
  const metadata=video=>new Promise(resolve=>{
    if(video.readyState>=1) resolve();
    else video.addEventListener('loadedmetadata',resolve,{once:true});
  });

  Promise.all(videos.map(metadata)).then(()=>{
    videos[1].currentTime=videos[1].duration/2;
    videos.forEach(video=>{
      video.play().catch(()=>{});
      requestAnimationFrame(()=>video.classList.add('is-active'));
    });
  });
}
