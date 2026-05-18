<template>
  <nav class="nav">
    <div class="nav-inner">
      <div class="nav-brand">
        <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
          <path d="M14 2L26 8V20L14 26L2 20V8L14 2Z" stroke="currentColor" stroke-width="2"/>
          <circle cx="14" cy="14" r="4" fill="currentColor"/>
        </svg>
        <span>Atracciones</span>
      </div>
      <div class="nav-center" v-if="slots">
        <slot name="tabs"/>
      </div>
      <div class="nav-right">
        <template v-if="isLoggedIn">
          <div class="nav-user">
          <div class="user-avatar">{{ initials }}</div>
          <span class="user-name">{{ userName }}</span>
          </div>
          <button v-if="isAdmin && $route.path !== '/admin'" class="btn-primary" @click="$router.push('/admin')">
            Panel admin
          </button>
          <button class="btn-logout" @click="logout">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16,17 21,12 16,7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Salir
          </button>
        </template>
        <template v-else>
          <button class="btn-ghost" @click="goLogin">Ingresar</button>
          <button class="btn-primary" @click="goRegister">Registrarme</button>
        </template>
      </div>
    </div>
  </nav>
</template>

<script>
import { logout as clearSession } from "../services/authService";
import { authState } from "../services/session";

export default {
  props: {
    slots: { type: Boolean, default: false }
  },
  computed: {
    user() {
      return authState.user || {};
    },
    userName() {
      return this.user.userName || this.user.UserName || "Usuario";
    },
    isLoggedIn() {
      return Boolean(this.user.token);
    },
    isAdmin() {
      const roles = this.user.roles || this.user.Roles || [];
      return roles.map((role) => String(role).toUpperCase()).includes("ADMIN");
    },
    initials() {
      return this.userName.slice(0, 2).toUpperCase();
    }
  },
  methods: {
    logout() {
      clearSession();
      this.$router.push("/cliente");
    },
    goLogin() {
      this.$router.push({ path: "/login", query: { redirect: this.$route.fullPath } });
    },
    goRegister() {
      this.$router.push({ path: "/login", query: { mode: "register", redirect: this.$route.fullPath } });
    }
  }
};
</script>

<style scoped>
.nav {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(245,240,232,0.92);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}
.nav-inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 32px;
  height: 64px;
  display: flex;
  align-items: center;
  gap: 24px;
}
.nav-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 17px;
  color: var(--ink);
  flex-shrink: 0;
}
.nav-brand svg { color: var(--terracotta); }
.nav-center { flex: 1; display: flex; justify-content: center; }
.nav-right { display: flex; align-items: center; gap: 16px; margin-left: auto; }
.nav-user { display: flex; align-items: center; gap: 10px; }
.user-avatar {
  width: 34px; height: 34px;
  background: var(--terracotta);
  color: white;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 600;
}
.user-name { font-size: 14px; font-weight: 500; color: var(--ink-soft); }
.btn-logout {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 14px;
  border: 1.5px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: transparent;
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--ink-soft);
  cursor: pointer;
  transition: all var(--transition);
}
.btn-ghost,
.btn-primary {
  border: 1.5px solid var(--border-strong);
  border-radius: var(--radius-sm);
  padding: 8px 14px;
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
.btn-ghost {
  background: transparent;
  color: var(--ink-soft);
}
.btn-primary {
  background: var(--ink);
  border-color: var(--ink);
  color: white;
}
.btn-ghost:hover { background: white; }
.btn-primary:hover { background: var(--terracotta); border-color: var(--terracotta); }
.btn-logout:hover {
  background: var(--ink);
  border-color: var(--ink);
  color: white;
}
</style>
