// Toast Notification System
class ToastSystem {
  constructor() {
    this.container = this.createContainer();
    this.toasts = new Map();
    this.config = {
      duration: 3000,
      animationDuration: 300,
      maxToasts: 5,
      position: 'top-right'
    };
  }

  createContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  // Create a new toast notification
  show(message, type = 'info', options = {}) {
    const id = this.generateId();
    const toast = this.createToastElement(message, type, id, options);
    
    // Add to container
    this.container.appendChild(toast);
    this.toasts.set(id, toast);

    // Handle overflow
    this.handleOverflow();

    // Auto-remove after duration
    setTimeout(() => this.remove(id), this.config.duration);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.style.transform = 'translateX(0)';
      toast.style.opacity = '1';
    });

    return id;
  }

  // Create toast element with advanced styling
  createToastElement(message, type, id, options) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    toast.setAttribute('data-toast-id', id);

    // Create content wrapper
    const content = document.createElement('div');
    content.className = 'toast-content';
    content.textContent = message;

    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.setAttribute('aria-label', 'Close notification');
    closeBtn.innerHTML = '×';
    closeBtn.onclick = () => this.remove(id);

    // Assemble toast
    toast.appendChild(content);
    toast.appendChild(closeBtn);

    // Add custom classes and data attributes
    if (options.className) {
      toast.classList.add(options.className);
    }
    if (options.data) {
      Object.entries(options.data).forEach(([key, value]) => {
        toast.setAttribute(`data-${key}`, value);
      });
    }

    return toast;
  }

  // Get appropriate icon for toast type
  getIconForType(type) {
    const icons = {
      success: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
      error: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
      warning: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
      </svg>`,
      info: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 16v-4M12 8h.01"/>
      </svg>`
    };

    return icons[type] || icons.info;
  }

  // Remove a toast with animation
  remove(id) {
    const toast = this.toasts.get(id);
    if (!toast) return;

    // Add exit animation
    toast.style.transform = 'translateX(120%)';
    toast.style.opacity = '0';

    // Remove after animation
    setTimeout(() => {
      toast.remove();
      this.toasts.delete(id);
      this.handleOverflow();
    }, this.config.animationDuration);
  }

  // Handle overflow of toasts
  handleOverflow() {
    const toasts = Array.from(this.toasts.values());
    if (toasts.length > this.config.maxToasts) {
      const oldestToast = toasts[0];
      this.remove(oldestToast.dataset.toastId);
    }
  }

  // Generate unique ID for toast
  generateId() {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Clear all toasts
  clearAll() {
    this.toasts.forEach((toast, id) => this.remove(id));
  }

  // Update toast message
  update(id, message) {
    const toast = this.toasts.get(id);
    if (toast) {
      const content = toast.querySelector('.toast-content');
      if (content) {
        content.textContent = message;
      }
    }
  }
}

// Create global toast instance
const toast = new ToastSystem();

// Export the showToast function
export const showToast = (message, type = 'info', options = {}) => {
  return toast.show(message, type, options);
};

// Add keyboard shortcut to clear all toasts
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'k') {
    toast.clearAll();
  }
});