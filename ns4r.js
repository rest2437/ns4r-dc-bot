require("dotenv").config();
const axios = require("axios");

const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  EmbedBuilder,
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});
const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const baseApi = "https://biggamesapi.io/api/clan/NS4R";
const userApi = "https://users.roblox.com/v1/users";
const avatarAPI = "https://thumbnails.roblox.com/v1/users/avatar-3d?userId=";
const robDaDevAvatar =
  "https://cdn.discordapp.com/attachments/1241850321097986240/1241851128644112524/Group_2.png?ex=664bb37d&is=664a61fd&hm=479429dc8a7824b96326ae511d9c59e2f95ba405a05a91cac28228b030fce18e&";
const NS4RLogo =
  "https://cdn.discordapp.com/attachments/1249494462963384351/1249494485256245371/DaLogoButDaPink.png?ex=666781eb&is=6666306b&hm=c28309d1316514f2236f11459a230dd7f8fd3df44262488282da90eb94ef25c6&";
const autoPostChannelId = "1249488638706978858";

client.once("ready", () => {
  console.log(`Ready! Logged in as ${client.user.tag}`);

  const clanSearch = new SlashCommandBuilder()
    .setName("clansearch")
    .setDescription("Search for a clan by name");

  const clan = new SlashCommandBuilder()
    .setName("clan")
    .setDescription("Shows clan stats");

  const clanSearchCommand = clanSearch.toJSON();
  const clanCommand = clan.toJSON();

  client.application.commands.set([clanSearchCommand, clanCommand]);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;
  console.log(`Received interaction for command: ${interaction.commandName}`);
  console.log(`Interaction ID: ${interaction.id}`);
  console.log(`User ID: ${interaction.user.id}`);

  if (interaction.commandName === "clansearch") {
    await interaction.reply(
      "Please enter the name of the clan you want to search."
    );

    const filter = (msg) => interaction.user.id === msg.author.id;
    const collector = interaction.channel.createMessageCollector({
      filter,
      time: 60000,
    });

    collector.on("collect", async (msg) => {
      const clanName = msg.content.trim();
      const baseApi = `https://biggamesapi.io/api/clan/${clanName}`;

      try {
        const response = await axios.get(baseApi);

        if (
          !response.data ||
          !response.data.data ||
          !response.data.data.Battles ||
          !response.data.data.Battles.HackerBattle
        ) {
          await interaction.followUp(
            `Clan '${clanName}' not found. Please try again.`
          );
          collector.stop();
          return;
        }

        const currentPlace = response.data.data.Battles.HackerBattle.Place;
        const clanPoints = response.data.data.Battles.HackerBattle.Points;
        const pointContributions =
          response.data.data.Battles.HackerBattle.PointContributions;
        pointContributions.sort((a, b) => b.Points - a.Points);

        const allPlayers = [];
        for (let i = 0; i < pointContributions.length; i++) {
          const userId = pointContributions[i].UserID;
          const points = pointContributions[i].Points;
          const userResponse = await axios.get(`${userApi}/${userId}`);
          const username = userResponse.data.displayName;
          allPlayers.push({ username, points });
        }

        const topPlayers = pointContributions.slice(0, 10);
        const averageTopTen =
          topPlayers.reduce((acc, curr) => acc + curr.Points, 0) / 10;

        const playerChunks = [];
        for (let i = 0; i < allPlayers.length; i += 25) {
          playerChunks.push(allPlayers.slice(i, i + 25));
        }

        const channel = interaction.channel;

        for (const [chunkIndex, chunk] of playerChunks.entries()) {
          const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle(`Results for ${clanName}`)
            .setTimestamp()
            .setFooter({
              text: "Made by RobDaDev",
              iconURL: robDaDevAvatar,
            });

          if (chunkIndex === 0) {
            embed.setDescription(
              `**Current Place:** ${currentPlace}\n**Clan Points:** ${clanPoints}`
            );
          }

          chunk.forEach((player, index) => {
            const position = chunkIndex * 25 + index + 1;
            let playerEmoji = "";

            const thresholdScore = Math.ceil(0.1 * averageTopTen);
            const thresholdScore2 = Math.ceil(0.03 * averageTopTen);

            if (player.points <= thresholdScore) {
              playerEmoji = "\n🫤 **The 10th percentile**";
            }
            if (player.points <= thresholdScore2) {
              playerEmoji = "\n😡 **The 3rd percentile**";
            }

            if (chunkIndex === 0) {
              let medalEmoji = " ";
              if (index === 0) {
                medalEmoji = "🥇";
              } else if (index === 1) {
                medalEmoji = "🥈";
              } else if (index === 2) {
                medalEmoji = "🥉";
              }
              embed.addFields({
                name: `${position}. ${medalEmoji} ${player.username} ${medalEmoji}`,
                value: `Points: ${player.points}   ${playerEmoji}`,
              });
            } else {
              embed.addFields({
                name: `${position}. ${player.username}`,
                value: `Points: ${player.points}   ${playerEmoji}`,
              });
            }
          });
          await channel.send({
            embeds: [embed],
          });
        }
        console.log("Updated clan stats");
      } catch (error) {
        if (error.response && error.response.status === 400) {
          await interaction.followUp(
            `Bad request. Please check the clan name and try again.`
          );
        } else {
          await interaction.followUp(
            `An error occurred while fetching clan stats. Please try again later.`
          );
          console.error("Error fetching clan stats:", error);
        }
      }

      collector.stop();
    });

    collector.on("end", (collected, reason) => {
      if (reason === "time") {
        interaction.followUp("Clan search timed out. Please try again.");
      }
    });
  } else if (interaction.commandName === "clan") {
    try {
      const clanAPI =
        "https://biggamesapi.io/api/clans?page=1&pageSize=50&sort=Points&sortOrder=desc";
      const clanResponse = await axios.get(clanAPI);
      const clanData = clanResponse.data.data;

      let clanInfo = "";
      let otherClansInfo = "";
      let topClanInfo = "";
      let aboveNS4RInfo = "";
      let belowNS4RInfo = "";

      clanData.sort((a, b) => b.Points - a.Points);

      const NS4RClanIndex = clanData.findIndex((clan) => clan.Name === "NS4R");
      if (NS4RClanIndex !== -1) {
        const NS4RClan = clanData[NS4RClanIndex];
        clanInfo += `**#${NS4RClanIndex + 1}. NS4R Clan**\n**Points:** ${
          NS4RClan.Points
        }\n\n`;
      } else {
        clanInfo += "NS4R Clan not found in top 50.\n\n";
      }

      const topClan = clanData[0];
      if (NS4RClanIndex !== -1) {
        topClanInfo = `**#${1}. ${topClan.Name}**\n**Points:** ${
          topClan.Points
        } \n${
          topClan.Points - clanData[NS4RClanIndex].Points
        } points ahead of NS4R\n`;
      }

      const aboveNS4RIndex = NS4RClanIndex - 1;
      if (aboveNS4RIndex >= 0) {
        const aboveNS4R = clanData[aboveNS4RIndex];
        aboveNS4RInfo = `**#${aboveNS4RIndex + 1}. ${
          aboveNS4R.Name
        }**\n**Points:** ${aboveNS4R.Points} \n${
          aboveNS4R.Points - clanData[NS4RClanIndex].Points
        } points ahead of NS4R\n`;
      }

      const belowNS4RIndex = NS4RClanIndex + 1;
      if (belowNS4RIndex < clanData.length) {
        const belowNS4R = clanData[belowNS4RIndex];
        belowNS4RInfo = `**#${belowNS4RIndex + 1}. ${
          belowNS4R.Name
        }**\n**Points:** ${belowNS4R.Points} \n${
          belowNS4R.Points - clanData[NS4RClanIndex].Points
        } points behind NS4R\n`;
      }

      const embed = new EmbedBuilder()
        .setThumbnail(NS4RLogo)
        .setTitle(`Glitch Battle Leaderboard`)
        .addFields(
          { name: "NS4R Clan", value: clanInfo },
          { name: "🥇 Top Clan 🥇", value: topClanInfo },
          { name: "⬆️ Above NS4R ⬆️", value: aboveNS4RInfo },
          { name: "⬇️ Below NS4R ⬇️", value: belowNS4RInfo }
        )
        .setColor("#0099ff");

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      const dcUsername = interaction.user.username;
      const errorMessage = `HELP! Please fix me! ${dcUsername} encountered an ERROR with the /clan command`;
      const user = await client.users.fetch(robDaDevId);
      user
        .send(errorMessage)
        .then(() => console.log(`Sent error message to RobDaDev`))
        .catch((error) =>
          console.error(`Error sending message to RobDaDev: ${error}`)
        );

      console.error("Error fetching clan data:", error);
      await interaction.reply("An error occurred while fetching clan data.");
    }
  }
});

