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

// --- AI LOGIC (Gemini 1.5 Flash) ---
let genAI = null;
let aiModel = null;

async function checkAICompatibility() {
    // Lazy Init
    if (!window.GoogleGenerativeAI) return;
    if (!aiModel) {
        try {
            // Using the key from firebase-config for demo purposes
            const API_KEY = "AIzaSyDtXNyRvQYet8W5kkoxrpZlz_raZJ_y4Wk";
            genAI = new window.GoogleGenerativeAI(API_KEY);
            aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        } catch (e) {
            console.error("AI Init Error:", e);
            return;
        }
    }

    const parts = Object.values(buildState);
    if (parts.length === 0) return;

    const feedbackEl = document.getElementById('ai-feedback');
    const loadingEl = document.getElementById('ai-loading');

    if (loadingEl) loadingEl.classList.remove('hidden');

    // Construct Prompt
    const prompt = `
        As a PC Building Expert, analyze this build list for compatibility issues:
        ${parts.map(p => `- ${p.category} (${p.socket || 'N/A'}): ${p.name}`).join('\n')}
        
        1. Are the parts compatible? (Yes/No)
        2. Any warnings or notes? (Short)
        3. Suggest ONE missing critical component if applicable.
        Keep response under 30 words.
    `;

    try {
        const result = await aiModel.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        if (feedbackEl) {
            feedbackEl.innerHTML = `<p class="text-white text-sm"><i class="fas fa-magic text-[#39ff14] mr-2"></i> ${text.replace(/\*\*/g, '')}</p>`; // Basic formatting
        }
    } catch (e) {
        console.error("AI Check Failed:", e);
        if (feedbackEl) feedbackEl.innerHTML = `<p class="text-red-500 text-xs">AI Service Unavailable.</p>`;
    } finally {
        if (loadingEl) loadingEl.classList.add('hidden');
    }
}

// Hook into selection (Override existing function partial)
const _originalSelect = window.selectProduct;
window.selectProduct = (product) => {
    // Re-implement or call original? Since original is window attached, we can copy body.
    // Easier to just duplicate logic here to be safe and clear.

    if (!activeStepId) return;

    // Set State
    buildState[activeStepId] = product;

    // Clear dependencies if conflict
    if (activeStepId === 'cpu') {
        if (buildState.motherboard && buildState.motherboard.socket !== product.socket) {
            delete buildState.motherboard;
            alert("Motherboard deselected: Socket mismatch with new CPU.");
        }
    }

    renderSlots();
    updateSummary();
    closePicker();

    // Trigger AI
    checkAICompatibility();
};

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
