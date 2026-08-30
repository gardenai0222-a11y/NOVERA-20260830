/**
 * NOVERA 官方跨瀏覽器防 UUID 亂碼下載引擎 (Universal Safe File Downloader)
 * 徹底解決 Windows / Chrome / Edge 下載 SheetJS Excel、Blob、JSON 時檔名遺失為 GUID 的問題
 */
(function() {
    window.noveraDownloadFile = function(dataOrBlob, filename, mimeType) {
        try {
            let blob;
            if (dataOrBlob instanceof Blob) {
                blob = dataOrBlob;
            } else if (typeof dataOrBlob === 'string') {
                blob = new Blob([dataOrBlob], { type: mimeType || 'text/plain;charset=utf-8' });
            } else if (dataOrBlob instanceof ArrayBuffer || ArrayBuffer.isView(dataOrBlob)) {
                blob = new Blob([dataOrBlob], { type: mimeType || 'application/octet-stream' });
            } else {
                blob = new Blob([JSON.stringify(dataOrBlob, null, 2)], { type: 'application/json;charset=utf-8' });
            }

            let fileObj;
            try {
                fileObj = new File([blob], filename, { type: blob.type });
            } catch(e) {
                fileObj = blob;
            }

            const url = window.URL.createObjectURL(fileObj);
            const a = document.createElement('a');
            a.style.position = 'fixed';
            a.style.left = '-9999px';
            a.style.top = '-9999px';
            a.href = url;
            a.download = filename;
            a.setAttribute('download', filename);
            document.body.appendChild(a);
            
            a.click();

            // 關鍵：延遲 60 秒釋放 URL，絕不可同步 revokeObjectURL，保證瀏覽器下載管理器已完整寫入檔名與副檔名
            setTimeout(function() {
                if (a.parentNode) a.parentNode.removeChild(a);
                window.URL.revokeObjectURL(url);
            }, 60000);
        } catch (err) {
            console.error('noveraDownloadFile 發生錯誤:', err);
            if (typeof dataOrBlob === 'string' && (dataOrBlob.endsWith('.xlsx') || dataOrBlob.endsWith('.json'))) {
                window.location.href = dataOrBlob;
            }
        }
    };

    // 徹底攔截並覆蓋 SheetJS 的 XLSX.writeFile，阻斷其觸發 chrome.downloads.download 的 UUID Bug
    function patchSheetJS() {
        if (typeof XLSX !== 'undefined' && !XLSX._noveraPatched) {
            XLSX._noveraPatched = true;
            const originalWriteFile = XLSX.writeFile;
            XLSX.writeFile = function(wb, filename, opts) {
                try {
                    const defaultMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                    const outType = (opts && opts.bookType === 'csv') ? 'string' : 'array';
                    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: outType, ...opts });
                    window.noveraDownloadFile(wbout, filename, defaultMime);
                } catch(e) {
                    console.warn('XLSX 自訂下載引擎降級:', e);
                    if (originalWriteFile) originalWriteFile.call(XLSX, wb, filename, opts);
                }
            };
        }
    }

    patchSheetJS();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', patchSheetJS);
    }
    window.addEventListener('load', patchSheetJS);
})();

