import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { auth } from "./firebaseConfig.js";
import { showTransactionModal } from './transactions.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "./firebaseConfig.js";
import { showToast } from "./toast.js";

// Constants and Configuration
const CONFIG = {
  ANIMATION_DURATION: 300,
  TOAST_DURATION: 3000,
  THEME_KEY: 'beteor-theme',
  SCROLL_THRESHOLD: 100
};

// State Management
const state = {
  isMenuOpen: false,
  isScrolled: false,
  currentTheme: localStorage.getItem(CONFIG.THEME_KEY) || 'dark',
  isAnimating: false
};

// DOM Elements
const elements = {
  menuToggle: document.getElementById('menuToggle'),
  sideMenu: document.getElementById('sideMenu'),
  themeToggle: document.getElementById('themeToggle'),
  balanceInfo: document.getElementById('balanceInfo'),
  user: document.getElementById('user'),
  navbar: document.querySelector('.navbar'),
  mainContent: document.getElementById('main-content')
};

// Utility Functions
const utils = {
  // Debounce function for performance optimization
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // Throttle function for scroll events
  throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  // Format currency with proper locale
  formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'NPR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  },

  // Generate unique ID
  generateId() {
    return Math.random().toString(36).substr(2, 9);
  }
};

// Theme Management
class ThemeManager {
  constructor() {
    this.themeToggle = document.getElementById('themeToggle');
    this.currentTheme = localStorage.getItem('theme') || 'dark';
  }

  init() {
    this.setTheme(this.currentTheme);
    this.setupThemeToggle();
  }

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    this.currentTheme = theme;
    localStorage.setItem('theme', theme);
    if (this.themeToggle) {
      this.themeToggle.checked = theme === 'light';
    }
    
    // Update meta theme-color
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = theme === 'light' ? '#f8fafc' : '#0f172a';
      document.head.appendChild(meta);
    } else {
      metaThemeColor.content = theme === 'light' ? '#f8fafc' : '#0f172a';
    }
  }

  setupThemeToggle() {
    if (this.themeToggle) {
      this.themeToggle.addEventListener('change', (e) => {
        const newTheme = e.target.checked ? 'light' : 'dark';
        this.setTheme(newTheme);
        showToast(`Switched to ${newTheme} mode`, 'success');
      });
    }
  }
}

// Menu Management
class MenuManager {
  constructor() {
    this.menuToggle = document.getElementById('menuToggle');
    this.sideMenu = document.getElementById('sideMenu');
    this.closeMenu = document.getElementById('closeMenu');
    this.menuOverlay = document.createElement('div');
    this.menuOverlay.className = 'menu-overlay';
    document.body.appendChild(this.menuOverlay);
  }

  init() {
    this.setupMenuToggle();
    this.setupMenuClose();
    this.setupOverlay();
    this.updateUserDisplay();
  }

  setupMenuToggle() {
    if (this.menuToggle) {
      this.menuToggle.addEventListener('click', () => {
        this.toggleMenu();
      });
    }
  }

  setupMenuClose() {
    if (this.closeMenu) {
      this.closeMenu.addEventListener('click', () => {
        this.closeMenuFn();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.sideMenu?.classList.contains('active')) {
        this.closeMenuFn();
      }
    });
  }

  setupOverlay() {
    if (this.menuOverlay) {
      this.menuOverlay.addEventListener('click', () => {
        this.closeMenuFn();
      });
    }
  }

  toggleMenu() {
    if (this.sideMenu) {
      this.sideMenu.classList.toggle('active');
      this.menuOverlay.classList.toggle('active');
      document.body.classList.toggle('menu-open');
      this.menuToggle?.setAttribute('aria-expanded', 
        this.sideMenu.classList.contains('active').toString());
    }
  }

  closeMenuFn() {
    if (this.sideMenu) {
      this.sideMenu.classList.remove('active');
      this.menuOverlay.classList.remove('active');
      document.body.classList.remove('menu-open');
      this.menuToggle?.setAttribute('aria-expanded', 'false');
    }
  }

