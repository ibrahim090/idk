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
                loadAdminNavigation(); // Load navigation menu
                loadPageTypes(); // Load dynamic types for dropdown
                loadAdminOrders(); // Load Orders
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
                <td class="p-3">
                    <input type="number" min="0" value="${data.stock !== undefined ? data.stock : 0}" 
                           class="w-20 bg-black border border-gray-700 p-1 text-[#00f3ff] text-center rounded focus:border-[#39ff14] outline-none font-mono"
                           onkeypress="return (event.charCode >= 48 && event.charCode <= 57)"
                           oninput="this.value = this.value.replace(/[^0-9]/g, '');"
                           onchange="if(this.value === '' || parseInt(this.value) < 0) this.value = 0; window.updateProductStock('${doc.id}', this.value)">
                </td>
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

window.updateProductStock = (id, newStock) => {
    const qty = parseInt(newStock);
    if (isNaN(qty)) return; // Prevent bad data

    // Optional: Visual feedback (toast)?
    db.collection("products").doc(id).update({ stock: qty }).then(() => {
        console.log(`Stock updated for ${id} to ${qty}`);
        // Maybe flash border?
        // For now silent update is fine or console log.
    }).catch(e => alert("Failed to update stock: " + e.message));
};

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
    // STOCK CHECK
    if (product.stock !== undefined && product.stock <= 0) {
        alert("This product is currently out of stock.");
        return;
    }

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

    // Update Checkout Button Listener
    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) {
        checkoutBtn.onclick = startCheckout;
    }
}

// --- ORDER SYSTEM LOGIC ---

