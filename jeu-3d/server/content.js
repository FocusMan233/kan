// Contenu du jeu : quartiers, personnages, missions, phrases à traduire.
// Les phrases (champ `say`) sont en français ; les joueurs les traduisent en mooré / dioula.
// `sensitive: true` => les traductions ne sortent dans l'API qu'après approbation d'un admin
// (relecture par un professionnel de santé recommandée).
// `verify: true`   => contenu factuel à vérifier / mettre à jour par l'équipe avant diffusion.

export const LANGUAGES = [
  { code: 'moore', name: 'Mooré', iso: 'mos' },
  { code: 'dioula', name: 'Dioula', iso: 'dyu' },
];

export const QUARTIERS = [
  { id: 'gounghin', name: 'Gounghin', city: 'Ouagadougou', geocode: 'Gounghin, Ouagadougou, Burkina Faso',
    tagline: 'Les rues animées de l\'ouest', seed: 11, palette: 'chaud' },
  { id: 'dapoya', name: 'Dapoya', city: 'Ouagadougou', geocode: 'Dapoya, Ouagadougou, Burkina Faso',
    tagline: 'Entre commerces et ruelles', seed: 23, palette: 'ocre' },
  { id: 'zogona', name: 'Zogona', city: 'Ouagadougou', geocode: 'Zogona, Ouagadougou, Burkina Faso',
    tagline: 'Un quartier vivant et étudiant', seed: 37, palette: 'frais' },
  { id: 'tanghin', name: 'Tanghin', city: 'Ouagadougou', geocode: 'Tanghin, Ouagadougou, Burkina Faso',
    tagline: 'Grandes parcelles et grands arbres', seed: 41, palette: 'vert' },
];

export const ZONES = {
  quartier: { name: 'Vie du quartier', icon: '🏘️', color: '#e8a33d' },
  sante:    { name: 'Centre de santé', icon: '🏥', color: '#3aa6a0' },
  meeting:  { name: 'Place des bonnes nouvelles', icon: '📣', color: '#d9534f' },
  culture:  { name: 'Coin culturel', icon: '🎭', color: '#7b5ea7' },
};