  updateUserDisplay() {
    const userElement = document.getElementById('user');
    if (!userElement) return;

    auth.onAuthStateChanged(user => {
      if (user) {
        userElement.textContent = `Welcome, ${user.displayName || 'User'}`;
        userElement.classList.add('user-welcome');
      } else {
        userElement.innerHTML = `<a href="login.html" class="cta-btn">Sign-In/Sign-Up</a>`;
        userElement.classList.remove('user-welcome');
      }
    });
  }
}

// Scroll Management
class ScrollManager {
  constructor() {
    this.navbar = document.querySelector('.navbar');
    this.scrollToTopBtn = this.createScrollToTopButton();
  }

  init() {
    this.setupScrollHandler();
    this.setupScrollToTop();
  }

  createScrollToTopButton() {
    const scrollToTop = document.createElement('button');
    scrollToTop.className = 'scroll-to-top';
    scrollToTop.innerHTML = '↑';
    scrollToTop.setAttribute('aria-label', 'Scroll to top');
    document.body.appendChild(scrollToTop);
    return scrollToTop;
  }

  setupScrollHandler() {
    const handleScroll = utils.throttle(() => {
      const isScrolled = window.scrollY > CONFIG.SCROLL_THRESHOLD;
      if (this.navbar) {
        this.navbar.classList.toggle('scrolled', isScrolled);
      }
    }, 100);

    window.addEventListener('scroll', handleScroll);
  }

  setupScrollToTop() {
    this.scrollToTopBtn.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });

    window.addEventListener('scroll', utils.throttle(() => {
      const isNearTop = window.scrollY < 50;
      const shouldShow = window.scrollY > CONFIG.SCROLL_THRESHOLD && !isNearTop;
      this.scrollToTopBtn.classList.toggle('visible', shouldShow);
    }, 100));
  }
}

// Animation Management
class AnimationManager {
  init() {
    this.setupIntersectionObserver();
  }

  setupIntersectionObserver() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '50px'
      }
    );

    document.querySelectorAll('.game-card, .section-title').forEach(el => {
      observer.observe(el);
    });
  }
}

// Error Management
class ErrorManager {
  init() {
    window.addEventListener('error', this.handleError.bind(this));
    window.addEventListener('unhandledrejection', this.handlePromiseError.bind(this));
  }

  handleError(error) {
    console.error('Global error:', error);
    showToast('An error occurred: ' + error.message, 'error');
  }

  handlePromiseError(event) {
    console.error('Unhandled promise rejection:', event.reason);
    showToast('An error occurred: ' + event.reason.message, 'error');
  }
}

// Balance Management
class BalanceManager {
  constructor() {
    this.balanceInfo = document.getElementById('balanceInfo') || document.getElementById('balance-amount');
    this.balanceModal = document.getElementById('balanceModal');
  }

  init() {
    if (this.balanceInfo && this.balanceModal) {
      this.setupBalanceModal();
    }
  }

  setupBalanceModal() {
    const closeModalBtn = this.balanceModal.querySelector('.modal-close');
    const depositOption = document.getElementById('depositOption');
    const withdrawOption = document.getElementById('withdrawOption');

    // Open modal when clicking balance
    this.balanceInfo.addEventListener('click', (e) => {
      if (!auth.currentUser) return;
      e.stopPropagation();
      this.balanceModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    });

    // Close modal when clicking close button
    closeModalBtn.addEventListener('click', () => {
      this.balanceModal.classList.remove('active');
      document.body.style.overflow = '';
    });

    // Close modal when clicking outside
    this.balanceModal.addEventListener('click', (e) => {
      if (e.target === this.balanceModal) {
        this.balanceModal.classList.remove('active');
        document.body.style.overflow = '';
      }
    });

    // Handle deposit option click
    depositOption.addEventListener('click', () => {
      this.balanceModal.classList.remove('active');
      document.body.style.overflow = '';
      showTransactionModal('deposit');
    });

    // Handle withdraw option click
    withdrawOption.addEventListener('click', () => {
      this.balanceModal.classList.remove('active');
      document.body.style.overflow = '';
      showTransactionModal('withdraw');
    });

    // Close modal on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.balanceModal.classList.contains('active')) {
        this.balanceModal.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  }
}

