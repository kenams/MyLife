import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISSED_KEY = "mylife:pwa-install-dismissed";

function isStandalone(): boolean {
  return window.matchMedia?.("(display-mode: standalone)").matches
    || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone() || window.localStorage.getItem(DISMISSED_KEY) === "1") return;

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      setInstallEvent(null);
      window.localStorage.removeItem(DISMISSED_KEY);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!visible || !installEvent) return null;

  const dismiss = () => {
    window.localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  };

  const install = async () => {
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") {
      setVisible(false);
      setInstallEvent(null);
    }
  };

  return (
    <View pointerEvents="box-none" style={styles.layer}>
      <View style={styles.card} accessibilityRole="alert">
        <View style={styles.copy}>
          <Text style={styles.title}>Installer MyLife</Text>
          <Text style={styles.body}>Ajoute le jeu à ton écran d’accueil pour l’ouvrir comme une app.</Text>
        </View>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={dismiss} style={styles.secondary}>
            <Text style={styles.secondaryText}>Plus tard</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={install} style={styles.primary}>
            <Text style={styles.primaryText}>Installer</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 86,
    zIndex: 9999,
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 18,
    backgroundColor: "rgba(7, 17, 31, 0.96)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    padding: 14,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  copy: { gap: 4 },
  title: { color: "#fff", fontSize: 16, fontWeight: "800" },
  body: { color: "rgba(255,255,255,0.78)", fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  secondary: { minHeight: 44, justifyContent: "center", paddingHorizontal: 14 },
  secondaryText: { color: "rgba(255,255,255,0.72)", fontWeight: "700" },
  primary: {
    minHeight: 44,
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
  },
  primaryText: { color: "#07111f", fontWeight: "900" },
});
