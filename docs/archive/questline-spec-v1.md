# Questline: Product and Engineering Overview

**One-liner:** Questline turns the downtime of waiting for the T into a game of small adventures with the *right* strangers. An AI matcher decides **who** you should meet; Meta Ray-Ban Display glasses are how you **find, meet and play** with them, eyes up and hands free.

---

## 1. Guiding principles (decisions we are locking)

| # | Decision | Why |
|---|----------|-----|
| D1 | **Who you meet > what you do.** The matching engine is the product. Missions are thin, short and swappable. | Our real differentiator vs. Errant, Timeleft, Sidequest, KrewQuest. |
| D2 | **Downtime only.** Every mission fits inside the platform wait (target 60 to 180 seconds). Missions are never longer than the time until the train arrives. | Riders have somewhere to be. No detours, no side quests. |
| D3 | **Phone decides, glasses deliver.** Phone = profile, matching brain, background services, post-ride social. Glasses = the live, in-the-moment layer. The phone stays in the pocket during a mission. | Keeps the hardware purposeful (see section 3). |
| D4 | **Platform is primary, train is secondary.** Live pairing happens on the platform. In-car pairing is optional and same-car only. Cross-car is asynchronous and lightweight. | Platforms have a built-in timer (the arrival prediction) and people are standing around anyway. |
| D5 | **Route overlap is a hard filter for matching, interest is the ranking.** We only match riders whose journeys overlap (same line, same direction, ideally same branch). | You want to meet people going your way, and it's what makes repeat encounters possible. |
| D6 | **Opt-in everywhere.** Badge worn = consent to be approached. Both people say yes before anything starts. No face recognition, ever. | Safety and trust; also a strong judge talking point. |
| D7 | **Novelty is rewarded.** The matcher penalizes repeat pairings and rewards meeting someone new. Progress is tracked as "people met" per line. | Goal is to see a bunch of different people. |

---

## 2. User journey (end to end)

### 2.1 Before the first ride (phone, one time, about 90 seconds)
Profile onboarding. Keep it to 5 quick screens:
1. **Basics:** first name, avatar/color, 18+ confirmation.
2. **Interests:** pick 3 to 5 from about 25 tags (music, food, sports, startups, books, hiking, gaming, art, etc.).
3. **Ask me about:** one short free-text line (e.g. "ask me about my sourdough starter").
4. **Social battery:** `Just a nod` / `Quick chat` / `Let's talk`. Controls how intense missions are.
5. **Local or visitor:** `Local`, `Student`, `Visiting`, plus languages spoken. Powers local/tourist pairing.

Optional: **Commute pattern.** Home line and station, usual times. Used to pre-warm matches and predict journeys.

Then **badge pairing:** link the physical badge (BLE ID) and pair the glasses.

### 2.2 Before getting on (phone, 10 seconds, a.k.a. "Ride Mode")
- One tap: **"Riding now"** (or auto-prompt from commute pattern / location). Select or confirm station, line and direction (e.g. Kenmore, Green Line, eastbound).
- The app creates a **Journey** (origin, line, direction, expected stops, ETA window) and starts background scanning and matching.
- The user puts the phone away. Everything after this happens on the glasses.

### 2.3 On the platform (glasses lead)
1. **Glance state:** tiny HUD shows station, next train countdown, and a subtle "2 riders open to play" indicator.
2. **Lock-on:** user looks at a badge. The glasses camera reads the badge's tag, confirms it matches a *pre-ranked* match from the phone, and anchors a card to that person.
3. **Offer:** card shows first name, one-line "why you two" (AI generated), and a mission with the timer. Voice: **"Yes"** / **"Skip."**
4. **Both say yes** (mutual consent handshake via backend).
5. **Mission runs** with a countdown tied to the train ETA.
6. **Stamp:** hold badges side by side (BLE close range or NFC). Both sides confirm the mission ID. Stamp awarded for that station.
7. **Train arrives:** HUD auto-ends the mission with a graceful "to be continued" if unfinished.

