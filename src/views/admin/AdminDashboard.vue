<template>
  <div class="page">
    <AppNav :slots="true">
      <template #tabs>
        <div class="tabs">
          <button v-for="m in modules" :key="m.key" :class="['tab', {active: active === m.key}]" @click="selectModule(m.key)">{{ m.label }}</button>
        </div>
      </template>
    </AppNav>

    <main class="wrap">
      <section class="hero-card">
        <div>
          <p class="eyebrow">Panel de administración</p>
          <h1>{{ current.label }}</h1>
          <p>{{ current.help }}</p>
        </div>
        <div class="hero-actions">
          <button class="btn secondary" @click="loadAll">Actualizar</button>
          <button v-if="current.canCreate" class="btn" @click="openCreate">Nuevo registro</button>
        </div>
      </section>

      <section class="summary-grid">
        <div class="summary"><strong>{{ rows.length }}</strong><span>Registros</span></div>
        <div class="summary"><strong>{{ filteredRows.length }}</strong><span>Filtrados</span></div>
        <div class="summary"><strong>{{ current.resource }}</strong><span>Endpoint</span></div>
      </section>

      <!-- Toast de éxito -->
      <transition name="toast">
        <div v-if="notice" class="toast toast-ok">
          <span class="toast-icon">✓</span>
          <span>{{ notice }}</span>
        </div>
      </transition>

      <!-- Banner de error general -->
      <transition name="fade">
        <div v-if="error" class="notice bad">
          <span class="notice-icon">⚠</span>
          <div>
            <strong>Ocurrió un problema</strong>
            <p>{{ error }}</p>
          </div>
          <button class="notice-close" @click="error=''">×</button>
        </div>
      </transition>

      <section class="panel">
        <div class="toolbar">
          <input v-model="search" class="search" placeholder="Buscar en la tabla..." />
          <select v-model="active" class="select" @change="selectModule(active)">
            <option v-for="m in modules" :key="m.key" :value="m.key">{{ m.label }}</option>
          </select>
        </div>

        <!-- Búsqueda especial para Usuario-Rol -->
        <div v-if="current.specialLoad === 'byUsuario'" class="special-search">
          <div class="rel-select-wrap" style="flex:1">
            <select
              v-if="lookupCache.usuarios && lookupCache.usuarios.length"
              v-model="usuarioSearch"
              class="search"
              @change="usuarioSearchError=''"
            >
              <option value="">— Todos los usuarios (ver todos los roles) —</option>
              <option v-for="u in lookupCache.usuarios" :key="u.value" :value="u.value">
                {{ u.label }}
              </option>
            </select>
            <input v-else v-model="usuarioSearch" class="search" type="number" min="1" placeholder="ID del usuario (opcional, vacío = todos)..." />
          </div>
          <button class="btn" @click="loadAll">Filtrar</button>
          <p v-if="usuarioSearchError" class="field-hint error" style="width:100%">{{ usuarioSearchError }}</p>
        </div>

        <div v-if="loading" class="loading">
          <div class="spinner"></div>
          <span>Cargando información...</span>
        </div>
        <div v-else-if="filteredRows.length === 0" class="empty">
          <span class="empty-icon">📋</span>
          <p>No hay datos para mostrar.</p>
          <p v-if="search" class="empty-hint">Intenta con otro término de búsqueda.</p>
        </div>
        <div v-else class="table-scroll">
          <table>
            <thead>
              <tr>
                <th v-for="field in current.table" :key="field">{{ label(field) }}</th>
                <th class="right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in filteredRows" :key="rowKey(row)">
                <td v-for="field in current.table" :key="field">{{ formatValue(row[field]) }}</td>
                <td class="right actions">
                  <button v-if="current.canEdit" class="mini" @click="openEdit(row)">Editar</button>
                  <button v-if="current.cancel" class="mini warn" @click="openCancel(row)">Cancelar</button>
                  <button v-if="current.inhabilitar" class="mini warn" @click="openDisable(row)">Inhabilitar</button>
                  <button v-if="current.canDelete" class="mini danger" @click="confirmDelete(row)">Eliminar</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>

    <!-- Modal: Crear / Editar -->
    <div v-if="modal" class="modal-backdrop" @click.self="handleModalClose">
      <form class="modal" @submit.prevent="saveRow" novalidate>
        <div class="modal-head">
          <h2>{{ editing ? 'Editar' : 'Crear' }} {{ current.single }}</h2>
          <button type="button" class="x" @click="handleModalClose">×</button>
        </div>

        <!-- Indicador de carga de lookups -->
        <div v-if="lookupsLoading" class="lookups-loading">
          <div class="spinner"></div>
          <span>Cargando opciones...</span>
        </div>

        <div class="form-grid" :class="{ 'loading-blur': lookupsLoading }">
          <div
            v-for="field in current.form"
            :key="field.name"
            class="field"
            :class="{full: field.type === 'textarea' || field.type === 'relselect', 'has-error': fieldErrors[field.name]}"
          >
            <label :for="'f-'+field.name">
              {{ field.label }}
              <span v-if="field.required" class="req" title="Campo obligatorio">*</span>
            </label>

            <!-- Dropdown relacional (reemplaza campos *Id) -->
            <div v-if="field.type === 'relselect'" class="rel-select-wrap">
              <select
                :id="'f-'+field.name"
                v-model="form[field.name]"
                :class="{ 'input-error': fieldErrors[field.name] }"
                @change="clearFieldError(field.name)"
              >
                <option value="">— Selecciona {{ field.label.toLowerCase() }} —</option>
                <option
                  v-for="opt in (lookupCache[field.lookupKey] || [])"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </option>
              </select>
              <span v-if="!(lookupCache[field.lookupKey] || []).length && !lookupsLoading" class="rel-hint">
                ⚠ Sin registros disponibles
              </span>
            </div>

            <textarea
              v-else-if="field.type === 'textarea'"
              :id="'f-'+field.name"
              v-model.trim="form[field.name]"
              rows="3"
              :class="{ 'input-error': fieldErrors[field.name] }"
              @input="clearFieldError(field.name)"
            ></textarea>

            <select
              v-else-if="field.type === 'select'"
              :id="'f-'+field.name"
              v-model="form[field.name]"
              :class="{ 'input-error': fieldErrors[field.name] }"
              @change="clearFieldError(field.name)"
            >
              <option value="">— Seleccione una opción —</option>
              <option v-for="op in field.options" :key="op" :value="op">{{ op }}</option>
            </select>

            <input
              v-else
              :id="'f-'+field.name"
              v-model="form[field.name]"
              :type="field.type || 'text'"
              :step="field.step || undefined"
              :min="field.type === 'number' ? 0 : undefined"
              :readonly="field.readonly || false"
              :inputmode="field.inputmode || undefined"
              :pattern="field.pattern || undefined"
              :class="{ 'input-error': fieldErrors[field.name], 'input-readonly': field.readonly }"
              :placeholder="fieldPlaceholder(field)"
              @input="clearFieldError(field.name); onFieldInput(field.name, $event)"
            />

            <p v-if="fieldErrors[field.name]" class="field-hint error">
              <span>⚠</span> {{ fieldErrors[field.name] }}
            </p>
            <p v-else-if="field.hint" class="field-hint">{{ field.hint }}</p>
          </div>
        </div>

        <!-- Error general del formulario -->
        <div v-if="formError" class="notice bad form-notice">
          <span class="notice-icon">⚠</span>
          <div>
            <strong>No se pudo guardar</strong>
            <p>{{ formError }}</p>
          </div>
        </div>

        <!-- Nota especial reservas -->
        <div v-if="active === 'reservas'" class="info-box">
          <span>ℹ</span> El <strong>IVA (15%)</strong> y el <strong>Total</strong> se calculan automáticamente al ingresar el Subtotal.
        </div>
        <div v-if="active === 'reservas' && isDuplicateReserva() && !editing" class="info-box info-warn">
          <span>⚠</span> Ya existe una reserva para este <strong>cliente</strong> en este <strong>horario</strong>. Revisa antes de guardar.
        </div>

        <div class="modal-actions">
          <button type="button" class="btn secondary" @click="handleModalClose">Cancelar</button>
          <button class="btn" :disabled="saving || lookupsLoading">
            <span v-if="saving" class="spinner-sm"></span>
            {{ saving ? 'Guardando...' : (editing ? 'Actualizar' : 'Crear registro') }}
          </button>
        </div>
      </form>
    </div>

    <!-- Modal: Motivo (cancelar / inhabilitar) -->
    <div v-if="reasonModal" class="modal-backdrop" @click.self="reasonModal=null">
      <form class="modal small" @submit.prevent="sendReason" novalidate>
        <div class="modal-head">
          <h2>{{ reasonTitle }}</h2>
          <button type="button" class="x" @click="reasonModal=null">×</button>
        </div>
        <div class="field full">
          <label for="motivo-textarea">Motivo <span class="req">*</span></label>
          <textarea
            id="motivo-textarea"
            v-model.trim="reason"
            rows="4"
            placeholder="Describe el motivo detalladamente (mínimo 10 caracteres)..."
            :class="{ 'input-error': reasonError }"
            @input="reasonError=''"
          ></textarea>
          <p v-if="reasonError" class="field-hint error"><span>⚠</span> {{ reasonError }}</p>
          <p class="field-hint">Este motivo quedará registrado en el sistema.</p>
        </div>
        <div v-if="formError" class="notice bad form-notice">
          <span class="notice-icon">⚠</span>
          <div><strong>No se pudo completar la acción</strong><p>{{ formError }}</p></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" @click="reasonModal=null">Cancelar</button>
          <button class="btn btn-warn">Confirmar</button>
        </div>
      </form>
    </div>

    <!-- Modal: Confirmación de eliminación -->
    <div v-if="deleteConfirm" class="modal-backdrop" @click.self="deleteConfirm=null">
      <div class="modal small modal-confirm">
        <div class="confirm-icon">🗑</div>
        <h2>¿Eliminar registro?</h2>
        <p>Esta acción <strong>no se puede deshacer</strong>. El registro será eliminado permanentemente.</p>
        <div class="modal-actions">
          <button class="btn secondary" @click="deleteConfirm=null">Cancelar</button>
          <button class="btn btn-danger" :disabled="deleting" @click="executeDelete">
            <span v-if="deleting" class="spinner-sm"></span>
            {{ deleting ? 'Eliminando...' : 'Sí, eliminar' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import AppNav from "../../components/AppNav.vue";
import { list, create, update, remove, patch } from "../../services/crudService";
import { apiFor } from "../../services/api";

// Helper para campo texto/número normal
const f  = (name, label, type = "text",      required = true, extra = {}) => ({ name, label, type, required, ...extra });
// Helper para dropdown relacional (carga datos del API)
const rs = (name, label, lookupKey,          required = true, extra = {}) => ({ name, label, type: "relselect", lookupKey, required, ...extra });

/*
 * lookupKey  →  qué endpoint GET se llama y cómo se muestra cada opción
 * La configuración de lookups está en LOOKUP_CONFIG más abajo.
 */

const modules = [
  {
    key:"atracciones", label:"Atracciones", single:"atracción", resource:"atracciones",
    help:"Crea, edita y elimina atracciones turísticas.",
    table:["id","nombre","destinoId","destinoNombre","precioReferencia"],
    form:[
      rs("destinoId",       "Destino",           "destinos"),
      f ("nombre",          "Nombre"),
      f ("descripcion",     "Descripción",        "textarea", false),
      f ("precioReferencia","Precio referencia",  "number",   false, {step:"0.01", hint:"Valor en dólares (ej: 25.00)"}),
    ],
    canCreate:true, canEdit:true, canDelete:true,
  },
  {
    key:"destinos", label:"Destinos", single:"destino", resource:"destinos",
    help:"Administra destinos y país asociado.",
    table:["id","nombre","pais","imagenUrl"],
    form:[
      f("nombre",   "Nombre"),
      f("pais",     "País"),
      f("imagenUrl","URL de imagen","url", false, {hint:"Debe iniciar con https://"}),
    ],
    canCreate:true, canEdit:true, canDelete:true,
  },
  {
    key:"tickets", label:"Tickets", single:"ticket", resource:"tickets",
    help:"Administra tickets, precios, cupos y participantes.",
    table:["id","atraccionId","atraccionNombre","titulo","precio","tipoParticipante","cuposDisponibles"],
    form:[
      rs("atraccionId",      "Atracción",           "atracciones"),
      f ("titulo",           "Título"),
      f ("precio",           "Precio",              "number", true, {step:"0.01", hint:"Valor en dólares"}),
      f ("tipoParticipante", "Tipo participante",   "text",   true, {hint:"Ej: Adulto, Niño, Estudiante"}),
      f ("capacidadMaxima",  "Capacidad máxima",    "number"),
      f ("cuposDisponibles", "Cupos disponibles",   "number", true, {hint:"Debe ser ≤ capacidad máxima"}),
    ],
    canCreate:true, canEdit:true, canDelete:true,
  },
  {
    key:"horarios", label:"Horarios", single:"horario", resource:"horarios",
    help:"Gestiona fechas, horas y cupos de cada ticket.",
    table:["id","ticketId","fecha","horaInicio","horaFin","cuposDisponibles"],
    form:[
      rs("ticketId",         "Ticket",              "tickets"),
      f ("fecha",            "Fecha",               "date"),
      f ("horaInicio",       "Hora inicio",         "time"),
      f ("horaFin",          "Hora fin",            "time",   true, {hint:"Debe ser posterior a la hora de inicio"}),
      f ("cuposDisponibles", "Cupos disponibles",   "number"),
    ],
    canCreate:true, canEdit:true, canDelete:true,
  },
  {
    key:"reservas", label:"Reservas", single:"reserva", resource:"reservas",
    help:"Consulta, edita o cancela reservas.",
    table:["id","codigo","clienteId","horarioId","atraccionNombre","estado","subtotal","valorIva","total"],
    form:[
      rs("clienteId",   "Cliente",        "clientes"),
      rs("horarioId",   "Horario",        "horarios"),
      f ("subtotal",    "Subtotal",       "number", true, {step:"0.01", hint:"Monto sin IVA — IVA y Total se calculan solos"}),
      f ("valorIva",    "IVA",            "number", true, {step:"0.01", hint:"Se calcula automáticamente (15%)", readonly:true}),
      f ("total",       "Total",          "number", true, {step:"0.01", hint:"Se calcula automáticamente", readonly:true}),
      f ("origenCanal", "Origen canal",   "select", true, {options:["WEB","ADMIN","APP"]}),
    ],
    canCreate:true, canEdit:true, cancel:true,
  },
  {
    key:"clientes", label:"Clientes", single:"cliente", resource:"clientes",
    help:"Administra datos principales de clientes.",
    table:["id","usuarioId","nombres","apellidos","correo","telefono"],
    form:[
      rs("usuarioId",            "Usuario del sistema",    "usuarios"),
      f ("tipoIdentificacion",   "Tipo identificación",    "select", true, {options:["CEDULA","RUC","PASAPORTE"]}),
      f ("numeroIdentificacion", "Número de identificación","tel",   true, {hint:"Ej: 1712345678 (solo números)", pattern:"[0-9]+", inputmode:"numeric"}),
      f ("nombres",              "Nombres"),
      f ("apellidos",            "Apellidos"),
      f ("razonSocial",          "Razón social",           "text",   false),
      f ("correo",               "Correo electrónico",     "email",  true,  {hint:"usuario@correo.com"}),
      f ("telefono",             "Teléfono",               "tel",    false, {hint:"Ej: 0991234567 (solo números)", pattern:"[0-9]+", inputmode:"numeric"}),
      f ("direccion",            "Dirección",              "text",   false),
    ],
    canCreate:true, canEdit:true, canDelete:true,
  },
  {
    key:"usuarios", label:"Usuarios", single:"usuario", resource:"usuarios",
    help:"Crea usuarios de acceso al sistema.",
    table:["id","login","roles"],
    form:[
      f("login",    "Login (nombre de usuario)", "text",     true, {hint:"Sin espacios, solo letras y números"}),
      f("password", "Contraseña",               "password", true, {hint:"Mínimo 6 caracteres"}),
    ],
    canCreate:true, canEdit:true, canDelete:true,
  },
  {
    key:"roles", label:"Roles", single:"rol", resource:"roles",
    help:"Gestiona roles ADMIN y CLIENTE.",
    table:["id","descripcion"],
    form:[f("descripcion","Descripción","text",true,{hint:"Ej: ADMIN, CLIENTE"})],
    canCreate:true, canEdit:true, canDelete:true,
  },
  {
    key:"usuarioRoles", label:"Usuario-Rol", single:"usuario-rol", resource:"usuarios-roles",
    help:"Asigna roles a usuarios. Se muestran todos los roles asignados. Usa el buscador para filtrar por usuario específico.",
    table:["usuarioRolId","usuarioId","rolId","rolDescripcion"],
    form:[
      rs("usuarioId","Usuario", "usuarios"),
      rs("rolId",    "Rol",     "roles"),
    ],
    canCreate:true, specialLoad:"byUsuario",
  },
  {
    key:"categorias", label:"Categorías", single:"categoría", resource:"categorias",
    help:"Administra categorías de atracciones.",
    table:["id","parentId","nombre"],
    form:[
      rs("parentId","Categoría padre",  "categorias", false, {hint:"Dejar vacío si es categoría raíz"}),
      f ("nombre",  "Nombre"),
    ],
    canCreate:true, canEdit:true, canDelete:true,
  },
  {
    key:"incluyes", label:"Incluye", single:"incluido", resource:"incluyes",
    help:"Catálogo de elementos incluidos en una atracción.",
    table:["id","descripcion"],
    form:[f("descripcion","Descripción","textarea")],
    canCreate:true, canEdit:true, canDelete:true,
  },
  {
    key:"idiomas", label:"Idiomas", single:"idioma", resource:"idiomas",
    help:"Catálogo de idiomas disponibles.",
    table:["id","nombre"],
    form:[f("nombre","Nombre","text",true,{hint:"Ej: Español, Inglés, Francés"})],
    canCreate:true, canEdit:true, canDelete:true,
  },
  {
    key:"imagenes", label:"Imágenes", single:"imagen", resource:"imagenes",
    help:"Catálogo de imágenes reutilizables.",
    table:["id","url","descripcion"],
    form:[
      f("url",        "URL de imagen","url",  true, {hint:"Debe iniciar con https://"}),
      f("descripcion","Descripción",  "text", false),
    ],
    canCreate:true, canEdit:true, canDelete:true,
  },
  {
    key:"resenias", label:"Reseñas", single:"reseña", resource:"resenias",
    help:"Administra opiniones de clientes.",
    table:["id","atraccionId","reservaId","rating","comentario"],
    form:[
      rs("atraccionId","Atracción",              "atracciones"),
      rs("reservaId",  "Reserva",                "reservas"),
      f ("rating",     "Calificación (1 a 5)",   "number", true, {hint:"Valor entre 1 y 5"}),
      f ("comentario", "Comentario",             "textarea"),
    ],
    canCreate:true, canEdit:true, canDelete:true,
  },
  {
    key:"facturas", label:"Facturas", single:"factura", resource:"facturas",
    help:"Administra facturas y anulaciones lógicas.",
    table:["id","reservaId","numero","total","origenCanal","facturacionNombre","facturacionCorreo"],
    form:[
      rs("reservaId",  "Reserva",          "reservas"),
      f ("numero",     "Número de factura","text",    false, {hint:"Opcional, se genera automáticamente"}),
      f ("total",      "Total",            "number",  true,  {step:"0.01"}),
      f ("observacion","Observación",      "textarea",false),
      f ("origenCanal","Origen canal",     "select",  true,  {options:["WEB","ADMIN","APP"]}),
      f ("facturacionNombre",   "Nombre facturacion",   "text",  true),
      f ("facturacionApellido", "Apellido facturacion", "text",  false),
      f ("facturacionCorreo",   "Correo facturacion",   "email", true, {hint:"facturacion@empresa.com"}),
      f ("facturacionTelefono", "Telefono facturacion", "tel",   false, {pattern:"[0-9]+", inputmode:"numeric"}),
    ],
    canCreate:true, canEdit:false, inhabilitar:true,
  },
  {
    key:"datosFacturacion", label:"Datos facturación", single:"dato de facturación", resource:"datos-facturacion",
    help:"Datos fiscales vinculados a facturas.",
    table:["id","facturaId","nombre","apellido","correo","telefono"],
    form:[
      rs("facturaId","Factura",            "facturas"),
      f ("nombre",   "Nombre"),
      f ("apellido", "Apellido"),
      f ("correo",   "Correo electrónico", "email", true, {hint:"facturacion@empresa.com"}),
      f ("telefono", "Teléfono",           "text",  false),
    ],
    canCreate:false, canEdit:false,
  },
];

// ─── Configuración de lookups ────────────────────────────────────────────────
// key        → nombre de la clave en lookupCache  (coincide con field.lookupKey)
// resource   → endpoint GET del backend
// valueField → campo que se envía al backend (normalmente "id")
// labelFn    → función que genera el texto visible en el dropdown
const LOOKUP_CONFIG = {
  destinos:    { resource: "destinos",   valueField: "id", labelFn: r => `#${r.id} — ${r.nombre} (${r.pais})` },
  atracciones: { resource: "atracciones",valueField: "id", labelFn: r => `#${r.id} — ${r.nombre}` },
  tickets:     { resource: "tickets",    valueField: "id", labelFn: r => `#${r.id} — ${r.titulo} (${r.tipoParticipante})` },
  horarios:    { resource: "horarios",   valueField: "id", labelFn: r => `#${r.id} — ${r.fecha} ${r.horaInicio}–${r.horaFin} (cupos: ${r.cuposDisponibles})` },
  clientes:    { resource: "clientes",   valueField: "id", labelFn: r => `#${r.id} — ${r.nombres} ${r.apellidos} (${r.correo})` },
  usuarios:    { resource: "usuarios",   valueField: "id", labelFn: r => `#${r.id} — ${r.login}` },
  roles:       { resource: "roles",      valueField: "id", labelFn: r => `#${r.id} — ${r.descripcion}` },
  categorias:  { resource: "categorias", valueField: "id", labelFn: r => `#${r.id} — ${r.nombre}` },
  reservas:    { resource: "reservas",   valueField: "id", labelFn: r => `#${r.id} — ${r.codigo} (${r.estado})` },
  facturas:    { resource: "facturas",   valueField: "id", labelFn: r => `#${r.id} — ${r.numero || 'S/N'} · $${r.total}` },
};

export default {
  components: { AppNav },

  data: () => ({
    modules,
    active: "atracciones",
    rows: [],
    loading: false,
    saving: false,
    deleting: false,
    search: "",
    modal: false,
    editing: null,
    form: {},
    fieldErrors: {},
    error: "",
    formError: "",
    notice: "",
    noticeTimer: null,
    reasonModal: null,
    reason: "",
    reasonError: "",
    usuarioSearch: "",
    usuarioSearchError: "",
    deleteConfirm: null,
    // Lookups
    lookupCache: {},      // { destinos: [{value, label}, ...], ... }
    lookupsLoading: false,
  }),

  computed: {
    current() { return this.modules.find(m => m.key === this.active) || this.modules[0]; },
    filteredRows() {
      const q = this.search.toLowerCase().trim();
      if (!q) return this.rows;
      return this.rows.filter(r => JSON.stringify(r).toLowerCase().includes(q));
    },
    reasonTitle() { return this.reasonModal?.type === 'cancel' ? 'Cancelar reserva' : 'Inhabilitar factura'; },
  },

  mounted() { this.loadAll(); },

  methods: {
    label(s) {
      const custom = { atraccionNombre: 'Atracción', destinoNombre: 'Destino', atraccionNombre: 'Atracción' };
      if (custom[s]) return custom[s];
      return s.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).replace('Id', 'ID');
    },
    rowKey(r) { return r.id ?? r.guid ?? r.usuarioRolId ?? `${r.atId}-${r.imgId}-${r.catId}-${r.incId}-${r.idId}`; },

    formatValue(v) {
      if (Array.isArray(v)) return v.join(', ');
      if (v == null || v === '') return '—';
      if (typeof v === 'number') return Number.isInteger(v) ? v : Number(v).toFixed(2);
      return String(v).length > 80 ? String(v).slice(0, 80) + '…' : String(v);
    },

    fieldPlaceholder(field) {
      if (field.type === 'number')   return '0';
      if (field.type === 'email')    return 'correo@ejemplo.com';
      if (field.type === 'url')      return 'https://...';
      if (field.type === 'password') return '••••••••';
      return '';
    },

    showNotice(msg) {
      this.notice = msg;
      if (this.noticeTimer) clearTimeout(this.noticeTimer);
      this.noticeTimer = setTimeout(() => { this.notice = ''; }, 3500);
    },

    selectModule(k) {
      this.active = k;
      this.search = '';
      this.usuarioSearch = '';
      this.usuarioSearchError = '';
      this.error = '';
      this.loadAll();
    },

    async loadAll() {
      this.loading = true;
      this.error = '';
      try {
        if (this.current.specialLoad === "byUsuario") {
          const api = apiFor('identidad');
          if (!this.usuarioSearch) {
            // Sin filtro: cargar todos los usuarios y consolidar todos sus roles
            this.usuarioSearchError = '';
            try {
              const usuRes = await api.get('/usuarios');
              const usuarios = usuRes.data?.data ?? usuRes.data ?? [];
              if (!usuarios.length) { this.rows = []; this.loading = false; return; }
              // Pedir roles de todos los usuarios en paralelo (ignorar errores individuales)
              const allRoles = await Promise.allSettled(
                usuarios.map(u => api.get('/usuarios-roles/usuario/' + u.id))
              );
              const combined = [];
              allRoles.forEach(r => {
                if (r.status === 'fulfilled') {
                  const d = r.value.data;
                  const items = d?.data ?? d ?? [];
                  combined.push(...(Array.isArray(items) ? items : []));
                }
              });
              this.rows = combined;
              if (!combined.length) this.error = 'No hay roles asignados aún. Usa "Nuevo registro" para asignar.';
            } catch {
              this.rows = [];
              this.error = 'No se pudo cargar la lista de usuario-roles.';
            }
          } else {
            // Con filtro por usuario específico
            this.usuarioSearchError = '';
            const res = await api.get('/usuarios-roles/usuario/' + this.usuarioSearch);
            const d = res.data;
            this.rows = d?.data ?? d ?? [];
            if (!this.rows.length) this.error = `No se encontraron roles para el usuario #${this.usuarioSearch}.`;
          }
        } else {
          this.rows = await list(this.current.resource);
          // Para reservas: enriquecer con nombre de atracción
          if (this.active === 'reservas' && this.rows.length) {
            try {
              const [horarios, tickets, atracciones] = await Promise.all([
                list('horarios'),
                list('tickets'),
                list('atracciones'),
              ]);
              const horMap  = Object.fromEntries(horarios.map(h => [h.id, h]));
              const tickMap = Object.fromEntries(tickets.map(t => [t.id, t]));
              const atMap   = Object.fromEntries(atracciones.map(a => [a.id, a]));
              this.rows = this.rows.map(r => {
                const horario   = horMap[r.horarioId];
                const ticket    = horario ? tickMap[horario.ticketId] : null;
                const atraccion = ticket  ? atMap[ticket.atraccionId]  : null;
                return { ...r, atraccionNombre: atraccion ? atraccion.nombre : '—' };
              });
            } catch { /* si falla, no es crítico */ }
          }
        }
      } catch (e) {
        const s = e?.response?.status;
        if (s === 404)        this.error = 'No se encontraron datos. Verifica que el recurso exista.';
        else if (s === 401 || s === 403) this.error = 'No tienes permisos para ver este módulo.';
        else if (s >= 500)    this.error = 'El servidor tuvo un problema. Intenta de nuevo en unos momentos.';
        else                  this.error = e.userMessage || 'No se pudo cargar la información.';
        this.rows = [];
      } finally {
        this.loading = false;
      }
    },

    // ── Cargar todos los lookups que necesita el módulo actual ───────────────
    async loadLookups() {
      // Detectar qué lookupKeys necesita el formulario actual
      const needed = this.current.form
        .filter(f => f.type === 'relselect' && f.lookupKey)
        .map(f => f.lookupKey);

      // También necesitamos usuarios para el buscador especial de Usuario-Rol
      if (this.current.specialLoad === 'byUsuario' && !needed.includes('usuarios')) {
        needed.push('usuarios');
      }

      // Filtrar los que ya están en caché
      const toFetch = needed.filter(k => !this.lookupCache[k]);
      if (!toFetch.length) return;

      this.lookupsLoading = true;
      const results = await Promise.allSettled(
        toFetch.map(async key => {
          const cfg = LOOKUP_CONFIG[key];
          if (!cfg) return { key, opts: [] };
          try {
            const data = await list(cfg.resource);
            const opts = (Array.isArray(data) ? data : []).map(r => ({
              value: r[cfg.valueField],
              label: cfg.labelFn(r),
            }));
            return { key, opts };
          } catch {
            return { key, opts: [] };
          }
        })
      );

      const newCache = { ...this.lookupCache };
      results.forEach(r => {
        if (r.status === 'fulfilled') newCache[r.value.key] = r.value.opts;
      });
      this.lookupCache = newCache;
      this.lookupsLoading = false;
    },

    // ── Abrir modal ──────────────────────────────────────────────────────────
    async openCreate() {
      this.editing = null;
      this.form = {};
      this.fieldErrors = {};
      this.formError = '';
      this.current.form.forEach(x => { this.form[x.name] = ''; });
      // Para reservas, pre-setear subtotal=0 para que el hint tenga sentido
      if (this.active === 'reservas') {
        this.form.subtotal = '';
        this.form.valorIva = '0.00';
        this.form.total    = '0.00';
      }
      this.modal = true;
      await this.loadLookups();
    },

    async openEdit(row) {
      this.editing = row;
      this.form = {};
      this.fieldErrors = {};
      this.formError = '';
      this.current.form.forEach(x => { this.form[x.name] = row[x.name] ?? ''; });
      if (row.id) this.form.id = row.id;
      this.modal = true;
      await this.loadLookups();
    },

    handleModalClose() { if (this.saving) return; this.closeModal(); },
    closeModal() { this.modal = false; this.form = {}; this.editing = null; this.fieldErrors = {}; this.formError = ''; },
    clearFieldError(name) { if (this.fieldErrors[name]) this.fieldErrors = { ...this.fieldErrors, [name]: '' }; },

    // ── Validación ───────────────────────────────────────────────────────────
    validate() {
      const errors = {};
      for (const field of this.current.form) {
        const val = this.form[field.name];
        const isEmpty = val === null || val === undefined || String(val).trim() === '';

        if (field.required && isEmpty) {
          errors[field.name] = field.type === 'relselect'
            ? `Debes seleccionar ${field.label.toLowerCase()}.`
            : 'Este campo es obligatorio.';
          continue;
        }

        if (!isEmpty) {
          if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val))
            errors[field.name] = 'Ingresa un correo electrónico válido.';
          if (field.type === 'url' && !/^https?:\/\/.+/.test(val))
            errors[field.name] = 'La URL debe iniciar con http:// o https://';
          if (field.type === 'number') {
            if (isNaN(Number(val))) errors[field.name] = 'Debe ser un valor numérico.';
            else if (Number(val) < 0) errors[field.name] = 'El valor no puede ser negativo.';
          }
          // Validar que cédula/teléfono sean solo dígitos
          if (field.inputmode === 'numeric' && !/^\d+$/.test(String(val).trim()))
            errors[field.name] = 'Solo se permiten números (sin letras ni espacios).';
          if (field.type === 'password' && String(val).length < 6)
            errors[field.name] = 'La contraseña debe tener al menos 6 caracteres.';
        }
      }

      // Validaciones cruzadas
      // Normalizar HH:MM → HH:MM:SS antes de comparar (el input type="time" devuelve sin segundos)
      const normTime = t => t && /^\d{2}:\d{2}$/.test(t) ? t + ':00' : t;
      if (this.form.horaInicio && this.form.horaFin &&
          normTime(this.form.horaInicio) >= normTime(this.form.horaFin))
        errors['horaFin'] = 'La hora fin debe ser posterior a la hora inicio.';

      if (this.form.rating !== '' && this.form.rating !== undefined) {
        const r = Number(this.form.rating);
        if (r < 1 || r > 5) errors['rating'] = 'La calificación debe estar entre 1 y 5.';
      }

      if (this.active === 'reservas') {
        const sub = Number(this.form.subtotal) || 0;
        const iva = Number(this.form.valorIva)  || 0;
        const tot = Number(this.form.total)     || 0;
        if (this.form.subtotal !== '' && this.form.valorIva !== '' && this.form.total !== '') {
          if (Math.abs(tot - (sub + iva)) > 0.01)
            errors['total'] = `El total (${tot.toFixed(2)}) debe ser igual a subtotal (${sub.toFixed(2)}) + IVA (${iva.toFixed(2)}) = ${(sub+iva).toFixed(2)}.`;
        }
      }

      if (this.active === 'tickets') {
        const cap   = Number(this.form.capacidadMaxima);
        const cupos = Number(this.form.cuposDisponibles);
        if (!isNaN(cap) && !isNaN(cupos) && cupos > cap)
          errors['cuposDisponibles'] = `Los cupos (${cupos}) no pueden superar la capacidad máxima (${cap}).`;
      }

      return errors;
    },

    normalize() {
      const body = {};
      this.current.form.forEach(field => {
        let val = this.form[field.name];
        if (val === '' && !field.required) val = null;
        if (field.type === 'number' && val !== null && val !== '')
          val = Number(val);
        if (field.type === 'relselect' && val !== null && val !== '') {
          const raw = String(val);
          val = /^-?\d+(\.\d+)?$/.test(raw) ? Number(val) : raw;
        }
        // El backend espera System.TimeOnly en formato HH:MM:SS.
        // El <input type="time"> devuelve HH:MM (sin segundos), así que añadimos ":00".
        if (field.type === 'time' && val && typeof val === 'string') {
          val = /^\d{2}:\d{2}$/.test(val) ? val + ':00' : val;
        }
        body[field.name] = val;
      });
      if (this.editing?.id) body.id = this.editing.id;
      return body;
    },

    async saveRow() {
      const errors = this.validate();
      this.fieldErrors = errors;
      if (Object.keys(errors).length > 0) {
        this.formError = 'Revisa los campos marcados antes de continuar.';
        this.$nextTick(() => {
          const el = document.querySelector('.input-error');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        return;
      }

      this.formError = '';
      // Advertir si ya existe una reserva con el mismo cliente y horario
      if (!this.editing && this.isDuplicateReserva()) {
        this.formError = '⚠ Ya existe una reserva activa para este cliente en el mismo horario. ¿Deseas continuar de todas formas?';
        // Permitir guardar igual (solo es aviso), el backend decidirá si es válido
      }
      this.saving = true;
      try {
        const body = this.normalize();
        if (this.editing) {
          await update(this.current.resource, this.rowKey(this.editing), body);
          this.showNotice(`${this.cap(this.current.single)} actualizado correctamente.`);
        } else {
          await create(this.current.resource, body);
          this.showNotice(`${this.cap(this.current.single)} creado correctamente.`);
        }
        // Limpiar todo el caché de lookups para que los dropdowns
        // siempre reflejen los datos más recientes al abrir el próximo modal
        this.lookupCache = {};
        this.closeModal();
        await this.loadAll();
      } catch (e) {
        const s = e?.response?.status;
        if (s === 400) {
          const be = e?.response?.data?.errors || e?.response?.data?.validationErrors;
          this.formError = be ? Object.values(be).flat().join(' ') : (e.userMessage || 'Los datos no son válidos.');
        } else if (s === 409) {
          this.formError = 'Ya existe un registro con estos datos.';
        } else if (s === 404) {
          this.formError = 'El registro que intentas editar ya no existe.';
        } else if (s >= 500) {
          this.formError = 'El servidor tuvo un problema al guardar. Intenta de nuevo.';
        } else {
          this.formError = e.userMessage || 'No se pudo guardar. Verifica los datos e intenta de nuevo.';
        }
      } finally {
        this.saving = false;
      }
    },

    cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); },

    // Calcula IVA (15%) y Total automáticamente al cambiar Subtotal en reservas
    onFieldInput(fieldName) {
      if (this.active === 'reservas' && fieldName === 'subtotal') {
        const sub = parseFloat(this.form.subtotal) || 0;
        const iva = Math.round(sub * 0.15 * 100) / 100;
        const total = Math.round((sub + iva) * 100) / 100;
        this.form.valorIva = iva.toFixed(2);
        this.form.total = total.toFixed(2);
        // Limpiar errores de esos campos
        this.fieldErrors = { ...this.fieldErrors, valorIva: '', total: '' };
      }
      // Bloquear letras en campos numéricos (cédula / teléfono)
      if (fieldName === 'numeroIdentificacion' || fieldName === 'telefono') {
        this.form[fieldName] = String(this.form[fieldName] || '').replace(/\D/g, '');
      }
    },

    // Detectar si existe una reserva duplicada (mismo cliente + mismo horario)
    isDuplicateReserva() {
      if (this.active !== 'reservas') return false;
      const clienteId = String(this.form.clienteId || '');
      const horarioId = String(this.form.horarioId || '');
      if (!clienteId || !horarioId) return false;
      return this.rows.some(r => {
        // En edición, excluir la reserva actual
        if (this.editing && (r.id === this.editing.id)) return false;
        return String(r.clienteId || '') === clienteId && String(r.horarioId || '') === horarioId;
      });
    },

    confirmDelete(row) { this.deleteConfirm = row; },

    async executeDelete() {
      const row = this.deleteConfirm;
      if (!row) return;
      this.deleting = true;
      try {
        const key = this.current.specialLoad === "byUsuario"
          ? row.usuarioId + '/' + row.rolId
          : this.rowKey(row);
        await remove(this.current.resource, key);
        this.deleteConfirm = null;
        this.showNotice('Registro eliminado correctamente.');
        await this.loadAll();
      } catch (e) {
        this.deleteConfirm = null;
        const s = e?.response?.status;
        if (s === 409) this.error = 'No se puede eliminar: tiene datos asociados. Elimina primero los registros relacionados.';
        else if (s === 404) this.error = 'El registro ya no existe o fue eliminado previamente.';
        else this.error = e.userMessage || 'No se pudo eliminar el registro.';
      } finally {
        this.deleting = false;
      }
    },

    openCancel(row)  { this.reasonModal = { type:'cancel',  row }; this.reason = ''; this.reasonError = ''; this.formError = ''; },
    openDisable(row) { this.reasonModal = { type:'disable', row }; this.reason = ''; this.reasonError = ''; this.formError = ''; },

    async sendReason() {
      if (!this.reason.trim())            { this.reasonError = 'El motivo es obligatorio.'; return; }
      if (this.reason.trim().length < 10) { this.reasonError = 'El motivo debe tener al menos 10 caracteres.'; return; }
      this.formError = '';
      try {
        const r = this.reasonModal;
        await patch(this.current.resource, this.rowKey(r.row), r.type === 'cancel' ? 'cancelar' : 'inhabilitar', { motivo: this.reason });
        this.reasonModal = null;
        this.showNotice('Acción realizada correctamente.');
        await this.loadAll();
      } catch (e) {
        const s = e?.response?.status;
        this.formError = s === 404
          ? 'El registro ya no existe.'
          : (e.userMessage || 'No se pudo completar la acción. Intenta de nuevo.');
      }
    },
  },
};
</script>

