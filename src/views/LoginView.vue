<template>
  <div class="login-page">
    <section class="login-shell">
      <div class="login-copy">
        <button class="back-link" type="button" @click="$router.push('/cliente')">
          Volver a atracciones
        </button>
        <p class="eyebrow">Atracciones</p>
        <h1>{{ mode === 'login' ? 'Ingresa para reservar' : 'Crea tu cuenta de cliente' }}</h1>
        <p>
          Puedes explorar el catalogo sin iniciar sesion. Solo te pediremos una cuenta cuando quieras confirmar una reserva.
        </p>
      </div>

      <div class="form-card">
        <div class="tabs">
          <button :class="{ active: mode === 'login' }" type="button" @click="mode = 'login'">Ingresar</button>
          <button :class="{ active: mode === 'register' }" type="button" @click="mode = 'register'">Registrarme</button>
        </div>

        <form v-if="mode === 'login'" class="form-body" @submit.prevent="handleLogin">
          <label>
            Usuario
            <input v-model.trim="loginForm.userName" type="text" autocomplete="username" />
          </label>
          <label>
            Contrasena
            <input v-model="loginForm.password" type="password" autocomplete="current-password" />
          </label>

          <div v-if="error" class="notice bad">{{ error }}</div>
          <button class="btn" :disabled="loading">{{ loading ? 'Ingresando...' : 'Ingresar' }}</button>
        </form>

        <form v-else class="form-body" @submit.prevent="handleRegister">
          <div class="grid">
            <label>
              Usuario
              <input v-model.trim="registerForm.userName" type="text" autocomplete="username" />
            </label>
            <label>
              Contrasena
              <input v-model="registerForm.password" type="password" autocomplete="new-password" />
            </label>
            <label>
              Nombres
              <input v-model.trim="registerForm.nombres" type="text" />
            </label>
            <label>
              Apellidos
              <input v-model.trim="registerForm.apellidos" type="text" />
            </label>
            <label>
              Tipo identificacion
              <select v-model="registerForm.tipoIdentificacion">
                <option value="CEDULA">CEDULA</option>
                <option value="RUC">RUC</option>
                <option value="PASAPORTE">PASAPORTE</option>
                <option value="OTRO">OTRO</option>
              </select>
            </label>
            <label>
              Numero identificacion
              <input v-model.trim="registerForm.numeroIdentificacion" type="text" inputmode="numeric" />
            </label>
            <label class="full">
              Correo
              <input v-model.trim="registerForm.correo" type="email" autocomplete="email" />
            </label>
            <label>
              Telefono
              <input v-model.trim="registerForm.telefono" type="text" inputmode="numeric" />
            </label>
            <label>
              Direccion
              <input v-model.trim="registerForm.direccion" type="text" />
            </label>
          </div>

          <div v-if="error" class="notice bad">{{ error }}</div>
          <button class="btn" :disabled="loading">{{ loading ? 'Creando cuenta...' : 'Crear cuenta' }}</button>
        </form>
      </div>
    </section>
  </div>
</template>

<script>
import { clientesApi, normalizeUser } from "../services/api";
import { login, registerCliente } from "../services/authService";
import { setStoredUser } from "../services/session";

