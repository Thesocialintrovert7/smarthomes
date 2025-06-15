// Toggle the menu on and off
document.getElementById('menu-toggle').addEventListener('click', function() {
  const navLinks = document.getElementById('nav-links');
  // Toggle the 'show' class, which makes the nav-links visible
  navLinks.classList.toggle('show');
});
