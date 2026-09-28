(() => {
  const stage = document.querySelector('.device-stage');
  const scene = document.querySelector('.device-scene');
  const front = document.querySelector('.device-front');
  const angle = document.querySelector('.device-angle');
  const still = document.querySelector('.screen-still');
  const video = document.querySelector('.screen-video');
  const hand = document.querySelector('.tap-hand');
  const progressBar = document.querySelector('.page-progress span');
  const sections = [...document.querySelectorAll('.scene')];
  const navLinks = [...document.querySelectorAll('.site-header nav a')];
  const hardware = document.querySelector('.hardware');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const screens = {
    gallery: '/display-scope/assets/screen-gallery.jpg',
    dialogue: '/display-scope/assets/screen-dialogue.jpg',
    voice: '/display-scope/assets/screen-mic.jpg',
    wifi: '/display-scope/assets/screen-wifi.jpg'
  };
  const demos = {
    gallery: {
      src: '/display-scope/assets/screen-gallery.mp4', poster: screens.gallery, duration: 9.6,
      taps: [{ time: 4.8, left: 73, top: 41 }, { time: 9.6, left: 73, top: 41 }]
    },
    dialogue: {
      src: '/display-scope/assets/screen-conversation-demo.mp4', poster: '/display-scope/assets/screen-next-art.png', duration: 9,
      taps: [{ time: 2, left: 50.4, top: 42 }, { time: 4.6, left: 44.5, top: 52 }]
    },
    voice: {
      src: '/display-scope/assets/screen-recording-demo.mp4', poster: screens.voice, duration: 6.4,
      taps: [{ time: 2, left: 44.5, top: 52 }]
    }
  };

  Object.values(screens).forEach((src) => { const image = new Image(); image.src = src; });
  const clamp = (value) => Math.min(1, Math.max(0, value));
  const ease = (value) => value * value * (3 - 2 * value);
  let queued = false;
  let activeScreen = 'gallery';
  let activeDemo = 'gallery';
  let tapFrame = 0;

  function updateTap() {
    const demo = demos[activeDemo];
    if (!demo || video.paused || reducedMotion.matches) { stopTap(); return; }
    const time = video.currentTime;
    const tap = demo.taps.map((position) => ({
      ...position,
      distance: ((time - position.time + demo.duration * 1.5) % demo.duration) - demo.duration / 2
    })).find((position) => position.distance >= -.7 && position.distance < .45);
    const distance = tap ? tap.distance : -1;
    let opacity = 0;
    let shift = 80;
    if (distance >= -.7 && distance < -.1) {
      const progress = ease((distance + .7) / .6);
      opacity = Math.min(1, progress * 3);
      shift = 80 - 82 * progress;
    } else if (distance >= -.1 && distance <= .1) {
      opacity = 1;
      shift = -2;
    } else if (distance > .1 && distance < .45) {
      const progress = ease((distance - .1) / .35);
      opacity = 1 - progress;
      shift = -2 + 82 * progress;
    }
    hand.style.opacity = opacity;
    if (tap) {
      hand.style.left = `${tap.left}%`;
      hand.style.top = `${tap.top}%`;
    }
    hand.style.transform = `translateX(${shift}%)`;
    if (!video.paused && !reducedMotion.matches) tapFrame = requestAnimationFrame(updateTap);
  }

  function stopTap() {
    cancelAnimationFrame(tapFrame);
    tapFrame = 0;
    hand.style.opacity = 0;
  }

  video.addEventListener('play', () => { cancelAnimationFrame(tapFrame); updateTap(); });
  video.addEventListener('pause', stopTap);

  function render() {
    queued = false;
    const vh = innerHeight;
    const vw = innerWidth;
    const mobile = vw <= 700;
    const hero = sections[0];
    const arrival = ease(clamp(scrollY / (hero.offsetHeight * .7)));
    const x = mobile ? vw * .5 : vw * (.5 + .21 * arrival);
    const y = vh * (mobile ? (.71 + .05 * arrival) : (.79 - .26 * arrival));
    const scale = mobile ? .92 : .70 + .27 * arrival;

    stage.style.left = `${x}px`;
    stage.style.top = `${y}px`;
    stage.style.transform = `translate(-50%, -50%) scale(${scale})`;

    let current = sections[0];
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= vh * .55) current = section;
    }
    const screen = current.dataset.screen || 'gallery';
    if (screen !== activeScreen) {
      activeScreen = screen;
      still.src = screens[screen];
    }

    const frontWeight = current.dataset.view === 'front' ? 1 : 0;
    front.style.opacity = frontWeight;
    angle.style.opacity = 1 - frontWeight;
    const tilt = reducedMotion.matches ? 0 : Math.sin(scrollY / 880) * 2;
    scene.style.transform = `perspective(1400px) rotateY(${tilt}deg)`;

    const nextDemo = demos[screen] ? screen : null;
    if (nextDemo !== activeDemo) {
      video.pause();
      stopTap();
      activeDemo = nextDemo;
      if (nextDemo) {
        video.poster = demos[nextDemo].poster;
        video.src = demos[nextDemo].src;
        video.load();
      }
    }
    const playingDemo = frontWeight === 1 && nextDemo && !reducedMotion.matches;
    video.style.opacity = playingDemo ? 1 : 0;
    if (playingDemo && video.paused) video.play().catch(() => {});
    if (!playingDemo) { video.pause(); stopTap(); }

    const hardwareTop = hardware.getBoundingClientRect().top;
    stage.style.opacity = clamp((hardwareTop - vh * .43) / (vh * .4));
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - vh);
    progressBar.style.transform = `scaleX(${clamp(scrollY / maxScroll)})`;
    navLinks.forEach((link) => {
      const selected = link.hash === `#${current.id}`;
      link.classList.toggle('active', selected);
      if (selected) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }

  function schedule() {
    if (!queued) {
      queued = true;
      requestAnimationFrame(render);
    }
  }

  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  reducedMotion.addEventListener('change', schedule);
  render();
  if (!tapFrame && !video.paused && !reducedMotion.matches) updateTap();
})();
