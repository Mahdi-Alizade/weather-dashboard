// Local Storage Keys
const STORAGE_KEY_THEME = "weatherpulse_theme";
const STORAGE_KEY_LAST_CITY = "weatherpulse_last_city";
const STORAGE_KEY_FAVORITES = "weatherpulse_favorites";

// DOM Elements
const themeToggleBtn = document.getElementById("theme-toggle");
const searchForm = document.getElementById("search-form");
const cityInput = document.getElementById("city-input");
const geoBtn = document.getElementById("geo-btn");
const errorMessage = document.getElementById("error-message");
const loadingSpinner = document.getElementById("loading-spinner");
const weatherContent = document.getElementById("weather-content");

// Favorites Elements
const favoritesSection = document.getElementById("favorites-section");
const favoritesContainer = document.getElementById("favorites-container");
const favoriteBtn = document.getElementById("favorite-btn");

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

// Air Quality Elements
const aqiSectionEl = document.getElementById("aqi-section");
const aqiBadgeEl = document.getElementById("aqi-badge");
const aqiAdvisoryEl = document.getElementById("aqi-advisory");
const aqiPm25El = document.getElementById("aqi-pm25");
const aqiPm10El = document.getElementById("aqi-pm10");
const aqiNo2El = document.getElementById("aqi-no2");
const aqiO3El = document.getElementById("aqi-o3");

// Forecast Containers
const hourlyTrackEl = document.getElementById("hourly-track");
const forecastGridEl = document.getElementById("forecast-grid");

// App State
let currentLoadedCity = "";

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  renderFavoritesList();
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

// Dynamic Weather Atmosphere Themes
function applyWeatherAtmosphere(conditionMain) {
  const atmosphereClasses = [
    "weather-clear",
    "weather-clouds",
    "weather-rain",
    "weather-snow",
    "weather-thunderstorm"
  ];

  for (let i = 0; i < atmosphereClasses.length; i++) {
    document.body.classList.remove(atmosphereClasses[i]);
  }

  if (!conditionMain) return;

  const normalized = conditionMain.trim().toLowerCase();

  if (normalized.includes("clear")) {
    document.body.classList.add("weather-clear");
  } else if (normalized.includes("cloud")) {
    document.body.classList.add("weather-clouds");
  } else if (normalized.includes("rain") || normalized.includes("drizzle")) {
    document.body.classList.add("weather-rain");
  } else if (normalized.includes("snow")) {
    document.body.classList.add("weather-snow");
  } else if (normalized.includes("thunder") || normalized.includes("storm")) {
    document.body.classList.add("weather-thunderstorm");
  }
}

// Favorites Storage Operations
function getStoredFavorites() {
  const rawData = localStorage.getItem(STORAGE_KEY_FAVORITES);
  if (!rawData) {
    return [];
  }
  try {
    const parsed = JSON.parse(rawData);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function saveFavorites(favoritesArray) {
  const jsonString = JSON.stringify(favoritesArray);
  localStorage.setItem(STORAGE_KEY_FAVORITES, jsonString);
}

function isCityFavorited(cityName) {
  if (!cityName) return false;
  const list = getStoredFavorites();
  const normalizedTarget = cityName.trim().toLowerCase();
  for (let i = 0; i < list.length; i++) {
    if (list[i].toLowerCase() === normalizedTarget) {
      return true;
    }
  }
  return false;
}

function toggleFavoriteCity() {
  if (!currentLoadedCity) return;

  const currentList = getStoredFavorites();
  const normalizedTarget = currentLoadedCity.trim().toLowerCase();
  const existingIndex = currentList.findIndex(
    (item) => item.toLowerCase() === normalizedTarget
  );

  if (existingIndex > -1) {
    // Remove from favorites
    currentList.splice(existingIndex, 1);
    favoriteBtn.classList.remove("active");
  } else {
    // Add to favorites (maximum 6 pinned cities)
    if (currentList.length >= 6) {
      currentList.shift();
    }
    currentList.push(currentLoadedCity);
    favoriteBtn.classList.add("active");
  }

  saveFavorites(currentList);
  renderFavoritesList();
}

function renderFavoritesList() {
  const favorites = getStoredFavorites();
  favoritesContainer.innerHTML = "";

  if (favorites.length === 0) {
    favoritesSection.classList.add("hidden");
    return;
  }

  favoritesSection.classList.remove("hidden");

  for (let i = 0; i < favorites.length; i++) {
    const city = favorites[i];
    const chip = document.createElement("div");
    chip.className = "favorite-chip";

    const label = document.createElement("span");
    label.textContent = city;
    label.addEventListener("click", () => {
      fetchWeatherData({ city: city });
    });

    const removeBtn = document.createElement("button");
    removeBtn.className = "chip-remove";
    removeBtn.innerHTML = "&times;";
    removeBtn.title = `Remove ${city}`;
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      removeFavoriteCity(city);
    });

    chip.appendChild(label);
    chip.appendChild(removeBtn);
    favoritesContainer.appendChild(chip);
  }
}

