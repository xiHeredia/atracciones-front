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

          <form v-else-if="!showPayment && !facturaOk" class="booking" @submit.prevent="createdReserva ? abrirPasarela() : reservar()">
            <h2>Crear reserva</h2>

            <label>Ticket</label>
            <select v-model="form.ticketGuid" :disabled="Boolean(createdReserva)" @change="loadHorarios">
              <option value="">Seleccione ticket</option>
              <option v-for="t in tickets" :key="t.guid" :value="t.guid">
                {{ t.titulo }} - ${{ money(t.precio) }} - cupos {{ t.cuposDisponibles }}
              </option>
            </select>

            <label>Horario</label>
            <select v-model="form.horarioGuid" :disabled="Boolean(createdReserva)">
              <option value="">Seleccione horario</option>
              <option v-for="h in horarios" :key="h.guid" :value="h.guid">
                {{ h.fecha }} {{ h.horaInicio }} - {{ h.horaFin || 'sin fin' }} / cupos {{ h.cuposDisponibles }}
              </option>
            </select>

            <label>Cantidad</label>
            <input v-model.number="form.cantidad" type="number" min="1" :disabled="Boolean(createdReserva)" />

            <div class="total">
              <span>Total estimado</span>
              <strong>${{ money(total) }}</strong>
            </div>

            <div v-if="formError" class="notice bad">{{ formError }}</div>
            <div v-if="ok" class="notice ok">{{ ok }}</div>

            <button v-if="!createdReserva" class="btn" :disabled="saving">{{ saving ? 'Reservando...' : 'Confirmar reserva' }}</button>
            <button v-else type="button" class="btn" @click="abrirPasarela">Confirmar pago</button>
          </form>

          <section v-if="createdReserva && showPayment && !facturaOk" class="payment-panel">
            <div class="payment-heading">
              <p class="eyebrow">Pago simulado</p>
              <h2>Confirma tu pago</h2>
              <p>Tu reserva ya fue creada. Al confirmar el pago se emitira y guardara la factura con tus datos.</p>
            </div>

            <div class="payment-summary">
              <div>
                <span>Reserva</span>
                <strong>{{ reservaCodigo }}</strong>
              </div>
              <div>
                <span>Total</span>
                <strong>${{ money(createdReserva.total || createdReserva.rev_total || total) }}</strong>
              </div>
            </div>

            <form class="payment-form" @submit.prevent="confirmarPago">
              <div class="payment-card">
                <span>Tarjeta de prueba</span>
                <strong>{{ maskedCard }}</strong>
                <small>{{ payment.cardName || 'Nombre del titular' }}</small>
              </div>

              <label>Nombre en la tarjeta</label>
              <input v-model.trim="payment.cardName" type="text" placeholder="Nombre del titular" />

              <label>Numero de tarjeta</label>
              <input
                v-model="payment.cardNumber"
                type="text"
                inputmode="numeric"
                maxlength="19"
                placeholder="4242 4242 4242 4242"
                @input="formatCardNumber"
              />

              <div class="form-row">
                <div>
                  <label>Vencimiento</label>
                  <input v-model="payment.expiration" type="text" inputmode="numeric" maxlength="5" placeholder="MM/AA" @input="formatExpiration" />
                </div>
                <div>
                  <label>CVV</label>
                  <input v-model="payment.cvv" type="password" inputmode="numeric" maxlength="4" placeholder="123" />
                </div>
              </div>

              <div class="billing-title">
                <h3>Datos para facturacion</h3>
                <p>Estos datos se guardaran junto a la factura emitida.</p>
              </div>

              <label>Nombre o razon social</label>
              <input v-model.trim="billing.nombre" type="text" />

              <label>Apellido</label>
              <input v-model.trim="billing.apellido" type="text" />

              <label>Correo</label>
              <input v-model.trim="billing.correo" type="email" />

              <label>Telefono</label>
              <input v-model.trim="billing.telefono" type="tel" />

              <div v-if="billingError" class="notice bad">{{ billingError }}</div>
              <button class="btn" :disabled="paymentSaving">{{ paymentSaving ? 'Procesando pago...' : 'Pagar y emitir factura' }}</button>
            </form>
          </section>

        </div>
      </section>
    </main>

    <div v-if="facturaOk" class="receipt-backdrop" @click.self="cerrarComprobante">
      <section class="receipt-modal" role="dialog" aria-modal="true" aria-labelledby="receipt-title">
        <button class="modal-close" type="button" aria-label="Cerrar comprobante" @click="cerrarComprobante">x</button>
        <div class="success-mark">OK</div>
        <h2 id="receipt-title">Pago confirmado</h2>
        <p>Tu factura ha sido emitida correctamente y registrada con los datos de facturacion ingresados.</p>

        <div class="invoice-number">
          <span>Numero de factura</span>
          <strong>{{ facturaNumero }}</strong>
        </div>

        <div class="receipt-grid">
          <div>
            <span>Codigo de reserva</span>
            <strong>{{ facturaReservaCodigo }}</strong>
          </div>
          <div>
            <span>Estado factura</span>
            <strong class="status-pill">{{ facturaEstado }}</strong>
          </div>
          <div>
            <span>Total pagado</span>
            <strong>${{ money(facturaTotal) }}</strong>
          </div>
          <div>
            <span>Fecha de emision</span>
            <strong>{{ facturaFechaEmision }}</strong>
          </div>
        </div>

        <button class="btn receipt-primary" type="button" @click="$router.push('/cliente')">Volver al listado de atracciones</button>
        <button class="btn secondary" type="button" @click="cerrarComprobante">Cerrar comprobante</button>
      </section>
    </div>
  </div>
