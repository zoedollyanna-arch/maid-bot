const {
	SlashCommandBuilder,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} = require("discord.js");

// ── Color Palettes for Jwett Moments ♡ ──────────────────────────────────────
const COLORS = {
	AFFECTION: 0xf7c6d4, // Baby Pink
	MOMMY_BABY: 0xf5c2e7, // Soft Blossom Pink
	BEDTIME: 0xcba6f7, // Lavender Dream
	FAMILY_LIFE: 0xfab387, // Warm Peach / Apricot
	COMFORT: 0x89dceb, // Soft Aqua / Sky Blue
	ESTATE: 0xf9e2af, // Champagne Gold
	SPECIAL: 0xf6c177, // Warm Golden Honey
};

// ── Data Helpers & Seed Profiles ────────────────────────────────────────────
const MOTHER_ID = "1197552066269282306";
const DAUGHTER_ID = "782978151185121280";

const SEED_PROFILES = {
	[DAUGHTER_ID]: {
		familyRole: "Daughter 🧸",
		mood: "Spoiled & Loved 🌸",
		comfortItem: "Teddy Bear 🐻",
		pronouns: "she/her",
		characterAge: "Little Princess",
		title: "Princess Jwett 👑",
		bio: "The cherished daughter of Jwett Estates, protected and adored by Mommy.",
		momentsCount: 25,
	},
	[MOTHER_ID]: {
		familyRole: "Mother 👑",
		mood: "Protective & Loving 💕",
		comfortItem: "Warm Chamomile Tea 🫖",
		pronouns: "she/her",
		characterAge: "Matriarch",
		title: "Mother Jwett 👑",
		bio: "The devoted Mother of Jwett Estates, loving her daughter Princess Jwett to the moon and back.",
		momentsCount: 25,
	},
};

const SEED_RELATIONSHIP = {
	userA: MOTHER_ID,
	userB: DAUGHTER_ID,
	relationAtoB: "Mother",
	relationBtoA: "Daughter",
	closeness: 100, // Highest tier: Inseparable Souls 💕 ⭐⭐⭐⭐⭐
	createdAt: Date.now(),
	lastInteraction: Date.now(),
};

const SEED_MEMORY = {
	id: "mem_jwett_foundation",
	timestamp: Date.now(),
	userIds: [MOTHER_ID, DAUGHTER_ID],
	title: "🌙 A Little Love Before Dreamland",
	description: "Mother Jwett tucked Princess Jwett into bed with her teddy bear, kissing her forehead: 'Sweet dreams, my pretty girl. Mommy loves you to the moon and back.'",
	category: "bedtime",
};

function ensureSeedData(guildState) {
	if (!guildState) return;
	if (!guildState.rpProfiles) guildState.rpProfiles = {};
	if (!guildState.rpRelationships) guildState.rpRelationships = {};
	if (!guildState.rpMemories) guildState.rpMemories = [];

	for (const [id, prof] of Object.entries(SEED_PROFILES)) {
		if (!guildState.rpProfiles[id]) {
			guildState.rpProfiles[id] = { ...prof };
		} else {
			if (id === DAUGHTER_ID) {
				guildState.rpProfiles[id].familyRole = "Daughter 🧸";
				guildState.rpProfiles[id].pronouns = "she/her";
				guildState.rpProfiles[id].title = "Princess Jwett 👑";
			} else if (id === MOTHER_ID) {
				guildState.rpProfiles[id].familyRole = "Mother 👑";
				guildState.rpProfiles[id].pronouns = "she/her";
				guildState.rpProfiles[id].title = "Mother Jwett 👑";
			}
		}
	}

	const relKey1 = `${MOTHER_ID}:${DAUGHTER_ID}`;
	const relKey2 = `${DAUGHTER_ID}:${MOTHER_ID}`;
	if (!guildState.rpRelationships[relKey1] && !guildState.rpRelationships[relKey2]) {
		guildState.rpRelationships[relKey1] = { ...SEED_RELATIONSHIP };
	} else {
		const targetKey = guildState.rpRelationships[relKey1] ? relKey1 : relKey2;
		guildState.rpRelationships[targetKey].closeness = Math.max(guildState.rpRelationships[targetKey].closeness || 0, 100);
		guildState.rpRelationships[targetKey].relationAtoB = "Mother";
		guildState.rpRelationships[targetKey].relationBtoA = "Daughter";
	}

	if (guildState.rpMemories.length === 0) {
		guildState.rpMemories.push({ ...SEED_MEMORY });
	}
}

function getRpProfile(guildState, userId) {
	ensureSeedData(guildState);
	if (!guildState.rpProfiles[userId]) {
		guildState.rpProfiles[userId] = {
			familyRole: "Family Member 🏡",
			mood: "Cozy 🍵",
			comfortItem: "Silk Blanket 🎀",
			pronouns: "she/her",
			characterAge: "Youth",
			title: "Cherished Member",
			bio: "",
			momentsCount: 0,
		};
	}
	return guildState.rpProfiles[userId];
}

function getRelationship(guildState, userAId, userBId) {
	ensureSeedData(guildState);
	if (!guildState.rpRelationships) guildState.rpRelationships = {};
	const key1 = `${userAId}:${userBId}`;
	const key2 = `${userBId}:${userAId}`;
	if (guildState.rpRelationships[key1]) {
		return { key: key1, data: guildState.rpRelationships[key1], isA: true };
	}
	if (guildState.rpRelationships[key2]) {
		return { key: key2, data: guildState.rpRelationships[key2], isA: false };
	}
	return null;
}

function addCloseness(guildState, userAId, userBId, amount = 1) {
	if (!guildState.rpRelationships) guildState.rpRelationships = {};
	const existing = getRelationship(guildState, userAId, userBId);
	if (existing) {
		existing.data.closeness = (existing.data.closeness || 0) + amount;
		existing.data.lastInteraction = Date.now();
	}
}

function addRpMemory(guildState, { userIds, title, description, category }) {
	if (!guildState.rpMemories) guildState.rpMemories = [];
	guildState.rpMemories.unshift({
		id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
		timestamp: Date.now(),
		userIds: userIds || [],
		title,
		description,
		category: category || "general",
	});
	if (guildState.rpMemories.length > 50) {
		guildState.rpMemories = guildState.rpMemories.slice(0, 50);
	}
}

function getClosenessTier(closeness) {
	if (closeness >= 50) return { title: "Inseparable Souls 💕", stars: "⭐⭐⭐⭐⭐" };
	if (closeness >= 30) return { title: "Deeply Cherished 🌸", stars: "⭐⭐⭐⭐" };
	if (closeness >= 15) return { title: "Sweetly Bonded 🎀", stars: "⭐⭐⭐" };
	if (closeness >= 5) return { title: "Growing Closer 🌱", stars: "⭐⭐" };
	return { title: "New Connection 💫", stars: "⭐" };
}

