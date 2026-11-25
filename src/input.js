const mouseEdgeWidth = 48;
const mouseEdgeSpeed = 2.05;
const mouseEdgeAcceleration = 5;

export function createInput(canvas, container, action, canPlay, touch) {
  const held = new Set();
  const state = { x: 0, y: 0, aiming: false, fire: false, sprinting: false };
  const stick = container.querySelector('#stick');
  const knob = stick.firstElementChild;
  const look = container.querySelector('#touch-look');
  let stickId = null;
  let lookId = null;
  let mouseX = null;
  let mouseY = 0;
  let lookX = 0;
  let lookY = 0;
  let edgeTarget = 0;
  let edgeSpeed = 0;
  const pointerButtons = new Map();

  const resetMouseLook = () => {
    mouseX = null;
    edgeTarget = edgeSpeed = 0;
  };

  const position = (event) => {
    const rect = stick.getBoundingClientRect();
    const dx = (event.clientX - rect.left - rect.width / 2) / (rect.width * 0.37);
    const dy = (event.clientY - rect.top - rect.height / 2) / (rect.height * 0.37);
    const magnitude = Math.max(1, Math.hypot(dx, dy));
    state.x = dx / magnitude;
    state.y = dy / magnitude;
    knob.style.transform = 'translate(' + state.x * 25 + 'px,' + state.y * 25 + 'px)';
  };
  function pointerRelease(event) {
    if (event.pointerId === stickId) {
      stickId = null;
      state.x = state.y = 0;
      knob.style.transform = '';
    }
    if (event.pointerId === lookId) lookId = null;
    const button = pointerButtons.get(event.pointerId);
    if (button) {
      pointerButtons.delete(event.pointerId);
      if (![...pointerButtons.values()].includes(button)) {
        held.delete(button.dataset.hold);
        delete button.dataset.pressed;
      }
    }
  }

  const options = { signal: new AbortController().signal };
  stick.addEventListener(
    'pointerdown',
    (event) => {
      if (!canPlay() || stickId !== null) return;
      event.preventDefault();
      stickId = event.pointerId;
      stick.setPointerCapture(event.pointerId);
      position(event);
    },
    options,
  );
  stick.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerId === stickId) position(event);
    },
    options,
  );
  let lastX = 0;
  let lastY = 0;
  look.addEventListener(
    'pointerdown',
    (event) => {
      if (!canPlay() || event.pointerType === 'mouse' || lookId !== null) return;
      event.preventDefault();
      lookId = event.pointerId;
      look.setPointerCapture(lookId);
      lastX = event.clientX;
      lastY = event.clientY;
    },
    options,
  );
  look.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerId !== lookId) return;
      lookX += (event.clientX - lastX) * 0.007;
      lookY += (event.clientY - lastY) * 0.005;
      lastX = event.clientX;
      lastY = event.clientY;
    },
    options,
  );
  for (const button of container.querySelectorAll('[data-hold]')) {
    button.addEventListener(
      'pointerdown',
      (event) => {
        if (!canPlay()) return;
        event.preventDefault();
        pointerButtons.set(event.pointerId, button);
        button.setPointerCapture(event.pointerId);
        held.add(button.dataset.hold);
        button.dataset.pressed = '';
        if (button.dataset.hold === 'fire') action('fire');
      },
      options,
    );
  }
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    container.addEventListener(event, pointerRelease, options);
  }

  const actions = {
    KeyE: 'use',
    KeyQ: 'switch',
    KeyV: 'gear',
    Space: 'jump',
    KeyR: 'reload',
    Escape: 'pause',
    KeyM: 'map',
    KeyF: 'survey',
    KeyB: 'radio',
    KeyL: 'lock-mouse',
    Enter: 'fire',
  };
  window.addEventListener(
    'keydown',
    (event) => {
      if (!canPlay()) return;
      const code = event.code;
      if (event.shiftKey || event.key === 'Shift') state.sprinting = true;
      if (
        !actions[code] &&
        ![
          'KeyW',
          'KeyA',
          'KeyS',
          'KeyD',
          'KeyT',
          'ArrowUp',
          'ArrowLeft',
          'ArrowRight',
          'ArrowDown',
          'ShiftLeft',
          'ShiftRight',
          'Space',
          'Enter',
        ].includes(code)
      )
        return;
      event.preventDefault();
      held.add(code);
      if (!event.repeat && actions[code]) action(actions[code]);
    },
    options,
  );
  window.addEventListener(
    'keyup',
    (event) => {
      held.delete(event.code);
      state.sprinting = event.shiftKey || held.has('ShiftLeft') || held.has('ShiftRight');
    },
    options,
  );
  container.addEventListener(
    'contextmenu',
    (event) => {
      if (canPlay()) event.preventDefault();
    },
    options,
  );
  canvas.addEventListener(
    'mousedown',
    (event) => {
      if (!canPlay() || touch() || event.sourceCapabilities?.firesTouchEvents) return;
      if (event.button === 2) state.aiming = true;
      if (event.button === 0) {
        state.fire = true;
        canvas.focus({ preventScroll: true });
        action('fire');
      }
    },
    options,
  );
  window.addEventListener(
    'mouseup',
    (event) => {
      if (event.button === 0) state.fire = false;
      if (event.button === 2) state.aiming = false;
    },
    options,
  );
  window.addEventListener(
    'pointercancel',
    (event) => {
      if (event.pointerType === 'mouse') state.fire = state.aiming = false;
    },
    options,
  );
  function moveMouse(dx, dy) {
    lookX += dx * 0.0041;
    lookY += dy * 0.0034;
  }

  canvas.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType !== 'mouse' || touch() || document.pointerLockElement || !canPlay()) return;
      if (!(event.buttons & 1)) state.fire = false;
      if (mouseX !== null) moveMouse(event.clientX - mouseX, event.clientY - mouseY);
      mouseX = event.clientX;
      mouseY = event.clientY;
      const { left, right } = canvas.getBoundingClientRect();
      const leftWeight = Math.max(0, 1 - (mouseX - left) / mouseEdgeWidth);
      const rightWeight = Math.max(0, 1 - (right - mouseX) / mouseEdgeWidth);
      const weight = Math.max(-1, Math.min(1, rightWeight - leftWeight));
      edgeTarget = mouseEdgeSpeed * weight * Math.abs(weight);
    },
    options,
  );
  canvas.addEventListener(
    'pointerleave',
    (event) => {
      if (event.pointerType !== 'mouse') return;
      resetMouseLook();
      if (!document.pointerLockElement) state.fire = state.aiming = false;
    },
    options,
  );
  canvas.addEventListener(
    'mousemove',
    (event) => {
      if (!canPlay() || touch() || document.pointerLockElement !== canvas) return;
      moveMouse(event.movementX, event.movementY);
    },
    options,
  );
  document.addEventListener('pointerlockchange', resetMouseLook, options);
  window.addEventListener('resize', resetMouseLook, options);
  window.addEventListener(
    'blur',
    () => {
      resetMouseLook();
      state.fire = state.aiming = state.sprinting = false;
    },
    options,
  );

  return {
    held,
    state,
    readLook(dt) {
      if (edgeTarget && canPlay() && !touch() && !document.pointerLockElement) {
        if (edgeSpeed * edgeTarget < 0) edgeSpeed = 0;
        edgeSpeed += (edgeTarget - edgeSpeed) * (1 - Math.exp(-mouseEdgeAcceleration * dt));
      } else edgeSpeed = 0;
      const delta = [lookX + edgeSpeed * dt, lookY];
      lookX = lookY = 0;
      return delta;
    },
    clear() {
      held.clear();
      pointerButtons.forEach((button) => delete button.dataset.pressed);
      pointerButtons.clear();
      stickId = lookId = null;
      resetMouseLook();
      knob.style.transform = '';
      state.x = state.y = lookX = lookY = 0;
      state.fire = state.aiming = state.sprinting = false;
    },
  };
}
