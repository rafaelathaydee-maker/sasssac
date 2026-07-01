import axios from "axios";
import { getTenantSlugFromHost } from "../lib/tenant";

function inferApiUrl() {
  const configured = import.meta.env.VITE_API_URL;
  if (configured) return configured;

  if (typeof window !== "undefined" && window.location.hostname.endsWith(".onrender.com")) {
    return window.location.origin.replace("frontend", "backend");
  }

  return "http://localhost:4000";
}

export const API_URL = inferApiUrl();

export const api = axios.create({ baseURL: `${API_URL}/api` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  const slug = getTenantSlugFromHost();
  if (slug) {
    config.headers = config.headers || {};
    config.headers["X-Company-Slug"] = slug;
  }
  return config;
});
