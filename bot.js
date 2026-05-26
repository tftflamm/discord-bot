require('dotenv').config();
const { Client, GatewayIntentBits, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ══════════════════════════════════════════
//  CONFIGURATION — Adapte ces valeurs !
// ══════════════════════════════════════════
const CONFIG = {
  // Nom des catégories à créer automatiquement
  categories: {
    info:   '📋 INFORMATIONS',
    text:   '💬 DISCUSSION',
    vocal:  '🎙️ VOCAUX',
  },

  // Salons textuels à créer
  textChannels: [
    { name: 'général',       topic: 'Discussion générale du serveur' },
    { name: 'annonces',      topic: 'Annonces officielles', readOnly: true },
    { name: 'présentations', topic: 'Présente-toi à la communauté !' },
  ],

  // Salons vocaux à créer
  voiceChannels: [
    { name: '🎮 Jeu #1' },
    { name: '🎮 Jeu #2' },
    { name: '☕ Détente' },
  ],

  // Message de bienvenue
  welcomeEmbed: {
    title: '👋 Bienvenue sur le serveur !',
    description: [
      '**Avant tout, lis le règlement ci-dessous.**',
      '',
      'Une fois lu, clique sur le bouton ✅ pour accéder au reste du serveur.',
    ].join('\n'),
    color: 0x5865F2, // Bleu Discord
    rulesTitle: '📜 Règlement',
    rules: [
      '**1.** Respecte tous les membres.',
      '**2.** Pas de spam ni de pub non autorisée.',
      '**3.** Reste dans le sujet de chaque salon.',
      '**4.** Aucune image/vidéo choquante.',
      '**5.** Suis les consignes des modérateurs.',
    ],
  },

  // Nom du rôle attribué après validation
  memberRoleName: 'Membre',
};
// ══════════════════════════════════════════

// ── Commande de setup (tape !setup dans ton Discord) ──────────────────────────
client.on('messageCreate', async (message) => {
  if (message.content !== '!setup') return;
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return message.reply('❌ Tu dois être administrateur pour utiliser cette commande.');
  }

  const guild = message.guild;
  await message.reply('⚙️ Configuration en cours...');

  try {
    // 1. Crée (ou récupère) le rôle Membre
    let memberRole = guild.roles.cache.find(r => r.name === CONFIG.memberRoleName);
    if (!memberRole) {
      memberRole = await guild.roles.create({
        name: CONFIG.memberRoleName,
        color: 0x57F287,
        reason: 'Rôle créé automatiquement par le bot',
      });
    }

    // 2. Catégorie INFORMATIONS (visible par tout le monde, même sans rôle)
    const catInfo = await guild.channels.create({
      name: CONFIG.categories.info,
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          allow: [PermissionFlagsBits.ViewChannel],
          deny:  [PermissionFlagsBits.SendMessages],
        },
      ],
    });

    // Salon #règles avec bouton de validation
    const rulesChannel = await guild.channels.create({
      name: 'règles',
      type: ChannelType.GuildText,
      parent: catInfo.id,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
          deny:  [PermissionFlagsBits.SendMessages],
        },
      ],
    });

    // 3. Catégorie DISCUSSION (visible uniquement par les Membres)
    const catText = await guild.channels.create({
      name: CONFIG.categories.text,
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
        { id: memberRole.id,        allow: [PermissionFlagsBits.ViewChannel] },
      ],
    });

    for (const ch of CONFIG.textChannels) {
      const overrides = [
        { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: memberRole.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
          ...(ch.readOnly ? { deny: [PermissionFlagsBits.SendMessages] } : { allow: [PermissionFlagsBits.SendMessages] }),
        },
      ];
      await guild.channels.create({
        name: ch.name,
        type: ChannelType.GuildText,
        topic: ch.topic,
        parent: catText.id,
        permissionOverwrites: overrides,
      });
    }

    // 4. Catégorie VOCAUX (visible uniquement par les Membres)
    const catVoice = await guild.channels.create({
      name: CONFIG.categories.vocal,
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
        { id: memberRole.id,        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] },
      ],
    });

    for (const ch of CONFIG.voiceChannels) {
      await guild.channels.create({
        name: ch.name,
        type: ChannelType.GuildVoice,
        parent: catVoice.id,
        permissionOverwrites: [
          { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
          { id: memberRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
        ],
      });
    }

    // 5. Envoie le message de règlement avec le bouton
    const { welcomeEmbed: cfg } = CONFIG;

    const embed = new EmbedBuilder()
      .setTitle(cfg.title)
      .setDescription(cfg.description)
      .addFields({ name: cfg.rulesTitle, value: cfg.rules.join('\n') })
      .setColor(cfg.color)
      .setFooter({ text: 'Clique sur ✅ pour rejoindre le serveur' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('accept_rules')
        .setLabel('✅ J\'accepte le règlement')
        .setStyle(ButtonStyle.Success),
    );

    await rulesChannel.send({ embeds: [embed], components: [row] });

    await message.reply(`✅ **Serveur configuré avec succès !**\n\n📋 Règles → <#${rulesChannel.id}>\n💬 ${CONFIG.textChannels.length} salons textuels créés\n🎙️ ${CONFIG.voiceChannels.length} salons vocaux créés`);

  } catch (err) {
    console.error(err);
    await message.reply('❌ Une erreur est survenue : ' + err.message);
  }
});

// ── Validation du règlement via le bouton ─────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton() || interaction.customId !== 'accept_rules') return;

  const guild = interaction.guild;
  const member = interaction.member;
  const memberRole = guild.roles.cache.find(r => r.name === CONFIG.memberRoleName);

  if (!memberRole) {
    return interaction.reply({ content: '❌ Rôle introuvable. Contacte un admin.', ephemeral: true });
  }

  if (member.roles.cache.has(memberRole.id)) {
    return interaction.reply({ content: '✅ Tu as déjà accès au serveur !', ephemeral: true });
  }

  await member.roles.add(memberRole);
  await interaction.reply({
    content: '🎉 Bienvenue ! Tu as maintenant accès à tous les salons. Amuse-toi bien !',
    ephemeral: true,
  });
});

// ── Message de bienvenue automatique à l'arrivée ──────────────────────────────
client.on('guildMemberAdd', async (member) => {
  const guild = member.guild;

  // Cherche le salon #règles
  const rulesChannel = guild.channels.cache.find(
    c => c.name === 'règles' && c.type === ChannelType.GuildText
  );
  if (!rulesChannel) return;

  await rulesChannel.send({
    content: `👋 Bienvenue <@${member.id}> ! Lis les règles ci-dessus et clique sur ✅ pour accéder au serveur.`,
  });
});

// ── Démarrage ─────────────────────────────────────────────────────────────────
client.once('ready', () => {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`);
  console.log(`📡 Serveurs : ${client.guilds.cache.size}`);
});

client.login(process.env.DISCORD_TOKEN);
