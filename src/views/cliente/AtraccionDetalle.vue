<template>
  <div class="page">
    <AppNav />
    <main class="wrap">
      <button class="back" @click="$router.push('/cliente')">Volver</button>

      <div v-if="loading" class="loading">Cargando detalle...</div>
      <div v-else-if="error" class="notice bad">{{ error }}</div>

      <section v-else class="detail">
        <div class="cover" :style="{ backgroundImage: `url('${mainImage}')` }"></div>

        <div class="info">
          <p class="eyebrow">{{ atraccion.destinoNombre || 'Atraccion' }}</p>
          <h1>{{ atraccion.nombre }}</h1>
          <p class="desc">{{ atraccion.descripcion || 'Experiencia disponible para reserva.' }}</p>

          <div class="meta">
            <span v-if="atraccion.duracionMinutos">{{ atraccion.duracionMinutos }} min</span>
            <span v-if="atraccion.direccion">{{ atraccion.direccion }}</span>
            <span>{{ atraccion.totalResenias || 0 }} resenas</span>
          </div>

          <div class="chips" v-if="atraccion.incluye?.length">
            <span v-for="x in atraccion.incluye" :key="x.guid">{{ x.nombre }}</span>
          </div>

          <section v-if="!loggedIn" class="auth-gate">
            <h2>Reserva esta experiencia</h2>
            <p>Para confirmar una reserva necesitas iniciar sesion o crear tu cuenta de cliente.</p>
            <div class="gate-actions">
              <button class="btn" @click="goLogin">Ingresar</button>
              <button class="btn secondary" @click="goRegister">Registrarme</button>
            </div>
          </section>

          <form v-else class="booking" @submit.prevent="reservar">
            <h2>Crear reserva</h2>

            <label>Ticket</label>
            <select v-model="form.ticketGuid" @change="loadHorarios">
              <option value="">Seleccione ticket</option>
              <option v-for="t in tickets" :key="t.guid" :value="t.guid">
                {{ t.titulo }} - ${{ money(t.precio) }} - cupos {{ t.cuposDisponibles }}
              </option>
            </select>

            <label>Horario</label>
            <select v-model="form.horarioGuid">
              <option value="">Seleccione horario</option>
              <option v-for="h in horarios" :key="h.guid" :value="h.guid">
                {{ h.fecha }} {{ h.horaInicio }} - {{ h.horaFin || 'sin fin' }} / cupos {{ h.cuposDisponibles }}
              </option>
            </select>

            <label>Cantidad</label>
            <input v-model.number="form.cantidad" type="number" min="1" />

            <div class="total">
              <span>Total estimado</span>
              <strong>${{ money(total) }}</strong>
            </div>

            <div v-if="formError" class="notice bad">{{ formError }}</div>
            <div v-if="ok" class="notice ok">{{ ok }}</div>

            <button class="btn" :disabled="saving">{{ saving ? 'Reservando...' : 'Confirmar reserva' }}</button>
          </form>

          <form v-if="createdReserva && !facturaOk" class="billing" @submit.prevent="generarFactura">
            <h2>Datos de facturacion</h2>
            <p>Completa estos datos para emitir la factura de la reserva.</p>

            <label>Nombre o razon social</label>
            <input v-model.trim="billing.nombre" type="text" />

            <label>Apellido</label>
            <input v-model.trim="billing.apellido" type="text" />

            <label>Correo</label>
            <input v-model.trim="billing.correo" type="email" />

            <label>Telefono</label>
            <input v-model.trim="billing.telefono" type="tel" />

            <div v-if="billingError" class="notice bad">{{ billingError }}</div>
            <button class="btn secondary" :disabled="billingSaving">{{ billingSaving ? 'Generando...' : 'Generar factura' }}</button>
          </form>

          <div v-if="facturaOk" class="notice ok">{{ facturaOk }}</div>
        </div>
      </section>
    </main>
  </div>
</template>

<script>
import AppNav from "../../components/AppNav.vue";
import { clientesApi, getStoredUser, isAuthenticated } from "../../services/api";
import { setStoredUser } from "../../services/session";
import {
  crearFactura,
  crearReserva,
  dataOf,
  obtenerAtraccionDetalle,
  obtenerHorariosTicket,
  obtenerTicketsAtraccion,
} from "../../services/atraccionService";

