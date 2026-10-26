import "@fontsource-variable/dm-sans";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 180_000,
      gcTime: 15 * 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

const root = document.getElementById("root");

if (!root) {
  throw new Error("Application root is missing");
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