### 2.4 On the train
- **Same car:** optional micro-missions (60 to 90 seconds), triggered only if two matched riders are in BLE range and both have "on train" mode on.
- **Different cars:** see section 6.

### 2.5 After the ride (phone)
- **Passport:** stamps per station, per line.
- **People met:** a lightweight "crew" list. Either person can choose to **stay in touch** (mutual opt-in) and share a handle. Nothing is shared by default.
- Rate the match (thumbs up/down) to improve the matcher.

---

## 3. What the glasses do (and why they're not a buzzword)

The pitch to judges: **"The phone decides who. The glasses make it happen."**

| Capability | Phone-only experience | With glasses | Why it matters |
|------------|----------------------|--------------|----------------|
| **Finding the person** | Look at a map or list, compare badge colors, scan the platform. | Look at someone, and the glasses **lock on** to their badge and anchor a card to them. | Turns "which one is it?" into "that person, right there." |
| **Starting a mission** | Pull out the phone, read, tap. Breaks eye contact. | Card appears in the lens, you say "Yes" without looking down. | Eyes stay up, which is the whole point of social play. |
| **Doing a mission** | Both people staring at screens. | Prompt in-lens, you are looking at each other and the world. | The game happens *in the real world*, not on a screen. |
| **Mission verification** | Self-reported. | Glasses confirm it (badge tag in view, scene or object check for "spot" missions, stamp handshake). | Harder to cheat, more satisfying. |
| **Crowd awareness** | Constant phone checking. | Ambient glance indicator, discreet haptic or visual nudge. | Doesn't pull you out of the moment. |
| **Cross-car direction** | Map UI. | Subtle arrow and car hint when you want to find a match. | Hands-free wayfinding on a moving platform. |

**Rule for the team:** every feature we demo must pass the test *"would this be worse if the user had to take out a phone?"* If not, it belongs on the phone.

### Glasses HUD states
1. **Idle:** station, line, countdown. Minimal.
2. **Nearby:** subtle dot count of opted-in riders.
3. **Lock-on:** reticle on badge, first name, route overlap chip, "why you two" line.
4. **Offer:** mission title, timer, "Say Yes / Skip."
5. **Active:** countdown + one-line prompt.
6. **Verify:** "Hold badges together."
7. **Stamp:** celebration animation, station stamp. Brief and auto-dismiss.
8. **Late-train bonus:** distinct accent when a delay unlocks a rare mission.

> **Open item (verify before the event):** Confirm what the Meta Ray-Ban Display SDK / device access toolkit actually exposes (camera frames, display surface, voice input, Neural Band gestures, background processing). Build against an abstraction layer so we can fall back to a **glasses simulator** (phone or web view styled as a lens) without rewriting logic.

---

## 4. AI matching engine

### 4.1 Goal
Maximize the chance that two people who match will (a) physically be in the same place, (b) want to talk, and (c) have something to talk about.

### 4.2 Pipeline
1. **Candidate set (hard filters).** Both riders opted in, 18+, not blocked or recently paired, journeys overlap (same line, same direction, and an overlapping time window), and both are within BLE range or on the same platform (station match).
2. **Scoring.** Weighted sum:

```
score = w_route   * route_overlap          # shared stops / same branch / same direction
      + w_interest* interest_similarity    # embedding similarity of tags + "ask me about"
      + w_comp    * complementarity        # local<->visitor, different fields with shared interest
      + w_battery * social_battery_match   # don't pair "just a nod" with "let's talk"
      + w_novelty * novelty                # haven't met, or met long ago
      - w_repeat  * recent_pair_penalty
```

3. **Ranking and reciprocity.** Only surface a pair if it is a top match for *both* sides (mutual).
4. **Mission selection.** Pick a mission from the deck using the pair type, time remaining, social battery and cooldown history (see section 5).
5. **LLM "why you two" line.** One short, friendly sentence grounded in the two profiles' shared tags (e.g. "You both love ramen and are heading to Park Street").

