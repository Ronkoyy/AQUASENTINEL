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
    constructor(name, email, password, bio = "", birthday = "", age = "", profilePic = "") {
        this.name = name;
        this.email = email;
        this.password = password;
        this.bio = bio;
        this.birthday = birthday;
        this.age = age;
        this.profilePic = profilePic || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=1780&auto=format&fit=crop"; 
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

        const userReports = DataManager.get('aqua_reports').filter(x => x.userId === this.currentUser.email).length;
        let rank = "Volunteer Ranger";
        if(userReports >= 5) rank = "Coastal Guardian";
        if(userReports >= 15) rank = "Aqua Sentinel Elite";

        const sbName = document.getElementById('user-name-display');
        if(sbName) sbName.innerText = this.currentUser.name;

        if (document.getElementById('profile-name')) {
            document.getElementById('profile-name').innerText = this.currentUser.name;
            document.querySelector('.role-text').innerText = rank; 
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

    toggleSidebar() {
        document.getElementById('sidebar').classList.toggle('open');
        document.querySelector('.sidebar-overlay').classList.toggle('open');
    },
    
    logout() { localStorage.removeItem('aqua_user'); window.location.href = 'index.html'; },

    showToast(msg, type='success') {
        const div = document.createElement('div');
        div.className = 'toast';
        div.style.background = type === 'success' ? '#10b981' : '#ef4444';
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

    // ✅ RESTORED: WASTE DETAILS MODAL LOGIC
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
}