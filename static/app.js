// State Management
const STORAGE_KEY_THEME = "weatherpulse_theme";
const STORAGE_KEY_LAST_CITY = "weatherpulse_last_city";

// DOM Elements
const themeToggleBtn = document.getElementById("theme-toggle");
const searchForm = document.getElementById("search-form");
const cityInput = document.getElementById("city-input");
const geoBtn = document.getElementById("geo-btn");
const errorMessage = document.getElementById("error-message");
const loadingSpinner = document.getElementById("loading-spinner");
const weatherContent = document.getElementById("weather-content");

// Current Weather Elements
const cityNameEl = document.getElementById("city-name");
const currentDateEl = document.getElementById("current-date");
const weatherBadgeEl = document.getElementById("weather-badge");
const currentTempEl = document.getElementById("current-temp");
const currentIconEl = document.getElementById("current-icon");
const currentConditionEl = document.getElementById("current-condition");
const metricFeelsEl = document.getElementById("metric-feels");
const metricHumidityEl = document.getElementById("metric-humidity");
const metricWindEl = document.getElementById("metric-wind");
const metricPressureEl = document.getElementById("metric-pressure");
const forecastGridEl = document.getElementById("forecast-grid");

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  setupEventListeners();

  const savedCity = localStorage.getItem(STORAGE_KEY_LAST_CITY) || "London";
  fetchWeatherData({ city: savedCity });
});

// Theme Toggle Handling
function initTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem(STORAGE_KEY_THEME, newTheme);
}

// Event Listeners
function setupEventListeners() {
  themeToggleBtn.addEventListener("click", toggleTheme);

  searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const city = cityInput.value.trim();
    if (city) {
      fetchWeatherData({ city });
    }
  });

  geoBtn.addEventListener("click", () => {
    if (!navigator.geolocation) {
      showError("Geolocation is not supported by your browser.");
      return;
    }

    showLoading();
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetchWeatherData({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude
        });
      },
      (err) => {
        hideLoading();
        showError("Unable to retrieve your location. Please check browser permissions.");
      },
      { timeout: 10000 }
    );
  });
}

// Fetch Data from Backend API
async function fetchWeatherData(params) {
  showLoading();
  hideError();

  try {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`/api/weather?${query}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "An error occurred while fetching weather data.");
    }

    renderWeather(data);
    if (params.city) {
      localStorage.setItem(STORAGE_KEY_LAST_CITY, params.city);
    } else if (data.current && data.current.name) {
      localStorage.setItem(STORAGE_KEY_LAST_CITY, data.current.name);
    }
  } catch (err) {
    showError(err.message);
  } finally {
    hideLoading();
  }
}

// Render Weather Information
function renderWeather(data) {
  const { current, forecast } = data;

  if (!current) {
    showError("Incomplete data received from server.");
    return;
  }

  // Populate Current Weather
  cityNameEl.textContent = `${current.name}, ${current.sys?.country || ""}`;
  currentDateEl.textContent = formatDate(new Date());
  
  const mainCondition = current.weather?.[0]?.main || "Clear";
  weatherBadgeEl.textContent = mainCondition;

  currentTempEl.textContent = Math.round(current.main.temp);
  currentConditionEl.textContent = current.weather?.[0]?.description || "";
  
  const iconCode = current.weather?.[0]?.icon || "01d";
  currentIconEl.src = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
  currentIconEl.alt = mainCondition;

  metricFeelsEl.textContent = `${Math.round(current.main.feels_like)}°C`;
  metricHumidityEl.textContent = `${current.main.humidity}%`;
  metricWindEl.textContent = `${Math.round((current.wind?.speed || 0) * 3.6)} km/h`; // convert m/s to km/h
  metricPressureEl.textContent = `${current.main.pressure} hPa`;

  // Process & Render 3-Day Forecast
  renderForecast(forecast);

  weatherContent.classList.remove("hidden");
}

// Extract next 3 distinct days from 3-hour interval data
function renderForecast(forecastData) {
  forecastGridEl.innerHTML = "";

  if (!forecastData || !forecastData.list) {
    return;
  }

  const dailyForecasts = [];
  const processedDates = new Set();
  const todayStr = new Date().toISOString().split("T")[0];

  for (const entry of forecastData.list) {
    const entryDate = entry.dt_txt.split(" ")[0];
    const entryTime = entry.dt_txt.split(" ")[1];

    // Pick midday data (~12:00:00) for future days
    if (entryDate !== todayStr && !processedDates.has(entryDate)) {
      if (entryTime.startsWith("12") || entryTime.startsWith("15")) {
        dailyForecasts.push(entry);
        processedDates.add(entryDate);
      }
    }

    if (dailyForecasts.length === 3) break;
  }

  // Fallback if strict 12:00 was not available
  if (dailyForecasts.length < 3) {
    for (const entry of forecastData.list) {
      const entryDate = entry.dt_txt.split(" ")[0];
      if (entryDate !== todayStr && !processedDates.has(entryDate)) {
        dailyForecasts.push(entry);
        processedDates.add(entryDate);
      }
      if (dailyForecasts.length === 3) break;
    }
  }

  dailyForecasts.forEach((item) => {
    const dateObj = new Date(item.dt * 1000);
    const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });
    const formattedShortDate = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const icon = item.weather?.[0]?.icon || "01d";
    const desc = item.weather?.[0]?.description || "";
    const temp = Math.round(item.main.temp);

    const card = document.createElement("div");
    card.className = "forecast-card";
    card.innerHTML = `
      <span class="forecast-day">${dayName}</span>
      <span class="forecast-date">${formattedShortDate}</span>
      <img src="https://openweathermap.org/img/wn/${icon}.png" alt="${desc}" />
      <span class="forecast-temp">${temp}°C</span>
      <span class="forecast-condition">${desc}</span>
    `;
    forecastGridEl.appendChild(card);
  });
}

// Utility Helpers
function formatDate(date) {
  const options = { weekday: "long", month: "short", day: "numeric", year: "numeric" };
  return date.toLocaleDateString("en-US", options);
}

function showLoading() {
  loadingSpinner.classList.remove("hidden");
  weatherContent.classList.add("hidden");
}

function hideLoading() {
  loadingSpinner.classList.add("hidden");
}

function showError(msg) {
  errorMessage.textContent = msg;
  errorMessage.classList.remove("hidden");
}

function hideError() {
  errorMessage.classList.add("hidden");
}