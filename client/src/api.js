const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const getToken = () => localStorage.getItem("token");

const handleResponse = async (response) => {
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.reload();
      throw new Error("Session expired. Please log in again.");
    }
    throw new Error(data.error || "Request failed");
  }
  return data;
};

const headers = (extra = {}) => {
  const token = getToken();
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const api = {
  get: async (path) => {
    return handleResponse(await fetch(`${BASE_URL}${path}`, { headers: headers() }));
  },

  post: async (path, body, isFormData = false) => {
    return handleResponse(
      await fetch(`${BASE_URL}${path}`, {
        method: "POST",
        headers: headers(isFormData ? {} : { "Content-Type": "application/json" }),
        body: isFormData ? body : JSON.stringify(body),
      })
    );
  },

  patch: async (path, body) => {
    return handleResponse(
      await fetch(`${BASE_URL}${path}`, {
        method: "PATCH",
        headers: headers({ "Content-Type": "application/json" }),
        body: body ? JSON.stringify(body) : undefined,
      })
    );
  },

  delete: async (path) => {
    return handleResponse(
      await fetch(`${BASE_URL}${path}`, { method: "DELETE", headers: headers() })
    );
  },
};
