export function createInput(canvas, container, action, canPlay) {
  const held = new Set();
  const state = { x: 0, y: 0, lookX: 0, lookY: 0, aiming: false, fire: false };
  const stick = container.querySelector('#stick');
  const knob = stick.firstElementChild;
  const look = container.querySelector('#touch-look');
  let stickId = null;
  let lookId = null;
  let mouseDrag = false;
  let dragMoved = false;
  const pointerButtons = new Map();

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
      if (!canPlay() || lookId !== null) return;
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
      state.lookX += (event.clientX - lastX) * 0.007;
      state.lookY += (event.clientY - lastY) * 0.005;
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
      },
      options,
    );
  }
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    container.addEventListener(event, pointerRelease, options);
  }

  const actions = { KeyE: 'use', KeyQ: 'switch', KeyR: 'reload', Escape: 'pause', KeyM: 'map', Enter: 'fire' };
  window.addEventListener(
    'keydown',
    (event) => {
      if (!canPlay()) return;
      const code = event.code;
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
  window.addEventListener('keyup', (event) => held.delete(event.code), options);
  container.addEventListener(
    'contextmenu',
    (event) => {
      if (canPlay()) event.preventDefault();
    },
    options,
  );
  canvas.addEventListener(
    'pointerdown',
    (event) => {
      if (!canPlay() || event.pointerType !== 'mouse') return;
      if (event.button === 2) state.aiming = true;
      if (event.button === 0) {
        if (document.pointerLockElement === canvas) {
          state.fire = true;
          action('fire');
          return;
        }
        mouseDrag = true;
        dragMoved = false;
        canvas.focus({ preventScroll: true });
      }
    },
    options,
  );
  window.addEventListener(
    'pointerup',
    (event) => {
      if (event.pointerType !== 'mouse') return;
      if (event.button === 0) {
        if (mouseDrag && !dragMoved && canPlay()) action('fire');
        state.fire = mouseDrag = false;
      }
      if (event.button === 2) state.aiming = false;
    },
    options,
  );
  window.addEventListener(
    'mousemove',
    (event) => {
      if (!canPlay() || (!mouseDrag && document.pointerLockElement !== canvas)) return;
      if (Math.abs(event.movementX) + Math.abs(event.movementY) > 2) dragMoved = true;
      state.lookX += event.movementX * 0.0041;
      state.lookY += event.movementY * 0.0034;
    },
    options,
  );

  return {
    held,
    state,
    clear() {
      held.clear();
      pointerButtons.forEach((button) => delete button.dataset.pressed);
      pointerButtons.clear();
      stickId = lookId = null;
      knob.style.transform = '';
      state.x = state.y = state.lookX = state.lookY = 0;
      state.fire = state.aiming = mouseDrag = false;
    },
  };
}
