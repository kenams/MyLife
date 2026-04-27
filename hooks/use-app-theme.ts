import { THEMES } from "@/lib/themes";
import { useGameStore } from "@/stores/game-store";

export function useAppTheme() {
  const themeId = useGameStore((s) => s.appTheme);
  return THEMES[themeId] ?? THEMES["clean-life"];
}
