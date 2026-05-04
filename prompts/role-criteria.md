# Role-Involvement Scoring Rubric

Each player's `role_involvement_pct` is the model's weighted aggregate of the
per-criterion scores listed below for their assigned role. Per-criterion scores
+ evidence go into the private block so the player can see *why*. Public block
exposes only the aggregate pct + a one-liner rationale.

## Duelist
- **entry_attempts**: was the player pushing first into contested space?
- **opening_duels_won**: success rate on opening duels they initiated
- **space_taken**: did entries open up map control for teammates?
- **util_used_to_enable**: dashes/flashes/blinds spent to create team value (not solo plays)

## Initiator
- **recon_util_landed**: drones/flashes/sonar revealed enemy positions or denied space
- **flashes_for_kills_or_trades**: flashes that led to teammate kills/trades within 3s
- **info_called**: actionable callouts that resulted in team adjustments
- **post_plant_setups**: util held for post-plant denial / retake disruption

## Controller
- **smokes_at_executable_timings**: smokes placed before execute, not reactive
- **mid_control_util**: mid smokes/mollies for map control, not just site
- **retake_smokes**: smokes used to enable retake (cut sightlines into site)
- **utility_economy**: util conserved for high-leverage rounds, not blown on save rounds

## Sentinel
- **site_anchor_presence**: stayed on assigned site through critical timings
- **flank_watches**: watched flank lanes during exec/post-plant
- **util_held_in_reserve**: trips/turret kept for retake/post-plant rather than burned early
- **retake_util**: trips/cages/molly used in retakes when site was lost

## Flex
- Use the criteria from the role of the agent the player actually played that map.
- If the agent doesn't fit one role cleanly (e.g. Cypher on attack), pick the closest role and apply its criteria.
- A short note in `evidence` should mention the agent and which role's rubric was applied.

## Scoring Bands

- **0-20**: barely fulfilled the role
- **21-40**: minimal; many missed opportunities
- **41-60**: average; about what's expected from a casual ranked player
- **61-80**: good; consistent role fulfillment with some standout moments
- **81-100**: excellent; role-defining play

## Output Notes

- Each criterion gets a 0-100 `score_pct` + `evidence` (<= 140 chars).
- `evidence` should reference concrete observable behavior in the match: round counts, agent abilities used, kill/death events.
- The aggregate `role_involvement_pct` is a weighted average of the criteria. Criteria can be weighted equally if the model has no strong reason to differentiate.
- The public `role_involvement_one_liner` (<= 100 chars) summarizes the aggregate without listing criteria.
