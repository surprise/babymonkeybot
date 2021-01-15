const Discord = require('discord.js');
const client = new Discord.Client();

const {MongoClient} = require('mongodb');

let collection = null;

client.on('ready', async _ => {
	const mongoClient = new MongoClient(process.env.MONGODB_URI);
	await mongoClient.connect();
	collection = mongoClient.db('babymonkeybot').collection('data');
});

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
	for (const word of message_words) {
		const message_query = await collection.findOne({word: word});
		if (message_query === null) {
			await collection.insertOne({
				word: word
			});
		} else {
			try {
				if (!message.member.roles.cache.has(process.env.MUTED_ROLE)) await message.member.roles.add(process.env.MUTED_ROLE);
				return message.channel.send(message.member.nickname + ' was a baby and goofed up!');
			} catch (e) {
				console.log('Error adding muted role to', message.author.id, e);
			}
		}
	}
});

client.login(process.env.DISCORD_TOKEN);
