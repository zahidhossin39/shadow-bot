import { Events } from 'discord.js';
import { buildWelcomeMessage, config, findChannel } from '../welcome/message.js';

export const name = Events.GuildMemberAdd;

export async function execute(member) {
  if (member.user.bot) return;

  const channel = findChannel(member.guild, config.channels.welcome);
  if (!channel) {
    console.warn(`[join] welcome channel "${config.channels.welcome}" not found in ${member.guild.name}`);
    return;
  }

  try {
    await channel.send(await buildWelcomeMessage(member));
    console.log(`[join] welcomed ${member.user.tag} as #${member.guild.memberCount}`);
  } catch (err) {
    // Log and carry on: one failed welcome shouldn't take the bot down.
    console.error(`[join] failed to welcome ${member.user.tag}:`, err);
  }
}
