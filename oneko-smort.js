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
  const sheetWidth = 256;
  const sheetHeight = 128;
  const duckSpeed = 100;
  const stopDistance = 48;
  const spriteFrameDuration = 110;
  const storageKey = "oneko-smort-position";
  const configuredDuck = script?.dataset.duck;
  const duckFile = configuredDuck
    ? new URL(configuredDuck, document.baseURI).href
    : new URL("red-duck-v3.gif", script?.src || document.baseURI).href;
  const persistPosition =
    script?.dataset.persistPosition?.toLowerCase() !== "false";

  const duckEl = document.createElement("div");
  let duckPosX = 32;
  let duckPosY = 32;
  let pointerPosX = duckPosX;
  let pointerPosY = duckPosY;
  let isMoving = false;
  let movementDirection = null;
  let movementTime = 0;
  let idleTime = 0;
  let nextIdleAnimationAt = randomIdleDelay();
  let idleAnimation = null;
  let idleAnimationTime = 0;
  let mirrored = false;
  let currentSprite = null;
  let lastFrameTimestamp;

  // Each frame is [column, row, mirrorHorizontally] in the 8 x 4 sheet.
  const spriteSets = {
    idle: [[0, 3]],
    flapping: [
      [0, 3],
      [4, 3],
      [5, 3],
      [4, 3],
    ],
    tired: [[1, 3]],
    sleeping: [
      [2, 3],
      [3, 3],
    ],
    N: [
      [0, 2],
      [1, 2],
      [2, 2],
      [3, 2],
    ],
    NE: [
      [0, 0, true],
      [1, 0, true],
      [2, 0, true],
      [3, 0, true],
    ],
    E: [
      [0, 0, true],
      [1, 0, true],
      [2, 0, true],
      [3, 0, true],
    ],
    SE: [
      [0, 0, true],
      [1, 0, true],
      [2, 0, true],
      [3, 0, true],
    ],
    S: [
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
    ],
    SW: [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ],
    W: [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ],
    NW: [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
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
    duckEl.style.transform = `translate3d(${duckPosX - frameSize / 2}px, ${
      duckPosY - frameSize / 2
    }px, 0) scaleX(${mirrored ? -1 : 1})`;
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
    const [column, row, nextMirrored = false] = frames[frame % frames.length];
    const sprite = `${column}:${row}:${nextMirrored}`;

    if (sprite === currentSprite) return;

    currentSprite = sprite;
    duckEl.style.backgroundPosition = `${-column * frameSize}px ${
      -row * frameSize
    }px`;
    if (mirrored !== nextMirrored) {
      mirrored = nextMirrored;
      placeDuck();
    }
  }

  function randomIdleDelay() {
    return 10000 + Math.random() * 20000;
  }

  function resetIdleState() {
    idleTime = 0;
    nextIdleAnimationAt = randomIdleDelay();
    idleAnimation = null;
    idleAnimationTime = 0;
  }

  function idle(deltaTime) {
    idleTime += deltaTime;

    if (idleTime >= nextIdleAnimationAt && idleAnimation === null) {
      idleAnimation = Math.random() < 0.5 ? "sleeping" : "flapping";
      idleAnimationTime = 0;
    }

    switch (idleAnimation) {
      case "sleeping":
        idleAnimationTime += deltaTime;
        if (idleAnimationTime < 800) {
          setSprite("tired", 0);
        } else {
          setSprite("sleeping", Math.floor((idleAnimationTime - 800) / 500));
        }
        if (idleAnimationTime > 12000) {
          resetIdleState();
          setSprite("idle", 0);
        }
        break;
      case "flapping":
        idleAnimationTime += deltaTime;
        setSprite("flapping", Math.floor(idleAnimationTime / 150));
        if (idleAnimationTime > 1200) {
          resetIdleState();
          setSprite("idle", 0);
        }
        break;
      default:
        setSprite("idle", 0);
    }
  }

  function frame(deltaTime) {
    const diffX = duckPosX - pointerPosX;
    const diffY = duckPosY - pointerPosY;
    const distance = Math.hypot(diffX, diffY);

    if (distance <= stopDistance) {
      if (isMoving) {
        isMoving = false;
        movementDirection = null;
        movementTime = 0;
        resetIdleState();
      }
      idle(deltaTime);
      return;
    }

    if (!isMoving) {
      isMoving = true;
      resetIdleState();
    }

    let direction = diffY / distance > 0.5 ? "N" : "";
    direction += diffY / distance < -0.5 ? "S" : "";
    direction += diffX / distance > 0.5 ? "W" : "";
    direction += diffX / distance < -0.5 ? "E" : "";

    if (direction !== movementDirection) {
      movementDirection = direction;
      movementTime = 0;
    } else {
      movementTime += deltaTime;
    }
    setSprite(direction, Math.floor(movementTime / spriteFrameDuration));

    const step = Math.min(
      (duckSpeed * deltaTime) / 1000,
      distance - stopDistance,
    );
    duckPosX -= (diffX / distance) * step;
    duckPosY -= (diffY / distance) * step;
    duckPosX = clampPosition(duckPosX, window.innerWidth);
    duckPosY = clampPosition(duckPosY, window.innerHeight);
    placeDuck();
  }

  function onAnimationFrame(timestamp) {
    if (!duckEl.isConnected) return;

    if (lastFrameTimestamp !== undefined) {
      const deltaTime = Math.min(timestamp - lastFrameTimestamp, 50);
      frame(deltaTime);
    }
    lastFrameTimestamp = timestamp;
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
      left: "0",
      top: "0",
      pointerEvents: "none",
      imageRendering: "pixelated",
      zIndex: "2147483647",
      backgroundImage: `url("${duckFile}")`,
      backgroundRepeat: "no-repeat",
      backgroundSize: `${sheetWidth}px ${sheetHeight}px`,
      overflow: "hidden",
      transformOrigin: "center",
      willChange: "transform",
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
