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