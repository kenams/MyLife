import type { MapPlayer } from "./life-map";

export type CityId = "toulouse" | "paris" | "lyon" | "marseille" | "bordeaux" | "lille" | "nice" | "nantes" | "strasbourg" | "montpellier" | "rennes" | "grenoble";

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

// ─── LYON ────────────────────────────────────────────────────────────────────
const LYON: CityConfig = {
  id: "lyon", name: "Lyon", displayName: "Neo Lyon",
  center: { lat: 45.7640, lng: 4.8357 },
  zoom: 13,
  region: { latitude: 45.7640, longitude: 4.8357, latitudeDelta: 0.12, longitudeDelta: 0.12 },
  quartiers: [
    { name: "Presqu'île",    lat: 45.7640, lng: 4.8340, radius: 0.007 },
    { name: "Croix-Rousse",  lat: 45.7750, lng: 4.8300, radius: 0.008 },
    { name: "Guillotière",   lat: 45.7500, lng: 4.8420, radius: 0.007 },
    { name: "Part-Dieu",     lat: 45.7600, lng: 4.8590, radius: 0.008 },
    { name: "Vieux-Lyon",    lat: 45.7620, lng: 4.8270, radius: 0.006 },
    { name: "Gerland",       lat: 45.7320, lng: 4.8340, radius: 0.009 },
    { name: "Villeurbanne",  lat: 45.7668, lng: 4.8797, radius: 0.010 },
    { name: "Vaise",         lat: 45.7740, lng: 4.8090, radius: 0.008 },
  ],
  npcSpots: [
    { name: "Presqu'île — Place Bellecour",  lat: 45.7580, lng: 4.8320 },
    { name: "Croix-Rousse — Plateau",        lat: 45.7780, lng: 4.8290 },
    { name: "Guillotière — Rue",             lat: 45.7490, lng: 4.8430 },
    { name: "Part-Dieu — Centre com.",       lat: 45.7610, lng: 4.8600 },
    { name: "Vieux-Lyon — Quais",            lat: 45.7630, lng: 4.8260 },
    { name: "Gerland — Stade",               lat: 45.7280, lng: 4.8310 },
    { name: "Confluence — Musée",            lat: 45.7440, lng: 4.8180 },
    { name: "Villeurbanne — Gratte-ciel",    lat: 45.7680, lng: 4.8820 },
  ],
  feedLocations: ["Presqu'île", "Croix-Rousse", "Guillotière", "Part-Dieu", "Vieux-Lyon", "Gerland", "Villeurbanne"],
  mockPlayers: [
    { id:"l1",  user_id:"lu1",  display_name:"Naps ✓",      avatar_emoji:"🎤", status:"vibe",  lat:45.7640, lng:4.8340, location_name:"Presqu'île",   location_verified:true,  last_action:"Studio session",    is_star:true,  is_npc:true, level:95, crew_color:"#FFD600", crew_tag:"LYN", updated_at:new Date().toISOString() },
    { id:"l2",  user_id:"lu2",  display_name:"Soso.CRX",    avatar_emoji:"🧢", status:"free",  lat:45.7750, lng:4.8300, location_name:"Croix-Rousse", location_verified:true,  last_action:"Au taff",           is_star:false, is_npc:true, level:7,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"l3",  user_id:"lu3",  display_name:"Kenza.7",     avatar_emoji:"👑", status:"vibe",  lat:45.7500, lng:4.8420, location_name:"Guillotière",  location_verified:false, last_action:"Terrasse",          is_star:false, is_npc:true, level:5,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"l4",  user_id:"lu4",  display_name:"Mehdi.PD",    avatar_emoji:"🎯", status:"free",  lat:45.7600, lng:4.8590, location_name:"Part-Dieu",    location_verified:true,  last_action:"Meeting",           is_star:false, is_npc:true, level:9,  crew_color:"#FFD600", crew_tag:"LYN", updated_at:new Date().toISOString() },
    { id:"l5",  user_id:"lu5",  display_name:"Fatou.VL",    avatar_emoji:"💄", status:"vibe",  lat:45.7620, lng:4.8270, location_name:"Vieux-Lyon",   location_verified:true,  last_action:"Visite touristique",is_star:false, is_npc:true, level:3,  crew_color:"#BF5FFF", crew_tag:"RHN", updated_at:new Date().toISOString() },
    { id:"l6",  user_id:"lu6",  display_name:"Romain.G",    avatar_emoji:"🔥", status:"charo", lat:45.7320, lng:4.8340, location_name:"Gerland",      location_verified:false, last_action:"Match de foot",     is_star:false, is_npc:true, level:12, crew_color:"#FF3B3B", crew_tag:"GRL", updated_at:new Date().toISOString() },
    { id:"l7",  user_id:"lu7",  display_name:"Issa.Vilbne",  avatar_emoji:"⚽", status:"free",  lat:45.7668, lng:4.8797, location_name:"Villeurbanne", location_verified:true,  last_action:"Five le soir",      is_star:false, is_npc:true, level:6,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"l8",  user_id:"lu8",  display_name:"Yasmine.C",   avatar_emoji:"🌸", status:"taken", lat:45.7440, lng:4.8180, location_name:"Confluence",   location_verified:true,  last_action:"Shopping",          is_star:false, is_npc:true, level:4,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"l9",  user_id:"lu9",  display_name:"Driss.Vaise", avatar_emoji:"🧢", status:"free",  lat:45.7740, lng:4.8090, location_name:"Vaise",        location_verified:true,  last_action:"Gym",               is_star:false, is_npc:true, level:8,  crew_color:"#FFD600", crew_tag:"LYN", updated_at:new Date().toISOString() },
    { id:"l10", user_id:"lu10", display_name:"Amara.CRX",   avatar_emoji:"🎸", status:"vibe",  lat:45.7760, lng:4.8310, location_name:"Croix-Rousse", location_verified:true,  last_action:"Concert impro",     is_star:false, is_npc:true, level:5,  crew_color:"#00FFD1", crew_tag:"RHN", updated_at:new Date().toISOString() },
  ],
};

