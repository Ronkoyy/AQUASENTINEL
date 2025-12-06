// =======================================================
// 1. DATA MODELS & STORAGE (OOP)
// =======================================================

class Report {
    constructor(id, date, location, placeName, userId, type, image, status, condition) {
        this.id = id;
        this.date = date;
        this.location = location;
        this.placeName = placeName;
        this.userId = userId;
        this.type = type;
        this.image = image;
        this.status = status || 'Pending'; 
        this.condition = condition || ''; 
    }
}

class User {
    // 🆕 ADDED: 'rank' parameter
    constructor(name, email, password, bio = "", birthday = "", age = "", profilePic = "", rank = "Volunteer Ranger") {
        this.name = name;
        this.email = email;
        this.password = password;
        this.bio = bio;
        this.birthday = birthday;
        this.age = age;
        this.profilePic = profilePic || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=1780&auto=format&fit=crop";
        this.rank = rank; // Store rank persistently
    }
}

class DataManager {
    static get(k) { return JSON.parse(localStorage.getItem(k) || '[]'); }
    static set(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

    static seed() { 
        if(!localStorage.getItem('aqua_reports')) this.set('aqua_reports',[]); 
        if(!localStorage.getItem('aqua_users')) this.set('aqua_users',[]); 
    }
    
    static saveReport(r) { const list = this.get('aqua_reports'); list.push(r); this.set('aqua_reports', list); }
    static deleteReport(id) { const list = this.get('aqua_reports').filter(x => x.id !== id); this.set('aqua_reports', list); }
    static updateReport(r) { 
        const list = this.get('aqua_reports');
        const idx = list.findIndex(x => x.id === r.id);
        if(idx !== -1) { list[idx] = r; this.set('aqua_reports', list); }
    }

    static getUsers() { return JSON.parse(localStorage.getItem('aqua_users') || '[]'); }
    static registerUser(u) { 
        const users = this.get('aqua_users'); 
        if(users.find(x => x.email === u.email)) return false; 
        users.push(u); this.set('aqua_users', users); return true; 
    }
    static validateUser(e, p) { return this.get('aqua_users').find(u => u.email === e && u.password === p); }
    
    static updateUser(u) {
        const users = this.get('aqua_users');
        const idx = users.findIndex(x => x.email === u.email);
        if(idx !== -1) { users[idx] = u; this.set('aqua_users', users); }
    }
}

// =======================================================
// 2. CORE APP CONTROLLER
// =======================================================
const app = {
    currentUser: null, map: null, chart: null, markers: [], editingId: null, tempMarker: null, deleteId: null,

    init() {
        this.fixLeafletIcons();
        DataManager.seed();
        this.checkSession();
        
        const path = window.location.pathname;
        const page = path.split("/").pop();

        if (page === 'dashboard.html') this.loadDash();
        if (page === 'map.html') this.loadMap();
        if (page === 'profile.html') this.loadProfile();
        
        if (document.getElementById('picker-map')) this.loadPickerMap();
        
        if(document.getElementById('login-form')) document.getElementById('login-form').addEventListener('submit', e => this.login(e));
        if(document.getElementById('signup-form')) document.getElementById('signup-form').addEventListener('submit', e => this.signup(e));
        if(document.getElementById('report-form')) {
            const urlParams = new URLSearchParams(window.location.search);
            const editId = urlParams.get('edit');
            if(editId) this.loadReportForEdit(parseInt(editId));
            document.getElementById('report-form').addEventListener('submit', e => this.handleReport(e));
        }

        if(document.querySelector('.mobile-menu-btn')) {
            document.querySelector('.mobile-menu-btn').addEventListener('click', this.toggleSidebar);
            document.querySelector('.close-sidebar-btn').addEventListener('click', this.toggleSidebar);
            document.querySelector('.sidebar-overlay').addEventListener('click', this.toggleSidebar);
        }

        window.addEventListener('scroll', () => {
            const nav = document.getElementById('main-nav');
            const hero = document.querySelector('.hero-bg'); 
            if(nav) {
                let threshold = 50; 
                if (hero) threshold = hero.offsetHeight - 80; 
                if(window.scrollY > threshold) nav.classList.add('scrolled');
                else nav.classList.remove('scrolled');
            }
        });
    },

    fixLeafletIcons() {
        if(typeof L !== 'undefined' && L.Icon && L.Icon.Default) {
            delete L.Icon.Default.prototype._getIconUrl;
            L.Icon.Default.mergeOptions({
                iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
                iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            });
        }
    },

    getWeatherIcon(condition) {
        const main = condition.toLowerCase();
        switch (main) {
            case 'clear': return 'fa-solid fa-sun';
            case 'clouds': return 'fa-solid fa-cloud';
            case 'rain': case 'drizzle': return 'fa-solid fa-cloud-showers-heavy';
            case 'thunderstorm': return 'fa-solid fa-cloud-bolt';
            case 'snow': return 'fa-solid fa-snowflake';
            case 'mist': case 'fog': return 'fa-solid fa-smog';
            default: return 'fa-solid fa-cloud-sun';
        }
    },

    createPin(color) {
        return L.divIcon({
            className: 'bg-transparent',
            html: `<i class="fa-solid fa-location-dot fa-3x" style="color: ${color}; filter: drop-shadow(3px 5px 2px rgba(0,0,0,0.3)); display:block;"></i>`,
            iconSize: [30, 42], iconAnchor: [15, 42], popupAnchor: [0, -45]
        });
    },

    checkSession() {
        const u = localStorage.getItem('aqua_user');
        const page = window.location.pathname.split("/").pop();
        const publicPages = ['index.html', 'login.html', 'signup.html', ''];

        if (u) {
            this.currentUser = JSON.parse(u);
            if (publicPages.includes(page)) window.location.href = 'dashboard.html';
            this.updateUI();
        } else {
            if (!publicPages.includes(page)) window.location.href = 'login.html';
        }
    },

    updateUI() {
        if(!this.currentUser) return;

        const sbName = document.getElementById('user-name-display');
        if(sbName) sbName.innerText = this.currentUser.name;

        // 🏆 DASHBOARD BADGE LOGIC
        const dashBadge = document.getElementById('dashboard-badge');
        if(dashBadge) {
            dashBadge.classList.remove('hidden-section');
            document.getElementById('badge-text').innerText = this.currentUser.rank || "Volunteer Ranger";
        }

        if (document.getElementById('profile-name')) {
            document.getElementById('profile-name').innerText = this.currentUser.name;
            // Use stored rank
            document.querySelector('.role-text').innerText = this.currentUser.rank || "VOLUNTEER RANGER"; 
            document.getElementById('display-bio').innerText = this.currentUser.bio || "No bio set yet.";
            document.getElementById('display-birthday').innerText = this.currentUser.birthday || "-";
            document.getElementById('display-age').innerText = this.currentUser.age || "-";

            const pImg = document.getElementById('profile-img-large');
             if (this.currentUser.profilePic && pImg) {
                pImg.src = this.currentUser.profilePic;
                pImg.style.display = 'block';
                pImg.classList.remove('hidden-section');
                document.getElementById('profile-initials-large').style.display = 'none';
            }
        }
    },

    // 🏆 FEATURE: CHECK FOR PROMOTION
    checkRankUpgrade() {
        const userReports = DataManager.get('aqua_reports').filter(x => x.userId === this.currentUser.email).length;
        let newRank = "Volunteer Ranger";
        
        if(userReports >= 5) newRank = "Coastal Guardian";
        if(userReports >= 15) newRank = "Aqua Sentinel Elite";

        // If rank changed, save it and show notification
        if (newRank !== this.currentUser.rank) {
            this.currentUser.rank = newRank;
            DataManager.updateUser(this.currentUser); // Save to DB
            localStorage.setItem('aqua_user', JSON.stringify(this.currentUser)); // Update session
            
            // Trigger Gold Notification
            this.showToast(`🎉 PROMOTED! You are now a ${newRank}!`, 'upgrade');
            this.updateUI();
        }
    },

    toggleSidebar() {
        document.getElementById('sidebar').classList.toggle('open');
        document.querySelector('.sidebar-overlay').classList.toggle('open');
    },
    
    logout() { localStorage.removeItem('aqua_user'); window.location.href = 'index.html'; },

    showToast(msg, type='success') {
        const div = document.createElement('div');
        div.className = `toast ${type}`; // Add type class
        
        // Default styling logic (overridden by CSS for 'upgrade')
        if (type !== 'upgrade') {
            div.style.background = type === 'success' ? '#10b981' : '#ef4444';
        }
        
        div.innerText = msg;
        document.body.appendChild(div);
        setTimeout(() => {
            div.style.opacity = '0';
            setTimeout(() => div.remove(), 300);
        }, 3000);
    },

    login(e) {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pwd = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error');
        errorEl.style.display = 'none';

        const user = DataManager.validateUser(email, pwd);
        if(user) {
            localStorage.setItem('aqua_user', JSON.stringify(user));
            window.location.href = 'dashboard.html';
        } else { 
            errorEl.innerText = "Incorrect password."; errorEl.style.display = 'block'; 
        }
    },

    signup(e) {
        e.preventDefault();
        const u = new User(
            document.getElementById('signup-name').value,
            document.getElementById('signup-email').value,
            document.getElementById('signup-password').value
        );
        if(DataManager.registerUser(u)) {
            this.showToast('Registered Successfully! Please Login.');
            setTimeout(() => window.location.href = 'login.html', 1500);
        } else { alert('Email exists'); }
    },

    loadDash() {
        const allReports = DataManager.get('aqua_reports');
        const r = allReports.filter(x => x.userId === this.currentUser.email);

        document.getElementById('stat-pollution').innerText = r.filter(x => x.type === 'pollution').length;
        document.getElementById('stat-marine').innerText = r.filter(x => x.type === 'marine').length;
        
        const feed = document.getElementById('activity-feed');
        feed.innerHTML = '';
        
        if (r.length === 0) {
            feed.innerHTML = '<div style="color:#94a3b8; text-align:center; padding:20px;">No activity yet.</div>';
        }

        r.slice(-5).reverse().forEach(x => {
            const color = x.type === 'pollution' ? 'red' : 'teal';
            
            let statusBadge = '<span style="color:#ef4444; font-weight:bold; font-size:0.8rem; margin-left:8px;"><i class="fa-solid fa-clock"></i> PENDING</span>';
            if (x.status === 'Resolved') {
                if (x.type === 'pollution') {
                    statusBadge = '<span style="color:#10b981; font-weight:bold; font-size:0.8rem; margin-left:8px;"><i class="fa-solid fa-check-circle"></i> CLEANED</span>';
                } else {
                    statusBadge = '<span style="color:#0ea5e9; font-weight:bold; font-size:0.8rem; margin-left:8px;"><i class="fa-solid fa-check-circle"></i> VERIFIED</span>';
                }
            }

            feed.innerHTML += `<div style="display:flex; gap:10px; padding:12px; background:#f8fafc; border-left:4px solid var(--color-${color}); margin-bottom:10px; border-radius:4px; align-items:center;">
                <div style="flex:1;">
                    <strong>${x.type.toUpperCase()}</strong> @ ${x.placeName} ${statusBadge}
                    <br><small style="color:#64748b;">${x.wasteType || x.species}</small>
                </div>
            </div>`;
        });

        const ctx = document.getElementById('wasteChart').getContext('2d');
        if(this.chart) this.chart.destroy();
        const counts = {};
        r.filter(x => x.type === 'pollution').forEach(x => counts[x.wasteType] = (counts[x.wasteType]||0)+1);
        
        this.chart = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: Object.keys(counts), datasets: [{ data: Object.values(counts), backgroundColor: ['#009688', '#26a69a', '#80cbc4', '#546e7a', '#ff7043'] }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
        });

        const apiKey = '087c63d4f2bdc8a29e9262521bb2cd38'; 
        const city = 'Manolo Fortich'; 
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`;

        fetch(url)
            .then(res => res.json())
            .then(data => {
                document.querySelector('.weather-temp').innerText = `${Math.round(data.main.temp)}°C`;
                document.querySelector('.weather-loc').innerText = data.name;
                const condition = data.weather[0].main;
                const iconClass = this.getWeatherIcon(condition);
                const iconEl = document.querySelector('.weather-icon');
                iconEl.className = `${iconClass} weather-icon`;
            })
            .catch(err => console.error("Weather Error:", err));
    },

    openWasteDetails() {
        const allReports = DataManager.get('aqua_reports');
        const myPollution = allReports.filter(x => x.userId === this.currentUser.email && x.type === 'pollution');

        const stats = { 'Plastic': 0, 'Metal': 0, 'Oil': 0, 'Net': 0, 'Chemical': 0 };
        myPollution.forEach(r => {
            if (stats[r.wasteType] !== undefined) stats[r.wasteType]++;
            else stats[r.wasteType] = 1;
        });

        const container = document.getElementById('waste-stats-list');
        container.innerHTML = ''; 

        if (myPollution.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#9ca3af;">No pollution data recorded yet.</p>';
        } else {
            for (const [type, count] of Object.entries(stats)) {
                if (count > 0) {
                    container.innerHTML += `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f9fafb; border-radius: 12px; border: 1px solid #f3f4f6;">
                            <span style="font-weight: 600; color: #4b5563;">${type}</span>
                            <span style="font-weight: 800; color: #009688; background: #e0f2f1; padding: 4px 12px; border-radius: 20px;">${count}</span>
                        </div>
                    `;
                }
            }
        }
        document.getElementById('waste-modal').classList.remove('hidden-section');
    },

    closeWasteModal() {
        document.getElementById('waste-modal').classList.add('hidden-section');
    },

    loadPickerMap() {
        const map = L.map('picker-map').setView([8.37, 124.86], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(map);

        let currentMarker = null;

        map.on('click', (e) => {
            const lat = e.latlng.lat.toFixed(6);
            const lng = e.latlng.lng.toFixed(6);

            document.getElementById('input-location').value = `${lat}, ${lng}`;

            if (currentMarker) map.removeLayer(currentMarker);

            currentMarker = L.marker(e.latlng, {icon: this.createPin('#3b82f6')}).addTo(map)
                .bindPopup("<b>Selected Location</b>")
                .openPopup();
        });

        setTimeout(() => map.invalidateSize(), 200);
    },

    toggleFormFields() {
        const type = document.querySelector('input[name="reportType"]:checked').value;
        document.getElementById('fields-pollution').classList.toggle('hidden-section', type !== 'pollution');
        document.getElementById('fields-marine').classList.toggle('hidden-section', type !== 'marine');
    },

    handleReport(e) {
        e.preventDefault();
        const type = document.querySelector('input[name="reportType"]:checked').value;
        const locStr = document.getElementById('input-location').value;
        const placeName = document.getElementById('input-placename').value;
        
        if(!locStr || locStr.trim() === "") return this.showToast('Please select a location on the map!', 'error');

        const coords = locStr.split(',').map(n => parseFloat(n));
        const file = document.getElementById('input-image').files[0];
        
        if(coords.length!==2 || isNaN(coords[0])) return this.showToast('Invalid Coordinates!', 'error');
        
        const loc = [coords[0], coords[1]];
        
        const processReport = (imgData) => {
            const commonData = {
                date: new Date().toISOString(), location: loc, placeName: placeName,
                userId: this.currentUser.email, type: type, image: imgData,
                status: 'Pending'
            };

            let specificData = {};
            if(type === 'pollution') {
                specificData.wasteType = document.getElementById('input-waste').value;
                specificData.severity = document.getElementById('input-severity').value;
            } else {
                specificData.species = document.getElementById('input-species').value;
                specificData.quantity = document.getElementById('input-quantity').value;
                specificData.condition = document.getElementById('input-condition').value;
            }

            if (this.editingId) {
                const updatedObj = { id: this.editingId, ...commonData, ...specificData };
                DataManager.updateReport(updatedObj);
                this.showToast('Report Updated Successfully!');
            } else {
                const newObj = { id: Date.now(), ...commonData, ...specificData };
                DataManager.saveReport(newObj);
                this.showToast('Report Saved Successfully!');
            }
            
            // ✅ CHECK FOR PROMOTION
            this.checkRankUpgrade();
            
            setTimeout(() => window.location.href = 'map.html', 1000);
        };

        if (file) {
            const reader = new FileReader();
            reader.onloadend = function() { processReport(reader.result); }
            reader.readAsDataURL(file);
        } else {
            processReport(null);
        }
    },
    
    loadReportForEdit(id) {
        const r = DataManager.get('aqua_reports').find(x => x.id === id);
        if (!r) return;
        this.editingId = id;
        document.querySelector(`input[name="reportType"][value="${r.type}"]`).checked = true;
        this.toggleFormFields();
        document.getElementById('input-placename').value = r.placeName;
        document.getElementById('input-location').value = `${r.location[0]}, ${r.location[1]}`;
        
        if (r.type === 'pollution') {
            document.getElementById('input-waste').value = r.wasteType;
            document.getElementById('input-severity').value = r.severity;
        } else {
            document.getElementById('input-species').value = r.species;
            document.getElementById('input-quantity').value = r.quantity;
            if(document.getElementById('input-condition')) {
                document.getElementById('input-condition').value = r.condition || 'Healthy';
            }
        }
        
        document.getElementById('btn-submit-report').innerText = 'UPDATE REPORT';
        document.getElementById('btn-cancel-edit').classList.remove('hidden-section');
        
        const doneBtn = document.getElementById('btn-mark-done');
        if(doneBtn) {
            doneBtn.classList.remove('hidden-section');
            if (r.type === 'pollution') {
                doneBtn.style.background = '#10b981'; 
                doneBtn.innerHTML = '<i class="fa-solid fa-broom"></i> MARK AS CLEANED';
            } else {
                doneBtn.style.background = '#0ea5e9'; 
                doneBtn.innerHTML = '<i class="fa-solid fa-clipboard-check"></i> MARK AS VERIFIED';
            }
        }
    },

    markAsDone() {
        if(this.editingId) {
            const report = DataManager.get('aqua_reports').find(x => x.id === this.editingId);
            if(report) {
                report.status = 'Resolved';
                DataManager.updateReport(report);
                this.showToast('Great job! Report status updated.');
                setTimeout(() => window.location.href = 'profile.html', 1500);
            }
        }
    },

    cancelEdit() { window.location.href = 'report.html'; },

    loadMap() {
        if(!this.map) {
            this.map = L.map('map').setView([8.37, 124.86], 11); 
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(this.map);

            this.map.on('click', (e) => {
                const lat = e.latlng.lat.toFixed(6);
                const lng = e.latlng.lng.toFixed(6);

                if (this.tempMarker) this.map.removeLayer(this.tempMarker);
                
                this.tempMarker = L.marker(e.latlng, {icon: this.createPin('#3b82f6')}).addTo(this.map)
                    .bindPopup(`<b>📍 Selected Location</b><br>Lat: ${lat}<br>Lng: ${lng}`)
                    .openPopup();
            });
        }

        setTimeout(() => { this.map.invalidateSize(); }, 200);

        this.markers.forEach(m => this.map.removeLayer(m));
        this.markers = [];

        const allReports = DataManager.get('aqua_reports');
        const r = allReports.filter(x => x.userId === this.currentUser.email);

        r.forEach(x => {
            if(!x.location || isNaN(x.location[0])) return;
            
            const pinColor = x.type === 'pollution' ? '#ef4444' : '#14b8a6';
            const customIcon = this.createPin(pinColor);

            let popupContent = `
                <div style="min-width: 150px;">
                    <b style="color:#0f172a; font-size:1rem;">${x.type.toUpperCase()}</b><br>
                    <span style="color:#64748b; font-size:0.9rem;">${x.placeName}</span><br>
                    <span style="font-weight:600; color:#334155;">${x.wasteType || x.species}</span>
                    <br><span style="font-size:0.85rem; color:#ef4444; font-weight:600;">
                        ${x.severity || x.condition || ''}
                    </span>
                </div>
            `;
            if (x.image) {
                popupContent += `<img src="${x.image}" style="width:100%; height:120px; object-fit:cover; margin-top:10px; border-radius:8px; border:1px solid #e2e8f0;">`;
            }

            const m = L.marker(x.location, {icon: customIcon}).addTo(this.map)
                .bindPopup(popupContent);
            this.markers.push(m);
        });

        if(this.markers.length > 0) {
            setTimeout(() => this.map.fitBounds(L.featureGroup(this.markers).getBounds(), {padding:[50,50]}), 300);
        }
    },

    loadProfile() {
        const list = DataManager.get('aqua_reports').filter(x => x.userId === this.currentUser.email);
        const tb = document.getElementById('history-table-body');
        tb.innerHTML = '';
        document.getElementById('empty-history-msg').style.display = list.length ? 'none' : 'block';
        
        list.forEach(x => {
            let statusHtml = `<span style="background:#fee2e2; color:#991b1b; padding:4px 8px; border-radius:12px; font-size:0.75rem; font-weight:700;">PENDING</span>`;
            
            if (x.status === 'Resolved') {
                if (x.type === 'pollution') {
                    statusHtml = `<span style="background:#dcfce7; color:#166534; padding:4px 8px; border-radius:12px; font-size:0.75rem; font-weight:700;">CLEANED</span>`;
                } else {
                    statusHtml = `<span style="background:#e0f2fe; color:#0369a1; padding:4px 8px; border-radius:12px; font-size:0.75rem; font-weight:700;">VERIFIED</span>`;
                }
            }

            tb.innerHTML += `<tr style="border-bottom:1px solid #e2e8f0">
                <td style="padding:10px">
                    <div style="font-weight:600;">${new Date(x.date).toLocaleDateString()}</div>
                    ${statusHtml}
                </td>
                <td style="padding:10px">${x.placeName}</td>
                <td style="padding:10px">${x.wasteType || x.species}</td>
                <td style="padding:10px">
                    <button onclick="app.editItem(${x.id})" class="action-btn-edit" style="color:#0ea5e9; font-weight:bold; margin-right:5px; border:none; background:none; cursor:pointer;">Edit</button>
                    <button onclick="app.delItem(${x.id})" class="action-btn-delete" style="color:#ef4444; font-weight:bold; border:none; background:none; cursor:pointer;">Delete</button>
                </td>
            </tr>`;
        });
    },

    editItem(id) { window.location.href = `report.html?edit=${id}`; },

    delItem(id) {
        this.deleteId = id; 
        const modal = document.getElementById('delete-modal');
        if(modal) modal.classList.remove('hidden-section');
    },

    confirmDelete() {
        if (this.deleteId) {
            DataManager.deleteReport(this.deleteId);
            this.loadProfile();
            this.showToast('Report Deleted Successfully', 'error');
            this.closeDeleteModal();
        }
    },

    closeDeleteModal() {
        const modal = document.getElementById('delete-modal');
        if(modal) modal.classList.add('hidden-section');
        this.deleteId = null;
    },

    openEditProfile() {
        const modal = document.getElementById('edit-profile-modal');
        if(modal) {
            modal.classList.remove('hidden-section');
            document.getElementById('edit-name').value = this.currentUser.name;
            document.getElementById('edit-email').value = this.currentUser.email;
            document.getElementById('edit-bio').value = this.currentUser.bio || '';
            document.getElementById('edit-birthday').value = this.currentUser.birthday || '';
            document.getElementById('edit-age').value = this.currentUser.age || '';
            document.getElementById('edit-password').value = '';
        }
    },
    closeEditProfile() { document.getElementById('edit-profile-modal').classList.add('hidden-section'); },
    
    saveProfile() {
        const newName = document.getElementById('edit-name').value;
        const newBio = document.getElementById('edit-bio').value;
        const newBday = document.getElementById('edit-birthday').value;
        const newAge = document.getElementById('edit-age').value;
        const newPwd = document.getElementById('edit-password').value;
        const file = document.getElementById('edit-image').files[0];
        
        if(!newName) return alert("Name required");
        
        const performSave = (picUrl) => {
            this.currentUser.name = newName;
            this.currentUser.bio = newBio;
            this.currentUser.birthday = newBday;
            this.currentUser.age = newAge;
            if(newPwd) this.currentUser.password = newPwd;
            if(picUrl) this.currentUser.profilePic = picUrl; 

            DataManager.updateUser(this.currentUser);
            localStorage.setItem('aqua_user', JSON.stringify(this.currentUser));
            this.updateUI(); 
            this.closeEditProfile(); 
            this.showToast("Profile Updated Successfully!");
        };

        if (file) {
            const reader = new FileReader();
            reader.onloadend = function() { performSave(reader.result); }
            reader.readAsDataURL(file);
        } else {
            performSave(null); 
        }
    }
};

window.onload = () => app.init();