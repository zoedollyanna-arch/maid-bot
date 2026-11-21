const fs = require("fs");
const path = require("path");
const http = require("http");

// ── Render Web Service keep-alive ──────────────────────────────────────────
// Render's free tier requires a listening HTTP server or it will kill the
// process. This tiny server just returns 200 OK for health checks.
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
	res.writeHead(200, { "Content-Type": "text/plain" });
	res.end("Maid bot is on duty. 🧹");
}).listen(PORT, () => console.log(`[HTTP] Health server listening on port ${PORT}`));
// ──────────────────────────────────────────────────────────────────────────

const {
	Client,
	GatewayIntentBits,
	Partials,
	ActivityType,
	REST,
	Routes,
	SlashCommandBuilder,
	ChannelType,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	StringSelectMenuBuilder,
	ContextMenuCommandBuilder,
	ApplicationCommandType,
} = require("discord.js");
require("dotenv").config();

const DATA_PATH = path.join(__dirname, "data.json");
const DEFAULT_WELCOME_CHANNEL_ID = "1461354800833626122";
const DEFAULT_VISITOR_ROLE_ID = "1573304596170936381";

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMembers,
	],
	partials: [Partials.Channel, Partials.GuildMember, Partials.User],
});

let data = loadData();
let saveTimer = null;

function loadData() {
	try {
		const raw = fs.readFileSync(DATA_PATH, "utf8");
		return JSON.parse(raw);
	} catch (error) {
		return {
			guilds: {},
			global: {
				statusRotation: [
					"Polishing silverware",
					"Judging quietly",
					"Preparing snacks",
					"Watching the hallway",
				],
				statusIntervalMinutes: 10,
			},
		};
	}
}

function scheduleSave() {
	if (saveTimer) return;
	saveTimer = setTimeout(() => {
		saveTimer = null;
		fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
	}, 500);
}

function getGuildState(guildId) {
	if (!data.guilds[guildId]) {
		data.guilds[guildId] = {
			mode: "sassy",
			nightMode: false,
			welcomeChannelId: DEFAULT_WELCOME_CHANNEL_ID,
			announceChannelId: null,
			lastActiveChannelId: null,
			lastMessageAt: 0,
			lastNudgeAt: 0,
			lastCurfewAt: null,
			cooldowns: {},
			roles: {},
			rolesByUser: {},
			addresses: {},
			notes: [],
			jokes: [],
			reminders: [],
			sl: {
				home: null,
			},
			curfew: "23:00",
			favor: {},
			checkIns: {},
			incidents: [],
		};
	}
	if (!data.guilds[guildId].welcomeChannelId) data.guilds[guildId].welcomeChannelId = DEFAULT_WELCOME_CHANNEL_ID;
	if (!data.guilds[guildId].incidents) data.guilds[guildId].incidents = [];
	if (!data.guilds[guildId].cooldowns) data.guilds[guildId].cooldowns = {};
	if (!data.guilds[guildId].favor) data.guilds[guildId].favor = {};
	if (!data.guilds[guildId].checkIns) data.guilds[guildId].checkIns = {};
	return data.guilds[guildId];
}

function buildWelcomeGreeting(member) {
	const embed = maidEmbed(
		"🚪 Welcome to Jwett Estates",
		`The grand carriage arrives before the estate gates, and the Maid curtsies warmly in welcome.\n\n` +
		`*"Good day, and welcome to **Jwett Estates**, <@${member.id}>! I am the estate's resident maid. It is my utmost duty to ensure our halls remain immaculate, the tea is fresh, and all residents and honored guests are tended to."*\n\n` +
		`**📜 Household Structure & Estate Roles:**\n` +
		`• 👑 **Head of Household** — Masters of the estate; directing household affairs, setting curfews, and calling family meetings.\n` +
		`• 🧸 **Kids** — The young masters and misses; protected by the house, guided with study, tucked in at night, and rewarded with sweets.\n` +
		`• 🫖 **Siblings** — Cherished family members who keep the manor lively and take part in weekly traditions.\n` +
		`• 🕊️ **Kin** — Cherished extended family and trusted kin of the estate.\n` +
		`• 🗝️ **Visitor** — Honored guests and travelers welcomed through our grand entrance!\n\n` +
		`*"Please press the button below to open the grand double doors and receive your Visitor credentials."*`,
		"#f5c2e7"
	);

	const row = new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId("open_door_visitor")
			.setLabel("Open the Door")
			.setEmoji("🚪")
			.setStyle(ButtonStyle.Success)
	);

	return {
		content: `🛎️ <@${member.id}>, welcome to **Jwett Estates**!`,
		embeds: [embed],
		components: [row]
	};
}

// Role helper functions
function hasRole(member, roleName) {
	return member.roles.cache.some(
		role => role.name === roleName
	);
}

function isHeadOfHousehold(member) {
	// Server owner always counts as Head of Household
	if (member.guild.ownerId === member.id) return true;
	const roleName = process.env.ROLE_HEAD || "Head of Household";
	return hasRole(member, roleName);
}

function getFamilyType(member) {
	const roleHead = process.env.ROLE_HEAD || "Head of Household";
	const roleKids = process.env.ROLE_KIDS || "Kids";
	const roleSiblings = process.env.ROLE_SIBLINGS || "Siblings";
	const roleKin = process.env.ROLE_KIN || "Kin";
	
	if (hasRole(member, roleHead)) return "head";
	if (hasRole(member, roleKids)) return "kid";
	if (hasRole(member, roleSiblings)) return "sibling";
	if (hasRole(member, roleKin)) return "kin";
	return "guest";
}

function getFavorTier(favor = 0) {
	if (favor >= 20) {
		return {
			title: "🌟 Golden Child",
			level: "golden",
			desc: "Immune to curfew callouts, unlocks secret gourmet treats, receives prioritized maid affection."
		};
	}
	if (favor >= 10) {
		return {
			title: "✨ Favored Resident",
			level: "favored",
			desc: "Unlocks fresh warm cookies & afternoon teas, receives praise for household efforts."
		};
	}
	if (favor >= 0) {
		return {
			title: "☕ Resident in Good Standing",
			level: "neutral",
			desc: "Receives standard courteous service and everyday household accommodations."
		};
	}
	if (favor >= -9) {
		return {
			title: "⚠️ On Thin Ice",
			level: "warning",
			desc: "Under watchful maid supervision; chores are inspected with a critical eye."
		};
	}
	return {
		title: "🪣 In the Doghouse",
		level: "doghouse",
		desc: "Refused luxury tea (served lukewarm tap water), scolded at the service bell, subject to strict curfews."
	};
}

// Embed builder utility
function maidEmbed(title, description, color = "#f5c2e7") {
	return new EmbedBuilder()
		.setColor(color)
		.setTitle(title)
		.setDescription(description)
		.setFooter({ text: "The Maid • Household System" })
		.setTimestamp();
}

function choose(list) {
	if (!list || list.length === 0) return "...";
	return list[Math.floor(Math.random() * list.length)];
}

function parseQuoted(text) {
	const match = text.match(/"([\s\S]+)"/);
	return match ? match[1] : null;
}

function formatUserDisplay(member, guildState) {
	if (!member) return "dear";
	if (guildState.addresses[member.id]) return guildState.addresses[member.id];
	const roleName = guildState.rolesByUser[member.id];
	if (!roleName) return member.displayName;
	const lowered = roleName.toLowerCase();
	if (/(mom|dad|parent|guardian)/.test(lowered)) return "Head of Household";
	if (/(child|kid|son|teen)/.test(lowered)) return "Young Master";
	if (/(daughter|miss)/.test(lowered)) return "Young Miss";
	return member.displayName;
}

function addReminder(guildState, reminder) {
	guildState.reminders.push(reminder);
	scheduleSave();
}

function createReminderId(guildState) {
	const maxId = guildState.reminders.reduce((max, item) => Math.max(max, item.id || 0), 0);
	return maxId + 1;
}

function parseDateTime(input) {
	const match = input.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
	if (!match) return null;
	const [_, y, m, d, hh, mm] = match;
	const date = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), 0, 0);
	if (Number.isNaN(date.getTime())) return null;
	return date;
}

function parseTime(input) {
	const match = input.match(/^(\d{2}):(\d{2})$/);
	if (!match) return null;
	const [_, hh, mm] = match;
	const hour = Number(hh);
	const minute = Number(mm);
	if (hour > 23 || minute > 59) return null;
	return { hour, minute };
}

function nextWeeklyOccurrence(dayName, time) {
	const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
	const targetIndex = days.indexOf(dayName.toLowerCase().slice(0, 3));
	if (targetIndex === -1) return null;
	const now = new Date();
	const result = new Date(now);
	result.setHours(time.hour, time.minute, 0, 0);
	const diff = (targetIndex - result.getDay() + 7) % 7;
	if (diff === 0 && result <= now) {
		result.setDate(result.getDate() + 7);
	} else {
		result.setDate(result.getDate() + diff);
	}
	return result;
}

function ensureFutureDate(date) {
	if (!date) return null;
	const now = new Date();
	if (date <= now) {
		date.setFullYear(date.getFullYear() + 1);
	}
	return date;
}

function getResponse(command, mode) {
	const responses = {
		dinner: {
			polite: ["Dinner will be served at 8pm, dear."],
			sassy: ["Dinner at 8pm. Do not be late.", "Dinner is at 8pm. Be on time or be hungry."],
			chaotic: ["Dinner at 8pm. I may move it."],
			tired: ["Dinner at 8pm. Please eat quietly."],
		},
		menu: {
			polite: ["Tonight's menu: something warm and something sweet."],
			sassy: ["Tonight's menu: food you asked for and food you did not."],
			chaotic: ["Tonight's menu: surprises."],
			tired: ["Tonight's menu: whatever is fastest."],
		},
		rules: {
			polite: ["Please mind the family rules. Kindness first."],
			sassy: ["Rules are posted. Read them. Obey them."],
			chaotic: ["Rules exist. I might rewrite them."],
			tired: ["Rules are still the rules."],
		},
		cook: {
			polite: ["I am preparing dinner."],
			sassy: ["Chopping vegetables aggressively."],
			chaotic: ["Cooking. Possibly alchemy."],
			tired: ["Cooking. Try not to hover."],
		},
		snack: {
			polite: ["One snack, dear."],
			sassy: ["One snack. Two if you behave."],
			chaotic: ["Snack granted. Chaos priced in."],
			tired: ["Take a snack and sit down."],
		},
		laundry: {
			polite: ["Laundry is underway."],
			sassy: ["I have found socks where socks should never be."],
			chaotic: ["Laundry is a mystery and I am the detective."],
			tired: ["Laundry is in progress. Again."],
		},
		fold: {
			polite: ["Folding laundry with care."],
			sassy: ["Folding laundry. Someone owns too many hoodies."],
			chaotic: ["Folding laundry into strange geometry."],
			tired: ["Folding. Please put things away."],
		},
		chores: {
			polite: ["Chores assigned. Thank you."],
			sassy: ["Chores assigned. Complaining increases difficulty."],
			chaotic: ["Chores assigned by fate."],
			tired: ["Chores assigned. Be quick."],
		},
		bedtime: {
			polite: ["It is bedtime. Rest well."],
			sassy: ["It is bedtime. Yes, even for the adults."],
			chaotic: ["Bedtime. I am locking the lights in my mind."],
			tired: ["Bedtime. Please."],
		},
		wake: {
			polite: ["Good morning. Rise and shine."],
			sassy: ["Wake up. The sun is out and I am not whispering."],
			chaotic: ["Wake up. I have hidden the remote."],
			tired: ["Wake up. Let us be calm."],
		},
		routine: {
			polite: ["Teeth brushed. Pajamas on. Cozy."],
			sassy: ["Teeth brushed. Pajamas on. Attitude adjusted."],
			chaotic: ["Routine complete. Chaos pending."],
			tired: ["Routine done. Good."],
		},
		comfort: {
			polite: ["Sit. Drink this. You do not have to talk."],
			sassy: ["Sit. Drink this. You are safe here."],
			chaotic: ["Comfort delivered. Do not argue."],
			tired: ["Sit. I will handle things."],
		},
		hug: {
			polite: ["The Maid offers a gentle hug."],
			sassy: ["The Maid offers a firm but loving hug."],
			chaotic: ["Hug deployed."],
			tired: ["Hug. Breathe."],
		},
		badday: {
			polite: ["I see. You may rest. I will handle things tonight."],
			sassy: ["Bad day noted. Rest. I will guard the house."],
			chaotic: ["Bad day. I am plotting soft blankets."],
			tired: ["Rest. I will manage."],
		},
		house: {
			polite: ["The house is calm. Laundry humming. Dinner smells good."],
			sassy: ["The house is calm. Try to keep it that way."],
			chaotic: ["The house is calm. Suspiciously calm."],
			tired: ["The house is quiet. Finally."],
		},
		weather: {
			polite: ["The weather calls for warm tea and quiet voices."],
			sassy: ["Rain outside. Perfect excuse to stay in."],
			chaotic: ["Weather is moody. Match it."],
			tired: ["Weather is fine. Stay cozy."],
		},
		homework: {
			polite: ["Sit properly. What subject are we pretending to understand today?"],
			sassy: ["Sit properly, young one. What subject are we pretending to understand today?"],
			chaotic: ["Homework time. I have snacks and threats."],
			tired: ["Homework. Quickly."],
		},
		study: {
			polite: ["Study time. I have laid out your books and a snack."],
			sassy: ["Study time. I have laid out your books and a snack. No escaping."],
			chaotic: ["Study time. I am judging your effort."],
			tired: ["Study time. Focus."],
		},
		help: {
			polite: ["I will proofread... emotionally."],
			sassy: ["I will proofread... emotionally."],
			chaotic: ["I will proofread and sigh dramatically."],
			tired: ["I will proofread. Keep it short."],
		},
		clean: {
			polite: ["The house is tidy. Let us keep it so."],
			sassy: ["Cleaned. Do not ruin it."],
			chaotic: ["Cleaned. For now."],
			tired: ["Cleaned. Please."],
		},
	};

	const entry = responses[command];
	if (!entry) return "...";
	return choose(entry[mode] || entry.sassy);
}

