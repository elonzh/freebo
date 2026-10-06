import { MutationCache, QueryClient, queryOptions } from "@tanstack/react-query";
import type { AppState, DesktopAPI } from "../shared/types";

export const desktopStateKey = ["desktop", "state"] as const;
export const diagnosticsKey = ["desktop", "diagnostics"] as const;

// Main-process snapshots can arrive while an older IPC read is still in flight.
export function newerSnapshot(current: AppState | undefined, next: AppState): AppState {
  return current && current.revision > next.revision ? current : next;
}
export function createDesktopRuntime(api: DesktopAPI) {
  const listeners = new Set<(state: AppState) => void>();
  let disposed = false;
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        retryOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        networkMode: "always",
      },
      mutations: { retry: false, networkMode: "always", gcTime: 0 },
    },
    mutationCache: new MutationCache({
      onSuccess(result) {
        if (isAppState(result)) applyState(result);
        void queryClient.invalidateQueries({ queryKey: diagnosticsKey });
      },
    }),
  });
  function applyState(next: AppState) {
    if (disposed) return next;
    const current = queryClient.getQueryData<AppState>(desktopStateKey);
    const accepted = newerSnapshot(current, next);
    if (accepted !== current) {
      queryClient.setQueryData(desktopStateKey, accepted);
      listeners.forEach((listener) => listener(accepted));
    }
    return accepted;
  }
  const stateOptions = queryOptions({
    queryKey: desktopStateKey,
    queryFn: async () => applyState(await api.getState()),
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const unsubscribe = api.onState(applyState);
  return {
    api,
    queryClient,
    stateOptions,
    applyState,
    subscribe(listener: (state: AppState) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      disposed = true;
      unsubscribe();
      listeners.clear();
      queryClient.clear();
    },
  };
}
export type DesktopRuntime = ReturnType<typeof createDesktopRuntime>;
function isAppState(value: unknown): value is AppState {
  return Boolean(value && typeof value === "object" && "revision" in value && "settings" in value);
}