// ==========================================
// NOVERA 官方全站 UI 與互動控制邏輯
// ==========================================
document.addEventListener('DOMContentLoaded', () => {

    // 1. 漢堡選單 (Hamburger Menu) 開關與手機導航
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');

    if (hamburger && navLinks) {
        hamburger.addEventListener('click', (e) => {
            e.stopPropagation();
            navLinks.classList.toggle('active');
            hamburger.classList.toggle('active');
        });
        
        // 點擊導覽連結後自動收合選單（一般頁面連結）
        document.querySelectorAll('.nav-links a:not(.dropdown-toggle)').forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 1100 && !link.closest('.nav-dropdown')) {
                    navLinks.classList.remove('active');
                    hamburger.classList.remove('active');
                }
            });
        });

        // 點擊網頁其他空白處自動收合漢堡選單
        document.addEventListener('click', (e) => {
            if (navLinks.classList.contains('active') && !navLinks.contains(e.target) && !hamburger.contains(e.target)) {
                navLinks.classList.remove('active');
                hamburger.classList.remove('active');
            }
        });
    }

    // 2. 手機版下拉選單 (實用工程工具) 觸控點擊展開/收合
    document.querySelectorAll('.nav-dropdown').forEach(dropdown => {
        const dropLink = dropdown.querySelector('a');
        if (dropLink) {
            dropLink.addEventListener('click', function(e) {
                if (window.innerWidth <= 1100) {
                    e.preventDefault();
                    dropdown.classList.toggle('active');
                    const menu = dropdown.querySelector('.dropdown-menu');
                    if (menu) {
                        menu.style.display = dropdown.classList.contains('active') ? 'block' : 'none';
                    }
                }
            });
        }
    });

    // 3. 頂部導覽列滾動陰影特效 (Navbar Scroll Effect)
    const navbar = document.querySelector('.navbar');
    if (navbar) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });
    }

    // 4. 平滑錨點滾動 (Smooth Scrolling for Anchors)
    document.querySelectorAll('a[href*="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href && (href.startsWith('#') || (window.location.pathname.endsWith('tools.html') && href.includes('tools.html#')))) {
                const hash = href.includes('#') ? href.substring(href.indexOf('#')) : '';
                if (hash && hash !== '#') {
                    const target = document.querySelector(hash);
                    if (target) {
                        e.preventDefault();
                        target.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                        });
                        history.pushState(null, null, hash);
                    }
                }
            }
        });
    });

    // 5. FAQ 手風琴摺疊元件 (FAQ Accordion)
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        if (question) {
            question.addEventListener('click', () => {
                faqItems.forEach(otherItem => {
                    if (otherItem !== item && otherItem.classList.contains('active')) {
                        otherItem.classList.remove('active');
                    }
                });
                item.classList.toggle('active');
            });
        }
    });

    // Counter Animation function
    const animateCounters = () => {
        const counters = document.querySelectorAll('.counter');
        const speed = 200;

        counters.forEach(counter => {
            const updateCount = () => {
                const target = +counter.getAttribute('data-target');
                const count = +counter.innerText;
                const inc = target / speed;

                if (count < target) {
                    counter.innerText = Math.ceil(count + inc);
                    setTimeout(updateCount, 20);
                } else {
                    counter.innerText = target;
                }
            };
            
            const rect = counter.getBoundingClientRect();
            if (rect.top < window.innerHeight && counter.innerText == '0') {
                updateCount();
            }
        });
    }

    // Scroll Observer for Animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    };

    const scrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                if (entry.target.classList.contains('about-text')) {
                    animateCounters();
                }
            }
        });
    }, observerOptions);

    // Scroll to Top Button Injection & Logic
    const scrollToTopBtn = document.createElement('button');
    scrollToTopBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
    scrollToTopBtn.className = 'scroll-to-top';
    scrollToTopBtn.setAttribute('aria-label', '回到頂部');
    document.body.appendChild(scrollToTopBtn);

    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            scrollToTopBtn.classList.add('show');
        } else {
            scrollToTopBtn.classList.remove('show');
        }
    });

    scrollToTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    const elementsToObserve = document.querySelectorAll('.about-text');
    elementsToObserve.forEach(el => {
        scrollObserver.observe(el);
    });

    // --- Inject SweetAlert2 ---
    if (!document.getElementById('swal2-script')) {
        const swalScript = document.createElement('script');
        swalScript.id = 'swal2-script';
        swalScript.src = 'https://cdn.jsdelivr.net/npm/sweetalert2@11';
        document.head.appendChild(swalScript);
    }

    // --- Inject Floating LINE Button ---
    const floatingLineBtn = document.createElement('a');
    floatingLineBtn.href = 'assets/line_contact_qr.jpg';
    floatingLineBtn.target = '_blank';
    floatingLineBtn.className = 'floating-line';
    floatingLineBtn.innerHTML = '<i class="fab fa-line"></i>';
    floatingLineBtn.setAttribute('title', '點擊檢視 LINE QR Code 加好友聯絡管理員');
    floatingLineBtn.setAttribute('aria-label', '開啟 LINE QR Code');
    document.body.appendChild(floatingLineBtn);

    // --- Initialize tool-page widgets (only if corresponding elements exist on page) ---
    if (document.getElementById('rebar-chips-container')) {
        initRebarChips();
        updateRebarSpec();
    }
    if (document.getElementById('rain-city')) {
        populateRainDistricts();
    }
});




/* ==========================================================================
   NOVERA 高階鋼筋規範 ＆ 混凝土伸展搭接長度速查系統 (土木結構技師標準)
   ========================================================================== */

