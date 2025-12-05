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