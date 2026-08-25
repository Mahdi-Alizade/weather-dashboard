# 🌦️ WeatherPulse Dashboard

A modern, responsive, and secure full-stack weather dashboard built with **FastAPI** and **Vanilla JavaScript**. It leverages the **OpenWeatherMap API** to deliver real-time atmospheric conditions, interactive location search, and multi-day forecasts with a sleek glassmorphic user interface.

---

## ✨ Features

- 🔍 **Global City Search:** Instantly fetch live weather data for any city worldwide.
- 📍 **Geolocation Detection:** Automatically fetch local weather using browser-native Geolocation API.
- 📅 **3-Day Forecast:** Dynamic aggregation and display of future weather conditions.
- 🌓 **Dark / Light Mode:** Fully adaptive theme system with instant state persistence via `localStorage`.
- 🔒 **Secure API Proxying:** Client requests are routed through a Python FastAPI backend, keeping API credentials completely private.
- 📱 **Fully Responsive UI:** Glassmorphism-inspired design optimized for mobile, tablet, and desktop viewports.

---

## 🛠️ Tech Stack

- **Backend:** Python 3.10+, FastAPI, Uvicorn, HTTPX, Python-Dotenv
- **Frontend:** Semantic HTML5, Modern CSS3 (CSS Variables, Flexbox/Grid, Glassmorphism), Vanilla JavaScript (ES6+ Async/Await)
- **API:** OpenWeatherMap API (Current Weather & 5-Day/3-Hour Forecast endpoints)

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10 or higher
- An OpenWeatherMap API Key ([Get a free key here](https://home.openweathermap.org/api_keys))

### Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/your-username/weather-dashboard.git](https://github.com/your-username/weather-dashboard.git)
   cd weather-dashboard
Set up a Virtual Environment:

PowerShell
python -m venv venv
.\venv\Scripts\Activate.ps1
Install Dependencies:

PowerShell
pip install -r requirements.txt
Configure Environment Variables:
Copy .env.example to .env and supply your OpenWeatherMap API key:

Code snippet
OPENWEATHER_API_KEY=your_actual_api_key_here
PORT=8000
Run the Application:

PowerShell
python main.py
Open your browser and navigate to:

Plaintext
[http://127.0.0.1:8000](http://127.0.0.1:8000)
📂 Project Structure
Plaintext
weather-dashboard/
│
├── static/
│   ├── index.html      # Main HTML structure
│   ├── style.css       # Responsive styling & themes
│   └── app.js          # Client-side API integration & DOM manipulation
│
├── main.py             # FastAPI backend & secure API proxy
├── requirements.txt    # Project dependencies
├── .env.example        # Environment variable template
├── .gitignore          # Git exclusion rules
└── README.md           # Project documentation
📄 License
This project is licensed under the MIT License.