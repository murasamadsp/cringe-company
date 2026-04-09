const resetScrollPosition = () => {
  if (window.location.hash) return;
  if (window.scrollY > 0) {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  }
};
try {
  if ("scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
  }
  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", resetScrollPosition);
  } else {
    resetScrollPosition();
  }
  window.addEventListener("pageshow", () => {
    resetScrollPosition();
  });
} catch (error) {
  // ignore browsers that do not support pageshow behavior
}

const canvas = document.getElementById("particleCanvas");
const ctx = canvas ? canvas.getContext("2d") : null;
const launchPanel = document.getElementById("launchPanel");
let dots = [];
const visualViewport = window.visualViewport || null;
const isMobileViewport = window.matchMedia("(max-width: 768px)").matches;
const networkInfo = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
const saveData = !!(networkInfo && networkInfo.saveData);
const baseCount = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || isMobileViewport || saveData ? 40 : 84;
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const hasCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
const isLowPowerDevice = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || hasCoarsePointer || isMobileViewport || saveData;
const maxLineLinks = isLowPowerDevice ? 28 : 70;
const particleFrameSkip = isLowPowerDevice ? 1 : 0;
const particleRatioClamp = isLowPowerDevice ? 1.3 : 1.8;
let skipNextParticleFrame = 0;
let viewportWidth = window.innerWidth;
let viewportHeight = window.innerHeight;
let scrollPerfTimer = null;
let scrollPaintPaused = false;
let particleFrame = 0;
let particleRunning = false;

function pauseForScrollPerformance() {
  if (!ctx || scrollPaintPaused || reducedMotionQuery.matches) return;
  scrollPaintPaused = true;
  stopParticleLoop();
  document.body.classList.add("is-scrolling");
  clearTimeout(scrollPerfTimer);
  scrollPerfTimer = setTimeout(() => {
    scrollPaintPaused = false;
    scrollPerfTimer = null;
    document.body.classList.remove("is-scrolling");
    startParticleLoop();
  }, 140);
}

function getParticleCount() {
  const densityDivisor = isLowPowerDevice ? 9000 : 7000;
  const area = viewportWidth * viewportHeight;
  const estimatedCount = Math.round(area / densityDivisor);
  return Math.max(28, Math.min(baseCount, estimatedCount));
}

function syncCanvasSize() {
  if (!ctx || reducedMotionQuery.matches) return;
  const ratio = Math.min(particleRatioClamp, window.devicePixelRatio || 1);
  viewportWidth = Math.ceil(visualViewport ? visualViewport.width : window.innerWidth);
  viewportHeight = Math.ceil(visualViewport ? visualViewport.height : window.innerHeight);

  canvas.width = Math.ceil(viewportWidth * ratio);
  canvas.height = Math.ceil(viewportHeight * ratio);
  canvas.style.width = `${viewportWidth}px`;
  canvas.style.height = `${viewportHeight}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  const count = getParticleCount();
  if (dots.length !== count) dots = [];
  if (!dots.length) {
    for (let i = 0; i < count; i += 1) {
      dots.push({
        x: Math.random() * viewportWidth,
        y: Math.random() * viewportHeight,
        r: 0.8 + Math.random() * 2.4,
        vx: -0.35 + Math.random() * 0.7,
        vy: -0.35 + Math.random() * 0.7,
        p: 0.22 + Math.random() * 0.35,
        c: Math.random() > 0.5 ? [109, 224, 255] : [141, 155, 255],
        s: 40 + Math.random() * 80,
      });
    }
  }
}

function step() {
  if (!ctx || reducedMotionQuery.matches || document.hidden) {
    particleRunning = false;
    particleFrame = 0;
    return;
  }

  if (skipNextParticleFrame > 0) {
    skipNextParticleFrame -= 1;
    particleFrame = requestAnimationFrame(step);
    return;
  }
  if (particleFrameSkip > 0) {
    skipNextParticleFrame = particleFrameSkip;
  }

  ctx.clearRect(0, 0, viewportWidth, viewportHeight);
  for (let i = 0; i < dots.length; i += 1) {
    const d = dots[i];
    d.x += d.vx;
    d.y += d.vy;

    if (d.x < 0 || d.x > viewportWidth) d.vx = -d.vx;
    if (d.y < 0 || d.y > viewportHeight) d.vy = -d.vy;

    if (dots.length <= maxLineLinks) {
      for (let j = i + 1; j < dots.length; j += 1) {
        const e = dots[j];
        const dx = d.x - e.x;
        const dy = d.y - e.y;
        const dist = Math.hypot(dx, dy);
        if (dist < d.s) {
          const alpha = 1 - dist / d.s;
          ctx.strokeStyle = `rgba(109,224,255,${alpha * 0.08})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(e.x, e.y);
          ctx.stroke();
        }
      }
    }

    ctx.fillStyle = `rgba(${d.c[0]}, ${d.c[1]}, ${d.c[2]}, ${Math.min(0.95, Math.max(0.06, d.p))})`;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }
  particleFrame = requestAnimationFrame(step);
}

function stopParticleLoop() {
  if (!particleRunning) return;
  if (particleFrame) {
    cancelAnimationFrame(particleFrame);
  }
  particleRunning = false;
  particleFrame = 0;
}

