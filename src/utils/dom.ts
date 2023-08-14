const setMaxWidth = (idOrClass: string) => {
  console.log(idOrClass);
  const element = document.querySelector(idOrClass)! as HTMLVideoElement;
  const computedStyle = window.getComputedStyle(element, null);
  element.style.maxWidth = `${(parseFloat(computedStyle.height) * 16) / 9}px`;
};

export { setMaxWidth };