let lastPostedPoints = {};

async function postClanStats() {
  try {
    const response = await axios.get(baseApi);
    const currentPlace = response.data.data.Battles.HackerBattle.Place;
    const clanPoints = response.data.data.Battles.HackerBattle.Points;
    const pointContributions =
      response.data.data.Battles.HackerBattle.PointContributions;
    pointContributions.sort((a, b) => b.Points - a.Points);

    const allPlayers = [];
    for (let i = 0; i < pointContributions.length; i++) {
      const userId = pointContributions[i].UserID;
      const points = pointContributions[i].Points;
      const userResponse = await axios.get(`${userApi}/${userId}`);
      const username = userResponse.data.displayName;

      const lastPoints = lastPostedPoints[userId] || 0;
      const gainedPoints = points - lastPoints;

      allPlayers.push({ username, points, gainedPoints });
    }

    await Promise.all(
      pointContributions.map(async (contribution) => {
        const userId = contribution.UserID;
        const points = contribution.Points;
        const lastPoints = lastPostedPoints[userId] || 0;
        const gainedPoints = points - lastPoints;

        lastPostedPoints[userId] = points;

        if (gainedPoints === 0) {
          try {
            const userId = contribution.UserID;
            const discordIdObject = await db.get(userId);
            const discordId = discordIdObject.value;

            console.log(
              `User ${discordId} with Roblox ID ${userId} has not changed their score.`
            );

            if (discordId) {
              const user = await client.users.fetch(discordId);

              const roleId = "1244335123264966706";
              const member = await client.guilds.cache
                .get("1159492670272581735")
                .members.fetch(discordId);
              if (member.roles.cache.has(roleId)) {
                try {
                  await user.send(
                    "Your points have not changed since the last update. Please check Roblox for any disconnects."
                  );
                  console.log(`Sent a direct message to user ${discordId}.`);
                } catch (error) {
                  console.error(
                    `Error sending a direct message to user ${discordId}:`,
                    error
                  );
                }
              }
            } else {
              console.error("Discord user ID is null or undefined.");
            }
          } catch (error) {
            console.error(
              "Error fetching Discord user ID from the database:",
              error
            );
          }
        }
      })
    );

    const player1 = pointContributions[0].Points;
    const player2 = pointContributions[1].Points;
    const player3 = pointContributions[2].Points;
    const player4 = pointContributions[3].Points;
    const player5 = pointContributions[4].Points;
    const player6 = pointContributions[5].Points;
    const player7 = pointContributions[6].Points;
    const player8 = pointContributions[7].Points;
    const player9 = pointContributions[8].Points;
    const player10 = pointContributions[9].Points;

    const averageTopTen =
      (player1 +
        player2 +
        player3 +
        player4 +
        player5 +
        player6 +
        player7 +
        player8 +
        player9 +
        player10) /
      10;

    const playerChunks = [];
    for (let i = 0; i < allPlayers.length; i += 25) {
      playerChunks.push(allPlayers.slice(i, i + 25));
    }

    const channel = await client.channels.fetch(autoPostChannelId);
    const messages = await channel.messages.fetch();
    await Promise.all(
      messages.map(async (msg) => {
        try {
          await msg.delete();
          console.log(`Deleted message with ID: ${msg.id}`);
        } catch (error) {
          console.error(`Error deleting message with ID ${msg.id}:`, error);
        }
      })
    );

    for (const [chunkIndex, chunk] of playerChunks.entries()) {
      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle("Participating Players")
        .setTimestamp()
        .setFooter({
          text: "Made by RobDaDev",
          iconURL: robDaDevAvatar,
        });

      if (chunkIndex === 0) {
        embed.setDescription(
          `**Current Place:** ${currentPlace}\n**Clan Points:** ${clanPoints}`
        );
      }

      chunk.forEach((player, index) => {
        const position = chunkIndex * 25 + index + 1;
        let playerEmoji = "";

        const thresholdScore = Math.ceil(0.1 * averageTopTen);
        const thresholdScore2 = Math.ceil(0.03 * averageTopTen);

        if (player.points <= thresholdScore) {
          playerEmoji = "\n🫤 **The 10th percentile**";
        }
        if (player.points <= thresholdScore2) {
          playerEmoji = "\n😡 **The 3rd percentile\nAsk for help**";
        }

        const gainedPointsText =
          player.gainedPoints > 0
            ? ` ⬆️ ${player.gainedPoints}`
            : "📵 No change since last post 📵";

        if (chunkIndex === 0) {
          let medalEmoji = " ";
          if (index === 0) {
            medalEmoji = "🥇";
          } else if (index === 1) {
            medalEmoji = "🥈";
          } else if (index === 2) {
            medalEmoji = "🥉";
          }
          embed.addFields({
            name: `${position}. ${medalEmoji} ${player.username} ${medalEmoji}`,
            value: `Points: ${player.points}   ${playerEmoji} \n${gainedPointsText}`,
          });
        } else {
          embed.addFields({
            name: `${position}. ${player.username}`,
            value: `Points: ${player.points}   ${playerEmoji} \n${gainedPointsText}`,
          });
        }
      });
      await channel.send({
        content: "Automatically posted update:",
        embeds: [embed],
      });
    }
    console.log("Updated NS4R clan stats");
  } catch (error) {
    console.log(error);
  }
}

postClanStats();

setInterval(postClanStats, 600000);

client.login(TOKEN);