### 4.3 What the LLM does and does not do
- **Does:** write the one-line icebreaker, personalize mission wording, embed tags and free-text for similarity.
- **Does not:** decide consent, generate missions on the fly in the critical path, or see anything outside of the user's profile. Missions come from a curated deck to guarantee safety and latency.
- **Latency:** pre-compute pair scores and blurbs when a Journey starts and refresh periodically. By the time someone looks at a badge, the card is already cached.

### 4.4 Cold start
- Seed demo profiles. For judges, run with 3 to 4 team members plus scripted "ghost riders."
- New users with sparse profiles lean on route overlap and social battery.

---

## 5. Mission system

**Design rule:** missions are *templates with slots*, filled from live context (station, line, time left, partner info). That makes them feel fresh without us writing hundreds of missions.

### 5.1 Categories (keep 5, about 4 to 6 templates each for the demo)
| Category | Example | Time |
|----------|---------|------|
| **Create** | "Rename {station} together. Best name wins." | 60 to 120 s |
| **Show me** | Local: "Tell them one thing to do above ground near {station}." | 60 to 90 s |
| **Spot** | "Find something on this platform that's {color or theme}." | 30 to 60 s |
| **Quick game** | "Two truths and a lie, one round each." | 90 to 150 s |
| **Late-train bonus** | Rare, longer, higher stamp rarity. Unlocked when MBTA reports a delay over N minutes. | 3+ min |

### 5.2 Anti-repetition rules
- Per user: no template repeated within the last 10 missions.
- Per pair: never the same template twice.
- Per station: at least one station-specific variant (slot filled from a small station fact list).
- Rarity: 10 to 15% chance of a "rare" mission variant.

### 5.3 Constraints
- Must fit within `eta_minutes - 30s` buffer. Otherwise downgrade to a shorter template or hold the offer.
- Public and low-risk only. No requests for personal info, no physical contact beyond the badge handshake, no recording the other person.
- Either party can skip at any time with no penalty.

---

## 6. The hard cases

### 6.1 Waiting on the platform
- Matches are computed while people approach the platform. By the time you look up, your card is ready.
- Use **opt-in badge + glasses lock-on** to reduce awkwardness: you're not approaching a random person, you're approaching someone who's signaled they're open.
- Crowded platforms: show only the **top 1 to 2** matches. Don't overwhelm the HUD.

### 6.2 Different cars
Two options, decided as follows:
- **MVP (decision):** Live missions are **same-car only**. If a match is on the same train but a different car, the HUD shows a "same train, car away" soft indicator and queues a **platform mission at the next transfer or shared stop**, or a post-ride "you rode the same train" stamp.
- **Stretch:** **Linked quests.** Both riders get complementary clues on their own lens. Each completes their half, and the result is revealed when both reach a shared station (or at the end of the ride). Keeps the game going without requiring proximity.

### 6.3 Seeing lots of different people / heading your way
- Matching is route-first (hard filter), so you're always paired with someone on your line and direction.
- **Novelty weighting** and a visible **"people met" counter per line** push the system to introduce you to new people each time.
- **Line collection:** meet 5 riders on each branch (B, C, D, E on the Green Line; Ashmont and Braintree on the Red Line) to complete a line set.
- On busy stations, allow **trios** as a stretch feature for variety.

### 6.4 Not derailing people
- Any mission auto-cancels when the train is approaching (T-30s) and the HUD says "enjoy your ride."
- "Hurry mode": users can set `Only quick missions` in Ride Mode.
- No mission ever requires leaving the platform or missing a train.

---

## 7. Hardware and detection

