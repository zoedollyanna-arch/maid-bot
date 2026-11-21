# 🎀 Maid Bot — Cozy Manor & Roleplay Discord Bot

A Discord maid bot designed for roleplay, cozy manor aesthetics, and household management without chat spam.

---

## 🌟 Key Features

### 1. 🛡️ Zero-Spam Guarantee & Anti-Spam Protection
- **No Unsolicited Silence Spam:** The old 30-minute quiet check (`"Am I dismissed, or are we ignoring each other?"`, `"The halls are quiet"`) is permanently disabled!
- **Zero Chat Disruption:** The maid **NEVER** sends uninvited text messages into chat during roleplay.
- **Explicit Mentions Only:** Text replies trigger **only** when a member explicitly `@mentions` the maid directly.
- **Subtle Emoji Reactions:** Everyday words (`tired`, `sleepy`, `hungry`, `bored`, `dirty`, `food`) receive organic emoji reactions (🍵, 💤, 🍪, 🧹, 🍽️) rather than unsolicited text messages.
- **Drama De-escalation:** Conflict keywords (`drama`, `fight`, `argue`) trigger gentle calming reminders with a 10-minute cooldown.

### 2. 🎀 Jwett Moments ♡ — Interactive Family Roleplay System
Turn your server into an interactive family RP experience where members perform actions, respond with real Discord buttons, advance branching scenes, level up closeness, and save family memories!

#### 🌸 Interactive Multi-Turn Scenes:
- **/tuckin `target` `[style]`:** Bedtime moment with warm blankets, nightlights, and favorite comfort items!
  - **Target's Turn:** `[🧸 Snuggle Closer]`, `[💋 Kiss Goodnight]`, `[📖 Ask for a Story]`, `[😴 Fall Asleep]`, `[❌ End Scene]`
  - Clicking a choice advances the scene with a custom narrative and gives the initiator follow-up options (`[💗 Stay a Little Longer]`, `[🌙 Sing a Lullaby]`, etc.)
  - Closing beat automatically saves a memory to the family album and increases relationship closeness!
  - **Permissions Guard:** Only the intended participant can click their turn's buttons!

#### 🧸 Full Suite of Roleplay Moments:
- **🎀 Affection:** `/hug`, `/kiss`, `/kissforehead`, `/cuddle`, `/holdhands`, `/carry`
- **🧸 Mommy & Baby / Parenting:** `/tuckin`, `/rock`, `/soothe`, `/feed`, `/bathtime`, `/brushhair`
- **🌙 Bedtime:** `/goodnight`, `/storytime`, `/lullaby`, `/nightmare`, `/wake`
- **🏡 Family Life:** `/cook`, `/familydinner`, `/homework`, `/knock`, `/visit`
- **💕 Emotional RP:** `/comfort`, `/cry`, `/apologize`, `/reassure`, `/checkon`
- **🥂 Estate Lifestyle:** `/spa`, `/shopping`, `/familyouting`, `/movie`, `/familymeeting`
- **🎁 Special Moments:** `/surprise`, `/gift`, `/birthday`, `/celebrate`, `/proudofyou`

#### 👑 Signature Color Palettes:
- **Baby Pink (`#f7c6d4`):** Affection & Mommy/Baby
- **Lavender (`#cba6f7`):** Bedtime & Lullabies
- **Warm Peach (`#fab387`):** Family Life & Dinners
- **Soft Aqua (`#89dceb`):** Emotional Support & Comfort
- **Champagne Gold (`#f9e2af`):** Estate Lifestyle & Celebrations

#### 📜 Character Profiles & Family Ties (`/rp`):
- **/rp profile `[user]`:** Displays family role, RP mood, favorite comfort item, stage/age, pronouns, family connections, total moments shared, and last recorded memory!
- **/rp setup:** Personalize your own family roleplay character card.
- **/rp relationship `set|remove` `target` `relation`:** Establish deep family bonds (e.g. *Mother, Daughter, Son, Sister, Auntie*). Relationships level up with mutual interactions (*Inseparable Souls 💕, Deeply Cherished 🌸*).
- **/rp family `[user]`:** View a member's family connections and closeness tiers.
- **/rp memories `[user]`:** Browse the Jwett Estates scrapbook of cherished family moments.

