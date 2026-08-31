import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import {
  ageRanges,
  ambitionLevels,
  bodyFrames,
  eyeColors,
  facialHairOptions,
  genderOptions,
  hairColors,
  hairLengths,
  hairTypes,
  interestOptions,
  jobs,
  lifeHabits,
  lifeRhythms,
  lookingForOptions,
  originStyles,
  outfitStyles,
  personalGoals,
  personalityTraits,
  photoStyles,
  preferredVibes,
  relationshipStyles,
  silhouettes,
  skinTones,
  sociabilityLevels,
  traitPreferences,
  toulouseDistrictOptions
} from "@/lib/game-data";
import { colors } from "@/lib/theme";
import type { AvatarProfile } from "@/lib/types";

function Card({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <View style={{
      backgroundColor: accent ? "rgba(13,26,45,0.96)" : "rgba(13,23,41,0.9)",
      borderRadius: 18,
      borderWidth: 1,
      borderColor: accent ? "rgba(88,214,163,0.24)" : colors.border,
      padding: 18,
      gap: 12
    }}>
      {children}
    </View>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <View style={{
      alignSelf: "flex-start",
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: "rgba(88,214,163,0.14)",
      borderWidth: 1,
      borderColor: "rgba(88,214,163,0.22)"
    }}>
      <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>{children}</Text>
    </View>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={{ color: colors.text, fontSize: 19, fontWeight: "800" }}>{children}</Text>;
}

function Muted({ children }: { children: React.ReactNode }) {
  return <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 22 }}>{children}</Text>;
}

function Input({
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: "default" | "email-address" | "numeric";
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      autoCapitalize="none"
      multiline={multiline}
      keyboardType={keyboardType}
      style={{
        minHeight: multiline ? 112 : 56,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.bgSoft,
        paddingHorizontal: 16,
        paddingTop: multiline ? 14 : undefined,
        color: colors.text,
        fontSize: 16,
        textAlignVertical: multiline ? "top" : "center"
      }}
    />
  );
}

function FormButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        minHeight: 54,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 18,
        backgroundColor: colors.accentStrong
      }}
    >
      <Text style={{ color: "#052117", fontWeight: "800", fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

function ChoiceGroup({
  label,
  options,
  selected,
  onSelect
}: {
  label: string;
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: colors.text, fontWeight: "700" }}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((option) => (
          <Text
            key={option}
            onPress={() => onSelect(option)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: selected === option ? "rgba(88,214,163,0.55)" : colors.border,
              backgroundColor: selected === option ? "rgba(88,214,163,0.14)" : colors.cardAlt,
              color: colors.text
            }}
          >
            {option}
          </Text>
        ))}
      </View>
    </View>
  );
}