// 1. Setup Modal (Inject HTML)
function setupOrderModal() {
    if (document.getElementById('order-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'order-modal';
    modal.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm z-50 hidden flex items-center justify-center';
    modal.innerHTML = `
        <div class="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 relative shadow-2xl m-4">
            <button onclick="closeOrderModal()" class="absolute top-4 right-4 text-gray-500 hover:text-white">
                <i class="fas fa-times"></i>
            </button>
            
            <h2 class="text-2xl font-black text-white italic uppercase mb-6">
                Checkout <span class="text-[#39ff14]">Order</span>
            </h2>

            <form id="order-form" onsubmit="submitOrder(event)" class="space-y-4">
                <div>
                    <label class="block text-xs uppercase text-gray-500 mb-1">Full Name</label>
                    <input type="text" id="ord-name" required class="w-full bg-black border border-gray-800 p-3 rounded focus:border-[#39ff14] outline-none text-white">
                </div>
                <div>
                    <label class="block text-xs uppercase text-gray-500 mb-1">Phone Number</label>
                    <input type="tel" id="ord-phone" required class="w-full bg-black border border-gray-800 p-3 rounded focus:border-[#39ff14] outline-none text-white">
                </div>
                <div>
                    <label class="block text-xs uppercase text-gray-500 mb-1">Shipping Address</label>
                    <textarea id="ord-address" required rows="3" class="w-full bg-black border border-gray-800 p-3 rounded focus:border-[#39ff14] outline-none text-white resize-none"></textarea>
                </div>

                <div class="border-t border-gray-800 pt-4 mt-4">
                    <div class="flex justify-between text-sm text-gray-400 mb-4">
                        <span>Total Items:</span>
                        <span class="text-white font-bold" id="ord-count">0</span>
                    </div>
                    <div class="flex justify-between text-lg text-white font-bold mb-6">
                        <span>Total:</span>
                        <span class="text-[#39ff14]" id="ord-total">$0.00</span>
                    </div>

                    <button type="submit" class="w-full py-3 bg-[#39ff14] text-black font-black uppercase tracking-wider rounded hover:shadow-[0_0_20px_#39ff14] transition-all">
                        Confirm Order
                    </button>
                    <button type="button" onclick="closeOrderModal()" class="w-full py-3 mt-2 text-gray-500 hover:text-white uppercase text-xs font-bold">
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
}

// 2. Open/Close Logic
// 2. Start Checkout (Redirect)
window.startCheckout = function () {
    if (STATE.cart.length === 0) {
        alert("Your cart is empty!");
        return;
    }
    window.location.href = 'checkout.html';
};

window.closeOrderModal = function () {
    // Deprecated
};

// 3. Submit Order
// 3. Submit Order
// 3. Checkout Page Logic
function initCheckoutPage() {
    if (!window.location.pathname.includes('checkout.html')) return;

    // Redirect if empty
    if (STATE.cart.length === 0) {
        window.location.href = 'index.html';
        return;
    }

    // Render Summary
    const container = document.getElementById('checkout-items');
    const totalEl = document.getElementById('checkout-total');
    let total = 0;

    container.innerHTML = STATE.cart.map(item => {
        total += item.price * item.qty;
        return `
            <div class="flex gap-4 items-center">
                <img src="${item.image}" class="w-12 h-12 object-cover rounded bg-gray-800">
                <div class="flex-1">
                    <h4 class="text-white text-sm font-bold line-clamp-1">${item.name}</h4>
                    <p class="text-xs text-gray-500">${item.qty} x $${item.price}</p>
                </div>
                <span class="text-[#39ff14] text-sm font-mono">$${(item.price * item.qty).toFixed(2)}</span>
            </div>
        `;
    }).join('');
    totalEl.textContent = `$${total.toFixed(2)}`;

    // Handle Form Submit
    const form = document.getElementById('checkout-form');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();

            const btn = form.querySelector('button[type="submit"]');
            const originalText = btn.textContent;
            btn.textContent = "Processing...";
            btn.disabled = true;

            const firstName = document.getElementById('chk-first-name').value;
            const lastName = document.getElementById('chk-last-name').value;
            const country = document.getElementById('chk-country').value;
            const governorate = document.getElementById('chk-governorate').value;
            const email = document.getElementById('chk-email').value;
            const phone = document.getElementById('chk-phone').value;
            const addressDetails = document.getElementById('chk-address').value;
            const notes = document.getElementById('chk-notes').value;

            const orderItems = STATE.cart.map(item => ({
                id: item.id || 'unknown',
                name: item.name || 'Unknown Item',
                price: item.price || 0,
                qty: item.qty || 1,
                image: item.image || 'assets/placeholder.jpg',
                link: `product.html?id=${item.id}`
            }));

            const order = {
                customer: {
                    name: `${firstName} ${lastName}`,
                    firstName, lastName,
                    country, governorate,
                    email, phone,
                    address: `${country}, ${governorate}, ${addressDetails}`,
                    notes
                },
                items: orderItems,
                total: total,
                status: 'pending',
                createdAt: Date.now()
            };

            try {
                // 1. Create Order
                await db.collection("orders").add(order);

                // 2. Decrement Stock
                const batch = db.batch();
                STATE.cart.forEach(item => {
                    if (item.id && item.id !== 'unknown') {
                        const ref = db.collection('products').doc(item.id);
                        batch.update(ref, { stock: firebase.firestore.FieldValue.increment(-item.qty) });
                    }
                });
                await batch.commit();

                // 3. Cleanup
                STATE.cart = [];
                saveCart();
                alert("Order Placed Successfully!");
                window.location.href = 'index.html';
            } catch (err) {
                console.error("Order Error:", err);
                alert("Failed to place order. Please try again.");
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        };
    }
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
    // Checkout Page
    else if (path.includes('checkout.html')) {
        initCheckoutPage();
    }
}

// 0. Home Sidebar Loader
// 0. Home Sidebar Loader (Dynamic & Standard)
function loadHomeSidebar() {
    const navContainer = document.getElementById('home-sidebar-nav');
    if (!navContainer) return;

    // 1. Fetch Navigation Sections (Ordered by creation to match Top Nav)
    db.collection('navigation').orderBy('createdAt', 'asc').get().then(async navSnap => {
        const sections = [];

        navSnap.forEach(doc => {
            const data = doc.data();
            let typeId = data.type;

            // Fallback: Extract type from URL if not explicitly set
            if (!typeId && data.url && data.url.includes('?type=')) {
                typeId = data.url.split('?type=')[1];
            }

            // Only add if we identified a type (means it's a category-based section)
            if (typeId) {
                sections.push({
                    label: data.label,
                    type: typeId,
                    url: data.url
                });
            }
        });

        // 2. Fetch All Categories for mapping
        const catSnap = await db.collection("categories").get();
        const categories = [];
        catSnap.forEach(doc => categories.push(doc.data()));

        // Group Categories by Type
        const catsByType = {};
        categories.forEach(cat => {
            if (!catsByType[cat.type]) catsByType[cat.type] = [];
            catsByType[cat.type].push(cat);
        });

        // 3. Render Sidebar
        navContainer.innerHTML = '';

        sections.forEach(section => {
            // Get categories for this section
            const sectionCats = catsByType[section.type] || [];

            // Sort categories by name
            sectionCats.sort((a, b) => a.name.localeCompare(b.name));

            // Default Open Standard Sections (Laptops, Components, Accessories)
            // They have specific types we know. Or we can just default all to open?
            // User screenshot shows them closed except one? Original HTML had open.
            // Let's keep the explicit list for 'open' default just for UX, or check if it matches standard types.
            const isOpen = ['laptop', 'component', 'accessory'].includes(section.type) ? 'open' : '';

            const details = document.createElement('details');
            details.className = 'group/acc border-b border-gray-800/50';
            if (isOpen) details.setAttribute('open', '');

            let listItems = ``;

            // "View All" Link
            listItems += `
                <a href="${section.url}"
                   class="block py-1.5 text-sm text-[#39ff14] font-bold hover:text-white transition-all">
                   View All ${section.label}
                </a>
            `;

            if (sectionCats.length === 0) {
                listItems += `<span class="text-xs text-gray-500 italic px-2">No categories found</span>`;
            } else {
                sectionCats.forEach(cat => {
                    listItems += `
                        <a href="category.html?id=${cat.id}" 
                           class="block py-1.5 text-sm text-gray-400 hover:text-[#00f3ff] hover:translate-x-1 transition-all flex items-center gap-2">
                           <i class="${cat.icon || 'fas fa-folder'} text-xs w-4"></i> ${cat.name}
                        </a>
                    `;
                });
            }

            details.innerHTML = `
                <summary class="px-5 py-3 text-gray-300 hover:bg-gray-800 hover:text-[#39ff14] cursor-pointer list-none flex items-center justify-between transition-all">
                    <span>${section.label}</span>
                    <i class="fas fa-chevron-down text-xs transition-transform group-open/acc:rotate-180"></i>
                </summary>
                <div class="bg-black/50 pl-8 py-2 space-y-1">
                    ${listItems}
                </div>
            `;

            navContainer.appendChild(details);
        });

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

    container.innerHTML = products.map(product => {
        const isOutOfStock = (product.stock !== undefined && product.stock <= 0);
        return `
        <div class="group bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-[#39ff14] transition-all hover:shadow-[0_0_30px_rgba(57,255,20,0.1)] flex flex-col relative">
            ${isOutOfStock ? `<div class="absolute top-6 left-[-45px] w-[170px] bg-[#39ff14] text-black text-[10px] font-bold uppercase -rotate-45 z-20 shadow-lg text-center py-1 tracking-wider border-y border-[#32cc11]">Not Available</div>` : ''}
            <a href="product.html?id=${product.id}" class="block relative h-48 overflow-hidden bg-black cursor-pointer">
                <img src="${product.image_url}" alt="${product.name}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ${isOutOfStock ? 'opacity-50 grayscale' : ''}">
            </a>
            <div class="p-5 flex-1 flex flex-col">
                <div class="text-xs text-gray-500 mb-1 uppercase tracking-wider font-bold">${product.category || 'Hardware'}</div>
                ${(product.stock !== undefined && product.stock > 0) ? `<div class="text-[#39ff14] text-[10px] font-bold mb-1 font-mono tracking-wide">In Stock : ${product.stock} Only</div>` : ''}
                <h3 class="text-white font-bold text-lg mb-2 leading-tight group-hover:text-[#39ff14] transition-colors line-clamp-2">
                    <a href="product.html?id=${product.id}">${product.name}</a>
                </h3>
                <div class="mt-auto pt-4 flex items-center justify-between border-t border-gray-800">
                    ${isOutOfStock ?
                `<span class="text-[#39ff14]/70 font-bold uppercase text-xs">Out of Stock</span>` :
                `<span class="text-2xl font-black text-white italic">$${product.price}</span>`
            }
                    
                    ${isOutOfStock ?
                `<button disabled class="bg-gray-900 text-[#39ff14] font-bold py-2 px-3 rounded cursor-not-allowed uppercase text-[10px] border border-[#39ff14]/50 opacity-70">Sold Out</button>` :
                `<button onclick="window.addToCartFromCard(this, '${product.id}', '${product.name.replace(/'/g, "\\'")}', ${product.price}, '${product.image_url}', ${product.stock})" 
                            class="w-10 h-10 rounded-full bg-[#39ff14] text-black flex items-center justify-center hover:bg-white hover:scale-110 transition-all shadow-[0_0_15px_rgba(57,255,20,0.4)]">
                            <i class="fas fa-cart-plus"></i>
                        </button>`
            }
                </div>
            </div>
        </div>
    `}).join('');
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
        stock: document.getElementById('detail-stock'),
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
        if (els.stock && stock > 0) els.stock.textContent = `In Stock : ${stock} Only`;
        if (els.desc) els.desc.innerText = data.description || "No description available for this product.";
        if (els.sku) els.sku.innerText = `SKU: ${doc.id.substring(0, 8).toUpperCase()}`;

        // Stock Logic
        if (isOutOfStock) {
            if (els.addBtn) {
                els.addBtn.disabled = true;
                els.addBtn.innerText = "Currently Unavailable";
                // Force styling for disabled state
                els.addBtn.className = "w-full bg-[#39ff14]/10 text-[#39ff14] border border-[#39ff14]/50 font-bold py-4 rounded cursor-not-allowed uppercase tracking-wider shadow-none opacity-80";
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

        // Load Related Products
        loadRelatedProducts(doc.id);

    }).catch(e => {
        console.error("Detail Error", e);
        if (els.name) els.name.innerText = "Error loading product.";
    });
}

// Function to Load Related Products (Slider)
function loadRelatedProducts(currentId) {
    const slider = document.getElementById('related-slider');
    if (!slider) return;

    // Fetch random subset (simulated by fetching limit 20 then shuffling)
    db.collection('products').limit(20).get().then(snap => {
        if (snap.empty) {
            slider.innerHTML = '<div class="w-full text-center text-gray-500 italic">No related items found.</div>';
            return;
        }

        let products = [];
        snap.forEach(doc => {
            if (doc.id !== currentId) { // Exclude current product
                products.push({ id: doc.id, ...doc.data() });
            }
        });

        // Shuffle Array
        products = products.sort(() => 0.5 - Math.random());
        // Take top 8
        products = products.slice(0, 8);

        if (products.length === 0) {
            slider.innerHTML = '<div class="w-full text-center text-gray-500 italic">No other items found.</div>';
            return;
        }

        slider.innerHTML = '';
        products.forEach(prod => {
            // Responsive width: Mobile 100%, Tablet 2 (50%), Desktop 4 (25%)
            // Adjusting for gap-6 (24px)
            // Desktop: (100% - 3*24px)/4 = 25% - 18px
            // Tablet: (100% - 1*24px)/2 = 50% - 12px
            const card = `
                <div class="min-w-full md:min-w-[calc(50%-12px)] lg:min-w-[calc(25%-18px)] bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col snap-start group hover:border-[#39ff14] transition-all">
                    <a href="product.html?id=${prod.id}" class="block overflow-hidden rounded-lg mb-4 relative aspect-square">
                        <img src="${prod.image_url}" alt="${prod.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                    </a>
                    <div class="flex-1 flex flex-col">
                        <h4 class="text-white font-bold mb-1 truncate">${prod.name}</h4>
                        <p class="text-xs text-gray-500 uppercase tracking-widest mb-3">${prod.category}</p>
                        <div class="mt-auto flex items-center justify-between">
                            <span class="text-[#39ff14] font-black text-lg">$${prod.price}</span>
                            <button onclick="window.addToCartFromCard('${prod.id}', '${prod.name}', ${prod.price}, '${prod.image_url}', this)" 
                                    class="bg-gray-800 hover:bg-[#39ff14] hover:text-black text-white w-8 h-8 rounded flex items-center justify-center transition-colors">
                                <i class="fas fa-cart-plus"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            slider.insertAdjacentHTML('beforeend', card);
        });

    });
}

