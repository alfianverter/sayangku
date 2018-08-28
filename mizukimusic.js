const Discord = require("discord.js");
const superagent = require("superagent");
const YouTube = require("simple-youtube-api");
const ytdl = require("ytdl-core");
const opus = require("opusscript");
const moment = require("moment");
 
const prefix = 'm!';
var commandcooldown = new Set();
var queue = new Map();
 
var bot = new Discord.Client({
    disableEveryone: true
})
var youtube = new YouTube(process.env.YTAPI);
bot.on("ready", async () => {
    console.log("Mizuki Music Part is ready!")
})
 
bot.on('message', async msg => { // eslint-disable-line
    var message = msg;
 
    if (message.author.bot) return;
 
    if (message.channel.type === 'dm') return;
 
    var DEFAULTPREFIX = 'm!'
 
    var {body} = await superagent
        .get("http://mizuki.glitch.me/prefixes.json")
 
    if (!body[message.guild.id]) {
        body[message.guild.id] = {
            PREFIXES: DEFAULTPREFIX
        };
    }
 
    var PREFIX = body[message.guild.id].PREFIXES
 
    if (commandcooldown.has(message.author.id)) {
        return;
    }
    commandcooldown.add(message.author.id);
    setTimeout(() => {
        commandcooldown.delete(message.author.id);
    }, 2000); //2000 ms = 2 detik\
 
    if (msg.author.bot) return undefined;
    if (!msg.content.startsWith(PREFIX)) return undefined;
 
  var randomhexcolor = Math.floor(Math.random() * 16777214) + 1
 
  var serverQueue = queue.get(message.guild.id);
 
  var args = message.content.substring(PREFIX.length).split(" ")
 
  var url = args[1] ? args[1].replace(/<(.+)>/g, '$1') : '';
 
  var invitelink = "https://discord.gg/kU7Q38j";
 
    let command = msg.content.toLowerCase().split(' ')[0];
    command = command.slice(PREFIX.length)
 
    if (command === 'play' || command === 'p') {
        var searchString = args.slice(1).join(" ");
        if(!searchString) return msg.channel.send({embed: {
          description: `❌ Please usage: \`${PREFIX}play <Song name | URL | Playlist URL>\``
        }})
        const voiceChannel = msg.member.voiceChannel;
        if (!voiceChannel) return msg.channel.send({
            embed: {
                description: `${msg.author} You are not on the voice channel, you need to be in a voice channel to play some music!.`
            }
        })
        const permissions = voiceChannel.permissionsFor(bot.user);
        if (!permissions.has('CONNECT')) {
              msg.channel.send({
            embed: {
                description: `Sorry, cannot connect to your voice channel, make sure I have the permissions!`
            }
        })
    }
        if (!permissions.has('SPEAK')) {
            return msg.channel.send({
            embed: {
                description: `I cannot speak in this voice channel, make sure I have the permissions!`
            }
        })
        }
 
        if (url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
            const playlist = await youtube.getPlaylist(url);
            const videos = await playlist.getVideos();
            for (const video of Object.values(videos)) {
                const video2 = await youtube.getVideoByID(video.id); // eslint-disable-line no-await-in-loop
                await handleVideo(video2, msg, voiceChannel, true); // eslint-disable-line no-await-in-loop
            }
            return msg.channel.send({
            embed: {
                description: `${playlist.title} has been added to the queue!`
            }
        })
        } else {
            try {
                var video = await youtube.getVideo(url);
            } catch (error) {
                try {
                    var videos = await youtube.searchVideos(searchString, 10);
                    let index = 0;
                    var selection = await msg.channel.send({
            embed: {
                description: `__**🔽 Please select your song below:**__
${videos.map(video2 => `**${++index} -** ${video2.title}`).join('\n')}
**Type in the number listed above, you have a 30 seconds before it get automatically canceled!**`
            }
        })
 
                    try {
                        var response = await msg.channel.awaitMessages(msg2 => msg2.content > 0 && msg2.content < 11, {
                            maxMatches: 1,
                            time: 30000,
                            errors: ['time']
                        });
                                                selection.delete();
                    } catch (err) {
                        console.error(err);
                        return msg.channel.send({
            embed: {
                description: `No or invalid value entered, cancelling video selection.`
            }
        })
                        selection.delete();
                    }
                    const videoIndex = parseInt(response.first().content);
                    var video = await youtube.getVideoByID(videos[videoIndex - 1].id);
                } catch (err) {
                    console.error(err)
                    return msg.channel.send({
            embed: {
                description: `ERR! I could not obtain any search results.`
            }
        })
                }
            }
            return handleVideo(video, msg, voiceChannel);
        }
    } else if (command === 'skip') {
        if (!msg.member.voiceChannel) return msg.channel.send({
            embed: {
                description: `${msg.author} You are not in a voice channel!`,
            }
        })
        if (!serverQueue) return msg.channel.send({
            embed: {
                description: `Hei ${msg.author}, There is nothing playing that I could skip for you.`
            }
        })
        serverQueue.connection.dispatcher.end('Skip command has been used!');
        return undefined;
  } else if (command === 'stop') {
    let member = msg.member;
        if (!msg.member.voiceChannel) return msg.channel.send({
            embed: {
                description: `Hei ${msg.author}, You need to join voice channel.`,
            }
        })
        if (!serverQueue) return msg.channel.send({
            embed: {
                description: `Hei ${msg.author}, There is nothing playing that I could stop for you.`
            }
        })
        serverQueue.songs = [];
        serverQueue.connection.dispatcher.end('Stop is already used!');
        return msg.channel.send({embed: {
          description: `⏹ Music has been stoped!.`,
        }}) + msg.channel.send({embed: {
          fields: [{
            name: `Support ${bot.user.username}`,
            value: `Support ${bot.user.username} by joining to our discord:\n[Click here](https://discordbots.org/bot/449277727514558464/vote)`
          }],
          timestamp: new Date()
          }});
      } else if (command === 'volume') {
          if (!msg.member.voiceChannel) return msg.channel.send({
            embed: {
                description: `${msg.author}, You are not in a voice channel!.`
            }
        });
        if (!serverQueue) return msg.channel.send({
            embed: {
                description: `There is nothing playing.`
            }
        })
        if (!args[1]) return msg.channel.send({
            embed: {
                description: `The current volume is: __**${serverQueue.volume}%**__`
            }
        });
        serverQueue.volume = args[1];
    if (args[1] > 100) return msg.channel.send({
      embed: {
        description: `${msg.author} Volume limit is 100%, your ear will bleeding!`
      }
    });
     serverQueue.volume = args[1];
     if (args[1] > 100) return !serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1] / 100) +
       msg.channel.send({
      embed: {
        description: `${msg.author} Volume limit is 100%, your ear will bleeding!`
      }
    });
 
     if (args[1] < 101) return serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1] / 100) +
          msg.channel.send({
            embed: {
                description: `I set the volume to: __**${args[1]}**%__`
            }
        });
    } else if (command === 'np') {
        if (!serverQueue) return msg.channel.send({
            embed: {
                description: `There is nothing playing.`
            }
        })
        return msg.channel.send({
            embed: {
                description: `🎶 Now playing: __**${serverQueue.songs[0].title}**__`
            }
        })
    } else if (command === 'queue') {
        var index = 0;
        if (!serverQueue) return msg.channel.send({
            embed: {
                description: `There is nothing playing.`
            }
        })
        return msg.channel.send({
            embed: {
                description: `__**Songs in the queue list:**__
 
${serverQueue.songs.map(song => `**${index++}.** ${song.title}`).join('\n')}`
            }
        });
    } else if (command === 'pause') {
        if (serverQueue && serverQueue.playing) {
            serverQueue.playing = false;
            serverQueue.connection.dispatcher.pause();
            return msg.channel.send({
            embed: {
                description: `⏸ Music has paused.`
            }
        })
        }
        return msg.channel.send({
            embed: {
                description: `There is nothing playing.`
            }
        })
    } else if (command === 'resume') {
        if (serverQueue && !serverQueue.playing) {
            serverQueue.playing = true;
            serverQueue.connection.dispatcher.resume();
            return msg.channel.send({
            embed: {
                description: `⏯ Music has resumed.`
            }
        })
        }
        return msg.channel.send({
            embed: {
                description: `There is nothing playing.`
            }
        })
    }
 
    return undefined;
});
 