function getNightModeResponse(text) {
	return text.replace(/!+/g, ".").replace(/\s{2,}/g, " ");
}

function setPresenceRotation() {
	const list = data.global.statusRotation || [];
	if (list.length === 0) return;
	let index = 0;
	setInterval(() => {
		const activity = list[index % list.length];
		index += 1;
		client.user.setPresence({
			activities: [{ name: activity, type: ActivityType.Custom }],
			status: "online",
		});
	}, data.global.statusIntervalMinutes * 60 * 1000);
}

function scheduleReminderSweep() {
	setInterval(async () => {
		const now = new Date();
		for (const [guildId, guildState] of Object.entries(data.guilds)) {
			const due = [];
			for (const reminder of guildState.reminders) {
				const time = new Date(reminder.time);
				if (time <= now) {
					due.push(reminder);
				}
			}
			if (due.length === 0) continue;

			for (const reminder of due) {
				try {
					const channel = await client.channels.fetch(reminder.channelId);
					if (channel) {
						await channel.send(reminder.text);
					}
				} catch (error) {
					// Ignore send errors to keep reminder loop alive.
				}

				if (reminder.repeat === "weekly") {
					const nextTime = new Date(reminder.time);
					nextTime.setDate(nextTime.getDate() + 7);
					reminder.time = nextTime.toISOString();
				} else if (reminder.repeat === "yearly") {
					const nextTime = new Date(reminder.time);
					nextTime.setFullYear(nextTime.getFullYear() + 1);
					reminder.time = nextTime.toISOString();
				} else if (reminder.repeat === "daily") {
					const nextTime = new Date(reminder.time);
					nextTime.setDate(nextTime.getDate() + 1);
					reminder.time = nextTime.toISOString();
				} else {
					guildState.reminders = guildState.reminders.filter((item) => item.id !== reminder.id);
				}
			}
			scheduleSave();
		}
	}, 30 * 1000);
}

function scheduleQuietCheck() {
	setInterval(async () => {
		const now = Date.now();
		for (const [guildId, guildState] of Object.entries(data.guilds)) {
			if (!guildState.lastActiveChannelId) continue;
			if (now - guildState.lastMessageAt < 30 * 60 * 1000) continue;
			if (now - guildState.lastNudgeAt < 30 * 60 * 1000) continue;

			guildState.lastNudgeAt = now;
			scheduleSave();

			try {
				const channel = await client.channels.fetch(guildState.lastActiveChannelId);
				if (channel) {
					await channel.send(choose([
						"Am I dismissed, or are we ignoring each other?",
						"The halls are quiet. Should I ring a bell?",
						"Silence noted. I am still watching.",
					]));
				}
			} catch (error) {
				// Ignore.
			}
		}
	}, 5 * 60 * 1000);
}

function scheduleCurfewCheck() {
	setInterval(async () => {
		const now = new Date();
		for (const [guildId, guildState] of Object.entries(data.guilds)) {
			const time = parseTime(guildState.curfew);
			if (!time || !guildState.lastActiveChannelId) continue;
			const curfewDate = new Date(now);
			curfewDate.setHours(time.hour, time.minute, 0, 0);

			if (now < curfewDate) continue;
			if (guildState.lastCurfewAt === curfewDate.toDateString()) continue;

			guildState.lastCurfewAt = curfewDate.toDateString();
			scheduleSave();

			try {
				const channel = await client.channels.fetch(guildState.lastActiveChannelId);
				if (channel) {
					const guild = await client.guilds.fetch(guildId);
					const kidsRoleName = process.env.ROLE_KIDS || "Kids";
					const kidsRole = guild.roles.cache.find(r => r.name === kidsRoleName);
					const mention = kidsRole ? `<@&${kidsRole.id}>` : "Children";
					
					// Curfew exemption for Golden Child / high favor (favor >= 15)
					const exemptions = [];
					if (kidsRole) {
						for (const [memberId, member] of kidsRole.members) {
							if ((guildState.favor[memberId] || 0) >= 15) {
								exemptions.push(`<@${memberId}>`);
							}
						}
					}
					
					let noticeText = `It is past curfew. ${mention} should be asleep. I am watching.`;
					if (exemptions.length > 0) {
						noticeText += `\n\n*(Exemption granted: ${exemptions.join(", ")} has earned late-night reading privileges due to stellar behavior. Everyone else: lights out!)*`;
					}

					const embed = maidEmbed(
						"🕰 Curfew Notice",
						noticeText,
						"#2b2d42"
					);
					await channel.send({ embeds: [embed] });
				}
			} catch (error) {
				// Ignore.
			}
		}
	}, 5 * 60 * 1000);
}

function maybeReact(message, keyword, emoji) {
	if (message.content.toLowerCase().includes(keyword)) {
		message.react(emoji).catch(() => undefined);
	}
}

const SIMPLE_RESPONSE_COMMANDS = [
	{ name: "dinner", description: "Ask about dinner." },
	{ name: "rules", description: "Ask about the rules." },
	{ name: "menu", description: "Ask about the menu." },
	{ name: "cook", description: "Ask what the maid is doing." },
	{ name: "laundry", description: "Ask about laundry." },
	{ name: "fold", description: "Ask about folding laundry." },
	{ name: "bedtime", description: "Ask about bedtime." },
	{ name: "wake", description: "Ask about wake-up." },
	{ name: "routine", description: "Ask about the routine." },
	{ name: "hug", description: "Ask for a hug." },
	{ name: "badday", description: "Mention a bad day." },
	{ name: "house", description: "Ask about the house." },
	{ name: "weather", description: "Ask about the weather." },
	{ name: "homework", description: "Ask about homework time." },
	{ name: "clean", description: "Ask about cleaning." },
];

const DAY_CHOICES = [
	{ name: "Sunday", value: "Sun" },
	{ name: "Monday", value: "Mon" },
	{ name: "Tuesday", value: "Tue" },
	{ name: "Wednesday", value: "Wed" },
	{ name: "Thursday", value: "Thu" },
	{ name: "Friday", value: "Fri" },
	{ name: "Saturday", value: "Sat" },
];