### 3. 🫖 Interactive Discord Components (Buttons & Dropdowns)
- **/tea:** Wheels out an interactive tea cart with custom blends:
  - *Chamomile & Lavender Honey*
  - *Black Earl Grey*
  - *Ceremonial Matcha Latte*
  - *Garden Peppermint*
  - *Gourmet Hot Chocolate* (Special privileges for Kids & high-standing members)
- **/snack:** Opens the manor pantry dropdown:
  - *Warm Chocolate Chip Cookies*
  - *Afternoon Scones with Clotted Cream & Jam*
  - *Chilled Fruit Plate*
  - *Cucumber Sandwiches*
  - *French Pastel Macarons* (Unlocked at Favor 10+)
- **/chores:** Spawns the interactive Manor Chore Board:
  - `[🧹 Dust Library]`, `[✨ Polish Silver]`, `[🌿 Tend Conservatory]`, `[🧺 Fold Linens]`
  - Features d20 effort checks:
    - **Natural 20:** Critical perfection (+2 Favor)!
    - **10–19:** Standard good work (+1 Favor).
    - **2–9:** Mediocre effort (0 Favor).
    - **Natural 1:** Clumsy catastrophe! Shatters porcelain heirloom (-1 Favor).

### 4. 🛎️ Roleplay Service Bell
- **/bell `[request]`:** Ring the silver service bell.
  - Custom roleplay greetings based on role (`Head of Household`, `Kids`, `Siblings`, `Kin`) and favor standing:
    - **Head of Household:** Immediate, deferential response (*"At your command, Head of Household"*).
    - **Golden Child:** Warm, affectionate greeting (*"A pleasure, dear child"*).
    - **In the Doghouse:** Scolded (*"Ring that bell again with dirty hands and see what happens"*).
    - **Kids:** Inquisitive (*"What has been spilled or misplaced this time?"*).

### 5. 📊 Favor & Standing System
- **Status Tiers:**
  - 🌟 **Golden Child (20+ Favor):** Curfew callout immunity, secret gourmet treats, priority attention.
  - ✨ **Favored Resident (10+ Favor):** Unlocks fresh pastries and afternoon tea treats.
  - ☕ **In Good Standing (0–9 Favor):** Standard courteous household accommodations.
  - ⚠️ **On Thin Ice (-1 to -9 Favor):** Under close maid scrutiny.
  - 🪣 **In the Doghouse (-10 or less Favor):** Refused luxury teas (served lukewarm tap water or stale bread crusts) until chores are completed.
- **/favor `[user]`:** Check your or another member's favor points and unlocked privileges.
- **/whoami:** View your household role, custom title, and favor standing tier.
- **/household:** View full manor standings, curfew status, active reminders, and pending incident reports.

### 6. 📜 Manor Incident Ledger
- **/incident record `user` `infraction`:** Log a household incident (e.g. `"Left wet umbrella on antique chaise"`). The maid records it with formal commentary in the ledger and announces it.
- **/incident log `[user]`:** Review recent manor infractions and their current review status.
- **/incident resolve `id` `verdict`:** (*Head of Household only*) Adjudicate incidents:
  - *Pardon* (0 favor penalty)
  - *Reprimand* (-2 favor points)
  - *Severe Penalty* (-5 favor points & chores)
  - *Exonerated* (+1 favor point for false accusation)

### 7. 🖱️ Discord User Apps (Zero-Typing Roleplay)
Right-click any member in chat -> **Apps**:
- **Serve Drink:** Opens an ephemeral menu to choose a beverage (Afternoon Tea, Hot Cocoa, Lemonade, Coffee, Spiced Cider, Ice Water) delivered directly to them by the maid with custom flavor text.
- **Tuck In:** Fluffs pillows and adjusts blankets for that member with custom role-based narration.

---

## 🚀 Setup & Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file in the root directory:
   ```env
   DISCORD_TOKEN=your-bot-token
   DISCORD_CLIENT_ID=your-application-id
   DISCORD_GUILD_ID=your-server-id
   
   # Optional custom role names:
   ROLE_HEAD="Head of Household"
   ROLE_KIDS="Kids"
   ROLE_SIBLINGS="Siblings"
   ROLE_KIN="Kin"
   ```

3. Start the bot:
   ```bash
   npm start
   ```

> **Note:** Providing `DISCORD_GUILD_ID` registers slash and context menu commands immediately to your test server. If omitted, Discord registers them globally which can take up to an hour to propagate.
