const fs = require("fs");
const path = require("path");
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
} = require("discord.js");
require("dotenv").config();

const DATA_PATH = path.join(__dirname, "data.json");

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	],
	partials: [Partials.Channel],
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
		};
	}
	return data.guilds[guildId];
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
					const embed = maidEmbed(
						"🕰 Curfew Notice",
						`It is past curfew. ${mention} should be asleep. I am watching.`,
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
	{ name: "snack", description: "Ask for a snack." },
	{ name: "laundry", description: "Ask about laundry." },
	{ name: "fold", description: "Ask about folding laundry." },
	{ name: "chores", description: "Ask about chores." },
	{ name: "bedtime", description: "Ask about bedtime." },
	{ name: "wake", description: "Ask about wake-up." },
	{ name: "routine", description: "Ask about the routine." },
	{ name: "comfort", description: "Ask for comfort." },
	{ name: "hug", description: "Ask for a hug." },
	{ name: "badday", description: "Mention a bad day." },
	{ name: "house", description: "Ask about the house." },
	{ name: "weather", description: "Ask about the weather." },
	{ name: "homework", description: "Ask about homework time." },
	{ name: "study", description: "Ask about study time." },
	{ name: "help", description: "Ask for help." },
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
	...SIMPLE_RESPONSE_COMMANDS.filter((item) => !["help", "study"].includes(item.name)).map((item) =>
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
		.setDescription("Check your favor points.")
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
		.setDescription("The maid offers tea and comfort.")
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
	const guildId = process.env.GUILD_ID;
	if (!guildId) {
		console.warn("GUILD_ID not set. Skipping slash command registration.");
		return;
	}
	const route = Routes.applicationGuildCommands(clientId, guildId);
	try {
		await rest.put(route, { body: COMMANDS });
		console.log(`Registered ${COMMANDS.length} guild commands.`);
	} catch (error) {
		console.error("Failed to register slash commands:", error);
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

client.on("messageCreate", async (message) => {
	if (message.author.bot) return;
	if (!message.guild) return;

	const guildState = getGuildState(message.guild.id);
	guildState.lastMessageAt = Date.now();
	guildState.lastActiveChannelId = message.channel.id;

	maybeReact(message, "dirty", "\ud83e\uddfd");
	maybeReact(message, "food", "\ud83c\udf7d\ufe0f");

	if (/\b(tired|sleepy)\b/i.test(message.content)) {
		message.channel.send(choose([
			"Sit down. I insist.",
			"Rest. I will handle it.",
		])).catch(() => undefined);
	}
	if (/\bhungry\b/i.test(message.content)) {
		message.channel.send(choose([
			"That explains the attitude.",
			"Kitchen is ready if you behave.",
		])).catch(() => undefined);
	}
	if (/\bbored\b/i.test(message.content)) {
		message.channel.send(choose([
			"I have ideas. Dangerous ones.",
			"Boredom is a choice. Choose better.",
		])).catch(() => undefined);
	}

	if (/\b(drama|fight|argue)\b/i.test(message.content)) {
		const key = `calm:${message.channel.id}`;
		const last = guildState.cooldowns[key] || 0;
		if (Date.now() - last > 10 * 60 * 1000) {
			guildState.cooldowns[key] = Date.now();
			scheduleSave();
			message.channel.send(choose([
				"Gentle reminder: breathe first, respond second.",
				"Let us lower the volume and raise the care.",
			])).catch(() => undefined);
		}
	}
});

client.on("interactionCreate", async (interaction) => {
	if (!interaction.isChatInputCommand()) return;
	if (!interaction.guild) {
		await interaction.reply({ content: "This command can only be used in servers.", ephemeral: true });
		return;
	}

	const guildState = getGuildState(interaction.guild.id);
	guildState.lastMessageAt = Date.now();
	guildState.lastActiveChannelId = interaction.channelId;

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
		await interaction.reply(`You are addressed as: ${title}`);
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
		const embed = maidEmbed("🍪 Good Behavior Acknowledged", `${targetMember.displayName} has been rewarded 5 favor points.\nCurrent favor: ${guildState.favor[targetMember.id]}`);
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
		const embed = maidEmbed("📉 Privileges Reduced", `${targetMember.displayName} has lost 5 favor points.\nCurrent favor: ${guildState.favor[targetMember.id]}`, "#e56b6f");
		await interaction.reply({ embeds: [embed] });
		return;
	}

	if (command === "favor") {
		const targetMember = interaction.options.getMember("user") || interaction.member;
		const favor = guildState.favor[targetMember.id] || 0;
		const embed = maidEmbed("📊 Favor Points", `${targetMember.displayName} has **${favor}** favor points.`);
		await interaction.reply({ embeds: [embed] });
		return;
	}

	if (command === "household") {
		const favorEntries = Object.entries(guildState.favor).sort((a, b) => b[1] - a[1]);
		const topBehaved = favorEntries[0] ? `<@${favorEntries[0][0]}> (${favorEntries[0][1]} favor)` : "None yet";
		const mostChaotic = favorEntries[favorEntries.length - 1] && favorEntries[favorEntries.length - 1][1] < 0
			? `<@${favorEntries[favorEntries.length - 1][0]}> (${favorEntries[favorEntries.length - 1][1]} favor)`
			: "None yet";
		const embed = maidEmbed(
			"🏠 Household Status",
			`**🌙 Night Mode:** ${guildState.nightMode ? "On" : "Off"}\n` +
			`**🕰 Curfew:** ${guildState.curfew}\n` +
			`**🧺 Active Reminders:** ${guildState.reminders.length}\n` +
			`**📊 Top Behaved:** ${topBehaved}\n` +
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
		const embed = maidEmbed("✅ Attendance Noted", `Daily check-in complete. You received 1 favor point.\nCurrent favor: ${guildState.favor[interaction.user.id]}`);
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
		const type = getFamilyType(interaction.member);
		let message = "Sit. Drink slowly. Speak when ready.";
		if (type === "kid") {
			message = "Sit, young one. The tea is warm. Tell me what happened.";
		} else if (type === "head") {
			message = "Tea is prepared. Rest your thoughts here.";
		}
		const embed = maidEmbed("🍵 Tea Time", message);
		await interaction.reply({ embeds: [embed] });
		return;
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
		let message = "You are safe here. Breathe.";
		if (type === "kid") {
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
