// Carousel: auto-advancing slide deck with prev/next + dot controls.
(function () {
  document.querySelectorAll('[data-carousel]').forEach(function (c) {
    var track = c.querySelector('.track'),
      n = track.children.length,
      dots = c.querySelectorAll('.dot'),
      i = 0,
      timer,
      reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    function go(x) {
      i = (x + n) % n;
      track.style.transform = 'translateX(-' + i * 100 + '%)';
      dots.forEach(function (d, k) { d.classList.toggle('active', k === i); });
    }
    function auto() {
      if (!reduce) {
        clearInterval(timer);
        timer = setInterval(function () { go(i + 1); }, 4500);
      }
    }

    c.querySelector('.next').onclick = function () { go(i + 1); auto(); };
    c.querySelector('.prev').onclick = function () { go(i - 1); auto(); };
    dots.forEach(function (d, k) { d.onclick = function () { go(k); auto(); }; });
    c.addEventListener('mouseenter', function () { clearInterval(timer); });
    c.addEventListener('mouseleave', auto);
    auto();
  });
})();