const REBAR_DATA = {
    '3':  { name: '#3 (D10)', db: 9.53,  weight: 0.560, area: 0.713, perim: 2.99, perton: 1786, factor: 'small' },
    '4':  { name: '#4 (D13)', db: 12.70, weight: 0.994, area: 1.267, perim: 3.99, perton: 1006, factor: 'small' },
    '5':  { name: '#5 (D16)', db: 15.90, weight: 1.560, area: 1.986, perim: 4.99, perton: 641,  factor: 'small' },
    '6':  { name: '#6 (D19)', db: 19.10, weight: 2.250, area: 2.865, perim: 5.99, perton: 444,  factor: 'small' },
    '7':  { name: '#7 (D22)', db: 22.20, weight: 3.040, area: 3.871, perim: 6.98, perton: 329,  factor: 'large' },
    '8':  { name: '#8 (D25)', db: 25.40, weight: 3.980, area: 5.067, perim: 7.98, perton: 251,  factor: 'large' },
    '9':  { name: '#9 (D29)', db: 28.70, weight: 5.080, area: 6.469, perim: 9.01, perton: 197,  factor: 'large' },
    '10': { name: '#10 (D32)',db: 32.20, weight: 6.390, area: 8.143, perim: 10.12, perton: 156, factor: 'large' },
    '11': { name: '#11 (D36)',db: 35.80, weight: 7.900, area: 10.066, perim: 11.25, perton: 127, factor: 'large' }
};

let currentSelectedRebar = '6';

function initRebarChips() {
    const container = document.getElementById('rebar-chips-container');
    if (!container) return;
    container.innerHTML = '';
    
    Object.keys(REBAR_DATA).forEach(num => {
        const btn = document.createElement('button');
        btn.id = `rebar-chip-${num}`;
        btn.className = 'rebar-chip-btn';
        btn.innerHTML = `#${num}`;
        btn.style.cssText = `padding: 6px 14px; border-radius: 20px; font-weight: 800; font-size: 0.95rem; cursor: pointer; transition: all 0.2s; border: 1px solid ${num === currentSelectedRebar ? '#2563EB' : '#CBD5E1'}; background: ${num === currentSelectedRebar ? '#2563EB' : '#fff'}; color: ${num === currentSelectedRebar ? '#fff' : '#334155'};`;
        
        btn.onclick = () => {
            currentSelectedRebar = num;
            document.querySelectorAll('.rebar-chip-btn').forEach(b => {
                b.style.background = '#fff';
                b.style.color = '#334155';
                b.style.borderColor = '#CBD5E1';
            });
            btn.style.background = '#2563EB';
            btn.style.color = '#fff';
            btn.style.borderColor = '#2563EB';
            updateRebarSpec();
        };
        container.appendChild(btn);
    });
}

function calculateRebarLengths(rebarKey, fy, fc) {
    const data = REBAR_DATA[rebarKey];
    const db_cm = data.db / 10.0;
    const sqrt_fc = Math.sqrt(fc);
    
    // 基本受拉伸展長度 ld (cm)
    // 依內政部規範第5.3節：小號筋(≤#6)除以 6.6√fc；大號筋(≥#7)除以 5.3√fc
    let ld;
    if (data.factor === 'small') {
        ld = (fy / (6.6 * sqrt_fc)) * db_cm;
    } else {
        ld = (fy / (5.3 * sqrt_fc)) * db_cm;
    }
    ld = Math.max(30.0, ld); // 規範低限 30cm
    
    const ld_rounded = Math.ceil(ld);
    const lap_b = Math.ceil(ld * 1.3); // 乙種搭接 (1.3 ld)
    const lap_top = Math.ceil(ld * 1.3 * 1.3); // 頂層鋼筋搭接 (1.3 * 1.3 ld)
    
    // 受壓搭接長度 (cm) - 規範要求 0.0072 * fy * db 或 30cm
    let lap_comp = Math.max(30.0, 0.0072 * fy * db_cm);
    if (fy === 4200) lap_comp = Math.max(lap_comp, 30.0 * db_cm);
    const lap_comp_rounded = Math.ceil(lap_comp);
    
    // 標準彎鉤
    const hook_90 = Math.ceil(12.0 * db_cm); // 12 db
    const hook_135 = Math.ceil(Math.max(6.0 * db_cm, 7.5)); // 6 db ≥ 7.5cm
    const hook_180 = Math.ceil(Math.max(4.0 * db_cm, 6.5)); // 4 db ≥ 6.5cm
    
    // 彎心直徑 (內徑)
    const pin_mult = (parseInt(rebarKey) <= 8) ? 6 : 8;
    const pin_diam = (pin_mult * db_cm).toFixed(1);
    
    return {
        ld: ld_rounded,
        lap_b: lap_b,
        lap_top: lap_top,
        lap_comp: lap_comp_rounded,
        hook_90: hook_90,
        hook_135: hook_135,
        hook_180: hook_180,
        pin_diam: pin_diam,
        pin_mult: pin_mult
    };
}

