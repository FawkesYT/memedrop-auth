// sketch.js

document.addEventListener('DOMContentLoaded', () => {
    console.log("MemeDrop App: DOMContentLoaded fired.");

    // --- Firebase Configuration ---
    const firebaseConfig = {
        apiKey: "AIzaSyAEDWYFwpeSttykkIR60kiCojA5S5UdaA8",
        authDomain: "test-6336a.firebaseapp.com",
        databaseURL: "https://test-6336a-default-rtdb.firebaseio.com",
        projectId: "test-6336a",
        storageBucket: "test-6336a.appspot.com",
        messagingSenderId: "437879418972",
        appId: "1:437879418972:web:47678bb0b3664edab8f699"
    };

    // --- Initialize Firebase ---
    try {
        firebase.initializeApp(firebaseConfig);
        console.log("Firebase app initialized successfully.");
    } catch (e) {
        console.error("Firebase initialization FAILED:", e);
        document.body.innerHTML = '<h1 style="color:red;text-align:center;margin-top:50px;">Critical Error: Could not connect to services. Please try again later.</h1>';
        return;
    }

    const auth = firebase.auth();
    const database = firebase.database();
    const serverTimestamp = firebase.database.ServerValue.TIMESTAMP;

    // --- Global State Variables ---
    let currentUser = null;
    let allMemes = [];
    let currentFeedMemes = [];
    let activeFeed = 'for-you';
    let currentAccountPageUserId = null;
    let activeAccountTab = 'account-memes-content';
    const commentsListeners = {};
    let userNotificationsListener = null;
    let unreadNotificationCount = 0;
    let activeContextMenu = null;
    let userFollowData = { following: {}, followers: {}, favorites: {}, settings: { theme: 'vaporwave', emailNotifications: false } };

    // --- DOM Element References ---
    const homeLink = document.getElementById('home-link');
    const searchBar = document.getElementById('search-bar');
    const notificationsBtn = document.getElementById('notificationsBtn');
    const notificationBadge = document.getElementById('notification-badge');
    const notificationDropdownContainer = document.getElementById('notification-dropdown-container');
    const uploadBtn = document.getElementById('uploadBtn');
    const themeSelector = document.getElementById('theme-selector');
    const myAccountBtn = document.getElementById('myAccountBtn');
    const userInfoDiv = document.getElementById('userInfo');
    const loginPromptBtn = document.getElementById('loginPromptBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const mainContentArea = document.getElementById('main-content-area');
    const galleryView = document.getElementById('gallery-view');
    const memeGalleryPanel = document.getElementById('meme-gallery-panel');
    const memeGallery = document.getElementById('meme-gallery');
    const accountView = document.getElementById('account-view');
    const feedTabsContainer = document.querySelector('#gallery-view .feed-tabs');
    const accountPhotoEl = document.getElementById('account-photo');
    const accountDisplayNameEl = document.getElementById('account-display-name');
    const accountEmailEl = document.getElementById('account-email');
    const accountMemeCountStatEl = document.getElementById('account-meme-count-stat');
    const accountFollowerCountStatEl = document.getElementById('account-follower-count-stat');
    const accountFollowingCountStatEl = document.getElementById('account-following-count-stat');
    const accountFollowUnfollowBtn = document.getElementById('account-follow-unfollow-btn');
    const accountEditProfileBtn = document.getElementById('account-edit-profile-btn');
    const accountTabsContainer = document.querySelector('#account-view .account-tabs');
    const accountMemeGallery = document.getElementById('account-meme-gallery');
    const accountFavoritesGallery = document.getElementById('account-favorites-gallery');
    const accountFollowersContent = document.getElementById('account-followers-content');
    const accountFollowingContent = document.getElementById('account-following-content');
    const modalContainer = document.getElementById('modal-container');
    const notificationArea = document.getElementById('notification-area');
    const spinnerOverlay = document.getElementById('spinner-overlay');

    // --- Utility Functions ---
    const showSpinner = () => spinnerOverlay?.classList.remove('hidden');
    const hideSpinner = () => spinnerOverlay?.classList.add('hidden');

    const showInPageNotification = (message, type = 'info', duration = 3500) => {
        if (!notificationArea) return;
        const notificationId = `notif-${Date.now()}`;
        const notification = document.createElement('div');
        notification.id = notificationId;
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.setAttribute('role', 'alert');
        notification.addEventListener('click', () => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(120%)';
            notification.addEventListener('transitionend', () => notification.remove(), { once: true });
        });
        notificationArea.appendChild(notification);
        void notification.offsetWidth;
        notification.classList.add('show');
        setTimeout(() => {
            const currentNotif = document.getElementById(notificationId);
            if (currentNotif) {
                currentNotif.style.opacity = '0';
                currentNotif.style.transform = 'translateX(120%)';
                currentNotif.addEventListener('transitionend', () => currentNotif.remove(), { once: true });
            }
        }, duration);
    };

    const timeAgo = (timestamp) => {
        if (!timestamp) return 'a while ago';
        const now = new Date();
        const seconds = Math.round((now.getTime() - new Date(timestamp).getTime()) / 1000);
        if (seconds < 5) return 'just now';
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.round(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.round(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.round(hours / 24);
        if (days < 7) return `${days}d ago`;
        const weeks = Math.round(days / 7);
        if (weeks < 4) return `${weeks}w ago`;
        const months = Math.round(days / 30.44);
        if (months < 12) return `${months}mo ago`;
        const years = Math.round(days / 365.25);
        return `${years}y ago`;
    };

    const initTheme = () => {
        const savedTheme = localStorage.getItem('theme') || userFollowData?.settings?.theme || 'vaporwave';
        document.body.setAttribute('data-theme', savedTheme);
        if (themeSelector) themeSelector.value = savedTheme;
        const settingsModalThemeSelector = document.querySelector('#settingsFormModal #settingThemeModal');
        if (settingsModalThemeSelector) settingsModalThemeSelector.value = savedTheme;
    };

    // --- View Management ---
    let currentVisibleView = galleryView;
    const switchMainView = (viewToShow) => {
        document.querySelectorAll('#main-content-area > .view').forEach(v => v.classList.add('hidden'));
        if (viewToShow) {
            viewToShow.classList.remove('hidden');
            currentVisibleView = viewToShow;
            window.scrollTo(0, 0);
        } else {
            galleryView.classList.remove('hidden');
            currentVisibleView = galleryView;
        }
    };

    // --- Modal Management ---
    const openModal = (modalType, data = null) => {
        closeActiveContextMenu();
        if (!modalContainer) { console.error("Modal container not found!"); return; }
        modalContainer.innerHTML = '';
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';
        let modalHTML = '';

        switch (modalType) {
            case 'auth':
                modalHTML = `<div class="modal-content"><h2>Login with Google</h2><p>Continue to MemeDrop using your Google account.</p><div class="modal-flex-buttons"><button id="googleLoginBtn" class="nav-button">Sign in with Google</button></div><button type="button" class="cancel-btn nav-button" style="margin-top:20px;">Cancel</button></div>`;
                break;
            case 'upload':
                modalHTML = `<div class="modal-content"><h2>Upload a New Meme</h2>
                                <form id="uploadForm">
                                    <label for="memeFileModal">Choose image/gif (Max 5MB):</label>
                                    <input type="file" id="memeFileModal" name="memeFileModal" accept="image/*,image/gif" required>
                                    <label for="memeDescriptionModal">Description (Max 2000 chars):</label>
                                    <textarea id="memeDescriptionModal" name="memeDescriptionModal" placeholder="A funny description..." rows="4" required maxlength="1999"></textarea>
                                    <div class="modal-flex-buttons">
                                        <button type="button" class="cancel-btn nav-button">Cancel</button>
                                        <button type="submit" class="nav-button">Upload Meme</button>
                                    </div>
                                </form>
                             </div>`;
                break;
            case 'editMeme':
                if (data && data.meme) {
                    modalHTML = `<div class="modal-content"><h2>Edit Meme Description</h2>
                                <form id="editMemeForm">
                                    <input type="hidden" id="editMemeIdModal" value="${data.meme.id}">
                                    <label for="editMemeDescriptionModal">Description (Max 2000 chars):</label>
                                    <textarea id="editMemeDescriptionModal" name="editMemeDescriptionModal" rows="4" required maxlength="1999">${data.meme.description || ''}</textarea>
                                    <div class="modal-flex-buttons">
                                        <button type="button" class="cancel-btn nav-button">Cancel</button>
                                        <button type="submit" class="nav-button">Save Changes</button>
                                    </div>
                                </form>
                             </div>`;
                } else { showInPageNotification("Error: Meme data not found for editing.", "error"); return; }
                break;
            case 'settings':
                 const userSettings = userFollowData.settings || { theme: 'vaporwave', emailNotifications: false };
                 const themeOptions = ['light', 'dark', 'vaporwave', 'synthwave84', 'forest', 'ocean', 'sunset', 'monochrome'];
                 const themeOptionHTML = themeOptions.map(theme => {
                    const themeName = theme.charAt(0).toUpperCase() + theme.slice(1).replace(/([A-Z0-9])/g, ' $1').trim();
                    return `<option value="${theme}" ${userSettings.theme === theme ? 'selected' : ''}>${themeName}</option>`;
                 }).join('');

                 modalHTML = `<div class="modal-content"><h2>Settings</h2>
                                <form id="settingsFormModal">
                                    <div>
                                        <label for="settingThemeModal">Preferred Theme:</label>
                                        <select id="settingThemeModal" name="theme">
                                            ${themeOptionHTML}
                                        </select>
                                    </div>
                                    <div style="margin-top: 15px; text-align:left;">
                                        <input type="checkbox" id="settingEmailNotificationsModal" name="emailNotifications" ${userSettings.emailNotifications ? 'checked' : ''}>
                                        <label for="settingEmailNotificationsModal" class="checkbox-label">Receive Email Notifications (Feature coming soon)</label>
                                    </div>
                                    <div class="modal-flex-buttons" style="margin-top:25px;">
                                        <button type="button" class="cancel-btn nav-button">Cancel</button>
                                        <button type="submit" class="nav-button">Save Settings</button>
                                    </div>
                                </form>
                             </div>`;
                break;
            case 'memeDetail':
                if (data && data.meme) {
                    modalOverlay.classList.add('meme-detail-modal-overlay');
                    modalHTML = `<div class="meme-detail-modal-content">
                                    <button class="meme-detail-close-btn" aria-label="Close meme detail view">×</button>
                                    <img src="${data.meme.imageBase64}" alt="${(data.meme.description || 'Meme image').replace(/"/g, '"')}"/>
                                 </div>`;
                } else { showInPageNotification("Error: Meme data not found for detail view.", "error"); return; }
                break;
            default:
                console.error("Unknown modal type:", modalType);
                return;
        }

        modalOverlay.innerHTML = modalHTML;
        modalContainer.appendChild(modalOverlay);
        attachModalListeners(modalType, modalOverlay, data);
    };

    const attachModalListeners = (modalType, modalOverlayElement, modalData = null) => {
        const closeLogic = () => {
            modalOverlayElement.style.animationName = 'fadeOut';
            modalOverlayElement.addEventListener('animationend', () => {
                modalOverlayElement.remove();
            }, { once: true });
        };

        modalOverlayElement.addEventListener('click', e => {
            if (e.target === modalOverlayElement || e.target.classList.contains('cancel-btn') || e.target.classList.contains('meme-detail-close-btn')) {
                closeLogic();
            }
        });

        const escListener = (e) => {
            if (e.key === "Escape" && modalContainer.contains(modalOverlayElement)) {
                closeLogic();
            }
        };
        document.addEventListener('keydown', escListener);
        const observer = new MutationObserver((mutationsList, obs) => {
            for (const mutation of mutationsList) {
                if (mutation.removedNodes) {
                    let modalRemoved = false;
                    mutation.removedNodes.forEach(node => { if (node === modalOverlayElement) modalRemoved = true; });
                    if (modalRemoved) { document.removeEventListener('keydown', escListener); obs.disconnect(); return; }
                }
            }
        });
        observer.observe(modalContainer, { childList: true });

        switch (modalType) {
            case 'auth':
                const googleLoginBtn = modalOverlayElement.querySelector('#googleLoginBtn');
                googleLoginBtn?.addEventListener('click', async () => {
                    showSpinner();
                    const provider = new firebase.auth.GoogleAuthProvider();
                    try {
                        const result = await auth.signInWithPopup(provider);
                        if (result.user) {
                            const user = result.user;
                            const userRef = database.ref('users/' + user.uid);
                            const userSnap = await userRef.once('value');
                            const updates = {
                                lastLogin: serverTimestamp,
                                displayName: user.displayName || (userSnap.exists() ? userSnap.val().displayName : 'Meme Enthusiast'),
                                photoURL: user.photoURL || (userSnap.exists() ? userSnap.val().photoURL : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.displayName || 'User')}&fontSize=36`)
                            };
                            if (!userSnap.exists()) {
                                updates.email = user.email;
                                updates.createdAt = serverTimestamp;
                                updates.settings = { theme: 'vaporwave', emailNotifications: false };
                                await userRef.set(updates);
                            } else {
                                await userRef.update(updates);
                            }
                            closeLogic();
                            showInPageNotification('Login successful!', 'success');
                        }
                    } catch (error) {
                        console.error("signInWithPopup ERROR:", error);
                        showInPageNotification(`Login failed: ${error.message} (Code: ${error.code})`, "error");
                    } finally {
                        hideSpinner();
                    }
                });
                break;
            case 'upload':
                const uploadForm = modalOverlayElement.querySelector('#uploadForm');
                uploadForm?.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    if (!currentUser) { showInPageNotification("Please login to upload memes.", "error"); openModal('auth'); return; }
                    showSpinner();
                    const fileInput = uploadForm.querySelector('#memeFileModal');
                    const descriptionInput = uploadForm.querySelector('#memeDescriptionModal');
                    const file = fileInput.files[0];
                    const description = descriptionInput.value.trim();

                    if (!file) { hideSpinner(); showInPageNotification("Please select an image file.", "warning"); return; }
                    if (!description) { hideSpinner(); showInPageNotification("Please enter a description.", "warning"); return; }
                    if (file.size > 5 * 1024 * 1024) { hideSpinner(); showInPageNotification("Image too large! Max 5MB.", "error"); return; }

                    try {
                        const reader = new FileReader();
                        reader.onloadend = async () => {
                            if (reader.error) { hideSpinner(); showInPageNotification("Failed to read file.", "error"); return; }
                            const imageBase64 = reader.result;
                            if (imageBase64.length > 7 * 1024 * 1024) { hideSpinner(); showInPageNotification("Encoded image data too large. Try a smaller or more compressed image.", "error"); return; }

                            const memeData = {
                                imageBase64, description,
                                creatorId: currentUser.uid,
                                creatorName: currentUser.displayName || 'Anonymous Dropper',
                                createdAt: serverTimestamp,
                                likeCount: 0, dislikeCount: 0, commentCount: 0, favoriteCount: 0, viewCount: 0,
                                likes: {}, dislikes: {}, favorites: {}
                            };
                            await database.ref('memes').push(memeData);
                            showInPageNotification('Meme uploaded successfully!', 'success');
                            if (fileInput) fileInput.value = '';
                            if (descriptionInput) descriptionInput.value = '';
                            closeLogic();
                        };
                        reader.readAsDataURL(file);
                    } catch (uploadError) {
                        console.error("Upload error:", uploadError);
                        showInPageNotification(`Upload failed: ${uploadError.message}`, "error");
                         hideSpinner(); // Ensure spinner hides on catch
                    }
                    // Removed finally hideSpinner here, as it's handled in onloadend/error
                });
                break;
            case 'editMeme':
                const editMemeForm = modalOverlayElement.querySelector('#editMemeForm');
                editMemeForm?.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    if (!currentUser || !modalData?.meme || currentUser.uid !== modalData.meme.creatorId) {
                        showInPageNotification("You don't have permission to edit this.", "error"); return;
                    }
                    const memeId = editMemeForm.querySelector('#editMemeIdModal').value;
                    const newDescription = editMemeForm.querySelector('#editMemeDescriptionModal').value.trim();
                    // Allow empty description, length validation is in rules and on textarea maxlength
                    showSpinner();
                    try {
                        await database.ref(`memes/${memeId}/description`).set(newDescription);
                        await database.ref(`memes/${memeId}/lastEditedAt`).set(serverTimestamp);
                        showInPageNotification("Meme description updated!", "success");
                        closeLogic();
                    } catch (err) {
                        console.error("Error updating description:", err);
                        showInPageNotification("Failed to update: " + err.message, "error");
                    } finally {
                        hideSpinner();
                    }
                });
                break;
            case 'settings':
                const settingsForm = modalOverlayElement.querySelector('#settingsFormModal');
                settingsForm?.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    if (!currentUser) { showInPageNotification("Please login to save settings.", "error"); return; }
                    const newTheme = settingsForm.querySelector('#settingThemeModal').value;
                    const emailNotifs = settingsForm.querySelector('#settingEmailNotificationsModal').checked;
                    showSpinner();
                    try {
                        const newSettings = { theme: newTheme, emailNotifications: emailNotifs };
                        await database.ref(`users/${currentUser.uid}/settings`).set(newSettings);
                        userFollowData.settings = newSettings;
                        localStorage.setItem('theme', newTheme);
                        document.body.setAttribute('data-theme', newTheme);
                        if(themeSelector) themeSelector.value = newTheme;
                        showInPageNotification("Settings saved!", "success");
                        closeLogic();
                    } catch (err) {
                        console.error("Error saving settings:", err);
                        showInPageNotification("Failed to save settings: " + err.message, "error");
                    } finally {
                        hideSpinner();
                    }
                });
                break;
        }
    };

    // --- UI Update Functions ---
    const updateUIForAuthState = (user) => {
        const prevUid = currentUser?.uid; // Capture previous UID before updating currentUser
        currentUser = user;

        const currentLogoutBtn = document.getElementById('logoutBtn');
        if (currentLogoutBtn) currentLogoutBtn.remove(); // Remove old button and its listener

        if (user) {
            if (userInfoDiv) {
                userInfoDiv.innerHTML = `<span title="${user.displayName || 'User'}">${user.displayName || 'User'}!</span> <button id="logoutBtn" class="nav-button">Logout</button>`;
                document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
                userInfoDiv.classList.remove('hidden');
            }
            loginPromptBtn?.classList.add('hidden');
            uploadBtn?.classList.remove('hidden');
            settingsBtn?.classList.remove('hidden');
            myAccountBtn?.classList.remove('hidden');
            document.getElementById('feed-following')?.classList.remove('hidden');
            document.getElementById('feed-favorites')?.classList.remove('hidden');

            listenToUserNotifications(user.uid);
            loadUserFollowData(user.uid); // Load user's own follow/favs/settings data
        } else {
            if(userInfoDiv) {
                userInfoDiv.classList.add('hidden');
                userInfoDiv.innerHTML = '';
            }
            loginPromptBtn?.classList.remove('hidden');
            uploadBtn?.classList.add('hidden');
            settingsBtn?.classList.add('hidden');
            myAccountBtn?.classList.add('hidden');
            document.getElementById('feed-following')?.classList.add('hidden');
            document.getElementById('feed-favorites')?.classList.add('hidden');

            userFollowData = { following: {}, followers: {}, favorites: {}, settings: { theme: 'vaporwave', emailNotifications: false } }; // Reset cache

            if (userNotificationsListener && prevUid) { // Use captured prevUid
                database.ref(`user-notifications/${prevUid}`).off('value', userNotificationsListener);
                userNotificationsListener = null;
            }
            updateNotificationBadge(0);
            closeNotificationDropdown();
        }

        // Refresh current view based on auth state
        if (currentVisibleView === galleryView) {
            if ((activeFeed === 'favorites' || activeFeed === 'following') && !user) {
                renderGallery([], 'meme-gallery');
                setActiveFeedTab('for-you'); // Default back
            } else {
                renderGalleryForCurrentFeed(); // Re-render current general feed
            }
        } else if (currentVisibleView === accountView) {
            if (!user) { // If on account page and logs out, go to gallery
                switchMainView(galleryView);
                setActiveFeedTab('for-you');
                renderGalleryForCurrentFeed();
            } else if (currentAccountPageUserId) { // If still logged in, refresh account page content
                loadAccountPage(currentAccountPageUserId);
            }
        }
    };

    const handleLogout = () => {
        auth.signOut()
            .then(() => showInPageNotification('You have been logged out.', 'info'))
            .catch(error => {
                console.error("Logout error:", error);
                showInPageNotification(`Logout failed: ${error.message}`, "error");
            });
    };

    // --- Meme Rendering, Interaction, Comments ---
    const createMemeElement = (meme) => {
        const post = document.createElement('article');
        post.className = 'meme-post';
        post.dataset.memeId = meme.id;
        post.setAttribute('tabindex', '0');
        post.setAttribute('aria-labelledby', `meme-desc-${meme.id}`);

        const imageContainer = document.createElement('div');
        imageContainer.className = 'meme-post-image-container';
        const img = document.createElement('img');
        img.src = meme.imageBase64;
        img.alt = (meme.description || `Meme by ${meme.creatorName || 'User'}`).substring(0, 100).replace(/"/g, '"');
        img.loading = 'lazy';
        imageContainer.appendChild(img);
        post.appendChild(imageContainer);

        imageContainer.addEventListener('click', (e) => { e.stopPropagation(); incrementMemeViewCount(meme.id); openMemeDetail(meme); });
        post.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { if (document.activeElement === post) { e.preventDefault(); incrementMemeViewCount(meme.id); openMemeDetail(meme); } } });

        const memeInfoDiv = document.createElement('div');
        memeInfoDiv.className = 'meme-info';
        if (meme.description) {
            const descriptionP = document.createElement('p');
            descriptionP.className = 'meme-description';
            descriptionP.id = `meme-desc-${meme.id}`;
            descriptionP.textContent = meme.description;
            memeInfoDiv.appendChild(descriptionP);
        }

        const metaDiv = document.createElement('div');
        metaDiv.className = 'meme-meta';
        const creatorDiv = document.createElement('div');
        creatorDiv.className = 'meme-creator';
        const creatorLink = document.createElement('a');
        creatorLink.className = 'meme-creator-link';
        creatorLink.textContent = `${meme.creatorName || 'Anonymous'}`;
        creatorLink.href = `#/user/${meme.creatorId}`;
        creatorLink.dataset.userId = meme.creatorId;
        creatorLink.addEventListener('click', (e) => { e.preventDefault(); navigateToAccountPage(meme.creatorId); });
        creatorDiv.appendChild(creatorLink);

        if (currentUser && currentUser.uid !== meme.creatorId) {
            const followBtn = document.createElement('button');
            followBtn.className = 'follow-creator-btn';
            followBtn.dataset.userId = meme.creatorId;
            checkAndSetFollowButtonState(meme.creatorId, followBtn);
            followBtn.addEventListener('click', (e) => { e.stopPropagation(); handleFollowToggle(meme.creatorId, e.currentTarget); });
            creatorDiv.appendChild(followBtn);
        }
        metaDiv.appendChild(creatorDiv);

        const timestampP = document.createElement('p');
        timestampP.className = 'meme-timestamp';
        timestampP.textContent = timeAgo(meme.createdAt);
        metaDiv.appendChild(timestampP);
        memeInfoDiv.appendChild(metaDiv);
        post.appendChild(memeInfoDiv);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'meme-actions';

        const likeCount = meme.likeCount || 0;
        const dislikeCount = meme.dislikeCount || 0;
        const commentCount = meme.commentCount || 0;
        const isLiked = currentUser && meme.likes && meme.likes[currentUser.uid];
        const isDisliked = currentUser && meme.dislikes && meme.dislikes[currentUser.uid];
        const isFavorited = currentUser && userFollowData.favorites && userFollowData.favorites[meme.id];

        const likeButton = document.createElement('button'); likeButton.className = `action-button like-button ${isLiked ? 'liked' : ''}`; likeButton.title = isLiked ? "Unlike" : "Like"; likeButton.setAttribute('aria-pressed', !!isLiked); likeButton.innerHTML = `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg><span class="like-count">${likeCount}</span>`; likeButton.onclick = (e) => { e.stopPropagation(); handleLike(meme.id); }; actionsDiv.appendChild(likeButton);
        const dislikeButton = document.createElement('button'); dislikeButton.className = `action-button dislike-button ${isDisliked ? 'disliked' : ''}`; dislikeButton.title = isDisliked ? "Remove Dislike" : "Dislike"; dislikeButton.setAttribute('aria-pressed', !!isDisliked); dislikeButton.innerHTML = `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="${isDisliked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3L8 14M5 2h4v10H5z"/></svg><span class="dislike-count">${dislikeCount}</span>`; dislikeButton.onclick = (e) => { e.stopPropagation(); handleDislike(meme.id); }; actionsDiv.appendChild(dislikeButton);
        const commentToggleButton = document.createElement('button'); commentToggleButton.className = 'action-button comment-toggle-button'; commentToggleButton.title = "View Comments"; commentToggleButton.setAttribute('aria-expanded', 'false'); commentToggleButton.innerHTML = `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg><span class="comment-count-display">${commentCount}</span>`; commentToggleButton.onclick = (e) => { e.stopPropagation(); toggleComments(meme.id, post, commentToggleButton); }; actionsDiv.appendChild(commentToggleButton);
        const favoriteButton = document.createElement('button'); favoriteButton.className = `action-button favorite-button ${isFavorited ? 'favorited' : ''}`; favoriteButton.title = isFavorited ? "Unfavorite" : "Favorite"; favoriteButton.setAttribute('aria-pressed', !!isFavorited); favoriteButton.innerHTML = `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="${isFavorited ? 'var(--favorite-color)' : 'none'}" stroke="var(--favorite-color)" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg><span class="sr-only">Favorite</span>`; favoriteButton.onclick = (e) => { e.stopPropagation(); handleFavoriteToggle(meme.id, e.currentTarget); }; actionsDiv.appendChild(favoriteButton);

        const viewsCounterSpan = document.createElement('span'); viewsCounterSpan.className = 'meme-views-counter'; viewsCounterSpan.innerHTML = `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg> <span>${meme.viewCount || 0}</span>`; actionsDiv.appendChild(viewsCounterSpan);

        if (currentUser && currentUser.uid === meme.creatorId) {
            const optionsButton = document.createElement('button'); optionsButton.className = 'action-button post-options-button'; optionsButton.title = "More options"; optionsButton.innerHTML = `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>`; optionsButton.onclick = (e) => { e.stopPropagation(); togglePostOptionsMenu(meme, optionsButton); }; actionsDiv.appendChild(optionsButton);
        }
        post.appendChild(actionsDiv);

        const commentsSection = document.createElement('div'); commentsSection.className = 'comments-section hidden'; commentsSection.id = `comments-for-${meme.id}`; const altTextForComment = (meme.description || 'this meme').substring(0,50).replace(/"/g, '"'); const commentsListAriaLabel = `Comments for ${altTextForComment}`; commentsSection.innerHTML = `<h4>Comments</h4><div class="comments-list" aria-live="polite" aria-label="${commentsListAriaLabel}"><p>Click comment icon to load/refresh.</p></div>${currentUser ? `<form class="add-comment-form" data-meme-id="${meme.id}" aria-labelledby="comment-form-label-${meme.id}"><label id="comment-form-label-${meme.id}" class="sr-only">Add a comment for ${altTextForComment}</label><textarea name="commentText" placeholder="Add a comment..." required aria-required="true" rows="3"></textarea><button type="submit" class="nav-button">Post</button></form>` : '<p><small>Login to post comments.</small></p>'}`; post.appendChild(commentsSection);
        const addCommentForm = commentsSection.querySelector('.add-comment-form');
        if (addCommentForm) { addCommentForm.addEventListener('submit', (e) => { e.preventDefault(); e.stopPropagation(); handleAddComment(e, meme.id); }); }
        return post;
    };

    const renderGallery = (memesToDisplay, galleryElementId = 'meme-gallery') => {
        const galleryContainer = document.getElementById(galleryElementId);
        if (!galleryContainer) { console.warn(`Gallery container #${galleryElementId} not found.`); return; }
        galleryContainer.innerHTML = '';
        if (!memesToDisplay || memesToDisplay.length === 0) {
            galleryContainer.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; padding: 40px 0;">No memes here yet! Try a different feed or upload your own.</p>`;
            return;
        }
        const fragment = document.createDocumentFragment();
        memesToDisplay.forEach((meme, index) => {
            const memeEl = createMemeElement(meme);
            if (memeEl) {
                memeEl.style.animationDelay = `${index * 0.05}s`;
                fragment.appendChild(memeEl);
            }
        });
        galleryContainer.appendChild(fragment);
    };

    const openMemeDetail = (meme) => {
        // incrementMemeViewCount(meme.id); // Called on click before this
        openModal('memeDetail', { meme });
    };

    const incrementMemeViewCount = (memeId) => {
        if (!memeId) return;
        const memeRef = database.ref(`memes/${memeId}/viewCount`);
        memeRef.transaction(currentCount => (currentCount || 0) + 1)
            .catch(error => console.warn("View count increment failed:", error.message));
    };

    const handleLike = (memeId) => handleLikeDislike(memeId, 'like');
    const handleDislike = (memeId) => handleLikeDislike(memeId, 'dislike');

    const handleLikeDislike = (memeId, actionType) => {
        if (!currentUser) { openModal('auth'); return; }
        const memeRef = database.ref(`memes/${memeId}`);
        memeRef.transaction(memeData => {
            if (memeData) {
                memeData.likes = memeData.likes || {};
                memeData.dislikes = memeData.dislikes || {};
                memeData.likeCount = typeof memeData.likeCount === 'number' ? memeData.likeCount : 0;
                memeData.dislikeCount = typeof memeData.dislikeCount === 'number' ? memeData.dislikeCount : 0;
                const userUid = currentUser.uid;
                const wasLiked = !!memeData.likes[userUid];
                const wasDisliked = !!memeData.dislikes[userUid];

                if (actionType === 'like') {
                    if (wasLiked) {
                        memeData.likeCount = Math.max(0, memeData.likeCount - 1);
                        delete memeData.likes[userUid];
                    } else {
                        memeData.likeCount++;
                        memeData.likes[userUid] = true;
                        if (wasDisliked) {
                            memeData.dislikeCount = Math.max(0, memeData.dislikeCount - 1);
                            delete memeData.dislikes[userUid];
                        }
                        if (memeData.creatorId && memeData.creatorId !== userUid) {
                            memeData._pendingNotification = { type: 'like', memeOwnerId: memeData.creatorId, memeId: memeId };
                        }
                    }
                } else if (actionType === 'dislike') {
                    if (wasDisliked) {
                        memeData.dislikeCount = Math.max(0, memeData.dislikeCount - 1);
                        delete memeData.dislikes[userUid];
                    } else {
                        memeData.dislikeCount++;
                        memeData.dislikes[userUid] = true;
                        if (wasLiked) {
                            memeData.likeCount = Math.max(0, memeData.likeCount - 1);
                            delete memeData.likes[userUid];
                        }
                    }
                }
            }
            return memeData;
        }, (error, committed, snapshot) => {
            if (error) {
                console.error(`${actionType} transaction error:`, error);
                showInPageNotification(`Could not process ${actionType}: ${error.message}`, "error");
            } else if (committed) {
                const updatedMeme = snapshot.val();
                 if (updatedMeme && updatedMeme._pendingNotification) {
                    const {type, memeOwnerId, memeId: currentMemeId} = updatedMeme._pendingNotification; // Renamed to avoid conflict
                    createNotification(memeOwnerId, type, currentUser.uid, currentUser.displayName || 'Someone', currentMemeId, `${type}d your meme.`, 'meme');
                    database.ref(`memes/${currentMemeId}/_pendingNotification`).remove();
                 }
            }
        });
    };

    const toggleComments = (memeId, postElement, toggleButton) => {
        const commentsSection = postElement.querySelector('.comments-section');
        if (!commentsSection) return;
        const commentsListDiv = commentsSection.querySelector('.comments-list');
        const isHidden = commentsSection.classList.toggle('hidden');
        toggleButton.setAttribute('aria-expanded', String(!isHidden));

        if (!isHidden) {
            commentsListDiv.innerHTML = '<p>Loading comments...</p>';
            if (commentsListeners[memeId] && commentsListeners[memeId].isActive) {
                 // Optionally, force a re-fetch or just assume listener is good
            } else {
                const memeCommentsRef = database.ref(`comments/${memeId}`).orderByChild('createdAt').limitToLast(50);
                const listenerCallback = snapshot => { renderComments(snapshot, commentsListDiv, memeId); };
                const errorCallback = error => { console.error(`Error fetching comments for meme ${memeId}:`, error); if(commentsListDiv) commentsListDiv.innerHTML = '<p style="color:red;">Could not load comments.</p>'; };
                memeCommentsRef.on('value', listenerCallback, errorCallback);
                commentsListeners[memeId] = { ref: memeCommentsRef, listener: listenerCallback, errorCb: errorCallback, isActive: true };
            }
        } else {
            if (commentsListeners[memeId] && commentsListeners[memeId].isActive) {
                commentsListeners[memeId].ref.off('value', commentsListeners[memeId].listener);
                commentsListeners[memeId].isActive = false;
            }
        }
    };

    const renderComments = (snapshot, commentsListDiv, memeIdForCountUpdate) => {
        if (!commentsListDiv) return;
        commentsListDiv.innerHTML = '';
        if (!snapshot.exists() || snapshot.numChildren() === 0) {
            commentsListDiv.innerHTML = '<p>No comments yet. Be the first!</p>';
        } else {
            const commentsArray = [];
            snapshot.forEach(childSnapshot => { commentsArray.push({ id: childSnapshot.key, ...childSnapshot.val() }); });
            commentsArray.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)); // Oldest first

            const fragment = document.createDocumentFragment();
            commentsArray.forEach(comment => {
                const commentDiv = document.createElement('div'); commentDiv.className = 'comment';
                const headerDiv = document.createElement('div'); headerDiv.className = 'comment-header';
                const strong = document.createElement('strong'); strong.textContent = (comment.userName || 'User');
                strong.style.cursor = 'pointer'; strong.onclick = () => navigateToAccountPage(comment.userId);
                const time = document.createElement('span'); time.className = 'comment-timestamp'; time.textContent = ` - ${timeAgo(comment.createdAt)}`;
                headerDiv.appendChild(strong); headerDiv.appendChild(time);
                const p = document.createElement('p'); p.textContent = comment.text;
                commentDiv.appendChild(headerDiv); commentDiv.appendChild(p);
                fragment.appendChild(commentDiv);
            });
            commentsListDiv.appendChild(fragment);
        }
        // Update comment count on the main meme post
        const postElement = document.querySelector(`.meme-post[data-meme-id="${memeIdForCountUpdate}"]`);
        if (postElement) {
            const countDisplay = postElement.querySelector('.comment-count-display');
            if (countDisplay) countDisplay.textContent = snapshot.numChildren();
        }
    };

    const handleAddComment = async (event, memeId) => {
        if (!currentUser) { openModal('auth'); return; }
        const form = event.target;
        const commentTextarea = form.querySelector('textarea[name="commentText"]');
        const commentText = commentTextarea.value.trim();
        if (!commentText) { showInPageNotification("Comment cannot be empty.", "warning"); return; }

        const commentData = {
            text: commentText, userId: currentUser.uid,
            userName: currentUser.displayName || 'Anonymous Commenter', createdAt: serverTimestamp
        };
        showSpinner();
        try {
            await database.ref(`comments/${memeId}`).push(commentData);
            commentTextarea.value = '';
            showInPageNotification("Comment posted!", "success");
            await database.ref(`memes/${memeId}/commentCount`).transaction(count => (count || 0) + 1);
            const memeDataSnap = await database.ref(`memes/${memeId}`).once('value');
            const memeOwnerId = memeDataSnap.val()?.creatorId;
            if (memeOwnerId && memeOwnerId !== currentUser.uid) {
                createNotification(memeOwnerId, 'comment', currentUser.uid, currentUser.displayName || 'Someone',
                                   memeId, `commented: "${commentText.substring(0, 30)}${commentText.length > 30 ? '...' : ''}"`, 'meme');
            }
        } catch (error) {
            console.error("Error posting comment:", error);
            showInPageNotification("Could not post comment: " + error.message, "error");
        } finally {
            hideSpinner();
        }
    };


    // --- Notification Logic ---
    const createNotification = (receivingUserId, type, actorUid, actorName, targetId, messageContent, targetType = 'meme') => {
        if (!receivingUserId || !type || !actorUid || !actorName) { console.warn("Skipping notification: missing params."); return; }
        if (receivingUserId === actorUid && (type === 'like' || type === 'comment' || type === 'favorite' || type === 'follow')) { console.log("Skipping self-notification for action:", type); return; }

        const notificationData = {
            type, actorUid, actorName, targetId, targetType,
            message: messageContent || `${actorName} interacted with your content.`,
            timestamp: serverTimestamp,
            read: false
        };
        database.ref(`user-notifications/${receivingUserId}`).push(notificationData)
            .then(() => console.log("Notification created for", receivingUserId, "Type:", type))
            .catch(err => console.error("Error creating notification:", err));
    };
    const updateNotificationBadge = (count) => {
        unreadNotificationCount = count;
        if (notificationBadge) {
            if (count > 0) {
                notificationBadge.textContent = count > 9 ? '9+' : count.toString();
                notificationBadge.classList.remove('hidden');
                if (!notificationBadge.classList.contains('popping')) {
                    notificationBadge.classList.add('popping');
                    setTimeout(() => notificationBadge.classList.remove('popping'), 300);
                }
            } else {
                notificationBadge.classList.add('hidden');
            }
        }
    };
    const listenToUserNotifications = (userId) => {
        if (userNotificationsListener && currentUser?.uid === userId && userId) return;
        if (userNotificationsListener && currentUser?.uid && currentUser.uid !== userId && userId) {
            database.ref(`user-notifications/${currentUser.uid}`).off('value', userNotificationsListener);
        }
        if (!userId) return; // Don't attach if no userId
        const userNotificationsRef = database.ref(`user-notifications/${userId}`).orderByChild('timestamp').limitToLast(25);
        userNotificationsListener = userNotificationsRef.on('value', snapshot => {
            let unread = 0;
            const notifications = [];
            snapshot.forEach(childSnap => {
                const notif = { id: childSnap.key, ...childSnap.val() };
                notifications.unshift(notif);
                if (!notif.read) unread++;
            });
            updateNotificationBadge(unread);
            if (notificationDropdownContainer.querySelector('.notification-dropdown')) {
                renderNotificationDropdown(notifications);
            }
        }, error => {
            console.error("Error fetching notifications:", error);
        });
    };
    const renderNotificationDropdown = (notifications) => {
        let dropdown = notificationDropdownContainer.querySelector('.notification-dropdown');
        if (!dropdown) return;
        dropdown.innerHTML = '';
        if (notifications.length === 0) {
            dropdown.innerHTML = '<div class="no-notifications">No new notifications.</div>';
            return;
        }
        const fragment = document.createDocumentFragment();
        notifications.forEach(notif => {
            const item = document.createElement('div');
            item.className = `notification-item ${!notif.read ? 'unread' : ''}`;
            item.dataset.notificationId = notif.id;
            item.setAttribute('tabindex', '0');
            item.innerHTML = `<span class="notification-message">${notif.message || `${notif.actorName} performed an action.`}</span>
                              <span class="notification-timestamp">${timeAgo(notif.timestamp)}</span>`;
            item.addEventListener('click', () => handleNotificationClick(notif));
            item.addEventListener('keydown', (e) => { if(e.key === 'Enter' || e.key === ' ') handleNotificationClick(notif); });
            fragment.appendChild(item);
        });
        dropdown.appendChild(fragment);
    };
    const handleNotificationClick = (notification) => {
        if (!notification.read && currentUser) {
            database.ref(`user-notifications/${currentUser.uid}/${notification.id}/read`).set(true)
                .catch(err => console.warn("Could not mark notification as read:", err));
        }
        closeNotificationDropdown();
        if (notification.targetType === 'meme' && notification.targetId) {
            const targetMeme = allMemes.find(m => m.id === notification.targetId);
            if (targetMeme) { openMemeDetail(targetMeme); }
            else {
                database.ref(`memes/${notification.targetId}`).once('value').then(snap => {
                    if(snap.exists()) openMemeDetail({id: snap.key, ...snap.val()});
                    else showInPageNotification("The related meme could not be found.", "warning");
                });
            }
        } else if (notification.targetType === 'user' && notification.actorUid) {
            navigateToAccountPage(notification.actorUid);
        }
    };
    const closeNotificationDropdown = () => {
        const dropdown = notificationDropdownContainer.querySelector('.notification-dropdown');
        if (dropdown) {
            dropdown.remove();
            notificationsBtn?.setAttribute('aria-expanded', 'false');
        }
    };

    // --- Context Menu (Post Options) ---
    const togglePostOptionsMenu = (meme, buttonElement) => {
        closeActiveContextMenu();
        if (!currentUser || currentUser.uid !== meme.creatorId) return;
        const rect = buttonElement.getBoundingClientRect();
        const menu = document.createElement('div'); menu.className = 'context-menu';
        menu.style.top = `${rect.bottom + window.scrollY + 5}px`;
        if (rect.left + 150 > window.innerWidth) { menu.style.right = `${window.innerWidth - rect.right - window.scrollX}px`; }
        else { menu.style.left = `${rect.left + window.scrollX}px`; }
        const editButton = document.createElement('button'); editButton.textContent = 'Edit Description';
        editButton.onclick = () => { openModal('editMeme', { meme }); closeActiveContextMenu(); }; menu.appendChild(editButton);
        const deleteButton = document.createElement('button'); deleteButton.textContent = 'Delete Meme'; deleteButton.className = 'delete-option';
        deleteButton.onclick = () => { handleDeleteMeme(meme.id); closeActiveContextMenu(); }; menu.appendChild(deleteButton);
        document.body.appendChild(menu); activeContextMenu = menu;
        setTimeout(() => { document.addEventListener('click', handleClickOutsideContextMenu, { once: true }); }, 0);
    };
    const closeActiveContextMenu = () => { if (activeContextMenu) { activeContextMenu.remove(); activeContextMenu = null; document.removeEventListener('click', handleClickOutsideContextMenu); } };
    const handleClickOutsideContextMenu = (event) => { if (activeContextMenu && !activeContextMenu.contains(event.target) && !event.target.closest('.post-options-button')) { closeActiveContextMenu(); } else if (activeContextMenu) { document.addEventListener('click', handleClickOutsideContextMenu, { once: true }); } };
    const handleDeleteMeme = (memeId) => {
        if (!currentUser) return;
        const memeToDelete = allMemes.find(m => m.id === memeId);
        if (!memeToDelete || memeToDelete.creatorId !== currentUser.uid) { showInPageNotification("You can only delete your own memes.", "error"); return; }
        if (confirm("Are you sure you want to delete this meme? This cannot be undone.")) {
            showSpinner();
            const updates = {};
            updates[`/memes/${memeId}`] = null;
            updates[`/comments/${memeId}`] = null;
            // Also remove from user-favorites of all users who favorited it. This is complex client-side.
            // For now, we'll just delete the meme. Favorited lists might point to a non-existent meme.
            // A Cloud Function would be better for thorough cleanup.
            database.ref().update(updates)
                .then(() => { showInPageNotification("Meme deleted successfully.", "success"); })
                .catch(err => { console.error("Error deleting meme:", err); showInPageNotification("Failed to delete: " + err.message, "error"); })
                .finally(hideSpinner);
        }
    };

    // --- Feed Management & Rendering ---
    const setActiveFeedTab = (feedName) => {
        document.querySelectorAll('.feed-tabs .feed-tab-btn').forEach(btn => {
            btn.classList.remove('active'); btn.setAttribute('aria-selected', 'false');
            if (btn.dataset.feed === feedName) { btn.classList.add('active'); btn.setAttribute('aria-selected', 'true'); memeGalleryPanel?.setAttribute('aria-labelledby', btn.id); }
        });
        activeFeed = feedName;
    };
    const getFollowingFeedMemes = async (baseMemesToFilter) => {
        if (!currentUser || !userFollowData.following) return [];
        const followedUserIds = Object.keys(userFollowData.following);
        if (followedUserIds.length === 0) return [];
        return baseMemesToFilter.filter(meme => followedUserIds.includes(meme.creatorId)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    };
    const getUserFavoritesFeedMemes = async (baseMemesToFilter, userIdForFavorites) => {
        if (!userIdForFavorites) return [];
        const userFavs = userIdForFavorites === currentUser?.uid ? userFollowData.favorites : (await database.ref(`user-favorites/${userIdForFavorites}`).once('value')).val();
        if (!userFavs) return [];
        const favoritedMemeIds = Object.keys(userFavs);
        if (favoritedMemeIds.length === 0) return [];
        let favoriteMemes = baseMemesToFilter.filter(meme => favoritedMemeIds.includes(meme.id));
        const foundIds = new Set(favoriteMemes.map(m => m.id));
        const missingIds = favoritedMemeIds.filter(id => !foundIds.has(id));
        if (missingIds.length > 0) {
            const missingPromises = missingIds.map(id => database.ref(`memes/${id}`).once('value').then(s => s.exists() ? {id: s.key, ...s.val()} : null));
            const fetchedMissing = (await Promise.all(missingPromises)).filter(Boolean);
            favoriteMemes = favoriteMemes.concat(fetchedMissing);
        }
        return favoriteMemes.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    };
    const renderGalleryForCurrentFeed = async () => {
        if (currentVisibleView !== galleryView) return;
        showSpinner();
        let memesToDisplay = [];
        const searchTerm = searchBar.value.toLowerCase().trim();
        let baseMemes = [...allMemes];
        if (searchTerm) {
            baseMemes = allMemes.filter(meme => (meme.description && meme.description.toLowerCase().includes(searchTerm)) || (meme.creatorName && meme.creatorName.toLowerCase().includes(searchTerm)));
        }
        try {
            switch (activeFeed) {
                case 'new': memesToDisplay = [...baseMemes].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); break;
                case 'following': if (currentUser) memesToDisplay = await getFollowingFeedMemes(baseMemes); else showInPageNotification("Login to see your following feed.", "info"); break;
                case 'favorites': if (currentUser) memesToDisplay = await getUserFavoritesFeedMemes(baseMemes, currentUser.uid); else showInPageNotification("Login to see your favorites.", "info"); break;
                case 'for-you': default: memesToDisplay = [...baseMemes].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); break;
            }
        } catch (error) { console.error(`Error preparing feed ${activeFeed}:`, error); showInPageNotification(`Could not load ${activeFeed.replace('-', ' ')} feed.`, "error"); }
        currentFeedMemes = memesToDisplay;
        renderGallery(currentFeedMemes, 'meme-gallery');
        hideSpinner();
    };
    const switchFeed = (feedName) => {
        setActiveFeedTab(feedName);
        renderGalleryForCurrentFeed();
        showInPageNotification(`Switched to "${feedName.replace(/-/g, ' ')}" feed.`, 'info', 1500);
    };
    const applySearchFilter = () => { if (currentVisibleView === galleryView) renderGalleryForCurrentFeed(); };

    // --- Account Page Management ---
    const navigateToAccountPage = (userId) => { if (!userId) return; currentAccountPageUserId = userId; switchMainView(accountView); loadAccountPage(userId); window.location.hash = `#/user/${userId}`; };
    const loadAccountPage = async (userId) => {
        if (!userId || !accountView) return; showSpinner();
        accountPhotoEl.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; accountDisplayNameEl.textContent = 'Loading...'; accountEmailEl.textContent = ''; accountEmailEl.classList.add('hidden'); accountMemeCountStatEl.textContent = 'Memes: ...'; accountFollowerCountStatEl.textContent = 'Followers: ...'; accountFollowingCountStatEl.textContent = 'Following: ...'; accountFollowUnfollowBtn.classList.add('hidden'); accountEditProfileBtn.classList.add('hidden');
        try {
            const userSnap = await database.ref(`users/${userId}`).once('value'); const userData = userSnap.val();
            if (!userData) { accountDisplayNameEl.textContent = 'User Not Found'; hideSpinner(); return; }
            accountPhotoEl.src = userData.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(userData.displayName || 'User')}&fontSize=36`; accountDisplayNameEl.textContent = userData.displayName || 'Anonymous User';
            if (currentUser && currentUser.uid === userId && userData.email) { accountEmailEl.textContent = userData.email; accountEmailEl.classList.remove('hidden'); }
            if (currentUser) { if (currentUser.uid === userId) accountEditProfileBtn.classList.remove('hidden'); else { accountFollowUnfollowBtn.classList.remove('hidden'); accountFollowUnfollowBtn.dataset.targetUserId = userId; await checkAndSetFollowButtonState(userId, accountFollowUnfollowBtn); } }
            const [memeCountSnap, followerCountSnap, followingCountSnap] = await Promise.all([database.ref('memes').orderByChild('creatorId').equalTo(userId).once('value'), database.ref(`followers/${userId}`).once('value'), database.ref(`following/${userId}`).once('value')]);
            accountMemeCountStatEl.textContent = `Memes: ${memeCountSnap.numChildren()}`; accountFollowerCountStatEl.textContent = `Followers: ${followerCountSnap.numChildren()}`; accountFollowingCountStatEl.textContent = `Following: ${followingCountSnap.numChildren()}`;
            const defaultAccountTabBtn = document.getElementById('account-tab-memes'); setActiveAccountTab('account-memes-content', defaultAccountTabBtn);
        } catch (error) { console.error(`Error loading account page for ${userId}:`, error); accountDisplayNameEl.textContent = 'Error Loading Profile'; showInPageNotification('Could not load profile.', 'error');
        } finally { hideSpinner(); }
    };
    const setActiveAccountTab = (tabContentId, clickedTabBtn) => {
        document.querySelectorAll('#account-view .account-tab-content').forEach(content => content.classList.remove('active')); document.querySelectorAll('#account-view .account-tabs .tab-btn').forEach(btn => { btn.classList.remove('active'); btn.setAttribute('aria-selected', 'false'); });
        const targetContentEl = document.getElementById(tabContentId); if (targetContentEl) { targetContentEl.classList.add('active'); activeAccountTab = tabContentId; } if (clickedTabBtn) { clickedTabBtn.classList.add('active'); clickedTabBtn.setAttribute('aria-selected', 'true'); }
        loadContentForActiveAccountTab();
    };
    const loadContentForActiveAccountTab = () => {
        if (!currentAccountPageUserId || !activeAccountTab) return; showSpinner();
        switch (activeAccountTab) {
            case 'account-memes-content': loadUserMemes(currentAccountPageUserId).finally(hideSpinner); break;
            case 'account-favorites-content': loadUserFavorites(currentAccountPageUserId).finally(hideSpinner); break;
            case 'account-followers-content': loadUserFollowList(currentAccountPageUserId, 'followers').finally(hideSpinner); break;
            case 'account-following-content': loadUserFollowList(currentAccountPageUserId, 'following').finally(hideSpinner); break;
            default: hideSpinner();
        }
    };
    const loadUserMemes = async (userId) => {
        if (!userId) return; const galleryEl = accountMemeGallery; if(galleryEl) galleryEl.innerHTML = '<p>Loading memes...</p>'; else return;
        try {
            let userMemesResult = allMemes.filter(m => m.creatorId === userId);
            if (userMemesResult.length === 0 && allMemes.length > 0) { const snapshot = await database.ref('memes').orderByChild('creatorId').equalTo(userId).once('value'); userMemesResult = []; snapshot.forEach(childSnap => userMemesResult.push({ id: childSnap.key, ...childSnap.val() })); }
            renderGallery(userMemesResult.sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0)), galleryEl.id);
        } catch (error) { console.error(`Error loading memes for user ${userId}:`, error); if(galleryEl) galleryEl.innerHTML = '<p>Could not load user memes.</p>'; }
    };
    const loadUserFavorites = async (userIdToLoadFavoritesFor) => {
        if (!userIdToLoadFavoritesFor) return; const galleryEl = accountFavoritesGallery; if(galleryEl) galleryEl.innerHTML = '<p>Loading favorites...</p>'; else return;
        try {
            const userFavsData = (currentUser && userIdToLoadFavoritesFor === currentUser.uid) ? userFollowData.favorites : (await database.ref(`user-favorites/${userIdToLoadFavoritesFor}`).once('value')).val();
            const favoritedMemeIds = userFavsData ? Object.keys(userFavsData) : [];
            if (favoritedMemeIds.length === 0) { if(galleryEl) galleryEl.innerHTML = '<p>No favorite memes yet.</p>'; return; }
            let favoriteMemes = allMemes.filter(m => favoritedMemeIds.includes(m.id)); const foundIds = new Set(favoriteMemes.map(m => m.id)); const missingIds = favoritedMemeIds.filter(id => !foundIds.has(id));
            if (missingIds.length > 0) { const missingPromises = missingIds.map(id => database.ref(`memes/${id}`).once('value').then(s => s.exists() ? {id: s.key, ...s.val()} : null)); const fetchedMissing = (await Promise.all(missingPromises)).filter(Boolean); favoriteMemes = favoriteMemes.concat(fetchedMissing); }
            renderGallery(favoriteMemes.sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0)), galleryEl.id);
        } catch (error) { console.error(`Error loading favorites for user ${userIdToLoadFavoritesFor}:`, error); if(galleryEl) galleryEl.innerHTML = '<p>Could not load favorites.</p>'; }
    };
    const loadUserFollowList = async (targetUserId, listType) => {
        const containerId = listType === 'followers' ? 'account-followers-content' : 'account-following-content'; const containerEl = document.getElementById(containerId); if(!containerEl) return; containerEl.innerHTML = `<p>Loading ${listType}...</p>`;
        const path = listType === 'followers' ? `followers/${targetUserId}` : `following/${targetUserId}`;
        try {
            const listSnap = await database.ref(path).once('value'); const userIds = listSnap.val() ? Object.keys(listSnap.val()) : [];
            if (userIds.length === 0) { containerEl.innerHTML = `<p>No ${listType} found.</p>`; return; }
            const userPromises = userIds.map(uid => database.ref(`users/${uid}`).once('value')); const userSnaps = await Promise.all(userPromises);
            containerEl.innerHTML = ''; const fragment = document.createDocumentFragment();
            userSnaps.forEach(userSnap => {
                if (userSnap.exists()) {
                    const userData = userSnap.val(); const userId = userSnap.key;
                    const item = document.createElement('div'); item.className = 'user-list-item'; item.dataset.userId = userId;
                    const avatar = document.createElement('img'); avatar.className = 'user-list-avatar'; avatar.src = userData.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(userData.displayName || 'User')}&fontSize=36`; avatar.alt = `${userData.displayName || 'User'}'s avatar`;
                    const nameLink = document.createElement('a'); nameLink.className = 'user-list-name'; nameLink.href = `#/user/${userId}`; nameLink.textContent = userData.displayName || 'Anonymous User'; nameLink.onclick = (e) => { e.preventDefault(); navigateToAccountPage(userId); };
                    item.appendChild(avatar); item.appendChild(nameLink);
                    if (currentUser && currentUser.uid !== userId) { const followBtn = document.createElement('button'); followBtn.className = 'follow-action-btn nav-button'; followBtn.dataset.userId = userId; checkAndSetFollowButtonState(userId, followBtn); followBtn.addEventListener('click', (e) => { e.stopPropagation(); handleFollowToggle(userId, e.currentTarget); }); item.appendChild(followBtn); }
                    fragment.appendChild(item);
                }
            });
            containerEl.appendChild(fragment);
        } catch (error) { console.error(`Error loading ${listType} for ${targetUserId}:`, error); containerEl.innerHTML = `<p>Could not load ${listType}.</p>`; }
    };

    // --- Follow/Unfollow Logic ---
    const loadUserFollowData = async (userId) => {
        if (!userId) { userFollowData = { following: {}, followers: {}, favorites: {}, settings: { theme: 'vaporwave', emailNotifications: false } }; return; }
        try {
            const [followingSnap, followersSnap, favoritesSnap, settingsSnap] = await Promise.all([
                database.ref(`following/${userId}`).once('value'),
                database.ref(`followers/${userId}`).once('value'),
                database.ref(`user-favorites/${userId}`).once('value'),
                database.ref(`users/${userId}/settings`).once('value')
            ]);
            userFollowData.following = followingSnap.val() || {};
            userFollowData.followers = followersSnap.val() || {}; // For counts or direct use
            userFollowData.favorites = favoritesSnap.val() || {};
            userFollowData.settings = settingsSnap.val() || { theme: localStorage.getItem('theme') || 'vaporwave', emailNotifications: false }; // Load settings or default

            initTheme(); // Apply loaded/default theme

            // Refresh relevant parts of UI
            if (currentVisibleView === galleryView) renderGalleryForCurrentFeed();
            else if (currentVisibleView === accountView && currentAccountPageUserId) {
                 loadAccountPage(currentAccountPageUserId); // This will refresh follow buttons and favorite status on memes if account is current user's
            }
        } catch (error) { console.error("Error loading user follow/favorites/settings data:", error); }
    };
    const handleFollowToggle = async (targetUserId, buttonElement) => {
        if (!currentUser || !targetUserId || currentUser.uid === targetUserId) { if(!currentUser) openModal('auth'); return; }
        showSpinner(); const currentUid = currentUser.uid; const isCurrentlyFollowing = !!userFollowData.following[targetUserId];
        const updates = {};
        if (isCurrentlyFollowing) { updates[`/following/${currentUid}/${targetUserId}`] = null; updates[`/followers/${targetUserId}/${currentUid}`] = null; delete userFollowData.following[targetUserId]; }
        else { updates[`/following/${currentUid}/${targetUserId}`] = true; updates[`/followers/${targetUserId}/${currentUid}`] = true; userFollowData.following[targetUserId] = true; }
        try {
            await database.ref().update(updates);
            if (buttonElement) checkAndSetFollowButtonState(targetUserId, buttonElement);
            document.querySelectorAll(`.follow-creator-btn[data-user-id="${targetUserId}"], .follow-action-btn[data-user-id="${targetUserId}"]`).forEach(btn => { if (btn !== buttonElement) checkAndSetFollowButtonState(targetUserId, btn); });
            if (currentVisibleView === accountView && (currentAccountPageUserId === currentUid || currentAccountPageUserId === targetUserId)) {
                const displayedUserId = currentAccountPageUserId;
                const [newFollowerCount, newFollowingCount] = await Promise.all([database.ref(`followers/${displayedUserId}`).once('value').then(s => s.numChildren()), database.ref(`following/${displayedUserId}`).once('value').then(s => s.numChildren())]);
                if(accountFollowerCountStatEl && currentAccountPageUserId === displayedUserId) accountFollowerCountStatEl.textContent = `Followers: ${newFollowerCount}`; // Update only if current user or target user's page is viewed
                if(accountFollowingCountStatEl && currentAccountPageUserId === displayedUserId) accountFollowingCountStatEl.textContent = `Following: ${newFollowingCount}`;
            }
            if (!isCurrentlyFollowing) { createNotification(targetUserId, 'follow', currentUser.uid, currentUser.displayName || 'Someone', null, `${currentUser.displayName || 'Someone'} started following you.`, 'user'); }
            showInPageNotification(isCurrentlyFollowing ? `Unfollowed ${buttonElement.previousSibling?.textContent || 'user'}.` : `Now following ${buttonElement.previousSibling?.textContent || 'user'}.`, 'success');
        } catch (error) {
            console.error("Error toggling follow state:", error); showInPageNotification("Could not update follow status: " + error.message, "error");
            if (isCurrentlyFollowing) userFollowData.following[targetUserId] = true; else delete userFollowData.following[targetUserId]; // Revert cache
            if (buttonElement) checkAndSetFollowButtonState(targetUserId, buttonElement); // Revert button
        } finally { hideSpinner(); }
    };
    const checkAndSetFollowButtonState = (targetUserId, buttonElement) => {
        if (!buttonElement || !currentUser || currentUser.uid === targetUserId) { if(buttonElement) buttonElement.classList.add('hidden'); return; }
        buttonElement.classList.remove('hidden');
        const isFollowing = userFollowData.following && userFollowData.following[targetUserId];
        buttonElement.textContent = isFollowing ? 'Unfollow' : 'Follow';
        buttonElement.classList.toggle('following', !!isFollowing);
    };
    const handleFavoriteToggle = async (memeId, buttonElement) => {
        if (!currentUser || !memeId) { if(!currentUser) openModal('auth'); return; }
        showSpinner(); const currentUid = currentUser.uid; const isCurrentlyFavorited = !!(userFollowData.favorites && userFollowData.favorites[memeId]);
        const updates = {}; updates[`/user-favorites/${currentUid}/${memeId}`] = isCurrentlyFavorited ? null : true;
        try {
            await database.ref().update(updates); // Update user-favorites list
            await database.ref(`memes/${memeId}`).transaction(memeData => { // Update meme's count and internal list
                if (memeData) {
                    memeData.favorites = memeData.favorites || {}; memeData.favoriteCount = typeof memeData.favoriteCount === 'number' ? memeData.favoriteCount : 0;
                    if (isCurrentlyFavorited) { if (memeData.favorites[currentUid]) { memeData.favoriteCount = Math.max(0, memeData.favoriteCount - 1); delete memeData.favorites[currentUid]; } }
                    else { if (!memeData.favorites[currentUid]) { memeData.favoriteCount++; memeData.favorites[currentUid] = true; if (memeData.creatorId && memeData.creatorId !== currentUid) { memeData._pendingNotification = { type: 'favorite', memeOwnerId: memeData.creatorId, memeId: memeId }; } } }
                } return memeData;
            }, (error, committed, snapshot) => {
                 if (error) { console.error(`Meme Favorite transaction error:`, error); }
                 else if (committed) { const updatedMeme = snapshot.val(); if (updatedMeme?._pendingNotification) { const ni = updatedMeme._pendingNotification; createNotification(ni.memeOwnerId, 'favorite', currentUid, currentUser.displayName||'Someone', ni.memeId, 'favorited your meme.', 'meme'); database.ref(`memes/${memeId}/_pendingNotification`).remove();}}
            });
            if (isCurrentlyFavorited) delete userFollowData.favorites[memeId]; else userFollowData.favorites[memeId] = true; // Update local cache
            if (buttonElement) { buttonElement.classList.toggle('favorited', !isCurrentlyFavorited); buttonElement.title = isCurrentlyFavorited ? "Favorite" : "Unfavorite"; const svg = buttonElement.querySelector('svg'); if(svg) svg.style.fill = !isCurrentlyFavorited ? 'var(--favorite-color)' : 'none'; }
            if (currentVisibleView === galleryView && activeFeed === 'favorites') { renderGalleryForCurrentFeed(); }
            else if (currentVisibleView === accountView && activeAccountTab === 'account-favorites-content' && currentAccountPageUserId === currentUid) { loadUserFavorites(currentUid); }
            showInPageNotification(isCurrentlyFavorited ? 'Removed from favorites.' : 'Added to favorites!', 'success');
        } catch (error) {
            console.error("Error toggling favorite state:", error); showInPageNotification("Could not update favorite: " + error.message, "error");
            if (isCurrentlyFavorited) userFollowData.favorites[memeId] = true; else delete userFollowData.favorites[memeId]; // Revert cache
            if (buttonElement) { buttonElement.classList.toggle('favorited', isCurrentlyFavorited); buttonElement.title = isCurrentlyFavorited ? "Unfavorite" : "Favorite"; const svg = buttonElement.querySelector('svg'); if(svg) svg.style.fill = isCurrentlyFavorited ? 'var(--favorite-color)' : 'none';} // Revert button
        } finally { hideSpinner(); }
    };

    // --- Auth State Change Handler ---
    auth.onAuthStateChanged(user => {
        console.log("Auth state changed. User:", user ? user.uid : null);
        const previousUserUid = currentUser?.uid;
        // currentUser = user; // This is set inside updateUIForAuthState
        updateUIForAuthState(user); // This also calls loadUserFollowData

        if (user && !previousUserUid) { // Just logged in
            loadInitialData(true); // User context is now available for feeds
        } else if (!user && previousUserUid) { // Just logged out
            if (currentVisibleView === accountView || (currentVisibleView === galleryView && (activeFeed === 'favorites' || activeFeed === 'following'))) {
                window.location.hash = ''; switchMainView(galleryView); setActiveFeedTab('for-you'); renderGalleryForCurrentFeed();
            }
            currentAccountPageUserId = null;
        } else if (!user && !previousUserUid) { // Initial load, no user determined yet
            loadInitialData(false); // Load public data
        } else if (user && previousUserUid && user.uid === previousUserUid) { // User session refreshed
            // Re-check follow data in case it changed in another tab, or just rely on listeners
            loadUserFollowData(user.uid).then(() => {
                 if (currentVisibleView === galleryView) renderGalleryForCurrentFeed();
                 else if (currentVisibleView === accountView && currentAccountPageUserId) loadAccountPage(currentAccountPageUserId);
            });
        }
    });

    // --- Event Listeners ---
    homeLink?.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = ''; switchMainView(galleryView); setActiveFeedTab('for-you'); if(searchBar) searchBar.value = ''; renderGalleryForCurrentFeed(); });
    myAccountBtn?.addEventListener('click', () => { if (currentUser) navigateToAccountPage(currentUser.uid); else openModal('auth'); });
    feedTabsContainer?.addEventListener('click', (e) => { const b = e.target.closest('.feed-tab-btn'); if (b) { const fN = b.dataset.feed; if (fN) { if ((fN==='following'||fN==='favorites')&&!currentUser) {openModal('auth');return;} switchMainView(galleryView); switchFeed(fN);}}});
    accountTabsContainer?.addEventListener('click', (e) => { const b = e.target.closest('.tab-btn'); if (b) { const tId = b.dataset.tabTarget; if (tId) setActiveAccountTab(tId, b);}});
    accountFollowUnfollowBtn?.addEventListener('click', (e) => { const tId = e.currentTarget.dataset.targetUserId; if (tId) handleFollowToggle(tId, e.currentTarget); });
    accountEditProfileBtn?.addEventListener('click', () => { openModal('settings'); /* Or a dedicated edit profile modal */ });
    loginPromptBtn?.addEventListener('click', () => openModal('auth'));
    uploadBtn?.addEventListener('click', () => { if(currentUser) openModal('upload'); else openModal('auth');});
    settingsBtn?.addEventListener('click', () => openModal('settings'));
    themeSelector?.addEventListener('change', (e) => { const nt = e.target.value; document.body.setAttribute('data-theme', nt); localStorage.setItem('theme', nt); const smts = document.querySelector('#settingsFormModal #settingThemeModal'); if(smts)smts.value=nt; if(currentUser && userFollowData.settings) { userFollowData.settings.theme = nt; database.ref(`users/${currentUser.uid}/settings/theme`).set(nt).catch(console.warn);}});
    searchBar?.addEventListener('input', applySearchFilter);
    notificationsBtn?.addEventListener('click', (e) => { e.stopPropagation(); const dr = notificationDropdownContainer.querySelector('.notification-dropdown'); if(dr){closeNotificationDropdown();}else{if(!currentUser){showInPageNotification("Login to see notifications.","info");return;} const nd=document.createElement('div');nd.className='notification-dropdown';nd.setAttribute('aria-label','Notifications List');nd.innerHTML='<p style="text-align:center;padding:10px;">Loading...</p>';notificationDropdownContainer.appendChild(nd);notificationsBtn.setAttribute('aria-expanded','true');database.ref(`user-notifications/${currentUser.uid}`).orderByChild('timestamp').limitToLast(20).once('value').then(s=>{const nlist=[];s.forEach(cs=>nlist.unshift({id:cs.key,...cs.val()}));renderNotificationDropdown(nlist);}).catch(err=>{console.error(err);if(nd)nd.innerHTML='<p style="color:var(--error-color);text-align:center;padding:10px;">Error.</p>';});}});
    document.body.addEventListener('click', (e) => { if (notificationDropdownContainer && !notificationDropdownContainer.contains(e.target) && e.target !== notificationsBtn && !notificationsBtn?.contains(e.target)) { closeNotificationDropdown(); } if (activeContextMenu && !activeContextMenu.contains(e.target) && !e.target.closest('.post-options-button')) { closeActiveContextMenu(); }});

    // --- Hash-based Routing ---
    const handleHashChange = () => {
        closeActiveContextMenu(); closeNotificationDropdown(); const hash = window.location.hash;
        if (hash.startsWith('#/user/')) { const userId = hash.substring('#/user/'.length); if (userId) { if (userId !== currentAccountPageUserId || currentVisibleView !== accountView) { navigateToAccountPage(userId); } } }
        else if (hash.startsWith('#/meme/')) { const memeId = hash.substring('#/meme/'.length); const foundMeme = allMemes.find(m => m.id === memeId); if (foundMeme) { openMemeDetail(foundMeme); } else { database.ref(`memes/${memeId}`).once('value').then(s => { if (s.exists()) openMemeDetail({ id: s.key, ...s.val() }); else { showInPageNotification("Meme not found.", "warning"); if (currentVisibleView !== galleryView) { window.location.hash = ''; switchMainView(galleryView); } } }); } }
        else { if (currentVisibleView !== galleryView) { switchMainView(galleryView); if(!currentUser && (activeFeed === 'following' || activeFeed === 'favorites')){ setActiveFeedTab('for-you'); } renderGalleryForCurrentFeed(); } }
    };
    window.addEventListener('hashchange', handleHashChange);

    // --- Initial Load Function ---
    let initialDataLoaded = false;
    const loadInitialData = (isUserContextKnown = false) => { // isUserContextKnown is true after first auth check
        if(initialDataLoaded && !isUserContextKnown) return; // Avoid redundant full loads if memes listener handles updates
        showSpinner();
        if(!initialDataLoaded) initTheme();

        database.ref('memes').on('value', snapshot => {
            allMemes = []; const memesData = snapshot.val() || {};
            for (const key in memesData) { allMemes.push({ id: key, ...memesData[key] }); }
            console.log("All memes updated/fetched:", allMemes.length);

            if (!initialDataLoaded || isUserContextKnown) {
                if (!window.location.hash && currentVisibleView === galleryView) { // Default to gallery if no hash
                    setActiveFeedTab(currentUser ? activeFeed : 'for-you'); // Keep user's feed or default to public
                    renderGalleryForCurrentFeed();
                } else {
                    handleHashChange(); // Process hash now that memes (and user state) are known
                }
                initialDataLoaded = true;
            } else { // Subsequent meme updates from the listener
                if (currentVisibleView === galleryView) renderGalleryForCurrentFeed();
                else if (currentVisibleView === accountView) {
                     if (activeAccountTab === 'account-memes-content' && currentAccountPageUserId) loadUserMemes(currentAccountPageUserId);
                     else if (activeAccountTab === 'account-favorites-content' && currentAccountPageUserId) loadUserFavorites(currentAccountPageUserId);
                }
            }
            hideSpinner();
        }, error => {
            console.error("Error fetching initial memes:", error);
            if(memeGallery) memeGallery.innerHTML = '<p style="color:red;">Could not load memes.</p>';
            hideSpinner();
        });
    };

    // Initial theme setup, auth listener will trigger main data load.
    initTheme();
    console.log("MemeDrop App: Structure Initialized. Waiting for Firebase auth.");
}); // End DOMContentLoaded
