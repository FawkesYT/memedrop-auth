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
    let currentFeedMemes = []; // Specifically for the main #meme-gallery
    let activeFeed = 'for-you';
    let currentAccountPageUserId = null;
    let activeAccountTab = 'account-memes-content';
    const commentsListeners = {};
    let userNotificationsListener = null;
    let unreadNotificationCount = 0;
    let activeContextMenu = null;
    let userFollowData = { following: {}, followers: {}, favorites: {} };

    // --- DOM Element References (Copied from previous correct version) ---
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
    const memeGallery = document.getElementById('meme-gallery'); // Main gallery
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
    const accountMemeGallery = document.getElementById('account-meme-gallery'); // User's own memes on account page
    const accountFavoritesGallery = document.getElementById('account-favorites-gallery'); // User's favs on account page
    const accountFollowersContent = document.getElementById('account-followers-content');
    const accountFollowingContent = document.getElementById('account-following-content');
    const modalContainer = document.getElementById('modal-container');
    const notificationArea = document.getElementById('notification-area');
    const spinnerOverlay = document.getElementById('spinner-overlay');


    // --- Utility Functions ---
    const showSpinner = () => spinnerOverlay?.classList.remove('hidden');
    const hideSpinner = () => spinnerOverlay?.classList.add('hidden');
    const showInPageNotification = (message, type = 'info', duration = 3500) => { /* ... full implementation ... */ };
    const timeAgo = (timestamp) => { /* ... full implementation ... */ };
    // (Make sure showInPageNotification and timeAgo full implementations are here)
    const initTheme = () => {
        const savedTheme = localStorage.getItem('theme') || 'vaporwave';
        document.body.setAttribute('data-theme', savedTheme);
        if(themeSelector) themeSelector.value = savedTheme;
        const settingsModalThemeSelector = document.querySelector('#settingsForm #settingThemeModal');
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
    const openModal = (modalType, data = null) => { /* ... full implementation ... */ };
    const attachModalListeners = (modalType, modalOverlayElement, modalData = null) => { /* ... full implementation ... */ };
    // (Make sure openModal and attachModalListeners full implementations are here)


    // --- Notification Logic ---
    const createNotification = (receivingUserId, type, actorUid, actorName, targetId, messageContent, targetType = 'meme') => { /* ... */};
    const updateNotificationBadge = (count) => { /* ... */ };
    const listenToUserNotifications = (userId) => { /* ... */ };
    const renderNotificationDropdown = (notifications) => { /* ... */ };
    const handleNotificationClick = (notification) => { /* ... */ };
    const closeNotificationDropdown = () => { /* ... */ };
    // (Make sure all notification function full implementations are here)

    // --- Context Menu (Post Options) ---
    const togglePostOptionsMenu = (meme, buttonElement) => { /* ... */ };
    const closeActiveContextMenu = () => { /* ... */ };
    const handleClickOutsideContextMenu = (event) => { /* ... */ };
    const handleDeleteMeme = (memeId) => { /* ... */ };
    // (Make sure all context menu function full implementations are here)


    // --- Meme Rendering (General) ---
    const renderGallery = (memesToDisplay, galleryElementId = 'meme-gallery') => {
        const galleryContainer = document.getElementById(galleryElementId);
        if (!galleryContainer) { console.warn(`Gallery container #${galleryElementId} not found.`); return; }
        galleryContainer.innerHTML = '';
        if (!memesToDisplay || memesToDisplay.length === 0) {
            galleryContainer.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; padding: 40px 0;">No memes found here!</p>`;
            return;
        }
        const fragment = document.createDocumentFragment();
        memesToDisplay.forEach((meme, index) => {
            const memeEl = createMemeElement(meme); // createMemeElement will be defined below
            if (memeEl) {
                memeEl.style.animationDelay = `${index * 0.05}s`;
                fragment.appendChild(memeEl);
            }
        });
        galleryContainer.appendChild(fragment);
    };


    // --- Feed Data Fetching Helpers (for main gallery feeds) ---
    const getFollowingFeedMemes = async (baseMemesToFilter) => {
        if (!currentUser || !userFollowData.following) return [];
        const followedUserIds = Object.keys(userFollowData.following);
        if (followedUserIds.length === 0) return [];
        const feedMemes = baseMemesToFilter.filter(meme => followedUserIds.includes(meme.creatorId));
        return feedMemes.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    };

    const getUserFavoritesFeedMemes = async (baseMemesToFilter, userIdForFavorites) => { // Used by main fav feed & account fav tab
        if (!userIdForFavorites) return []; // Needs a user ID
        const userFavs = userIdForFavorites === currentUser?.uid ? userFollowData.favorites : (await database.ref(`user-favorites/${userIdForFavorites}`).once('value')).val();
        if (!userFavs) return [];

        const favoritedMemeIds = Object.keys(userFavs);
        if (favoritedMemeIds.length === 0) return [];
        
        const feedMemes = baseMemesToFilter.filter(meme => favoritedMemeIds.includes(meme.id));
        // Sort by original creation date, or could store favoritedAt timestamp and sort by that
        return feedMemes.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    };


    // --- Core Feed Rendering Logic (for main gallery) ---
    const renderGalleryForCurrentFeed = async () => {
        if (currentVisibleView !== galleryView) { // This function is ONLY for the main gallery view
            return;
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
                    if (currentUser) memesToDisplay = await getFollowingFeedMemes(baseMemes);
                    else showInPageNotification("Login to see your following feed.", "info");
                    break;
                case 'favorites':
                    if (currentUser) memesToDisplay = await getUserFavoritesFeedMemes(baseMemes, currentUser.uid);
                    else showInPageNotification("Login to see your favorites.", "info");
                    break;
                case 'for-you':
                default:
                    memesToDisplay = [...baseMemes].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                    break;
            }
        } catch (error) {
            console.error(`Error preparing feed ${activeFeed}:`, error);
            showInPageNotification(`Could not load ${activeFeed.replace('-', ' ')} feed.`, "error");
        }
        currentFeedMemes = memesToDisplay; // Update global state for main gallery
        renderGallery(currentFeedMemes, 'meme-gallery'); // Explicitly render to main gallery
        hideSpinner();
    };


    // --- Meme Element Creation & Interactions (createMemeElement and its helpers) ---
    // (This function is very long, ensure its full definition is here)
    const createMemeElement = (meme) => { /* ... Your full implementation from previous response ... */ };
    const openMemeDetail = (meme) => { /* ... Your full implementation ... */ };
    const incrementMemeViewCount = (memeId) => { /* ... Your full implementation ... */ };
    const handleLike = (memeId) => handleLikeDislike(memeId, 'like');
    const handleDislike = (memeId) => handleLikeDislike(memeId, 'dislike');
    const handleLikeDislike = (memeId, actionType) => { /* ... Your full implementation ... */ };
    const handleFavoriteToggle = async (memeId, buttonElement) => { /* ... Your full implementation ... */ };
    const toggleComments = (memeId, postElement, toggleButton) => { /* ... Your full implementation ... */ };
    const renderComments = (snapshot, commentsListDiv, memeIdForCountUpdate) => { /* ... Your full implementation ... */ };
    const handleAddComment = async (event, memeId) => { /* ... Your full implementation ... */ };


    // --- Feed Tab Management (Main Gallery) ---
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
        activeFeed = feedName; // Update global activeFeed for main gallery
    };

    const switchFeed = (feedName) => { // For main gallery feeds
        if (!feedTabsContainer && currentVisibleView === galleryView) {
            // console.warn("Feed tabs container not found in gallery view.");
        }
        setActiveFeedTab(feedName);
        renderGalleryForCurrentFeed(); // This now uses the updated global activeFeed
        showInPageNotification(`Switched to "${feedName.replace(/-/g, ' ')}" feed.`, 'info', 1500);
    };


    // --- Account Page Management ---
    const navigateToAccountPage = (userId) => { /* ... Your full implementation ... */ };
    const loadAccountPage = async (userId) => { /* ... Your full implementation ... */ };
    const setActiveAccountTab = (tabContentId, clickedTabBtn) => { /* ... Your full implementation ... */ };
    const loadContentForActiveAccountTab = () => { /* ... Your full implementation ... */ };
    const loadUserMemes = async (userId) => { // For account page 'My Memes'
        if (!userId) return;
        const galleryEl = accountMemeGallery;
        if(galleryEl) galleryEl.innerHTML = '<p>Loading memes...</p>'; else return;
        try {
            // Filter from allMemes first for speed, fallback to query if needed or for freshness
            let userMemes = allMemes.filter(m => m.creatorId === userId);
            if (userMemes.length === 0 && allMemes.length > 0) { // User might have memes not yet in allMemes cache
                // This query is more definitive if allMemes isn't perfectly up-to-date for this specific user
                const snapshot = await database.ref('memes').orderByChild('creatorId').equalTo(userId).once('value');
                userMemes = [];
                snapshot.forEach(childSnap => userMemes.push({ id: childSnap.key, ...childSnap.val() }));
            }
            renderGallery(userMemes.sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0)), galleryEl.id);
        } catch (error) {
            console.error(`Error loading memes for user ${userId}:`, error);
            if(galleryEl) galleryEl.innerHTML = '<p>Could not load user memes.</p>';
        }
    };
    const loadUserFavorites = async (userIdToLoadFavoritesFor) => { // For account page 'Favorites'
         if (!userIdToLoadFavoritesFor) return;
        const galleryEl = accountFavoritesGallery;
        if(galleryEl) galleryEl.innerHTML = '<p>Loading favorites...</p>'; else return;
        try {
            // Use cached userFollowData if loading for current user, otherwise fetch
            const userFavsData = (currentUser && userIdToLoadFavoritesFor === currentUser.uid)
                ? userFollowData.favorites
                : (await database.ref(`user-favorites/${userIdToLoadFavoritesFor}`).once('value')).val();

            const favoritedMemeIds = userFavsData ? Object.keys(userFavsData) : [];
            if (favoritedMemeIds.length === 0) {
                if(galleryEl) galleryEl.innerHTML = '<p>No favorite memes yet.</p>';
                return;
            }
            // Filter from allMemes first
            let favoriteMemes = allMemes.filter(m => favoritedMemeIds.includes(m.id));
            // If some favorites are not in allMemes (e.g. very old memes not in initial load), fetch them individually
            const foundIds = new Set(favoriteMemes.map(m => m.id));
            const missingIds = favoritedMemeIds.filter(id => !foundIds.has(id));
            if (missingIds.length > 0) {
                const missingPromises = missingIds.map(id => database.ref(`memes/${id}`).once('value').then(s => s.exists() ? {id: s.key, ...s.val()} : null));
                const fetchedMissing = (await Promise.all(missingPromises)).filter(Boolean);
                favoriteMemes = favoriteMemes.concat(fetchedMissing);
            }
            renderGallery(favoriteMemes.sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0)), galleryEl.id);
        } catch (error) {
            console.error(`Error loading favorites for user ${userIdToLoadFavoritesFor}:`, error);
            if(galleryEl) galleryEl.innerHTML = '<p>Could not load favorites.</p>';
        }
    };
    const loadUserFollowList = async (targetUserId, listType) => { /* ... Your full implementation ... */ };

    // --- Follow/Unfollow Logic ---
    const loadUserFollowData = async (userId) => { /* ... Your full implementation ... */ };
    const handleFollowToggle = async (targetUserId, buttonElement) => { /* ... Your full implementation ... */ };
    const checkAndSetFollowButtonState = (targetUserId, buttonElement) => { /* ... Your full implementation ... */ };

    // --- UI Update Functions (like updateUIForAuthState) ---
    // (Ensure the full implementation of updateUIForAuthState is here)
    const handleLogout = () => { /* ... Your full implementation ... */ };

    // --- Auth State Change Handler ---
    auth.onAuthStateChanged(user => {
        console.log("Auth state changed. User:", user ? user.uid : null);
        const previousUserUid = currentUser?.uid;
        currentUser = user;
        updateUIForAuthState(user); // This will call loadUserFollowData if user logs in

        // Determine initial view or action based on auth state and URL hash
        if (!previousUserUid && user) { // Just logged in
            // User is now known, process hash or load default logged-in view
            handleHashChange(); // Will navigate or load default feed
        } else if (previousUserUid && !user) { // Just logged out
            // If on a view that requires auth, redirect or clear content
            if (currentVisibleView === accountView ||
                (currentVisibleView === galleryView && (activeFeed === 'favorites' || activeFeed === 'following'))) {
                window.location.hash = ''; // Go to home/default view
                switchMainView(galleryView);
                setActiveFeedTab('for-you');
                renderGalleryForCurrentFeed(); // Render public feed
            }
            currentAccountPageUserId = null;
        } else if (!previousUserUid && !user) { // Initial page load, no user session from Firebase yet
            handleHashChange(); // Check if there's a public hash route
        }
        // If user state hasn't changed (e.g., page refresh while logged in),
        // handleHashChange or renderGalleryForCurrentFeed (if on gallery) will be called by loadInitialData
    });

    // --- Event Listeners ---
    // (Ensure all your event listeners like homeLink, myAccountBtn, feedTabsContainer, etc. are fully here)
    // Make sure they call the correctly defined functions.
    homeLink?.addEventListener('click', (e) => { /* ... */ });
    myAccountBtn?.addEventListener('click', () => { /* ... */ });
    feedTabsContainer?.addEventListener('click', (e) => { /* ... */ });
    accountTabsContainer?.addEventListener('click', (e) => { /* ... */ });
    accountFollowUnfollowBtn?.addEventListener('click', (e) => { /* ... */ });
    loginPromptBtn?.addEventListener('click', () => openModal('auth'));
    uploadBtn?.addEventListener('click', () => { if(currentUser) openModal('upload'); else openModal('auth');});
    settingsBtn?.addEventListener('click', () => openModal('settings'));
    themeSelector?.addEventListener('change', (e) => { /* ... */ });
    searchBar?.addEventListener('input', () => {
        if (currentVisibleView === galleryView) {
             renderGalleryForCurrentFeed(); // This is the primary function for updating main gallery
        }
        // TODO: Add search filtering for account page galleries if desired
    });
    notificationsBtn?.addEventListener('click', (e) => { /* ... */ });
    document.body.addEventListener('click', (e) => { /* For closing dropdowns/menus ... */ });


    // --- Hash-based Routing ---
    const handleHashChange = () => { /* ... Your full implementation ... */ };
    window.addEventListener('hashchange', handleHashChange);

    // --- Initial Load Function ---
    const loadInitialData = () => {
        showSpinner();
        initTheme();

        database.ref('memes').on('value', snapshot => {
            allMemes = [];
            const memesData = snapshot.val() || {};
            for (const key in memesData) {
                allMemes.push({ id: key, ...memesData[key] });
            }
            // No initial sort for allMemes, sorting happens per feed
            console.log("All memes updated/fetched:", allMemes.length);

            // If not on a specific hash route, load default feed.
            // Hash change handler will take precedence if URL has a hash.
            if (!window.location.hash) {
                if (currentVisibleView !== galleryView) switchMainView(galleryView);
                // If activeFeed isn't set by hash or user action yet, default it.
                if (!activeFeed || (activeFeed !== 'for-you' && activeFeed !== 'new' && (!currentUser || (activeFeed !== 'following' && activeFeed !== 'favorites')))) {
                    setActiveFeedTab('for-you');
                }
                renderGalleryForCurrentFeed();
            } else {
                // Let handleHashChange (triggered by auth state or direct call if no auth change) decide the view.
                // It might call renderGalleryForCurrentFeed if it lands on the gallery.
                // Or it might call loadAccountPage.
                handleHashChange(); // Process hash *after* memes are loaded so account pages can show memes
            }
            hideSpinner(); // Usually hide after the first gallery render
        }, error => {
            console.error("Error fetching initial memes:", error);
            if(memeGallery) memeGallery.innerHTML = '<p style="color:red;">Could not load memes. Please check connection.</p>';
            hideSpinner();
        });
    };

    // Initial setup calls
    // initTheme(); // Moved into loadInitialData to ensure it runs before any rendering that might depend on theme vars
    // The first call to onAuthStateChanged will handle the initial view/data load logic.
    // If Firebase takes a while to determine auth state, loadInitialData might run first with currentUser=null
    loadInitialData();


    console.log("MemeDrop App: Fully Initialized.");
}); // End DOMContentLoaded
