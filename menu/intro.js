// The opening screen: black, then the photosensitivity warning, then the creator's message and a Continue button.
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

  function pause(ms, skippable) {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      skip = skippable ? () => { clearTimeout(timer); skip = null; resolve(); } : null;
    });
  }

  intro.addEventListener('cancel', (e) => e.preventDefault());
  intro.addEventListener('click', () => { if (stage === 'warning' && skip) skip(); });
  intro.addEventListener('keydown', (e) => {
    if (stage === 'warning' && skip && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      skip();
    }
  });

  const fade = (ms) => (still ? 0 : ms);

  async function run() {
    await pause(fade(700), false);
    intro.classList.add('lit');
    warning.classList.add('on');
    stage = 'warning';
    await pause(1500, false);
    await pause(6500, true);
    warning.classList.remove('on');
    await pause(fade(900), false);
    stage = 'message';
    intro.setAttribute('aria-labelledby', 'intro-message-title');
    message.classList.add('on');
    await pause(fade(1600), false);
    if (stage === 'message') cont.focus({ preventScroll: true });
  }

  cont.addEventListener('click', () => {
    if (stage !== 'message') return;
    stage = 'done';
    dispatchEvent(new Event('intro-done'));
    intro.classList.add('leaving');
    setTimeout(() => {
      intro.close();
      const player = document.getElementById('player');
      const preview = document.getElementById('preview');
      if (player && !player.hidden) {
        document.getElementById('player-frame').focus();
      } else if (preview && !preview.hidden) {
        const start = document.getElementById('pv-start');
        (start.disabled ? document.getElementById('pv-back') : start).focus({ preventScroll: true });
      }
    }, fade(900));
  });

  run();
})();
