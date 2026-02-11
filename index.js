const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits, Partials, ActivityType } = require("discord.js");
require("dotenv").config();

const DATA_PATH = path.join(__dirname, "data.json");
const PREFIX = "!";

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
		};
	}
	return data.guilds[guildId];
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
		for (const [, guildState] of Object.entries(data.guilds)) {
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
					await channel.send("It is past curfew. Children should be asleep. I am watching.");
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

client.once("ready", () => {
	console.log(`Logged in as ${client.user.tag}`);
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

	if (!message.content.startsWith(PREFIX)) return;

	const [rawCommand, ...args] = message.content.slice(PREFIX.length).trim().split(/\s+/);
	const command = rawCommand.toLowerCase();

	if (command === "maid") {
		const sub = (args[0] || "").toLowerCase();
		const text = args.slice(1).join(" ");
		if (sub === "announce") {
			const channelId = guildState.announceChannelId || message.channel.id;
			const channel = await client.channels.fetch(channelId);
			if (channel) {
				await channel.send(`\ud83d\udce3 Maid Announcement: ${text || "Family meeting in 10 minutes."}`);
			}
			return;
		}
		if (["polite", "sassy", "chaotic", "tired"].includes(sub)) {
			guildState.mode = sub;
			guildState.nightMode = false;
			scheduleSave();
			await message.channel.send(`Mode set to ${sub}.`);
			return;
		}
		if (sub === "nightmode" || sub === "night") {
			guildState.nightMode = true;
			scheduleSave();
			await message.channel.send("Night mode enabled. Voices low.");
			return;
		}
		if (sub === "help") {
			const adults = Object.entries(guildState.roles)
				.filter(([role]) => /(mom|dad|parent|guardian|adult)/i.test(role))
				.map(([, userId]) => `<@${userId}>`);
			const ping = adults.length > 0 ? adults.join(" ") : "";
			await message.channel.send(`Calm mode engaged. ${ping}`.trim());
			return;
		}
		if (sub === "status") {
			const action = (args[1] || "").toLowerCase();
			const statusText = args.slice(2).join(" ");
			if (action === "add" && statusText) {
				data.global.statusRotation.push(statusText);
				scheduleSave();
				await message.channel.send("Status added.");
				return;
			}
			if (action === "list") {
				await message.channel.send(`Statuses: ${data.global.statusRotation.join(" | ")}`);
				return;
			}
			await message.channel.send("Usage: !maid status add <text> | !maid status list");
			return;
		}
		await message.channel.send("Usage: !maid announce <text> | polite | sassy | chaotic | tired | nightmode | help");
		return;
	}

	if (command === "setannounce") {
		const channel = message.mentions.channels.first();
		if (!channel) {
			await message.channel.send("Mention a channel to set announcements.");
			return;
		}
		guildState.announceChannelId = channel.id;
		scheduleSave();
		await message.channel.send(`Announcement channel set to ${channel}.`);
		return;
	}

	if (command === "setrole") {
		const roleName = args[0];
		const member = message.mentions.members.first();
		if (!roleName || !member) {
			await message.channel.send("Usage: !setrole <role> @user");
			return;
		}
		guildState.roles[roleName.toLowerCase()] = member.id;
		guildState.rolesByUser[member.id] = roleName.toLowerCase();
		scheduleSave();
		await message.channel.send(`Role ${roleName} set for ${member.displayName}.`);
		return;
	}

	if (command === "roles") {
		const entries = Object.entries(guildState.roles);
		if (entries.length === 0) {
			await message.channel.send("No roles set yet.");
			return;
		}
		await message.channel.send(entries.map(([role, userId]) => `${role}: <@${userId}>`).join("\n"));
		return;
	}

	if (command === "note") {
		const member = message.mentions.members.first();
		const noteText = args.slice(1).join(" ");
		if (!member || !noteText) {
			await message.channel.send("Usage: !note @user <text>");
			return;
		}
		guildState.notes.push({
			userId: member.id,
			text: noteText,
			at: new Date().toISOString(),
			authorId: message.author.id,
		});
		scheduleSave();
		await message.channel.send("Noted. This will be used against you later.");
		return;
	}

	if (command === "notes") {
		const member = message.mentions.members.first();
		const list = member
			? guildState.notes.filter((note) => note.userId === member.id)
			: guildState.notes;
		if (list.length === 0) {
			await message.channel.send("No notes yet.");
			return;
		}
		await message.channel.send(list.slice(-5).map((note) => `- <@${note.userId}>: ${note.text}`).join("\n"));
		return;
	}

	if (command === "remember") {
		const quoted = parseQuoted(message.content);
		const memory = quoted || args.join(" ");
		if (!memory) {
			await message.channel.send("Usage: !remember \"text\"");
			return;
		}
		guildState.jokes.push({
			text: memory,
			at: new Date().toISOString(),
			authorId: message.author.id,
		});
		scheduleSave();
		await message.channel.send("Noted. This will be used against you later.");
		return;
	}

	if (command === "recall") {
		if (guildState.jokes.length === 0) {
			await message.channel.send("I remember nothing. Yet.");
			return;
		}
		const memory = choose(guildState.jokes);
		await message.channel.send(memory.text);
		return;
	}

	if (command === "setcurfew") {
		const time = parseTime(args[0] || "");
		if (!time) {
			await message.channel.send("Usage: !setcurfew HH:MM (24h)");
			return;
		}
		guildState.curfew = args[0];
		scheduleSave();
		await message.channel.send(`Curfew set to ${args[0]}.`);
		return;
	}

	if (command === "curfew") {
		await message.channel.send(`Curfew is ${guildState.curfew}.`);
		return;
	}

	if (command === "warnmute") {
		const member = message.mentions.members.first();
		const reason = args.slice(1).join(" ") || "Please cool down.";
		if (!member) {
			await message.channel.send("Usage: !warnmute @user <reason>");
			return;
		}
		await message.channel.send(`Temporary mute warning for ${member.displayName}: ${reason}`);
		return;
	}

	if (command === "remind") {
		const quoted = parseQuoted(message.content);
		const reminderText = quoted || args.slice(0, -2).join(" ");
		const dateInput = args.slice(-2).join(" ");
		const date = parseDateTime(dateInput);
		if (!reminderText || !date) {
			await message.channel.send("Usage: !remind \"text\" YYYY-MM-DD HH:MM");
			return;
		}
		const id = createReminderId(guildState);
		addReminder(guildState, {
			id,
			guildId: message.guild.id,
			channelId: message.channel.id,
			userId: message.author.id,
			text: `\ud83d\udcc5 Reminder: ${reminderText}`,
			time: date.toISOString(),
		});
		await message.channel.send(`Reminder set (#${id}).`);
		return;
	}

	if (command === "remindme") {
		const minutes = Number(args[0]);
		const reminderText = args.slice(1).join(" ");
		if (!minutes || !reminderText) {
			await message.channel.send("Usage: !remindme <minutes> <text>");
			return;
		}
		const time = new Date(Date.now() + minutes * 60 * 1000);
		const id = createReminderId(guildState);
		addReminder(guildState, {
			id,
			guildId: message.guild.id,
			channelId: message.channel.id,
			userId: message.author.id,
			text: `\ud83d\udcc5 Reminder: ${reminderText}`,
			time: time.toISOString(),
		});
		await message.channel.send(`Reminder set (#${id}).`);
		return;
	}

	if (command === "listreminders") {
		if (guildState.reminders.length === 0) {
			await message.channel.send("No reminders set.");
			return;
		}
		const lines = guildState.reminders
			.slice(0, 10)
			.map((reminder) => `#${reminder.id} at ${new Date(reminder.time).toLocaleString()}: ${reminder.text}`);
		await message.channel.send(lines.join("\n"));
		return;
	}

	if (command === "delreminder") {
		const id = Number(args[0]);
		if (!id) {
			await message.channel.send("Usage: !delreminder <id>");
			return;
		}
		const before = guildState.reminders.length;
		guildState.reminders = guildState.reminders.filter((reminder) => reminder.id !== id);
		scheduleSave();
		await message.channel.send(before === guildState.reminders.length ? "No reminder found." : "Reminder deleted.");
		return;
	}

	if (command === "setbirthday" || command === "setanniversary") {
		const member = message.mentions.members.first();
		const dateInput = args[1];
		if (!member || !dateInput) {
			await message.channel.send(`Usage: !${command} @user YYYY-MM-DD`);
			return;
		}
		const date = parseDateTime(`${dateInput} 09:00`);
		if (!date) {
			await message.channel.send("Provide a valid date YYYY-MM-DD.");
			return;
		}
		ensureFutureDate(date);
		const id = createReminderId(guildState);
		addReminder(guildState, {
			id,
			guildId: message.guild.id,
			channelId: message.channel.id,
			userId: member.id,
			text: command === "setbirthday"
				? `\ud83c\udf82 Happy birthday <@${member.id}>!`
				: `\ud83d\udc9e Happy anniversary, <@${member.id}>!`,
			time: date.toISOString(),
			repeat: "yearly",
		});
		await message.channel.send("Date saved.");
		return;
	}

	if (command === "addevent") {
		const quoted = parseQuoted(message.content);
		const eventName = quoted || args.slice(0, -2).join(" ");
		const dateInput = args.slice(-2).join(" ");
		const date = parseDateTime(dateInput);
		if (!eventName || !date) {
			await message.channel.send("Usage: !addevent \"Name\" YYYY-MM-DD HH:MM");
			return;
		}
		const id = createReminderId(guildState);
		addReminder(guildState, {
			id,
			guildId: message.guild.id,
			channelId: message.channel.id,
			userId: message.author.id,
			text: `\ud83c\udf89 Event: ${eventName} is starting now.`,
			time: date.toISOString(),
		});
		await message.channel.send(`Event scheduled (#${id}).`);
		return;
	}

	if (command === "addweekly") {
		const quoted = parseQuoted(message.content);
		const eventName = quoted || args.slice(0, -2).join(" ");
		const dayName = args.slice(-2, -1)[0];
		const timeInput = args.slice(-1)[0];
		const time = parseTime(timeInput || "");
		if (!eventName || !dayName || !time) {
			await message.channel.send("Usage: !addweekly \"Name\" Fri 20:00");
			return;
		}
		const next = nextWeeklyOccurrence(dayName, time);
		if (!next) {
			await message.channel.send("Invalid day name.");
			return;
		}
		const id = createReminderId(guildState);
		addReminder(guildState, {
			id,
			guildId: message.guild.id,
			channelId: message.channel.id,
			userId: message.author.id,
			text: `\ud83c\udf89 Weekly tradition: ${eventName} starts now.`,
			time: next.toISOString(),
			repeat: "weekly",
		});
		await message.channel.send(`Weekly event scheduled (#${id}).`);
		return;
	}

	if (command === "inittraditions") {
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
				guildId: message.guild.id,
				channelId: message.channel.id,
				userId: message.author.id,
				text: `\ud83c\udf89 Weekly tradition: ${item.name} starts now.`,
				time: next.toISOString(),
				repeat: "weekly",
			});
			created.push(item.name);
		}
		await message.channel.send(created.length > 0 ? `Traditions added: ${created.join(", ")}` : "No traditions added.");
		return;
	}

	if (command === "listevents") {
		if (guildState.reminders.length === 0) {
			await message.channel.send("No events scheduled.");
			return;
		}
		const lines = guildState.reminders
			.filter((reminder) => /Event|Weekly tradition/i.test(reminder.text))
			.slice(0, 10)
			.map((reminder) => `#${reminder.id} at ${new Date(reminder.time).toLocaleString()}: ${reminder.text}`);
		await message.channel.send(lines.join("\n") || "No events scheduled.");
		return;
	}

	if (command === "delevent") {
		const id = Number(args[0]);
		if (!id) {
			await message.channel.send("Usage: !delevent <id>");
			return;
		}
		const before = guildState.reminders.length;
		guildState.reminders = guildState.reminders.filter((reminder) => reminder.id !== id);
		scheduleSave();
		await message.channel.send(before === guildState.reminders.length ? "No event found." : "Event deleted.");
		return;
	}

	if (command === "sl") {
		const sub = (args[0] || "").toLowerCase();
		if (sub === "sethome") {
			const url = args[1];
			if (!url) {
				await message.channel.send("Usage: !sl sethome <SLURL>");
				return;
			}
			guildState.sl.home = url;
			scheduleSave();
			await message.channel.send("SL home set.");
			return;
		}
		if (sub === "home") {
			await message.channel.send(guildState.sl.home || "No SL home set yet.");
			return;
		}
		await message.channel.send("Usage: !sl sethome <SLURL> | !sl home");
		return;
	}

	if (command === "roll") {
		const input = args[0] || "1d20";
		const match = input.match(/^(\d+)d(\d+)$/i);
		if (!match) {
			await message.channel.send("Usage: !roll 1d20");
			return;
		}
		const count = Math.min(10, Number(match[1]));
		const sides = Math.min(1000, Number(match[2]));
		const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
		const total = rolls.reduce((sum, value) => sum + value, 0);
		await message.channel.send(`\ud83c\udfb2 Rolls: ${rolls.join(", ")} (Total ${total})`);
		return;
	}

	if (command === "truth" || command === "dare") {
		const spicy = args[0] && args[0].toLowerCase() === "spicy";
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
		await message.channel.send(choose(prompts));
		return;
	}

	if (command === "icebreaker") {
		await message.channel.send(choose([
			"Icebreaker: What is your comfort movie?",
			"Icebreaker: Which room in the house do you claim?",
			"Icebreaker: What snack represents your mood today?",
		]));
		return;
	}

	if (command === "fortune") {
		await message.channel.send(choose([
			"You will argue today. Over nothing.",
			"A cozy surprise waits in your near future.",
			"Someone will ask you for help. Say yes.",
		]));
		return;
	}

	if (command === "dinner" || command === "rules" || command === "menu" || command === "cook" ||
		command === "snack" || command === "laundry" || command === "fold" || command === "chores" ||
		command === "bedtime" || command === "wake" || command === "routine" || command === "comfort" ||
		command === "hug" || command === "badday" || command === "house" || command === "weather" ||
		command === "homework" || command === "study" || command === "help" || command === "clean") {
		let reply = getResponse(command, guildState.mode);
		if (command === "help" && args.length > 0) {
			reply = `${getResponse("help", guildState.mode)} (${args.join(" ")})`;
		}
		if (command === "study" && args[0] === "roll") {
			const effort = Math.floor(Math.random() * 20) + 1;
			reply = `Effort: ${effort}/20. Acceptable.`;
		}
		if (["homework", "study", "bedtime"].includes(command)) {
			const address = formatUserDisplay(message.member, guildState);
			reply = `${address}, ${reply}`;
		}
		if (guildState.nightMode) {
			reply = getNightModeResponse(reply);
		}
		await message.channel.send(reply);
		return;
	}

	if (command === "address") {
		const member = message.mentions.members.first();
		const address = args.slice(1).join(" ");
		if (!member || !address) {
			await message.channel.send("Usage: !address @user <title>");
			return;
		}
		guildState.addresses[member.id] = address;
		scheduleSave();
		await message.channel.send(`Address set for ${member.displayName}.`);
		return;
	}

	if (command === "whoami") {
		const title = formatUserDisplay(message.member, guildState);
		await message.channel.send(`You are addressed as: ${title}`);
		return;
	}
});

client.login(process.env.DISCORD_TOKEN);
