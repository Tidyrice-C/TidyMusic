const Discord = require('discord.js');
const client = new Discord.Client();
const token = require("./scripts/token.js");
const prefix = require("./scripts/config.js");
const ytdl = require("ytdl-core");

const musicCooldown = new Set();

const YouTube = require("discord-youtube-api");
 
let youtube = new YouTube(require("./scripts/youtubeAPI"));

const queue = new Map();
//var joinTimeout;
var playTimeout;

//TIDY ADMIN POWERS
let admin = false;

//status
client.on('ready', () => {
	console.log("TidyMusic primed and ready!");
	console.log("Current guilds: " + client.guilds.cache.size);
	client.user.setPresence({
	 activity: {
			type: "PLAYING",
			name: 'use "$help"'
		}
	});
});

//when joins a server
client.on('guildCreate', guild => {
	console.log("New guild joined! Name: "+ guild.name);

	let channel = guild.channels.cache.find(channel => channel.name === "general");

		if (channel == null) {
			channel = guild.channels.cache.find(channel => channel.name === "welcome");

			if(channel == null) {
				return;
			}
		}
	
		channel.send("Thank you for adding **TidyMusic!** To get a list of commands execute ***$help***. If you are experiencing issues with the bot please contact **Tidyrice!** <a:happy_dark:785427255626956800>");

})

//dumbcheck
client.on('message', async msg => {
	if (!msg.content.startsWith(prefix) || msg.author.bot) return;

	if (admin == true && (msg.author.id !== "adminID1" && msg.author.id !== "adminID2")) {
		return msg.channel.send("***Admin mode*: You do not have admin priviledges!**");
	}

	const args = msg.content.slice(prefix.length).trim().split(/ +/);
	const command = args.shift().toLowerCase();

	const serverQueue = queue.get(msg.guild.id);

	//admin
	if (command === "admin") {
		if (msg.author.id === "adminID1" || msg.author.id === "adminID2") {
			if (admin == true) {
				admin = false;
				return msg.channel.send("**Admin priviledges disabled!**");
			}
			admin = true;
			return msg.channel.send("**Admin priviledges enabled!**");
		}
		return msg.channel.send("**You do not have access to this command!**");
	}

	//help
	if (command === "help") {
		const helplist = module.require("./scripts/helplist.js");
	
		msg.channel.send(helplist);
	}
	//ping

	if (command === "ping") {
		msg.reply(" **Pong!**");
		return;
	}

	//join (music)

	if (command === "join") {
		if (msg.member.voice.channel) {
			const connection = msg.member.voice.channel.join();
	}
		else {
			msg.reply(' **Please join a voice channel before calling me!**');
			return;
		}
	}

	//leave (music)
	if (command === "leave") {
		if (msg.member.voice.channel) {
			const connection = msg.member.voice.channel.leave();
			return;
		} else {
			msg.reply(" **Either I am not connected or you are not in my voice channel.**");
			return;
		}
	}

	//play
	if (command === "play" || command === "p") {
		//checks to see if user executed command within past 15 secs
		if (musicCooldown.has(msg.author.id)) 
			return msg.reply(" **You may only play/queue a song every 15 seconds!**");

			musicCooldown.add(msg.author.id);
			setTimeout(() => {
				musicCooldown.delete(msg.author.id);
			}, 15000);
		
		
		if (args) {
				execute(msg, serverQueue, command);
			return;
	} else {
		msg.reply("**You need to provide a song title or link!**");
		return;
		}
	}

	//stop
	if (command === "stop" || command === "s") {
		stop(msg, serverQueue);
	}

	//resume
	if (command === "resume" || command === "r") {
		resume(msg, serverQueue);
	}

	//skip
	if (command === "skip" || command === "fs") {
		skip(msg, serverQueue);
	}

	//queue
	if (command === "queue" || command === "q") {
		queuelist(msg, serverQueue);
	}

	//now playing
	if (command === "np" || command === "nowplaying") {
		nowplaying(msg, serverQueue);
	}
	
	//loop
	if (command === "loop" || command === "l") {
		loop(msg, serverQueue);
	}
});

