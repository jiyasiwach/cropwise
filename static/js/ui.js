/* Shared interactions. Everything here degrades to a working page if JavaScript fails. */

(() => {
  // Tell the stylesheet that scripting is available, which is what turns on the entrance
  // animations. Without this line the page simply renders, which is the right fallback.
  document.documentElement.classList.add('js');

  // A button that submits a form says what it is doing, and cannot be double-submitted.
  document.addEventListener('submit', (event) => {
    const button = event.target.querySelector('button[type=submit], .btn[type=submit], button:not([type])');
    if (!button || button.dataset.busy) return;
    button.dataset.busy = '1';
    button.dataset.label = button.innerHTML;
    button.innerHTML = `<span class="spinner"></span>${button.dataset.busyLabel || 'Working…'}`;
    button.disabled = true;
    // If the browser restores the page from cache (back button), put the label back.
    window.addEventListener('pageshow', () => {
      button.disabled = false;
      delete button.dataset.busy;
      button.innerHTML = button.dataset.label;
    }, { once: true });
  });

  // Toasts
  const host = Object.assign(document.createElement('div'), { className: 'toast-host' });
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(host));
  window.toast = (message, kind = '') => {
    const el = Object.assign(document.createElement('div'), { className: `toast ${kind}`, textContent: message });
    host.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  };

  // Cards appear as they scroll into view.
  document.addEventListener('DOMContentLoaded', () => {
    const targets = document.querySelectorAll('.reveal');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!targets.length || reduced || !('IntersectionObserver' in window)) {
      targets.forEach((t) => t.classList.add('in'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (!entry.isIntersecting) return;
        setTimeout(() => entry.target.classList.add('in'), i * 60);
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -40px 0px' });
    targets.forEach((t) => observer.observe(t));
  });

  // Numbers count up, so a confidence figure reads as a result rather than a label.
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-count]').forEach((el) => {
      const end = parseFloat(el.dataset.count);
      if (Number.isNaN(end)) return;
      const decimals = (el.dataset.count.split('.')[1] || '').length;
      const started = performance.now();
      const tick = (now) => {
        const progress = Math.min(1, (now - started) / 900);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = (end * eased).toFixed(decimals);
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  });

  // Ctrl/Cmd+K opens the assistant from anywhere.
  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      window.location.href = '/assistant';
    }
  });
})();
