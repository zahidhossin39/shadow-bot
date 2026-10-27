import 'dotenv/config';
import { Client, Events, GatewayIntentBits, PermissionFlagsBits } from 'discord.js';
import * as memberAdd from './events/memberAdd.js';
import * as welcomeTest from './commands/welcomeTest.js';
import { config, findChannel } from './welcome/message.js';

if (!process.env.DISCORD_TOKEN) {
  console.error('Missing DISCORD_TOKEN. Create a file named .env in the Shadow-Bot folder with:\nDISCORD_TOKEN=your-bot-token');
  process.exit(1);
}

const commands = new Map([[welcomeTest.data.name, welcomeTest]]);

// GuildMembers is the privileged "Server Members Intent": without it, join events never arrive.
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.on(memberAdd.name, memberAdd.execute);

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`[/${interaction.commandName}]`, err);
    const msg = { content: 'Something went wrong. Check the bot console.' };
    if (interaction.deferred || interaction.replied) await interaction.editReply(msg).catch(() => {});
  }
});

client.once(Events.ClientReady, async (c) => {
  console.log(`Logged in as ${c.user.tag}`);
  const body = [...commands.values()].map((cmd) => cmd.data.toJSON());

  for (const guild of c.guilds.cache.values()) {
    // Guild commands show up instantly; global ones can take up to an hour.
    await guild.commands.set(body);
    console.log(`[${guild.name}] registered: ${body.map((b) => '/' + b.name).join(', ')}`);

    const channel = findChannel(guild, config.channels.welcome);
    if (!channel) {
      console.warn(`[${guild.name}] welcome channel "${config.channels.welcome}" not found`);
      continue;
    }
    const needed = ['ViewChannel', 'SendMessages', 'EmbedLinks', 'AttachFiles'];
    const missing = needed.filter((p) => !channel.permissionsFor(c.user)?.has(PermissionFlagsBits[p]));
    console.log(
      missing.length
        ? `[${guild.name}] #${channel.name}: bot is MISSING permissions: ${missing.join(', ')}`
        : `[${guild.name}] #${channel.name}: ready to post welcomes`,
    );
  }
});

client.login(process.env.DISCORD_TOKEN);
