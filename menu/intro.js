// The opening screen: black, then the photosensitivity warning, then the creator's message and a Continue button.
// A click or key press finishes the current fade or wait at once.
(() => {
  'use strict';

  const intro = document.getElementById('intro');
  if (!intro) return;
  const warning = document.getElementById('intro-warning');
  const message = document.getElementById('intro-message');
  const cont = document.getElementById('intro-continue');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The dialog ships open so the first paint is black, and reopening it as a modal makes the page behind it inert.
  intro.close();
  intro.showModal();
  intro.focus();

  let stage = 'black';
  let skip = null;

  function pause(ms) {
    return new Promise((resolve) => {
      const done = () => { clearTimeout(timer); if (skip === done) skip = null; resolve(); };
      const timer = setTimeout(done, ms);
      skip = done;
    });
  }

  // Transitions started while the class is on finish at once. Two frames lets the browser apply the new classes first.
  function hurry() {
    intro.classList.add('hurry');
    requestAnimationFrame(() => requestAnimationFrame(() => intro.classList.remove('hurry')));
  }

  function advance() {
    if (!skip) return;
    hurry();
    skip();
  }

  intro.addEventListener('cancel', (e) => e.preventDefault());
  intro.addEventListener('click', (e) => {
    if (e.target.closest('#intro-continue')) return;
    advance();
  });
  intro.addEventListener('keydown', (e) => {
    if (e.repeat || ['Tab', 'Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
    if (e.target === cont && stage === 'ready' && (e.key === 'Enter' || e.key === ' ')) return;
    if (!skip) return;
    e.preventDefault();
    advance();
  });

  const fade = (ms) => (still ? 0 : ms);

  async function run() {
    await pause(fade(700));
    intro.classList.add('lit');
    warning.classList.add('on');
    stage = 'warning';
    await pause(8000);
    warning.classList.remove('on');
    await pause(fade(900));
    stage = 'message';
    intro.setAttribute('aria-labelledby', 'intro-message-title');
    message.classList.add('on');
    await pause(fade(1600));
    if (stage !== 'message') return;
    stage = 'ready';
    cont.focus({ preventScroll: true });
  }

  cont.addEventListener('click', async () => {
    if (stage !== 'message' && stage !== 'ready') return;
    stage = 'leaving';
    dispatchEvent(new Event('intro-done'));
    intro.classList.add('leaving');
    await pause(fade(900));
    stage = 'done';
    intro.close();
    if (intro.contains(document.activeElement)) document.activeElement.blur();
    const player = document.getElementById('player');
    const preview = document.getElementById('preview');
    if (player && !player.hidden) {
      document.getElementById('player-frame').focus();
    } else if (preview && !preview.hidden) {
      const start = document.getElementById('pv-start');
      (start.disabled ? document.getElementById('pv-back') : start).focus({ preventScroll: true });
    }
  });

  run();
})();