//MUSIC STOP,SKIP,PLAY FUNCTIONS
async function execute(msg, serverQueue, command) {
	//you may only queue up to 5 songs
	if (serverQueue && serverQueue.length - 1 >= 5) {
		return msg.channel.send("**You may only queue up to 5 songs!**")
	}
	msg.channel.send("**Track Loading!** <a:loading_rainbow:786027280643522601>").then(msg => {
		msg.delete({timeout: 6500})
	})
	const args = msg.content.slice(prefix.length + command.length + 1);
	const argsTrimmed = msg.content.slice(prefix.length).trim().split(/ +/);
	var videoID = "";
	var videoDetails;

try {
	if (argsTrimmed[1].startsWith("https://")) {
		video = await (await youtube.getVideo(argsTrimmed[1]));
		videoID = video.id;
		videoDetails = video;
		//adds duration to end of array
} 

if (!argsTrimmed[1].startsWith("https://")) {
	//GET URL FUNCTION
	video = await (await youtube.searchVideos(args));
	videoID = video.id;
	videoDetails = video;
	//adds duration to end of array
	
    }
} catch(error) {
	console.log(error);
	msg.channel.send("**No search results, please try again!**");
	return;
}

  
	const voiceChannel = msg.member.voice.channel;
	if (!voiceChannel)
	  return msg.channel.send(
		"**You need to be in a voice channel to play music!**"
	  );
	const permissions = voiceChannel.permissionsFor(msg.client.user);
	if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
	  return msg.channel.send(
		"**I need the permissions to join and speak in your voice channel!**"
	  );
	}
  
	const songInfo = await ytdl.getInfo(videoID);
	const song = {
		  title: songInfo.videoDetails.title,
		  url: songInfo.videoDetails.video_url,
		  loop: false,
		  author: msg.author,
		  video: videoDetails
	 };
  
	if (!serverQueue) {
	  const queueContruct = {
		textChannel: msg.channel,
		voiceChannel: voiceChannel,
		connection: null,
		songs: [],
		volume: 5,
		playing: true
	  };
  
	  queue.set(msg.guild.id, queueContruct);
  
	  queueContruct.songs.push(song);
  
	//  try {
		var connection = await voiceChannel.join();
		queueContruct.connection = connection;
		play(msg.guild, queueContruct.songs[0]);
	//  } catch (error) {
	//	console.log(error);
	//	queue.delete(msg.guild.id);
	//	return msg.channel.send(err);
	//  }
	} else {
	  serverQueue.songs.push(song);
	  let teng = serverQueue.songs.length-1;
	  const addQueue = new Discord.MessageEmbed()
	  .setColor("#4a90e2")
	  .setTitle(song.title)
	  .setURL("https://www.youtube.com/watch?v="+song.video.id)
	  .setAuthor("Added to queue", song.author.displayAvatarURL())
	  .setThumbnail(song.video.thumbnail)
	  .addFields(
		  { name: "Position in queue:", value: teng, inline: true },
		  { name: "Duration:", value: song.video.length, inline: true },
	  )
	  return msg.channel.send(addQueue);
	}
  }
  
  function skip(msg, serverQueue) {
	if (!serverQueue) {
	return msg.channel.send("**There is no song that I could skip!**"); }

	if (!msg.member.voice.channel) {
	  return msg.channel.send("**You have to be in my voice channel to skip the current track!**"); }

	  if (serverQueue.songs.length > 1) {
		//deletes loop
	  serverQueue.songs[0].loop = false;
	  try {
	  serverQueue.connection.dispatcher.end();
	  return msg.channel.send("**Song skipped!**");
	  } catch (error) {
		  console.log(error);
		  queue.delete(msg.guild.id);
		  return msg.channel.send("**A server-side error has occured. The current queue has been deleted.**");
	  }
	  }
	  if (serverQueue.songs.length <= 1) {
		  try {
	  serverQueue.connection.dispatcher.end();
	  queue.delete(msg.guild.id);
	  return msg.channel.send("**Song skipped!**");
		  } catch (error) {
			  console.log(error);
			  queue.delete(msg.guild.id);
			  return msg.channel.send("**A server-side error has occured. The current queue has been deleted.**");
		  }
	  }
  }

  function loop(msg, serverQueue) {
	if (!serverQueue)
	return msg.channel.send("**No song to loop!**");
	if (!msg.member.voice.channel)
	return msg.channel.send("**You must be in a voice channel to loop!");
	
	if (!serverQueue.songs[0].loop) {
		serverQueue.songs[0].loop = true;
		const loopPlaying = new Discord.MessageEmbed()
		.setColor("#B64BB3")
		.setTitle(serverQueue.songs[0].title)
		.setURL("https://www.youtube.com/watch?v="+serverQueue.songs[0].video.id)
		.setAuthor("Song looped", serverQueue.songs[0].author.displayAvatarURL())
		.setThumbnail(serverQueue.songs[0].video.thumbnail)
		return msg.channel.send(loopPlaying);
	}
	if (serverQueue.songs[0].loop) {
		serverQueue.songs[0].loop = false;
		return msg.channel.send("**Song unlooped!**");
	}

  }
  
  function stop(msg, serverQueue) {
	if (!msg.member.voice.channel)
	  return msg.channel.send("**You have to be in my voice channel to stop music playback!**");
	if (!serverQueue) 
	return msg.channel.send ("There is no song playing at the moment!");
	serverQueue.connection.dispatcher.pause();
	msg.channel.send("**Music stopped!**");
  }

  function resume(msg, serverQueue) {
	if (!msg.member.voice.channel)
	return msg.channel.send("**You have to be in my voice channel to resume music playback**");
	if (!serverQueue) 
	return msg.channel.send ("**There is no song playing at the moment!**");
	serverQueue.connection.dispatcher.resume();
	msg.channel.send("**Music resumed!**");
  }

  function queuelist(msg, serverQueue) {
	  if (!serverQueue) {
		  return msg.channel.send("**There are no songs playing at the moment!**");
	  }
	
	  var songQueue = [];
	  for (i = serverQueue.songs.length - 1; i > 0; i--) {
		songQueue.unshift(`**${serverQueue.songs[i].title}**`);
	  }

	  if (songQueue === undefined || songQueue.length == 0) {
		return msg.channel.send("The current queue: **EMPTY**");
	}

var displayQueue;

	switch (songQueue.length) {
//ALL EMBEDS FOR MAX OF 5 IN QUEUE
case 5:
	  displayQueue = new Discord.MessageEmbed()
	  .setAuthor("Server queue", "https://cdn.discordapp.com/avatars/785742735473639444/d608249141219d7a3d63b06ff79a2fe5.png?size=128")
	  //.setThumbnail(videoDetails[0].thumbnail)
	  .addFields(
		  { name: "[1]:", value: songQueue[0]},
		  { name: "[2]:", value: songQueue[1]},
		  { name: "[3]:", value: songQueue[2]},
		  { name: "[4]:", value: songQueue[3]},
		  { name: "[5]:", value: songQueue[4]}
	  ) 
	  break;
case 4:
	  displayQueue = new Discord.MessageEmbed()
	  .setAuthor("Server queue", "https://cdn.discordapp.com/avatars/785742735473639444/d608249141219d7a3d63b06ff79a2fe5.png?size=128")
	  //.setThumbnail(videoDetails[0].thumbnail)
	  .addFields(
		  { name: "[1]:", value: songQueue[0]},
		  { name: "[2]:", value: songQueue[1]},
		  { name: "[3]:", value: songQueue[2]},
		  { name: "[4]:", value: songQueue[3]},
	  )
		break;
case 3:
	  displayQueue = new Discord.MessageEmbed()
	  .setAuthor("Server queue", "https://cdn.discordapp.com/avatars/785742735473639444/d608249141219d7a3d63b06ff79a2fe5.png?size=128")
	  //.setThumbnail(videoDetails[0].thumbnail)
	  .addFields(
		  { name: "[1]:", value: songQueue[0]},
		  { name: "[2]:", value: songQueue[1]},
		  { name: "[3]:", value: songQueue[2]},
	  )
		break;
case 2:
	  displayQueue = new Discord.MessageEmbed()
	  .setAuthor("Server queue", "https://cdn.discordapp.com/avatars/785742735473639444/d608249141219d7a3d63b06ff79a2fe5.png?size=128")
	  //.setThumbnail(videoDetails[0].thumbnail)
	  .addFields(
		  { name: "[1]:", value: songQueue[0]},
		  { name: "[2]:", value: songQueue[1]},
	  )
		break;
case 1:
	  displayQueue = new Discord.MessageEmbed()
	  .setAuthor("Server queue", "https://cdn.discordapp.com/avatars/785742735473639444/d608249141219d7a3d63b06ff79a2fe5.png?size=128")
	  //.setThumbnail(videoDetails[0].thumbnail)
	  .addFields(
		  { name: "[1]:", value: songQueue[0]},
	  )
	  break;
	} //END OF SWITCH
	  return msg.channel.send(displayQueue);
  }

  function nowplaying(msg, serverQueue) {
	  if (!serverQueue) {
		  return msg.channel.send("**There are no songs playing at the moment!**");
	  }
	  const songTitle = serverQueue.songs[0].title;
	  return msg.channel.send(`Currently playing: **${songTitle}**`);
  }
  
  async function play(guild, song) {
	const serverQueue = queue.get(guild.id);

//	try {
	if (!song) {
		queue.delete(guild.id);

		playTimeout = setTimeout(() => {
			//if no song after 300,000 ms then leave channel
	if (!queue.get(guild.id) || queue.get(guild.id).length == 0) {

	  try{serverQueue.voiceChannel.leave();} catch (error) {}
	  queue.delete(guild.id);
	  return;
		console.log(error);
	}
	}, 300000)

	return;
	}
//} catch(error) { console.log(error) }
  
	const dispatcher = serverQueue.connection
	  .play(ytdl(song.url, { filter: "audioonly"}))
	  .on("finish", () => {
		if (serverQueue.songs[0].loop) {return play(guild, serverQueue.songs[0]);}
		serverQueue.songs.shift();
		//if (!serverQueue.songs[0]) {return queue.delete(guild.id)};
		play(guild, serverQueue.songs[0]);
	  })
	dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
	//if looping
	if (serverQueue.songs[0].loop) 
	return;
	//embed
	const desc = song.video.description.slice(0, 150) + "...";
	const nowPlaying = new Discord.MessageEmbed()
	  .setColor("#78ea86")
	  .setTitle(song.title)
	  .setURL("https://www.youtube.com/watch?v="+song.video.id)
	  .setAuthor("Now playing", song.author.displayAvatarURL())
	  .setThumbnail(song.video.thumbnail)
	  .addFields(
		  { name: "Position in queue:", value: "0", inline: true },
		  { name: "Duration:", value: song.video.length, inline: true },
		  { name: "Description:", value: desc}
	  )
	  //.setFooter("TidyMusic", "https://cdn.discordapp.com/avatars/785742735473639444/d608249141219d7a3d63b06ff79a2fe5.png?size=128")

	serverQueue.textChannel.send(nowPlaying);

	//if kicked from VC
	serverQueue.connection.on("disconnect", () => {
		serverQueue.voiceChannel.leave();
		queue.delete(guild.id);
		//clearTimeout(joinTimeout);
		clearTimeout(playTimeout);
		return;
	})

	//if reconnecting (network issues)
	client.once("reconnecting", () => {
		serverQueue.voiceChannel.leave();
		queue.delete(guild.id);
		//clearTimeout(joinTimeout);
		clearTimeout(playTimeout);
		msg.channel.send(" **TidyMusic** is currently experiencing network problems. If this problem persists please contact Tidyrice.")
		return;
	})
  }

client.login(token);