window.scrollRelated = function (direction) {
    const slider = document.getElementById('related-slider');
    if (!slider) return;

    // Scroll by visible width to reveal distinct new set of products
    const scrollAmount = slider.clientWidth;

    if (direction === 'left') {
        slider.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    } else {
        slider.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
};
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
                                <p class="text-xs text-gray-500"><span class="uppercase">${cat.type}</span> | ID: <span class="font-mono text-gray-400">${cat.id}</span></p>
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

/* ============================
   SEARCH PAGE LOGIC
   ============================ */

let searchResults = []; // Global store for filtering/sorting
let searchViewMode = 'grid'; // 'grid' or 'list'

// Search submission is now handled by native HTML <form action="search.html"> attributes.
// Removed handleSearchSubmit to prevent conflicts.

// --- Cart Toggle Logic ---
window.toggleCart = function () {
    const modal = document.getElementById('cart-modal');
    if (modal) {
        modal.classList.toggle('hidden');
    }
};

window.initSearchPage = function () {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q');
    const container = document.getElementById('search-results-container');
    const termDisplay = document.getElementById('search-term');
    const bgSearchInput = document.getElementById('search-input'); // The one in header

    if (!query) {
        if (container) container.innerHTML = '<div class="col-span-full text-center text-gray-500">Please enter a search term.</div>';
        return;
    }

    if (termDisplay) termDisplay.innerText = query;
    if (bgSearchInput) bgSearchInput.value = query;

    // Fetch ALL products (Client-side filtering mainly for simplicity)
    db.collection("products").get().then(snap => {
        const allProducts = [];
        snap.forEach(doc => allProducts.push({ id: doc.id, ...doc.data() }));

        // Filter
        const qLower = query.toLowerCase();
        searchResults = allProducts.filter(p => {
            return p.name.toLowerCase().includes(qLower) ||
                (p.description && p.description.toLowerCase().includes(qLower)) ||
                (p.category && p.category.toLowerCase().includes(qLower));
        });

        // Update Count
        const countDisplay = document.getElementById('result-count');
        if (countDisplay) countDisplay.innerText = searchResults.length;

        renderSearchResults();

    }).catch(e => {
        console.error("Search Error", e);
        if (container) container.innerHTML = '<div class="col-span-full text-center text-red-500">Error loading results.</div>';
    });
};

window.renderSearchResults = function () {
    const container = document.getElementById('search-results-container');
    if (!container) return;

    container.innerHTML = "";

    if (searchResults.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-20 flex flex-col items-center">
                <i class="fas fa-search text-6xl text-gray-800 mb-6"></i>
                <h3 class="text-2xl font-bold text-gray-500 mb-2">No results found</h3>
                <p class="text-gray-600">Try checking your spelling or use different keywords.</p>
            </div>
        `;
        return;
    }

    // Apply Sort
    const sortParams = document.querySelector('input[name="sort"]:checked');
    const sortVal = sortParams ? sortParams.value : 'latest';

    searchResults.sort((a, b) => {
        if (sortVal === 'price_asc') return a.price - b.price;
        if (sortVal === 'price_desc') return b.price - a.price;
        if (sortVal === 'alpha') return a.name.localeCompare(b.name);
        // Default latest (assuming created_at exists, else minimal sort)
        if (a.created_at && b.created_at) return b.created_at - a.created_at;
        return 0;
    });

    // Update View Layout Classes
    if (searchViewMode === 'list') {
        container.className = "flex flex-col gap-4"; // List Layout
    } else {
        container.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"; // Grid Layout
    }

    searchResults.forEach(prod => {
        let cardHTML = '';
        const isList = searchViewMode === 'list';

        if (isList) {
            // LIST ITEM
            cardHTML = `
                <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 flex gap-6 hover:border-[#39ff14] transition-all group">
                    <a href="product.html?id=${prod.id}" class="w-48 h-32 flex-shrink-0 bg-black rounded-lg overflow-hidden">
                        <img src="${prod.image_url}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="${prod.name}">
                    </a>
                    <div class="flex-1 flex flex-col justify-between">
                        <div>
                            <div class="flex justify-between items-start">
                                <h3 class="text-xl font-bold text-white mb-1">
                                    <a href="product.html?id=${prod.id}" class="hover:text-[#39ff14] transition-colors">${prod.name}</a>
                                </h3>
                                <div class="text-right">
                                    <span class="block text-2xl font-black text-[#39ff14]">$${prod.price}</span>
                                    ${prod.stock > 0 ? `<span class="text-xs text-[#00f3ff]"><i class="fas fa-check-circle"></i> In Stock</span>` : `<span class="text-xs text-red-500">Out of Stock</span>`}
                                </div>
                            </div>
                            <p class="text-xs text-gray-500 uppercase tracking-widest mb-2">${prod.category}</p>
                            <p class="text-gray-400 text-sm line-clamp-2">${prod.description || 'No description available.'}</p>
                        </div>
                        <div class="flex items-center gap-4 mt-4">
                             <button onclick="window.addToCartFromCard('${prod.id}', '${prod.name}', ${prod.price}, '${prod.image_url}', this)" 
                                    class="bg-[#39ff14] text-black font-bold uppercase px-6 py-2 rounded hover:bg-white transition-colors text-sm">
                                <i class="fas fa-cart-plus mr-2"></i> Add to Cart
                            </button>
                            <a href="product.html?id=${prod.id}" class="text-gray-400 hover:text-white text-sm underline decoration-gray-700 hover:decoration-white transition-all underline-offset-4">
                                View Details
                            </a>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // GRID CARD
            cardHTML = `
                <div class="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-[#39ff14] transition-all group relative">
                    ${ribbon}
                    <a href="product.html?id=${prod.id}" class="block h-48 overflow-hidden relative">
                         <div class="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors z-10"></div>
                        <img src="${prod.image_url}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ${isOutOfStock ? 'opacity-50 grayscale' : ''}" alt="${prod.name}">
                    </a>
                    <div class="p-5">
                        <h3 class="text-white font-bold text-lg mb-2 truncate group-hover:text-[#39ff14] transition-colors">
                            <a href="product.html?id=${prod.id}">${prod.name}</a>
                        </h3>
                        <p class="text-gray-500 text-xs mb-4 line-clamp-2 h-8">${prod.description || 'Premium hardware for enthusiasts.'}</p>
                        <div class="flex items-center justify-between mb-2">
                             ${priceDisplay}
                             <span class="text-xs text-gray-500 font-mono">Stock: ${prod.stock !== undefined ? prod.stock : 'Unknown'}</span>
                        </div>
                        ${btnHtml}
                    </div>
                </div>
            `;
        }

        container.insertAdjacentHTML('beforeend', cardHTML);
    });
};

