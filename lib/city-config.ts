import type { MapPlayer } from "./life-map";

export type CityId = "toulouse" | "paris";

export interface CityConfig {
  id:          CityId;
  name:        string;
  displayName: string;
  center:      { lat: number; lng: number };
  zoom:        number;
  region: {
    latitude: number; longitude: number;
    latitudeDelta: number; longitudeDelta: number;
  };
  quartiers:   { name: string; lat: number; lng: number; radius: number }[];
  npcSpots:    { name: string; lat: number; lng: number }[];
  mockPlayers: MapPlayer[];
  feedLocations: string[];
}

// ─── TOULOUSE ────────────────────────────────────────────────────────────────
const TOULOUSE: CityConfig = {
  id: "toulouse", name: "Toulouse", displayName: "Neo Toulouse",
  center: { lat: 43.6047, lng: 1.4442 },
  zoom: 13,
  region: { latitude: 43.6047, longitude: 1.4442, latitudeDelta: 0.12, longitudeDelta: 0.12 },
  quartiers: [
    { name: "Capitole",       lat: 43.6047, lng: 1.4442,  radius: 0.008 },
    { name: "Saint-Cyprien",  lat: 43.5995, lng: 1.4380,  radius: 0.007 },
    { name: "Compans",        lat: 43.6115, lng: 1.4380,  radius: 0.007 },
    { name: "Carmes",         lat: 43.5985, lng: 1.4480,  radius: 0.006 },
    { name: "Wilson",         lat: 43.6089, lng: 1.4501,  radius: 0.006 },
    { name: "Les Minimes",    lat: 43.6200, lng: 1.4320,  radius: 0.008 },
    { name: "Esquirol",       lat: 43.6012, lng: 1.4430,  radius: 0.006 },
    { name: "Rangueil",       lat: 43.5660, lng: 1.4680,  radius: 0.010 },
    { name: "Bonnefoy",       lat: 43.6050, lng: 1.4640,  radius: 0.007 },
    { name: "Croix-Daurade",  lat: 43.6230, lng: 1.4420,  radius: 0.009 },
    { name: "Saint-Agne",     lat: 43.5830, lng: 1.4600,  radius: 0.008 },
    { name: "Mirail",         lat: 43.5780, lng: 1.4060,  radius: 0.012 },
    { name: "Bagatelle",      lat: 43.5940, lng: 1.4200,  radius: 0.009 },
    { name: "Empalot",        lat: 43.5860, lng: 1.4500,  radius: 0.007 },
    { name: "La Vache",       lat: 43.6300, lng: 1.4200,  radius: 0.008 },
    { name: "Blagnac",        lat: 43.6340, lng: 1.3670,  radius: 0.012 },
  ],
  npcSpots: [
    { name: "Capitole — Place",             lat: 43.6047, lng: 1.4442 },
    { name: "Saint-Cyprien — Quai",         lat: 43.5995, lng: 1.4380 },
    { name: "Compans-Caffarelli",           lat: 43.6115, lng: 1.4380 },
    { name: "Carmes — Marché",              lat: 43.5985, lng: 1.4480 },
    { name: "Wilson — Place",               lat: 43.6089, lng: 1.4501 },
    { name: "Minimes — Parc",               lat: 43.6200, lng: 1.4320 },
    { name: "Esquirol — Galerie",           lat: 43.6012, lng: 1.4430 },
    { name: "Rangueil — Campus",            lat: 43.5660, lng: 1.4680 },
    { name: "Blagnac — Aéro",              lat: 43.6340, lng: 1.3670 },
    { name: "Bonnefoy — Bar",               lat: 43.6050, lng: 1.4640 },
    { name: "Croix-Daurade — Terrain",      lat: 43.6230, lng: 1.4420 },
    { name: "Saint-Agne — Resto",           lat: 43.5830, lng: 1.4600 },
    { name: "Bellefontaine — Dalle",        lat: 43.5750, lng: 1.4110 },
    { name: "Mirail — Centre",              lat: 43.5780, lng: 1.4060 },
    { name: "Bagatelle — Parc",             lat: 43.5940, lng: 1.4200 },
    { name: "Empalot — Place",              lat: 43.5860, lng: 1.4500 },
    { name: "Côte Pavée — Terrasse",        lat: 43.5930, lng: 1.4620 },
    { name: "La Vache — Studio",            lat: 43.6300, lng: 1.4200 },
  ],
  feedLocations: ["Capitole", "Saint-Cyprien", "Compans", "Carmes", "Minimes", "Rangueil", "Bonnefoy", "Mirail", "Croix-Daurade", "Bagatelle"],
  mockPlayers: [
    { id:"m1",  user_id:"u1",  display_name:"Jok'air ✓",  avatar_emoji:"🎤", status:"vibe",  lat:43.6076, lng:1.4451, location_name:"Capitole",      location_verified:true,  last_action:"Studio session",     is_star:true,  is_npc:true, level:99, crew_color:"#FFD600", crew_tag:"BVK", updated_at:new Date().toISOString() },
    { id:"m2",  user_id:"u2",  display_name:"Karim_93",    avatar_emoji:"🧢", status:"free",  lat:43.5998, lng:1.4420, location_name:"Saint-Cyprien", location_verified:true,  last_action:"Au taff",            is_star:false, is_npc:true, level:6,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"m3",  user_id:"u3",  display_name:"Lina.Paris",  avatar_emoji:"👑", status:"vibe",  lat:43.6120, lng:1.4580, location_name:"Compans",       location_verified:false, last_action:"Terrasse",           is_star:false, is_npc:true, level:4,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"m4",  user_id:"u4",  display_name:"Seb.Bellev",  avatar_emoji:"🎨", status:"free",  lat:43.6180, lng:1.4320, location_name:"Les Minimes",   location_verified:true,  last_action:"Manger propre",      is_star:false, is_npc:true, level:8,  crew_color:"#FFD600", crew_tag:"BVK", updated_at:new Date().toISOString() },
    { id:"m5",  user_id:"u5",  display_name:"Amina.M",     avatar_emoji:"💄", status:"vibe",  lat:43.5920, lng:1.4500, location_name:"Rangueil",      location_verified:true,  last_action:"Roupiller",          is_star:false, is_npc:true, level:3,  crew_color:"#BF5FFF", crew_tag:"MTR", updated_at:new Date().toISOString() },
    { id:"m6",  user_id:"u6",  display_name:"Toxic_Nat",   avatar_emoji:"🔥", status:"charo", lat:43.6050, lng:1.4650, location_name:"Bonnefoy",      location_verified:false, last_action:"Faire un tour",      is_star:false, is_npc:true, level:11, crew_color:"#FF3B3B", crew_tag:"NAT", updated_at:new Date().toISOString() },
    { id:"m7",  user_id:"u7",  display_name:"Djo.SDenis",  avatar_emoji:"⚽", status:"free",  lat:43.6240, lng:1.4410, location_name:"Croix-Daurade", location_verified:true,  last_action:"Terrain de foot",    is_star:false, is_npc:true, level:5,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"m8",  user_id:"u8",  display_name:"Maska ✓",     avatar_emoji:"🎭", status:"vibe",  lat:43.6032, lng:1.4395, location_name:"Carmes",        location_verified:true,  last_action:"Avant-première",     is_star:true,  is_npc:true, level:87, crew_color:"#BF5FFF", crew_tag:"MSK", updated_at:new Date().toISOString() },
    { id:"m9",  user_id:"u9",  display_name:"Doomams",      avatar_emoji:"😤", status:"free",  lat:43.6155, lng:1.4502, location_name:"Wilson",        location_verified:true,  last_action:"Serrage de mains",   is_star:false, is_npc:true, level:22, crew_color:"#FF3B3B", crew_tag:"DOM", updated_at:new Date().toISOString() },
    { id:"m10", user_id:"u10", display_name:"Lil Yaz",      avatar_emoji:"💜", status:"vibe",  lat:43.5860, lng:1.4490, location_name:"Empalot",       location_verified:true,  last_action:"Enregistrement",     is_star:false, is_npc:true, level:15, crew_color:"#BF5FFF", crew_tag:"MTR", updated_at:new Date().toISOString() },
    { id:"m11", user_id:"u11", display_name:"Benz",         avatar_emoji:"🔑", status:"taken", lat:43.6090, lng:1.4362, location_name:"Esquirol",      location_verified:false, last_action:"Café business",      is_star:false, is_npc:true, level:18, crew_color:"#FFD600", crew_tag:"BVK", updated_at:new Date().toISOString() },
    { id:"m12", user_id:"u12", display_name:"Sékouba",      avatar_emoji:"🧢", status:"free",  lat:43.6200, lng:1.4480, location_name:"Compans",       location_verified:true,  last_action:"Gym session",        is_star:false, is_npc:true, level:9,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"m13", user_id:"u13", display_name:"Nadia.TLS",    avatar_emoji:"🌹", status:"free",  lat:43.5970, lng:1.4550, location_name:"Saint-Agne",    location_verified:true,  last_action:"Marché bio",         is_star:false, is_npc:true, level:7,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"m14", user_id:"u14", display_name:"Rafa.Mirail",  avatar_emoji:"🐺", status:"charo", lat:43.5780, lng:1.4070, location_name:"Mirail",        location_verified:true,  last_action:"Dalle et freestyle", is_star:false, is_npc:true, level:13, crew_color:"#FF3B3B", crew_tag:"MRL", updated_at:new Date().toISOString() },
    { id:"m15", user_id:"u15", display_name:"Yusuf.B",      avatar_emoji:"🤲", status:"free",  lat:43.6310, lng:1.4390, location_name:"La Vache",      location_verified:false, last_action:"Prière du vendredi", is_star:false, is_npc:true, level:4,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"m16", user_id:"u16", display_name:"Chloe.rive",   avatar_emoji:"🎸", status:"vibe",  lat:43.6010, lng:1.4340, location_name:"Saint-Cyprien", location_verified:true,  last_action:"Concert impro",      is_star:false, is_npc:true, level:6,  crew_color:"#00FFD1", crew_tag:"RVG", updated_at:new Date().toISOString() },
    { id:"m17", user_id:"u17", display_name:"Oumar.66",     avatar_emoji:"🦁", status:"free",  lat:43.6260, lng:1.4220, location_name:"Croix-Daurade", location_verified:true,  last_action:"Five le soir",       is_star:false, is_npc:true, level:10, crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"m18", user_id:"u18", display_name:"Priya.Cps",    avatar_emoji:"💎", status:"taken", lat:43.5840, lng:1.4690, location_name:"Rangueil",      location_verified:true,  last_action:"Cours à l'INSA",     is_star:false, is_npc:true, level:3,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"m19", user_id:"u19", display_name:"Driss.Cap",    avatar_emoji:"🎯", status:"free",  lat:43.6080, lng:1.4420, location_name:"Capitole",      location_verified:true,  last_action:"Balade midi",        is_star:false, is_npc:true, level:7,  crew_color:"#FFD600", crew_tag:"BVK", updated_at:new Date().toISOString() },
    { id:"m20", user_id:"u20", display_name:"Astou.Bag",    avatar_emoji:"🌟", status:"vibe",  lat:43.5940, lng:1.4210, location_name:"Bagatelle",     location_verified:false, last_action:"Répet danse",        is_star:false, is_npc:true, level:5,  crew_color:"#BF5FFF", crew_tag:"MTR", updated_at:new Date().toISOString() },
  ],
};

