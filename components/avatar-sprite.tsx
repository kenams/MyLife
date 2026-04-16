import React, { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";

import type { AvatarAction, AvatarVisual } from "@/lib/avatar-visual";
import { ACTION_COLORS } from "@/lib/avatar-visual";

export type AvatarSpriteSize = "xs" | "sm" | "md" | "lg";

const SIZE_MAP: Record<AvatarSpriteSize, number> = {
  xs: 32,
  sm: 48,
  md: 72,
  lg: 96
};

type Props = {
  visual: AvatarVisual;
  action?: AvatarAction;
  size?: AvatarSpriteSize;
  showBubble?: boolean;
};

// ─── Sprite SVG ───────────────────────────────────────────────────────────────
function CharacterSVG({
  v,
  w,
  action = "idle"
}: {
  v: AvatarVisual;
  w: number;
  action: AvatarAction;
}) {
  // Proportions relatives à w
  const h     = w * 1.5;
  const cx    = w / 2;
  const headR = w * 0.18;
  const headY = headR + w * 0.04;
  const bodyW = v.silhouette === "robuste" ? w * 0.38 : v.silhouette === "mince" ? w * 0.24 : w * 0.30;
  const bodyH = w * 0.32;
  const bodyY = headY + headR + w * 0.02;
  const bodyX = cx - bodyW / 2;
  const legW  = bodyW * 0.42;
  const legH  = w * 0.28;
  const legY  = bodyY + bodyH;
  const armW  = w * 0.1;
  const armH  = bodyH * 0.9;

  // Bras oscillants selon action
  const leftArmRot  = action === "walking" || action === "exercising" ? -18 : action === "waving" ? -50 : -8;
  const rightArmRot = action === "walking" || action === "exercising" ?  18 : action === "waving" ?  10 :  8;

  // Jambes selon action
  const leftLegRot  = action === "walking" ?  14 : action === "exercising" ?  20 : 0;
  const rightLegRot = action === "walking" ? -14 : action === "exercising" ? -20 : 0;

  // Hair path selon longueur
  const hairPath = v.hairLength === "long"
    ? `M ${cx - headR} ${headY} Q ${cx - headR * 1.4} ${headY + headR * 2.5} ${cx - headR * 1.1} ${headY + headR * 3.2} Q ${cx} ${headY - headR * 0.3} ${cx + headR * 1.1} ${headY + headR * 3.2} Q ${cx + headR * 1.4} ${headY + headR * 2.5} ${cx + headR} ${headY} Z`
    : v.hairLength === "mi-long"
    ? `M ${cx - headR} ${headY} Q ${cx - headR * 1.3} ${headY + headR * 1.5} ${cx - headR * 1.0} ${headY + headR * 2} Q ${cx} ${headY - headR * 0.3} ${cx + headR * 1.0} ${headY + headR * 2} Q ${cx + headR * 1.3} ${headY + headR * 1.5} ${cx + headR} ${headY} Z`
    : `M ${cx - headR} ${headY - headR * 0.2} Q ${cx} ${headY - headR * 1.1} ${cx + headR} ${headY - headR * 0.2} Q ${cx + headR * 0.8} ${headY - headR * 0.5} ${cx} ${headY - headR * 0.5} Q ${cx - headR * 0.8} ${headY - headR * 0.5} ${cx - headR} ${headY - headR * 0.2} Z`;

  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>

      {/* Bras gauche */}
      <Rect
        x={bodyX - armW + 1}
        y={bodyY}
        width={armW}
        height={armH}
        rx={armW / 2}
        fill={v.outfitTop}
        origin={`${bodyX}, ${bodyY}`}
        rotation={leftArmRot}
      />

      {/* Bras droit */}
      <Rect
        x={bodyX + bodyW - 1}
        y={bodyY}
        width={armW}
        height={armH}
        rx={armW / 2}
        fill={v.outfitTop}
        origin={`${bodyX + bodyW}, ${bodyY}`}
        rotation={rightArmRot}
      />

      {/* Corps */}
      <Rect
        x={bodyX}
        y={bodyY}
        width={bodyW}
        height={bodyH}
        rx={bodyW * 0.18}
        fill={v.outfitTop}
      />

      {/* Jambe gauche */}
      <Rect
        x={cx - legW - 1}
        y={legY}
        width={legW}
        height={legH}
        rx={legW / 2}
        fill={v.outfitBottom}
        origin={`${cx - legW / 2 - 1}, ${legY}`}
        rotation={leftLegRot}
      />

      {/* Jambe droite */}
      <Rect
        x={cx + 1}
        y={legY}
        width={legW}
        height={legH}
        rx={legW / 2}
        fill={v.outfitBottom}
        origin={`${cx + legW / 2 + 1}, ${legY}`}
        rotation={rightLegRot}
      />

      {/* Chaussures */}
      <Ellipse cx={cx - legW / 2 - 1} cy={legY + legH} rx={legW * 0.6} ry={legW * 0.25} fill="#1a1a1a" />
      <Ellipse cx={cx + legW / 2 + 1} cy={legY + legH} rx={legW * 0.6} ry={legW * 0.25} fill="#1a1a1a" />

      {/* Cou */}
      <Rect
        x={cx - headR * 0.35}
        y={headY + headR * 0.7}
        width={headR * 0.7}
        height={w * 0.06}
        fill={v.skinColor}
      />

      {/* Tête */}
      <Circle cx={cx} cy={headY} r={headR} fill={v.skinColor} />

      {/* Cheveux */}
      <Path d={hairPath} fill={v.hairColor} />

      {/* Yeux */}
      <Circle cx={cx - headR * 0.4} cy={headY - headR * 0.1} r={headR * 0.16} fill={v.eyeColor} />
      <Circle cx={cx + headR * 0.4} cy={headY - headR * 0.1} r={headR * 0.16} fill={v.eyeColor} />
      {/* Pupilles */}
      <Circle cx={cx - headR * 0.4} cy={headY - headR * 0.08} r={headR * 0.08} fill="#07111f" />
      <Circle cx={cx + headR * 0.4} cy={headY - headR * 0.08} r={headR * 0.08} fill="#07111f" />

      {/* Bouche */}
      <Path
        d={`M ${cx - headR * 0.3} ${headY + headR * 0.35} Q ${cx} ${headY + headR * 0.55} ${cx + headR * 0.3} ${headY + headR * 0.35}`}
        stroke="#c07d52"
        strokeWidth={headR * 0.1}
        fill="none"
        strokeLinecap="round"
      />

      {/* Barbe si applicable */}
      {v.hasBeard && (
        <Path
          d={`M ${cx - headR * 0.5} ${headY + headR * 0.3} Q ${cx} ${headY + headR * 0.9} ${cx + headR * 0.5} ${headY + headR * 0.3}`}
          fill={v.hairColor}
          opacity={0.7}
        />
      )}

      {/* Sleeping ZZZ */}
      {action === "sleeping" && (
        <>
          <Rect x={cx + headR} y={headY - headR * 1.5} width={headR * 1.2} height={headR * 0.9} rx={4} fill="rgba(155,89,182,0.3)" />
          <Path
            d={`M ${cx + headR * 1.1} ${headY - headR * 1.4} L ${cx + headR * 2} ${headY - headR * 1.4} L ${cx + headR * 1.1} ${headY - headR * 0.7} L ${cx + headR * 2} ${headY - headR * 0.7}`}
            stroke="#9b59b6"
            strokeWidth={1.5}
            fill="none"
          />
        </>
      )}

      {/* Chat bubble dot */}
      {action === "chatting" && (
        <>
          <Circle cx={cx + headR * 1.2} cy={headY - headR * 1.3} r={headR * 0.15} fill="#2ecc71" />
          <Circle cx={cx + headR * 1.6} cy={headY - headR * 1.5} r={headR * 0.1} fill="#2ecc71" />
          <Circle cx={cx + headR * 1.9} cy={headY - headR * 1.7} r={headR * 0.07} fill="#2ecc71" />
        </>
      )}
    </Svg>
  );
}