window.applySearchSort = function () {
    renderSearchResults();
};

window.setView = function (mode) {
    searchViewMode = mode;

    // Update Button Styles
    const btnGrid = document.getElementById('view-grid');
    const btnList = document.getElementById('view-list');

    if (mode === 'grid') {
        if (btnGrid) btnGrid.className = "flex-1 py-2 bg-gray-800 hover:bg-gray-700 rounded text-center transition-colors text-[#39ff14] border border-[#39ff14]/30";
        if (btnList) btnList.className = "flex-1 py-2 bg-gray-800 hover:bg-gray-700 rounded text-center transition-colors text-gray-400 border border-transparent";
    } else {
        if (btnList) btnList.className = "flex-1 py-2 bg-gray-800 hover:bg-gray-700 rounded text-center transition-colors text-[#39ff14] border border-[#39ff14]/30";
        if (btnGrid) btnGrid.className = "flex-1 py-2 bg-gray-800 hover:bg-gray-700 rounded text-center transition-colors text-gray-400 border border-transparent";
    }

    renderSearchResults();
};

// Auto-run on search page
if (window.location.pathname.includes('search.html')) {
    document.addEventListener('DOMContentLoaded', initSearchPage);
}

/* ============================
   NAVIGATION MANAGEMENT
   ============================ */

window.toggleNavType = () => {
    const type = document.getElementById('n-type').value;
    const catContainer = document.getElementById('n-cat-container');
    const urlContainer = document.getElementById('n-url-container');

    if (type === 'category') {
        catContainer.classList.remove('hidden');
        urlContainer.classList.add('hidden');
        // Populate categories logic
        const catSelect = document.getElementById('n-cat-select');
        // If empty, fetch
        if (catSelect && catSelect.options.length <= 1) {
            db.collection('categories').get().then(snap => {
                catSelect.innerHTML = '<option value="" disabled selected>Select Category</option>';
                snap.forEach(doc => {
                    const c = doc.data();
                    const opt = document.createElement('option');
                    opt.value = c.id;
                    opt.textContent = c.name;
                    catSelect.appendChild(opt);
                });
            });
        }
    } else {
        catContainer.classList.add('hidden');
        urlContainer.classList.remove('hidden');
    }
};

window.loadAdminNavigation = () => {
    const list = document.getElementById('nav-list');
    if (!list) return;

    list.innerHTML = '<p class="text-center text-gray-500">Loading...</p>';

    db.collection('navigation').orderBy('createdAt', 'asc').get().then(snap => {
        list.innerHTML = '';
        if (snap.empty) {
            list.innerHTML = '<p class="text-gray-500 text-center text-sm">No menu items. Site using defaults.</p>';
            return;
        }

        snap.forEach(doc => {
            const item = doc.data();
            const div = document.createElement('div');
            div.className = 'flex justify-between items-center bg-black border border-gray-800 p-2 rounded';
            div.innerHTML = `
                <div>
                    <p class="text-white font-bold text-sm">${item.label}</p>
                    <p class="text-xs text-gray-500">${item.url}</p>
                </div>
                <button onclick="deleteNavItem('${doc.id}')" class="text-red-500 hover:text-white px-2">
                    <i class="fas fa-trash"></i>
                </button>
            `;
            list.appendChild(div);
        });
    });
};

window.deleteNavItem = (id) => {
    if (confirm('Remove this menu item? This will also remove the associated Category and Page Type.')) {
        // 1. Get the Nav Item to find the Type slug
        db.collection('navigation').doc(id).get().then(doc => {
            if (!doc.exists) {
                db.collection('navigation').doc(id).delete().then(loadAdminNavigation);
                return;
            }

            const data = doc.data();
            const url = data.url;
            // Expecting: category.html?type=slug
            if (url && url.includes('type=')) {
                const slug = url.split('type=')[1];
                if (slug) {
                    console.log("Deleting linked resources for:", slug);
                    // 2. Delete Page Type
                    db.collection('types').doc(slug).delete();
                    // 3. Delete Default Category
                    db.collection('categories').doc(slug).delete();
                }
            }

            // 4. Delete Nav Link
            db.collection('navigation').doc(id).delete().then(() => {
                loadAdminNavigation();
                loadAdminCategories(); // Refresh list to show category gone
                loadPageTypes(); // Refresh dropdown
            });
        });
    }
};

