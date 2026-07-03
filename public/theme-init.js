(function() {
  try {
    var theme = localStorage.getItem('theme') || 'dark';
    document.documentElement.classList.add(theme);

    // Tauri check to prevent flash on IDE landing page
    if (window.__TAURI_INTERNALS__ || window.__TAURI__ || window.__TAURI_IPC__) {
      document.documentElement.classList.add('is-tauri');
    }
  } catch (e) {}
})();
