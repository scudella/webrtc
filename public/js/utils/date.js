const copyrightDate = () => {
  document.getElementById('date').textContent = new Date().getFullYear();
};

export { copyrightDate };
