const BUILDER_STEPS = [
    { id: 'cpu', title: 'Processor (CPU)', category: 'cpu', icon: 'fa-microchip' },
    { id: 'motherboard', title: 'Motherboard', category: 'motherboard', icon: 'fa-server', dependsOn: 'cpu' },
    { id: 'ram', title: 'Memory (RAM)', category: 'ram', icon: 'fa-memory' },
    { id: 'gpu', title: 'Graphics Card', category: 'gpu', icon: 'fa-video' },
    { id: 'storage', title: 'Storage', category: 'storage', icon: 'fa-hdd' },
    { id: 'psu', title: 'Power Supply', category: 'psu', icon: 'fa-plug' },
    { id: 'case', title: 'PC Case', category: 'case', icon: 'fa-box' }
];

let buildState = {}; // { cpu: {id, ...}, motherboard: {id, ...} }
let activeStepId = null; // For modal



document.addEventListener('DOMContentLoaded', () => {
    initBuilder();
});

function initBuilder() {
    renderSlots();
    updateSummary();

    document.getElementById('finish-build-btn').addEventListener('click', finishBuild);

    // AI Listeners

}

// --- SLOT RENDERING (HUB) ---
function renderSlots() {
    const container = document.getElementById('builder-slots');
    container.innerHTML = BUILDER_STEPS.map(step => {
        const item = buildState[step.id];
        const isSelected = !!item;

        return `
            <div class="group bg-gray-900/50 border ${isSelected ? 'border-[#39ff14]/30' : 'border-gray-800'} hover:border-[#39ff14] rounded-xl p-4 transition-all duration-300 flex items-center gap-4">
                
                <!-- Icon Box -->
                <div class="w-14 h-14 rounded-lg bg-black border border-gray-800 flex items-center justify-center shrink-0 text-xl text-gray-500 group-hover:text-[#39ff14] transition-colors">
                    <i class="fas ${step.icon}"></i>
                </div>
                
                <!-- Content -->
                <div class="flex-1 min-w-0">
                    <h3 class="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">${step.title}</h3>
                    ${isSelected ? `
                        <div class="flex items-center gap-3">
                            ${item.image_url ? `<img src="${item.image_url}" class="w-8 h-8 rounded object-cover border border-gray-700">` : ''}
                            <div class="truncate">
                                <p class="text-white font-bold truncate">${item.name}</p>
                                <p class="text-[#39ff14] font-mono text-xs">$${item.price}</p>
                            </div>
                        </div>
                    ` : `
                        <p class="text-gray-600 text-sm italic">Not selected</p>
                    `}
                </div>

                <!-- Action Button -->
                <button onclick="openPicker('${step.id}')" 
                    class="px-6 py-3 rounded font-bold uppercase text-sm transition-all whitespace-nowrap
                    ${isSelected ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-[#39ff14] text-black hover:shadow-[0_0_15px_#39ff14]'}">
                    ${isSelected ? 'Change' : 'Select'}
                </button>
            </div>
        `;
    }).join('');
}


