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
}