// Add Nav Listener
const addNavForm = document.getElementById('add-nav-form');
if (addNavForm) {
    addNavForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const label = document.getElementById('n-label').value;
        if (!label) return;

        // Generate Slug
        const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const url = `category.html?type=${id}`; // Link by TYPE

        // 1. Save as a Page Type (for Dropdown)
        db.collection('types').doc(id).set({
            id: id,
            name: label,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // 2. Add to Navigation
        db.collection('navigation').add({
            label,
            url,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            alert(`Section "${label}" added! Start adding categories to it manually.`);
            addNavForm.reset();
            loadAdminNavigation();
            loadPageTypes(); // Refresh dropdown
        });
    });
}

// --- ONE-TIME MIGRATION: Seed Standard Nav ---
window.seedStandardNavigation = async () => {
    const standard = [
        { id: 'nav-laptops', label: 'Laptops', url: 'laptops.html', type: 'laptop', createdAt: Date.now() },
        { id: 'nav-components', label: 'PC Components', url: 'components.html', type: 'component', createdAt: Date.now() + 1 },
        { id: 'nav-accessories', label: 'Accessories', url: 'accessories.html', type: 'accessory', createdAt: Date.now() + 2 }
    ];

    for (const item of standard) {
        const doc = await db.collection('navigation').doc(item.id).get();
        if (!doc.exists) {
            console.log(`Seeding navigation: ${item.label}`);
            await db.collection('navigation').doc(item.id).set(item);
        }
    }
};

// Global Nav Renderer
window.renderGlobalNavigation = () => {
    const navContainer = document.getElementById('dynamic-nav');
    if (!navContainer) return;

    // Seed on load (harmless if already exists)
    seedStandardNavigation().then(() => {
        db.collection('navigation').orderBy('createdAt', 'asc').get().then(snap => {
            // Define standard links (Just Home)
            const links = [
                { label: 'Home', url: 'index.html' }
            ];

            // Add dynamic links (Now includes Laptops, Components, Accessories)
            snap.forEach(doc => {
                links.push(doc.data());
            });

            // Determine current page for highlighting
            const currentPath = window.location.pathname;
            const currentSearch = window.location.search;

            let html = '';

            links.forEach(link => {
                let isActive = false;

                // Check matching URL
                if (link.url === 'index.html' && (currentPath.endsWith('index.html') || currentPath.endsWith('/'))) {
                    isActive = true;
                } else if (currentPath.includes(link.url.split('?')[0])) {
                    if (link.url.includes('?')) {
                        if (currentSearch === link.url.substring(link.url.indexOf('?'))) {
                            isActive = true;
                        }
                    } else {
                        isActive = true;
                    }
                }

                const activeClass = isActive ? 'text-[#39ff14] font-bold' : 'hover:text-white hover:bg-gray-800 text-gray-300';

                html += `<a href="${link.url}" class="px-3 h-8 flex items-center rounded transition-all uppercase text-sm tracking-wider ${activeClass}">${link.label}</a>`;
            });

            navContainer.innerHTML = html;
            navContainer.classList.remove('hidden');
        }).catch(e => {
            console.error("Nav Load Error", e);
        });
    });
};

document.addEventListener('DOMContentLoaded', renderGlobalNavigation);

// Load Page Types into "Add Category" Dropdown
window.loadPageTypes = () => {
    const typeSelect = document.getElementById('c-type');
    if (!typeSelect) return;

    // Keep Default Options? 
    // We should probably clear and re-add defaults OR just append. 
    // To avoid duplicates on re-run, let's clear custom ones? 
    // Easier to just rebuild standard ones + dynamic ones.

    typeSelect.innerHTML = `
        <option value="component">Component Page</option>
        <option value="accessory">Accessory Page</option>
        <option value="laptop">Laptop Page</option>
        <option disabled>──────────</option>
    `;

    db.collection('types').get().then(snap => {
        // Also populate Admin Cleanup List
        const adminList = document.getElementById('types-list');
        if (adminList) adminList.innerHTML = '';

        snap.forEach(doc => {
            const t = doc.data();

            // 1. Dropdown Option
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = `${t.name} Page`;
            typeSelect.appendChild(opt);

            // 2. Admin List Item
            if (adminList) {
                const div = document.createElement('div');
                div.className = 'flex justify-between items-center bg-black border border-gray-800 p-2 rounded';
                div.innerHTML = `
                    <span class="text-xs text-gray-400 font-mono">${t.name} Page</span>
                    <button onclick="window.deletePageType('${doc.id}')" class="text-red-500 hover:text-white px-2">
                        <i class="fas fa-trash"></i>
                    </button>
                `;
                adminList.appendChild(div);
            }
        });
    });
};

window.deletePageType = (id) => {
    if (confirm('Delete this Page Type? The dropdown option will be removed.')) {
        db.collection('types').doc(id).delete().then(() => {
            loadPageTypes();
            // Also refresh other lists if needed
        });
    }
};

/* ============================
   GENERIC CATEGORY/TYPE PAGE LOGIC
   ============================ */
/* ============================
   GENERIC CATEGORY/TYPE PAGE LOGIC
   ============================ */
