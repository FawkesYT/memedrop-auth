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
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
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
        if (window.getComputedStyle(notificationArea).flexDirection === 'column-reverse') {
            notificationArea.insertBefore(notification, notificationArea.firstChild);
        } else {
            notificationArea.appendChild(notification);
        }
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
        let seconds = Math.round((now.getTime() - new Date(timestamp).getTime()) / 1000);
        if (isNaN(seconds)) {
             const currentServerTimeEstimate = Date.now();
             seconds = Math.round((currentServerTimeEstimate - timestamp) / 1000);
             if (seconds < 0) seconds = 0;
        }
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
                modalHTML = `<div class="modal-content"><h2>Upload a New Meme</h2><form id="uploadForm"><label for="memeFileModal">Choose image/gif (Max 5MB):</label><input type="file" id="memeFileModal" name="memeFileModal" accept="image/*,image/gif" required><label for="memeDescriptionModal">Description (Max 2000 chars):</label><textarea id="memeDescriptionModal" name="memeDescriptionModal" placeholder="A funny description..." rows="4" required maxlength="1999"></textarea><div class="modal-flex-buttons"><button type="button" class="cancel-btn nav-button">Cancel</button><button type="submit" class="nav-button">Upload Meme</button></div></form></div>`;
                break;
            case 'editMeme':
                if (data?.meme) { modalHTML = `<div class="modal-content"><h2>Edit Meme Description</h2><form id="editMemeForm"><input type="hidden" id="editMemeIdModal" value="${data.meme.id}"><label for="editMemeDescriptionModal">Description (Max 2000 chars):</label><textarea id="editMemeDescriptionModal" name="editMemeDescriptionModal" rows="4" required maxlength="1999">${data.meme.description || ''}</textarea><div class="modal-flex-buttons"><button type="button" class="cancel-btn nav-button">Cancel</button><button type="submit" class="nav-button">Save Changes</button></div></form></div>`; }
                else { showInPageNotification("Error: Meme data not found for editing.", "error"); return; }
                break;
            case 'settings':
                 const userSettings = userFollowData.settings || { theme: localStorage.getItem('theme') || 'vaporwave', emailNotifications: false };
                 const themeOptions = ['light', 'dark', 'vaporwave', 'synthwave84', 'forest', 'ocean', 'sunset', 'monochrome'];
                 const themeOptionHTML = themeOptions.map(theme => { const themeName = theme.charAt(0).toUpperCase() + theme.slice(1).replace(/([A-Z0-9])/g, ' $1').trim(); return `<option value="${theme}" ${userSettings.theme === theme ? 'selected' : ''}>${themeName}</option>`; }).join('');
                 modalHTML = `<div class="modal-content"><h2>Settings</h2><form id="settingsFormModal"><label for="settingThemeModal">Preferred Theme:</label><select id="settingThemeModal" name="theme">${themeOptionHTML}</select><div style="margin-top: 15px; text-align:left;"><input type="checkbox" id="settingEmailNotificationsModal" name="emailNotifications" ${userSettings.emailNotifications ? 'checked' : ''}><label for="settingEmailNotificationsModal" class="checkbox-label">Receive Email Notifications (Feature coming soon)</label></div><div class="modal-flex-buttons" style="margin-top:25px;"><button type="button" class="cancel-btn nav-button">Cancel</button><button type="submit" class="nav-button">Save Settings</button></div></form></div>`;
                break;
            case 'memeDetail':
                if (data?.meme) { modalOverlay.classList.add('meme-detail-modal-overlay'); modalHTML = `<div class="meme-detail-modal-content"><button class="meme-detail-close-btn" aria-label="Close meme detail view">×</button><img src="${data.meme.imageBase64}" alt="${(data.meme.description || 'Meme image').replace(/"/g, '"')}"/></div>`; }
                else { showInPageNotification("Error: Meme data not found for detail view.", "error"); return; }
                break;
            default: console.error("Unknown modal type:", modalType); return;
        }
        modalOverlay.innerHTML = modalHTML; modalContainer.appendChild(modalOverlay); attachModalListeners(modalType, modalOverlay, data);
    };

    const attachModalListeners = (modalType, modalOverlayElement, modalData = null) => {
        const closeLogic = () => { modalOverlayElement.style.animationName = 'fadeOut'; modalOverlayElement.addEventListener('animationend', () => modalOverlayElement.remove(), { once: true }); };
        modalOverlayElement.addEventListener('click', e => { if (e.target === modalOverlayElement || e.target.classList.contains('cancel-btn') || e.target.classList.contains('meme-detail-close-btn')) closeLogic(); });
        const escListener = (e) => { if (e.key === "Escape" && modalContainer.contains(modalOverlayElement)) closeLogic(); };
        document.addEventListener('keydown', escListener);
        const observer = new MutationObserver((mutationsList, obs) => { for (const m of mutationsList) { if (m.removedNodes) { let r = false; m.removedNodes.forEach(n => { if (n === modalOverlayElement) r = true; }); if (r) { document.removeEventListener('keydown', escListener); obs.disconnect(); return; }}}});
        observer.observe(modalContainer, { childList: true });

        switch (modalType) {
            case 'auth':
                modalOverlayElement.querySelector('#googleLoginBtn')?.addEventListener('click', async () => {
                    showSpinner(); const p = new firebase.auth.GoogleAuthProvider();
                    try {
                        const res = await auth.signInWithPopup(p); if (res.user) { const u = res.user, uRef = database.ref(`users/${u.uid}`), uSnap = await uRef.once('value'); const up = {lastLogin:serverTimestamp,displayName:u.displayName||(uSnap.exists()?uSnap.val().displayName:'Meme Fan'),photoURL:u.photoURL||(uSnap.exists()?uSnap.val().photoURL:`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.displayName||'U')}&fontSize=36`)}; if(!uSnap.exists()){up.email=u.email;up.createdAt=serverTimestamp;up.settings={theme:localStorage.getItem('theme')||'vaporwave',emailNotifications:false};await uRef.set(up);}else{await uRef.update(up);} closeLogic(); showInPageNotification('Login successful!','success');}
                    } catch (err) { console.error("SignIn Error:",err); showInPageNotification(`Login failed: ${err.message} (Code: ${err.code})`,"error"); } finally { hideSpinner(); }
                }); break;
            case 'upload':
                modalOverlayElement.querySelector('#uploadForm')?.addEventListener('submit', async e => {
                    e.preventDefault(); if(!currentUser){showInPageNotification("Login to upload.","error");openModal('auth');return;} showSpinner();
                    const fIn=e.target.querySelector('#memeFileModal'),dIn=e.target.querySelector('#memeDescriptionModal'),f=fIn.files[0],d=dIn.value.trim();
                    if(!f){hideSpinner();showInPageNotification("Select an image.","warning");return;} if(!d){hideSpinner();showInPageNotification("Enter a description.","warning");return;} if(f.size > 5*1024*1024){hideSpinner();showInPageNotification("Image too large (Max 5MB).","error");return;}
                    try{const r=new FileReader();r.onloadend=async()=>{if(r.error){hideSpinner();showInPageNotification("File read error.","error");return;} const b64=r.result;if(b64.length > 7*1024*1024){hideSpinner();showInPageNotification("Encoded image too large.","error");return;} const mD={imageBase64:b64,description:d,creatorId:currentUser.uid,creatorName:currentUser.displayName||'Anon',createdAt:serverTimestamp,likeCount:0,dislikeCount:0,commentCount:0,favoriteCount:0,viewCount:0,likes:{},dislikes:{},favorites:{}};await database.ref('memes').push(mD);showInPageNotification('Meme uploaded!','success');fIn.value='';dIn.value='';closeLogic(); hideSpinner();};r.readAsDataURL(f);}catch(err){console.error("Upload Error:",err);showInPageNotification(`Upload failed: ${err.message}`,"error"); hideSpinner();}
                }); break;
            case 'editMeme':
                modalOverlayElement.querySelector('#editMemeForm')?.addEventListener('submit', async e => {
                    e.preventDefault();if(!currentUser||!modalData?.meme||currentUser.uid!==modalData.meme.creatorId){showInPageNotification("Not permitted.","error");return;}
                    const mId=e.target.querySelector('#editMemeIdModal').value,newD=e.target.querySelector('#editMemeDescriptionModal').value.trim(); showSpinner();
                    try{await database.ref(`memes/${mId}/description`).set(newD);await database.ref(`memes/${mId}/lastEditedAt`).set(serverTimestamp);showInPageNotification("Description updated.","success");closeLogic();}catch(err){console.error("Update Error:",err);showInPageNotification(`Update failed: ${err.message}`,"error");}finally{hideSpinner();}
                }); break;
            case 'settings':
                modalOverlayElement.querySelector('#settingsFormModal')?.addEventListener('submit', async e => {
                    e.preventDefault();if(!currentUser){showInPageNotification("Login to save.","error");return;}
                    const nT=e.target.querySelector('#settingThemeModal').value,eN=e.target.querySelector('#settingEmailNotificationsModal').checked;showSpinner();
                    try{const nS={theme:nT,emailNotifications:eN};await database.ref(`users/${currentUser.uid}/settings`).set(nS);userFollowData.settings=nS;localStorage.setItem('theme',nT);document.body.setAttribute('data-theme',nT);if(themeSelector)themeSelector.value=nT;showInPageNotification("Settings saved.","success");closeLogic();}catch(err){console.error("Settings Error:",err);showInPageNotification(`Save failed: ${err.message}`,"error");}finally{hideSpinner();}
                }); break;
        }
    };

    // --- UI Update Functions ---
    const updateUIForAuthState = (user) => {
        const prevUid = currentUser?.uid;
        currentUser = user;
        const currentLogoutBtn = document.getElementById('logoutBtn'); if (currentLogoutBtn) currentLogoutBtn.remove();
        if (user) {
            if (userInfoDiv) { userInfoDiv.innerHTML = `<span title="${user.displayName||'User'}">${user.displayName||'User'}!</span> <button id="logoutBtn" class="nav-button">Logout</button>`; document.getElementById('logoutBtn')?.addEventListener('click', handleLogout); userInfoDiv.classList.remove('hidden');}
            loginPromptBtn?.classList.add('hidden'); uploadBtn?.classList.remove('hidden'); settingsBtn?.classList.remove('hidden'); myAccountBtn?.classList.remove('hidden'); document.getElementById('feed-following')?.classList.remove('hidden'); document.getElementById('feed-favorites')?.classList.remove('hidden');
            listenToUserNotifications(user.uid); loadUserFollowData(user.uid);
        } else {
            if(userInfoDiv){ userInfoDiv.classList.add('hidden'); userInfoDiv.innerHTML = '';}
            loginPromptBtn?.classList.remove('hidden'); uploadBtn?.classList.add('hidden'); settingsBtn?.classList.add('hidden'); myAccountBtn?.classList.add('hidden'); document.getElementById('feed-following')?.classList.add('hidden'); document.getElementById('feed-favorites')?.classList.add('hidden');
            userFollowData = { following: {}, followers: {}, favorites: {}, settings: { theme: localStorage.getItem('theme') || 'vaporwave', emailNotifications: false } }; initTheme();
            if (userNotificationsListener && prevUid) { database.ref(`user-notifications/${prevUid}`).off('value', userNotificationsListener); userNotificationsListener = null; }
            updateNotificationBadge(0); closeNotificationDropdown();
        }
        if (currentVisibleView === galleryView) { if ((activeFeed==='favorites'||activeFeed==='following')&&!user){renderGallery([],'meme-gallery'); setActiveFeedTab('for-you');} else {renderGalleryForCurrentFeed();} }
        else if (currentVisibleView === accountView) { if (!user) {switchMainView(galleryView); setActiveFeedTab('for-you'); renderGalleryForCurrentFeed();} else if (currentAccountPageUserId){loadAccountPage(currentAccountPageUserId);} }
    };
    const handleLogout = () => { auth.signOut().then(() => showInPageNotification('Logged out.', 'info')).catch(err => showInPageNotification(`Logout failed: ${err.message}`, "error")); };

    // --- Meme Rendering, Interaction, Comments ---