// ── Interactive Moments Catalog ─────────────────────────────────────────────
const MOMENT_DEFINITIONS = {
	// 🎀 AFFECTION
	tuckin: {
		name: "tuckin",
		category: "BEDTIME",
		color: COLORS.BEDTIME,
		banner: "🌙 A Little Love Before Dreamland",
		subTitle: "Jwett Estates • Bedtime Moments",
		starterText: (actor, target, profile) => {
			const item = profile?.comfortItem || "favorite plush teddy";
			return (
				`*The soft glow of the bedside lamp warms the room as ${actor} gently smooths the linen sheets over ${target}.*\n\n` +
				`Tucking ${target}'s ${item} snug beside them, ${actor} brushes soft strands of hair from their forehead before leaning down to plant a tender, loving kiss.\n\n` +
				`*"Sweet dreams, my precious one. Rest easy knowing you are loved beyond words."* 🥹💕\n\n` +
				`**${target.displayName.toUpperCase()}'S TURN • Choose how to respond:**`
			);
		},
		targetOptions: [
			{ key: "snuggle", label: "🧸 Snuggle Closer", style: ButtonStyle.Primary },
			{ key: "kiss", label: "💋 Kiss Goodnight", style: ButtonStyle.Success },
			{ key: "story", label: "📖 Ask for a Story", style: ButtonStyle.Secondary },
			{ key: "sleep", label: "😴 Fall Asleep", style: ButtonStyle.Secondary },
		],
		responses: {
			snuggle: {
				narrative: (actor, target) =>
					`🧸 **A Little More Love...**\n\n` +
					`${target} scoots closer to ${actor}, wrapping small arms tight and refusing to let go.\n\n` +
					`*"Just five more minutes, please!"* 🥹💕\n\n` +
					`${actor} giggles softly before leaning in for another warm cuddle.\n\n` +
					`**${actor.displayName.toUpperCase()}'S TURN • How do you tuck them in?**`,
				followUps: [
					{ key: "stay", label: "💗 Stay a Little Longer", style: ButtonStyle.Primary },
					{ key: "lullaby", label: "🌙 Sing a Lullaby", style: ButtonStyle.Secondary },
					{ key: "kiss_forehead", label: "🛏️ Kiss Forehead", style: ButtonStyle.Success },
				],
			},
			kiss: {
				narrative: (actor, target) =>
					`💋 **Sweetest Goodnight...**\n\n` +
					`${target} sits up slightly to press a sweet kiss to ${actor}'s cheek with a sleepy smile.\n\n` +
					`*"Goodnight... I love you to the moon and back."* 💖\n\n` +
					`**${actor.displayName.toUpperCase()}'S TURN • Final bedtime response:**`,
				followUps: [
					{ key: "stay", label: "💗 Whisper 'I love you too'", style: ButtonStyle.Primary },
					{ key: "tuck_tight", label: "🧸 Tuck Blanket Snug", style: ButtonStyle.Success },
				],
			},
			story: {
				narrative: (actor, target) =>
					`📖 **One Quick Bedtime Tale...**\n\n` +
					`${target} peeks out from beneath the blankets with wide, hopeful eyes.\n\n` +
					`*"Could you read just one short fairy tale? Just one chapter?"* ✨\n\n` +
					`**${actor.displayName.toUpperCase()}'S TURN • Tell the story:**`,
				followUps: [
					{ key: "read_story", label: "🏰 Read About the Manor", style: ButtonStyle.Primary },
					{ key: "kiss_forehead", label: "🌙 'Tomorrow, little one'", style: ButtonStyle.Secondary },
				],
			},
			sleep: {
				narrative: (actor, target) =>
					`😴 **Drifting into Dreamland...**\n\n` +
					`${target}'s eyes flutter shut as their breathing grows slow and peaceful, safely surrounded by warmth and love.\n\n` +
					`**${actor.displayName.toUpperCase()}'S TURN • Final blessing:**`,
				followUps: [
					{ key: "dim_lights", label: "🕯️ Dim the Nightlight", style: ButtonStyle.Primary },
					{ key: "kiss_forehead", label: "🛏️ Kiss Forehead", style: ButtonStyle.Success },
				],
			},
		},
		finalText: (actor, target, choice) => {
			if (choice === "lullaby") {
				return (
					`🌙 **A Manor Lullaby**\n\n` +
					`${actor} softly hums a tranquil bedtime melody. ${target} gives a tiny sigh of pure contentment and falls into sweet, peaceful sleep.\n\n` +
					`*The maid quietly dims the chandelier in the corridor. A beautiful memory is saved to Jwett Estates.* ♡`
				);
			}
			return (
				`🌸 **Safe & Sound**\n\n` +
				`${actor} softly tucks the edges of the duvet, leaves the door gently ajar with the nightlight glowing softly, and whispers:\n` +
				`*"Sleep well, precious soul. Tomorrow will be wonderful."*\n\n` +
				`*The room is quiet, filled with unconditional warmth and family love.* ♡`
			);
		},
	},

	hug: {
		name: "hug",
		category: "AFFECTION",
		color: COLORS.AFFECTION,
		banner: "🎀 Warm Embrace",
		subTitle: "Jwett Estates • Affection Moments",
		starterText: (actor, target) => {
			return (
				`*With open arms and a radiant, fond smile, ${actor} steps close and wraps ${target} in the warmest, coziest embrace.*\n\n` +
				`The bustling manor fades into the background as their hug brings a rush of comfort and belonging.\n\n` +
				`**${target.displayName.toUpperCase()}'S TURN • Choose how to respond:**`
			);
		},
		targetOptions: [
			{ key: "squeeze", label: "🤗 Squeeze Tighter", style: ButtonStyle.Primary },
			{ key: "shoulder", label: "💗 Rest Head on Shoulder", style: ButtonStyle.Success },
			{ key: "spin", label: "✨ Giggle & Spin", style: ButtonStyle.Secondary },
			{ key: "pat", label: "🥰 Pat Back Gently", style: ButtonStyle.Secondary },
		],
		responses: {
			squeeze: {
				narrative: (actor, target) =>
					`🤗 **Holding On Tight...**\n\n` +
					`${target} buries into the embrace, hugging ${actor} with all their strength. Neither wants the moment to end!\n\n` +
					`**${actor.displayName.toUpperCase()}'S TURN:**`,
				followUps: [
					{ key: "pat_head", label: "🌸 Stroke Hair Tenderly", style: ButtonStyle.Primary },
					{ key: "whisper", label: "💕 Whisper 'I've got you'", style: ButtonStyle.Success },
				],
			},
			shoulder: {
				narrative: (actor, target) =>
					`💗 **Pure Comfort...**\n\n` +
					`${target} gently rests their cheek against ${actor}'s shoulder, letting out a soft sigh of utter safety.\n\n` +
					`**${actor.displayName.toUpperCase()}'S TURN:**`,
				followUps: [
					{ key: "pat_head", label: "🌸 Kiss Top of Head", style: ButtonStyle.Primary },
					{ key: "whisper", label: "💕 'Always here for you'", style: ButtonStyle.Success },
				],
			},
			spin: {
				narrative: (actor, target) =>
					`✨ **Giggles & Joy!**\n\n` +
					`${target} bursts into laughter as they sway and spin together across the polished manor floor.\n\n` +
					`**${actor.displayName.toUpperCase()}'S TURN:**`,
				followUps: [
					{ key: "pat_head", label: "🥰 Laugh Together", style: ButtonStyle.Primary },
				],
			},
			pat: {
				narrative: (actor, target) =>
					`🥰 **Sweet & Gentle...**\n\n` +
					`${target} softly pats ${actor}'s back, smiling gratefully for the timely comfort.\n\n` +
					`**${actor.displayName.toUpperCase()}'S TURN:**`,
				followUps: [
					{ key: "whisper", label: "💕 Smile Warmly", style: ButtonStyle.Primary },
				],
			},
		},
		finalText: (actor, target) =>
			`🌸 **Connected at Heart**\n\n` +
			`${actor} and ${target} slowly pull back with bright eyes and comforted hearts. Nothing beats family affection at Jwett Estates. ♡`,
	},

	cuddle: {
		name: "cuddle",
		category: "AFFECTION",
		color: COLORS.AFFECTION,
		banner: "🧸 Cozy Cuddle Time",
		subTitle: "Jwett Estates • Affection Moments",
		starterText: (actor, target) =>
			`*${actor} sits down on the plush velvet lounge, pulling a fluffy cable-knit throw blanket over both of them and welcoming ${target} into a warm cuddle.*\n\n` +
			`*"Come here, you. Time to unwind."*\n\n` +
			`**${target.displayName.toUpperCase()}'S TURN • Choose your response:**`,
		targetOptions: [
			{ key: "nuzzle", label: "🧸 Nuzzle Close", style: ButtonStyle.Primary },
			{ key: "drift", label: "💤 Drift Off to Sleep", style: ButtonStyle.Secondary },
			{ key: "cocoa", label: "☕ Sip Hot Cocoa", style: ButtonStyle.Success },
		],
		responses: {
			nuzzle: {
				narrative: (actor, target) =>
					`🧸 **Snuggled Right In...**\n\n` +
					`${target} curls up against ${actor}, completely content under the soft blanket.\n\n` +
					`**${actor.displayName.toUpperCase()}'S TURN:**`,
				followUps: [
					{ key: "blanket", label: "🧣 Tuck Blanket Snug", style: ButtonStyle.Primary },
					{ key: "hair", label: "💕 Gently Stroke Hair", style: ButtonStyle.Success },
				],
			},
			drift: {
				narrative: (actor, target) =>
					`💤 **Peaceful Slumber...**\n\n` +
					`Lulled by ${actor}'s steady heartbeat, ${target}'s eyelids droop until they drift off peacefully.\n\n` +
					`**${actor.displayName.toUpperCase()}'S TURN:**`,
				followUps: [
					{ key: "blanket", label: "🤫 Keep Perfectly Still", style: ButtonStyle.Primary },
				],
			},
			cocoa: {
				narrative: (actor, target) =>
					`☕ **Warm Cocoa & Sweet Talks...**\n\n` +
					`Sharing a steaming mug of hot chocolate with mini marshmallows while cuddled side-by-side.\n\n` +
					`**${actor.displayName.toUpperCase()}'S TURN:**`,
				followUps: [
					{ key: "hair", label: "🍰 Offer a Marshmallow", style: ButtonStyle.Primary },
				],
			},
		},
		finalText: (actor, target) =>
			`✨ **Moments Like This**\n\n` +
			`Surrounded by warmth and soft blankets, ${actor} and ${target} share an unforgettable, cozy afternoon. ♡`,
	},

	kissforehead: {
		name: "kissforehead",
		category: "AFFECTION",
		color: COLORS.AFFECTION,
		banner: "🌸 Tender Forehead Kiss",
		subTitle: "Jwett Estates • Affection Moments",
		starterText: (actor, target) =>
			`*${actor} gently cups ${target}'s cheek with a soft, affectionate hand, tilting their head up slightly before pressing the sweetest, most protective kiss to their forehead.*\n\n` +
			`*"You are so deeply precious to me."* 🥺💕\n\n` +
			`**${target.displayName.toUpperCase()}'S TURN:**`,
		targetOptions: [
			{ key: "blush", label: "🥺 Soft Blushing Smile", style: ButtonStyle.Primary },
			{ key: "kiss_cheek", label: "💕 Kiss Cheek in Return", style: ButtonStyle.Success },
			{ key: "hug_waist", label: "🥰 Hug Waist Tight", style: ButtonStyle.Secondary },
		],
		responses: {
			blush: {
				narrative: (actor, target) =>
					`🥺 **A Warm Rosy Glow...**\n\n` +
					`${target}'s cheeks flush with soft pink as their heart swells with happiness.\n\n` +
					`**${actor.displayName.toUpperCase()}'S TURN:**`,
				followUps: [{ key: "hold", label: "💗 Pull into Gentle Hug", style: ButtonStyle.Primary }],
			},
			kiss_cheek: {
				narrative: (actor, target) =>
					`💕 **Sweet Reciprocation...**\n\n` +
					`${target} reaches up on tiptoes and places a loving kiss right on ${actor}'s cheek!\n\n` +
					`**${actor.displayName.toUpperCase()}'S TURN:**`,
				followUps: [{ key: "hold", label: "😊 Smile from Ear to Ear", style: ButtonStyle.Primary }],
			},
			hug_waist: {
				narrative: (actor, target) =>
					`🥰 **Never Letting Go...**\n\n` +
					`${target} wraps both arms securely around ${actor}'s waist, resting their forehead right against their chest.\n\n` +
					`**${actor.displayName.toUpperCase()}'S TURN:**`,
				followUps: [{ key: "hold", label: "🌸 Rest Chin on Top of Head", style: ButtonStyle.Primary }],
			},
		},
		finalText: (actor, target) =>
			`🎀 **Cherished Forever**\n\n` +
			`A simple kiss on the forehead holds ten thousand unspoken words of care and devotion. Jwett Estates stands a little warmer today. ♡`,
	},

	comfort: {
		name: "comfort",
		category: "COMFORT",
		color: COLORS.COMFORT,
		banner: "💧 Safe in My Arms",
		subTitle: "Jwett Estates • Emotional Support",
		starterText: (actor, target) =>
			`*Noticing the quiet heaviness in ${target}'s posture, ${actor} sits right beside them, offering a soothing presence and an open, understanding heart.*\n\n` +
			`*"Whatever is weighing on your mind, you do not have to carry it alone in this house. I'm right here."* 🫂💙\n\n` +
			`**${target.displayName.toUpperCase()}'S TURN:**`,
		targetOptions: [
			{ key: "lean", label: "🫂 Lean on Shoulder", style: ButtonStyle.Primary },
			{ key: "tears", label: "💧 Let Tears Fall", style: ButtonStyle.Secondary },
			{ key: "thanks", label: "💕 Whisper 'Thank You'", style: ButtonStyle.Success },
		],
		responses: {
			lean: {
				narrative: (actor, target) =>
					`🫂 **Leaning on Family...**\n\n` +
					`${target} leans their head against ${actor}'s sturdy shoulder, taking the first deep, relaxed breath all day.\n\n` +
					`**${actor.displayName.toUpperCase()}'S TURN:**`,
				followUps: [
					{ key: "rub_back", label: "🌸 Rub Back Soothingly", style: ButtonStyle.Primary },
					{ key: "tea", label: "🫖 Fetch Chamomile Tea", style: ButtonStyle.Success },
				],
			},
			tears: {
				narrative: (actor, target) =>
					`💧 **Releasing the Weight...**\n\n` +
					`A few quiet tears slip past ${target}'s lashes, no longer needing to stay strong alone.\n\n` +
					`**${actor.displayName.toUpperCase()}'S TURN:**`,
				followUps: [
					{ key: "wipe_tears", label: "🤍 Gently Wipe Tears Away", style: ButtonStyle.Primary },
					{ key: "rub_back", label: "🫂 Hold Them Securely", style: ButtonStyle.Success },
				],
			},
			thanks: {
				narrative: (actor, target) =>
					`💕 **A Relieved Whisper...**\n\n` +
					`${target} squeezes ${actor}'s hand gently, grateful beyond measure for someone who truly cares.\n\n` +
					`**${actor.displayName.toUpperCase()}'S TURN:**`,
				followUps: [{ key: "rub_back", label: "🌸 'Always for you, dear'", style: ButtonStyle.Primary }],
			},
		},
		finalText: (actor, target) =>
			`🕊️ **Peace Restored**\n\n` +
			`Storms may come and go outside, but inside Jwett Estates, comfort and grace always welcome you home. ♡`,
	},

	soothe: {
		name: "soothe",
		category: "MOMMY_BABY",
		color: COLORS.MOMMY_BABY,
		banner: "🍼 Hush, Little One",
		subTitle: "Jwett Estates • Parenting & Care",
		starterText: (actor, target, profile) => {
			const item = profile?.comfortItem || "little satin blanket";
			return (
				`*${actor} gently gathers ${target} into their lap, rocking gently back and forth while offering their ${item}.*\n\n` +
				`*"Hush now, sweetheart. Big breaths. You are safe in my arms, and nothing can hurt you."* 🌸👶\n\n` +
				`**${target.displayName.toUpperCase()}'S TURN:**`
			);
		},
		targetOptions: [
			{ key: "calm", label: "🥺 Calm Down & Coo", style: ButtonStyle.Primary },
			{ key: "cling", label: "🫂 Cling to Shirt", style: ButtonStyle.Success },
			{ key: "sigh", label: "💧 Sniffle & Soft Sigh", style: ButtonStyle.Secondary },
		],
		responses: {
			calm: {
				narrative: (actor, target) =>
					`🥺 **Calm & Settled...**\n\n` +
					`${target} relaxes their tiny hands, gazing up at ${actor} with big, trustful eyes.\n\n` +
					`**${actor.displayName.toUpperCase()}'S TURN:**`,
				followUps: [{ key: "hum", label: "🎶 Hum a Gentle Tune", style: ButtonStyle.Primary }],
			},
			cling: {
				narrative: (actor, target) =>
					`🫂 **Holding Tight...**\n\n` +
					`${target} clutches the fabric of ${actor}'s clothes, nestling right under their chin.\n\n` +
					`**${actor.displayName.toUpperCase()}'S TURN:**`,
				followUps: [{ key: "hum", label: "🌸 Rock Gently in the Glider", style: ButtonStyle.Primary }],
			},
			sigh: {
				narrative: (actor, target) =>
					`💧 **The Tears Disappear...**\n\n` +
					`With one last little sniffle, ${target} rests peacefully, the fussiness melting away.\n\n` +
					`**${actor.displayName.toUpperCase()}'S TURN:**`,
				followUps: [{ key: "hum", label: "🍼 Offer Warm Bottle/Drink", style: ButtonStyle.Primary }],
			},
		},
		finalText: (actor, target) =>
			`🌸 **Sweet Tranquility**\n\n` +
			`${actor} kisses the top of ${target}'s head as calm returns to the estate nursery. Beautiful parenting moments make a family whole. ♡`,
	},

	storytime: {
		name: "storytime",
		category: "BEDTIME",
		color: COLORS.BEDTIME,
		banner: "📖 Manor Story Hour",
		subTitle: "Jwett Estates • Bedtime Moments",
		starterText: (actor, target) =>
			`*${actor} pulls a gilded storybook from the library shelf and sits beside ${target}, opening to a world of castles, enchanted gardens, and brave heroes.*\n\n` +
			`*"Once upon a time, in a grand estate tucked beyond the whispering pines..."*\n\n` +
			`**${target.displayName.toUpperCase()}'S TURN:**`,
		targetOptions: [
			{ key: "turn_page", label: "📖 Turn the Page", style: ButtonStyle.Primary },
			{ key: "ask_next", label: "✨ 'What happens next?!'", style: ButtonStyle.Success },
			{ key: "point", label: "🐉 Point at the Illustration", style: ButtonStyle.Secondary },
		],
		responses: {
			turn_page: {
				narrative: (actor, target) =>
					`📖 **The Adventure Unfolds...**\n\n` +
					`${target} excitedly turns to the glossy color plate showing the sparkling ballroom of the manor!\n\n` +
					`**${actor.displayName.toUpperCase()}'S TURN:**`,
				followUps: [{ key: "voice", label: "👑 Do Funny Character Voices", style: ButtonStyle.Primary }],
			},
			ask_next: {
				narrative: (actor, target) =>
					`✨ **Eager Anticipation!**\n\n` +
					`${target} leans in with wide sparkling eyes, hanging onto every single word.\n\n` +
					`**${actor.displayName.toUpperCase()}'S TURN:**`,
				followUps: [{ key: "voice", label: "🏰 Dramatic Plot Twist!", style: ButtonStyle.Primary }],
			},
			point: {
				narrative: (actor, target) =>
					`🐉 **Spotting the Details!**\n\n` +
					`${target} points to the friendly friendly dragon napping on the roof of the illustrated castle!\n\n` +
					`**${actor.displayName.toUpperCase()}'S TURN:**`,
				followUps: [{ key: "voice", label: "🥰 'Look, it has your smile!'", style: ButtonStyle.Primary }],
			},
		},
		finalText: (actor, target) =>
			`⭐ **Happily Ever After**\n\n` +
			`${actor} closes the book with a flourish. *"And they lived with more love than any kingdom could hold."* A classic Jwett Estates bedtime tradition. ♡`,
	},

	familydinner: {
		name: "familydinner",
		category: "FAMILY_LIFE",
		color: COLORS.FAMILY_LIFE,
		banner: "🍽️ The Grand Family Feast",
		subTitle: "Jwett Estates • Family Life",
		starterText: (actor) =>
			`*${actor} rings the silver dining chime! The mahogany dining table is adorned with roasted delights, buttered rolls, fresh salads, and sparkling carafes.*\n\n` +
			`*"Dinner is served, my wonderful family! Everyone take your seats and let's feast together!"* 🥂✨\n\n` +
			`**FAMILY'S TURN • Anyone may take a seat and participate:**`,
		targetOptions: [
			{ key: "pass_rolls", label: "🥖 Pass the Warm Rolls", style: ButtonStyle.Primary },
			{ key: "toast", label: "🥂 Give a Family Toast", style: ButtonStyle.Success },
			{ key: "dessert", label: "🍰 Ask About Dessert", style: ButtonStyle.Secondary },
			{ key: "day", label: "💬 Share High of the Day", style: ButtonStyle.Secondary },
		],
		responses: {
			pass_rolls: {
				narrative: (actor, target) =>
					`🥖 **Warm Buttered Rolls!**\n\n` +
					`${target} passes the bread basket across the table with a huge smile. Delicious aromas fill the dining hall!\n\n` +
					`**${actor.displayName.toUpperCase()}'S TURN:**`,
				followUps: [{ key: "eat", label: "🍽️ 'Dig in, everyone!'", style: ButtonStyle.Primary }],
			},
			toast: {
				narrative: (actor, target) =>
					`🥂 **A Loving Toast!**\n\n` +
					`${target} raises their goblet: *"To Jwett Estates, and to the best family in the world!"*\n\n` +
					`**${actor.displayName.toUpperCase()}'S TURN:**`,
				followUps: [{ key: "eat", label: "🎉 Clink Glasses in Unison", style: ButtonStyle.Primary }],
			},
			dessert: {
				narrative: (actor, target) =>
					`🍰 **Saving Room for Sweets!**\n\n` +
					`${target} grins playfully: *"I heard the maid made double-fudge lava cake for dessert tonight!"*\n\n` +
					`**${actor.displayName.toUpperCase()}'S TURN:**`,
				followUps: [{ key: "eat", label: "😋 'Only if you finish your vegetables!'", style: ButtonStyle.Primary }],
			},
			day: {
				narrative: (actor, target) =>
					`💬 **Heartfelt Table Talks...**\n\n` +
					`${target} shares the best part of their day, sparking laughter and warm stories all around the table.\n\n` +
					`**${actor.displayName.toUpperCase()}'S TURN:**`,
				followUps: [{ key: "eat", label: "💕 'I love our dinners together'", style: ButtonStyle.Primary }],
			},
		},
		finalText: (actor) =>
			`🍷 **Full Stomachs & Happy Hearts**\n\n` +
			`Plates cleared, laughter shared, and memories made. Another rich, cozy family dinner in the books at Jwett Estates! ♡`,
	},

	cook: {
		name: "cook",
		category: "FAMILY_LIFE",
		color: COLORS.FAMILY_LIFE,
		banner: "👩‍🍳 Cooking in the Manor Kitchen",
		subTitle: "Jwett Estates • Family Life",
		starterText: (actor, target) =>
			`*${actor} ties on a floral apron and invites ${target} into the warm manor kitchen, where savory aromas and sweet baking vanilla fill the air.*\n\n` +
			`*"Grab an apron! Let's make something incredible together."* 🍳✨\n\n` +
			`**${target.displayName.toUpperCase()}'S TURN:**`,
		targetOptions: [
			{ key: "taste", label: "🥄 Taste Test with Spoon", style: ButtonStyle.Primary },
			{ key: "stir", label: "✨ Help Stir the Pot", style: ButtonStyle.Success },
			{ key: "cookie", label: "🍪 Sneak a Warm Cookie", style: ButtonStyle.Secondary },
		],
		responses: {
			taste: {
				narrative: (actor, target) =>
					`🥄 **The Master Taster!**\n\n` +
					`${target} blows on the wooden spoon and takes a taste: *"Mmm! Just needs a tiny pinch more seasoning!"*\n\n` +
					`**${actor.displayName.toUpperCase()}'S TURN:**`,
				followUps: [{ key: "finish", label: "🧂 Add the Secret Spice", style: ButtonStyle.Primary }],
			},
			stir: {
				narrative: (actor, target) =>
					`✨ **Kitchen Teamwork!**\n\n` +
					`${target} diligently stirs the simmering sauce, giggling as flour gets dusted onto their nose.\n\n` +
					`**${actor.displayName.toUpperCase()}'S TURN:**`,
				followUps: [{ key: "finish", label: "👩‍🍳 'Chef status unlocked!'", style: ButtonStyle.Primary }],
			},
			cookie: {
				narrative: (actor, target) =>
					`🍪 **Caught in the Act!**\n\n` +
					`${target} stealthily snatches a chocolate chip cookie right off the cooling rack with a mischievous grin!\n\n` +
					`**${actor.displayName.toUpperCase()}'S TURN:**`,
				followUps: [{ key: "finish", label: "😜 Pretend Not to Notice", style: ButtonStyle.Primary }],
			},
		},
		finalText: (actor, target) =>
			`🍲 **Masterpiece Created**\n\n` +
			`The meal turns out heavenly. Nothing tastes sweeter than food made with family love in the Jwett Estates kitchen. ♡`,
	},

	celebrate: {
		name: "celebrate",
		category: "SPECIAL",
		color: COLORS.SPECIAL,
		banner: "🎉 Manor Celebration!",
		subTitle: "Jwett Estates • Special Moments",
		starterText: (actor, target) =>
			`*${actor} pops open sparkling manor cider as golden streamers and confetti burst across the hall in honor of ${target}!*\n\n` +
			`*"Everyone raise your glasses! Today we celebrate an extraordinary person who deserves all the world's joy!"* 🥳🥂✨\n\n` +
			`**${target.displayName.toUpperCase()}'S TURN:**`,
		targetOptions: [
			{ key: "cheer", label: "🙌 Cheer Loudly!", style: ButtonStyle.Primary },
			{ key: "dance", label: "💃 Victory Dance", style: ButtonStyle.Success },
			{ key: "hug", label: "🫂 Emotional Group Hug", style: ButtonStyle.Secondary },
		],
		responses: {
			cheer: {
				narrative: (actor, target) =>
					`🙌 **Cheers All Around!**\n\n` +
					`${target} raises both hands with the brightest smile! The whole estate erupts in applause!\n\n` +
					`**${actor.displayName.toUpperCase()}'S TURN:**`,
				followUps: [{ key: "trophy", label: "🏆 Present Golden Ribbon", style: ButtonStyle.Primary }],
			},
			dance: {
				narrative: (actor, target) =>
					`💃 **Dancing in the Parlour!**\n\n` +
					`${target} spins across the floor in a happy victory dance, inviting everyone to join in!\n\n` +
					`**${actor.displayName.toUpperCase()}'S TURN:**`,
				followUps: [{ key: "trophy", label: "🎶 Crank Up the Music", style: ButtonStyle.Primary }],
			},
			hug: {
				narrative: (actor, target) =>
					`🫂 **So Much Love!**\n\n` +
					`${target} pulls ${actor} into a huge, beaming hug, overwhelmed by the thoughtful surprise!\n\n` +
					`**${actor.displayName.toUpperCase()}'S TURN:**`,
				followUps: [{ key: "trophy", label: "💕 'We are so proud of you!'", style: ButtonStyle.Primary }],
			},
		},
		finalText: (actor, target) =>
			`🌟 **An Unforgettable Milestone**\n\n` +
			`Gold confetti still drifts down like glitter. A memory forever etched in the annals of Jwett Estates. ♡`,
	},
};

