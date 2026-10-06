import { createContext, useContext, useCallback, useRef } from "react";
import { useMutation, useMutationState } from "@tanstack/react-query";
import type { AppState, DesktopAPI } from "../shared/types";
import type { RunAction, SettingsPatch } from "../ui";
import type { DesktopRuntime } from "./desktop";

type Action = { key: string; id: number };
export function useDesktopActions(runtime: DesktopRuntime) {
  const actions = useRef(new Map<number, (api: DesktopAPI) => Promise<unknown>>());
  const nextId = useRef(0);
  const mutation = useMutation({
    mutationKey: ["desktop", "action"],
    mutationFn: async ({ id }: Action) => {
      const action = actions.current.get(id);
      if (!action) throw new Error("Desktop action is unavailable");
      try {
        return await action(runtime.api);
      } finally {
        actions.current.delete(id);
      }
    },
  });
  const pendingKeys = useMutationState({
    filters: { mutationKey: ["desktop", "action"], status: "pending" },
    select: (entry) => (entry.state.variables as Action).key,
  });
  const { mutateAsync, reset } = mutation;
  const run: RunAction = useCallback(
    async (key, action) => {
      const id = ++nextId.current;
      actions.current.set(id, action);
      try {
        // Cache identifiers only; callbacks can close over credential input.
        await mutateAsync({ key, id });
      } catch {
        /* The mutation owns the error state. */
      }
    },
    [mutateAsync],
  );
  const update = useCallback(
    (patch: SettingsPatch) => {
      void run("settings", (api) => api.updateSettings(patch));
    },
    [run],
  );
  return {
    run,
    update,
    pending: pendingKeys.at(-1) ?? "",
    isPending: (key: string) => pendingKeys.includes(key),
    error: mutation.error,
    clearError: reset,
  };
}
export type AppContextValue = ReturnType<typeof useDesktopActions> & {
  state: AppState;
  runtime: DesktopRuntime;
};
export const RuntimeContext = createContext<DesktopRuntime | null>(null);
export function useRuntime() {
  const value = useContext(RuntimeContext);
  if (!value) throw new Error("Desktop runtime is unavailable");
  return value;
}
export const AppContext = createContext<AppContextValue | null>(null);
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("AppContext is unavailable");
  return value;
}