const COMMANDS = [
	new SlashCommandBuilder()
		.setName("maid")
		.setDescription("Maid management commands.")
		.addSubcommand((subcommand) =>
			subcommand
				.setName("announce")
				.setDescription("Send a maid announcement.")
				.addStringOption((option) =>
					option.setName("text").setDescription("Announcement text.").setRequired(true)
				)
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("mode")
				.setDescription("Set the maid mode.")
				.addStringOption((option) =>
					option
						.setName("mode")
						.setDescription("Choose a mode.")
						.setRequired(true)
						.addChoices(
							{ name: "Polite", value: "polite" },
							{ name: "Sassy", value: "sassy" },
							{ name: "Chaotic", value: "chaotic" },
							{ name: "Tired", value: "tired" }
						)
				)
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("nightmode")
				.setDescription("Enable or disable night mode.")
				.addBooleanOption((option) =>
					option
						.setName("enabled")
						.setDescription("Set night mode on or off (default on).")
						.setRequired(false)
				)
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("help")
				.setDescription("Ping guardians for calm mode.")
		)
		.addSubcommandGroup((group) =>
			group
				.setName("status")
				.setDescription("Manage status rotation.")
				.addSubcommand((subcommand) =>
					subcommand
						.setName("add")
						.setDescription("Add a status to rotation.")
						.addStringOption((option) =>
							option.setName("text").setDescription("Status text.").setRequired(true)
						)
				)
				.addSubcommand((subcommand) =>
					subcommand
						.setName("list")
						.setDescription("List status rotation entries.")
				)
		)
		.toJSON(),
	new SlashCommandBuilder()
		.setName("setannounce")
		.setDescription("Set the announcement channel.")
		.addChannelOption((option) =>
			option
				.setName("channel")
				.setDescription("Channel to use for announcements.")
				.addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
				.setRequired(true)
		)
		.toJSON(),
	new SlashCommandBuilder()
		.setName("setwelcome")
		.setDescription("Set the welcome foyer channel for new arrivals to Jwett Estates.")
		.addChannelOption((option) =>
			option
				.setName("channel")
				.setDescription("Channel to post welcome greetings.")
				.addChannelTypes(ChannelType.GuildText)
				.setRequired(true)
		)
		.toJSON(),
	new SlashCommandBuilder()
		.setName("testwelcome")
		.setDescription("Preview the Jwett Estates maid greeting and Open the Door button.")
		.addUserOption((option) =>
			option.setName("user").setDescription("User to simulate welcoming.").setRequired(false)
		)
		.toJSON(),
	new SlashCommandBuilder()
		.setName("setrole")
		.setDescription("Assign a family role to a user.")
		.addStringOption((option) =>
			option.setName("role").setDescription("Role name.").setRequired(true)
		)
		.addUserOption((option) =>
			option.setName("user").setDescription("User to assign.").setRequired(true)
		)
		.toJSON(),
	new SlashCommandBuilder()
		.setName("roles")
		.setDescription("List assigned roles.")
		.toJSON(),
	new SlashCommandBuilder()
		.setName("note")
		.setDescription("Add a note about a user.")
		.addUserOption((option) =>
			option.setName("user").setDescription("User to note.").setRequired(true)
		)
		.addStringOption((option) =>
			option.setName("text").setDescription("Note text.").setRequired(true)
		)
		.toJSON(),
	new SlashCommandBuilder()
		.setName("notes")
		.setDescription("List recent notes.")
		.addUserOption((option) =>
			option.setName("user").setDescription("Filter by user.").setRequired(false)
		)
		.toJSON(),
	new SlashCommandBuilder()
		.setName("remember")
		.setDescription("Remember something for later.")
		.addStringOption((option) =>
			option.setName("text").setDescription("Memory text.").setRequired(true)
		)
		.toJSON(),
	new SlashCommandBuilder()
		.setName("recall")
		.setDescription("Recall a remembered joke.")
		.toJSON(),
	new SlashCommandBuilder()
		.setName("setcurfew")
		.setDescription("Set the nightly curfew.")
		.addStringOption((option) =>
			option.setName("time").setDescription("Time in HH:MM (24h).").setRequired(true)
		)
		.toJSON(),
	new SlashCommandBuilder()
		.setName("curfew")
		.setDescription("Show the current curfew.")
		.toJSON(),
	new SlashCommandBuilder()
		.setName("warnmute")
		.setDescription("Warn someone about a temporary mute.")
		.addUserOption((option) =>
			option.setName("user").setDescription("User to warn.").setRequired(true)
		)
		.addStringOption((option) =>
			option.setName("reason").setDescription("Reason for the warning.").setRequired(false)
		)
		.toJSON(),
	new SlashCommandBuilder()
		.setName("remind")
		.setDescription("Set a reminder with a date and time.")
		.addStringOption((option) =>
			option.setName("text").setDescription("Reminder text.").setRequired(true)
		)
		.addStringOption((option) =>
			option
				.setName("datetime")
				.setDescription("YYYY-MM-DD HH:MM (24h).")
				.setRequired(true)
		)
		.toJSON(),
	new SlashCommandBuilder()
		.setName("remindme")
		.setDescription("Set a reminder in X minutes.")
		.addIntegerOption((option) =>
			option.setName("minutes").setDescription("Minutes from now.").setRequired(true)
		)
		.addStringOption((option) =>
			option.setName("text").setDescription("Reminder text.").setRequired(true)
		)
		.toJSON(),
	new SlashCommandBuilder()
		.setName("listreminders")
		.setDescription("List reminders.")
		.toJSON(),
	new SlashCommandBuilder()
		.setName("delreminder")
		.setDescription("Delete a reminder by id.")
		.addIntegerOption((option) =>
			option.setName("id").setDescription("Reminder id.").setRequired(true)
		)
		.toJSON(),
	new SlashCommandBuilder()
		.setName("setbirthday")
		.setDescription("Set a birthday reminder.")
		.addUserOption((option) =>
			option.setName("user").setDescription("Birthday person.").setRequired(true)
		)
		.addStringOption((option) =>
			option.setName("date").setDescription("YYYY-MM-DD.").setRequired(true)
		)
		.toJSON(),
	new SlashCommandBuilder()
		.setName("setanniversary")
		.setDescription("Set an anniversary reminder.")
		.addUserOption((option) =>
			option.setName("user").setDescription("Anniversary person.").setRequired(true)
		)
		.addStringOption((option) =>
			option.setName("date").setDescription("YYYY-MM-DD.").setRequired(true)
		)
		.toJSON(),
	new SlashCommandBuilder()
		.setName("addevent")
		.setDescription("Add a one-time event.")
		.addStringOption((option) =>
			option.setName("name").setDescription("Event name.").setRequired(true)
		)
		.addStringOption((option) =>
			option.setName("date").setDescription("YYYY-MM-DD.").setRequired(true)
		)
		.addStringOption((option) =>
			option.setName("time").setDescription("HH:MM (24h).").setRequired(true)
		)
		.toJSON(),
	new SlashCommandBuilder()
		.setName("addweekly")
		.setDescription("Add a weekly event.")
		.addStringOption((option) =>
			option.setName("name").setDescription("Event name.").setRequired(true)
		)
		.addStringOption((option) =>
			option
				.setName("day")
				.setDescription("Day of the week.")
				.setRequired(true)
				.addChoices(...DAY_CHOICES)
		)
		.addStringOption((option) =>
			option.setName("time").setDescription("HH:MM (24h).").setRequired(true)
		)
		.toJSON(),
	new SlashCommandBuilder()
		.setName("inittraditions")
		.setDescription("Create default weekly traditions.")
		.toJSON(),
	new SlashCommandBuilder()
		.setName("listevents")
		.setDescription("List scheduled events.")
		.toJSON(),
	new SlashCommandBuilder()
		.setName("delevent")
		.setDescription("Delete an event by id.")
		.addIntegerOption((option) =>
			option.setName("id").setDescription("Event id.").setRequired(true)
		)
		.toJSON(),
	new SlashCommandBuilder()
		.setName("sl")
		.setDescription("Second Life commands.")
		.addSubcommand((subcommand) =>
			subcommand
				.setName("sethome")
				.setDescription("Set SL home.")
				.addStringOption((option) =>
					option.setName("url").setDescription("SLURL.").setRequired(true)
				)
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("home")
				.setDescription("Show SL home.")
		)
		.toJSON(),
	new SlashCommandBuilder()
		.setName("roll")
		.setDescription("Roll dice.")
		.addStringOption((option) =>
			option.setName("dice").setDescription("Dice format, e.g. 1d20.").setRequired(false)
		)
		.toJSON(),
	new SlashCommandBuilder()
		.setName("truth")
		.setDescription("Get a truth prompt.")
		.addBooleanOption((option) =>
			option.setName("spicy").setDescription("Spicy mode.").setRequired(false)
		)
		.toJSON(),
	new SlashCommandBuilder()
		.setName("dare")
		.setDescription("Get a dare prompt.")
		.addBooleanOption((option) =>
			option.setName("spicy").setDescription("Spicy mode.").setRequired(false)
		)
		.toJSON(),
	new SlashCommandBuilder()
		.setName("icebreaker")
		.setDescription("Get an icebreaker prompt.")
		.toJSON(),
	new SlashCommandBuilder()
		.setName("fortune")
		.setDescription("Get a fortune.")
		.toJSON(),
	new SlashCommandBuilder()
		.setName("address")
		.setDescription("Set a custom address for a user.")
		.addUserOption((option) =>
			option.setName("user").setDescription("User to address.").setRequired(true)
		)
		.addStringOption((option) =>
			option.setName("title").setDescription("Custom address/title.").setRequired(true)
		)
		.toJSON(),
	new SlashCommandBuilder()
		.setName("whoami")
		.setDescription("Show how the maid addresses you.")
		.toJSON(),
	new SlashCommandBuilder()
		.setName("help")
		.setDescription("Ask for help.")
		.addStringOption((option) =>
			option.setName("context").setDescription("Optional context.").setRequired(false)
		)
		.toJSON(),
	new SlashCommandBuilder()
		.setName("study")
		.setDescription("Ask about study time.")
		.addBooleanOption((option) =>
			option.setName("roll").setDescription("Roll for effort.").setRequired(false)
		)
		.toJSON(),
	...SIMPLE_RESPONSE_COMMANDS.map((item) =>
		new SlashCommandBuilder()
			.setName(item.name)
			.setDescription(item.description)
			.toJSON()
	),
	new SlashCommandBuilder()
		.setName("reward")
		.setDescription("Reward a household member with favor.")
		.addUserOption((option) =>
			option.setName("user").setDescription("User to reward.").setRequired(true)
		)
		.toJSON(),
	new SlashCommandBuilder()
		.setName("ground")
		.setDescription("Ground a household member (reduce favor).")
		.addUserOption((option) =>
			option.setName("user").setDescription("User to ground.").setRequired(true)
		)
		.toJSON(),
	new SlashCommandBuilder()
		.setName("favor")
		.setDescription("Check your favor points and household privileges.")
		.addUserOption((option) =>
			option.setName("user").setDescription("Check another user's favor.").setRequired(false)
		)
		.toJSON(),
	new SlashCommandBuilder()
		.setName("household")
		.setDescription("View household status and statistics.")
		.toJSON(),
	new SlashCommandBuilder()
		.setName("checkin")
		.setDescription("Daily check-in for favor.")
		.toJSON(),
	new SlashCommandBuilder()
		.setName("familymeeting")
		.setDescription("Call a family meeting (Head of Household only).")
		.addStringOption((option) =>
			option.setName("topic").setDescription("Meeting topic.").setRequired(false)
		)
		.toJSON(),
	new SlashCommandBuilder()
		.setName("tea")
		.setDescription("The maid prepares a customized tea cart with interactive selections.")
		.addUserOption((option) =>
			option.setName("user").setDescription("Serve tea to someone else.").setRequired(false)
		)
		.toJSON(),
	new SlashCommandBuilder()
		.setName("snack")
		.setDescription("The maid presents the manor pantry snack selection.")
		.addUserOption((option) =>
			option.setName("user").setDescription("Serve a snack to someone else.").setRequired(false)
		)
		.toJSON(),
	new SlashCommandBuilder()
		.setName("chores")
		.setDescription("View the household chore board and roll for favor.")
		.toJSON(),
	new SlashCommandBuilder()
		.setName("bell")
		.setDescription("Ring the silver service bell for the maid.")
		.addStringOption((option) =>
			option.setName("request").setDescription("What do you require from the maid?").setRequired(false)
		)
		.toJSON(),
	new SlashCommandBuilder()
		.setName("incident")
		.setDescription("Manor incident ledger system.")
		.addSubcommand((subcommand) =>
			subcommand
				.setName("record")
				.setDescription("Report a household incident or infraction.")
				.addUserOption((option) =>
					option.setName("user").setDescription("The accused member.").setRequired(true)
				)
				.addStringOption((option) =>
					option.setName("infraction").setDescription("Description of what happened.").setRequired(true)
				)
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("log")
				.setDescription("View recent household incidents.")
				.addUserOption((option) =>
					option.setName("user").setDescription("Filter by accused member.").setRequired(false)
				)
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("resolve")
				.setDescription("Resolve an incident (Head of Household only).")
				.addIntegerOption((option) =>
					option.setName("id").setDescription("Incident ID to resolve.").setRequired(true)
				)
				.addStringOption((option) =>
					option
						.setName("verdict")
						.setDescription("Head of Household verdict.")
						.setRequired(true)
						.addChoices(
							{ name: "Pardon (No favor penalty)", value: "pardon" },
							{ name: "Reprimand (-2 favor points)", value: "reprimand" },
							{ name: "Severe Penalty (-5 favor points)", value: "severe" },
							{ name: "Exonerated (+1 favor point)", value: "exonerate" }
						)
				)
		)
		.toJSON(),
	new SlashCommandBuilder()
		.setName("tuckin")
		.setDescription("Get tucked in for bedtime.")
		.addUserOption((option) =>
			option.setName("user").setDescription("Tuck in someone else.").setRequired(false)
		)
		.toJSON(),
	new SlashCommandBuilder()
		.setName("comfort")
		.setDescription("Request comfort from the maid.")
		.addUserOption((option) =>
			option.setName("user").setDescription("Comfort another user.").setRequired(false)
		)
		.toJSON(),
	new SlashCommandBuilder()
		.setName("tidy")
		.setDescription("The maid reports on the house.")
		.toJSON(),
	new ContextMenuCommandBuilder()
		.setName("Serve Drink")
		.setType(ApplicationCommandType.User)
		.toJSON(),
	new ContextMenuCommandBuilder()
		.setName("Tuck In")
		.setType(ApplicationCommandType.User)
		.toJSON(),
];

async function registerCommands() {
	const clientId = process.env.DISCORD_CLIENT_ID;
	if (!clientId) {
		console.warn("DISCORD_CLIENT_ID not set. Skipping slash command registration.");
		return;
	}
	const token = process.env.DISCORD_TOKEN;
	if (!token) {
		console.warn("DISCORD_TOKEN not set. Skipping slash command registration.");
		return;
	}
	const rest = new REST({ version: "10" }).setToken(token);
	const guildId = process.env.GUILD_ID || process.env.DISCORD_GUILD_ID;
	try {
		if (guildId) {
			const route = Routes.applicationGuildCommands(clientId, guildId);
			await rest.put(route, { body: COMMANDS });
			console.log(`Registered ${COMMANDS.length} guild commands.`);
		} else {
			const route = Routes.applicationCommands(clientId);
			await rest.put(route, { body: COMMANDS });
			console.log(`Registered ${COMMANDS.length} global commands.`);
		}
	} catch (error) {
		console.error("Failed to register commands:", error);
	}
}

