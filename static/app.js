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

// Forecast Containers
const hourlyTrackEl = document.getElementById("hourly-track");
const forecastGridEl = document.getElementById("forecast-grid");

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  setupEventListeners();

  const savedCity = localStorage.getItem(STORAGE_KEY_LAST_CITY) || "London";
  fetchWeatherData({ city: savedCity });
});

// Theme Management
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

// Event Listeners Setup
function setupEventListeners() {
  themeToggleBtn.addEventListener("click", toggleTheme);

  searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const city = cityInput.value.trim();
    if (city) {
      fetchWeatherData({ city: city });
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
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;
        fetchWeatherData({
          lat: latitude,
          lon: longitude
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

// Fetch Weather Data from Backend API
async function fetchWeatherData(params) {
  showLoading();
  hideError();

  try {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`/api/weather?${query}`);
    const data = await response.json();

    if (!response.ok) {
      const serverError = data.detail || "An error occurred while fetching weather data.";
      throw new Error(serverError);
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

// Render Main Weather View
function renderWeather(data) {
  const current = data.current;
  const forecast = data.forecast;
  const hourly = data.hourly || [];

  if (!current) {
    showError("Incomplete data received from server.");
    return;
  }

  // Populate Current Weather Card
  const countryCode = current.sys && current.sys.country ? current.sys.country : "";
  cityNameEl.textContent = `${current.name}, ${countryCode}`;
  currentDateEl.textContent = formatDate(new Date());

  const weatherArray = current.weather || [];
  const primaryWeather = weatherArray[0] || {};
  const mainCondition = primaryWeather.main || "Clear";
  weatherBadgeEl.textContent = mainCondition;

  const currentTemp = Math.round(current.main.temp);
  currentTempEl.textContent = currentTemp;
  currentConditionEl.textContent = primaryWeather.description || "";

  const iconCode = primaryWeather.icon || "01d";
  currentIconEl.src = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
  currentIconEl.alt = mainCondition;

  const feelsLikeTemp = Math.round(current.main.feels_like);
  metricFeelsEl.textContent = `${feelsLikeTemp}°C`;
  metricHumidityEl.textContent = `${current.main.humidity}%`;

  const windSpeedKmH = Math.round((current.wind?.speed || 0) * 3.6);
  metricWindEl.textContent = `${windSpeedKmH} km/h`;
  metricPressureEl.textContent = `${current.main.pressure} hPa`;

  // Render Subsections
  renderHourlyForecast(hourly);
  renderForecast(forecast);

  weatherContent.classList.remove("hidden");
}

// Render 24-Hour Forecast Track
function renderHourlyForecast(hourlyList) {
  hourlyTrackEl.innerHTML = "";

  if (!hourlyList || hourlyList.length === 0) {
    return;
  }

  for (let i = 0; i < hourlyList.length; i++) {
    const item = hourlyList[i];
    const timeLabel = item.hour || "--:--";
    const tempValue = item.temp;
    const iconCode = item.icon || "01d";
    const conditionText = item.condition || "";
    const popPercent = item.pop || 0;

    const card = document.createElement("div");
    card.className = "hourly-card";

    let popHtml = "";
    if (popPercent > 0) {
      popHtml = `<span class="hourly-pop">💧 ${popPercent}%</span>`;
    }

    card.innerHTML = `
      <span class="hourly-time">${timeLabel}</span>
      <img src="https://openweathermap.org/img/wn/${iconCode}.png" alt="${conditionText}" />
      <span class="hourly-temp">${tempValue}°C</span>
      ${popHtml}
    `;

    hourlyTrackEl.appendChild(card);
  }
}

// Render 3-Day Daily Forecast
function renderForecast(forecastData) {
  forecastGridEl.innerHTML = "";

  if (!forecastData || !forecastData.list) {
    return;
  }

  const dailyForecasts = [];
  const processedDates = new Set();
  const todayStr = new Date().toISOString().split("T")[0];

  const listItems = forecastData.list;

  for (let i = 0; i < listItems.length; i++) {
    const entry = listItems[i];
    const dtTxt = entry.dt_txt || "";
    const entryDate = dtTxt.split(" ")[0];
    const entryTime = dtTxt.split(" ")[1] || "";

    if (entryDate !== todayStr && !processedDates.has(entryDate)) {
      if (entryTime.startsWith("12") || entryTime.startsWith("15")) {
        dailyForecasts.push(entry);
        processedDates.add(entryDate);
      }
    }

    if (dailyForecasts.length === 3) {
      break;
    }
  }

  // Fallback if exact 12:00 was absent
  if (dailyForecasts.length < 3) {
    for (let i = 0; i < listItems.length; i++) {
      const entry = listItems[i];
      const dtTxt = entry.dt_txt || "";
      const entryDate = dtTxt.split(" ")[0];

      if (entryDate !== todayStr && !processedDates.has(entryDate)) {
        dailyForecasts.push(entry);
        processedDates.add(entryDate);
      }

      if (dailyForecasts.length === 3) {
        break;
      }
    }
  }

  for (let j = 0; j < dailyForecasts.length; j++) {
    const item = dailyForecasts[j];
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
  }
}

// Utility Formatting and UI State
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