function MultiChoiceGroup({
  label,
  options,
  selected,
  onToggle,
  limit
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  limit?: number;
}) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: colors.text, fontWeight: "700" }}>
        {label}
        {limit ? ` (${selected.length}/${limit})` : ""}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((option) => {
          const active = selected.includes(option);
          const blocked = !active && typeof limit === "number" && selected.length >= limit;

          return (
            <Text
              key={option}
              onPress={() => {
                if (!blocked) {
                  onToggle(option);
                }
              }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: active ? "rgba(139,124,255,0.6)" : colors.border,
                backgroundColor: active ? "rgba(139,124,255,0.18)" : colors.cardAlt,
                color: blocked ? colors.muted : colors.text,
                opacity: blocked ? 0.45 : 1
              }}
            >
              {option}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

function toggleInArray(list: string[], value: string, limit?: number) {
  if (list.includes(value)) {
    return list.filter((item) => item !== value);
  }
  if (typeof limit === "number" && list.length >= limit) {
    return list;
  }
  return [...list, value];
}

function numberValue(input: string, fallback: number) {
  const parsed = Number(input);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function AvatarForm({
  initialAvatar,
  initialDisplayName,
  submitLabel,
  onSubmit
}: {
  initialAvatar?: AvatarProfile | null;
  initialDisplayName?: string;
  submitLabel: string;
  onSubmit: (avatar: AvatarProfile) => void;
}) {
  const [displayName, setDisplayName] = useState(initialAvatar?.displayName ?? initialDisplayName ?? "");
  const [homeDistrict, setHomeDistrict] = useState(initialAvatar?.homeDistrict ?? toulouseDistrictOptions[0]);
  const [bio, setBio] = useState(initialAvatar?.bio ?? "");
  const [ageRange, setAgeRange] = useState(initialAvatar?.ageRange ?? ageRanges[2]);
  const [gender, setGender] = useState(initialAvatar?.gender ?? genderOptions[0]);
  const [photoStyle, setPhotoStyle] = useState(initialAvatar?.photoStyle ?? photoStyles[0]);
  const [heightCm, setHeightCm] = useState(String(initialAvatar?.heightCm ?? 172));
  const [weightKg, setWeightKg] = useState(String(initialAvatar?.weightKg ?? 72));
  const [bodyFrame, setBodyFrame] = useState(initialAvatar?.bodyFrame ?? bodyFrames[1]);
  const [skinTone, setSkinTone] = useState(initialAvatar?.skinTone ?? skinTones[2]);
  const [hairType, setHairType] = useState(initialAvatar?.hairType ?? hairTypes[0]);
  const [hairColor, setHairColor] = useState(initialAvatar?.hairColor ?? hairColors[0]);
  const [hairLength, setHairLength] = useState(initialAvatar?.hairLength ?? hairLengths[1]);
  const [eyeColor, setEyeColor] = useState(initialAvatar?.eyeColor ?? eyeColors[0]);
  const [outfitStyle, setOutfitStyle] = useState(initialAvatar?.outfitStyle ?? outfitStyles[0]);
  const [facialHair, setFacialHair] = useState(initialAvatar?.facialHair ?? facialHairOptions[0]);
  const [silhouette, setSilhouette] = useState(initialAvatar?.silhouette ?? silhouettes[2]);
  const [originStyle, setOriginStyle] = useState(initialAvatar?.originStyle ?? originStyles[0]);
  const [personalityTrait, setPersonalityTrait] = useState(initialAvatar?.personalityTrait ?? personalityTraits[0]);
  const [sociabilityStyle, setSociabilityStyle] = useState(initialAvatar?.sociabilityStyle ?? sociabilityLevels[1]);
  const [ambition, setAmbition] = useState(initialAvatar?.ambition ?? ambitionLevels[1]);
  const [lifeRhythm, setLifeRhythm] = useState(initialAvatar?.lifeRhythm ?? lifeRhythms[1]);
  const [relationshipStyle, setRelationshipStyle] = useState(initialAvatar?.relationshipStyle ?? relationshipStyles[0]);
  const [personalGoal, setPersonalGoal] = useState(initialAvatar?.personalGoal ?? personalGoals[0]);
  const [lifeHabit, setLifeHabit] = useState(initialAvatar?.lifeHabit ?? lifeHabits[0]);
  const [friendshipIntent, setFriendshipIntent] = useState(initialAvatar?.friendshipIntent ?? "cercle authentique");
  const [romanceIntent, setRomanceIntent] = useState(initialAvatar?.romanceIntent ?? "rencontres calmes");
  const [preferredVibe, setPreferredVibe] = useState(initialAvatar?.preferredVibe ?? preferredVibes[0]);
  const [starterJob, setStarterJob] = useState(initialAvatar?.starterJob ?? jobs[0].slug);
  const [interests, setInterests] = useState<string[]>(initialAvatar?.interests ?? ["sport", "sorties"]);
  const [leisureStyles, setLeisureStyles] = useState<string[]>(initialAvatar?.leisureStyles ?? ["sport", "food"]);
  const [lookingFor, setLookingFor] = useState<string[]>(initialAvatar?.lookingFor ?? ["amis", "crew"]);
  const [favoriteActivities, setFavoriteActivities] = useState<string[]>(initialAvatar?.favoriteActivities ?? ["sport", "sorties"]);
  const [favoriteOutingsState, setFavoriteOutingsState] = useState<string[]>(initialAvatar?.favoriteOutings ?? ["cafe", "park"]);
  const [appreciatedTraits, setAppreciatedTraits] = useState<string[]>(initialAvatar?.appreciatedTraits ?? ["fiable", "douceur"]);

  const summary = useMemo(
    () => `${homeDistrict} · ${personalGoal} · ${interests.slice(0, 2).join(" / ")}`,
    [homeDistrict, interests, personalGoal]
  );

  function submit() {
    if (!displayName.trim()) {
      return;
    }

    onSubmit({
      displayName: displayName.trim(),
      homeDistrict,
      ageRange,
      gender,
      photoStyle,
      bio: bio.trim() || "Recherche un rythme stable, des liens propres et une progression visible.",
      heightCm: numberValue(heightCm, 172),
      weightKg: numberValue(weightKg, 72),
      bodyFrame,
      skinTone,
      hairType,
      hairColor,
      hairLength,
      eyeColor,
      outfitStyle,
      facialHair,
      silhouette,
      originStyle,
      personalityTrait,
      sociabilityStyle,
      ambition,
      lifeRhythm,
      interests,
      leisureStyles,
      relationshipStyle,
      personalGoal,
      lifeHabit,
      lookingFor,
      friendshipIntent,
      romanceIntent,
      favoriteActivities,
      favoriteOutings: favoriteOutingsState,
      preferredVibe,
      appreciatedTraits,
      starterJob
    });
  }

  return (
    <View style={{ gap: 16 }}>
      <Card accent>
        <Pill>Profil joueur</Pill>
        <SectionTitle>{displayName.trim() || "Ton pseudo MyLife"}</SectionTitle>
        <Muted>{summary}</Muted>
      </Card>

      <Card>
        <Input value={displayName} onChangeText={setDisplayName} placeholder="Prénom ou pseudo" />
        <ChoiceGroup
          label="Quartier approximatif"
          options={toulouseDistrictOptions}
          selected={homeDistrict}
          onSelect={setHomeDistrict}
        />
        <MultiChoiceGroup
          label="Centres d'intérêt"
          options={interestOptions}
          selected={interests}
          onToggle={(value) => {
            setInterests((current) => toggleInArray(current, value, 4));
            setLeisureStyles((current) => toggleInArray(current, value, 4));
            setFavoriteActivities((current) => toggleInArray(current, value, 4));
          }}
          limit={4}
        />
        <ChoiceGroup label="Objectif principal" options={personalGoals} selected={personalGoal} onSelect={setPersonalGoal} />
      </Card>

      <Card>
        <SectionTitle>Avatar</SectionTitle>
        <ChoiceGroup label="Style avatar" options={photoStyles} selected={photoStyle} onSelect={setPhotoStyle} />
        <ChoiceGroup label="Style vestimentaire" options={outfitStyles} selected={outfitStyle} onSelect={setOutfitStyle} />
        <ChoiceGroup label="Ambiance" options={preferredVibes} selected={preferredVibe} onSelect={setPreferredVibe} />
        <Input value={bio} onChangeText={setBio} placeholder="Bio courte optionnelle" multiline />
      </Card>

      <Card>
        <SectionTitle>Intention sociale</SectionTitle>
        <MultiChoiceGroup
          label="Je cherche"
          options={lookingForOptions}
          selected={lookingFor}
          onToggle={(value) => setLookingFor((current) => toggleInArray(current, value, 4))}
          limit={4}
        />
        <Input value={friendshipIntent} onChangeText={setFriendshipIntent} placeholder="Ce que tu veux construire ici" />
        <Input value={romanceIntent} onChangeText={setRomanceIntent} placeholder="Rencontres: ton cadre et tes limites" />
      </Card>

      <FormButton label={submitLabel} onPress={submit} />
    </View>
  );
}
