import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, doc, getDoc, getDocs, setDoc, updateDoc, collection, query, where, runTransaction, serverTimestamp, arrayUnion } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// Import configuration from separate file (not committed to GitHub)

// Fetch Firebase config from Vercel serverless function
async function loadFirebaseConfig() {
    const res = await fetch('/api/firebaseConfig');
    return res.json();
}

let app, db, auth;

// Initialize Firebase dynamically
loadFirebaseConfig().then(cfg => {
    app = initializeApp(cfg);
    db = getFirestore(app);
    auth = getAuth(app);
});

// OMDb API Configuration

// Global State
let currentUser = null;
let currentMovie = null;
let selectedSeats = [];
let currentShow = null;

// Featured movie IMDb IDs for homepage
const featuredMovies = ['tt0111161', 'tt0068646', 'tt0468569','tt4849438','tt13664684','tt8948790', 'tt0167260','tt27540542','tt8178634','tt20850406', 'tt0109830','tt9537292', 'tt0137523', 'tt1375666', 'tt0816692'];

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    initAuth();
    loadFeaturedMovies();
    initSearch();
    initForms();
});

// Auth State
function initAuth() {
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        updateUserMenu();
    });
}

function updateUserMenu() {
    const userMenu = document.getElementById('userMenu');
    if (currentUser) {
        userMenu.innerHTML = `
            <button class="btn btn-secondary" onclick="showPage('tickets')">My Tickets</button>
            <button class="btn btn-primary" onclick="logout()">Logout</button>
        `;
    } else {
        userMenu.innerHTML = `
            <button class="btn btn-primary" onclick="showPage('login')">Login</button>
        `;
    }
}

// Page Navigation
window.showPage = function(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId + 'Page').classList.add('active');
    
    if (pageId === 'tickets') {
        if (!currentUser) {
            showPage('login');
            return;
        }
        loadUserTickets();
    } else if (pageId === 'home') {
        loadFeaturedMovies();
    }
};

// Movie API Functions
async function fetchMovieById(imdbId) {
    const res = await fetch(`/api/omdb?i=${imdbId}`);
    const data = await res.json();
    if (data.Response === "True") return data;
    throw new Error(data.Error || "Movie not found");
}

async function searchMovies(title) {
    const res = await fetch(`/api/omdb?s=${encodeURIComponent(title)}`);
    const data = await res.json();
    if (data.Response === "True") return data.Search;
    return [];
}

async function loadFeaturedMovies() {
    const grid = document.getElementById('moviesGrid');
    grid.innerHTML = '<div class="loader"></div>';

    try {
        const movies = await Promise.all(
            featuredMovies.map(id => fetchMovieById(id))
        );
        displayMovies(movies);
    } catch (error) {
        grid.innerHTML = '<div class="error-message">Failed to load movies. Please check your API key.</div>';
    }
}

function displayMovies(movies) {
    const grid = document.getElementById('moviesGrid');
    grid.innerHTML = movies.map(movie => `
        <div class="movie-card" onclick="showMovieDetail('${movie.imdbID}')">
            <img src="${movie.Poster !== 'N/A' ? movie.Poster : 'https://via.placeholder.com/200x300?text=No+Poster'}" alt="${movie.Title}">
            <div class="movie-card-content">
                <h3>${movie.Title}</h3>
                <p>${movie.Year} • ${movie.Genre || 'N/A'}</p>
            </div>
        </div>
    `).join('');
}

// Search
function initSearch() {
    const searchInput = document.getElementById('searchInput');
    let timeout;
    
    searchInput.addEventListener('input', (e) => {
        clearTimeout(timeout);
        const query = e.target.value.trim();
        
        if (query.length > 2) {
            timeout = setTimeout(async () => {
                const results = await searchMovies(query);
                if (results.length > 0) {
                    const detailedResults = await Promise.all(
                        results.slice(0, 8).map(r => fetchMovieById(r.imdbID))
                    );
                    displayMovies(detailedResults);
                } else {
                    document.getElementById('moviesGrid').innerHTML = '<div class="error-message">No movies found</div>';
                }
            }, 500);
        } else if (query.length === 0) {
            loadFeaturedMovies();
        }
    });
}