</template>

<script>
import AppNav from "../../components/AppNav.vue";
import { clientesApi, getStoredUser, isAuthenticated } from "../../services/api";
import { setStoredUser } from "../../services/session";
import {
  confirmarPagoReserva,
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
    paymentSaving: false,
    error: "",
    formError: "",
    billingError: "",
    ok: "",
    facturaOk: "",
    facturaData: null,
    showPayment: false,
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
    payment: {
      cardName: "",
      cardNumber: "",
      expiration: "",
      cvv: "",
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
    createdReservaGuid() {
      return this.createdReserva?.guid || this.createdReserva?.rev_guid || this.createdReserva?.reservaGuid || "";
    },
    reservaCodigo() {
      return this.createdReserva?.codigo || this.createdReserva?.rev_codigo || this.createdReservaGuid || "Reserva";
    },
    maskedCard() {
      const digits = (this.payment.cardNumber || "").replace(/\D/g, "");
      if (!digits) return "#### #### #### ####";
      const lastFour = digits.slice(-4).padStart(4, "#");
      return `#### #### #### ${lastFour}`;
    },
    facturaNumero() {
      return this.facturaData?.fac_numero || this.facturaData?.numero || this.facturaData?.facturaNumero || "Generada";
    },
    facturaReservaCodigo() {
      return this.facturaData?.rev_codigo || this.facturaData?.reservaCodigo || this.reservaCodigo;
    },
    facturaTotal() {
      return this.facturaData?.total || this.createdReserva?.total || this.createdReserva?.rev_total || this.total || 0;
    },
    facturaEstado() {
      const estado = this.facturaData?.estado || this.facturaData?.fac_estado || "Emitida";
      if (String(estado).toUpperCase() === "A") return "Activa";
      if (String(estado).toUpperCase() === "I") return "Inactiva";
      if (String(estado).toUpperCase() === "C") return "Cancelada";
      return estado;
    },
    facturaFechaEmision() {
      const raw =
        this.facturaData?.fecha_emision ||
        this.facturaData?.fechaEmision ||
        this.facturaData?.fac_fecha_emision ||
        new Date().toISOString();
      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) return String(raw);
      return date.toLocaleString("es-EC", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
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
      if (!this.payment.cardName) {
        this.payment.cardName = [cliente.nombres, cliente.apellidos].filter(Boolean).join(" ") || this.billing.nombre;
      }
    },
    formatCardNumber() {
      const digits = (this.payment.cardNumber || "").replace(/\D/g, "").slice(0, 16);
      this.payment.cardNumber = digits.replace(/(.{4})/g, "$1 ").trim();
    },
    formatExpiration() {
      const digits = (this.payment.expiration || "").replace(/\D/g, "").slice(0, 4);
      this.payment.expiration = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
    },
    validateBilling() {
      const cardDigits = (this.payment.cardNumber || "").replace(/\D/g, "");
      if (!this.createdReservaGuid) return "No se encontro la reserva para facturar.";
      if (!this.payment.cardName) return "Ingresa el nombre de la tarjeta.";
      if (cardDigits.length < 12) return "Ingresa un numero de tarjeta de prueba valido.";
      if (!/^\d{2}\/\d{2}$/.test(this.payment.expiration || "")) return "Ingresa el vencimiento en formato MM/AA.";
      if (!/^\d{3,4}$/.test(this.payment.cvv || "")) return "Ingresa el CVV.";
      if (!this.billing.nombre) return "Ingresa el nombre o razon social.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.billing.correo || "")) return "Ingresa un correo valido.";
      return "";
    },
    abrirPasarela() {
      this.formError = "";
      this.billingError = "";
      if (!this.createdReservaGuid) {
        this.formError = "Primero crea la reserva para continuar al pago.";
        return;
      }
      this.showPayment = true;
    },
    cerrarComprobante() {
      this.facturaOk = "";
      this.facturaData = null;
      this.createdReserva = null;
      this.showPayment = false;
      this.ok = "";
      this.form.ticketGuid = "";
      this.form.horarioGuid = "";
      this.form.cantidad = 1;
      this.horarios = [];
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
        this.showPayment = false;
        this.ok = `Reserva creada correctamente. Codigo: ${reserva.codigo || reserva.rev_codigo || reserva.guid || reserva.rev_guid}`;
        if (this.cliente) this.prefillBilling(this.cliente);
      } catch (e) {
        this.formError = e.userMessage || "No se pudo crear la reserva.";
      } finally {
        this.saving = false;
      }
    },
    async confirmarPago() {
      this.billingError = this.validateBilling();
      if (this.billingError) return;

      this.paymentSaving = true;
      try {
        const payload = {
          nombre_receptor: this.billing.nombre,
          apellido_receptor: this.billing.apellido || null,
          correo_receptor: this.billing.correo,
          telefono_receptor: this.billing.telefono || null,
          observacion: `Pago simulado desde el front para reserva ${this.reservaCodigo}`.trim(),
        };

        const response = await confirmarPagoReserva(this.createdReservaGuid, payload);
        const factura = response.data ?? response;
        this.facturaData = factura;
        this.facturaOk = `Factura emitida correctamente`;
        this.ok = "";
      } catch (e) {
        this.billingError = e.userMessage || "No se pudo confirmar el pago.";
      } finally {
        this.paymentSaving = false;
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
.booking, .auth-gate, .payment-panel { margin-top: 20px; border-top: 1px solid var(--border); padding-top: 20px; display: grid; gap: 10px; }
.auth-gate p { color: rgba(26,22,18,.65); }
.gate-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.booking h2, .auth-gate h2, .payment-heading h2 { font-size: 22px; margin: 0; }
.payment-heading p, .billing-title p { color: rgba(26,22,18,.65); margin: 4px 0 0; }
.payment-summary, .receipt-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.payment-summary div, .receipt-grid div { background: var(--sand); border-radius: var(--radius-md); padding: 12px; }
.payment-summary span, .receipt-grid span { display: block; color: rgba(26,22,18,.58); font-size: 12px; margin-bottom: 4px; }
.payment-summary strong, .receipt-grid strong { font-size: 18px; overflow-wrap: anywhere; }
.payment-form { display: grid; gap: 10px; }
.payment-card { background: #201711; color: white; border-radius: var(--radius-md); padding: 18px; min-height: 120px; display: grid; align-content: space-between; box-shadow: var(--shadow-soft); }
.payment-card span, .payment-card small { color: rgba(255,255,255,.72); }
.payment-card strong { font-size: 22px; letter-spacing: .08em; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.form-row > div { display: grid; gap: 10px; }
.billing-title { margin-top: 8px; }
.billing-title h3 { margin: 0; font-size: 18px; }
.booking label, .payment-form label { font-weight: 800; font-size: 13px; }
input, select { border: 1.5px solid var(--border-strong); border-radius: var(--radius-sm); padding: 11px 12px; }
input:disabled, select:disabled { background: #f7f3eb; color: rgba(26,22,18,.72); cursor: not-allowed; }
.total { display: flex; justify-content: space-between; align-items: center; background: var(--sand); border-radius: var(--radius-md); padding: 14px; }
.total strong { font-size: 26px; }
.btn { border: 0; background: var(--ink); color: white; border-radius: var(--radius-sm); padding: 13px 16px; font-weight: 800; cursor: pointer; }
.btn.secondary { background: var(--sand-dark); color: var(--ink); }
.btn:disabled { opacity: .6; cursor: not-allowed; }
.notice { padding: 12px 14px; border-radius: var(--radius-sm); }
.bad { background: #fdebea; color: #8c2922; }
.ok  { background: #e9f5ec; color: #285c35; }
.loading { text-align: center; padding: 50px; }
.receipt-backdrop { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; background: rgba(26,22,18,.58); padding: 22px; }
.receipt-modal { position: relative; width: min(520px, 100%); background: white; border-radius: 18px; padding: 30px; box-shadow: 0 30px 90px rgba(26,22,18,.28); text-align: center; }
.modal-close { position: absolute; top: 16px; right: 18px; border: 0; background: transparent; color: rgba(26,22,18,.6); font-size: 22px; line-height: 1; cursor: pointer; }
.success-mark { width: 58px; height: 58px; border-radius: 50%; background: #3ba86b; color: white; display: grid; place-items: center; margin: 0 auto 12px; font-weight: 900; box-shadow: 0 12px 30px rgba(59,168,107,.28); }
.receipt-modal h2 { font-family: var(--font-display); font-size: 34px; margin: 6px 0 8px; }
.receipt-modal p { max-width: 390px; margin: 0 auto 18px; color: rgba(26,22,18,.65); }
.invoice-number { border: 1.5px dashed #cdbb86; background: #fff9dd; border-radius: var(--radius-md); padding: 14px; margin: 14px 0; }
.invoice-number span { display: block; color: rgba(26,22,18,.55); font-size: 11px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
.invoice-number strong { color: #9b5b4f; font-size: 18px; letter-spacing: .08em; overflow-wrap: anywhere; }
.receipt-modal .receipt-grid { text-align: left; margin-bottom: 16px; }
.status-pill { display: inline-block; width: fit-content; background: #dff5e8; color: #277248; border-radius: 999px; padding: 4px 10px; font-size: 13px; }
.receipt-primary { width: 100%; background: #9b5b4f; margin-bottom: 10px; }
.receipt-modal .btn.secondary { width: 100%; background: white; border: 1.5px solid #9b5b4f; color: #9b5b4f; }
@media (max-width: 900px) {
  .detail { grid-template-columns: 1fr; }
  .cover  { min-height: 300px; }
  .info h1 { font-size: 34px; }
  .payment-summary, .receipt-grid, .form-row { grid-template-columns: 1fr; }
  .receipt-modal { padding: 24px 18px; }
}
</style>
