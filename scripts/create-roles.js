// One-off: create server roles if they don't exist yet. Run with `npm run create-roles`.
import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';

const ROLES = [
  { name: 'Video Editor', color: '#E67E22' },
  { name: 'Cyber Security', color: '#2ECC71' },
];

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once('clientReady', async () => {
  try {
    for (const guild of client.guilds.cache.values()) {
      const roles = await guild.roles.fetch();
      for (const r of ROLES) {
        if (roles.some((x) => x.name.toLowerCase() === r.name.toLowerCase())) {
          console.log(`= ${guild.name}: "${r.name}" already exists`);
          continue;
        }
        await guild.roles.create({ name: r.name, colors: { primaryColor: r.color }, reason: 'Shadow Bot create-roles' });
        console.log(`+ ${guild.name}: created "${r.name}"`);
      }
    }
  } catch (err) {
    console.error('Failed:', err.message, '(does the bot have Manage Roles?)');
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});
client.login(process.env.DISCORD_TOKEN);