export default {
  components: { AppNav },
  data: () => ({
    loading: false,
    saving: false,
    billingSaving: false,
    error: "",
    formError: "",
    billingError: "",
    ok: "",
    facturaOk: "",
    atraccion: {},
    tickets: [],
    horarios: [],
    cliente: null,
    clienteGuid: "",
    createdReserva: null,
    form: {
      ticketGuid: "",
      horarioGuid: "",
      cantidad: 1,
    },
    billing: {
      nombre: "",
      apellido: "",
      correo: "",
      telefono: "",
    },
    fallback: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
  }),
  computed: {
    loggedIn() {
      return isAuthenticated();
    },
    selectedTicket() {
      return this.tickets.find((t) => t.guid === this.form.ticketGuid);
    },
    selectedHorario() {
      return this.horarios.find((h) => h.guid === this.form.horarioGuid);
    },
    total() {
      return Number(this.form.cantidad || 0) * Number(this.selectedTicket?.precio || 0);
    },
    mainImage() {
      const candidates = [this.atraccion.imagenUrl, this.atraccion.urlImagen, ...(this.atraccion.imagenes || [])];
      return candidates.find((url) => typeof url === "string" && /^https?:\/\//i.test(url.trim())) || this.fallback;
    },
  },
  mounted() {
    this.load();
  },
  methods: {
    money(value) {
      return Number(value || 0).toFixed(2);
    },
    goLogin() {
      this.$router.push({ path: "/login", query: { redirect: this.$route.fullPath } });
    },
    goRegister() {
      this.$router.push({ path: "/login", query: { mode: "register", redirect: this.$route.fullPath } });
    },
    async hydrateCliente() {
      const user = getStoredUser();
      if (!user?.token) return;
      if (user.clienteGuid) {
        this.clienteGuid = user.clienteGuid;
        this.cliente = user.cliente || null;
        if (this.cliente) this.prefillBilling(this.cliente);
        return;
      }
      if (!user.usuarioGuid) return;

      try {
        const response = await clientesApi.get(`/clientes/usuario/${user.usuarioGuid}`);
        const cliente = response.data?.data ?? response.data;
        this.cliente = cliente;
        this.clienteGuid = cliente?.guid || "";
        this.prefillBilling(cliente);
        setStoredUser({ ...user, clienteGuid: this.clienteGuid, cliente });
      } catch {
        this.clienteGuid = "";
      }
    },
    async load() {
      this.loading = true;
      this.error = "";
      try {
        const guid = this.$route.params.guid;
        const [detalle, tickets] = await Promise.all([
          obtenerAtraccionDetalle(guid),
          obtenerTicketsAtraccion(guid),
          this.hydrateCliente(),
        ]);
        this.atraccion = detalle.data ?? detalle;
        this.tickets = dataOf(tickets);
      } catch (e) {
        this.error = e.userMessage || "No se pudo cargar el detalle.";
      } finally {
        this.loading = false;
      }
    },
    async loadHorarios() {
      this.form.horarioGuid = "";
      this.horarios = [];
      if (!this.form.ticketGuid) return;

      try {
        const response = await obtenerHorariosTicket(this.form.ticketGuid);
        this.horarios = dataOf(response).filter((h) => Number(h.cuposDisponibles || 0) > 0);
      } catch (e) {
        this.formError = e.userMessage || "No se pudieron cargar los horarios.";
      }
    },
    validate() {
      if (!this.loggedIn) return "Inicia sesion o registrate para reservar.";
      if (!this.clienteGuid) return "No encontramos tu perfil de cliente. Registrate como cliente para reservar.";
      if (!this.form.ticketGuid) return "Selecciona un ticket.";
      if (!this.form.horarioGuid) return "Selecciona un horario.";
      if (Number(this.form.cantidad) < 1) return "La cantidad debe ser minimo 1.";
      if (this.selectedHorario && Number(this.form.cantidad) > Number(this.selectedHorario.cuposDisponibles)) {
        return "La cantidad supera los cupos disponibles.";
      }
      return "";
    },
    prefillBilling(cliente) {
      if (!cliente) return;
      this.billing.nombre = cliente.razonSocial || cliente.nombres || this.billing.nombre;
      this.billing.apellido = cliente.apellidos || this.billing.apellido;
      this.billing.correo = cliente.correo || this.billing.correo;
      this.billing.telefono = cliente.telefono || this.billing.telefono;
    },
    validateBilling() {
      if (!this.createdReserva?.guid) return "No se encontro la reserva para facturar.";
      if (!this.billing.nombre) return "Ingresa el nombre o razon social.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.billing.correo || "")) return "Ingresa un correo valido.";
      return "";
    },
    async reservar() {
      this.formError = this.validate();
      if (this.formError) return;

      this.saving = true;
      this.ok = "";
      try {
        const payload = {
          clienteGuid: this.clienteGuid,
          horarioGuid: this.form.horarioGuid,
          origenCanal: "WEB",
          detalles: [
            {
              ticketGuid: this.form.ticketGuid,
              cantidad: Number(this.form.cantidad),
              precioUnitario: Number(this.selectedTicket?.precio || 0),
            },
          ],
        };

        const response = await crearReserva(payload);
        const reserva = response.data ?? response;
        this.createdReserva = reserva;
        this.ok = `Reserva creada correctamente. Codigo: ${reserva.codigo || reserva.guid}`;
        if (this.cliente) this.prefillBilling(this.cliente);
      } catch (e) {
        this.formError = e.userMessage || "No se pudo crear la reserva.";
      } finally {
        this.saving = false;
      }
    },
    async generarFactura() {
      this.billingError = this.validateBilling();
      if (this.billingError) return;

      this.billingSaving = true;
      try {
        const payload = {
          reservaGuid: this.createdReserva.guid,
          total: Number(this.createdReserva.total || this.total || 0),
          observacion: `Factura generada desde la reserva ${this.createdReserva.codigo || ""}`.trim(),
          origenCanal: "WEB",
          datosFacturacion: {
            nombre: this.billing.nombre,
            apellido: this.billing.apellido || null,
            correo: this.billing.correo,
            telefono: this.billing.telefono || null,
          },
        };

        const response = await crearFactura(payload);
        const factura = response.data ?? response;
        this.facturaOk = `Factura generada correctamente. Numero: ${factura.numero || factura}`;
      } catch (e) {
        this.billingError = e.userMessage || "No se pudo generar la factura.";
      } finally {
        this.billingSaving = false;
      }
    },
  },
};
</script>

<style scoped>
.page { min-height: 100vh; background: var(--sand); }
.wrap { max-width: 1180px; margin: auto; padding: 28px; }
.back { border: 0; background: white; border-radius: var(--radius-sm); padding: 10px 14px; margin-bottom: 18px; cursor: pointer; }
.detail { display: grid; grid-template-columns: 1.1fr .9fr; gap: 24px; }
.cover { min-height: 620px; background-size: cover; background-position: center; border-radius: var(--radius-lg); box-shadow: var(--shadow-soft); }
.info { background: white; border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 28px; box-shadow: var(--shadow-soft); }
.eyebrow { color: var(--terracotta); text-transform: uppercase; letter-spacing: .12em; font-size: 12px; font-weight: 800; }
.info h1 { font-family: var(--font-display); font-size: 46px; line-height: 1.05; margin: 8px 0 14px; }
.desc { color: rgba(26,22,18,.65); }
.meta { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0; }
.meta span, .chips span { background: var(--sand-dark); border-radius: 999px; padding: 7px 10px; font-size: 12px; }
.chips { display: flex; gap: 8px; flex-wrap: wrap; margin: 16px 0; }
.booking, .billing, .auth-gate { margin-top: 20px; border-top: 1px solid var(--border); padding-top: 20px; display: grid; gap: 10px; }
.auth-gate p { color: rgba(26,22,18,.65); }
.billing p { color: rgba(26,22,18,.65); margin: 0; }
.gate-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.booking h2, .auth-gate h2 { font-size: 22px; }
.booking label { font-weight: 800; font-size: 13px; }
input, select { border: 1.5px solid var(--border-strong); border-radius: var(--radius-sm); padding: 11px 12px; }
.total { display: flex; justify-content: space-between; align-items: center; background: var(--sand); border-radius: var(--radius-md); padding: 14px; }
.total strong { font-size: 26px; }
.btn { border: 0; background: var(--ink); color: white; border-radius: var(--radius-sm); padding: 13px 16px; font-weight: 800; cursor: pointer; }
.btn.secondary { background: var(--sand-dark); color: var(--ink); }
.btn:disabled { opacity: .6; cursor: not-allowed; }
.notice { padding: 12px 14px; border-radius: var(--radius-sm); }
.bad { background: #fdebea; color: #8c2922; }
.ok  { background: #e9f5ec; color: #285c35; }
.loading { text-align: center; padding: 50px; }
@media (max-width: 900px) {
  .detail { grid-template-columns: 1fr; }
  .cover  { min-height: 300px; }
  .info h1 { font-size: 34px; }
}
</style>
