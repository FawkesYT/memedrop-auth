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
    let allMemes = []; // Cache of all memes
    let currentFeedMemes = []; // Memes currently displayed in the main gallery
    let activeFeed = 'for-you'; // 'for-you', 'new', 'following', 'favorites'
    let currentAccountPageUserId = null;
    let activeAccountTab = 'account-memes-content';
    const commentsListeners = {};
    let userNotificationsListener = null;
    let unreadNotificationCount = 0;
    let activeContextMenu = null;
    let userFollowData = { following: {}, followers: {} }; // Cache user's own follow data

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
    const accountMemeGallery = document.getElementById('account-meme-gallery'); // For user's own memes
    const accountFavoritesGallery = document.getElementById('account-favorites-gallery'); // For user's favorites
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
            galleryView.classList.remove('hidden'); // Fallback
            currentVisibleView = galleryView;
        }
    };

    // --- UI Update Functions ---
    const updateUIForAuthState = (user) => {
        const prevUid = currentUser?.uid;
        currentUser = user; // Update global currentUser

        const currentLogoutBtn = document.getElementById('logoutBtn');
        if (currentLogoutBtn) currentLogoutBtn.removeEventListener('click', handleLogout);

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
            loadUserFollowData(user.uid); // Load user's own follow data
        } else {
            userInfoDiv.classList.add('hidden');
            userInfoDiv.innerHTML = '';
            loginPromptBtn.classList.remove('hidden');
            uploadBtn.classList.add('hidden');
            settingsBtn.classList.add('hidden');
            myAccountBtn.classList.add('hidden');
            document.getElementById('feed-following')?.classList.add('hidden');
            document.getElementById('feed-favorites')?.classList.add('hidden');

            userFollowData = { following: {}, followers: {} }; // Clear follow data

            if (userNotificationsListener && prevUid) {
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
                renderGalleryForCurrentFeed();
            }
        } else if (currentVisibleView === accountView) {
            if (!user) { // If on account page and logs out, go to gallery
                switchMainView(galleryView);
                setActiveFeedTab('for-you');
                renderGalleryForCurrentFeed();
            } else if (currentAccountPageUserId) { // If still logged in, refresh account page content (e.g. follow buttons)
                loadAccountPage(currentAccountPageUserId);
            }
        }
    };

    // --- Meme Rendering & Interaction ---
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

        imageContainer.addEventListener('click', (e) => {
            e.stopPropagation();
            incrementMemeViewCount(meme.id); // Increment view on click to open
            openMemeDetail(meme);
        });
        post.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                if (document.activeElement === post) {
                    e.preventDefault();
                    incrementMemeViewCount(meme.id);
                    openMemeDetail(meme);
                }
            }
        });

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
        creatorLink.addEventListener('click', (e) => {
            e.preventDefault();
            navigateToAccountPage(meme.creatorId);
        });
        creatorDiv.appendChild(creatorLink);

        if (currentUser && currentUser.uid !== meme.creatorId) {
            const followBtn = document.createElement('button');
            followBtn.className = 'follow-creator-btn';
            followBtn.dataset.userId = meme.creatorId;
            checkAndSetFollowButtonState(meme.creatorId, followBtn); // Set initial state
            followBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleFollowToggle(meme.creatorId, e.currentTarget);
            });
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
        const favoriteCount = meme.favoriteCount || 0; // Assuming you add this to meme object
        const isLiked = currentUser && meme.likes && meme.likes[currentUser.uid];
        const isDisliked = currentUser && meme.dislikes && meme.dislikes[currentUser.uid];
        const isFavorited = currentUser && userFollowData.favorites && userFollowData.favorites[meme.id]; // Check against user-favorites

        // Like Button
        const likeButton = document.createElement('button');
        likeButton.className = `action-button like-button ${isLiked ? 'liked' : ''}`;
        likeButton.title = isLiked ? "Unlike" : "Like";
        likeButton.setAttribute('aria-pressed', !!isLiked);
        likeButton.innerHTML = `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg><span class="like-count">${likeCount}</span>`;
        likeButton.onclick = (e) => { e.stopPropagation(); handleLike(meme.id); };
        actionsDiv.appendChild(likeButton);

        // Dislike Button
        const dislikeButton = document.createElement('button');
        dislikeButton.className = `action-button dislike-button ${isDisliked ? 'disliked' : ''}`;
        dislikeButton.title = isDisliked ? "Remove Dislike" : "Dislike";
        dislikeButton.setAttribute('aria-pressed', !!isDisliked);
        dislikeButton.innerHTML = `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="${isDisliked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3L8 14M5 2h4v10H5z"/></svg><span class="dislike-count">${dislikeCount}</span>`;
        dislikeButton.onclick = (e) => { e.stopPropagation(); handleDislike(meme.id); };
        actionsDiv.appendChild(dislikeButton);

        // Comment Button
        const commentToggleButton = document.createElement('button');
        commentToggleButton.className = 'action-button comment-toggle-button';
        commentToggleButton.title = "View Comments";
        commentToggleButton.setAttribute('aria-expanded', 'false');
        commentToggleButton.innerHTML = `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg><span class="comment-count-display">${commentCount}</span>`;
        commentToggleButton.onclick = (e) => { e.stopPropagation(); toggleComments(meme.id, post, commentToggleButton); };
        actionsDiv.appendChild(commentToggleButton);

        // Favorite Button
        const favoriteButton = document.createElement('button');
        favoriteButton.className = `action-button favorite-button ${isFavorited ? 'favorited' : ''}`;
        favoriteButton.title = isFavorited ? "Unfavorite" : "Favorite";
        favoriteButton.setAttribute('aria-pressed', !!isFavorited);
        favoriteButton.innerHTML = `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="${isFavorited ? 'var(--favorite-color)' : 'none'}" stroke="var(--favorite-color)" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg><span class="sr-only">Favorite</span>`; // No count on button
        favoriteButton.onclick = (e) => { e.stopPropagation(); handleFavoriteToggle(meme.id, e.currentTarget); };
        actionsDiv.appendChild(favoriteButton);

        // Views Counter
        const viewsCounterSpan = document.createElement('span');
        viewsCounterSpan.className = 'meme-views-counter';
        viewsCounterSpan.innerHTML = `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg> <span>${meme.viewCount || 0}</span>`;
        actionsDiv.appendChild(viewsCounterSpan);

        // Options button
        if (currentUser && currentUser.uid === meme.creatorId) {
            const optionsButton = document.createElement('button');
            optionsButton.className = 'action-button post-options-button';
            optionsButton.title = "More options";
            optionsButton.innerHTML = `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>`;
            optionsButton.onclick = (e) => { e.stopPropagation(); togglePostOptionsMenu(meme, optionsButton); };
            actionsDiv.appendChild(optionsButton);
        }
        post.appendChild(actionsDiv);

        const commentsSection = document.createElement('div');
        commentsSection.className = 'comments-section hidden';
        commentsSection.id = `comments-for-${meme.id}`;
        const commentsListAriaLabel = `Comments for meme: ${img.alt}`;
        commentsSection.innerHTML = `<h4>Comments</h4>
                                     <div class="comments-list" aria-live="polite" aria-label="${commentsListAriaLabel}"><p>Click comment icon to load/refresh.</p></div>
                                     ${currentUser ? `<form class="add-comment-form" data-meme-id="${meme.id}" aria-labelledby="comment-form-label-${meme.id}">
                                         <label id="comment-form-label-${meme.id}" class="sr-only">Add a comment for meme: ${img.alt}</label>
                                         <textarea name="commentText" placeholder="Add a comment..." required aria-required="true" rows="3"></textarea>
                                         <button type="submit" class="nav-button">Post</button>
                                     </form>` : '<p><small>Login to post comments.</small></p>'}`;
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

    const renderGallery = (memesToDisplay, galleryElementId = 'meme-gallery') => {
        const galleryContainer = document.getElementById(galleryElementId);
        if (!galleryContainer) return;
        galleryContainer.innerHTML = ''; // Clear previous
        if (!memesToDisplay || memesToDisplay.length === 0) {
            galleryContainer.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; padding: 40px 0;">No memes found. Try a different feed or upload your own!</p>`;
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
        // incrementMemeViewCount(meme.id); // Already called on click
        openModal('memeDetail', { meme });
    };

    const incrementMemeViewCount = (memeId) => {
        if (!memeId) return;
        const memeRef = database.ref(`memes/${memeId}/viewCount`);
        memeRef.transaction(currentCount => (currentCount || 0) + 1)
            .catch(error => console.warn("View count increment failed:", error.message));
    };


    // --- Feed Management ---
    const setActiveFeedTab = (feedName) => {
        document.querySelectorAll('.feed-tabs .feed-tab-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-selected', 'false');
            if (btn.dataset.feed === feedName) {
                btn.classList.add('active');
                btn.setAttribute('aria-selected', 'true');
                memeGalleryPanel?.setAttribute('aria-labelledby', btn.id);
            }
        });
        activeFeed = feedName;
    };

    const switchFeed = (feedName) => {
        if (!feedTabsContainer && currentVisibleView === galleryView) {
            console.warn("Feed tabs container not found in gallery view.");
            // return; // Don't return, still set activeFeed and render
        }
        setActiveFeedTab(feedName);
        renderGalleryForCurrentFeed(); // This will handle spinner
        showInPageNotification(`Switched to "${feedName.replace(/-/g, ' ')}" feed.`, 'info', 1500);
    };

    const renderGalleryForCurrentFeed = async () => {
        if (currentVisibleView !== galleryView && currentVisibleView !== accountView) { // Allow rendering in account view sub-galleries
             // If not on a view with a main gallery, don't proceed with main feed rendering
            if(currentVisibleView !== accountView) return;
        }
        showSpinner();
        let memesToDisplay = [];
        const searchTerm = searchBar.value.toLowerCase().trim();
        let baseMemes = [...allMemes];

        if (searchTerm) {
            baseMemes = allMemes.filter(meme =>
                (meme.description && meme.description.toLowerCase().includes(searchTerm)) ||
                (meme.creatorName && meme.creatorName.toLowerCase().includes(searchTerm))
            );
        }

        try {
            switch (activeFeed) {
                case 'new':
                    memesToDisplay = [...baseMemes].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                    break;
                case 'following':
                    if (currentUser) {
                        memesToDisplay = await getFollowingFeedMemes(baseMemes);
                    } else { showInPageNotification("Login to see your following feed.", "info"); }
                    break;
                case 'favorites':
                    if (currentUser) {
                        memesToDisplay = await getUserFavoritesFeedMemes(baseMemes);
                    } else { showInPageNotification("Login to see your favorites.", "info"); }
                    break;
                case 'for-you':
                default: // For now, "for-you" is same as "new"
                    memesToDisplay = [...baseMemes].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                    break;
            }
        } catch (error) {
            console.error(`Error preparing feed ${activeFeed}:`, error);
            showInPageNotification(`Could not load ${activeFeed} feed.`, "error");
        }

        currentFeedMemes = memesToDisplay;
        renderGallery(currentFeedMemes, 'meme-gallery'); // Render to main gallery
        hideSpinner();
    };

    // --- Account Page Management ---
    const navigateToAccountPage = (userId) => {
        if (!userId) return;
        currentAccountPageUserId = userId;
        switchMainView(accountView); // Switch view first
        loadAccountPage(userId);     // Then load content
        window.location.hash = `#/user/${userId}`;
    };

    const loadAccountPage = async (userId) => {
        if (!userId || !accountView) return;
        showSpinner();

        // Reset UI elements
        accountPhotoEl.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        accountDisplayNameEl.textContent = 'Loading...';
        accountEmailEl.textContent = ''; accountEmailEl.classList.add('hidden');
        accountMemeCountStatEl.textContent = 'Memes: ...';
        accountFollowerCountStatEl.textContent = 'Followers: ...';
        accountFollowingCountStatEl.textContent = 'Following: ...';
        accountFollowUnfollowBtn.classList.add('hidden');
        accountEditProfileBtn.classList.add('hidden');

        try {
            const userSnap = await database.ref(`users/${userId}`).once('value');
            const userData = userSnap.val();

            if (!userData) {
                accountDisplayNameEl.textContent = 'User Not Found';
                showInPageNotification('User profile not found.', 'error');
                hideSpinner(); return;
            }

            accountPhotoEl.src = userData.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(userData.displayName || 'User')}&backgroundColor=007bff,ff71ce,f92aad,4CAF50&backgroundType=gradientLinear&fontSize=36`;
            accountDisplayNameEl.textContent = userData.displayName || 'Anonymous User';
            if (currentUser && currentUser.uid === userId && userData.email) {
                accountEmailEl.textContent = userData.email;
                accountEmailEl.classList.remove('hidden');
            }

            if (currentUser) {
                if (currentUser.uid === userId) {
                    accountEditProfileBtn.classList.remove('hidden');
                } else {
                    accountFollowUnfollowBtn.classList.remove('hidden');
                    accountFollowUnfollowBtn.dataset.targetUserId = userId;
                    await checkAndSetFollowButtonState(userId, accountFollowUnfollowBtn);
                }
            }

            // Fetch counts in parallel
            const [memeCountSnap, followerCountSnap, followingCountSnap] = await Promise.all([
                database.ref('memes').orderByChild('creatorId').equalTo(userId).once('value'),
                database.ref(`followers/${userId}`).once('value'),
                database.ref(`following/${userId}`).once('value')
            ]);
            accountMemeCountStatEl.textContent = `Memes: ${memeCountSnap.numChildren()}`;
            accountFollowerCountStatEl.textContent = `Followers: ${followerCountSnap.numChildren()}`;
            accountFollowingCountStatEl.textContent = `Following: ${followingCountSnap.numChildren()}`;


            // Set default tab & load its content
            const defaultAccountTabBtn = document.getElementById('account-tab-memes');
            setActiveAccountTab('account-memes-content', defaultAccountTabBtn);

        } catch (error) {
            console.error(`Error loading account page for ${userId}:`, error);
            accountDisplayNameEl.textContent = 'Error Loading Profile';
            showInPageNotification('Could not load profile.', 'error');
        } finally {
            hideSpinner();
        }
    };

    const setActiveAccountTab = (tabContentId, clickedTabBtn) => {
        document.querySelectorAll('#account-view .account-tab-content').forEach(content => content.classList.remove('active'));
        document.querySelectorAll('#account-view .account-tabs .tab-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-selected', 'false');
        });

        const targetContentEl = document.getElementById(tabContentId);
        if (targetContentEl) {
            targetContentEl.classList.add('active');
            activeAccountTab = tabContentId;
        }
        if (clickedTabBtn) {
            clickedTabBtn.classList.add('active');
            clickedTabBtn.setAttribute('aria-selected', 'true');
        }
        loadContentForActiveAccountTab(); // Load content for the newly active tab
    };

    const loadContentForActiveAccountTab = () => {
        if (!currentAccountPageUserId || !activeAccountTab) return;
        showSpinner(); // Show spinner for tab content loading
        switch (activeAccountTab) {
            case 'account-memes-content':
                loadUserMemes(currentAccountPageUserId).finally(hideSpinner);
                break;
            case 'account-favorites-content':
                loadUserFavorites(currentAccountPageUserId).finally(hideSpinner);
                break;
            case 'account-followers-content':
                loadUserFollowList(currentAccountPageUserId, 'followers').finally(hideSpinner);
                break;
            case 'account-following-content':
                loadUserFollowList(currentAccountPageUserId, 'following').finally(hideSpinner);
                break;
            default:
                hideSpinner();
        }
    };

    const loadUserMemes = async (userId) => {
        if (!userId) return;
        const galleryEl = accountMemeGallery;
        if(galleryEl) galleryEl.innerHTML = '<p>Loading memes...</p>'; else return;
        try {
            const snapshot = await database.ref('memes').orderByChild('creatorId').equalTo(userId).once('value');
            const userMemes = [];
            snapshot.forEach(childSnap => {
                userMemes.push({ id: childSnap.key, ...childSnap.val() });
            });
            renderGallery(userMemes.sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0)), galleryEl.id);
        } catch (error) {
            console.error(`Error loading memes for user ${userId}:`, error);
            if(galleryEl) galleryEl.innerHTML = '<p>Could not load memes.</p>';
        }
    };

    const loadUserFavorites = async (userIdToLoadFavoritesFor) => {
        if (!userIdToLoadFavoritesFor) return;
        const galleryEl = accountFavoritesGallery;
        if(galleryEl) galleryEl.innerHTML = '<p>Loading favorites...</p>'; else return;

        try {
            const favoritesSnap = await database.ref(`user-favorites/${userIdToLoadFavoritesFor}`).once('value');
            const favoriteMemeIds = favoritesSnap.val() ? Object.keys(favoritesSnap.val()) : [];

            if (favoriteMemeIds.length === 0) {
                if(galleryEl) galleryEl.innerHTML = '<p>No favorite memes yet.</p>';
                return;
            }

            const memePromises = favoriteMemeIds.map(memeId =>
                database.ref(`memes/${memeId}`).once('value').then(snap => ({ id: snap.key, ...snap.val() }))
            );
            const favoriteMemesRaw = await Promise.all(memePromises);
            const favoriteMemes = favoriteMemesRaw.filter(meme => meme.id && meme.imageBase64); // Filter out deleted/invalid memes
            renderGallery(favoriteMemes.sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0)), galleryEl.id);
        } catch (error) {
            console.error(`Error loading favorites for user ${userIdToLoadFavoritesFor}:`, error);
            if(galleryEl) galleryEl.innerHTML = '<p>Could not load favorites.</p>';
        }
    };

    const loadUserFollowList = async (targetUserId, listType) => { // listType is 'followers' or 'following'
        const containerId = listType === 'followers' ? 'account-followers-content' : 'account-following-content';
        const containerEl = document.getElementById(containerId);
        if(!containerEl) return;
        containerEl.innerHTML = `<p>Loading ${listType}...</p>`;

        const path = listType === 'followers' ? `followers/${targetUserId}` : `following/${targetUserId}`;
        try {
            const listSnap = await database.ref(path).once('value');
            const userIds = listSnap.val() ? Object.keys(listSnap.val()) : [];

            if (userIds.length === 0) {
                containerEl.innerHTML = `<p>No ${listType} found.</p>`;
                return;
            }

            const userPromises = userIds.map(uid => database.ref(`users/${uid}`).once('value'));
            const userSnaps = await Promise.all(userPromises);

            containerEl.innerHTML = ''; // Clear loading message
            const fragment = document.createDocumentFragment();
            userSnaps.forEach(userSnap => {
                if (userSnap.exists()) {
                    const userData = userSnap.val();
                    const userId = userSnap.key;
                    const item = document.createElement('div');
                    item.className = 'user-list-item';
                    item.dataset.userId = userId;
                    const avatar = document.createElement('img');
                    avatar.className = 'user-list-avatar';
                    avatar.src = userData.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(userData.displayName || 'User')}&fontSize=36`;
                    avatar.alt = `${userData.displayName || 'User'}'s avatar`;
                    const nameLink = document.createElement('a');
                    nameLink.className = 'user-list-name';
                    nameLink.href = `#/user/${userId}`;
                    nameLink.textContent = userData.displayName || 'Anonymous User';
                    nameLink.onclick = (e) => { e.preventDefault(); navigateToAccountPage(userId); };

                    item.appendChild(avatar);
                    item.appendChild(nameLink);

                    if (currentUser && currentUser.uid !== userId) { // Don't show follow button for self
                        const followBtn = document.createElement('button');
                        followBtn.className = 'follow-action-btn nav-button'; // Using nav-button for consistency
                        followBtn.dataset.userId = userId;
                        checkAndSetFollowButtonState(userId, followBtn);
                        followBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            handleFollowToggle(userId, e.currentTarget);
                        });
                        item.appendChild(followBtn);
                    }
                    fragment.appendChild(item);
                }
            });
            containerEl.appendChild(fragment);

        } catch (error) {
            console.error(`Error loading ${listType} for ${targetUserId}:`, error);
            containerEl.innerHTML = `<p>Could not load ${listType}.</p>`;
        }
    };


    // --- Follow/Unfollow Logic ---
    const loadUserFollowData = async (userId) => { // Call this on login
        if (!userId) {
            userFollowData = { following: {}, followers: {}, favorites: {} }; // Reset
            return;
        }
        try {
            const [followingSnap, followersSnap, favoritesSnap] = await Promise.all([
                database.ref(`following/${userId}`).once('value'),
                database.ref(`followers/${userId}`).once('value'), // For completeness, though not always needed by client directly
                database.ref(`user-favorites/${userId}`).once('value')
            ]);
            userFollowData.following = followingSnap.val() || {};
            userFollowData.followers = followersSnap.val() || {};
            userFollowData.favorites = favoritesSnap.val() || {};
            // After loading, might need to refresh UI elements that depend on this
            // e.g., if a gallery is open, re-render it to update follow/favorite button states.
            if (currentVisibleView === galleryView) renderGalleryForCurrentFeed();
            else if (currentVisibleView === accountView && currentAccountPageUserId) {
                 // If on someone else's page, refresh its follow button
                 if(currentAccountPageUserId !== currentUser.uid) {
                    checkAndSetFollowButtonState(currentAccountPageUserId, accountFollowUnfollowBtn);
                 }
                 // Refresh follow buttons on any visible user lists or meme creator buttons within account view
                 document.querySelectorAll(`#${activeAccountTab} [data-user-id]`).forEach(el => {
                    if(el.classList.contains('follow-creator-btn') || el.classList.contains('follow-action-btn')){
                        checkAndSetFollowButtonState(el.dataset.userId, el);
                    }
                 });
            }


        } catch (error) {
            console.error("Error loading user follow/favorites data:", error);
        }
    };

    const handleFollowToggle = async (targetUserId, buttonElement) => {
        if (!currentUser || !targetUserId || currentUser.uid === targetUserId) {
            if(!currentUser) openModal('auth');
            return;
        }
        showSpinner();
        const currentUid = currentUser.uid;
        const isCurrentlyFollowing = userFollowData.following[targetUserId]; // Check cached data

        const updates = {};
        if (isCurrentlyFollowing) { // Unfollow
            updates[`/following/${currentUid}/${targetUserId}`] = null;
            updates[`/followers/${targetUserId}/${currentUid}`] = null;
            delete userFollowData.following[targetUserId]; // Update local cache
        } else { // Follow
            updates[`/following/${currentUid}/${targetUserId}`] = true; // serverTimestamp; for sorting/activity
            updates[`/followers/${targetUserId}/${currentUid}`] = true; // serverTimestamp;
            userFollowData.following[targetUserId] = true; // Update local cache
        }

        try {
            await database.ref().update(updates);
            if (buttonElement) {
                checkAndSetFollowButtonState(targetUserId, buttonElement); // Update this specific button
            }
            // Update all other follow buttons for this targetUser on the page
            document.querySelectorAll(`.follow-creator-btn[data-user-id="${targetUserId}"], .follow-action-btn[data-user-id="${targetUserId}"]`).forEach(btn => {
                if (btn !== buttonElement) checkAndSetFollowButtonState(targetUserId, btn);
            });

            // Update counts on account page if it's the current user's or the target user's page
            if (currentVisibleView === accountView) {
                if (currentAccountPageUserId === currentUid || currentAccountPageUserId === targetUserId) {
                    // Fetch and update follower/following counts for the displayed profile
                    const displayedUserId = currentAccountPageUserId;
                    const [newFollowerCount, newFollowingCount] = await Promise.all([
                        database.ref(`followers/${displayedUserId}`).once('value').then(s => s.numChildren()),
                        database.ref(`following/${displayedUserId}`).once('value').then(s => s.numChildren())
                    ]);
                    if(accountFollowerCountStatEl) accountFollowerCountStatEl.textContent = `Followers: ${newFollowerCount}`;
                    if(accountFollowingCountStatEl) accountFollowingCountStatEl.textContent = `Following: ${newFollowingCount}`;
                }
            }


            if (!isCurrentlyFollowing) { // Send notification only on follow
                const targetUserSnap = await database.ref(`users/${targetUserId}`).once('value');
                const targetUserData = targetUserSnap.val();
                if (targetUserData) { // Check if target user exists before notifying
                    createNotification(
                        targetUserId,
                        'follow',
                        currentUser.uid,
                        currentUser.displayName || 'Someone',
                        null, // No specific targetId for a follow action itself
                        `${currentUser.displayName || 'Someone'} started following you.`,
                        'user'
                    );
                }
            }
            showInPageNotification(isCurrentlyFollowing ? `Unfollowed user.` : `Now following user.`, 'success');
        } catch (error) {
            console.error("Error toggling follow state:", error);
            showInPageNotification("Could not update follow status: " + error.message, "error");
            // Revert local cache if DB update failed
            if (isCurrentlyFollowing) userFollowData.following[targetUserId] = true;
            else delete userFollowData.following[targetUserId];
        } finally {
            hideSpinner();
        }
    };

    const checkAndSetFollowButtonState = (targetUserId, buttonElement) => {
        if (!buttonElement || !currentUser || currentUser.uid === targetUserId) {
            if(buttonElement) buttonElement.classList.add('hidden'); // Hide if self or no user
            return;
        }
        buttonElement.classList.remove('hidden'); // Make sure it's visible
        const isFollowing = userFollowData.following && userFollowData.following[targetUserId];
        buttonElement.textContent = isFollowing ? 'Unfollow' : 'Follow';
        buttonElement.classList.toggle('following', !!isFollowing);
    };


    // --- Favorite Toggle Logic ---
    const handleFavoriteToggle = async (memeId, buttonElement) => {
        if (!currentUser || !memeId) {
            if(!currentUser) openModal('auth');
            return;
        }
        showSpinner();
        const currentUid = currentUser.uid;
        const isCurrentlyFavorited = userFollowData.favorites && userFollowData.favorites[memeId];

        const updates = {};
        // Update user-favorites path
        updates[`/user-favorites/${currentUid}/${memeId}`] = isCurrentlyFavorited ? null : true; // or serverTimestamp
        // Update meme's favoriteCount (transaction recommended for counters)
        // The `favoriteCount` on the meme object itself and the `memes/{memeId}/favorites/{userId}`
        // structure for indicating *who* favorited are slightly redundant with user-favorites.
        // Choose one source of truth for "who favorited" or keep them synced.
        // For simplicity, we'll focus on user-favorites for the list, and meme's favoriteCount for display.

        try {
            await database.ref().update(updates); // Update user-favorites

            // Transaction for meme's favoriteCount and its internal favorites list
            await database.ref(`memes/${memeId}`).transaction(memeData => {
                if (memeData) {
                    memeData.favorites = memeData.favorites || {};
                    memeData.favoriteCount = typeof memeData.favoriteCount === 'number' ? memeData.favoriteCount : 0;
                    if (isCurrentlyFavorited) { // Unfavoriting
                        if (memeData.favorites[currentUid]) {
                            memeData.favoriteCount = Math.max(0, memeData.favoriteCount - 1);
                            memeData.favorites[currentUid] = null;
                        }
                    } else { // Favoriting
                        if (!memeData.favorites[currentUid]) {
                            memeData.favoriteCount++;
                            memeData.favorites[currentUid] = true;
                            // Create notification for meme owner (if not self)
                            if (memeData.creatorId && memeData.creatorId !== currentUid) {
                                 memeData._pendingNotification = { type: 'favorite', memeOwnerId: memeData.creatorId, memeId: memeId };
                            }
                        }
                    }
                }
                return memeData;
            }, (error, committed, snapshot) => {
                 if (error) { console.error(`Meme Favorite transaction error:`, error); }
                 else if (committed) {
                    const updatedMeme = snapshot.val();
                    if (updatedMeme && updatedMeme._pendingNotification) {
                        const notifInfo = updatedMeme._pendingNotification;
                        createNotification(
                            notifInfo.memeOwnerId, 'favorite', currentUid, currentUser.displayName || 'Someone',
                            notifInfo.memeId, 'favorited your meme.', 'meme'
                        );
                        database.ref(`memes/${memeId}/_pendingNotification`).remove();
                    }
                 }
            });


            // Update local cache
            if (isCurrentlyFavorited) delete userFollowData.favorites[memeId];
            else userFollowData.favorites[memeId] = true;

            // Update button UI
            if (buttonElement) {
                buttonElement.classList.toggle('favorited', !isCurrentlyFavorited);
                buttonElement.title = isCurrentlyFavorited ? "Favorite" : "Unfavorite";
                const svg = buttonElement.querySelector('svg');
                if(svg) svg.style.fill = !isCurrentlyFavorited ? 'var(--favorite-color)' : 'none';
            }
             // If on favorites feed, re-render it
            if (currentVisibleView === galleryView && activeFeed === 'favorites') {
                renderGalleryForCurrentFeed();
            } else if (currentVisibleView === accountView && activeAccountTab === 'account-favorites-content' && currentAccountPageUserId === currentUid){
                loadUserFavorites(currentUid);
            }

            showInPageNotification(isCurrentlyFavorited ? 'Removed from favorites.' : 'Added to favorites!', 'success');

        } catch (error) {
            console.error("Error toggling favorite state:", error);
            showInPageNotification("Could not update favorite status: " + error.message, "error");
            // Revert local cache if DB update failed
            if (isCurrentlyFavorited) userFollowData.favorites[memeId] = true;
            else delete userFollowData.favorites[memeId];
        } finally {
            hideSpinner();
        }
    };


    // --- Feed Data Fetching (Conceptual for Following/Favorites Feeds) ---
    const getFollowingFeedMemes = async (baseMemesToFilter) => {
        if (!currentUser || !userFollowData.following) return [];
        const followedUserIds = Object.keys(userFollowData.following);
        if (followedUserIds.length === 0) return [];
        const feedMemes = baseMemesToFilter.filter(meme => followedUserIds.includes(meme.creatorId));
        return feedMemes.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    };

    const getUserFavoritesFeedMemes = async (baseMemesToFilter) => {
        if (!currentUser || !userFollowData.favorites) return [];
        const favoritedMemeIds = Object.keys(userFollowData.favorites);
        if (favoritedMemeIds.length === 0) return [];
        const feedMemes = baseMemesToFilter.filter(meme => favoritedMemeIds.includes(meme.id));
        return feedMemes.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); // Or by favorited time if stored
    };


    // --- Existing Functions (Assume they are defined here or pasted from original) ---
    // openModal, attachModalListeners, handleLogout, handleLike, handleDislike,
    // toggleComments, renderComments, handleAddComment,
    // createNotification, updateNotificationBadge, listenToUserNotifications, closeNotificationDropdown, handleNotificationClick,
    // togglePostOptionsMenu, closeActiveContextMenu, handleDeleteMeme,
    // initTheme, applySearchFilter (will call renderGalleryForCurrentFeed)

    // --- Auth State Change Handler ---
    auth.onAuthStateChanged(user => {
        console.log("Auth state changed. User:", user ? user.uid : null);
        const previousUserUid = currentUser?.uid; // Store previous UID to check if it's a new login/logout
        currentUser = user; // Update global currentUser
        updateUIForAuthState(user); // This will update nav buttons, load follow data etc.

        if (user && !previousUserUid) { // User just logged in
            // User is now known, safe to process hash or load default for logged-in user
            handleHashChange();
        } else if (!user && previousUserUid) { // User just logged out
            // If on a view that requires auth, redirect or clear content
            if (currentVisibleView === accountView ||
                (currentVisibleView === galleryView && (activeFeed === 'favorites' || activeFeed === 'following'))) {
                window.location.hash = ''; // Go to home/default view
                switchMainView(galleryView);
                setActiveFeedTab('for-you'); // Reset to a public feed
                renderGalleryForCurrentFeed();
            }
            currentAccountPageUserId = null; // Clear whose profile we might have been on
        } else if (!user && !previousUserUid) { // Initial load, no user determined yet by Firebase
            // Wait for Firebase to confirm no user, then process hash or load default public view
             handleHashChange(); // If hash exists, try to load public parts or default
        } else { // User state same (e.g. page refresh while logged in, or user changed but still logged in - unlikely)
            // If current view depends on user data (e.g. account page), refresh it
            if (currentVisibleView === accountView && currentAccountPageUserId) {
                loadAccountPage(currentAccountPageUserId);
            } else if (currentVisibleView === galleryView) {
                renderGalleryForCurrentFeed(); // Refresh gallery, e.g., for new likes
            }
        }
    });

    // --- Event Listeners ---
    homeLink?.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.hash = '';
        switchMainView(galleryView);
        setActiveFeedTab('for-you');
        renderGalleryForCurrentFeed();
        if(searchBar) searchBar.value = '';
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
                    openModal('auth');
                    return;
                }
                switchMainView(galleryView);
                switchFeed(feedName); // switchFeed calls setActiveFeedTab and renderGalleryForCurrentFeed
            }
        }
    });

    accountTabsContainer?.addEventListener('click', (e) => {
        const button = e.target.closest('.tab-btn');
        if (button) {
            const tabTargetId = button.dataset.tabTarget;
            if (tabTargetId) {
                setActiveAccountTab(tabTargetId, button); // setActiveAccountTab calls loadContentForActiveAccountTab
            }
        }
    });

    accountFollowUnfollowBtn?.addEventListener('click', (e) => {
        const targetUserId = e.currentTarget.dataset.targetUserId;
        if (targetUserId) handleFollowToggle(targetUserId, e.currentTarget);
    });

    loginPromptBtn?.addEventListener('click', () => openModal('auth'));
    uploadBtn?.addEventListener('click', () => { if(currentUser) openModal('upload'); else openModal('auth');});
    settingsBtn?.addEventListener('click', () => { if(currentUser) openModal('settings'); /* else openModal('auth'); // Or just hide if not logged in */});
    themeSelector?.addEventListener('change', (e) => {
        document.body.setAttribute('data-theme', e.target.value);
        localStorage.setItem('theme', e.target.value);
        // If settings modal is open, update its theme selector too
        const settingsModalThemeSelector = document.querySelector('#settingsForm #settingTheme');
        if (settingsModalThemeSelector) settingsModalThemeSelector.value = e.target.value;
    });
    searchBar?.addEventListener('input', () => {
        // Debounce search for better performance if desired
        if (currentVisibleView === galleryView) {
             renderGalleryForCurrentFeed();
        } else if (currentVisibleView === accountView && activeAccountTab === 'account-memes-content') {
            // TODO: Implement search/filter within user's own memes on account page if needed
        }
    });


    // --- Hash-based Routing ---
    const handleHashChange = () => {
        const hash = window.location.hash;
        if (hash.startsWith('#/user/')) {
            const userId = hash.substring('#/user/'.length);
            if (userId && userId !== currentAccountPageUserId) { // Only navigate if different user or not on account view
                navigateToAccountPage(userId);
            } else if (userId && userId === currentAccountPageUserId && currentVisibleView !== accountView) {
                switchMainView(accountView); // Ensure account view is visible if hash matches
            }
        } else if (hash.startsWith('#/meme/')) {
            // const memeId = hash.substring('#/meme/'.length);
            // TODO: Find meme by ID from allMemes and call openMemeDetail(foundMeme)
            // If meme not found in allMemes, maybe try fetching it directly.
            // For now, if not a user link, go to gallery
            if (currentVisibleView !== galleryView) {
                 switchMainView(galleryView);
                 setActiveFeedTab('for-you'); // Or last active feed
                 renderGalleryForCurrentFeed();
            }
        } else { // No specific route, or just '#'
            if (currentVisibleView !== galleryView) {
                switchMainView(galleryView);
                // setActiveFeedTab('for-you'); // Reset to default if desired
                // renderGalleryForCurrentFeed();
            }
        }
    };
    window.addEventListener('hashchange', handleHashChange);

    // --- Initial Load ---
    const loadInitialData = () => {
        showSpinner();
        initTheme(); // Load theme first

        database.ref('memes').orderByChild('createdAt').limitToLast(100).on('value', snapshot => { // Fetch initial batch, can paginate later
            allMemes = [];
            const memesData = snapshot.val() || {};
            for (const key in memesData) {
                allMemes.push({ id: key, ...memesData[key] });
            }
            allMemes.sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0)); // Ensure sorted for initial display
            console.log("Initial memes fetched:", allMemes.length);

            // Initial view determination based on hash and auth state (which should be known by now)
            if (!window.location.hash) { // No specific route in URL
                switchMainView(galleryView);
                setActiveFeedTab('for-you');
                renderGalleryForCurrentFeed();
            } else {
                handleHashChange(); // Process the hash to show appropriate view/content
            }
            hideSpinner();
        }, error => {
            console.error("Error fetching initial memes:", error);
            if(memeGallery) memeGallery.innerHTML = '<p style="color:red;">Could not load memes. Please try again later.</p>';
            hideSpinner();
        });
    };

    // Let onAuthStateChanged handle the very first call to determine user state,
    // then it can call loadInitialData or parts of it.
    // However, some parts of UI (like theme) can be set before auth.
    initTheme();

    // Call handleHashChange once on load if not handled by onAuthStateChanged's first run
    // This ensures if a user lands on a deep link directly, it's processed.
    // The onAuthStateChanged will run very quickly, usually before this.
    // If Firebase auth hasn't resolved yet, currentUser might be null.
    // The functions called by handleHashChange should be robust to currentUser being null.
    // A slightly safer approach is to let the *first* onAuthStateChanged callback trigger initial routing/data load.
    // For now, this direct call is okay for initial setup.
    // handleHashChange(); // This will be handled by onAuthStateChanged more reliably

    // --- PASTE YOUR EXISTING MODAL, NOTIFICATION, CONTEXT MENU, etc. FUNCTIONS HERE ---
    // Make sure to use the globally defined DOM element variables.
    // Example:
    // const openModal = (modalType, data = null) => { /* your code */ };
    // const togglePostOptionsMenu = (meme, buttonElement) => { /* your code */ };
    // etc.

    console.log("MemeDrop App: Initialized. Waiting for Firebase auth and data.");
}); // End DOMContentLoaded
