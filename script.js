/* =========================================================================
   TASTE-SKILL PHYSICS CORE (Vanilla JS)
   Perpetual Micro-Interactions, Magnetic Hover, Parallax, Stagger
   ========================================================================= */

// Breakpoint: acima disso o scroll-scrub funciona; abaixo, vídeos viram autoplay+loop.
// Isso evita o bug clássico de "tela travada": quando o vídeo sai da viewport
// em layouts coluna (mobile), o usuário rolava no vazio sem ver nada acontecer.
const SCRUB_BREAKPOINT = 768;
const isMobileViewport = () => window.innerWidth <= SCRUB_BREAKPOINT;


// --- 1. NAVBAR (estilo ao rolar) ---
const nav = document.querySelector('.main-nav');

window.addEventListener('scroll', () => {
  if (window.scrollY > 50) {
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('scrolled');
  }
}, { passive: true });


// --- 2. INTERSECTION OBSERVER REVEALS (Staggered Load) ---
const revealElements = document.querySelectorAll('[data-scroll-reveal]');

const loadObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const el = entry.target;
      const delay = el.getAttribute('data-delay') || 0;
      setTimeout(() => {
        el.classList.add('is-revealed');
      }, delay);
      observer.unobserve(el);
    }
  });
}, {
  root: null,
  threshold: 0.1,
  rootMargin: "-50px"
});

revealElements.forEach(el => loadObserver.observe(el));


// --- 3. MAGNETIC HOVER PHYSICS ---
// Em dispositivos touch o magnetic não faz sentido (não há cursor),
// então só ativamos em telas que suportam hover real.
const supportsHover = window.matchMedia('(hover: hover)').matches;

if (supportsHover) {
  const magneticEls = document.querySelectorAll('.magnetic');

  magneticEls.forEach((el) => {
    const strengthText = el.querySelector('.btn-text');
    const maxDistance = el.getAttribute('data-magnetic-strength') || 30;

    let currentDx = 0;
    let currentDy = 0;

    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();

      // Descontamos o translate atual para achar a posição "real" do elemento
      // e evitar feedback loop (tremor) quando o rect muda por causa do próprio transform.
      const realLeft = rect.left - currentDx;
      const realTop  = rect.top  - currentDy;

      const h = rect.width  / 2;
      const w = rect.height / 2;

      const x = e.clientX - realLeft - h;
      const y = e.clientY - realTop  - w;

      currentDx = (x / h) * (maxDistance * 0.5);
      currentDy = (y / w) * (maxDistance * 0.5);

      el.style.transform = `translate3d(${currentDx}px, ${currentDy}px, 0)`;

      if (strengthText) {
        strengthText.style.transform = `translate3d(${currentDx * 0.25}px, ${currentDy * 0.25}px, 0)`;
      }
    });

    el.addEventListener('mouseleave', () => {
      currentDx = 0;
      currentDy = 0;

      el.style.transition = 'transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
      el.style.transform = 'translate3d(0px, 0px, 0px)';

      if (strengthText) {
        strengthText.style.transition = 'transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
        strengthText.style.transform = 'translate3d(0px, 0px, 0px)';
      }

      setTimeout(() => {
        el.style.transition = '';
        if (strengthText) strengthText.style.transition = '';
      }, 800);
    });
  });
}