// ── Generic Fallback for Quick Affection Commands ───────────────────────────
const GENERIC_MOMENTS = {
	kiss: {
		title: "💋 Gentle Kiss",
		color: COLORS.AFFECTION,
		text: (a, t) => `*${a} leans in tenderly and places a sweet, loving kiss on ${t}'s cheek, making their world feel peaceful and bright.* 💖`,
		button: "💋 Kiss Cheek Back",
		reply: (a, t) => `*${t} blushes and places a sweet kiss right back onto ${a}'s cheek with a joyful smile!* 🥺💕`,
	},
	holdhands: {
		title: "🤝 Holding Hands",
		color: COLORS.AFFECTION,
		text: (a, t) => `*${a} gently reaches out, fingers softly intertwining with ${t}'s as they walk side-by-side through the serene estate gardens.* 🌸`,
		button: "🤝 Squeeze Hand Tight",
		reply: (a, t) => `*${t} interlocks their fingers securely, giving ${a}'s hand an affectionate squeeze.* 💖`,
	},
	carry: {
		title: "🧸 Swept into Arms",
		color: COLORS.AFFECTION,
		text: (a, t) => `*${a} playfully scoops ${t} up into their arms! ${t} gasps with a giggle as they are carried comfortably toward the lounge.* ✨`,
		button: "🧸 Wrap Arms Around Neck",
		reply: (a, t) => `*${t} wraps their arms safely around ${a}'s neck, resting their head on their shoulder with a happy grin.* 🥰`,
	},
	rock: {
		title: "🧸 Rocking in the Glider",
		color: COLORS.MOMMY_BABY,
		text: (a, t) => `*${a} sits in the carved oak glider chair with ${t} cradled in their arms, gently swaying to the rhythm of a serene manor afternoon.* 🍼`,
		button: "😴 Snuggle into Sleep",
		reply: (a, t) => `*${t}'s eyelids grow heavy as they curl up peacefully, completely soothed by the rhythmic rocking.* 💤`,
	},
	feed: {
		title: "🥄 Sweet Treats & Feeding",
		color: COLORS.MOMMY_BABY,
		text: (a, t) => `*${a} lovingly prepares a fresh treat for ${t}, holding up a delicious bite with patient, caring eyes.* 🍰✨`,
		button: "😋 Yummy Bite!",
		reply: (a, t) => `*${t} takes a happy bite with a messy, satisfied smile: "So delicious!"* 🌸`,
	},
	bathtime: {
		title: "🛁 Warm Bubble Bath",
		color: COLORS.MOMMY_BABY,
		text: (a, t) => `*${a} fills the clawfoot tub with fragrant lavender suds and warm water, wrapping ${t} in a fluffy heated towel right after.* 🫧`,
		button: "🦆 Splash Bubbles Playfully",
		reply: (a, t) => `*${t} giggles and makes a bubble crown! Pure childhood innocence at Jwett Estates.* 🧼✨`,
	},
	brushhair: {
		title: "🎀 Brushing Hair & Ribbons",
		color: COLORS.MOMMY_BABY,
		text: (a, t) => `*${a} sits behind ${t} with a silver bristle brush, carefully detangling silky locks and tying a beautiful satin ribbon.* 🌸`,
		button: "🎀 Admire in Mirror",
		reply: (a, t) => `*${t} touches their ribbon and smiles in the mirror: "I look like royalty!"* 🥺💕`,
	},
	goodnight: {
		title: "🌙 Goodnight, Sweet Heart",
		color: COLORS.BEDTIME,
		text: (a, t) => `*${a} blows out the corridor candle and waves softly to ${t}. "Rest well tonight. Morning will bring new adventures."* 🕯️`,
		button: "💫 Sweet Dreams!",
		reply: (a, t) => `*${t} waves sleepily from beneath the covers: "Sweet dreams, see you tomorrow!"* 😴💖`,
	},
	lullaby: {
		title: "🎶 Sweet Manor Lullaby",
		color: COLORS.BEDTIME,
		text: (a, t) => `*${a} softly hums an ancient, peaceful melody passed down through the family. The room is blanketed in serene harmony.* 🌙`,
		button: "💤 Drift into Dreams",
		reply: (a, t) => `*${t}'s breathing syncs with the melody as they drift into dreams of golden sunrises.* 🌸`,
	},
	nightmare: {
		title: "🛡️ Chasing the Bad Dreams Away",
		color: COLORS.BEDTIME,
		text: (a, t) => `*Hearing a quiet whimper, ${a} quickly rushes to ${t}'s side, wrapping them in an impenetrable cocoon of love.* 🕯️\n\n*"I am right here. The shadow monsters have no power in this house."*`,
		button: "🫂 Hold Hand Tight",
		reply: (a, t) => `*${t} squeezes tight until the shivering stops. Safe at last in loving hands.* 🥺💙`,
	},
	wake: {
		title: "☀️ Morning Sunshine Wakeup",
		color: COLORS.FAMILY_LIFE,
		text: (a, t) => `*${a} gently draws back the velvet drapes, letting golden morning light pour across ${t}'s bed alongside the aroma of fresh pancakes.* 🥞✨`,
		button: "🥱 Stretch & Wake Up",
		reply: (a, t) => `*${t} rubs their eyes with a sleepy smile: "Good morning! Are the pancakes ready?!"* 😋☀️`,
	},
	homework: {
		title: "📚 Manor Study Session",
		color: COLORS.FAMILY_LIFE,
		text: (a, t) => `*${a} pulls up a mahogany chair beside ${t} in the library, bringing a tray of berry juice and sharpened pencils to conquer today's lessons.* ✏️`,
		button: "⭐ Show Finished Homework",
		reply: (a, t) => `*${t} hands over the notebook with pride! ${a} draws a big gold star right at the top.* 🌟`,
	},
	knock: {
		title: "🚪 Knock, Knock!",
		color: COLORS.FAMILY_LIFE,
		text: (a, t) => `*A polite double-tap on the door. ${a} stands outside with a warm smile: "May I come in for a visit?"* 🌸`,
		button: "🚪 'Come on in!'",
		reply: (a, t) => `*${t} swings the door open with a beaming smile: "I was hoping you'd stop by!"* 🥰`,
	},
	visit: {
		title: "🛋️ A Cozy Room Visit",
		color: COLORS.FAMILY_LIFE,
		text: (a, t) => `*${a} drops by ${t}'s chambers with a box of freshly baked pastries and settles into the armchair for some quality family time.* 🍰`,
		button: "🍵 Pour Two Teas",
		reply: (a, t) => `*${t} pours hot tea as they dive into heartwarming conversation for hours on end.* 🫖💕`,
	},
	cry: {
		title: "💧 Leaning on Family",
		color: COLORS.COMFORT,
		text: (a) => `*${a} sits quietly by the bay window, a lone tear tracing down their cheek. Sometimes even the strongest family members need a moment.* 🥺🌧️`,
		button: "🫂 Offer a Comforting Hug",
		reply: (a, t) => `*${t} gently wraps both arms around ${a}: "You never have to cry alone. We've got you."* 💙`,
	},
	apologize: {
		title: "🕊️ Sincere Apology",
		color: COLORS.COMFORT,
		text: (a, t) => `*${a} approaches ${t} with genuine, humble eyes: "I am truly sorry. Our bond matters more to me than anything. Can we start fresh?"* 🥺`,
		button: "🫂 'Of Course, I Forgive You'",
		reply: (a, t) => `*${t} pulls ${a} into a forgiving embrace: "Always. Family comes first."* 🌸💕`,
	},
	reassure: {
		title: "🌟 Words of Affirmation",
		color: COLORS.COMFORT,
		text: (a, t) => `*${a} looks ${t} right in the eye with unwavering belief: "You are stronger, kinder, and more capable than you know. Never doubt yourself."* 👑✨`,
		button: "🥺 Thank You from the Heart",
		reply: (a, t) => `*${t}'s posture straightens and a genuine smile returns: "I needed to hear that more than you know."* 💖`,
	},
	checkon: {
		title: "💌 Just Checking In",
		color: COLORS.COMFORT,
		text: (a, t) => `*${a} sends a quiet knock and brings a warm drink to ${t}: "Just making sure your heart is doing well today."* 🍵`,
		button: "😊 'Doing Great Now!'",
		reply: (a, t) => `*${t} smiles warmly: "Seeing you made my whole day brighter."* 🌸`,
	},
	spa: {
		title: "🧖 Manor Spa Afternoon",
		color: COLORS.ESTATE,
		text: (a, t) => `*${a} prepares the private estate bathhouse for ${t} with eucalyptus steam, warm stone therapy, and fresh herbal masks.* 🌿✨`,
		button: "🫧 Relax Completely",
		reply: (a, t) => `*${t} sinks into the heated mineral bath with cucumber slices over their eyes: "Pure heaven."* 💆‍♀️`,
	},
	shopping: {
		title: "🛍️ Estate Boutique Spree",
		color: COLORS.ESTATE,
		text: (a, t) => `*${a} and ${t} head out to the premier designer shops in the estate town car, ready for a day of style and retail fun!* 👗✨`,
		button: "👠 Try on Fabulous Outfit",
		reply: (a, t) => `*${t} twirls out of the dressing room: "What do you think?!" ${a} gives a standing ovation.* 👏💖`,
	},
	familyouting: {
		title: "🚗 Estate Family Outing",
		color: COLORS.ESTATE,
		text: (a) => `*${a} packs a gourmet wicker picnic hamper and starts the engine: "Who's ready for a scenic family outing to the lake?!"* 🧺🌳`,
		button: "🧺 Spread Out the Quilt!",
		reply: (a, t) => `*${t} lays out the checkered blanket in the sunshine: "Best family day ever!"* ☀️🎉`,
	},
	movie: {
		title: "🍿 Cinema Room Screening",
		color: COLORS.ESTATE,
		text: (a, t) => `*${a} dims the lights in the private manor theatre, passing a giant tub of warm buttered popcorn to ${t} as the projector rolls.* 🎬✨`,
		button: "🍿 Grab a Huge Handful",
		reply: (a, t) => `*${t} takes a big handful of popcorn and curls up under the fleece throw as the intro music swells.* 🥤🛋️`,
	},
	surprise: {
		title: "🎊 Surprise!",
		color: COLORS.SPECIAL,
		text: (a, t) => `*${a} hides a beautifully wrapped box behind their back with a mischievous grin before presenting it to ${t}: "Surprise!"* 🎁✨`,
		button: "🎉 Tear Open the Ribbon!",
		reply: (a, t) => `*${t} gasps in pure delight as the silk ribbon falls away: "Oh my gosh, you didn't have to!"* 😭💕`,
	},
	gift: {
		title: "🎁 A Gift from the Heart",
		color: COLORS.SPECIAL,
		text: (a, t) => `*${a} hands ${t} a bespoke gift wrapped in ivory paper and gold foil: "I saw this and could only think of you."* 🎀`,
		button: "🥺 'I Love It So Much!'",
		reply: (a, t) => `*${t} cradles the thoughtful present, hugging ${a} with heartfelt appreciation.* 🥰✨`,
	},
	birthday: {
		title: "🎂 Birthday Wishes at the Manor",
		color: COLORS.SPECIAL,
		text: (a, t) => `*${a} carries in a three-tiered velvet cake glowing with golden candles for ${t}! "Happy Birthday, beautiful soul!"* 🍰👑🎉`,
		button: "🕯️ Make a Secret Wish!",
		reply: (a, t) => `*${t} closes their eyes, makes a wish, and blows out the candles amidst cheers and clinking glasses!* 🥳🥂`,
	},
	proudofyou: {
		title: "⭐ So Immensely Proud of You",
		color: COLORS.SPECIAL,
		text: (a, t) => `*${a} places both hands on ${t}'s shoulders, eyes brimming with pure respect and adoration: "I want you to know how proud I am of the person you are."* 🥺💖`,
		button: "🫂 Cling in an Emotional Hug",
		reply: (a, t) => `*${t} buries their face in ${a}'s shoulder, emotional tears of joy in their eyes: "Thank you for always believing in me."* 🌟`,
	},
};

