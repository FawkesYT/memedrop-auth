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
    let userFollowData = { following: {}, followers: {}, favorites: {} };

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
        const notification = document.createElement('div');
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
            if (notification.parentElement) {
                notification.style.opacity = '0';
                notification.style.transform = 'translateX(120%)';
                notification.addEventListener('transitionend', () => notification.remove(), { once: true });
            }
        }, duration);
    };

    const timeAgo = (timestamp) => {
        if (!timestamp) return 'a while ago';
        const now = new Date();
        const seconds = Math.round((now - new Date(timestamp)) / 1000);
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
        const years = Math.round(days / 365);
        return `${years}y ago`;
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
        if (!modalContainer) {
            console.error("Modal container not found!");
            return;
        }
        modalContainer.innerHTML = ''; // Clear previous modal
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
                                    <label for="memeFileModal">Choose image/gif:</label>
                                    <input type="file" id="memeFileModal" name="memeFileModal" accept="image/*,image/gif" required>
                                    <label for="memeDescriptionModal">Description:</label>
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
                                    <label for="editMemeDescriptionModal">Description:</label>
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
                 const currentTheme = localStorage.getItem('theme') || 'vaporwave';
                 const isEmailNotificationsChecked = currentUser && userFollowData.settings && userFollowData.settings.emailNotifications ? 'checked' : '';
                 modalHTML = `<div class="modal-content"><h2>Settings</h2>
                                <form id="settingsForm">
                                    <div>
                                        <label for="settingThemeModal">Preferred Theme:</label>
                                        <select id="settingThemeModal" name="theme">
                                            <option value="light" ${currentTheme === 'light' ? 'selected' : ''}>Light</option>
                                            <option value="dark" ${currentTheme === 'dark' ? 'selected' : ''}>Dark</option>
                                            <option value="vaporwave" ${currentTheme === 'vaporwave' ? 'selected' : ''}>Vaporwave</option>
                                            <option value="synthwave84" ${currentTheme === 'synthwave84' ? 'selected' : ''}>Synthwave '84</option>
                                            <option value="forest" ${currentTheme === 'forest' ? 'selected' : ''}>Forest Whisper</option>
                                            <option value="ocean" ${currentTheme === 'ocean' ? 'selected' : ''}>Ocean Deep</option>
                                            <option value="sunset" ${currentTheme === 'sunset' ? 'selected' : ''}>Sunset Glow</option>
                                            <option value="monochrome" ${currentTheme === 'monochrome' ? 'selected' : ''}>Monochrome</option>
                                        </select>
                                    </div>
                                    <div style="margin-top: 15px; text-align:left;">
                                        <input type="checkbox" id="settingEmailNotificationsModal" name="emailNotifications" ${isEmailNotificationsChecked}>
                                        <label for="settingEmailNotificationsModal" class="checkbox-label">Receive Email Notifications (placeholder)</label>
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
            modalOverlayElement.style.animation = 'fadeOut 0.3s forwards';
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
            for(const mutation of mutationsList) {
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
                                displayName: user.displayName || (userSnap.exists() ? userSnap.val().displayName : 'Meme Lover'),
                                photoURL: user.photoURL || (userSnap.exists() ? userSnap.val().photoURL : null)
                            };
                            if (!userSnap.exists()) {
                                updates.email = user.email;
                                updates.createdAt = serverTimestamp;
                                updates.settings = { theme: 'vaporwave', emailNotifications: false }; // Default settings
                                await userRef.set(updates);
                            } else {
                                await userRef.update(updates);
                            }
                            closeLogic();
                            showInPageNotification('Login successful!', 'success');
                        }
                    } catch (error) {
                        console.error("signInWithPopup ERROR:", error);
                        showInPageNotification(`Login failed: ${error.message}`, "error");
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
                            if (imageBase64.length > 7 * 1024 * 1024) { hideSpinner(); showInPageNotification("Encoded image data too large.", "error"); return; }

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
                            closeLogic();
                        };
                        reader.readAsDataURL(file);
                    } catch (uploadError) {
                        console.error("Upload error:", uploadError);
                        showInPageNotification(`Upload failed: ${uploadError.message}`, "error");
                    } finally {
                        // Smart hide spinner
                        if (fileInput.value) { /* still processing */ } else { hideSpinner(); }
                    }
                });
                break;
            case 'editMeme':
                const editMemeForm = modalOverlayElement.querySelector('#editMemeForm');
                editMemeForm?.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    if (!currentUser || !modalData || !modalData.meme || currentUser.uid !== modalData.meme.creatorId) {
                        showInPageNotification("You don't have permission to edit this.", "error"); return;
                    }
                    const memeId = editMemeForm.querySelector('#editMemeIdModal').value;
                    const newDescription = editMemeForm.querySelector('#editMemeDescriptionModal').value.trim();
                    if (!newDescription) { showInPageNotification("Description cannot be empty.", "warning"); return; }
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
                const settingsForm = modalOverlayElement.querySelector('#settingsForm');
                // Pre-fill form from userFollowData.settings or localStorage
                const themeInput = settingsForm?.querySelector('#settingThemeModal');
                const emailNotifInput = settingsForm?.querySelector('#settingEmailNotificationsModal');
                if (themeInput) themeInput.value = localStorage.getItem('theme') || 'vaporwave';
                if (emailNotifInput && currentUser && userFollowData.settings) {
                    emailNotifInput.checked = !!userFollowData.settings.emailNotifications;
                }

                settingsForm?.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    if (!currentUser) { showInPageNotification("Please login to save settings.", "error"); return; }
                    const newTheme = themeInput.value;
                    const emailNotifs = emailNotifInput.checked;
                    showSpinner();
                    try {
                        await database.ref(`users/${currentUser.uid}/settings`).set({
                            theme: newTheme,
                            emailNotifications: emailNotifs
                        });
                        // Update local cache and UI
                        if(userFollowData.settings) userFollowData.settings = { theme: newTheme, emailNotifications: emailNotifs };
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
        const prevUid = currentUser?.uid;
        currentUser = user;

        const currentLogoutBtn = document.getElementById('logoutBtn');
        if (currentLogoutBtn) currentLogoutBtn.remove(); // Simpler removal

        if (user) {
            userInfoDiv.innerHTML = `<span title="${user.displayName || 'User'}">${user.displayName || 'User'}!</span> <button id="logoutBtn" class="nav-button">Logout</button>`;
            document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
            userInfoDiv.classList.remove('hidden');
            loginPromptBtn.classList.add('hidden');
            uploadBtn.classList.remove('hidden');
            settingsBtn.classList.remove('hidden');
            myAccountBtn.classList.remove('hidden');
            document.getElementById('feed-following')?.classList.remove('hidden');
            document.getElementById('feed-favorites')?.classList.remove('hidden');

            listenToUserNotifications(user.uid);
            loadUserFollowData(user.uid);
        } else {
            userInfoDiv.classList.add('hidden');
            userInfoDiv.innerHTML = '';
            loginPromptBtn.classList.remove('hidden');
            uploadBtn.classList.add('hidden');
            settingsBtn.classList.add('hidden');
            myAccountBtn.classList.add('hidden');
            document.getElementById('feed-following')?.classList.add('hidden');
            document.getElementById('feed-favorites')?.classList.add('hidden');

            userFollowData = { following: {}, followers: {}, favorites: {} };

            if (userNotificationsListener && prevUid) {
                database.ref(`user-notifications/${prevUid}`).off('value', userNotificationsListener);
                userNotificationsListener = null;
            }
            updateNotificationBadge(0);
            closeNotificationDropdown();
        }

        if (currentVisibleView === galleryView) {
            if ((activeFeed === 'favorites' || activeFeed === 'following') && !user) {
                renderGallery([], 'meme-gallery');
                setActiveFeedTab('for-you');
            } else {
                renderGalleryForCurrentFeed();
            }
        } else if (currentVisibleView === accountView) {
            if (!user) {
                switchMainView(galleryView);
                setActiveFeedTab('for-you');
                renderGalleryForCurrentFeed();
            } else if (currentAccountPageUserId) {
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

    // --- Theme Management ---
    const initTheme = () => {
        const savedTheme = localStorage.getItem('theme') || 'vaporwave';
        document.body.setAttribute('data-theme', savedTheme);
        if(themeSelector) themeSelector.value = savedTheme;
    };


    // --- Meme Rendering, Interaction, Comments (Copied and adapted from previous logic) ---
    // createMemeElement, renderGallery, openMemeDetail, incrementMemeViewCount
    // handleLike, handleDislike
    // toggleComments, renderComments, handleAddComment
    // (Full definitions for these should be here)
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
                const wasLiked = memeData.likes[userUid];
                const wasDisliked = memeData.dislikes[userUid];

                if (actionType === 'like') {
                    if (wasLiked) {
                        memeData.likeCount--;
                        delete memeData.likes[userUid];
                    } else {
                        memeData.likeCount++;
                        memeData.likes[userUid] = true;
                        if (wasDisliked) {
                            memeData.dislikeCount--;
                            delete memeData.dislikes[userUid];
                        }
                        if (memeData.creatorId && memeData.creatorId !== userUid) {
                            memeData._pendingNotification = { type: 'like', memeOwnerId: memeData.creatorId, memeId: memeId };
                        }
                    }
                } else if (actionType === 'dislike') {
                    if (wasDisliked) {
                        memeData.dislikeCount--;
                        delete memeData.dislikes[userUid];
                    } else {
                        memeData.dislikeCount++;
                        memeData.dislikes[userUid] = true;
                        if (wasLiked) {
                            memeData.likeCount--;
                            delete memeData.likes[userUid];
                        }
                        // No notification for dislikes usually
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
                    const {type, memeOwnerId, memeId} = updatedMeme._pendingNotification;
                    createNotification(memeOwnerId, type, currentUser.uid, currentUser.displayName || 'Someone', memeId, `${type}d your meme.`, 'meme');
                    database.ref(`memes/${memeId}/_pendingNotification`).remove();
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

        if (!isHidden) { // Comments are now visible
            commentsListDiv.innerHTML = '<p>Loading comments...</p>';
            if (commentsListeners[memeId] && commentsListeners[memeId].isActive) {
                // Listener already active, maybe force a refresh or just let it update
            } else {
                const memeCommentsRef = database.ref(`comments/${memeId}`).orderByChild('createdAt').limitToLast(50);
                const listenerCallback = snapshot => {
                    renderComments(snapshot, commentsListDiv, memeId); // Pass memeId for comment count update
                };
                const errorCallback = error => {
                    console.error(`Error fetching comments for meme ${memeId}:`, error);
                    if(commentsListDiv) commentsListDiv.innerHTML = '<p style="color:red;">Could not load comments.</p>';
                };
                memeCommentsRef.on('value', listenerCallback, errorCallback);
                commentsListeners[memeId] = { ref: memeCommentsRef, listener: listenerCallback, errorCb: errorCallback, isActive: true };
            }
        } else { // Comments are now hidden
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
            return;
        }
        const commentsArray = [];
        snapshot.forEach(childSnapshot => {
            commentsArray.push({ id: childSnapshot.key, ...childSnapshot.val() });
        });
        commentsArray.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)); // Oldest first, or use .reverse() later

        commentsArray.forEach(comment => {
            const commentDiv = document.createElement('div');
            commentDiv.className = 'comment';
            const headerDiv = document.createElement('div');
            headerDiv.className = 'comment-header';
            const strong = document.createElement('strong');
            strong.textContent = (comment.userName || 'User');
            strong.onclick = () => navigateToAccountPage(comment.userId); // Make username clickable
            const time = document.createElement('span');
            time.className = 'comment-timestamp';
            time.textContent = ` - ${timeAgo(comment.createdAt)}`;
            headerDiv.appendChild(strong);
            headerDiv.appendChild(time);
            const p = document.createElement('p');
            p.textContent = comment.text;
            commentDiv.appendChild(headerDiv);
            commentDiv.appendChild(p);
            commentsListDiv.appendChild(commentDiv);
        });

        // Update comment count on the meme post itself
        const postElement = document.querySelector(`.meme-post[data-meme-id="${memeIdForCountUpdate}"]`);
        if (postElement) {
            const countDisplay = postElement.querySelector('.comment-count-display');
            if (countDisplay) countDisplay.textContent = snapshot.numChildren();
        }
    };

    const handleAddComment = async (event, memeId) => {
        // event.preventDefault(); // Already done in createMemeElement's listener
        if (!currentUser) { openModal('auth'); return; }
        const form = event.target;
        const commentTextarea = form.querySelector('textarea[name="commentText"]');
        const commentText = commentTextarea.value.trim();
        if (!commentText) { showInPageNotification("Comment cannot be empty.", "warning"); return; }

        const commentData = {
            text: commentText,
            userId: currentUser.uid,
            userName: currentUser.displayName || 'Anonymous Commenter',
            createdAt: serverTimestamp
        };
        showSpinner();
        try {
            await database.ref(`comments/${memeId}`).push(commentData);
            commentTextarea.value = '';
            showInPageNotification("Comment posted!", "success");
            // Update meme's commentCount via transaction
            await database.ref(`memes/${memeId}/commentCount`).transaction(count => (count || 0) + 1);

            // Notify meme owner
            const memeDataSnap = await database.ref(`memes/${memeId}`).once('value');
            const memeOwnerId = memeDataSnap.val()?.creatorId;
            if (memeOwnerId && memeOwnerId !== currentUser.uid) {
                createNotification(
                    memeOwnerId, 'comment', currentUser.uid, currentUser.displayName || 'Someone',
                    memeId, `commented on your meme: "${commentText.substring(0, 30)}${commentText.length > 30 ? '...' : ''}"`, 'meme'
                );
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
        if (receivingUserId === actorUid && (type === 'like' || type === 'comment' || type === 'favorite')) { console.log("Skipping self-notification for action:", type); return; }

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
        if (userNotificationsListener && currentUser?.uid === userId) return; // Already listening
        if (userNotificationsListener && currentUser?.uid && currentUser.uid !== userId) { // User changed
            database.ref(`user-notifications/${currentUser.uid}`).off('value', userNotificationsListener);
        }
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
                renderNotificationDropdown(notifications); // Re-render if open
            }
        }, error => {
            console.error("Error fetching notifications:", error);
            showInPageNotification("Could not load notifications.", "error");
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
        notifications.forEach(notif => {
            const item = document.createElement('div');
            item.className = `notification-item ${!notif.read ? 'unread' : ''}`;
            item.dataset.notificationId = notif.id;
            item.setAttribute('tabindex', '0');
            item.innerHTML = `<span class="notification-message">${notif.message || `${notif.actorName} performed an action.`}</span>
                              <span class="notification-timestamp">${timeAgo(notif.timestamp)}</span>`;
            item.addEventListener('click', () => handleNotificationClick(notif));
            item.addEventListener('keydown', (e) => { if(e.key === 'Enter' || e.key === ' ') handleNotificationClick(notif); });
            dropdown.appendChild(item);
        });
    };

    const handleNotificationClick = (notification) => {
        if (!notification.read && currentUser) {
            database.ref(`user-notifications/${currentUser.uid}/${notification.id}/read`).set(true)
                .catch(err => console.warn("Could not mark notification as read:", err));
        }
        closeNotificationDropdown(); // Close dropdown after click
        // Navigate based on notification type
        if (notification.targetType === 'meme' && notification.targetId) {
            const targetMeme = allMemes.find(m => m.id === notification.targetId);
            if (targetMeme) {
                openMemeDetail(targetMeme);
            } else {
                // Try to fetch meme if not in local cache, then open
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
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.top = `${rect.bottom + window.scrollY + 5}px`;
        // Position relative to the button, try to keep in viewport.
        // Calculate if right edge would be off-screen
        if (rect.left + 150 > window.innerWidth) { // Assuming menu min-width 150px
             menu.style.right = `${window.innerWidth - rect.right - window.scrollX}px`; // Align to right of button
        } else {
             menu.style.left = `${rect.left + window.scrollX}px`; // Align to left of button
        }


        const editButton = document.createElement('button');
        editButton.textContent = 'Edit Description';
        editButton.onclick = () => { openModal('editMeme', { meme }); closeActiveContextMenu(); };
        menu.appendChild(editButton);

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete Meme';
        deleteButton.className = 'delete-option';
        deleteButton.onclick = () => { handleDeleteMeme(meme.id); closeActiveContextMenu(); };
        menu.appendChild(deleteButton);

        document.body.appendChild(menu);
        activeContextMenu = menu;

        // Auto-close if clicked outside
        setTimeout(() => { // Allow current click to propagate first
            document.addEventListener('click', handleClickOutsideContextMenu, { once: true });
        }, 0);
    };

    const closeActiveContextMenu = () => {
        if (activeContextMenu) {
            activeContextMenu.remove();
            activeContextMenu = null;
            document.removeEventListener('click', handleClickOutsideContextMenu);
        }
    };

    const handleClickOutsideContextMenu = (event) => {
        if (activeContextMenu && !activeContextMenu.contains(event.target) && !event.target.closest('.post-options-button')) {
            closeActiveContextMenu();
        } else if (activeContextMenu) { // If click was inside or on button, re-attach listener for next click
             document.addEventListener('click', handleClickOutsideContextMenu, { once: true });
        }
    };

    const handleDeleteMeme = (memeId) => {
        if (!currentUser) return;
        const memeToDelete = allMemes.find(m => m.id === memeId);
        if (!memeToDelete || memeToDelete.creatorId !== currentUser.uid) {
            showInPageNotification("You can only delete your own memes.", "error"); return;
        }
        if (confirm("Are you sure you want to delete this meme? This cannot be undone.")) {
            showSpinner();
            const updates = {};
            updates[`/memes/${memeId}`] = null;
            updates[`/comments/${memeId}`] = null;
            // TODO: Also remove from all users' user-favorites lists
            // This requires iterating through /user-favorites or a Cloud Function for cleanup.
            // For now, favorited memes might point to null after deletion.

            database.ref().update(updates)
                .then(() => {
                    showInPageNotification("Meme deleted successfully.", "success");
                    // No need to manually remove from allMemes if Firebase listener auto-updates it.
                    // If not, filter it out: allMemes = allMemes.filter(m => m.id !== memeId);
                    // renderGalleryForCurrentFeed(); // The 'on value' for memes should handle this
                })
                .catch(err => {
                    console.error("Error deleting meme:", err);
                    showInPageNotification("Failed to delete meme: " + err.message, "error");
                })
                .finally(hideSpinner);
        }
    };

    // --- Auth State Change Handler (Initialization & Updates) ---
    auth.onAuthStateChanged(user => {
        console.log("Auth state changed. User:", user ? user.uid : null);
        const previousUserUid = currentUser?.uid;
        currentUser = user;
        updateUIForAuthState(user);

        if (user && !previousUserUid) { // Just logged in
            loadInitialData(); // Or just parts that depend on user being known
            handleHashChange();
        } else if (!user && previousUserUid) { // Just logged out
            if (currentVisibleView === accountView || (currentVisibleView === galleryView && (activeFeed === 'favorites' || activeFeed === 'following'))) {
                window.location.hash = '';
                switchMainView(galleryView);
                setActiveFeedTab('for-you');
                renderGalleryForCurrentFeed();
            }
            currentAccountPageUserId = null;
        } else if (!user && !previousUserUid) { // Initial load, no user yet
            loadInitialData(); // Load public data
            handleHashChange();
        } else { // User state same, or other complex cases
             if (currentVisibleView === galleryView) {
                renderGalleryForCurrentFeed(); // Refresh current feed
            } else if (currentVisibleView === accountView && currentAccountPageUserId) {
                loadAccountPage(currentAccountPageUserId); // Refresh account page
            }
        }
    });

    // --- Event Listeners (Global & Specific) ---
    homeLink?.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.hash = '';
        switchMainView(galleryView);
        setActiveFeedTab('for-you');
        if(searchBar) searchBar.value = '';
        renderGalleryForCurrentFeed();
    });

    myAccountBtn?.addEventListener('click', () => {
        if (currentUser) navigateToAccountPage(currentUser.uid);
        else openModal('auth');
    });

    feedTabsContainer?.addEventListener('click', (e) => {
        const button = e.target.closest('.feed-tab-btn');
        if (button) {
            const feedName = button.dataset.feed;
            if (feedName) {
                if ((feedName === 'following' || feedName === 'favorites') && !currentUser) {
                    openModal('auth'); return;
                }
                switchMainView(galleryView);
                switchFeed(feedName);
            }
        }
    });

    accountTabsContainer?.addEventListener('click', (e) => {
        const button = e.target.closest('.tab-btn');
        if (button) {
            const tabTargetId = button.dataset.tabTarget;
            if (tabTargetId) setActiveAccountTab(tabTargetId, button);
        }
    });

    accountFollowUnfollowBtn?.addEventListener('click', (e) => {
        const targetUserId = e.currentTarget.dataset.targetUserId;
        if (targetUserId) handleFollowToggle(targetUserId, e.currentTarget);
    });
    accountEditProfileBtn?.addEventListener('click', () => {
        // TODO: Implement openModal('editProfile', { user: currentUserData })
        showInPageNotification("Profile editing coming soon!", "info");
    });


    loginPromptBtn?.addEventListener('click', () => openModal('auth'));
    uploadBtn?.addEventListener('click', () => { if(currentUser) openModal('upload'); else openModal('auth');});
    settingsBtn?.addEventListener('click', () => openModal('settings')); // Settings modal can be opened by anyone to change theme

    themeSelector?.addEventListener('change', (e) => {
        const newTheme = e.target.value;
        document.body.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        // If settings modal is open, update its theme selector too
        const settingsModalThemeSelector = document.querySelector('#settingsForm #settingThemeModal');
        if (settingsModalThemeSelector) settingsModalThemeSelector.value = newTheme;
    });

    searchBar?.addEventListener('input', () => {
        // Could add debounce here
        if (currentVisibleView === galleryView) {
             renderGalleryForCurrentFeed();
        }
        // else if (currentVisibleView === accountView && activeAccountTab === 'account-memes-content') {
            // Potentially filter user's own memes on their account page.
        // }
    });

    notificationsBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const dropdown = notificationDropdownContainer.querySelector('.notification-dropdown');
        if (dropdown) {
            closeNotificationDropdown();
        } else {
            if (!currentUser) { showInPageNotification("Login to see notifications.", "info"); return; }
            const newDropdown = document.createElement('div');
            newDropdown.className = 'notification-dropdown';
            newDropdown.setAttribute('aria-label', 'Notifications List');
            notificationDropdownContainer.appendChild(newDropdown);
            notificationsBtn.setAttribute('aria-expanded', 'true');
            // Fetch and render notifications
            database.ref(`user-notifications/${currentUser.uid}`).orderByChild('timestamp').limitToLast(20).once('value', snapshot => {
                const notifications = [];
                snapshot.forEach(childSnap => notifications.unshift({ id: childSnap.key, ...childSnap.val() })); // Newest first
                renderNotificationDropdown(notifications);
            });
        }
    });
    // Global click to close notification dropdown
    document.body.addEventListener('click', (e) => {
        if (notificationDropdownContainer && !notificationDropdownContainer.contains(e.target) && e.target !== notificationsBtn && !notificationsBtn?.contains(e.target)) {
            closeNotificationDropdown();
        }
        // Also close context menu
        if (activeContextMenu && !activeContextMenu.contains(e.target) && !e.target.closest('.post-options-button')) {
            closeActiveContextMenu();
        }
    });


    // --- Hash-based Routing ---
    const handleHashChange = () => {
        const hash = window.location.hash;
        closeActiveContextMenu(); // Close any open menus on route change
        closeNotificationDropdown();

        if (hash.startsWith('#/user/')) {
            const userId = hash.substring('#/user/'.length);
            if (userId) {
                // Only navigate if different user or not already on account view for this user
                if (userId !== currentAccountPageUserId || currentVisibleView !== accountView) {
                    navigateToAccountPage(userId);
                }
            }
        } else if (hash.startsWith('#/meme/')) {
            const memeId = hash.substring('#/meme/'.length);
            const foundMeme = allMemes.find(m => m.id === memeId);
            if (foundMeme) {
                openMemeDetail(foundMeme);
            } else { // Meme not in local cache, try to fetch
                database.ref(`memes/${memeId}`).once('value').then(snap => {
                    if (snap.exists()) openMemeDetail({ id: snap.key, ...snap.val() });
                    else {
                        showInPageNotification("Meme not found.", "warning");
                        if (currentVisibleView !== galleryView) { // Fallback to gallery if meme detail fails
                           window.location.hash = ''; // Clear bad hash
                           switchMainView(galleryView);
                        }
                    }
                });
            }
        } else { // No specific route or just '#'
            if (currentVisibleView !== galleryView) {
                switchMainView(galleryView);
                // Don't force feed switch here, let it be user's last choice or default
            }
        }
    };
    window.addEventListener('hashchange', handleHashChange);

    // --- Initial Load Function ---
    const loadInitialData = () => {
        showSpinner();
        initTheme();

        // Listener for all memes - this will keep `allMemes` up to date
        database.ref('memes').on('value', snapshot => {
            const memesData = snapshot.val() || {};
            allMemes = Object.keys(memesData).map(key => ({ id: key, ...memesData[key] }));
            console.log("All memes updated/fetched:", allMemes.length);

            // After memes are loaded (or reloaded), refresh current view
            if (currentVisibleView === galleryView) {
                renderGalleryForCurrentFeed();
            } else if (currentVisibleView === accountView) {
                if (activeAccountTab === 'account-memes-content' && currentAccountPageUserId) {
                    loadUserMemes(currentAccountPageUserId);
                } else if (activeAccountTab === 'account-favorites-content' && currentAccountPageUserId) {
                    loadUserFavorites(currentAccountPageUserId);
                }
                // Follower/Following lists are typically loaded on tab click, not on general meme update.
            }
            hideSpinner(); // Hide spinner after initial meme load or update
        }, error => {
            console.error("Error fetching memes:", error);
            if(memeGallery) memeGallery.innerHTML = '<p style="color:red;">Could not load memes. Please check your connection or try again later.</p>';
            hideSpinner();
        });

        // The auth state listener will handle initial view based on login and hash
        // No need to call handleHashChange or switchMainView here if auth listener does it.
    };

    loadInitialData(); // Call to start loading theme and memes listener

    console.log("MemeDrop App: Fully Initialized.");
}); // End DOMContentLoaded