client.once("ready", async () => {
	console.log(`Logged in as ${client.user.tag}`);
	await registerCommands();
	setPresenceRotation();
	scheduleReminderSweep();
	scheduleQuietCheck();
	scheduleCurfewCheck();
});

client.on("guildMemberAdd", async (member) => {
	if (member.user.bot) return;
	const guildState = getGuildState(member.guild.id);
	const channelId = guildState.welcomeChannelId || process.env.WELCOME_CHANNEL_ID || DEFAULT_WELCOME_CHANNEL_ID;

	let channel = null;
	try {
		channel = await member.guild.channels.fetch(channelId);
	} catch (error) {
		if (guildState.announceChannelId) {
			channel = await member.guild.channels.fetch(guildState.announceChannelId).catch(() => null);
		} else if (member.guild.systemChannelId) {
			channel = await member.guild.channels.fetch(member.guild.systemChannelId).catch(() => null);
		}
	}

	if (channel) {
		try {
			const greeting = buildWelcomeGreeting(member);
			await channel.send(greeting);
		} catch (err) {
			console.error("Failed to send welcome greeting to new member:", err);
		}
	}
});

client.on("messageCreate", async (message) => {
	if (message.author.bot) return;
	if (!message.guild) return;

	const guildState = getGuildState(message.guild.id);
	guildState.lastMessageAt = Date.now();
	guildState.lastActiveChannelId = message.channel.id;

	// Subtle emoji reactions (Zero spam, keeps roleplay clean)
	maybeReact(message, "dirty", "🧹");
	maybeReact(message, "mess", "🧹");
	maybeReact(message, "spill", "🧹");
	maybeReact(message, "food", "🍽️");
	maybeReact(message, "dinner", "🍽️");
	maybeReact(message, "tired", "🍵");
	maybeReact(message, "sleepy", "💤");
	maybeReact(message, "hungry", "🍪");
	maybeReact(message, "bored", "🧶");

	// Drama / conflict calming mechanism (10-minute cooldown)
	if (/\b(drama|fight|argue)\b/i.test(message.content)) {
		const key = `calm:${message.channel.id}`;
		const last = guildState.cooldowns[key] || 0;
		if (Date.now() - last > 10 * 60 * 1000) {
			guildState.cooldowns[key] = Date.now();
			scheduleSave();
			message.channel.send(choose([
				"Gentle reminder: breathe first, respond second.",
				"Let us lower the volume and raise the care.",
				"The house is a sanctuary. Calm voices, please."
			])).catch(() => undefined);
		}
		return;
	}

	const isMentioned = message.mentions.has(client.user);
	const directlyAddressesMaid = isMentioned || /\b(maid|maidbot)\b/i.test(message.content);

	// Unprompted text replies ONLY trigger if:
	// 1. Explicitly addressed to the maid (maid, ...) OR
	// 2. Very rare chance (15%) + 20-minute channel cooldown to avoid disrupting scenes!
	if (directlyAddressesMaid) {
		if (/\b(tired|sleepy)\b/i.test(message.content)) {
			message.channel.send(choose([
				"Sit down. I insist.",
				"Rest. I will handle things tonight.",
				"You push yourself too hard. Sit, I will fetch a blanket."
			])).catch(() => undefined);
			return;
		}
		if (/\bhungry\b/i.test(message.content)) {
			message.channel.send(choose([
				"That explains the attitude.",
				"The kitchen is ready if you behave. What shall I prepare?",
				"Do not raid the cupboards like a stray raccoon. I will bring a tray."
			])).catch(() => undefined);
			return;
		}
		if (/\bbored\b/i.test(message.content)) {
			message.channel.send(choose([
				"I have ideas. Dangerous ones.",
				"Boredom is a choice. The library has twelve centuries of history.",
				"If you are bored, I have three hampers of laundry waiting."
			])).catch(() => undefined);
			return;
		}
		// General address
		message.channel.send(choose([
			"Present. How may I be of service?",
			"I am here, dear. What does the household require?",
			"You summoned me? Speak quickly, the kettle is whistling.",
			"Listening quietly."
		])).catch(() => undefined);
		return;
	}

	// Natural ambient reaction (15% chance with 20 min channel cooldown)
	const chatKey = `chat_flow:${message.channel.id}`;
	const lastChat = guildState.cooldowns[chatKey] || 0;
	if (Date.now() - lastChat > 20 * 60 * 1000) {
		if (Math.random() < 0.15) {
			if (/\b(tired|sleepy)\b/i.test(message.content)) {
				guildState.cooldowns[chatKey] = Date.now();
				scheduleSave();
				message.channel.send(choose([
					"Sit down. I insist.",
					"Rest. I will handle it."
				])).catch(() => undefined);
			} else if (/\bhungry\b/i.test(message.content)) {
				guildState.cooldowns[chatKey] = Date.now();
				scheduleSave();
				message.channel.send(choose([
					"That explains the attitude.",
					"Kitchen is ready if you behave."
				])).catch(() => undefined);
			} else if (/\bbored\b/i.test(message.content)) {
				guildState.cooldowns[chatKey] = Date.now();
				scheduleSave();
				message.channel.send(choose([
					"Boredom is a choice. Choose better.",
					"I have plenty of silver that needs polishing if your hands are idle."
				])).catch(() => undefined);
			}
		}
	}
});