window.initCategoryPage = function () {
    const params = new URLSearchParams(window.location.search);
    const catId = params.get('id');
    const typeId = params.get('type');

    // Elements
    const container = document.getElementById('product-container') || document.getElementById('search-results-container');
    const sidebarContainer = document.getElementById('sidebar-container'); // The wrapper
    const sidebarList = document.getElementById('dynamic-sidebar-categories'); // The UL

    if (catId) {
        // --- SINGLE CATEGORY MODE (Standard Grid) ---
        if (sidebarContainer) sidebarContainer.classList.add('hidden'); // Hide sidebar categories in single mode

        db.collection('products').where('category', '==', catId).get().then(snap => {
            const products = [];
            snap.forEach(doc => products.push({ id: doc.id, ...doc.data() }));

            // Update Title
            db.collection('categories').doc(catId).get().then(doc => {
                if (doc.exists) {
                    const title = document.getElementById('page-title');
                    if (title) title.innerText = doc.data().name;
                    const sub = document.getElementById('page-subtitle');
                    if (sub) sub.innerText = `Explore our collection of ${doc.data().name}`;
                    document.title = `TechZone | ${doc.data().name}`;
                }
            });

            searchResults = products;
            renderSearchResults(); // Use standard grid renderer
        }).catch(err => console.error("Error loading category products:", err));

    } else if (typeId) {
        // --- TYPE MODE (Grouped Sections + Sidebar) ---
        // This makes it look like "Components" page
        console.log(`Loading Type Grouped Layout: ${typeId}`);

        // 1. Setup Page Title
        db.collection('types').doc(typeId).get().then(doc => {
            let typeName = typeId.replace(/-/g, ' ').toUpperCase();
            if (doc.exists) typeName = doc.data().name;

            const title = document.getElementById('page-title');
            if (title) title.innerText = typeName;
            const sub = document.getElementById('page-subtitle');
            if (sub) sub.innerText = `Browse all ${typeName} items`;
            document.title = `TechZone | ${typeName}`;
        });

        // 2. Fetch Categories AND Products
        Promise.all([
            db.collection('categories').where('type', '==', typeId).get(),
            db.collection('products').get() // Fetch all (cached) to filter client-side
        ]).then(([catSnap, prodSnap]) => {

            // A. Prepare Categories
            const categories = [];
            catSnap.forEach(doc => categories.push(doc.data()));
            // Sort by name
            categories.sort((a, b) => a.name.localeCompare(b.name));

            // B. Prepare Products (Map for faster lookup if needed, or just array)
            const allProducts = [];
            prodSnap.forEach(doc => allProducts.push({ id: doc.id, ...doc.data() }));

            // Clear Container for Custom Rendering
            if (container) {
                container.innerHTML = '';
                container.className = 'space-y-16'; // Vertical spacing between sections
            }

            // Setup Sidebar
            if (sidebarContainer && sidebarList) {
                sidebarContainer.classList.remove('hidden');
                sidebarList.innerHTML = '';
                if (categories.length === 0) {
                    sidebarList.innerHTML = '<li class="text-gray-500 text-xs px-2">No categories found.</li>';
                }
            }

            let hasAnyProducts = false;

            // C. Render Groups
            categories.forEach(cat => {
                // Filter Products for this Category
                const catProducts = allProducts.filter(p => p.category === cat.id);

                // Add to Sidebar
                if (sidebarList) {
                    const li = document.createElement('li');
                    li.innerHTML = `<a href="#cat-${cat.id}" class="block px-4 py-2 text-sm text-gray-400 hover:text-[#39ff14] hover:bg-white/5 rounded transition-colors group flex items-center">
                        <i class="${cat.icon || 'fas fa-circle'} w-5 group-hover:text-[#39ff14] text-gray-600"></i> ${cat.name}
                    </a>`;
                    sidebarList.appendChild(li);
                }

                // If no products, skip section rendering (keeps page clean)
                // OR render empty section if you want to show it exists? 
                // "Components" page usually shows headings. Let's show header even if empty, or checking user preference.
                // User said "copy mechanism". Usually mechanism hides empty or shows them.
                // I'll show them if they have products, to be safe. 
                // Wait, if I hide them, user might think category doesn't exist.
                // But valid categories with 0 products are sad.
                // Let's render if products > 0 OR if it's a valid category. 
                // Let's render ALL valid categories.

                // Construct Section HTML
                // Using Grid layout for the products inside
                let productsHTML = '';
                if (catProducts.length > 0) {
                    hasAnyProducts = true;
                    // Limit to 4 for preview? Or show all? Components page usually shows all or subset.
                    // Let's show all for now.
                    catProducts.forEach(prod => {
                        // Reuse Card HTML Logic (Simplified)
                        productsHTML += `
                            <div class="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden group hover:border-[#39ff14] transition-all flex flex-col h-full">
                                <a href="product.html?id=${prod.id}" class="block relative aspect-square overflow-hidden bg-black">
                                    <img src="${prod.image_url}" alt="${prod.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                                    ${prod.stock === 0 ? '<div class="absolute inset-0 bg-black/60 flex items-center justify-center"><span class="bg-red-600 text-white font-bold px-3 py-1 rounded text-sm uppercase">Out of Stock</span></div>' : ''}
                                </a>
                                <div class="p-5 flex flex-col flex-1">
                                    <div class="mb-3">
                                        <h3 class="text-lg font-bold text-white leading-tight mt-1 group-hover:text-[#39ff14] transition-colors line-clamp-2">
                                            <a href="product.html?id=${prod.id}">${prod.name}</a>
                                        </h3>
                                    </div>
                                    <div class="mt-auto flex items-end justify-between">
                                        <span class="block text-xl font-black text-[#39ff14]">$${prod.price}</span>
                                        <button onclick="window.addToCartFromCard('${prod.id}', '${prod.name}', ${prod.price}, '${prod.image_url}', this)" 
                                            class="w-8 h-8 rounded-full bg-gray-800 text-white flex items-center justify-center hover:bg-[#39ff14] hover:text-black transition-all shadow-lg" 
                                            ${prod.stock === 0 ? 'disabled' : ''}>
                                            <i class="fas fa-cart-plus font-small"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                         `;
                    });
                } else {
                    productsHTML = '<div class="col-span-full text-gray-600 italic text-sm py-4">No products in this category yet.</div>';
                }

                // Append Section
                const section = document.createElement('section');
                section.id = `cat-${cat.id}`;
                section.innerHTML = `
                    <h2 class="text-2xl font-black text-white uppercase tracking-tight mb-6 flex items-center gap-3 border-b border-gray-800 pb-4">
                        <span class="text-[#39ff14]"><i class="${cat.icon || 'fas fa-layer-group'}"></i></span> ${cat.name}
                    </h2>
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        ${productsHTML}
                    </div>
                `;
                container.appendChild(section);
            });

            if (categories.length === 0) {
                container.innerHTML = `<div class="text-center py-20 text-gray-500">
                    <i class="fas fa-ghost text-4xl mb-4 text-gray-700"></i><br>
                    No categories found for this section.<br>
                    <span class="text-xs">Go to Admin > Categories and create a category with Type: <strong>${typeName || typeId}</strong></span>
                 </div>`;
            }

        }).catch(err => console.error("Error loading type page:", err));
    }
};

if (window.location.pathname.includes('category.html')) {
    document.addEventListener('DOMContentLoaded', initCategoryPage);
}