window.updateRebarSpec = function() {
    const fyElem = document.getElementById('rebar-fy');
    const fcElem = document.getElementById('rebar-fc');
    if (!fyElem || !fcElem) return;
    
    const fy = parseFloat(fyElem.value);
    const fc = parseFloat(fcElem.value);
    const data = REBAR_DATA[currentSelectedRebar];
    if (!data) return;
    
    const calc = calculateRebarLengths(currentSelectedRebar, fy, fc);
    
    // 更新單號數卡片
    const dbEl = document.getElementById('spec-db');
    if (dbEl) {
        dbEl.innerText = `${data.db} mm`;
        document.getElementById('spec-weight').innerText = `${data.weight.toFixed(3)} kg/m`;
        document.getElementById('spec-area').innerText = `${data.area.toFixed(3)} cm²`;
        document.getElementById('spec-perim').innerText = `${data.perim.toFixed(2)} cm`;
        document.getElementById('spec-perton').innerText = `${data.perton} m`;
        document.getElementById('spec-per12m').innerText = `${(data.weight * 12).toFixed(1)} kg`;
        
        document.getElementById('spec-ld').innerText = `${calc.ld} cm`;
        document.getElementById('spec-lap-b').innerText = `${calc.lap_b} cm`;
        document.getElementById('spec-lap-top').innerText = `${calc.lap_top} cm`;
        document.getElementById('spec-lap-comp').innerText = `${calc.lap_comp} cm`;
        
        document.getElementById('spec-hook90').innerText = `${calc.hook_90} cm`;
        document.getElementById('spec-hook135').innerText = `${calc.hook_135} cm`;
        document.getElementById('spec-hook180').innerText = `${calc.hook_180} cm`;
        document.getElementById('spec-pin').innerText = `${calc.pin_diam} cm (${calc.pin_mult} db)`;
    }
    
    // 更新矩陣大表
    const tbody = document.getElementById('rebar-matrix-tbody');
    if (tbody) {
        let html = '';
        Object.keys(REBAR_DATA).forEach(num => {
            const rData = REBAR_DATA[num];
            const rCalc = calculateRebarLengths(num, fy, fc);
            const isSelected = (num === currentSelectedRebar);
            html += `<tr style="border-bottom: 1px solid #E2E8F0; background: ${isSelected ? '#EFF6FF' : '#fff'};">
                <td style="padding: 10px 8px; font-weight: 800; color: #1E293B; border: 1px solid #E2E8F0;">${rData.name}</td>
                <td style="padding: 10px 8px; border: 1px solid #E2E8F0;">${rData.db}</td>
                <td style="padding: 10px 8px; border: 1px solid #E2E8F0; font-weight: 700; color: #0F172A;">${rData.weight.toFixed(3)}</td>
                <td style="padding: 10px 8px; border: 1px solid #E2E8F0;">${rData.area.toFixed(3)}</td>
                <td style="padding: 10px 8px; border: 1px solid #E2E8F0; font-weight: 900; color: #DC2626; font-size: 1rem; background: ${isSelected ? '#DBEAFE' : '#FEF2F2'};">${rCalc.lap_b} cm</td>
                <td style="padding: 10px 8px; border: 1px solid #E2E8F0; font-weight: 700; color: #B45309;">${rCalc.lap_top} cm</td>
                <td style="padding: 10px 8px; border: 1px solid #E2E8F0;">${rCalc.lap_comp} cm</td>
                <td style="padding: 10px 8px; border: 1px solid #E2E8F0;">${rCalc.hook_90} cm</td>
                <td style="padding: 10px 8px; border: 1px solid #E2E8F0;">${rCalc.hook_135} cm</td>
            </tr>`;
        });
        tbody.innerHTML = html;
    }
};

window.switchRebarView = function(view) {
    const singleView = document.getElementById('rebar-single-view');
    const matrixView = document.getElementById('rebar-matrix-view');
    const btnSingle = document.getElementById('rebar-tab-single');
    const btnMatrix = document.getElementById('rebar-tab-matrix');
    const chipsBlock = document.getElementById('rebar-bar-chips');
    
    if (view === 'single') {
        if (singleView) singleView.style.display = 'block';
        if (matrixView) matrixView.style.display = 'none';
        if (chipsBlock) chipsBlock.style.display = 'block';
        if (btnSingle) { btnSingle.style.background = '#2563EB'; btnSingle.style.color = '#fff'; }
        if (btnMatrix) { btnMatrix.style.background = '#F1F5F9'; btnMatrix.style.color = '#475569'; }
    } else {
        if (singleView) singleView.style.display = 'none';
        if (matrixView) matrixView.style.display = 'block';
        if (chipsBlock) chipsBlock.style.display = 'none';
        if (btnSingle) { btnSingle.style.background = '#F1F5F9'; btnSingle.style.color = '#475569'; }
        if (btnMatrix) { btnMatrix.style.background = '#2563EB'; btnMatrix.style.color = '#fff'; }
    }
};