// skin: 0 (clair) .. 5 (très foncé)
export const NPCS = {
  yaaba:      { name: 'Yaaba', role: 'Grand-mère', gender: 'f', age: 'elder', skin: 4, outfit: 'pagne', colors: ['#c0392b', '#f1c40f'], pattern: 3, head: 'foulard', hair: 'aucun', at: 'home' },
  voisine:    { name: 'Tantie Awa', role: 'Voisine', gender: 'f', age: 'adult', skin: 3, outfit: 'pagne', colors: ['#16a085', '#f39c12'], pattern: 7, head: 'foulard', hair: 'aucun', at: 'voisin1' },
  voisin:     { name: 'Oncle Boukary', role: 'Voisin', gender: 'm', age: 'adult', skin: 4, outfit: 'boubou', colors: ['#2c3e80', '#e8d9a0'], pattern: 2, head: 'kufi', hair: 'court', at: 'voisin2' },
  enfant:     { name: 'Salif', role: 'Écolier', gender: 'm', age: 'child', skin: 4, outfit: 'uniforme', colors: ['#2e86de', '#c8b26a'], pattern: 1, head: 'aucun', hair: 'court', at: 'voisin3' },
  tomates:    { name: 'Maman Fati', role: 'Vendeuse de tomates', gender: 'f', age: 'adult', skin: 3, outfit: 'pagne', colors: ['#e84393', '#fdcb6e'], pattern: 11, head: 'foulard', hair: 'aucun', at: 'market.t' },
  oignons:    { name: 'Boureima', role: 'Vendeur d\'oignons', gender: 'm', age: 'adult', skin: 5, outfit: 'chemise', colors: ['#6c5ce7', '#dfe6e9'], pattern: 5, head: 'casquette', hair: 'court', at: 'market.o' },
  riz:        { name: 'Tantie Mariam', role: 'Marchande de riz', gender: 'f', age: 'adult', skin: 4, outfit: 'pagne', colors: ['#00b894', '#fab1a0'], pattern: 14, head: 'foulard', hair: 'aucun', at: 'market.r' },
  moto:       { name: 'Issouf', role: 'Taxi-moto', gender: 'm', age: 'adult', skin: 4, outfit: 'tshirt', colors: ['#e17055', '#2d3436'], pattern: 0, head: 'casque', hair: 'court', at: 'taxi' },
  serveuse:   { name: 'Rasmata', role: 'Serveuse du maquis', gender: 'f', age: 'adult', skin: 3, outfit: 'tablier', colors: ['#d63031', '#ffeaa7'], pattern: 9, head: 'foulard', hair: 'aucun', at: 'maquis' },
  accueil:    { name: 'Adama', role: 'Agent d\'accueil', gender: 'm', age: 'adult', skin: 4, outfit: 'chemise', colors: ['#0984e3', '#ffffff'], pattern: 0, head: 'aucun', hair: 'court', at: 'csps.accueil' },
  infirmiere: { name: 'Mme Ouédraogo', role: 'Infirmière', gender: 'f', age: 'adult', skin: 4, outfit: 'blouse', colors: ['#ffffff', '#3aa6a0'], pattern: 0, head: 'foulard_blanc', hair: 'aucun', at: 'csps.consult' },
  sagefemme:  { name: 'Mme Kaboré', role: 'Sage-femme', gender: 'f', age: 'adult', skin: 3, outfit: 'blouse', colors: ['#ffffff', '#e84393'], pattern: 0, head: 'foulard_blanc', hair: 'aucun', at: 'csps.pre' },
  animateur:  { name: 'Le Maître de cérémonie', role: 'Animateur', gender: 'm', age: 'adult', skin: 4, outfit: 'boubou', colors: ['#a4161a', '#f1c40f'], pattern: 4, head: 'chapeau', hair: 'court', at: 'meeting.podium' },
  guide_sindou: { name: 'Seydou', role: 'Guide', gender: 'm', age: 'adult', skin: 4, outfit: 'chemise', colors: ['#1e7f4f', '#f4d03f'], pattern: 6, head: 'casquette', hair: 'court', at: 'culture.sindou' },
  guide_loro:   { name: 'Mariam', role: 'Guide', gender: 'f', age: 'adult', skin: 3, outfit: 'pagne', colors: ['#8e44ad', '#f1c40f'], pattern: 12, head: 'foulard', hair: 'aucun', at: 'culture.loro' },
  tisserand:    { name: 'Papa Dramane', role: 'Tisserand', gender: 'm', age: 'elder', skin: 5, outfit: 'boubou', colors: ['#7f4f24', '#f5deb3'], pattern: 8, head: 'bonnet', hair: 'court', beard: true, at: 'culture.faso' },
  cuisiniere:   { name: 'Tantie Pauline', role: 'Cuisinière', gender: 'f', age: 'adult', skin: 4, outfit: 'tablier', colors: ['#e67e22', '#ecf0f1'], pattern: 13, head: 'foulard', hair: 'aucun', at: 'culture.cuisine' },
};