// ─── PARIS ───────────────────────────────────────────────────────────────────
const PARIS: CityConfig = {
  id: "paris", name: "Paris", displayName: "Neo Paris",
  center: { lat: 48.8566, lng: 2.3522 },
  zoom: 13,
  region: { latitude: 48.8566, longitude: 2.3522, latitudeDelta: 0.12, longitudeDelta: 0.12 },
  quartiers: [
    { name: "République",    lat: 48.8673, lng: 2.3630,  radius: 0.007 },
    { name: "Belleville",    lat: 48.8720, lng: 2.3785,  radius: 0.008 },
    { name: "Oberkampf",     lat: 48.8640, lng: 2.3720,  radius: 0.006 },
    { name: "Pigalle",       lat: 48.8828, lng: 2.3390,  radius: 0.006 },
    { name: "Châtelet",      lat: 48.8589, lng: 2.3469,  radius: 0.007 },
    { name: "Marais",        lat: 48.8570, lng: 2.3580,  radius: 0.008 },
    { name: "Bastille",      lat: 48.8533, lng: 2.3692,  radius: 0.007 },
    { name: "Nation",        lat: 48.8484, lng: 2.3960,  radius: 0.007 },
    { name: "Montmartre",    lat: 48.8867, lng: 2.3431,  radius: 0.007 },
    { name: "Saint-Denis",   lat: 48.9362, lng: 2.3574,  radius: 0.012 },
    { name: "Aubervilliers", lat: 48.9132, lng: 2.3814,  radius: 0.010 },
    { name: "Montreuil",     lat: 48.8640, lng: 2.4425,  radius: 0.012 },
    { name: "Vincennes",     lat: 48.8480, lng: 2.4390,  radius: 0.009 },
    { name: "La Défense",    lat: 48.8921, lng: 2.2385,  radius: 0.010 },
    { name: "Pantin",        lat: 48.8978, lng: 2.4039,  radius: 0.010 },
    { name: "Bobigny",       lat: 48.9100, lng: 2.4402,  radius: 0.010 },
  ],
  npcSpots: [
    { name: "Belleville — Studio",         lat: 48.8720, lng: 2.3800 },
    { name: "Marais — Galerie",            lat: 48.8590, lng: 2.3570 },
    { name: "République — Place",          lat: 48.8676, lng: 2.3634 },
    { name: "Châtelet — Forum",            lat: 48.8603, lng: 2.3471 },
    { name: "6ème — Saint-Germain",        lat: 48.8530, lng: 2.3330 },
    { name: "Pigalle — Club Privé",        lat: 48.8835, lng: 2.3340 },
    { name: "Montmartre — Sacré-Cœur",     lat: 48.8867, lng: 2.3431 },
    { name: "13ème — Quartier Asiatique",  lat: 48.8322, lng: 2.3561 },
    { name: "Nation — Place",              lat: 48.8482, lng: 2.3962 },
    { name: "Oberkampf — Terrasse",        lat: 48.8660, lng: 2.3770 },
    { name: "Bastille — Place",            lat: 48.8531, lng: 2.3693 },
    { name: "Opéra — Grand Bvd",           lat: 48.8718, lng: 2.3318 },
    { name: "Vincennes — Bois Est",        lat: 48.8479, lng: 2.4338 },
    { name: "Louvre — Tuileries",          lat: 48.8600, lng: 2.3400 },
    { name: "Quartier Latin — Brasserie",  lat: 48.8510, lng: 2.3460 },
    { name: "Gobelins — Mouffetard",       lat: 48.8370, lng: 2.3510 },
    { name: "Grands Boulevards — Café",    lat: 48.8700, lng: 2.3500 },
    { name: "Saint-Denis — Stade",         lat: 48.9200, lng: 2.3600 },
  ],
  feedLocations: ["Marais", "Belleville", "93", "Châtelet", "Pigalle", "Oberkampf", "Nation", "Bastille", "Montmartre", "République"],
  mockPlayers: [
    { id:"p1",  user_id:"pu1",  display_name:"Lacrim ✓",     avatar_emoji:"🦅", status:"vibe",  lat:48.8720, lng:2.3800, location_name:"Belleville",    location_verified:true,  last_action:"Studio nuit",        is_star:true,  is_npc:true, level:99, crew_color:"#FFD600", crew_tag:"CLM", updated_at:new Date().toISOString() },
    { id:"p2",  user_id:"pu2",  display_name:"Booba ✓",      avatar_emoji:"🦁", status:"vibe",  lat:48.8590, lng:2.3570, location_name:"Marais",        location_verified:true,  last_action:"Shooting photo",     is_star:true,  is_npc:true, level:99, crew_color:"#00B4FF", crew_tag:"B2O", updated_at:new Date().toISOString() },
    { id:"p3",  user_id:"pu3",  display_name:"SCH ✓",        avatar_emoji:"🎭", status:"free",  lat:48.8867, lng:2.3431, location_name:"Montmartre",    location_verified:true,  last_action:"Clip en tournage",   is_star:true,  is_npc:true, level:97, crew_color:"#BF5FFF", crew_tag:"SCH", updated_at:new Date().toISOString() },
    { id:"p4",  user_id:"pu4",  display_name:"Karim_93",     avatar_emoji:"🧢", status:"free",  lat:48.9132, lng:2.3814, location_name:"Aubervilliers", location_verified:true,  last_action:"Au taff",            is_star:false, is_npc:true, level:6,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"p5",  user_id:"pu5",  display_name:"Lina.Bvl",     avatar_emoji:"👑", status:"vibe",  lat:48.8673, lng:2.3630, location_name:"République",    location_verified:false, last_action:"Terrasse",           is_star:false, is_npc:true, level:4,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"p6",  user_id:"pu6",  display_name:"Seb.Bellev",   avatar_emoji:"🎨", status:"free",  lat:48.8640, lng:2.3770, location_name:"Oberkampf",     location_verified:true,  last_action:"Manger propre",      is_star:false, is_npc:true, level:8,  crew_color:"#FFD600", crew_tag:"BVK", updated_at:new Date().toISOString() },
    { id:"p7",  user_id:"pu7",  display_name:"Toxic_93",     avatar_emoji:"🔥", status:"charo", lat:48.9362, lng:2.3574, location_name:"Saint-Denis",   location_verified:false, last_action:"Faire un tour",      is_star:false, is_npc:true, level:11, crew_color:"#FF3B3B", crew_tag:"9-3", updated_at:new Date().toISOString() },
    { id:"p8",  user_id:"pu8",  display_name:"Djo.Montreuil",avatar_emoji:"⚽", status:"free",  lat:48.8640, lng:2.4425, location_name:"Montreuil",     location_verified:true,  last_action:"Terrain de foot",    is_star:false, is_npc:true, level:5,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"p9",  user_id:"pu9",  display_name:"Doomams",       avatar_emoji:"😤", status:"free",  lat:48.8533, lng:2.3692, location_name:"Bastille",      location_verified:true,  last_action:"Serrage de mains",   is_star:false, is_npc:true, level:22, crew_color:"#FF3B3B", crew_tag:"DOM", updated_at:new Date().toISOString() },
    { id:"p10", user_id:"pu10", display_name:"Lil Yaz",       avatar_emoji:"💜", status:"vibe",  lat:48.8484, lng:2.3960, location_name:"Nation",        location_verified:true,  last_action:"Enregistrement",     is_star:false, is_npc:true, level:15, crew_color:"#BF5FFF", crew_tag:"MTR", updated_at:new Date().toISOString() },
    { id:"p11", user_id:"pu11", display_name:"Benz.Chatelet", avatar_emoji:"🔑", status:"taken", lat:48.8589, lng:2.3469, location_name:"Châtelet",      location_verified:false, last_action:"Café business",      is_star:false, is_npc:true, level:18, crew_color:"#FFD600", crew_tag:"BVK", updated_at:new Date().toISOString() },
    { id:"p12", user_id:"pu12", display_name:"Sékouba.19",    avatar_emoji:"🧢", status:"free",  lat:48.8978, lng:2.4039, location_name:"Pantin",        location_verified:true,  last_action:"Gym session",        is_star:false, is_npc:true, level:9,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"p13", user_id:"pu13", display_name:"Nadia.18",      avatar_emoji:"🌹", status:"free",  lat:48.8828, lng:2.3390, location_name:"Pigalle",       location_verified:true,  last_action:"Sortie nightclub",   is_star:false, is_npc:true, level:7,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"p14", user_id:"pu14", display_name:"Rafa.Bobigny",  avatar_emoji:"🐺", status:"charo", lat:48.9100, lng:2.4402, location_name:"Bobigny",       location_verified:true,  last_action:"Dalle et freestyle", is_star:false, is_npc:true, level:13, crew_color:"#FF3B3B", crew_tag:"9-3", updated_at:new Date().toISOString() },
    { id:"p15", user_id:"pu15", display_name:"Yusuf.Def",     avatar_emoji:"🤲", status:"free",  lat:48.8921, lng:2.2385, location_name:"La Défense",    location_verified:false, last_action:"Prière du vendredi", is_star:false, is_npc:true, level:4,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"p16", user_id:"pu16", display_name:"Chloe.6eme",    avatar_emoji:"🎸", status:"vibe",  lat:48.8530, lng:2.3330, location_name:"Saint-Germain", location_verified:true,  last_action:"Concert impro",      is_star:false, is_npc:true, level:6,  crew_color:"#00FFD1", crew_tag:"RVG", updated_at:new Date().toISOString() },
    { id:"p17", user_id:"pu17", display_name:"Oumar.Vincen",  avatar_emoji:"🦁", status:"free",  lat:48.8480, lng:2.4390, location_name:"Vincennes",     location_verified:true,  last_action:"Bois de Vincennes",  is_star:false, is_npc:true, level:10, crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"p18", user_id:"pu18", display_name:"Priya.Latin",   avatar_emoji:"💎", status:"taken", lat:48.8510, lng:2.3460, location_name:"Quartier Latin",location_verified:true,  last_action:"Cours à la Sorbonne",is_star:false, is_npc:true, level:3,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"p19", user_id:"pu19", display_name:"Driss.Opéra",   avatar_emoji:"🎯", status:"free",  lat:48.8718, lng:2.3318, location_name:"Opéra",         location_verified:true,  last_action:"Balade midi",        is_star:false, is_npc:true, level:7,  crew_color:"#FFD600", crew_tag:"BVK", updated_at:new Date().toISOString() },
    { id:"p20", user_id:"pu20", display_name:"Astou.Montm",   avatar_emoji:"🌟", status:"vibe",  lat:48.8867, lng:2.3431, location_name:"Montmartre",    location_verified:false, last_action:"Répet danse",        is_star:false, is_npc:true, level:5,  crew_color:"#BF5FFF", crew_tag:"MTR", updated_at:new Date().toISOString() },
  ],
};

// ─── CONFIG ACTIVE — changer ici pour switcher de ville ─────────────────────
// "toulouse" → test GPS local   |   "paris" → lancement Paris
export const ACTIVE_CITY: CityConfig = TOULOUSE;

export const CITIES: Record<CityId, CityConfig> = { toulouse: TOULOUSE, paris: PARIS };
