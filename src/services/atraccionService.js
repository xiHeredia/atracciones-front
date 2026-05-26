import { atraccionesApi, reservasApi, clientesApi, facturacionApi, bookingApi, unwrap } from "./api";

export const obtenerAtracciones = async (params = {}) => {
  const response = await atraccionesApi.get("/atracciones", { params });
  return response.data;
};

export const obtenerAtraccionDetalle = async (guid) => {
  const response = await atraccionesApi.get(`/atracciones/${guid}`);
  return response.data;
};

export const crearAtraccion = async (atraccion) => {
  const response = await atraccionesApi.post("/atracciones", atraccion);
  return response.data;
};

export const actualizarAtraccion = async (guid, atraccion) => {
  const response = await atraccionesApi.put(`/atracciones/${guid}`, atraccion);
  return response.data;
};

export const eliminarAtraccion = async (guid) => {
  const response = await atraccionesApi.delete(`/atracciones/${guid}`);
  return response.data;
};

export const buscarAtracciones = async (filtro) => {
  const response = await atraccionesApi.get("/atracciones", { params: filtro });
  return response.data;
};

export const obtenerTicketsAtraccion = async (atraccionGuid) => {
  const response = await atraccionesApi.get(`/atracciones/${atraccionGuid}/tickets`);
  return response.data;
};

export const obtenerHorariosTicket = async (ticketGuid) => {
  const response = await atraccionesApi.get(`/tickets/${ticketGuid}/horarios`);
  return response.data;
};

export const crearReserva = async (reserva) => {
  const response = await reservasApi.post("/reservas", reserva);
  return response.data;
};

export const crearReservaBooking = async (reserva) => {
  const response = await bookingApi.post("/reservas", reserva);
  return response.data;
};

export const crearFactura = async (factura) => {
  const response = await facturacionApi.post("/facturas", factura);
  return response.data;
};

export const confirmarPagoReserva = async (reservaGuid, pago) => {
  const response = await bookingApi.post(`/reservas/${reservaGuid}/pagos/confirmacion`, pago);
  return response.data;
};

export const obtenerReservas = async () => {
  const response = await reservasApi.get("/reservas");
  return response.data;
};

export const obtenerClientePorUsuarioGuid = async (usuarioGuid) => {
  const response = await clientesApi.get(`/clientes/usuario/${usuarioGuid}`);
  return response.data;
};

export const dataOf = unwrap;