// ─── MARSEILLE ───────────────────────────────────────────────────────────────
const MARSEILLE: CityConfig = {
  id: "marseille", name: "Marseille", displayName: "Neo Marseille",
  center: { lat: 43.2965, lng: 5.3698 },
  zoom: 13,
  region: { latitude: 43.2965, longitude: 5.3698, latitudeDelta: 0.12, longitudeDelta: 0.12 },
  quartiers: [
    { name: "Vieux-Port",    lat: 43.2951, lng: 5.3749, radius: 0.007 },
    { name: "Le Panier",     lat: 43.2993, lng: 5.3683, radius: 0.006 },
    { name: "Noailles",      lat: 43.2940, lng: 5.3790, radius: 0.006 },
    { name: "La Plaine",     lat: 43.2900, lng: 5.3900, radius: 0.007 },
    { name: "Belsunce",      lat: 43.2975, lng: 5.3760, radius: 0.006 },
    { name: "La Castellane", lat: 43.3350, lng: 5.3540, radius: 0.009 },
    { name: "Saint-Barnabé", lat: 43.2830, lng: 5.4180, radius: 0.009 },
    { name: "La Rose",       lat: 43.3470, lng: 5.3830, radius: 0.009 },
  ],
  npcSpots: [
    { name: "Vieux-Port — Quai",        lat: 43.2951, lng: 5.3749 },
    { name: "Le Panier — Ruelle",       lat: 43.2993, lng: 5.3683 },
    { name: "Noailles — Marché",        lat: 43.2940, lng: 5.3790 },
    { name: "La Plaine — Place",        lat: 43.2900, lng: 5.3900 },
    { name: "Castellane — Dalle",       lat: 43.3350, lng: 5.3540 },
    { name: "Cours Julien — Café",      lat: 43.2893, lng: 5.3840 },
    { name: "La Joliette — Docks",      lat: 43.3050, lng: 5.3620 },
    { name: "Bonneveine — Plage",       lat: 43.2540, lng: 5.3960 },
  ],
  feedLocations: ["Vieux-Port", "Le Panier", "Noailles", "La Plaine", "Castellane", "Cours Julien", "La Joliette"],
  mockPlayers: [
    { id:"ms1", user_id:"mu1",  display_name:"Jul ✓",       avatar_emoji:"☀️", status:"vibe",  lat:43.2951, lng:5.3749, location_name:"Vieux-Port",   location_verified:true,  last_action:"Clip tournage",     is_star:true,  is_npc:true, level:99, crew_color:"#FFD600", crew_tag:"MRS", updated_at:new Date().toISOString() },
    { id:"ms2", user_id:"mu2",  display_name:"Alonzo ✓",    avatar_emoji:"🦅", status:"vibe",  lat:43.3350, lng:5.3540, location_name:"La Castellane",location_verified:true,  last_action:"Studio nuit",       is_star:true,  is_npc:true, level:98, crew_color:"#00B4FF", crew_tag:"SCM", updated_at:new Date().toISOString() },
    { id:"ms3", user_id:"mu3",  display_name:"Kaci.Panier", avatar_emoji:"🧢", status:"free",  lat:43.2993, lng:5.3683, location_name:"Le Panier",    location_verified:true,  last_action:"Au taff",           is_star:false, is_npc:true, level:7,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"ms4", user_id:"mu4",  display_name:"Soraya.N",    avatar_emoji:"👑", status:"vibe",  lat:43.2940, lng:5.3790, location_name:"Noailles",     location_verified:false, last_action:"Terrasse",          is_star:false, is_npc:true, level:5,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"ms5", user_id:"mu5",  display_name:"Mouloud.13",  avatar_emoji:"🔥", status:"charo", lat:43.2900, lng:5.3900, location_name:"La Plaine",    location_verified:true,  last_action:"Sortie le soir",    is_star:false, is_npc:true, level:11, crew_color:"#FF3B3B", crew_tag:"MRS", updated_at:new Date().toISOString() },
    { id:"ms6", user_id:"mu6",  display_name:"Inès.CJ",     avatar_emoji:"🌺", status:"vibe",  lat:43.2893, lng:5.3840, location_name:"Cours Julien", location_verified:true,  last_action:"Concert",           is_star:false, is_npc:true, level:6,  crew_color:"#BF5FFF", crew_tag:"CJN", updated_at:new Date().toISOString() },
    { id:"ms7", user_id:"mu7",  display_name:"Yanis.Rose",  avatar_emoji:"⚽", status:"free",  lat:43.3470, lng:5.3830, location_name:"La Rose",      location_verified:true,  last_action:"Terrain de foot",   is_star:false, is_npc:true, level:8,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"ms8", user_id:"mu8",  display_name:"Nadia.Bvne",  avatar_emoji:"💄", status:"taken", lat:43.2540, lng:5.3960, location_name:"Bonneveine",   location_verified:true,  last_action:"Plage le matin",    is_star:false, is_npc:true, level:4,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"ms9", user_id:"mu9",  display_name:"Sam.Joliette",avatar_emoji:"🎯", status:"free",  lat:43.3050, lng:5.3620, location_name:"La Joliette",  location_verified:true,  last_action:"Docks business",    is_star:false, is_npc:true, level:9,  crew_color:"#FFD600", crew_tag:"MRS", updated_at:new Date().toISOString() },
    { id:"ms10",user_id:"mu10", display_name:"Fatia.SB",    avatar_emoji:"🌹", status:"free",  lat:43.2830, lng:5.4180, location_name:"Saint-Barnabé",location_verified:true,  last_action:"Marché",            is_star:false, is_npc:true, level:3,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
  ],
};

// ─── BORDEAUX ────────────────────────────────────────────────────────────────
const BORDEAUX: CityConfig = {
  id: "bordeaux", name: "Bordeaux", displayName: "Neo Bordeaux",
  center: { lat: 44.8378, lng: -0.5792 },
  zoom: 13,
  region: { latitude: 44.8378, longitude: -0.5792, latitudeDelta: 0.10, longitudeDelta: 0.10 },
  quartiers: [
    { name: "Saint-Michel",   lat: 44.8320, lng: -0.5680, radius: 0.007 },
    { name: "Chartrons",      lat: 44.8490, lng: -0.5730, radius: 0.007 },
    { name: "Bastide",        lat: 44.8400, lng: -0.5560, radius: 0.008 },
    { name: "Victoire",       lat: 44.8360, lng: -0.5770, radius: 0.006 },
    { name: "Bacalan",        lat: 44.8620, lng: -0.5680, radius: 0.009 },
    { name: "Belcier",        lat: 44.8240, lng: -0.5620, radius: 0.008 },
    { name: "Mériadeck",      lat: 44.8410, lng: -0.5840, radius: 0.007 },
  ],
  npcSpots: [
    { name: "Saint-Michel — Place",      lat: 44.8320, lng: -0.5680 },
    { name: "Chartrons — Marché",        lat: 44.8490, lng: -0.5730 },
    { name: "Bastide — Darwin",          lat: 44.8400, lng: -0.5560 },
    { name: "Victoire — Place",          lat: 44.8360, lng: -0.5770 },
    { name: "Bacalan — Darwin",          lat: 44.8620, lng: -0.5680 },
    { name: "Quinconces — Place",        lat: 44.8450, lng: -0.5760 },
    { name: "Saint-Pierre — Rue",        lat: 44.8390, lng: -0.5700 },
  ],
  feedLocations: ["Saint-Michel", "Chartrons", "Bastide", "Victoire", "Bacalan", "Quinconces"],
  mockPlayers: [
    { id:"b1",  user_id:"bu1",  display_name:"Timal ✓",     avatar_emoji:"🍷", status:"vibe",  lat:44.8490, lng:-0.5730, location_name:"Chartrons",    location_verified:true,  last_action:"Studio session",    is_star:true,  is_npc:true, level:94, crew_color:"#FFD600", crew_tag:"BDX", updated_at:new Date().toISOString() },
    { id:"b2",  user_id:"bu2",  display_name:"Kev.StMich",  avatar_emoji:"🧢", status:"free",  lat:44.8320, lng:-0.5680, location_name:"Saint-Michel", location_verified:true,  last_action:"Au taff",           is_star:false, is_npc:true, level:6,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"b3",  user_id:"bu3",  display_name:"Lucie.Vic",   avatar_emoji:"🌸", status:"vibe",  lat:44.8360, lng:-0.5770, location_name:"Victoire",     location_verified:false, last_action:"Terrasse étudiante",is_star:false, is_npc:true, level:4,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"b4",  user_id:"bu4",  display_name:"Omar.Bastide",avatar_emoji:"🎯", status:"free",  lat:44.8400, lng:-0.5560, location_name:"Bastide",      location_verified:true,  last_action:"Darwin café",       is_star:false, is_npc:true, level:8,  crew_color:"#FFD600", crew_tag:"BDX", updated_at:new Date().toISOString() },
    { id:"b5",  user_id:"bu5",  display_name:"Aïcha.Bac",   avatar_emoji:"💄", status:"vibe",  lat:44.8620, lng:-0.5680, location_name:"Bacalan",      location_verified:true,  last_action:"Soirée Darwin",     is_star:false, is_npc:true, level:5,  crew_color:"#BF5FFF", crew_tag:"GRN", updated_at:new Date().toISOString() },
    { id:"b6",  user_id:"bu6",  display_name:"Théo.Belic",  avatar_emoji:"🔥", status:"charo", lat:44.8240, lng:-0.5620, location_name:"Belcier",      location_verified:false, last_action:"Soirée",            is_star:false, is_npc:true, level:10, crew_color:"#FF3B3B", crew_tag:"BLC", updated_at:new Date().toISOString() },
    { id:"b7",  user_id:"bu7",  display_name:"Mamadou.Quin",avatar_emoji:"⚽", status:"free",  lat:44.8450, lng:-0.5760, location_name:"Quinconces",   location_verified:true,  last_action:"Terrain de foot",   is_star:false, is_npc:true, level:7,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"b8",  user_id:"bu8",  display_name:"Jade.StP",    avatar_emoji:"🎸", status:"vibe",  lat:44.8390, lng:-0.5700, location_name:"Saint-Pierre", location_verified:true,  last_action:"Bar live",          is_star:false, is_npc:true, level:5,  crew_color:"#00FFD1", crew_tag:"GRN", updated_at:new Date().toISOString() },
  ],
};

// ─── LILLE ───────────────────────────────────────────────────────────────────
const LILLE: CityConfig = {
  id: "lille", name: "Lille", displayName: "Neo Lille",
  center: { lat: 50.6292, lng: 3.0573 },
  zoom: 13,
  region: { latitude: 50.6292, longitude: 3.0573, latitudeDelta: 0.10, longitudeDelta: 0.10 },
  quartiers: [
    { name: "Vieux-Lille",    lat: 50.6380, lng: 3.0600, radius: 0.007 },
    { name: "Wazemmes",       lat: 50.6240, lng: 3.0470, radius: 0.008 },
    { name: "Moulins",        lat: 50.6200, lng: 3.0650, radius: 0.008 },
    { name: "Fives",          lat: 50.6220, lng: 3.0820, radius: 0.008 },
    { name: "Bois-Blancs",    lat: 50.6350, lng: 3.0280, radius: 0.009 },
    { name: "Hellemmes",      lat: 50.6210, lng: 3.1030, radius: 0.009 },
  ],
  npcSpots: [
    { name: "Vieux-Lille — Rue de la Monnaie", lat: 50.6380, lng: 3.0600 },
    { name: "Wazemmes — Marché",               lat: 50.6240, lng: 3.0470 },
    { name: "Grand-Place",                     lat: 50.6370, lng: 3.0630 },
    { name: "Moulins — Place",                 lat: 50.6200, lng: 3.0650 },
    { name: "Fives — Bar",                     lat: 50.6220, lng: 3.0820 },
    { name: "Euralille — Centre",              lat: 50.6340, lng: 3.0750 },
  ],
  feedLocations: ["Vieux-Lille", "Wazemmes", "Moulins", "Fives", "Grand-Place", "Euralille"],
  mockPlayers: [
    { id:"li1", user_id:"liu1", display_name:"Hamza ✓",     avatar_emoji:"🎤", status:"vibe",  lat:50.6380, lng:3.0600, location_name:"Vieux-Lille",  location_verified:true,  last_action:"Studio session",    is_star:true,  is_npc:true, level:96, crew_color:"#FFD600", crew_tag:"LLE", updated_at:new Date().toISOString() },
    { id:"li2", user_id:"liu2", display_name:"Bilel.Waz",   avatar_emoji:"🧢", status:"free",  lat:50.6240, lng:3.0470, location_name:"Wazemmes",     location_verified:true,  last_action:"Marché",            is_star:false, is_npc:true, level:7,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"li3", user_id:"liu3", display_name:"Chloé.Moul",  avatar_emoji:"🌹", status:"vibe",  lat:50.6200, lng:3.0650, location_name:"Moulins",      location_verified:false, last_action:"Terrasse",          is_star:false, is_npc:true, level:4,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"li4", user_id:"liu4", display_name:"Samir.Five",  avatar_emoji:"🔥", status:"charo", lat:50.6220, lng:3.0820, location_name:"Fives",        location_verified:true,  last_action:"Soirée",            is_star:false, is_npc:true, level:9,  crew_color:"#FF3B3B", crew_tag:"FVS", updated_at:new Date().toISOString() },
    { id:"li5", user_id:"liu5", display_name:"Inès.GP",     avatar_emoji:"💄", status:"vibe",  lat:50.6370, lng:3.0630, location_name:"Grand-Place",  location_verified:true,  last_action:"Shopping",          is_star:false, is_npc:true, level:5,  crew_color:"#BF5FFF", crew_tag:"LLE", updated_at:new Date().toISOString() },
    { id:"li6", user_id:"liu6", display_name:"Thomas.BB",   avatar_emoji:"⚽", status:"free",  lat:50.6350, lng:3.0280, location_name:"Bois-Blancs",  location_verified:true,  last_action:"Terrain",           is_star:false, is_npc:true, level:6,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
  ],
};

// ─── NICE ─────────────────────────────────────────────────────────────────────
const NICE: CityConfig = {
  id: "nice", name: "Nice", displayName: "Neo Nice",
  center: { lat: 43.7102, lng: 7.2620 },
  zoom: 13,
  region: { latitude: 43.7102, longitude: 7.2620, latitudeDelta: 0.09, longitudeDelta: 0.09 },
  quartiers: [
    { name: "Vieux-Nice",     lat: 43.6962, lng: 7.2764, radius: 0.007 },
    { name: "Libération",     lat: 43.7180, lng: 7.2620, radius: 0.007 },
    { name: "Riquier",        lat: 43.7020, lng: 7.2890, radius: 0.007 },
    { name: "Madeleine",      lat: 43.7150, lng: 7.2490, radius: 0.008 },
    { name: "Ariane",         lat: 43.7350, lng: 7.2830, radius: 0.010 },
    { name: "Promenade",      lat: 43.6949, lng: 7.2660, radius: 0.008 },
  ],
  npcSpots: [
    { name: "Vieux-Nice — Cours Saleya",  lat: 43.6962, lng: 7.2764 },
    { name: "Libération — Marché",        lat: 43.7180, lng: 7.2620 },
    { name: "Promenade des Anglais",      lat: 43.6949, lng: 7.2660 },
    { name: "Riquier — Rue",              lat: 43.7020, lng: 7.2890 },
    { name: "Ariane — Dalle",             lat: 43.7350, lng: 7.2830 },
    { name: "Jean-Médecin — Avenue",      lat: 43.7080, lng: 7.2620 },
  ],
  feedLocations: ["Vieux-Nice", "Libération", "Riquier", "Promenade", "Ariane", "Jean-Médecin"],
  mockPlayers: [
    { id:"ni1", user_id:"nu1",  display_name:"Soprano ✓",   avatar_emoji:"🌊", status:"vibe",  lat:43.6962, lng:7.2764, location_name:"Vieux-Nice",   location_verified:true,  last_action:"Studio session",    is_star:true,  is_npc:true, level:97, crew_color:"#00B4FF", crew_tag:"NCE", updated_at:new Date().toISOString() },
    { id:"ni2", user_id:"nu2",  display_name:"Karim.Ariane",avatar_emoji:"🧢", status:"free",  lat:43.7350, lng:7.2830, location_name:"Ariane",       location_verified:true,  last_action:"Au taff",           is_star:false, is_npc:true, level:8,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"ni3", user_id:"nu3",  display_name:"Sofia.Prom",  avatar_emoji:"💎", status:"vibe",  lat:43.6949, lng:7.2660, location_name:"Promenade",    location_verified:false, last_action:"Jogging bord mer",  is_star:false, is_npc:true, level:5,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"ni4", user_id:"nu4",  display_name:"Yann.Riq",    avatar_emoji:"🔥", status:"charo", lat:43.7020, lng:7.2890, location_name:"Riquier",      location_verified:true,  last_action:"Sortie",            is_star:false, is_npc:true, level:10, crew_color:"#FF3B3B", crew_tag:"RQR", updated_at:new Date().toISOString() },
    { id:"ni5", user_id:"nu5",  display_name:"Amira.Lib",   avatar_emoji:"🌸", status:"free",  lat:43.7180, lng:7.2620, location_name:"Libération",   location_verified:true,  last_action:"Marché bio",        is_star:false, is_npc:true, level:6,  crew_color:"#BF5FFF", crew_tag:"NCE", updated_at:new Date().toISOString() },
    { id:"ni6", user_id:"nu6",  display_name:"Marc.VN",     avatar_emoji:"🎨", status:"vibe",  lat:43.6962, lng:7.2780, location_name:"Vieux-Nice",   location_verified:true,  last_action:"Galerie art",       is_star:false, is_npc:true, level:7,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
  ],
};

// ─── NANTES ──────────────────────────────────────────────────────────────────
const NANTES: CityConfig = {
  id: "nantes", name: "Nantes", displayName: "Neo Nantes",
  center: { lat: 47.2184, lng: -1.5536 },
  zoom: 13,
  region: { latitude: 47.2184, longitude: -1.5536, latitudeDelta: 0.10, longitudeDelta: 0.10 },
  quartiers: [
    { name: "Bouffay",         lat: 47.2130, lng: -1.5510, radius: 0.007 },
    { name: "Île de Nantes",   lat: 47.2070, lng: -1.5630, radius: 0.009 },
    { name: "Bellevue",        lat: 47.2150, lng: -1.5870, radius: 0.009 },
    { name: "Malakoff",        lat: 47.2180, lng: -1.5440, radius: 0.007 },
    { name: "Zola",            lat: 47.2320, lng: -1.5640, radius: 0.008 },
    { name: "Chantenay",       lat: 47.2140, lng: -1.5820, radius: 0.009 },
  ],
  npcSpots: [
    { name: "Bouffay — Place",       lat: 47.2130, lng: -1.5510 },
    { name: "Île de Nantes — Hangar", lat: 47.2070, lng: -1.5630 },
    { name: "Bellevue — Dalle",       lat: 47.2150, lng: -1.5870 },
    { name: "Malakoff — Marché",      lat: 47.2180, lng: -1.5440 },
    { name: "Passage Pommeraye",      lat: 47.2150, lng: -1.5530 },
    { name: "Zola — Bar",             lat: 47.2320, lng: -1.5640 },
  ],
  feedLocations: ["Bouffay", "Île de Nantes", "Bellevue", "Malakoff", "Zola", "Chantenay"],
  mockPlayers: [
    { id:"na1", user_id:"nau1", display_name:"Vald ✓",      avatar_emoji:"🌊", status:"vibe",  lat:47.2130, lng:-1.5510, location_name:"Bouffay",      location_verified:true,  last_action:"Studio session",   is_star:true,  is_npc:true, level:93, crew_color:"#FFD600", crew_tag:"NTS", updated_at:new Date().toISOString() },
    { id:"na2", user_id:"nau2", display_name:"Alexis.Blv",  avatar_emoji:"🧢", status:"free",  lat:47.2150, lng:-1.5870, location_name:"Bellevue",     location_verified:true,  last_action:"Au taff",          is_star:false, is_npc:true, level:7,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"na3", user_id:"nau3", display_name:"Fatou.IleN",  avatar_emoji:"💄", status:"vibe",  lat:47.2070, lng:-1.5630, location_name:"Île de Nantes",location_verified:false, last_action:"Hangar event",     is_star:false, is_npc:true, level:5,  crew_color:"#BF5FFF", crew_tag:"NTS", updated_at:new Date().toISOString() },
    { id:"na4", user_id:"nau4", display_name:"Niko.Malak",  avatar_emoji:"🔥", status:"charo", lat:47.2180, lng:-1.5440, location_name:"Malakoff",     location_verified:true,  last_action:"Soirée",           is_star:false, is_npc:true, level:9,  crew_color:"#FF3B3B", crew_tag:"MLK", updated_at:new Date().toISOString() },
    { id:"na5", user_id:"nau5", display_name:"Emma.Zola",   avatar_emoji:"🌸", status:"free",  lat:47.2320, lng:-1.5640, location_name:"Zola",         location_verified:true,  last_action:"Bar quartier",     is_star:false, is_npc:true, level:4,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"na6", user_id:"nau6", display_name:"Seun.Chan",   avatar_emoji:"⚽", status:"free",  lat:47.2140, lng:-1.5820, location_name:"Chantenay",    location_verified:true,  last_action:"Terrain",          is_star:false, is_npc:true, level:6,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
  ],
};

// ─── STRASBOURG ──────────────────────────────────────────────────────────────
const STRASBOURG: CityConfig = {
  id: "strasbourg", name: "Strasbourg", displayName: "Neo Strasbourg",
  center: { lat: 48.5734, lng: 7.7521 },
  zoom: 13,
  region: { latitude: 48.5734, longitude: 7.7521, latitudeDelta: 0.09, longitudeDelta: 0.09 },
  quartiers: [
    { name: "Grande-Île",     lat: 48.5800, lng: 7.7500, radius: 0.007 },
    { name: "Neudorf",        lat: 48.5620, lng: 7.7700, radius: 0.008 },
    { name: "Hautepierre",    lat: 48.5960, lng: 7.7100, radius: 0.009 },
    { name: "Meinau",         lat: 48.5590, lng: 7.7420, radius: 0.008 },
    { name: "Cronenbourg",    lat: 48.5910, lng: 7.7310, radius: 0.009 },
    { name: "Elsau",          lat: 48.5700, lng: 7.7200, radius: 0.008 },
  ],
  npcSpots: [
    { name: "Grande-Île — Place Kléber",  lat: 48.5800, lng: 7.7500 },
    { name: "Neudorf — Rue",              lat: 48.5620, lng: 7.7700 },
    { name: "Hautepierre — Dalle",        lat: 48.5960, lng: 7.7100 },
    { name: "Meinau — Bar",               lat: 48.5590, lng: 7.7420 },
    { name: "Petite France — Canal",      lat: 48.5770, lng: 7.7420 },
    { name: "Cronenbourg — Place",        lat: 48.5910, lng: 7.7310 },
  ],
  feedLocations: ["Grande-Île", "Neudorf", "Hautepierre", "Meinau", "Petite France", "Cronenbourg"],
  mockPlayers: [
    { id:"st1", user_id:"stu1", display_name:"Kekra ✓",     avatar_emoji:"🎭", status:"vibe",  lat:48.5800, lng:7.7500, location_name:"Grande-Île",   location_verified:true,  last_action:"Studio session",   is_star:true,  is_npc:true, level:92, crew_color:"#FFD600", crew_tag:"SBG", updated_at:new Date().toISOString() },
    { id:"st2", user_id:"stu2", display_name:"Bilal.Ndf",   avatar_emoji:"🧢", status:"free",  lat:48.5620, lng:7.7700, location_name:"Neudorf",      location_verified:true,  last_action:"Au taff",          is_star:false, is_npc:true, level:6,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"st3", user_id:"stu3", display_name:"Sara.HP",     avatar_emoji:"🌹", status:"vibe",  lat:48.5960, lng:7.7100, location_name:"Hautepierre",  location_verified:false, last_action:"Dalle",            is_star:false, is_npc:true, level:5,  crew_color:"#BF5FFF", crew_tag:"SBG", updated_at:new Date().toISOString() },
    { id:"st4", user_id:"stu4", display_name:"Mehdi.Mn",    avatar_emoji:"🔥", status:"charo", lat:48.5590, lng:7.7420, location_name:"Meinau",       location_verified:true,  last_action:"Soirée",           is_star:false, is_npc:true, level:8,  crew_color:"#FF3B3B", crew_tag:"MNA", updated_at:new Date().toISOString() },
    { id:"st5", user_id:"stu5", display_name:"Clara.PF",    avatar_emoji:"🌊", status:"vibe",  lat:48.5770, lng:7.7420, location_name:"Petite France",location_verified:true,  last_action:"Balade canal",     is_star:false, is_npc:true, level:4,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"st6", user_id:"stu6", display_name:"Youssef.Cr",  avatar_emoji:"⚽", status:"free",  lat:48.5910, lng:7.7310, location_name:"Cronenbourg",  location_verified:true,  last_action:"Terrain",          is_star:false, is_npc:true, level:7,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
  ],
};

// ─── MONTPELLIER ─────────────────────────────────────────────────────────────
const MONTPELLIER: CityConfig = {
  id: "montpellier", name: "Montpellier", displayName: "Neo Montpellier",
  center: { lat: 43.6108, lng: 3.8767 },
  zoom: 13,
  region: { latitude: 43.6108, longitude: 3.8767, latitudeDelta: 0.10, longitudeDelta: 0.10 },
  quartiers: [
    { name: "Écusson",        lat: 43.6110, lng: 3.8760, radius: 0.007 },
    { name: "Mosson",         lat: 43.6260, lng: 3.8380, radius: 0.009 },
    { name: "Port Marianne",  lat: 43.5990, lng: 3.9050, radius: 0.009 },
    { name: "Figuerolles",    lat: 43.6080, lng: 3.8680, radius: 0.007 },
    { name: "Montpellier-Est",lat: 43.6010, lng: 3.9200, radius: 0.010 },
    { name: "Près-d'Arènes",  lat: 43.5950, lng: 3.8750, radius: 0.008 },
  ],
  npcSpots: [
    { name: "Écusson — Place de la Comédie", lat: 43.6110, lng: 3.8760 },
    { name: "Mosson — Dalle",                lat: 43.6260, lng: 3.8380 },
    { name: "Port Marianne — Café",          lat: 43.5990, lng: 3.9050 },
    { name: "Figuerolles — Bar",             lat: 43.6080, lng: 3.8680 },
    { name: "Comédie — Tram",                lat: 43.6093, lng: 3.8763 },
    { name: "Antigone — Place",              lat: 43.6060, lng: 3.8870 },
  ],
  feedLocations: ["Écusson", "Mosson", "Port Marianne", "Figuerolles", "Antigone", "Comédie"],
  mockPlayers: [
    { id:"mp1", user_id:"mpu1", display_name:"Orelsan ✓",   avatar_emoji:"🎤", status:"vibe",  lat:43.6110, lng:3.8760, location_name:"Écusson",      location_verified:true,  last_action:"Studio session",   is_star:true,  is_npc:true, level:99, crew_color:"#FFD600", crew_tag:"MPL", updated_at:new Date().toISOString() },
    { id:"mp2", user_id:"mpu2", display_name:"Riad.Mosson", avatar_emoji:"🧢", status:"free",  lat:43.6260, lng:3.8380, location_name:"Mosson",       location_verified:true,  last_action:"Dalle",            is_star:false, is_npc:true, level:9,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"mp3", user_id:"mpu3", display_name:"Léa.PM",      avatar_emoji:"🌸", status:"vibe",  lat:43.5990, lng:3.9050, location_name:"Port Marianne",location_verified:false, last_action:"Terrasse",         is_star:false, is_npc:true, level:4,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"mp4", user_id:"mpu4", display_name:"Amine.Fig",   avatar_emoji:"🔥", status:"charo", lat:43.6080, lng:3.8680, location_name:"Figuerolles",  location_verified:true,  last_action:"Soirée",           is_star:false, is_npc:true, level:8,  crew_color:"#FF3B3B", crew_tag:"FIG", updated_at:new Date().toISOString() },
    { id:"mp5", user_id:"mpu5", display_name:"Sana.Ant",    avatar_emoji:"💄", status:"free",  lat:43.6060, lng:3.8870, location_name:"Antigone",     location_verified:true,  last_action:"Shopping",         is_star:false, is_npc:true, level:5,  crew_color:"#BF5FFF", crew_tag:"MPL", updated_at:new Date().toISOString() },
    { id:"mp6", user_id:"mpu6", display_name:"Jules.Près",  avatar_emoji:"⚽", status:"free",  lat:43.5950, lng:3.8750, location_name:"Près-d'Arènes",location_verified:true,  last_action:"Terrain",          is_star:false, is_npc:true, level:6,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
  ],
};

// ─── RENNES ──────────────────────────────────────────────────────────────────
const RENNES: CityConfig = {
  id: "rennes", name: "Rennes", displayName: "Neo Rennes",
  center: { lat: 48.1173, lng: -1.6778 },
  zoom: 13,
  region: { latitude: 48.1173, longitude: -1.6778, latitudeDelta: 0.09, longitudeDelta: 0.09 },
  quartiers: [
    { name: "Centre historique", lat: 48.1100, lng: -1.6800, radius: 0.007 },
    { name: "Maurepas",          lat: 48.1300, lng: -1.6720, radius: 0.009 },
    { name: "Cleunay",           lat: 48.1170, lng: -1.7050, radius: 0.009 },
    { name: "Villejean",         lat: 48.1320, lng: -1.7050, radius: 0.009 },
    { name: "Bréquigny",         lat: 48.0980, lng: -1.6760, radius: 0.009 },
    { name: "Saint-Martin",      lat: 48.1250, lng: -1.6650, radius: 0.008 },
  ],
  npcSpots: [
    { name: "Centre — Place Saint-Anne",  lat: 48.1100, lng: -1.6800 },
    { name: "Maurepas — Dalle",           lat: 48.1300, lng: -1.6720 },
    { name: "Villejean — Fac",            lat: 48.1320, lng: -1.7050 },
    { name: "République — Place",         lat: 48.1120, lng: -1.6760 },
    { name: "Bréquigny — Bar",            lat: 48.0980, lng: -1.6760 },
    { name: "Saint-Martin — Rue",         lat: 48.1250, lng: -1.6650 },
  ],
  feedLocations: ["Centre", "Maurepas", "Villejean", "République", "Bréquigny", "Saint-Martin"],
  mockPlayers: [
    { id:"re1", user_id:"ru1",  display_name:"Gringe ✓",    avatar_emoji:"🎤", status:"vibe",  lat:48.1100, lng:-1.6800, location_name:"Centre",       location_verified:true,  last_action:"Studio session",   is_star:true,  is_npc:true, level:91, crew_color:"#FFD600", crew_tag:"RNS", updated_at:new Date().toISOString() },
    { id:"re2", user_id:"ru2",  display_name:"Karim.Maur",  avatar_emoji:"🧢", status:"free",  lat:48.1300, lng:-1.6720, location_name:"Maurepas",     location_verified:true,  last_action:"Au taff",          is_star:false, is_npc:true, level:6,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"re3", user_id:"ru3",  display_name:"Marie.Vj",    avatar_emoji:"🌸", status:"vibe",  lat:48.1320, lng:-1.7050, location_name:"Villejean",    location_verified:false, last_action:"Fac + terrasse",   is_star:false, is_npc:true, level:3,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"re4", user_id:"ru4",  display_name:"Souf.Brq",    avatar_emoji:"🔥", status:"charo", lat:48.0980, lng:-1.6760, location_name:"Bréquigny",    location_verified:true,  last_action:"Soirée",           is_star:false, is_npc:true, level:8,  crew_color:"#FF3B3B", crew_tag:"BRQ", updated_at:new Date().toISOString() },
    { id:"re5", user_id:"ru5",  display_name:"Lucie.Rep",   avatar_emoji:"💄", status:"vibe",  lat:48.1120, lng:-1.6760, location_name:"République",   location_verified:true,  last_action:"Bar centre",       is_star:false, is_npc:true, level:5,  crew_color:"#BF5FFF", crew_tag:"RNS", updated_at:new Date().toISOString() },
    { id:"re6", user_id:"ru6",  display_name:"Omar.StM",    avatar_emoji:"⚽", status:"free",  lat:48.1250, lng:-1.6650, location_name:"Saint-Martin", location_verified:true,  last_action:"Terrain",          is_star:false, is_npc:true, level:7,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
  ],
};

// ─── GRENOBLE ────────────────────────────────────────────────────────────────
const GRENOBLE: CityConfig = {
  id: "grenoble", name: "Grenoble", displayName: "Neo Grenoble",
  center: { lat: 45.1885, lng: 5.7245 },
  zoom: 13,
  region: { latitude: 45.1885, longitude: 5.7245, latitudeDelta: 0.09, longitudeDelta: 0.09 },
  quartiers: [
    { name: "Presqu'île",      lat: 45.1950, lng: 5.7170, radius: 0.007 },
    { name: "Village Olympique",lat: 45.1870, lng: 5.7080, radius: 0.008 },
    { name: "Mistral",          lat: 45.1760, lng: 5.7300, radius: 0.008 },
    { name: "Villeneuve",       lat: 45.1680, lng: 5.7390, radius: 0.009 },
    { name: "Berriat",          lat: 45.1890, lng: 5.7090, radius: 0.007 },
    { name: "Centre",           lat: 45.1875, lng: 5.7245, radius: 0.007 },
  ],
  npcSpots: [
    { name: "Victor Hugo — Place",       lat: 45.1875, lng: 5.7245 },
    { name: "Presqu'île — Campus",       lat: 45.1950, lng: 5.7170 },
    { name: "Village Olympique — Dalle", lat: 45.1870, lng: 5.7080 },
    { name: "Mistral — Bar",             lat: 45.1760, lng: 5.7300 },
    { name: "Villeneuve — Place",        lat: 45.1680, lng: 5.7390 },
    { name: "Berriat — Café",            lat: 45.1890, lng: 5.7090 },
  ],
  feedLocations: ["Centre", "Presqu'île", "Village Olympique", "Mistral", "Villeneuve", "Berriat"],
  mockPlayers: [
    { id:"gr1", user_id:"gu1",  display_name:"Nekfeu ✓",    avatar_emoji:"❄️", status:"vibe",  lat:45.1875, lng:5.7245, location_name:"Centre",       location_verified:true,  last_action:"Studio session",   is_star:true,  is_npc:true, level:98, crew_color:"#00B4FF", crew_tag:"GRB", updated_at:new Date().toISOString() },
    { id:"gr2", user_id:"gu2",  display_name:"Samir.VO",    avatar_emoji:"🧢", status:"free",  lat:45.1870, lng:5.7080, location_name:"Village Olym.",location_verified:true,  last_action:"Au taff",          is_star:false, is_npc:true, level:7,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"gr3", user_id:"gu3",  display_name:"Inès.Mist",   avatar_emoji:"🌸", status:"vibe",  lat:45.1760, lng:5.7300, location_name:"Mistral",      location_verified:false, last_action:"Terrasse",         is_star:false, is_npc:true, level:4,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
    { id:"gr4", user_id:"gu4",  display_name:"Yanis.Vilnv", avatar_emoji:"🔥", status:"charo", lat:45.1680, lng:5.7390, location_name:"Villeneuve",   location_verified:true,  last_action:"Dalle",            is_star:false, is_npc:true, level:11, crew_color:"#FF3B3B", crew_tag:"VLN", updated_at:new Date().toISOString() },
    { id:"gr5", user_id:"gu5",  display_name:"Celia.Ber",   avatar_emoji:"💄", status:"free",  lat:45.1890, lng:5.7090, location_name:"Berriat",      location_verified:true,  last_action:"Café bio",         is_star:false, is_npc:true, level:5,  crew_color:"#BF5FFF", crew_tag:"GRB", updated_at:new Date().toISOString() },
    { id:"gr6", user_id:"gu6",  display_name:"Kader.Prq",   avatar_emoji:"⛷️", status:"free",  lat:45.1950, lng:5.7170, location_name:"Presqu'île",   location_verified:true,  last_action:"Campus",           is_star:false, is_npc:true, level:6,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
  ],
};

// ─── CONFIG ACTIVE — changer ici pour switcher de ville ─────────────────────
// "toulouse" = test GPS local — changer pour le lancement ville par ville
export const ACTIVE_CITY: CityConfig = TOULOUSE;

export const CITIES: Record<CityId, CityConfig> = {
  toulouse:    TOULOUSE,
  paris:       PARIS,
  lyon:        LYON,
  marseille:   MARSEILLE,
  bordeaux:    BORDEAUX,
  lille:       LILLE,
  nice:        NICE,
  nantes:      NANTES,
  strasbourg:  STRASBOURG,
  montpellier: MONTPELLIER,
  rennes:      RENNES,
  grenoble:    GRENOBLE,
};