/* ==========================================================================
   NOVERA 南高屏各行政區即時雨量 ＆ 免計工期自動判定站
   ========================================================================== */

const SOUTHERN_STATIONS = {
    'kh': {
        name: '高雄市',
        districts: {
            '苓雅區/前金/新興': { station: '高雄氣象站 (467440)', cwaUrl: 'https://www.cwa.gov.tw/V8/C/W/OBS_Station.html?ID=467440' },
            '楠梓區': { station: '楠梓自動觀測站 (C0V730)', cwaUrl: 'https://www.cwa.gov.tw/V8/C/W/OBS_Station.html?ID=C0V730' },
            '左營區': { station: '左營觀測站 (C0V740)', cwaUrl: 'https://www.cwa.gov.tw/V8/C/W/OBS_Station.html?ID=C0V740' },
            '三民區': { station: '三民覆鼎金站 (C0V810)', cwaUrl: 'https://www.cwa.gov.tw/V8/C/W/OBS_Station.html?ID=C0V810' },
            '鳳山區': { station: '鳳山觀測站 (C0V760)', cwaUrl: 'https://www.cwa.gov.tw/V8/C/W/OBS_Station.html?ID=C0V760' },
            '仁武區': { station: '仁武自動站 (C0V770)', cwaUrl: 'https://www.cwa.gov.tw/V8/C/W/OBS_Station.html?ID=C0V770' },
            '大社區': { station: '大社觀測站 (C0V780)', cwaUrl: 'https://www.cwa.gov.tw/V8/C/W/OBS_Station.html?ID=C0V780' },
            '岡山區': { station: '岡山觀測站 (C0V680)', cwaUrl: 'https://www.cwa.gov.tw/V8/C/W/OBS_Station.html?ID=C0V680' },
            '橋頭區': { station: '橋頭自動站 (C0V690)', cwaUrl: 'https://www.cwa.gov.tw/V8/C/W/OBS_Station.html?ID=C0V690' },
            '路竹區': { station: '路竹觀測站 (C0V650)', cwaUrl: 'https://www.cwa.gov.tw/V8/C/W/OBS_Station.html?ID=C0V650' },
            '大寮區': { station: '大寮自動站 (C0V750)', cwaUrl: 'https://www.cwa.gov.tw/V8/C/W/OBS_Station.html?ID=C0V750' },
            '小港區': { station: '小港高雄港站 (C0V720)', cwaUrl: 'https://www.cwa.gov.tw/V8/C/W/OBS_Station.html?ID=C0V720' },
            '前鎮區': { station: '前鎮漁港站 (C0V800)', cwaUrl: 'https://www.cwa.gov.tw/V8/C/W/OBS_Station.html?ID=C0V800' },
            '旗山區': { station: '旗山觀測站 (C0V630)', cwaUrl: 'https://www.cwa.gov.tw/V8/C/W/OBS_Station.html?ID=C0V630' },
            '美濃區': { station: '美濃吉洋站 (C0V620)', cwaUrl: 'https://www.cwa.gov.tw/V8/C/W/OBS_Station.html?ID=C0V620' },
            '燕巢區': { station: '燕巢自動站 (C0V700)', cwaUrl: 'https://www.cwa.gov.tw/V8/C/W/OBS_Station.html?ID=C0V700' },
            '林園區': { station: '林園自動站 (C0V790)', cwaUrl: 'https://www.cwa.gov.tw/V8/C/W/OBS_Station.html?ID=C0V790' },
            '梓官/彌陀/永安': { station: '彌陀自動站 (C0V660)', cwaUrl: 'https://www.cwa.gov.tw/V8/C/W/OBS_Station.html?ID=C0V660' }
        }
    },
    'tn': {
        name: '台南市',
        districts: {
            '中西區/東區/南區/北區': { station: '臺南氣象站 (467410)', cwaUrl: 'https://www.cwa.gov.tw/V8/C/W/OBS_Station.html?ID=467410' },
            '安南區': { station: '安南自動站 (C0X060)', cwaUrl: 'https://www.cwa.gov.tw/V8/C/W/OBS_Station.html?ID=C0X060' },
            '安平區': { station: '安平觀測站 (C0X050)', cwaUrl: 'https://www.cwa.gov.tw/V8/C/W/OBS_Station.html?ID=C0X050' },
            '永康區': { station: '永康氣象站 (467420)', cwaUrl: 'https://www.cwa.gov.tw/V8/C/W/OBS_Station.html?ID=467420' },
            '新化區': { station: '新化觀測站 (C0X100)', cwaUrl: 'https://www.cwa.gov.tw/V8/C/W/OBS_Station.html?ID=C0X100' },
            '善化區': { station: '善化自動站 (C0X110)', cwaUrl: 'https://www.cwa.gov.tw/V8/C/W/OBS_Station.html?ID=C0X110' },
            '新市/山上/安定': { station: '新市自動站 (C0X090)', cwaUrl: 'https://www.cwa.gov.tw/V8/C/W/OBS_Station.html?ID=C0X090' },
            '仁德/歸仁/關廟': { station: '歸仁自動站 (C0X120)', cwaUrl: 'https://www.cwa.gov.tw/V8/C/W/OBS_Station.html?ID=C0X120' },
            '新營/後壁/鹽水': { station: '新營自動站 (C0X160)', cwaUrl: 'https://www.cwa.gov.tw/V8/C/W/OBS_Station.html?ID=C0X160' },
            '麻豆/官田/下營': { station: '麻豆觀測站 (C0X140)', cwaUrl: 'https://www.cwa.gov.tw/V8/C/W/OBS_Station.html?ID=C0X140' },
            '佳里/七股/西港': { station: '佳里觀測站 (C0X070)', cwaUrl: 'https://www.cwa.gov.tw/V8/C/W/OBS_Station.html?ID=C0X070' },
            '白河/東山/六甲': { station: '白河觀測站 (C0X190)', cwaUrl: 'https://www.cwa.gov.tw/V8/C/W/OBS_Station.html?ID=C0X190' },
            '玉井/楠西/南化': { station: '玉井觀測站 (C0X210)', cwaUrl: 'https://www.cwa.gov.tw/V8/C/W/OBS_Station.html?ID=C0X210' }
        }
    },
    'pt': {
        name: '屏東縣',
        districts: {
            '屏東市/萬丹/長治/麟洛': { station: '屏東觀測站 (C0R130)', cwaUrl: 'https://www.cwa.gov.tw/V8/C/W/OBS_Station.html?ID=C0R130' },
            '潮州/萬巒/竹田/內埔': { station: '潮州觀測站 (C0R170)', cwaUrl: 'https://www.cwa.gov.tw/V8/C/W/OBS_Station.html?ID=C0R170' },
            '東港/新園/崁頂/林邊': { station: '東港觀測站 (C0R220)', cwaUrl: 'https://www.cwa.gov.tw/V8/C/W/OBS_Station.html?ID=C0R220' },
            '恆春/車城/滿州': { station: '恆春氣象站 (467590)', cwaUrl: 'https://www.cwa.gov.tw/V8/C/W/OBS_Station.html?ID=467590' },
            '里港/九如/高樹/鹽埔': { station: '里港觀測站 (C0R150)', cwaUrl: 'https://www.cwa.gov.tw/V8/C/W/OBS_Station.html?ID=C0R150' },
            '枋寮/枋山/獅子/春日': { station: '枋寮觀測站 (C0R260)', cwaUrl: 'https://www.cwa.gov.tw/V8/C/W/OBS_Station.html?ID=C0R260' },
            '琉球鄉 (小琉球)': { station: '琉球嶼站 (C0R240)', cwaUrl: 'https://www.cwa.gov.tw/V8/C/W/OBS_Station.html?ID=C0R240' }
        }
    }
};

