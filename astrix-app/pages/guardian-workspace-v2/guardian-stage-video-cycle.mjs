const backdrop=document.querySelector('.stage-backdrop');

if(backdrop && !matchMedia('(prefers-reduced-motion: reduce)').matches){
  const video=document.createElement('video');
  video.className='stage-paradox-video';
  video.autoplay=true;
  video.loop=true;
  video.muted=true;
  video.defaultMuted=true;
  video.playsInline=true;
  video.preload='auto';
  video.src='../../../video/Digital%20Growth%20Hero%20Loop.mp4';

  backdrop.prepend(video);

  const reveal=()=>{
    video.classList.remove('is-fading');
    requestAnimationFrame(()=>video.classList.add('is-active'));
  };

  video.addEventListener('playing',reveal,{once:true});
  video.play().catch(()=>{});
}