function startParticleLoop() {
  if (!ctx || reducedMotionQuery.matches || document.hidden || particleRunning) return;
  syncCanvasSize();
  particleRunning = true;
  particleFrame = requestAnimationFrame(step);
}

function restartParticleLoop() {
  stopParticleLoop();
  dots = [];
  startParticleLoop();
}

window.addEventListener("resize", restartParticleLoop);
if (visualViewport) {
  visualViewport.addEventListener("resize", restartParticleLoop, { passive: true });
}
window.addEventListener("scroll", pauseForScrollPerformance, { passive: true });
function handleReducedMotionChange(event) {
  if (event.matches) {
    stopParticleLoop();
  } else {
    startParticleLoop();
  }
}
if (typeof reducedMotionQuery.addEventListener === "function") {
  reducedMotionQuery.addEventListener("change", handleReducedMotionChange);
} else if (typeof reducedMotionQuery.addListener === "function") {
  reducedMotionQuery.addListener(handleReducedMotionChange);
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopParticleLoop();
  } else {
    startParticleLoop();
  }
});
startParticleLoop();

const words = ["experimental", "minimalist", "futuristic", "audacious"];
let wordIndex = 0;
let charIndex = 0;
let direction = "forward";
const typeWord = document.getElementById("typeWord");

function pulseType() {
  const word = words[wordIndex];
  const isTyping = direction === "forward";
  charIndex += isTyping ? 1 : -1;

  if (charIndex < 0) charIndex = 0;
  if (charIndex > word.length) charIndex = word.length;

  typeWord.textContent = word.slice(0, charIndex);

  let delay = isTyping ? 70 : 35;

  if (isTyping && charIndex === word.length) {
    direction = "backward";
    delay = 900;
  } else if (!isTyping && charIndex === 0) {
    direction = "forward";
    wordIndex = (wordIndex + 1) % words.length;
    delay = 330;
  }

  setTimeout(pulseType, delay);
}

typeWord.textContent = "";
setTimeout(pulseType, 400);

const targetDateConfig = launchPanel && launchPanel.dataset && launchPanel.dataset.launchDate;
const fallbackDate = new Date();
fallbackDate.setDate(fallbackDate.getDate() + 37);
const parsedLaunchDate = targetDateConfig ? new Date(targetDateConfig) : null;
const targetDate = parsedLaunchDate && !Number.isNaN(parsedLaunchDate.getTime()) ? parsedLaunchDate : fallbackDate;
const get = (id) => document.getElementById(id);
let countdownTimer = null;

function stopTimer() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

function updateTimer() {
  const now = new Date();
  const diff = targetDate - now;
  if (diff <= 0) {
    get("days").textContent = "00";
    get("hours").textContent = "00";
    get("minutes").textContent = "00";
    get("seconds").textContent = "00";
    stopTimer();
    return;
  }
  const day = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hour = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minute = Math.floor((diff / (1000 * 60)) % 60);
  const sec = Math.floor((diff / 1000) % 60);
  get("days").textContent = String(day).padStart(2, "0");
  get("hours").textContent = String(hour).padStart(2, "0");
  get("minutes").textContent = String(minute).padStart(2, "0");
  get("seconds").textContent = String(sec).padStart(2, "0");
}
updateTimer();
countdownTimer = setInterval(updateTimer, 1000);

const obs = new IntersectionObserver(
  (items) => {
    items.forEach((item) => {
      if (item.isIntersecting) item.target.classList.add("show");
    });
  },
  { threshold: 0.12 }
);
document.querySelectorAll(".reveal").forEach((node) => obs.observe(node));

document.querySelectorAll("[data-tilt]").forEach((el) => {
  el.addEventListener("pointermove", (event) => {
    const box = el.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * 2 - 1;
    const py = ((event.clientY - box.top) / box.height) * 2 - 1;
    el.style.setProperty("--rx", `${-py * 5}deg`);
    el.style.setProperty("--ry", `${px * 7}deg`);
  });
  el.addEventListener("pointerleave", () => {
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  });
});

const email = document.getElementById("email");
const form = document.getElementById("notifyForm");
const notifyStatus = document.getElementById("notifyStatus");
const notifyStorageKey = "notifyEmail";
let storageAvailable = false;

(function detectStorage() {
  try {
    localStorage.setItem("__probe__", "1");
    localStorage.removeItem("__probe__");
    storageAvailable = true;
  } catch (error) {
    storageAvailable = false;
  }
})();

if (storageAvailable) {
  const savedEmail = localStorage.getItem(notifyStorageKey);
  if (savedEmail) notifyStatus.textContent = "Demo mode: we already have your email saved for this browser.";
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const currentEmail = email.value.trim();

  if (!currentEmail || !email.checkValidity()) {
    notifyStatus.textContent = "Please enter a valid email.";
    return;
  }

  if (storageAvailable) {
    try {
      localStorage.setItem(notifyStorageKey, currentEmail);
    } catch (error) {
      storageAvailable = false;
    }
  }

  form.reset();
  notifyStatus.textContent = storageAvailable
    ? "Thanks — demo mode: saved locally for this browser. We'll wire real notifications later."
    : "Thanks — demo mode: submission accepted this session.";
});