// Movie Detail
window.showMovieDetail = async function(imdbId) {
    const modal = document.getElementById('movieModal');
    const content = document.getElementById('movieDetailContent');
    modal.classList.add('active');
    content.innerHTML = '<div class="loader"></div>';

    try {
        const movie = await fetchMovieById(imdbId);
        currentMovie = movie;
        
        content.innerHTML = `
            <div class="movie-detail-header">
                <img src="${movie.Poster !== 'N/A' ? movie.Poster : 'https://via.placeholder.com/200x300'}" alt="${movie.Title}">
                <div class="movie-detail-info">
                    <h2>${movie.Title}</h2>
                    <p><strong>Year:</strong> ${movie.Year}</p>
                    <p><strong>Runtime:</strong> ${movie.Runtime}</p>
                    <p><strong>Genre:</strong> ${movie.Genre}</p>
                    <p><strong>Director:</strong> ${movie.Director}</p>
                    <p><strong>Writers:</strong> ${movie.Writer}</p>
                    <p><strong>Actors:</strong> ${movie.Actors}</p>
                    <p><strong>IMDb Rating:</strong> ${movie.imdbRating}/10</p>
                    ${movie.BoxOffice ? `<p><strong>Box Office:</strong> ${movie.BoxOffice}</p>` : ''}
                    ${movie.Awards !== 'N/A' ? `<p><strong>Awards:</strong> ${movie.Awards}</p>` : ''}
                </div>
            </div>
            <div>
                <h3>Plot</h3>
                <p>${movie.Plot}</p>
            </div>
            <button class="btn btn-primary" style="margin-top: 20px; width: 100%;" onclick="showSeatSelection()">
                Book My Seat
            </button>
        `;
    } catch (error) {
        content.innerHTML = '<div class="error-message">Failed to load movie details</div>';
    }
};

window.closeModal = function() {
    document.getElementById('movieModal').classList.remove('active');
};

// Seat Selection
window.showSeatSelection = async function() {
    if (!currentUser) {
        alert('Please login to book seats');
        closeModal();
        showPage('login');
        return;
    }

    const seatModal = document.getElementById('seatModal');
    const content = document.getElementById('seatSelectionContent');
    seatModal.classList.add('active');
    content.innerHTML = '<div class="loader"></div>';

    // Create or get show
    const showId = `show_${currentMovie.imdbID}`;
    currentShow = {
        id: showId,
        movieId: currentMovie.imdbID,
        movieTitle: currentMovie.Title,
        cinema: "CinemaHub Main",
        datetime: new Date().toISOString(),
        pricePerSeat: 250
    };

    try {
        const showRef = doc(db, "shows", showId);
        const showSnap = await getDoc(showRef);
        
        if (!showSnap.exists()) {
            await setDoc(showRef, {
                ...currentShow,
                bookedSeats: [],
                createdAt: serverTimestamp()
            });
        }

        const showData = showSnap.exists() ? showSnap.data() : { bookedSeats: [] };
        renderSeatLayout(showData.bookedSeats || []);
    } catch (error) {
        content.innerHTML = '<div class="error-message">Failed to load seats</div>';
    }
};

function renderSeatLayout(bookedSeats) {
    const content = document.getElementById('seatSelectionContent');
    selectedSeats = [];

    const rows = ['A', 'B', 'C', 'D', 'E', 'F'];
    const seatsPerRow = 10;

    let html = `
        <h2>Select Your Seats</h2>
        <p style="margin: 10px 0;"><strong>${currentMovie.Title}</strong></p>
        <p>Cinema: ${currentShow.cinema} | Price: ₹${currentShow.pricePerSeat}/seat</p>
        
        <div class="seat-layout">
            <div class="screen">SCREEN</div>
            <div class="seat-legend">
                <div class="legend-item">
                    <div class="legend-seat" style="background: white;"></div>
                    <span>Available</span>
                </div>
                <div class="legend-item">
                    <div class="legend-seat" style="background: #667eea;"></div>
                    <span>Selected</span>
                </div>
                <div class="legend-item">
                    <div class="legend-seat" style="background: #ccc;"></div>
                    <span>Booked</span>
                </div>
            </div>
            <div class="seats-grid">
    `;

    rows.forEach(row => {
        html += `<div class="seat-row"><div class="row-label">${row}</div>`;
        for (let i = 1; i <= seatsPerRow; i++) {
            const seatId = `${row}${i}`;
            const isBooked = bookedSeats.includes(seatId);
            html += `<div class="seat ${isBooked ? 'booked' : ''}" data-seat="${seatId}" onclick="toggleSeat('${seatId}', ${isBooked})"></div>`;
        }
        html += '</div>';
    });

    html += `
            </div>
        </div>
        <div class="booking-summary">
            <h3>Booking Summary</h3>
            <p>Selected Seats: <strong id="selectedSeatsText">None</strong></p>
            <p>Total Amount: <strong id="totalAmount">₹0</strong></p>
        </div>
        <button class="btn btn-primary" style="width: 100%;" onclick="proceedToPayment()">
            Proceed to Payment
        </button>
    `;

    content.innerHTML = html;
}

