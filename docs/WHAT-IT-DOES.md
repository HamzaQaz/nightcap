# What this bot does (in plain English)

This is a Discord bot for your Valorant **Premier team**. You add it to your server, point it at your team, and it starts doing the boring stuff for you so you can just play.

Here's what it actually does, in everyday words.

---

## 1. It runs your roster

You have 5 (or more) people on your team. Each one tells the bot their Riot tag once:

> `/link Captain#NA1`

Now the bot knows which Discord user belongs to which Valorant account. The captain says who plays which role:

> `/roster set-role @nightowl controller`

You only have to do this once per player. The bot remembers everyone forever (until you remove them).

**Why you care:** Without this, the bot has no idea which people in your Discord are actually on the team, so nothing else works.

---

## 2. It posts your match results automatically

After you finish a Premier match, you don't have to do anything. The bot is checking every 5 minutes. When it sees a new match, it:

1. Pulls the full match details (score, map, who killed who, headshot %, all that)
2. Posts a stats card in your team's announcements channel
3. Opens a new Discord **thread** for that specific match

The thread is where the team can talk about the match, post clips, and review later.

**Example:**
> 🎮 **Ascent — WIN 13-7**
> Captain (Omen) — 18/12/7, 32% HS
> Phantom (Jett) — 21/14/3, 28% HS
> ...
> *(Click here to open the match thread →)*

If the bot misses one (rare), or you want to ingest a scrim, just paste the match URL or ID:

> `/match link https://tracker.gg/.../match/abc123`

---

## 3. It writes you AI coaching after every match

This is the big one. After a match is posted, the bot calls **Google Gemini** (an AI) and asks it to coach each player based on what actually happened in that game.

Each player gets **two** coaching messages:

### A. A public message in the match thread (everyone sees it)
Short, blameless, and team-friendly. Just a highlight + one thing to focus on next time. Plus a "role involvement %" — basically, "did you play your role well this game?"

> @nightowl — coaching summary
> **TL;DR**: Solid anchor on B; util timing slipped twice
> **Highlight**: 1v2 retake on B round 14
> **Focus area**: Earlier molly on retakes
> **Role involvement**: 78% — Held angles, late retake util on two pushes

### B. A private DM, just to you (no one else sees it)
This one is **direct and detailed**. It tells you:
- 1-3 things you did well
- 1-3 things to improve
- A specific tip for your next match
- Why your role-involvement % was what it was, with evidence ("you held B all 6 defense rounds — that's why anchor presence is 85%")

This way the team thread stays positive, but you still get real, candid feedback in private. No one gets called out in front of the team.

**If your DMs are turned off**, the bot can't message you. It'll post a note in the thread asking you to enable DMs from server members, and your captain can rerun the coaching for you with `/match coach @you <match-id>`.

**Pre-role coaching**: If your captain hasn't assigned you a role yet, the AI uses generic "flex" coaching and reminds the captain to set your role for sharper feedback.

---

## 4. It runs your weekly match-night poll automatically

This one saves the most hassle. Premier matches happen on weekends, but it's annoying to chase down every player to ask "you in for Saturday?" every week.

So the bot does it for you. Here's the flow:

**Monday morning** — bot posts a poll in your announcements channel:

> @members — Match-night poll: **Saturday** (Ascent, 7pm CST)
> Closes Friday 7pm CST · Quorum: 5 ✅
> [✅ Yes] [❓ Maybe] [❌ No]

Players click a button. The bot tallies live.

**24 hours before the match** — bot closes the poll:

- ✅ **5 or more "yes"** → "We're in! See you Saturday." It schedules **two reminders**: one at T-60 minutes ("match in 1 hour") and one at T-10 minutes ("match in 10 min, queue up").
- ❌ **Fewer than 5 yes** → "Not enough for Saturday — opening Sunday poll." It does the whole thing over for the fallback night.
- ❌ **Sunday also fails** → "No quorum this week — skipping Premier. We'll try again next Monday." Done. No more pings, no more polls until the cycle restarts.

By default the ladder is **Saturday primary, Sunday fallback**. The captain can change which days are primary/fallback with `/team match-nights add saturday 1`.

**Why you care:** No more "did everyone see my message?" five times a week. The bot pings everyone at the right moments and only the right moments.

---

## 5. It handles scrims too

If you want to practice outside the official match window:

