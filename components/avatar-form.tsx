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
  traitPreferences
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
  submitLabel,
  onSubmit
}: {
  initialAvatar?: AvatarProfile | null;
  submitLabel: string;
  onSubmit: (avatar: AvatarProfile) => void;
}) {
  const [displayName, setDisplayName] = useState(initialAvatar?.displayName ?? "");
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
  const [interests, setInterests] = useState<string[]>(initialAvatar?.interests ?? ["wellness", "coffee"]);
  const [leisureStyles, setLeisureStyles] = useState<string[]>(initialAvatar?.leisureStyles ?? ["fitness", "cinema"]);
  const [lookingFor, setLookingFor] = useState<string[]>(initialAvatar?.lookingFor ?? ["amis", "motivation"]);
  const [favoriteActivities, setFavoriteActivities] = useState<string[]>(initialAvatar?.favoriteActivities ?? ["fitness", "coffee"]);
  const [favoriteOutingsState, setFavoriteOutingsState] = useState<string[]>(initialAvatar?.favoriteOutings ?? ["coffee", "cinema"]);
  const [appreciatedTraits, setAppreciatedTraits] = useState<string[]>(initialAvatar?.appreciatedTraits ?? ["fiable", "douceur"]);

  const summary = useMemo(
    () => `${personalityTrait} · ${ambition} · ${sociabilityStyle} · ${starterJob}`,
    [ambition, personalityTrait, sociabilityStyle, starterJob]
  );

  function submit() {
    if (!displayName.trim()) {
      return;
    }

    onSubmit({
      displayName: displayName.trim(),
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
        <Pill>Identité</Pill>
        <SectionTitle>{displayName.trim() || "Avatar premium"}</SectionTitle>
        <Muted>{summary}</Muted>
      </Card>

      <Card>
        <Input value={displayName} onChangeText={setDisplayName} placeholder="Prénom ou pseudo" />
        <Input value={bio} onChangeText={setBio} placeholder="Bio courte" multiline />
        <ChoiceGroup label="Tranche d'âge" options={ageRanges} selected={ageRange} onSelect={setAgeRange} />
        <ChoiceGroup label="Genre" options={genderOptions} selected={gender} onSelect={setGender} />
        <ChoiceGroup label="Style photo" options={photoStyles} selected={photoStyle} onSelect={setPhotoStyle} />
        <ChoiceGroup label="Origine / style" options={originStyles} selected={originStyle} onSelect={setOriginStyle} />
      </Card>

      <Card>
        <SectionTitle>Physique et présence</SectionTitle>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Input value={heightCm} onChangeText={setHeightCm} placeholder="Taille (cm)" keyboardType="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <Input value={weightKg} onChangeText={setWeightKg} placeholder="Poids (kg)" keyboardType="numeric" />
          </View>
        </View>
        <ChoiceGroup label="Corpulence" options={bodyFrames} selected={bodyFrame} onSelect={setBodyFrame} />
        <ChoiceGroup label="Silhouette" options={silhouettes} selected={silhouette} onSelect={setSilhouette} />
        <ChoiceGroup label="Peau" options={skinTones} selected={skinTone} onSelect={setSkinTone} />
        <ChoiceGroup label="Cheveux" options={hairTypes} selected={hairType} onSelect={setHairType} />
        <ChoiceGroup label="Couleur cheveux" options={hairColors} selected={hairColor} onSelect={setHairColor} />
        <ChoiceGroup label="Longueur cheveux" options={hairLengths} selected={hairLength} onSelect={setHairLength} />
        <ChoiceGroup label="Yeux" options={eyeColors} selected={eyeColor} onSelect={setEyeColor} />
        <ChoiceGroup label="Style vestimentaire" options={outfitStyles} selected={outfitStyle} onSelect={setOutfitStyle} />
        <ChoiceGroup label="Barbe / moustache" options={facialHairOptions} selected={facialHair} onSelect={setFacialHair} />
      </Card>

      <Card>
        <SectionTitle>Profil comportemental</SectionTitle>
        <ChoiceGroup label="Trait principal" options={personalityTraits} selected={personalityTrait} onSelect={setPersonalityTrait} />
        <ChoiceGroup label="Sociabilité" options={sociabilityLevels} selected={sociabilityStyle} onSelect={setSociabilityStyle} />
        <ChoiceGroup label="Ambition" options={ambitionLevels} selected={ambition} onSelect={setAmbition} />
        <ChoiceGroup label="Rythme de vie" options={lifeRhythms} selected={lifeRhythm} onSelect={setLifeRhythm} />
        <ChoiceGroup label="Style relationnel" options={relationshipStyles} selected={relationshipStyle} onSelect={setRelationshipStyle} />
        <ChoiceGroup label="Objectif personnel" options={personalGoals} selected={personalGoal} onSelect={setPersonalGoal} />
        <ChoiceGroup label="Habitude dominante" options={lifeHabits} selected={lifeHabit} onSelect={setLifeHabit} />
        <ChoiceGroup label="Métier de départ" options={jobs.map((job) => job.slug)} selected={starterJob} onSelect={setStarterJob} />
      </Card>

      <Card>
        <SectionTitle>Vie sociale et préférences</SectionTitle>
        <Input value={friendshipIntent} onChangeText={setFriendshipIntent} placeholder="Ce que tu cherches en amitié" />
        <Input value={romanceIntent} onChangeText={setRomanceIntent} placeholder="Vision des rencontres" />
        <ChoiceGroup label="Ambiance préférée" options={preferredVibes} selected={preferredVibe} onSelect={setPreferredVibe} />
        <MultiChoiceGroup
          label="Centres d'intérêt"
          options={interestOptions}
          selected={interests}
          onToggle={(value) => setInterests((current) => toggleInArray(current, value, 4))}
          limit={4}
        />
        <MultiChoiceGroup
          label="Loisirs"
          options={interestOptions}
          selected={leisureStyles}
          onToggle={(value) => setLeisureStyles((current) => toggleInArray(current, value, 3))}
          limit={3}
        />
        <MultiChoiceGroup
          label="Ce que tu recherches"
          options={lookingForOptions}
          selected={lookingFor}
          onToggle={(value) => setLookingFor((current) => toggleInArray(current, value, 4))}
          limit={4}
        />
        <MultiChoiceGroup
          label="Activités préférées"
          options={interestOptions}
          selected={favoriteActivities}
          onToggle={(value) => setFavoriteActivities((current) => toggleInArray(current, value, 3))}
          limit={3}
        />
        <MultiChoiceGroup
          label="Sorties préférées"
          options={["coffee", "cinema", "restaurant", "park", "gym"]}
          selected={favoriteOutingsState}
          onToggle={(value) => setFavoriteOutingsState((current) => toggleInArray(current, value, 3))}
          limit={3}
        />
        <MultiChoiceGroup
          label="Traits appréciés"
          options={traitPreferences}
          selected={appreciatedTraits}
          onToggle={(value) => setAppreciatedTraits((current) => toggleInArray(current, value, 3))}
          limit={3}
        />
      </Card>

      <FormButton label={submitLabel} onPress={submit} />
    </View>
  );
}