// --- MODAL / PART PICKER ---
window.openPicker = async (stepId) => {
    activeStepId = stepId;
    const step = BUILDER_STEPS.find(s => s.id === stepId);

    // UI Setup
    const modal = document.getElementById('picker-modal');
    const title = document.getElementById('picker-title');
    const subtitle = document.getElementById('picker-subtitle');
    const grid = document.getElementById('picker-grid');

    title.textContent = `Select ${step.title}`;
    subtitle.textContent = "Loading available options...";
    grid.innerHTML = `<div class="col-span-full py-20 text-center text-gray-500"><i class="fas fa-spinner fa-spin text-3xl mb-4 text-[#39ff14]"></i><p>Loading...</p></div>`;
    modal.classList.remove('hidden');

    try {
        let query = db.collection("products")
            .where("category", "==", step.category);

        const snap = await query.get();
        let products = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Client-side filtering
        products = products.filter(p => (p.stock || 0) > 0);

        // Compatibility Logic
        if (step.dependsOn === 'cpu' && buildState.cpu) {
            const cpuSocket = buildState.cpu.socket;
            if (cpuSocket) {
                const originalCount = products.length;
                products = products.filter(p => p.socket && p.socket.trim().toLowerCase() === cpuSocket.trim().toLowerCase());
                subtitle.textContent = `Showing compatible parts for Socket ${cpuSocket}`;

                if (products.length === 0 && originalCount > 0) {
                    grid.innerHTML = `
                        <div class="col-span-full text-center py-10">
                            <i class="fas fa-exclamation-triangle text-red-500 text-2xl mb-4"></i>
                            <p class="text-gray-300 mb-2">No motherboards found matching <strong>${cpuSocket}</strong> socket.</p>
                            <button onclick="closePicker()" class="text-[#39ff14] underline">Go back</button>
                        </div>`;
                    return;
                }
            }
        } else {
            subtitle.textContent = `Showing all available options`;
        }

        // Render Grid
        if (products.length === 0) {
            grid.innerHTML = `<div class="col-span-full text-center text-gray-500 py-10">No stock available for this category.</div>`;
            return;
        }

        grid.innerHTML = products.map(p => {
            const isSelected = buildState[step.id]?.id === p.id;
            return `
               <div class="bg-black border border-gray-800 rounded-lg overflow-hidden hover:border-[#39ff14] transition-all group flex flex-col">
                   <div class="h-40 relative">
                        <img src="${p.image_url}" class="w-full h-full object-cover">
                        ${isSelected ? '<div class="absolute top-2 right-2 bg-[#39ff14] text-black text-[10px] font-bold px-2 py-1 rounded">CURRENT</div>' : ''}
                   </div>
                   <div class="p-4 flex-1 flex flex-col">
                       <h4 class="text-white font-bold text-sm line-clamp-2 mb-2">${p.name}</h4>
                       ${p.socket ? `<div class="text-[10px] text-gray-500 mb-4 font-mono border border-gray-800 w-fit px-1.5 rounded">${p.socket}</div>` : ''}
                       <div class="mt-auto flex justify-between items-center">
                           <span class="text-[#39ff14] font-mono font-bold">$${p.price}</span>
                           <button onclick='selectProduct(${JSON.stringify(p).replace(/'/g, "&#39;")})' 
                                class="bg-white text-black text-xs font-bold uppercase px-3 py-2 rounded hover:bg-[#39ff14] transition-colors">
                                Add
                           </button>
                       </div>
                   </div>
               </div>
             `;
        }).join('');

    } catch (e) {
        console.error(e);
        grid.innerHTML = `<div class="col-span-full text-center text-red-500">Error: ${e.message}</div>`;
    }
}

window.closePicker = () => {
    document.getElementById('picker-modal').classList.add('hidden');
    activeStepId = null;
};

window.selectProduct = (product) => {
    if (!activeStepId) return;

    // Set State
    buildState[activeStepId] = product;

    // Clear dependencies if conflict? (e.g. Changed CPU socket)
    if (activeStepId === 'cpu') {
        // If we have a mobo selected, check if it's still compatible. If not, remove it.
        if (buildState.motherboard && buildState.motherboard.socket !== product.socket) {
            delete buildState.motherboard;
            // Optionally alert user or Toast?
        }
    }

    renderSlots();
    updateSummary();
    closePicker();
};


function updateSummary() {
    const list = document.getElementById('build-summary-list');
    const totalEl = document.getElementById('build-total');
    const finishBtn = document.getElementById('finish-build-btn');

    const parts = Object.values(buildState);
    const total = parts.reduce((sum, p) => sum + parseFloat(p.price || 0), 0);

    totalEl.textContent = `$${total.toFixed(2)}`;

    finishBtn.disabled = parts.length === 0;
    if (parts.length > 0) {
        finishBtn.classList.remove('bg-gray-800', 'text-gray-500');
        finishBtn.classList.add('bg-[#39ff14]', 'text-black');
    } else {
        finishBtn.classList.add('bg-gray-800', 'text-gray-500');
        finishBtn.classList.remove('bg-[#39ff14]', 'text-black');
    }



    if (parts.length === 0) {
        list.innerHTML = `<p class="text-gray-600 text-sm text-center italic py-4">No parts selected.</p>`;
        return;
    }

    list.innerHTML = BUILDER_STEPS.map(step => {
        const item = buildState[step.id];
        if (!item) return '';
        return `
            <div class="flex justify-between items-start text-xs border-b border-gray-800/50 pb-2 last:border-0 hover:bg-gray-800/30 p-1 rounded transition-colors group">
               <div>
                    <span class="text-gray-500 font-bold uppercase text-[10px] block">${step.title}</span>
                    <span class="text-white line-clamp-1">${item.name}</span>
               </div>
               <span class="text-[#39ff14] font-mono whitespace-nowrap ml-2">$${item.price}</span>
            </div>
        `;
    }).join('');
}


// --- AI LOGIC (Unchanged mostly, just re-renders slots) ---
// --- AI ANALYZER ---


function finishBuild() {
    Object.values(buildState).forEach(item => {
        window.addToCart({
            id: item.id,
            name: item.name,
            price: item.price,
            image_url: item.image_url,
            stock: item.stock
        });
    });
    alert("Build added to cart!");
}
