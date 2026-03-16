/* =========================================
   Global Variables & Initial State
   ========================================= */
let currentWordLimit = 300;

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements Selection ---
    const themeToggle = document.getElementById('themeToggle');
    const inputText = document.getElementById('inputText');
    const outputText = document.getElementById('outputText');
    const pasteBtn = document.getElementById('pasteBtn');
    const clearBtn = document.getElementById('clearBtn');
    const humanizeBtn = document.getElementById('humanizeBtn');
    const copyBtn = document.getElementById('copyBtn');
    
    // Stats & Display Elements
    const wordCountDisplay = document.getElementById('wordCount');
    const charCountDisplay = document.getElementById('charCount');
    const outputWordCount = document.getElementById('outputWordCount');
    const outputContainer = document.getElementById('outputContainer');
    const highlightedOutput = document.getElementById('highlightedOutput');
    const btnText = document.getElementById('btnText');
    const processingText = document.getElementById('processingText');
    
    // Selectors
    const modelSelector = document.getElementById('modelSelector');
    const levelSelector = document.getElementById('levelSelector');
    const styleSelector = document.getElementById('styleSelector');
    const languageSelector = document.getElementById('languageSelector');

    // Meter Elements
    const meterStroke = document.getElementById('meterStroke');
    const scoreText = document.getElementById('scoreText');
    const humanLabel = document.getElementById('humanLabel');

    // =========================================
    // 1. AUTO-EXPAND LOGIC (Naya Addition)
    // =========================================
    function autoExpand(field) {
        if (!field) return;
        // Reset height
        field.style.height = 'inherit';
        // Calculate new height
        const height = field.scrollHeight;
        field.style.height = height + 'px';
    }

    // =========================================
    // 2. THEME LOGIC
    // =========================================
    function initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        if (savedTheme === 'light') {
            document.body.classList.add('light-theme');
            document.body.classList.remove('dark-theme');
        }
        updateThemeIcon();
    }

    function updateThemeIcon() {
        if (!themeToggle) return;
        const icon = themeToggle.querySelector('i');
        const isLight = document.body.classList.contains('light-theme');
        if (icon) {
            icon.className = isLight ? 'fas fa-moon' : 'fas fa-sun';
        }
    }

    themeToggle.addEventListener('click', () => {
        const isLightNow = document.body.classList.toggle('light-theme');
        document.body.classList.toggle('dark-theme', !isLightNow);
        localStorage.setItem('theme', isLightNow ? 'light' : 'dark');
        updateThemeIcon();
    });

    // =========================================
    // 3. WORD & CHAR COUNT LOGIC
    // =========================================
    function updateCounts() {
        const text = inputText.value.trim();
        const words = text ? text.split(/\s+/).length : 0;
        const chars = inputText.value.length;
        
        wordCountDisplay.textContent = `Words: ${words}/${currentWordLimit}`;
        charCountDisplay.textContent = `Chars: ${chars}`;
        
        if (words > currentWordLimit) {
            wordCountDisplay.style.color = '#ff4757';
            humanizeBtn.disabled = true;
        } else {
            wordCountDisplay.style.color = '';
            humanizeBtn.disabled = words === 0;
        }
        
        const outWords = outputText.value.trim() ? outputText.value.trim().split(/\s+/).length : 0;
        outputWordCount.textContent = `Words: ${outWords}`;
    }

    // =========================================
    // 4. METER & HIGHLIGHTING LOGIC
    // =========================================
    function updateHumanMeter(score) {
        const validScore = Math.min(100, Math.max(0, score));
        meterStroke.style.strokeDasharray = `${validScore}, 100`;
        scoreText.textContent = `${validScore}%`;
        humanLabel.textContent = `${validScore}%`;

        if(validScore < 50) {
            meterStroke.style.stroke = "#ff4757"; 
        } else if(validScore < 80) {
            meterStroke.style.stroke = "#ffa502";
        } else {
            meterStroke.style.stroke = "#2ed573";
        }
    }

    function applyHighlights(text, aiDetectedSentences = []) {
        if (!aiDetectedSentences || aiDetectedSentences.length === 0) {
            highlightedOutput.innerHTML = `<span class="text-human">${text}</span>`;
            return;
        }
        let processedHTML = text;
        aiDetectedSentences.forEach(sentence => {
            if (sentence.trim().length > 0) {
                const escaped = sentence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`(${escaped})`, 'gi');
                processedHTML = processedHTML.replace(regex, `<span class="text-ai">$1</span>`);
            }
        });
        highlightedOutput.innerHTML = `<div class="text-human-wrapper">${processedHTML}</div>`;
    }

    // =========================================
    // 5. API EXECUTION
    // =========================================
    humanizeBtn.addEventListener('click', async () => {
        const text = inputText.value.trim();
        if (!text) return;

        humanizeBtn.disabled = true;
        btnText.style.display = 'none';
        processingText.style.display = 'inline';
        outputContainer.style.display = 'block';
        highlightedOutput.innerHTML = "Analyzing linguistic patterns...";
        outputText.value = "Transforming your content...";

        const payload = {
            text: text,
            model: modelSelector.value,
            level: levelSelector.value,
            style: styleSelector.value,
            language: languageSelector.value
        };

        try {
            const response = await fetch("/.netlify/functions/humanize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "API Communication Failed");

            // Success Update
            outputText.value = data.output;
            
            // Auto Expand Output Box (1200 words support)
            autoExpand(outputText); 
            
            updateHumanMeter(data.humanScore || 98);
            applyHighlights(data.output, data.aiSentences || []);
            updateCounts();
            showNotification('✨ Humanized Successfully!', 'success');
            
        } catch (error) {
            outputText.value = `Error: ${error.message}`;
            highlightedOutput.innerHTML = `<span style="color:#ff4757">Optimization failed.</span>`;
            showNotification('❌ Transformation Failed', 'error');
        } finally {
            humanizeBtn.disabled = false;
            btnText.style.display = 'inline';
            processingText.style.display = 'none';
        }
    });

    // =========================================
    // 6. HELPER ACTIONS
    // =========================================
    inputText.addEventListener('input', () => {
        autoExpand(inputText);
        updateCounts();
    });

    pasteBtn.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            inputText.value = text;
            autoExpand(inputText);
            updateCounts();
        } catch (err) {
            showNotification('Unable to access clipboard', 'error');
        }
    });

    clearBtn.addEventListener('click', () => {
        inputText.value = '';
        outputText.value = '';
        inputText.style.height = '280px'; 
        outputText.style.height = '280px';
        outputContainer.style.display = 'none';
        updateCounts();
    });

    copyBtn.addEventListener('click', () => {
        if (outputText.value) {
            navigator.clipboard.writeText(outputText.value);
            showNotification('📋 Copied to Clipboard!', 'success');
        }
    });

    // FAQ Logic
    const viewAllBtn = document.getElementById('viewAllFaqs');
    const moreFaqs = document.getElementById('more-faqs');

    document.querySelectorAll('.faq-question').forEach(q => {
        q.addEventListener('click', () => {
            const item = q.parentElement;
            document.querySelectorAll('.faq-item').forEach(otherItem => {
                if (otherItem !== item) otherItem.classList.remove('active');
            });
            item.classList.toggle('active');
        });
    });

    if (viewAllBtn && moreFaqs) {
        viewAllBtn.addEventListener('click', () => {
            if (moreFaqs.style.display === "none" || moreFaqs.style.display === "") {
                moreFaqs.style.display = "block";
                viewAllBtn.innerHTML = 'Show Less <i class="fas fa-chevron-up"></i>';
            } else {
                moreFaqs.style.display = "none";
                viewAllBtn.innerHTML = 'View All Questions <i class="fas fa-chevron-down"></i>';
            }
        });
    }

    function showNotification(msg, type) {
        const notify = document.createElement('div');
        notify.className = `notification notification-${type}`;
        const bgColor = type === 'success' ? '#4CAF50' : '#f44336';
        notify.style.cssText = `
            position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
            background: ${bgColor}; color: white; padding: 12px 30px;
            border-radius: 50px; z-index: 9999; font-weight: 600;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3); animation: slideUp 0.3s ease;
        `;
        notify.innerText = msg;
        document.body.appendChild(notify);
        setTimeout(() => {
            notify.style.opacity = '0';
            setTimeout(() => notify.remove(), 500);
        }, 3000);
    }

    initTheme();
});
