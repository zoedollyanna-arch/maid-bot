# 🎀 Maid Bot — Cozy Manor & Roleplay Discord Bot

A Discord maid bot designed for roleplay, cozy manor aesthetics, and household management without chat spam.

---

## 🌟 Key Features

### 1. 🛡️ Anti-Spam & Chat Flow Protection
- **Subtle Emoji Reactions:** Common keywords (`tired`, `sleepy`, `hungry`, `bored`, `dirty`, `food`) receive organic emoji reactions (🍵, 💤, 🍪, 🧶, 🧹, 🍽️) rather than unsolicited chat messages.
- **On-Demand Interaction:** The maid only speaks when directly addressed (e.g., `"Maid, ..."` or `@Maid`) or during extremely rare ambient moments (15% chance, 20-minute channel cooldown).
- **Drama De-escalation:** Monitored conflict triggers (`drama`, `fight`, `argue`) activate gentle reminders to lower the temperature with a 10-minute cooldown.

### 2. 🫖 Interactive Discord Components (Buttons & Dropdowns)
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

### 3. 🛎️ Roleplay Service Bell
- **/bell `[request]`:** Ring the silver service bell.
  - Custom roleplay greetings based on role (`Head of Household`, `Kids`, `Siblings`, `Kin`) and favor standing:
    - **Head of Household:** Immediate, deferential response (*"At your command, Head of Household"*).
    - **Golden Child:** Warm, affectionate greeting (*"A pleasure, dear child"*).
    - **In the Doghouse:** Scolded (*"Ring that bell again with dirty hands and see what happens"*).
    - **Kids:** Inquisitive (*"What has been spilled or misplaced this time?"*).

### 4. 📊 Favor & Standing System
- **Status Tiers:**
  - 🌟 **Golden Child (20+ Favor):** Curfew callout immunity, secret gourmet treats, priority attention.
  - ✨ **Favored Resident (10+ Favor):** Unlocks fresh pastries and afternoon tea treats.
  - ☕ **In Good Standing (0–9 Favor):** Standard courteous household accommodations.
  - ⚠️ **On Thin Ice (-1 to -9 Favor):** Under close maid scrutiny.
  - 🪣 **In the Doghouse (-10 or less Favor):** Refused luxury teas (served lukewarm tap water or stale bread crusts) until chores are completed.
- **/favor `[user]`:** Check your or another member's favor points and unlocked privileges.
- **/whoami:** View your household role, custom title, and favor standing tier.
- **/household:** View full manor standings, curfew status, active reminders, and pending incident reports.

### 5. 📜 Manor Incident Ledger
- **/incident record `user` `infraction`:** Log a household incident (e.g. `"Left wet umbrella on antique chaise"`). The maid records it with formal commentary in the ledger and announces it.
- **/incident log `[user]`:** Review recent manor infractions and their current review status.
- **/incident resolve `id` `verdict`:** (*Head of Household only*) Adjudicate incidents:
  - *Pardon* (0 favor penalty)
  - *Reprimand* (-2 favor points)
  - *Severe Penalty* (-5 favor points & chores)
  - *Exonerated* (+1 favor point for false accusation)

### 6. 🖱️ Discord User Apps (Zero-Typing Roleplay)
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
