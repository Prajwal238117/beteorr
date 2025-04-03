// login.js
import { auth, db } from "./firebaseConfig.js";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Initialize event listeners when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  // Tab switching logic
  const loginTab = document.getElementById("loginTab");
  const signupTab = document.getElementById("signupTab");
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");

  // Form elements
  const loginGoogle = document.getElementById("loginGoogle");
  const signupGoogle = document.getElementById("signupGoogle");

  if (loginTab && signupTab && loginForm && signupForm) {
    loginTab.addEventListener("click", () => {
      loginTab.classList.add("active");
      signupTab.classList.remove("active");
      loginForm.classList.remove("hidden");
      signupForm.classList.add("hidden");
    });

    signupTab.addEventListener("click", () => {
      signupTab.classList.add("active");
      loginTab.classList.remove("active");
      signupForm.classList.remove("hidden");
      loginForm.classList.add("hidden");
    });
  }

  // Add form submit event listeners
  if (loginForm) loginForm.addEventListener("submit", login);
  if (signupForm) signupForm.addEventListener("submit", signup);

  // Add Google sign-in button event listeners
  if (loginGoogle) loginGoogle.addEventListener("click", loginWithGoogle);
  if (signupGoogle) signupGoogle.addEventListener("click", loginWithGoogle);
});

// Create a Firestore document for the user
async function createUserCollection(user) {
  if (!user) return;
  const userRef = doc(db, "users", user.uid);
  try {
    await setDoc(userRef, {
      createdAt: serverTimestamp(),
      uid: user.uid,
      name: user.displayName,
      email: user.email,
      money: 0,
      userWinChance: 0
    });
    console.log("User collection created successfully");
  } catch (error) {
    console.error("Error creating user collection:", error);
    window.showToast("Error creating user profile", "error");
  }
}

// Sign-Up Function with input validation
async function signup(e) {
  e.preventDefault();
  const nameEl = document.querySelector("#signupName");
  const emailEl = document.querySelector("#signupEmail");
  const passwordEl = document.querySelector("#signupPassword");

  // Validate required fields
  if (!emailEl.value.trim() || !passwordEl.value.trim()) {
    window.showToast("Email and password are required!", "error");
    return;
  }
  
  // Validate password length
  if (passwordEl.value.trim().length < 6) {
    window.showToast("Password must be at least 6 characters long", "error");
    return;
  }

  try {
    const result = await createUserWithEmailAndPassword(
      auth,
      emailEl.value.trim(),
      passwordEl.value.trim()
    );
    // Update the user's display name (trimmed)
    await updateProfile(result.user, { displayName: nameEl.value.trim() });
    // Create a user document in Firestore
    await createUserCollection(result.user);
    // Send email verification
    await sendEmailVerification(result.user);
    window.showToast("Sign-up successful! Check your email for verification.", "success");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 2000);
  } catch (err) {
    console.error("Signup error:", err);
    window.showToast(err.message || "Invalid Information", "error");
  }
}

// Login Function
async function login(e) {
  e.preventDefault();
  const emailEl = document.querySelector("#loginEmail");
  const passwordEl = document.querySelector("#loginPassword");

  if (!emailEl.value.trim() || !passwordEl.value.trim()) {
    window.showToast("Email and password are required!", "error");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, emailEl.value.trim(), passwordEl.value.trim());
    window.showToast("Login successful! Redirecting...", "success");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 2000);
  } catch (err) {
    console.error("Login error:", err);
    window.showToast(err.message || "Invalid Information", "error");
  }
}

// Google Sign-In Function
async function loginWithGoogle() {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    // Check if this is a new user
    const userRef = doc(db, "users", result.user.uid);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      // Create new user collection for first-time Google sign-in
      await createUserCollection(result.user);
    }
    
    window.showToast("Google Sign-In Successful!", "success");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 2000);
  } catch (err) {
    console.error("Google sign-in error:", err);
    window.showToast(err.message, "error");
  }
}

// Update User Balance Function
function updateUserBalance() {
  onAuthStateChanged(auth, async (user) => {
    const userBalanceEl = document.getElementById("userBalance");
    if (!userBalanceEl) return;
    if (user) {
      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const data = userDocSnap.data();
          const money = data.money || 0;
          userBalanceEl.innerHTML = `<span>NPR ${parseFloat(money).toFixed(0)}</span>`;
        } else {
          userBalanceEl.innerHTML = `<span>NPR 0</span>`;
        }
      } catch (error) {
        console.error("Error retrieving user balance:", error);
        userBalanceEl.innerHTML = `<span>NPR 0</span>`;
      }
    } else {
      userBalanceEl.innerHTML = `
        <a href="login.html" class="cta-btn">Login</a>
        <a href="login.html" class="cta-btn">Sign-Up</a>
      `;
    }
  });
}

// Auth state change to handle sign-out button rendering
onAuthStateChanged(auth, (user) => {
  const authActionDiv = document.getElementById("authAction");
  if (!authActionDiv) return;
  if (user) {
    authActionDiv.innerHTML = '<button id="signOutBtn" class="cta-btn">Sign Out</button>';
    const signOutBtn = document.getElementById("signOutBtn");
    if (signOutBtn) {
      signOutBtn.addEventListener("click", async () => {
        try {
          await signOut(auth);
          window.showToast("Signed out successfully!", "success");
        } catch (error) {
          window.showToast(error.message, "error");
        }
      });
    }
  } else {
    authActionDiv.innerHTML = '';
  }
});

// Call the function on page load to update the user balance
updateUserBalance();

// Expose functions to the global scope so inline event handlers work
window.signup = signup;
window.login = login;
window.loginWithGoogle = loginWithGoogle;
