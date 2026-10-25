// Sets the theme before the first paint, so the page doesn't flash the default
// one. A file rather than an inline <script> so the Content-Security-Policy can
// forbid inline scripts altogether (see deploy/nginx/security-headers.conf).
(function () {
  var theme = 'dark';
  var legible = 'off';
  try {
    theme = localStorage.getItem('pdx-theme') || theme;
    legible = localStorage.getItem('pdx-legible') || legible;
  } catch {
    // Storage blocked (Safari with site data off, some private modes): the defaults
  }
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.legible = legible;
})();