| Layer | Tech | Purpose |
|-------|------|---------|
| **Badge** | BLE advertiser (ESP32 or nRF52; for the demo, a second phone can emulate it) with rotating anonymous ID, plus a printed ArUco/AprilTag-style pattern and color | Presence, identity lock-on, stamp handshake |
| **Proximity** | BLE RSSI thresholds (about 5 m for discovery, very close for stamp) | Detect nearby opted-in riders, works underground |
| **Visual lock-on** | Glasses camera detects the badge tag | Anchors the card to the right person. **Badge only, no face recognition.** |
| **Stamp handshake** | NFC or high-RSSI BLE + matching mission ID on both sides within a time window | Prevents cheating, makes the moment tactile |
| **Station context** | Platform BLE beacon, last GPS fix, or QR / manual check-in for demo | Which station you're at |
| **Train timing** | MBTA V3 API (predictions, vehicles, alerts) | Countdown timer, delay detection, direction |

### Same-train and car detection
- Use MBTA `trip` ID from predictions plus a user "on train" confirmation (or motion/boarding heuristic) to group riders on the same train.
- Car-level location is not provided by MBTA. Use BLE RSSI between riders. Treat "same car" as strong RSSI, "same train" as shared trip ID.

---

## 8. Architecture

```
Badge (BLE ID) ──┐
                 ├─> Mobile app (profile, Ride Mode, scanning, matching cache, passport)
Glasses ─────────┘        │            ▲
 (HUD, camera,            ▼            │
  voice, lock-on)   Backend API ──> Matching service (scoring + LLM blurbs)
                          │
                          ├─> Mission service (deck, slots, cooldowns)
                          ├─> Consent / session service (mutual yes, stamps)
                          └─> MBTA V3 adapter (predictions, alerts, vehicles)
```

### Suggested ownership split
| Workstream | Owner focus |
|------------|-------------|
| **Glasses client** | HUD states, lock-on, voice yes/skip, stamp UI, simulator fallback |
| **Mobile app** | Onboarding, Ride Mode, BLE scanning, background service, Passport / People met |
| **Matching service** | Candidate filter, scoring, embeddings, LLM blurb, caching |
| **Backend / MBTA** | Journeys, mission service, consent handshake, MBTA adapter, delay triggers |
| **Hardware / badge** | BLE firmware or phone emulator, ArUco tag design, NFC or close-BLE handshake |
| **Design / demo** | Glasses HUD visuals, phone UI, demo script, ghost riders |

---

## 9. Data model (starter)

```
User        { id, first_name, avatar, age_verified, interests[], ask_me_about, social_battery,
              status(local|student|visitor), languages[], embedding, badge_id, created_at }
Journey     { id, user_id, line, direction, origin_stop, expected_stops[], start_ts,
              eta_ts, mode(platform|train), trip_id? }
Match       { id, journey_a, journey_b, score, why_blurb, mission_id?, state }
Mission     { id, template_id, category, slots{}, duration_s, rarity, requires(handshake|spot|none) }
MissionSession { id, match_id, mission_id, a_consent, b_consent, started_ts, ended_ts, state }
Stamp       { id, user_id, station, line, mission_session_id, rarity, ts }
Connection  { id, user_a, user_b, mutual_opt_in, shared_handle_a?, shared_handle_b? }
SafetyEvent { id, reporter, subject, reason, ts }
```

### Key API surface
```
POST /journeys                  # start Ride Mode
GET  /matches?journey_id=       # pre-ranked candidates (cached)
POST /matches/{id}/consent      # a/b yes or skip
POST /sessions/{id}/stamp       # both sides confirm handshake
GET  /mbta/predictions?stop=    # proxied, cached
POST /report                    # safety
```

---

## 10. Safety, privacy and trust (must-haves)

