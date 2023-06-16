import { axiosError } from './axios';

const alert = document.querySelector('.alert-show')! as HTMLParagraphElement;
const showModal = document.querySelector('.modal-overlay')! as HTMLDivElement;
const showContainer = document.querySelector(
  '.modal-container'
)! as HTMLDivElement;

type AlertClass = 'alert-danger' | 'alert-success';

const toast = ({
  alertClass,
  content,
  error,
  modal,
}: {
  alertClass: AlertClass;
  content?: string;
  error?: unknown;
  modal?: boolean;
}) => {
  if (modal) {
    showModal.classList.add('show-modal');
    showContainer.classList.add('show-container');
  }
  content
    ? (alert.textContent = content)
    : (alert.textContent = axiosError(error));
  alert.classList.add(alertClass);
  alert.style.opacity = '1';
  setTimeout(() => {
    alert.style.opacity = '0';
    setTimeout(() => {
      alert.textContent = '';
      alert.classList.remove(alertClass);
      if (modal) {
        setTimeout(() => {
          showContainer.classList.remove('show-container');
          showModal.classList.remove('show-modal');
        }, 1200);
      }
    }, 1500);
  }, 1800);
};

export { toast };
