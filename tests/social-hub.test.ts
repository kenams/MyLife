import { describe, expect, it } from "vitest";

import { buildSocialHubSnapshot, relationshipScore } from "@/lib/social-hub";
import type { Conversation, InvitationRecord, NpcState, RelationshipRecord, Room, RoomInvite } from "@/lib/types";

function npc(id: string, online: boolean): NpcState {
  return {
    id,
    name: id,
    locationSlug: "cafe",
    action: "chatting",
    mood: 70,
    energy: 70,
    hunger: 70,
    stress: 20,
    hygiene: 80,
    money: 100,
    xp: 0,
    level: 1,
    reputation: 30,
    streak: 0,
    lastTickAt: "2026-04-18T10:00:00.000Z",
    lastMessageAt: null,
    lastInviteAt: null,
    posX: 50,
    posY: 50,
    presenceOnline: online,
    lastOnlineAt: null
  };
}

function relationship(residentId: string, score: number): RelationshipRecord {
  return {
    residentId,
    status: "ami",
    score,
    quality: "stable",
    influence: "positive",
    lastInteractionAt: "2026-04-18T10:00:00.000Z",
    isFollowing: true
  };
}

function conversation(id: string, createdAt: string, unreadCount = 0): Conversation {
  return {
    id,
    peerId: id,
    title: id,
    subtitle: "conversation",
    kind: "direct",
    locationSlug: null,
    unreadCount,
    messages: [{
      id: `${id}-message`,
      authorId: id,
      body: "hello",
      createdAt,
      read: unreadCount === 0,
      kind: "message"
    }]
  };
}

function room(id: string, isActive = true): Room {
  return {
    id,
    name: id,
    kind: "public",
    code: id.toUpperCase().slice(0, 6),
    ownerId: "system",
    ownerName: "Systeme",
    locationSlug: "cafe",
    memberCount: 1,
    maxMembers: 20,
    description: "room",
    createdAt: "2026-04-18T10:00:00.000Z",
    isActive
  };
}

describe("social-hub", () => {
  it("builds a stable view-model for the chat hub", () => {
    const pendingRoomInvite: RoomInvite = {
      id: "invite-room",
      roomId: "room-live",
      roomName: "Room live",
      fromId: "ava",
      fromName: "Ava",
      toId: "Kenan",
      status: "pending",
      createdAt: "2026-04-18T10:00:00.000Z"
    };
    const pendingInvitation: InvitationRecord = {
      id: "invite-activity",
      residentId: "ava",
      residentName: "Ava",
      activitySlug: "cafe-chat",
      status: "pending",
      createdAt: "2026-04-18T10:00:00.000Z"
    };

    const snapshot = buildSocialHubSnapshot({
      avatar: { displayName: "Kenan" } as never,
      conversations: [
        conversation("old", "2026-04-18T08:00:00.000Z", 2),
        conversation("new", "2026-04-18T11:00:00.000Z", 1)
      ],
      npcs: [npc("ava", true), npc("noa", true), npc("yan", false)],
      relationships: [relationship("ava", 65), relationship("noa", 20)],
      rooms: [room("room-live"), room("room-hidden", false), room("room-other")],
      joinedRooms: ["room-live"],
      roomInvites: [pendingRoomInvite, { ...pendingRoomInvite, id: "ignored", toId: "Other" }],
      invitations: [pendingInvitation, { ...pendingInvitation, id: "done", status: "accepted" }],
      roomMessages: {
        "room-lounge-global": [{
          id: "last",
          authorId: "ava",
          authorName: "Ava",
          body: "Dernier message",
          createdAt: "2026-04-18T11:30:00.000Z",
          kind: "message"
        }]
      }
    });

    expect(snapshot.onlineNpcs.map((item) => item.id)).toEqual(["ava", "noa"]);
    expect(snapshot.friendOnline.map((item) => item.id)).toEqual(["ava"]);
    expect(snapshot.sortedConversations.map((item) => item.id)).toEqual(["new", "old"]);
    expect(snapshot.myRooms.map((item) => item.id)).toEqual(["room-live"]);
    expect(snapshot.otherRooms.map((item) => item.id)).toEqual(["room-other"]);
    expect(snapshot.pendingRoomInvites).toHaveLength(1);
    expect(snapshot.pendingInvitations).toHaveLength(1);
    expect(snapshot.unreadTotal).toBe(3);
    expect(snapshot.loungeLastMessage?.body).toBe("Dernier message");
  });

  it("returns zero when a relationship does not exist", () => {
    expect(relationshipScore([relationship("ava", 72)], "noa")).toBe(0);
  });
});