- **Opt-in:** wearing the badge and enabling Ride Mode is consent to be matched. Both people must say yes per mission.
- **Rotating anonymous BLE IDs** so riders cannot be tracked over time.
- **No face recognition.** Lock-on uses the badge pattern only. Say this explicitly in the pitch.
- **Camera frames processed ephemerally.** Do not store or upload frames. Only the decoded badge ID leaves the glasses.
- **First name only** shown in-lens. No photos, no last names, no contact details until mutual opt-in.
- **Public, low-risk missions only.** Curated deck, no open-ended LLM mission generation.
- **Skip, block, report** are one gesture or tap away. Blocked users never match again.
- **18+ only.**
- **Ghost mode:** user can pause being discoverable at any time.

---

## 11. Differentiation (for the pitch and judges)

| App | What it does | Questline difference |
|-----|--------------|----------------------|
| Errant | Daily solo real-world dare, friends-only feed | Strangers, in the moment |
| Timeleft | Weekly dinner with 5 strangers, planned days ahead | Happens on your ride, no planning |
| Sidequest | Browse and sign up for nearby activities | Dealt to you when someone is next to you |
| KrewQuest | AI matches people by interest, meet up later | The person is standing next to you *now* |
| happn | Shows people you've crossed paths with, after the fact | Acts while they're still there |
| StreetPass (3DS) | Swaps data when you pass, no interaction | Makes people actually talk |
| Klick (HackMIT) | Both-say-yes badge matching for networking events | A game on the T, built around a repeatable commute |

**Our combined edge:** real-time, route-aware matching + hardware that finds the person for you + built-in timer (the train) + a low-stakes game that makes the first hello easy.

---

## 12. Hackathon scope and priorities

### P0: must work end to end (the demo loop)
- Profile onboarding and Ride Mode (phone).
- BLE detection between two devices (two phones or badges).
- Matching with route overlap + interest score, cached; LLM "why you two" line.
- Glasses (or simulator) HUD: nearby, lock-on, offer, voice Yes, active mission with MBTA countdown, stamp.
- Stamp handshake (BLE close range or NFC) confirmed by both sides.

### P1: makes it feel real
- Late-train bonus mission using live MBTA alerts or a simulated delay.
- Local/visitor pairing mission.
- Passport screen with stamps per line.
- Anti-repetition and rarity.

### P2: stretch
- Linked cross-car quests.
- Trios on busy platforms.
- Line-completion collections and "people met" leaderboard.
- Persistent crew and stay-in-touch flow.

### Fake it (scripted for the demo)
Ghost riders to populate the platform, a pre-seeded profile set, scripted delay, and station beacon (use manual station picker).

---

## 13. Demo script (about 3 minutes)

1. **Setup (20 s):** show the 90-second profile and Ride Mode on the phone. Put the phone away.
2. **Platform (30 s):** wearer on the glasses sees "2 riders open to play" on the HUD.
3. **Lock-on (30 s):** looks at a badge, reticle lands, card appears: "Maya • Green Line E • You both love ramen."
4. **Mission (40 s):** both say yes, "Rename Kenmore" starts with a countdown tied to the live train ETA.
5. **Stamp (20 s):** badges together, both confirm, Kenmore stamp.
6. **Bonus (20 s):** simulated delay triggers a rare late-train mission.
7. **Close (20 s):** Passport view, and the line: *"The phone decides who. The glasses make it happen."*

---

## 14. Open questions for the team

1. What does the Meta Ray-Ban Display SDK allow today (camera access, display, voice, gestures, background execution)? Does the fallback simulator need to be demo-ready?
2. Badge form factor: custom ESP32 hardware or phone-as-badge for the demo?
3. NFC or close-range BLE for the stamp handshake?
4. Station detection for the demo: beacon, QR check-in, or manual picker?
5. Which line do we demo on (Green Line B/C/D/E is a good showcase for branch matching)?
6. Do we show match percentages anywhere, or keep matching invisible and only show the "why you two" line? (Recommendation: invisible, to avoid a dating-app feel.)
7. How do we handle the first time a user has no one else on the network? (Recommendation: solo "station stamp" quests as a fallback so the app is never empty.)