// Update navigation menu
function updateNavigation(user) {
    const sideMenu = document.getElementById('sideMenu');
    if (!sideMenu) return;

    if (user) {
        sideMenu.innerHTML = `
            <div class="menu-header">
                <button id="closeMenu" class="close-menu" aria-label="Close menu">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            </div>
            <nav class="menu-links" role="navigation" aria-label="Side navigation">
                <ul>
                <li><a href="profile.html">My Profile</a></li>
                    <li><a href="index.html">Home</a></li>
                    <li><a href="index.html#games">Games</a></li>
                    <li><a href="#" onclick="window.showTransactionModal('deposit'); return false;">Deposit</a></li>
                    <li><a href="#" onclick="window.showTransactionModal('withdraw'); return false;">Withdraw</a></li>
                    
                </ul>
            </nav>
            <div class="menu-bottom">
                <div class="theme-toggle-container" role="group" aria-label="Theme selection">
                    <label class="toggle">
                        <input type="checkbox" id="themeToggle" aria-label="Toggle dark mode" />
                        <span class="toggle-slider"></span>
                    </label>
                    <span class="toggle-icon" aria-hidden="true"></span>
                    <span class="toggle-label">Toggle Theme</span>
                </div>
            </div>
        `;

        // Add logout event listener
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                try {
                    await auth.signOut();
                    window.location.reload();
                } catch (error) {
                    console.error('Error signing out:', error);
                    showToast('Error signing out', 'error');
                }
            });
        }
    } else {
        sideMenu.innerHTML = `
            <div class="menu-header">
                <button id="closeMenu" class="close-menu" aria-label="Close menu">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            </div>
            <nav class="menu-links" role="navigation" aria-label="Side navigation">
                <ul>
                    <li><a href="index.html">Home</a></li>
                    <li><a href="index.html#games">Games</a></li>
                    <li><a href="login.html" class="cta-btn">Login</a></li>
                </ul>
            </nav>
            <div class="menu-bottom">
                <div class="theme-toggle-container" role="group" aria-label="Theme selection">
                    <label class="toggle">
                        <input type="checkbox" id="themeToggle" aria-label="Toggle dark mode" />
                        <span class="toggle-slider"></span>
                    </label>
                    <span class="toggle-icon" aria-hidden="true"></span>
                    <span class="toggle-label">Toggle Theme</span>
                </div>
            </div>
        `;
    }
}

// Initialize Application
const init = () => {
  try {
    const themeManager = new ThemeManager();
    const menuManager = new MenuManager();
    const scrollManager = new ScrollManager();
    const animationManager = new AnimationManager();
    const errorManager = new ErrorManager();
    const balanceManager = new BalanceManager();

    themeManager.init();
    menuManager.init();
    scrollManager.init();
    animationManager.init();
    errorManager.init();
    balanceManager.init();

    // Initialize Firebase Auth State
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userElement = document.getElementById('user');
        const balanceElement = document.getElementById('balanceInfo') || document.getElementById('balance-amount');
        
        // Fetch user data from Firestore
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userData = userDoc.data() || {};
        
        if (userElement) {
          userElement.textContent = `Welcome, ${user.displayName || user.email}`;
        }
        if (balanceElement) {
          balanceElement.classList.add('logged-in');
          balanceElement.innerHTML = `
            <span class="balance">NPR ${parseFloat(userData.money || 0).toFixed(0)}</span>
          `;
        }
      } else {
        const userElement = document.getElementById('user');
        const balanceElement = document.getElementById('balanceInfo') || document.getElementById('balance-amount');
        
        if (userElement) {
          userElement.textContent = '';
        }
        if (balanceElement) {
          balanceElement.classList.remove('logged-in');
          balanceElement.innerHTML = `
            <a href="login.html" class="cta-btn">Sign-In/Sign-Up</a>
          `;
        }
      }
    });

    // Add keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.isMenuOpen) {
        menuManager.closeMenu();
      }
    });

  } catch (error) {
    console.error('Initialization error:', error);
    showToast('An error occurred while initializing the application', 'error');
  }
};

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