function removeFavoriteCity(cityName) {
  const list = getStoredFavorites();
  const filtered = list.filter(
    (item) => item.toLowerCase() !== cityName.trim().toLowerCase()
  );
  saveFavorites(filtered);
  renderFavoritesList();

  if (currentLoadedCity.toLowerCase() === cityName.trim().toLowerCase()) {
    favoriteBtn.classList.remove("active");
  }
}

// Event Listeners Setup
function setupEventListeners() {
  themeToggleBtn.addEventListener("click", toggleTheme);
  favoriteBtn.addEventListener("click", toggleFavoriteCity);

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
  const airQuality = data.air_quality || {};

  if (!current) {
    showError("Incomplete data received from server.");
    return;
  }

  // Update State
  currentLoadedCity = current.name || "";

  // Populate Current Weather Card
  const countryCode = current.sys && current.sys.country ? current.sys.country : "";
  cityNameEl.textContent = `${current.name}, ${countryCode}`;
  currentDateEl.textContent = formatDate(new Date());

  // Update Favorite Star Status
  if (isCityFavorited(current.name)) {
    favoriteBtn.classList.add("active");
  } else {
    favoriteBtn.classList.remove("active");
  }

  const weatherArray = current.weather || [];
  const primaryWeather = weatherArray[0] || {};
  const mainCondition = primaryWeather.main || "Clear";
  weatherBadgeEl.textContent = mainCondition;

  // Apply Atmospheric Dynamic Glow Theme
  applyWeatherAtmosphere(mainCondition);

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
  renderAirQuality(airQuality);
  renderHourlyForecast(hourly);
  renderForecast(forecast);

  weatherContent.classList.remove("hidden");
}

// Render Air Quality Index
function renderAirQuality(airQuality) {
  if (!airQuality || !airQuality.aqi) {
    aqiSectionEl.classList.add("hidden");
    return;
  }

  aqiSectionEl.classList.remove("hidden");

  const aqiVal = airQuality.aqi;
  const statusLabel = airQuality.status || "Moderate";
  const badgeColor = airQuality.color || "#10b981";
  const advisoryText = airQuality.advisory || "";

  aqiBadgeEl.textContent = `AQI ${aqiVal} • ${statusLabel}`;
  aqiBadgeEl.style.color = badgeColor;
  aqiBadgeEl.style.borderColor = badgeColor;
  aqiAdvisoryEl.textContent = advisoryText;

  aqiPm25El.textContent = `${airQuality.pm2_5 || 0} µg/m³`;
  aqiPm10El.textContent = `${airQuality.pm10 || 0} µg/m³`;
  aqiNo2El.textContent = `${airQuality.no2 || 0} µg/m³`;
  aqiO3El.textContent = `${airQuality.o3 || 0} µg/m³`;
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