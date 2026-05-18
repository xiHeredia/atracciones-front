<template>
  <div class="page">
    <AppNav />
    <section class="hero">
      <div><p class="eyebrow">Booking de experiencias</p><h1>Explora y reserva atracciones</h1><p>Busca por nombre, revisa precios y confirma tu reserva desde el detalle.</p></div>
    </section>
    <main class="wrap">
      <div v-if="error" class="notice bad">{{ error }}</div>
      <div class="filters"><input v-model="search" placeholder="Buscar atracción, destino o descripción..." /><button @click="load" class="btn secondary">Actualizar</button></div>
      <div v-if="loading" class="loading">Cargando atracciones...</div>
      <div v-else-if="filtered.length===0" class="empty">No hay atracciones disponibles.</div>
      <div v-else class="grid">
        <article v-for="a in filtered" :key="a.guid" class="card" @click="$router.push('/cliente/atraccion/' + a.guid)">
          <div class="img" :style="{backgroundImage:'url(' + imgUrl(a) + ')'}"></div>
          <div class="body">
            <span class="pill">{{ a.destinoNombre || 'Destino' }}</span>
            <h3>{{ a.nombre }}</h3>
            <p>{{ a.descripcion || 'Experiencia disponible para reserva.' }}</p>
            <div class="foot"><strong>${{ money(a.precioReferencia) }}</strong><button>Ver detalle</button></div>
          </div>
        </article>
      </div>
    </main>
  </div>
</template>

<script>
import AppNav from "../../components/AppNav.vue";
import { dataOf, obtenerAtracciones } from "../../services/atraccionService";

export default {
  components: { AppNav },
  data: () => ({
    atracciones: [],
    loading: false,
    error: '',
    search: '',
    fallback: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80'
  }),
  computed: {
    filtered() {
      const q = this.search.toLowerCase().trim();
      if (!q) return this.atracciones;
      return this.atracciones.filter(a => JSON.stringify(a).toLowerCase().includes(q));
    }
  },
  mounted() { this.load(); },
  methods: {
    money(v) { return Number(v || 0).toFixed(2); },
    imgUrl(a) {
      const candidates = [a.imagenUrl, a.urlImagen, ...(a.imagenes || [])];
      return candidates.find((url) => typeof url === "string" && /^https?:\/\//i.test(url.trim())) || this.fallback;
    },
    async load() {
      this.loading = true;
      this.error = '';
      try {
        const r = await obtenerAtracciones();
        this.atracciones = dataOf(r);
      } catch (e) {
        this.error = e.userMessage || 'No se pudieron cargar las atracciones.';
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>

<style scoped>
.page{min-height:100vh;background:var(--sand)}.hero{background:linear-gradient(135deg,var(--ink),#2c2118);color:white;padding:70px 32px}.hero>div,.wrap{max-width:1180px;margin:auto}.eyebrow{color:var(--gold);font-size:12px;text-transform:uppercase;letter-spacing:.14em;font-weight:800}.hero h1{font-family:var(--font-display);font-size:clamp(36px,5vw,58px);line-height:1.05;margin:10px 0}.hero p{color:rgba(255,255,255,.68)}.wrap{padding:32px}.filters{display:flex;gap:12px;margin-bottom:24px}input{flex:1;border:1.5px solid var(--border-strong);border-radius:16px;padding:13px 16px}.btn{border:0;border-radius:14px;padding:12px 16px;background:var(--ink);color:white;font-weight:800}.secondary{background:white;color:var(--ink);border:1px solid var(--border)}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:22px}.card{background:white;border:1px solid var(--border);border-radius:24px;overflow:hidden;box-shadow:var(--shadow-soft);cursor:pointer;transition:.2s}.card:hover{transform:translateY(-4px);box-shadow:var(--shadow-md)}.img{height:180px;background-size:cover;background-position:center}.body{padding:20px}.pill{font-size:12px;background:var(--terracotta-pale);color:var(--terracotta);padding:6px 10px;border-radius:999px;font-weight:800}.body h3{font-family:var(--font-display);font-size:25px;margin:12px 0 6px}.body p{color:rgba(26,22,18,.62);min-height:52px}.foot{display:flex;justify-content:space-between;align-items:center;margin-top:16px}.foot button{border:0;background:var(--ink);color:white;border-radius:12px;padding:9px 12px}.notice{padding:12px 14px;border-radius:14px;margin-bottom:14px}.bad{background:#fdebea;color:#8c2922}.loading,.empty{text-align:center;padding:42px;color:rgba(26,22,18,.55)}@media(max-width:700px){.filters{flex-direction:column}}
</style>