window.populateRainDistricts = function() {
    const cityEl = document.getElementById('rain-city');
    const distSelect = document.getElementById('rain-district');
    if (!cityEl || !distSelect) return;
    
    const cityKey = cityEl.value;
    distSelect.innerHTML = '';
    const cityData = SOUTHERN_STATIONS[cityKey];
    if (!cityData) return;
    
    Object.keys(cityData.districts).forEach(distName => {
        const opt = document.createElement('option');
        opt.value = distName;
        opt.innerText = distName;
        distSelect.appendChild(opt);
    });
    
    updateStationInfo();
};

window.updateStationInfo = function() {
    const cityEl = document.getElementById('rain-city');
    const distEl = document.getElementById('rain-district');
    if (!cityEl || !distEl) return;
    
    const cityKey = cityEl.value;
    const distName = distEl.value;
    const info = SOUTHERN_STATIONS[cityKey]?.districts[distName];
    if (!info) return;
    
    const nameEl = document.getElementById('rain-station-name');
    const linkEl = document.getElementById('rain-cwa-link');
    if (nameEl) nameEl.innerText = info.station;
    if (linkEl) linkEl.href = info.cwaUrl;
    
    evaluateRainDeduction();
};

window.evaluateRainDeduction = function() {
    const inputEl = document.getElementById('rain-value-input');
    const threshEl = document.getElementById('rain-threshold');
    const resultBox = document.getElementById('rain-result-box');
    const cityEl = document.getElementById('rain-city');
    const distEl = document.getElementById('rain-district');
    
    if (!inputEl || !threshEl || !resultBox || !cityEl || !distEl) return;
    
    const cityKey = cityEl.value;
    const distName = distEl.value;
    const stationInfo = SOUTHERN_STATIONS[cityKey]?.districts[distName];
    if (!stationInfo) return;
    
    const rainfall = parseFloat(inputEl.value) || 0;
    const threshold = parseFloat(threshEl.value);
    const isQualify = rainfall >= threshold;
    
    const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
    
    if (isQualify) {
        resultBox.style.background = '#ECFDF5';
        resultBox.style.border = '2px solid #10B981';
        resultBox.innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: 16px; flex-wrap: wrap;">
                <div style="width: 52px; height: 52px; border-radius: 50%; background: #10B981; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 1.6rem; flex-shrink: 0;">
                    <i class="fas fa-check-circle"></i>
                </div>
                <div style="flex-grow: 1;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                        <span style="background: #10B981; color: #fff; font-size: 0.8rem; font-weight: 800; padding: 2px 8px; border-radius: 4px;">判定結果：符合條件</span>
                        <h4 style="color: #065F46; font-size: 1.25rem; font-weight: 900; margin: 0;">符合公共工程契約「降雨免計工期」標準 (成立)</h4>
                    </div>
                    <p style="color: #047857; font-size: 0.95rem; line-height: 1.7; margin: 0 0 10px;">
                        當日實測累積雨量 <strong>${rainfall.toFixed(1)} mm</strong> 已達契約規定門檻 <strong>${threshold.toFixed(1)} mm</strong>。<br>
                        依據行政院公共工程委員會標準契約第17條（天候不可抗力），廠商得檢附氣象監測紀錄，依法向監造單位申請<strong>免計工期 1 日</strong>。
                    </p>
                    <div style="background: rgba(16, 185, 129, 0.15); padding: 8px 14px; border-radius: 6px; font-size: 0.85rem; color: #064E3B;">
                        <strong>觀測測站：</strong>${stationInfo.station} ｜ <strong>行政區：</strong>${distName} ｜ <strong>日期：</strong>${today}
                    </div>
                </div>
            </div>
        `;
    } else {
        resultBox.style.background = '#FFFBEB';
        resultBox.style.border = '2px solid #F59E0B';
        resultBox.innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: 16px; flex-wrap: wrap;">
                <div style="width: 52px; height: 52px; border-radius: 50%; background: #F59E0B; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 1.6rem; flex-shrink: 0;">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div style="flex-grow: 1;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                        <span style="background: #F59E0B; color: #fff; font-size: 0.8rem; font-weight: 800; padding: 2px 8px; border-radius: 4px;">判定結果：未達門檻</span>
                        <h4 style="color: #92400E; font-size: 1.25rem; font-weight: 900; margin: 0;">未達契約降雨免計工期門檻 (計入工期)</h4>
                    </div>
                    <p style="color: #B45309; font-size: 0.95rem; line-height: 1.7; margin: 0;">
                        當日實測累積雨量為 <strong>${rainfall.toFixed(1)} mm</strong>，未達合約免計工期門檻 <strong>${threshold.toFixed(1)} mm</strong>。若現場因局部泥濘或特定戶外工項受阻，建議拍照留存並於施工日誌載明原因提送監造專案核定。
                    </p>
                </div>
            </div>
        `;
    }
};

