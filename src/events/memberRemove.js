import { Events } from 'discord.js';
import { buildGoodbyeMessage, config, findChannel } from '../welcome/message.js';

export const name = Events.GuildMemberRemove;

export async function execute(member) {
  if (member.user.bot) return;

  const channel = findChannel(member.guild, config.channels.goodbye);
  if (!channel) {
    console.warn(`[leave] goodbye channel "${config.channels.goodbye}" not found in ${member.guild.name}`);
    return;
  }

  try {
    await channel.send(await buildGoodbyeMessage(member));
    console.log(`[leave] said goodbye to ${member.user.tag}`);
  } catch (err) {
    console.error(`[leave] failed to say goodbye to ${member.user.tag}:`, err);
  }
}