// ── Slash Command Builders for Jwett Moments ────────────────────────────────
function buildJwettMomentSlashCommands() {
	const commands = [];

	// /rp suite
	const rpCmd = new SlashCommandBuilder()
		.setName("rp")
		.setDescription("Jwett Estates family roleplay system.")
		.addSubcommand((sub) =>
			sub
				.setName("profile")
				.setDescription("View a member's family roleplay profile.")
				.addUserOption((opt) => opt.setName("user").setDescription("User profile to view."))
		)
		.addSubcommand((sub) =>
			sub
				.setName("setup")
				.setDescription("Set up your own family RP profile.")
				.addStringOption((opt) =>
					opt
						.setName("role")
						.setDescription("Your family role (e.g. Mother, Daughter, Son, Auntie, Baby).")
						.setRequired(false)
				)
				.addStringOption((opt) =>
					opt
						.setName("mood")
						.setDescription("Your current RP mood (e.g. Sleepy 😴, Playful 🎈, Cozy 🍵, Spoiled 🍼).")
						.setRequired(false)
				)
				.addStringOption((opt) =>
					opt
						.setName("comfort_item")
						.setDescription("Your favorite comfort item (e.g. Teddy Bear 🐻, Silk Blanket 🎀).")
						.setRequired(false)
				)
				.addStringOption((opt) =>
					opt
						.setName("pronouns")
						.setDescription("Your character's pronouns.")
						.setRequired(false)
				)
				.addStringOption((opt) =>
					opt
						.setName("character_age")
						.setDescription("Your character's age or stage (e.g. Baby, Toddler, Teen, Adult).")
						.setRequired(false)
				)
				.addStringOption((opt) =>
					opt
						.setName("bio")
						.setDescription("A short description of your character.")
						.setRequired(false)
				)
		)
		.addSubcommand((sub) =>
			sub
				.setName("relationship")
				.setDescription("Define a family bond with another member.")
				.addStringOption((opt) =>
					opt
						.setName("action")
						.setDescription("Set or remove relationship.")
						.setRequired(true)
						.addChoices(
							{ name: "Set Relationship", value: "set" },
							{ name: "Remove Relationship", value: "remove" }
						)
				)
				.addUserOption((opt) =>
					opt.setName("target").setDescription("The family member.").setRequired(true)
				)
				.addStringOption((opt) =>
					opt
						.setName("relation")
						.setDescription("What are you to them? (e.g. Mother, Father, Daughter, Son, Sister, Brother, Auntie).")
						.setRequired(false)
				)
		)
		.addSubcommand((sub) =>
			sub
				.setName("family")
				.setDescription("View family connections and relationships.")
				.addUserOption((opt) => opt.setName("user").setDescription("View connections for this user."))
		)
		.addSubcommand((sub) =>
			sub
				.setName("memories")
				.setDescription("Browse the Jwett Estates family memory album.")
				.addUserOption((opt) => opt.setName("user").setDescription("Filter memories by user."))
		);
	commands.push(rpCmd.toJSON());

	// Complex moment commands
	for (const [key, def] of Object.entries(MOMENT_DEFINITIONS)) {
		const b = new SlashCommandBuilder()
			.setName(key)
			.setDescription(`${def.subTitle} — ${def.banner}`);

		if (key !== "familydinner") {
			b.addUserOption((opt) =>
				opt.setName("target").setDescription("The family member to share this moment with.").setRequired(true)
			);
		}
		b.addStringOption((opt) =>
			opt
				.setName("style")
				.setDescription("Style of the moment.")
				.setRequired(false)
				.addChoices(
					{ name: "Sweet & Tender 🌸", value: "sweet" },
					{ name: "Playful & Giddy 🎈", value: "playful" },
					{ name: "Sleepy & Cozy 😴", value: "sleepy" },
					{ name: "Dramatic & Elegant 👑", value: "dramatic" }
				)
		);
		commands.push(b.toJSON());
	}

	// Generic moments
	for (const [key, def] of Object.entries(GENERIC_MOMENTS)) {
		if (MOMENT_DEFINITIONS[key]) continue; // already defined
		const b = new SlashCommandBuilder()
			.setName(key)
			.setDescription(`Jwett Moments ♡ — ${def.title}`);

		if (key !== "cry" && key !== "familyouting") {
			b.addUserOption((opt) =>
				opt.setName("target").setDescription("The family member to interact with.").setRequired(true)
			);
		}
		b.addStringOption((opt) =>
			opt
				.setName("style")
				.setDescription("Style of the moment.")
				.setRequired(false)
				.addChoices(
					{ name: "Sweet & Tender 🌸", value: "sweet" },
					{ name: "Playful & Giddy 🎈", value: "playful" },
					{ name: "Sleepy & Cozy 😴", value: "sleepy" }
				)
		);
		commands.push(b.toJSON());
	}

	return commands;
}

