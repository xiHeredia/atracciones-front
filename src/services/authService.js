import { identidadApi, clientesApi, normalizeUser } from "./api";
import { clearStoredUser, setStoredUser } from "./session";

export const login = async (userName, password) => {
  const response = await identidadApi.post("/auth/login", {
    userName,
    password,
  });

  return response.data;
};

export const register = async (userName, password, roles = ["CLIENTE"]) => {
  const response = await identidadApi.post("/auth/register", {
    userName,
    password,
    roles,
  });

  return response.data;
};

export const loginAndStore = async (userName, password) => {
  const result = await login(userName, password);
  const user = normalizeUser(result);
  setStoredUser(user);
  return user;
};

export const registerCliente = async ({ cuenta, perfil }) => {
  const result = await register(cuenta.userName, cuenta.password, ["CLIENTE"]);
  const user = normalizeUser(result);
  setStoredUser(user);

  await clientesApi.post("/clientes", {
    usuarioGuid: user.usuarioGuid,
    tipoIdentificacion: perfil.tipoIdentificacion,
    numeroIdentificacion: perfil.numeroIdentificacion,
    nombres: perfil.nombres,
    apellidos: perfil.apellidos,
    razonSocial: perfil.razonSocial || null,
    correo: perfil.correo,
    telefono: perfil.telefono || null,
    direccion: perfil.direccion || null,
  });

  const clienteResponse = await clientesApi.get(`/clientes/usuario/${user.usuarioGuid}`);
  const cliente = clienteResponse.data?.data ?? clienteResponse.data;
  const stored = { ...user, clienteGuid: cliente?.guid, cliente };
  setStoredUser(stored);
  return stored;
};

export const logout = () => {
  clearStoredUser();
};
