// Sets the theme before the first paint, so the page doesn't flash the default
// one. A file rather than an inline <script> so the Content-Security-Policy can
// forbid inline scripts altogether (see nginx-security-headers.conf).
(function () {
  var t = localStorage.getItem('pdx-theme') || 'dark';
  document.documentElement.dataset.theme = t;
  document.documentElement.dataset.legible = localStorage.getItem('pdx-legible') || 'off';
})();
