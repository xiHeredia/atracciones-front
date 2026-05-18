import { reactive } from "vue";

const readUserFromStorage = () => {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem("user");
    return null;
  }
};

export const authState = reactive({
  user: readUserFromStorage(),
});

export const getStoredUser = () => authState.user;

export const setStoredUser = (user) => {
  authState.user = user || null;
  if (user) {
    localStorage.setItem("user", JSON.stringify(user));
  } else {
    localStorage.removeItem("user");
  }
};

export const clearStoredUser = () => {
  setStoredUser(null);
};

export const isAuthenticated = () => Boolean(authState.user?.token);

window.addEventListener("storage", (event) => {
  if (event.key === "user") {
    authState.user = readUserFromStorage();
  }
});
