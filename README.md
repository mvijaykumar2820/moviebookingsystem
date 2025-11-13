# CinemaHub - Movie Booking System

A modern movie booking web application with Firebase authentication and real-time seat booking.

## Features
- 🎬 Browse featured movies from OMDb API
- 🔍 Search for movies
- 🎫 Book movie tickets with seat selection
- 👤 User authentication (Sign up/Login)
- 📋 View and manage your bookings
- ✨ Real-time seat availability

## Setup Instructions

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd batch-08
```

### 2. Configure API Keys
1. Copy `config.example.js` to `config.js`
   ```bash
   cp config.example.js config.js
   ```

2. Open `config.js` and add your API keys:
   - **Firebase Configuration**: Get from [Firebase Console](https://console.firebase.google.com/)
   - **OMDb API Key**: Get from [OMDb API](http://www.omdbapi.com/apikey.aspx)

### 3. Firebase Setup
1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable **Email/Password Authentication**
3. Create a **Firestore Database** with the following collections:
   - `shows` - For movie shows
   - `bookings` - For user bookings

### 4. Run the Application
Simply open `index.html` in a web browser or use a local server:
```bash
# Using Python
python3 -m http.server 8000

# Using Node.js
npx serve
```

## Important Notes
⚠️ **Never commit `config.js` to GitHub** - It contains your sensitive API keys!

## Technologies Used
- HTML5, CSS3, JavaScript (ES6 Modules)
- Firebase (Authentication & Firestore)
- OMDb API
- Responsive Design

## License
MIT
