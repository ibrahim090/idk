// Initialize Firebase (Compat) - ONLINE MODE
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// State
const STATE = {
    cart: (() => {
        try {
            const stored = JSON.parse(localStorage.getItem('techzone_cart'));
            if (!Array.isArray(stored)) return [];
            // Heal corrupted data
            return stored.map(item => ({
                ...item,
                qty: (typeof item.qty === 'number' && !isNaN(item.qty)) ? item.qty : 1
            }));
        } catch (e) {
            return [];
        }
    })(),
    isAdmin: false
};

// --- TEMP: Seed Categories ---
window.seedCategories = async () => {
    const categories = [
        { id: 'cpu', name: 'Processors (CPUs)', type: 'component', icon: 'fas fa-microchip', color: '#00f3ff' },
        { id: 'gpu', name: 'Graphics Cards (GPUs)', type: 'component', icon: 'fas fa-video', color: '#39ff14' },
        { id: 'motherboard', name: 'Motherboards', type: 'component', icon: 'fas fa-server', color: '#ff00ff' },
        { id: 'ram', name: 'Memory (RAM)', type: 'component', icon: 'fas fa-memory', color: '#facc15' },
        { id: 'cooling', name: 'Cooling & Fans', type: 'component', icon: 'fas fa-fan', color: '#60a5fa' },
        { id: 'keyboard', name: 'Keyboards', type: 'accessory', icon: 'fas fa-keyboard', color: '#00f3ff' },
        { id: 'mouse', name: 'Mice & Pads', type: 'accessory', icon: 'fas fa-mouse', color: '#39ff14' },
        { id: 'headset', name: 'Headsets & Audio', type: 'accessory', icon: 'fas fa-headset', color: '#ff00ff' },
        { id: 'monitor', name: 'Monitors & Displays', type: 'accessory', icon: 'fas fa-desktop', color: '#facc15' }
    ];

    console.log("Seeding categories...");
    const batch = db.batch();

    // Check if collection is empty or just overwrite? Let's check IDs.
    // Actually, for simplicity, I'll just write them. If they exist, they update.
    for (const cat of categories) {
        const ref = db.collection('categories').doc(cat.id);
        batch.set(ref, cat);
    }

    try {
        await batch.commit();
        console.log("Categories seeded successfully!");
        alert("Categories seeded!");
    } catch (e) {
        console.error("Error seeding categories:", e);
    }
};

// --- CORE FUNCTIONS ---

// DOMContentLoaded wrapper
document.addEventListener('DOMContentLoaded', () => {
    // Check if we are on Admin Page or Storefront
    if (window.location.pathname.includes('admin.html')) {
        initAdmin();
    } else {
        initStorefront();
    }
});

/* ============================
   ADMIN PANEL LOGIC
   ============================ */
function initAdmin() {
    const authSection = document.getElementById('auth-section');
    const dashboardSection = document.getElementById('dashboard-section');
    const pinInput = document.getElementById('pin-input');
    const loginBtn = document.getElementById('login-btn');
    const authError = document.getElementById('auth-error');
    const addForm = document.getElementById('add-product-form');

    // 1. PIN Security
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            const pin = pinInput.value;
            // Hardcoded Simple PIN for demo
            if (pin === "1234") {
                authSection.classList.add('hidden');
                dashboardSection.classList.remove('hidden');
                dashboardSection.classList.remove('hidden');
                loadAdminInventory();
                loadAdminBanners();
                loadAdminCategories(); // Load categories
            } else {
                authError.textContent = "Access Denied: Invalid PIN";
                authError.classList.remove('hidden');
            }
        });
    }

    // 2. Add Product
    if (addForm) {
        addForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const btn = addForm.querySelector('button');
            const originalText = btn.textContent;
            btn.textContent = "Adding...";
            btn.disabled = true;

            const name = document.getElementById('p-name').value;
            const price = parseFloat(document.getElementById('p-price').value);
            const stock = parseInt(document.getElementById('p-stock').value) || 0;
            const category = document.getElementById('p-category').value;
            const desc = document.getElementById('p-desc').value; // NEW: description
            let image = document.getElementById('p-image').value;

            if (!category) {
                alert("Please select a category.");
                btn.disabled = false;
                btn.textContent = originalText;
                return;
            }

            // Use generic placeholder if empty
            if (!image) {
                image = "https://placehold.co/400x300/000000/39ff14?text=No+Image";
            }

            db.collection("products").add({
                name,
                price,
                stock,
                category,
                description: desc, // Save description
                image_url: image,
                created_at: firebase.firestore.FieldValue.serverTimestamp()
            }).then(() => {
                alert("Product added successfully!");
                addForm.reset();
                document.getElementById('p-stock').value = 1; // Reset stock default
                loadAdminInventory(); // Refresh list
            }).catch((error) => {
                console.error("Error adding document: ", error);
                alert("Error adding product: " + error.message + "\n\nCHECK YOUR API KEYS in firebase-config.js");
            }).finally(() => {
                btn.textContent = originalText;
                btn.disabled = false;
            });
        });
    }
    // 3. Banner Management
    const bannerForm = document.getElementById('add-banner-form');
    if (bannerForm) {
        bannerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const btn = bannerForm.querySelector('button');
            const originalText = btn.textContent;
            btn.textContent = "Adding...";
            btn.disabled = true;

            const title = document.getElementById('b-title').value;
            const subtitle = document.getElementById('b-subtitle').value;
            const image = document.getElementById('b-image').value;
            const link = document.getElementById('b-link').value;
            const btnText = document.getElementById('b-btn').value;
            const color = document.getElementById('b-color').value;
            const btnColor = document.getElementById('b-btn-color').value;

            db.collection("banners").add({
                title, subtitle, image_url: image, link, btn_text: btnText, color, btn_color: btnColor,
                created_at: firebase.firestore.FieldValue.serverTimestamp()
            }).then(() => {
                alert("Banner added!");
                bannerForm.reset();
                loadAdminBanners();
            }).catch(e => {
                alert("Error: " + e.message);
            }).finally(() => {
                btn.textContent = originalText;
                btn.disabled = false;
            });
        });
    }


    // 4. Category Management
    const categoryForm = document.getElementById('add-category-form');
    if (categoryForm) {
        // Auto-fill ID from Name
        document.getElementById('c-name').addEventListener('input', (e) => {
            const val = e.target.value;
            document.getElementById('c-id').value = val.toLowerCase().replace(/[^a-z0-9]/g, '');
        });

        categoryForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('c-name').value;
            const id = document.getElementById('c-id').value;
            const type = document.getElementById('c-type').value;
            const icon = document.getElementById('c-icon').value;
            const color = document.getElementById('c-color').value;

            if (!id) return alert("ID is required");

            db.collection("categories").doc(id).set({
                id, name, type, icon, color,
                created_at: firebase.firestore.FieldValue.serverTimestamp()
            }).then(() => {
                alert("Category added!");
                categoryForm.reset();
                loadAdminCategories();
            }).catch(err => {
                console.error(err);
                alert("Error adding category");
            });
        });
    }
}