// --- 4. VIDEO SCROLL SCRUBBING ---
// Desktop: vídeo segue o scroll (scrub).
// Mobile/Tablet: vídeo vira autoplay + loop — mesmo efeito visual, sem travar scroll.
const setupVideoScrub = (wrapperId, videoId) => {
  const scrollWrapper = document.getElementById(wrapperId);
  const scrubVideo    = document.getElementById(videoId);

  if (!scrollWrapper || !scrubVideo) return;

  // Atributos obrigatórios pra autoplay funcionar em iOS/Android
  scrubVideo.muted = true;
  scrubVideo.playsInline = true;
  scrubVideo.setAttribute('playsinline', '');

  if (isMobileViewport()) {
    // Mobile: autoplay com loop
    scrubVideo.loop = true;
    scrubVideo.autoplay = true;
    const tryPlay = () => {
      const p = scrubVideo.play();
      if (p && typeof p.catch === 'function') {
        // Se o navegador bloquear o autoplay, não quebra nada — fica no frame 0.
        p.catch(() => {});
      }
    };
    if (scrubVideo.readyState >= 2) {
      tryPlay();
    } else {
      scrubVideo.addEventListener('loadeddata', tryPlay, { once: true });
    }
    return;
  }

  // Desktop: scroll-scrub
  scrubVideo.loop = false;
  scrubVideo.autoplay = false;

  scrubVideo.addEventListener('loadedmetadata', () => {
    scrubVideo.pause();
  });

  let targetTime = 0;
  let currentScrubTime = 0;

  const updateTargetTime = () => {
    const scrollY             = window.scrollY;
    const wrapperTop          = scrollWrapper.offsetTop;
    const wrapperHeight       = scrollWrapper.offsetHeight;
    const windowHeight        = window.innerHeight;
    const scrollableDistance  = wrapperHeight - windowHeight;
    const currentScrollInfo   = scrollY - wrapperTop;

    const progress = Math.max(0, Math.min(1, currentScrollInfo / scrollableDistance));

    if (scrubVideo.readyState >= 1 && scrubVideo.duration > 0) {
      targetTime = progress * scrubVideo.duration;
    }
  };

  const smoothScrub = () => {
    if (scrubVideo.readyState >= 1 && scrubVideo.duration > 0) {
      currentScrubTime += (targetTime - currentScrubTime) * 0.08;
      // Previne o travamento do navegador esperando o 'seek' terminar antes de pedir o próximo frame
      if (!scrubVideo.seeking && Math.abs(targetTime - scrubVideo.currentTime) > 0.01) {
        scrubVideo.currentTime = currentScrubTime;
      }
    }
    requestAnimationFrame(smoothScrub);
  };

  window.addEventListener('scroll', () => {
    requestAnimationFrame(updateTargetTime);
  }, { passive: true });

  // Initial call to set target time
  updateTargetTime();
  requestAnimationFrame(smoothScrub);
};

setupVideoScrub('hero-scroll-wrapper',    'hero-scrub-video');
setupVideoScrub('switch-scroll-wrapper',  'switch-scrub-video');
setupVideoScrub('keycaps-scroll-wrapper', 'keycaps-scrub-video');


// --- 5. RESIZE HANDLER ---
// Se o usuário redimensionar a janela atravessando o breakpoint,
// recarregamos a página pra reavaliar o modo dos vídeos (scrub vs loop).
// Debounced para não disparar a cada pixel.
let resizeTimer;
let lastWasMobile = isMobileViewport();
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const nowMobile = isMobileViewport();
    if (nowMobile !== lastWasMobile) {
      lastWasMobile = nowMobile;
      window.location.reload();
    }
  }, 300);
});


// --- 6. PARALLAX SCROLL BINDINGS ---
const parallaxContainers = document.querySelectorAll('.parallax-layer');
const parallaxImages     = document.querySelectorAll('.bento-card .parallax-img');

const runScrollParallax = () => {
  const scrollY        = window.scrollY;
  const viewportHeight = window.innerHeight;

  parallaxContainers.forEach(el => {
    el.style.setProperty('--parallax-y', scrollY);
  });

  parallaxImages.forEach(img => {
    const card = img.closest('.bento-card');
    if (!card) return;
    const rect = card.getBoundingClientRect();

    if (rect.top < viewportHeight && rect.bottom > 0) {
      const progress = 1 - (rect.bottom / (viewportHeight + rect.height));
      const yMove = (progress * 20) - 10;
      img.style.transform = `translateY(${yMove}%)`;
    }
  });

  requestAnimationFrame(runScrollParallax);
};

requestAnimationFrame(runScrollParallax);