> `/scrim propose 2026-05-15 19:00 quick mid-week scrim`

The bot creates a scrim entry with reaction buttons for "yes / maybe / no". Same RSVP system as match nights, but for one-off scrims.

> `/scrim list` shows everything coming up.
> `/scrim cancel 3` (captain only) kills it if plans change.

---

## 6. It keeps a VOD library with timestamped notes

You record your matches (Twitch, YouTube, Medal, whatever). When you have a VOD, save it:

> `/vod add https://twitch.tv/yourstream/video/123 abc-match-id`

The bot:
- Saves the VOD URL linked to that match
- Opens a thread named "VOD #5 — abc-match-id"

Now anyone on the team can leave **timestamped review notes**:

> `/vod note 5 4:32 @nightowl peeking too wide on this corner — try shoulder peek next time`

The note shows up in the VOD thread with the timestamp, the tagged player, and your name. Run `/vod list` to see your library.

This is basically a free, simple "VOD review board" that lives inside Discord.

---

## 7. It tracks your season stats

> `/stats season`

The bot looks at every match you've played in the **current Premier season** and shows:

- Your overall record (W-L)
- Per-map stats: how often you win on each map
- Per-player stats: average ADR, headshot %, K/D, top 3 most-played agents

You can pull it up any time to see how you're tracking.

---

## How a typical week looks for you

| When | What happens |
|---|---|
| Mon 7am CST | Bot posts SAT match-night poll. Map shown if known. |
| Mon-Fri | Players click buttons whenever. Bot tallies live. |
| Fri 7pm CST | Poll closes. If 5+ yes → match locked in. If not → SUN poll opens. |
| Sat 6pm CST | Bot posts "match in 1 hour" reminder. |
| Sat 6:50pm CST | Bot posts "match in 10 min — queue up" reminder. |
| Sat 7pm CST | You play your match. |
| Sat ~9pm CST | Bot picks up the finished match within 5 minutes. Posts stats card + opens match thread. |
| Sat ~9:01pm CST | Each player gets a public summary in the thread + a private DM with detailed coaching. |
| Sun-Mon | Watch your VOD, drop notes in the VOD thread, prep for next week. |

You did basically nothing except play the game and click some buttons. That's the point.

---

## Commands cheat sheet

### Setup (captain does these once)
- `/team set region na`
- `/team set conference NA_US_WEST`
- `/team set henrik-team-id <your-team-id>`
- `/team set captain-role @Captain`
- `/team set member-role @Player`
- `/team set channel #premier-announcements`
- `/team show` — see your current config

### Roster
- `/link Captain#NA1` — anyone links their own Riot account
- `/unlink` — undo it
- `/roster add @user RiotName#TAG controller` — captain adds someone
- `/roster set-role @user duelist` — captain changes a role
- `/roster remove @user` — captain kicks someone

### Match nights
- `/team match-nights list` — see your current ladder (default: SAT primary, SUN fallback)
- `/team match-nights add saturday 1` — set Saturday as primary
- `/team match-nights add sunday 2` — set Sunday as fallback
- `/team match-nights remove sunday` — drop a night

### Scrims
- `/scrim propose 2026-05-15 19:00 [note]`
- `/scrim list`
- `/scrim cancel <id>` — captain only

### Matches
- `/match latest` — re-post the most recent match
- `/match link <url-or-id>` — manually ingest a match
- `/match coach @player <match-id>` — re-run AI coaching for one player

### VODs
- `/vod add <url> [match-id]`
- `/vod note <vod-id> <mm:ss> [@player] <text>`
- `/vod list`

### Stats
- `/stats season`

### Help
- `/help` — shows all commands

---

## A few honest limits

- Only one team per Discord server. If you want to manage multiple teams, you need multiple Discord servers (or wait for v2).
- AI coaching depends on the match data Henrik provides. If a player's stats are missing or weird, the AI works with what it has.
- The DM-disabled fallback is a "you must turn DMs on" thing — Discord doesn't let bots force-DM users.
- The `❓ Maybe` button doesn't count toward quorum (only ✅ does). That's intentional — captain can override manually if needed.
- The bot is **self-hosted on your machine**. If you turn off your computer, the bot is offline.

That's it. The whole thing is meant to feel like a really attentive team manager who never sleeps and writes you personalized coaching notes after every match.