// --- ADMIN ORDER LOGIC ---
// --- ADMIN ORDER LOGIC ---
window.loadAdminOrders = function () {
    const grid = document.getElementById('admin-orders-grid');
    if (!grid) return; // Not on admin page or not ready

    db.collection('orders').orderBy('createdAt', 'desc').onSnapshot(snap => {
        grid.innerHTML = '';
        if (snap.empty) {
            grid.innerHTML = `
                <div class="col-span-full flex flex-col items-center justify-center py-20 text-gray-500 opacity-50">
                    <i class="fas fa-clipboard-list text-6xl mb-4"></i>
                    <p class="text-xl font-bold">No Orders Yet</p>
                </div>`;
            return;
        }

        snap.forEach(doc => {
            const order = doc.data();
            const date = new Date(order.createdAt).toLocaleString();
            const statusColor = order.status === 'delivered' ? 'bg-green-500/20 text-green-500 border-green-500/50' :
                (order.status === 'processing' ? 'bg-blue-500/20 text-blue-500 border-blue-500/50' : 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50');

            // Items HTML
            let itemsHtml = order.items.map(item => {
                const link = item.link || `product.html?id=${item.id}`; // Fallback
                const subtotal = item.price * item.qty;
                return `
                    <div class="flex gap-4 py-3 border-b border-dashed border-gray-800 last:border-0">
                        <img src="${item.image || 'assets/placeholder.jpg'}" class="w-12 h-12 object-cover rounded bg-black border border-gray-800">
                        <div class="flex-1 min-w-0">
                            <a href="${link}" target="_blank" class="text-sm font-bold text-gray-300 hover:text-[#39ff14] truncate block flex items-center gap-1">
                                ${item.name} <i class="fas fa-external-link-alt text-[10px] opacity-50"></i>
                            </a>
                            <div class="flex justify-between items-center mt-1 text-xs">
                                <span class="text-gray-500">${item.qty} x $${item.price.toFixed(2)}</span>
                                <span class="text-white font-mono">$${subtotal.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            // Card HTML
            const card = document.createElement('div');
            card.className = "bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col shadow-lg hover:border-gray-700 transition-colors relative group";
            card.innerHTML = `
                <!-- Status Bar -->
                <div class="h-1 w-full bg-gradient-to-r from-gray-800 to-gray-900 group-hover:from-[#39ff14] group-hover:to-[#00f3ff] transition-all"></div>
                
                <div class="p-5 flex-1 flex flex-col">
                    <!-- Header -->
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <p class="text-xs text-gray-500 uppercase tracking-wider font-bold">Order #${doc.id.slice(0, 6)}</p>
                            <p class="text-[10px] text-gray-600">${date}</p>
                        </div>
                        <span class="px-2 py-1 rounded text-[10px] font-black uppercase border ${statusColor}">
                            ${order.status}
                        </span>
                    </div>

                    <!-- Customer Info -->
                    <div class="bg-black/40 rounded p-3 mb-4 space-y-2 border border-gray-800/50">
                        <div class="flex items-center gap-2 text-sm text-white font-bold">
                            <i class="fas fa-user-circle text-gray-600"></i> ${order.customer.name}
                        </div>
                        ${order.customer.email ? `<div class="text-xs text-gray-500 ml-6 flex items-center gap-2"><i class="fas fa-envelope"></i> ${order.customer.email}</div>` : ''}
                        
                        <a href="tel:${order.customer.phone}" class="flex items-center gap-2 text-xs text-gray-400 hover:text-[#39ff14] transition-colors w-fit">
                            <i class="fas fa-phone"></i> ${order.customer.phone}
                        </a>
                        
                        <div class="flex items-start gap-2 text-xs text-gray-400 group/addr cursor-pointer hover:text-white transition-colors" 
                             onclick="navigator.clipboard.writeText('${order.customer.address}'); alert('Address Copied!')" 
                             title="Click to Copy">
                            <i class="fas fa-map-marker-alt mt-0.5"></i>
                            <p class="line-clamp-2">${order.customer.address}</p>
                            <i class="fas fa-copy ml-auto opacity-0 group-hover/addr:opacity-100 transition-opacity"></i>
                        </div>

                        ${order.customer.notes ? `
                        <div class="mt-2 p-2 bg-gray-800/50 rounded text-xs text-gray-300 italic border-l-2 border-[#ff9900]">
                            <strong>Note:</strong> "${order.customer.notes}"
                        </div>` : ''}
                    </div>

                    <!-- Items List -->
                    <div class="flex-1 mb-4">
                        <div class="text-[10px] uppercase text-gray-600 font-bold mb-2">Items Ordered</div>
                        <div class="max-h-40 overflow-y-auto pr-1 scrollbar-hide">
                            ${itemsHtml}
                        </div>
                    </div>

                    <!-- Footer -->
                    <div class="pt-4 border-t border-gray-800 flex items-center justify-between mt-auto">
                        <div>
                            <p class="text-xs text-gray-500">Total Amount</p>
                            <p class="text-xl font-black text-[#39ff14]">$${order.total.toFixed(2)}</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <button onclick="printOrder('${doc.id}')" class="w-8 h-8 rounded bg-gray-800 text-gray-400 hover:bg-white hover:text-black flex items-center justify-center transition-colors" title="Print Receipt">
                                <i class="fas fa-print"></i>
                            </button>
                            ${order.status !== 'delivered' ? `
                            <button onclick="updateOrderStatus('${doc.id}', 'delivered')" class="w-8 h-8 rounded bg-gray-800 text-gray-400 hover:bg-[#39ff14] hover:text-black flex items-center justify-center transition-colors" title="Mark Delivered">
                                <i class="fas fa-check"></i>
                            </button>` : ''}
                            <button onclick="deleteOrder('${doc.id}')" class="w-8 h-8 rounded bg-gray-800 text-red-500 hover:bg-red-600 hover:text-white flex items-center justify-center transition-colors" title="Delete Order">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    });
};

window.updateOrderStatus = (id, status) => {
    db.collection('orders').doc(id).update({ status: status });
};

window.printOrder = (id) => {
    // Simple Print Logic: Open new window with order details
    db.collection('orders').doc(id).get().then(doc => {
        if (!doc.exists) return;
        const order = doc.data();
        const w = window.open('', '_blank');
        w.document.write(`
            <html>
            <head>
                <title>Order #${id}</title>
                <style>
                    body { font-family: monospace; padding: 40px; max-width: 400px; margin: 0 auto; }
                    .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 20px; margin-bottom: 20px; }
                    .item { display: flex; justify-content: space-between; margin-bottom: 10px; }
                    .total { border-top: 1px dashed #000; margin-top: 20px; padding-top: 10px; display: flex; justify-content: space-between; font-weight: bold; font-size: 1.2em; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>TECHZONE</h1>
                    <p>Order Receipt</p>
                    <small>${new Date(order.createdAt).toLocaleString()}</small>
                </div>
                <div>
                    <p><strong>Customer:</strong><br>${order.customer.name}<br>${order.customer.phone}<br>${order.customer.address}</p>
                </div>
                <hr style="border-top: 1px dashed #000; margin: 20px 0;">
                <div>
                    ${order.items.map(i => `
                        <div class="item">
                            <span>${i.qty} val ${i.name}</span>
                            <span>$${(i.price * i.qty).toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="total">
                    <span>TOTAL</span>
                    <span>$${order.total.toFixed(2)}</span>
                </div>
                <script>window.print(); window.onafterprint = () => window.close();<\/script>
            </body>
            </html>
        `);
        w.document.close();
    });
};

window.deleteOrder = function (id) {
    if (confirm("Are you sure you want to delete this order? This cannot be undone.")) {
        db.collection('orders').doc(id).delete(); // Snapshot listener will auto-update UI
    }
};

// Patch renderSearchResults to support category.html container
const originalRender = window.renderSearchResults;
window.renderSearchResults = function () {
    // Try finding search container first
    let container = document.getElementById('search-results-container');
    // If not found, look for product-container (used in category.html)
    if (!container) {
        container = document.getElementById('product-container');
        // We need to inject the ID into the original function context or handle it here.
        // Since original function hardcodes 'search-results-container', we must OVERRIDE it completely or modify HTML.
        // Easier to just modify the function body above? 
        // But I'm in Append mode.
        // I will Redefine it here fully if needed, or I'll just change category.html logic to use 'search-results-container' id?
        // No, category.html (Step 1920) has 'product-container'.
        // I will REDEFINE renderSearchResults here to be safe and robust.
    }

    // REDEFINED LOGIC (See below)
    if (!container) return; // Should not happen

    container.innerHTML = "";

    if (searchResults.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-20 flex flex-col items-center">
                <i class="fas fa-box-open text-6xl text-gray-800 mb-6"></i>
                <h3 class="text-2xl font-bold text-gray-500 mb-2">No products found</h3>
                <p class="text-gray-600">Check back later for stock updates.</p>
            </div>
        `;
        return;
    }

    // Sort implementation (copied from earlier to ensure scope access)
    const sortParams = document.querySelector('input[name="sort"]:checked');
    const sortVal = sortParams ? sortParams.value : 'latest';

    searchResults.sort((a, b) => {
        if (sortVal === 'price_asc') return a.price - b.price;
        if (sortVal === 'price_desc') return b.price - a.price;
        if (sortVal === 'alpha') return a.name.localeCompare(b.name);
        if (a.created_at && b.created_at) return b.created_at - a.created_at;
        return 0;
    });

    if (searchViewMode === 'list') {
        container.className = "flex flex-col gap-4";
    } else {
        container.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6";
    }

    searchResults.forEach(prod => {
        const isOutOfStock = (prod.stock !== undefined && prod.stock <= 0);

        // Ribbon
        const ribbon = isOutOfStock ?
            `<div class="absolute top-6 left-[-45px] w-[170px] bg-red-600 text-white text-[10px] font-bold uppercase -rotate-45 z-20 shadow-lg text-center py-1 tracking-wider border-y border-red-800">Not Available</div>`
            : '';

        // Button
        const btnHtml = isOutOfStock ?
            `<button disabled class="w-full bg-gray-800 text-gray-500 border border-gray-700 font-bold py-3 mt-4 rounded cursor-not-allowed uppercase tracking-wider text-xs hover:bg-gray-800">Sold Out</button>` :
            `<button onclick="window.addToCartFromCard('${prod.id}', '${prod.name.replace(/'/g, "\\'")}', ${prod.price}, '${prod.image_url}', this)" 
                class="w-full bg-[#39ff14] text-black font-bold py-3 mt-4 rounded hover:bg-[#32cc11] transition-transform active:scale-95 shadow-[0_0_15px_rgba(57,255,20,0.4)] uppercase tracking-wider text-sm flex items-center justify-center gap-2 group-hover:shadow-[0_0_25px_rgba(57,255,20,0.6)]">
                <i class="fas fa-shopping-cart"></i> Add to Cart
            </button>`;

        // Price styling
        const priceDisplay = isOutOfStock ?
            `<span class="text-red-500 font-bold uppercase text-sm">Out of Stock</span>` :
            `<span class="text-[#39ff14] font-black text-xl">$${prod.price.toFixed(2)}</span>`;

        let cardHTML = '';
        const isList = searchViewMode === 'list';

        if (isList) {
            // LIST ITEM
            cardHTML = `
                <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 flex gap-6 hover:border-[#39ff14] transition-all group">
                    <a href="product.html?id=${prod.id}" class="w-48 h-32 flex-shrink-0 bg-black rounded-lg overflow-hidden">
                        <img src="${prod.image_url}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="${prod.name}">
                    </a>
                    <div class="flex-1 flex flex-col justify-between">
                        <div>
                            <div class="flex justify-between items-start">
                                <h3 class="text-xl font-bold text-white mb-1">
                                    <a href="product.html?id=${prod.id}" class="hover:text-[#39ff14] transition-colors">${prod.name}</a>
                                </h3>
                                <div class="text-right">
                                    <span class="block text-2xl font-black text-[#39ff14]">$${prod.price}</span>
                                    ${prod.stock > 0 ? `<span class="text-xs text-[#00f3ff]"><i class="fas fa-check-circle"></i> In Stock</span>` : `<span class="text-xs text-red-500">Out of Stock</span>`}
                                </div>
                            </div>
                            <p class="text-xs text-gray-500 uppercase tracking-widest mb-2">${prod.category}</p>
                            <p class="text-gray-400 text-sm line-clamp-2">${prod.description || 'No description available.'}</p>
                        </div>
                        <div class="flex items-center gap-4 mt-4">
                             <button onclick="window.addToCartFromCard('${prod.id}', '${prod.name}', ${prod.price}, '${prod.image_url}', this)" 
                                    class="bg-[#39ff14] text-black font-bold uppercase px-6 py-2 rounded hover:bg-white transition-colors text-sm">
                                <i class="fas fa-cart-plus mr-2"></i> Add to Cart
                            </button>
                            <a href="product.html?id=${prod.id}" class="text-gray-400 hover:text-white text-sm underline decoration-gray-700 hover:decoration-white transition-all underline-offset-4">
                                View Details
                            </a>
                        </div>
                    </div>
                </div>
            `;
        } else {
            cardHTML = `
                <div class="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden group hover:border-[#39ff14] transition-all flex flex-col h-full">
                    <a href="product.html?id=${prod.id}" class="block relative aspect-square overflow-hidden bg-black">
                        <img src="${prod.image_url}" alt="${prod.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                        ${prod.stock === 0 ? '<div class="absolute inset-0 bg-black/60 flex items-center justify-center"><span class="bg-red-600 text-white font-bold px-3 py-1 rounded text-sm uppercase">Out of Stock</span></div>' : ''}
                    </a>
                    <div class="p-5 flex flex-col flex-1">
                        <div class="mb-3">
                            <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">${prod.category}</span>
                            <h3 class="text-lg font-bold text-white leading-tight mt-1 group-hover:text-[#39ff14] transition-colors line-clamp-2">
                                <a href="product.html?id=${prod.id}">${prod.name}</a>
                            </h3>
                        </div>
                        <div class="mt-auto flex items-end justify-between">
                            <div>
                                <span class="block text-2xl font-black text-[#39ff14]">$${prod.price}</span>
                            </div>
                            <button onclick="window.addToCartFromCard('${prod.id}', '${prod.name}', ${prod.price}, '${prod.image_url}', this)" 
                                class="w-10 h-10 rounded-full bg-gray-800 text-white flex items-center justify-center hover:bg-[#39ff14] hover:text-black transition-all shadow-lg group-active:scale-95" 
                                ${prod.stock === 0 ? 'disabled' : ''}>
                                <i class="fas fa-cart-plus"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }

        container.insertAdjacentHTML('beforeend', cardHTML);
    });
};