// ─── Composant principal avec animation ───────────────────────────────────────
export function AvatarSprite({ visual, action = "idle", size = "md", showBubble = false }: Props) {
  const w = SIZE_MAP[size];
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (action === "idle" || action === "sleeping") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(bounceAnim, { toValue: -2, duration: 1200, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
          Animated.timing(bounceAnim, { toValue: 0, duration: 1200, useNativeDriver: true, easing: Easing.inOut(Easing.sin) })
        ])
      ).start();
    } else if (action === "walking") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(bounceAnim, { toValue: -3, duration: 250, useNativeDriver: true }),
          Animated.timing(bounceAnim, { toValue: 0, duration: 250, useNativeDriver: true })
        ])
      ).start();
    } else if (action === "exercising") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(bounceAnim, { toValue: -6, duration: 200, useNativeDriver: true }),
          Animated.timing(bounceAnim, { toValue: 0, duration: 200, useNativeDriver: true })
        ])
      ).start();
    } else if (action === "waving") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(bounceAnim, { toValue: -4, duration: 300, useNativeDriver: true }),
          Animated.timing(bounceAnim, { toValue: 0, duration: 300, useNativeDriver: true })
        ])
      ).start();
    } else {
      bounceAnim.setValue(0);
    }
  }, [action]);

  const dotColor = ACTION_COLORS[action];

  return (
    <View style={{ alignItems: "center", gap: 2 }}>
      {showBubble && (
        <View style={{
          backgroundColor: dotColor,
          borderRadius: 8,
          paddingHorizontal: 5,
          paddingVertical: 2,
          marginBottom: 2
        }}>
        </View>
      )}
      <Animated.View style={{ transform: [{ translateY: bounceAnim }] }}>
        <CharacterSVG v={visual} w={w} action={action} />
      </Animated.View>
      {/* Indicateur action */}
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dotColor, opacity: 0.8 }} />
    </View>
  );
}

// ─── Mini-sprite (dot + couleur) pour la carte monde ─────────────────────────
export function AvatarDot({ visual, size = 10 }: { visual: AvatarVisual; size?: number }) {
  return (
    <View style={{
      width: size,
      height: size * 1.5,
      alignItems: "center",
      justifyContent: "flex-end"
    }}>
      <View style={{ width: size * 0.7, height: size * 0.7, borderRadius: size, backgroundColor: visual.skinColor, borderWidth: 1, borderColor: visual.outfitTop }} />
      <View style={{ width: size * 0.5, height: size * 0.5, backgroundColor: visual.outfitTop, borderRadius: 2 }} />
    </View>
  );
}
