import axios from "axios";
import { getStoredUser, isAuthenticated } from "./session";

const serviceUrls = {
  identidad: import.meta.env.VITE_API_URL || import.meta.env.VITE_IDENTIDAD_API_URL || "http://localhost:5012/api/v1",
  clientes: import.meta.env.VITE_API_URL || import.meta.env.VITE_CLIENTES_API_URL || "http://localhost:5167/api/v1",
  atracciones: import.meta.env.VITE_API_URL || import.meta.env.VITE_ATRACCIONES_API_URL || "http://localhost:5265/api/v1",
  reservas: import.meta.env.VITE_API_URL || import.meta.env.VITE_RESERVAS_API_URL || "http://localhost:5231/api/v1",
  facturacion: import.meta.env.VITE_API_URL || import.meta.env.VITE_FACTURACION_API_URL || "http://localhost:5023/api/v1",
};

const attachInterceptors = (client) => {
  client.interceptors.request.use((config) => {
    const raw = localStorage.getItem("user");
    const user = raw ? JSON.parse(raw) : null;
    const token = user?.token || user?.accessToken || user?.jwt;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    (error) => {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.title ||
        error?.response?.data?.error ||
        error.message ||
        "Error inesperado";
      return Promise.reject({ ...error, userMessage: message });
    }
  );

  return client;
};

export const identidadApi = attachInterceptors(axios.create({ baseURL: serviceUrls.identidad, timeout: 20000 }));
export const clientesApi = attachInterceptors(axios.create({ baseURL: serviceUrls.clientes, timeout: 20000 }));
export const atraccionesApi = attachInterceptors(axios.create({ baseURL: serviceUrls.atracciones, timeout: 20000 }));
export const reservasApi = attachInterceptors(axios.create({ baseURL: serviceUrls.reservas, timeout: 20000 }));
export const facturacionApi = attachInterceptors(axios.create({ baseURL: serviceUrls.facturacion, timeout: 20000 }));

export const apiFor = (service) => {
  const clients = {
    identidad: identidadApi,
    clientes: clientesApi,
    atracciones: atraccionesApi,
    reservas: reservasApi,
    facturacion: facturacionApi,
  };

  return clients[service] || atraccionesApi;
};

export const unwrap = (payload) => payload?.data ?? payload?.items ?? payload ?? [];

export const normalizeUser = (payload) => {
  const raw = payload?.data ?? payload ?? {};
  return {
    ...raw,
    token: raw.token || raw.Token || raw.accessToken || raw.jwt,
    roles: raw.roles || raw.Roles || [],
    usuarioId: raw.usuarioId ?? raw.UsuarioId,
    usuarioGuid: raw.usuarioGuid || raw.UsuarioGuid,
    userName: raw.userName || raw.UserName,
  };
};

export { getStoredUser, isAuthenticated };

export default atraccionesApi;
