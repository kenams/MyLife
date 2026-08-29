# City Pulse + NPC Brain

This phase extends the existing City Engine. It does not create a second simulation runtime.

## City Pulse

City Pulse is a ranking/policy layer above existing game signals (`happening-now`, battles, outings, dating/social zones, events, Living City events). It should answer: what are the 1-3 most relevant things happening for this player right now?

Rules:
- favor current district and the player's Crew;
- respect dating/social opt-outs;
- deduplicate recently surfaced opportunities;
- never spam more than three primary opportunities;
- keep real-world public signals separate from game signals;
- public safety information may be surfaced, but no precise operational tracking of police/checks/interventions.

Crew dominance is derived from reputation, activity, territories and recent trend. It is gameplay influence, never permission to locate or confront rival members in real life.

## NPC Brain

The existing `lib/npc-brain.ts` remains the execution/economy engine. `lib/npc-brain-policy.ts` adds a context-aware intent layer rather than replacing it.

Intent inputs include needs, personality, time, district activity, nearby people and relevant Crew/social/dating opportunities. NPCs are allowed to idle, rest, refuse or do nothing. Contact cooldowns prevent notification and invitation spam.

Long-term loop:

City Engine -> City Pulse -> NPC context -> intent -> existing NPC action engine -> consequence -> meaningful memory -> next context.

Generative AI is optional last-mile dialogue enrichment only. It must not be called continuously for every NPC tick.