// Chaque step : { npc, say } — `say` est la phrase française à traduire.
// Une mission est une suite de rencontres : le joueur est l'interprète de Yaaba.
// ---- Assistant maternité (voir server/maternite.js) --------------------------------
// Messages « de base » envoyés aux couples par l'assistant. Ils sont proposés aux joueurs
// comme mission de santé : la version mooré / dioula validée (et approuvée par l'admin,
// car sensible) est celle qui part par SMS ; à défaut, le message part en français.
// Le prénom et la date sont ajoutés autour du texte par l'assistant : pas de variable ici.
// ⚠ Contenu à faire relire par un professionnel de santé avant tout usage réel.
export const MATERNITE_MISSION_ID = 's4';
export const MATERNITE_CORES = [
  { id: 'welcome_mere', fr: 'Bienvenue dans le suivi de votre grossesse. Vous recevrez des conseils et des rappels de rendez-vous.' },
  { id: 'welcome_partenaire', fr: 'La future maman est inscrite au suivi de sa grossesse. Vous recevrez des conseils pour la soutenir.' },
  { id: 'cpn_mere', fr: 'Votre consultation prénatale approche. Allez au centre de santé avec votre carnet.' },
  { id: 'cpn_partenaire', fr: 'La consultation prénatale approche. Pensez au transport et accompagnez la future maman si possible. Votre soutien compte.' },
  { id: 'danger_mere', fr: 'En cas de saignement, de forte fièvre, de maux de tête sévères ou de fortes douleurs au ventre, allez tout de suite au centre de santé.' },
  { id: 'danger_partenaire', fr: 'En cas de saignement, de forte fièvre, de maux de tête sévères ou de fortes douleurs au ventre, conduisez la future maman tout de suite au centre de santé.' },
  { id: 'move_mere', fr: 'À ce stade, vous pouvez sentir bébé bouger. Si bébé ne bouge plus, allez au centre de santé.' },
  { id: 'term_mere', fr: 'L\'accouchement approche. Préparez votre sac et le transport vers le centre de santé.' },
  { id: 'term_partenaire', fr: 'L\'accouchement approche. Préparez le transport et un peu d\'argent, et restez joignable.' },
  { id: 'alert_partenaire', fr: 'Un signe de danger a été signalé. Suivez les conseils de l\'agent de santé et allez au centre de santé.' },
];
export const MISSIONS = [
  { id: 'q1', zone: 'quartier', level: 1, reward: 40, title: 'Bonjour le quartier',
    summary: 'Salue les voisins comme il se doit.',
    intro: 'Yaaba ne parle que la langue du pays. Aide-la à saluer ses voisins : traduis ce qu\'on lui dit.',
    steps: [
      { npc: 'voisine', say: 'Bonjour, comment vas-tu ce matin ?' },
      { npc: 'voisin',  say: 'Comment va ta famille ?' },
      { npc: 'enfant',  say: 'Merci beaucoup, et à bientôt.' },
      { npc: 'voisine', say: 'Bonne journée, à demain !' },
    ] },
  { id: 'q2', zone: 'quartier', level: 1, reward: 60, title: 'Les courses au marché',
    summary: 'Achète tomates, oignons et riz pour la famille.',
    intro: 'Yaaba veut préparer le repas. Accompagne-la au marché et traduis les échanges avec les vendeurs.',
    steps: [
      { npc: 'tomates', say: 'Bonjour maman, que voulez-vous acheter aujourd\'hui ?' },
      { npc: 'tomates', say: 'Les tomates sont à cinq cents francs le tas.' },
      { npc: 'oignons', say: 'C\'est trop cher, faites-moi un meilleur prix.' },
      { npc: 'oignons', say: 'D\'accord, je prends deux tas d\'oignons.' },
      { npc: 'riz',     say: 'Voici l\'argent, merci et bonne vente !' },
    ] },
  { id: 'q3', zone: 'quartier', level: 2, reward: 70, title: 'Le taxi-moto',
    summary: 'Négocie la course et guide le conducteur.',
    intro: 'Yaaba doit se rendre en ville. Traduis pour le conducteur de moto-taxi.',
    steps: [
      { npc: 'moto', say: 'Bonjour, je voudrais aller au grand marché.' },
      { npc: 'moto', say: 'Combien coûte la course ?' },
      { npc: 'moto', say: 'Tourne à gauche au prochain carrefour.' },
      { npc: 'moto', say: 'Tout droit, puis arrête-toi devant la pharmacie.' },
      { npc: 'moto', say: 'Voici ta monnaie, fais attention sur la route.' },
    ] },
  { id: 'q4', zone: 'quartier', level: 2, reward: 70, title: 'Un repas au maquis',
    summary: 'Commande poulet braisé, riz et bissap.',
    intro: 'Yaaba invite la famille au maquis. Aide-la à commander.',
    steps: [
      { npc: 'serveuse', say: 'Bienvenue ! Voici la carte, que désirez-vous ?' },
      { npc: 'serveuse', say: 'Je voudrais du poulet braisé avec du riz et du bissap.' },
      { npc: 'serveuse', say: 'Ce sera prêt dans dix minutes.' },
      { npc: 'serveuse', say: 'Pouvez-vous apporter de l\'eau, s\'il vous plaît ?' },
      { npc: 'serveuse', say: 'L\'addition, s\'il vous plaît. Le repas était délicieux.' },
    ] },

  { id: 's1', zone: 'sante', level: 2, reward: 70, sensitive: true, title: 'À l\'accueil du centre de santé',
    summary: 'Accompagne Yaaba à l\'accueil.',
    intro: 'Yaaba se rend au centre de santé. Traduis ce que dit l\'agent d\'accueil. (Simulation de jeu, pas un conseil médical.)',
    steps: [
      { npc: 'accueil', say: 'Bonjour, avez-vous votre carnet de santé ?' },
      { npc: 'accueil', say: 'Asseyez-vous, l\'infirmière va vous appeler.' },
      { npc: 'accueil', say: 'Veuillez passer à la caisse avant la consultation.' },
      { npc: 'accueil', say: 'Merci de patienter, c\'est bientôt votre tour.' },
    ] },
  { id: 's2', zone: 'sante', level: 3, reward: 90, sensitive: true, title: 'Un enfant a de la fièvre',
    summary: 'Traduis la consultation d\'un enfant malade.',
    intro: 'Le petit-fils de Yaaba a de la fièvre. Traduis la consultation. (Simulation de jeu, pas un conseil médical.)',
    steps: [
      { npc: 'infirmiere', say: 'Bonjour, qu\'est-ce qui ne va pas chez l\'enfant ?' },
      { npc: 'infirmiere', say: 'Depuis combien de jours a-t-il de la fièvre ?' },
      { npc: 'infirmiere', say: 'Est-ce qu\'il mange et il boit normalement ?' },
      { npc: 'infirmiere', say: 'Donnez-lui beaucoup à boire et gardez-le au frais.' },
      { npc: 'infirmiere', say: 'Si la fièvre augmente ou s\'il vomit, revenez tout de suite.' },
    ] },
  { id: 's3', zone: 'sante', level: 3, reward: 90, sensitive: true, title: 'Consultation prénatale',
    summary: 'Aide une future maman à comprendre sa consultation.',
    intro: 'La nièce de Yaaba attend un bébé. Traduis sa première consultation. (Simulation de jeu, pas un conseil médical.)',
    steps: [
      { npc: 'sagefemme', say: 'Bonjour madame, bienvenue au centre de santé.' },
      { npc: 'sagefemme', say: 'Est-ce votre première consultation depuis le début de la grossesse ?' },
      { npc: 'sagefemme', say: 'Avez-vous des douleurs, des saignements ou des maux de tête ?' },
      { npc: 'sagefemme', say: 'Prenez vos comprimés de fer chaque jour et dormez sous une moustiquaire.' },
      { npc: 'sagefemme', say: 'Revenez pour la prochaine consultation dans un mois.' },
    ] },

  { id: 's4', zone: 'sante', level: 3, reward: 90, sensitive: true, verify: true, title: 'Ma grossesse, mon couple',
    summary: 'Traduis les conseils envoyés aux futurs parents.',
    intro: 'La sage-femme envoie des conseils par SMS et par message vocal aux futurs parents. Traduis-les : ils serviront à l\'assistant maternité. (Simulation de jeu, pas un conseil médical.)',
    steps: MATERNITE_CORES.map(c => ({ npc: 'sagefemme', say: c.fr })) },

  { id: 'm1', zone: 'meeting', level: 2, reward: 70, title: 'Le meeting du quartier',
    summary: 'Traduis le discours de bienvenue.',
    intro: 'Toute la place est réunie. Yaaba veut comprendre le discours : traduis-le pour elle.',
    steps: [
      { npc: 'animateur', say: 'Chers habitants du quartier, bonsoir et bienvenue !' },
      { npc: 'animateur', say: 'Aujourd\'hui, nous célébrons le travail et la créativité de notre pays.' },
      { npc: 'animateur', say: 'Le Burkina est connu pour son cinéma, son artisanat et sa culture.' },
      { npc: 'animateur', say: 'Ensemble, construisons un quartier propre, uni et accueillant.' },
      { npc: 'animateur', say: 'Merci à tous d\'être venus, et bonne soirée !' },
    ] },
  { id: 'm2', zone: 'meeting', level: 2, reward: 70, verify: true, title: 'Les bonnes nouvelles du Burkina',
    summary: 'Fais connaître les belles choses du pays.',
    intro: 'L\'animateur annonce des bonnes nouvelles du pays. Traduis-les pour Yaaba.',
    steps: [
      { npc: 'animateur', say: 'Le FESPACO, grand festival de cinéma africain, se tient à Ouagadougou.' },
      { npc: 'animateur', say: 'Le Salon international de l\'artisanat de Ouagadougou réunit des artisans de nombreux pays.' },
      { npc: 'animateur', say: 'Le coton est l\'une des grandes richesses agricoles du pays.' },
      { npc: 'animateur', say: 'Les tisserands burkinabè fabriquent le Faso Dan Fani, un tissu traditionnel.' },
      { npc: 'animateur', say: 'Des jeunes inventent des applications utiles pour leur quartier.' },
    ] },

  { id: 'c1', zone: 'culture', level: 2, reward: 70, title: 'Les pics de Sindou',
    summary: 'Découvre de grands rochers sculptés par le temps.',
    intro: 'Le guide présente un site célèbre de l\'ouest du pays. Traduis pour Yaaba.',
    steps: [
      { npc: 'guide_sindou', say: 'Bienvenue aux pics de Sindou, de grands rochers sculptés par le temps.' },
      { npc: 'guide_sindou', say: 'Cette région se trouve dans l\'ouest du pays, près de Banfora.' },
      { npc: 'guide_sindou', say: 'Beaucoup de visiteurs viennent y marcher et admirer le paysage.' },
      { npc: 'guide_sindou', say: 'Respectons la nature et ne laissons aucun déchet.' },
    ] },
  { id: 'c2', zone: 'culture', level: 2, reward: 70, verify: true, title: 'Les ruines de Loropéni',
    summary: 'Visite un site du patrimoine mondial.',
    intro: 'La guide raconte l\'histoire d\'un site classé à l\'UNESCO. Traduis pour Yaaba.',
    steps: [
      { npc: 'guide_loro', say: 'Voici les ruines de Loropéni, un site classé au patrimoine mondial de l\'UNESCO.' },
      { npc: 'guide_loro', say: 'Ces grands murs de pierre sont très anciens.' },
      { npc: 'guide_loro', say: 'On pense qu\'ils protégeaient une ancienne cité liée au commerce de l\'or.' },
      { npc: 'guide_loro', say: 'Merci de visiter le site avec respect.' },
    ] },
  { id: 'c3', zone: 'culture', level: 2, reward: 70, title: 'Le tissage du Faso Dan Fani',
    summary: 'Apprends comment on tisse le pagne traditionnel.',
    intro: 'Le tisserand montre son métier. Traduis ses explications pour Yaaba.',
    steps: [
      { npc: 'tisserand', say: 'Ce tissu est fabriqué à la main sur un métier à tisser.' },
      { npc: 'tisserand', say: 'Chaque motif et chaque couleur a son histoire.' },
      { npc: 'tisserand', say: 'Le coton est filé, teint, puis tissé en bandes étroites.' },
      { npc: 'tisserand', say: 'Les bandes sont cousues ensemble pour faire un vêtement.' },
    ] },
  { id: 'c4', zone: 'culture', level: 1, reward: 60, title: 'La cuisine du Faso',
    summary: 'Découvre le tô, la sauce et le bissap.',
    intro: 'La cuisinière présente les plats du pays. Traduis pour Yaaba.',
    steps: [
      { npc: 'cuisiniere', say: 'Le tô est fait avec de la farine de mil ou de maïs.' },
      { npc: 'cuisiniere', say: 'On le mange avec une sauce de gombo ou de feuilles.' },
      { npc: 'cuisiniere', say: 'Le bissap est une boisson fraîche faite avec des fleurs d\'hibiscus.' },
      { npc: 'cuisiniere', say: 'Mangeons ensemble, c\'est la tradition du partage.' },
    ] },
];

export function promptKey(missionId, i) { return `${missionId}.${i + 1}`; }

export function maternitePromptKey(coreId) {
  const i = MATERNITE_CORES.findIndex(c => c.id === coreId);
  return i < 0 ? null : promptKey(MATERNITE_MISSION_ID, i);
}

export function allPromptSeeds() {
  const out = [];
  for (const m of MISSIONS) {
    m.steps.forEach((s, i) => out.push({
      key: promptKey(m.id, i), zone: m.zone, mission_id: m.id, text_fr: s.say,
      sensitive: m.sensitive ? 1 : 0, level: m.level, verify: m.verify ? 1 : 0,
    }));
  }
  return out;
}