window.printRainReport = function() {
    const cityKey = document.getElementById('rain-city')?.value || 'kh';
    const distName = document.getElementById('rain-district')?.value || '';
    const stationInfo = (typeof SOUTHERN_STATIONS !== 'undefined' && SOUTHERN_STATIONS[cityKey]?.districts[distName]) || { station: '中央氣象署測站' };
    const rainfall = document.getElementById('rain-value-input')?.value || '0';
    const threshold = document.getElementById('rain-threshold')?.value || '5.0';
    const today = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });
    
    const printWin = window.open('', '_blank');
    if (!printWin) return;
    printWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>公共工程降雨免計工期申請佐證表 - NOVERA</title>
            <style>
                body { font-family: 'Noto Sans TC', 'Microsoft JhengHei', sans-serif; padding: 40px; color: #000; }
                h2 { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14pt; }
                th, td { border: 1px solid #000; padding: 12px; text-align: left; }
                th { background: #f0f0f0; width: 30%; }
                .footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 13pt; }
                @media print { button { display: none; } }
            </style>
        </head>
        <body>
            <h2>公共工程天候不可抗力（降雨）免計工期佐證申請表</h2>
            <table>
                <tr><th>工程名稱</th><td>（請填寫本標案工程全名）</td></tr>
                <tr><th>施工廠商</th><td>（請填寫承包營造廠名稱）</td></tr>
                <tr><th>監造單位</th><td>（請填寫監造顧問公司名稱）</td></tr>
                <tr><th>申請日期</th><td>${today}</td></tr>
                <tr><th>氣象署觀測站名</th><td>${stationInfo.station}</td></tr>
                <tr><th>當日實測累積雨量</th><td><strong>${rainfall} mm</strong></td></tr>
                <tr><th>契約免計工期門檻</th><td>日累積雨量 ≥ ${threshold} mm</td></tr>
                <tr><th>法定條款依據</th><td>依據公共工程標準契約第17條（天候不可抗力致無法施工）</td></tr>
                <tr><th>判定結論</th><td><strong>${parseFloat(rainfall) >= parseFloat(threshold) ? '符合合約免計工期標準，申請扣除工期 1 日' : '未達標準'}</strong></td></tr>
            </table>
            <div class="footer">
                <div>工地主任簽章：_______________</div>
                <div>品管人員簽章：_______________</div>
                <div>監造工程師覆核：_______________</div>
            </div>
            <div style="text-align: center; margin-top: 30px;">
                <button onclick="window.print()" style="padding: 10px 24px; font-size: 16pt; cursor: pointer;">立即列印本單</button>
            </div>
        </body>
        </html>
    `);
    printWin.document.close();
};

// 全域剪貼簿複製模組 (支援 Clipboard API 與 execCommand 雙重降級保護)
window.copyText = function(text, successMsg = '已成功複製到剪貼簿！') {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            alert(successMsg);
        }).catch(() => {
            fallbackCopy(text, successMsg);
        });
    } else {
        fallbackCopy(text, successMsg);
    }
};

function fallbackCopy(text, successMsg) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
        document.execCommand('copy');
        alert(successMsg);
    } catch (err) {
        prompt('請手動選取並複製以下文字：', text);
    }
    document.body.removeChild(textarea);
}

// 全域權威法律條款與智財權彈窗控制模組
window.openLegalModal = function(tabKey = 'copyright') {
    const modal = document.getElementById('globalLegalModal');
    if (!modal) return;
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    switchLegalTab(tabKey);
};

window.closeLegalModal = function() {
    const modal = document.getElementById('globalLegalModal');
    if (!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = '';
};

window.switchLegalTab = function(tabKey) {
    document.querySelectorAll('.legal-nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabKey);
    });
    document.querySelectorAll('.legal-tab-pane').forEach(pane => {
        pane.classList.toggle('active', pane.id === `legal-pane-${tabKey}`);
    });
};

document.addEventListener('DOMContentLoaded', () => {
    // ESC 關閉法律彈窗
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeLegalModal();
    });
    
    // 點擊遮罩關閉
    const modal = document.getElementById('globalLegalModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeLegalModal();
        });
    }
    
    // 自動更新 Footer 年份
    const footerYear = document.getElementById('footer-year');
    if (footerYear) footerYear.textContent = new Date().getFullYear();
});

/* ==========================================================================
   NOVERA 全站安全防護核心
   ========================================================================== */
(function() {
    // 1. 全站禁用右鍵選單 (輸入框保留正常右鍵以利貼上工程數據)
    document.addEventListener('contextmenu', function(e) {
        if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
        e.preventDefault();
    });

    // 3. 禁用開發者工具與另存原始碼快速鍵 (F12, Ctrl+U, Ctrl+S, Ctrl+Shift+I/J/C)
    document.addEventListener('keydown', function(e) {
        // F12
        if (e.key === 'F12' || e.keyCode === 123) {
            e.preventDefault();
            return false;
        }
        // Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C (DevTools)
        if (e.ctrlKey && e.shiftKey && (['I', 'J', 'C'].includes(e.key.toUpperCase()) || [73, 74, 67].includes(e.keyCode))) {
            e.preventDefault();
            return false;
        }
        // Ctrl+U (檢視原始碼)
        if (e.ctrlKey && (e.key.toUpperCase() === 'U' || e.keyCode === 85)) {
            e.preventDefault();
            return false;
        }
        // Ctrl+S (另存網頁) - 僅在非輸入狀態下攔截
        if (e.ctrlKey && (e.key.toUpperCase() === 'S' || e.keyCode === 83)) {
            if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
            e.preventDefault();
            return false;
        }
    });
})();
