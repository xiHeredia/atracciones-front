import { apiFor } from "./api";

export const unwrap = (payload) => payload?.data ?? payload?.items ?? payload ?? [];

const resourceServices = {
  usuarios: "identidad",
  roles: "identidad",
  "usuarios-roles": "identidad",
  clientes: "clientes",
  atracciones: "atracciones",
  destinos: "atracciones",
  categorias: "atracciones",
  idiomas: "atracciones",
  incluye: "atracciones",
  incluyes: "atracciones",
  imagenes: "atracciones",
  tickets: "atracciones",
  horarios: "atracciones",
  resenias: "atracciones",
  reservas: "reservas",
  facturas: "facturacion",
  "datos-facturacion": "facturacion",
};

const clientFor = (resource) => apiFor(resourceServices[resource] || "atracciones");

const idOf = (row) => row?.id ?? row?.Id ?? row?.guid ?? row?.Guid;
const guidOf = (row) => row?.guid ?? row?.Guid ?? row?.id ?? row?.Id;
const guidIdResources = new Set([
  "atracciones",
  "destinos",
  "categorias",
  "incluye",
  "incluyes",
  "idiomas",
  "imagenes",
  "tickets",
  "horarios",
  "reservas",
  "resenias",
  "facturas",
  "datos-facturacion",
]);

function normalizeRows(resource, rows) {
  const list = Array.isArray(rows) ? rows : [];

  return list.map((row) => {
    const guid = guidOf(row);
    const normalized = { ...row, id: idOf(row), guid };

    if (guidIdResources.has(resource) && guid && typeof guid === "string") normalized.id = guid;

    switch (resource) {
      case "atracciones":
        return {
          ...normalized,
          destinoId: row.destinoGuid ?? row.DestinoGuid,
          destinoNombre: row.destinoNombre ?? row.DestinoNombre,
          destino: row.destinoNombre ?? row.DestinoNombre,
          precioReferencia: row.precioReferencia ?? row.PrecioReferencia,
        };
      case "destinos":
        return {
          ...normalized,
          pais: row.pais ?? row.Pais ?? row.extra ?? row.Extra,
          imagenUrl: row.imagenUrl ?? row.ImagenUrl,
        };
      case "categorias":
        return {
          ...normalized,
          parentId: row.parentId ?? row.ParentId ?? row.parentGuid ?? row.ParentGuid,
        };
      case "incluye":
      case "incluyes":
        return {
          ...normalized,
          descripcion: row.descripcion ?? row.Descripcion ?? row.nombre ?? row.Nombre,
        };
      case "idiomas":
        return {
          ...normalized,
          nombre: row.nombre ?? row.Nombre ?? row.descripcion ?? row.Descripcion,
        };
      case "imagenes":
        return {
          ...normalized,
          url: row.url ?? row.Url,
          descripcion: row.descripcion ?? row.Descripcion,
        };
      case "tickets":
        return {
          ...normalized,
          atraccionId: row.atraccionGuid ?? row.AtraccionGuid,
          atraccionNombre: row.atraccionNombre ?? row.AtraccionNombre,
        };
      case "horarios":
        return {
          ...normalized,
          ticketId: row.ticketGuid ?? row.TicketGuid,
          ticketTitulo: row.ticketTitulo ?? row.TicketTitulo,
        };
      case "reservas":
        return {
          ...normalized,
          clienteId: row.clienteGuid ?? row.ClienteGuid,
          horarioId: row.horarioGuid ?? row.HorarioGuid,
        };
      case "resenias":
        return {
          ...normalized,
          atraccionId: row.atraccionGuid ?? row.AtraccionGuid,
          reservaId: row.reservaGuid ?? row.ReservaGuid,
        };
      case "facturas":
        {
          const datos = row.datosFacturacion ?? row.DatosFacturacion ?? {};
          return {
            ...normalized,
            reservaId: row.reservaGuid ?? row.ReservaGuid,
            facturacionNombre: datos.nombre ?? datos.Nombre,
            facturacionCorreo: datos.correo ?? datos.Correo,
          };
        }
      case "datos-facturacion":
        return {
          ...normalized,
          facturaId: row.facturaGuid ?? row.FacturaGuid,
        };
      default:
        return normalized;
    }
  });
}

function normalizeBody(resource, body) {
  const value = (name) => body[name] === "" ? null : body[name];

  switch (resource) {
    case "atracciones":
      return {
        destinoGuid: value("destinoId") ?? value("destinoGuid"),
        nombre: value("nombre"),
        descripcion: value("descripcion"),
        precioReferencia: value("precioReferencia"),
        direccion: value("direccion"),
        duracionMinutos: value("duracionMinutos"),
        puntoEncuentro: value("puntoEncuentro"),
        incluyeAcompaniante: Boolean(body.incluyeAcompaniante),
        incluyeTransporte: Boolean(body.incluyeTransporte),
        disponible: body.disponible ?? true,
      };
    case "tickets":
      return {
        atraccionGuid: value("atraccionId") ?? value("atraccionGuid"),
        titulo: value("titulo"),
        precio: value("precio"),
        tipoParticipante: value("tipoParticipante"),
        capacidadMaxima: value("capacidadMaxima"),
        cuposDisponibles: value("cuposDisponibles"),
      };
    case "horarios":
      return {
        ticketGuid: value("ticketId") ?? value("ticketGuid"),
        fecha: value("fecha"),
        horaInicio: value("horaInicio"),
        horaFin: value("horaFin"),
        cuposDisponibles: value("cuposDisponibles"),
      };
    case "resenias":
      return {
        atraccionGuid: value("atraccionId") ?? value("atraccionGuid"),
        reservaGuid: value("reservaId") ?? value("reservaGuid"),
        rating: value("rating"),
        comentario: value("comentario"),
      };
    case "facturas":
      return {
        reservaGuid: value("reservaId") ?? value("reservaGuid"),
        numero: value("numero"),
        total: value("total"),
        observacion: value("observacion"),
        origenCanal: value("origenCanal"),
        datosFacturacion: {
          nombre: value("facturacionNombre"),
          apellido: value("facturacionApellido"),
          correo: value("facturacionCorreo"),
          telefono: value("facturacionTelefono"),
        },
      };
    default:
      return body;
  }
}

export async function list(resource) {
  const { data } = await clientFor(resource).get(`/${resource}`);
  return normalizeRows(resource, unwrap(data));
}

export async function get(resource, id) {
  const { data } = await clientFor(resource).get(`/${resource}/${id}`);
  const rows = normalizeRows(resource, [data?.data ?? data]);
  return rows[0];
}

export async function create(resource, body) {
  const { data } = await clientFor(resource).post(`/${resource}`, normalizeBody(resource, body));
  return data?.data ?? data;
}

export async function update(resource, id, body) {
  const { data } = await clientFor(resource).put(`/${resource}/${id}`, normalizeBody(resource, body));
  return data?.data ?? data;
}

export async function remove(resource, id) {
  const { data } = await clientFor(resource).delete(`/${resource}/${id}`);
  return data?.data ?? data;
}

export async function patch(resource, id, action, body) {
  const { data } = await clientFor(resource).patch(`/${resource}/${id}/${action}`, body);
  return data?.data ?? data;
}