// sketch.js

// ... (Keep all code before createMemeElement) ...

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
            checkAndSetFollowButtonState(meme.creatorId, followBtn); // checkAndSet will set initial text
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

        const likeButton = document.createElement('button');
        likeButton.className = `action-button like-button ${isLiked ? 'liked' : ''}`;
        likeButton.title = isLiked ? "Unlike" : "Like";
        likeButton.setAttribute('aria-pressed', String(!!isLiked)); // Use String() for boolean attributes
        likeButton.innerHTML = `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg><span class="like-count">${likeCount}</span>`;
        likeButton.onclick = (e) => { e.stopPropagation(); handleLike(meme.id); };
        actionsDiv.appendChild(likeButton);

        const dislikeButton = document.createElement('button');
        dislikeButton.className = `action-button dislike-button ${isDisliked ? 'disliked' : ''}`;
        dislikeButton.title = isDisliked ? "Remove Dislike" : "Dislike";
        dislikeButton.setAttribute('aria-pressed', String(!!isDisliked));
        dislikeButton.innerHTML = `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="${isDisliked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3L8 14M5 2h4v10H5z"/></svg><span class="dislike-count">${dislikeCount}</span>`;
        dislikeButton.onclick = (e) => { e.stopPropagation(); handleDislike(meme.id); };
        actionsDiv.appendChild(dislikeButton);

        const commentToggleButton = document.createElement('button');
        commentToggleButton.className = 'action-button comment-toggle-button';
        commentToggleButton.title = "View Comments";
        commentToggleButton.setAttribute('aria-expanded', 'false');
        commentToggleButton.innerHTML = `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg><span class="comment-count-display">${commentCount}</span>`;
        commentToggleButton.onclick = (e) => { e.stopPropagation(); toggleComments(meme.id, post, commentToggleButton); };
        actionsDiv.appendChild(commentToggleButton);

        const favoriteButton = document.createElement('button');
        favoriteButton.className = `action-button favorite-button ${isFavorited ? 'favorited' : ''}`;
        favoriteButton.title = isFavorited ? "Unfavorite" : "Favorite";
        favoriteButton.setAttribute('aria-pressed', String(!!isFavorited));
        favoriteButton.innerHTML = `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="${isFavorited ? 'var(--favorite-color)' : 'none'}" stroke="var(--favorite-color)" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg><span class="sr-only">Favorite</span>`;
        favoriteButton.onclick = (e) => { e.stopPropagation(); handleFavoriteToggle(meme.id, e.currentTarget); };
        actionsDiv.appendChild(favoriteButton);

        const viewsCounterSpan = document.createElement('span');
        viewsCounterSpan.className = 'meme-views-counter';
        viewsCounterSpan.innerHTML = `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg> <span>${meme.viewCount || 0}</span>`;
        actionsDiv.appendChild(viewsCounterSpan);

        if (currentUser && currentUser.uid === meme.creatorId) {
            const optionsButton = document.createElement('button');
            optionsButton.className = 'action-button post-options-button';
            optionsButton.title = "More options";
            optionsButton.setAttribute('aria-haspopup', 'true');
            optionsButton.setAttribute('aria-expanded', 'false');
            optionsButton.innerHTML = `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg><span class="sr-only">More options</span>`;
            optionsButton.onclick = (e) => { e.stopPropagation(); togglePostOptionsMenu(meme, optionsButton); };
            actionsDiv.appendChild(optionsButton);
        }
        post.appendChild(actionsDiv);

        const commentsSection = document.createElement('div');
        commentsSection.className = 'comments-section hidden';
        commentsSection.id = `comments-for-${meme.id}`;
        const altTextForComment = (meme.description || 'this meme').substring(0, 50).replace(/"/g, '"');
        const commentsListAriaLabel = `Comments for ${altTextForComment}`;
        commentsSection.innerHTML = `<h4>Comments</h4><div class="comments-list" aria-live="polite" aria-label="${commentsListAriaLabel}"><p>Click comment icon to load/refresh.</p></div>${currentUser ? `<form class="add-comment-form" data-meme-id="${meme.id}" aria-labelledby="comment-form-label-${meme.id}"><label id="comment-form-label-${meme.id}" class="sr-only">Add a comment for ${altTextForComment}</label><textarea name="commentText" placeholder="Add a comment..." required aria-required="true" rows="3"></textarea><button type="submit" class="nav-button">Post</button></form>` : '<p><small>Login to post comments.</small></p>'}`;
        post.appendChild(commentsSection);
        const addCommentForm = commentsSection.querySelector('.add-comment-form');
        if (addCommentForm) {
            addCommentForm.addEventListener('submit', (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleAddComment(e, meme.id);
            });
        }
        return post;
    };