window.toggleSeat = function(seatId, isBooked) {
    if (isBooked) return;

    const seatEl = document.querySelector(`[data-seat="${seatId}"]`);
    const index = selectedSeats.indexOf(seatId);

    if (index > -1) {
        selectedSeats.splice(index, 1);
        seatEl.classList.remove('selected');
    } else {
        selectedSeats.push(seatId);
        seatEl.classList.add('selected');
    }

    updateBookingSummary();
};

function updateBookingSummary() {
    document.getElementById('selectedSeatsText').textContent = 
        selectedSeats.length > 0 ? selectedSeats.join(', ') : 'None';
    document.getElementById('totalAmount').textContent = 
        `₹${selectedSeats.length * currentShow.pricePerSeat}`;
}

window.closeSeatModal = function() {
    document.getElementById('seatModal').classList.remove('active');
};

// Payment
window.proceedToPayment = function() {
    if (selectedSeats.length === 0) {
        alert('Please select at least one seat');
        return;
    }

    const content = document.getElementById('seatSelectionContent');
    const totalAmount = selectedSeats.length * currentShow.pricePerSeat;

    content.innerHTML = `
        <h2>Payment (Mock)</h2>
        <div class="payment-form">
            <div class="booking-summary">
                <h3>Order Summary</h3>
                <p>Movie: <strong>${currentMovie.Title}</strong></p>
                <p>Seats: <strong>${selectedSeats.join(', ')}</strong></p>
                <p>Total: <strong>₹${totalAmount}</strong></p>
            </div>
            <form id="paymentForm">
                <div class="form-group">
                    <label>Cardholder Name</label>
                    <input type="text" required placeholder="John Doe">
                </div>
                <div class="form-group">
                    <label>Card Number</label>
                    <input type="text" required placeholder="1234 5678 9012 3456" maxlength="19">
                </div>
                <div class="form-group">
                    <label>Expiry Date</label>
                    <input type="text" required placeholder="MM/YY" maxlength="5">
                </div>
                <div class="form-group">
                    <label>CVV</label>
                    <input type="text" required placeholder="123" maxlength="3">
                </div>
                <button type="submit" class="btn btn-primary" style="width: 100%;">
                    Complete Payment
                </button>
            </form>
        </div>
    `;

    document.getElementById('paymentForm').addEventListener('submit', handlePayment);
};

async function handlePayment(e) {
    e.preventDefault();
    
    const content = document.getElementById('seatSelectionContent');
    content.innerHTML = '<div class="loader"></div><p style="text-align: center; margin-top: 20px;">Processing payment...</p>';

    try {
        const bookingId = await bookSeats(
            currentShow.id,
            currentUser.uid,
            selectedSeats,
            selectedSeats.length * currentShow.pricePerSeat,
            currentMovie.Title
        );

        content.innerHTML = `
            <div class="success-message">
                <h2>🎉 Booking Confirmed!</h2>
                <p style="margin-top: 15px;">Your booking has been successful.</p>
                <div style="margin: 20px 0; padding: 20px; background: white; border-radius: 10px;">
                    <p><strong>Booking ID:</strong> ${bookingId}</p>
                    <p><strong>Movie:</strong> ${currentMovie.Title}</p>
                    <p><strong>Seats:</strong> ${selectedSeats.join(', ')}</p>
                    <p><strong>Total:</strong> ₹${selectedSeats.length * currentShow.pricePerSeat}</p>
                </div>
                <button class="btn btn-primary" style="width: 100%; margin-top: 10px;" onclick="closeSeatModal(); showPage('tickets');">
                    View My Tickets
                </button>
                <button class="btn btn-secondary" style="width: 100%; margin-top: 10px;" onclick="closeSeatModal(); closeModal(); showPage('home');">
                    Back to Home
                </button>
            </div>
        `;
    } catch (error) {
        content.innerHTML = `
            <div class="error-message">
                <h3>Booking Failed</h3>
                <p>${error.message}</p>
                <button class="btn btn-primary" style="margin-top: 15px;" onclick="showSeatSelection()">
                    Try Again
                </button>
            </div>
        `;
    }
}

