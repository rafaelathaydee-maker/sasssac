import axios from "axios";
import { getTenantSlugFromHost } from "../lib/tenant";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

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