function loadAdminBanners() {
    const list = document.getElementById('banner-list');
    if (!list) return;
    list.innerHTML = '<p class="text-gray-500 text-sm text-center">Loading...</p>';

    db.collection("banners").orderBy("created_at", "asc").get().then(snap => {
        list.innerHTML = '';
        if (snap.empty) {
            list.innerHTML = '<p class="text-gray-500 text-sm italic">No banners active.</p>';
            return;
        }

        snap.forEach(doc => {
            const data = doc.data();
            const el = document.createElement('div');
            el.className = "flex items-center gap-3 bg-black border border-gray-800 p-2 rounded group hover:border-[#39ff14] transition-colors";
            el.innerHTML = `
                <img src="${data.image_url}" class="w-10 h-10 object-cover rounded bg-gray-800">
                <div class="flex-1 min-w-0">
                    <p class="text-xs text-white font-bold truncate">${data.title}</p>
                    <p class="text-[10px] text-gray-500 truncate">${data.subtitle || ''}</p>
                </div>
                <button onclick="window.deleteBanner('${doc.id}')" class="text-gray-600 hover:text-red-500 p-1">
                    <i class="fas fa-trash"></i>
                </button>
            `;
            list.appendChild(el);
        });
    });
}

window.deleteBanner = (id) => {
    if (!confirm("Remove this banner?")) return;
    db.collection("banners").doc(id).delete().then(() => loadAdminBanners());
};

// Helper to toggle select all
window.toggleSelectAll = (source) => {
    const checkboxes = document.querySelectorAll('.product-checkbox');
    checkboxes.forEach(cb => cb.checked = source.checked);
    window.updateBatchDeleteUI();
};

// Helper to update UI based on selection
window.updateBatchDeleteUI = () => {
    const selected = document.querySelectorAll('.product-checkbox:checked');
    const btn = document.getElementById('batch-delete-btn');
    const countSpan = document.getElementById('selected-count');

    if (btn && countSpan) {
        countSpan.innerText = selected.length;
        if (selected.length > 0) {
            btn.classList.remove('hidden');
        } else {
            btn.classList.add('hidden');
        }
    }

    // Update header checkbox state
    const all = document.querySelectorAll('.product-checkbox');
    const selectAll = document.getElementById('select-all');
    if (selectAll) {
        if (all.length > 0 && selected.length === all.length) {
            selectAll.checked = true;
            selectAll.indeterminate = false;
        } else if (selected.length > 0) {
            selectAll.indeterminate = true;
            selectAll.checked = false;
        } else {
            selectAll.checked = false;
            selectAll.indeterminate = false;
        }
    }
};

// Batch Delete Function
window.deleteSelectedProducts = () => {
    const selected = document.querySelectorAll('.product-checkbox:checked');
    if (selected.length === 0) return;

    if (!confirm(`Are you sure you want to delete ${selected.length} products? This cannot be undone.`)) return;

    const btn = document.getElementById('batch-delete-btn');
    const originalText = btn.innerText;
    btn.innerText = "Deleting...";
    btn.disabled = true;

    // Create a batch (Note: Firestore batch limited to 500 ops)
    // For simplicity in this vanilla JS app, we'll use Promise.all
    // Correct way for >500 is creating multiple batches, but users won't select that many manually usually.
    const deletePromises = Array.from(selected).map(cb => {
        return db.collection("products").doc(cb.value).delete();
    });

    Promise.all(deletePromises).then(() => {
        alert("Products deleted successfully!");
        loadAdminInventory();
        document.getElementById('select-all').checked = false;
        btn.classList.add('hidden');
    }).catch(e => {
        console.error("Batch delete error", e);
        alert("Some deletions failed: " + e.message);
    }).finally(() => {
        btn.innerText = originalText;
        btn.disabled = false;
    });
};