// Firestore Booking Transaction
async function bookSeats(showId, userId, seats, amount, movieTitle) {
    const showRef = doc(db, "shows", showId);
    const bookingRef = doc(collection(db, "bookings"));

    await runTransaction(db, async (transaction) => {
        const showSnap = await transaction.get(showRef);
        
        if (!showSnap.exists()) {
            throw new Error("Show not found");
        }

        const showData = showSnap.data();
        const bookedSeats = showData.bookedSeats || [];

        // Check for conflicts
        for (const seat of seats) {
            if (bookedSeats.includes(seat)) {
                throw new Error(`Seat ${seat} is already booked. Please select different seats.`);
            }
        }

        // Update booked seats
        const newBookedSeats = [...bookedSeats, ...seats];
        transaction.update(showRef, { bookedSeats: newBookedSeats });

        // Create booking
        transaction.set(bookingRef, {
            userId,
            showId,
            movieTitle,
            seats,
            amount,
            status: "booked",
            cinema: currentShow.cinema,
            createdAt: serverTimestamp()
        });
    });

    return bookingRef.id;
}

// My Tickets
async function loadUserTickets() {
    const ticketsList = document.getElementById('ticketsList');
    ticketsList.innerHTML = '<div class="loader"></div>';

    try {
        const q = query(
            collection(db, "bookings"),
            where("userId", "==", currentUser.uid)
        );
        
        const querySnapshot = await getDocs(q);
        const bookings = [];
        
        querySnapshot.forEach((doc) => {
            bookings.push({ id: doc.id, ...doc.data() });
        });

        if (bookings.length === 0) {
            ticketsList.innerHTML = '<div class="error-message">No bookings found. Book your first movie!</div>';
            return;
        }

        // Sort by creation date (newest first)
        bookings.sort((a, b) => {
            const aTime = a.createdAt?.toMillis() || 0;
            const bTime = b.createdAt?.toMillis() || 0;
            return bTime - aTime;
        });

        ticketsList.innerHTML = bookings.map(booking => `
            <div class="ticket-card">
                <h3>${booking.movieTitle}</h3>
                <p><strong>Booking ID:</strong> ${booking.id}</p>
                <p><strong>Cinema:</strong> ${booking.cinema || 'CinemaHub Main'}</p>
                <p><strong>Seats:</strong> ${booking.seats.join(', ')}</p>
                <p><strong>Amount:</strong> ₹${booking.amount}</p>
                <p><strong>Date:</strong> ${booking.createdAt ? new Date(booking.createdAt.toMillis()).toLocaleString() : 'N/A'}</p>
                <span class="ticket-status status-${booking.status}">${booking.status.toUpperCase()}</span>
                ${booking.status === 'booked' ? `
                    <button class="btn btn-secondary" style="margin-top: 10px;" onclick="cancelBooking('${booking.id}', '${booking.showId}', '${JSON.stringify(booking.seats).replace(/"/g, '&quot;')}')">
                        Cancel Booking
                    </button>
                ` : ''}
            </div>
        `).join('');
    } catch (error) {
        ticketsList.innerHTML = '<div class="error-message">Failed to load tickets</div>';
    }
}

// Cancel Booking
window.cancelBooking = async function(bookingId, showId, seatsJson) {
    if (!confirm('Are you sure you want to cancel this booking?')) {
        return;
    }

    try {
        const seats = JSON.parse(seatsJson.replace(/&quot;/g, '"'));
        const bookingRef = doc(db, "bookings", bookingId);
        const showRef = doc(db, "shows", showId);

        await runTransaction(db, async (transaction) => {
            const showSnap = await transaction.get(showRef);
            
            if (showSnap.exists()) {
                const showData = showSnap.data();
                const bookedSeats = showData.bookedSeats || [];
                const updatedSeats = bookedSeats.filter(s => !seats.includes(s));
                transaction.update(showRef, { bookedSeats: updatedSeats });
            }

            transaction.update(bookingRef, { status: "cancelled" });
        });

        alert('Booking cancelled successfully');
        loadUserTickets();
    } catch (error) {
        alert('Failed to cancel booking: ' + error.message);
    }
};

// Auth Forms
function initForms() {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const messageEl = document.getElementById('authMessage');

        try {
            await signInWithEmailAndPassword(auth, email, password);
            messageEl.innerHTML = '<div class="success-message">Login successful!</div>';
            setTimeout(() => showPage('home'), 1000);
        } catch (error) {
            messageEl.innerHTML = `<div class="error-message">${error.message}</div>`;
        }
    });

    document.getElementById('signupForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const messageEl = document.getElementById('signupMessage');

        try {
            await createUserWithEmailAndPassword(auth, email, password);
            messageEl.innerHTML = '<div class="success-message">Account created! Redirecting...</div>';
            setTimeout(() => showPage('home'), 1000);
        } catch (error) {
            messageEl.innerHTML = `<div class="error-message">${error.message}</div>`;
        }
    });
}

// Logout
window.logout = async function() {
    try {
        await signOut(auth);
        showPage('home');
    } catch (error) {
        alert('Logout failed: ' + error.message);
    }
};