// ... (Rest of your sketch.js file starting from renderGallery) ...

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

    const openMemeDetail = (meme) => { openModal('memeDetail', { meme }); };
    const incrementMemeViewCount = (memeId) => { if (!memeId) return; database.ref(`memes/${memeId}/viewCount`).transaction(c => (c || 0) + 1).catch(err => console.warn("View count increment failed:", err.message)); };
    const handleLike = (memeId) => handleLikeDislike(memeId, 'like');
    const handleDislike = (memeId) => handleLikeDislike(memeId, 'dislike');

    const handleLikeDislike = (memeId, actionType) => {
        if (!currentUser) { openModal('auth'); return; }
        const memeRef = database.ref(`memes/${memeId}`);
        memeRef.transaction(memeData => {
            if (memeData) {
                memeData.likes = memeData.likes || {}; memeData.dislikes = memeData.dislikes || {};
                memeData.likeCount = typeof memeData.likeCount === 'number' ? memeData.likeCount : 0;
                memeData.dislikeCount = typeof memeData.dislikeCount === 'number' ? memeData.dislikeCount : 0;
                const userUid = currentUser.uid;
                const wasLiked = !!memeData.likes[userUid]; const wasDisliked = !!memeData.dislikes[userUid];
                if (actionType === 'like') {
                    if (wasLiked) { memeData.likeCount = Math.max(0, memeData.likeCount - 1); delete memeData.likes[userUid]; }
                    else { memeData.likeCount++; memeData.likes[userUid] = true; if (wasDisliked) { memeData.dislikeCount = Math.max(0, memeData.dislikeCount - 1); delete memeData.dislikes[userUid]; } if (memeData.creatorId && memeData.creatorId !== userUid) { memeData._pendingNotification = { type: 'like', memeOwnerId: memeData.creatorId, memeId: memeId }; } }
                } else if (actionType === 'dislike') {
                    if (wasDisliked) { memeData.dislikeCount = Math.max(0, memeData.dislikeCount - 1); delete memeData.dislikes[userUid]; }
                    else { memeData.dislikeCount++; memeData.dislikes[userUid] = true; if (wasLiked) { memeData.likeCount = Math.max(0, memeData.likeCount - 1); delete memeData.likes[userUid]; } }
                }
            } return memeData;
        }, (error, committed, snapshot) => {
            if (error) { console.error(`${actionType} transaction error:`, error); showInPageNotification(`Could not process ${actionType}: ${error.message}`, "error"); }
            else if (committed) { const uM = snapshot.val(); if (uM?._pendingNotification) { const {type:nt,memeOwnerId:mOI,memeId:cMI}=uM._pendingNotification; createNotification(mOI,nt,currentUser.uid,currentUser.displayName||'Someone',cMI,`${nt}d your meme.`,'meme'); database.ref(`memes/${cMI}/_pendingNotification`).remove();}}
        });
    };

    const handleFavoriteToggle = async (memeId, buttonElement) => {
        if (!currentUser || !memeId) { if (!currentUser) openModal('auth'); return; }
        showSpinner(); const cU = currentUser.uid; const iCF = !!(userFollowData.favorites && userFollowData.favorites[memeId]);
        const oBS = {isFavorited:iCF, title:buttonElement.title, fill:buttonElement.querySelector('svg')?.style.fill};
        buttonElement.classList.toggle('favorited', !iCF); buttonElement.title = iCF ? "Favorite" : "Unfavorite"; const svg = buttonElement.querySelector('svg'); if (svg) svg.style.fill = !iCF ? 'var(--favorite-color)' : 'none';
        if (iCF) delete userFollowData.favorites[memeId]; else userFollowData.favorites[memeId] = true;
        const updates = {}; updates[`/user-favorites/${cU}/${memeId}`] = iCF ? null : true;
        try {
            await database.ref().update(updates);
            await database.ref(`memes/${memeId}`).transaction(mD => {
                if(mD){mD.favorites=mD.favorites||{};mD.favoriteCount=typeof mD.favoriteCount==='number'?mD.favoriteCount:0;if(iCF){if(mD.favorites[cU]){mD.favoriteCount=Math.max(0,mD.favoriteCount-1);delete mD.favorites[cU];}}else{if(!mD.favorites[cU]){mD.favoriteCount++;mD.favorites[cU]=true;if(mD.creatorId&&mD.creatorId!==cU){mD._pendingNotification={type:'favorite',memeOwnerId:mD.creatorId,memeId:memeId};}}}}return mD;
            }, (error,committed,snapshot)=>{if(error){console.error("Meme Fav Tx Error:",error);}else if(committed){const uM=snapshot.val();if(uM?._pendingNotification){const ni=uM._pendingNotification;createNotification(ni.memeOwnerId,'favorite',cU,currentUser.displayName||'Someone',ni.memeId,'favorited your meme.','meme');database.ref(`memes/${memeId}/_pendingNotification`).remove();}}});
            showInPageNotification(iCF ? 'Removed from favorites.' : 'Added to favorites!', 'success');
            if(currentVisibleView===galleryView && activeFeed==='favorites'){renderGalleryForCurrentFeed();} else if(currentVisibleView===accountView && activeAccountTab==='account-favorites-content' && currentAccountPageUserId===cU){loadUserFavorites(cU);}
        } catch (error) {
            console.error("Error toggling favorite:", error); showInPageNotification("Favorite update failed: "+error.message, "error");
            userFollowData.favorites = oBS.isFavorited ? {...userFollowData.favorites,[memeId]:true} : (delete userFollowData.favorites[memeId],userFollowData.favorites);
            if(buttonElement){buttonElement.classList.toggle('favorited',oBS.isFavorited);buttonElement.title=oBS.title;const sR=buttonElement.querySelector('svg');if(sR)sR.style.fill=oBS.fill;}
        } finally { hideSpinner(); }
    };

    const checkAndSetFavoriteButtonState = (memeId, buttonElement) => {
        if (!buttonElement || !currentUser) return;
        const isFavorited = userFollowData.favorites && userFollowData.favorites[memeId];
        buttonElement.classList.toggle('favorited', !!isFavorited);
        buttonElement.title = isFavorited ? "Unfavorite" : "Favorite";
        const svg = buttonElement.querySelector('svg'); if (svg) svg.style.fill = isFavorited ? 'var(--favorite-color)' : 'none';
    };

    const toggleComments = (memeId, postElement, toggleButton) => {
        const commentsSection = postElement.querySelector('.comments-section'); if (!commentsSection) return;
        const commentsListDiv = commentsSection.querySelector('.comments-list'); const isHidden = commentsSection.classList.toggle('hidden');
        toggleButton.setAttribute('aria-expanded', String(!isHidden));
        if (!isHidden) {
            commentsListDiv.innerHTML = '<p>Loading comments...</p>';
            if (commentsListeners[memeId]?.isActive) { /* Already active, could re-fetch or rely on listener */ }
            else {
                const ref = database.ref(`comments/${memeId}`).orderByChild('createdAt').limitToLast(50);
                const cb = s => renderComments(s, commentsListDiv, memeId);
                const errCb = e => { console.error(`Comments fetch error for ${memeId}:`, e); if(commentsListDiv) commentsListDiv.innerHTML = '<p style="color:red;">Could not load comments.</p>';};
                ref.on('value', cb, errCb); commentsListeners[memeId] = { ref, listener: cb, errorCb: errCb, isActive: true };
            }
        } else { if (commentsListeners[memeId]?.isActive) { commentsListeners[memeId].ref.off('value', commentsListeners[memeId].listener); commentsListeners[memeId].isActive = false;}}
    };

    const renderComments = (snapshot, commentsListDiv, memeIdForCountUpdate) => {
        if (!commentsListDiv) return; commentsListDiv.innerHTML = '';
        if (!snapshot.exists() || snapshot.numChildren() === 0) { commentsListDiv.innerHTML = '<p>No comments yet. Be the first!</p>'; }
        else {
            const arr = []; snapshot.forEach(cs => arr.push({ id: cs.key, ...cs.val() }));
            arr.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
            const frag = document.createDocumentFragment();
            arr.forEach(c => {
                const cDiv = document.createElement('div'); cDiv.className = 'comment';
                const hDiv = document.createElement('div'); hDiv.className = 'comment-header';
                const str = document.createElement('strong'); str.textContent = (c.userName||'User'); str.style.cursor='pointer'; str.onclick=()=>navigateToAccountPage(c.userId);
                const t = document.createElement('span'); t.className = 'comment-timestamp'; t.textContent = ` - ${timeAgo(c.createdAt)}`;
                hDiv.appendChild(str); hDiv.appendChild(t);
                const p = document.createElement('p'); p.textContent = c.text;
                cDiv.appendChild(hDiv); cDiv.appendChild(p); frag.appendChild(cDiv);
            });
            commentsListDiv.appendChild(frag);
        }
        const postEl = document.querySelector(`.meme-post[data-meme-id="${memeIdForCountUpdate}"]`);
        if (postEl) { const cd = postEl.querySelector('.comment-count-display'); if (cd) cd.textContent = snapshot.numChildren(); }
    };

    const handleAddComment = async (event, memeId) => {
        if (!currentUser) { openModal('auth'); return; }
        const form = event.target; const ta = form.querySelector('textarea[name="commentText"]'); const txt = ta.value.trim();
        if (!txt) { showInPageNotification("Comment cannot be empty.", "warning"); return; }
        const cD = {text:txt, userId:currentUser.uid, userName:currentUser.displayName||'Anon', createdAt:serverTimestamp};
        showSpinner();
        try {
            await database.ref(`comments/${memeId}`).push(cD); ta.value = ''; showInPageNotification("Comment posted!", "success");
            await database.ref(`memes/${memeId}/commentCount`).transaction(c => (c||0)+1);
            const mDSnap = await database.ref(`memes/${memeId}`).once('value'); const mOI = mDSnap.val()?.creatorId;
            if (mOI && mOI !== currentUser.uid) { createNotification(mOI,'comment',currentUser.uid,currentUser.displayName||'Someone',memeId,`commented: "${txt.substring(0,30)}${txt.length>30?'...':''}"`,'meme');}
        } catch (e) { console.error("Comment post error:",e); showInPageNotification("Comment post failed: "+e.message,"error");}
        finally { hideSpinner(); }
    };

    // --- Notification Logic ---
    const createNotification = (receivingUserId, type, actorUid, actorName, targetId, messageContent, targetType = 'meme') => {
        if (!receivingUserId || !type || !actorUid || !actorName) { console.warn("Skipping notification: missing params."); return; }
        if (receivingUserId === actorUid && (type === 'like' || type === 'comment' || type === 'favorite' || type === 'follow')) { console.log("Skipping self-notification for action:", type); return; }
        const nD = {type, actorUid, actorName, targetId, targetType, message:messageContent||`${actorName} interacted.`, timestamp:serverTimestamp, read:false};
        database.ref(`user-notifications/${receivingUserId}`).push(nD).then(()=>console.log("Notification created for",receivingUserId,"Type:",type)).catch(e=>console.error("Notification create error:",e));
    };
    const updateNotificationBadge = (count) => {
        unreadNotificationCount = count;
        if (notificationBadge) { if(count>0){notificationBadge.textContent=count>9?'9+':count.toString();notificationBadge.classList.remove('hidden');if(!notificationBadge.classList.contains('popping')){notificationBadge.classList.add('popping');setTimeout(()=>notificationBadge.classList.remove('popping'),300);}}else{notificationBadge.classList.add('hidden');}}
    };
    const listenToUserNotifications = (userId) => {
        if (userNotificationsListener && currentUser?.uid === userId && userId) return;
        if (userNotificationsListener && currentUser?.uid && currentUser.uid !== userId && userId) { database.ref(`user-notifications/${currentUser.uid}`).off('value', userNotificationsListener); }
        if (!userId) return;
        const uNR = database.ref(`user-notifications/${userId}`).orderByChild('timestamp').limitToLast(25);
        userNotificationsListener = uNR.on('value', s => { let u=0; const nlist=[]; s.forEach(cs=>{const notif={id:cs.key,...cs.val()};nlist.unshift(notif);if(!notif.read)u++;}); updateNotificationBadge(u); if(notificationDropdownContainer.querySelector('.notification-dropdown')){renderNotificationDropdown(nlist);}}, e => {console.error("Notifications fetch error:", e);});
    };
    const renderNotificationDropdown = (notifications) => {
        let dr = notificationDropdownContainer.querySelector('.notification-dropdown'); if (!dr) return; dr.innerHTML = '';
        if (notifications.length === 0) { dr.innerHTML = '<div class="no-notifications">No new notifications.</div>'; return; }
        const frag = document.createDocumentFragment();
        notifications.forEach(n => { const i=document.createElement('div'); i.className=`notification-item ${!n.read?'unread':''}`; i.dataset.notificationId=n.id; i.setAttribute('tabindex','0'); i.innerHTML=`<span class="notification-message">${n.message||`${n.actorName} did something.`}</span><span class="notification-timestamp">${timeAgo(n.timestamp)}</span>`; i.addEventListener('click',()=>handleNotificationClick(n)); i.addEventListener('keydown',(e)=>{if(e.key==='Enter'||e.key===' ')handleNotificationClick(n);}); frag.appendChild(i);});
        dr.appendChild(frag);
    };
    const handleNotificationClick = (notification) => {
        if (!notification.read && currentUser) { database.ref(`user-notifications/${currentUser.uid}/${notification.id}/read`).set(true).catch(e=>console.warn("Mark as read failed:",e));}
        closeNotificationDropdown();
 if (notification.targetType === 'meme' && notification.targetId) {
    const targetMeme = allMemes.find(m => m.id === notification.targetId);
    if (targetMeme) {
        openMemeDetail(targetMeme);
    } else {
        database.ref(`memes/${notification.targetId}`).once('value').then(snap => {
            if (snap.exists()) {
                openMemeDetail({ id: snap.key, ...snap.val() });
            } else {
                showInPageNotification("Related meme not found.", "warning");
            }
        }).catch(err => { // Also good to catch potential errors from the DB call
            console.error("Error fetching meme for notification click:", err);
            showInPageNotification("Could not retrieve meme details.", "error");
        });
    }
} else if (notification.targetType === 'user' && notification.actorUid) {
    navigateToAccountPage(notification.actorUid);
}
    };
    const closeNotificationDropdown = () => { const dr=notificationDropdownContainer.querySelector('.notification-dropdown'); if(dr){dr.remove();notificationsBtn?.setAttribute('aria-expanded','false');}};

    // --- Context Menu (Post Options) ---
    const togglePostOptionsMenu = (meme, buttonElement) => {
        closeActiveContextMenu(); if (!currentUser || currentUser.uid !== meme.creatorId) return;
        const rect = buttonElement.getBoundingClientRect(); const menu = document.createElement('div'); menu.className = 'context-menu'; menu.style.top = `${rect.bottom + window.scrollY + 5}px`;
        if (rect.left + 150 > window.innerWidth) { menu.style.right = `${window.innerWidth - rect.right - window.scrollX}px`; } else { menu.style.left = `${rect.left + window.scrollX}px`; }
        const eB = document.createElement('button'); eB.textContent='Edit Description'; eB.onclick=()=>{openModal('editMeme',{meme});closeActiveContextMenu();}; menu.appendChild(eB);
        const dB = document.createElement('button'); dB.textContent='Delete Meme'; dB.className='delete-option'; dB.onclick=()=>{handleDeleteMeme(meme.id);closeActiveContextMenu();}; menu.appendChild(dB);
        document.body.appendChild(menu); activeContextMenu = menu;
        setTimeout(() => { document.addEventListener('click', handleClickOutsideContextMenu, { once: true }); }, 0);
    };
    const closeActiveContextMenu = () => { if (activeContextMenu) { activeContextMenu.remove(); activeContextMenu = null; document.removeEventListener('click', handleClickOutsideContextMenu); } };
    const handleClickOutsideContextMenu = (event) => { if (activeContextMenu && !activeContextMenu.contains(event.target) && !event.target.closest('.post-options-button')) { closeActiveContextMenu(); } else if (activeContextMenu) { document.addEventListener('click', handleClickOutsideContextMenu, { once: true }); } };
    const handleDeleteMeme = (memeId) => {
        if (!currentUser) return; const mTD = allMemes.find(m=>m.id===memeId); if (!mTD||mTD.creatorId!==currentUser.uid){showInPageNotification("Only owner can delete.","error");return;}
        if (confirm("Delete this meme forever?")) { showSpinner(); const upd={}; upd[`/memes/${memeId}`]=null;upd[`/comments/${memeId}`]=null; database.ref().update(upd).then(()=>showInPageNotification("Meme deleted.","success")).catch(e=>{console.error("Delete error:",e);showInPageNotification("Delete failed: "+e.message,"error");}).finally(hideSpinner);}
    };

    // --- Feed Management & Rendering ---
    const setActiveFeedTab = (feedName) => { document.querySelectorAll('.feed-tabs .feed-tab-btn').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-selected','false');if(b.dataset.feed===feedName){b.classList.add('active');b.setAttribute('aria-selected','true');memeGalleryPanel?.setAttribute('aria-labelledby',b.id);}}); activeFeed = feedName; };
    const getFollowingFeedMemes = async (baseMemesToFilter) => { if (!currentUser||!userFollowData.following)return[]; const fIds=Object.keys(userFollowData.following); if(fIds.length===0)return[]; return baseMemesToFilter.filter(m=>fIds.includes(m.creatorId)).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)); };
    const getUserFavoritesFeedMemes = async (baseMemesToFilter, userIdForFavorites) => { if(!userIdForFavorites)return[]; const uF=(userIdForFavorites===currentUser?.uid)?userFollowData.favorites:(await database.ref(`user-favorites/${userIdForFavorites}`).once('value')).val(); if(!uF)return[]; const fMIds=Object.keys(uF); if(fMIds.length===0)return[]; let fM=baseMemesToFilter.filter(m=>fMIds.includes(m.id)); const foIds=new Set(fM.map(m=>m.id)); const mIds=fMIds.filter(id=>!foIds.has(id)); if(mIds.length>0){const mP=mIds.map(id=>database.ref(`memes/${id}`).once('value').then(s=>s.exists()?{id:s.key,...s.val()}:null));const fMs=(await Promise.all(mP)).filter(Boolean);fM=fM.concat(fMs);} return fM.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));};
    const renderGalleryForCurrentFeed = async () => { if(currentVisibleView!==galleryView)return; showSpinner(); let mtd=[]; const sT=searchBar.value.toLowerCase().trim(); let bM=[...allMemes]; if(sT){bM=allMemes.filter(m=>(m.description&&m.description.toLowerCase().includes(sT))||(m.creatorName&&m.creatorName.toLowerCase().includes(sT)));} try{switch(activeFeed){case 'new':mtd=[...bM].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));break;case 'following':if(currentUser)mtd=await getFollowingFeedMemes(bM);else showInPageNotification("Login for following feed.","info");break;case 'favorites':if(currentUser)mtd=await getUserFavoritesFeedMemes(bM,currentUser.uid);else showInPageNotification("Login for favorites.","info");break;case 'for-you':default:mtd=[...bM].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));break;}}catch(e){console.error(`Error feed ${activeFeed}:`,e);showInPageNotification(`Could not load ${activeFeed} feed.`,"error");} currentFeedMemes=mtd; renderGallery(currentFeedMemes,'meme-gallery'); hideSpinner();};
    const switchFeed = (feedName) => { setActiveFeedTab(feedName); renderGalleryForCurrentFeed(); showInPageNotification(`Switched to "${feedName.replace(/-/g,' ')}" feed.`,'info',1500);};
    const applySearchFilter = () => { if(currentVisibleView===galleryView)renderGalleryForCurrentFeed(); };

    // --- Account Page Management ---
    const navigateToAccountPage = (userId) => { if (!userId) return; currentAccountPageUserId = userId; switchMainView(accountView); loadAccountPage(userId); window.location.hash = `#/user/${userId}`; };
    const loadAccountPage = async (userId) => {
        if (!userId || !accountView) return; showSpinner();
        accountPhotoEl.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; accountDisplayNameEl.textContent = 'Loading...'; accountEmailEl.textContent = ''; accountEmailEl.classList.add('hidden'); accountMemeCountStatEl.textContent = 'Memes: ...'; accountFollowerCountStatEl.textContent = 'Followers: ...'; accountFollowingCountStatEl.textContent = 'Following: ...'; accountFollowUnfollowBtn.classList.add('hidden'); accountEditProfileBtn.classList.add('hidden');
        try {
            const userSnap = await database.ref(`users/${userId}`).once('value'); const userData = userSnap.val();
            if (!userData) { accountDisplayNameEl.textContent = 'User Not Found'; showInPageNotification("User not found.","error"); hideSpinner(); return; }
            accountPhotoEl.src = userData.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(userData.displayName || 'User')}&fontSize=36`; accountDisplayNameEl.textContent = userData.displayName || 'Anonymous User';
            if (currentUser && currentUser.uid === userId && userData.email) { accountEmailEl.textContent = userData.email; accountEmailEl.classList.remove('hidden'); }
            if (currentUser) { if (currentUser.uid === userId) accountEditProfileBtn.classList.remove('hidden'); else { accountFollowUnfollowBtn.classList.remove('hidden'); accountFollowUnfollowBtn.dataset.targetUserId = userId; await checkAndSetFollowButtonState(userId, accountFollowUnfollowBtn); } }
            const [memeCountSnap, followerCountSnap, followingCountSnap] = await Promise.all([database.ref('memes').orderByChild('creatorId').equalTo(userId).once('value'), database.ref(`followers/${userId}`).once('value'), database.ref(`following/${userId}`).once('value')]);
            accountMemeCountStatEl.innerHTML = `Memes: <strong>${memeCountSnap.numChildren()}</strong>`; accountFollowerCountStatEl.innerHTML = `Followers: <strong>${followerCountSnap.numChildren()}</strong>`; accountFollowingCountStatEl.innerHTML = `Following: <strong>${followingCountSnap.numChildren()}</strong>`;
            const defaultAccountTabBtn = document.getElementById('account-tab-memes'); setActiveAccountTab('account-memes-content', defaultAccountTabBtn);
        } catch (error) { console.error(`Error loading account ${userId}:`, error); accountDisplayNameEl.textContent = 'Error Loading'; showInPageNotification('Could not load profile.', 'error');
        } finally { hideSpinner(); }
    };
    const setActiveAccountTab = (tabContentId, clickedTabBtn) => {
        document.querySelectorAll('#account-view .account-tab-content').forEach(c => c.classList.remove('active')); document.querySelectorAll('#account-view .account-tabs .tab-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected','false');});
        const tCE = document.getElementById(tabContentId); if (tCE) { tCE.classList.add('active'); activeAccountTab = tabContentId; } if (clickedTabBtn) { clickedTabBtn.classList.add('active'); clickedTabBtn.setAttribute('aria-selected','true'); }
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
        if (!userId) return; const gE = accountMemeGallery; if(gE) gE.innerHTML = '<p>Loading memes...</p>'; else return;
        try { let uM = allMemes.filter(m=>m.creatorId===userId); if(uM.length===0&&allMemes.length>0){const s=await database.ref('memes').orderByChild('creatorId').equalTo(userId).once('value'); uM=[];s.forEach(cs=>uM.push({id:cs.key,...cs.val()}));} renderGallery(uM.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)), gE.id);
        } catch (e) { console.error(`Error loading user memes ${userId}:`, e); if(gE) gE.innerHTML = '<p>Could not load memes.</p>'; }
    };
    const loadUserFavorites = async (userIdToLoadFavoritesFor) => {
        if (!userIdToLoadFavoritesFor) return; const gE = accountFavoritesGallery; if(gE) gE.innerHTML = '<p>Loading favorites...</p>'; else return;
        try { const uFD = (currentUser&&userIdToLoadFavoritesFor===currentUser.uid)?userFollowData.favorites:(await database.ref(`user-favorites/${userIdToLoadFavoritesFor}`).once('value')).val(); const fMIds = uFD?Object.keys(uFD):[]; if(fMIds.length===0){if(gE)gE.innerHTML='<p>No favorites yet.</p>';return;} let fM=allMemes.filter(m=>fMIds.includes(m.id)); const foIds=new Set(fM.map(m=>m.id)); const mIds=fMIds.filter(id=>!foIds.has(id)); if(mIds.length>0){const mP=mIds.map(id=>database.ref(`memes/${id}`).once('value').then(s=>s.exists()?{id:s.key,...s.val()}:null)); const fMs=(await Promise.all(mP)).filter(Boolean);fM=fM.concat(fMs);} renderGallery(fM.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)), gE.id);
        } catch (e) { console.error(`Error loading favorites for ${userIdToLoadFavoritesFor}:`, e); if(gE) gE.innerHTML = '<p>Could not load favorites.</p>'; }
    };
    const loadUserFollowList = async (targetUserId, listType) => {
        const cId=listType==='followers'?'account-followers-content':'account-following-content'; const cE=document.getElementById(cId); if(!cE)return; cE.innerHTML=`<p>Loading ${listType}...</p>`;
        const path=listType==='followers'?`followers/${targetUserId}`:`following/${targetUserId}`;
        try { const lS=await database.ref(path).once('value'); const uIds=lS.val()?Object.keys(lS.val()):[]; if(uIds.length===0){cE.innerHTML=`<p>No ${listType} found.</p>`;return;}
            const uP=uIds.map(uid=>database.ref(`users/${uid}`).once('value')); const uS=await Promise.all(uP); cE.innerHTML=''; const frag=document.createDocumentFragment();
            uS.forEach(uSn=>{if(uSn.exists()){const uD=uSn.val();const uId=uSn.key; const itm=document.createElement('div');itm.className='user-list-item';itm.dataset.userId=uId; const av=document.createElement('img');av.className='user-list-avatar';av.src=uD.photoURL||`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(uD.displayName||'U')}&fontSize=36`;av.alt=`${uD.displayName||'User'}'s avatar`; const nL=document.createElement('a');nL.className='user-list-name';nL.href=`#/user/${uId}`;nL.textContent=uD.displayName||'Anon';nL.onclick=(e)=>{e.preventDefault();navigateToAccountPage(uId);}; itm.appendChild(av);itm.appendChild(nL); if(currentUser && currentUser.uid !== uId){const fB=document.createElement('button');fB.className='follow-action-btn nav-button';fB.dataset.userId=uId;checkAndSetFollowButtonState(uId,fB);fB.addEventListener('click',(e)=>{e.stopPropagation();handleFollowToggle(uId,e.currentTarget);});itm.appendChild(fB);} frag.appendChild(itm);}}); cE.appendChild(frag);
        } catch(e){console.error(`Error loading ${listType} for ${targetUserId}:`,e);cE.innerHTML=`<p>Could not load ${listType}.</p>`;}
    };

    // --- Follow/Unfollow Logic ---
    const loadUserFollowData = async (userId) => {
        if (!userId) { userFollowData = { following:{}, followers:{}, favorites:{}, settings:{theme:localStorage.getItem('theme')||'vaporwave',emailNotifications:false}}; initTheme(); return; }
        try {
            const [fS,frS,fvS,stS] = await Promise.all([database.ref(`following/${userId}`).once('value'),database.ref(`followers/${userId}`).once('value'),database.ref(`user-favorites/${userId}`).once('value'),database.ref(`users/${userId}/settings`).once('value')]);
            userFollowData.following=fS.val()||{}; userFollowData.followers=frS.val()||{}; userFollowData.favorites=fvS.val()||{}; userFollowData.settings=stS.val()||{theme:localStorage.getItem('theme')||'vaporwave',emailNotifications:false};
            initTheme(); // Apply theme after settings are loaded/defaulted
     if (currentVisibleView === galleryView) renderGalleryForCurrentFeed(); 
else if (currentVisibleView === accountView && currentAccountPageUserId) loadAccountPage(currentAccountPageUserId);
        } catch (e) { console.error("Error loading user data bundle:",e); initTheme(); /* Still apply default/localStorage theme */ }
    };
    const handleFollowToggle = async (targetUserId, buttonElement) => {
        if(!currentUser||!targetUserId||currentUser.uid===targetUserId){if(!currentUser)openModal('auth');return;} showSpinner();const cU=currentUser.uid;const iCF=!!userFollowData.following[targetUserId];
        const oBS={isFollowing:iCF,text:buttonElement.textContent,classList:buttonElement.className}; // Save original button state
        buttonElement.textContent=iCF?'Follow':'Unfollow';buttonElement.classList.toggle('following',!iCF); // Optimistic UI
        if(iCF)delete userFollowData.following[targetUserId];else userFollowData.following[targetUserId]=true;
        const upd={};if(iCF){upd[`/following/${cU}/${targetUserId}`]=null;upd[`/followers/${targetUserId}/${cU}`]=null;}else{upd[`/following/${cU}/${targetUserId}`]=true;upd[`/followers/${targetUserId}/${cU}`]=true;}
        try {
            await database.ref().update(upd);
            document.querySelectorAll(`.follow-creator-btn[data-user-id="${targetUserId}"], .follow-action-btn[data-user-id="${targetUserId}"]`).forEach(b=>checkAndSetFollowButtonState(targetUserId,b));
            if(currentVisibleView===accountView&&(currentAccountPageUserId===cU||currentAccountPageUserId===targetUserId)){const dId=currentAccountPageUserId;const[nFrC,nFgC]=await Promise.all([database.ref(`followers/${dId}`).once('value').then(s=>s.numChildren()),database.ref(`following/${dId}`).once('value').then(s=>s.numChildren())]);if(accountFollowerCountStatEl&¤tAccountPageUserId===dId)accountFollowerCountStatEl.innerHTML=`Followers: <strong>${nFrC}</strong>`;if(accountFollowingCountStatEl&¤tAccountPageUserId===dId)accountFollowingCountStatEl.innerHTML=`Following: <strong>${nFgC}</strong>`;}
            if(!iCF){createNotification(targetUserId,'follow',currentUser.uid,currentUser.displayName||'Someone',null,`${currentUser.displayName||'Someone'} started following you.`,'user');}
            showInPageNotification(iCF?`Unfollowed.`:`Now following.`,'success');
        } catch(e){console.error("Follow toggle error:",e);showInPageNotification("Follow update failed: "+e.message,"error");userFollowData.following=oBS.isFollowing?{...userFollowData.following,[targetUserId]:true}:(delete userFollowData.following[targetUserId],userFollowData.following);if(buttonElement){buttonElement.textContent=oBS.text;buttonElement.className=oBS.classList;} } finally {hideSpinner();}
    };
    const checkAndSetFollowButtonState = (targetUserId, buttonElement) => {
        if(!buttonElement||!currentUser||currentUser.uid===targetUserId){if(buttonElement)buttonElement.classList.add('hidden');return;} buttonElement.classList.remove('hidden');
        const iF=userFollowData.following&&userFollowData.following[targetUserId]; buttonElement.textContent=iF?'Unfollow':'Follow'; buttonElement.classList.toggle('following',!!iF);
    };


    // --- Auth State Change Handler ---
    auth.onAuthStateChanged(user => {
        console.log("Auth state changed. User:", user ? user.uid : null);
        const previousUserUid = currentUser?.uid;
        updateUIForAuthState(user); // Sets currentUser, loads userFollowData, updates nav
        if (user && !previousUserUid) { loadInitialData(true); } // Just logged in
        else if (!user && previousUserUid) { // Just logged out
            if (currentVisibleView === accountView || (currentVisibleView === galleryView && (activeFeed === 'favorites' || activeFeed === 'following'))) { window.location.hash = ''; switchMainView(galleryView); setActiveFeedTab('for-you'); renderGalleryForCurrentFeed(); }
            currentAccountPageUserId = null;
        } else if (!user && !previousUserUid) { loadInitialData(false); } // Initial load, no user session
        else if (user && previousUserUid && user.uid === previousUserUid) { // Session refreshed
            loadUserFollowData(user.uid).then(() => { if (currentVisibleView === galleryView) renderGalleryForCurrentFeed(); else if (currentVisibleView === accountView && currentAccountPageUserId) loadAccountPage(currentAccountPageUserId); });
        }
    });

    // --- Event Listeners ---
    homeLink?.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = ''; switchMainView(galleryView); setActiveFeedTab('for-you'); if(searchBar) searchBar.value = ''; renderGalleryForCurrentFeed(); });
    myAccountBtn?.addEventListener('click', () => { if (currentUser) navigateToAccountPage(currentUser.uid); else openModal('auth'); });
    feedTabsContainer?.addEventListener('click', (e) => { const b = e.target.closest('.feed-tab-btn'); if (b) { const fN = b.dataset.feed; if (fN) { if ((fN==='following'||fN==='favorites')&&!currentUser) {openModal('auth');return;} switchMainView(galleryView); switchFeed(fN);}}});
    accountTabsContainer?.addEventListener('click', (e) => { const b = e.target.closest('.tab-btn'); if (b) { const tId = b.dataset.tabTarget; if (tId) setActiveAccountTab(tId, b);}});
    accountFollowUnfollowBtn?.addEventListener('click', (e) => { const tId = e.currentTarget.dataset.targetUserId; if (tId) handleFollowToggle(tId, e.currentTarget); });
    accountEditProfileBtn?.addEventListener('click', () => { if(currentUser) openModal('settings'); else showInPageNotification("Login to edit settings.", "info");}); // Changed to open settings modal
    loginPromptBtn?.addEventListener('click', () => openModal('auth'));
    uploadBtn?.addEventListener('click', () => { if(currentUser) openModal('upload'); else openModal('auth');});
    settingsBtn?.addEventListener('click', () => openModal('settings'));
    themeSelector?.addEventListener('change', (e) => { const nt = e.target.value; document.body.setAttribute('data-theme', nt); localStorage.setItem('theme', nt); const smts = document.querySelector('#settingsFormModal #settingThemeModal'); if(smts)smts.value=nt; if(currentUser && userFollowData.settings) { userFollowData.settings.theme = nt; database.ref(`users/${currentUser.uid}/settings/theme`).set(nt).catch(err => console.warn("Failed to save theme to DB:", err));}});
    searchBar?.addEventListener('input', applySearchFilter);
    notificationsBtn?.addEventListener('click', (e) => { e.stopPropagation(); const dr = notificationDropdownContainer.querySelector('.notification-dropdown'); if(dr){closeNotificationDropdown();}else{if(!currentUser){showInPageNotification("Login to see notifications.","info");return;} const nd=document.createElement('div');nd.className='notification-dropdown';nd.setAttribute('aria-label','Notifications List');nd.innerHTML='<p style="text-align:center; padding:10px;">Loading...</p>';notificationDropdownContainer.appendChild(nd);notificationsBtn.setAttribute('aria-expanded','true');database.ref(`user-notifications/${currentUser.uid}`).orderByChild('timestamp').limitToLast(20).once('value').then(s=>{const nlist=[];s.forEach(cs=>nlist.unshift({id:cs.key,...cs.val()}));renderNotificationDropdown(nlist);}).catch(err=>{console.error("Error fetching notifications for dropdown:",err);if(nd)nd.innerHTML='<p style="color:var(--error-color);text-align:center;padding:10px;">Could not load notifications.</p>';});}});
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
    const loadInitialData = (isUserContextJustKnown = false) => {
        if(initialDataLoaded && !isUserContextJustKnown && !isUserContextJustKnown) { // Avoid re-entry unless user state newly known OR forceReload
             if(currentVisibleView === galleryView) renderGalleryForCurrentFeed(); // Still refresh gallery if memes updated
             return;
        }
        showSpinner();
        if(!initialDataLoaded) initTheme(); // Set theme on very first load attempt

        database.ref('memes').on('value', snapshot => { // Persistent listener for memes
            allMemes = []; const memesData = snapshot.val() || {};
            for (const key in memesData) { allMemes.push({ id: key, ...memesData[key] }); }
            console.log("All memes updated/fetched:", allMemes.length);

            if (!initialDataLoaded || isUserContextJustKnown) {
                if (!window.location.hash) {
                    if (currentVisibleView !== galleryView) switchMainView(galleryView);
                    setActiveFeedTab(currentUser && activeFeed !== 'for-you' && activeFeed !== 'new' ? activeFeed : 'for-you');
                    renderGalleryForCurrentFeed();
                } else {
                    handleHashChange();
                }
                initialDataLoaded = true;
            } else { // Subsequent meme updates from the listener
                if (currentVisibleView === galleryView) renderGalleryForCurrentFeed();
                else if (currentVisibleView === accountView) {
                     if (activeAccountTab === 'account-memes-content' && currentAccountPageUserId) loadUserMemes(currentAccountPageUserId);
                     else if (activeAccountTab === 'account-favorites-content' && currentAccountPageUserId) loadUserFavorites(currentAccountPageUserId);
                }
            }
            hideSpinner(); // Usually hide after the first gallery render or update
        }, error => {
            console.error("Error fetching initial memes:", error);
            if(memeGallery) memeGallery.innerHTML = '<p style="color:red;">Could not load memes. Check connection.</p>';
            hideSpinner();
        });
    };

    initTheme();
    // auth.onAuthStateChanged will trigger the first meaningful data load.
    console.log("MemeDrop App: Structure Initialized. Waiting for Firebase auth.");
}); // End DOMContentLoaded
