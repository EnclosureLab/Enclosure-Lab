(() => {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.nav');
  if (toggle && nav) toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  });
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
  try {
    const cart = JSON.parse(localStorage.getItem('enclosureLabCart') || '[]');
    const count = cart.reduce((sum, item) => sum + Math.max(0, Number(item.qty) || 0), 0);
    document.querySelectorAll('[data-cart-count]').forEach(el => el.textContent = count);
  } catch (_) {
    document.querySelectorAll('[data-cart-count]').forEach(el => el.textContent = '0');
  }
})();