client.on("interactionCreate", async (interaction) => {
	if (!interaction.guild) {
		if (interaction.isRepliable()) {
			await interaction.reply({ content: "This bot can only be used in servers.", ephemeral: true });
		}
		return;
	}

	const guildState = getGuildState(interaction.guild.id);
	guildState.lastMessageAt = Date.now();
	guildState.lastActiveChannelId = interaction.channelId;

	// Handle Buttons (e.g. Household Chore Board)
	if (interaction.isButton()) {
		if (interaction.customId.startsWith("chore_")) {
			const member = interaction.member;
			const userId = interaction.user.id;
			const choreKey = `chore:${userId}`;
			const lastChore = guildState.cooldowns[choreKey] || 0;
			const cooldownMs = 10 * 60 * 1000; // 10 minutes
			const elapsed = Date.now() - lastChore;

			if (elapsed < cooldownMs) {
				const minutesLeft = Math.ceil((cooldownMs - elapsed) / (60 * 1000));
				await interaction.reply({
					content: `⏳ You have already worked recently, ${formatUserDisplay(member, guildState)}. The maid insists you rest for **${minutesLeft} more minute(s)** before taking on another chore.`,
					ephemeral: true,
				});
				return;
			}

			guildState.cooldowns[choreKey] = Date.now();

			const roll = Math.floor(Math.random() * 20) + 1;
			const currentFavor = guildState.favor[userId] || 0;
			let title = "";
			let color = "#f5c2e7";
			let choreDescription = "";

			const choreNames = {
				chore_library: "Dusting the Manor Library",
				chore_silver: "Polishing the Silverware",
				chore_garden: "Tending the Conservatory & Garden",
				chore_linen: "Folding & Organizing Bed Linens",
			};
			const choreName = choreNames[interaction.customId] || "Household Chore";

			if (roll === 20) {
				guildState.favor[userId] = currentFavor + 2;
				title = "🌟 Critical Perfection!";
				color = "#a6e3a1";
				choreDescription = `**${member.displayName}** tackled **${choreName}** and rolled a **Natural 20**!\n\n` +
					`Every surface shines like polished obsidian, and every tome is aligned to the millimeter. ` +
					`The maid offers a rare, dignified nod of profound satisfaction.\n\n` +
					`🎁 **+2 Favor Points** (Total: **${guildState.favor[userId]}**)`;
			} else if (roll >= 10) {
				guildState.favor[userId] = currentFavor + 1;
				title = "✅ Chore Completed Splendidly";
				color = "#94e2d5";
				choreDescription = `**${member.displayName}** attended to **${choreName}** (Effort Roll: **${roll}/20**).\n\n` +
					`The task is completed to exacting household standards. *"Acceptable work, dear. The estate is more orderly now."*\n\n` +
					`✨ **+1 Favor Point** (Total: **${guildState.favor[userId]}**)`;
			} else if (roll >= 2) {
				title = "⚠️ Mediocre Effort";
				color = "#f9e2af";
				choreDescription = `**${member.displayName}** attempted **${choreName}** (Effort Roll: **${roll}/20**).\n\n` +
					`Corners were cut, and smudges were left behind. The maid inspects with a white glove and sighs dramatically.\n\n` +
					`*"I will have to go over this myself later. No favor earned today."* (Total: **${currentFavor}**)`;
			} else {
				guildState.favor[userId] = currentFavor - 1;
				title = "💥 Clumsy Catastrophe!";
				color = "#f38ba8";
				choreDescription = `**${member.displayName}** attempted **${choreName}** and rolled a **Natural 1**!\n\n` +
					`Disaster! You tripped over a throw rug, knocking an antique porcelain heirloom to the stone floor in a chorus of shattered shards! ` +
					`The maid closes her eyes and breathes deeply to keep her composure.\n\n` +
					`📉 **-1 Favor Point** (Total: **${guildState.favor[userId]}**)`;
			}

			scheduleSave();
			const embed = maidEmbed(title, choreDescription, guildState.nightMode ? "#2b2d42" : color);
			await interaction.reply({ embeds: [embed] });
			return;
		}

		if (interaction.customId === "open_door_visitor") {
			const visitorRoleId = process.env.ROLE_VISITOR_ID || DEFAULT_VISITOR_ROLE_ID;
			const targetMember = interaction.member;

			if (!targetMember) {
				await interaction.reply({ content: "Could not locate your member profile.", ephemeral: true });
				return;
			}

			if (targetMember.roles.cache.has(visitorRoleId)) {
				await interaction.reply({
					content: `🗝️ The grand oak doors are already open for you, <@${interaction.user.id}>. Welcome inside Jwett Estates!`,
					ephemeral: true,
				});
				return;
			}

			try {
				await targetMember.roles.add(visitorRoleId);
				const welcomeResponse = maidEmbed(
					"🗝️ Estate Doors Opened",
					`*The heavy brass handles turn with a satisfying click, and the double oak doors swing open into the warm, chandelier-lit foyer of Jwett Estates.*\n\n` +
					`The maid curtsies deeply before <@${interaction.user.id}>.\n\n` +
					`*"Welcome inside Jwett Estates, dear guest. You have been granted the **Visitor** role. Please make yourself at home, mind the freshly polished floors, and ring the service bell if you require tea."*`,
					guildState.nightMode ? "#2b2d42" : "#a6e3a1"
				);
				await interaction.reply({ embeds: [welcomeResponse] });
			} catch (err) {
				console.error("Failed to assign visitor role:", err);
				await interaction.reply({
					content: `⚠️ The maid attempted to grant your Visitor key, but encountered a permissions issue. Please ask the Head of Household to ensure the bot's role is positioned **above** the Visitor role in **Server Settings > Roles** and that the bot has the **Manage Roles** permission.`,
					ephemeral: true,
				});
			}
			return;
		}
	}

	// Handle String Select Menus (Tea Cart, Snack Pantry, Serve Drink Context Menu)
	if (interaction.isStringSelectMenu()) {
		if (interaction.customId.startsWith("tea_select:")) {
			const [, targetId, callerId] = interaction.customId.split(":");
			if (interaction.user.id !== callerId) {
				await interaction.reply({ content: "This tea cart was called for someone else.", ephemeral: true });
				return;
			}
			const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
			if (!targetMember) {
				await interaction.reply({ content: "Target member is no longer in the server.", ephemeral: true });
				return;
			}

			const choice = interaction.values[0];
			const targetFavor = guildState.favor[targetId] || 0;
			const isKid = getFamilyType(targetMember) === "kid";
			let title = "🍵 Tea Served";
			let description = "";
			let color = "#f5c2e7";

			if (choice === "cocoa") {
				if (isKid || targetFavor >= 10) {
					title = "🍫 Gourmet Hot Chocolate";
					color = "#a6e3a1";
					description = `The maid brings a rich, steaming mug of gourmet hot cocoa for <@${targetId}>, gently dropping in double marshmallows.\n\n` +
						`*"A special indulgence for our cherished household member. Sip slowly before it cools, dear."*`;
				} else {
					title = "☕ Bitter Lemon Water";
					color = "#f9e2af";
					description = `The maid eyes <@${targetId}> and sets down a cup of plain warm water with a lemon rind instead.\n\n` +
						`*"Gourmet hot cocoa is reserved for well-behaved children and residents of high favor. Earn your standing first."*`;
				}
			} else if (choice === "chamomile") {
				title = "🌼 Chamomile & Lavender Honey";
				description = `The maid sets down a delicate porcelain teacup of chamomile infused with sweet lavender honey before <@${targetId}>.\n\n` +
					`*"Breathe in the floral steam. The household is quiet, and you are safe to rest."*`;
			} else if (choice === "earlgrey") {
				title = "☕ Black Earl Grey";
				description = `The maid serves a brisk, steaming cup of classic black Earl Grey with bergamot for <@${targetId}>.\n\n` +
					`*"Strong, sensible, and clear. Straighten your posture and drink up."*`;
			} else if (choice === "matcha") {
				title = "🍵 Ceremonial Matcha Latte";
				description = `The maid whisks a vibrant green ceremonial matcha with frothed oat milk and a leaf design for <@${targetId}>.\n\n` +
					`*"Mindful sips. Discipline and tranquility go hand in hand."*`;
			} else if (choice === "peppermint") {
				title = "🌿 Garden Peppermint Herbal";
				description = `The maid pours a soothing infusion of fresh crushed peppermint leaves for <@${targetId}>.\n\n` +
					`*"Crisp and restorative. It clears the thoughts and settles the spirit."*`;
			}

			// Small favor bonus for taking time for tea (cooldown 1 hr)
			const teaKey = `tea:${interaction.user.id}`;
			if (!guildState.cooldowns[teaKey] || Date.now() - guildState.cooldowns[teaKey] > 60 * 60 * 1000) {
				guildState.cooldowns[teaKey] = Date.now();
				guildState.favor[interaction.user.id] = (guildState.favor[interaction.user.id] || 0) + 1;
				description += `\n\n*(+1 Favor point awarded for mindful household etiquette)*`;
				scheduleSave();
			}

			const embed = maidEmbed(title, description, guildState.nightMode ? "#2b2d42" : color);
			await interaction.update({ embeds: [embed], components: [] });
			return;
		}

		if (interaction.customId.startsWith("snack_select:")) {
			const [, targetId, callerId] = interaction.customId.split(":");
			if (interaction.user.id !== callerId) {
				await interaction.reply({ content: "This pantry order was called for someone else.", ephemeral: true });
				return;
			}
			const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
			if (!targetMember) {
				await interaction.reply({ content: "Target member is no longer in the server.", ephemeral: true });
				return;
			}

			const choice = interaction.values[0];
			const targetFavor = guildState.favor[targetId] || 0;
			const isKid = getFamilyType(targetMember) === "kid";
			let title = "🍪 Pantry Treat";
			let description = "";
			let color = "#f5c2e7";

			if (choice === "cookies") {
				if (isKid || targetFavor >= 5) {
					title = "🍪 Fresh Warm Cookies";
					description = `The maid brings a warm ceramic plate with fresh chocolate chip cookies, gooey in the center, for <@${targetId}>.\n\n` +
						`*"Fresh out of the oven. Only two, dear—do not spoil your dinner."*`;
				} else {
					title = "🍘 Dry Saltine Cracker";
					color = "#f9e2af";
					description = `The maid sets down a single dry saltine cracker for <@${targetId}>.\n\n` +
						`*"Fresh cookies are for residents who obey household rules. Complete your chores if you wish for sweets."*`;
				}
			} else if (choice === "scones") {
				title = "🧁 Warm Scones & Clotted Cream";
				description = `The maid presents warm golden scones with clotted Devon cream and homemade strawberry jam for <@${targetId}>.\n\n` +
					`*"Proper afternoon tea etiquette: cream first or jam first, do not cause an argument."*`;
			} else if (choice === "fruit") {
				title = "🍇 Chilled Fruit Plate";
				description = `The maid brings a crystal plate of chilled blackberries, sliced honeydew, and crisp seedless grapes for <@${targetId}>.\n\n` +
					`*"Hydrating, refreshing, and entirely respectable."*`;
			} else if (choice === "sandwiches") {
				title = "🥪 Cucumber Tea Sandwiches";
				description = `The maid presents paper-thin cucumber sandwiches on crustless white bread with herbed dill butter for <@${targetId}>.\n\n` +
					`*"Dainty and crisp. A quintessential afternoon snack."*`;
			} else if (choice === "macarons") {
				if (targetFavor >= 10) {
					title = "🍬 French Pastel Macarons";
					color = "#a6e3a1";
					description = `The maid unboxes a delicate assortment of pistachio, raspberry, and vanilla macarons for <@${targetId}>.\n\n` +
						`*"A rare luxury for our most cherished resident. Enjoy every bite."*`;
				} else {
					title = "🍞 Crust of Bread";
					color = "#f9e2af";
					description = `The maid side-eyes <@${targetId}>. *"Macarons are fragile and reserved for our highest-standing members. You may have a slice of yesterday's toast instead."*`;
				}
			}

			const embed = maidEmbed(title, description, guildState.nightMode ? "#2b2d42" : color);
			await interaction.update({ embeds: [embed], components: [] });
			return;
		}

		if (interaction.customId.startsWith("serve_drink:")) {
			const targetId = interaction.customId.split(":")[1];
			const choice = interaction.values[0];
			const drinkMap = {
				drink_tea: { name: "English Afternoon Tea", emoji: "🫖", desc: "steaming hot with milk and clover honey" },
				drink_cocoa: { name: "Gourmet Hot Cocoa", emoji: "🍫", desc: "topped with whipped cream and chocolate shavings" },
				drink_lemonade: { name: "Iced Lavender Lemonade", emoji: "🍋", desc: "chilled and crisp in a tall crystal glass" },
				drink_coffee: { name: "Dark Roast Coffee", emoji: "☕", desc: "freshly brewed, robust and steaming" },
				drink_wine: { name: "Sparkling Spiced Cider", emoji: "🥂", desc: "effervescent in a crystal flute" },
				drink_water: { name: "Chilled Mountain Spring Water", emoji: "🧊", desc: "served in a goblet with a fresh mint leaf" },
			};
			const drink = drinkMap[choice] || drinkMap.drink_tea;

			await interaction.update({
				content: `✅ The maid has delivered **${drink.name}** to <@${targetId}>.`,
				components: [],
			});

			const publicEmbed = maidEmbed(
				`${drink.emoji} Refreshment Delivered`,
				`*The maid glides into the room bearing a polished silver tray with **${drink.name}** (${drink.desc}) for <@${targetId}>.*\n\n` +
				`*"Compliments of <@${interaction.user.id}>, dear. Sit comfortably and enjoy."*`,
				guildState.nightMode ? "#2b2d42" : "#f5c2e7"
			);
			await interaction.channel.send({ embeds: [publicEmbed] });
			return;
		}
	}

	// Handle Context Menus (Serve Drink, Tuck In)
	if (interaction.isUserContextMenuCommand()) {
		const targetMember = interaction.targetMember;
		const targetUser = interaction.targetUser;

		if (interaction.commandName === "Serve Drink") {
			const menu = new StringSelectMenuBuilder()
				.setCustomId(`serve_drink:${targetUser.id}`)
				.setPlaceholder("Choose a beverage to send via the maid...")
				.addOptions(
					{ label: "English Afternoon Tea", value: "drink_tea", description: "Steaming hot with milk and honey", emoji: "🫖" },
					{ label: "Gourmet Hot Cocoa", value: "drink_cocoa", description: "Topped with whipped cream and sprinkles", emoji: "🍫" },
					{ label: "Iced Lavender Lemonade", value: "drink_lemonade", description: "Chilled and crisp in crystal glass", emoji: "🍋" },
					{ label: "Dark Roast Coffee", value: "drink_coffee", description: "Robust and steaming wake-up cup", emoji: "☕" },
					{ label: "Sparkling Spiced Cider", value: "drink_wine", description: "Effervescent in a crystal flute", emoji: "🥂" },
					{ label: "Chilled Spring Water", value: "drink_water", description: "Goblet with ice and fresh mint", emoji: "🧊" },
				);
			const row = new ActionRowBuilder().addComponents(menu);
			await interaction.reply({
				content: `Select a refreshment to have the maid deliver to **${targetMember ? targetMember.displayName : targetUser.username}**:`,
				components: [row],
				ephemeral: true,
			});
			return;
		}

		if (interaction.commandName === "Tuck In") {
			const type = targetMember ? getFamilyType(targetMember) : "guest";
			let description = "";

			if (type === "kid") {
				description = `*The maid gently tucks <@${targetUser.id}> beneath the thick down quilt, smoothing the linen and fluffing the pillows on behalf of <@${interaction.user.id}>.*\n\n*"Forehead kiss deployed. Lights out, and sweet dreams, young one. The house is peaceful."* 🌙🧸`;
			} else if (type === "head") {
				description = `*The maid draws the heavy velvet curtains and arranges the weighted comforter for <@${targetUser.id}> with deep reverence on behalf of <@${interaction.user.id}>.*\n\n*"Rest well, Head of Household. The doors are barred, the hearth is banked, and the estate is safe."* 🕯️🗝️`;
			} else {
				description = `*The maid drapes a plush wool blanket over <@${targetUser.id}>, sent with warmth and care by <@${interaction.user.id}>.*\n\n*"Breathe out the tension of the day. Sleep deeply and wake restored."* ✨🛏️`;
			}

			const embed = maidEmbed("🛏️ Tucked In for the Night", description, "#2b2d42");
			await interaction.reply({ embeds: [embed] });
			return;
		}
	}

	if (!interaction.isChatInputCommand()) return;

	const command = interaction.commandName;
	const member = interaction.member;

	if (command === "maid") {
		const group = interaction.options.getSubcommandGroup(false);
		const sub = interaction.options.getSubcommand();
		if (group === "status") {
			if (sub === "add") {
				const statusText = interaction.options.getString("text", true);
				data.global.statusRotation.push(statusText);
				scheduleSave();
				await interaction.reply("Status added.");
				return;
			}
			if (sub === "list") {
				await interaction.reply(`Statuses: ${data.global.statusRotation.join(" | ")}`);
				return;
			}
		}
		if (sub === "announce") {
			const text = interaction.options.getString("text", true);
			const channelId = guildState.announceChannelId || interaction.channelId;
			const channel = await client.channels.fetch(channelId);
			if (channel) {
				await channel.send(`\ud83d\udce3 Maid Announcement: ${text}`);
			}
			await interaction.reply("Announcement sent.");
			return;
		}
		if (sub === "mode") {
			if (!isHeadOfHousehold(interaction.member)) {
				await interaction.reply({
					content: "👑 Only the Head of Household may issue this command.",
					ephemeral: true
				});
				return;
			}
			const mode = interaction.options.getString("mode", true);
			guildState.mode = mode;
			guildState.nightMode = false;
			scheduleSave();
			await interaction.reply(`Mode set to ${mode}.`);
			return;
		}
		if (sub === "nightmode") {
			const enabled = interaction.options.getBoolean("enabled");
			guildState.nightMode = enabled ?? true;
			scheduleSave();
			await interaction.reply(guildState.nightMode ? "Night mode enabled. Voices low." : "Night mode disabled.");
			return;
		}
		if (sub === "help") {
			const adults = Object.entries(guildState.roles)
				.filter(([role]) => /(mom|dad|parent|guardian|adult)/i.test(role))
				.map(([, userId]) => `<@${userId}>`);
			const ping = adults.length > 0 ? adults.join(" ") : "";
			await interaction.reply(`Calm mode engaged. ${ping}`.trim());
			return;
		}
	}

	if (command === "setannounce") {
		const channel = interaction.options.getChannel("channel", true);
		guildState.announceChannelId = channel.id;
		scheduleSave();
		await interaction.reply(`Announcement channel set to ${channel}.`);
		return;
	}

	if (command === "setwelcome") {
		if (!isHeadOfHousehold(interaction.member)) {
			await interaction.reply({
				content: "👑 Only the Head of Household may set the welcome channel.",
				ephemeral: true,
			});
			return;
		}
		const channel = interaction.options.getChannel("channel", true);
		guildState.welcomeChannelId = channel.id;
		scheduleSave();
		await interaction.reply(`Welcome foyer channel set to ${channel}.`);
		return;
	}

	if (command === "testwelcome") {
		const targetMember = interaction.options.getMember("user") || interaction.member;
		const greeting = buildWelcomeGreeting(targetMember);
		await interaction.reply(greeting);
		return;
	}

	if (command === "setrole") {
		if (!isHeadOfHousehold(interaction.member)) {
			await interaction.reply({
				content: "👑 Only the Head of Household may issue this command.",
				ephemeral: true
			});
			return;
		}
		const roleName = interaction.options.getString("role", true);
		const targetMember = interaction.options.getMember("user");
		if (!targetMember) {
			await interaction.reply("That user is not in this server.");
			return;
		}
		guildState.roles[roleName.toLowerCase()] = targetMember.id;
		guildState.rolesByUser[targetMember.id] = roleName.toLowerCase();
		scheduleSave();
		await interaction.reply(`Role ${roleName} set for ${targetMember.displayName}.`);
		return;
	}

	if (command === "roles") {
		const entries = Object.entries(guildState.roles);
		if (entries.length === 0) {
			await interaction.reply("No roles set yet.");
			return;
		}
		await interaction.reply(entries.map(([role, userId]) => `${role}: <@${userId}>`).join("\n"));
		return;
	}

	if (command === "note") {
		const targetMember = interaction.options.getMember("user");
		const noteText = interaction.options.getString("text", true);
		if (!targetMember) {
			await interaction.reply("That user is not in this server.");
			return;
		}
		guildState.notes.push({
			userId: targetMember.id,
			text: noteText,
			at: new Date().toISOString(),
			authorId: interaction.user.id,
		});
		scheduleSave();
		await interaction.reply("Noted. This will be used against you later.");
		return;
	}

	if (command === "notes") {
		const targetMember = interaction.options.getMember("user");
		const list = targetMember
			? guildState.notes.filter((note) => note.userId === targetMember.id)
			: guildState.notes;
		if (list.length === 0) {
			await interaction.reply("No notes yet.");
			return;
		}
		await interaction.reply(list.slice(-5).map((note) => `- <@${note.userId}>: ${note.text}`).join("\n"));
		return;
	}

	if (command === "remember") {
		const memory = interaction.options.getString("text", true);
		guildState.jokes.push({
			text: memory,
			at: new Date().toISOString(),
			authorId: interaction.user.id,
		});
		scheduleSave();
		await interaction.reply("Noted. This will be used against you later.");
		return;
	}

	if (command === "recall") {
		if (guildState.jokes.length === 0) {
			await interaction.reply("I remember nothing. Yet.");
			return;
		}
		const memory = choose(guildState.jokes);
		await interaction.reply(memory.text);
		return;
	}

	if (command === "setcurfew") {
		if (!isHeadOfHousehold(interaction.member)) {
			await interaction.reply({
				content: "👑 Only the Head of Household may issue this command.",
				ephemeral: true
			});
			return;
		}
		const input = interaction.options.getString("time", true);
		const time = parseTime(input);
		if (!time) {
			await interaction.reply("Provide time as HH:MM (24h).");
			return;
		}
		guildState.curfew = input;
		scheduleSave();
		await interaction.reply(`Curfew set to ${input}.`);
		return;
	}

	if (command === "curfew") {
		await interaction.reply(`Curfew is ${guildState.curfew}.`);
		return;
	}

	if (command === "warnmute") {
		const targetMember = interaction.options.getMember("user");
		const reason = interaction.options.getString("reason") || "Please cool down.";
		if (!targetMember) {
			await interaction.reply("That user is not in this server.");
			return;
		}
		await interaction.reply(`Temporary mute warning for ${targetMember.displayName}: ${reason}`);
		return;
	}

	if (command === "remind") {
		const reminderText = interaction.options.getString("text", true);
		const dateInput = interaction.options.getString("datetime", true);
		const date = parseDateTime(dateInput);
		if (!date) {
			await interaction.reply("Provide datetime as YYYY-MM-DD HH:MM (24h).");
			return;
		}
		const id = createReminderId(guildState);
		addReminder(guildState, {
			id,
			guildId: interaction.guild.id,
			channelId: interaction.channelId,
			userId: interaction.user.id,
			text: `\ud83d\udcc5 Reminder: ${reminderText}`,
			time: date.toISOString(),
		});
		await interaction.reply(`Reminder set (#${id}).`);
		return;
	}

	if (command === "remindme") {
		const minutes = interaction.options.getInteger("minutes", true);
		const reminderText = interaction.options.getString("text", true);
		if (!minutes || minutes <= 0) {
			await interaction.reply("Provide a positive number of minutes.");
			return;
		}
		const time = new Date(Date.now() + minutes * 60 * 1000);
		const id = createReminderId(guildState);
		addReminder(guildState, {
			id,
			guildId: interaction.guild.id,
			channelId: interaction.channelId,
			userId: interaction.user.id,
			text: `\ud83d\udcc5 Reminder: ${reminderText}`,
			time: time.toISOString(),
		});
		await interaction.reply(`Reminder set (#${id}).`);
		return;
	}

	if (command === "listreminders") {
		if (guildState.reminders.length === 0) {
			await interaction.reply("No reminders set.");
			return;
		}
		const lines = guildState.reminders
			.slice(0, 10)
			.map((reminder) => `#${reminder.id} at ${new Date(reminder.time).toLocaleString()}: ${reminder.text}`);
		await interaction.reply(lines.join("\n"));
		return;
	}

	if (command === "delreminder") {
		const id = interaction.options.getInteger("id", true);
		const before = guildState.reminders.length;
		guildState.reminders = guildState.reminders.filter((reminder) => reminder.id !== id);
		scheduleSave();
		await interaction.reply(before === guildState.reminders.length ? "No reminder found." : "Reminder deleted.");
		return;
	}

	if (command === "setbirthday" || command === "setanniversary") {
		const targetMember = interaction.options.getMember("user");
		const dateInput = interaction.options.getString("date", true);
		if (!targetMember) {
			await interaction.reply("That user is not in this server.");
			return;
		}
		const date = parseDateTime(`${dateInput} 09:00`);
		if (!date) {
			await interaction.reply("Provide a valid date YYYY-MM-DD.");
			return;
		}
		ensureFutureDate(date);
		const id = createReminderId(guildState);
		addReminder(guildState, {
			id,
			guildId: interaction.guild.id,
			channelId: interaction.channelId,
			userId: targetMember.id,
			text: command === "setbirthday"
				? `\ud83c\udf82 Happy birthday <@${targetMember.id}>!`
				: `\ud83d\udc9e Happy anniversary, <@${targetMember.id}>!`,
			time: date.toISOString(),
			repeat: "yearly",
		});
		await interaction.reply("Date saved.");
		return;
	}

	if (command === "addevent") {
		const eventName = interaction.options.getString("name", true);
		const dateInput = interaction.options.getString("date", true);
		const timeInput = interaction.options.getString("time", true);
		const date = parseDateTime(`${dateInput} ${timeInput}`);
		if (!date) {
			await interaction.reply("Provide date/time as YYYY-MM-DD and HH:MM (24h).");
			return;
		}
		const id = createReminderId(guildState);
		addReminder(guildState, {
			id,
			guildId: interaction.guild.id,
			channelId: interaction.channelId,
			userId: interaction.user.id,
			text: `\ud83c\udf89 Event: ${eventName} is starting now.`,
			time: date.toISOString(),
		});
		await interaction.reply(`Event scheduled (#${id}).`);
		return;
	}

	if (command === "addweekly") {
		const eventName = interaction.options.getString("name", true);
		const dayName = interaction.options.getString("day", true);
		const timeInput = interaction.options.getString("time", true);
		const time = parseTime(timeInput || "");
		if (!time) {
			await interaction.reply("Provide time as HH:MM (24h).");
			return;
		}
		const next = nextWeeklyOccurrence(dayName, time);
		if (!next) {
			await interaction.reply("Invalid day name.");
			return;
		}
		const id = createReminderId(guildState);
		addReminder(guildState, {
			id,
			guildId: interaction.guild.id,
			channelId: interaction.channelId,
			userId: interaction.user.id,
			text: `\ud83c\udf89 Weekly tradition: ${eventName} starts now.`,
			time: next.toISOString(),
			repeat: "weekly",
		});
		await interaction.reply(`Weekly event scheduled (#${id}).`);
		return;
	}

	if (command === "inittraditions") {
		if (!isHeadOfHousehold(interaction.member)) {
			await interaction.reply({
				content: "👑 Only the Head of Household may issue this command.",
				ephemeral: true
			});
			return;
		}
		const defaults = [
			{ name: "Family Friday", day: "Fri", time: "20:00" },
			{ name: "Movie Night", day: "Sat", time: "19:00" },
			{ name: "SL RP Night", day: "Sun", time: "21:00" },
		];
		const created = [];
		for (const item of defaults) {
			const time = parseTime(item.time);
			const next = nextWeeklyOccurrence(item.day, time);
			if (!next) continue;
			const id = createReminderId(guildState);
			addReminder(guildState, {
				id,
				guildId: interaction.guild.id,
				channelId: interaction.channelId,
				userId: interaction.user.id,
				text: `\ud83c\udf89 Weekly tradition: ${item.name} starts now.`,
				time: next.toISOString(),
				repeat: "weekly",
			});
			created.push(item.name);
		}
		await interaction.reply(created.length > 0 ? `Traditions added: ${created.join(", ")}` : "No traditions added.");
		return;
	}

	if (command === "listevents") {
		if (guildState.reminders.length === 0) {
			await interaction.reply("No events scheduled.");
			return;
		}
		const lines = guildState.reminders
			.filter((reminder) => /Event|Weekly tradition/i.test(reminder.text))
			.slice(0, 10)
			.map((reminder) => `#${reminder.id} at ${new Date(reminder.time).toLocaleString()}: ${reminder.text}`);
		await interaction.reply(lines.join("\n") || "No events scheduled.");
		return;
	}

	if (command === "delevent") {
		if (!isHeadOfHousehold(interaction.member)) {
			await interaction.reply({
				content: "👑 Only the Head of Household may issue this command.",
				ephemeral: true
			});
			return;
		}
		const id = interaction.options.getInteger("id", true);
		const before = guildState.reminders.length;
		guildState.reminders = guildState.reminders.filter((reminder) => reminder.id !== id);
		scheduleSave();
		await interaction.reply(before === guildState.reminders.length ? "No event found." : "Event deleted.");
		return;
	}

	if (command === "sl") {
		const sub = interaction.options.getSubcommand();
		if (sub === "sethome") {
			const url = interaction.options.getString("url", true);
			guildState.sl.home = url;
			scheduleSave();
			await interaction.reply("SL home set.");
			return;
		}
		if (sub === "home") {
			await interaction.reply(guildState.sl.home || "No SL home set yet.");
			return;
		}
	}

	if (command === "roll") {
		const input = interaction.options.getString("dice") || "1d20";
		const match = input.match(/^(\d+)d(\d+)$/i);
		if (!match) {
			await interaction.reply("Provide dice in NdM format, like 1d20.");
			return;
		}
		const count = Math.min(10, Number(match[1]));
		const sides = Math.min(1000, Number(match[2]));
		const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
		const total = rolls.reduce((sum, value) => sum + value, 0);
		await interaction.reply(`\ud83c\udfb2 Rolls: ${rolls.join(", ")} (Total ${total})`);
		return;
	}

	if (command === "truth" || command === "dare") {
		const spicy = interaction.options.getBoolean("spicy") === true;
		const prompts = command === "truth"
			? (spicy
				? [
					"Truth: What secret snack do you hide?",
					"Truth: Who in the family is the biggest softie?",
				]
				: [
					"Truth: What small habit makes you feel cozy?",
					"Truth: What is a silly thing you love?",
				])
			: (spicy
				? [
					"Dare: Compliment someone in the chat, dramatically.",
					"Dare: Change your nickname for 10 minutes.",
				]
				: [
					"Dare: Post your favorite cozy emoji.",
					"Dare: Share a wholesome fact about you.",
				]);
		await interaction.reply(choose(prompts));
		return;
	}

	if (command === "icebreaker") {
		await interaction.reply(choose([
			"Icebreaker: What is your comfort movie?",
			"Icebreaker: Which room in the house do you claim?",
			"Icebreaker: What snack represents your mood today?",
		]));
		return;
	}

	if (command === "fortune") {
		await interaction.reply(choose([
			"You will argue today. Over nothing.",
			"A cozy surprise waits in your near future.",
			"Someone will ask you for help. Say yes.",
		]));
		return;
	}

	if (command === "address") {
		const targetMember = interaction.options.getMember("user");
		const address = interaction.options.getString("title", true);
		if (!targetMember) {
			await interaction.reply("That user is not in this server.");
			return;
		}
		guildState.addresses[targetMember.id] = address;
		scheduleSave();
		await interaction.reply(`Address set for ${targetMember.displayName}.`);
		return;
	}

	if (command === "whoami") {
		const title = formatUserDisplay(member, guildState);
		const roleType = getFamilyType(member);
		const favor = guildState.favor[member.id] || 0;
		const tier = getFavorTier(favor);
		const embed = maidEmbed(
			"🪞 Manor Identity",
			`**Addressed As:** ${title}\n` +
			`**Household Role:** ${roleType.toUpperCase()}\n` +
			`**Favor Standing:** ${tier.title} (${favor} points)\n\n` +
			`**Household Standing:**\n*${tier.desc}*`
		);
		await interaction.reply({ embeds: [embed] });
		return;
	}

	if (command === "reward") {
		if (!isHeadOfHousehold(interaction.member)) {
			await interaction.reply({
				content: "👑 Only the Head of Household may issue this command.",
				ephemeral: true
			});
			return;
		}
		const targetMember = interaction.options.getMember("user");
		if (!targetMember) {
			await interaction.reply("That user is not in this server.");
			return;
		}
		guildState.favor[targetMember.id] = (guildState.favor[targetMember.id] || 0) + 5;
		scheduleSave();
		const tier = getFavorTier(guildState.favor[targetMember.id]);
		const embed = maidEmbed(
			"🍪 Good Behavior Acknowledged",
			`${targetMember.displayName} has been rewarded 5 favor points.\n` +
			`Current favor: **${guildState.favor[targetMember.id]}** (${tier.title})`
		);
		await interaction.reply({ embeds: [embed] });
		return;
	}

	if (command === "ground") {
		if (!isHeadOfHousehold(interaction.member)) {
			await interaction.reply({
				content: "👑 Only the Head of Household may issue this command.",
				ephemeral: true
			});
			return;
		}
		const targetMember = interaction.options.getMember("user");
		if (!targetMember) {
			await interaction.reply("That user is not in this server.");
			return;
		}
		guildState.favor[targetMember.id] = (guildState.favor[targetMember.id] || 0) - 5;
		scheduleSave();
		const tier = getFavorTier(guildState.favor[targetMember.id]);
		const embed = maidEmbed(
			"📉 Privileges Reduced",
			`${targetMember.displayName} has lost 5 favor points.\n` +
			`Current favor: **${guildState.favor[targetMember.id]}** (${tier.title})`,
			"#e56b6f"
		);
		await interaction.reply({ embeds: [embed] });
		return;
	}

	if (command === "favor") {
		const targetMember = interaction.options.getMember("user") || interaction.member;
		const favor = guildState.favor[targetMember.id] || 0;
		const tier = getFavorTier(favor);
		const embed = maidEmbed(
			`📊 Favor Ledger: ${targetMember.displayName}`,
			`**Standing:** ${tier.title}\n` +
			`**Current Favor:** **${favor}** points\n\n` +
			`**Household Privileges:**\n${tier.desc}`
		);
		await interaction.reply({ embeds: [embed] });
		return;
	}

	if (command === "household") {
		const favorEntries = Object.entries(guildState.favor).sort((a, b) => b[1] - a[1]);
		const topBehaved = favorEntries[0] ? `<@${favorEntries[0][0]}> (${favorEntries[0][1]} favor - ${getFavorTier(favorEntries[0][1]).title})` : "None yet";
		const mostChaotic = favorEntries[favorEntries.length - 1] && favorEntries[favorEntries.length - 1][1] < 0
			? `<@${favorEntries[favorEntries.length - 1][0]}> (${favorEntries[favorEntries.length - 1][1]} favor - ${getFavorTier(favorEntries[favorEntries.length - 1][1]).title})`
			: "None yet";
		const unresolvedIncidents = (guildState.incidents || []).filter(i => !i.resolved).length;
		const embed = maidEmbed(
			"🏠 Household Status & Standings",
			`**🌙 Night Mode:** ${guildState.nightMode ? "On" : "Off"}\n` +
			`**🕰 Curfew:** ${guildState.curfew}\n` +
			`**🧺 Active Reminders:** ${guildState.reminders.length}\n` +
			`**📜 Pending Incidents:** ${unresolvedIncidents}\n` +
			`**🌟 Top Behaved:** ${topBehaved}\n` +
			`**😈 Most Chaotic:** ${mostChaotic}`
		);
		await interaction.reply({ embeds: [embed] });
		return;
	}

	if (command === "checkin") {
		const today = new Date().toDateString();
		if (guildState.checkIns[interaction.user.id] === today) {
			await interaction.reply({ content: "You have already checked in today.", ephemeral: true });
			return;
		}
		guildState.checkIns[interaction.user.id] = today;
		guildState.favor[interaction.user.id] = (guildState.favor[interaction.user.id] || 0) + 1;
		scheduleSave();
		const tier = getFavorTier(guildState.favor[interaction.user.id]);
		const embed = maidEmbed(
			"✅ Attendance Noted",
			`Daily check-in complete. You received 1 favor point.\nCurrent favor: **${guildState.favor[interaction.user.id]}** (${tier.title})`
		);
		await interaction.reply({ embeds: [embed] });
		return;
	}

	if (command === "familymeeting") {
		if (!isHeadOfHousehold(interaction.member)) {
			await interaction.reply({
				content: "👑 Only the Head of Household may call a family meeting.",
				ephemeral: true
			});
			return;
		}
		const topic = interaction.options.getString("topic") || "General household matters";
		const embed = maidEmbed(
			"🏠 Family Meeting Called",
			`**Topic:** ${topic}\n\nAttendance required by all household members.`,
			"#ffd700"
		);
		const roleNames = [
			process.env.ROLE_HEAD || "Head of Household",
			process.env.ROLE_KIDS || "Kids",
			process.env.ROLE_SIBLINGS || "Siblings",
			process.env.ROLE_KIN || "Kin"
		];
		const mentions = roleNames.map(roleName => {
			const discordRole = interaction.guild.roles.cache.find(r => r.name === roleName);
			return discordRole ? `<@&${discordRole.id}>` : null;
		}).filter(Boolean).join(" ");
		await interaction.reply({ content: mentions, embeds: [embed] });
		return;
	}

	if (command === "tea") {
		const targetMember = interaction.options.getMember("user") || interaction.member;
		const favor = guildState.favor[targetMember.id] || 0;
		if (favor <= -10) {
			const embed = maidEmbed(
				"💧 Lukewarm Tap Water - In the Doghouse",
				`${targetMember.displayName} has **${favor}** favor points.\n\n` +
				`*"You have brought disrepute to the household and tested my patience. You have not earned fine tea today. Assist with chores and behave before asking for luxuries."*`,
				"#e56b6f"
			);
			await interaction.reply({ embeds: [embed] });
			return;
		}

		const menu = new StringSelectMenuBuilder()
			.setCustomId(`tea_select:${targetMember.id}:${interaction.user.id}`)
			.setPlaceholder("Select a tea blend from the cart...")
			.addOptions(
				{ label: "Chamomile & Lavender Honey", value: "chamomile", description: "Calming floral brew to soothe stress.", emoji: "🌼" },
				{ label: "Earl Grey, Black", value: "earlgrey", description: "Strong bergamot black tea. No sugar, no nonsense.", emoji: "☕" },
				{ label: "Ceremonial Matcha Latte", value: "matcha", description: "Whisked green tea with smooth oat milk foam.", emoji: "🍵" },
				{ label: "Peppermint Herbal", value: "peppermint", description: "Crisp and invigorating mint infusion.", emoji: "🌿" },
				{ label: "Gourmet Hot Chocolate", value: "cocoa", description: "Rich cocoa with marshmallows (Kids or Favor 10+).", emoji: "🍫" },
			);
		const row = new ActionRowBuilder().addComponents(menu);
		const embed = maidEmbed(
			"🫖 The Maid's Afternoon Tea Cart",
			`The maid wheels in the mahogany tea cart for **${targetMember.displayName}**.\n` +
			`Please choose a blend from the tea cart below:`,
			guildState.nightMode ? "#2b2d42" : "#f5c2e7"
		);
		await interaction.reply({ embeds: [embed], components: [row] });
		return;
	}

	if (command === "snack") {
		const targetMember = interaction.options.getMember("user") || interaction.member;
		const favor = guildState.favor[targetMember.id] || 0;
		if (favor <= -10) {
			const embed = maidEmbed(
				"🍞 Stale Bread Crusts - In the Doghouse",
				`${targetMember.displayName} has **${favor}** favor points.\n\n` +
				`*"A dried heel of yesterday's loaf. Those who sow chaos in the house do not receive pastries. Go do some chores."*`,
				"#e56b6f"
			);
			await interaction.reply({ embeds: [embed] });
			return;
		}

		const menu = new StringSelectMenuBuilder()
			.setCustomId(`snack_select:${targetMember.id}:${interaction.user.id}`)
			.setPlaceholder("Select a treat from the pantry...")
			.addOptions(
				{ label: "Warm Chocolate Chip Cookies", value: "cookies", description: "Fresh from the oven, gooey and warm.", emoji: "🍪" },
				{ label: "Scones with Clotted Cream & Jam", value: "scones", description: "Traditional afternoon tea scones.", emoji: "🧁" },
				{ label: "Chilled Cut Fruit Plate", value: "fruit", description: "Melon, fresh berries, and grapes.", emoji: "🍇" },
				{ label: "Cucumber Tea Sandwiches", value: "sandwiches", description: "Delicate with herbed dill butter.", emoji: "🥪" },
				{ label: "French Pastel Macarons", value: "macarons", description: "Delicate almond confections (Favor 10+).", emoji: "🍬" },
			);
		const row = new ActionRowBuilder().addComponents(menu);
		const embed = maidEmbed(
			"🧺 The Maid's Pantry Selection",
			`The maid opens the manor pantry for **${targetMember.displayName}**.\n` +
			`Select a refreshment from the list below:`,
			guildState.nightMode ? "#2b2d42" : "#f5c2e7"
		);
		await interaction.reply({ embeds: [embed], components: [row] });
		return;
	}

	if (command === "chores") {
		const row = new ActionRowBuilder().addComponents(
			new ButtonBuilder().setCustomId("chore_library").setLabel("Dust Library").setEmoji("🧹").setStyle(ButtonStyle.Secondary),
			new ButtonBuilder().setCustomId("chore_silver").setLabel("Polish Silver").setEmoji("✨").setStyle(ButtonStyle.Secondary),
			new ButtonBuilder().setCustomId("chore_garden").setLabel("Tend Conservatory").setEmoji("🌿").setStyle(ButtonStyle.Success),
			new ButtonBuilder().setCustomId("chore_linen").setLabel("Fold Linens").setEmoji("🧺").setStyle(ButtonStyle.Primary)
		);
		const embed = maidEmbed(
			"📋 The Manor Chore Board",
			`The household requires upkeep. Select a duty below to assist the maid and earn favor points.\n\n` +
			`*Warning: Skill rolls determine your results! Perfect effort is rewarded, but clumsy mishaps will damage heirlooms.*`,
			guildState.nightMode ? "#2b2d42" : "#94e2d5"
		);
		await interaction.reply({ embeds: [embed], components: [row] });
		return;
	}

	if (command === "bell") {
		const request = interaction.options.getString("request");
		const roleType = getFamilyType(member);
		const favor = guildState.favor[member.id] || 0;
		const tier = getFavorTier(favor);
		let greeting = "";

		if (isHeadOfHousehold(member)) {
			greeting = "The sterling bell chimes with solemn authority. The maid appears almost instantaneously, offering a deep, respectful curtsey.\n\n*'At your command, Head of Household. How may the estate attend to your wishes?'*";
		} else if (tier.level === "golden") {
			greeting = "The bell tinkles in a bright, musical chime. The maid enters with an affectionate smile, carrying a clean cloth.\n\n*'A pleasure, dear child. What may I fetch or prepare for our most exemplary household member?'*";
		} else if (tier.level === "doghouse") {
			greeting = "The bell jangles noisily. The maid steps into the archway with arms crossed and eyes narrowed.\n\n*'Ring that bell again with dirty hands and see what happens. What do you want, scullery delinquent? Speak quickly before I find you another scrubbing brush.'*";
		} else if (roleType === "kid") {
			greeting = "The bell rings three times in rapid succession. The maid strides in with her hands planted firmly on her apron.\n\n*'Yes, young one? What has been spilled, misplaced, or broken this time?'*";
		} else {
			greeting = "The silver bell echoes through the hall. The maid appears with poised posture and a polite bow.\n\n*'You rang? How may I be of service to you today?'*";
		}

		let fullResponse = greeting;
		if (request) {
			fullResponse += `\n\n**Your Request:** *"${request}"*`;
			if (tier.level !== "doghouse") {
				fullResponse += `\n\n*'Very well. I shall see to it shortly.'*`;
			} else {
				fullResponse += `\n\n*'Request noted, though you will wait until your chores are completed.'*`;
			}
		}

		const embed = maidEmbed("🛎️ The Service Bell", fullResponse, guildState.nightMode ? "#2b2d42" : "#ffd700");
		await interaction.reply({ embeds: [embed] });
		return;
	}

	if (command === "incident") {
		const sub = interaction.options.getSubcommand();
		if (sub === "record") {
			const targetUser = interaction.options.getUser("user", true);
			const targetMember = interaction.options.getMember("user");
			const infraction = interaction.options.getString("infraction", true);
			const incidentId = (guildState.incidents.reduce((max, i) => Math.max(max, i.id || 0), 0)) + 1;
			
			const commentary = choose([
				"The carpets were freshly steam-cleaned this morning. Utterly unacceptable.",
				"A formal black mark has been inked into the household ledger.",
				"I shall present this evidence to the Head of Household posthaste.",
				"The silverware count was already short; now this. Suspicious indeed.",
				"I am disappointed, though frankly not surprised.",
				"The tea had gone cold while I witnessed this commotion."
			]);

			const incidentObj = {
				id: incidentId,
				targetId: targetUser.id,
				targetName: targetMember ? targetMember.displayName : targetUser.username,
				reporterId: interaction.user.id,
				reporterName: interaction.member?.displayName || interaction.user.username,
				infraction,
				commentary,
				date: new Date().toISOString(),
				resolved: false,
				verdict: null,
			};
			guildState.incidents.push(incidentObj);
			scheduleSave();

			const embed = maidEmbed(
				`📜 Manor Incident Report #${incidentId}`,
				`**Accused:** <@${targetUser.id}>\n` +
				`**Reported by:** <@${interaction.user.id}>\n` +
				`**Infraction:** *"${infraction}"*\n\n` +
				`**Housekeeper's Ledger Note:**\n*"${commentary}"*`,
				"#e76f51"
			);
			await interaction.reply({ embeds: [embed] });

			// Also announce in announceChannelId if configured
			if (guildState.announceChannelId && guildState.announceChannelId !== interaction.channelId) {
				try {
					const annChannel = await client.channels.fetch(guildState.announceChannelId);
					if (annChannel) {
						await annChannel.send({ embeds: [embed] });
					}
				} catch (e) {
					// Ignore announce error
				}
			}
			return;
		}

		if (sub === "log") {
			const targetUser = interaction.options.getUser("user");
			let list = guildState.incidents || [];
			if (targetUser) {
				list = list.filter(i => i.targetId === targetUser.id);
			}
			if (list.length === 0) {
				await interaction.reply({ content: "The incident ledger is completely clean. No infractions on file.", ephemeral: true });
				return;
			}
			const recent = list.slice(-5).reverse();
			const lines = recent.map(i => {
				const status = i.resolved ? `✅ Resolved (${i.verdict})` : "⚠️ Pending Head of Household Review";
				return `**#${i.id}** — <@${i.targetId}>: *"${i.infraction}"*\n   ↳ ${status}`;
			});
			const embed = maidEmbed(
				"📜 Manor Incident Ledger",
				lines.join("\n\n"),
				"#2b2d42"
			);
			await interaction.reply({ embeds: [embed] });
			return;
		}

		if (sub === "resolve") {
			if (!isHeadOfHousehold(interaction.member)) {
				await interaction.reply({
					content: "👑 Only the Head of Household may resolve incident reports.",
					ephemeral: true
				});
				return;
			}
			const id = interaction.options.getInteger("id", true);
			const verdict = interaction.options.getString("verdict", true);
			const incident = (guildState.incidents || []).find(i => i.id === id);

			if (!incident) {
				await interaction.reply({ content: `No incident found with ID #${id}.`, ephemeral: true });
				return;
			}
			if (incident.resolved) {
				await interaction.reply({ content: `Incident #${id} has already been resolved (${incident.verdict}).`, ephemeral: true });
				return;
			}

			let favorDelta = 0;
			let verdictDescription = "";
			if (verdict === "pardon") {
				favorDelta = 0;
				verdictDescription = "Pardoned with a stern reminder (No favor change).";
			} else if (verdict === "reprimand") {
				favorDelta = -2;
				verdictDescription = "Formal Reprimand (-2 favor points).";
			} else if (verdict === "severe") {
				favorDelta = -5;
				verdictDescription = "Severe Household Penalty (-5 favor points and mandatory chores).";
			} else if (verdict === "exonerate") {
				favorDelta = 1;
				verdictDescription = "Exonerated of false accusation (+1 favor point).";
			}

			guildState.favor[incident.targetId] = (guildState.favor[incident.targetId] || 0) + favorDelta;
			incident.resolved = true;
			incident.verdict = verdictDescription;
			incident.resolvedBy = interaction.user.id;
			incident.resolvedAt = new Date().toISOString();
			scheduleSave();

			const embed = maidEmbed(
				`⚖️ Incident #${id} Formally Resolved`,
				`**Accused:** <@${incident.targetId}>\n` +
				`**Original Infraction:** *"${incident.infraction}"*\n\n` +
				`**Head of Household Verdict:**\n${verdictDescription}\n\n` +
				`Current favor for <@${incident.targetId}>: **${guildState.favor[incident.targetId]}** points (${getFavorTier(guildState.favor[incident.targetId]).title}).`,
				"#a6e3a1"
			);
			await interaction.reply({ embeds: [embed] });
			return;
		}
	}

	if (command === "tuckin") {
		const targetMember = interaction.options.getMember("user") || interaction.member;
		const type = getFamilyType(targetMember);
		let message = "Blanket adjusted. Sleep well.";
		if (type === "kid") {
			message = `Blanket adjusted for ${targetMember.displayName}. Forehead kiss deployed. Sleep tight, young one.`;
		} else if (type === "head") {
			message = `Rest well, ${targetMember.displayName}. The household is secure.`;
		}
		const embed = maidEmbed("🛏️ Tucked In", message);
		await interaction.reply({ embeds: [embed] });
		return;
	}

	if (command === "comfort") {
		const targetMember = interaction.options.getMember("user") || interaction.member;
		const type = getFamilyType(targetMember);
		const favor = guildState.favor[targetMember.id] || 0;
		let message = "You are safe here. Breathe.";
		
		if (favor <= -10) {
			message = `${targetMember.displayName}, you have accumulated negative favor and tested the family's patience. Sit in the quiet corner and reflect. When your chores are done, comfort will be waiting.`;
		} else if (type === "kid") {
			message = `Gentle hug deployed for ${targetMember.displayName}. It will be alright, young one.`;
		} else if (type === "sibling") {
			message = `${targetMember.displayName}, sit. You do not have to explain. Just rest.`;
		} else if (type === "head") {
			message = `${targetMember.displayName}, even the Head of Household needs rest. I will manage things.`;
		}
		const embed = maidEmbed("🧸 Comfort Delivered", message, "#9d8ac5");
		await interaction.reply({ embeds: [embed] });
		return;
	}

	if (command === "tidy") {
		const embed = maidEmbed(
			"🧹 House Report",
			choose([
				"The house sparkles. Please do not undo my work.",
				"Everything is in its place. Try to keep it that way.",
				"I have tidied. The tea is brewing. All is calm."
			])
		);
		await interaction.reply({ embeds: [embed] });
		return;
	}

	if (SIMPLE_RESPONSE_COMMANDS.some((item) => item.name === command)) {
		let reply = getResponse(command, guildState.mode);
		if (command === "help") {
			const context = interaction.options.getString("context");
			if (context) {
				reply = `${getResponse("help", guildState.mode)} (${context})`;
			}
		}
		if (command === "study") {
			const roll = interaction.options.getBoolean("roll") === true;
			if (roll) {
				const effort = Math.floor(Math.random() * 20) + 1;
				reply = `Effort: ${effort}/20. Acceptable.`;
			}
		}
		if (["homework", "study", "bedtime"].includes(command)) {
			const address = formatUserDisplay(member, guildState);
			reply = `${address}, ${reply}`;
		}
		if (guildState.nightMode) {
			reply = getNightModeResponse(reply);
		}
		
		// Get emoji based on command
		const emojiMap = {
			dinner: "🍽️", menu: "📋", rules: "📜", cook: "👩‍🍳", snack: "🍪",
			laundry: "🧺", fold: "👔", chores: "📝", bedtime: "🛏️", wake: "☀️",
			routine: "🧸", comfort: "💜", hug: "🤗", badday: "🌧️", house: "🏠",
			weather: "🌤️", homework: "📚", study: "✏️", help: "🤝", clean: "✨"
		};
		const emoji = emojiMap[command] || "🤍";
		const title = `${emoji} ${command.charAt(0).toUpperCase() + command.slice(1)}`;
		
		const embed = maidEmbed(title, reply, guildState.nightMode ? "#2b2d42" : undefined);
		await interaction.reply({ embeds: [embed] });
		return;
	}

	await interaction.reply("Unknown command.");
});

client.login(process.env.DISCORD_TOKEN);
