const Discord = require('discord.js');
const client = new Discord.Client();

const {MongoClient} = require('mongodb');

let collection = null;

client.on('ready', async _ => {
	const mongoClient = new MongoClient(process.env.MONGODB_URI, {useUnifiedTopology: true});
	await mongoClient.connect();
	collection = mongoClient.db('babymonkeybot').collection('data');
});

const leaderboard_roles = {
	1: process.env.FIRST_PLACE_ROLE,
	2: process.env.SECOND_PLACE_ROLE,
	3: process.env.THIRD_PLACE_ROLE
};

let last_leaderboards = [];

client.on('message', async message => {
	if (!process.env.TARGET_CHANNELS.includes(message.channel.id)) return;
	if (message.author.bot) return;
	if (message.content.startsWith(process.env.CMD_PREFIX) && message.author.id === process.env.OWNER_ID) {
		const prefixless = message.content.replace(process.env.CMD_PREFIX, '');
		if (prefixless.startsWith('removeword')) {
			if (prefixless.split(' ').length === 1) return message.channel.send('You have to specify a word to remove!');
			try {
				await collection.deleteOne({
					word: prefixless.split(' ')[1]
				});
			} catch (e) {
				return message.channel.send('There was an error removing that word');
			}
		} else if (prefixless.startsWith('removeall')){
			if (prefixless.split(' ').length === 1) return message.channel.send('You have to specify a word to remove!');
			try {
				await collection.deleteMany({});
			} catch (e) {
				return message.channel.send('There was an error removing that word');
			}
		}
	}
	const message_words = message.content.split(' ');
	if (message_words.length > 1) return;
	const message_query = await collection.findOne({word: message.content});
	if (message_query === null) {
		await collection.insertOne({
			word: message.content,
			speaker: message.author.id
		});
	} else {
		try {
			if (!message.member.roles.cache.has(process.env.MUTED_ROLE)) await message.member.roles.add(process.env.MUTED_ROLE);
			return message.channel.send(`<@${message.author.id}> was a baby and goofed up!`);
		} catch (e) {
			console.log('Error adding muted role to', message.author.id, e);
		}
	}
	try {
		const entries = await collection.find({}).toArray();
		if (entries.length > 0) {
			const people = {};
			for (const entry of entries) {
				if (people[entry.speaker] === undefined) people[entry.speaker] = 1;
				else people[entry.speaker]++;
			}
			for (const role of Object.values(leaderboard_roles)) {
				(await message.guild.roles.fetch(role)).members.some(member => {
					try {
						member.roles.remove(role);
					} catch (e) {
						console.log('Error removing roles', e);
					}
				});
			}
			let i = 1;
			const top_3 = Object.keys(people).sort((idA, idB) => people[idB] - people[idA]).slice(0, 2);
			if (last_leaderboards === top_3) return;
			last_leaderboards = top_3;
			for (const id of top_3) {
				try {
					const member = await message.guild.members.fetch(id);
					if (!member.roles.cache.has(process.env.MUTED_ROLE)) {
						await member.roles.add(leaderboard_roles[String(i)]);
						i++;
					}
				} catch (e) {
					console.log('Error giving role', id, e);
				}
			}
		}
	} catch (e) {
		console.log('Error updating lb', e);
	}
});

client.login(process.env.DISCORD_TOKEN);
