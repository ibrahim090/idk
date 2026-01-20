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
                loadAdminInventory();
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
            let image = document.getElementById('p-image').value;

            // Use placeholder if empty
            if (!image) {
                image = `https://source.unsplash.com/random/400x300/?${category},tech`;
            }

            db.collection("products").add({
                name,
                price,
                stock, // NEW: Stock field
                category,
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
}

function loadAdminInventory() {
    const tbody = document.getElementById('inventory-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center">Loading...</td></tr>';

    db.collection("products").orderBy("created_at", "desc").get().then((querySnapshot) => {
        tbody.innerHTML = ''; // Clear loading

        if (querySnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center">No products found.</td></tr>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const row = document.createElement('tr');
            row.className = "hover:bg-gray-900/50 transition-colors";
            row.innerHTML = `
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
   STOREFRONT LOGIC
   ============================ */
function initStorefront() {
    const productContainer = document.getElementById('product-container');

    // Determine category based on current page
    let categoryFilter = null;
    const path = window.location.pathname;

    if (path.includes('laptops.html')) {
        categoryFilter = 'Laptop';
    } else if (path.includes('components.html')) {
        categoryFilter = ['GPU', 'CPU']; // Array for multiple types
    } else if (path.includes('accessories.html')) {
        categoryFilter = 'Accessory';
    }

    if (productContainer) loadProducts(productContainer, categoryFilter);
    updateCartUI();
}

function loadProducts(container, filter) {
    let query = db.collection("products").orderBy("created_at", "desc");

    // Note: strict equality filtering in Firestore with 'where' + 'orderBy' requires composite index.
    // To avoid index creation hassle for the user, we will filter client-side for this small app.

    query.get().then((querySnapshot) => {
        container.innerHTML = ''; // Clear loading

        if (querySnapshot.empty) {
            container.innerHTML = '<div class="col-span-full text-center py-20">No products available right now.</div>';
            return;
        }

        let hasItems = false;

        querySnapshot.forEach((doc) => {
            const data = doc.data();

            // Client-side Filter
            if (filter) {
                if (Array.isArray(filter)) {
                    if (!filter.includes(data.category)) return;
                } else {
                    if (data.category !== filter) return;
                }
            }

            hasItems = true;
            const stock = data.stock || 0;
            const isOutOfStock = stock === 0;

            // Sanitize Cart on Load (Fix NaN issue) - This line was added based on the instruction, but `data` here refers to product data, not cart data.
            // It's likely intended for cart items, but placed here in the instruction. Keeping it as per instruction.
            if (!data.qty) data.qty = 1;

            const card = document.createElement('div');
            card.className = "bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-[#39ff14] transition-all group hover:shadow-[0_0_20px_rgba(57,255,20,0.1)] flex flex-col";
            card.innerHTML = `
                <div class="h-48 overflow-hidden relative">
                    <img src="${data.image_url}" alt="${data.name}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">
                    <div class="absolute top-2 right-2 bg-black/80 backdrop-blur px-2 py-1 rounded text-xs font-bold text-white uppercase border border-gray-700">
                        ${data.category}
                    </div>
                </div>
                <div class="p-5 flex-1 flex flex-col">
                    <h3 class="text-lg font-bold text-white mb-2 truncate" title="${data.name}">${data.name}</h3>
                    
                    <div class="mt-auto">
                        <div class="flex justify-between items-end mb-4">
                            <div class="flex flex-col">
                                <span class="text-xl font-bold text-[#39ff14]">$${data.price}</span>
                                <span class="text-xs text-gray-500">${stock > 0 ? stock + ' in stock' : 'Out of Stock'}</span>
                            </div>
                        </div>

                        <div class="flex items-center space-x-2">
                            <input type="number" id="qty-${doc.id}" 
                                class="w-16 bg-black border border-gray-700 rounded p-1 text-center text-white focus:border-[#39ff14] outline-none" 
                                value="1" min="1" max="${stock}" ${isOutOfStock ? 'disabled' : ''}>
                            
                            <button class="flex-1 bg-white text-black py-1.5 rounded font-bold uppercase text-sm hover:bg-[#39ff14] transition-colors ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : ''}"
                                onclick="window.addToCartFromCard(this, '${doc.id}', '${data.name}', ${data.price}, '${data.image_url}', ${stock})">
                                ${isOutOfStock ? 'Sold Out' : 'Add to Cart'}
                            </button>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });

        if (!hasItems) {
            container.innerHTML = '<div class="col-span-full text-center py-20 text-gray-500">No products found in this category.</div>';
        }

    }).catch((e) => {
        console.error("Error loading products", e);
        container.innerHTML = `<div class="col-span-full text-center text-red-500 py-20">Unable to load products. Check your connection or API keys.</div>`;
    });
}

// Wrapper to get quantity from input
// Accepts 'btn' element as first argument to avoid global event issues
window.addToCartFromCard = (btn, id, name, price, image, maxStock) => {
    if (maxStock === 0) return;

    // Prevent default form submission if inside a form (just in case)
    if (window.event) window.event.preventDefault();

    const qtyInput = document.getElementById(`qty-${id}`);
    let qty = 1;
    if (qtyInput) {
        qty = parseInt(qtyInput.value) || 1;
        if (qty < 1) qty = 1;
        if (qty > maxStock) qty = maxStock;
    }

    coreAddToCart(id, name, price, image, maxStock, qty, btn);
};

// Internal Add Function - Renamed to avoid recursion
function coreAddToCart(id, name, price, image, maxStock, qtyToAdd, btnElement) {
    // Check if already in cart and check stock limits
    const existing = STATE.cart.find(item => item.id === id);
    const currentQtyInCart = existing ? existing.qty : 0;

    if ((currentQtyInCart + qtyToAdd) > maxStock) {
        alert(`Sorry, you can't add more. Only ${maxStock} in stock (You have ${currentQtyInCart} in cart).`);
        return;
    }

    if (existing) {
        existing.qty = (existing.qty || 0) + qtyToAdd; // Safety check
    } else {
        STATE.cart.push({ id, name, price, image, qty: qtyToAdd });
    }

    localStorage.setItem('techzone_cart', JSON.stringify(STATE.cart));
    updateCartUI();

    // Visual Feedback
    if (btnElement) {
        const originalContent = btnElement.innerHTML;
        btnElement.innerHTML = '<i class="fas fa-check"></i> Added';
        btnElement.classList.add('bg-[#39ff14]');

        // Disable temporarily
        btnElement.disabled = true;

        setTimeout(() => {
            btnElement.innerHTML = originalContent;
            btnElement.classList.remove('bg-[#39ff14]');
            btnElement.disabled = false;
        }, 1000);
    }
}

// Global scope wrapper
window.addToCart = (id, name, price, image, maxStock = 999) => coreAddToCart(id, name, price, image, maxStock, 1, null);

window.removeFromCart = (index) => {
    STATE.cart.splice(index, 1);
    localStorage.setItem('techzone_cart', JSON.stringify(STATE.cart));
    renderCartItems();
    updateCartUI();
};

function updateCartUI() {
    const countBadge = document.getElementById('cart-count');
    if (countBadge) {
        // Count total items
        const totalItems = STATE.cart.reduce((acc, item) => acc + item.qty, 0);
        countBadge.textContent = totalItems;
    }
}

// Cart Modal Logic
const cartModal = document.getElementById('cart-modal');
const cartBtn = document.getElementById('cart-btn');
const closeCartBtn = document.getElementById('close-cart');
const cartBackdrop = document.getElementById('cart-backdrop');

if (cartBtn && cartModal) {
    cartBtn.addEventListener('click', () => {
        cartModal.classList.remove('hidden');
        renderCartItems();
    });

    const closeCart = () => cartModal.classList.add('hidden');
    if (closeCartBtn) closeCartBtn.addEventListener('click', closeCart);
    if (cartBackdrop) cartBackdrop.addEventListener('click', closeCart);
}

function renderCartItems() {
    const itemsContainer = document.getElementById('cart-items');
    const totalEl = document.getElementById('cart-total');

    if (!itemsContainer) return;

    itemsContainer.innerHTML = '';
    let total = 0;

    if (STATE.cart.length === 0) {
        itemsContainer.innerHTML = '<p class="text-gray-500 text-center mt-10">Your cart is empty.</p>';
    } else {
        STATE.cart.forEach((item, index) => {
            total += item.price * item.qty;
            const itemEl = document.createElement('div');
            itemEl.className = "flex items-center space-x-4 bg-gray-800/50 p-3 rounded border border-gray-700";
            itemEl.innerHTML = `
                <img src="${item.image}" class="w-16 h-16 object-cover rounded bg-black">
                <div class="flex-1">
                    <h4 class="text-sm font-bold text-white truncate">${item.name}</h4>
                    <p class="text-xs text-gray-500">Qty: ${item.qty}</p>
                    <p class="text-[#39ff14] font-mono">$${(item.price * item.qty).toFixed(2)}</p>
                </div>
                <button onclick="window.removeFromCart(${index})" class="text-gray-500 hover:text-red-500 transition-colors">
                    <i class="fas fa-times"></i>
                </button>
            `;
            itemsContainer.appendChild(itemEl);
        });
    }

    if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;
}
