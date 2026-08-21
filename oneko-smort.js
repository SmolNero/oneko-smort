// oneko-smort: a red rubber duck inspired by oneko.js
// https://github.com/SmolNero/oneko-smort

(function onekoSmort() {
  "use strict";

  const script = document.currentScript;
  const reducedMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  if (reducedMotion || document.getElementById("oneko-smort")) return;

  const frameSize = 32;
  const duckSpeed = 10;
  const storageKey = "oneko-smort-position";
  const configuredDuck = script?.dataset.duck;
  const duckFile = configuredDuck
    ? new URL(configuredDuck, document.baseURI).href
    : new URL(
        "red_duck_sprite_256x128.png",
        script?.src || document.baseURI,
      ).href;
  const persistPosition =
    script?.dataset.persistPosition?.toLowerCase() !== "false";

  const duckEl = document.createElement("div");
  let duckPosX = 32;
  let duckPosY = 32;
  let pointerPosX = duckPosX;
  let pointerPosY = duckPosY;
  let frameCount = 0;
  let idleTime = 0;
  let idleAnimation = null;
  let idleAnimationFrame = 0;
  let lastFrameTimestamp;

  // Each frame is [column, row, mirrorHorizontally] in the 8 x 4 sheet.
  const spriteSets = {
    idle: [[3, 3]],
    alert: [[1, 2]],
    flapping: [
      [3, 2],
      [1, 2],
      [3, 2],
      [1, 3],
    ],
    tired: [[3, 1]],
    sleeping: [
      [2, 0],
      [2, 1],
    ],
    N: [
      [6, 3],
      [7, 3],
    ],
    NE: [
      [6, 2],
      [5, 3],
    ],
    E: [
      [4, 2],
      [4, 3],
    ],
    SE: [
      [2, 2],
      [2, 3],
    ],
    S: [
      [1, 2],
      [1, 3],
    ],
    SW: [
      [2, 2, true],
      [2, 3, true],
    ],
    W: [
      [4, 2, true],
      [4, 3, true],
    ],
    NW: [
      [6, 2, true],
      [5, 3, true],
    ],
  };

  function clampPosition(value, viewportSize) {
    if (viewportSize <= frameSize) return viewportSize / 2;
    return Math.min(
      Math.max(frameSize / 2, value),
      viewportSize - frameSize / 2,
    );
  }

  function placeDuck() {
    duckEl.style.left = `${duckPosX - frameSize / 2}px`;
    duckEl.style.top = `${duckPosY - frameSize / 2}px`;
  }

  function loadPosition() {
    if (!persistPosition) return;

    try {
      const storedPosition = JSON.parse(localStorage.getItem(storageKey));
      if (
        Number.isFinite(storedPosition?.x) &&
        Number.isFinite(storedPosition?.y)
      ) {
        duckPosX = storedPosition.x;
        duckPosY = storedPosition.y;
        pointerPosX = duckPosX;
        pointerPosY = duckPosY;
      }
    } catch {
      // Storage can be unavailable or contain stale data; neither should stop the duck.
    }
  }

  function savePosition() {
    if (!persistPosition) return;

    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ x: duckPosX, y: duckPosY }),
      );
    } catch {
      // Ignore storage failures in private or restricted browsing contexts.
    }
  }

  function setSprite(name, frame) {
    const frames = spriteSets[name];
    const [column, row, mirrored = false] = frames[frame % frames.length];
    duckEl.style.backgroundPosition = `${-column * frameSize}px ${
      -row * frameSize
    }px`;
    duckEl.style.transform = mirrored ? "scaleX(-1)" : "none";
  }

  function resetIdleAnimation() {
    idleAnimation = null;
    idleAnimationFrame = 0;
  }

  function idle() {
    idleTime += 1;

    if (
      idleTime > 10 &&
      Math.floor(Math.random() * 200) === 0 &&
      idleAnimation === null
    ) {
      idleAnimation = Math.random() < 0.5 ? "sleeping" : "flapping";
    }

    switch (idleAnimation) {
      case "sleeping":
        if (idleAnimationFrame < 8) {
          setSprite("tired", 0);
          break;
        }
        setSprite("sleeping", Math.floor(idleAnimationFrame / 4));
        if (idleAnimationFrame > 192) {
          resetIdleAnimation();
          return;
        }
        break;
      case "flapping":
        setSprite("flapping", Math.floor(idleAnimationFrame / 2));
        if (idleAnimationFrame > 15) {
          resetIdleAnimation();
          return;
        }
        break;
      default:
        setSprite("idle", 0);
        return;
    }

    idleAnimationFrame += 1;
  }

  function frame() {
    frameCount += 1;
    const diffX = duckPosX - pointerPosX;
    const diffY = duckPosY - pointerPosY;
    const distance = Math.hypot(diffX, diffY);

    if (distance < duckSpeed || distance < 48) {
      idle();
      return;
    }

    resetIdleAnimation();

    if (idleTime > 1) {
      setSprite("alert", 0);
      idleTime = Math.min(idleTime, 7) - 1;
      return;
    }

    let direction = diffY / distance > 0.5 ? "N" : "";
    direction += diffY / distance < -0.5 ? "S" : "";
    direction += diffX / distance > 0.5 ? "W" : "";
    direction += diffX / distance < -0.5 ? "E" : "";
    setSprite(direction, frameCount);

    duckPosX -= (diffX / distance) * duckSpeed;
    duckPosY -= (diffY / distance) * duckSpeed;
    duckPosX = clampPosition(duckPosX, window.innerWidth);
    duckPosY = clampPosition(duckPosY, window.innerHeight);
    placeDuck();
  }

  function onAnimationFrame(timestamp) {
    if (!duckEl.isConnected) return;

    if (!lastFrameTimestamp) lastFrameTimestamp = timestamp;
    if (timestamp - lastFrameTimestamp > 100) {
      lastFrameTimestamp = timestamp;
      frame();
    }
    window.requestAnimationFrame(onAnimationFrame);
  }

  function trackPointer(event) {
    pointerPosX = event.clientX;
    pointerPosY = event.clientY;
  }

  function init() {
    if (!document.body || document.getElementById("oneko-smort")) return;

    loadPosition();
    duckPosX = clampPosition(duckPosX, window.innerWidth);
    duckPosY = clampPosition(duckPosY, window.innerHeight);

    duckEl.id = "oneko-smort";
    duckEl.setAttribute("aria-hidden", "true");
    Object.assign(duckEl.style, {
      width: `${frameSize}px`,
      height: `${frameSize}px`,
      position: "fixed",
      pointerEvents: "none",
      imageRendering: "pixelated",
      zIndex: "2147483647",
      backgroundImage: `url("${duckFile}")`,
      transformOrigin: "center",
    });
    setSprite("idle", 0);
    placeDuck();
    document.body.appendChild(duckEl);

    document.addEventListener("pointermove", trackPointer, { passive: true });
    document.addEventListener("pointerdown", trackPointer, { passive: true });
    window.addEventListener("resize", () => {
      duckPosX = clampPosition(duckPosX, window.innerWidth);
      duckPosY = clampPosition(duckPosY, window.innerHeight);
      placeDuck();
    });
    window.addEventListener("pagehide", savePosition);
    window.requestAnimationFrame(onAnimationFrame);
  }

  if (document.body) {
    init();
  } else {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  }
})();
