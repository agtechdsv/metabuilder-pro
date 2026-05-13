(function() {
  try {
    var theme = localStorage.getItem('theme') || 'dark';
    document.documentElement.classList.add(theme);
  } catch (e) {}
})();