async function handleVideo(video, msg, voiceChannel, playlist = false) {
    const serverQueue = queue.get(msg.guild.id);
    console.log(video);
  const song = {
        id: video.id,
        title: Discord.Util.escapeMarkdown(video.title),
        url: `https://www.youtube.com/watch?v=${video.id}`,
        uploadedby: video.channel.title,
        channelurl: `https://www.youtube.com/channel/${video.channel.id}`,
        durationh: video.duration.hours,
        durationm: video.duration.minutes,
        durations: video.duration.seconds,
        request: msg.author,
        channels: voiceChannel.name,
    }
    if (!serverQueue) {
        const queueConstruct = {
            textChannel: msg.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 100,
            playing: true
        };
        queue.set(msg.guild.id, queueConstruct);
 
        queueConstruct.songs.push(song);
 
        try {
            var connection = await voiceChannel.join();
            queueConstruct.connection = connection;
            play(msg.guild, queueConstruct.songs[0]);
        } catch (error) {
            console.error(`I could not join the voice channel: ${error}`);
            queue.delete(msg.guild.id);
            return msg.channel.send({
            embed: {
                description: `I could not join the voice channel: ${error}.`
            }
        });
        }
    } else {
      var queueembed = new Discord.RichEmbed()
      .setAuthor(`Added to queue`, `https://images-ext-1.discordapp.net/external/YwuJ9J-4k1AUUv7bj8OMqVQNz1XrJncu4j8q-o7Cw5M/http/icons.iconarchive.com/icons/dakirby309/simply-styled/256/YouTube-icon.png`)
      .setThumbnail(`https://i.ytimg.com/vi/${song.id}/default.jpg?width=80&height=60`)
      .addField('Title', `__[${song.title}](${song.url})__`, true)
      .addField('Video ID', `${song.id}`, true)
      .addField("Uploaded by", `[${song.uploadedby}](${song.channelurl})`, true)
      .addField("Duration", `${song.durationm}min ${song.durations}sec`, true)
      .addField("Request by", `${song.request}`, true)
      .setFooter(`If this bot does not sound, you have to exit and log back in.`)
      .setTimestamp();
        serverQueue.songs.push(song);
        console.log(serverQueue.songs);
        if (playlist) return undefined;
        else return msg.channel.send(queueembed);
    }
    return undefined;
}
 
