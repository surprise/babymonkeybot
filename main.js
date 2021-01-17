const Discord = require('discord.js');
const client = new Discord.Client();

const {MongoClient} = require('mongodb');

let collection = null;

client.on('ready', async _ => {
	const mongoClient = new MongoClient(process.env.MONGODB_URI, {useUnifiedTopology: true});
	await mongoClient.connect();
	collection = mongoClient.db('babymonkeybot').collection('data');
	updateLBLoop();
	console.log('Ready!');
});

let last_winner = null;

async function updateRoles() {
	try {
		const guild = await client.guilds.fetch(process.env.GUILD_ID);
		const entries = await collection.find({}).toArray();
		if (entries.length > 0) {
			const people = {};
			for (const entry of entries) {
				if (people[entry.speaker] === undefined) people[entry.speaker] = 1;
				else people[entry.speaker]++;
			}
			const sorted_players = Object.keys(people).sort((idA, idB) => people[idB] - people[idA]);
			if (sorted_players.indexOf('0') !== -1) sorted_players.splice(sorted_players.indexOf('0'), 1);
			let winner = null;
			if (sorted_players.length !== 0) winner = sorted_players[0];
			if (last_winner === winner) return;
			if (winner !== null) {
				try {
					if (last_winner !== winner) {
						const winner_role = await guild.roles.fetch(process.env.FIRST_PLACE_ROLE);
						winner_role.members.some(async member => await member.roles.remove(process.env.FIRST_PLACE_ROLE));
					}
					const winner_member = await guild.members.fetch(winner);
					if (!winner_member.roles.cache.has(process.env.MUTED_ROLE)) await winner_member.roles.add(process.env.FIRST_PLACE_ROLE);
				} catch (e) {
					console.log('Error giving role', winner, e);
				}
			}
			last_winner = winner;
		}
	} catch (e) {
		console.log('Error updating lb', e);
	}
}

async function updateLBLoop() {
	await updateRoles();

	setTimeout(updateLBLoop, 5000);
}

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
			try {
				await collection.deleteMany({});
				(await message.guild.roles.fetch(process.env.FIRST_PLACE_ROLE)).members.some(member => {
					console.log(member.id);
					try {
						member.roles.remove(process.env.FIRST_PLACE_ROLE);
					} catch (e) {
						console.log('Error removing roles', e);
					}
				});
				return message.channel.send('All words removed!');
			} catch (e) {
				return message.channel.send('There was an error removing that word');
			}
		} else if (prefixless.startsWith('check')){
			if (message.mentions.users.size === 0) return message.channel.send('You must mention someone!');
			const words_from_person = await collection.find({speaker: message.mentions.users.first().id}).toArray();
			return message.channel.send('That person has ' + words_from_person.length + ' words sent!');
		}
	}
	const message_words = message.content.split(' ');
	if (message_words.length > 1) return;
	const message_query = await collection.findOne({word: message.content});
	if (message_query === null) {
		let speaker = message.author.id;
		if (message.member.roles.cache.has(process.env.MUTED_ROLE)) speaker = '0';
		await collection.insertOne({
			word: message.content,
			speaker: speaker
		});
		console.log(message.author.id, `sent a word (${message.content})`, speaker === '0' ? 'but they were muted' : '');
	} else {
		try {
			if (!message.member.roles.cache.has(process.env.MUTED_ROLE)) await message.member.roles.add(process.env.MUTED_ROLE);
			return message.channel.send(`<@${message.author.id}> was a baby and goofed up!`);
		} catch (e) {
			console.log('Error adding muted role to', message.author.id, e);
		}
	}
});

client.login(process.env.DISCORD_TOKEN);
