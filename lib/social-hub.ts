import type {
  AvatarProfile,
  Conversation,
  InvitationRecord,
  NpcState,
  RelationshipRecord,
  Room,
  RoomInvite,
  RoomMessage
} from "@/lib/types";

export type SocialHubInput = {
  avatar: AvatarProfile | null;
  conversations: Conversation[];
  npcs: NpcState[];
  relationships: RelationshipRecord[];
  rooms: Room[];
  joinedRooms: string[];
  roomInvites: RoomInvite[];
  invitations: InvitationRecord[];
  roomMessages: Record<string, RoomMessage[]>;
};

export type SocialHubSnapshot = {
  onlineNpcs: NpcState[];
  friendOnline: NpcState[];
  sortedConversations: Conversation[];
  myRooms: Room[];
  otherRooms: Room[];
  pendingRoomInvites: RoomInvite[];
  pendingInvitations: InvitationRecord[];
  unreadTotal: number;
  loungeLastMessage: RoomMessage | undefined;
};

function latestConversationTime(conversation: Conversation) {
  return conversation.messages.at(-1)?.createdAt ?? conversation.id;
}

export function relationshipScore(relationships: RelationshipRecord[], residentId: string) {
  return relationships.find((relationship) => relationship.residentId === residentId)?.score ?? 0;
}

export function buildSocialHubSnapshot(input: SocialHubInput): SocialHubSnapshot {
  const onlineNpcs = input.npcs.filter((npc) => npc.presenceOnline);
  const friendOnline = onlineNpcs.filter((npc) => relationshipScore(input.relationships, npc.id) >= 40);
  const sortedConversations = [...input.conversations].sort((a, b) =>
    latestConversationTime(b).localeCompare(latestConversationTime(a))
  );
  const myRooms = input.rooms.filter((room) => input.joinedRooms.includes(room.id));
  const otherRooms = input.rooms.filter((room) => !input.joinedRooms.includes(room.id) && room.isActive);
  const pendingRoomInvites = input.roomInvites.filter((invite) =>
    invite.status === "pending" && invite.toId === (input.avatar?.displayName ?? "__")
  );
  const pendingInvitations = input.invitations.filter((invite) => invite.status === "pending");
  const unreadTotal = input.conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0);

  return {
    onlineNpcs,
    friendOnline,
    sortedConversations,
    myRooms,
    otherRooms,
    pendingRoomInvites,
    pendingInvitations,
    unreadTotal,
    loungeLastMessage: (input.roomMessages["room-lounge-global"] ?? []).at(-1)
  };
}
