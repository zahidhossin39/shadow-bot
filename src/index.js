import 'dotenv/config';
import { Client, Events, GatewayIntentBits, Partials, PermissionFlagsBits } from 'discord.js';
import * as memberAdd from './events/memberAdd.js';
import * as memberRemove from './events/memberRemove.js';
import * as welcomeTest from './commands/welcomeTest.js';
import { handleWelcomeInteraction } from './welcome/interactions.js';
import { config, findChannel, findRole } from './welcome/message.js';

if (!process.env.DISCORD_TOKEN) {
  console.error('Missing DISCORD_TOKEN. Create a file named .env in the Shadow-Bot folder with:\nDISCORD_TOKEN=your-bot-token');
  process.exit(1);
}

const commands = new Map([[welcomeTest.data.name, welcomeTest]]);

// GuildMembers is the privileged "Server Members Intent": without it, join events never arrive.
// Partials.GuildMember: members who joined before the bot started aren't cached,
// and without this their leave events would be dropped silently.
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.GuildMember],
});

client.on(memberAdd.name, memberAdd.execute);
client.on(memberRemove.name, memberRemove.execute);

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (command) await command.execute(interaction);
      return;
    }
    await handleWelcomeInteraction(interaction);
  } catch (err) {
    console.error(`[interaction ${interaction.commandName ?? interaction.customId}]`, err);
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

    // Role picker: report missing roles and roles the bot is too low to hand out.
    const me = guild.members.me;
    const roleNotes = config.interestRoles.map(({ role }) => {
      const r = findRole(guild, role);
      if (!r) return `${role}: NOT FOUND`;
      return r.position >= me.roles.highest.position ? `${r.name}: bot role is BELOW it` : `${r.name}: ok`;
    });
    const canManage = me.permissions.has(PermissionFlagsBits.ManageRoles);
    console.log(`[${guild.name}] role picker: ${roleNotes.join(', ')}${canManage ? '' : ' (bot is MISSING Manage Roles)'}`);

    const channel = findChannel(guild, config.channels.welcome);
    if (!channel) {
      const names = guild.channels.cache.filter((ch) => ch.isTextBased()).map((ch) => ch.name);
      console.warn(`[${guild.name}] welcome channel "${config.channels.welcome}" not found. Text channels: ${names.join(', ')}`);
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

client.login(process.env.DISCORD_TOKEN).catch((err) => {
  if (err.message.includes('disallowed intents')) {
    console.error(
      'Discord refused the connection: "Server Members Intent" is off for this bot.\n' +
        'Fix: discord.com/developers/applications → your app → Bot → Privileged Gateway Intents →\n' +
        'turn on SERVER MEMBERS INTENT → click "Save Changes" at the bottom, then start the bot again.',
    );
  } else if (err.code === 'TokenInvalid') {
    console.error('Discord rejected the token. Reset it in the Developer Portal (Bot → Reset Token) and update .env.');
  } else {
    console.error('Login failed:', err);
  }
  process.exit(1);
});
