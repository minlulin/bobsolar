import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  theme: "light" | "dark";
  toggleTheme: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  commandBarOpen: boolean;
  setCommandBarOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: "dark",
      toggleTheme: (): void => {
        set((state) => ({ theme: state.theme === "light" ? "dark" : "light" }));
      },
      sidebarOpen: false,
      setSidebarOpen: (open: boolean): void => {
        set({ sidebarOpen: open });
      },
      commandBarOpen: false,
      setCommandBarOpen: (open: boolean): void => {
        set({ commandBarOpen: open });
      },
    }),
    {
      name: "bob-solar-ui",
    },
  ),
);
