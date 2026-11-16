// For webview-too-old.html: says which WebView version this is, and whether
// that is the reason the app couldn't start. Plain ES5 — an old WebView runs it.
// NEEDED must match minWebViewVersion in capacitor.config.ts.
(function () {
  var NEEDED = 99;
  var match = /Chrome\/(\d+)/.exec(navigator.userAgent);
  var found = document.getElementById("found");
  if (!match || !found) return;
  var version = Number(match[1]);
  if (version < NEEDED) {
    found.innerHTML =
      "This device has WebView <strong>" +
      version +
      "</strong>. Settings → Apps → Android System WebView shows it too.";
    return;
  }
  document.getElementById("reason").innerHTML =
    "The app's page didn't load. This device's WebView (<strong>" +
    version +
    "</strong>) is new enough, so this is a problem with the app, not your device.";
  found.textContent =
    "Close the app completely and open it again. If this page comes back, reinstall the app (back up first if you use it offline).";
})();