// ── Slash Command Execution Handler ─────────────────────────────────────────
async function handleJwettMomentCommand(interaction, guildState, scheduleSave) {
	const command = interaction.commandName;

	// /rp suite
	if (command === "rp") {
		const sub = interaction.options.getSubcommand();

		if (sub === "profile") {
			const targetUser = interaction.options.getUser("user") || interaction.user;
			const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
			const profile = getRpProfile(guildState, targetUser.id);

			// Find relationships
			const rels = [];
			if (guildState.rpRelationships) {
				for (const [key, rel] of Object.entries(guildState.rpRelationships)) {
					const [u1, u2] = key.split(":");
					if (u1 === targetUser.id) {
						rels.push(`**${rel.relationAtoB || "Relative"}** to <@${u2}> (${getClosenessTier(rel.closeness).title})`);
					} else if (u2 === targetUser.id) {
						rels.push(`**${rel.relationBtoA || "Relative"}** to <@${u1}> (${getClosenessTier(rel.closeness).title})`);
					}
				}
			}

			// Find last memory
			let lastMemoryText = "*No memories recorded yet. Start a moment with /tuckin, /hug, or /cuddle!*";
			if (guildState.rpMemories) {
				const mem = guildState.rpMemories.find((m) => m.userIds.includes(targetUser.id));
				if (mem) {
					lastMemoryText = `**${mem.title}**\n${mem.description} (<t:${Math.floor(mem.timestamp / 1000)}:R>)`;
				}
			}

			const embed = new EmbedBuilder()
				.setColor(COLORS.AFFECTION)
				.setTitle(`🎀 ${targetMember?.displayName || targetUser.username}'s Little World`)
				.setDescription(
					`**Jwett Estates • Family RP Profile** ♡\n` +
					(profile.bio ? `*${profile.bio}*\n\n` : "\n") +
					`🏡 **Family Role:** ${profile.familyRole}\n` +
					`💭 **RP Mood:** ${profile.mood}\n` +
					`🧸 **Favorite Comfort Item:** ${profile.comfortItem}\n` +
					`📜 **Stage & Age:** ${profile.characterAge} • Pronouns: ${profile.pronouns}\n` +
					`✨ **Moments Shared:** ${profile.momentsCount} memories\n\n` +
					`**💕 Family Connections:**\n` +
					(rels.length > 0 ? rels.map((r) => `• ${r}`).join("\n") : "• *No established bonds yet. Use `/rp relationship` to link with family!*") +
					`\n\n**📖 Recent Family Memory:**\n${lastMemoryText}`
				)
				.setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
				.setFooter({ text: "Jwett Moments ♡ • Made with love at Jwett Estates" })
				.setTimestamp();

			await interaction.reply({ embeds: [embed] });
			return true;
		}

		if (sub === "setup") {
			const profile = getRpProfile(guildState, interaction.user.id);
			const role = interaction.options.getString("role");
			const mood = interaction.options.getString("mood");
			const comfort = interaction.options.getString("comfort_item");
			const pronouns = interaction.options.getString("pronouns");
			const age = interaction.options.getString("character_age");
			const bio = interaction.options.getString("bio");

			if (role) profile.familyRole = role;
			if (mood) profile.mood = mood;
			if (comfort) profile.comfortItem = comfort;
			if (pronouns) profile.pronouns = pronouns;
			if (age) profile.characterAge = age;
			if (bio) profile.bio = bio;

			scheduleSave();

			const embed = new EmbedBuilder()
				.setColor(COLORS.AFFECTION)
				.setTitle("🌸 Family RP Profile Updated!")
				.setDescription(
					`Your character profile in Jwett Estates has been saved!\n\n` +
					`🏡 **Role:** ${profile.familyRole}\n` +
					`💭 **Mood:** ${profile.mood}\n` +
					`🧸 **Comfort Item:** ${profile.comfortItem}\n` +
					`📜 **Stage:** ${profile.characterAge} (${profile.pronouns})\n\n` +
					`Use \`/rp profile\` anytime to view your complete card.`
				)
				.setFooter({ text: "Jwett Moments ♡ • Profile Saved" });

			await interaction.reply({ embeds: [embed], ephemeral: true });
			return true;
		}

		if (sub === "relationship") {
			const action = interaction.options.getString("action", true);
			const targetUser = interaction.options.getUser("target", true);
			const relation = interaction.options.getString("relation") || "Family";

			if (targetUser.id === interaction.user.id) {
				await interaction.reply({ content: "You cannot form a family relationship with yourself!", ephemeral: true });
				return true;
			}

			if (action === "remove") {
				const existing = getRelationship(guildState, interaction.user.id, targetUser.id);
				if (existing) {
					delete guildState.rpRelationships[existing.key];
					scheduleSave();
					await interaction.reply({
						content: `🕊️ The family bond between <@${interaction.user.id}> and <@${targetUser.id}> has been removed.`,
						ephemeral: true,
					});
				} else {
					await interaction.reply({ content: "No recorded bond existed between you two.", ephemeral: true });
				}
				return true;
			}

			// set
			if (!guildState.rpRelationships) guildState.rpRelationships = {};
			const key = `${interaction.user.id}:${targetUser.id}`;
			guildState.rpRelationships[key] = {
				userA: interaction.user.id,
				userB: targetUser.id,
				relationAtoB: relation,
				relationBtoA: "Family",
				closeness: 5,
				createdAt: Date.now(),
			};
			scheduleSave();

			const embed = new EmbedBuilder()
				.setColor(COLORS.AFFECTION)
				.setTitle("💕 Family Bond Established!")
				.setDescription(
					`<@${interaction.user.id}> is now registered as **${relation}** to <@${targetUser.id}>!\n\n` +
					`As you perform interactive moments together (like \`/tuckin\`, \`/hug\`, \`/cuddle\`), your closeness will grow. ♡`
				)
				.setFooter({ text: "Jwett Moments ♡ • Family Connections" });

			await interaction.reply({ embeds: [embed] });
			return true;
		}

		if (sub === "family") {
			const targetUser = interaction.options.getUser("user") || interaction.user;
			const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

			const bonds = [];
			if (guildState.rpRelationships) {
				for (const [key, rel] of Object.entries(guildState.rpRelationships)) {
					const [u1, u2] = key.split(":");
					if (u1 === targetUser.id) {
						const tier = getClosenessTier(rel.closeness);
						bonds.push(`• **${rel.relationAtoB}** to <@${u2}> — ${tier.title} (${rel.closeness || 0} pts ${tier.stars})`);
					} else if (u2 === targetUser.id) {
						const tier = getClosenessTier(rel.closeness);
						bonds.push(`• **${rel.relationBtoA}** to <@${u1}> — ${tier.title} (${rel.closeness || 0} pts ${tier.stars})`);
					}
				}
			}

			const embed = new EmbedBuilder()
				.setColor(COLORS.FAMILY_LIFE)
				.setTitle(`🏡 ${targetMember?.displayName || targetUser.username}'s Family Tree`)
				.setDescription(
					bonds.length > 0
						? bonds.join("\n\n")
						: "*No family relationships recorded yet. Link up with `/rp relationship set`!*"
				)
				.setFooter({ text: "Jwett Estates • Household Heritage ♡" });

			await interaction.reply({ embeds: [embed] });
			return true;
		}

		if (sub === "memories") {
			const filterUser = interaction.options.getUser("user");
			let mems = guildState.rpMemories || [];
			if (filterUser) {
				mems = mems.filter((m) => m.userIds.includes(filterUser.id));
			}

			if (mems.length === 0) {
				await interaction.reply({
					content: "📖 The Jwett Estates family album is waiting for its first memory! Use `/tuckin`, `/hug`, or `/celebrate` to make one.",
					ephemeral: true,
				});
				return true;
			}

			const list = mems.slice(0, 10).map((m, i) => {
				const time = `<t:${Math.floor(m.timestamp / 1000)}:R>`;
				return `**${i + 1}. ${m.title}** (${time})\n${m.description}`;
			});

			const embed = new EmbedBuilder()
				.setColor(COLORS.SPECIAL)
				.setTitle("📖 Jwett Estates • Family Memory Album ♡")
				.setDescription(list.join("\n\n"))
				.setFooter({ text: `Showing last ${Math.min(10, mems.length)} of ${mems.length} memories` });

			await interaction.reply({ embeds: [embed] });
			return true;
		}
	}

	// Complex moments
	if (MOMENT_DEFINITIONS[command]) {
		const def = MOMENT_DEFINITIONS[command];
		const actor = interaction.member;
		const targetMember = command === "familydinner"
			? null
			: interaction.options.getMember("target");

		if (command !== "familydinner" && !targetMember) {
			await interaction.reply({ content: "Please specify a valid server member for this moment.", ephemeral: true });
			return true;
		}

		const targetProfile = targetMember ? getRpProfile(guildState, targetMember.id) : null;
		const text = def.starterText(actor, targetMember, targetProfile);

		const embed = new EmbedBuilder()
			.setColor(def.color)
			.setTitle(def.banner)
			.setDescription(text)
			.setFooter({ text: `${def.subTitle} • Made with love ♡` })
			.setTimestamp();

		// Buttons for target
		const row = new ActionRowBuilder();
		const targetIdStr = targetMember ? targetMember.id : "all";

		for (const opt of def.targetOptions) {
			row.addComponents(
				new ButtonBuilder()
					.setCustomId(`jm_resp:${command}:${actor.id}:${targetIdStr}:${opt.key}`)
					.setLabel(opt.label)
					.setStyle(opt.style)
			);
		}

		// End scene button
		row.addComponents(
			new ButtonBuilder()
				.setCustomId(`jm_end:${command}:${actor.id}:${targetIdStr}`)
				.setLabel("❌ End Scene")
				.setStyle(ButtonStyle.Secondary)
		);

		await interaction.reply({ embeds: [embed], components: [row] });
		return true;
	}

	// Generic moments
	if (GENERIC_MOMENTS[command]) {
		const def = GENERIC_MOMENTS[command];
		const actor = interaction.member;
		const targetMember = (command === "cry" || command === "familyouting")
			? null
			: interaction.options.getMember("target");

		const text = targetMember ? def.text(actor, targetMember) : def.text(actor);

		const embed = new EmbedBuilder()
			.setColor(def.color)
			.setTitle(`Jwett Moments ♡ • ${def.title}`)
			.setDescription(text)
			.setFooter({ text: "Jwett Estates • Made with love ♡" })
			.setTimestamp();

		const row = new ActionRowBuilder();
		const targetIdStr = targetMember ? targetMember.id : "all";

		row.addComponents(
			new ButtonBuilder()
				.setCustomId(`jm_gen:${command}:${actor.id}:${targetIdStr}`)
				.setLabel(def.button)
				.setStyle(ButtonStyle.Primary)
		);

		row.addComponents(
			new ButtonBuilder()
				.setCustomId(`jm_end:${command}:${actor.id}:${targetIdStr}`)
				.setLabel("❌ Done")
				.setStyle(ButtonStyle.Secondary)
		);

		await interaction.reply({ embeds: [embed], components: [row] });
		return true;
	}

	return false;
}