export default {
  data() {
    return {
      mode: this.$route.query.mode === "register" ? "register" : "login",
      loading: false,
      error: "",
      loginForm: {
        userName: "",
        password: "",
      },
      registerForm: {
        userName: "",
        password: "",
        nombres: "",
        apellidos: "",
        tipoIdentificacion: "CEDULA",
        numeroIdentificacion: "",
        correo: "",
        telefono: "",
        direccion: "",
      },
    };
  },
  watch: {
    "$route.query.mode"(value) {
      this.mode = value === "register" ? "register" : "login";
    },
  },
  methods: {
    redirectAfterAuth(user) {
      const roles = (user.roles || []).map((r) => String(r).toUpperCase());
      const redirect = this.$route.query.redirect;

      if (roles.includes("ADMIN")) {
        this.$router.push("/admin");
        return;
      }

      if (redirect) {
        this.$router.push(String(redirect));
        return;
      }

      this.$router.push("/cliente");
    },
    async hydrateCliente(user) {
      if (!user?.usuarioGuid || (user.roles || []).some((r) => String(r).toUpperCase() === "ADMIN")) {
        return user;
      }

      try {
        const response = await clientesApi.get(`/clientes/usuario/${user.usuarioGuid}`);
        const cliente = response.data?.data ?? response.data;
        const updated = { ...user, clienteGuid: cliente?.guid, cliente };
        setStoredUser(updated);
        return updated;
      } catch {
        return user;
      }
    },
    validateLogin() {
      if (!this.loginForm.userName || !this.loginForm.password) {
        return "Completa usuario y contrasena.";
      }
      return "";
    },
    validateRegister() {
      const required = [
        "userName",
        "password",
        "nombres",
        "apellidos",
        "numeroIdentificacion",
        "correo",
      ];
      if (required.some((field) => !String(this.registerForm[field] || "").trim())) {
        return "Completa los campos obligatorios.";
      }
      if (this.registerForm.password.length < 6) {
        return "La contrasena debe tener al menos 6 caracteres.";
      }
      return "";
    },
    async handleLogin() {
      this.error = this.validateLogin();
      if (this.error) return;

      this.loading = true;
      try {
        const result = await login(this.loginForm.userName, this.loginForm.password);
        const user = normalizeUser(result);
        setStoredUser(user);
        const hydrated = await this.hydrateCliente(user);
        this.redirectAfterAuth(hydrated);
      } catch (e) {
        this.error = e.userMessage || "Usuario o contrasena incorrectos.";
      } finally {
        this.loading = false;
      }
    },
    async handleRegister() {
      this.error = this.validateRegister();
      if (this.error) return;

      this.loading = true;
      try {
        const user = await registerCliente({
          cuenta: {
            userName: this.registerForm.userName,
            password: this.registerForm.password,
          },
          perfil: {
            tipoIdentificacion: this.registerForm.tipoIdentificacion,
            numeroIdentificacion: this.registerForm.numeroIdentificacion,
            nombres: this.registerForm.nombres,
            apellidos: this.registerForm.apellidos,
            correo: this.registerForm.correo,
            telefono: this.registerForm.telefono,
            direccion: this.registerForm.direccion,
          },
        });
        this.redirectAfterAuth(user);
      } catch (e) {
        this.error = e.userMessage || "No se pudo crear la cuenta.";
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: var(--sand);
  padding: 24px;
}

.login-shell {
  width: min(1060px, 100%);
  display: grid;
  grid-template-columns: 0.9fr 1.1fr;
  background: white;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.login-copy {
  background: linear-gradient(145deg, var(--ink) 0%, #2C2118 100%);
  color: white;
  padding: 44px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.back-link {
  align-self: flex-start;
  border: 1px solid rgba(255,255,255,.25);
  background: transparent;
  color: white;
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  cursor: pointer;
  margin-bottom: 32px;
}

.eyebrow {
  color: var(--gold);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: .14em;
  font-weight: 800;
}

.login-copy h1 {
  font-family: var(--font-display);
  font-size: clamp(34px, 5vw, 54px);
  line-height: 1.05;
  margin: 10px 0 14px;
}

.login-copy p {
  color: rgba(255,255,255,.68);
  max-width: 360px;
}

.form-card {
  padding: 34px;
}

.tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: var(--sand);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 4px;
  margin-bottom: 24px;
}

.tabs button {
  border: 0;
  background: transparent;
  border-radius: 7px;
  padding: 10px;
  font-weight: 800;
  cursor: pointer;
  color: var(--ink-soft);
}

.tabs button.active {
  background: white;
  color: var(--ink);
  box-shadow: var(--shadow-soft);
}

.form-body {
  display: grid;
  gap: 16px;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.full {
  grid-column: 1 / -1;
}

label {
  display: grid;
  gap: 6px;
  font-weight: 800;
  font-size: 13px;
}

input,
select {
  border: 1.5px solid var(--border-strong);
  border-radius: var(--radius-sm);
  padding: 12px 13px;
  font: inherit;
  background: white;
}

input:focus,
select:focus {
  outline: none;
  border-color: var(--terracotta);
  box-shadow: 0 0 0 3px rgba(196,98,45,.12);
}

.btn {
  border: 0;
  background: var(--ink);
  color: white;
  border-radius: var(--radius-sm);
  padding: 13px 16px;
  font-weight: 800;
  cursor: pointer;
}

.btn:disabled {
  opacity: .6;
  cursor: not-allowed;
}

.notice {
  padding: 12px 14px;
  border-radius: var(--radius-sm);
}

.bad {
  background: #fdebea;
  color: #8c2922;
}

@media (max-width: 820px) {
  .login-shell {
    grid-template-columns: 1fr;
  }

  .login-copy {
    padding: 28px;
  }
}

@media (max-width: 560px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