function play(guild, song) {
    const serverQueue = queue.get(guild.id);
 
    if (!song) {
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
        return;
    }
    console.log(serverQueue.songs);
 
    const dispatcher = serverQueue.connection.playStream(ytdl(song.url))
        .on('end', reason => {
            if (reason === 'Stream is not generating quickly enough.') console.log('Song ended.');
            else console.log(reason);
            serverQueue.songs.shift();
            play(guild, serverQueue.songs[0]);
        })
        .on('error', error => console.error(error));
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 100);
 
  let startembed = new Discord.RichEmbed()
  .setAuthor(`Start Playing`, `https://images-ext-1.discordapp.net/external/YwuJ9J-4k1AUUv7bj8OMqVQNz1XrJncu4j8q-o7Cw5M/http/icons.iconarchive.com/icons/dakirby309/simply-styled/256/YouTube-icon.png`)
  .setThumbnail(`https://i.ytimg.com/vi/${song.id}/default.jpg?width=80&height=60`)
  .addField('Title', `__[${song.title}](${song.url})__`, true)
  .addField('Video ID', `${song.id}`, true)
  .addField("Uploaded by", `[${song.uploadedby}](${song.channelurl})`, true)
  .addField("Duration", `${song.durationh}hrs ${song.durationm}mins ${song.durations}secs`, true)
  .addField("Request by", `${song.request}`, true)
  .addField("Voice Channel", `${song.channels}`, true)
  .addField("Volume", `${serverQueue.volume}%`, true)
  .setFooter(`If this bot does not sound, you have to exit and log back in.`)
  .setTimestamp();
 
    serverQueue.textChannel.send(startembed);
}
 
bot.login(process.env.TOKEN);