function loadAdminInventory() {
    const tbody = document.getElementById('inventory-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="p-4 text-center">Loading...</td></tr>';

    db.collection("products").orderBy("created_at", "desc").get().then((querySnapshot) => {
        tbody.innerHTML = ''; // Clear loading
        document.getElementById('select-all').checked = false; // Reset header checkbox
        window.updateBatchDeleteUI(); // Reset button

        // Filter Logic
        const filterVal = document.getElementById('inventory-filter') ? document.getElementById('inventory-filter').value : '';

        let hasItems = false;
        querySnapshot.forEach((doc) => {
            const data = doc.data();

            // Apply Filter
            if (filterVal && data.category !== filterVal) {
                return; // Skip this item
            }

            hasItems = true;
            const row = document.createElement('tr');
            row.className = "hover:bg-gray-900/50 transition-colors";
            row.innerHTML = `
                <td class="p-3 text-center">
                    <input type="checkbox" value="${doc.id}" class="product-checkbox accent-[#39ff14] cursor-pointer w-4 h-4" onclick="window.updateBatchDeleteUI()">
                </td>
                <td class="p-3"><img src="${data.image_url}" class="w-10 h-10 object-cover rounded border border-gray-700"></td>
                <td class="p-3 font-semibold text-white">${data.name}</td>
                <td class="p-3"><span class="px-2 py-1 text-xs rounded bg-gray-800 text-gray-300">${data.category}</span></td>
                <td class="p-3 text-[#39ff14]">$${data.price}</td>
                <td class="p-3 font-mono text-[#00f3ff]">${data.stock || 0}</td>
                <td class="p-3 text-right">
                    <button class="text-red-500 hover:text-red-400 p-2" onclick="window.deleteProduct('${doc.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }).catch((e) => {
        console.error("Error loading inventory", e);
        // Special helpful message for permissions error
        let msg = e.message;
        if (msg.includes("permission-denied") || msg.includes("Missing or insufficient permissions")) {
            msg = "Permission Denied: Check your Firebase Database Rules or API Keys.";
        }
        tbody.innerHTML = `<tr><td colspan="6" class="text-red-500 p-4 font-bold text-center">${msg}</td></tr>`;
    });
}

// Global scope for onclick access
window.deleteProduct = (id) => {
    if (!confirm("Are you sure you want to delete this item?")) return;

    db.collection("products").doc(id).delete().then(() => {
        loadAdminInventory(); // Refresh
    }).catch((e) => {
        alert("Failed to delete: " + e.message);
    });
};

/* ============================
   CART LOGIC
   ============================ */

function injectCartModal() {
    if (document.getElementById('cart-modal')) return;

    const modalHTML = `
    <div id="cart-modal" class="fixed inset-0 z-[100] hidden">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity opacity-0" id="cart-backdrop"></div>
        
        <!-- Modal Panel -->
        <div class="absolute right-0 top-0 h-full w-full max-w-md bg-gray-900 border-l border-gray-800 shadow-2xl flex flex-col transform transition-transform duration-300 translate-x-full" id="cart-panel">
            <!-- Header -->
            <div class="p-6 border-b border-gray-800 flex items-center justify-between bg-gray-900/95 backdrop-blur">
                <h2 class="text-2xl font-black text-white italic">YOUR <span class="text-[#39ff14]">CART</span></h2>
                <button id="close-cart-btn" class="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full">
                    <i class="fas fa-times text-xl"></i>
                </button>
            </div>
            
            <!-- Items Area -->
            <div id="cart-items" class="flex-1 overflow-y-auto p-6 space-y-4">
                <!-- Cart items will be injected here -->
                <div class="text-center text-gray-500 mt-10">Your cart is empty.</div>
            </div>
            
            <!-- Footer -->
            <div class="p-6 border-t border-gray-800 bg-black/50 backdrop-blur-sm">
                <div class="flex justify-between items-center mb-6">
                    <span class="text-gray-400 font-bold uppercase text-sm">Total</span>
                    <span id="cart-total" class="text-3xl font-black text-[#39ff14]">$0.00</span>
                </div>
                <button onclick="alert('Checkout functionality coming soon!')" class="w-full bg-[#39ff14] text-black font-bold uppercase py-4 rounded hover:bg-[#32e010] transition-transform active:scale-95 shadow-[0_0_20px_rgba(57,255,20,0.3)] tracking-widest">
                    Checkout Now
                </button>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function setupCartModal() {
    // Ensure HTML exists
    injectCartModal();

    const modal = document.getElementById('cart-modal');
    const backdrop = document.getElementById('cart-backdrop');
    const panel = document.getElementById('cart-panel');
    const closeBtn = document.getElementById('close-cart-btn');
    const cartBtns = document.querySelectorAll('#cart-btn'); // Handle multiple triggers if any

    const openCart = () => {
        modal.classList.remove('hidden');
        // Small delay to allow display:block to apply before transition
        setTimeout(() => {
            backdrop.classList.remove('opacity-0');
            panel.classList.remove('translate-x-full');
        }, 10);
    };

    const closeCart = () => {
        backdrop.classList.add('opacity-0');
        panel.classList.add('translate-x-full');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300); // Match transition duration
    };

    // Attach listeners
    cartBtns.forEach(btn => btn.addEventListener('click', openCart));
    if (closeBtn) closeBtn.addEventListener('click', closeCart);
    if (backdrop) backdrop.addEventListener('click', closeCart);

    // Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            closeCart();
        }
    });
}

window.addToCart = function (product, qty = 1, btnElement = null) {
    // Product should have: id, name, price, image, stock (opt)
    const maxStock = product.stock || 999;

    // Check if item exists
    const existing = STATE.cart.find(item => item.id === product.id);
    const textCurrentQty = existing ? existing.qty : 0;

    if ((textCurrentQty + qty) > maxStock) {
        alert(`Sorry, only ${maxStock} items available.`);
        return;
    }

    if (existing) {
        existing.qty += qty;
    } else {
        STATE.cart.push({
            id: product.id,
            name: product.name,
            price: parseFloat(product.price),
            image: product.image_url || 'assets/placeholder.png', // Fallback
            qty: qty
        });
    }

    saveCart();
    updateCartUI();

    // Visual Feedback
    if (btnElement) {
        const originalContent = btnElement.innerHTML;
        btnElement.innerHTML = '<i class="fas fa-check"></i> Added';
        // btnElement.classList.add('bg-[#39ff14]'); // Keep original color or pulse?

        setTimeout(() => {
            btnElement.innerHTML = originalContent;
            // btnElement.classList.remove('bg-[#39ff14]');
        }, 2000);
    }

    // Auto-open cart on add
    const modal = document.getElementById('cart-modal');
    if (modal && modal.classList.contains('hidden')) {
        const btn = document.getElementById('cart-btn');
        if (btn) btn.click();
    }
};

// Wrapper for HTML onclicks from cards
window.addToCartFromCard = (btn, id, name, price, image, maxStock) => {
    // Prevent default if in form
    if (window.event) window.event.preventDefault();

    window.addToCart({
        id: id,
        name: name,
        price: price,
        image_url: image, // Mapped to expected property
        stock: maxStock
    }, 1, btn);
};

window.removeFromCart = function (index) {
    STATE.cart.splice(index, 1);
    saveCart();
    updateCartUI();
};

window.updateCartQty = function (index, change) {
    const item = STATE.cart[index];
    if (item) {
        item.qty += change;
        if (item.qty <= 0) {
            removeFromCart(index);
        } else {
            saveCart();
            updateCartUI();
        }
    }
};

function saveCart() {
    localStorage.setItem('techzone_cart', JSON.stringify(STATE.cart));
}

function updateCartUI() {
    const countBadge = document.getElementById('cart-count');
    const itemsContainer = document.getElementById('cart-items');
    const totalEl = document.getElementById('cart-total');

    // Update Badge
    const totalQty = STATE.cart.reduce((sum, item) => sum + item.qty, 0);
    if (countBadge) {
        countBadge.textContent = totalQty;
        countBadge.classList.toggle('hidden', totalQty === 0);
    }

    // Update Items
    if (!itemsContainer) return;

    if (STATE.cart.length === 0) {
        itemsContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-gray-500 space-y-4">
                <i class="fas fa-shopping-cart text-4xl opacity-20"></i>
                <p>Your cart is empty</p>
                <button onclick="document.getElementById('close-cart-btn').click()" class="text-[#39ff14] hover:underline text-sm uppercase font-bold">Start Shopping</button>
            </div>`;
        if (totalEl) totalEl.textContent = '$0.00';
        return;
    }

    let total = 0;
    itemsContainer.innerHTML = STATE.cart.map((item, index) => {
        total += item.price * item.qty;
        return `
        <div class="flex gap-4 bg-black/40 p-3 rounded-lg border border-gray-800">
            <img src="${item.image}" alt="${item.name}" class="w-20 h-20 object-cover rounded bg-gray-900">
            <div class="flex-1 flex flex-col justify-between">
                <div>
                    <h4 class="text-white font-bold text-sm line-clamp-2">${item.name}</h4>
                    <p class="text-[#39ff14] font-mono text-sm mt-1">$${item.price.toFixed(2)}</p>
                </div>
                <div class="flex items-center justify-between mt-2">
                    <div class="flex items-center space-x-3 bg-gray-900 rounded p-1">
                        <button onclick="updateCartQty(${index}, -1)" class="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white transition-colors">-</button>
                        <span class="text-white text-xs font-bold w-4 text-center">${item.qty}</span>
                        <button onclick="updateCartQty(${index}, 1)" class="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white transition-colors">+</button>
                    </div>
                    <button onclick="removeFromCart(${index})" class="text-red-500 hover:text-red-400 text-xs uppercase font-bold px-2">
                        Remove
                    </button>
                </div>
            </div>
        </div>`;
    }).join('');

    if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;
}

/* ============================
   STOREFRONT LOGIC
   ============================ */
/* ============================
   STOREFRONT LOGIC
   ============================ */
function initStorefront() {
    const path = window.location.pathname;

    // Initialize Search Listener (Must run on ALL pages)
    initSearch();

    // Load Cart for all pages
    updateCartUI();
    setupCartModal();

    // Initialize Hero Carousel on index
    if (path.includes('index.html') || path.endsWith('/')) {
        initCarousel();
        loadLatestArrivals(); // Featured
        loadHomeSidebar(); // NEW: Load Dynamic Sidebar
    }
    // Components Page - Dynamic
    else if (path.includes('components.html')) {
        loadDynamicSections('component', 'products');
    }
    // Accessories Page - Dynamic
    else if (path.includes('accessories.html')) {
        loadDynamicSections('accessory', 'products');
    }
    // Laptops Page
    else if (path.includes('laptops.html')) {
        loadDynamicSections('laptop', 'product-container');
    }
    // Category Collection Page (Dynamic)
    else if (path.includes('category.html')) {
        initCategoryPage();
    }
    // Product Details Page
    else if (path.includes('product.html')) {
        loadProductDetails(); // Now self-contained
    }
}

// 0. Home Sidebar Loader
function loadHomeSidebar() {
    const compList = document.getElementById('home-components-list');
    const accList = document.getElementById('home-accessories-list');
    const lapList = document.getElementById('home-laptops-list');

    // Only run if at least one list exists (meaning we're on home or layout has sidebar)
    if (!compList && !accList && !lapList) return;

    db.collection("categories").get().then(snap => {
        if (compList) compList.innerHTML = '';
        if (accList) accList.innerHTML = '';
        if (lapList) lapList.innerHTML = '<a href="laptops.html" class="block py-1.5 text-sm text-[#39ff14] font-bold hover:text-white transition-all">View All Laptops</a>';

        const categories = [];
        snap.forEach(doc => categories.push(doc.data()));
        categories.sort((a, b) => a.name.localeCompare(b.name));

        categories.forEach(cat => {
            // Generate Link HTML
            const linkHTML = `
                <a href="category.html?type=${cat.id}" 
                   class="block py-1.5 text-sm text-gray-400 hover:text-[#00f3ff] hover:translate-x-1 transition-all flex items-center gap-2">
                   <i class="${cat.icon} text-xs w-4"></i> ${cat.name}
                </a>
            `;

            if (cat.type === 'component' && compList) {
                compList.insertAdjacentHTML('beforeend', linkHTML);
            } else if (cat.type === 'accessory' && accList) {
                accList.insertAdjacentHTML('beforeend', linkHTML);
            } else if (cat.type === 'laptop' && lapList) {
                lapList.insertAdjacentHTML('beforeend', linkHTML);
            }
        });

        // Fallback for empty
        if (compList && compList.children.length === 0)
            compList.innerHTML = '<span class="text-xs text-gray-600 italic px-2">No components found</span>';
        if (accList && accList.children.length === 0)
            accList.innerHTML = '<span class="text-xs text-gray-600 italic px-2">No accessories found</span>';
        // Laptops always has at least 1 child (View All), so no fallback needed usually.

    }).catch(e => {
        console.error("Home Sidebar Error", e);
    });
}

// 1. Search Functionality
function initSearch() {
    const searchInput = document.getElementById('search-input');
    const searchBtn = searchInput ? searchInput.parentElement.querySelector('button') : null;

    if (searchInput) {
        searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                const query = e.target.value.toLowerCase().trim();
                window.location.href = `index.html?search=${query}`; // Simple redirect search
            }
        });

        if (searchBtn) {
            searchBtn.onclick = () => {
                const query = searchInput.value.toLowerCase().trim();
                window.location.href = `index.html?search=${query}`;
            };
        }
    }
}

// 2. Load Latest Arrivals (for Index)
function loadLatestArrivals() {
    const container = document.getElementById('product-container');
    if (!container) return;

    // Check for search param first
    const params = new URLSearchParams(window.location.search);
    const searchQuery = params.get('search');

    let query = db.collection("products");

    if (searchQuery) {
        // Client-side filtering for simplicity (Firestore text search is limited)
        container.innerHTML = '<p class="text-center text-gray-500 py-20">Searching...</p>';
        query.get().then(snap => {
            let products = [];
            snap.forEach(doc => {
                const data = doc.data();
                if (data.name.toLowerCase().includes(searchQuery.toLowerCase())) {
                    products.push({ id: doc.id, ...data });
                }
            });
            renderGrid(products, container);
        });
        return;
    }

    // Default Latest
    query.orderBy("created_at", "desc").limit(8).get().then(snap => {
        let products = [];
        snap.forEach(doc => products.push({ id: doc.id, ...doc.data() }));
        renderGrid(products, container);
    }).catch(e => {
        console.error("Load Latest Error:", e);
        container.innerHTML = '<p class="text-center text-red-500">Error loading products.</p>';
    });
}

// 3. Load Laptops (Specific Page)
function loadLaptops() {
    // Assuming 'laptop' is a category ID or we use a filter
    // If no specific container, use 'products'
    const container = document.getElementById('products') || document.getElementById('product-container');
    if (!container) return;

    // Try to find 'laptop' category products. If 'laptops' isn't in your category list, 
    // you might need to add it or query differently. 
    // For now, let's query where category == 'laptop' or name contains 'Laptop'

    db.collection("products").where("category", "==", "laptop").get().then(snap => {
        if (snap.empty) {
            // Fallback: try searching by name if category scheme changed
            db.collection("products").orderBy("created_at", "desc").get().then(allSnap => {
                let products = [];
                allSnap.forEach(doc => {
                    const data = doc.data();
                    if (data.name.toLowerCase().includes('laptop') || data.category === 'laptops') {
                        products.push({ id: doc.id, ...data });
                    }
                });
                renderGrid(products, container);
            });
            return;
        }

        let products = [];
        snap.forEach(doc => products.push({ id: doc.id, ...doc.data() }));
        renderGrid(products, container);
    });
}

// 4. Init Category Page (Generic)
function initCategoryPage() {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type'); // e.g., 'CPU', 'GPU' or 'component'
    const container = document.getElementById('product-container') || document.getElementById('products');

    if (!container) return;
    if (!type) {
        container.innerHTML = '<p class="text-center text-gray-500">No category specified.</p>';
        return;
    }

    // Update Title if exists
    const titleEl = document.getElementById('category-title');
    if (titleEl) titleEl.textContent = type;

    // Query: Try category field match first
    db.collection("products").where("category", "==", type).get().then(snap => {
        let products = [];
        snap.forEach(doc => products.push({ id: doc.id, ...doc.data() }));

        if (products.length === 0) {
            container.innerHTML = `<p class="text-center text-gray-500 py-20">No products found in ${type}.</p>`;
        } else {
            renderGrid(products, container);
        }
    }).catch(e => console.error(e));
}

// 5. Generic Product Grid Renderer
function renderGrid(products, container) {
    if (products.length === 0) {
        container.innerHTML = '<p class="col-span-full text-center text-gray-500 py-10">No products found.</p>';
        return;
    }

    container.innerHTML = products.map(product => `
        <div class="group bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-[#39ff14] transition-all hover:shadow-[0_0_30px_rgba(57,255,20,0.1)] flex flex-col">
            <a href="product.html?id=${product.id}" class="block relative h-48 overflow-hidden bg-black cursor-pointer">
                <img src="${product.image_url}" alt="${product.name}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">
                <div class="absolute top-2 right-2 bg-black/80 backdrop-blur text-xs font-bold px-2 py-1 rounded border border-gray-700 text-[#39ff14]">
                    ${product.stock > 0 ? 'IN STOCK' : 'OUT OF STOCK'}
                </div>
            </a>
            <div class="p-5 flex-1 flex flex-col">
                <div class="text-xs text-gray-500 mb-1 uppercase tracking-wider font-bold">${product.category || 'Hardware'}</div>
                <h3 class="text-white font-bold text-lg mb-2 leading-tight group-hover:text-[#39ff14] transition-colors line-clamp-2">
                    <a href="product.html?id=${product.id}">${product.name}</a>
                </h3>
                <div class="mt-auto pt-4 flex items-center justify-between border-t border-gray-800">
                    <span class="text-2xl font-black text-white italic">$${product.price}</span>
                    <button onclick="window.addToCartFromCard(this, '${product.id}', '${product.name.replace(/'/g, "\\'")}', ${product.price}, '${product.image_url}', ${product.stock})" 
                        class="w-10 h-10 rounded-full bg-[#39ff14] text-black flex items-center justify-center hover:bg-white hover:scale-110 transition-all shadow-[0_0_15px_rgba(57,255,20,0.4)]"
                        ${product.stock === 0 ? 'disabled style="background-color:#555; cursor:not-allowed;"' : ''}>
                        <i class="fas fa-cart-plus"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// 6. Generic Load Products Helper (for Dynamic Sections)
function loadProducts(categoryId, containerId, limit = 4) {
    const container = document.getElementById(containerId);
    if (!container) return;

    db.collection("products").where("category", "==", categoryId).limit(limit).get().then(snap => {
        if (snap.empty) {
            container.innerHTML = '<p class="col-span-full text-center text-gray-600 text-sm">No products available.</p>';
            return;
        }
        let products = [];
        snap.forEach(doc => products.push({ id: doc.id, ...doc.data() }));
        renderGrid(products, container);
    });
}


// New Dynamic Section Loader
function loadDynamicSections(typeFilter, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // container.innerHTML = '<p class="text-center text-gray-500 py-20">Loading...</p>'; 
    // (Container already has loading text from HTML)

    db.collection("categories").where("type", "==", typeFilter).get().then(snap => {
        container.innerHTML = ""; // Clear initial loading text

        // Populate Sidebar if exists
        const sidebar = document.getElementById('category-sidebar');
        if (sidebar) sidebar.innerHTML = '';

        if (snap.empty) {
            container.innerHTML = '<p class="text-center text-gray-500 py-20">No categories found.</p>';
            if (sidebar) sidebar.innerHTML = '<li><span class="text-gray-600 italic">No categories.</span></li>';
            return;
        }

        const categories = [];
        snap.forEach(doc => categories.push(doc.data()));

        // Sort alphabetically
        categories.sort((a, b) => a.name.localeCompare(b.name));

        categories.forEach(cat => {
            const sectionId = cat.id;
            const gridId = `${sectionId}-container`;

            // 1. Sidebar Link
            if (sidebar) {
                sidebar.insertAdjacentHTML('beforeend', `
                    <li>
                        <a href="#${sectionId}" class="group flex items-center space-x-3 px-4 py-3 rounded-r-lg border-l-2 border-transparent hover:border-[#39ff14] hover:bg-white/5 transition-all duration-300">
                             <div class="w-8 h-8 rounded-lg bg-black/50 flex items-center justify-center text-gray-400 group-hover:text-[#39ff14] group-hover:shadow-[0_0_10px_rgba(57,255,20,0.2)] transition-all">
                                <i class="${cat.icon} text-sm"></i>
                             </div>
                             <span class="text-sm font-bold text-gray-400 group-hover:text-white tracking-wide uppercase transition-colors">${cat.name}</span>
                        </a>
                    </li>
                 `);
            }

            // 2. Main Section HTML
            const sectionHTML = `
                <section id="${sectionId}" class="scroll-mt-24">
                    <div class="flex items-center space-x-4 mb-6 border-b border-gray-800 pb-2">
                        <i class="${cat.icon} text-3xl" style="color: ${cat.color}"></i>
                        <h2 class="text-2xl font-black text-white uppercase tracking-wider">${cat.name}</h2>
                    </div>
                    <div id="${gridId}" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                        <div class="col-span-full text-center text-gray-500 py-10">Loading products...</div>
                    </div>
                </section>
            `;
            container.insertAdjacentHTML('beforeend', sectionHTML);

            // 3. Load Products
            loadProducts(cat.id, gridId, 4);
        });
    }).catch(err => {
        console.error(err);
        container.innerHTML = '<p class="text-center text-red-500 py-20">Error loading categories.</p>';
    });
}



/* ============================
   PRODUCT DETAIL LOGIC
   ============================ */
/* ============================
   PRODUCT DETAIL LOGIC
   ============================ */
function loadProductDetails() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    if (!id) {
        window.location.href = 'index.html';
        return;
    }

    const els = {
        img: document.getElementById('detail-image'),
        name: document.getElementById('detail-name'),
        nameCrumb: document.getElementById('detail-name-crumb'),
        cat: document.getElementById('detail-category'),
        price: document.getElementById('detail-price'),
        desc: document.getElementById('detail-desc'),
        sku: document.getElementById('detail-sku'),
        qty: document.getElementById('detail-qty'),
        addBtn: document.getElementById('add-to-cart-btn')
    };

    if (!els.name) return; // Not on details page

    db.collection('products').doc(id).get().then(doc => {
        if (!doc.exists) {
            els.name.innerText = "Product Not Found";
            return;
        }

        const data = doc.data();
        const stock = data.stock || 0;
        const isOutOfStock = stock === 0;

        // Render Data
        if (els.img) els.img.src = data.image_url;
        if (els.name) els.name.innerText = data.name;
        if (els.nameCrumb) els.nameCrumb.innerText = data.name;
        if (els.cat) els.cat.innerText = data.category;
        if (els.price) els.price.innerText = `$${data.price}`;
        if (els.desc) els.desc.innerText = data.description || "No description available for this product.";
        if (els.sku) els.sku.innerText = `SKU: ${doc.id.substring(0, 8).toUpperCase()}`;

        // Stock Logic
        if (isOutOfStock) {
            if (els.addBtn) {
                els.addBtn.disabled = true; // Changed to disabled for simplicity or use modal logic
                els.addBtn.innerText = "Out of Stock";
                els.addBtn.classList.add('bg-gray-700', 'text-gray-500', 'cursor-not-allowed');
                els.addBtn.classList.remove('bg-[#39ff14]', 'text-black', 'hover:bg-white');
            }
            if (els.qty) els.qty.disabled = true;
        } else {
            // Add to Cart Action
            if (els.addBtn) {
                els.addBtn.onclick = () => {
                    let qty = 1;
                    if (els.qty) qty = parseInt(els.qty.value) || 1;

                    // Use new window.addToCart
                    window.addToCart({
                        id: doc.id,
                        name: data.name,
                        price: data.price,
                        image_url: data.image_url,
                        stock: stock
                    }, qty, els.addBtn);
                };
            }
        }

        // Qty Handlers
        window.increaseDetailQty = () => {
            if (els.qty && els.qty.value < stock) els.qty.value++;
        };
        window.decreaseDetailQty = () => {
            if (els.qty && els.qty.value > 1) els.qty.value--;
        };

    }).catch(e => {
        console.error("Detail Error", e);
        if (els.name) els.name.innerText = "Error loading product.";
    });
}
function showModal(title, message, isError = true) {
    const existing = document.getElementById('gen-modal');
    if (existing) existing.remove();

    const color = isError ? 'red' : 'green';
    const icon = isError ? 'fa-ban' : 'fa-check';

    const modal = document.createElement('div');
    modal.id = 'gen-modal';
    modal.className = "fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in";
    modal.innerHTML = `
        <div class="bg-gray-900 border border-${color}-500/50 rounded-2xl shadow-[0_0_30px_rgba(${isError ? '239,68,68' : '57,255,20'},0.2)] max-w-sm w-full p-8 text-center relative transform transition-transform scale-95 opacity-0 animate-scale-up">
            <button onclick="this.closest('#gen-modal').remove()" class="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
                <i class="fas fa-times text-xl"></i>
            </button>
            <div class="w-16 h-16 rounded-full bg-${color}-900/30 flex items-center justify-center mx-auto mb-6 border border-${color}-500/30">
                <i class="fas ${icon} text-3xl text-${color}-500"></i>
            </div>
            <h3 class="text-2xl font-black text-white uppercase italic mb-2">${title}</h3>
            <p class="text-gray-400 mb-8">${message}</p>
            <button onclick="this.closest('#gen-modal').remove()" class="bg-white text-black font-bold uppercase tracking-wider px-8 py-3 rounded hover:bg-gray-200 transition-colors w-full">
                Close
            </button>
        </div>
    `;

    // Animation Styles injection if not present (simple hack)
    if (!document.getElementById('ofs-styles')) {
        const style = document.createElement('style');
        style.id = 'ofs-styles';
        style.innerHTML = `
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes scaleUp { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            .animate-fade-in { animation: fadeIn 0.2s ease-out forwards; }
            .animate-scale-up { animation: scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(modal);
}

// Deprecated alias for compatibility, but updated to use new showModal
function showOutOfStockModal() {
    showModal("Out of Stock", "Sorry, this item is currently unavailable. Please check back later or contact us for availability.");
}

// Wrapper to get quantity from input
// Accepts 'btn' element as first argument to avoid global event issues


// Hero Carousel (Dynamic)
function initCarousel() {
    const container = document.getElementById('hero-carousel');
    if (!container) return;

    db.collection("banners").orderBy("created_at", "asc").get().then(snap => {
        if (snap.empty) {
            // If strictly no banners, check if static HTML exists (children > 0)
            // If static exists, just run logic. If not, maybe hide?
            // For now, assume if empty we do nothing or keep static.
            startCarouselLogic();
            return;
        }

        const slidesHTML = [];
        const dotsHTML = [];
        let index = 0;

        snap.forEach(doc => {
            const data = doc.data();
            const colors = ['#39ff14', '#00f3ff', '#ff00ff'];
            const color = data.color || colors[index % colors.length];
            const btnColor = data.btn_color || color;

            // Strict content checks
            const titleText = data.title ? data.title.trim() : "";
            const subtitleText = data.subtitle ? data.subtitle.trim() : "";
            const btnText = data.btn_text ? data.btn_text.trim() : "";

            const hasContent = titleText.length > 0 || subtitleText.length > 0 || btnText.length > 0;

            // Content HTML Generation
            let contentHTML = '';
            if (hasContent) {
                contentHTML = `
                    <div class="carousel-content relative h-full flex flex-col justify-center px-12 max-w-2xl">
                        ${subtitleText ? `<span class="text-[${color}] font-bold tracking-widest mb-2 uppercase text-sm animate-pulse">${subtitleText}</span>` : ''}
                        <h1 class="text-5xl md:text-7xl font-black text-white mb-6 leading-tight italic">
                            ${titleText}
                        </h1>
                        <a href="${data.link || '#'}" class="inline-block bg-transparent border-2 border-[${btnColor}] text-[${btnColor}] px-8 py-3 rounded font-black uppercase hover:bg-[${btnColor}] hover:text-black transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] w-fit">
                            ${btnText || 'Shop Now'}
                        </a>
                    </div>
                `;
            } else if (data.link) {
                // Image only link overlay
                contentHTML = `<a href="${data.link}" class="absolute inset-0 z-10" aria-label="View Offer"></a>`;
            }

            slidesHTML.push(`
                <div class="carousel-slide absolute inset-0 opacity-0 transition-opacity duration-1000 ease-in-out ${index === 0 ? 'active' : ''}" data-index="${index}">
                    <div class="absolute inset-0 bg-cover bg-center" style="background-image: url('${data.image_url}');">
                        ${hasContent ? '<div class="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent"></div>' : ''}
                    </div>
                    ${contentHTML}
                </div>
            `);

            dotsHTML.push(`
                <button class="carousel-dot w-3 h-3 rounded-full bg-white/30 hover:bg-[#39ff14] transition-all ${index === 0 ? 'active' : ''}" data-index="${index}"></button>
            `);

            index++;
        });

        // Inject
        container.innerHTML = `
            ${slidesHTML.join('')}
            <div class="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex space-x-3 z-10">
                ${dotsHTML.join('')}
            </div>
        `;

        startCarouselLogic();

    }).catch(e => {
        console.error("Carousel Load Error", e);
        startCarouselLogic(); // Fallback
    });
}

function startCarouselLogic() {
    const slides = document.querySelectorAll('.carousel-slide');
    const dots = document.querySelectorAll('.carousel-dot');

    if (slides.length === 0) return;

    let currentSlide = 0;
    let interval;

    // Ensure state
    if (!document.querySelector('.carousel-slide.active')) {
        slides[0].classList.add('active');
        if (dots[0]) dots[0].classList.add('active');
    }

    const showSlide = (index) => {
        slides.forEach(s => s.classList.remove('active'));
        dots.forEach(d => d.classList.remove('active'));

        slides[index].classList.add('active');
        if (dots[index]) dots[index].classList.add('active');
        currentSlide = index;
    };

    const nextSlide = () => {
        let next = currentSlide + 1;
        if (next >= slides.length) next = 0;
        showSlide(next);
    };

    const startTimer = () => {
        clearInterval(interval);
        interval = setInterval(nextSlide, 5000);
    };

    const stopTimer = () => {
        clearInterval(interval);
    };

    dots.forEach((dot, idx) => {
        dot.addEventListener('click', () => {
            stopTimer();
            showSlide(idx);
            startTimer();
        });
    });

    const container = document.getElementById('hero-carousel');
    if (container) {
        container.addEventListener('mouseenter', stopTimer);
        container.addEventListener('mouseleave', startTimer);
    }

    startTimer();
}

// --- Category Management Functions ---
window.loadAdminCategories = function () {
    const list = document.getElementById('category-list');
    const productSelect = document.getElementById('p-category');
    const filterSelect = document.getElementById('inventory-filter');

    // Safety check: if standard selects are missing (storefront), don't crash
    if (!list && !productSelect && !filterSelect) return;

    db.collection("categories").get().then((snap) => {
        if (list) list.innerHTML = "";

        // Reset Dropdowns (keep first option)
        if (productSelect) productSelect.innerHTML = '<option value="" disabled selected>Select Category</option>';
        if (filterSelect) filterSelect.innerHTML = '<option value="">All Categories</option>';

        const categories = [];
        snap.forEach(doc => categories.push(doc.data()));

        // Sort alphabetically by name
        categories.sort((a, b) => a.name.localeCompare(b.name));

        categories.forEach(cat => {
            // Update List (Admin Only)
            if (list) {
                list.innerHTML += `
                    <div class="flex items-center justify-between bg-black p-3 rounded border border-gray-800">
                        <div class="flex items-center space-x-3">
                            <div class="w-8 h-8 rounded flex items-center justify-center bg-gray-900" style="color: ${cat.color}">
                                <i class="${cat.icon}"></i>
                            </div>
                            <div>
                                <p class="text-sm font-bold text-white">${cat.name}</p>
                                <p class="text-xs text-gray-500 uppercase">${cat.type} | ID: ${cat.id}</p>
                            </div>
                        </div>
                        <button onclick="deleteCategory('${cat.id}')" class="text-red-500 hover:text-red-400">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
            }

            // Update Dropdowns
            // Using ID (slug) as value
            if (productSelect) {
                const opt = document.createElement('option');
                opt.value = cat.id;
                opt.textContent = cat.name;
                productSelect.appendChild(opt);
            }
            if (filterSelect) {
                const opt = document.createElement('option');
                opt.value = cat.id;
                opt.textContent = cat.name;
                filterSelect.appendChild(opt);
            }
        });
    });
};

window.deleteCategory = (id) => {
    if (confirm("Delete this category? Products associated with it will lose their category association.")) {
        db.collection("categories").doc(id).delete().then(loadAdminCategories);
    }
};