<style scoped>
.page { min-height: 100vh; background: var(--sand); }
.wrap { max-width: 1280px; margin: auto; padding: 28px; }

/* Cards base */
.hero-card, .panel, .summary { background: #fff; border: 1px solid var(--border); box-shadow: var(--shadow-soft); border-radius: 24px; }
.hero-card { display: flex; justify-content: space-between; gap: 20px; padding: 28px; margin-bottom: 18px; }
.eyebrow { text-transform: uppercase; letter-spacing: .12em; color: var(--terracotta); font-size: 12px; font-weight: 700; }
.hero-card h1 { font-family: var(--font-display); font-size: 42px; }
.hero-card p { color: rgba(26,22,18,.65); }
.hero-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

/* Botones */
.btn { border: 0; background: var(--ink); color: white; border-radius: 12px; padding: 11px 16px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: opacity .15s; }
.btn:disabled { opacity: .55; cursor: not-allowed; }
.btn:not(:disabled):hover { opacity: .85; }
.btn.secondary { background: var(--sand-dark); color: var(--ink); }
.btn-danger { background: #c0392b !important; }
.btn-warn   { background: #e67e22 !important; }

/* Summary */
.summary-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; margin-bottom: 18px; }
.summary { padding: 18px; }
.summary strong { display: block; font-size: 26px; }
.summary span { color: rgba(26,22,18,.55); }

/* Toast */
.toast { position: fixed; top: 20px; right: 20px; z-index: 2000; background: #1e4d2b; color: #fff; border-radius: 14px; padding: 14px 20px; display: flex; align-items: center; gap: 10px; font-weight: 600; box-shadow: 0 4px 20px rgba(0,0,0,.25); max-width: 360px; }
.toast-icon { font-size: 20px; background: rgba(255,255,255,.2); border-radius: 50%; width: 32px; height: 32px; display: grid; place-items: center; flex-shrink: 0; }
.toast-enter-active, .toast-leave-active { transition: all .3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(-12px) scale(.95); }

/* Notices */
.notice { padding: 14px 16px; border-radius: 14px; margin-bottom: 14px; display: flex; align-items: flex-start; gap: 12px; }
.bad { background: #fdebea; color: #8c2922; border: 1px solid #f5c6c4; }
.notice-icon { font-size: 18px; flex-shrink: 0; margin-top: 1px; }
.notice strong { display: block; margin-bottom: 2px; }
.notice p { margin: 0; font-size: 14px; opacity: .85; }
.notice-close { border: 0; background: none; font-size: 20px; cursor: pointer; color: inherit; margin-left: auto; opacity: .6; padding: 0 4px; }
.notice-close:hover { opacity: 1; }
.form-notice { margin-top: 14px; margin-bottom: 0; }

/* Info box */
.info-box { background: #fffbe6; border: 1px solid #ffe066; border-radius: 10px; padding: 10px 14px; font-size: 13px; color: #7a5900; margin-top: 10px; display: flex; align-items: center; gap: 8px; }
.info-warn { background: #fff3e0; border-color: #ffb74d; color: #7a3900; }

/* Readonly field */
.input-readonly { background: #f5f5f5 !important; color: rgba(26,22,18,.55) !important; cursor: not-allowed; }

/* Fade */
.fade-enter-active, .fade-leave-active { transition: opacity .25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* Panel */
.panel { padding: 18px; }
.toolbar { display: flex; gap: 12px; margin-bottom: 16px; }
.special-search { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; align-items: flex-start; }
.special-search .search { flex: 1; }

/* Inputs */
.search, .select, input, textarea, select {
  width: 100%; border: 1.5px solid var(--border-strong); border-radius: 12px;
  padding: 10px 12px; font-family: var(--font-body); background: white;
  transition: border-color .2s, box-shadow .2s; box-sizing: border-box;
}
input:focus, textarea:focus, select:focus {
  outline: none; border-color: var(--terracotta);
  box-shadow: 0 0 0 3px rgba(180,70,50,.12);
}
.input-error { border-color: #c0392b !important; background: #fff8f8 !important; }
.input-error:focus { box-shadow: 0 0 0 3px rgba(192,57,43,.15) !important; }
.select { max-width: 260px; }

/* Relational select */
.rel-select-wrap { position: relative; }
.rel-select-wrap select { appearance: auto; }
.rel-hint { font-size: 12px; color: #a06b00; margin-top: 4px; display: block; }

/* Field hints */
.field-hint { font-size: 12px; margin: 4px 0 0; color: rgba(26,22,18,.5); display: flex; align-items: flex-start; gap: 4px; }
.field-hint.error { color: #a93226; font-weight: 600; }

/* Table */
.table-scroll { overflow: auto; }
table { width: 100%; border-collapse: collapse; min-width: 850px; }
th, td { padding: 12px; border-bottom: 1px solid var(--border); text-align: left; font-size: 14px; }
th { font-size: 12px; text-transform: uppercase; color: rgba(26,22,18,.55); }
.right { text-align: right; }
.actions { white-space: nowrap; }
.mini { border: 1px solid var(--border-strong); background: white; border-radius: 9px; padding: 7px 10px; margin-left: 6px; cursor: pointer; font-size: 13px; transition: background .15s; }
.mini:hover { background: var(--sand); }
.mini.danger { color: #9d2f26; }
.mini.danger:hover { background: #fdebea; border-color: #f5c6c4; }
.mini.warn { color: #a06b00; }
.mini.warn:hover { background: #fffbe6; }

/* Loading */
.loading { text-align: center; padding: 40px; color: rgba(26,22,18,.55); display: flex; align-items: center; justify-content: center; gap: 12px; }
.lookups-loading { display: flex; align-items: center; gap: 10px; color: rgba(26,22,18,.55); font-size: 14px; padding: 10px 0 16px; }
.loading-blur { opacity: .5; pointer-events: none; transition: opacity .2s; }
.spinner { width: 20px; height: 20px; border: 2.5px solid var(--border-strong); border-top-color: var(--ink); border-radius: 50%; animation: spin .7s linear infinite; }
.spinner-sm { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,.4); border-top-color: white; border-radius: 50%; animation: spin .7s linear infinite; flex-shrink: 0; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Empty */
.empty { text-align: center; padding: 48px 20px; color: rgba(26,22,18,.55); }
.empty-icon { font-size: 36px; display: block; margin-bottom: 10px; }
.empty p { margin: 4px 0; }
.empty-hint { font-size: 13px; opacity: .7; }

/* Tabs */
.tabs { display: flex; gap: 8px; overflow: auto; max-width: 720px; }
.tab { border: 1px solid var(--border); background: white; border-radius: 999px; padding: 8px 12px; cursor: pointer; white-space: nowrap; transition: all .15s; }
.tab:hover { background: var(--sand); }
.tab.active { background: var(--ink); color: white; border-color: var(--ink); }

/* Modal */
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: grid; place-items: center; z-index: 1000; padding: 20px; }
.modal { width: min(760px,100%); max-height: 90vh; overflow: auto; background: white; border-radius: 24px; padding: 24px; }
.modal.small { width: min(520px,100%); }
.modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.modal-head h2 { font-family: var(--font-display); font-size: 24px; margin: 0; }
.x { border: 0; background: var(--sand-dark); border-radius: 50%; width: 34px; height: 34px; font-size: 20px; cursor: pointer; display: grid; place-items: center; }
.x:hover { background: #ddd; }

/* Form */
.form-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 16px; }
.field label { font-weight: 700; font-size: 13px; display: block; margin-bottom: 6px; }
.field .req { color: #b9372b; }
.field.full { grid-column: 1 / -1; }
.field.has-error label { color: #a93226; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }

/* Confirm modal */
.modal-confirm { text-align: center; padding: 32px; }
.confirm-icon { font-size: 40px; margin-bottom: 12px; }
.modal-confirm h2 { margin: 0 0 10px; }
.modal-confirm p { color: rgba(26,22,18,.65); margin-bottom: 0; }
.modal-confirm .modal-actions { justify-content: center; }

@media (max-width: 800px) {
  .hero-card, .toolbar { flex-direction: column; }
  .summary-grid, .form-grid { grid-template-columns: 1fr; }
  .nav-center { display: none; }
  .hero-card h1 { font-size: 32px; }
  .select { max-width: 100%; }
  .toast { right: 10px; left: 10px; }
}
</style>
