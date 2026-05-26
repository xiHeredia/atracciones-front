import { createRouter, createWebHistory } from "vue-router";
import LoginView from "../views/LoginView.vue";
import AdminDashboard from "../views/admin/AdminDashboard.vue";
import ClienteHome from "../views/cliente/ClienteHome.vue";
import AtraccionDetalle from "../views/cliente/AtraccionDetalle.vue";

const routes = [
  { path: "/", redirect: "/cliente" },
  { path: "/index.html", redirect: "/cliente" },
  { path: "/login", component: LoginView },
  { path: "/admin", component: AdminDashboard, meta: { requiresAuth: true, role: "ADMIN" } },
  { path: "/cliente", component: ClienteHome },
  { path: "/cliente/atraccion/:guid", component: AtraccionDetalle },
  { path: "/:pathMatch(.*)*", redirect: "/cliente" },
];

const router = createRouter({ history: createWebHistory(), routes });

router.beforeEach((to) => {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  if (to.meta.requiresAuth && !user?.token) {
    return { path: "/login", query: { redirect: to.fullPath } };
  }
  const roles = (user?.roles || user?.Roles || []).map((r) => String(r).toUpperCase());
  if (to.meta.role && !roles.includes(to.meta.role)) return "/cliente";
  return true;
});

export default router;
