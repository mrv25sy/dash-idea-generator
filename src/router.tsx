import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// Tell the browser not to restore the old scroll spot on refresh; always start at the top.
if (typeof window !== "undefined") {
  if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
  if (!window.location.hash) window.scrollTo(0, 0);
  window.addEventListener("load", () => {
    if (!window.location.hash) window.scrollTo(0, 0);
  });
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    // Off so a refresh always starts at the top (new pages still open at the top).
    scrollRestoration: false,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
