import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/lib/theme";

// ─── NavBack — bouton retour universel ───────────────────────────────────────
export function NavBack({ fallback }: { fallback: string }) {
  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallback as never);
    }
  };
  return (
    <Pressable
      onPress={goBack}
      style={{
        flexDirection: "row", alignItems: "center", gap: 6,
        paddingHorizontal: 12, paddingVertical: 8,
        borderRadius: 10, backgroundColor: "rgba(255,255,255,0.06)",
        alignSelf: "flex-start"
      }}
      hitSlop={12}
    >
      <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>←</Text>
      <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>Retour</Text>
    </Pressable>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <LinearGradient colors={["#050d18", "#0b1730", "#09111d"]} style={StyleSheet.absoluteFill}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

export function Card({
  children,
  accent = false
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  return <View style={[styles.card, accent ? styles.cardAccent : null]}>{children}</View>;
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        variant === "secondary" ? styles.buttonSecondary : null,
        variant === "ghost" ? styles.buttonGhost : null,
        variant === "primary" ? styles.buttonPrimary : null,
        disabled ? styles.buttonDisabled : null
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          variant === "secondary" ? styles.buttonSecondaryText : null,
          variant === "ghost" ? styles.buttonGhostText : null
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Pill({
  children,
  tone = "accent"
}: {
  children: React.ReactNode;
  tone?: "accent" | "muted" | "warning";
}) {
  return (
    <View
      style={[
        styles.pill,
        tone === "muted" ? styles.pillMuted : null,
        tone === "warning" ? styles.pillWarning : null
      ]}
    >
      <Text style={styles.pillText}>{children}</Text>
    </View>
  );
}

export function Input({
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  multiline = false,
  keyboardType
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
  keyboardType?: "default" | "email-address" | "numeric";
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      secureTextEntry={secureTextEntry}
      autoCapitalize="none"
      multiline={multiline}
      keyboardType={keyboardType}
      style={[styles.input, multiline ? styles.inputMultiline : null]}
    />
  );
}

export function MetricCard({
  label,
  value,
  hint
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricHint}>{hint}</Text>
    </View>
  );
}

export function StatMeter({
  label,
  value,
  tone = "accent"
}: {
  label: string;
  value: number;
  tone?: "accent" | "warning" | "danger" | "violet";
}) {
  const background =
    tone === "danger" ? colors.danger : tone === "warning" ? colors.warning : tone === "violet" ? colors.accentSecondary : colors.accentStrong;

  return (
    <View style={{ gap: 8 }}>
      <View style={styles.statHeader}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{Math.round(value)}%</Text>
      </View>
      <View style={styles.statTrack}>
        <View style={[styles.statFill, { width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: background }]} />
      </View>
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  right
}: {
  title: string;
  subtitle: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.listRow}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.listTitle}>{title}</Text>
        <Text style={styles.listSubtitle}>{subtitle}</Text>
      </View>
      {right}
    </View>
  );
}

export function AvatarBadge({
  title,
  subtitle,
  tone = "accent"
}: {
  title: string;
  subtitle: string;
  tone?: "accent" | "violet";
}) {
  return (
    <LinearGradient
      colors={tone === "violet" ? ["#1b1733", "#241f49"] : ["#10243d", "#0f1a30"]}
      style={styles.avatarBadge}
    >
      <View style={styles.avatarCore}>
        <Text style={styles.avatarInitial}>{title.slice(0, 2).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.avatarTitle}>{title}</Text>
        <Text style={styles.avatarSubtitle}>{subtitle}</Text>
      </View>
    </LinearGradient>
  );
}

export const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 40, gap: 16 },
  card: {
    backgroundColor: "rgba(13, 23, 41, 0.9)",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 }
  },
  cardAccent: {
    borderColor: "rgba(88,214,163,0.24)",
    backgroundColor: "rgba(13, 26, 45, 0.96)"
  },
  title: { color: colors.text, fontSize: 30, fontWeight: "800", lineHeight: 36 },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: "800" },
  muted: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  button: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18
  },
  buttonPrimary: {
    backgroundColor: colors.accentStrong
  },
  buttonSecondary: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border
  },
  buttonGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)"
  },
  buttonText: { color: "#052117", fontWeight: "800", fontSize: 16 },
  buttonSecondaryText: { color: colors.text },
  buttonGhostText: { color: colors.text },
  buttonDisabled: { opacity: 0.45 },
  pill: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(88,214,163,0.14)",
    borderWidth: 1,
    borderColor: "rgba(88,214,163,0.22)"
  },
  pillMuted: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.08)"
  },
  pillWarning: {
    backgroundColor: "rgba(246,185,79,0.12)",
    borderColor: "rgba(246,185,79,0.2)"
  },
  pillText: { color: colors.text, fontSize: 12, fontWeight: "700" },
  input: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSoft,
    paddingHorizontal: 16,
    color: colors.text,
    fontSize: 16
  },
  inputMultiline: {
    minHeight: 112,
    paddingTop: 14,
    textAlignVertical: "top"
  },
  metricCard: {
    flex: 1,
    minWidth: 140,
    padding: 14,
    borderRadius: 20,
    backgroundColor: colors.cardAlt,
    gap: 4
  },
  metricLabel: { color: colors.muted, fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  metricValue: { color: colors.text, fontSize: 24, fontWeight: "800" },
  metricHint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  statHeader: { flexDirection: "row", justifyContent: "space-between" },
  statLabel: { color: colors.text, fontSize: 14, fontWeight: "700" },
  statValue: { color: colors.muted, fontSize: 13 },
  statTrack: { height: 8, backgroundColor: colors.bgSoft, borderRadius: 999, overflow: "hidden" },
  statFill: { height: 8, borderRadius: 999 },
  listRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    paddingVertical: 10
  },
  listTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  listSubtitle: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  avatarBadge: {
    borderRadius: 22,
    padding: 14,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)"
  },
  avatarCore: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center"
  },
  avatarInitial: { color: colors.text, fontSize: 16, fontWeight: "800" },
  avatarTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  avatarSubtitle: { color: colors.muted, fontSize: 13, marginTop: 2 }
});
