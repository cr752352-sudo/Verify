const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fetch = require('node-fetch');

const TOKEN = process.env.BOT_TOKEN; 
const CLIENT_ID = process.env.CLIENT_ID; 
const VERIFIED_ROLE_NAME = process.env.VERIFIED_ROLE || 'Verified';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ]
});

// Register slash commands
const commands = [
  new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Verify your Roblox account')
    .addStringOption(opt =>
      opt.setName('username')
        .setDescription('Your Roblox username')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('whois')
    .setDescription('Look up a verified member')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('Discord user to look up')
        .setRequired(true)
    ),
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('✅ Slash commands registered');
  } catch (e) { console.error(e); }
  client.user.setActivity('Verifying members 🔒', { type: 'WATCHING' });
});

// Map to store pending verifications: discordId -> robloxUsername
const pending = new Map();

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'verify') {
    const robloxUsername = interaction.options.getString('username');
    await interaction.deferReply({ ephemeral: true });

    // Check roblox user exists
    try {
      const res = await fetch(`https://api.roblox.com/users/get-by-username?username=${encodeURIComponent(robloxUsername)}`);
      const data = await res.json();
      if (!data.Id) {
        return interaction.editReply({ content: '❌ Roblox user **' + robloxUsername + '** not found. Check your spelling.' });
      }

      // Assign verified role
      const guild = interaction.guild;
      let role = guild.roles.cache.find(r => r.name === VERIFIED_ROLE_NAME);
      if (!role) {
        role = await guild.roles.create({ name: VERIFIED_ROLE_NAME, color: 0x5865F2, reason: 'VerifyBot auto-created' });
      }

      const member = interaction.member;
      await member.roles.add(role);
      try { await member.setNickname(robloxUsername); } catch (_) {}

      const embed = new EmbedBuilder()
        .setTitle('✅ Verified!')
        .setDescription(`You have been verified as **${robloxUsername}** on Roblox.`)
        .setColor(0x57F287)
        .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${data.Id}&width=150&height=150`)
        .setFooter({ text: 'VerifyBot • Roblox Verification' });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      await interaction.editReply({ content: '❌ Failed to verify. Try again.' });
    }
  }

  if (interaction.commandName === 'whois') {
    const user = interaction.options.getUser('user');
    await interaction.reply({ content: `🔍 ${user.tag} — check their server nickname for their Roblox username.`, ephemeral: true });
  }
});

client.login(TOKEN);


