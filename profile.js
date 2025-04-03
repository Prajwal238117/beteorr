import { auth, db } from "./firebaseConfig.js";
import { onAuthStateChanged, updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential, deleteUser } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, collection, query, where, orderBy, getDocs, deleteDoc, updateDoc, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// DOM Elements
const userNameEl = document.getElementById("userName");
const userEmailEl = document.getElementById("userEmail");
const memberSinceEl = document.getElementById("memberSince");
const changePasswordBtn = document.getElementById("changePasswordBtn");
const updateProfileBtn = document.getElementById("updateProfileBtn");
const deleteAccountBtn = document.getElementById("deleteAccountBtn");
const transactionTypeSelect = document.getElementById("transactionType");
const transactionHistoryEl = document.getElementById("transactionHistory");

// Modal Elements
const changePasswordModal = document.getElementById("changePasswordModal");
const updateProfileModal = document.getElementById("updateProfileModal");
const deleteModal = document.getElementById("deleteModal");

// Form Elements
const changePasswordForm = document.getElementById("changePasswordForm");
const updateProfileForm = document.getElementById("updateProfileForm");
const currentPasswordEl = document.getElementById("currentPassword");
const newPasswordEl = document.getElementById("newPassword");
const confirmPasswordEl = document.getElementById("confirmPassword");
const displayNameEl = document.getElementById("displayName");

// Initialize profile page
function initProfile() {
    setupAuthStateListener();
    setupEventListeners();
}

// Setup auth state listener
function setupAuthStateListener() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User is signed in
            await loadUserProfile(user);
            await loadTransactionHistory(user);
        } else {
            // User is signed out
            window.location.href = "login.html";
        }
    });
}

// Load user profile data
async function loadUserProfile(user) {
    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            userNameEl.textContent = user.displayName || "Anonymous User";
            userEmailEl.textContent = user.email;
            memberSinceEl.textContent = new Date(user.metadata.creationTime).toLocaleDateString();
        }
    } catch (error) {
        console.error("Error loading user profile:", error);
        window.showToast("Error loading profile data", "error");
    }
}

// Load transaction history
async function loadTransactionHistory(user) {
    try {
        const transactionsQuery = query(
            collection(db, "transactions"),
            where("userId", "==", user.uid),
            orderBy("timestamp", "desc"),
            limit(50)
        );
        
        const querySnapshot = await getDocs(transactionsQuery);
        displayTransactionHistory(querySnapshot);
    } catch (error) {
        console.error("Error loading transaction history:", error);
        if (error.code === 'failed-precondition') {
            window.showToast("Please create the required Firestore index", "error");
        } else {
            window.showToast("Error loading transaction history", "error");
        }
    }
}

// Display transaction history
function displayTransactionHistory(querySnapshot) {
    if (querySnapshot.empty) {
        transactionHistoryEl.innerHTML = "<p>No transactions found</p>";
        return;
    }

    const table = document.createElement("table");
    table.innerHTML = `
        <thead>
            <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;

    const tbody = table.querySelector("tbody");
    querySnapshot.forEach((doc) => {
        const transaction = doc.data();
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${new Date(transaction.timestamp?.toDate()).toLocaleString()}</td>
            <td>${transaction.type}</td>
            <td>NPR ${transaction.amount.toFixed(2)}</td>
            <td>${transaction.status}</td>
        `;
        tbody.appendChild(row);
    });

    transactionHistoryEl.innerHTML = "";
    transactionHistoryEl.appendChild(table);
}

// Setup event listeners
function setupEventListeners() {
    // Change Password Button
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener("click", () => {
            changePasswordModal.classList.add("active");
        });
    }

    // Update Profile Button
    if (updateProfileBtn) {
        updateProfileBtn.addEventListener("click", () => {
            updateProfileModal.classList.add("active");
        });
    }

    // Delete Account Button
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener("click", () => {
            deleteModal.classList.add("active");
        });
    }

    // Transaction Type Filter
    if (transactionTypeSelect) {
        transactionTypeSelect.addEventListener("change", async () => {
            const user = auth.currentUser;
            if (user) {
                await loadTransactionHistory(user);
            }
        });
    }

    // Modal Close Buttons
    document.querySelectorAll(".modal-close").forEach(button => {
        button.addEventListener("click", () => {
            const modal = button.closest(".modal-overlay");
            modal.classList.remove("active");
        });
    });

    // Change Password Form
    if (changePasswordForm) {
        changePasswordForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const user = auth.currentUser;
            if (!user) return;

            try {
                const credential = EmailAuthProvider.credential(
                    user.email,
                    currentPasswordEl.value
                );
                await reauthenticateWithCredential(user, credential);
                await updatePassword(user, newPasswordEl.value);
                window.showToast("Password updated successfully", "success");
                changePasswordModal.classList.remove("active");
                changePasswordForm.reset();
            } catch (error) {
                console.error("Error updating password:", error);
                window.showToast("Error updating password", "error");
            }
        });
    }

    // Update Profile Form
    if (updateProfileForm) {
        updateProfileForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const user = auth.currentUser;
            if (!user) return;

            try {
                await updateProfile(user, {
                    displayName: displayNameEl.value
                });
                await updateDoc(doc(db, "users", user.uid), {
                    name: displayNameEl.value
                });
                window.showToast("Profile updated successfully", "success");
                updateProfileModal.classList.remove("active");
                updateProfileForm.reset();
                await loadUserProfile(user);
            } catch (error) {
                console.error("Error updating profile:", error);
                window.showToast("Error updating profile", "error");
            }
        });
    }

    // Delete Account
    document.getElementById("confirmDeleteBtn")?.addEventListener("click", async () => {
        const user = auth.currentUser;
        if (!user) return;

        try {
            // Delete user data from Firestore
            await deleteDoc(doc(db, "users", user.uid));
            
            // Delete user account
            await deleteUser(user);
            
            window.showToast("Account deleted successfully", "success");
            window.location.href = "login.html";
        } catch (error) {
            console.error("Error deleting account:", error);
            window.showToast("Error deleting account", "error");
        }
    });
}

// Initialize the profile page when DOM is loaded
document.addEventListener("DOMContentLoaded", initProfile); 