// ── Button Interaction Handler ──────────────────────────────────────────────
async function handleJwettMomentButton(interaction, guildState, scheduleSave) {
	if (!interaction.customId.startsWith("jm_")) return false;

	const parts = interaction.customId.split(":");
	const actionType = parts[0]; // jm_resp, jm_fol, jm_gen, jm_end
	const command = parts[1];
	const actorId = parts[2];
	const targetId = parts[3];
	const key = parts[4];

	// Security: End scene
	if (actionType === "jm_end") {
		if (interaction.user.id !== actorId && interaction.user.id !== targetId && targetId !== "all") {
			await interaction.reply({ content: "🌸 Only scene participants may end this moment.", ephemeral: true });
			return true;
		}

		await interaction.update({
			components: [
				new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId("disabled_scene").setLabel("✨ Moment Concluded ♡").setStyle(ButtonStyle.Secondary).setDisabled(true)
				),
			],
		});
		return true;
	}

	// Generic moment reply button
	if (actionType === "jm_gen") {
		const def = GENERIC_MOMENTS[command];
		if (!def) return false;

		if (targetId !== "all" && interaction.user.id !== targetId) {
			await interaction.reply({ content: `🌸 This tender moment was sent for <@${targetId}> to answer.`, ephemeral: true });
			return true;
		}

		const actorMember = await interaction.guild.members.fetch(actorId).catch(() => null);
		const targetMember = interaction.member;

		const replyText = def.reply(actorMember || { displayName: "Actor" }, targetMember);

		// Record memory
		addRpMemory(guildState, {
			userIds: [actorId, targetMember.id],
			title: `💕 ${def.title}`,
			description: `${actorMember?.displayName || "Someone"} and ${targetMember.displayName} shared a heartwarming moment.`,
			category: "affection",
		});
		addCloseness(guildState, actorId, targetMember.id, 2);

		// Profile moment count
		const p1 = getRpProfile(guildState, actorId);
		const p2 = getRpProfile(guildState, targetMember.id);
		p1.momentsCount = (p1.momentsCount || 0) + 1;
		p2.momentsCount = (p2.momentsCount || 0) + 1;
		scheduleSave();

		const embed = new EmbedBuilder()
			.setColor(def.color)
			.setTitle(`✨ ${def.title} — Completed ♡`)
			.setDescription(replyText)
			.setFooter({ text: "Jwett Estates • Memory Saved to Album ♡" })
			.setTimestamp();

		await interaction.update({
			embeds: [embed],
			components: [
				new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId("done_btn").setLabel("✨ Memory Saved ♡").setStyle(ButtonStyle.Success).setDisabled(true)
				),
			],
		});
		return true;
	}

	// Complex moment target response
	if (actionType === "jm_resp") {
		const def = MOMENT_DEFINITIONS[command];
		if (!def) return false;

		if (targetId !== "all" && interaction.user.id !== targetId) {
			await interaction.reply({ content: `🌸 It is <@${targetId}>'s turn to respond to this family moment.`, ephemeral: true });
			return true;
		}

		const respObj = def.responses[key];
		if (!respObj) return false;

		const actorMember = await interaction.guild.members.fetch(actorId).catch(() => null);
		const targetMember = interaction.member;

		const text = respObj.narrative(actorMember || { displayName: "Actor" }, targetMember);

		const embed = new EmbedBuilder()
			.setColor(def.color)
			.setTitle(def.banner)
			.setDescription(text)
			.setFooter({ text: `${def.subTitle} • Scene in progress...` })
			.setTimestamp();

		// Buttons for initiator follow-up
		const row = new ActionRowBuilder();
		for (const fol of respObj.followUps) {
			row.addComponents(
				new ButtonBuilder()
					.setCustomId(`jm_fol:${command}:${actorId}:${targetId}:${fol.key}`)
					.setLabel(fol.label)
					.setStyle(fol.style)
			);
		}
		row.addComponents(
			new ButtonBuilder()
				.setCustomId(`jm_end:${command}:${actorId}:${targetId}`)
				.setLabel("❌ End Scene")
				.setStyle(ButtonStyle.Secondary)
		);

		await interaction.update({ embeds: [embed], components: [row] });
		return true;
	}

	// Complex moment initiator follow-up (closing beat)
	if (actionType === "jm_fol") {
		const def = MOMENT_DEFINITIONS[command];
		if (!def) return false;

		if (interaction.user.id !== actorId) {
			await interaction.reply({ content: `🌸 It is <@${actorId}>'s turn to conclude this family moment.`, ephemeral: true });
			return true;
		}

		const actorMember = interaction.member;
		const targetMember = targetId !== "all" ? await interaction.guild.members.fetch(targetId).catch(() => null) : null;

		const finalText = def.finalText(actorMember, targetMember || { displayName: "Family" }, key);

		// Record memory
		addRpMemory(guildState, {
			userIds: targetId !== "all" ? [actorId, targetId] : [actorId],
			title: `${def.banner}`,
			description: `${actorMember.displayName} and ${targetMember?.displayName || "the family"} shared an unforgettable moment.`,
			category: def.category.toLowerCase(),
		});
		if (targetId !== "all") {
			addCloseness(guildState, actorId, targetId, 3);
			const p2 = getRpProfile(guildState, targetId);
			p2.momentsCount = (p2.momentsCount || 0) + 1;
		}
		const p1 = getRpProfile(guildState, actorId);
		p1.momentsCount = (p1.momentsCount || 0) + 1;
		scheduleSave();

		const embed = new EmbedBuilder()
			.setColor(def.color)
			.setTitle(`✨ ${def.banner} — Completed ♡`)
			.setDescription(finalText)
			.setFooter({ text: "Jwett Estates • Memory Saved to Album ♡" })
			.setTimestamp();

		await interaction.update({
			embeds: [embed],
			components: [
				new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId("completed_btn").setLabel("✨ Moment Saved to Memories ♡").setStyle(ButtonStyle.Success).setDisabled(true)
				),
			],
		});
		return true;
	}

	return false;
}

module.exports = {
	buildJwettMomentSlashCommands,
	handleJwettMomentCommand,
	handleJwettMomentButton,
	getRpProfile,
	addRpMemory,
	ensureSeedData,
	MOTHER_ID,
	DAUGHTER_ID,
	COLORS,
};
