import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISSED_KEY = "mylife:pwa-install-dismissed-at";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

function isStandalone(): boolean {
  return window.matchMedia?.("(display-mode: standalone)").matches
    || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}

function isIosSafari(): boolean {
  const ua = window.navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua)
    || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return ios && safari;
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const iosSafari = useMemo(isIosSafari, []);

  useEffect(() => {
    if (isStandalone()) return;

    const dismissedAt = Number(window.localStorage.getItem(DISMISSED_KEY) || 0);
    if (Date.now() - dismissedAt < DISMISS_MS) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const showLater = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setVisible(true), 8_000);
    };

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      showLater();
    };
    const onInstalled = () => {
      setVisible(false);
      setInstallEvent(null);
      window.localStorage.removeItem(DISMISSED_KEY);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    if (iosSafari) showLater();

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [iosSafari]);

  if (!visible || (!installEvent && !iosSafari)) return null;

  const dismiss = () => {
    window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setVisible(false);
    setShowIosHelp(false);
  };

  const install = async () => {
    if (!installEvent) {
      if (showIosHelp) dismiss();
      else setShowIosHelp(true);
      return;
    }

    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") {
      setVisible(false);
      setInstallEvent(null);
    } else {
      dismiss();
    }
  };

  return (
    <View pointerEvents="box-none" style={styles.layer}>
      <View style={styles.card} accessibilityRole="alert">
        <View style={styles.copy}>
          <Text style={styles.title}>MyLife sur ton téléphone</Text>
          <Text style={styles.body}>
            {showIosHelp
              ? "Safari : touche Partager puis Sur l’écran d’accueil."
              : "Installe MyLife comme une app et ouvre directement la Map."}
          </Text>
        </View>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={dismiss} style={styles.secondary}>
            <Text style={styles.secondaryText}>Plus tard</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={install} style={styles.primary}>
            <Text style={styles.primaryText}>
              {iosSafari ? (showIosHelp ? "OK" : "Comment ?") : "Installer"}
            </Text>
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
    top: 12,
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
